/**
 * A pausable animation clock driven by requestAnimationFrame. `t` is the
 * number of seconds elapsed (scaled by `speed`) since the last `reset()`.
 */
export class Clock {
	t = $state(0);
	playing = $state(true);
	speed = $state(1);

	#frame = 0;
	#last = 0;

	start() {
		if (this.#frame) return;
		this.#last = performance.now();
		const tick = (now: number) => {
			// Clamp long gaps (background tab, debugger) so the scene never jumps, and
			// negative ones: the first frame's timestamp is the frame's start, which
			// can precede the performance.now() taken in start(), and t must never
			// go below 0.
			const dt = Math.max(0, Math.min(0.1, (now - this.#last) / 1000));
			this.#last = now;
			if (this.playing) this.t += dt * this.speed;
			this.#frame = requestAnimationFrame(tick);
		};
		this.#frame = requestAnimationFrame(tick);
	}

	stop() {
		cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	reset() {
		this.t = 0;
	}
}
