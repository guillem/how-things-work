<script lang="ts">
	/**
	 * NGC 3198 seen face-on, its stars and gas clouds orbiting the centre
	 * (steps galaxy, expect). On `galaxy` one disc turns at the measured speeds;
	 * on `expect` it moves right and a twin on the left turns at the speeds the
	 * visible matter alone would give (SPARC mass model, Υ = 0.5).
	 *
	 * Every body's angle is θ₀ + ω(r)·t with ω = v(r)/r, a pure function of t,
	 * at YEARS_PER_S of galactic time per second of animation. Three tracer
	 * stars start on one line at t = 0 and leave a trail, so the reader can see
	 * the outer ones fall behind on the left and keep pace on the right. The
	 * layout change between the two steps is a Tween.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GYR_S, KPC_KM, galaxy, periodGyr, speedAt } from '../galaxies';
	import { rng } from '#lib/draw/math.ts';
	import { Label } from '#lib/draw/index.ts';

	let { step, t, reduced }: StageProps = $props();

	const g = galaxy('NGC3198');
	const R_KPC = g.rLast; // disc drawn out to the last measured point
	const MYR_PER_S = 40;
	const RD = 3.14; // SPARC's disc scale length for NGC 3198, kpc

	/** Angular speed, radians per second of animation. */
	const omega = (r: number, which: 'measured' | 'visible') =>
		((speedAt(g, r, which) / (Math.max(r, 0.05) * KPC_KM)) * GYR_S * MYR_PER_S) / 1000;

	interface Body {
		id: number;
		r: number;
		th0: number;
		gas: boolean;
		size: number;
		wm: number;
		wv: number;
	}
	// Deterministic disc: stars from an exponential disc (radius ~ Gamma(2) × Rd),
	// gas clouds spread out to the last measured radius, both on two log-spiral arms.
	const bodies: Body[] = (() => {
		const rand = rng(3198);
		const out: Body[] = [];
		for (let i = 0; i < 120; i++) {
			const gas = i >= 80;
			const r = gas
				? 6 + rand() * (R_KPC - 7)
				: Math.min(30, -RD * Math.log(Math.max(1e-6, rand() * rand())) + 0.3);
			const arm = rand() < 0.5 ? 0 : Math.PI;
			const th0 = arm + 1.9 * Math.log(r) + (rand() - 0.5) * (gas ? 0.9 : 1.1);
			out.push({
				id: i,
				r,
				th0,
				gas,
				size: gas ? 2.2 + rand() * 1.4 : 1.2 + rand() * 1.6,
				wm: omega(r, 'measured'),
				wv: omega(r, 'visible')
			});
		}
		return out;
	})();

	const TRACERS = [8, 22, R_KPC].map((r, i) => ({
		id: i,
		r,
		wm: omega(r, 'measured'),
		wv: omega(r, 'visible'),
		vm: speedAt(g, r, 'measured'),
		vv: speedAt(g, r, 'visible')
	}));
	const outer = TRACERS[2];

	const split = new Tween(0, { duration: 900, easing: cubicInOut });
	const expect = $derived(step.hints?.phase === 'expect');
	$effect(() => {
		const v = expect ? 1 : 0;
		untrack(() => split.set(v, { duration: reduced ? 0 : 900 }));
	});

	const tt = $derived(reduced ? 2.5 : t);
	const s = $derived(split.current);
	// Measured disc: centred and big, then on the right; visible-only twin on the left.
	const meas = $derived({ cx: 480 + 230 * s, cy: 318 + 10 * s, R: 236 - 50 * s });
	const vis = $derived({ cx: 250, cy: 328, R: 186, o: s });
	const k = (R: number) => R / R_KPC;

	const trail = (cx: number, cy: number, rp: number, swept: number) => {
		const a = Math.min(swept, Math.PI * 2 - 0.05);
		const n = Math.max(2, Math.ceil(a / 0.12));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const th = -(a * i) / n;
			d += `${i ? 'L' : 'M'}${(cx + rp * Math.cos(th)).toFixed(1)} ${(cy + rp * Math.sin(th)).toFixed(1)}`;
		}
		return d;
	};
	const elapsed = $derived(tt * MYR_PER_S);
	const fmtMyr = (m: number) =>
		m < 1000
			? `${Math.round(m / 10) * 10} million years`
			: `${(m / 1000).toFixed(2)} billion years`;
	const TRACER_COLORS = ['var(--dm-stars)', 'var(--dm-model)', 'var(--dm-halo)'];
</script>

{#snippet disc(cx: number, cy: number, R: number, which: 'measured' | 'visible', o: number)}
	<g opacity={o}>
		<circle {cx} {cy} r={R + 8} fill="url(#galaxy-glow)" />
		<circle {cx} {cy} r={R} fill="none" stroke="var(--stage-line)" stroke-dasharray="3 5" />
		{#each bodies as b (b.id)}
			{@const th = b.th0 - (which === 'measured' ? b.wm : b.wv) * tt}
			<circle
				cx={cx + b.r * k(R) * Math.cos(th)}
				cy={cy + b.r * k(R) * Math.sin(th)}
				r={b.size}
				fill={b.gas ? 'var(--dm-gas)' : 'var(--dm-galaxies)'}
				opacity={b.gas ? 0.55 : 0.85}
			/>
		{/each}
		<circle {cx} {cy} r={9} fill="var(--dm-galaxies)" opacity="0.9" />
		<line
			x1={cx}
			y1={cy}
			x2={cx + R + 6}
			y2={cy}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="2 3"
		/>
		{#each TRACERS as tr (tr.id)}
			{@const w = which === 'measured' ? tr.wm : tr.wv}
			{@const rp = tr.r * k(R)}
			{@const th = -w * tt}
			<path
				d={trail(cx, cy, rp, w * tt)}
				fill="none"
				stroke={TRACER_COLORS[tr.id]}
				stroke-width="2.5"
				stroke-linecap="round"
				opacity="0.6"
			/>
			<circle
				cx={cx + rp * Math.cos(th)}
				cy={cy + rp * Math.sin(th)}
				r="5.5"
				fill={TRACER_COLORS[tr.id]}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
	</g>
{/snippet}

<g>
	<defs>
		<radialGradient id="galaxy-glow">
			<stop offset="0" stop-color="var(--dm-galaxies)" stop-opacity="0.32" />
			<stop offset="0.35" stop-color="var(--dm-galaxies)" stop-opacity="0.1" />
			<stop offset="1" stop-color="var(--dm-gas)" stop-opacity="0.04" />
		</radialGradient>
	</defs>

	{#if s > 0.02}
		{@render disc(vis.cx, vis.cy, vis.R, 'visible', vis.o)}
	{/if}
	{@render disc(meas.cx, meas.cy, meas.R, 'measured', 1)}

	<Readout
		id="title"
		order={1}
		label="NGC 3198"
		value="seen face-on, {fmtMyr(elapsed)} after the start"
	>
		<Label anchor="start" x={24} y={38} text="NGC 3198, seen face-on" size={16} weight={700} />
		<Label
			anchor="start"
			x={24}
			y={58}
			text="{fmtMyr(elapsed)} after the start · 1 s ≈ {MYR_PER_S} million years"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="key-stars">
		<circle cx={30} cy={572} r="4" fill="var(--dm-galaxies)" />
		<Label anchor="start" x={40} y={576} text="stars" size={12} muted />
		<circle cx={92} cy={572} r="4" fill="var(--dm-gas)" opacity="0.7" />
		<Label anchor="start" x={102} y={576} text="hydrogen gas" size={12} muted />
		<line
			x1={210}
			x2={210 + 10 * k(meas.R)}
			y1={572}
			y2={572}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Label
			anchor="start"
			x={216 + 10 * k(meas.R)}
			y={576}
			text="10 kpc (33,000 light years)"
			size={12}
			muted
		/>
	</Readout>

	{#if s > 0.02}
		<g opacity={s}>
			<Readout
				id="vis-head"
				order={2}
				label="Left: visible matter only"
				value="outer star {outer.vv.toFixed(0)} km/s, one turn in {periodGyr(
					outer.r,
					outer.vv
				).toFixed(1)} billion years"
				color="var(--dm-visible)"
			>
				<Label
					x={vis.cx}
					y={110}
					text="If only the visible matter pulled"
					size={14}
					weight={700}
					anchor="middle"
					color="var(--dm-visible)"
				/>
				<Label
					x={vis.cx}
					y={548}
					text="edge: {outer.vv.toFixed(0)} km/s · one turn in {periodGyr(
						outer.r,
						outer.vv
					).toFixed(1)} billion years"
					size={12}
					anchor="middle"
				/>
			</Readout>
			<Readout
				id="meas-head"
				order={3}
				label="Right: measured"
				value="outer star {outer.vm.toFixed(0)} km/s, one turn in {periodGyr(
					outer.r,
					outer.vm
				).toFixed(1)} billion years"
				color="var(--dm-model)"
			>
				<Label
					x={meas.cx}
					y={110}
					text="As measured"
					size={14}
					weight={700}
					anchor="middle"
					color="var(--dm-model)"
				/>
				<Label
					x={meas.cx}
					y={548}
					text="edge: {outer.vm.toFixed(0)} km/s · one turn in {periodGyr(
						outer.r,
						outer.vm
					).toFixed(1)} billion years"
					size={12}
					anchor="middle"
				/>
			</Readout>
		</g>
	{:else}
		<Readout
			id="tracers"
			order={2}
			label="Coloured stars"
			value="start on one line at 8, 22 and 44 kpc"
		>
			<Label
				x={936}
				y={38}
				text="three stars start on the dotted line,"
				size={12}
				anchor="end"
				muted
			/>
			<Label x={936} y={56} text="8, 22 and 44 kpc from the centre" size={12} anchor="end" muted />
		</Readout>
	{/if}
</g>
