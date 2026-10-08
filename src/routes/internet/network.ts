/**
 * A small packet-switched network, simulated packet by packet.
 *
 * Two computers (Ada's and Ben's) are joined by eight routers (A–H). Ada sends
 * Ben a short message cut into numbered packets. The simulation is a
 * discrete-event model of what really happens on the Internet, scaled down:
 *
 * - **Packets** carry a header (source and destination address, a number) and
 *   a little data. Routers look only at the destination.
 * - **Routing** is link-state, as in OSPF: every router knows the map of
 *   links and works out, by itself, the cheapest next hop to every
 *   destination (Dijkstra; the cost of a link is its delay). Nobody is in
 *   charge. When a link fails, the two routers at its ends notice after a
 *   short detection time and the news is passed on (flooded) from router to
 *   router; each router changes its own table only when the news reaches it,
 *   so for a while some routers still send packets towards the dead link.
 * - **Queues**: each router forwards one packet at a time, first come first
 *   served, and holds at most `BUFFER` packets waiting. A packet that arrives
 *   at a full queue is dropped (tail drop). One router (`BUSY`) can be given
 *   extra traffic from other people, which fills its queue.
 * - **Loss**: each crossing of a link can lose the packet with a fixed
 *   probability (noise, a corrupted packet that is thrown away). The draws
 *   come from a seeded generator, so a run is reproducible.
 * - **Reliability lives at the two ends**: Ben acknowledges every packet he
 *   receives; Ada sends each packet again if no acknowledgement arrives
 *   within a timeout. Ben puts the packets back in order by their numbers.
 *   This is selective repeat; TCP works the same way in spirit (cumulative
 *   acknowledgements, a measured timeout and congestion control are left
 *   out).
 * - **Hop limit**: a packet that has been through `MAX_HOPS` routers is
 *   dropped, like the IP time-to-live, so a packet caught in a short-lived
 *   loop while the news spreads cannot circle for ever.
 *
 * Simplifications, stated on the page: time is slowed down enormously (a
 * real hop takes about a millisecond); there are eight routers, not tens of
 * thousands of networks; each packet carries two letters instead of up to
 * about 1,500 bytes; between real networks routes are shared with BGP,
 * which passes on routes rather than maps.
 */

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

export type NodeKind = 'host' | 'router';

export interface NetNode {
	id: string;
	kind: NodeKind;
	label: string;
	/** Position on the map (scene units, 960 × 600). */
	x: number;
	y: number;
	/** IPv4 address (hosts only; documentation ranges, RFC 5737). */
	address?: string;
}

export interface Link {
	/** Sorted pair of node ids, e.g. 'C-E'. */
	id: string;
	a: string;
	b: string;
	/** Length on the map (scene units). */
	length: number;
	/** Seconds to cross (simulated time). */
	delay: number;
	/** Can the reader cut it? (Not the two links to the computers.) */
	cuttable: boolean;
}

/** Signal speed on the map, scene units per simulated second. */
export const SPEED = 420;

export const NODES: NetNode[] = [
	{ id: 'ada', kind: 'host', label: 'Ada', x: 62, y: 240, address: '192.0.2.10' },
	{ id: 'A', kind: 'router', label: 'A', x: 170, y: 240 },
	{ id: 'B', kind: 'router', label: 'B', x: 290, y: 110 },
	{ id: 'C', kind: 'router', label: 'C', x: 290, y: 375 },
	{ id: 'D', kind: 'router', label: 'D', x: 420, y: 245 },
	{ id: 'E', kind: 'router', label: 'E', x: 560, y: 400 },
	{ id: 'F', kind: 'router', label: 'F', x: 590, y: 105 },
	{ id: 'G', kind: 'router', label: 'G', x: 640, y: 250 },
	{ id: 'H', kind: 'router', label: 'H', x: 790, y: 240 },
	{ id: 'ben', kind: 'host', label: 'Ben', x: 898, y: 240, address: '198.51.100.20' }
];

export const nodeById = new Map(NODES.map((n) => [n.id, n]));

const PAIRS: [string, string][] = [
	['ada', 'A'],
	['A', 'B'],
	['A', 'C'],
	['A', 'D'],
	['B', 'D'],
	['B', 'F'],
	['C', 'D'],
	['C', 'E'],
	['D', 'G'],
	['E', 'G'],
	['E', 'H'],
	['F', 'G'],
	['F', 'H'],
	['G', 'H'],
	['H', 'ben']
];

export const linkId = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export const LINKS: Link[] = PAIRS.map(([a, b]) => {
	const na = nodeById.get(a)!;
	const nb = nodeById.get(b)!;
	const length = Math.hypot(nb.x - na.x, nb.y - na.y);
	return {
		id: linkId(a, b),
		a,
		b,
		length,
		delay: length / SPEED,
		cuttable: na.kind === 'router' && nb.kind === 'router'
	};
});

export const linkById = new Map(LINKS.map((l) => [l.id, l]));

const neighbours = new Map<string, { node: string; link: Link }[]>();
for (const n of NODES) neighbours.set(n.id, []);
for (const l of LINKS) {
	neighbours.get(l.a)!.push({ node: l.b, link: l });
	neighbours.get(l.b)!.push({ node: l.a, link: l });
}
export const neighboursOf = (id: string) => neighbours.get(id) ?? [];

export const ROUTERS = NODES.filter((n) => n.kind === 'router').map((n) => n.id);

// ---------------------------------------------------------------------------
// Timing constants (simulated seconds)
// ---------------------------------------------------------------------------

/** Time a router takes to forward one packet (it handles one at a time). */
export const SERVICE = 0.16;
/** Packets that can wait in a router's queue (besides the one being sent). */
export const BUFFER = 3;
/** Ada puts one packet on the wire every GAP seconds. */
export const GAP = 0.4;
/** Ben's acknowledgements are small: one every ACK_GAP seconds at most. */
export const ACK_GAP = 0.12;
/** Time for the routers at the ends of a cut link to notice it is dead. */
export const DETECT = 0.35;
/** When the chosen link is cut, in every run. */
export const CUT_AT = 1.9;
/** Packets are dropped after passing through this many routers. */
export const MAX_HOPS = 12;
/** The router that can be given other people's traffic. */
export const BUSY = 'G';
/** Ada starts sending at this time. */
export const START = 0.3;
/** Nothing is simulated after this time. */
export const HORIZON = 60;

// ---------------------------------------------------------------------------
// Routing: each router's own shortest-path table
// ---------------------------------------------------------------------------

/** Cheapest cost (seconds of delay) from every node to `dst`, avoiding `down` links. */
export function distancesTo(dst: string, down: ReadonlySet<string> = new Set()) {
	const dist = new Map<string, number>(NODES.map((n) => [n.id, Infinity]));
	dist.set(dst, 0);
	const done = new Set<string>();
	for (;;) {
		let best: string | null = null;
		for (const [id, d] of dist)
			if (!done.has(id) && d < Infinity && (best === null || d < dist.get(best)!)) best = id;
		if (best === null) break;
		done.add(best);
		// Computers are not routers: paths do not pass through them.
		if (best !== dst && nodeById.get(best)!.kind === 'host') continue;
		for (const { node, link } of neighboursOf(best)) {
			if (down.has(link.id)) continue;
			const nd = dist.get(best)! + link.delay;
			if (nd < dist.get(node)!) dist.set(node, nd);
		}
	}
	return dist;
}

/** One router's forwarding table: destination → next hop (or null: unreachable). */
export type Table = Map<string, string | null>;

/** Next hop from `from` towards `dst`, given the links it believes are down. */
export function nextHop(from: string, dst: string, down: ReadonlySet<string> = new Set()) {
	if (from === dst) return null;
	const dist = distancesTo(dst, down);
	let best: string | null = null;
	let bestCost = Infinity;
	for (const { node, link } of neighboursOf(from)) {
		if (down.has(link.id)) continue;
		if (node !== dst && nodeById.get(node)!.kind === 'host') continue;
		const c = link.delay + dist.get(node)!;
		if (c < bestCost - 1e-9 || (Math.abs(c - bestCost) < 1e-9 && best !== null && node < best)) {
			best = node;
			bestCost = c;
		}
	}
	return bestCost < Infinity ? best : null;
}

/** Path (node ids) from `from` to `dst` following each router's own next hop. */
export function route(from: string, dst: string, down: ReadonlySet<string> = new Set()) {
	const path = [from];
	let at = from;
	while (at !== dst && path.length < 20) {
		const n = nextHop(at, dst, down);
		if (!n) return null;
		path.push(n);
		at = n;
	}
	return at === dst ? path : null;
}

/** Full table of a router: every other node → next hop. */
export function tableOf(router: string, down: ReadonlySet<string> = new Set()): Table {
	const t: Table = new Map();
	for (const n of NODES) if (n.id !== router) t.set(n.id, nextHop(router, n.id, down));
	return t;
}

/**
 * When each router hears that `cut` is dead: the two routers at its ends
 * notice after DETECT; the news then travels over the remaining links, each
 * router passing it on after handling it (SERVICE).
 */
export function learnTimes(cut: string | null, cutAt = CUT_AT) {
	const learn = new Map<string, number>(NODES.map((n) => [n.id, Infinity]));
	const link = cut ? linkById.get(cut) : undefined;
	if (!link) return learn;
	const down = new Set([link.id]);
	learn.set(link.a, cutAt + DETECT);
	learn.set(link.b, cutAt + DETECT);
	const done = new Set<string>();
	for (;;) {
		let best: string | null = null;
		for (const [id, d] of learn)
			if (!done.has(id) && d < Infinity && (best === null || d < learn.get(best)!)) best = id;
		if (best === null) break;
		done.add(best);
		if (nodeById.get(best)!.kind === 'host') continue;
		for (const { node, link: l } of neighboursOf(best)) {
			if (down.has(l.id) || nodeById.get(node)!.kind === 'host') continue;
			const nd = learn.get(best)! + SERVICE + l.delay;
			if (nd < learn.get(node)!) learn.set(node, nd);
		}
	}
	return learn;
}

// ---------------------------------------------------------------------------
// The message and its packets
// ---------------------------------------------------------------------------

export const MESSAGE = 'SEE YOU AT NOON!';
/** Letters of data per packet (real packets carry up to about 1,500 bytes). */
export const PER_PACKET = 2;

export function packetize(message = MESSAGE, size = PER_PACKET) {
	const out: string[] = [];
	for (let i = 0; i < message.length; i += size) out.push(message.slice(i, i + size));
	return out;
}

/** Puts packets back in order by their numbers; null where one is still missing. */
export function reassemble(chunks: (string | undefined)[], count: number) {
	const parts: string[] = [];
	for (let i = 0; i < count; i++) {
		if (chunks[i] === undefined) return null;
		parts.push(chunks[i]!);
	}
	return parts.join('');
}

/** An IPv4 address as its 32 bits, in four bytes. */
export function addressBits(address: string) {
	const bytes = address.split('.').map(Number);
	if (bytes.length !== 4 || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
		throw new Error(`not an IPv4 address: ${address}`);
	return bytes.map((b) => b.toString(2).padStart(8, '0'));
}

// ---------------------------------------------------------------------------
// The simulation
// ---------------------------------------------------------------------------

export interface Scenario {
	/** Link that fails at CUT_AT in this run, or null. */
	cut: string | null;
	/** Probability of losing a packet on each crossing of a link (0–1). */
	loss: number;
	/** Other people's traffic through BUSY, as a fraction of its capacity (0–1). */
	load: number;
	/** Seed for the loss draws and the other traffic. */
	seed: number;
}

export const DEFAULT_SCENARIO: Scenario = { cut: null, loss: 0, load: 0, seed: 1 };

export type PacketKind = 'data' | 'ack' | 'other';

export type Fate =
	| 'delivered'
	| 'full' // dropped at a full queue
	| 'dead' // sent onto a link that had already failed
	| 'cut' // on the link when it failed
	| 'noise' // lost on a link at random
	| 'hops' // went through too many routers
	| 'noroute';

/** A stretch of a packet's life: crossing a link, or waiting in a router. */
export type Segment =
	| { kind: 'move'; from: string; to: string; t0: number; t1: number; u0: number; u1: number }
	| { kind: 'wait'; node: string; t0: number; t1: number };

export interface Packet {
	uid: number;
	kind: PacketKind;
	/** Packet number (0-based); for an acknowledgement, the packet it acknowledges. */
	seq: number;
	/** 1 for the first copy, 2 for the first resend, … */
	attempt: number;
	src: string;
	dst: string;
	segments: Segment[];
	fate: Fate | null;
	/** Time the packet's life ends (delivered or lost). */
	end: number;
	/** Where it ended: node id, or a point on a link. */
	endAt: { node: string } | { from: string; to: string; u: number } | null;
}

export interface SimResult {
	scenario: Scenario;
	packets: Packet[];
	count: number;
	chunks: string[];
	/** For each data packet number: times Ada sent it. */
	sends: number[][];
	/** First time Ben received each packet (Infinity if never). */
	received: number[];
	/** First time Ada received an acknowledgement for each packet. */
	acked: number[];
	/** When Ben has the whole message, and when Ada knows it. */
	complete: number;
	done: number;
	/** When each router hears about the cut. */
	learn: Map<string, number>;
	/** Retransmission timeout used by Ada. */
	rto: number;
	/** Packets dropped at the busy router's full queue (all kinds). */
	queueDrops: number;
}

/** Deterministic uniform number in [0, 1) from integers. */
export function hash01(...ns: number[]) {
	let h = 0x811c9dc5;
	for (const n of ns) {
		h ^= n >>> 0;
		h = Math.imul(h, 0x01000193);
		h ^= h >>> 13;
		h = Math.imul(h, 0x5bd1e995);
		h ^= h >>> 15;
	}
	return (h >>> 0) / 4294967296;
}

/** One-way time from Ada to Ben over the best route, with no queues. */
export function baseOneWay(down: ReadonlySet<string> = new Set()) {
	const path = route('ada', 'ben', down);
	if (!path) return Infinity;
	let t = 0;
	for (let i = 1; i < path.length; i++) t += linkById.get(linkId(path[i - 1], path[i]))!.delay;
	return t + (path.length - 2) * SERVICE;
}

/** Ada's timeout: a little more than one round trip on the best route. */
export const RTO = Math.round((2 * baseOneWay() * 1.25 + 0.5) * 10) / 10;

interface Ev {
	time: number;
	order: number;
	run: () => void;
}

export function simulate(sc: Partial<Scenario> = {}): SimResult {
	const scenario: Scenario = { ...DEFAULT_SCENARIO, ...sc };
	const cut = scenario.cut && linkById.get(scenario.cut)?.cuttable ? scenario.cut : null;
	const learn = learnTimes(cut);
	const chunks = packetize();
	const count = chunks.length;

	// Tables before and after the news: each router uses its own, depending on
	// whether the news has reached it.
	const downAfter = new Set(cut ? [cut] : []);
	const hopCache = new Map<string, string | null>();
	const hop = (at: string, dst: string, time: number) => {
		const knows = time >= learn.get(at)!;
		const key = `${at}>${dst}>${knows ? 1 : 0}`;
		if (!hopCache.has(key)) hopCache.set(key, nextHop(at, dst, knows ? downAfter : new Set()));
		return hopCache.get(key)!;
	};
	const linkDownAt = (id: string) => (cut === id ? CUT_AT : Infinity);

	const events: Ev[] = [];
	let order = 0;
	const at = (time: number, run: () => void) => {
		if (time > HORIZON) return;
		events.push({ time, order: order++, run });
	};

	const packets: Packet[] = [];
	const sends: number[][] = chunks.map(() => []);
	const received = chunks.map(() => Infinity);
	const acked = chunks.map(() => Infinity);
	const lastDep = new Map<string, number>();
	const accepted = new Map<string, number[]>();
	let queueDrops = 0;

	const end = (p: Packet, fate: Fate, time: number, endAt: Packet['endAt']) => {
		p.fate = fate;
		p.end = time;
		p.endAt = endAt;
	};

	/** The packet leaves `node` at `dep` towards its next hop. */
	const forward = (p: Packet, node: string, dep: number, hops: number) => {
		const nh =
			nodeById.get(node)!.kind === 'host' ? neighboursOf(node)[0].node : hop(node, p.dst, dep);
		if (!nh) return end(p, 'noroute', dep, { node });
		const link = linkById.get(linkId(node, nh))!;
		const d = link.delay;
		const downAt = linkDownAt(link.id);
		const move = (u1: number, t1: number) =>
			p.segments.push({ kind: 'move', from: node, to: nh, t0: dep, t1, u0: 0, u1 });
		if (downAt <= dep) {
			// Sent into a dead link (this router has not noticed yet): lost.
			move(0.12, dep + 0.12 * d);
			return end(p, 'dead', dep + 0.12 * d, { from: node, to: nh, u: 0.12 });
		}
		if (downAt < dep + d) {
			const u = (downAt - dep) / d;
			move(u, downAt);
			return end(p, 'cut', downAt, { from: node, to: nh, u });
		}
		if (
			scenario.loss > 0 &&
			p.kind !== 'other' &&
			hash01(scenario.seed, p.uid, hops) < scenario.loss
		) {
			move(0.5, dep + 0.5 * d);
			return end(p, 'noise', dep + 0.5 * d, { from: node, to: nh, u: 0.5 });
		}
		move(1, dep + d);
		at(dep + d, () => arrive(p, nh, dep + d, hops));
	};

	const arrive = (p: Packet, node: string, time: number, hops: number) => {
		const n = nodeById.get(node)!;
		if (n.kind === 'host' || (p.kind === 'other' && node === p.dst)) {
			end(p, 'delivered', time, { node });
			if (p.kind === 'data' && node === 'ben') onData(p, time);
			if (p.kind === 'ack' && node === 'ada') {
				if (acked[p.seq] === Infinity) acked[p.seq] = time;
			}
			return;
		}
		// A router: one packet at a time, at most BUFFER waiting.
		const deps = accepted.get(node) ?? [];
		const inSystem = deps.filter((d) => d > time).length;
		if (inSystem > BUFFER) {
			if (node === BUSY) queueDrops++;
			return end(p, 'full', time, { node });
		}
		if (hops + 1 > MAX_HOPS) return end(p, 'hops', time, { node });
		const dep = Math.max(time, lastDep.get(node) ?? -Infinity) + SERVICE;
		lastDep.set(node, dep);
		deps.push(dep);
		accepted.set(node, deps);
		p.segments.push({ kind: 'wait', node, t0: time, t1: dep });
		forward(p, node, dep, hops + 1);
	};

	let uid = 0;
	const make = (
		kind: PacketKind,
		seq: number,
		attempt: number,
		src: string,
		dst: string
	): Packet => {
		const p: Packet = {
			uid: uid++,
			kind,
			seq,
			attempt,
			src,
			dst,
			segments: [],
			fate: null,
			end: Infinity,
			endAt: null
		};
		packets.push(p);
		return p;
	};

	// Ada: one packet on the wire every GAP; resend when the timer runs out.
	let adaFree = START;
	const send = (seq: number, notBefore: number) => {
		const time = Math.max(notBefore, adaFree);
		adaFree = time + GAP;
		const p = make('data', seq, sends[seq].length + 1, 'ada', 'ben');
		sends[seq].push(time);
		forward(p, 'ada', time, 0);
		at(time + RTO, () => {
			if (acked[seq] === Infinity) send(seq, time + RTO);
		});
	};

	// Ben: acknowledge every packet, put them in order.
	let benFree = 0;
	const onData = (p: Packet, time: number) => {
		if (received[p.seq] === Infinity) received[p.seq] = time;
		const t = Math.max(time, benFree);
		benFree = t + ACK_GAP;
		const ack = make('ack', p.seq, p.attempt, 'ben', 'ada');
		forward(ack, 'ben', t, 0);
	};

	// Other people's traffic through BUSY: arrives from F, leaves towards E.
	if (scenario.load > 0) {
		const rate = scenario.load / SERVICE;
		let time = 0;
		let k = 0;
		const from = 'F';
		const to = 'E';
		const l = linkById.get(linkId(from, BUSY))!;
		for (;;) {
			// Exponential gaps (a random stream), drawn from the seed.
			time += -Math.log(1 - hash01(scenario.seed, 7919, k++)) / rate;
			if (time > HORIZON - 5) break;
			const t0 = time;
			at(t0, () => {
				const p = make('other', k, 1, from, to);
				p.segments.push({ kind: 'move', from, to: BUSY, t0: t0 - l.delay, t1: t0, u0: 0, u1: 1 });
				arriveOther(p, t0);
			});
		}
	}
	const arriveOther = (p: Packet, time: number) => {
		const deps = accepted.get(BUSY) ?? [];
		const inSystem = deps.filter((d) => d > time).length;
		if (inSystem > BUFFER) {
			queueDrops++;
			return end(p, 'full', time, { node: BUSY });
		}
		const dep = Math.max(time, lastDep.get(BUSY) ?? -Infinity) + SERVICE;
		lastDep.set(BUSY, dep);
		deps.push(dep);
		accepted.set(BUSY, deps);
		p.segments.push({ kind: 'wait', node: BUSY, t0: time, t1: dep });
		const l = linkById.get(linkId(BUSY, p.dst))!;
		p.segments.push({
			kind: 'move',
			from: BUSY,
			to: p.dst,
			t0: dep,
			t1: dep + l.delay,
			u0: 0,
			u1: 1
		});
		end(p, 'delivered', dep + l.delay, { node: p.dst });
	};

	for (let s = 0; s < count; s++) at(START + s * GAP, () => send(s, START + s * GAP));

	// Run the events in time order (ties in the order they were scheduled).
	while (events.length) {
		let bi = 0;
		for (let i = 1; i < events.length; i++) {
			const e = events[i];
			const b = events[bi];
			if (e.time < b.time || (e.time === b.time && e.order < b.order)) bi = i;
		}
		const [e] = events.splice(bi, 1);
		e.run();
	}

	const complete = Math.max(...received);
	const done = Math.max(...acked);
	return {
		scenario,
		packets,
		count,
		chunks,
		sends,
		received,
		acked,
		complete,
		done,
		learn,
		rto: RTO,
		queueDrops
	};
}

// ---------------------------------------------------------------------------
// Sampling the result at a time (for drawing)
// ---------------------------------------------------------------------------

export type Where =
	| { kind: 'link'; from: string; to: string; u: number }
	| { kind: 'queue'; node: string; slot: number; serving: boolean };

/** Where a packet is at time `t`, or null if it is not in the network. */
export function whereAt(p: Packet, t: number): Where | null {
	if (t >= p.end) return null;
	for (const s of p.segments) {
		if (t < s.t0) return null;
		if (t < s.t1 || (s === p.segments[p.segments.length - 1] && t <= s.t1)) {
			if (s.kind === 'move') {
				const f = (t - s.t0) / (s.t1 - s.t0);
				return { kind: 'link', from: s.from, to: s.to, u: s.u0 + (s.u1 - s.u0) * f };
			}
			// Waiting: slot 0 is being sent; the time left says how far back it is.
			const left = s.t1 - t;
			const slot = Math.max(0, Math.ceil(left / SERVICE - 1e-9) - 1);
			return { kind: 'queue', node: s.node, slot, serving: slot === 0 };
		}
	}
	return null;
}

/** Number of packets waiting or being forwarded at `node` at time `t`. */
export function queueAt(result: SimResult, node: string, t: number) {
	let n = 0;
	for (const p of result.packets)
		for (const s of p.segments)
			if (s.kind === 'wait' && s.node === node && t >= s.t0 && t < s.t1 && t < p.end) n++;
	return n;
}

// ---------------------------------------------------------------------------
// A web request, from name lookup to page
// ---------------------------------------------------------------------------

export type Lane = 'browser' | 'resolver' | 'root' | 'tld' | 'auth' | 'server';
export type Phase = 'dns' | 'tcp' | 'tls' | 'http';

export interface WebMessage {
	id: string;
	from: Lane;
	to: Lane;
	label: string;
	phase: Phase;
	/** Milliseconds from the moment the address is typed. */
	t0: number;
	t1: number;
}

export interface WebOptions {
	/** Round trip between the browser and the web server, ms. */
	rtt: number;
	/** The resolver already has the address in its cache. */
	cached: boolean;
	/** Round trip between the browser and its resolver, ms (an assumption). */
	resolverRtt?: number;
	/** Round trip between the resolver and each name server, ms (an assumption). */
	nameServerRtt?: number;
}

/**
 * The messages of a first visit to https://example.org, in order:
 * DNS (resolver → root → .org → example.org's name server, unless cached),
 * the TCP handshake (1 round trip), the TLS 1.3 handshake (1 round trip) and
 * the HTTP request and response (1 round trip; sending the page itself is
 * left out). The address is from a documentation range (RFC 5737).
 */
export function webRequest(o: WebOptions) {
	const r = o.resolverRtt ?? 20;
	const ns = o.nameServerRtt ?? 40;
	const msgs: WebMessage[] = [];
	let t = 0;
	const hop = (id: string, from: Lane, to: Lane, label: string, phase: Phase, oneWay: number) => {
		msgs.push({ id, from, to, label, phase, t0: t, t1: t + oneWay });
		t += oneWay;
	};
	hop('q', 'browser', 'resolver', 'Where is example.org?', 'dns', r / 2);
	if (!o.cached) {
		hop('root-q', 'resolver', 'root', 'example.org?', 'dns', ns / 2);
		hop('root-a', 'root', 'resolver', 'Ask .org', 'dns', ns / 2);
		hop('tld-q', 'resolver', 'tld', 'example.org?', 'dns', ns / 2);
		hop('tld-a', 'tld', 'resolver', "Ask example.org's server", 'dns', ns / 2);
		hop('auth-q', 'resolver', 'auth', 'example.org?', 'dns', ns / 2);
		hop('auth-a', 'auth', 'resolver', '203.0.113.7', 'dns', ns / 2);
	}
	hop('a', 'resolver', 'browser', '203.0.113.7', 'dns', r / 2);
	const dnsEnd = t;
	hop('syn', 'browser', 'server', 'SYN', 'tcp', o.rtt / 2);
	hop('synack', 'server', 'browser', 'SYN-ACK', 'tcp', o.rtt / 2);
	const tcpEnd = t;
	hop('hello', 'browser', 'server', 'ACK · Hello (keys)', 'tls', o.rtt / 2);
	hop('shello', 'server', 'browser', 'Hello · certificate', 'tls', o.rtt / 2);
	const tlsEnd = t;
	hop('get', 'browser', 'server', 'Finished · GET /', 'http', o.rtt / 2);
	hop('ok', 'server', 'browser', '200 OK · the page', 'http', o.rtt / 2);
	const phases: { phase: Phase; t0: number; t1: number }[] = [
		{ phase: 'dns', t0: 0, t1: dnsEnd },
		{ phase: 'tcp', t0: dnsEnd, t1: tcpEnd },
		{ phase: 'tls', t0: tcpEnd, t1: tlsEnd },
		{ phase: 'http', t0: tlsEnd, t1: t }
	];
	return { msgs, phases, total: t, roundTrips: 3 };
}
