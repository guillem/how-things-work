<script lang="ts">
	/**
	 * A slice along the equator across the Pacific, from Indonesia (left) to
	 * South America (right): the air above with the Walker circulation (rising
	 * over the warmest water, under the rain clouds, sinking in the east, back
	 * west along the surface as the trade winds), the sea surface (tilted, the
	 * tilt exaggerated), the warm layer coloured by sea surface temperature and
	 * the thermocline below it, a straight line from its western to its eastern
	 * depth (both from `pacificPicture`).
	 *
	 * Phases (`step.hints.phase`):
	 *   normal — the ocean's steady response to the trade winds held at
	 *            `params.pacTrades` × normal (`steadyPacific`), tweened; a
	 *            readout card below
	 *   enso   — Jin's recharge oscillator run from rest after a six-month lull
	 *            of `params.weaken` in the trades, with the Bjerknes feedback at
	 *            `params.feedback` × today's μ, replayed at one time unit (two
	 *            months) per second; `params.burst` restarts it. Below, the east
	 *            Pacific's temperature anomaly over eight years, El Niño and La
	 *            Niña shaded. The weather far away is labelled when the anomaly
	 *            passes ±0.5 °C. Reduced motion: the whole run drawn, the picture
	 *            at the El Niño's peak.
	 *
	 * The sea surface temperature along the equator is a sketch: the western
	 * value (29.5 °C) blending into the model's eastern value over the eastern
	 * two thirds of the ocean; rain falls where it is above 28 °C.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		JIN,
		MEAN_TILT,
		MU_TODAY,
		PACIFIC,
		pacificPicture,
		runEnso,
		steadyPacific,
		type PacificState
	} from '../ocean';
	import Card, { type Cell } from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- layout -----------------------------------------------------------------------------
	const X0 = 100; // west coast (Indonesia)
	const X1 = 856; // east coast (South America)
	const SURF = 200; // sea surface (mean)
	const DPX = 0.86; // px per metre of depth
	const BOTTOM = 410; // the slice is cut here
	const SL = 26; // px per metre of sea level (exaggerated)
	const PLOT = { x0: 140, x1: 620, top: 452, bottom: 562 };
	const YEARS = 8;
	const UNITS = (YEARS * 12) / JIN.months;

	const phase = $derived(String(step.hints?.phase ?? 'normal'));

	// ---- normal: steady response, tweened -------------------------------------------------------
	const strength = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = Number(params.pacTrades ?? 1);
		untrack(() => strength.set(v, { duration: reduced ? 0 : 700 }));
	});

	// ---- enso: the coupled run, replayed ------------------------------------------------------------
	const mu = $derived(Number(params.feedback ?? 1) * MU_TODAY);
	const amp = $derived(Number(params.weaken ?? 0.3) * MEAN_TILT);
	const bursts = $derived(Number(params.burst ?? 0));
	const run = $derived(runEnso(mu, amp, UNITS));
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${mu}|${amp}|${bursts}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const peakAt = $derived.by(() => {
		let k = 0;
		for (let i = 1; i < run.T.length; i++) if (run.T[i] > run.T[k]) k = i;
		return k * run.dt;
	});
	const tau = $derived(reduced ? peakAt : Math.min(UNITS, since));
	const sample = (arr: Float64Array, s: number) => {
		const f = Math.max(0, s / run.dt);
		const i = Math.min(arr.length - 2, Math.floor(f));
		const u = Math.min(1, f - i);
		return arr[i] + (arr[i + 1] - arr[i]) * u;
	};

	const st: PacificState = $derived(
		phase === 'enso'
			? { T: sample(run.T, tau), h: sample(run.h, tau), tau: sample(run.tau, tau) }
			: steadyPacific(strength.current)
	);
	const pic = $derived(pacificPicture(st));
	const anomaly = $derived(st.T * JIN.degrees);

	// ---- geometry from the state ----------------------------------------------------------------
	const surfY = (x: number) => SURF - SL * pic.seaLevel * (0.5 - (x - X0) / (X1 - X0));
	const yW = $derived(Math.min(BOTTOM - 6, SURF + DPX * pic.westDepth));
	const yE = $derived(Math.min(BOTTOM - 6, Math.max(SURF + 6, SURF + DPX * pic.eastDepth)));
	const sstAt = (x: number) =>
		pic.westSST - (pic.westSST - pic.eastSST) * smoothstep(0.3, 0.95, (x - X0) / (X1 - X0));
	/** Diverging colour scale: 23 °C blue, 26.5 °C pale, 29.5 °C warm. */
	const sstColor = (v: number) => {
		const pct = (u: number) => Math.round(Math.max(0, Math.min(1, u)) * 100);
		return v < 26.5
			? `color-mix(in oklab, var(--oc-mid) ${pct((v - 23) / 3.5)}%, var(--oc-cold))`
			: `color-mix(in oklab, var(--oc-warm) ${pct((v - 26.5) / 3)}%, var(--oc-mid))`;
	};
	const stops = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const x = X0 + (i / 6) * (X1 - X0);
			return { i, o: i / 6, c: sstColor(sstAt(x)) };
		})
	);
	const warmLayer = $derived(
		`M${X0} ${surfY(X0).toFixed(1)} L${X1} ${surfY(X1).toFixed(1)} L${X1} ${yE.toFixed(1)} L${X0} ${yW.toFixed(1)} Z`
	);
	// where the sea is warmer than 28 °C, rain clouds; the Walker cell rises there
	const rainEdge = $derived.by(() => {
		for (let x = X0; x <= X1; x += 4) if (sstAt(x) < 28) return x;
		return X1;
	});
	const rainX = $derived(Math.min(X1 - 150, Math.max(X0 + 90, X0 + 0.75 * (rainEdge - X0))));
	const trades = $derived(Math.max(0, pic.trades));
	const tradesOp = $derived(Math.min(1, trades));

	// ---- motion (pure functions of t) ---------------------------------------------------------------
	const tv = $derived(reduced ? 2.5 : t);
	const windChevrons = $derived(
		Array.from({ length: 10 }, (_, j) => {
			const u = cycle(tv, 9, j / 10);
			return { j, x: X1 - 40 - u * (X1 - X0 - 120), o: Math.sin(Math.PI * u) };
		})
	);
	const walker = $derived.by(() => {
		const x0 = rainX;
		const x1 = X1 - 70;
		const top = 66;
		const bot = 172;
		return { x0, x1, top, bot, d: `M${x0} ${bot} L${x0} ${top} L${x1} ${top} L${x1} ${bot}` };
	});
	const walkerChevrons = $derived.by(() => {
		const { x0, x1, top, bot } = walker;
		const legs = [bot - top, x1 - x0, bot - top];
		const total = legs[0] + legs[1] + legs[2];
		return Array.from({ length: 8 }, (_, j) => {
			let s = cycle(tv, 7, j / 8) * total;
			let x = x0;
			let y = bot - s;
			let a = -90;
			if (s > legs[0]) {
				s -= legs[0];
				x = x0 + s;
				y = top;
				a = 0;
				if (s > legs[1]) {
					s -= legs[1];
					x = x1;
					y = top + s;
					a = 90;
				}
			}
			return { j, x, y, a };
		});
	});
	const drops = $derived(
		Array.from({ length: 9 }, (_, i) => {
			const u = cycle(tv, 1.1, (i * 0.618) % 1);
			return {
				i,
				x: rainX - 40 + ((i * 23) % 84),
				y: 92 + u * (surfY(rainX) - 102),
				o: Math.min(1, 5 * u) * (1 - smoothstep(0.85, 1, u))
			};
		})
	);

	// ---- the plot (enso) ----------------------------------------------------------------------------
	const px = scale([0, UNITS], [PLOT.x0, PLOT.x1]);
	const py = scale([-4, 4], [PLOT.bottom, PLOT.top]);
	const trace = $derived.by(() => {
		const end = reduced ? UNITS : tau;
		const n = Math.max(1, Math.round(end / 0.1));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const s = (end * i) / n;
			const v = Math.max(-4, Math.min(4, sample(run.T, s) * JIN.degrees));
			d += `${i ? 'L' : 'M'}${px(s).toFixed(1)} ${py(v).toFixed(1)}`;
		}
		return d;
	});
	const ensoState = $derived(anomaly > 0.5 ? 'El Niño' : anomaly < -0.5 ? 'La Niña' : 'neutral');

	// ---- focus tween between phases -------------------------------------------------------------
	const ensoOn = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'enso' ? 1 : 0;
		untrack(() => ensoOn.set(v, { duration: reduced ? 0 : 800 }));
	});

	const fmtT = (v: number) => `${v.toFixed(1)} °C`;
	/** Text colour for a sea temperature: cool, warm or plain ink near normal. */
	const sstText = (v: number) =>
		v < PACIFIC.eastSST + 0.5 ? 'var(--oc-cold)' : v > 26.5 ? 'var(--oc-warm)' : undefined;
	const fmtA = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} °C`;
	const normalCells: Cell[] = $derived([
		{
			id: 'tr',
			label: 'trade winds',
			value: `${Math.round(trades * 100)}%`,
			sub: 'of normal',
			color: 'var(--oc-wind)'
		},
		{
			id: 'sst',
			label: 'east Pacific sea',
			value: fmtT(pic.eastSST),
			sub: `west ${fmtT(pic.westSST)}`,
			color: sstText(pic.eastSST)
		},
		{
			id: 'th',
			label: 'thermocline depth',
			value: `${Math.round(pic.westDepth)} → ${Math.max(0, Math.round(pic.eastDepth))} m`,
			sub: 'west → east'
		},
		{
			id: 'sl',
			label: 'sea level, west above east',
			value: `${pic.seaLevel.toFixed(2)} m`,
			sub: 'held up by the trades'
		}
	]);
	const ensoCells: Cell[] = $derived([
		{
			id: 'an',
			label: 'east Pacific vs normal',
			value: fmtA(anomaly),
			sub: ensoState,
			color: anomaly > 0.5 ? 'var(--oc-warm)' : anomaly < -0.5 ? 'var(--oc-cold)' : undefined
		},
		{
			id: 'tr',
			label: 'trade winds',
			value: `${Math.round(trades * 100)}%`,
			sub: `month ${Math.floor(tau * JIN.months)}`,
			color: 'var(--oc-wind)'
		}
	]);
	const farAway = $derived(
		phase !== 'enso' || Math.abs(anomaly) < 0.5
			? null
			: anomaly > 0
				? { west: 'drought, bushfires', east: 'floods' }
				: { west: 'extra-heavy rain', east: 'drier than usual' }
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		rotate?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		transform={opts.rotate ? `rotate(${opts.rotate} ${x} ${y})` : undefined}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<linearGradient id="pacific-sst" gradientUnits="userSpaceOnUse" x1={X0} y1="0" x2={X1} y2="0">
			{#each stops as s (s.i)}
				<stop offset={s.o} stop-color={s.c} />
			{/each}
		</linearGradient>
	</defs>

	<!-- ===== air ===== -->
	<rect x={X0} y="34" width={X1 - X0} height={SURF - 40} rx="10" fill="var(--oc-sky)" />
	<path
		d={walker.d}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="5 5"
		opacity={0.25 + 0.5 * tradesOp}
	/>
	{#each walkerChevrons as c (c.j)}
		<path
			d="M-5 -5 L3 0 L-5 5"
			transform="translate({c.x.toFixed(1)} {c.y.toFixed(1)}) rotate({c.a})"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			stroke-linecap="round"
			opacity={0.15 + 0.7 * tradesOp}
		/>
	{/each}
	{@render txt(walker.x1 + 8, 120, 'dry air sinks', 11, { muted: true })}
	<!-- rain clouds over the warmest water -->
	<g>
		<ellipse cx={rainX} cy="78" rx="62" ry="18" fill="var(--oc-cloud)" />
		<ellipse cx={rainX - 30} cy="66" rx="30" ry="20" fill="var(--oc-cloud)" />
		<ellipse cx={rainX + 22} cy="58" rx="34" ry="24" fill="var(--oc-cloud)" />
	</g>
	{#each drops as d (d.i)}
		<line
			x1={d.x}
			x2={d.x - 1.5}
			y1={d.y}
			y2={d.y + 9}
			stroke="var(--oc-fresh)"
			stroke-width="2"
			stroke-linecap="round"
			opacity={d.o}
		/>
	{/each}
	{@render txt(rainX, 48 - 8, 'moist air rises: rain', 11, { anchor: 'middle', weight: 600 })}

	<!-- trade winds along the surface -->
	{#each windChevrons as c (c.j)}
		<path
			d="M7 -7 L-3 0 L7 7"
			transform="translate({c.x.toFixed(1)} {surfY(c.x) - 20})"
			fill="none"
			stroke="var(--oc-wind)"
			stroke-width={2 + 1.5 * tradesOp}
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={c.o * tradesOp}
		/>
	{/each}
	{@render txt(X1 - 30, surfY(X1) - 40, `← trade winds ${Math.round(trades * 100)}%`, 12, {
		anchor: 'end',
		weight: 600,
		color: 'var(--oc-wind)',
		opacity: 0.35 + 0.65 * Math.min(1, trades * 2)
	})}

	<!-- ===== ocean ===== -->
	<rect x={X0} y={SURF - 20} width={X1 - X0} height={BOTTOM - SURF + 20} fill="var(--oc-deep)" />
	<rect
		x={X0}
		y={SURF - 20}
		width={X1 - X0}
		height={BOTTOM - SURF + 20}
		fill="var(--oc-cold)"
		opacity="0.18"
	/>
	<!-- cover the part of the rect above the tilted surface -->
	<path
		d="M{X0} {SURF - 21} L{X1} {SURF - 21} L{X1} {surfY(X1)} L{X0} {surfY(X0)} Z"
		fill="var(--oc-sky)"
	/>
	<path d={warmLayer} fill="url(#pacific-sst)" opacity="0.6" />
	<line x1={X0} y1={surfY(X0)} x2={X1} y2={surfY(X1)} stroke="url(#pacific-sst)" stroke-width="5" />
	<line
		x1={X0}
		y1={yW}
		x2={X1}
		y2={yE}
		stroke="var(--oc-thermo)"
		stroke-width="2"
		stroke-dasharray="7 4"
	/>
	{@render txt((X0 + X1) / 2, (yW + yE) / 2 + 18, 'thermocline', 12, {
		anchor: 'middle',
		weight: 600
	})}
	{@render txt(X0 + 10, yW + 18, `${Math.round(pic.westDepth)} m`, 12, { weight: 600 })}
	{@render txt(
		X1 - 10,
		Math.max(yE + 18, surfY(X1) + 40),
		`${Math.max(0, Math.round(pic.eastDepth))} m`,
		12,
		{
			anchor: 'end',
			weight: 600
		}
	)}
	{@render txt((X0 + X1) / 2, BOTTOM - 12, 'cold deep water', 12, {
		anchor: 'middle',
		muted: true
	})}
	<!-- upwelling in the east -->
	{#if trades > 0.2}
		{#each [0, 1] as k (k)}
			{@const u = cycle(tv, 2.4, k / 2)}
			{@const x = X1 - 44 - k * 30}
			<path
				d="M{x} {Math.min(BOTTOM - 20, yE + 60) - u * 50} l -5 7 m 5 -7 l 5 7"
				fill="none"
				stroke="var(--oc-cold)"
				stroke-width="2"
				stroke-linecap="round"
				opacity={Math.sin(Math.PI * u) * Math.min(1, trades)}
			/>
		{/each}
		{@render txt(X1 - 60, Math.min(BOTTOM - 20, yE + 60) + 18, 'upwelling', 11, {
			anchor: 'middle',
			muted: true,
			opacity: Math.min(1, trades)
		})}
	{/if}
	{@render txt(X0 + 12, surfY(X0) + 22, `${fmtT(pic.westSST)} warm pool`, 12, {
		weight: 700,
		color: 'var(--oc-warm)'
	})}
	{@render txt(X1 - 12, surfY(X1) + 20, fmtT(pic.eastSST), 12, {
		anchor: 'end',
		weight: 700,
		color: sstText(pic.eastSST)
	})}
	{#if pic.seaLevel > 0.05}
		{@render txt(
			X0 + 12,
			surfY(X0) + 38,
			`sea ${pic.seaLevel.toFixed(1)} m higher than in the east`,
			11,
			{
				muted: true
			}
		)}
	{/if}

	<!-- land -->
	<path
		d="M16 {SURF - 8} L{X0} {SURF - 12} L{X0} {BOTTOM} L16 {BOTTOM} Z"
		fill="var(--oc-land)"
		stroke="var(--oc-land-edge)"
	/>
	<path
		d="M{X1} {SURF - 14} L{X1 + 30} {SURF - 70} L{X1 + 52} {SURF - 104} L{X1 + 88} {SURF -
			60} L944 {SURF - 20} L944 {BOTTOM} L{X1} {BOTTOM} Z"
		fill="var(--oc-land)"
		stroke="var(--oc-land-edge)"
	/>
	{@render txt(58, SURF + 60, 'Indonesia', 11, { anchor: 'middle', muted: true, rotate: -90 })}
	{@render txt(900, SURF + 70, 'South America', 11, { anchor: 'middle', muted: true, rotate: -90 })}
	{#if farAway}
		{@render txt(26, SURF - 28, farAway.west, 12, {
			weight: 700,
			color: anomaly > 0 ? 'var(--oc-warm)' : 'var(--oc-cold)'
		})}
		{@render txt(940, SURF - 116, farAway.east, 12, {
			anchor: 'end',
			weight: 700,
			color: anomaly > 0 ? 'var(--oc-cold)' : 'var(--oc-warm)'
		})}
	{/if}
	{@render txt(X0, BOTTOM + 18, '120°E', 11, { anchor: 'middle', muted: true })}
	{@render txt(
		(X0 + X1) / 2,
		BOTTOM + 18,
		'along the equator · depths to scale, sea level exaggerated',
		11,
		{
			anchor: 'middle',
			muted: true
		}
	)}
	{@render txt(X1, BOTTOM + 18, '80°W', 11, { anchor: 'middle', muted: true })}

	<!-- ===== below: readouts / the run ===== -->
	{#if ensoOn.current < 0.99}
		<g opacity={1 - ensoOn.current}>
			<Card x={X0 - 60} y={456} w={X1 - X0 + 148} cells={normalCells} row cellH={76} />
		</g>
	{/if}
	{#if ensoOn.current > 0.01}
		<g opacity={ensoOn.current}>
			<rect
				x={PLOT.x0}
				y={py(4)}
				width={PLOT.x1 - PLOT.x0}
				height={py(0.5) - py(4)}
				fill="var(--oc-warm)"
				opacity="0.1"
			/>
			<rect
				x={PLOT.x0}
				y={py(-0.5)}
				width={PLOT.x1 - PLOT.x0}
				height={py(-4) - py(-0.5)}
				fill="var(--oc-cold)"
				opacity="0.1"
			/>
			<line x1={PLOT.x0} x2={PLOT.x1} y1={py(0)} y2={py(0)} stroke="var(--stage-line)" />
			<line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.top} y2={PLOT.bottom} stroke="var(--stage-line)" />
			{#each [-2, 2] as v (v)}
				<text x={PLOT.x0 - 6} y={py(v) + 4} text-anchor="end" class="muted" style:font-size="11px"
					>{v > 0 ? '+' : '−'}{Math.abs(v)} °C</text
				>
			{/each}
			<line
				x1={PLOT.x0}
				x2={PLOT.x1}
				y1={PLOT.bottom}
				y2={PLOT.bottom}
				stroke="var(--stage-line)"
			/>
			{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as yr (yr)}
				<line
					x1={px((yr * 12) / JIN.months)}
					x2={px((yr * 12) / JIN.months)}
					y1={PLOT.bottom}
					y2={PLOT.bottom + 4}
					stroke="var(--stage-line)"
				/>
				<text
					x={px((yr * 12) / JIN.months)}
					y={PLOT.bottom + 16}
					text-anchor="middle"
					class="muted"
					style:font-size="11px">{yr === 8 ? '8 years' : yr}</text
				>
			{/each}
			{@render txt(PLOT.x1 - 6, py(3.3), 'El Niño', 11, {
				anchor: 'end',
				weight: 600,
				color: 'var(--oc-warm)'
			})}
			{@render txt(PLOT.x1 - 6, py(-3.0), 'La Niña', 11, {
				anchor: 'end',
				weight: 600,
				color: 'var(--oc-cold)'
			})}
			{@render txt(PLOT.x0 - 100, PLOT.top - 4, 'east Pacific', 11, { muted: true })}
			{@render txt(PLOT.x0 - 100, PLOT.top + 10, 'vs normal', 11, { muted: true })}
			<path
				d={trace}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<circle
				cx={px(tau)}
				cy={py(Math.max(-4, Math.min(4, anomaly)))}
				r="4.5"
				fill={sstColor(pic.eastSST)}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Card x={676} y={456} w={268} cells={ensoCells} row cellH={76} />
		</g>
	{/if}
</g>
