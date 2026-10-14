<script lang="ts">
	/**
	 * Step "rotor": ATP synthase close up. The outline is the cow's enzyme
	 * traced from PDB 6ZPO (shared with the-cell, read only), turned so that
	 * the matrix is on top as in the chain scene. Drawn over it: the c-ring's
	 * subunits seen from the side, turning one subunit per proton; a proton
	 * that enters from the intermembrane space through the stator's lower
	 * half-channel, rides the ring once round and leaves into the matrix; the
	 * crooked shaft. On the right, the head seen from above: three catalytic
	 * β sites cycling open → loose → tight as the shaft turns, one ATP per
	 * third of a turn. `params.ring` picks the ring size (subunits = protons
	 * per turn); the outline stays the cow's.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Molecule, Label, colors, smoothstep, lerp, polar, TAU } from '#lib/draw/index.ts';
	import { MACHINES } from '../../the-cell/shapes';
	import { CHAIN } from '../colors';
	import { C_RINGS, hPerATP, synthaseHPerATP } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const ringId = $derived(String(params.ring ?? 'cow'));
	const C = $derived(C_RINGS.find((r) => r.id === ringId)?.c ?? 8);

	// ---- the outline ------------------------------------------------------------
	const shape = MACHINES.atpSynthase;
	const S = 20; // px per nm
	const OX = 372; // x of the structure's centre
	const OY = 470; // y of the membrane centre
	const sx = (nm: number) => OX + nm * S;
	const sy = (nm: number) => OY - nm * S;
	const group = (name: string) => shape.groups.find((g) => g.name === name)?.d ?? '';
	const MEM = { top: sy(2.1), bottom: sy(-2.1) };
	const RING = { x0: sx(-3.4), x1: sx(2.2), top: sy(1.7), bottom: sy(-1.7) };
	const RING_CX = (RING.x0 + RING.x1) / 2;
	const RING_R = (RING.x1 - RING.x0) / 2 - 4;

	// ---- the clock: one proton per second, one subunit step each ----------------
	const PROTON_S = 0.9;
	/** Protons through since the step started (fractional). */
	const n = $derived(t / PROTON_S);
	/** Rotor angle (radians): 1/C of a turn per proton. */
	const theta = $derived((n / C) * TAU);
	const protonsDone = $derived(Math.floor(n));
	const atpDone = $derived(Math.floor((protonsDone * 3) / C));
	const turns = $derived(n / C);

	/**
	 * Every c-subunit carries a proton on its glutamate except where it faces
	 * the stator (left edge): there one proton leaves into the matrix through
	 * the upper half-channel and the next arrives from below, once per step.
	 */
	const stepU = $derived(n % 1);
	const ENTRY = { x: RING.x0 + 4, lo: sy(-0.7), hi: sy(0.7) };
	const inLane = (v: number) => ({
		x: lerp(ENTRY.x - 30, ENTRY.x, v),
		y: lerp(sy(-4.4), ENTRY.lo, v)
	});
	const outLane = (v: number) => ({
		x: lerp(ENTRY.x, ENTRY.x - 30, v),
		y: lerp(ENTRY.hi, sy(4.4), v)
	});
	/** Angular distance of a subunit from the stator interface (at angle −π/2). */
	const fromStator = (a: number) => {
		const d = (((a + Math.PI / 2) % TAU) + TAU) % TAU;
		return Math.min(d, TAU - d);
	};
	const subunits = $derived(Array.from({ length: C }, (_, i) => i));

	// ---- the head from above ------------------------------------------------------
	const TOP = { x: 742, y: 214, r: 104 };
	const STATES = ['open', 'loose', 'tight'] as const;
	type SiteState = (typeof STATES)[number];
	/** Third of a turn the shaft is in, and how far through it. */
	const third = $derived(Math.floor((theta / TAU) * 3));
	const thirdU = $derived(((theta / TAU) * 3) % 1);
	const sites = $derived(
		[0, 1, 2].map((k) => {
			const state: SiteState = STATES[(((third + k) % 3) + 3) % 3];
			const a = (k / 3) * TAU - Math.PI / 2;
			return { k, state, p: polar(TOP.x, TOP.y, 58, a), a };
		})
	);
	const siteColor = (s: SiteState) =>
		s === 'tight' ? colors.atp : s === 'loose' ? colors.adp : 'var(--protein)';

	const cam = $derived(polar(TOP.x, TOP.y, 14, theta - Math.PI / 2));
	/** The real motor turns about 100 times a second (Watt et al. 2010). */
	const slower = $derived(Math.round((100 * C * PROTON_S) / 100) * 100);
	const hAtp = $derived(synthaseHPerATP(C));
	const fmt = (v: number) =>
		Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);
	const releaseFade = $derived(
		reduced ? 1 : smoothstep(0, 0.25, thirdU) * (1 - smoothstep(0.75, 1, thirdU))
	);
</script>

{#snippet lane(p: { x: number; y: number }, opacity: number)}
	<Molecule kind="proton" x={p.x} y={p.y} {opacity} glow scale={1.1} />
{/snippet}

<g class="synthase-scene">
	<!-- compartments -->
	<rect x="0" y="0" width="960" height={MEM.top} fill="var(--ra-matrix)" />
	<rect x="0" y={MEM.bottom} width="960" height={600 - MEM.bottom} fill="var(--ra-ims)" />
	<rect
		x="0"
		y={MEM.top}
		width="960"
		height={MEM.bottom - MEM.top}
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
	/>
	<Readout id="m">
		<Label x={24} y={36} text="matrix" anchor="start" muted />
		<Label x={24} y={MEM.top + 26} text="inner membrane" anchor="start" size={11} muted />
		<Label x={24} y={584} text="intermembrane space" anchor="start" size={11} muted />
	</Readout>

	<!-- the traced outline (flipped: matrix up) -->
	<g transform="translate({OX} {OY}) scale({S} {-S})">
		<path
			d={group('base')}
			fill="var(--protein)"
			stroke="var(--protein-edge)"
			stroke-width="1.2"
			vector-effect="non-scaling-stroke"
		/>
		<path
			d={group('stalk')}
			fill="var(--protein)"
			stroke="var(--protein-edge)"
			stroke-width="1.2"
			vector-effect="non-scaling-stroke"
		/>
		<path
			d={group('head')}
			fill={CHAIN.synthase}
			stroke="color-mix(in srgb, {CHAIN.synthase} 62%, #000)"
			stroke-width="1.2"
			vector-effect="non-scaling-stroke"
			opacity="0.92"
		/>
		<path
			d={group('ring')}
			fill="color-mix(in srgb, {CHAIN.synthase} 70%, #000)"
			stroke="color-mix(in srgb, {CHAIN.synthase} 45%, #000)"
			stroke-width="1.2"
			vector-effect="non-scaling-stroke"
		/>
	</g>

	<!-- back half of the ring's subunits, then the tracked proton when behind, then the front half -->
	{#each subunits as i (i)}
		{@const a = (i / C) * TAU + theta}
		{#if Math.cos(a) <= 0}
			<line
				x1={RING_CX + RING_R * Math.sin(a)}
				y1={RING.top + 6}
				x2={RING_CX + RING_R * Math.sin(a)}
				y2={RING.bottom - 6}
				stroke="#fff"
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.18"
			/>
		{/if}
	{/each}
	{#each subunits as i (i)}
		{@const a = (i / C) * TAU + theta}
		{#if Math.cos(a) <= 0 && fromStator(a) > TAU / C / 2}
			<Molecule
				kind="proton"
				x={RING_CX + RING_R * Math.sin(a)}
				y={OY}
				opacity={0.35}
				scale={0.9}
			/>
		{/if}
	{/each}
	{#each subunits as i (i)}
		{@const a = (i / C) * TAU + theta}
		{@const c = Math.cos(a)}
		{#if c > 0}
			<line
				x1={RING_CX + RING_R * Math.sin(a)}
				y1={RING.top + 4}
				x2={RING_CX + RING_R * Math.sin(a)}
				y2={RING.bottom - 4}
				stroke="#fff"
				stroke-width={i === 0 ? 4.5 : 3.5}
				stroke-linecap="round"
				opacity={0.3 + 0.6 * c}
			/>
		{/if}
	{/each}
	{#each subunits as i (i)}
		{@const a = (i / C) * TAU + theta}
		{#if Math.cos(a) > 0 && fromStator(a) > TAU / C / 2}
			<Molecule kind="proton" x={RING_CX + RING_R * Math.sin(a)} y={OY} glow />
		{/if}
	{/each}
	<!-- one in from the intermembrane space, one out into the matrix, per step -->
	{@render lane(inLane(stepU), smoothstep(0, 0.15, stepU) * (1 - smoothstep(0.9, 1, stepU)))}
	{@render lane(outLane(stepU), smoothstep(0, 0.1, stepU) * (1 - smoothstep(0.85, 1, stepU)))}
	<!-- half-channels in the stator (subunit a): in from below, out above -->
	<path
		d="M{RING.x0 - 26} {sy(-4.2)} L{RING.x0 + 2} {sy(-0.6)}"
		stroke={colors.proton}
		stroke-width="2"
		stroke-dasharray="3 3"
		opacity="0.8"
		marker-end="url(#arrowhead)"
	/>
	<path
		d="M{RING.x0 + 2} {sy(0.6)} L{RING.x0 - 26} {sy(4.2)}"
		stroke={colors.proton}
		stroke-width="2"
		stroke-dasharray="3 3"
		opacity="0.8"
		marker-end="url(#arrowhead)"
	/>

	<!-- the shaft (γ): its crooked tip swings inside the head as the ring turns -->
	<line
		x1={sx(-0.6)}
		y1={sy(2.6)}
		x2={sx(-0.6) + 26 * Math.sin(theta)}
		y2={sy(11)}
		stroke="color-mix(in srgb, {CHAIN.synthase} 45%, #000)"
		stroke-width="7"
		stroke-linecap="round"
		opacity={0.4 + 0.5 * (0.5 + 0.5 * Math.cos(theta))}
	/>

	<!-- part labels, left of the structure -->
	<Readout id="parts">
		<path
			d="M150 {sy(14) - 4} L{sx(-3.6)} {sy(14) - 4}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.6"
		/>
		<path
			d="M134 {sy(7) - 4} L{sx(-0.6) + 10} {sy(7) - 4}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.6"
		/>
		<Label x={24} y={sy(14)} text="head (F₁): 3 sites" anchor="start" weight={600} />
		<Label x={24} y={sy(14) + 16} text="makes ATP" anchor="start" size={11} muted />
		<Label x={24} y={sy(7)} text="shaft (γ) turns" anchor="start" weight={600} />
		<Label x={24} y={sy(7) + 16} text="with the ring" anchor="start" size={11} muted />
		<Label x={sx(2.9)} y={OY + 4} text="c-ring rotor" anchor="start" weight={600} />
		<Label x={sx(-8.6)} y={MEM.bottom + 48} text="stator (a): two half-channels" weight={600} />
		<Label
			x={sx(5.6)}
			y={sy(19.6)}
			text="side stalk holds the head still"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<!-- ================= the head seen from above ================= -->
	<circle cx={TOP.x} cy={TOP.y} r={TOP.r} fill="var(--surface)" stroke="var(--border)" />
	<Label x={TOP.x} y={TOP.y - TOP.r - 12} text="the head seen from above" size={12} weight={600} />
	{#each [0, 1, 2] as k (k)}
		{@const a = (k / 3) * TAU - Math.PI / 2 + Math.PI / 3}
		{@const p = polar(TOP.x, TOP.y, 58, a)}
		<circle
			cx={p.x}
			cy={p.y}
			r="24"
			fill="var(--protein)"
			stroke="var(--protein-edge)"
			opacity="0.6"
		/>
		<text x={p.x} y={p.y + 4} text-anchor="middle" font-size="11" class="muted">α</text>
	{/each}
	{#each sites as s (s.k)}
		<circle
			cx={s.p.x}
			cy={s.p.y}
			r="28"
			fill={siteColor(s.state)}
			stroke="var(--protein-edge)"
			stroke-width="1.2"
			opacity="0.9"
		/>
		<text
			x={s.p.x}
			y={s.p.y - 6}
			text-anchor="middle"
			font-size="11"
			font-weight="700"
			fill={s.state === 'open' ? 'var(--stage-ink)' : '#fff'}>β {s.state}</text
		>
		{#if s.state === 'loose'}
			<text
				x={s.p.x}
				y={s.p.y + 10}
				text-anchor="middle"
				font-size="9.5"
				font-weight="600"
				fill="#fff">ADP + Pᵢ</text
			>
		{:else if s.state === 'tight'}
			<text
				x={s.p.x}
				y={s.p.y + 10}
				text-anchor="middle"
				font-size="9.5"
				font-weight="600"
				fill="#fff">→ ATP</text
			>
		{:else}
			{@const out = polar(TOP.x, TOP.y, 58 + 52 * thirdU, s.a)}
			<Molecule kind="ATP" x={out.x} y={out.y + 12} scale={0.8} opacity={releaseFade} />
		{/if}
	{/each}
	<!-- γ seen from above: an off-centre cam that turns -->
	<circle cx={TOP.x} cy={TOP.y} r="16" fill="color-mix(in srgb, {CHAIN.synthase} 45%, #000)" />
	<circle cx={cam.x} cy={cam.y} r="8" fill="#fff" opacity="0.85" />

	{#if C !== 8}
		<Readout id="outline">
			<Label
				x={936}
				y={510}
				text="outline: the cow's enzyme (8); ring redrawn with {C} subunits"
				anchor="end"
				size={11}
				muted
			/>
		</Readout>
	{/if}
	<!-- ================= counters ================= -->
	<Readout id="card1">
		<rect
			x="544"
			y="358"
			width="392"
			height="128"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout id="ring" order={1} label="c-ring" value="{C} subunits: {C} H⁺ per turn, 3 ATP">
		<text x="562" y="384" font-size="12" class="muted">c-ring</text>
		<text x="918" y="384" font-size="13" font-weight="600" text-anchor="end"
			>{C} subunits: {C} H⁺ per turn → 3 ATP</text
		>
	</Readout>
	<Readout
		id="per"
		order={2}
		label="Protons per ATP"
		value="{fmt(hAtp)} at the synthase, ≈ {fmt(hPerATP(C))} with transport"
	>
		<text x="562" y="412" font-size="12" class="muted">protons per ATP</text>
		<text x="918" y="412" font-size="13" font-weight="600" text-anchor="end"
			>{fmt(hAtp)} (≈ {fmt(hPerATP(C))} with transport)</text
		>
	</Readout>
	<Readout id="count" order={3} label="So far" value="{protonsDone} H⁺ through → {atpDone} ATP">
		<text x="562" y="444" font-size="12" class="muted">so far</text>
		<text x="918" y="446" font-size="16" font-weight="700" text-anchor="end"
			>{protonsDone} H⁺ → {atpDone} ATP</text
		>
		<text x="918" y="472" font-size="11" class="muted" text-anchor="end"
			>{turns.toFixed(1)} turns · drawn ~{slower} times slower than life</text
		>
	</Readout>
</g>
