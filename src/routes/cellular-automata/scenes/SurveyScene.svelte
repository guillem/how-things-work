<script lang="ts">
	/**
	 * All 256 rules as a 16 × 16 grid, each tile coloured by what the rule does to the same random
	 * ring (dies out, repeats, keeps changing), with the chosen rule's pattern beside it. The grid is
	 * one control: click a tile, or use the arrow keys.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { evolve, randomRow, settle, type Behaviour } from '../model';
	import { runs } from '../runs';

	let { params, setParam }: StageProps = $props();

	const rule = $derived(Number(params.rule ?? 90));
	const kinds: Behaviour[] = Array.from({ length: 256 }, (_, r) => settle(r).behaviour);
	const count = (k: Behaviour) => kinds.filter((x) => x === k).length;
	const COLOUR: Record<Behaviour, string> = {
		uniform: 'var(--ca-uniform)',
		repeats: 'var(--ca-repeats)',
		'keeps changing': 'var(--ca-changing)'
	};

	const GX = 30;
	const GY = 60;
	const T = 30;
	const tileX = (r: number) => GX + (r % 16) * T;
	const tileY = (r: number) => GY + Math.floor(r / 16) * T;

	function pick(e: PointerEvent) {
		const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement;
		const ctm = svg?.getScreenCTM();
		if (!ctm) return;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		const c = Math.floor((p.x - GX) / T);
		const r = Math.floor((p.y - GY) / T);
		if (c >= 0 && c < 16 && r >= 0 && r < 16) setParam('rule', r * 16 + c);
	}
	function onKey(e: KeyboardEvent) {
		const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -16, ArrowDown: 16 };
		if (!(e.key in d)) return;
		e.preventDefault();
		setParam('rule', Math.min(255, Math.max(0, rule + d[e.key])));
	}

	// The chosen rule's pattern, from the same random start as the survey uses.
	const preview = $derived(evolve(rule, randomRow(61, 0.5, 7), 79));
	const cells = $derived(runs(preview, 560, 110, 6, 4.5));
	const SAYS: Record<Behaviour, string> = {
		uniform: 'dies out',
		repeats: 'repeats',
		'keeps changing': 'keeps changing'
	};
</script>

<g class="ca-survey">
	{#each kinds as k, r (r)}
		<rect
			x={tileX(r) + 1}
			y={tileY(r) + 1}
			width={T - 2}
			height={T - 2}
			rx="3"
			fill={COLOUR[k]}
			opacity={r === rule ? 1 : 0.75}
		/>
		<Label
			x={tileX(r) + T / 2}
			y={tileY(r) + T / 2 + 4}
			text={String(r)}
			anchor="middle"
			size={9}
			halo={false}
			color={k === 'uniform' ? 'var(--text)' : '#fff'}
		/>
	{/each}
	<rect
		x={tileX(rule)}
		y={tileY(rule)}
		width={T}
		height={T}
		rx="4"
		fill="none"
		stroke="var(--text)"
		stroke-width="3"
	/>
	<rect
		class="ca-grid"
		x={GX}
		y={GY}
		width={16 * T}
		height={16 * T}
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Choose a rule (arrow keys move across and down the grid)"
		aria-valuemin={0}
		aria-valuemax={255}
		aria-valuenow={rule}
		onpointerdown={pick}
		onkeydown={onKey}
	/>

	<!-- legend and counts -->
	<Readout
		id="ca-counts"
		order={1}
		label="All 256 rules"
		value="{count('uniform')} die out, {count('repeats')} repeat, {count(
			'keeps changing'
		)} keep changing"
	>
		{#each ['uniform', 'repeats', 'keeps changing'] as k, i (k)}
			<rect
				x={GX + i * 160}
				y={GY - 36}
				width="14"
				height="14"
				rx="3"
				fill={COLOUR[k as Behaviour]}
			/>
			<Label
				x={GX + i * 160 + 20}
				y={GY - 24}
				text="{SAYS[k as Behaviour]}: {count(k as Behaviour)}"
				anchor="start"
				size={13}
				weight={600}
			/>
		{/each}
	</Readout>

	<!-- the chosen rule -->
	<Readout id="ca-pick" order={2} label="Rule {rule}" value={SAYS[kinds[rule]]}>
		<Label
			x={560}
			y={84}
			text="rule {rule}: {SAYS[kinds[rule]]}"
			anchor="start"
			size={16}
			weight={700}
			color={COLOUR[kinds[rule]]}
		/>
	</Readout>
	<rect
		x={560}
		y={110}
		width={61 * 6}
		height={80 * 4.5}
		fill="none"
		stroke="var(--border-strong)"
	/>
	{#each cells as c, i (i)}
		<rect x={c.x} y={c.y} width={c.w} height={c.h} fill="var(--ca-live)" />
	{/each}
</g>

<style>
	.ca-grid {
		cursor: pointer;
		outline: none;
	}
	.ca-grid:focus-visible {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
