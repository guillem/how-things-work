<script lang="ts">
	/**
	 * The curve of binding energy per nucleon (AME2020: the most tightly bound
	 * nucleus of each mass number), and the energy of a split.
	 *
	 * Views (`step.hints.view`):
	 *   binding — the curve drawn in, its peak at nickel-62 / iron, uranium-235
	 *             and the two fragments of the chosen split, with arrows for
	 *             fission (heavy → middle) and the direction fusion goes
	 *   budget  — the curve, smaller, beside a waterfall of where the energy of
	 *             one fission goes: the chosen split at once and after its
	 *             fragments decay (AME2020), then the average over all splits,
	 *             minus antineutrinos, plus neutron captures (Ma et al. 2013)
	 *
	 * Everything is a pure function of t; reduced motion shows the finished frame.
	 */
	import { Axes, Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { nuclides } from '../ame2020';
	import {
		FISSION_ENERGY,
		METHANE_J_PER_KG,
		bindingCurve,
		heatPerKgU235,
		massLost,
		peak,
		promptQ,
		splitById,
		totalQ
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'binding'));
	const budget = $derived(view === 'budget');
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const split = $derived(splitById(offered.has('split') ? String(params.split ?? 'bakr') : 'bakr'));
	const time = $derived(reduced ? 30 : t);

	const NAMES: Record<string, string> = {
		Kr: 'krypton',
		Ba: 'barium',
		Xe: 'xenon',
		Sr: 'strontium',
		Cs: 'caesium',
		Rb: 'rubidium',
		U: 'uranium',
		Ni: 'nickel',
		Fe: 'iron',
		He: 'helium'
	};
	const name = (n: { element: string; A: number }) => `${NAMES[n.element] ?? n.element}-${n.A}`;

	// ---- the plot --------------------------------------------------------------
	const box = $derived(
		budget ? { x0: 76, x1: 470, y0: 150, y1: 470 } : { x0: 96, x1: 900, y0: 140, y1: 500 }
	);
	const sx = $derived(scale([0, 250], [box.x0, box.x1]));
	const sy = $derived(scale([0, 9.2], [box.y1, box.y0]));

	const reveal = $derived(budget ? 250 : 2 + 250 * smoothstep(0.3, 3, time));
	const shown = $derived(bindingCurve.filter((p) => p.A <= reveal));
	const curvePath = $derived(
		linePath(
			shown,
			(p) => p.A,
			(p) => p.b,
			sx,
			sy
		)
	);
	const marksIn = $derived(budget ? 1 : smoothstep(2.8, 3.6, time));
	const arcsIn = $derived(budget ? 1 : smoothstep(3.6, 4.6, time));

	const top = peak();
	const U = nuclides.U235;
	const heavy = $derived(nuclides[split.heavy]);
	const light = $derived(nuclides[split.light]);
	const pt = (n: { A: number; perNucleon: number }) => ({
		x: sx(n.A),
		y: sy(n.perNucleon / 1000)
	});
	const uPt = $derived(pt(U));
	const hPt = $derived(pt(heavy));
	const lPt = $derived(pt(light));
	/** An arc from a to b, bowed upwards. */
	const arc = (a: { x: number; y: number }, b: { x: number; y: number }, lift: number) => {
		const mx = (a.x + b.x) / 2;
		const my = Math.min(a.y, b.y) - lift;
		return `M${a.x.toFixed(1)} ${(a.y - 8).toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${(b.y - 8).toFixed(1)}`;
	};
	const march = $derived(reduced ? 0 : -time * 18);

	// ---- the energy waterfall (budget view) -------------------------------------
	const q0 = $derived(promptQ(split));
	const q1 = $derived(totalQ(split));
	const E = FISSION_ENERGY;
	const WX0 = 540;
	const WX1 = 900;
	const sw = scale([0, 220], [WX0, WX1]);
	interface Row {
		id: string;
		label: string;
		from: number;
		to: number;
		color: string;
		value: string;
		strong?: boolean;
	}
	const rows = $derived<Row[]>([
		{
			id: 'prompt',
			label: 'at once: the fragments fly apart',
			from: 0,
			to: q0,
			color: 'var(--nf-energy)',
			value: `${q0.toFixed(1)} MeV`
		},
		{
			id: 'decay',
			label: 'later: the fragments beta-decay',
			from: q0,
			to: q1,
			color: 'var(--nf-flash)',
			value: `+ ${(q1 - q0).toFixed(1)} → ${q1.toFixed(1)}`
		},
		{
			id: 'total',
			label: 'average over all splits',
			from: 0,
			to: E.total,
			color: 'var(--nf-curve)',
			value: `${E.total.toFixed(1)} MeV`
		},
		{
			id: 'nu',
			label: 'antineutrinos escape',
			from: E.total - E.neutrinos - E.pending,
			to: E.total,
			color: 'var(--nf-neutrino)',
			value: `− ${(E.neutrinos + E.pending).toFixed(1)}`
		},
		{
			id: 'capture',
			label: 'spare neutrons absorbed',
			from: E.total - E.neutrinos - E.pending,
			to: E.heat,
			color: 'var(--nf-light)',
			value: `+ ${E.capture.toFixed(1)}`
		},
		{
			id: 'heat',
			label: 'heat left in the reactor',
			from: 0,
			to: E.heat,
			color: 'var(--nf-u235)',
			value: `${E.heat.toFixed(1)} MeV`,
			strong: true
		}
	]);
	const rowY = (i: number) => 150 + i * 56 + (i >= 2 ? 26 : 0);
	const rowIn = (i: number) => (reduced ? 1 : smoothstep(0.4 + i * 0.7, 0.9 + i * 0.7, time));

	const lost = $derived(massLost(split));
	const gasRatio = heatPerKgU235() / METHANE_J_PER_KG;
	const fmtMillion = (v: number) => `${(v / 1e6).toFixed(1)} million`;
</script>

<g>
	<Readout id="title">
		<text x={box.x0} y={budget ? 76 : 56} style:font-size="16px" font-weight="600"
			>Binding energy per nucleon</text
		>
		<text x={box.x0} y={budget ? 94 : 74} class="muted"
			>most tightly bound nucleus of each mass number · AME2020</text
		>
	</Readout>
	<Axes
		{sx}
		{sy}
		xLabel="mass number A (protons + neutrons)"
		yLabel="MeV per nucleon"
		xTicks={[0, 50, 100, 150, 200, 250]}
		yTicks={[0, 2, 4, 6, 8]}
	/>
	<path
		d={curvePath}
		fill="none"
		stroke="var(--nf-curve)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>

	<g opacity={marksIn}>
		<!-- the peak -->
		<circle cx={sx(top.A)} cy={sy(top.b)} r="4.5" fill="var(--nf-curve)" />
		<Readout
			id="peak"
			order={1}
			label="Most tightly bound"
			value="{name(top)} · {top.b.toFixed(3)} MeV"
			note="iron-56: {(nuclides.Fe56.perNucleon / 1000).toFixed(3)}"
		>
			{#if budget}
				<Label x={sx(top.A)} y={sy(top.b) - 14} text="iron / nickel" />
			{:else}
				<line
					x1={sx(top.A)}
					y1={sy(top.b) + 6}
					x2={sx(top.A)}
					y2={sy(top.b) + 58}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 3"
				/>
				<Label
					x={sx(top.A) - 24}
					y={sy(top.b) + 74}
					text="peak: {name(top)}, {top.b.toFixed(2)} MeV (iron-56 just below)"
					anchor="start"
				/>
			{/if}
		</Readout>
		<!-- uranium -->
		<circle cx={uPt.x} cy={uPt.y} r="6" fill="var(--nf-u235)" />
		<Readout
			id="u235"
			order={2}
			label="Uranium-235"
			value="{(U.perNucleon / 1000).toFixed(2)} MeV per nucleon"
			color="var(--nf-u235)"
		>
			<Label
				x={uPt.x}
				y={uPt.y + 24}
				text="uranium-235 · {(U.perNucleon / 1000).toFixed(2)}"
				anchor="end"
				color="var(--nf-u235)"
			/>
		</Readout>
		<!-- fragments -->
		<circle cx={hPt.x} cy={hPt.y} r="5.5" fill="var(--nf-heavy)" />
		<circle cx={lPt.x} cy={lPt.y} r="5.5" fill="var(--nf-light)" />
		<Readout
			id="frags"
			order={3}
			label="Its fragments"
			value="{name(heavy)} {(heavy.perNucleon / 1000).toFixed(2)} · {name(light)} {(
				light.perNucleon / 1000
			).toFixed(2)}"
		>
			<Label
				x={hPt.x}
				y={hPt.y + 24}
				text="{name(heavy)} · {(heavy.perNucleon / 1000).toFixed(2)}"
				color="var(--nf-heavy)"
			/>
			<Label
				x={lPt.x}
				y={lPt.y + (budget ? 44 : 24)}
				text="{name(light)} · {(light.perNucleon / 1000).toFixed(2)}"
				color="var(--nf-light)"
			/>
		</Readout>
		{#if !budget}
			<!-- light nuclei -->
			<circle cx={sx(4)} cy={sy(nuclides.He4.perNucleon / 1000)} r="4" fill="var(--nf-curve)" />
			<Readout id="he4">
				<Label
					x={sx(4) + 10}
					y={sy(nuclides.He4.perNucleon / 1000) + 4}
					text="helium-4"
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	</g>

	<!-- fission: from uranium up to its fragments -->
	<g opacity={arcsIn}>
		<path
			d={arc(uPt, hPt, budget ? 34 : 54)}
			fill="none"
			stroke="var(--nf-u235)"
			stroke-width="2"
			stroke-dasharray="7 5"
			stroke-dashoffset={march}
			marker-end="url(#arrowhead)"
		/>
		<path
			d={arc(uPt, lPt, budget ? 64 : 100)}
			fill="none"
			stroke="var(--nf-u235)"
			stroke-width="2"
			stroke-dasharray="7 5"
			stroke-dashoffset={march}
			marker-end="url(#arrowhead)"
		/>
		{#if !budget}
			<Readout
				id="fission"
				order={4}
				label="Fission"
				value="up the curve by about 0.8 MeV per nucleon"
			>
				<Label
					x={box.x1}
					y={64}
					text="fission: up ≈ 0.8 MeV per nucleon × 236 ≈ 200 MeV"
					anchor="end"
					pill
				/>
			</Readout>
			<!-- fusion: the light side climbs towards the peak -->
			<path
				d="M{sx(10)} {sy(3.4)} Q{sx(16)} {sy(6.6)} {sx(40)} {sy(7.7)}"
				fill="none"
				stroke="var(--nf-curve)"
				stroke-width="1.6"
				stroke-dasharray="3 5"
				marker-end="url(#arrowhead)"
				opacity="0.75"
			/>
			<Readout id="fusion">
				<Label
					x={sx(20) + 4}
					y={sy(3.2)}
					text="light nuclei: energy by joining (fusion, in stars)"
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	</g>

	{#if budget}
		<Readout id="w-title">
			<text x={WX0} y={76} style:font-size="16px" font-weight="600">Energy of one fission</text>
			<text x={WX0} y={94} class="muted">this split, from the masses (AME2020)</text>
			<text x={WX0} y={rowY(2) - 34} class="muted">all splits, averaged (Ma et al. 2013)</text>
		</Readout>
		{#each rows as r, i (r.id)}
			{@const y = rowY(i)}
			{@const o = rowIn(i)}
			<Readout
				id="row-{r.id}"
				order={10 + i}
				label={r.label}
				value={r.value}
				color={r.color}
				opacity={o}
			>
				<g opacity={o}>
					<text x={WX0} y={y - 6} class={r.strong ? '' : 'muted'} font-weight={r.strong ? 600 : 400}
						>{r.label}</text
					>
					<rect
						x={sw(Math.min(r.from, r.to))}
						{y}
						width={Math.max(2, Math.abs(sw(r.to) - sw(r.from)))}
						height="16"
						rx="3"
						fill={r.color}
						opacity={r.id === 'nu' ? 0.55 : 1}
					/>
					<text
						x={WX1}
						y={y - 6}
						text-anchor="end"
						font-weight="600"
						style:font-variant-numeric="tabular-nums">{r.value}</text
					>
				</g>
			</Readout>
		{/each}
		<Readout
			id="mass"
			order={20}
			label="Mass turned into energy"
			value="{(100 * lost).toFixed(3)}%"
			note="of the uranium and the neutron"
		>
			<text x={box.x0} y={530} font-weight="600"
				>Mass turned into energy: {(100 * lost).toFixed(3)}%</text
			>
		</Readout>
		<Readout
			id="gas"
			order={21}
			label="1 kg of uranium-235, split"
			value="≈ {fmtMillion(gasRatio)} kg of natural gas"
		>
			<text x={box.x0} y={556} class="muted"
				>1 kg of uranium-235, split, gives the heat of ≈ {fmtMillion(gasRatio)} kg of natural gas</text
			>
		</Readout>
	{/if}
</g>
