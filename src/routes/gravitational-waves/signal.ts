/**
 * The GW150914 data, prepared for the page: Hanford shifted and flipped onto
 * Livingston, the two averaged to halve the noise, and the frequency read off
 * the averaged signal from its zero crossings.
 */
import { GW150914, crossingFrequencies } from './gw';
import { RATE, T0, hanford, livingston, nrHanford, nrLivingston } from './gw150914';

export { RATE, T0, hanford, livingston, nrHanford, nrLivingston };

/** Time of sample i, s after 09:50:45 UTC. */
export const timeOf = (i: number) => T0 + i / RATE;

/** Value of a series at time t, interpolated linearly (NaN outside the excerpt). */
export function sampleAt(y: readonly number[], t: number) {
	const x = (t - T0) * RATE;
	const i = Math.floor(x);
	if (i < 0 || i + 1 >= y.length) return NaN;
	return y[i] + (y[i + 1] - y[i]) * (x - i);
}

/**
 * Hanford as it would line up with Livingston: the wave reached Livingston
 * 6.9 ms earlier, and Hanford's arms point the other way round, so its signal is
 * inverted. Hanford at time t + delay, sign flipped, at Livingston's time t.
 */
export const hanfordAligned = livingston.map(
	(_, i) => -sampleAt(hanford, timeOf(i) + GW150914.delay)
);

/** Livingston and the aligned Hanford averaged (where both exist). */
export const combined = livingston.map((l, i) =>
	Number.isNaN(hanfordAligned[i]) ? l : (l + hanfordAligned[i]) / 2
);

/** The stretch of the signal where its cycles stand clear of the noise, s. */
export const FIT_WINDOW: readonly [number, number] = [0.355, 0.42];
/** Above this the band-pass filter (350 Hz) and the merger take over. */
export const FIT_MAX_F = 160;

/** Frequency estimates (one per half cycle) from the averaged signal, in the fit window. */
export const measuredTrack = crossingFrequencies(combined, T0, RATE).filter(
	(p) => p.t > FIT_WINDOW[0] && p.t < FIT_WINDOW[1] && p.f < FIT_MAX_F
);
