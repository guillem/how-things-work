// Checks the consensus and blockchain models behind the consensus-blockchains explainer.
// Runs in Node.
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
	BITCOIN,
	MINERS,
	GENESIS_PREV,
	LIES,
	blockHash,
	buildChain,
	confirmationsFor,
	exactRace,
	forkRun,
	generals,
	header,
	maxTraitors,
	mine,
	naiveReplicas,
	nakamoto,
	race,
	raft,
	remine,
	retarget,
	retargetRun,
	sha256d,
	stateAt,
	validate,
	zeroBits,
	type RaftScenario
} from '../src/routes/consensus-blockchains/consensus';

test('copies that apply writes as they arrive end up disagreeing', () => {
	const finals = naiveReplicas().map((r) => r.final);
	expect(new Set(finals).size).toBe(2);
});

test.describe('Byzantine generals (Lamport, Shostak & Pease 1982)', () => {
	/** Every way of choosing f traitors among n generals. */
	function* choose(n: number, f: number, from = 0): Generator<number[]> {
		if (f === 0) {
			yield [];
			return;
		}
		for (let g = from; g <= n - f; g++)
			for (const rest of choose(n, f - 1, g + 1)) yield [g, ...rest];
	}

	test('with n ≥ 3f + 1, loyal generals always agree and follow a loyal commander', () => {
		for (const [n, f] of [
			[4, 1],
			[5, 1],
			[7, 2]
		])
			for (const traitors of choose(n, f))
				for (const lie of Object.values(LIES))
					for (const order of ['attack', 'retreat'] as const)
						expect(generals(n, traitors, order, lie).ok, `${n} ${traitors.join(',')}`).toBe(true);
	});

	test('three generals cannot survive one traitor: the loyal lieutenant sees the same in both cases', () => {
		// Loyal commander orders attack, lieutenant 2 lies...
		const liar = generals(3, [2], 'attack');
		// ...or the commander is the traitor and tells lieutenant 1 attack, lieutenant 2 retreat.
		const twoFaced = generals(3, [0], 'attack');
		expect(liar.received.get(1)).toBe('attack');
		expect(twoFaced.received.get(1)).toBe('attack');
		expect(liar.relayed[1][2]).toBe('retreat');
		expect(twoFaced.relayed[1][2]).toBe('retreat');
		// Same view, so the same decision; it is wrong in the first case.
		expect(liar.decided.get(1)).toBe(twoFaced.decided.get(1));
		expect(liar.ok).toBe(false);
	});

	test('with n = 3f, some choice of traitors defeats the algorithm', () => {
		for (const [n, f] of [
			[3, 1],
			[6, 2]
		]) {
			const fails = [...choose(n, f)].some((tr) => !generals(n, tr).ok);
			expect(fails).toBe(true);
		}
		expect([3, 4, 6, 7, 10].map(maxTraitors)).toEqual([0, 1, 1, 2, 3]);
	});

	test('OM(1) with four generals sends 3 + 3 × 2 = 9 messages', () => {
		expect(generals(4, [3]).messages).toBe(9);
	});
});

test.describe('Raft', () => {
	const scenarios: RaftScenario[] = [
		{ crashLeader: { at: 11, restartAt: 18 } },
		{ crashFollowers: { count: 2, at: 8, restartAt: 17 } },
		{ crashFollowers: { count: 4, at: 8, restartAt: 17 } },
		{ partition: { at: 8, healAt: 17 } },
		{ partition: { at: 8 } }
	];
	const runs = scenarios.flatMap((sc) =>
		Array.from({ length: 25 }, (_, k) => ({ sc, run: raft({ ...sc, seed: k + 1, horizon: 30 }) }))
	);

	test('at most one leader per term', () => {
		for (const { run } of runs) {
			const terms = run.leaders.map((l) => l.term);
			expect(new Set(terms).size).toBe(terms.length);
		}
	});

	test('a committed entry is never lost or changed, through crashes and cuts', () => {
		const problems: string[] = [];
		for (const { run } of runs) {
			// No two servers ever commit different commands at the same position...
			const committed = new Map<number, { cmd: number; t: number }>();
			for (const list of run.states)
				for (const s of list)
					for (let i = 0; i < s.commit; i++) {
						const c = committed.get(i);
						if (!c || s.t < c.t) committed.set(i, { cmd: c?.cmd ?? s.log[i].cmd, t: s.t });
						if (c && c.cmd !== s.log[i].cmd) problems.push(`position ${i}`);
					}
			// ...and every leader elected later has every committed entry in its log.
			for (const l of run.leaders) {
				const log = stateAt(run.states[l.node], l.t).log;
				for (const [i, c] of committed)
					if (c.t < l.t && log[i]?.cmd !== c.cmd) problems.push(`leader of term ${l.term}`);
			}
		}
		expect(problems).toEqual([]);
	});

	test('three of five servers keep committing; two of five cannot', () => {
		for (let seed = 1; seed <= 10; seed++) {
			const two = raft({ seed, crashFollowers: { count: 2, at: 8 }, horizon: 26 });
			const late2 = [...two.committedAt.values()].filter((t) => t > 10);
			expect(late2.length).toBeGreaterThan(4);
			const three = raft({ seed, crashFollowers: { count: 3, at: 8 }, horizon: 26 });
			const late3 = [...three.committedAt.values()].filter((t) => t > 9);
			expect(late3).toEqual([]);
		}
	});

	test('a cut network keeps going on its majority side; the old leader’s new entries are dropped on healing', () => {
		const run = raft({ seed: 1, partition: { at: 8, healAt: 17 }, horizon: 26 });
		const [cut] = run.cuts;
		const minority = cut.sides.flatMap((s, i) => (s === 0 ? [i] : []));
		expect(minority.length).toBe(2);
		// A new leader on the majority side during the cut.
		const during = run.leaders.filter((l) => l.t > 8 && l.t < 17);
		expect(during.length).toBe(1);
		expect(minority).not.toContain(during[0].node);
		// Commands the old leader accepted during the cut were never committed, and are gone.
		const oldLeader = run.leaders[0].node;
		const atHeal = stateAt(run.states[oldLeader], 16.9);
		const stranded = atHeal.log.slice(atHeal.commit).map((e) => e.cmd);
		expect(stranded.length).toBeGreaterThan(0);
		for (const cmd of stranded) expect(run.committedAt.has(cmd)).toBe(false);
		const end = run.states.map((l) => stateAt(l, run.horizon).log.map((e) => e.cmd));
		for (const log of end) for (const cmd of stranded) expect(log).not.toContain(cmd);
		// And all five end with the same committed history.
		const prefix = Math.min(...run.states.map((l) => stateAt(l, run.horizon).commit));
		expect(prefix).toBeGreaterThan(3);
		for (const log of end) expect(log.slice(0, prefix)).toEqual(end[0].slice(0, prefix));
	});

	test('a new leader is elected after the leader crashes', () => {
		for (let seed = 1; seed <= 10; seed++) {
			const run = raft({ seed, crashLeader: { at: 11 }, horizon: 26 });
			expect(run.leaders.some((l) => l.t > 11)).toBe(true);
		}
	});
});

test.describe('hash chain and proof-of-work', () => {
	test('block hashes are double SHA-256 of the header text', () => {
		const b = { height: 1, prev: GENESIS_PREV, data: 'Ana pays Ben 5', nonce: 7 };
		const once = createHash('sha256').update(header(b)).digest();
		const twice = createHash('sha256').update(once).digest('hex');
		expect(blockHash(b)).toBe(twice);
		expect(zeroBits(new Uint8Array([0, 0x1f]))).toBe(11);
		expect(zeroBits(sha256d('x'))).toBeGreaterThanOrEqual(0);
	});

	test('a mined block meets its difficulty, and each extra bit doubles the average work', () => {
		const tries = (bits: number) => {
			let sum = 0;
			for (let k = 0; k < 40; k++)
				sum += mine({ height: 1, prev: GENESIS_PREV, data: `block ${k}` }, bits)!.tries;
			return sum / 40;
		};
		const found = mine({ height: 1, prev: GENESIS_PREV, data: 'Ana pays Ben 5' }, 12)!;
		expect(found.hash.startsWith('000')).toBe(true);
		// Expected 2^bits tries; 40 samples of a geometric distribution average within ±40 %.
		for (const bits of [6, 10]) {
			expect(tries(bits)).toBeGreaterThan(0.6 * 2 ** bits);
			expect(tries(bits)).toBeLessThan(1.4 * 2 ** bits);
		}
	});

	test('changing an old block invalidates it and every block after it', () => {
		const { blocks } = buildChain(
			['genesis', 'Ana pays Ben 5', 'Ben pays Cai 2', 'Cai pays Dee 1'],
			8
		);
		expect(validate(blocks, 8).every((v) => v.valid)).toBe(true);
		const tampered = blocks.map((b, i) => (i === 1 ? { ...b, data: 'Ana pays Ben 500' } : b));
		expect(validate(tampered, 8).map((v) => v.valid)).toEqual([true, false, false, false]);
		// Without proof-of-work, fixing the links is enough; with it, every later block is re-mined.
		const fixed = remine(tampered, 1, 8);
		expect(validate(fixed.blocks, 8).every((v) => v.valid)).toBe(true);
		expect(fixed.tries.length).toBe(3);
	});
});

test.describe('Bitcoin difficulty retarget (Bitcoin Core pow.cpp)', () => {
	test('a block every 10 minutes, a retarget every 2016 blocks (two weeks)', () => {
		expect(BITCOIN.spacing).toBe(600);
		expect(BITCOIN.interval).toBe(2016);
	});

	test('blocks twice as fast double the difficulty; ten times as fast is capped at four', () => {
		expect(retarget(1, BITCOIN.timespan / 2)).toBeCloseTo(2, 12);
		expect(retarget(1, BITCOIN.timespan / 10)).toBeCloseTo(4, 12);
		expect(retarget(1, BITCOIN.timespan * 10)).toBeCloseTo(0.25, 12);
	});

	test('after the hash rate jumps, block times return to about 10 minutes', () => {
		const run = retargetRun(2);
		expect(run[2].blockTime / 60).toBeCloseTo(5, 1);
		expect(run[3].blockTime / 60).toBeCloseTo(10, 1);
		// An eightfold jump needs two retargets because of the cap.
		const big = retargetRun(8);
		expect(big[3].blockTime / 60).toBeCloseTo(5, 1);
		expect(big[4].blockTime / 60).toBeCloseTo(10, 1);
	});
});

test.describe('forks and stale blocks', () => {
	const staleRate = (delay: number) => {
		let stale = 0;
		let settled = 0;
		for (let seed = 1; seed <= 30; seed++) {
			const r = forkRun({ delay, blocks: 400, seed });
			stale += r.stale;
			settled += r.settled;
		}
		return stale / settled;
	};

	test('with no delay there are no forks; with delay d the stale share is a little under d / 600 s', () => {
		expect(staleRate(0)).toBe(0);
		// A pool never races against its own block: only a block by another pool, found within
		// the delay, forks. The page quotes "about 0.8 × d ÷ 600 s".
		const others = 1 - MINERS.reduce((sum, s) => sum + s * s, 0);
		expect(others).toBeCloseTo(0.8, 1);
		const r10 = staleRate(10);
		const r60 = staleRate(60);
		for (const [r, d] of [
			[r10, 10],
			[r60, 60]
		]) {
			expect(r).toBeGreaterThan(0.8 * others * (d / 600));
			expect(r).toBeLessThan(1.2 * others * (d / 600));
		}
		expect(staleRate(300)).toBeGreaterThan(r60);
	});

	test('every block builds on one with height one less', () => {
		const r = forkRun({ delay: 120, blocks: 60, seed: 3 });
		for (const b of r.tree.slice(1)) expect(b.height).toBe(r.tree[b.parent].height + 1);
	});
});

test.describe('the double-spend race (Nakamoto 2008, §11)', () => {
	test('reproduces the paper’s tables', () => {
		const q01 = [
			1, 0.2045873, 0.0509779, 0.0131722, 0.0034552, 0.0009137, 0.0002428, 0.0000647, 0.0000173,
			0.0000046, 0.0000012
		];
		q01.forEach((p, z) => expect(nakamoto(0.1, z)).toBeCloseTo(p, 7));
		const q03 = [
			1, 0.1773523, 0.0416605, 0.0101008, 0.0024804, 0.0006132, 0.0001522, 0.0000379, 0.0000095,
			0.0000024, 0.0000006
		];
		q03.forEach((p, k) => expect(nakamoto(0.3, 5 * k)).toBeCloseTo(p, 7));
		// "Solving for P less than 0.1%".
		expect([0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45].map((q) => confirmationsFor(q))).toEqual([
			5, 8, 11, 15, 24, 41, 89, 340
		]);
	});

	test('an attacker with half the hash power or more always catches up', () => {
		expect(nakamoto(0.5, 50)).toBe(1);
		expect(exactRace(0.6, 10)).toBe(1);
	});

	test('simulated races match the exact formula; Nakamoto’s Poisson shortcut is low', () => {
		for (const [q, z] of [
			[0.1, 2],
			[0.3, 5]
		]) {
			const N = 20000;
			let won = 0;
			for (let s = 1; s <= N; s++) if (race(q, z, s, 80, 4000).outcome === 'caught-up') won++;
			const se = Math.sqrt((exactRace(q, z) * (1 - exactRace(q, z))) / N);
			expect(Math.abs(won / N - exactRace(q, z))).toBeLessThan(4 * se);
			expect(nakamoto(q, z)).toBeLessThan(exactRace(q, z));
		}
		expect(exactRace(0.1, 1)).toBeCloseTo(0.2, 12);
	});

	test('the exact race needs more confirmations than Nakamoto’s formula, as the page says', () => {
		// "with 30 % of the power, 24 blocks still leave a 0.4 % chance … needs 32 blocks".
		expect(nakamoto(0.3, 24)).toBeLessThan(0.001);
		expect(exactRace(0.3, 24)).toBeCloseTo(0.004, 4);
		const exactFor = (q: number) => confirmationsFor(q, 0.001, 1000, exactRace);
		expect(exactFor(0.1)).toBe(6);
		expect(exactFor(0.3)).toBe(32);
		// Up to the slider's 45 %, without overflowing.
		const at45 = exactFor(0.45);
		expect(at45).toBeGreaterThan(confirmationsFor(0.45));
		expect(at45).toBeLessThan(1000);
		expect(exactRace(0.45, at45)).toBeGreaterThan(0);
	});
});
