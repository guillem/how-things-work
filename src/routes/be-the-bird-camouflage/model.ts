/**
 * A quantitative-trait selection toy, NOT peppered-moth Mendelian genetics.
 * The reader alone removes moths. Surviving parents are sampled uniformly;
 * an offspring inherits its parent's shade with a small independent variation.
 * Bark never enters reproduction: it changes visibility, never inheritance.
 */
export interface Moth {
	id: number;
	x: number;
	y: number;
	angle: number;
	/** 0 = pale, 1 = dark. */
	shade: number;
}

export const POPULATION = 24;
export const HUNT_SECONDS = 12;

function random(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(1664525, s) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function place(shades: readonly number[], seed: number): Moth[] {
	const rand = random(seed);
	// One moth in each loose grid cell, leaving room for both wings and a tap target.
	return shades.map((shade, i) => ({
		id: i,
		x: 70 + (i % 6) * 84 + rand() * 24,
		y: 115 + Math.floor(i / 6) * 91 + rand() * 26,
		angle: (rand() - 0.5) * 70,
		shade
	}));
}

export function initialPopulation(seed = 17): Moth[] {
	// A deliberately broad classroom population, not measured moth frequencies.
	const shades = Array.from({ length: POPULATION }, (_, i) => (i + 0.5) / POPULATION);
	const rand = random(seed);
	for (let i = shades.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[shades[i], shades[j]] = [shades[j], shades[i]];
	}
	return place(shades, seed + 1);
}

export function survivors(population: readonly Moth[], eaten: ReadonlySet<number>): Moth[] {
	return population.filter((m) => !eaten.has(m.id));
}

/** Empty survivors mean extinction. Nothing is secretly rescued or recoloured. */
export function nextGeneration(parents: readonly Moth[], seed: number): Moth[] {
	if (parents.length === 0) return [];
	const rand = random(seed);
	const shades = Array.from({ length: POPULATION }, () => {
		const parent = parents[Math.floor(rand() * parents.length)];
		// Sum of two uniforms: small symmetric variation, clipped at the trait limits.
		return Math.max(0, Math.min(1, parent.shade + (rand() + rand() - 1) * 0.08));
	});
	return place(shades, seed + 4001);
}

export function shadeCounts(population: readonly Moth[]): number[] {
	const bins = [0, 0, 0, 0, 0, 0];
	for (const m of population) bins[Math.min(5, Math.floor(m.shade * 6))]++;
	return bins;
}

/** Luminance-like neutral pigment used by both moths and procedural bark. */
export function shadeColor(shade: number): string {
	const n = Math.round(226 - Math.max(0, Math.min(1, shade)) * 180);
	return `rgb(${n + 5}, ${n + 2}, ${n})`;
}

/** Procedural marks, deliberately independent of the moth positions. */
export function barkMarks(): { x: number; y: number; length: number; width: number }[] {
	const rand = random(3187);
	return Array.from({ length: 76 }, () => ({
		x: 34 + rand() * 558,
		y: 90 + rand() * 399,
		length: 9 + rand() * 37,
		width: 0.8 + rand() * 2
	}));
}
