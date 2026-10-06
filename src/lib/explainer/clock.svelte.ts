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
			// Clamp long gaps (background tab, debugger) so the scene never jumps.
			const dt = Math.min(0.1, (now - this.#last) / 1000);
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
