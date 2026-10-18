/**
 * The page's stimuli: the frequency slider's scale and the sounds of the "several tones" step,
 * as lists of tones for the model.
 */
import { VOWELS, vowelHarmonics, type VowelId } from './implant.ts';
import type { Tone } from './model.ts';

/** The frequency slider counts octaves above 125 Hz (to 16 kHz). */
export function pitchHz(octaves: number): number {
	return 125 * Math.pow(2, octaves);
}

/** The level of the soft tones of the first steps, dB SPL. */
export const SOFT = 20;

export type SoundId = 'tone' | 'pair' | 'close' | 'chord' | 'ah' | 'ee';

/** Equal-tempered C4, E4, G4, Hz. */
const CHORD = [261.63, 329.63, 392.0];

/**
 * The tones of a sound at `level` dB SPL: for a vowel, its strongest harmonic is at `level` and
 * the others at their relative levels (those more than 50 dB down are left out).
 */
export function tonesOf(id: SoundId, f: number, level: number): Tone[] {
	switch (id) {
		case 'tone':
			return [{ f, level }];
		case 'pair':
			return [500, 3000].map((f) => ({ f, level }));
		case 'close':
			return [1000, 1050].map((f) => ({ f, level }));
		case 'chord':
			return CHORD.map((f) => ({ f, level }));
		case 'ah':
		case 'ee':
			return vowelHarmonics(VOWELS[id as VowelId])
				.map((h) => ({ f: h.f, level: level + 20 * Math.log10(h.a) }))
				.filter((t) => t.level > level - 50);
	}
}
