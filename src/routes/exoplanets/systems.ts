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

/** The reader's planet and star, from the controls (tilt is degrees from edge-on). */
export function readerSystem(params: Params): System {
	return {
		star: starOf(params.star),
		planet: {
			radius: num(params.size, 11),
			mass: num(params.mass, 318),
			a: num(params.dist, 0.05),
			incl: 90 - num(params.tilt, 0)
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
