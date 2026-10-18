<script lang="ts">
	/**
	 * A close-up of a few cells in a uniform liquid, in real time: each runs, tumbles and runs
	 * again (../model.ts `Swarm`, no attractant), leaving a fading trail with a dot at every
	 * tumble. Cells are drawn three times larger than life. Underneath, one cell's runs and
	 * tumbles as a bar, and the averages measured over 1000 simulated cells.
	 *
	 * The movie lasts PERIOD seconds and starts again (fading out and in). Reduced motion: the
	 * frame at 21 s.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Swarm, SWIM } from '../model';

	let { t, reduced }: StageProps = $props();

	const PERIOD = 40;
	const REC = 0.05;
	const N = 7;
	/** The window, in stage units, and its scale: 3 px per µm. */
	const WX0 = 16;
	const WX1 = 944;
	const WY0 = 50;
	const WY1 = 440;
	const PX = 3;
	const W_UM = (WX1 - WX0) / PX;
	const H_UM = (WY1 - WY0) / PX;

	/** Recorded positions, headings and tumble flags of the drawn cells (computed once). */
	const movie = (() => {
		const s = new Swarm({
			n: N,
			seed: 21,
			field: () => 0,
			box: { w: W_UM - 8, h: H_UM - 8 },
			start: (r) => ({ x: 20 + r() * (W_UM - 48), y: 20 + r() * (H_UM - 48) })
		});
		const frames: { x: Float64Array; y: Float64Array; h: Float64Array; tum: Uint8Array }[] = [];
		const steps = Math.round(PERIOD / REC);
		for (let k = 0; k <= steps; k++) {
			const h = new Float64Array(N);
			const tum = new Uint8Array(N);
			for (let i = 0; i < N; i++) {
				h[i] = Math.atan2(s.ey[i], s.ex[i]);
				tum[i] = s.tumbleLeft[i] > 0 ? 1 : 0;
			}
			frames.push({ x: Float64Array.from(s.x), y: Float64Array.from(s.y), h, tum });
			s.run((k + 1) * REC);
		}
		return frames;
	})();

	/** Averages over many cells (computed once). */
	const stats = (() => {
		const s = new Swarm({ n: 1000, seed: 5, field: () => 0 });
		s.keepAngles = true;
		s.run(5);
		s.tumbles = 0;
		s.run(30);
		let sum = 0;
		for (const a of s.angles) sum += a;
		const perSecond = s.tumbles / s.n / 25;
		return { perSecond, angle: ((sum / s.angles.length) * 180) / Math.PI };
	})();

	const time = $derived(reduced ? 21 : t % PERIOD);
	const fade = $derived(
		reduced ? 1 : smoothstep(0, 0.8, time) * (1 - smoothstep(PERIOD - 0.8, PERIOD, time))
	);
	const k = $derived(Math.min(movie.length - 1, Math.floor(time / REC)));

	const sx = (x: number) => WX0 + 4 * PX + x * PX;
	const sy = (y: number) => WY0 + 4 * PX + y * PX;

	const TRAIL = 8; // seconds
	const cells = $derived.by(() => {
		const f = movie[k];
		const from = Math.max(0, k - Math.round(TRAIL / REC));
		return Array.from({ length: N }, (_, i) => {
			let d = '';
			const dots: { x: number; y: number }[] = [];
			for (let j = from; j <= k; j += 2) {
				const p = movie[j];
				d += `${j === from ? 'M' : 'L'}${sx(p.x[i]).toFixed(1)} ${sy(p.y[i]).toFixed(1)}`;
			}
			d += `L${sx(f.x[i]).toFixed(1)} ${sy(f.y[i]).toFixed(1)}`;
			for (let j = from + 1; j <= k; j++)
				if (movie[j].tum[i] && !movie[j - 1].tum[i])
					dots.push({ x: sx(movie[j].x[i]), y: sy(movie[j].y[i]) });
			const tumbling = f.tum[i] === 1;
			// a tumbling cell jiggles in place
			const wobble = tumbling ? 40 * Math.sin(time * 37 + i) : 0;
			return {
				i,
				d,
				dots,
				x: sx(f.x[i]),
				y: sy(f.y[i]),
				angle: (f.h[i] * 180) / Math.PI + wobble,
				tumbling
			};
		});
	});

	/** Cell 0's runs (filled) and tumbles over the movie so far. */
	const BX0 = 150;
	const BX1 = 930;
	const bx = (s: number) => BX0 + ((BX1 - BX0) * s) / PERIOD;
	const bar = $derived.by(() => {
		const segs: { a: number; b: number }[] = [];
		let start = -1;
		for (let j = 0; j <= k; j++) {
			const run = movie[j].tum[0] === 0;
			if (run && start < 0) start = j * REC;
			if ((!run || j === k) && start >= 0) {
				segs.push({ a: start, b: j * REC });
				start = -1;
			}
		}
		return segs;
	});
	const L = 6 * PX;
	const R = 1.5 * PX;
</script>

<g opacity={fade}>
	<Readout id="title" order={1} label="Close-up" value="real time, cells drawn 3× larger">
		<Label
			x={24}
			y={32}
			text="a few E. coli in a uniform liquid · real time · t = {time.toFixed(1)} s"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<rect
		x={WX0}
		y={WY0}
		width={WX1 - WX0}
		height={WY1 - WY0}
		rx="10"
		fill="var(--bc-liquid)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<!-- 20 µm scale bar -->
	<path
		d="M{WX1 - 20 - 20 * PX} 30 v6 h{20 * PX} v-6"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout id="scalebar">
		<Label x={WX1 - 28 - 20 * PX} y={36} text="20 µm" size={12} muted anchor="end" />
	</Readout>

	{#each cells as c (c.i)}
		<path
			d={c.d}
			fill="none"
			stroke="var(--bc-cell)"
			stroke-width="1.4"
			opacity="0.35"
			stroke-linejoin="round"
		/>
		{#each c.dots as p, j (j)}
			<circle cx={p.x} cy={p.y} r="2.6" fill="var(--bc-tumble)" opacity="0.8" />
		{/each}
		<g transform="translate({c.x} {c.y}) rotate({c.angle})">
			{#if c.tumbling}
				<!-- the bundle has flown apart -->
				{#each [-50, -10, 30] as a (a)}
					<path
						d="M{-L / 2} 0 q-6 -4 -14 0 t-14 0"
						transform="rotate({180 + a} {-L / 2} 0) rotate(180 {-L / 2} 0)"
						fill="none"
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
					/>
				{/each}
			{:else}
				<path
					d="M{-L / 2} 0 q-5 -4 -10 0 t-10 0 t-10 0"
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
				/>
			{/if}
			<rect
				x={-L / 2}
				y={-R}
				width={L}
				height={2 * R}
				rx={R}
				fill={c.tumbling ? 'var(--bc-tumble)' : 'var(--bc-cell)'}
				stroke="var(--stage-bg)"
				stroke-width="1"
			/>
		</g>
	{/each}

	<Readout id="key">
		<Label
			x={24}
			y={WY1 + 24}
			text="trails: the last 8 s · orange dots: tumbles · a cell turns orange while it tumbles"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- one cell's runs and tumbles -->
	<Readout id="bar-label">
		<Label x={24} y={WY1 + 64} text="one cell" size={12} anchor="start" weight={600} />
		<Label x={24} y={WY1 + 80} text="runs filled" size={11} anchor="start" muted />
	</Readout>
	<rect
		x={BX0}
		y={WY1 + 56}
		width={BX1 - BX0}
		height="16"
		rx="3"
		fill="none"
		stroke="var(--stage-line)"
	/>
	{#each bar as s (s.a)}
		<rect
			x={bx(s.a)}
			y={WY1 + 56}
			width={Math.max(0.5, bx(s.b) - bx(s.a))}
			height="16"
			fill="var(--bc-cell)"
		/>
	{/each}

	<Readout
		id="stats"
		order={2}
		label="Measured over 1000 cells"
		value="{stats.perSecond.toFixed(2)} tumbles/s, turns of {Math.round(stats.angle)}°"
	>
		<Label
			x={24}
			y={WY1 + 122}
			text="over 1000 simulated cells: {stats.perSecond.toFixed(
				2
			)} tumbles per second (runs {SWIM.run} s, tumbles {SWIM.tumble} s on average), turns of {Math.round(
				stats.angle
			)}° on average"
			size={12}
			anchor="start"
			tabular
		/>
	</Readout>
</g>
