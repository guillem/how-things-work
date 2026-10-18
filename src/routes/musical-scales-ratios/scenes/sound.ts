/**
 * The sounds of the twelve-notes explainer, with the Web Audio API.
 *
 * Nothing is created until the reader presses a key or a play button (the
 * audio context is made on that first press, within the click), nothing plays
 * by itself, and under browser automation (`navigator.webdriver`, as in the
 * Playwright tests) every call is silent. Each sound is scheduled once, from
 * the values at the moment of the press.
 */
import { partials, type Timbre } from '../scales';

let ctx: AudioContext | null = null;
const playing = new Set<{ stop: () => void }>();

function audio(): AudioContext | null {
	if (typeof window === 'undefined' || navigator.webdriver) return null;
	if (!ctx) {
		if (typeof window.AudioContext !== 'function') return null;
		ctx = new window.AudioContext();
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** Stops every sound that is still playing (on a step change or when the scene goes). */
export function stopAll() {
	for (const p of playing) p.stop();
	playing.clear();
}

/** Loudest level of the whole sound, kept well below clipping. */
const LEVEL = 0.2;

/**
 * Plays notes together, each with the partials of the chosen timbre, held
 * steady for `seconds` with a short fade in and out (so that beats between
 * them are easy to hear).
 */
export function playNotes(freqs: number[], timbre: Timbre, seconds = 2.2) {
	const ac = audio();
	if (!ac) return;
	stopAll();
	const t0 = ac.currentTime + 0.02;
	const parts = freqs.flatMap((f) => partials(f, timbre)).filter((p) => p.f > 0 && p.f < 18000);
	const total = parts.reduce((s, p) => s + p.a, 0) || 1;
	const master = ac.createGain();
	master.gain.setValueAtTime(0, t0);
	master.gain.linearRampToValueAtTime(LEVEL / Math.sqrt(total), t0 + 0.06);
	master.gain.setValueAtTime(LEVEL / Math.sqrt(total), t0 + seconds - 0.3);
	master.gain.linearRampToValueAtTime(0, t0 + seconds);
	master.connect(ac.destination);
	const oscs = parts.map((p) => {
		const osc = ac.createOscillator();
		osc.frequency.value = p.f;
		const g = ac.createGain();
		g.gain.value = p.a / Math.sqrt(total);
		osc.connect(g).connect(master);
		osc.start(t0);
		osc.stop(t0 + seconds + 0.05);
		return osc;
	});
	const handle = {
		stop: () => {
			const now = ac.currentTime;
			master.gain.cancelScheduledValues(now);
			master.gain.setTargetAtTime(0, now, 0.02);
			for (const o of oscs) o.stop(now + 0.1);
		}
	};
	playing.add(handle);
	oscs[0]?.addEventListener('ended', () => playing.delete(handle));
}
