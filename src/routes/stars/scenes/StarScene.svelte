<script lang="ts">
	/**
	 * The Sun as a ball of gas in balance, and the fusion in its core.
	 *
	 * Phases (`step.hints.phase`):
	 *   balance — a cross-section of the Sun: gravity arrows pointing in, pressure arrows
	 *             pointing out, the hot core, light leaving the surface; the model Sun's
	 *             numbers (MIST, 1 M☉ at 4.57 billion years) in a card
	 *   fusion  — the Sun moves aside and its core opens into the proton–proton chain, one
	 *             reaction at a time: p + p → ²H + e⁺ + ν, ²H + p → ³He + γ,
	 *             ³He + ³He → ⁴He + 2p; the bottom line sums it up (0.7% of the mass → energy)
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Photon, TAU, clamp, colors, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';
	import { C, FUSION_MASS_FRACTION, L_SUN, SUN_AGE, atAge, starColour, track } from '../star';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'balance'));
	const fusion = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const f = phase === 'fusion' ? 1 : 0;
		untrack(() => fusion.set(f, { duration: reduced ? 0 : 800 }));
	});
	const u = $derived(fusion.current);

	const sun = atAge(track(1), SUN_AGE);
	const surface = starColour(sun.T);
	const tonnes = L_SUN / C ** 2 / 1000; // 4.26 million t/s
	/** The model Sun's centre: about 16 million K and 160 g/cm³. */
	const coreMK = Math.round(sun.Tc / 1e6);
	const coreRho = Math.round(sun.rhoc / 10) * 10;

	const cx = $derived(lerp(300, 170, u));
	const cy = 300;
	const R = $derived(lerp(220, 120, u));
	const coreR = $derived(R * 0.25);

	// ---- balance: arrows and light -------------------------------------------------------
	const ARROWS = Array.from({ length: 8 }, (_, k) => (k * TAU) / 8 - TAU / 16);
	const breathe = $derived(reduced ? 0 : Math.sin((TAU * t) / 3.2) * 0.03);
	function arrow(a: number, r0: number, r1: number) {
		return {
			x1: cx + r0 * R * Math.cos(a),
			y1: cy + r0 * R * Math.sin(a),
			x2: cx + r1 * R * Math.cos(a),
			y2: cy + r1 * R * Math.sin(a)
		};
	}
	const PHOTONS = Array.from({ length: 10 }, (_, k) => ({
		a: ((k * 137.5) % 360) * (Math.PI / 180),
		off: (k * 0.37) % 1
	}));

	// ---- fusion: the pp chain ----------------------------------------------------------------
	type Nucleon = 'p' | 'n';
	const SHAPES: Record<number, [number, number][]> = {
		1: [[0, 0]],
		2: [
			[-7, 0],
			[7, 0]
		],
		3: [
			[-7, 5],
			[7, 5],
			[0, -7]
		],
		4: [
			[-7, -7],
			[7, -7],
			[-7, 7],
			[7, 7]
		]
	};
	interface Nucleus {
		parts: Nucleon[];
		name: string;
	}
	const P: Nucleus = { parts: ['p'], name: '¹H' };
	const D: Nucleus = { parts: ['p', 'n'], name: '²H' };
	const HE3: Nucleus = { parts: ['p', 'p', 'n'], name: '³He' };
	const HE4: Nucleus = { parts: ['p', 'n', 'n', 'p'], name: '⁴He' };
	interface Reaction {
		inputs: Nucleus[];
		outputs: Nucleus[];
		extras: ('e+' | 'nu' | 'gamma')[];
		text: string;
	}
	const REACTIONS: Reaction[] = [
		{
			inputs: [P, P],
			outputs: [D],
			extras: ['e+', 'nu'],
			text: 'two protons: one turns into a neutron'
		},
		{ inputs: [D, P], outputs: [HE3], extras: ['gamma'], text: 'deuterium catches a proton' },
		{
			inputs: [HE3, HE3],
			outputs: [HE4, P, P],
			extras: [],
			text: 'two helium-3 make helium-4 and two free protons'
		}
	];
	const PANEL = { x: 340, y: 44, w: 600, h: 500 };
	const rowY = (k: number) => PANEL.y + 96 + k * 128;
	const PERIOD = 3.6;
	const active = $derived(reduced ? -1 : Math.floor(cycle(t, PERIOD * 3) * 3));
	const local = $derived(reduced ? 1 : cycle(t, PERIOD));
	/** Reactants slide together, flash, and the products appear. */
	const merge = $derived(smoothstep(0.05, 0.4, local));
	const flash = $derived(smoothstep(0.38, 0.45, local) * (1 - smoothstep(0.45, 0.62, local)));
	const fly = $derived(smoothstep(0.45, 0.95, local));
	const panelOpacity = $derived(smoothstep(0.35, 1, u));

	const IN_X = PANEL.x + 70;
	const ARROW_X = PANEL.x + 290;
	const OUT_X = PANEL.x + 360;
</script>

{#snippet nucleus(n: Nucleus, x: number, y: number, s = 1)}
	{@const shape = SHAPES[n.parts.length]}
	<g transform="translate({x} {y}) scale({s})">
		{#each n.parts as part, i (i)}
			<circle
				cx={shape[i][0]}
				cy={shape[i][1]}
				r="8.5"
				fill={part === 'p' ? colors.proton : '#a7b0bb'}
				stroke={part === 'p' ? colors.protonEdge : '#5f6b78'}
				stroke-width="1"
			/>
		{/each}
	</g>
{/snippet}

<g>
	<defs>
		<radialGradient id="star-sun-grad" cx="50%" cy="50%" r="50%">
			<stop offset="0%" stop-color="#fffdf2" />
			<stop offset="25%" stop-color="#fff1b8" />
			<stop offset="70%" stop-color="#ffd27a" />
			<stop offset="100%" stop-color={surface} />
		</radialGradient>
	</defs>

	<!-- light leaving the surface -->
	{#each PHOTONS as ph, k (k)}
		{@const p = reduced ? 0.5 : cycle(t, 2.6, ph.off)}
		{@const r = R + 12 + p * 70}
		<Photon
			x={cx + r * Math.cos(ph.a)}
			y={cy + r * Math.sin(ph.a)}
			angle={(ph.a * 180) / Math.PI}
			length={30}
			opacity={(1 - u) * smoothstep(0, 0.15, p) * (1 - smoothstep(0.75, 1, p))}
			phase={p}
		/>
	{/each}

	<!-- the Sun -->
	<circle {cx} {cy} r={R + 6} fill="#ffb347" opacity="0.18" />
	<circle {cx} {cy} r={R} fill="url(#star-sun-grad)" />
	<circle
		{cx}
		{cy}
		r={coreR}
		fill="none"
		stroke="#b8540c"
		stroke-width="1.5"
		stroke-dasharray="5 4"
		opacity="0.8"
	/>

	<!-- balance: gravity in, pressure out -->
	{#if u < 0.99}
		<g opacity={1 - u}>
			{#each ARROWS as a, k (k)}
				{@const g = arrow(a, 0.92, 0.62 - breathe)}
				{@const pr = arrow(a + TAU / 16, 0.36, 0.66 + breathe)}
				<line
					{...g}
					stroke="var(--st-gravity)"
					stroke-width="3"
					stroke-linecap="round"
					marker-end="url(#arrowhead)"
				/>
				<line
					{...pr}
					stroke="var(--st-pressure)"
					stroke-width="3"
					stroke-linecap="round"
					marker-end="url(#arrowhead)"
				/>
			{/each}
			<Readout
				id="core"
				order={3}
				label="Core"
				value="{coreMK} million K, {coreRho} × the density of water"
			>
				<Txt x={cx} y={cy - 4} text="core" size={14} weight={700} color="#7a3a06" />
				<Txt x={cx} y={cy + 14} text="{coreMK} million K" size={12} color="#7a3a06" />
			</Readout>

			<rect
				x="600"
				y="110"
				width="330"
				height="300"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Txt x={620} y={146} text="The Sun today (model)" size={16} weight={700} anchor="start" />
			<line
				x1="624"
				y1="178"
				x2="664"
				y2="178"
				stroke="var(--st-gravity)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
			<Readout
				id="gravity"
				order={1}
				label="Gravity"
				value="pulls every part inwards"
				color="var(--st-gravity)"
			>
				<Txt x={676} y={183} text="gravity pulls inwards" anchor="start" />
			</Readout>
			<line
				x1="624"
				y1="210"
				x2="664"
				y2="210"
				stroke="var(--st-pressure)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
			<Readout
				id="pressure"
				order={2}
				label="Pressure"
				value="of the hot gas pushes outwards"
				color="var(--st-pressure)"
			>
				<Txt x={676} y={215} text="pressure pushes outwards" anchor="start" />
			</Readout>
			<Readout id="centre" order={4}>
				<Txt x={620} y={256} text="centre: {coreMK} million K," anchor="start" />
				<Txt
					x={620}
					y={276}
					text="{coreRho} g/cm³ ({coreRho} × water)"
					anchor="start"
					muted
					size={12}
				/>
			</Readout>
			<Readout id="surface">
				<Txt
					x={620}
					y={312}
					text="surface: {(Math.round(sun.T / 10) * 10).toLocaleString('en-US')} K"
					anchor="start"
				/>
			</Readout>
			<Readout
				id="light"
				order={6}
				label="Surface (model) · light (real Sun)"
				value="{(Math.round(sun.T / 10) * 10).toLocaleString('en-US')} K · 3.8 × 10²⁶ W"
			>
				<Txt x={620} y={348} text="light: 3.8 × 10²⁶ W (real Sun)" anchor="start" />
				<Txt
					x={620}
					y={368}
					text="mostly hydrogen and helium plasma"
					anchor="start"
					muted
					size={12}
				/>
			</Readout>
		</g>
	{/if}

	<!-- fusion: the zoom lines and the pp chain -->
	{#if u > 0.01}
		<g opacity={panelOpacity}>
			<line
				x1={cx + coreR * 0.7}
				y1={cy - coreR * 0.7}
				x2={PANEL.x}
				y2={PANEL.y}
				stroke="var(--stage-line)"
				stroke-dasharray="4 4"
			/>
			<line
				x1={cx + coreR * 0.7}
				y1={cy + coreR * 0.7}
				x2={PANEL.x}
				y2={PANEL.y + PANEL.h}
				stroke="var(--stage-line)"
				stroke-dasharray="4 4"
			/>
			<Txt x={cx} y={cy + R + 28} text="the Sun's core" size={13} weight={600} />
			<rect
				x={PANEL.x}
				y={PANEL.y}
				width={PANEL.w}
				height={PANEL.h}
				rx="14"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Txt
				x={PANEL.x + 24}
				y={PANEL.y + 34}
				text="The proton–proton chain"
				size={16}
				weight={700}
				anchor="start"
			/>
			{#each REACTIONS as r, k (k)}
				{@const y = rowY(k)}
				{@const on = active === k}
				{@const m = on ? merge : 1}
				{@const show = on ? fly : 1}
				{#if on}
					<rect
						x={PANEL.x + 12}
						y={y - 46}
						width={PANEL.w - 24}
						height="96"
						rx="10"
						fill="var(--st-burn)"
						opacity="0.08"
					/>
				{/if}
				<!-- inputs, sliding towards the arrow while the reaction runs -->
				{#each r.inputs as n, i (i)}
					{@const x0 = IN_X + i * 90}
					{@const x = on ? lerp(x0, ARROW_X - 40, m) : x0}
					{@const fade = on ? 1 - smoothstep(0.4, 0.5, local) * 0.75 : 1}
					<g opacity={fade}>
						{@render nucleus(n, x, y - 4)}
					</g>
					{#if !on || local < 0.4}
						<Txt x={x0} y={y + 30} text={n.name} size={12} muted />
					{/if}
					{#if i < r.inputs.length - 1 && (!on || local < 0.08)}
						<Txt x={x0 + 45} y={y + 1} text="+" size={15} muted />
					{/if}
				{/each}
				<line
					x1={ARROW_X - 10}
					y1={y - 4}
					x2={ARROW_X + 40}
					y2={y - 4}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
				{#if on && flash > 0.01}
					<circle cx={ARROW_X + 14} cy={y - 4} r={10 + 22 * flash} fill="#fff3bf" opacity={flash} />
				{/if}
				<!-- outputs -->
				<g opacity={show}>
					{#each r.outputs as n, i (i)}
						{@const x = OUT_X + 30 + i * 70}
						{@render nucleus(n, x, y - 4)}
						<Txt {x} y={y + 30} text={n.name} size={12} muted />
					{/each}
					{#each r.extras as e, i (i)}
						{@const ex = OUT_X + 120 + i * 70 + (on ? 18 * fly : 18)}
						{#if e === 'gamma'}
							<Photon x={ex - 20} y={y - 6} length={34} phase={on ? local : 0} />
							<Txt x={ex} y={y + 30} text="γ (gamma ray)" size={12} muted />
						{:else if e === 'e+'}
							<circle
								cx={ex}
								cy={y - 4}
								r="5"
								fill={colors.electron}
								stroke={colors.electronEdge}
							/>
							<Txt x={ex} y={y + 30} text="e⁺" size={12} muted />
						{:else}
							<circle cx={ex} cy={y - 4} r="3" fill="var(--stage-ink-muted)" />
							<Txt x={ex} y={y + 30} text="ν (neutrino)" size={12} muted />
						{/if}
					{/each}
				</g>
				<Txt
					x={PANEL.x + 24}
					y={y - 32}
					text="{k + 1}. {r.text}"
					size={12}
					anchor="start"
					muted={!on}
					weight={on ? 600 : 500}
				/>
				{#if k === 2}
					<Txt
						x={PANEL.x + PANEL.w - 24}
						y={y - 32}
						text="(steps 1 and 2 happen twice first)"
						size={11}
						anchor="end"
						muted
					/>
				{/if}
			{/each}
			<line
				x1={PANEL.x + 20}
				y1={PANEL.y + 432}
				x2={PANEL.x + PANEL.w - 20}
				y2={PANEL.y + 432}
				stroke="var(--border)"
			/>
			<Readout id="sum" order={1} label="Overall" value="4 ¹H → ⁴He + 2 e⁺ + 2 ν + energy">
				<Txt
					x={PANEL.x + 24}
					y={PANEL.y + 458}
					text="overall: 4 ¹H → ⁴He + 2 e⁺ + 2 ν + energy"
					anchor="start"
					weight={600}
				/>
			</Readout>
			<Readout
				id="mass"
				order={2}
				label="Mass turned into energy"
				value="{(FUSION_MASS_FRACTION * 100).toFixed(1)}%: {(tonnes / 1e6).toFixed(
					1
				)} million tonnes a second in the Sun"
			>
				<Txt
					x={PANEL.x + 24}
					y={PANEL.y + 482}
					text="{(FUSION_MASS_FRACTION * 100).toFixed(1)}% of the mass becomes energy: {(
						tonnes / 1e6
					).toFixed(1)} million tonnes a second in the Sun"
					anchor="start"
					size={12}
					muted
				/>
			</Readout>
			{#if clamp(u) > 0}
				<Txt x={cx} y={cy + 5} text="H → He" size={12} weight={700} color="#7a3a06" />
			{/if}
		</g>
	{/if}
</g>
