<script lang="ts">
	/**
	 * Two genes on one chromosome, params.dist centimorgans apart. Top left:
	 * the parent's two homologues (A B from one grandparent, a b from the
	 * other). Below: the first 80 of 2,000 gametes the model makes (a meiosis
	 * each, crossovers at random), each a little chromosome coloured by where
	 * its two genes came from; two-coloured ones are recombinants (ringed).
	 * They appear over the first ~2 s. Right: the recombinant share against
	 * distance, with Haldane's curve, the 50% ceiling, and this simulation's
	 * point. params.again breeds a new batch.
	 */
	import { Label, clamp, cycle, pathFrom, smoothstep } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { haldane, recombinants } from '../model';

	let { t, params }: StageProps = $props();

	const d = $derived(clamp(Number(params.dist ?? 20), 0, 200));
	const again = $derived(Number(params.again ?? 0));
	const N = 2000;
	const sim = $derived(recombinants(d / 100, N, 4242 + again * 7919));

	// Parent chromosomes.
	const X0 = 60;
	const X1 = 450;
	// Gene 2 sits at least a letter's width from gene 1, so both stay readable at 0 cM.
	const geneX = (k: 0 | 1) => X0 + 30 + (k ? 20 + (d / 200) * (X1 - X0 - 80) : 0);
	const colors = ['var(--mi-mom)', 'var(--mi-dad)'];
	const letters = [
		['A', 'B'],
		['a', 'b']
	];

	// Gamete grid.
	const grid = $derived(
		sim.gametes.slice(0, 80).map(([a, b], i) => ({
			i,
			x: 62 + (i % 8) * 50,
			y: 236 + Math.floor(i / 8) * 34,
			a,
			b,
			rec: a !== b,
			show: smoothstep(i * 0.022, i * 0.022 + 0.2, t)
		}))
	);
	const shownRec = $derived(grid.filter((g) => g.rec && g.show > 0.5).length);

	// Plot.
	const PX = 560;
	const PY = 470;
	const PW = 360;
	const PH = 330;
	const px = (cm: number) => PX + (cm / 200) * PW;
	const py = (r: number) => PY - (r / 0.6) * PH;
	const curve = pathFrom(
		Array.from({ length: 81 }, (_, i) => ({ x: px(i * 2.5), y: py(haldane((i * 2.5) / 100)) }))
	);
	const naive = pathFrom([
		{ x: px(0), y: py(0) },
		{ x: px(60), y: py(0.6) }
	]);
	const point = $derived(smoothstep(1.6, 2.2, t));
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
</script>

<g>
	<!-- the parent's pair -->
	<Readout id="parent" order={1} label="Parent" value="A B from one parent, a b from the other">
		<Label
			x={X0}
			y={52}
			text="the parent’s pair: A B from one of its parents, a b from the other"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>
	{#each [0, 1] as h (h)}
		{@const y = 92 + h * 36}
		<line
			x1={X0}
			x2={X1}
			y1={y}
			y2={y}
			stroke={colors[h]}
			stroke-width="14"
			stroke-linecap="round"
		/>
		{#each [0, 1] as k (k)}
			{@const gx = geneX(k as 0 | 1)}
			<rect x={gx - 8} y={y - 8} width="16" height="16" fill="var(--mi-band)" />
			<text
				x={gx}
				y={y + 5}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				font-style="italic"
				style:fill={colors[h]}>{letters[h][k]}</text
			>
		{/each}
	{/each}
	<line
		x1={geneX(0)}
		x2={geneX(1)}
		y1={160}
		y2={160}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>
	<Readout id="dist" order={2} label="Distance" value="{d} cM">
		<Label x={(geneX(0) + geneX(1)) / 2} y={178} text="{d} cM" size={12} weight={600} />
	</Readout>

	<!-- gametes -->
	<Readout id="gam" order={3} label="Recombinants among the first 80" value={String(shownRec)}>
		<Label
			x={X0}
			y={214}
			text="the first 80 of {N.toLocaleString('en-GB')} gametes · ringed: recombinant ({shownRec})"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>
	{#each grid as g (g.i)}
		<g opacity={g.show}>
			{#if g.rec}
				<rect
					x={g.x - 22}
					y={g.y - 12}
					width="44"
					height="24"
					rx="12"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
			{/if}
			<line
				x1={g.x - 14}
				x2={g.x}
				y1={g.y}
				y2={g.y}
				stroke={colors[g.a]}
				stroke-width="9"
				stroke-linecap="round"
			/>
			<line
				x1={g.x}
				x2={g.x + 14}
				y1={g.y}
				y2={g.y}
				stroke={colors[g.b]}
				stroke-width="9"
				stroke-linecap="round"
			/>
		</g>
	{/each}

	<!-- plot -->
	<line x1={PX} x2={PX + PW} y1={PY} y2={PY} stroke="var(--stage-line)" />
	<line x1={PX} x2={PX} y1={PY} y2={PY - PH} stroke="var(--stage-line)" />
	{#each [0, 50, 100, 150, 200] as cm (cm)}
		<text x={px(cm)} y={PY + 18} font-size="11" text-anchor="middle" class="muted">{cm}</text>
	{/each}
	{#each [0, 0.1, 0.2, 0.3, 0.4, 0.5] as r (r)}
		<text x={PX - 8} y={py(r) + 4} font-size="11" text-anchor="end" class="muted"
			>{Math.round(r * 100)}%</text
		>
	{/each}
	<Readout id="axes">
		<Label x={PX + PW / 2} y={PY + 40} text="distance between the genes (cM)" size={12} muted />
		<Label
			x={PX}
			y={PY - PH - 18}
			text="share of recombinant gametes"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>
	<line
		x1={PX}
		x2={PX + PW}
		y1={py(0.5)}
		y2={py(0.5)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
	/>
	<Readout id="ceiling">
		<Label x={PX + PW} y={py(0.5) - 8} text="never more than 50%" size={11} muted anchor="end" />
	</Readout>
	<path
		d={naive}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="2 4"
	/>
	<Readout id="naive">
		<Label x={px(52)} y={py(0.6) + 10} text="1 cM = 1%" size={11} muted anchor="start" />
	</Readout>
	<path d={curve} fill="none" stroke="var(--explainer-accent, var(--accent))" stroke-width="2.5" />
	<Readout
		id="haldane"
		order={4}
		label="Simulated"
		value="{pct(sim.fraction)} recombinant (Haldane: {pct(haldane(d / 100))})"
	>
		<circle cx={px(d)} cy={py(sim.fraction)} r="7" fill="var(--stage-ink)" opacity={point} />
		<circle
			cx={px(d)}
			cy={py(sim.fraction)}
			r={9 + 10 * cycle(t, 2)}
			fill="none"
			stroke="var(--stage-ink)"
			opacity={point * 0.6 * (1 - cycle(t, 2))}
		/>
		<Label
			x={d > 130 ? px(d) - 12 : px(d) + 12}
			y={py(sim.fraction) + (sim.fraction > 0.42 ? 24 : -12)}
			text="{pct(sim.fraction)} of {N.toLocaleString('en-GB')}"
			size={13}
			weight={600}
			anchor={d > 130 ? 'end' : 'start'}
			opacity={point}
		/>
	</Readout>
</g>
