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
	let positions: { x: number; y: number }[] = [];
	// Random resting places, not one moth per predictable search slot. Separate the
	// 60-unit tap circles and leave room for the wings inside the bark's edges.
	for (let attempt = 0; positions.length < shades.length && attempt < 10000; attempt++) {
		const point = { x: 62 + rand() * 506, y: 110 + rand() * 364 };
		if (positions.every((p) => Math.hypot(point.x - p.x, point.y - p.y) >= 62)) {
			positions.push(point);
		}
	}
	if (positions.length < shades.length) {
		// Bounded-retry safety net: take a random subset of 42 staggered, jittered
		// sites, rather than recreating a full row-and-column set of occupied slots.
		// Nearest sites remain over 62 units apart even at opposite jitter extremes.
		positions = Array.from({ length: 42 }, (_, i) => {
			const row = Math.floor(i / 7);
			return {
				x: 65 + (i % 7) * 76 + (row % 2) * 38 + (rand() - 0.5) * 8,
				y: 112 + row * 66 + (rand() - 0.5) * 8
			};
		});
		for (let i = positions.length - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[positions[i], positions[j]] = [positions[j], positions[i]];
		}
	}
	return shades.map((shade, i) => ({
		id: i,
		...positions[i],
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
		// Clipping puts some offspring exactly at an extreme and biases edge parents
		// slightly inward; this is an illustrative trait rule, not moth genetics.
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
