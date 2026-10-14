<script lang="ts">
	/**
	 * Steps "link" and "krebs": pyruvate crosses into the matrix and
	 * pyruvate dehydrogenase turns it into CO₂, NADH and acetyl-CoA (left);
	 * the citric acid cycle as a wheel of its eight intermediates (right), each
	 * drawn as a chain of carbon beads with the carbon count from the model's
	 * `CITRIC_ACID_CYCLE` table, and the CO₂, NADH, FADH₂ and GTP of each enzyme
	 * released as a marker goes round. The tally counts what has happened on
	 * screen; reduced motion shows a finished turn.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Label,
		Flow,
		along,
		smooth,
		smoothstep,
		lerp,
		cycle,
		polar,
		pathFrom
	} from '#lib/draw/index.ts';
	import Carrier from '../Carrier.svelte';
	import { CITRIC_ACID_CYCLE, LINK, STAGES } from '../model';

	let { step, t, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'link'));

	const focus = new Tween(
		untrack(() => (phase === 'link' ? 0 : 1)),
		{ duration: 750, easing: cubicInOut }
	);
	$effect(() => {
		const target = phase === 'link' ? 0 : 1;
		untrack(() => focus.set(target, { duration: reduced ? 0 : 750 }));
	});
	const oLink = $derived(lerp(1, 0.4, focus.current));
	const oCycle = $derived(lerp(0.45, 1, focus.current));

	// ---- the link reaction ----------------------------------------------------------
	const MEMX = 150;
	const PDH = { x: 250, y: 200, r: 34 };
	const LINK_PERIOD = 6;
	const lu = $derived(reduced ? 0.62 : cycle(t, LINK_PERIOD));
	const pyrPath = smooth([
		{ x: 70, y: 200 },
		{ x: 160, y: 200 },
		{ x: PDH.x - PDH.r - 10, y: PDH.y }
	]);
	const acetylPath = smooth([
		{ x: PDH.x + 22, y: PDH.y - 28 },
		{ x: 320, y: 96 },
		{ x: 460, y: 70 },
		{ x: 530, y: 118 },
		{ x: 542, y: 158 }
	]);
	const fade = (u: number) => smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u));

	// ---- the wheel --------------------------------------------------------------------
	const CX = 600;
	const CY = 300;
	const R = 150;
	const deg = (d: number) => (d * Math.PI) / 180;
	const nodes = CITRIC_ACID_CYCLE.map((r, k) => {
		const a = -90 + 45 * k;
		const c = Math.cos(deg(a));
		const side = Math.abs(c) > 0.3;
		// Side nodes are labelled outside the ring, the top and bottom ones inside it.
		const lp = side ? polar(CX, CY, R + 40, deg(a)) : polar(CX, CY, R - 30, deg(a));
		const anchor: 'start' | 'middle' | 'end' = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
		return { k, r, a, p: polar(CX, CY, R, deg(a)), lp, anchor };
	});
	const ringD = (() => {
		const pts = Array.from({ length: 73 }, (_, i) => polar(CX, CY, R, deg(i * 5)));
		return pathFrom(pts);
	})();
	/** Outputs of each enzyme, released on the arc leading to its product. */
	interface Out {
		k: number;
		items: ('CO2' | 'NADH' | 'FADH2' | 'GTP')[];
	}
	const outs: Out[] = nodes
		.map((n) => ({
			k: n.k,
			items: [
				...(n.r.co2 ? (['CO2'] as const) : []),
				...(n.r.nadh ? (['NADH'] as const) : []),
				...(n.r.fadh2 ? (['FADH2'] as const) : []),
				...(n.r.atp ? (['GTP'] as const) : [])
			]
		}))
		.filter((o) => o.items.length > 0);
	/** Arc midpoint before node k, pushed outwards. */
	const outAt = (k: number, extra: number) =>
		polar(CX, CY, R + 44 + extra, deg(-90 + 45 * k - 22.5));

	const TURN = 16;
	const HOLD = 2;
	/** Position of the marker round the wheel, in nodes (0 = citrate, 8 = back to oxaloacetate…citrate). */
	const pos = $derived(
		reduced ? 8 : Math.min(8, (cycle(t, TURN + HOLD) * (TURN + HOLD) * 8) / TURN)
	);
	const marker = $derived(polar(CX, CY, R, deg(-90 + 45 * pos)));
	const passed = (k: number) => pos >= k - 0.5 + 0.01;
	const popOf = (k: number) => {
		const d = pos - (k - 0.5);
		return d < 0 ? 0 : smoothstep(0, 0.3, d);
	};
	const turnTally = $derived.by(() => {
		const out = { co2: 0, nadh: 0, fadh2: 0, gtp: 0 };
		for (const n of nodes) {
			if (!passed(n.k) || n.k === 0) continue;
			out.co2 += n.r.co2 ?? 0;
			out.nadh += n.r.nadh ?? 0;
			out.fadh2 += n.r.fadh2 ?? 0;
			out.gtp += n.r.atp ?? 0;
		}
		return out;
	});
	const total = {
		atp: STAGES.glycolysis.atp + STAGES.link.atp + STAGES.cycle.atp,
		nadh: STAGES.glycolysis.nadh + STAGES.link.nadh + STAGES.cycle.nadh,
		fadh2: STAGES.cycle.fadh2,
		co2: STAGES.link.co2 + STAGES.cycle.co2
	};
	const turnDone = $derived(pos >= 7.99);
</script>

<g class="cycle-scene">
	<!-- compartments: cytosol | two membranes | matrix -->
	<rect x={MEMX + 12} y="0" width={960 - MEMX - 12} height="600" fill="var(--ra-matrix)" />
	<rect
		x={MEMX - 10}
		y="0"
		width="8"
		height="600"
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
	/>
	<rect
		x={MEMX + 4}
		y="0"
		width="8"
		height="600"
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
	/>
	<Readout id="m">
		<Label x={24} y={36} text="cytosol" anchor="start" muted />
		<Label x={MEMX + 28} y={36} text="matrix" anchor="start" muted />
	</Readout>

	<!-- ================= link reaction ================= -->
	<g opacity={oLink}>
		<circle
			cx={PDH.x}
			cy={PDH.y}
			r={PDH.r}
			fill="var(--protein)"
			stroke="var(--protein-edge)"
			stroke-width="1.4"
			filter="url(#soft-shadow)"
		/>
		<text x={PDH.x} y={PDH.y + 4} text-anchor="middle" font-size="11" font-weight="700">PDH</text>
		<Readout
			id="pdh"
			order={5}
			label="Pyruvate dehydrogenase"
			value="pyruvate → acetyl-CoA + CO₂ + NADH"
			opacity={oLink}
		>
			<Label
				x={PDH.x}
				y={PDH.y + PDH.r + 20}
				text="pyruvate dehydrogenase"
				size={12}
				weight={600}
			/>
		</Readout>
		{#if lu < 0.45}
			{@const v = lu / 0.45}
			{@const p = along(pyrPath, v)}
			<Molecule kind="sugar" x={p.x} y={p.y} carbons={3} opacity={fade(v)} />
			<Label x={p.x} y={p.y - 16} text="pyruvate" size={11} opacity={fade(v)} />
		{:else}
			{@const v = (lu - 0.45) / 0.55}
			{@const p = along(acetylPath, v)}
			<Molecule kind="sugar" x={p.x} y={p.y} carbons={LINK.carbons} opacity={fade(v)} />
			<Label x={p.x} y={p.y - 16} text="acetyl-CoA" size={11} opacity={fade(v)} />
			<Molecule kind="CO2" x={PDH.x - 30 - 30 * v} y={PDH.y - 46 - 70 * v} opacity={fade(v)} />
			<Carrier kind="NADH" x={PDH.x} y={PDH.y + 70 + 40 * v} opacity={fade(v)} />
		{/if}
		<Flow d={pathFrom(acetylPath)} width={1.2} dash={4} {t} speed={20} opacity={0.4} />
	</g>

	<!-- ================= the wheel ================= -->
	<g opacity={oCycle}>
		<path d={ringD} fill="none" stroke="var(--stage-line)" stroke-width="2" />
		{#each nodes as n (n.k)}
			{@const mid = polar(CX, CY, R, deg(n.a + 26))}
			<path
				d="M{mid.x} {mid.y} L{polar(CX, CY, R, deg(n.a + 28)).x} {polar(CX, CY, R, deg(n.a + 28))
					.y}"
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
			<Molecule kind="sugar" x={n.p.x} y={n.p.y} carbons={n.r.carbons} />
			<Readout id="node-{n.k}">
				<Label
					x={n.lp.x}
					y={n.lp.y + 4}
					text="{n.r.product} ({n.r.carbons} C)"
					anchor={n.anchor}
					size={11}
				/>
			</Readout>
		{/each}
		<!-- acetyl joins oxaloacetate -->
		<Label x={CX} y={CY - 6} text="citric acid cycle" size={14} weight={700} />
		<Label x={CX} y={CY + 14} text="one turn per acetyl" size={11} muted />

		<!-- the marker going round -->
		{#if !reduced}
			<circle
				cx={marker.x}
				cy={marker.y}
				r="30"
				fill="#10b981"
				opacity={0.18 * (1 - smoothstep(7.8, 8, pos))}
			/>
		{/if}

		<!-- outputs -->
		{#each outs as o (o.k)}
			{@const s = popOf(o.k)}
			{#each o.items as it, j (it)}
				{@const p = outAt(o.k, j * 4 + s * 10)}
				{@const y = p.y + (j - (o.items.length - 1) / 2) * 24}
				<g opacity={0.25 + 0.75 * s}>
					{#if it === 'CO2'}
						<Molecule kind="CO2" x={p.x} {y} />
					{:else}
						<Carrier kind={it} x={p.x} {y} />
					{/if}
				</g>
			{/each}
		{/each}
	</g>

	<!-- ================= tally ================= -->
	<rect
		x="24"
		y="412"
		width="316"
		height="172"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if phase === 'link'}
		<Label
			x={44}
			y={440}
			text="per pyruvate (two per glucose)"
			anchor="start"
			size={13}
			weight={600}
		/>
		<Readout id="l-co2" order={1} label="CO₂ released" value="1 (2 per glucose)">
			<text x="44" y="470" font-size="12" class="muted">CO₂ released</text>
			<text x="320" y="470" font-size="14" font-weight="600" text-anchor="end">1</text>
		</Readout>
		<Readout id="l-nadh" order={2} label="NADH made" value="1 (2 per glucose)">
			<text x="44" y="496" font-size="12" class="muted">NADH made</text>
			<text x="320" y="496" font-size="14" font-weight="600" text-anchor="end">1</text>
		</Readout>
		<Readout id="l-c" order={3} label="Carbon" value="3 C → 2 C (acetyl) + 1 C (CO₂)">
			<text x="44" y="522" font-size="12" class="muted">carbon</text>
			<text x="320" y="522" font-size="14" font-weight="600" text-anchor="end">3 C → 2 C + CO₂</text
			>
		</Readout>
	{:else}
		<Label x={44} y={440} text="this turn so far" anchor="start" size={13} weight={600} />
		<Readout
			id="c-co2"
			order={1}
			label="This turn"
			value="{turnTally.co2} CO₂ · {turnTally.nadh} NADH · {turnTally.fadh2} FADH₂ · {turnTally.gtp} GTP"
		>
			<text x="44" y="468" font-size="12" class="muted">CO₂ · NADH · FADH₂ · GTP</text>
			<text x="320" y="468" font-size="14" font-weight="600" text-anchor="end"
				>{turnTally.co2} · {turnTally.nadh} · {turnTally.fadh2} · {turnTally.gtp}</text
			>
		</Readout>
		<line x1="44" y1="486" x2="320" y2="486" stroke="var(--border)" />
		<Readout
			id="c-total"
			order={2}
			label="Whole glucose, so far"
			value="{total.co2} CO₂ out · {total.atp} ATP · {total.nadh} NADH · {total.fadh2} FADH₂"
			opacity={turnDone ? 1 : 0.4}
		>
			<g opacity={turnDone ? 1 : 0.35}>
				<text x="44" y="510" font-size="12" font-weight="600">whole glucose (2 turns), so far:</text
				>
				<text x="44" y="536" font-size="12" class="muted"
					>all {total.co2} carbons out as CO₂, ATP</text
				>
				<text x="320" y="536" font-size="14" font-weight="700" text-anchor="end" fill="#f97316"
					>{total.atp}</text
				>
				<text x="44" y="562" font-size="12" class="muted">loaded carriers: NADH · FADH₂</text>
				<text x="320" y="562" font-size="14" font-weight="700" text-anchor="end"
					>{total.nadh} · {total.fadh2}</text
				>
			</g>
		</Readout>
	{/if}
</g>
