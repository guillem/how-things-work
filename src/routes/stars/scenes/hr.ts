/**
 * The Hertzsprung–Russell diagram shared by the HR and life scenes: scales (log Teff to the
 * left, log L up), tick values, and the nearby Gaia stars as a few <path>s of dots grouped by
 * colour (one path per colour keeps the node count small).
 */
import { scale, type Scale } from '#lib/draw/index.ts';
import { NEARBY, NEARBY_WHITE_DWARFS } from '../nearby';
import { grid, starColour } from '../star';

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Hot end and cool end of the temperature axis (log₁₀ K), and the luminosity range (log₁₀ L☉). */
export const LOG_T: [number, number] = [5.0, 3.38];
export const LOG_L: [number, number] = [-5, 6.4];

export function hrScales(b: Box): { sx: Scale; sy: Scale } {
	return {
		sx: scale(LOG_T, [b.x, b.x + b.w]),
		sy: scale(LOG_L, [b.y + b.h, b.y])
	};
}

export const T_TICKS = [50000, 30000, 10000, 5000, 3000];
export const L_TICKS = [-4, -2, 0, 2, 4, 6];
export const fmtT = (T: number) => `${T.toLocaleString('en-US')} K`;
export const fmtL = (lg: number) => (lg === 0 ? '1' : `10${sup(lg)}`);
export function sup(n: number): string {
	return String(n)
		.split('')
		.map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]))
		.join('');
}

/** The nearby stars as dot paths, one per colour bin (0.04 in log T). */
export function dotPaths(sx: Scale, sy: Scale, r = 1.6) {
	const bins = new Map<number, string[]>();
	const add = (lt: number, ll: number) => {
		const k = Math.round(lt / 0.04) * 0.04;
		const x = sx(lt);
		const y = sy(ll);
		const list = bins.get(k) ?? [];
		list.push(
			`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
		);
		bins.set(k, list);
	};
	for (const [lt, ll] of NEARBY) add(lt, ll);
	for (const [lt, ll] of NEARBY_WHITE_DWARFS) add(lt, ll);
	return [...bins.entries()].map(([k, d]) => ({
		key: k,
		colour: starColour(10 ** k),
		d: d.join('')
	}));
}

/** The zero-age main sequence of the MIST grid, from 0.1 to 100 M☉. */
export function zamsPath(sx: Scale, sy: Scale): string {
	return grid
		.map((g, i) => `${i ? 'L' : 'M'}${sx(g.zams[2]).toFixed(1)} ${sy(g.zams[1]).toFixed(1)}`)
		.join('');
}
