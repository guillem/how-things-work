// Checks the sheared crystal behind the dislocations-alloys explainer: the lattice it relaxes to,
// the perfect crystal's ideal strength against Frenkel's estimate, how little stress one
// dislocation needs, how foreign atoms and a hard particle raise it, and the numbers the scenes
// draw as reference marks. Runs in Node.
import { expect, test } from '@playwright/test';
import { A0, Crystal, cores, slipBonds } from '../src/routes/dislocations-alloys/crystal';
import {
	GLIDE_STRESS,
	IDEAL_STRENGTH,
	OBSTACLE_AT,
	SHEAR_MODULUS,
	specFor
} from '../src/routes/dislocations-alloys/setups';

/** Runs a crystal for `frames` frames and returns its curve. */
function run(c: Crystal, frames: number) {
	c.frame(frames);
	return c.curve;
}
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

test.describe('the model crystal', () => {
	test('relaxes to the triangular lattice of the 2D Lennard-Jones solid', () => {
		// The energy per atom of a triangular lattice of LJ atoms (cut at 2.5σ), summed over
		// the lattice, is lowest at the spacing the crystal is built with.
		const energy = (a: number) => {
			let e = 0;
			for (let i = -6; i <= 6; i++)
				for (let j = -6; j <= 6; j++) {
					if (!i && !j) continue;
					const x = a * (i + j / 2);
					const y = (a * Math.sqrt(3) * j) / 2;
					const r = Math.hypot(x, y);
					if (r < 2.5) e += 2 * (r ** -12 - r ** -6);
				}
			return e;
		};
		const best = [1.09, 1.1, 1.105, 1.11, 1.1115, 1.115, 1.12, 1.13].reduce((p, a) =>
			energy(a) < energy(p) ? a : p
		);
		expect(Math.abs(best - A0)).toBeLessThan(0.006);
		// and the relaxed crystal pushes on its grip with no shear stress
		const c = new Crystal(specFor('perfect'));
		expect(Math.abs(c.frame(0).stress)).toBeLessThan(0.01);
	});

	test('the perfect crystal holds to about G/2π, as Frenkel estimated, then a whole plane slips', () => {
		const c = new Crystal(specFor('perfect'));
		const { stress, strain } = run(c, 420);
		const k = strain.findIndex((s) => s >= 0.02);
		// the elastic slope is the shear modulus the scenes use
		expect(stress[k] / strain[k]).toBeCloseTo(SHEAR_MODULUS, -0.5);
		const peak = Math.max(...stress);
		expect(peak / IDEAL_STRENGTH).toBeGreaterThan(0.95);
		expect(peak / IDEAL_STRENGTH).toBeLessThan(1.05);
		// Frenkel (1926): τ_ideal ≈ G/2π for a sinusoidal resistance to sliding
		const ratio = peak / SHEAR_MODULUS;
		expect(ratio).toBeGreaterThan(1 / (2 * Math.PI) / 1.5);
		expect(ratio).toBeLessThan((1.5 * 1) / (2 * Math.PI));
		// after the peak the stress falls: the crystal slipped all at once
		const after = stress.slice(stress.indexOf(peak));
		expect(Math.min(...after)).toBeLessThan(peak / 2);
	});

	test('one dislocation glides at a few hundredths of the perfect crystal’s strength', () => {
		const c = new Crystal(specFor('one'));
		const start = cores(c, c.frame(0));
		expect(start).toHaveLength(1);
		expect(start[0] / c.width).toBeCloseTo(0.25, 1);
		const { stress, strain } = run(c, 1000);
		const glide = mean(stress.slice(60));
		expect(glide / GLIDE_STRESS).toBeGreaterThan(0.8);
		expect(glide / GLIDE_STRESS).toBeLessThan(1.2);
		expect(Math.max(...stress.slice(60))).toBeLessThan(IDEAL_STRENGTH / 100);
		// it went once across the box: the crystal sheared by more than one atom spacing over
		// its height (strain b/H) while the stress stayed low
		expect(strain[1000]).toBeGreaterThan(A0 / c.gauge);
		const end = cores(c, c.frame(1000));
		expect(end).toHaveLength(1);
	});

	test('bonds across the slip plane are stretched only at the core', () => {
		const c = new Crystal(specFor('one'));
		const f = c.frame(0);
		const core = cores(c, f)[0];
		const bonds = slipBonds(c, f);
		const stretched = bonds.filter((b) => b.length > 1.15);
		expect(stretched.length).toBeGreaterThan(0);
		for (const b of stretched) {
			let dx = f.x[b.i] - core;
			dx -= c.width * Math.round(dx / c.width);
			expect(Math.abs(dx)).toBeLessThan(4 * A0);
		}
		// far from the core every upper atom sits between two lower ones, bonded to both
		const far = bonds.filter((b) => {
			let dx = f.x[b.i] - core;
			dx -= c.width * Math.round(dx / c.width);
			return Math.abs(dx) > 8 * A0;
		});
		for (const b of far) expect(b.length).toBeLessThan(1.06);
	});

	test('larger and smaller foreign atoms both pin the dislocation', () => {
		for (const size of [1.12, 0.88]) {
			const c = new Crystal(specFor('solutes', { size, fraction: 0.05 }));
			const { stress } = run(c, 700);
			expect(mean(stress.slice(60))).toBeGreaterThan(4 * GLIDE_STRESS);
			expect(Math.max(...stress)).toBeGreaterThan(10 * GLIDE_STRESS);
			expect(Math.max(...stress)).toBeLessThan(IDEAL_STRENGTH / 4);
		}
	});

	test('dislocations stop at the hard particle and the stress climbs', () => {
		const c = new Crystal(specFor('pileup', { count: 1 }));
		const xo = OBSTACLE_AT * c.width;
		const { stress } = run(c, 560);
		const at = cores(c, c.frame(560));
		expect(at).toHaveLength(1);
		// held just before the particle
		expect(xo - at[0]).toBeGreaterThan(0);
		expect(xo - at[0]).toBeLessThan(4 * A0);
		expect(stress[560]).toBeGreaterThan(50 * GLIDE_STRESS);
	});
});
