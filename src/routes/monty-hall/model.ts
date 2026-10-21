/**
 * The Monty Hall game, played for real with a seeded random number generator.
 *
 * A prize (a car) is behind one of `doors` doors, goats behind the others, the prize's door chosen
 * at random. The player picks a door. The host then opens all the other doors but one, showing
 * goats. A host who knows where the car is always can (the classic game, vos Savant 1990). A host
 * who doesn't know opens doors at random and sometimes shows the car: that game is spoiled. Then
 * the player stays with the first pick or switches to the one other closed door.
 */

/** Small, fast seeded generator (mulberry32), so the page plays the same games every time. */
export function rng(seed: number): () => number {
	let a = seed >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const pickOne = <T>(xs: readonly T[], r: () => number): T => xs[Math.floor(r() * xs.length)];

export interface Game {
	doors: number;
	/** Doors are numbered from 0. */
	prize: number;
	pick: number;
	/** The doors the host opened. */
	opened: number[];
	/** The one other door left closed (the switch door). */
	other: number;
	/** The host showed the car: the game can't go on as planned. */
	spoiled: boolean;
	stayWins: boolean;
	switchWins: boolean;
}

/**
 * Play one game. `pick` is the player's first choice (random if omitted). With `hostKnows`, the
 * host leaves closed the prize door, or (when the player already has the prize) a random other
 * door; without it, the door left closed is chosen at random.
 */
export function play(
	r: () => number,
	opts: { doors?: number; pick?: number; hostKnows?: boolean; prize?: number } = {}
): Game {
	const doors = opts.doors ?? 3;
	const hostKnows = opts.hostKnows ?? true;
	const prize = opts.prize ?? Math.floor(r() * doors);
	const pick = opts.pick ?? Math.floor(r() * doors);
	const others = Array.from({ length: doors }, (_, i) => i).filter((i) => i !== pick);
	const other = hostKnows ? (prize !== pick ? prize : pickOne(others, r)) : pickOne(others, r);
	const opened = others.filter((i) => i !== other);
	const spoiled = opened.includes(prize);
	return {
		doors,
		prize,
		pick,
		opened,
		other,
		spoiled,
		stayWins: !spoiled && pick === prize,
		switchWins: !spoiled && other === prize
	};
}

/** Play `n` games from a seed. */
export function playMany(
	n: number,
	seed: number,
	opts: { doors?: number; hostKnows?: boolean } = {}
): Game[] {
	const r = rng(seed);
	return Array.from({ length: n }, () => play(r, opts));
}

export interface Tally {
	games: number;
	stayWins: number;
	switchWins: number;
	spoiled: number;
}

export function tally(games: readonly Game[]): Tally {
	return {
		games: games.length,
		stayWins: games.filter((g) => g.stayWins).length,
		switchWins: games.filter((g) => g.switchWins).length,
		spoiled: games.filter((g) => g.spoiled).length
	};
}

/**
 * Every place the prize could be, for a first pick, with the knowing host: what staying and
 * switching win. (When the player picked the prize, either other door could be left closed; it
 * doesn't change the result, so the lower-numbered one is shown.)
 */
export function cases(pick: number, doors = 3): Game[] {
	return Array.from({ length: doors }, (_, prize) => {
		const others = Array.from({ length: doors }, (_, i) => i).filter((i) => i !== pick);
		const other = prize !== pick ? prize : others[0];
		const opened = others.filter((i) => i !== other);
		return {
			doors,
			prize,
			pick,
			opened,
			other,
			spoiled: false,
			stayWins: pick === prize,
			switchWins: other === prize
		};
	});
}
