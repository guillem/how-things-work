/**
 * Sounds of the gravitational-waves explainer, with the Web Audio API.
 *
 * Nothing is created until the reader presses a sound button (the audio context
 * is made within that click), nothing plays by itself, and under browser
 * automation (`navigator.webdriver`, as in the Playwright tests) every call is
 * silent. Each press plays a buffer computed from the model or the data at that
 * moment; it never follows the animation clock.
 */

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;

function audio(): AudioContext | null {
	if (typeof window === 'undefined' || navigator.webdriver) return null;
	if (!ctx) {
		if (typeof window.AudioContext !== 'function') return null;
		ctx = new window.AudioContext();
	}
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** Stops the sound that is playing, if any (on a step change or when the scene goes). */
export function stopAll() {
	try {
		current?.stop();
	} catch {
		// already stopped
	}
	current = null;
}

/** Loudest level, kept well below clipping. */
const LEVEL = 0.3;

/**
 * Plays samples (any scale: they are normalised to their peak) at `rate`
 * samples a second, with 20 ms fades at both ends, `repeat` times in a row.
 */
export function playSamples(samples: ArrayLike<number>, rate: number, repeat = 1) {
	const ac = audio();
	if (!ac || samples.length < 2) return;
	stopAll();
	let peak = 0;
	for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
	const fade = Math.min(samples.length / 4, Math.round(0.02 * rate));
	const gap = Math.round(0.35 * rate);
	const n = samples.length;
	const buf = ac.createBuffer(1, repeat * n + (repeat - 1) * gap, rate);
	const out = buf.getChannelData(0);
	for (let r = 0; r < repeat; r++) {
		const o = r * (n + gap);
		for (let i = 0; i < n; i++) {
			const w = Math.min(1, i / fade, (n - 1 - i) / fade);
			out[o + i] = (LEVEL * w * samples[i]) / (peak || 1);
		}
	}
	const src = ac.createBufferSource();
	src.buffer = buf;
	src.connect(ac.destination);
	src.start();
	current = src;
	src.addEventListener('ended', () => {
		if (current === src) current = null;
	});
}
