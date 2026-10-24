/**
 * The machine behind "Teach a machine to tell things apart": a k-nearest-neighbours classifier
 * on drawings. Every drawing is shrunk to a grid of squares (a square is inked if a line passes
 * through it, empty if not), two drawings are compared by counting the squares where one has ink
 * and the other doesn't (the Hamming distance between the two grids), and the labels of the
 * stored drawings with the fewest differing squares vote. Nothing else: it never looks at the
 * shape as a whole, and it does not centre or resize a drawing first, so where a drawing sits on
 * the pad matters as much as what it shows.
 */

/** A point on the drawing pad, from (0, 0) at the top left to (100, 100) at the bottom right. */
export type Point = readonly [number, number];
/** One line drawn without lifting the pen. */
export type Stroke = readonly Point[];
export type Doodle = readonly Stroke[];
export type Label = 'cat' | 'house';
export const LABELS: readonly Label[] = ['cat', 'house'];

export interface Example {
	doodle: Doodle;
	label: Label;
}

/** Squares across (and down) the grid a drawing is shrunk to. */
export const GRID = 10;
/** How many of the most alike stored drawings vote. */
export const K = 3;

/** The squares of the grid, row by row from the top left: true where a line passes through. */
export function squares(doodle: Doodle, n = GRID): boolean[] {
	const cells: boolean[] = new Array<boolean>(n * n).fill(false);
	const cell = (v: number) => Math.min(n - 1, Math.max(0, Math.floor((v / 100) * n)));
	const mark = (x: number, y: number) => {
		cells[cell(y) * n + cell(x)] = true;
	};
	for (const stroke of doodle) {
		if (stroke.length === 0) continue;
		mark(stroke[0][0], stroke[0][1]);
		for (let i = 1; i < stroke.length; i++) {
			const [x0, y0] = stroke[i - 1];
			const [x1, y1] = stroke[i];
			// Walk along the line in small steps (a tenth of a square), marking every square it enters.
			const steps = Math.max(1, Math.ceil((Math.hypot(x1 - x0, y1 - y0) * n) / 10));
			for (let s = 1; s <= steps; s++)
				mark(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
		}
	}
	return cells;
}

/** How many inked squares a drawing has. */
export function inked(grid: readonly boolean[]): number {
	return grid.reduce((n, c) => n + (c ? 1 : 0), 0);
}

/** The number of squares where one grid has ink and the other doesn't. */
export function differ(a: readonly boolean[], b: readonly boolean[]): number {
	let d = 0;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
	return d;
}

export interface Neighbour {
	/** Its place in the list of examples. */
	index: number;
	label: Label;
	/** Squares that differ from the new drawing. */
	differ: number;
}

export interface Guess {
	/** The answer, or null when there is nothing to compare (no drawing, or no examples). */
	label: Label | null;
	/** Every stored drawing, most alike first (ties keep the order they were shown in). */
	ranked: Neighbour[];
	/** The ones that vote: the K most alike, or only the most alike when fewer than K are stored. */
	voters: Neighbour[];
	votes: Record<Label, number>;
}

/** Lets the stored drawings most like the new one vote on its label. */
export function guess(doodle: Doodle, examples: readonly Example[], k = K): Guess {
	const grid = squares(doodle);
	const votes: Record<Label, number> = { cat: 0, house: 0 };
	const ranked = examples
		.map((e, index) => ({ index, label: e.label, differ: differ(grid, squares(e.doodle)) }))
		.sort((a, b) => a.differ - b.differ || a.index - b.index);
	if (inked(grid) === 0 || ranked.length === 0) return { label: null, ranked, voters: [], votes };
	const voters = ranked.slice(0, ranked.length >= k ? k : 1);
	for (const v of voters) votes[v.label]++;
	// A tied vote (possible only with an even k) goes to the most alike drawing.
	const label =
		votes.cat > votes.house ? 'cat' : votes.house > votes.cat ? 'house' : voters[0].label;
	return { label, ranked, voters, votes };
}

/** How many of the test drawings it labels right, comparing them with the examples only. */
export function score(
	examples: readonly Example[],
	tests: readonly Example[],
	k = K
): { right: number; of: number } {
	const right = tests.filter((t) => guess(t.doodle, examples, k).label === t.label).length;
	return { right, of: tests.length };
}

/** A drawing as text (for keeping the reader's drawing in a page parameter): "x.y x.y,x.y …". */
export function encode(doodle: Doodle): string {
	return doodle
		.map((s) => s.map(([x, y]) => `${Math.round(x)}.${Math.round(y)}`).join(' '))
		.join(',');
}

export function decode(text: string): Doodle {
	if (!text) return [];
	return text.split(',').map((s) =>
		s
			.split(' ')
			.filter(Boolean)
			.map((p) => {
				const [x, y] = p.split('.').map(Number);
				return [x, y] as const;
			})
	);
}
