// Checks the TCP congestion-control simulation (packet-level senders sharing a drop-tail
// bottleneck) against what TCP is known to do: slow start doubles the window every round trip;
// a lone Reno flow's window peaks at the path's capacity plus the queue and halves; the queue
// size sets the delay but not the throughput; AIMD flows converge to equal shares from unequal
// starts while MIMD flows don't (Chiu & Jain 1989); a short round trip takes more; throughput
// over a randomly lossy link follows Mathis et al. (1997); senders without backoff collapse
// (Jacobson 1988); Vegas keeps the queue short and CUBIC refills quickly (RFC 9438). Runs in
// Node; no browser.
import { expect, test } from '@playwright/test';
import {
	BASE_RTT,
	BUFFERS,
	CUBIC,
	LINK_RATE,
	LOSSY_RTT,
	bufferSweep,
	crowd,
	lossyRate,
	mathis,
	meanQueue,
	meanRate,
	oneFlow,
	sharing,
	simulate,
	versus
} from '../src/routes/tcp-congestion-control/model';

test('slow start doubles the window every round trip, until the first loss', () => {
	const r = simulate({
		link: { rate: LINK_RATE, buffer: 60 },
		flows: [{ rtt: BASE_RTT }],
		until: 0.6,
		every: 0.001
	});
	const reach = (w: number) => r.samples.find((s) => s.cwnd[0] >= w)?.t ?? NaN;
	// from 4 to 64 packets: four doublings, each a round trip (a little more than the base
	// round trip, as each burst queues briefly at the bottleneck)
	const perDoubling = (reach(64) - reach(4)) / 4;
	expect(perDoubling).toBeGreaterThan(BASE_RTT);
	expect(perDoubling).toBeLessThan(1.2 * BASE_RTT);
	// the first loss: the window has overshot the path by about as much again, and is halved
	expect(r.losses[0].timeout).toBe(false);
	const after = r.samples.find((s) => s.t > r.losses[0].t)?.cwnd[0] ?? NaN;
	expect(after).toBeGreaterThan(LINK_RATE * BASE_RTT + 60 - 5);
	expect(after).toBeLessThan(LINK_RATE * BASE_RTT + 60 + 5);
});

test("a lone Reno flow's window peaks at the path's capacity plus the queue, then halves", () => {
	const r = oneFlow(60);
	const xs = r.samples.filter((s) => s.t > 10);
	const peak = Math.max(...xs.map((s) => s.cwnd[0]));
	const bdp = LINK_RATE * BASE_RTT;
	// packets the path holds (rate × round trip) plus those the queue holds
	expect(peak).toBeGreaterThan(bdp + 60 - 2);
	expect(peak).toBeLessThan(bdp + 60 + 4);
	const trough = Math.min(...xs.map((s) => s.cwnd[0]));
	expect(trough / peak).toBeGreaterThan(0.45);
	expect(trough / peak).toBeLessThan(0.55);
	// a queue as big as the path's capacity keeps the link busy through the halvings
	expect(meanRate(r, 10, 40)[0] / LINK_RATE).toBeGreaterThan(0.99);
});

test('the queue size sets the delay; beyond the path capacity it adds no throughput', () => {
	const sweep = bufferSweep();
	for (const { buffer } of sweep) {
		const r = oneFlow(buffer);
		const maxRtt = Math.max(...r.samples.filter((s) => s.t > 10).map((s) => s.rtt[0]));
		// a full queue of B packets adds B / rate seconds; the largest queues don't fill up
		// again within the run
		const full = BASE_RTT + (buffer + 1) / LINK_RATE;
		expect(maxRtt).toBeLessThan(full + 0.003);
		if (buffer <= 200) expect(maxRtt).toBeGreaterThan(full - 0.006);
	}
	const at = (b: number) => sweep.find((s) => s.buffer === b) ?? sweep[0];
	expect(at(BUFFERS[0]).utilisation).toBeLessThan(0.85);
	expect(at(60).utilisation).toBeGreaterThan(0.99);
	expect(at(400).utilisation).toBeLessThan(at(60).utilisation + 0.005);
	expect(at(400).rtt).toBeGreaterThan(2 * at(60).rtt);
	for (let i = 1; i < sweep.length; i++) expect(sweep[i].rtt).toBeGreaterThan(sweep[i - 1].rtt);
});

test('two AIMD flows converge to equal shares from unequal starts; MIMD flows do not', () => {
	const aimd = sharing({ algo: 'reno' });
	// the first flow has the link to itself for 5 s
	const [a0, b0] = meanRate(aimd, 5, 10);
	expect(a0).toBeGreaterThan(1.3 * b0);
	const [a, b] = meanRate(aimd, 40, 80);
	expect(a / (a + b)).toBeGreaterThan(0.45);
	expect(a / (a + b)).toBeLessThan(0.55);
	expect(a + b).toBeGreaterThan(0.98 * LINK_RATE);
	const mimd = sharing({ algo: 'mimd' });
	const [c, d] = meanRate(mimd, 40, 80);
	expect(c / d).toBeGreaterThan(2);
});

test('a flow with a short round trip takes more; a user with more connections takes more', () => {
	const [near, far] = meanRate(sharing({ rtt2: 0.15 }), 30, 80);
	expect(near / far).toBeGreaterThan(2);
	const [one, ...four] = meanRate(sharing({ n2: 4 }), 30, 80);
	const theirs = four.reduce((x, y) => x + y, 0);
	expect(theirs / (one + theirs)).toBeGreaterThan(0.7);
	for (const f of four) expect(f / one).toBeGreaterThan(0.75);
});

test('over a randomly lossy link, throughput follows Mathis: 1.22 / (RTT √p)', () => {
	for (const p of [0.0005, 0.001, 0.002, 0.005]) {
		const ratio = lossyRate(p) / mathis(LOSSY_RTT, p);
		// Mathis et al. found a constant of 1.31 rather than 1.22 for random (not periodic)
		// losses, 7 % more
		expect(ratio, `p = ${p}`).toBeGreaterThan(0.95);
		expect(ratio, `p = ${p}`).toBeLessThan(1.2);
	}
	// four times the loss, half the rate
	expect(lossyRate(0.0005) / lossyRate(0.002)).toBeCloseTo(2, 0);
	// at high loss, timeouts take over and the formula is optimistic
	expect(lossyRate(0.02)).toBeLessThan(mathis(LOSSY_RTT, 0.02));
});

test('without backoff, goodput collapses as the offered load rises; with it, it holds', () => {
	const old = [16, 32, 64, 96].map((n) => crowd(n, false).goodput);
	for (let i = 1; i < old.length; i++) expect(old[i]).toBeLessThan(old[i - 1]);
	expect(old.at(-1) ?? 0).toBeLessThan(0.4 * LINK_RATE);
	expect(crowd(96, false).duplicates).toBeGreaterThan(0.5);
	for (const n of [16, 32, 64, 96]) expect(crowd(n, true).goodput).toBeGreaterThan(0.9 * LINK_RATE);
});

test('Vegas keeps the queue short; CUBIC refills its window faster than Reno', () => {
	const vegas = versus('vegas', false);
	const reno = versus('reno', false);
	const cubic = versus('cubic', false);
	expect(meanQueue(vegas, 20, 90)).toBeLessThan(5);
	expect(meanQueue(reno, 20, 90)).toBeGreaterThan(20);
	expect(meanRate(vegas, 20, 90)[0]).toBeGreaterThan(0.98 * 2 * LINK_RATE);
	// time between losses: Reno climbs back one packet per round trip; CUBIC's cubic returns
	// to W_max after K = ∛(W_max (1 − β) / C) seconds
	const gaps = (r: ReturnType<typeof versus>) => {
		const ts = r.losses.filter((l) => l.t > 20).map((l) => l.t);
		return (ts.at(-1)! - ts[0]) / (ts.length - 1);
	};
	expect(gaps(cubic)).toBeLessThan(gaps(reno) / 2);
	const wMax = 2 * LINK_RATE * 0.1 + 100;
	expect(gaps(cubic)).toBeGreaterThan(0.6 * Math.cbrt((wMax * (1 - CUBIC.beta)) / CUBIC.C));
	// but a delay-based sender yields to a loss-based one that fills the queue
	const [v, r] = meanRate(versus('vegas', true), 50, 90);
	expect(v).toBeLessThan(0.3 * r);
});

test('the simulation is deterministic', () => {
	const a = simulate({
		link: { rate: 500, buffer: 20, loss: 0.01 },
		flows: [{ rtt: 0.05 }],
		until: 5,
		seed: 4
	});
	const b = simulate({
		link: { rate: 500, buffer: 20, loss: 0.01 },
		flows: [{ rtt: 0.05 }],
		until: 5,
		seed: 4
	});
	expect(a.flows).toEqual(b.flows);
});
