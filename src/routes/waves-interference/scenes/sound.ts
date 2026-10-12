/**
 * The few sounds of the waves explainer, with the Web Audio API.
 *
 * Nothing is created until the reader presses a sound button (the audio
 * context is made on that first press, within the click), nothing plays by
 * itself, and under browser automation (`navigator.webdriver`, as in the
 * Playwright tests) every call is silent. Sounds are scheduled once, from the
 * control values at the moment of the press; they never follow the animation
 * clock.
 */

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

/** Loudest level of any sound, kept well below clipping. */
const LEVEL = 0.22;

/**
 * Plays a note made of partials (frequency in Hz, relative amplitude), with a
 * short attack and an exponential fade; partial n of a string fades faster
 * the higher it is when `pluck` is set (as on a real string).
 */
export function playNote(
	partials: { f: number; a: number }[],
	seconds: number,
	{ pluck = false }: { pluck?: boolean } = {}
) {
	const ac = audio();
	if (!ac) return;
	stopAll();
	const t0 = ac.currentTime + 0.02;
	const total = partials.reduce((s, p) => s + Math.abs(p.a), 0) || 1;
	const master = ac.createGain();
	master.gain.value = LEVEL / Math.max(1, total);
	master.connect(ac.destination);
	const oscs: OscillatorNode[] = [];
	partials.forEach((p, i) => {
		if (p.f <= 0 || p.f > 18000 || p.a === 0) return;
		const osc = ac.createOscillator();
		osc.frequency.value = p.f;
		const g = ac.createGain();
		const a = Math.abs(p.a);
		// a plucked string's upper partials die away sooner
		const fade = pluck ? seconds / (1 + 0.35 * i) : seconds;
		g.gain.setValueAtTime(0, t0);
		g.gain.linearRampToValueAtTime(a, t0 + (pluck ? 0.004 : 0.04));
		if (pluck) g.gain.exponentialRampToValueAtTime(Math.max(1e-4, a * 1e-3), t0 + fade);
		else {
			g.gain.setValueAtTime(a, t0 + seconds - 0.15);
			g.gain.linearRampToValueAtTime(0, t0 + seconds);
		}
		osc.connect(g).connect(master);
		osc.start(t0);
		osc.stop(t0 + seconds + 0.05);
		oscs.push(osc);
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

/**
 * Plays a tone whose frequency and loudness follow the given curves, sampled
 * evenly over `seconds` (the pass-by of a moving source).
 */
export function playSweep(freqs: number[], gains: number[], seconds: number) {
	const ac = audio();
	if (!ac || freqs.length < 2) return;
	stopAll();
	const t0 = ac.currentTime + 0.03;
	const master = ac.createGain();
	master.gain.setValueAtTime(0, t0);
	master.gain.linearRampToValueAtTime(LEVEL, t0 + 0.05);
	master.gain.setValueAtTime(LEVEL, t0 + seconds - 0.08);
	master.gain.linearRampToValueAtTime(0, t0 + seconds);
	master.connect(ac.destination);
	const loud = ac.createGain();
	loud.gain.setValueCurveAtTime(Float32Array.from(gains), t0, seconds);
	loud.connect(master);
	// a horn-like tone: the fundamental and a quieter second harmonic
	const oscs = [1, 2].map((k) => {
		const osc = ac.createOscillator();
		osc.type = 'triangle';
		osc.frequency.setValueCurveAtTime(Float32Array.from(freqs.map((f) => f * k)), t0, seconds);
		const g = ac.createGain();
		g.gain.value = k === 1 ? 1 : 0.3;
		osc.connect(g).connect(loud);
		osc.start(t0);
		osc.stop(t0 + seconds + 0.02);
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
	oscs[0].addEventListener('ended', () => playing.delete(handle));
}
