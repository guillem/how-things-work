/**
 * Distributed consensus and blockchains, as small runnable models.
 *
 * - Copies without consensus: two writes reach five replicas in different orders.
 * - Byzantine generals: Lamport, Shostak & Pease's Oral Messages algorithm OM(m) ("The
 *   Byzantine Generals Problem", ACM TOPLAS 4(3), 1982), which works when more than two
 *   thirds of the generals are loyal (n ≥ 3m + 1).
 * - Raft (Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm",
 *   USENIX ATC 2014): leader election with randomised timeouts, log replication with the
 *   consistency check, commit by majority. A discrete-event simulation, computed up front
 *   and replayed by the scene.
 * - A hash chain with proof-of-work, hashed with the real SHA-256 of the cryptography
 *   explainer, applied twice as Bitcoin does.
 * - Bitcoin's difficulty retarget, as in Bitcoin Core `src/pow.cpp` and
 *   `src/kernel/chainparams.cpp`: one block every 600 s, a retarget every 2016 blocks
 *   (14 days), clamped to a factor of 4 either way.
 * - Forks: miners on a network with propagation delay, each mining on the longest chain it
 *   has heard of.
 * - The double-spend race: Nakamoto's attacker-success probability ("Bitcoin: A Peer-to-Peer
 *   Electronic Cash System", 2008, §11) and the exact value of the same race (Rosenfeld,
 *   "Analysis of hashrate-based double-spending", 2014; Grunspan & Pérez-Marco, 2018).
 *
 * Simplifications (stated on the page): time in the Raft and fork simulations is slowed
 * down; Raft clients always find the leader they can reach; blocks carry a short text instead
 * of transactions and a text header instead of Bitcoin's 80-byte binary header; difficulty is
 * counted in leading zero bits instead of a 256-bit target.
 */
import { rng } from '#lib/draw/math.ts';
import { sha256, toHex } from '../cryptography/crypto';

// ================================================================ copies without consensus

/**
 * Seconds a write takes from each client to each of the five replicas (illustrative: roughly
 * in proportion to the distances in the drawing).
 */
export const NAIVE = {
	writes: [
		{ label: 'x = 1', client: 'A', at: 0.6, delay: [1.1, 0.8, 1.6, 1.8, 1.7] },
		{ label: 'x = 2', client: 'B', at: 0.9, delay: [1.9, 2.0, 1.5, 0.7, 1.3] }
	]
} as const;

/** Each replica applies the writes in the order they arrive; returns arrivals and final value. */
export function naiveReplicas(writes = NAIVE.writes) {
	const n = writes[0].delay.length;
	return Array.from({ length: n }, (_, i) => {
		const arrivals = writes
			.map((w) => ({ label: w.label, client: w.client, at: w.at + w.delay[i] }))
			.sort((a, b) => a.at - b.at);
		return { arrivals, final: arrivals[arrivals.length - 1].label };
	});
}

// ================================================================ Byzantine generals

export type Order = 'attack' | 'retreat';
const opposite = (v: Order): Order => (v === 'attack' ? 'retreat' : 'attack');

/** What a traitor sends to `receiver` when it should pass on `value`. */
type Lie = (sender: number, receiver: number, value: Order) => Order;

/**
 * The traitors' strategies used in the tests. `twoFaced` is the one on the page: a traitor
 * passes on the opposite of what it was told, and a traitorous commander tells
 * odd-numbered lieutenants to attack and even-numbered ones to retreat.
 */
export const LIES: Record<string, Lie> = {
	twoFaced: (s, r, v) => (s === 0 ? (r % 2 === 1 ? 'attack' : 'retreat') : opposite(v)),
	flip: (_s, _r, v) => opposite(v),
	split: (_s, r) => (r % 2 === 1 ? 'attack' : 'retreat'),
	splitOther: (_s, r) => (r % 2 === 0 ? 'attack' : 'retreat'),
	flipEven: (_s, r, v) => (r % 2 === 0 ? opposite(v) : v),
	flipOdd: (_s, r, v) => (r % 2 === 1 ? opposite(v) : v),
	allAttack: () => 'attack',
	allRetreat: () => 'retreat'
};

/** Majority of the values; a tie means the default, retreat. */
function majority(values: Order[]): Order {
	const a = values.filter((v) => v === 'attack').length;
	return a > values.length - a ? 'attack' : 'retreat';
}

interface OmResult {
	/** What each lieutenant of this instance decides. */
	decided: Map<number, Order>;
	/** What each lieutenant received directly from this instance's commander. */
	received: Map<number, Order>;
	/** The values each lieutenant took the majority of: `votes.get(i).get(j)` came via j. */
	votes: Map<number, Map<number, Order>>;
	messages: number;
}

/**
 * Oral Messages OM(m): the commander sends its value to every lieutenant; for m > 0 each
 * lieutenant then acts as commander of OM(m − 1) to pass on what it received, and finally
 * takes the majority of its own value and the values relayed to it by the others.
 */
function om(
	m: number,
	commander: number,
	lieutenants: number[],
	value: Order,
	traitor: (g: number) => boolean,
	lie: Lie
): OmResult {
	const received = new Map(
		lieutenants.map((l) => [l, traitor(commander) ? lie(commander, l, value) : value] as const)
	);
	let messages = lieutenants.length;
	if (m === 0) return { decided: received, received, votes: new Map(), messages };
	const sub = new Map<number, OmResult>();
	for (const j of lieutenants) {
		const r = om(
			m - 1,
			j,
			lieutenants.filter((x) => x !== j),
			received.get(j)!,
			traitor,
			lie
		);
		sub.set(j, r);
		messages += r.messages;
	}
	const decided = new Map<number, Order>();
	const votes = new Map<number, Map<number, Order>>();
	for (const i of lieutenants) {
		const mine = new Map(
			lieutenants.map((j) => [j, j === i ? received.get(i)! : sub.get(j)!.decided.get(i)!] as const)
		);
		votes.set(i, mine);
		decided.set(i, majority([...mine.values()]));
	}
	return { decided, received, votes, messages };
}

/**
 * One run of the generals problem: n generals (general 0 commands), the given traitors, and
 * OM(m) with m = the number of traitors. Reports what every lieutenant received in round 1,
 * what lieutenant i heard from lieutenant j in round 2 (`relayed[i][j]`, for m ≥ 1), every
 * loyal lieutenant's decision and the two conditions of the problem.
 */
export function generals(
	n: number,
	traitors: number[],
	order: Order = 'attack',
	lie: Lie = LIES.twoFaced
) {
	const isTraitor = (g: number) => traitors.includes(g);
	const m = traitors.length;
	const lts = Array.from({ length: n - 1 }, (_, i) => i + 1);
	const run = om(m, 0, lts, order, isTraitor, lie);
	// Round 2 as seen by each lieutenant: what j passed on about the commander's order.
	const relayed: Record<number, Record<number, Order>> = {};
	for (const i of lts) {
		relayed[i] = {};
		for (const j of lts) {
			if (j === i) continue;
			const v = run.received.get(j)!;
			relayed[i][j] = isTraitor(j) ? lie(j, i, v) : v;
		}
	}
	const loyal = lts.filter((l) => !isTraitor(l));
	const decisions = loyal.map((l) => run.decided.get(l)!);
	const agree = decisions.every((d) => d === decisions[0]);
	const obey = isTraitor(0) || decisions.every((d) => d === order);
	return {
		n,
		m,
		traitors,
		received: run.received,
		relayed,
		decided: run.decided,
		votes: run.votes,
		loyal,
		agree,
		obey,
		ok: agree && obey,
		messages: run.messages
	};
}

/** The largest number of traitors OM can survive among n generals: n ≥ 3f + 1. */
export const maxTraitors = (n: number) => Math.floor((n - 1) / 3);

// ================================================================ Raft

export type Role = 'follower' | 'candidate' | 'leader' | 'down';

export interface Entry {
	term: number;
	/** The client command, numbered in the order clients sent them. */
	cmd: number;
}

export interface NodeState {
	t: number;
	role: Role;
	term: number;
	votedFor: number | null;
	log: Entry[];
	commit: number;
	/** When the current election timer started and when it fires (followers, candidates). */
	timerFrom: number;
	timerAt: number;
	votes: number;
}

export type MsgKind = 'vote?' | 'vote' | 'append' | 'ack';

export interface Msg {
	from: number;
	to: number;
	kind: MsgKind;
	term: number;
	sent: number;
	arrive: number;
	/** Set when the message never arrives: the time it is lost (link cut or receiver down). */
	lost?: number;
	/** Votes: granted. Acks: success. */
	ok?: boolean;
	/** Append: number of log entries carried. */
	entries?: number;
}

export interface RaftScenario {
	seed?: number;
	horizon?: number;
	/** Crash the current leader at this time; it restarts at `restartAt` (if set). */
	crashLeader?: { at: number; restartAt?: number };
	/** Crash this many followers at `at` (the leader stays up); they restart at `restartAt`. */
	crashFollowers?: { count: number; at: number; restartAt?: number };
	/** Cut the network at `at`: the leader and one follower on one side, three on the other. */
	partition?: { at: number; healAt?: number };
	/** Times at which clients send commands. */
	commands?: number[];
}

/** Timings in seconds, slowed down (Raft's paper suggests 150–300 ms election timeouts). */
const RAFT = {
	n: 5,
	delay: [0.3, 0.45] as const,
	timeout: [3, 6] as const,
	heartbeat: 1.0,
	retry: 0.5
};

/** Commands every 2.2 s from 4 s on. */
const defaultCommands = (horizon: number) =>
	Array.from({ length: Math.floor((horizon - 4) / 2.2) + 1 }, (_, i) => 4 + 2.2 * i);

type Ev =
	| { t: number; k: 'timeout'; node: number; gen: number }
	| { t: number; k: 'beat'; node: number; term: number }
	| { t: number; k: 'deliver'; msg: Msg; body: Body }
	| { t: number; k: 'command'; cmd: number }
	| { t: number; k: 'script'; run: () => void };

type Body =
	| { kind: 'vote?'; lastIndex: number; lastTerm: number }
	| { kind: 'vote'; granted: boolean }
	| { kind: 'append'; prev: number; prevTerm: number; entries: Entry[]; commit: number }
	| { kind: 'ack'; success: boolean; match: number };

/**
 * Runs a five-server Raft cluster. Returns every server's state over time (`states[i]` is a
 * list of snapshots, the latest at or before t applies), every message, who led which term,
 * and when each command was committed (known committed by a majority's leader).
 */
export function raft(sc: RaftScenario = {}) {
	const n = RAFT.n;
	const horizon = sc.horizon ?? 26;
	const rand = rng(sc.seed ?? 1);
	const between = (a: number, b: number) => a + (b - a) * rand();
	const majority = Math.floor(n / 2) + 1;

	interface Live {
		role: Role;
		term: number;
		votedFor: number | null;
		log: Entry[];
		commit: number;
		up: boolean;
		gen: number;
		timerFrom: number;
		timerAt: number;
		votes: Set<number>;
		next: number[];
		match: number[];
	}
	const nodes: Live[] = Array.from({ length: n }, () => ({
		role: 'follower',
		term: 0,
		votedFor: null,
		log: [],
		commit: 0,
		up: true,
		gen: 0,
		timerFrom: 0,
		timerAt: 0,
		votes: new Set(),
		next: Array<number>(n).fill(1),
		match: Array<number>(n).fill(0)
	}));
	const states: NodeState[][] = Array.from({ length: n }, () => []);
	const msgs: Msg[] = [];
	const leaders: { term: number; node: number; t: number }[] = [];
	const committedAt = new Map<number, number>();
	/** Which side of the cut each server is on (all 0 when the network is whole). */
	let side: number[] = Array<number>(n).fill(0);
	const cuts: { at: number; healAt: number; sides: number[] }[] = [];
	const crashes: { node: number; at: number; restartAt?: number }[] = [];

	let now = 0;
	const queue: Ev[] = [];
	const push = (e: Ev) => {
		let i = queue.length;
		while (i > 0 && queue[i - 1].t > e.t) i--;
		queue.splice(i, 0, e);
	};

	const snap = (i: number) => {
		const s = nodes[i];
		const st: NodeState = {
			t: now,
			role: s.up ? s.role : 'down',
			term: s.term,
			votedFor: s.votedFor,
			log: s.log.slice(),
			commit: s.commit,
			timerFrom: s.timerFrom,
			timerAt: s.timerAt,
			votes: s.votes.size
		};
		const list = states[i];
		const last = list[list.length - 1];
		if (last && last.t === now) list[list.length - 1] = st;
		else list.push(st);
	};

	const resetTimer = (i: number) => {
		const s = nodes[i];
		s.gen++;
		s.timerFrom = now;
		s.timerAt = now + between(RAFT.timeout[0], RAFT.timeout[1]);
		push({ t: s.timerAt, k: 'timeout', node: i, gen: s.gen });
	};

	const send = (from: number, to: number, body: Body) => {
		const term = nodes[from].term;
		const msg: Msg = {
			from,
			to,
			kind: body.kind,
			term,
			sent: now,
			arrive: now + between(RAFT.delay[0], RAFT.delay[1])
		};
		if (body.kind === 'vote') msg.ok = body.granted;
		if (body.kind === 'ack') msg.ok = body.success;
		if (body.kind === 'append') msg.entries = body.entries.length;
		msgs.push(msg);
		if (side[from] !== side[to]) msg.lost = now + (msg.arrive - now) / 2;
		else push({ t: msg.arrive, k: 'deliver', msg, body });
	};

	const stepDown = (i: number, term: number) => {
		const s = nodes[i];
		const wasLeader = s.role === 'leader';
		s.term = term;
		s.role = 'follower';
		s.votedFor = null;
		s.votes = new Set();
		if (wasLeader) resetTimer(i);
	};

	const lastTerm = (s: Live) => (s.log.length ? s.log[s.log.length - 1].term : 0);

	const sendAppend = (i: number, p: number) => {
		const s = nodes[i];
		const prev = s.next[p] - 1;
		send(i, p, {
			kind: 'append',
			prev,
			prevTerm: prev > 0 ? s.log[prev - 1].term : 0,
			entries: s.log.slice(prev),
			commit: s.commit
		});
	};

	const advanceCommit = (i: number) => {
		const s = nodes[i];
		for (let N = s.log.length; N > s.commit; N--) {
			if (s.log[N - 1].term !== s.term) break;
			let count = 1;
			for (let p = 0; p < n; p++) if (p !== i && s.match[p] >= N) count++;
			if (count >= majority) {
				for (let k = s.commit; k < N; k++)
					if (!committedAt.has(s.log[k].cmd)) committedAt.set(s.log[k].cmd, now);
				s.commit = N;
				break;
			}
		}
	};

	const becomeLeader = (i: number) => {
		const s = nodes[i];
		s.role = 'leader';
		s.gen++; // a leader has no election timer
		s.timerAt = s.timerFrom = now;
		s.next = Array<number>(n).fill(s.log.length + 1);
		s.match = Array<number>(n).fill(0);
		leaders.push({ term: s.term, node: i, t: now });
		for (let p = 0; p < n; p++) if (p !== i) sendAppend(i, p);
		push({ t: now + RAFT.heartbeat, k: 'beat', node: i, term: s.term });
	};

	const handle = (to: number, msg: Msg, body: Body) => {
		const s = nodes[to];
		const from = msg.from;
		if (msg.term > s.term) stepDown(to, msg.term);
		switch (body.kind) {
			case 'vote?': {
				const upToDate =
					body.lastTerm > lastTerm(s) ||
					(body.lastTerm === lastTerm(s) && body.lastIndex >= s.log.length);
				const granted =
					msg.term === s.term && (s.votedFor === null || s.votedFor === from) && upToDate;
				if (granted) {
					s.votedFor = from;
					resetTimer(to);
				}
				send(to, from, { kind: 'vote', granted });
				break;
			}
			case 'vote': {
				if (s.role === 'candidate' && msg.term === s.term && body.granted) {
					s.votes.add(from);
					if (s.votes.size >= majority) becomeLeader(to);
				}
				break;
			}
			case 'append': {
				if (msg.term < s.term) {
					send(to, from, { kind: 'ack', success: false, match: 0 });
					break;
				}
				if (s.role !== 'follower') {
					s.role = 'follower';
					s.votes = new Set();
				}
				resetTimer(to);
				if (
					body.prev > s.log.length ||
					(body.prev > 0 && s.log[body.prev - 1].term !== body.prevTerm)
				) {
					send(to, from, {
						kind: 'ack',
						success: false,
						match: Math.min(s.log.length, body.prev - 1)
					});
					break;
				}
				body.entries.forEach((e, k) => {
					const idx = body.prev + k; // zero-based position
					if (idx < s.log.length && s.log[idx].term !== e.term) s.log.length = idx;
					if (idx >= s.log.length) s.log.push(e);
				});
				const last = body.prev + body.entries.length;
				s.commit = Math.max(s.commit, Math.min(body.commit, last));
				send(to, from, { kind: 'ack', success: true, match: last });
				break;
			}
			case 'ack': {
				if (s.role !== 'leader' || msg.term !== s.term) break;
				if (body.success) {
					s.match[from] = Math.max(s.match[from], body.match);
					s.next[from] = s.match[from] + 1;
					advanceCommit(to);
				} else {
					s.next[from] = Math.max(1, Math.min(s.next[from] - 1, body.match + 1));
					sendAppend(to, from);
				}
				break;
			}
		}
	};

	const currentLeader = (): number | null => {
		let best: number | null = null;
		nodes.forEach((s, i) => {
			if (s.up && s.role === 'leader' && (best === null || s.term > nodes[best].term)) best = i;
		});
		return best;
	};

	// ---- clients: two of them, taking turns (odd commands from the first). Each sends to the
	// leader it can reach, the highest-term one, and retries while there is none. During a cut
	// the first client is on the old leader's side and the second on the other side.
	const submitted = new Map<number, number>();
	const submit = (cmd: number) => {
		const cut = side.some((v) => v !== 0);
		const clientSide = cmd % 2 === 1 ? 0 : 1;
		let target: number | null = null;
		nodes.forEach((s, i) => {
			if (!s.up || s.role !== 'leader') return;
			if (cut && side[i] !== clientSide) return;
			if (target === null || s.term > nodes[target].term) target = i;
		});
		if (target === null) {
			push({ t: now + RAFT.retry, k: 'command', cmd });
			return;
		}
		const s = nodes[target];
		s.log.push({ term: s.term, cmd });
		submitted.set(cmd, now);
		snap(target);
	};

	// ---- scripted failures
	const crash = (i: number) => {
		const s = nodes[i];
		s.up = false;
		s.gen++;
		s.votes = new Set();
		snap(i);
	};
	const restart = (i: number) => {
		const s = nodes[i];
		s.up = true;
		s.role = 'follower';
		s.commit = 0; // volatile: relearned from the leader
		resetTimer(i);
		snap(i);
	};
	if (sc.crashLeader) {
		const { at, restartAt } = sc.crashLeader;
		push({
			t: at,
			k: 'script',
			run: () => {
				const l = currentLeader();
				if (l === null) return;
				crash(l);
				crashes.push({ node: l, at, restartAt });
				if (restartAt !== undefined) push({ t: restartAt, k: 'script', run: () => restart(l) });
			}
		});
	}
	if (sc.crashFollowers && sc.crashFollowers.count > 0) {
		const { count, at, restartAt } = sc.crashFollowers;
		push({
			t: at,
			k: 'script',
			run: () => {
				const l = currentLeader() ?? 0;
				// Followers in a fixed order around the ring from the leader.
				const victims = Array.from({ length: n - 1 }, (_, k) => (l + 1 + k) % n).slice(0, count);
				for (const v of victims) {
					crash(v);
					crashes.push({ node: v, at, restartAt });
				}
				if (restartAt !== undefined)
					push({ t: restartAt, k: 'script', run: () => victims.forEach(restart) });
			}
		});
	}
	if (sc.partition) {
		const { at, healAt } = sc.partition;
		push({
			t: at,
			k: 'script',
			run: () => {
				const l = currentLeader() ?? 0;
				side = Array.from({ length: n }, (_, i) => (i === l || i === (l + 1) % n ? 0 : 1));
				cuts.push({ at, healAt: healAt ?? Infinity, sides: side.slice() });
			}
		});
		if (healAt !== undefined)
			push({ t: healAt, k: 'script', run: () => (side = Array<number>(n).fill(0)) });
	}

	(sc.commands ?? defaultCommands(horizon)).forEach((t, k) =>
		push({ t, k: 'command', cmd: k + 1 })
	);
	for (let i = 0; i < n; i++) {
		resetTimer(i);
		snap(i);
	}

	while (queue.length && queue[0].t <= horizon) {
		const e = queue.shift()!;
		now = e.t;
		switch (e.k) {
			case 'timeout': {
				const s = nodes[e.node];
				if (!s.up || s.gen !== e.gen || s.role === 'leader') break;
				s.role = 'candidate';
				s.term++;
				s.votedFor = e.node;
				s.votes = new Set([e.node]);
				resetTimer(e.node);
				for (let p = 0; p < n; p++)
					if (p !== e.node)
						send(e.node, p, { kind: 'vote?', lastIndex: s.log.length, lastTerm: lastTerm(s) });
				snap(e.node);
				break;
			}
			case 'beat': {
				const s = nodes[e.node];
				if (!s.up || s.role !== 'leader' || s.term !== e.term) break;
				for (let p = 0; p < n; p++) if (p !== e.node) sendAppend(e.node, p);
				push({ t: now + RAFT.heartbeat, k: 'beat', node: e.node, term: e.term });
				break;
			}
			case 'deliver': {
				const s = nodes[e.msg.to];
				if (!s.up) {
					e.msg.lost = now;
					break;
				}
				if (side[e.msg.from] !== side[e.msg.to]) {
					e.msg.lost = now - 0.05;
					break;
				}
				handle(e.msg.to, e.msg, e.body);
				snap(e.msg.to);
				break;
			}
			case 'command':
				submit(e.cmd);
				break;
			case 'script':
				e.run();
				for (let i = 0; i < n; i++) snap(i);
				break;
		}
	}

	return { horizon, states, msgs, leaders, committedAt, submitted, cuts, crashes };
}

export type RaftRun = ReturnType<typeof raft>;

/** A server's state at time t (the latest snapshot at or before t). */
export function stateAt(list: NodeState[], t: number): NodeState {
	let lo = 0;
	let hi = list.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (list[mid].t <= t) lo = mid;
		else hi = mid - 1;
	}
	return list[lo];
}

// ================================================================ hash chain and mining

/** Bitcoin hashes block headers twice with SHA-256. */
export const sha256d = (s: string) => sha256(sha256(s));

/**
 * Number of leading zero bits of a digest. Bitcoin reads the hash as a little-endian number,
 * so the zeros it requires are at the end of the raw digest (block hashes are shown
 * byte-reversed, zeros first); counting them at the start is statistically the same.
 */
export function zeroBits(d: Uint8Array): number {
	let z = 0;
	for (const b of d) {
		if (b === 0) {
			z += 8;
			continue;
		}
		return z + Math.clz32(b) - 24;
	}
	return z;
}

export interface Block {
	height: number;
	prev: string;
	data: string;
	nonce: number;
}

/** The text that is hashed: a stand-in for Bitcoin's 80-byte header. */
export const header = (b: Block) => `#${b.height} prev:${b.prev} data:${b.data} nonce:${b.nonce}`;
export const blockDigest = (b: Block) => sha256d(header(b));
export const blockHash = (b: Block) => toHex(blockDigest(b));

/** The hash every chain starts from (the genesis block has no predecessor). */
export const GENESIS_PREV = '0'.repeat(64);

/** How many nonces mining tries before giving up (never reached below 20 bits). */
const MINE_LIMIT = 1 << 24;

/** Tries nonces 0, 1, 2, … until the block's hash starts with `bits` zero bits. */
export function mine(b: Omit<Block, 'nonce'>, bits: number, limit = MINE_LIMIT) {
	for (let nonce = 0; nonce < limit; nonce++) {
		const block = { ...b, nonce };
		const d = blockDigest(block);
		if (zeroBits(d) >= bits) return { block, hash: toHex(d), tries: nonce + 1 };
	}
	return null;
}

/** Builds and (with bits > 0) mines a chain of blocks carrying `data`, each linked to the last. */
export function buildChain(data: string[], bits: number) {
	const blocks: Block[] = [];
	let prev = GENESIS_PREV;
	let tries = 0;
	data.forEach((d, height) => {
		const found = mine({ height, prev, data: d }, bits);
		if (!found) throw new Error('mining limit reached');
		blocks.push(found.block);
		tries += found.tries;
		prev = found.hash;
	});
	return { blocks, tries };
}

/**
 * Checks a chain block by block: its stored `prev` must equal the previous block's hash and its
 * own hash must meet the difficulty. A block is valid only if it and every block before it pass.
 */
export function validate(blocks: Block[], bits: number) {
	let chainOk = true;
	return blocks.map((b, i) => {
		const hash = blockHash(b);
		const linkOk = b.prev === (i === 0 ? GENESIS_PREV : blockHash(blocks[i - 1]));
		const workOk = zeroBits(blockDigest(b)) >= bits;
		chainOk = chainOk && linkOk && workOk;
		return { hash, linkOk, workOk, valid: chainOk };
	});
}

/** Rewrites the chain from `from` on: fixes each `prev` and re-mines each block. */
export function remine(blocks: Block[], from: number, bits: number) {
	const out = blocks.slice(0, from);
	let prev = from === 0 ? GENESIS_PREV : blockHash(blocks[from - 1]);
	const tries: number[] = [];
	for (let i = from; i < blocks.length; i++) {
		const found = mine({ height: blocks[i].height, prev, data: blocks[i].data }, bits);
		if (!found) throw new Error('mining limit reached');
		out.push(found.block);
		tries.push(found.tries);
		prev = found.hash;
	}
	return { blocks: out, tries };
}

// ================================================================ difficulty retarget

/** Bitcoin Core consensus parameters (src/kernel/chainparams.cpp, main network). */
export const BITCOIN = {
	spacing: 10 * 60,
	timespan: 14 * 24 * 60 * 60,
	get interval() {
		return this.timespan / this.spacing; // 2016 blocks
	}
};

/**
 * The retarget of `pow.cpp`: the new difficulty is the old one times the target timespan over
 * the actual one, with the actual timespan clamped to [timespan / 4, timespan × 4]. Bitcoin
 * measures the actual timespan from the first to the last block of the period, which spans
 * 2015 intervals, not 2016 (a known off-by-one kept for compatibility).
 */
export function retarget(difficulty: number, actualTimespan: number) {
	const t = Math.min(BITCOIN.timespan * 4, Math.max(BITCOIN.timespan / 4, actualTimespan));
	return (difficulty * BITCOIN.timespan) / t;
}

/**
 * Average block time over successive 2016-block periods when the hash rate is multiplied by
 * `jump` at the start of period `jumpAt`. Difficulty and hash rate are in units where 1 at
 * difficulty 1 gives 600 s blocks; each period uses the expected (average) block time.
 */
export function retargetRun(jump: number, periods = 8, jumpAt = 2) {
	let difficulty = 1;
	const out: { period: number; hashrate: number; difficulty: number; blockTime: number }[] = [];
	for (let p = 0; p < periods; p++) {
		const hashrate = p >= jumpAt ? jump : 1;
		const blockTime = (BITCOIN.spacing * difficulty) / hashrate;
		out.push({ period: p, hashrate, difficulty, blockTime });
		difficulty = retarget(difficulty, blockTime * (BITCOIN.interval - 1));
	}
	return out;
}

// ================================================================ forks

interface ForkBlock {
	id: number;
	parent: number;
	height: number;
	miner: number;
	t: number;
	/** When each miner heard of it (its finder at once). */
	heard: number[];
}

/** Five mining pools' shares of the hash rate (illustrative). */
export const MINERS = [0.3, 0.25, 0.2, 0.15, 0.1];

/**
 * Miners find blocks at random (a Poisson process averaging one per `interval` seconds over
 * the whole network, split by hash-rate share). Each new block reaches every other miner
 * after `delay` seconds (± 25 %). Every miner mines on the highest block it has heard of,
 * keeping the first one it heard on a tie. Block 0 is the shared starting point.
 */
export function forkRun({
	delay,
	blocks = 40,
	seed = 1,
	interval = BITCOIN.spacing,
	shares = MINERS
}: {
	delay: number;
	blocks?: number;
	seed?: number;
	interval?: number;
	shares?: number[];
}) {
	const rand = rng(seed);
	const m = shares.length;
	const tree: ForkBlock[] = [
		{ id: 0, parent: -1, height: 0, miner: -1, t: 0, heard: Array<number>(m).fill(0) }
	];
	const tip = Array<number>(m).fill(0);
	const arrivals: { t: number; miner: number; block: number }[] = [];
	let now = 0;
	const deliverUntil = (t: number) => {
		arrivals.sort((a, b) => a.t - b.t);
		while (arrivals.length && arrivals[0].t <= t) {
			const a = arrivals.shift()!;
			const b = tree[a.block];
			if (b.height > tree[tip[a.miner]].height) tip[a.miner] = b.id;
		}
	};
	for (let k = 1; k <= blocks; k++) {
		now += -Math.log(1 - rand()) * interval;
		deliverUntil(now);
		let r = rand();
		let miner = 0;
		while (miner < m - 1 && r >= shares[miner]) r -= shares[miner++];
		const parent = tree[tip[miner]];
		const heard = Array.from({ length: m }, (_, j) =>
			j === miner ? now : now + delay * (0.75 + 0.5 * rand())
		);
		const b: ForkBlock = {
			id: k,
			parent: parent.id,
			height: parent.height + 1,
			miner,
			t: now,
			heard
		};
		tree.push(b);
		tip[miner] = k;
		heard.forEach((t, j) => j !== miner && arrivals.push({ t, miner: j, block: k }));
	}
	deliverUntil(Infinity);
	// The winning chain: back from the highest block (the earliest found on a tie).
	let best = tree[0];
	for (const b of tree) if (b.height > best.height) best = b;
	const main = new Set<number>();
	for (let b: ForkBlock | undefined = best; b; b = b.parent >= 0 ? tree[b.parent] : undefined)
		main.add(b.id);
	// Blocks near the top may still be decided either way: count only those 3 or more below.
	const settled = tree.filter((b) => b.id > 0 && b.height <= best.height - 3);
	const stale = settled.filter((b) => !main.has(b.id)).length;
	return { tree, main, stale, settled: settled.length, end: now };
}

/**
 * Rows for drawing a block tree: the winning chain on row 0, every other block on row 1 or
 * above (above its parent's row, and above any other losing block of the same height).
 */
export function forkLanes(tree: ForkBlock[], main: Set<number>) {
	const lane = new Map<number, number>();
	const used = new Map<number, number>();
	for (const b of tree) {
		if (main.has(b.id)) lane.set(b.id, 0);
		else {
			const k = Math.max(1, lane.get(b.parent) ?? 0, (used.get(b.height) ?? 0) + 1);
			used.set(b.height, k);
			lane.set(b.id, k);
		}
	}
	return lane;
}

// ================================================================ the double-spend race

/** Nakamoto 2008 §11, `AttackerSuccessProbability`, transcribed from the paper's C code. */
export function nakamoto(q: number, z: number) {
	const p = 1 - q;
	if (q >= p) return 1;
	const lambda = z * (q / p);
	let sum = 1;
	for (let k = 0; k <= z; k++) {
		let poisson = Math.exp(-lambda);
		for (let i = 1; i <= k; i++) poisson *= lambda / i;
		sum -= poisson * (1 - Math.pow(q / p, z - k));
	}
	return sum;
}

/**
 * The exact probability of the same race: while the honest network finds z blocks, the
 * attacker finds k with a negative binomial distribution (not Poisson), then catches up from
 * z − k behind with probability (q/p)^(z−k). Rosenfeld (2014), eq. 1, as
 * 1 − Σ_{k=0}^{z} C(z+k−1, k) (p^z q^k − q^z p^k) for z ≥ 1.
 */
export function exactRace(q: number, z: number) {
	const p = 1 - q;
	if (q >= p || z === 0) return 1;
	// In logarithms: C(z + k − 1, k) overflows a double for z of a few hundred, while each
	// term (a probability) stays at most 1.
	const lp = Math.log(p);
	const lq = Math.log(q);
	let sum = 0;
	let logc = 0; // ln C(z + k − 1, k)
	for (let k = 0; k <= z; k++) {
		if (k > 0) logc += Math.log(z + k - 1) - Math.log(k);
		sum += Math.exp(logc + z * lp + k * lq) - Math.exp(logc + z * lq + k * lp);
	}
	return 1 - sum;
}

/**
 * The fewest confirmations that bring the attacker's chance below `risk`, by Nakamoto's
 * formula or (with `f = exactRace`) the exact one.
 */
export function confirmationsFor(
	q: number,
	risk = 0.001,
	max = 1000,
	f: (q: number, z: number) => number = nakamoto
) {
	for (let z = 0; z <= max; z++) if (f(q, z) < risk) return z;
	return Infinity;
}

/**
 * One race, block by block: each new block is the attacker's with probability q. The merchant
 * waits for z honest blocks; the attacker wins if its secret chain ever catches up, and gives
 * up when it falls `giveUp` blocks behind (or after `maxBlocks`).
 */
export function race(q: number, z: number, seed: number, giveUp = 6, maxBlocks = 40) {
	const rand = rng(seed);
	const seq: ('h' | 'a')[] = [];
	let h = 0;
	let a = 0;
	let outcome: 'caught-up' | 'gave-up' | 'undecided' = 'undecided';
	let acceptedAt = z === 0 ? 0 : -1;
	while (seq.length < maxBlocks) {
		if (acceptedAt >= 0 && a >= h) {
			outcome = 'caught-up';
			break;
		}
		// With half the power or more he never falls behind for good, so he never gives up.
		if (acceptedAt >= 0 && q < 0.5 && h - a >= giveUp) {
			outcome = 'gave-up';
			break;
		}
		const who = rand() < q ? 'a' : 'h';
		seq.push(who);
		if (who === 'h') h++;
		else a++;
		if (acceptedAt < 0 && h >= z) acceptedAt = seq.length;
	}
	return { seq, outcome, acceptedAt, honest: h, attacker: a };
}
