// Evaluates the regression curves of NIST IR 6055 (W. C. Stone, "Electromagnetic Signal
// Attenuation in Construction Materials", NIST, 1997; a work of the US government, public
// domain) at the Wi-Fi bands, for the wall losses in src/routes/wifi-and-walls/model.ts.
//
// The report fits the mean received signal (dB relative to free space) of each specimen with a
// polynomial in the frequency F (GHz): M0 + M1 F + M2 F² + … Its low band runs 0.5–2.0 GHz
// (tables "b"), its high band 3.0–8.0 GHz (tables "d"); 2.4 GHz falls in the gap, so the page
// takes the mean of the 2.0 GHz and 3.0 GHz ends. Coefficients are copied from the tables named
// beside each curve (mean curves only, not the ±σ ones).
//
// Run: node scripts/data/wifi-and-walls/nist-ir-6055.mjs

/** @type {Record<string, { table: string; low: number[]; high: number[] }>} */
const curves = {
	'brick, 89 mm (B1)': {
		table: '4.1b, 4.1d',
		low: [27.078, -131.86, 253.34, -266.89, 156.92, -48.302, 6.0616],
		high: [-15.651, 0.3304, -0.0033608, -0.02876, 0.0065649, -0.0006953, 2.99e-5]
	},
	'drywall, 13 mm (D50)': {
		table: '4.13b, 4.13d',
		low: [0.11164, -0.37506, -0.36647, 0.63649, -0.48783, 0.18759, -0.028084],
		high: [-1.3024, 0.56703, 0.047116, -0.046679, 0.0082634, -7.1352e-4, 2.5864e-5]
	},
	'glass, 6 mm (G25)': {
		table: '4.14b, 4.14d',
		low: [1.1444, -4.1804, 4.6468, -3.8722, 1.8625, -0.41623, 0.026245],
		high: [-14.824, 12.201, -5.164, 1.2814, -0.18346, 0.013703, -4.0969e-4]
	},
	'concrete, 102 mm (C14)': {
		table: '4.4b, 4.4d',
		low: [-7.9286, 0.53499, -12.311, 9.3891, -0.84422, -1.4187, 0.39117],
		high: [
			33.11, -88.319, 53.943, -16.053, 2.0035, 0.1396, -0.084168, 0.012014, -7.9082e-4, 2.0626e-5
		]
	}
};

const poly = (/** @type {number[]} */ c, /** @type {number} */ f) =>
	c.reduce((sum, m, i) => sum + m * f ** i, 0);

for (const [name, { table, low, high }] of Object.entries(curves)) {
	const at2 = poly(low, 2.0);
	const at3 = poly(high, 3.0);
	const at5 = poly(high, 5.2);
	console.log(
		`${name.padEnd(24)} tables ${table.padEnd(12)} 2.0 GHz ${at2.toFixed(1).padStart(6)} dB` +
			`  3.0 GHz ${at3.toFixed(1).padStart(6)} dB  → 2.4 GHz ${((at2 + at3) / 2).toFixed(1).padStart(6)} dB` +
			`  5.2 GHz ${at5.toFixed(1).padStart(6)} dB`
	);
}
