<script lang="ts">
	/**
	 * The carbon cycle as a cross-section, drawn to scale: every reservoir's
	 * area is proportional to the carbon it holds (AREA_PER_GTC) and every
	 * band's width to its flow (WIDTH_PER_GTCYR); flows thinner than
	 * MIN_WIDTH are drawn at that width, dashed. Rock is the only store not to
	 * scale (marked with a break).
	 *
	 * Views (step.hints.view): stores, fast, ocean, slow, human, budget, locked.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, along, cycle, smoothstep } from '#lib/draw/index.ts';
	import { AIR_2024, BUDGET, CUMULATIVE, FOSSIL_RESERVES, NATURAL, PRE } from '../data';
	import { today, totals } from '../carbon';
	import { band, gtc, heightFor, toScale, widthFor, widthOf } from './geometry';

	let { step, t, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'stores'));

	// ---- focus ----------------------------------------------------------------
	type Focus = {
		air: number;
		land: number;
		ocean: number;
		deep: number;
		fossil: number;
		rock: number;
		fast: number;
		gas: number;
		mix: number;
		slow: number;
		human: number;
		budget: number;
		loops: number;
		/** 0: the air of 1750; 1: the air of 2024. */
		now: number;
	};
	const FOCUS: Record<string, Focus> = {
		stores: {
			air: 1,
			land: 1,
			ocean: 1,
			deep: 1,
			fossil: 1,
			rock: 1,
			fast: 0,
			gas: 0,
			mix: 0,
			slow: 0,
			human: 0,
			budget: 0,
			loops: 0,
			now: 0
		},
		fast: {
			air: 1,
			land: 1,
			ocean: 1,
			deep: 0.45,
			fossil: 0.4,
			rock: 0.4,
			fast: 1,
			gas: 1,
			mix: 0,
			slow: 0,
			human: 0,
			budget: 0,
			loops: 0,
			now: 0
		},
		ocean: {
			air: 0.5,
			land: 0.45,
			ocean: 1,
			deep: 1,
			fossil: 0.4,
			rock: 0.4,
			fast: 0,
			gas: 0.5,
			mix: 1,
			slow: 0,
			human: 0,
			budget: 0,
			loops: 0,
			now: 0
		},
		slow: {
			air: 0.55,
			land: 0.5,
			ocean: 0.5,
			deep: 0.5,
			fossil: 1,
			rock: 1,
			fast: 0.2,
			gas: 0.2,
			mix: 0,
			slow: 1,
			human: 0,
			budget: 0,
			loops: 0,
			now: 0
		},
		human: {
			air: 1,
			land: 1,
			ocean: 0.55,
			deep: 0.45,
			fossil: 1,
			rock: 0.4,
			fast: 0.4,
			gas: 0.4,
			mix: 0,
			slow: 0.4,
			human: 1,
			budget: 0,
			loops: 0,
			now: 1
		},
		budget: {
			air: 1,
			land: 1,
			ocean: 1,
			deep: 0.6,
			fossil: 0.5,
			rock: 0.4,
			fast: 0.12,
			gas: 0,
			mix: 0,
			slow: 0,
			human: 1,
			budget: 1,
			loops: 0,
			now: 1
		},
		locked: {
			air: 1,
			land: 0.9,
			ocean: 0.9,
			deep: 0.8,
			fossil: 1,
			rock: 0.8,
			fast: 0.25,
			gas: 0.25,
			mix: 0,
			slow: 0.5,
			human: 0.8,
			budget: 0,
			loops: 1,
			now: 1
		}
	};
	const focus = new Tween(FOCUS.stores, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const f = FOCUS[view] ?? FOCUS.stores;
		const duration = reduced ? 0 : 800;
		untrack(() => focus.set(f, { duration }));
	});
	const o = $derived(focus.current);

	// ---- reservoirs (areas to scale) -----------------------------------------
	const AIR_H = 30;
	const airPre = widthFor(PRE.atmosphere, AIR_H);
	const airNow = widthFor(AIR_2024, AIR_H);
	const airW = $derived(airPre + (airNow - airPre) * o.now);
	const AIR = { cx: 480, y: 34 };

	const PLANTS = { x: 118, y: 228, h: 22, w: widthFor(PRE.plants, 22) };
	const SOILS = { x: 84, y: 254, h: 36, w: widthFor(PRE.soils, 36) };
	const FROST = { x: 250, y: 254, h: 36, w: widthFor(PRE.permafrost, 36) };
	const OCEAN_X = 478;
	const OCEAN_W = 460;
	const SURF = { y: 262, h: heightFor(PRE.surfaceOcean, OCEAN_W) };
	const DEEP = { y: 270, h: heightFor(PRE.deepOcean, OCEAN_W) };
	const SED = { y: 530, h: heightFor(PRE.seafloor, OCEAN_W) };
	const COAL = { x: 60, y: 400, h: 28, w: widthFor(PRE.coal, 28) };
	const OIL = { x: 140, y: 404, h: 20, w: widthFor(PRE.oil, 20) };
	const GAS = { x: 194, y: 406, h: 16, w: widthFor(PRE.gas, 16) };
	/** Fossil carbon burnt since 1750 (model / GCB), drawn as a ghost beside the reserves. */
	const burnt = totals(today()).burnt;
	const BURNT = { x: 262, y: 400, h: 28, w: widthFor(burnt, 28) };
	const ROCK_Y = 548;

	// ---- flows (widths to scale) ---------------------------------------------
	interface FlowDef {
		id: string;
		flux: number;
		points: { x: number; y: number }[];
		color: string;
		group: keyof Focus;
	}
	const FLOWS: FlowDef[] = [
		{
			id: 'gpp',
			flux: NATURAL.photosynthesis,
			points: [
				{ x: 300, y: 72 },
				{ x: 250, y: 140 },
				{ x: 168, y: 224 }
			],
			color: 'var(--cc-plants)',
			group: 'fast'
		},
		{
			id: 'resp',
			flux: NATURAL.respiration,
			points: [
				{ x: 234, y: 246 },
				{ x: 306, y: 160 },
				{ x: 362, y: 74 }
			],
			color: 'var(--cc-soil)',
			group: 'fast'
		},
		{
			id: 'in',
			flux: NATURAL.oceanIn,
			points: [
				{ x: 590, y: 80 },
				{ x: 602, y: 170 },
				{ x: 628, y: 258 }
			],
			color: 'var(--cc-ocean)',
			group: 'gas'
		},
		{
			id: 'out',
			flux: NATURAL.oceanOut,
			points: [
				{ x: 706, y: 258 },
				{ x: 694, y: 170 },
				{ x: 676, y: 80 }
			],
			color: 'var(--cc-ocean)',
			group: 'gas'
		},
		{
			id: 'down',
			flux: NATURAL.subduction,
			points: [
				{ x: 586, y: 272 },
				{ x: 590, y: 390 },
				{ x: 600, y: 508 }
			],
			color: 'var(--cc-surface-fill)',
			group: 'mix'
		},
		{
			id: 'up',
			flux: NATURAL.obduction,
			points: [
				{ x: 800, y: 508 },
				{ x: 806, y: 390 },
				{ x: 800, y: 272 }
			],
			color: 'var(--cc-surface-fill)',
			group: 'mix'
		},
		{
			id: 'pump',
			flux: NATURAL.export,
			points: [
				{ x: 694, y: 272 },
				{ x: 700, y: 390 },
				{ x: 694, y: 508 }
			],
			color: 'var(--cc-plants)',
			group: 'mix'
		},
		{
			id: 'volcano',
			flux: NATURAL.volcanoes,
			points: [
				{ x: 424, y: 238 },
				{ x: 430, y: 170 },
				{ x: 446, y: 104 }
			],
			color: 'var(--stage-ink-muted)',
			group: 'slow'
		},
		{
			id: 'weather',
			flux: NATURAL.weathering,
			points: [
				{ x: 396, y: 104 },
				{ x: 392, y: 170 },
				{ x: 386, y: 244 }
			],
			color: 'var(--stage-ink-muted)',
			group: 'slow'
		},
		{
			id: 'rivers',
			flux: NATURAL.riversToOcean,
			points: [
				{ x: 380, y: 252 },
				{ x: 452, y: 254 },
				{ x: 520, y: 266 }
			],
			color: 'var(--stage-ink-muted)',
			group: 'slow'
		},
		{
			id: 'burial',
			flux: NATURAL.seafloorBurial,
			points: [
				{ x: 530, y: 272 },
				{ x: 534, y: 400 },
				{ x: 530, y: 528 }
			],
			color: 'var(--stage-ink-muted)',
			group: 'slow'
		},
		{
			id: 'fossil',
			flux: BUDGET.fossil,
			points: [
				{ x: 70, y: 396 },
				{ x: 56, y: 300 },
				{ x: 70, y: 170 },
				{ x: 150, y: 80 }
			],
			color: 'var(--cc-human)',
			group: 'human'
		},
		{
			id: 'clearing',
			flux: BUDGET.landUse,
			points: [
				{ x: 128, y: 224 },
				{ x: 116, y: 160 },
				{ x: 166, y: 100 }
			],
			color: 'var(--cc-clearing)',
			group: 'human'
		}
	];
	const bands = FLOWS.map((f) => ({
		...f,
		band: band(f.points, widthOf(f.flux)),
		scaled: toScale(f.flux)
	}));

	/** Moving dots along each band's centre line (a pure function of t). */
	const SPEED = 55;
	const dots = $derived(
		bands.flatMap((b) => {
			if (o[b.group] < 0.05) return [];
			const n = Math.min(6, Math.max(2, Math.round(b.flux / 15)));
			const period = b.band.length / SPEED;
			const r = b.scaled ? Math.min(4, b.band.width / 5 + 1.6) : 1.8;
			return Array.from({ length: n }, (_, i) => {
				const u = cycle(t, period, i / n);
				const p = along(b.band.line, u * 0.94);
				const fade = smoothstep(0, 0.1, u) * (1 - smoothstep(0.82, 0.94, u));
				return {
					key: `${b.id}-${i}`,
					x: p.x,
					y: p.y,
					r,
					color: b.color,
					opacity: fade * o[b.group]
				};
			});
		})
	);

	/** Flow labels show only while their flows are in focus (dimmed flows keep no text). */
	const labelOpacity = (v: number) => smoothstep(0.45, 0.8, v) * v;

	// ---- readouts per view (phone panel) -------------------------------------
	const ROWS: Record<string, string[]> = {
		stores: ['air', 'land', 'ocean', 'fossil'],
		fast: ['gpp', 'resp', 'in', 'out'],
		ocean: ['surface', 'deep', 'down', 'pump'],
		slow: ['volcano', 'weather', 'rivers', 'burial'],
		human: ['air', 'fossil-flow', 'clearing', 'reserves'],
		budget: ['b-air', 'b-ocean', 'b-land', 'b-total'],
		locked: ['l-burnt', 'l-air', 'l-ocean', 'l-land']
	};
	const row = (id: string) => ((ROWS[view] ?? []).includes(id) ? 1 : 0);

	const airValue = $derived(
		o.now > 0.5 ? `${gtc(AIR_2024)} GtC in 2024` : `${gtc(PRE.atmosphere)} GtC in 1750`
	);
	const now = totals(today());

	// ---- budget inset (magnified ×10) ----------------------------------------
	const INSET = { x: 626, y: 62, w: 310, h: 168 };
	const K = 3.5; // scene units per GtC/yr: 10× the main diagram
	const total = BUDGET.fossil + BUDGET.landUse;
	const sankey = (() => {
		const x0 = INSET.x + 22;
		const x1 = INSET.x + 160;
		const y0 = INSET.y + 56;
		const splits = [
			{ id: 'air', v: BUDGET.air, color: 'var(--cc-air)', label: 'air' },
			{ id: 'ocean', v: BUDGET.ocean, color: 'var(--cc-ocean)', label: 'ocean' },
			{ id: 'land', v: BUDGET.land, color: 'var(--cc-plants)', label: 'plants' }
		];
		let acc = 0;
		let outY = INSET.y + 50;
		return splits.map((s) => {
			const a = y0 + acc * K;
			const b = a + s.v * K;
			acc += s.v;
			const c = outY;
			const d = c + s.v * K;
			outY = d + 16;
			const mx = (x0 + x1) / 2 + 20;
			const path = `M${x0} ${a} C${mx} ${a} ${mx} ${c} ${x1} ${c} L${x1} ${d} C${mx} ${d} ${mx} ${b} ${x0} ${b} Z`;
			return { ...s, path, labelY: (c + d) / 2 + 4, x1 };
		});
	})();
	const srcTop = INSET.y + 56;
</script>

<g>
	<!-- sky, land and sea -->
	<rect x="16" y="16" width="928" height="240" rx="10" fill="var(--cc-sky)" />
	<path d="M16 250 L470 250 L478 262 L944 262 L944 584 L16 584 Z" fill="var(--cc-ground)" />
	<rect x={OCEAN_X - 4} y="262" width={OCEAN_W + 6} height="282" fill="var(--cc-sea)" />

	<!-- rock (not to scale) -->
	<g opacity={o.rock}>
		<path
			d="M16 {ROCK_Y} L944 {ROCK_Y} L944 576 L928 584 L912 576 L896 584 L880 576 L864 584 L848 576 L832 584 L816 576 L800 584 L784 576 L768 584 L752 576 L736 584 L720 576 L704 584 L688 576 L672 584 L656 576 L640 584 L624 576 L608 584 L592 576 L576 584 L560 576 L544 584 L528 576 L512 584 L496 576 L480 584 L464 576 L448 584 L432 576 L416 584 L400 576 L384 584 L368 576 L352 584 L336 576 L320 584 L304 576 L288 584 L272 576 L256 584 L240 576 L224 584 L208 576 L192 584 L176 576 L160 584 L144 576 L128 584 L112 576 L96 584 L80 576 L64 584 L48 576 L32 584 L16 576 Z"
			fill="var(--cc-rock-fill)"
			stroke="var(--cc-rock)"
		/>
		<Readout id="rock" order={9}>
			<Label
				x={480}
				y={568}
				text="rock (limestone, shale): about 75,000,000 GtC · not to scale"
				size={12}
			/>
		</Readout>
	</g>

	<!-- fossil fuels -->
	<g opacity={o.fossil}>
		<rect
			x={COAL.x}
			y={COAL.y}
			width={COAL.w}
			height={COAL.h}
			rx="2"
			fill="var(--cc-fossil-fill)"
			stroke="var(--cc-fossil)"
		/>
		<rect
			x={OIL.x}
			y={OIL.y}
			width={OIL.w}
			height={OIL.h}
			rx="2"
			fill="var(--cc-fossil-fill)"
			stroke="var(--cc-fossil)"
		/>
		<rect
			x={GAS.x}
			y={GAS.y}
			width={GAS.w}
			height={GAS.h}
			rx="2"
			fill="var(--cc-fossil-fill)"
			stroke="var(--cc-fossil)"
		/>
		<Readout
			id="fossil"
			order={5}
			label="Fossil fuels (proven reserves)"
			value="{gtc(FOSSIL_RESERVES)} GtC"
			opacity={row('fossil')}
		>
			<Label
				x={92}
				y={390}
				text="fossil fuels (proven reserves): {gtc(FOSSIL_RESERVES)} GtC"
				anchor="start"
				size={12}
				weight={600}
			/>
		</Readout>
		<Readout
			id="reserves"
			order={6}
			label="Proven reserves left"
			value="{gtc(FOSSIL_RESERVES)} GtC: about 90 years at today's rate"
			opacity={row('reserves')}
		>
			<Label x={COAL.x + COAL.w / 2} y={446} text="coal 560" size={11} muted />
			<Label x={OIL.x + OIL.w / 2} y={446} text="oil 230" size={11} muted />
			<Label x={GAS.x + GAS.w / 2 + 6} y={446} text="gas 115" size={11} muted />
		</Readout>
		{#if o.loops > 0.02}
			<g opacity={o.loops}>
				<rect
					x={BURNT.x}
					y={BURNT.y}
					width={BURNT.w}
					height={BURNT.h}
					rx="2"
					fill="none"
					stroke="var(--cc-human)"
					stroke-dasharray="4 3"
				/>
				<Readout
					id="l-burnt"
					order={1}
					label="Fossil carbon burnt since 1750"
					value="{gtc(burnt)} GtC"
					opacity={row('l-burnt')}
				>
					<Label
						x={BURNT.x}
						y={446}
						text="burnt since 1750: {gtc(burnt)}"
						anchor="start"
						size={11}
						color="var(--cc-human)"
					/>
				</Readout>
			</g>
		{/if}
	</g>

	<!-- ocean -->
	<g opacity={o.deep}>
		<rect
			x={OCEAN_X}
			y={DEEP.y}
			width={OCEAN_W}
			height={DEEP.h}
			rx="3"
			fill="var(--cc-deep-fill)"
			opacity="0.75"
		/>
		<rect
			x={OCEAN_X}
			y={SED.y}
			width={OCEAN_W}
			height={SED.h}
			rx="2"
			fill="var(--cc-soil-fill)"
			stroke="var(--cc-soil)"
			stroke-width="0.8"
		/>
		<Readout
			id="deep"
			order={4}
			label="Deep ocean"
			value="{gtc(PRE.deepOcean)} GtC"
			opacity={row('deep')}
		>
			<Label x={926} y={300} text="deep ocean" anchor="end" size={13} weight={600} />
			<Label x={926} y={318} text="{gtc(PRE.deepOcean)} GtC" anchor="end" size={12} />
		</Readout>
		<Readout id="sediments">
			<Label
				x={OCEAN_X + 12}
				y={SED.y + 10}
				text="sea-floor sediments 1,750"
				anchor="start"
				size={11}
			/>
		</Readout>
	</g>
	<g opacity={o.ocean}>
		<rect
			x={OCEAN_X}
			y={SURF.y}
			width={OCEAN_W}
			height={SURF.h}
			fill="var(--cc-surface-fill)"
			stroke="var(--cc-ocean)"
			stroke-width="0.8"
		/>
		<Readout
			id="ocean"
			order={3}
			label="Ocean"
			value="{gtc(PRE.surfaceOcean + PRE.deepOcean)} GtC (surface 900)"
			opacity={row('ocean')}
		/>
		<Readout
			id="surface"
			order={3}
			label="Surface ocean (top ~100 m)"
			value="{gtc(PRE.surfaceOcean)} GtC"
			opacity={row('surface')}
		>
			<Label
				x={930}
				y={250}
				text="surface ocean {gtc(PRE.surfaceOcean)} GtC"
				anchor="end"
				size={12}
				weight={600}
			/>
		</Readout>
	</g>

	<!-- plants, soils, permafrost -->
	<g opacity={o.land}>
		<rect
			x={SOILS.x}
			y={SOILS.y}
			width={SOILS.w}
			height={SOILS.h}
			rx="3"
			fill="var(--cc-soil-fill)"
			stroke="var(--cc-soil)"
		/>
		<rect
			x={FROST.x}
			y={FROST.y}
			width={FROST.w}
			height={FROST.h}
			rx="3"
			fill="var(--cc-permafrost-fill)"
			stroke="var(--cc-rock)"
			stroke-dasharray="3 2"
		/>
		<rect
			x={PLANTS.x}
			y={PLANTS.y}
			width={PLANTS.w}
			height={PLANTS.h}
			rx="3"
			fill="var(--cc-plants-fill)"
			stroke="var(--cc-plants)"
		/>
		<Readout
			id="land"
			order={2}
			label="Plants and soils"
			value="450 + 1,700 GtC (+1,400 frozen)"
			opacity={row('land')}
		>
			<Label
				x={PLANTS.x - 8}
				y={PLANTS.y + 15}
				text="plants 450"
				anchor="end"
				size={12}
				weight={600}
			/>
			<Label x={SOILS.x + SOILS.w / 2} y={SOILS.y + 23} text="soils 1,700" size={12} weight={600} />
			<Label x={FROST.x + FROST.w / 2} y={FROST.y + 17} text="permafrost 1,400" size={11} />
			<Label x={FROST.x + FROST.w / 2} y={FROST.y + 30} text="(frozen)" size={11} muted />
		</Readout>
	</g>

	<!-- flows -->
	{#each bands as b (b.id)}
		{#if o[b.group] > 0.02}
			<path
				d={b.band.d}
				fill={b.color}
				fill-opacity={b.group === 'human' ? 0.85 : b.scaled ? 0.42 : 0.9}
				stroke={b.scaled ? 'none' : b.color}
				stroke-dasharray={b.scaled ? undefined : '3 2'}
				stroke-width="0.6"
				opacity={o[b.group]}
			/>
		{/if}
	{/each}
	{#each dots as d (d.key)}
		<circle cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={d.opacity} />
	{/each}

	<!-- flow labels -->
	<g opacity={labelOpacity(o.fast)}>
		<Readout
			id="gpp"
			order={1}
			label="Photosynthesis"
			value="{NATURAL.photosynthesis} GtC a year"
			color="var(--cc-plants)"
			opacity={row('gpp')}
		>
			<Label
				x={198}
				y={118}
				text="photosynthesis {NATURAL.photosynthesis}"
				size={12}
				weight={600}
				color="var(--cc-plants)"
				anchor="end"
			/>
		</Readout>
		<Readout
			id="resp"
			order={2}
			label="Respiration and fire"
			value="{NATURAL.respiration} GtC a year"
			color="var(--cc-soil)"
			opacity={row('resp')}
		>
			<Label
				x={346}
				y={168}
				text="respiration & fire {NATURAL.respiration}"
				size={12}
				weight={600}
				color="var(--cc-soil)"
				anchor="start"
			/>
		</Readout>
	</g>
	<g opacity={labelOpacity(o.gas)}>
		<Readout
			id="in"
			order={3}
			label="Dissolving into the ocean"
			value="{NATURAL.oceanIn} GtC a year"
			color="var(--cc-ocean)"
			opacity={row('in')}
		>
			<Label
				x={584}
				y={150}
				text="dissolving {NATURAL.oceanIn}"
				size={12}
				weight={600}
				color="var(--cc-ocean)"
				anchor="end"
			/>
		</Readout>
		<Readout
			id="out"
			order={4}
			label="Bubbling back out"
			value="{NATURAL.oceanOut} GtC a year"
			color="var(--cc-ocean)"
			opacity={row('out')}
		>
			<Label
				x={714}
				y={150}
				text="bubbling out {NATURAL.oceanOut}"
				size={12}
				weight={600}
				color="var(--cc-ocean)"
				anchor="start"
			/>
		</Readout>
	</g>
	<g opacity={labelOpacity(o.mix)}>
		<Readout
			id="down"
			order={5}
			label="Water sinking / rising"
			value="{NATURAL.subduction} / {NATURAL.obduction} GtC a year"
			opacity={row('down')}
		>
			<Label x={594} y={404} text="sinking water {NATURAL.subduction}" size={12} weight={600} />
			<Label x={806} y={404} text="rising water {NATURAL.obduction}" size={12} weight={600} />
		</Readout>
		<Readout
			id="pump"
			order={6}
			label="Sinking plankton (biological pump)"
			value="{NATURAL.export} GtC a year"
			color="var(--cc-plants)"
			opacity={row('pump')}
		>
			<Label
				x={700}
				y={350}
				text="plankton {NATURAL.export}"
				size={12}
				weight={600}
				color="var(--cc-plants)"
			/>
		</Readout>
	</g>
	<g opacity={labelOpacity(o.slow)}>
		<path d="M408 250 L424 232 L440 250 Z" fill="var(--cc-rock)" />
		<Readout
			id="volcano"
			order={1}
			label="Volcanoes"
			value="{NATURAL.volcanoes} GtC a year"
			opacity={row('volcano')}
		>
			<Label
				x={452}
				y={100}
				text="volcanoes {NATURAL.volcanoes}"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="weather"
			order={2}
			label="Rock weathering"
			value="{NATURAL.weathering} GtC a year"
			opacity={row('weather')}
		>
			<Label
				x={386}
				y={100}
				text="weathering {NATURAL.weathering}"
				size={12}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="rivers"
			order={3}
			label="Rivers to the sea"
			value="{NATURAL.riversToOcean} GtC a year"
			opacity={row('rivers')}
		>
			<Label
				x={500}
				y={244}
				text="rivers {NATURAL.riversToOcean}"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="burial"
			order={4}
			label="Burial in the sea floor"
			value="{NATURAL.seafloorBurial} GtC a year"
			opacity={row('burial')}
		>
			<Label
				x={540}
				y={470}
				text="burial {NATURAL.seafloorBurial}"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>
	</g>
	<!-- The clearing arrow is dashed too; the loop labels take this corner in the last view. -->
	<g opacity={labelOpacity(Math.max(o.slow, o.human) * (1 - o.loops))}>
		<Readout id="minwidth">
			<Label
				x={24}
				y={538}
				text="dashed: too thin to draw to scale, shown wider"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
	</g>
	<g opacity={labelOpacity(o.human)}>
		<Readout
			id="fossil-flow"
			order={2}
			label="Burning fossil fuels"
			value="{BUDGET.fossil} GtC a year (2015–2024)"
			color="var(--cc-human)"
			opacity={row('fossil-flow')}
		>
			<Label
				x={74}
				y={344}
				text="burning {BUDGET.fossil}"
				size={12}
				weight={700}
				color="var(--cc-human)"
				anchor="start"
			/>
		</Readout>
		<Readout
			id="clearing"
			order={3}
			label="Clearing forests"
			value="{BUDGET.landUse} GtC a year"
			color="var(--cc-clearing)"
			opacity={row('clearing')}
		>
			<Label
				x={154}
				y={152}
				text="clearing {BUDGET.landUse}"
				size={12}
				weight={700}
				color="var(--cc-clearing)"
				anchor="start"
			/>
		</Readout>
	</g>

	<!-- the air -->
	<g opacity={o.air}>
		<rect
			x={AIR.cx - airW / 2}
			y={AIR.y}
			width={airW}
			height={AIR_H}
			rx="4"
			fill="var(--cc-air-fill)"
			stroke="var(--cc-air)"
		/>
		{#if o.now > 0.02}
			<rect
				x={AIR.cx - airPre / 2}
				y={AIR.y + 3}
				width={airPre}
				height={AIR_H - 6}
				rx="3"
				fill="none"
				stroke="var(--cc-air)"
				stroke-dasharray="3 2"
				opacity={o.now}
			/>
		{/if}
		<Readout
			id="air"
			order={1}
			label="The air"
			value={airValue}
			color="var(--cc-air)"
			opacity={row('air')}
		>
			<Label
				x={AIR.cx + airNow / 2 + 10}
				y={AIR.y + 13}
				text="the air"
				anchor="start"
				size={13}
				weight={700}
			/>
			<Label x={AIR.cx + airNow / 2 + 10} y={AIR.y + 28} text={airValue} anchor="start" size={12} />
			{#if o.now > 0.02}
				<Label
					x={AIR.cx - airNow / 2 - 10}
					y={AIR.y + 21}
					text="dashed: 1750"
					anchor="end"
					size={11}
					muted
					opacity={o.now}
				/>
			{/if}
		</Readout>
	</g>

	<!-- budget inset, magnified ×10 -->
	{#if o.budget > 0.02}
		<g opacity={o.budget}>
			<rect
				x={INSET.x}
				y={INSET.y}
				width={INSET.w}
				height={INSET.h}
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout id="b-title">
				<Label
					x={INSET.x + 14}
					y={INSET.y + 20}
					text="Where 11.2 GtC a year goes (2015–2024)"
					anchor="start"
					size={13}
					weight={700}
				/>
				<Label
					x={INSET.x + 14}
					y={INSET.y + 36}
					text="bands 10× wider than in the main drawing"
					anchor="start"
					size={11}
					muted
				/>
			</Readout>
			<rect
				x={INSET.x + 10}
				y={srcTop}
				width="12"
				height={BUDGET.fossil * K}
				fill="var(--cc-human)"
			/>
			<rect
				x={INSET.x + 10}
				y={srcTop + BUDGET.fossil * K}
				width="12"
				height={BUDGET.landUse * K}
				fill="var(--cc-clearing)"
			/>
			<Readout id="b-src">
				<Label
					x={INSET.x + 16}
					y={INSET.y + 134}
					text="burning 9.8 + clearing 1.4"
					anchor="start"
					size={11}
				/>
			</Readout>
			{#each sankey as s (s.id)}
				<path d={s.path} fill={s.color} fill-opacity="0.5" />
				<Readout
					id="b-{s.id}"
					order={s.id === 'air' ? 1 : s.id === 'ocean' ? 2 : 3}
					label={s.id === 'air'
						? 'Stays in the air'
						: s.id === 'ocean'
							? 'Into the ocean'
							: 'Into plants'}
					value="{s.v} GtC a year ({Math.round((s.v / total) * 100)}%)"
					color={s.color}
					opacity={row(`b-${s.id}`)}
				>
					<Label
						x={s.x1 + 8}
						y={s.labelY}
						text="{s.label} {s.v} ({Math.round((s.v / total) * 100)}%)"
						anchor="start"
						size={12}
						weight={600}
						color={s.color}
					/>
				</Readout>
			{/each}
			<Readout
				id="b-total"
				order={4}
				label="Since 1850"
				value="{CUMULATIVE.fossil +
					CUMULATIVE.landUse} GtC released: air {CUMULATIVE.air}, ocean {CUMULATIVE.ocean}, land {CUMULATIVE.land}"
				opacity={row('b-total')}
			>
				<Label
					x={INSET.x + 14}
					y={INSET.y + 156}
					text="1850–2024: air 290 · ocean 200 · land 175"
					anchor="start"
					size={11}
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- the two loops -->
	{#if o.loops > 0.02}
		<g opacity={o.loops}>
			<path
				d="M22 22 L938 22 L938 546 L474 546 L474 300 L22 300 Z"
				fill="none"
				stroke="var(--cc-air)"
				stroke-width="2"
				stroke-dasharray="7 5"
			/>
			<path
				d="M22 308 L468 308 L468 552 L938 552"
				fill="none"
				stroke="var(--cc-rock)"
				stroke-width="2"
				stroke-dasharray="7 5"
			/>
			<Label
				x={30}
				y={42}
				text="fast loop: years to centuries"
				anchor="start"
				size={13}
				weight={700}
				color="var(--cc-air)"
				pill
			/>
			<Label
				x={30}
				y={530}
				text="slow loop: millions of years"
				anchor="start"
				size={13}
				weight={700}
				pill
			/>
			<Readout
				id="l-air"
				order={2}
				label="Added to the air since 1750"
				value="+{gtc(now.air)} GtC"
				color="var(--cc-air)"
				opacity={row('l-air')}
			>
				<Label
					x={AIR.cx}
					y={AIR.y + AIR_H + 18}
					text="+{gtc(now.air)} since 1750"
					size={12}
					weight={700}
					color="var(--cc-air)"
				/>
			</Readout>
			<Readout
				id="l-ocean"
				order={3}
				label="Added to the ocean"
				value="+{gtc(now.ocean)} GtC"
				color="var(--cc-ocean)"
				opacity={row('l-ocean')}
			>
				<Label
					x={OCEAN_X + 150}
					y={300}
					text="+{gtc(now.ocean)} since 1750"
					size={12}
					weight={700}
					color="var(--cc-ocean)"
					pill
				/>
			</Readout>
			<Readout
				id="l-land"
				order={4}
				label="Plants and soils, net"
				value="{now.land < 0 ? '−' : '+'}{gtc(Math.abs(now.land))} GtC (cleared −{gtc(
					now.landSink - now.land
				)}, extra growth +{gtc(now.landSink)})"
				color="var(--cc-plants)"
				opacity={row('l-land')}
			>
				<Label
					x={330}
					y={238}
					text="land {now.land < 0 ? '−' : '+'}{gtc(Math.abs(now.land))} net"
					size={12}
					weight={700}
					color="var(--cc-plants)"
					pill
				/>
			</Readout>
		</g>
	{/if}
</g>
