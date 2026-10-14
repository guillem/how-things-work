<script lang="ts">
	/**
	 * The grid's frequency after an imbalance, for Continental Europe (`trip` in grid.ts).
	 * Left: a generator rotor standing for every synchronous machine, turning a little slower
	 * or faster with the frequency, and the frequency dial. Right: the frequency trace, drawn
	 * as the run is replayed, and below it where the missing power comes from at that moment.
	 *
	 * Modes (`step.hints.mode`):
	 *   free      — a mismatch with no controls at all (only the load's self-regulation)
	 *   inertia   — 3,000 MW lost; the first 12 seconds, with the initial slope (RoCoF)
	 *   primary   — governors (FCR) on or off, and the size of the loss; one minute
	 *   secondary — the secondary control returns the frequency to 50 Hz; fifteen minutes
	 *   ufls      — a very large loss, with load shedding on or off; one minute
	 *
	 * The run is computed once per setting; a cursor replays it at `rate` × real time (a pure
	 * function of t), holds the finished picture, and starts again. Under reduced motion the
	 * whole run is shown.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BAND, F0, UFLS_STEPS, UNDER_TRIP, trip, type TripInput } from '../grid';
	import Dial from './Dial.svelte';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	type Mode = 'free' | 'inertia' | 'primary' | 'secondary' | 'ufls';
	const mode = $derived(String(step.hints?.mode ?? 'free') as Mode);
	const num = (id: string, d: number) => Number(params[id] ?? d);
	const flag = (id: string) => params[id] !== false;

	interface Cfg {
		input: TripInput;
		window: number;
		rate: number;
		minutes?: boolean;
	}
	const cfg = $derived.by((): Cfg => {
		switch (mode) {
			case 'free':
				return {
					input: {
						lost: -num('imbalance', -3000),
						fcr: false,
						ufls: false,
						lfsmo: false,
						duration: 60
					},
					window: 60,
					rate: 3
				};
			case 'inertia':
				return {
					input: { lost: 3000, inverterShare: num('share', 30) / 100, duration: 12 },
					window: 12,
					rate: 1
				};
			case 'primary':
				return {
					input: { lost: num('lost', 3000), fcr: flag('fcr'), duration: 60 },
					window: 60,
					rate: 3
				};
			case 'secondary':
				return {
					input: { lost: 3000, afrr: flag('afrr'), duration: 900 },
					window: 900,
					rate: 45,
					minutes: true
				};
			case 'ufls':
				return {
					input: { lost: num('bigLost', 20000), ufls: flag('ufls'), duration: 60 },
					window: 60,
					rate: 3
				};
		}
	});
	const run = $derived(trip(cfg.input));
	const allSpinning = $derived(
		mode === 'inertia' ? trip({ ...cfg.input, inverterShare: 0 }) : null
	);
	const lost = $derived(cfg.input.lost);

	// ---- replay clock
	const LEAD = 0.6;
	const HOLD = 4;
	const period = $derived(cfg.window / cfg.rate + LEAD + HOLD);
	const tau = $derived(
		reduced ? cfg.window : Math.max(0, Math.min(cfg.window, ((t % period) - LEAD) * cfg.rate))
	);
	const sampleDt = $derived(run.samples.length > 1 ? run.samples[1].t - run.samples[0].t : 1);
	const idx = $derived(Math.min(run.samples.length - 1, Math.floor(tau / sampleDt + 1e-9)));
	const cur = $derived(run.samples[idx]);
	const shown = $derived(run.samples.slice(0, idx + 1));
	const blackout = $derived(run.blackoutAt !== null && tau >= run.blackoutAt);

	// ---- chart geometry
	const CX0 = 380;
	const CX1 = 924;
	const CY0 = 56;
	const CY1 = 360;
	const range = $derived.by((): [number, number] => {
		if (mode === 'free') return [48.8, 51.2];
		if (mode === 'ufls') return [47, 51];
		const lo = Math.min(49.6, Math.floor((run.nadir - 0.06) * 10) / 10);
		const hi = Math.max(50.1, Math.ceil((run.zenith + 0.06) * 10) / 10);
		return [Math.max(47, lo), Math.min(51, hi)];
	});
	const yLo = new Tween(49.6, { duration: 700, easing: cubicInOut });
	const yHi = new Tween(50.1, { duration: 700, easing: cubicInOut });
	const target = $derived(range);
	$effect(() => {
		const [lo, hi] = target;
		untrack(() => {
			yLo.set(lo, { duration: reduced ? 0 : 700 });
			yHi.set(hi, { duration: reduced ? 0 : 700 });
		});
	});
	const sx = $derived(scale([0, cfg.minutes ? cfg.window / 60 : cfg.window], [CX0, CX1]));
	const sy = $derived(scale([yLo.current, yHi.current], [CY1, CY0]));
	const xOf = (s: number) => (cfg.minutes ? s / 60 : s);
	const fy = (f: number) => sy(Math.max(yLo.current, Math.min(yHi.current, f)));
	const path = $derived(
		linePath(
			shown,
			(s) => xOf(s.t),
			(s) => Math.max(yLo.current, Math.min(yHi.current, s.f)),
			sx,
			sy
		)
	);
	const refPath = $derived(
		allSpinning
			? linePath(
					allSpinning.samples,
					(s) => s.t,
					(s) => s.f,
					sx,
					sy
				)
			: ''
	);
	const yTicks = $derived.by(() => {
		const span = yHi.current - yLo.current;
		const stepHz = span > 2.5 ? 0.5 : span > 1.2 ? 0.2 : 0.1;
		const out: number[] = [];
		for (
			let v = Math.ceil(yLo.current / stepHz - 1e-6) * stepHz;
			v <= yHi.current + 1e-6;
			v += stepHz
		)
			out.push(Number(v.toFixed(2)));
		return out;
	});
	const xTicks = $derived(
		cfg.minutes
			? [0, 3, 6, 9, 12, 15]
			: cfg.window === 12
				? [0, 2, 4, 6, 8, 10, 12]
				: [0, 10, 20, 30, 40, 50, 60]
	);

	// ---- labels
	const fmt = (v: number) => Math.round(v).toLocaleString('en-GB');
	const eventText = $derived(
		mode === 'free'
			? lost > 0
				? `generation ${fmt(lost)} MW short of demand`
				: lost < 0
					? `generation ${fmt(-lost)} MW more than demand`
					: 'generation equals demand'
			: `${fmt(lost)} MW lost`
	);
	const showNadir = $derived(
		mode !== 'free' && lost > 0 && tau >= run.nadirAt && run.nadir < F0 - 0.01 && !blackout
	);
	const nadirX = $derived(sx(xOf(run.nadirAt)));
	const nadirY = $derived(fy(run.nadir));
	const tangent = $derived.by(() => {
		if (mode !== 'inertia') return null;
		// the initial slope from the moment of the trip, until it leaves the chart
		const t1 = Math.min(cfg.window, 1 + (yLo.current - F0) / run.rocof);
		return { x1: sx(1), y1: sy(F0), x2: sx(t1), y2: sy(F0 + run.rocof * (t1 - 1)) };
	});
	const status = $derived.by(() => {
		if (blackout) return 'blackout: below 47.5 Hz the power stations disconnect';
		if (cur.shed > 0) return `load shedding: ${fmt(cur.shed)} MW of customers cut off`;
		if (Math.abs(cur.f - F0) <= 0.01) return 'on target';
		if (Math.abs(cur.f - F0) <= BAND) return 'inside the ±0.2 Hz band';
		return cur.f < F0 ? 'below the band' : 'above the band';
	});

	// ---- where the missing power comes from, at the cursor
	const bars = $derived.by(() => {
		const all = [
			{ id: 'inertia', name: 'spinning mass', v: cur.inertia, color: 'var(--pg-rotor)' },
			{ id: 'damping', name: 'motors slowing', v: cur.damping, color: 'var(--pg-other)' },
			{ id: 'fcr', name: 'governors', v: cur.fcr, color: 'var(--pg-gas)' },
			{ id: 'afrr', name: 'secondary', v: cur.afrr, color: 'var(--pg-hydro)' },
			{ id: 'shed', name: 'customers cut off', v: cur.shed, color: 'var(--pg-alarm)' }
		];
		const keep: Record<Mode, string[]> = {
			free: ['inertia', 'damping'],
			inertia: ['inertia', 'damping', 'fcr'],
			primary: ['inertia', 'damping', 'fcr'],
			secondary: ['inertia', 'damping', 'fcr', 'afrr'],
			ufls: ['inertia', 'damping', 'fcr', 'shed']
		};
		return all.filter((b) => keep[mode].includes(b.id));
	});
	const barScale = $derived(Math.max(Math.abs(lost), ...run.samples.map((s) => s.shed), 1));
	const BY0 = 448;
	const BROW = 27;
	const BZ = 620;
	const BMAX = 220;
	const BNEG = 70;

	// ---- rotor: turns at a visible rate times f/50 (and stops after a blackout)
	const rotorTurn = $derived.by(() => {
		const k = blackout ? 0 : cur.f / F0;
		return ((t * 0.35 * k) % 1) * 360;
	});
	const rpm = $derived(Math.round((3000 * cur.f) / F0));
	const dialMin = $derived(mode === 'ufls' ? 47 : 48.5);
	const dialMax = $derived(mode === 'ufls' ? 51 : 51.5);
	const showUnderTrip = $derived(mode === 'ufls');
</script>

<g>
	<!-- ===== the rotor: every synchronous generator, turning in step -->
	<g transform="translate(170 142)">
		<circle r="78" fill="var(--surface)" stroke="var(--border)" />
		<g transform="rotate({reduced ? 20 : rotorTurn})">
			<rect x="-58" y="-16" width="116" height="32" rx="10" fill="var(--pg-rotor)" />
			<rect x="-58" y="-16" width="22" height="32" rx="6" fill="var(--em-north, #e03131)" />
			<rect x="36" y="-16" width="22" height="32" rx="6" fill="var(--em-south, #1c7ed6)" />
			<circle r="9" fill="var(--stage-ink)" opacity="0.6" />
		</g>
	</g>
	<Readout id="rpm" order={3} label="Generators turn at" value="{rpm.toLocaleString('en-GB')} rpm">
		<Label x={170} y={244} text="every generator: {rpm.toLocaleString('en-GB')} turns a minute" />
	</Readout>
	<Readout id="rotor-note">
		<Label x={170} y={40} text="all turning in step" muted />
	</Readout>

	<!-- ===== the dial -->
	<Readout
		id="freq"
		order={1}
		label="Frequency"
		value="{cur.f.toFixed(2)} Hz"
		note={status}
		color={Math.abs(cur.f - F0) <= BAND ? 'var(--pg-ok)' : 'var(--pg-alarm)'}
	>
		<Dial cx={170} cy={390} r={92} f={cur.f} min={dialMin} max={dialMax} />
		<Label
			x={170}
			y={500}
			text={status}
			color={blackout || cur.shed > 0 ? 'var(--pg-alarm)' : undefined}
		/>
	</Readout>

	<!-- ===== the trace -->
	<rect
		x={CX0}
		y={fy(F0 + BAND)}
		width={CX1 - CX0}
		height={Math.max(0, fy(F0 - BAND) - fy(F0 + BAND))}
		fill="var(--pg-band)"
	/>
	<Axes
		{sx}
		{sy}
		{xTicks}
		{yTicks}
		xLabel={cfg.minutes ? 'minutes' : 'seconds'}
		yFormat={(v) => v.toFixed(yTicks.length > 1 && yTicks[1] - yTicks[0] < 0.15 ? 1 : 1)}
	/>
	<Txt x={CX0 - 8} y={CY0 - 16} text="frequency, Hz" anchor="start" muted size={12} />
	<line x1={CX0} x2={CX1} y1={sy(F0)} y2={sy(F0)} stroke="var(--pg-ok)" stroke-dasharray="4 4" />
	{#if yLo.current < UFLS_STEPS[0]}
		<line
			x1={CX0}
			x2={CX1}
			y1={sy(UFLS_STEPS[0])}
			y2={sy(UFLS_STEPS[0])}
			stroke="var(--pg-alarm)"
			stroke-dasharray="5 4"
		/>
		<Readout id="ufls-line">
			<Label
				x={CX1 - 6}
				y={sy(UFLS_STEPS[0]) - 7}
				text="49.0 Hz: load shedding starts"
				anchor="end"
				color="var(--pg-alarm)"
			/>
		</Readout>
	{/if}
	{#if showUnderTrip}
		<line
			x1={CX0}
			x2={CX1}
			y1={sy(UNDER_TRIP)}
			y2={sy(UNDER_TRIP)}
			stroke="var(--pg-alarm)"
			stroke-width="1.5"
		/>
		<Readout id="trip-line">
			<Label
				x={CX1 - 6}
				y={sy(UNDER_TRIP) - 7}
				text="47.5 Hz: power stations disconnect"
				anchor="end"
				color="var(--pg-alarm)"
			/>
		</Readout>
	{/if}
	<!-- the moment of the trip -->
	<line
		x1={sx(xOf(1))}
		x2={sx(xOf(1))}
		y1={CY0}
		y2={CY1}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 4"
	/>
	<Readout id="event">
		<Label x={sx(xOf(1)) + 8} y={CY0 + 14} text={eventText} anchor="start" />
	</Readout>
	{#if refPath}
		<path
			d={refPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<Readout id="ref">
			<Label
				x={sx(11.8)}
				y={fy(allSpinning?.samples.at(-1)?.f ?? F0) - 10}
				text="all spinning (0%)"
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
	{#if tangent}
		<line
			x1={tangent.x1}
			y1={tangent.y1}
			x2={tangent.x2}
			y2={tangent.y2}
			stroke="var(--pg-warn)"
			stroke-width="2"
			stroke-dasharray="7 4"
		/>
	{/if}
	<path d={path} fill="none" stroke="var(--stage-ink)" stroke-width="2.5" stroke-linejoin="round" />
	<circle cx={sx(xOf(cur.t))} cy={fy(cur.f)} r="5" fill="var(--stage-ink)" />
	{#if showNadir}
		<circle cx={nadirX} cy={nadirY} r="4" fill="none" stroke="var(--pg-alarm)" stroke-width="2" />
		<Readout id="nadir" order={2} label="Lowest point" value="{run.nadir.toFixed(2)} Hz">
			<Label
				x={nadirX + 10}
				y={nadirY + 18}
				text="lowest {run.nadir.toFixed(2)} Hz"
				anchor="start"
			/>
		</Readout>
	{/if}
	{#if mode === 'inertia'}
		<Readout
			id="rocof"
			order={2}
			label="Falling at first"
			value="{(-run.rocof).toFixed(3)} Hz per second"
			color="var(--pg-warn)"
		>
			<Label
				x={CX1 - 6}
				y={CY0 + 14}
				text="falling at first {(-run.rocof).toFixed(3)} Hz/s"
				anchor="end"
				color="var(--pg-warn)"
			/>
		</Readout>
	{/if}

	<!-- ===== where the power comes from: one row per contributor, zero at BZ -->
	<Readout id="bars-title">
		<Txt
			x={CX0}
			y={BY0 - 22}
			anchor="start"
			size={13}
			weight={600}
			text={lost >= 0
				? `Where the missing ${fmt(lost)} MW comes from, at the dot`
				: `Where the extra ${fmt(-lost)} MW goes, at the dot`}
		/>
	</Readout>
	<line
		x1={BZ}
		x2={BZ}
		y1={BY0 - 10}
		y2={BY0 + bars.length * BROW - 8}
		stroke="var(--stage-line)"
	/>
	{#each bars as b, i (b.id)}
		{@const y = BY0 + i * BROW}
		{@const v = lost >= 0 ? b.v : -b.v}
		{@const w = Math.min(v >= 0 ? BMAX : BNEG, (BMAX * Math.abs(v)) / barScale)}
		<rect
			x={v >= 0 ? BZ : BZ - w}
			y={y - 8}
			width={Math.max(0.5, w)}
			height="16"
			rx="3"
			fill={b.color}
			opacity="0.85"
		/>
		<Readout id="bar-{b.id}" order={10 + i} label={b.name} value="{fmt(v)} MW" color={b.color}>
			<Label x={BZ - BNEG - 10} y={y + 5} text={b.name} anchor="end" />
			<Label
				x={v >= 0 ? BZ + w + 8 : BZ + 8}
				y={y + 5}
				text="{fmt(v)} MW{b.id === 'inertia' && v < -50 ? ' (speeding back up)' : ''}"
				anchor="start"
				muted
			/>
		</Readout>
	{/each}
</g>
