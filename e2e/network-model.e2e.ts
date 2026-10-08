// Checks the packet network behind the internet explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BUFFER,
	CUT_AT,
	DETECT,
	LINKS,
	MESSAGE,
	NODES,
	RTO,
	ROUTERS,
	addressBits,
	baseOneWay,
	hash01,
	learnTimes,
	nextHop,
	packetize,
	queueAt,
	reassemble,
	route,
	simulate,
	webRequest,
	whereAt,
	type SimResult
} from '../src/routes/internet/network';

const delivered = (r: SimResult) => r.received.every((t) => t < Infinity);
const arrivalOrder = (r: SimResult) =>
	r.received
		.map((t, i) => [t, i] as const)
		.sort((a, b) => a[0] - b[0])
		.map(([, i]) => i);
/** Routers each delivered data packet went through. */
const pathsOf = (r: SimResult) =>
	r.packets
		.filter((p) => p.kind === 'data' && p.fate === 'delivered')
		.map((p) => p.segments.flatMap((s) => (s.kind === 'wait' ? [s.node] : [])).join(''));

test('the message is cut into 8 numbered packets of 2 letters and put back together', () => {
	const chunks = packetize();
	expect(MESSAGE.length).toBe(16);
	expect(chunks).toHaveLength(8);
	expect(chunks.every((c) => c.length === 2)).toBe(true);
	expect(reassemble(chunks, 8)).toBe(MESSAGE);
	const missing = [...chunks] as (string | undefined)[];
	missing[3] = undefined;
	expect(reassemble(missing, 8)).toBeNull();
});

test('an IPv4 address is 32 bits, written as four bytes', () => {
	expect(addressBits('192.0.2.10')).toEqual(['11000000', '00000000', '00000010', '00001010']);
	expect(addressBits('198.51.100.20').join('')).toHaveLength(32);
	expect(() => addressBits('256.1.1.1')).toThrow();
	// 2^32 possible addresses: about 4.3 billion.
	expect(2 ** 32).toBe(4_294_967_296);
});

test('the best route runs along the middle, and no single cut disconnects Ada from Ben', () => {
	expect(route('ada', 'ben')).toEqual(['ada', 'A', 'D', 'G', 'H', 'ben']);
	for (const l of LINKS.filter((l) => l.cuttable)) {
		const r = route('ada', 'ben', new Set([l.id]));
		expect(r, l.id).not.toBeNull();
		expect(route('ben', 'ada', new Set([l.id])), l.id).not.toBeNull();
	}
});

test('every router’s own table leads to Ben without loops, before and after any cut', () => {
	const cases = [null, ...LINKS.filter((l) => l.cuttable).map((l) => l.id)];
	for (const cut of cases) {
		const down = new Set(cut ? [cut] : []);
		for (const r of ROUTERS) {
			const path = route(r, 'ben', down);
			expect(path, `${r} with ${cut} down`).not.toBeNull();
			expect(new Set(path).size).toBe(path!.length);
		}
	}
	// No ties: the choice does not depend on the order of the links.
	expect(nextHop('A', 'ben')).toBe('D');
	expect(nextHop('D', 'ben', new Set(['D-G']))).not.toBe('G');
});

test('news of a cut starts at the two ends and spreads outward, router by router', () => {
	const learn = learnTimes('D-G');
	expect(learn.get('D')).toBeCloseTo(CUT_AT + DETECT);
	expect(learn.get('G')).toBeCloseTo(CUT_AT + DETECT);
	for (const r of ROUTERS) expect(learn.get(r)!).toBeGreaterThanOrEqual(CUT_AT + DETECT);
	expect(learn.get('A')!).toBeGreaterThan(learn.get('D')!);
	expect(learn.get('ada')).toBe(Infinity); // computers do not route
	expect([...learnTimes(null).values()].every((v) => v === Infinity)).toBe(true);
});

test('with nothing wrong, the packets arrive in order on one route, and no packet is sent twice', () => {
	const r = simulate();
	expect(delivered(r)).toBe(true);
	expect(arrivalOrder(r)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	expect(r.sends.every((s) => s.length === 1)).toBe(true);
	expect(new Set(pathsOf(r))).toEqual(new Set(['ADGH']));
	expect(r.complete).toBeLessThan(r.done);
	// The timeout is longer than a round trip, so nothing is resent needlessly.
	expect(RTO).toBeGreaterThan(2 * baseOneWay());
});

test('cutting D–G mid-message: packets on it are lost, the rest go round, and the lost ones are resent', () => {
	const r = simulate({ cut: 'D-G' });
	const lost = r.packets.filter((p) => p.kind === 'data' && p.fate !== 'delivered');
	expect(lost.length).toBeGreaterThan(0);
	expect(lost.every((p) => p.fate === 'cut' || p.fate === 'dead')).toBe(true);
	expect(delivered(r)).toBe(true);
	// Some packets were sent twice; the routes differ; they arrive out of order.
	expect(r.sends.some((s) => s.length === 2)).toBe(true);
	expect(new Set(pathsOf(r)).size).toBeGreaterThanOrEqual(2);
	expect(arrivalOrder(r)).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	// Ben still gets the right message, by sorting on the numbers.
	expect(reassemble(r.chunks, r.count)).toBe(MESSAGE);
	// No packet crosses D–G after the cut.
	for (const p of r.packets)
		for (const s of p.segments)
			if (s.kind === 'move' && [s.from, s.to].sort().join('-') === 'D-G')
				expect(s.t1 <= CUT_AT + 1e-9 || p.fate !== 'delivered').toBe(true);
});

test('only Ada ever sends data: the routers drop packets but never resend them', () => {
	for (const sc of [{ cut: 'D-G' }, { loss: 0.05 }, { load: 0.7 }]) {
		const r = simulate(sc);
		expect(r.packets.filter((p) => p.kind === 'data').every((p) => p.src === 'ada')).toBe(true);
		expect(r.packets.filter((p) => p.kind === 'ack').every((p) => p.src === 'ben')).toBe(true);
		// Number of data packets = number of sends by Ada.
		const sends = r.sends.reduce((n, s) => n + s.length, 0);
		expect(r.packets.filter((p) => p.kind === 'data')).toHaveLength(sends);
	}
});

test('random loss is reproducible from the seed, and the message still gets through', () => {
	const a = simulate({ loss: 0.05, seed: 4 });
	const b = simulate({ loss: 0.05, seed: 4 });
	expect(a.sends).toEqual(b.sends);
	for (let seed = 1; seed <= 6; seed++) {
		const r = simulate({ loss: 0.05, seed });
		expect(delivered(r), `seed ${seed}`).toBe(true);
	}
	const lossy = simulate({ loss: 0.08, seed: 1 });
	expect(lossy.packets.some((p) => p.fate === 'noise')).toBe(true);
	expect(lossy.sends.some((s) => s.length > 1)).toBe(true);
	for (let i = 0; i < 1000; i++) {
		const u = hash01(1, i, 3);
		expect(u).toBeGreaterThanOrEqual(0);
		expect(u).toBeLessThan(1);
	}
});

test('a busy router fills its queue and drops packets; the queue never exceeds its size', () => {
	expect(simulate({ load: 0 }).queueDrops).toBe(0);
	const r = simulate({ load: 0.7 });
	expect(r.queueDrops).toBeGreaterThan(0);
	expect(r.packets.some((p) => p.kind !== 'other' && p.fate === 'full')).toBe(true);
	expect(delivered(r)).toBe(true);
	for (let t = 0; t < 30; t += 0.05) expect(queueAt(r, 'G', t)).toBeLessThanOrEqual(BUFFER + 1);
	// Standard routing does not steer round a busy router: every delivered packet went through G.
	expect(pathsOf(r).every((p) => p === 'ADGH')).toBe(true);
});

test('a packet’s position is continuous along its route', () => {
	const r = simulate({ cut: 'D-G' });
	const p = r.packets.find((p) => p.kind === 'data' && p.fate === 'delivered')!;
	let prev: { x: number; y: number } | null = null;
	for (let t = p.segments[0].t0; t < p.end; t += 0.01) {
		const w = whereAt(p, t);
		expect(w).not.toBeNull();
		// Position on the map: moves at most a few units per 10 ms (no jumps along links).
		if (w!.kind === 'link') {
			const a = NODES.find((n) => n.id === w!.from)!;
			const b = NODES.find((n) => n.id === w!.to)!;
			const pt = { x: a.x + (b.x - a.x) * w!.u, y: a.y + (b.y - a.y) * w!.u };
			if (prev) expect(Math.hypot(pt.x - prev.x, pt.y - prev.y)).toBeLessThan(10);
			prev = pt;
		} else prev = null;
	}
	expect(whereAt(p, p.end + 0.01)).toBeNull();
	expect(NODES.find((n) => n.id === 'ben')!.address).toBe('198.51.100.20');
});

test('a web request: name lookup, then three round trips to the server', () => {
	const cold = webRequest({ rtt: 80, cached: false });
	// 20 ms to the resolver and back, plus three name servers at 40 ms each.
	expect(cold.phases[0].t1).toBe(140);
	expect(cold.total).toBe(140 + 3 * 80);
	expect(cold.msgs.filter((m) => m.phase === 'dns')).toHaveLength(8);
	const warm = webRequest({ rtt: 80, cached: true });
	expect(warm.total).toBe(20 + 240);
	expect(warm.msgs.filter((m) => m.phase === 'dns')).toHaveLength(2);
	expect(webRequest({ rtt: 200, cached: true }).total).toBe(620);
	// Each message starts when the previous one arrives.
	for (let i = 1; i < cold.msgs.length; i++) expect(cold.msgs[i].t0).toBe(cold.msgs[i - 1].t1);
	expect(cold.msgs.map((m) => m.label)).toContain('SYN');
});
