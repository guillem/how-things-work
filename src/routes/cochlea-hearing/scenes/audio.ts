/**
 * The cochlea page's sounds, played with the Web Audio API.
 *
 * Nothing is created until the reader presses a play button (the audio context is made on that
 * first press, within the click); nothing plays by itself; under browser automation
 * (`navigator.webdriver`, as in the Playwright tests) every call is silent. Every sound is quiet
 * (an RMS of 0.05 of full scale at most), lasts about a second and fades in and out. The model's
 * level in dB SPL is not reproduced: a speaker's real level is unknown, and 100 dB SPL would be
 * harmful.
 */
import { LEVEL_RMS, RATE } from '../implant.ts';

/** Sample rate of the tones (high enough for the slider's 16 kHz). */
const TONE_RATE = 44100;

let ctx: AudioContext | null = null;
let current: { stop: () => void } | null = null;

function audio(): AudioContext | null {
	if (typeof window === 'undefined' || navigator.webdriver) return null;
	if (!ctx) {
		if (typeof window.AudioContext !== 'function') return null;
		ctx = new window.AudioContext();
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** Stops whatever is playing (on a step change or when the scene goes). */
export function stopAll() {
	current?.stop();
	current = null;
}

/** Plays a sound computed at `rate` samples a second (the page's rate by default). */
export function playSamples(samples: Float32Array, rate = RATE) {
	const ac = audio();
	if (!ac) return;
	stopAll();
	const buffer = ac.createBuffer(1, samples.length, rate);
	buffer.copyToChannel(Float32Array.from(samples), 0);
	const src = ac.createBufferSource();
	src.buffer = buffer;
	const gain = ac.createGain();
	gain.gain.value = 1;
	src.connect(gain).connect(ac.destination);
	src.start();
	const handle = {
		stop: () => {
			gain.gain.setTargetAtTime(0, ac.currentTime, 0.02);
			src.stop(ac.currentTime + 0.1);
		}
	};
	current = handle;
	src.addEventListener('ended', () => {
		if (current === handle) current = null;
	});
}

/**
 * Plays tones together for `seconds`, with their relative levels (dB) kept and the whole at the
 * page's quiet RMS.
 */
export function playTones(tones: readonly { f: number; level: number }[], seconds = 1.2) {
	const rate = TONE_RATE;
	if (!audio()) return;
	const n = Math.round(seconds * rate);
	const top = Math.max(...tones.map((t) => t.level));
	const parts = tones
		.filter((t) => t.f < rate / 2 - 2000)
		.map((t, k) => ({ f: t.f, a: Math.pow(10, (t.level - top) / 20), p: (k * k * 0.37) % 6.28 }));
	const x = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		for (const q of parts) s += q.a * Math.sin((2 * Math.PI * q.f * i) / rate + q.p);
		x[i] = s;
	}
	let r = 0;
	for (const v of x) r += v * v;
	r = Math.sqrt(r / n) || 1;
	const ramp = Math.round(0.05 * rate);
	for (let i = 0; i < n; i++) {
		const g = Math.min(1, i / ramp, (n - 1 - i) / ramp);
		x[i] *= (g * LEVEL_RMS) / r;
	}
	playSamples(x, rate);
}
