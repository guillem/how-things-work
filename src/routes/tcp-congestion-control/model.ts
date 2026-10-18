/**
 * TCP congestion control: a seeded, packet-level, discrete-event simulation of several TCP
 * senders sharing one bottleneck link with a drop-tail queue.
 *
 * Every packet is one full-size segment (MSS = 1500 bytes). A flow's path is: sender → (a
 * quarter of its base round trip) → the bottleneck router's queue → the bottleneck link, which
 * sends `rate` packets a second → (a quarter) → receiver → (half) → the acknowledgement back at
 * the sender. Acknowledgements are never lost or queued (the reverse path is idle).
 *
 * Senders (`Algo`):
 * - 'reno': Reno with selective acknowledgements, as modern stacks run it: RFC 5681 slow start
 *   and congestion avoidance; fast retransmit and loss recovery driven by SACK (RFC 2018,
 *   RFC 6675: a packet is lost once three later ones have arrived; the window is halved once
 *   per window of data); RFC 6298 retransmission timer with exponential backoff and a 200 ms
 *   minimum (as in Linux). One acknowledgement per packet (no delayed ACKs).
 * - 'cubic': CUBIC (RFC 9438): W(t) = C(t − K)³ + W_max with C = 0.4 and β = 0.7, its
 *   Reno-friendly region and fast convergence. Loss handling as NewReno.
 * - 'vegas': TCP Vegas (Brakmo & Peterson 1995): once a round trip it compares the expected rate
 *   cwnd/baseRTT with the actual one cwnd/RTT, and keeps between α = 2 and β = 4 of its own
 *   packets queued; halves on loss like Reno.
 * - 'mimd': Reno with multiplicative increase (5 % a round trip) instead of additive, for Chiu &
 *   Jain's comparison.
 * - 'nobackoff': TCP before Jacobson (1988): it keeps a full receiver window in flight whatever
 *   happens, has no fast retransmit, and gives every packet its own timer of twice the smoothed
 *   round trip (RFC 793), never backed off; it times the round trip from a packet's latest
 *   transmission, so an ACK of the original that arrives after a resend reads as a short round
 *   trip (the ambiguity Karn & Partridge 1987 resolved).
 *
 * The receiver keeps out-of-order packets and acknowledges cumulatively (the next packet it
 * needs), echoing the send time of the packet that triggered the ACK (TCP timestamps), which the
 * sender uses to measure the round trip.
 */
import { rng } from '#lib/draw/math.ts';

export type Algo = 'reno' | 'cubic' | 'vegas' | 'mimd' | 'nobackoff';

/** Bytes per packet. */
export const MSS = 1500;

export interface FlowSpec {
	/** Base (propagation) round-trip time, s. */
	rtt: number;
	algo?: Algo;
	/** When the flow starts sending, s. */
	start?: number;
	/** Starting congestion window, packets (default 1... 10 as in RFC 6928 is not used: 2). */
	cwnd0?: number;
	/** Starting slow-start threshold, packets (default: unlimited). */
	ssthresh0?: number;
	/** Receiver's window, packets (flow control). Default: unlimited. */
	rwnd?: number;
}

export interface LinkSpec {
	/** Bottleneck rate, packets per second. */
	rate: number;
	/** Queue size, packets (drop-tail: an arrival that finds it full is dropped). */
	buffer: number;
	/** Probability that the link loses a packet at random (noise), independent of the queue. */
	loss?: number;
}

export interface SimOptions {
	link: LinkSpec;
	flows: FlowSpec[];
	/** Simulated seconds. */
	until: number;
	seed?: number;
	/** Sampling interval of the traces, s (default 0.05). */
	every?: number;
	/** Keep a log of every packet sent between these times (for the animated pipe). */
	logFrom?: number;
	logUntil?: number;
}

export interface Sample {
	t: number;
	/** Congestion window per flow, packets. */
	cwnd: number[];
	/** Delivered (new, in order) per flow over the last interval, packets per second. */
	rate: number[];
	/** Packets in the bottleneck queue (including the one being sent). */
	queue: number;
	/** Latest round-trip sample per flow, s. */
	rtt: number[];
}

export interface FlowStats {
	/** Packets delivered to the application, in order, each counted once. */
	delivered: number;
	/** Packets that reached the receiver, duplicates included. */
	received: number;
	/** Transmissions, retransmissions included. */
	sent: number;
	retransmits: number;
	/** Packets dropped at the full queue. */
	drops: number;
	/** Packets lost to the link's random loss. */
	noise: number;
	/** Fast retransmits (one per window with losses). */
	lossEvents: number;
	timeouts: number;
	/** Mean of the round-trip samples, s. */
	meanRtt: number;
}

export interface PacketLog {
	flow: number;
	seq: number;
	/** Left the sender. */
	sent: number;
	/** Reached the queue. */
	atQueue: number;
	/** Left the bottleneck link (−1: dropped at the queue, −2: lost on the link). */
	out: number;
	/** Reached the receiver. */
	recv: number;
	/** Its acknowledgement reached the sender. */
	acked: number;
	retransmit: boolean;
}

export interface SimResult {
	samples: Sample[];
	flows: FlowStats[];
	packets: PacketLog[];
	/** Losses detected (fast retransmit or timeout): time and flow. */
	losses: { t: number; flow: number; timeout: boolean }[];
	until: number;
}

// ---- event queue ------------------------------------------------------------------------------

const Ev = { Start: 0, AtQueue: 1, Depart: 2, Recv: 3, Ack: 4, Timer: 5 } as const;
type Ev = (typeof Ev)[keyof typeof Ev];

interface Event {
	t: number;
	/** Tie-breaker: events at the same time run in the order they were scheduled. */
	n: number;
	kind: Ev;
	flow: number;
	seq: number;
	/** The data packet an ACK acknowledges. */
	d: number;
	/** Send time echoed back (Recv, Ack) or timer generation (Timer). */
	x: number;
	log: number;
}

class Heap {
	private a: Event[] = [];
	get size() {
		return this.a.length;
	}
	push(e: Event) {
		const a = this.a;
		a.push(e);
		let i = a.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (less(a[p], a[i])) break;
			[a[p], a[i]] = [a[i], a[p]];
			i = p;
		}
	}
	pop(): Event {
		const a = this.a;
		const top = a[0];
		const last = a.pop() as Event;
		if (a.length > 0) {
			a[0] = last;
			let i = 0;
			for (;;) {
				const l = 2 * i + 1;
				const r = l + 1;
				let m = i;
				if (l < a.length && less(a[l], a[m])) m = l;
				if (r < a.length && less(a[r], a[m])) m = r;
				if (m === i) break;
				[a[m], a[i]] = [a[i], a[m]];
				i = m;
			}
		}
		return top;
	}
}
const less = (x: Event, y: Event) => x.t < y.t || (x.t === y.t && x.n < y.n);

// ---- constants ---------------------------------------------------------------------------------

/** RFC 9438 constants. */
export const CUBIC = { C: 0.4, beta: 0.7 };
/** Vegas thresholds, packets queued. */
export const VEGAS = { alpha: 2, beta: 4, gamma: 1 };
const MIN_RTO = 0.2;
const DUP_THRESH = 3;
const MAX_RTO = 60;
/** MIMD increase per round trip. */
const MIMD_GAIN = 0.05;

interface Sender {
	spec: Required<Omit<FlowSpec, 'ssthresh0'>> & { ssthresh0: number };
	una: number;
	nxt: number;
	/** One past the highest sequence number ever sent. */
	high: number;
	cwnd: number;
	ssthresh: number;
	/** Packets the receiver reported holding above `una` (SACK). */
	sacked: Set<number>;
	hiSacked: number;
	/** Packets resent in the current recovery. */
	rexmit: Set<number>;
	/** After a timeout, everything below this that is not SACKed counts as lost. */
	lostBelow: number;
	/** Where the search for the next lost packet resumes. */
	scan: number;
	/** 'nobackoff': when each outstanding packet was last sent. */
	lastSent: Map<number, number>;
	recovery: boolean;
	recover: number;
	srtt: number;
	rttvar: number;
	rto: number;
	timerGen: number;
	lastRtt: number;
	minRtt: number;
	// cubic
	wMax: number;
	wLastMax: number;
	epoch: number;
	k: number;
	wEst: number;
	cwndEpoch: number;
	// vegas
	vMark: number;
	vMinRtt: number;
	vSlow: boolean;
	// receiver
	rcvNxt: number;
	ooo: Set<number>;
	// stats
	st: FlowStats;
	rttSum: number;
	rttN: number;
	deliveredSince: number;
}

/** Runs the simulation. Same options and seed, same result. */
export function simulate(opts: SimOptions): SimResult {
	const { link, until } = opts;
	const every = opts.every ?? 0.05;
	const logFrom = opts.logFrom ?? 0;
	const logUntil = opts.logUntil ?? 0;
	const random = rng(opts.seed ?? 1);
	const service = 1 / link.rate;
	const heap = new Heap();
	let n = 0;
	const at = (t: number, kind: Ev, flow: number, seq = 0, x = 0, log = -1, d = 0) =>
		heap.push({ t, n: n++, kind, flow, seq, x, log, d });

	const S: Sender[] = opts.flows.map((f, i) => {
		const spec = {
			rtt: f.rtt,
			algo: f.algo ?? 'reno',
			start: f.start ?? 0,
			cwnd0: f.cwnd0 ?? 2,
			ssthresh0: f.ssthresh0 ?? Infinity,
			rwnd: f.rwnd ?? Infinity
		};
		at(spec.start, Ev.Start, i);
		return {
			spec,
			una: 0,
			nxt: 0,
			high: 0,
			cwnd: spec.algo === 'nobackoff' ? spec.rwnd : spec.cwnd0,
			ssthresh: spec.ssthresh0,
			sacked: new Set(),
			hiSacked: -1,
			rexmit: new Set(),
			lostBelow: 0,
			scan: 0,
			lastSent: new Map(),
			recovery: false,
			recover: 0,
			srtt: 0,
			rttvar: 0,
			rto: 1,
			timerGen: 0,
			lastRtt: f.rtt,
			minRtt: Infinity,
			wMax: 0,
			wLastMax: 0,
			epoch: -1,
			k: 0,
			wEst: 0,
			cwndEpoch: 0,
			vMark: 0,
			vMinRtt: Infinity,
			vSlow: true,
			rcvNxt: 0,
			ooo: new Set(),
			st: {
				delivered: 0,
				received: 0,
				sent: 0,
				retransmits: 0,
				drops: 0,
				noise: 0,
				lossEvents: 0,
				timeouts: 0,
				meanRtt: 0
			},
			rttSum: 0,
			rttN: 0,
			deliveredSince: 0
		};
	});

	// bottleneck queue: FIFO of [flow, seq, sentAt, log]
	const q: { flow: number; seq: number; x: number; log: number }[] = [];
	let qHead = 0;
	const qLen = () => q.length - qHead;

	const packets: PacketLog[] = [];
	const losses: SimResult['losses'] = [];
	const samples: Sample[] = [];
	let nextSample = 0;

	const window = (s: Sender) => Math.min(s.spec.rwnd, Math.max(1, Math.floor(s.cwnd)));

	function transmit(i: number, seq: number, now: number) {
		const s = S[i];
		s.st.sent++;
		const re = seq < s.high;
		if (re) s.st.retransmits++;
		else s.high = seq + 1;
		let log = -1;
		if (now >= logFrom && now < logUntil) {
			log = packets.length;
			packets.push({
				flow: i,
				seq,
				sent: now,
				atQueue: now + s.spec.rtt / 4,
				out: -1,
				recv: -1,
				acked: -1,
				retransmit: re
			});
		}
		at(now + s.spec.rtt / 4, Ev.AtQueue, i, seq, now, log);
		if (s.spec.algo === 'nobackoff') {
			// a timer for every packet, as in RFC 793
			s.lastSent.set(seq, now);
			at(now + s.rto, Ev.Timer, i, seq, now);
		}
	}

	function armTimer(i: number, now: number) {
		const s = S[i];
		if (s.spec.algo === 'nobackoff') return;
		s.timerGen++;
		if (s.nxt > s.una) at(now + s.rto, Ev.Timer, i, 0, s.timerGen);
	}

	/**
	 * RFC 6675's IsLost: a packet the receiver has not reported is taken as lost once it has
	 * reported three later ones, or after a timeout everything that was outstanding.
	 */
	const isLost = (s: Sender, x: number) =>
		!s.sacked.has(x) && (x + DUP_THRESH <= s.hiSacked || x < s.lostBelow);

	/** Packets the sender believes are still in the network (RFC 6675's "pipe"). */
	function pipe(s: Sender) {
		if (s.sacked.size === 0 && s.lostBelow <= s.una) return s.nxt - s.una;
		let p = 0;
		for (let x = s.una; x < s.nxt; x++) {
			if (s.sacked.has(x)) continue;
			if (isLost(s, x) && !s.rexmit.has(x)) continue;
			p++;
			if (s.rexmit.has(x) && !isLost(s, x)) p++;
		}
		return p;
	}

	/** The lowest packet taken as lost and not yet resent, or −1. */
	function nextLost(s: Sender) {
		const limit = Math.min(s.nxt, Math.max(s.hiSacked - DUP_THRESH + 1, s.lostBelow));
		for (let x = Math.max(s.scan, s.una); x < limit; x++) {
			if (isLost(s, x) && !s.rexmit.has(x)) return x;
			s.scan = x + 1;
		}
		return -1;
	}

	function sendMore(i: number, now: number) {
		const s = S[i];
		const idle = s.nxt === s.una;
		if (s.spec.algo === 'nobackoff') {
			while (s.nxt - s.una < window(s)) {
				transmit(i, s.nxt, now);
				s.nxt++;
			}
		} else {
			let p = pipe(s);
			while (p < window(s)) {
				const x = nextLost(s);
				if (x >= 0) {
					s.rexmit.add(x);
					transmit(i, x, now);
				} else {
					while (s.sacked.has(s.nxt)) s.nxt++;
					transmit(i, s.nxt, now);
					s.nxt++;
				}
				p++;
			}
		}
		if (idle && s.nxt > s.una) armTimer(i, now);
	}

	function rttSample(s: Sender, r: number) {
		s.lastRtt = r;
		s.minRtt = Math.min(s.minRtt, r);
		s.vMinRtt = Math.min(s.vMinRtt, r);
		s.rttSum += r;
		s.rttN++;
		if (s.spec.algo === 'nobackoff') {
			// RFC 793: SRTT = 0.9·SRTT + 0.1·R, RTO = 2·SRTT, no variance term, no backoff.
			s.srtt = s.srtt === 0 ? r : 0.9 * s.srtt + 0.1 * r;
			s.rto = 2 * s.srtt;
			return;
		}
		// RFC 6298
		if (s.srtt === 0) {
			s.srtt = r;
			s.rttvar = r / 2;
		} else {
			s.rttvar = 0.75 * s.rttvar + 0.25 * Math.abs(s.srtt - r);
			s.srtt = 0.875 * s.srtt + 0.125 * r;
		}
		s.rto = Math.min(MAX_RTO, Math.max(MIN_RTO, s.srtt + 4 * s.rttvar));
	}

	/** Multiplicative (or additive) decrease on a detected loss; returns the new ssthresh. */
	function decrease(s: Sender): number {
		const flight = s.nxt - s.una;
		switch (s.spec.algo) {
			case 'cubic': {
				const w = s.cwnd;
				s.wMax = w < s.wLastMax ? (w * (1 + CUBIC.beta)) / 2 : w; // fast convergence
				s.wLastMax = w;
				s.epoch = -1;
				return Math.max(2, w * CUBIC.beta);
			}
			default:
				return Math.max(2, Math.min(s.cwnd, flight) / 2);
		}
	}

	/** Window growth for `acked` newly acknowledged packets, outside recovery. */
	function grow(s: Sender, acked: number, now: number) {
		const a = s.spec.algo;
		if (a === 'nobackoff') return;
		if (a === 'vegas') {
			if (s.vSlow && s.cwnd < s.ssthresh) s.cwnd += acked;
			return; // congestion avoidance is done once per round trip in `vegasRound`
		}
		if (s.cwnd < s.ssthresh) {
			s.cwnd += acked;
			return;
		}
		if (a === 'mimd') {
			s.cwnd += MIMD_GAIN * acked;
			return;
		}
		if (a === 'cubic') {
			if (s.epoch < 0) {
				s.epoch = now;
				s.cwndEpoch = s.cwnd;
				s.wEst = s.cwnd;
				if (s.wMax < s.cwnd) s.wMax = s.cwnd;
				s.k = Math.cbrt((s.wMax - s.cwnd) / CUBIC.C);
			}
			const W = (tt: number) => CUBIC.C * (tt - s.k) ** 3 + s.wMax;
			const tt = now - s.epoch;
			const alpha = (3 * (1 - CUBIC.beta)) / (1 + CUBIC.beta);
			s.wEst += (alpha * acked) / s.cwnd;
			if (W(tt) < s.wEst) {
				s.cwnd = Math.max(s.cwnd, s.wEst);
			} else {
				const target = Math.min(1.5 * s.cwnd, Math.max(s.cwnd, W(tt + s.srtt)));
				s.cwnd += ((target - s.cwnd) / s.cwnd) * acked;
			}
			return;
		}
		s.cwnd += acked / s.cwnd; // reno: one packet per round trip
	}

	function vegasRound(s: Sender) {
		const rtt = s.vMinRtt;
		s.vMinRtt = Infinity;
		s.vMark = s.nxt;
		if (!isFinite(rtt) || !isFinite(s.minRtt)) return;
		const diff = s.cwnd * (1 - s.minRtt / rtt); // packets of its own in the queue
		if (s.vSlow) {
			if (diff > VEGAS.gamma || s.cwnd >= s.ssthresh) {
				s.vSlow = false;
				s.cwnd = Math.max(2, s.cwnd - diff);
			}
			return;
		}
		if (diff < VEGAS.alpha) s.cwnd += 1;
		else if (diff > VEGAS.beta) s.cwnd = Math.max(2, s.cwnd - 1);
	}

	/** An acknowledgement: cumulative `ack`, triggered by data packet `data` sent at `echo`. */
	function onAck(i: number, ack: number, data: number, echo: number, now: number) {
		const s = S[i];
		if (s.spec.algo === 'nobackoff') {
			// timed from the packet's latest transmission: an ACK of the original that arrives
			// after a resend looks like a short round trip (the ambiguity Karn & Partridge fixed)
			rttSample(s, now - (s.lastSent.get(data) ?? echo));
			for (let k = s.una; k < ack; k++) s.lastSent.delete(k);
			if (ack > s.una) s.una = ack;
			if (s.nxt < s.una) s.nxt = s.una;
			sendMore(i, now);
			return;
		}
		rttSample(s, now - echo);
		// selective acknowledgement: the packet that triggered this ACK arrived out of order
		if (data >= ack && data >= s.una && !s.sacked.has(data)) {
			s.sacked.add(data);
			s.hiSacked = Math.max(s.hiSacked, data);
		}
		if (ack > s.una) {
			const acked = ack - s.una;
			for (let k = s.una; k < ack; k++) {
				s.sacked.delete(k);
				s.rexmit.delete(k);
			}
			s.una = ack;
			if (s.nxt < s.una) s.nxt = s.una;
			if (s.recovery) {
				if (ack >= s.recover) {
					s.recovery = false;
					s.cwnd = s.ssthresh;
				}
			} else {
				grow(s, acked, now);
			}
			if (s.spec.algo === 'vegas' && s.una >= s.vMark) vegasRound(s);
			armTimer(i, now);
		}
		if (!s.recovery && s.una >= s.recover && s.una + DUP_THRESH <= s.hiSacked && isLost(s, s.una)) {
			// fast retransmit: enter loss recovery, once per window of data
			s.st.lossEvents++;
			losses.push({ t: now, flow: i, timeout: false });
			s.ssthresh = decrease(s);
			s.cwnd = s.ssthresh;
			s.vSlow = false;
			s.recover = s.nxt;
			s.recovery = true;
			s.scan = s.una;
		}
		sendMore(i, now);
	}

	function onTimeout(i: number, now: number) {
		const s = S[i];
		if (s.nxt === s.una) return;
		s.st.timeouts++;
		losses.push({ t: now, flow: i, timeout: true });
		s.recovery = false;
		s.recover = s.nxt;
		{
			s.ssthresh = decrease(s);
			s.cwnd = 1;
			s.vSlow = false;
			s.rto = Math.min(MAX_RTO, 2 * s.rto); // exponential backoff
			s.epoch = -1;
			s.lostBelow = s.nxt;
			s.rexmit.clear();
			s.scan = s.una;
		}
		s.timerGen++;
		sendMore(i, now);
		if (s.nxt > s.una) at(now + s.rto, Ev.Timer, i, 0, s.timerGen);
	}

	function emitSample(t: number) {
		const dt = every;
		samples.push({
			t,
			cwnd: S.map((s) => (t < s.spec.start ? 0 : Math.min(s.spec.rwnd, s.cwnd))),
			rate: S.map((s) => {
				const r = s.deliveredSince / dt;
				s.deliveredSince = 0;
				return r;
			}),
			queue: qLen(),
			rtt: S.map((s) => s.lastRtt)
		});
	}

	while (heap.size > 0) {
		const e = heap.pop();
		if (e.t > until) break;
		while (nextSample <= e.t) {
			emitSample(nextSample);
			nextSample += every;
		}
		const now = e.t;
		const s = S[e.flow];
		switch (e.kind) {
			case Ev.Start:
				sendMore(e.flow, now);
				break;
			case Ev.AtQueue: {
				if (link.loss && random() < link.loss) {
					s.st.noise++;
					if (e.log >= 0) packets[e.log].out = -2;
					break;
				}
				if (qLen() >= link.buffer + 1) {
					s.st.drops++;
					if (e.log >= 0) packets[e.log].out = -1;
					break;
				}
				q.push({ flow: e.flow, seq: e.seq, x: e.x, log: e.log });
				if (qLen() === 1) at(now + service, Ev.Depart, 0);
				break;
			}
			case Ev.Depart: {
				const p = q[qHead++];
				if (qHead > 4096 && qHead * 2 > q.length) {
					q.splice(0, qHead);
					qHead = 0;
				}
				const f = S[p.flow];
				if (p.log >= 0) packets[p.log].out = now;
				at(now + f.spec.rtt / 4, Ev.Recv, p.flow, p.seq, p.x, p.log);
				if (qLen() > 0) at(now + service, Ev.Depart, 0);
				break;
			}
			case Ev.Recv: {
				s.st.received++;
				if (e.log >= 0) packets[e.log].recv = now;
				if (e.seq >= s.rcvNxt) {
					s.ooo.add(e.seq);
					while (s.ooo.has(s.rcvNxt)) {
						s.ooo.delete(s.rcvNxt);
						s.rcvNxt++;
						s.st.delivered++;
						s.deliveredSince++;
					}
				}
				at(now + s.spec.rtt / 2, Ev.Ack, e.flow, s.rcvNxt, e.x, e.log, e.seq);
				break;
			}
			case Ev.Ack:
				if (e.log >= 0) packets[e.log].acked = now;
				onAck(e.flow, e.seq, e.d, e.x, now);
				break;
			case Ev.Timer:
				if (s.spec.algo === 'nobackoff') {
					// resend a packet whose own timer ran out, unless acknowledged or resent since
					if (e.seq >= s.una && s.lastSent.get(e.seq) === e.x) {
						s.st.timeouts++;
						transmit(e.flow, e.seq, now);
					}
				} else if (e.x === s.timerGen) onTimeout(e.flow, now);
				break;
		}
	}
	while (nextSample <= until + 1e-9) {
		emitSample(nextSample);
		nextSample += every;
	}
	for (const s of S) s.st.meanRtt = s.rttN ? s.rttSum / s.rttN : s.spec.rtt;
	return { samples, flows: S.map((s) => s.st), packets, losses, until };
}

// ---- helpers the scenes and tests share -------------------------------------------------------

/** Mean delivered rate of each flow between two times, packets per second. */
export function meanRate(r: SimResult, from: number, to: number): number[] {
	const xs = r.samples.filter((s) => s.t > from && s.t <= to);
	return r.samples[0].rate.map((_, i) => xs.reduce((a, s) => a + s.rate[i], 0) / xs.length);
}

/** Mean queue length between two times, packets. */
export function meanQueue(r: SimResult, from: number, to: number): number {
	const xs = r.samples.filter((s) => s.t > from && s.t <= to);
	return xs.reduce((a, s) => a + s.queue, 0) / xs.length;
}

/**
 * Mathis, Semke, Mahdavi & Ott (1997): a TCP that halves its window once per loss, with losses
 * at rate p (per packet), averages 1.22 / (RTT·√p) packets per second (√(3/2) = 1.22).
 */
export const mathis = (rtt: number, p: number) => Math.sqrt(1.5) / (rtt * Math.sqrt(p));

/** Megabits per second for a rate in packets per second. */
export const mbps = (pps: number) => (pps * MSS * 8) / 1e6;

// ---- the page's scenarios ----------------------------------------------------------------------

/** The page's bottleneck: 12 Mbit/s (1000 packets of 1500 bytes a second). */
export const LINK_RATE = 1000;
/** The base round trip of the main flow, s. */
export const BASE_RTT = 0.06;

const memo = new Map<string, unknown>();
function cached<T>(key: string, f: () => T): T {
	if (!memo.has(key)) memo.set(key, f());
	return memo.get(key) as T;
}

/** One Reno flow on the page's link with a queue of `buffer` packets. */
export const oneFlow = (buffer: number, until = 40, logFrom = 0, logUntil = 0) =>
	cached(`one:${buffer}:${until}:${logFrom}:${logUntil}`, () =>
		simulate({
			link: { rate: LINK_RATE, buffer },
			flows: [{ rtt: BASE_RTT }],
			until,
			logFrom,
			logUntil
		})
	);

/** Buffer sizes swept in the bufferbloat chart, packets. */
export const BUFFERS = [5, 15, 30, 60, 120, 200, 300, 400];

/** Utilisation and mean round trip of one Reno flow for each queue size (after 10 s). */
export const bufferSweep = () =>
	cached('sweep', () =>
		BUFFERS.map((b) => {
			const r = oneFlow(b);
			const rate = meanRate(r, 10, r.until)[0];
			const xs = r.samples.filter((s) => s.t > 10);
			const rtt = xs.reduce((a, s) => a + s.rtt[0], 0) / xs.length;
			return { buffer: b, utilisation: rate / LINK_RATE, rtt };
		})
	);

/**
 * Two flows of the same algorithm on the page's link (queue 60 packets): the first starts alone,
 * the second joins at `join` seconds. `rtt2` and `n2` give the second user's round trip and how
 * many connections it opens.
 */
export function sharing(o: {
	algo?: Algo;
	join?: number;
	rtt2?: number;
	n2?: number;
	until?: number;
	buffer?: number;
}) {
	const algo = o.algo ?? 'reno';
	const join = o.join ?? 5;
	const rtt2 = o.rtt2 ?? BASE_RTT;
	const n2 = o.n2 ?? 1;
	const until = o.until ?? 80;
	const buffer = o.buffer ?? 60;
	return cached(`share:${algo}:${join}:${rtt2}:${n2}:${until}:${buffer}`, () =>
		simulate({
			link: { rate: LINK_RATE, buffer },
			flows: [
				{ rtt: BASE_RTT, algo },
				...Array.from({ length: n2 }, (_, k) => ({
					rtt: rtt2,
					algo,
					start: join + 0.1 * k
				}))
			],
			until,
			seed: 7
		})
	);
}

/** Loss rates swept in the Mathis chart. */
export const LOSS_RATES = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02];
/** Round trip on the lossy link, s. */
export const LOSSY_RTT = 0.1;

/**
 * One Reno flow over a fast link (10× the page's bottleneck, ample queue) that loses packets at
 * random with probability `p`: losses from noise, not from congestion.
 */
export const lossyFlow = (p: number, until = 150) =>
	cached(`lossy:${p}:${until}`, () =>
		simulate({
			link: { rate: 10 * LINK_RATE, buffer: 2000, loss: p },
			// starts in congestion avoidance: a slow start up to the fast link's capacity would
			// take a minute of halvings to settle
			flows: [{ rtt: LOSSY_RTT, ssthresh0: 16 }],
			until,
			seed: 11
		})
	);

/** Measured mean rate after 10 s, packets per second. */
export const lossyRate = (p: number) => {
	const r = lossyFlow(p);
	return meanRate(r, 10, r.until)[0];
};

/** Sender counts swept in the collapse chart. */
export const SENDERS = [1, 4, 8, 16, 24, 32, 48, 64, 96];
/** Each sender's receiver window in the collapse experiment, packets. */
export const RWND = 16;

/**
 * `n` senders sharing the page's link (queue 60 packets), each with a receiver window of 16
 * packets and base round trips spread from 50 to 100 ms; `backoff` false is TCP before
 * Jacobson. Goodput counts each packet once; throughput counts duplicates too.
 */
export function crowd(n: number, backoff: boolean, until = 30) {
	return cached(`crowd:${n}:${backoff}:${until}`, () => {
		const r = simulate({
			link: { rate: LINK_RATE, buffer: 60 },
			flows: Array.from({ length: n }, (_, k) => ({
				rtt: 0.05 + (0.05 * k) / Math.max(1, n - 1),
				algo: backoff ? ('reno' as const) : ('nobackoff' as const),
				rwnd: RWND,
				start: 0.013 * k
			})),
			until,
			seed: 3
		});
		const after = 8;
		const xs = r.samples.filter((s) => s.t > after);
		const goodput = xs.reduce((a, s) => a + s.rate.reduce((b, v) => b + v, 0), 0) / xs.length;
		const received = r.flows.reduce((a, f) => a + f.received, 0);
		const delivered = r.flows.reduce((a, f) => a + f.delivered, 0);
		return {
			n,
			backoff,
			/** Packets per second delivered to applications (each once), after 8 s. */
			goodput,
			/** Share of what crossed the bottleneck that the receiver already had. */
			duplicates: 1 - delivered / Math.max(1, received),
			/** Offered load: the senders' full windows over their mean base round trip, as a
			 * multiple of the link's rate. */
			offered: (n * RWND) / 0.075 / LINK_RATE
		};
	});
}

/** The comparison's path: 24 Mbit/s, 100 ms, a queue of 100 packets (half the BDP). */
export const FAST = { rate: 2 * LINK_RATE, rtt: 0.1, buffer: 100 };
/** When the Reno flow joins in the comparison, s. */
export const RIVAL_JOIN = 30;

/**
 * One flow of `algo` on the comparison's path, alone or with a Reno flow joining at 30 s. Both
 * start with a slow-start threshold of 100 packets (as a cached value from an earlier connection
 * would give), so that the start doesn't overshoot by hundreds of packets.
 */
export const versus = (algo: Algo, rival: boolean, until = 90) =>
	cached(`versus:${algo}:${rival}:${until}`, () =>
		simulate({
			link: { rate: FAST.rate, buffer: FAST.buffer },
			flows: [
				{ rtt: FAST.rtt, algo, ssthresh0: 100 },
				...(rival ? [{ rtt: FAST.rtt, start: RIVAL_JOIN, ssthresh0: 100 }] : [])
			],
			until,
			every: 0.1,
			seed: 5
		})
	);
