/**
 * The systems the scenes draw: the reader's planet (from the controls) and the
 * real "mystery" planets of the read-back step (from the archive).
 */
import type { Params } from '#lib/explainer/index.ts';
import type { ArchivePlanet } from './archive';
import {
	archivePlanet,
	archiveSystem,
	periodDays,
	rvAmplitude,
	starOf,
	transitDepth,
	transits,
	type Planet,
	type Star
} from './exoplanets';

export interface System {
	star: Star;
	planet: Planet;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);

// The sliders: orbit size and mass on logarithmic scales (the value is log₁₀ of AU or
// Earth masses), the tilt on a cubic one (0–100 → 0–90°, fine near edge-on, where
// transits are decided).

/** Orbit radius, AU, from the slider value. */
export const distOf = (v: number) => 10 ** v;
/** Slider value for an orbit radius in AU. */
export const distValue = (au: number) => Math.log10(au);
/** Planet mass, Earth masses, from the slider value. */
export const massOf = (v: number) => 10 ** v;
/** Tilt from edge-on, degrees, from the slider value 0–100. */
export const tiltOf = (v: number) => 90 * (Math.min(100, Math.max(0, v)) / 100) ** 3;
/** An orbit radius in AU with sensible digits. */
export const fmtAU = (au: number) =>
	au < 0.1 ? au.toFixed(3) : au < 1 ? au.toFixed(2) : au < 10 ? au.toFixed(2) : au.toFixed(1);
/** A tilt in degrees with sensible digits. */
export const fmtTilt = (d: number) => (d < 1 ? d.toFixed(2) : d < 10 ? d.toFixed(1) : d.toFixed(0));

/** The reader's planet and star, from the controls. */
export function readerSystem(params: Params): System {
	return {
		star: starOf(params.star),
		planet: {
			radius: num(params.size, 11),
			mass: massOf(num(params.mass, Math.log10(318))),
			a: distOf(num(params.dist, Math.log10(0.05))),
			incl: 90 - tiltOf(num(params.tilt, 0))
		}
	};
}

/** The read-back step's planets, in the order of the "Mystery planet" menu. */
export const MYSTERIES = [
	{ id: 'hd209458', name: 'HD 209458 b' },
	{ id: 'peg51', name: '51 Peg b' },
	{ id: 'hd189733', name: 'HD 189733 b' }
] as const;

export function mysteryPlanet(id: string): ArchivePlanet {
	const m = MYSTERIES.find((q) => q.id === id) ?? MYSTERIES[0];
	return archivePlanet(m.name);
}

export function mysterySystem(id: string): System {
	return archiveSystem(mysteryPlanet(id));
}

/** What the curves of a mystery planet really show: depth in %, K in m/s, period in days. */
export function mysteryTruth(id: string) {
	const { star, planet } = mysterySystem(id);
	return {
		depthPercent: transits(star, planet) ? transitDepth(star, planet) * 100 : 0,
		K: rvAmplitude(star, planet),
		period: periodDays(star, planet)
	};
}

/** Upper ends of the two measuring sliders for a mystery planet: [depth %, K m/s]. */
export function measureBounds(id: string): [number, number] {
	const tr = mysteryTruth(id);
	return [Math.max(0.1, Math.ceil(tr.depthPercent * 16) / 10), Math.ceil((tr.K * 1.6) / 10) * 10];
}
