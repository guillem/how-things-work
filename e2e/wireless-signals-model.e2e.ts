// Checks the radio model behind the wireless-signals explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	Q,
	SCHEMES,
	berTheory,
	capacity,
	channelMHz,
	constellation,
	decide,
	dbToLin,
	fsplDb,
	link,
	linToDb,
	measureBer,
	minEbN0,
	noiseDbm,
	overlap,
	snrForBer,
	spectrum,
	wifiRate
} from '../src/routes/wireless-signals/radio';

test('Q function: textbook values', () => {
	expect(Q(0)).toBeCloseTo(0.5, 7);
	expect(Q(1)).toBeCloseTo(0.158655, 5);
	expect(Q(3) / 1.349898e-3).toBeCloseTo(1, 4);
	expect(Q(5) / 2.866516e-7).toBeCloseTo(1, 4);
});

test('constellations: Gray-coded, average energy 1, neighbours differ by one bit', () => {
	for (const s of SCHEMES) {
		const pts = constellation(s);
		const energy = pts.reduce((a, p) => a + p.i * p.i + p.q * p.q, 0) / pts.length;
		expect(energy).toBeCloseTo(1, 10);
		expect(new Set(pts.map((p) => p.bits)).size).toBe(pts.length);
		const dmin = Math.min(
			...pts.flatMap((a, i) => pts.slice(i + 1).map((b) => Math.hypot(a.i - b.i, a.q - b.q)))
		);
		for (const a of pts)
			for (const b of pts) {
				if (Math.abs(Math.hypot(a.i - b.i, a.q - b.q) - dmin) > 1e-9) continue;
				const diff = [...a.bits].filter((c, k) => c !== b.bits[k]).length;
				expect(diff).toBe(1);
			}
	}
	// the receiver reads each ideal point back as its own bits
	for (const s of SCHEMES)
		for (const p of constellation(s)) expect(decide(s, p.i, p.q)).toBe(p.bits);
	expect(constellation('qam16')).toHaveLength(16);
	expect(constellation('qam256')).toHaveLength(256);
});

test('measured bit-error rates match the theory (BPSK: Q(√(2Eb/N₀)))', () => {
	// Points where at least ~100 errors are expected, so the check is tight.
	const cases: [(typeof SCHEMES)[number], number][] = [
		['bpsk', 0],
		['bpsk', 4],
		['bpsk', 6],
		['qpsk', 6],
		['qam16', 12],
		['qam16', 15],
		['qam64', 18],
		['qam64', 22],
		['qam256', 25],
		['qam256', 28]
	];
	for (const [s, db] of cases) {
		const th = berTheory(s, db);
		const m = measureBer(s, db, 400_000, 11);
		const sigma = Math.sqrt(th / m.bits);
		expect(Math.abs(m.ber - th), `${s} at ${db} dB`).toBeLessThan(5 * sigma + 0.02 * th);
	}
	expect(berTheory('bpsk', 0)).toBeCloseTo(Q(Math.SQRT2), 10);
});

test('a neighbour’s overlapping signal acts as extra noise: BER follows the SINR', () => {
	for (const [snrDb, power] of [
		[20, 0.125],
		[15, 0.1],
		[25, 0.25]
	]) {
		const sinr = 1 / (1 / dbToLin(snrDb) + power);
		const th = berTheory('qpsk', linToDb(sinr));
		const m = measureBer('qpsk', snrDb, 400_000, 5, { power });
		expect(Math.abs(m.ber - th)).toBeLessThan(5 * Math.sqrt(th / m.bits) + 0.02 * th);
	}
});

test('QPSK has the BER of BPSK at the same energy per bit', () => {
	for (const ebn0 of [0, 4, 8]) {
		// QPSK carries 2 bits per symbol: Es/N₀ = Eb/N₀ + 3.01 dB
		expect(berTheory('qpsk', ebn0 + linToDb(2))).toBeCloseTo(berTheory('bpsk', ebn0), 12);
	}
});

test('the SNRs the narrative quotes for a BER of 1 in 1000 and 1 in a million', () => {
	expect(snrForBer('bpsk', 1e-3)).toBeCloseTo(6.8, 1);
	expect(snrForBer('bpsk', 1e-6)).toBeCloseTo(10.5, 1);
	expect(snrForBer('qpsk', 1e-3)).toBeCloseTo(9.8, 1);
	expect(snrForBer('qam16', 1e-3)).toBeCloseTo(16.5, 1);
	expect(snrForBer('qam64', 1e-3)).toBeCloseTo(22.5, 1);
	expect(snrForBer('qam256', 1e-3)).toBeCloseTo(28.4, 1);
	// each step up costs about 6 dB once the points are packed in a square grid
	expect(snrForBer('qam256', 1e-6) - snrForBer('qam64', 1e-6)).toBeCloseTo(6, 0);
});

test('spectra: AM takes twice the tone, FM follows Carson’s rule', () => {
	expect(spectrum('carrier', 1, false).occupied).toBeLessThan(0.1);
	expect(spectrum('am', 1, false).occupied).toBeCloseTo(1, 1); // 2 × 0.5 MHz tone
	expect(spectrum('fm', 1, false).occupied).toBeGreaterThan(3.8); // Carson: 2(1.5 + 0.5) = 4 MHz
	expect(spectrum('fm', 1, false).occupied).toBeLessThan(4.3);
});

test('spectra: faster symbols need more bandwidth; smooth switches need far less', () => {
	const abrupt = spectrum('psk', 1, false).occupied;
	const smooth = spectrum('psk', 1, true).occupied;
	expect(abrupt).toBeGreaterThan(15); // 99% bandwidth of rectangular pulses: ~18 MHz
	expect(smooth).toBeCloseTo(1.1, 1);
	// smooth raised-cosine pulses (roll-off 0.5) never exceed 1.5 × the symbol rate
	for (const r of [0.5, 1, 2]) {
		const b = spectrum('psk', r, true).occupied;
		expect(b / r).toBeGreaterThan(1);
		expect(b / r).toBeLessThan(1.5);
	}
	expect(spectrum('qpsk', 2, true).occupied).toBeCloseTo(2 * spectrum('qpsk', 1, true).occupied, 0);
});

test('free-space path loss (Friis) and thermal noise', () => {
	expect(fsplDb(1, 2.437e9)).toBeCloseTo(40.2, 1);
	expect(fsplDb(2, 2.437e9) - fsplDb(1, 2.437e9)).toBeCloseTo(6.02, 2);
	expect(fsplDb(1000, 2.437e9) - fsplDb(100, 2.437e9)).toBeCloseTo(20, 6);
	// 5 GHz loses 6.5 dB more than 2.4 GHz at any distance (smaller isotropic antenna)
	expect(fsplDb(50, 5.18e9) - fsplDb(50, 2.437e9)).toBeCloseTo(6.5, 1);
	expect(noiseDbm(1)).toBeCloseTo(-174, 0);
	expect(noiseDbm(20e6)).toBeCloseTo(-101, 0);
	expect(link(100, 2.437e9, 20e6).snrDb).toBeCloseTo(40.8, 1);
	expect(link(1000, 2.437e9, 20e6).snrDb).toBeCloseTo(20.8, 1);
	// doubling the channel width doubles the noise: 3 dB less SNR
	expect(link(30, 2.437e9, 20e6).snrDb - link(30, 2.437e9, 40e6).snrDb).toBeCloseTo(3.01, 2);
});

test('Shannon capacity and its floor of −1.59 dB', () => {
	expect(capacity(20e6, dbToLin(25)) / 1e6).toBeCloseTo(166, 0);
	expect(capacity(1, 1)).toBe(1);
	expect(linToDb(minEbN0(1e-9))).toBeCloseTo(-1.59, 2);
	expect(linToDb(Math.log(2))).toBeCloseTo(-1.59, 2);
	// no uncoded scheme reaches the limit: each one needs more SNR than Shannon for its rate
	for (const s of SCHEMES) {
		const bits = { bpsk: 1, qpsk: 2, qam16: 4, qam64: 6, qam256: 8 }[s];
		expect(snrForBer(s, 1e-6)).toBeGreaterThan(linToDb(2 ** bits - 1) + 5);
	}
});

test('2.4 GHz Wi-Fi channels: 5 MHz apart, 20 MHz wide, 1/6/11 clear of each other', () => {
	expect(channelMHz(1)).toBe(2412);
	expect(channelMHz(6)).toBe(2437);
	expect(channelMHz(11)).toBe(2462);
	expect(channelMHz(13)).toBe(2472);
	expect(channelMHz(14)).toBe(2484);
	expect(overlap(1, 6)).toBe(0);
	expect(overlap(6, 11)).toBe(0);
	expect(overlap(6, 6)).toBe(1);
	expect(overlap(6, 7)).toBe(0.75);
	expect(overlap(6, 8)).toBe(0.5);
	expect(overlap(6, 9)).toBe(0.25);
});

test('Wi-Fi data rates from the OFDM parameters match the 802.11n/ac tables', () => {
	// one spatial stream; Mbit/s with the 800 ns and the 400 ns guard interval
	expect(wifiRate(20, 6, 5 / 6)).toBeCloseTo(65, 6); // MCS 7
	expect(wifiRate(20, 6, 5 / 6, true)).toBeCloseTo(72.2, 1);
	expect(wifiRate(20, 8, 3 / 4)).toBeCloseTo(78, 6); // VHT MCS 8
	expect(wifiRate(40, 8, 5 / 6)).toBeCloseTo(180, 6); // VHT MCS 9
	expect(wifiRate(80, 8, 5 / 6)).toBeCloseTo(390, 6);
	expect(wifiRate(80, 8, 5 / 6, true)).toBeCloseTo(433.3, 1);
	expect(wifiRate(160, 8, 5 / 6, true)).toBeCloseTo(866.7, 1);
});

test('the numbers the narrative quotes', () => {
	// QPSK: 1 in 18 at 4 dB, 1 in 1,300 at 10 dB, under 1 in a million at 14 dB
	expect(1 / berTheory('qpsk', 4)).toBeCloseTo(18, -0.5);
	expect(1 / berTheory('qpsk', 10)).toBeCloseTo(1300, -2);
	expect(berTheory('qpsk', 14)).toBeLessThan(1e-6);
	// at 20 dB: QPSK error-free, 16-QAM ~3 per million, 64-QAM nearly 1 in 100
	expect(berTheory('qpsk', 20)).toBeLessThan(1e-12);
	expect(berTheory('qam16', 20) * 1e6).toBeCloseTo(3, 0);
	expect(berTheory('qam64', 20)).toBeCloseTo(0.0085, 3);
	// a wider channel at 1 km, 5 GHz: 96 → 337 Mbit/s, never above ~760 Mbit/s
	const c = (w: number) => capacity(w * 1e6, dbToLin(link(1000, 5.18e9, w * 1e6).snrDb)) / 1e6;
	expect(c(20)).toBeCloseTo(96, 0);
	expect(c(160)).toBeCloseTo(337, 0);
	expect(c(1e6)).toBeCloseTo(764, -1);
	// Shannon: 6 bit/s/Hz from 18 dB; uncoded 64-QAM needs 26.6 dB for 10⁻⁶
	expect(linToDb(2 ** 6 - 1)).toBeCloseTo(18, 1);
	expect(snrForBer('qam64', 1e-6)).toBeCloseTo(26.6, 1);
	// Wi-Fi 5's 390 Mbit/s in 80 MHz: 4.9 bit/s/Hz, allowed by Shannon from 14.5 dB
	expect(wifiRate(80, 8, 5 / 6) / 80).toBeCloseTo(4.9, 1);
	expect(linToDb(2 ** (wifiRate(80, 8, 5 / 6) / 80) - 1)).toBeCloseTo(14.5, 1);
});
