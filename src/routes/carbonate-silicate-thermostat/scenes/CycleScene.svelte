<script lang="ts">
	/**
	 * The slow carbon cycle as a cross-section: a volcano above a subducting plate releases
	 * CO₂; the air carries it to clouds over silicate mountains; rain, a weak acid, weathers
	 * the rock; a river carries calcium and bicarbonate to the sea; shells settle as limestone
	 * on the sea floor; the plate carries the limestone down under the continent, where the
	 * heat frees its CO₂ to the volcano again. Particles move along each leg as a pure function
	 * of t; under reduced motion they sit spread along their paths.
	 */
	import { Flow, Label, Molecule, along, cycle, smooth, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const tt = $derived(reduced ? 2.5 : t);
	const fade = (u: number) => smoothstep(0, 0.1, u) * (1 - smoothstep(0.88, 1, u));

	// ---- geometry
	const GROUND = 330;
	const COAST = 616;
	const mountains = 'M120 330 L205 214 L240 246 L292 178 L336 232 L362 214 L420 330 Z';
	const volcano = 'M452 330 L512 222 L540 222 L604 330 Z';
	const slabTop = 'M944 480 C800 478 700 480 664 492 C600 512 520 548 446 584';
	const slabBody =
		'M944 480 C800 478 700 480 664 492 C600 512 520 548 446 584 L560 584 C590 568 640 546 690 526 C720 514 800 510 944 512 Z';

	// ---- particle paths
	const co2Path = smooth([
		{ x: 526, y: 214 },
		{ x: 520, y: 160 },
		{ x: 480, y: 118 },
		{ x: 400, y: 104 },
		{ x: 318, y: 104 }
	]);
	const riverPath = smooth([
		{ x: 408, y: 336 },
		{ x: 470, y: 342 },
		{ x: 560, y: 342 },
		{ x: 630, y: 352 },
		{ x: 690, y: 372 }
	]);
	const seaPaths = [0, 1, 2, 3].map((i) =>
		smooth([
			{ x: 690, y: 372 },
			{ x: 730 + i * 50, y: 392 + (i % 2) * 14 },
			{ x: 760 + i * 52, y: 440 },
			{ x: 768 + i * 52, y: 470 }
		])
	);
	const magmaPath = smooth([
		{ x: 560, y: 560 },
		{ x: 540, y: 470 },
		{ x: 528, y: 380 },
		{ x: 526, y: 236 }
	]);

	const N = 6;
	const co2s = $derived(
		Array.from({ length: N }, (_, i) => {
			const u = cycle(tt, 7, i / N);
			return { ...along(co2Path, u), o: fade(u) };
		})
	);
	const rains = $derived(
		Array.from({ length: 12 }, (_, i) => {
			const u = cycle(tt, 1.1, (i * 0.37) % 1);
			const x = 222 + (i % 6) * 22 + (i >= 6 ? 11 : 0);
			return { x: x - u * 8, y: 128 + u * 70, o: fade(u) };
		})
	);
	const ions = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const u = cycle(tt, 6, i / 7);
			return { ...along(riverPath, u), o: fade(u), ca: i % 2 === 0 };
		})
	);
	const shells = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const u = cycle(tt, 6.5, i / 4 + 0.1);
			return { ...along(seaPaths[i], u), o: fade(u) };
		})
	);
	const magma = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const u = cycle(tt, 5, i / 4);
			return { ...along(magmaPath, u), o: fade(u) };
		})
	);
	/** The plate's conveyor: limestone blocks riding the sea floor toward the trench. */
	const blocks = $derived(
		Array.from({ length: 6 }, (_, i) => {
			const u = cycle(tt, 18, i / 6);
			const x = 940 - u * 290;
			const y = 472 + Math.max(0, 700 - x) * 0.35;
			return { x, y, o: 1 - smoothstep(0.82, 1, u) };
		})
	);
</script>

<g>
	<Readout id="title">
		<Label
			x={24}
			y={40}
			text="The slow carbon cycle: millions of years, through rock"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- crust and mantle -->
	<rect
		x={16}
		y={GROUND}
		width={944 - 16}
		height={584 - GROUND}
		fill="var(--cst-rock)"
		opacity="0.28"
	/>
	<!-- the sea -->
	<path
		d="M{COAST} {GROUND} L944 {GROUND} L944 480 C800 478 700 480 664 492 Z"
		fill="var(--cst-ocean)"
		opacity="0.75"
	/>
	<!-- the plate, with its limestone layer, diving under the continent -->
	<path d={slabBody} fill="var(--cst-rock)" opacity="0.55" />
	<path d={slabTop} fill="none" stroke="var(--cst-rock)" stroke-width="1.5" />
	<path
		d="M944 474 C800 472 720 474 680 484"
		fill="none"
		stroke="var(--cst-lime-edge)"
		stroke-width="9"
		stroke-linecap="round"
		opacity="0.9"
	/>
	{#each blocks as b, i (i)}
		<rect
			x={b.x - 9}
			y={b.y - 5}
			width="18"
			height="8"
			rx="2"
			fill="var(--cst-lime)"
			stroke="var(--cst-lime-edge)"
			opacity={b.o}
		/>
	{/each}

	<!-- land -->
	<line x1={16} x2={COAST} y1={GROUND} y2={GROUND} stroke="var(--cst-rock)" stroke-width="1.5" />
	<path d={mountains} fill="var(--cst-rock)" opacity="0.8" stroke="var(--cst-rock)" />
	{#each [[200, 290], [250, 300], [300, 270], [340, 300], [270, 320], [180, 318], [380, 316]] as p, i (i)}
		<circle cx={p[0]} cy={p[1]} r="2.2" fill="var(--stage-bg)" opacity="0.55" />
	{/each}
	<path d={volcano} fill="var(--cst-rock)" stroke="var(--cst-rock)" />
	<path d="M512 222 L540 222 L534 232 L518 232 Z" fill="var(--cst-volc)" />

	<!-- magma rising from the hot slab -->
	<Flow
		d="M560 560 C545 470 530 380 526 240"
		color="var(--cst-volc)"
		width={2}
		opacity={0.45}
		dash={6}
		t={tt}
		speed={14}
	/>
	{#each magma as m, i (i)}
		<circle cx={m.x} cy={m.y} r="4.5" fill="var(--cst-volc)" opacity={m.o * 0.9} />
	{/each}

	<!-- CO₂ rising and drifting to the clouds -->
	{#each co2s as m, i (i)}
		<Molecule kind="CO2" x={m.x} y={m.y} scale={0.75} opacity={m.o} />
	{/each}

	<!-- the cloud and its rain on the mountains -->
	<g opacity="0.95">
		<ellipse cx={270} cy={112} rx={74} ry={20} fill="var(--surface)" stroke="var(--border)" />
		<ellipse cx={240} cy={100} rx={34} ry={18} fill="var(--surface)" />
		<ellipse cx={292} cy={96} rx={30} ry={16} fill="var(--surface)" />
	</g>
	{#each rains as r, i (i)}
		<line
			x1={r.x}
			y1={r.y}
			x2={r.x - 2.4}
			y2={r.y + 9}
			stroke="var(--cst-weather)"
			stroke-width="1.8"
			stroke-linecap="round"
			opacity={r.o * 0.85}
		/>
	{/each}

	<!-- the river -->
	<path
		d="M408 336 C470 344 560 340 630 352 L690 372"
		fill="none"
		stroke="var(--cst-weather)"
		stroke-width="5"
		opacity="0.55"
		stroke-linecap="round"
	/>
	{#each ions as m, i (i)}
		<circle
			cx={m.x}
			cy={m.y}
			r="4"
			fill={m.ca ? 'var(--stage-bg)' : 'var(--cst-co2)'}
			stroke={m.ca ? 'var(--stage-ink)' : 'none'}
			stroke-width="1.2"
			opacity={m.o}
		/>
	{/each}

	<!-- shells settling -->
	{#each shells as s, i (i)}
		<path
			d="M{s.x - 6} {s.y} A6 6 0 0 1 {s.x + 6} {s.y} Z"
			fill="var(--cst-lime)"
			stroke="var(--cst-lime-edge)"
			stroke-width="1.2"
			opacity={s.o}
		/>
	{/each}

	<!-- labels, numbered round the loop -->
	<Readout id="l1" order={1} label="Volcanoes release CO₂" marker={1} at={[560, 196]}>
		<Label
			x={556}
			y={190}
			text="① volcanoes release CO₂"
			anchor="start"
			weight={600}
			color="var(--cst-volc)"
		/>
	</Readout>
	<Readout id="l2" order={2} label="Rain + CO₂: a weak acid" marker={2} at={[370, 84]}>
		<Label
			x={356}
			y={76}
			text="② rain + CO₂ → a weak acid"
			anchor="start"
			weight={600}
			color="var(--cst-weather)"
		/>
	</Readout>
	<Readout id="l3" order={3} label="It weathers silicate rock" marker={3} at={[110, 236]}>
		<Label x={176} y={168} text="③ silicate rock weathers" anchor="end" weight={600} />
	</Readout>
	<Readout
		id="l4"
		order={4}
		label="Rivers carry Ca²⁺ + HCO₃⁻ to the sea"
		marker={4}
		at={[640, 312]}
	>
		<Label x={634} y={312} text="④ rivers carry Ca²⁺ + HCO₃⁻" anchor="start" weight={600} />
	</Readout>
	<Readout id="l5" order={5} label="Shells and reefs: limestone, CaCO₃" marker={5} at={[880, 452]}>
		<Label x={930} y={410} text="⑤ shells → limestone (CaCO₃)" anchor="end" weight={600} />
	</Readout>
	<Readout
		id="l6"
		order={6}
		label="Plates carry it down; heat frees the CO₂"
		marker={6}
		at={[640, 560]}
	>
		<Label
			x={936}
			y={560}
			text="⑥ the plate carries it down; heat frees the CO₂"
			anchor="end"
			weight={600}
		/>
	</Readout>
	<Readout id="net" order={7} label="Net" value="CaSiO₃ + CO₂ → CaCO₃ + SiO₂">
		<Label
			x={24}
			y={572}
			text="net: CaSiO₃ + CO₂ → CaCO₃ + SiO₂"
			anchor="start"
			size={13}
			weight={600}
			pill
		/>
	</Readout>
	<Readout id="fast">
		<Label
			x={936}
			y={40}
			text="the fast cycle (plants, sea surface) runs on top, in years to centuries"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
