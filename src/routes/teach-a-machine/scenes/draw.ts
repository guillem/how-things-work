/** Drawing helpers for the teach-a-machine scene: doodles and grids as SVG paths. */
import type { Doodle, Label } from '../model';

/** One path for a whole doodle, drawn into the square box at (x, y) of the given size. */
export function doodlePath(d: Doodle, x: number, y: number, size: number): string {
	const k = size / 100;
	return d
		.map((s) => {
			if (s.length === 0) return '';
			const pts = s.map(([px, py]) => `${(x + px * k).toFixed(1)} ${(y + py * k).toFixed(1)}`);
			// A single tap is a dot: a tiny line that the round cap turns into one.
			return s.length === 1 ? `M${pts[0]}h0.01` : `M${pts.join('L')}`;
		})
		.join('');
}

/** The lines of an n × n grid over the square box at (x, y). */
export function gridPath(x: number, y: number, size: number, n: number): string {
	let d = '';
	for (let i = 1; i < n; i++) {
		const v = (i * size) / n;
		d += `M${x + v} ${y}v${size}M${x} ${y + v}h${size}`;
	}
	return d;
}

export const labelColor = (l: Label | null) =>
	l === 'cat' ? 'var(--tam-cat)' : l === 'house' ? 'var(--tam-house)' : 'var(--stage-ink-muted)';

/** "1 cat", "2 houses". */
export const count = (n: number, l: Label) => `${n} ${l}${n === 1 ? '' : 's'}`;
