/**
 * Plays the page's own synthesized samples with the Web Audio API.
 *
 * Nothing is created until the reader presses a play button (the audio context is made within
 * that click), nothing plays by itself, the microphone is never used, and under browser
 * automation (`navigator.webdriver`, as in the Playwright tests) every call is silent.
 */
import { SAMPLE_RATE } from '../model';

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

/** Stops whatever is playing. */
export function stopSound() {
	try {
		current?.stop();
	} catch {
		// already stopped
	}
	current = null;
}

/** Plays samples at 8 kHz, scaled so the loudest is at a comfortable level. */
export function playSamples(x: Float32Array) {
	const ac = audio();
	if (!ac) return;
	stopSound();
	let peak = 0;
	for (const v of x) peak = Math.max(peak, Math.abs(v));
	const buf = ac.createBuffer(1, x.length, SAMPLE_RATE);
	const data = buf.getChannelData(0);
	const gain = peak > 0 ? 0.5 / peak : 0;
	for (let i = 0; i < x.length; i++) data[i] = x[i] * gain;
	// a short fade at both ends so the sound doesn't click
	const fade = Math.min(200, x.length >> 1);
	for (let i = 0; i < fade; i++) {
		data[i] *= i / fade;
		data[x.length - 1 - i] *= i / fade;
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
