// Checks the transistor and chipmaking model against the textbook laws and the numbers the
// page quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	COX,
	K1_CUTOFF,
	M1,
	NMOS,
	PMOS,
	SUBTHRESHOLD_SWING,
	TOOLS,
	VDD,
	aerialImage,
	channelDensity,
	diesPerWafer,
	drainCurrent,
	halfPitch,
	inverterCurrent,
	inverterOut,
	k1,
	mooreFit,
	nand,
	switchingPoint,
	toolById
} from '../src/routes/transistors-chipmaking/model';
import { COUNTS } from '../src/routes/transistors-chipmaking/counts';

test('well above threshold the drain current follows the square law', () => {
	// Saturation: ½ k′ (W/L) (V_GS − V_t)², Sedra & Smith's 0.18 µm nMOS at W/L = 2.
	const sat = (vgs: number) => 0.5 * 387e-6 * 2 * (vgs - 0.5) ** 2;
	expect(drainCurrent(NMOS, 1.8, 1.8)).toBeCloseTo(sat(1.8), 6);
	expect(drainCurrent(NMOS, 1.8, 1.8) / 1e-6).toBeCloseTo(654, 0);
	// Doubling the overdrive quadruples the current.
	const r = drainCurrent(NMOS, 1.7, 1.8) / drainCurrent(NMOS, 1.1, 1.8);
	expect(r).toBeCloseTo(4, 1);
	// Triode: small v_DS acts like a resistor, k′(W/L)(V_GS − V_t)v_DS.
	expect(drainCurrent(NMOS, 1.8, 0.01)).toBeCloseTo(387e-6 * 2 * 1.3 * 0.01, 7);
	// Beyond pinch-off (v_DS > V_GS − V_t) the current no longer grows.
	const ratio = drainCurrent(NMOS, 1.2, 1.8) / drainCurrent(NMOS, 1.2, 0.8);
	expect(Math.abs(ratio - 1)).toBeLessThan(0.002);
});

test('below threshold the transistor is off: picoamps, ten times less per ~90 mV', () => {
	const off = drainCurrent(NMOS, 0, VDD);
	expect(off).toBeLessThan(1e-11);
	expect(off).toBeGreaterThan(1e-12);
	expect(drainCurrent(NMOS, VDD, VDD) / off).toBeGreaterThan(1e8);
	expect(SUBTHRESHOLD_SWING * 1000).toBeCloseTo(89, 0);
	const tenfold = drainCurrent(NMOS, 0.1, VDD) / drainCurrent(NMOS, 0.1 - SUBTHRESHOLD_SWING, VDD);
	expect(tenfold).toBeCloseTo(10, 1);
	// No drain voltage, no current.
	expect(drainCurrent(NMOS, VDD, 0)).toBe(0);
});

test('the channel holds C_ox (V_GS − V_t) of charge: ~54 000 electrons per µm² per volt', () => {
	const perVolt = COX / 1.602176634e-19;
	expect(perVolt).toBeGreaterThan(53000);
	expect(perVolt).toBeLessThan(54000);
	// Strong inversion: each extra volt adds C_ox × 1 V (the absolute level sits n·kT/q ≈ 39 mV low).
	const added = channelDensity(NMOS, 1.5) - channelDensity(NMOS, 1.0);
	expect(Math.abs(added - perVolt / 2) / (perVolt / 2)).toBeLessThan(0.01);
	expect(channelDensity(NMOS, 0)).toBeLessThan(20);
});

test('below threshold the channel charge falls tenfold per subthreshold swing, like the current', () => {
	const ratio = channelDensity(NMOS, 0.3) / channelDensity(NMOS, 0.3 - SUBTHRESHOLD_SWING);
	expect(ratio).toBeGreaterThan(9);
	expect(ratio).toBeLessThan(11);
	// So at 0.3 V, 0.2 V under threshold, only some tens of electrons per µm².
	expect(channelDensity(NMOS, 0.3)).toBeLessThan(100);
});

test('a matched CMOS inverter flips at V_DD/2 and draws current only while switching', () => {
	expect(switchingPoint()).toBeCloseTo(VDD / 2, 3);
	expect(inverterOut(0)).toBeCloseTo(VDD, 3);
	expect(inverterOut(VDD)).toBeCloseTo(0, 3);
	let prev = Infinity;
	for (let v = 0; v <= VDD; v += 0.05) {
		const out = inverterOut(v);
		expect(out).toBeLessThanOrEqual(prev + 1e-9);
		prev = out;
	}
	// Steady states draw picoamps; mid-switch tens of microamps.
	expect(inverterCurrent(0)).toBeLessThan(1e-11);
	expect(inverterCurrent(VDD)).toBeLessThan(1e-11);
	expect(inverterCurrent(0.9)).toBeGreaterThan(1e-5);
	// The pMOS is wider so both have the same strength.
	expect(drainCurrent(PMOS, 1.8, 1.8)).toBeCloseTo(drainCurrent(NMOS, 1.8, 1.8), 9);
});

test('the NAND gate is low only when both inputs are high, and never shorts the supply', () => {
	expect(nand(false, false).out).toBe(true);
	expect(nand(true, false).out).toBe(true);
	expect(nand(false, true).out).toBe(true);
	expect(nand(true, true).out).toBe(false);
	for (const a of [false, true])
		for (const b of [false, true]) {
			const g = nand(a, b);
			expect(g.out).toBe(!g.pullDown);
		}
});

test('Rayleigh: the scanners’ quoted resolutions correspond to k₁ between 0.25 and 0.36', () => {
	expect(k1(110, toolById('krf'))).toBeCloseTo(0.355, 3);
	expect(k1(38, toolById('arfi'))).toBeCloseTo(0.266, 3);
	expect(k1(13, toolById('euv'))).toBeCloseTo(0.318, 3);
	expect(k1(8, toolById('hna'))).toBeCloseTo(0.326, 3);
	for (const t of TOOLS) expect(k1(t.spec, t)).toBeGreaterThan(0.25);
	expect(halfPitch(0.25, toolById('arfi'))).toBeCloseTo(35.7, 1);
});

test('the image of a grating vanishes below k₁ ≈ 0.26 and is sharp above 0.3, for every tool', () => {
	expect(K1_CUTOFF).toBeCloseTo(0.256, 3);
	for (const t of TOOLS) {
		expect(aerialImage(halfPitch(0.25, t), t).contrast).toBeLessThan(1e-9);
		expect(aerialImage(halfPitch(0.32, t), t).contrast).toBeGreaterThan(0.85);
		const mid = aerialImage(halfPitch(0.27, t), t).contrast;
		expect(mid).toBeGreaterThan(0.1);
		expect(mid).toBeLessThan(0.6);
	}
	// At the scanner's quoted resolution, light falls under the glass and not under the chrome.
	const img = aerialImage(38, toolById('arfi'), 64);
	expect(img.I[0]).toBeCloseTo(img.max, 6);
	expect(img.I[32]).toBeCloseTo(img.min, 6);
});

test('a 300 mm wafer holds about 530 M1-sized dies: some 8 trillion transistors', () => {
	const dies = diesPerWafer(M1.area);
	expect(dies).toBeGreaterThan(520);
	expect(dies).toBeLessThan(540);
	expect(dies * M1.transistors).toBeGreaterThan(8e12);
});

test('transistor counts: from 2,300 in 1971 to tens of billions, doubling every ~2 years', () => {
	const first = COUNTS[0];
	expect(Math.round(first[0])).toBe(1972); // the Intel 4004, November 1971
	expect(first[1]).toBeCloseTo(2300, -2);
	const max = Math.max(...COUNTS.map(([, n]) => n));
	expect(max).toBeGreaterThan(5e10);
	expect(COUNTS.some(([y, n]) => Math.abs(y - 2020.9) < 0.01 && n === 1.6e10)).toBe(true);
	const fit = mooreFit(COUNTS);
	expect(fit.doubling).toBeGreaterThan(1.9);
	expect(fit.doubling).toBeLessThan(2.1);
});
