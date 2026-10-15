<script lang="ts">
	/**
	 * Step "yogurt": the 2007 experiment, schematically. Left, a dish with a
	 * lawn of the chosen bacterium and phage 858 spread on it: where the phage
	 * kills, clear holes (plaques) grow. Right, the four bacteria with their
	 * arrays: the original strain, a survivor with two new spacers at the front,
	 * the survivor with them removed, and the original strain given them.
	 * Whether a strain resists comes from the model (`immune`).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { TAU, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PHAGE_858, immune, strainArray, type Strain } from '../model';
	import ArrayStrip, { type StripSpacer } from './ArrayStrip.svelte';
	import Tag from './Tag.svelte';

	let { t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);

	const ROWS: { s: Strain; name: string }[] = [
		{ s: 'wt', name: 'The original strain' },
		{ s: 'bim', name: 'A survivor of phage 858' },
		{ s: 'removed', name: 'The survivor, new spacers removed' },
		{ s: 'added', name: 'The original strain, new spacers added' }
	];
	const strain = $derived((params.strain as Strain) ?? 'bim');

	const stripOf = (s: Strain): StripSpacer[] => {
		const { array, removed } = strainArray(s);
		const ghosts: StripSpacer[] = Array.from({ length: removed }, (_, i) => ({
			key: `gone${i}`,
			color: 'none',
			ghost: true
		}));
		return [
			...ghosts,
			...array.spacers.map((sp, i) => ({
				key: `${sp.source}-${i}`,
				label: sp.source.startsWith('new') ? 'new' : '',
				color: sp.source.startsWith('new') ? 'var(--cr-phage)' : 'var(--cr-repeat)'
			}))
		];
	};
	const RESULT = new Map(ROWS.map((r) => [r.s, immune(strainArray(r.s).array, PHAGE_858)]));
	const resistant = $derived(RESULT.get(strain) ?? false);

	// the dish
	const D = { x: 240, y: 330, r: 170 };
	const PLAQUES = Array.from({ length: 26 }, (_, i) => {
		const a = hash(i, 1) * TAU;
		const rr = Math.sqrt(hash(i, 2)) * (D.r - 26);
		return {
			k: i,
			x: D.x + Math.cos(a) * rr,
			y: D.y + Math.sin(a) * rr,
			d: 1 + hash(i, 3) * 4,
			s: 0.7 + hash(i, 4) * 0.6
		};
	});
	const LAWN = Array.from({ length: 160 }, (_, i) => {
		const a = hash(i, 7) * TAU;
		const rr = Math.sqrt(hash(i, 8)) * (D.r - 8);
		return { k: i, x: D.x + Math.cos(a) * rr, y: D.y + Math.sin(a) * rr };
	});
	/** Plaques grow from the step's start, and again (over 8 s of wall time) whenever the strain changes. */
	const regrow = new Tween(0, { duration: 8000 });
	let changed = $state(false);
	let first = true;
	$effect(() => {
		void strain;
		untrack(() => {
			if (first) {
				first = false;
				return;
			}
			changed = true;
			regrow.set(0, { duration: 0 });
			regrow.set(8, { duration: reduced ? 0 : 8000 });
		});
	});
	const clock = $derived(reduced ? 99 : changed ? regrow.current : time);
	const plaqueR = (p: (typeof PLAQUES)[number]) =>
		resistant ? 0 : 15 * p.s * smoothstep(p.d, p.d + 3, clock);
	const verdict = $derived(
		resistant
			? 'lawn intact: phage 858 cannot multiply here'
			: 'clear holes: phage 858 kills these bacteria'
	);
</script>

<g>
	<Readout
		id="title"
		order={0}
		label="Phage 858 on a lawn"
		value="{ROWS.find((r) => r.s === strain)?.name}: {resistant ? 'resistant' : 'sensitive'}"
	>
		<Tag x={D.x} y={70} text="Phage 858 spread on a lawn of bacteria" size={14} weight={600} />
		<Tag x={D.x} y={92} text={ROWS.find((r) => r.s === strain)?.name ?? ''} size={13} muted />
	</Readout>
	<circle
		cx={D.x}
		cy={D.y}
		r={D.r + 8}
		fill="var(--cr-dish)"
		stroke="var(--border)"
		stroke-width="2"
	/>
	<circle
		cx={D.x}
		cy={D.y}
		r={D.r}
		fill="var(--cr-lawn)"
		stroke="var(--cr-lawn-edge)"
		stroke-width="1.2"
	/>
	{#each LAWN as l (l.k)}
		<circle cx={l.x} cy={l.y} r={1.3} fill="var(--cr-lawn-edge)" opacity="0.6" />
	{/each}
	{#each PLAQUES as p (p.k)}
		{@const r = plaqueR(p)}
		{#if r > 0.3}
			<circle
				cx={p.x}
				cy={p.y}
				{r}
				fill="var(--cr-plaque)"
				stroke="var(--cr-lawn-edge)"
				stroke-width="0.8"
			/>
		{/if}
	{/each}
	<Readout
		id="verdict"
		order={1}
		label="Result"
		value={verdict}
		color={resistant ? 'var(--cr-match)' : 'var(--cr-mismatch)'}
	>
		<Tag
			x={D.x}
			y={540}
			text={verdict}
			size={13}
			weight={600}
			color={resistant ? 'var(--cr-match)' : 'var(--cr-mismatch)'}
		/>
	</Readout>

	<!-- the four strains -->
	<Readout id="rows-title" label="Strains">
		<Tag
			x={480}
			y={70}
			text="Their CRISPR arrays (schematic)"
			size={14}
			weight={600}
			anchor="start"
		/>
		<Tag x={480} y={92} text="red: new spacers matching phage 858" size={12} anchor="start" muted />
	</Readout>
	{#each ROWS as r, i (r.s)}
		{@const y = 150 + i * 102}
		{@const on = r.s === strain}
		{@const ok = RESULT.get(r.s)}
		<g opacity={on ? 1 : 0.5}>
			{#if on}
				<rect
					x={466}
					y={y - 34}
					width={478}
					height={88}
					rx={10}
					fill="var(--surface)"
					stroke="var(--border)"
				/>
			{/if}
			<Readout id="row{i}" order={2 + i} label={r.name} value={ok ? 'resistant' : 'sensitive'}>
				<Tag x={480} y={y - 12} text={r.name} size={13} weight={on ? 600 : 500} anchor="start" />
				<Tag
					x={928}
					y={y - 12}
					text={ok ? 'resistant' : 'sensitive'}
					size={13}
					weight={600}
					anchor="end"
					color={ok ? 'var(--cr-match)' : 'var(--cr-mismatch)'}
				/>
			</Readout>
			<ArrayStrip x={494} y={y + 24} spacers={stripOf(r.s)} scale={0.72} text={11} more />
		</g>
	{/each}
</g>
