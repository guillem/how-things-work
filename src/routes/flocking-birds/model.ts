/**
 * Reynolds-style steering with seven nearest neighbours, a deliberately simplified
 * 2-D model. Three rules suffice here; they are not measured laws of real birds.
 * Neighbours are topological (Ballerini et al. 2008), spacing is short-range.
 * The sky wraps, so no wall or shared destination secretly holds the flock together.
 */
export interface Bird {
	x: number;
	y: number;
	vx: number;
	vy: number;
}
export interface Vector {
	x: number;
	y: number;
}
export interface Rules {
	separation: boolean;
	alignment: boolean;
	cohesion: boolean;
	hawk: boolean;
}
export interface Steering {
	separation: Vector;
	alignment: Vector;
	cohesion: Vector;
	escape: Vector;
	neighbours: number[];
}
export const WIDTH = 860;
export const HEIGHT = 370;
export const SPEED = 48;
const DT = 1 / 30;
export const ALL_RULES: Rules = { separation: true, alignment: true, cohesion: true, hawk: false };

export function initialFlock(seed = 138): Bird[] {
	let s = seed >>> 0;
	const random = () => {
		s = (Math.imul(1664525, s) + 1013904223) >>> 0;
		return s / 4294967296;
	};
	return Array.from({ length: 100 }, () => {
		const angle = random() * Math.PI * 2;
		const radius = Math.sqrt(random());
		const heading = (random() - 0.5) * Math.PI * 1.6;
		return {
			x: WIDTH / 2 + Math.cos(angle) * radius * 160,
			y: HEIGHT / 2 + Math.sin(angle) * radius * 115,
			vx: Math.cos(heading) * SPEED,
			vy: Math.sin(heading) * SPEED
		};
	});
}

/** Shortest displacement on the wrapping sky. */
export function displacement(a: Bird | Vector, b: Bird | Vector): Vector {
	let x = b.x - a.x,
		y = b.y - a.y;
	if (x > WIDTH / 2) x -= WIDTH;
	if (x < -WIDTH / 2) x += WIDTH;
	if (y > HEIGHT / 2) y -= HEIGHT;
	if (y < -HEIGHT / 2) y += HEIGHT;
	return { x, y };
}

export function hawkAt(time: number): Vector {
	// A single pass through the sky, not an intelligent predator or a bird controller.
	return { x: WIDTH + 30 - Math.min(18, Math.max(0, time - 3)) * 48, y: HEIGHT / 2 };
}

export function steering(
	birds: readonly Bird[],
	index: number,
	rules: Rules,
	time: number
): Steering {
	const bird = birds[index];
	const nearest: { index: number; d2: number; x: number; y: number }[] = [];
	for (let j = 0; j < birds.length; j++) {
		if (j === index) continue;
		const d = displacement(bird, birds[j]);
		const d2 = d.x * d.x + d.y * d.y;
		if (nearest.length === 7 && d2 >= nearest[6].d2) continue;
		let k = nearest.findIndex((n) => d2 < n.d2);
		if (k < 0) k = nearest.length;
		nearest.splice(k, 0, { index: j, d2, ...d });
		if (nearest.length > 7) nearest.pop();
	}
	const separation = { x: 0, y: 0 },
		alignment = { x: 0, y: 0 },
		cohesion = { x: 0, y: 0 },
		escape = { x: 0, y: 0 };
	for (const n of nearest) {
		const d = Math.sqrt(n.d2);
		if (rules.separation && d < 26 && d > 0.0001) {
			const strength = (26 - d) * 3.8;
			separation.x -= (n.x / d) * strength;
			separation.y -= (n.y / d) * strength;
		}
		alignment.x += birds[n.index].vx;
		alignment.y += birds[n.index].vy;
		cohesion.x += n.x;
		cohesion.y += n.y;
	}
	const n = nearest.length;
	if (n) {
		alignment.x = rules.alignment ? (alignment.x / n - bird.vx) * 1.8 : 0;
		alignment.y = rules.alignment ? (alignment.y / n - bird.vy) * 1.8 : 0;
		cohesion.x = rules.cohesion ? (cohesion.x / n) * 0.65 : 0;
		cohesion.y = rules.cohesion ? (cohesion.y / n) * 0.65 : 0;
	}
	if (rules.hawk && time >= 3 && time < 21) {
		const d = displacement(hawkAt(time), bird);
		const distance = Math.hypot(d.x, d.y);
		if (distance < 110 && distance > 0.0001) {
			const strength = (110 - distance) * 5;
			escape.x = (d.x / distance) * strength;
			escape.y = (d.y / distance) * strength;
		}
	}
	return { separation, alignment, cohesion, escape, neighbours: nearest.map((n) => n.index) };
}

/** Simultaneous update: neither array order nor a special first bird gives leadership. */
export function advance(birds: readonly Bird[], rules: Rules, time: number, dt = DT): Bird[] {
	return birds.map((bird, i) => {
		const f = steering(birds, i, rules, time);
		let ax = f.separation.x + f.alignment.x + f.cohesion.x + f.escape.x;
		let ay = f.separation.y + f.alignment.y + f.cohesion.y + f.escape.y;
		const acceleration = Math.hypot(ax, ay);
		if (acceleration > 160) {
			ax *= 160 / acceleration;
			ay *= 160 / acceleration;
		}
		let vx = bird.vx + ax * dt,
			vy = bird.vy + ay * dt;
		const speed = Math.hypot(vx, vy);
		if (speed > 0.0001) {
			vx *= SPEED / speed;
			vy *= SPEED / speed;
		} else {
			vx = bird.vx;
			vy = bird.vy;
		}
		return {
			x: (((bird.x + vx * dt) % WIDTH) + WIDTH) % WIDTH,
			y: (((bird.y + vy * dt) % HEIGHT) + HEIGHT) % HEIGHT,
			vx,
			vy
		};
	});
}

export function simulate(rules: Rules, seconds: number, seed = 138): Bird[] {
	let birds = initialFlock(seed);
	for (let frame = 0; frame < Math.round(seconds / DT); frame++)
		birds = advance(birds, rules, frame * DT);
	return birds;
}

export function agreement(birds: readonly Bird[]): number {
	if (!birds.length) return 0;
	let x = 0,
		y = 0;
	for (const b of birds) {
		const speed = Math.hypot(b.vx, b.vy);
		x += b.vx / speed;
		y += b.vy / speed;
	}
	return Math.hypot(x, y) / birds.length;
}

export function crowdedPairs(birds: readonly Bird[]): number {
	let count = 0;
	for (let i = 0; i < birds.length; i++)
		for (let j = i + 1; j < birds.length; j++) {
			const d = displacement(birds[i], birds[j]);
			if (Math.hypot(d.x, d.y) < 12) count++;
		}
	return count;
}

export function neighbourDistance(birds: readonly Bird[]): number {
	let total = 0;
	for (let i = 0; i < birds.length; i++) {
		let best = Infinity;
		for (let j = 0; j < birds.length; j++)
			if (i !== j) {
				const d = displacement(birds[i], birds[j]);
				best = Math.min(best, Math.hypot(d.x, d.y));
			}
		total += best;
	}
	return total / birds.length;
}
