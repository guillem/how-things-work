/**
 * Drawing Cα traces in 3D for the protein scenes: an orthographic projection the reader can
 * turn (a slow automatic turn plus dragging or arrow keys), and the trace cut into short
 * depth-sorted pieces so that near parts are drawn over far ones with few SVG nodes.
 */
import { clamp, startDrag, type Point } from '#lib/draw/index.ts';
import type { Vec3 } from '../structure';

export interface Projected {
	x: number;
	y: number;
	/** Towards the viewer is positive. */
	z: number;
}

/** Turns by `yaw` about the vertical axis, then tilts by `pitch`; `scale` px per Å. */
export function projector(yaw: number, pitch: number, scale: number, cx: number, cy: number) {
	const cy0 = Math.cos(yaw);
	const sy0 = Math.sin(yaw);
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	return (v: Vec3): Projected => {
		const x = v[0] * cy0 + v[2] * sy0;
		const z1 = -v[0] * sy0 + v[2] * cy0;
		const y = v[1] * cp - z1 * sp;
		const z = v[1] * sp + z1 * cp;
		return { x: cx + x * scale, y: cy - y * scale, z };
	};
}

export interface Piece {
	key: string;
	d: string;
	color: string;
	/** Mean depth (Å, towards the viewer positive). */
	z: number;
}

/**
 * Cuts the runs of a projected trace into pieces of at most `k` bonds that share a colour
 * (`colorOf(i)` colours the bond from residue i to i + 1), sorted back to front.
 */
export function pieces(
	proj: readonly (Projected | null)[],
	runs: readonly number[][],
	colorOf: (i: number) => string,
	k = 3
): Piece[] {
	const out: Piece[] = [];
	for (const run of runs) {
		let start = 0;
		while (start < run.length - 1) {
			const color = colorOf(run[start]);
			let end = start + 1;
			while (end < run.length - 1 && end - start < k && colorOf(run[end]) === color) end++;
			// A smooth curve through the trace: straight from the first point to the middle of
			// the first bond, then a quadratic bend at each Cα to the middle of the next bond,
			// then straight to the last point. Bond j belongs to the piece that draws from the
			// middle of bond j − 1 … to the middle of bond j, so neighbouring pieces meet.
			const at = (m: number) => proj[run[m]]!;
			const half = (m: number) => ({ x: (at(m).x + at(m + 1).x) / 2, y: (at(m).y + at(m + 1).y) / 2 });
			const f = (v: number) => v.toFixed(1);
			const a = start === 0 ? at(0) : half(start - 1);
			let d = `M${f(a.x)} ${f(a.y)}`;
			if (start === 0) d += `L${f(half(0).x)} ${f(half(0).y)}`;
			let z = 0;
			for (let m = start; m <= end; m++) z += at(m).z;
			for (let m = Math.max(1, start); m < end; m++) {
				const c = at(m);
				const e = half(m);
				d += `Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
			}
			if (end === run.length - 1) d += `L${f(at(end).x)} ${f(at(end).y)}`;
			out.push({ key: `${run[start]}`, d, color, z: z / (end - start + 1) });
			start = end;
		}
	}
	return out.sort((a, b) => a.z - b.z);
}

/**
 * The reader's control over a 3D view: a slow turn that pauses while the pointer is over the
 * drawing (so it holds still to be looked at), dragging, and arrow keys. Event handlers pass
 * the scene's current `t`; nothing here runs in an effect.
 */
export class Turntable {
	yawOff = $state(0);
	pitch = $state(0.2);
	pausedAt = $state<number | null>(null);
	shift = $state(0);
	private last: Point | null = null;

	constructor(
		readonly speed = 0.12,
		readonly yaw0 = 0,
		pitch0 = 0.2
	) {
		this.pitch = pitch0;
	}

	yaw(t: number, reduced: boolean) {
		return this.yawOff + this.yaw0 + (reduced ? 0 : this.speed * (this.pausedAt ?? t) - this.shift);
	}
	hold(t: number) {
		if (this.pausedAt === null) this.pausedAt = t;
	}
	release(t: number) {
		if (this.pausedAt === null) return;
		this.shift += this.speed * (t - this.pausedAt);
		this.pausedAt = null;
	}
	drag(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (this.last) {
					this.yawOff += (p.x - this.last.x) * 0.01;
					this.pitch = clamp(this.pitch + (p.y - this.last.y) * 0.01, -1.4, 1.4);
				}
				this.last = p;
			},
			() => (this.last = null)
		);
	}
	key(e: KeyboardEvent) {
		const k = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') this.yawOff -= k;
		else if (e.key === 'ArrowRight') this.yawOff += k;
		else if (e.key === 'ArrowUp') this.pitch = clamp(this.pitch - k, -1.4, 1.4);
		else if (e.key === 'ArrowDown') this.pitch = clamp(this.pitch + k, -1.4, 1.4);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
	degrees(t: number, reduced: boolean) {
		return Math.round((((this.yaw(t, reduced) * 180) / Math.PI) % 360) + 360) % 360;
	}
}
