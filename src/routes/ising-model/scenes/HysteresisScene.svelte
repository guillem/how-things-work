<script lang="ts">
	/**
	 * A 32 × 32 lattice in a field swept between +1.5 J and −1.5 J and back (left, with the field
	 * as an arrow above it), and the magnetisation against the field (right): the loop it traces.
	 * One Metropolis sweep per value of the field, RATE sweeps a second; `sweep:hyst` sets 400 or
	 * 100 sweeps a loop, `T:hyst` the temperature.
	 *
	 * The run is a `FieldSweep` advanced as t passes; it carries on when the temperature changes,
	 * and starts again (all spins up, field at +1.5 J) when the sweep speed or the step changes or
	 * t goes back. Reduced motion: two full loops at the setting, the second drawn.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FieldSweep, TC } from '../ising';
	import { upPath } from '../live';
	import { numberFrom, signed, stringFrom } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const L = 32;
	const H0 = 1.5;
	const RATE = 40;
	const T = $derived(numberFrom(step, params, 't', 1.5));
	const per = $derived(stringFrom(step, params, 'sweep', 'slow') === 'fast' ? 100 : 400);

	let run: FieldSweep | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, FieldSweep>();

	const current = $derived.by((): { run: FieldSweep; k: number } => {
		const time = t;
		const key = `${step.id}|${per}`;
		if (reduced) {
			const rk = `${per}|${T}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = new FieldSweep(L, H0, per, 3);
				r.advance(2 * per, T);
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(rk, r);
			}
			return { run: r, k: r.hs.length };
		}
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = new FieldSweep(L, H0, per, 3);
			runKey = key;
			t0 = time;
		}
		lastT = time;
		const target = Math.floor((time - t0) * RATE);
		run.advance(Math.min(target, run.hs.length + 400), T);
		return { run, k: run.hs.length };
	});

	// ---- the lattice ---------------------------------------------------------------------------
	const LX = 40;
	const LY = 132;
	const C = 12;
	const LS = L * C;
	const ups = $derived.by(() => {
		void current.k;
		return upPath(current.run.lat, LX, LY, C);
	});
	const h = $derived(current.k > 0 ? current.run.hs[current.k - 1] : H0);
	const m = $derived(current.k > 0 ? current.run.ms[current.k - 1] : 1);

	// ---- the loop ------------------------------------------------------------------------------
	const sx = scale([-H0, H0], [612, 916]);
	const sy = scale([-1, 1], [510, 110]);
	/** The loop so far: the current period bright, the one before faint. */
	const paths = $derived.by(() => {
		const { run: r, k } = current;
		const startNow = Math.max(0, k - per);
		const seg = (a: number, b: number) => {
			let d = '';
			b = Math.min(b, k);
			for (let i = a; i < b; i++) {
				d += `${i === a ? 'M' : 'L'}${sx(r.hs[i]).toFixed(1)} ${sy(r.ms[i]).toFixed(1)}`;
			}
			return d;
		};
		return { now: seg(startNow, k), before: seg(Math.max(0, startNow - per), startNow + 1) };
	});
	const ordered = $derived(T < TC);

	// field arrow above the lattice: length ∝ h
	const AX = LX + LS / 2;
	const AY = 84;
	const arrowLen = $derived((h / H0) * 150);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="32 × 32 spins"
		value="kT = {T.toFixed(2)} J ({ordered ? 'below' : 'above'} T꜀)"
	>
		<Label
			anchor="start"
			x={LX}
			y={34}
			text="32 × 32 spins at kT = {T.toFixed(2)} J, {ordered ? 'below' : 'above'} T꜀"
			size={15}
			weight={600}
		/>
	</Readout>
	<!-- the field -->
	<line x1={AX - 160} x2={AX + 160} y1={AY} y2={AY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={AX} x2={AX} y1={AY - 8} y2={AY + 8} stroke="var(--stage-line)" stroke-width="1.5" />
	{#if Math.abs(arrowLen) > 2}
		<path
			d="M{AX} {AY}H{AX + arrowLen}"
			stroke="var(--im-field)"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<path
			d="M{AX + arrowLen + Math.sign(arrowLen) * 10} {AY}l{-Math.sign(arrowLen) * 12} -8v16z"
			fill="var(--im-field)"
		/>
	{/if}
	<Label x={AX - 166} y={AY + 4} text="−" size={14} anchor="end" muted />
	<Label anchor="start" x={AX + 166} y={AY + 4} text="+" size={14} muted />
	<Readout id="h" order={2} label="Field h" value="{signed(h)} J">
		<Label
			x={AX}
			y={AY + 28}
			text="field h = {signed(h)} J"
			size={13}
			anchor="middle"
			tabular
			weight={600}
		/>
	</Readout>

	<rect
		x={LX}
		y={LY}
		width={LS}
		height={LS}
		fill="var(--im-down)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={ups} fill="var(--im-up)" />
	<Readout id="key" order={4} label="up (+1) orange, down (−1) blue">
		<rect x={LX} y={LY + LS + 16} width="14" height="14" rx="3" fill="var(--im-up)" />
		<Label anchor="start" x={LX + 20} y={LY + LS + 27} text="up" size={12} halo={false} />
		<rect x={LX + 70} y={LY + LS + 16} width="14" height="14" rx="3" fill="var(--im-down)" />
		<Label anchor="start" x={LX + 90} y={LY + LS + 27} text="down" size={12} halo={false} />
		<Label
			x={LX + LS}
			y={LY + LS + 27}
			text="sweep {current.k.toLocaleString('en-US')}"
			size={12}
			anchor="end"
			muted
			tabular
			halo={false}
		/>
	</Readout>

	<!-- the loop -->
	<Label anchor="start" x={612} y={72} text="magnetisation against field" size={13} weight={600} />
	<Axes
		{sx}
		{sy}
		xLabel="h / J"
		yLabel="m"
		xTicks={[-1.5, -1, -0.5, 0, 0.5, 1, 1.5]}
		yTicks={[-1, -0.5, 0, 0.5, 1]}
		xFormat={(v: number) => signed(v, 1).replace('+0.0', '0')}
		yFormat={(v: number) => signed(v, 1).replace('+0.0', '0')}
	/>
	<line x1={sx(0)} x2={sx(0)} y1={110} y2={510} stroke="var(--stage-line)" stroke-width="1" />
	<line x1={612} x2={916} y1={sy(0)} y2={sy(0)} stroke="var(--stage-line)" stroke-width="1" />
	<path d={paths.before} fill="none" stroke="var(--im-loop)" stroke-width="1.5" opacity="0.35" />
	<path d={paths.now} fill="none" stroke="var(--im-loop)" stroke-width="2.4" />
	<circle
		cx={sx(h)}
		cy={sy(m)}
		r="6"
		fill="var(--im-field)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout id="m" order={3} label="Magnetisation m" value={signed(m)}>
		<Label x={916} y={72} text="m = {signed(m)}" size={14} anchor="end" tabular weight={600} />
	</Readout>
	<Readout id="note" label={ordered ? 'Below T꜀: an open loop' : 'Above T꜀: the loop closes'}>
		<Label
			x={764}
			y={560}
			text={ordered
				? 'below T꜀: at h = 0 the lattice remembers its last push'
				: 'above T꜀: m follows h, with only a little lag'}
			size={12}
			anchor="middle"
			italic
			muted
		/>
	</Readout>
</g>
