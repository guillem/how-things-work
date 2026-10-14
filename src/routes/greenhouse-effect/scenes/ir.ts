/**
 * Photons for the greenhouse scenes, as pure functions of time. An infrared
 * photon leaves the ground and either escapes to space or is absorbed by a
 * greenhouse-gas molecule in the air; a moment later the molecule gives off a
 * new photon in a random direction, up or down. Nothing bounces: the photon
 * ends at the molecule and the new one starts there.
 */
import { hash, smoothstep } from '#lib/draw/index.ts';

export interface IrOptions {
	/** Horizontal range of the photons' starting points. */
	x0: number;
	x1: number;
	/** The ground (photons start here) and the top of the air (they leave here). */
	ground: number;
	top: number;
	/** Where in the air absorption happens (y range). */
	airTop: number;
	airBottom: number;
	/** Chance that a photon is absorbed on its way up. */
	absorb: number;
	/** Seconds per photon life. */
	period?: number;
	salt?: number;
}

export interface IrPhoton {
	key: number;
	x: number;
	y: number;
	/** Direction of travel, degrees clockwise from +x (−90 = up). */
	angle: number;
	opacity: number;
	/** The absorbing molecule's glow, when one is lit. */
	flash: { x: number; y: number; opacity: number } | null;
}

/** Photon `i` of `n` at time `t`. */
export function irPhoton(i: number, n: number, t: number, o: IrOptions): IrPhoton {
	const period = o.period ?? 3.2;
	const s = t / period + i / n;
	const k = Math.floor(s);
	const u = s - k;
	const salt = (o.salt ?? 0) + k * 7.31;
	const x = o.x0 + (o.x1 - o.x0) * hash(i * 13.7 + 1, salt);
	const absorbed = hash(i * 5.3 + 2, salt) < o.absorb;
	const fade = (a: number, b: number, v: number) =>
		smoothstep(a, a + 0.06, v) * (1 - smoothstep(b - 0.06, b, v));
	if (!absorbed) {
		const y = o.ground + (o.top - o.ground) * (u / 0.9);
		return { key: i, x, y, angle: -90, opacity: fade(0, 0.9, u), flash: null };
	}
	const yAbs = o.airBottom + (o.airTop - o.airBottom) * hash(i * 3.1 + 3, salt);
	if (u < 0.4) {
		const y = o.ground + (yAbs - o.ground) * (u / 0.4);
		return {
			key: i,
			x,
			y,
			angle: -90,
			opacity: fade(0, 0.4, u),
			flash: null
		};
	}
	const flash = { x, y: yAbs, opacity: smoothstep(0.36, 0.42, u) * (1 - smoothstep(0.5, 0.62, u)) };
	if (u < 0.5) return { key: i, x, y: yAbs, angle: -90, opacity: 0, flash };
	// Re-emitted: up or down at random, within ±50° of the vertical.
	const up = hash(i * 9.7 + 4, salt) < 0.5;
	const tilt = (hash(i * 2.9 + 5, salt) - 0.5) * 100;
	const angle = (up ? -90 : 90) + tilt;
	const rad = (angle * Math.PI) / 180;
	const end = up ? o.top : o.ground;
	const dist = Math.abs((end - yAbs) / Math.sin(rad));
	const v = (u - 0.5) / 0.45;
	return {
		key: i,
		x: x + Math.cos(rad) * dist * Math.min(1, v),
		y: yAbs + Math.sin(rad) * dist * Math.min(1, v),
		angle,
		opacity: fade(0.5, 0.95, u),
		flash: flash.opacity > 0.01 ? flash : null
	};
}

/** A sunlight photon `i` of `n` travelling down from (x, top) to y `bottom`. */
export function sunPhoton(
	i: number,
	n: number,
	t: number,
	top: number,
	bottom: number,
	period = 2.4
) {
	const u = (t / period + i / n) % 1;
	return {
		key: i,
		y: top + (bottom - top) * u,
		opacity: smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u))
	};
}

/** °C with a sign and one decimal: +1.2 °C, −0.3 °C. */
export const signed = (v: number, digits = 1) =>
	`${v < -0.05 / 10 ** (digits - 1) ? '−' : '+'}${Math.abs(v).toFixed(digits)}`;
