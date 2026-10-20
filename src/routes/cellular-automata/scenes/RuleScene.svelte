<script lang="ts">
	/**
	 * One elementary rule: its eight-entry lookup table on top (clickable where the rule can be
	 * changed), the generations stacked below it, and beside them the live-cell count over time,
	 * what the rule does on a random ring, and its family.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { evolve, family, live, outcome, randomRow, settle, singleCell } from '../model';
	import { runs } from '../runs';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'table'));
	const editable = $derived(phase === 'table' || phase === 'families');
	const rule = $derived(Number(step.hints?.rule ?? params.rule ?? 90));
	const startKind = $derived(String(step.hints?.start ?? params.start ?? 'single'));
	const seed = $derived(1 + Number(params.reseed ?? 0));

	const W = 101;
	// 50 generations: a single cell's pattern just reaches the edges of the 101-cell ring.
	const G = 50;
	const rows = $derived(
		evolve(rule, startKind === 'random' ? randomRow(W, 0.5, seed) : singleCell(W), G - 1)
	);

	// Rows appear one after another, 20 a second; all at once with reduced motion.
	let t0 = $state(0);
	$effect(() => {
		void rows;
		void step.id;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	const shown = $derived(reduced ? G : Math.min(G, 1 + Math.floor(local * 20)));

	// ---- layout -------------------------------------------------------------------------------
	const X0 = 30;
	const CW = 6.4;
	const Y0 = 150;
	const CH = 8;
	const cells = $derived(runs(rows.slice(0, shown), X0, Y0, CW, CH));

	// ---- the table ----------------------------------------------------------------------------
	const TX = 40;
	const BOX = 14;
	const SLOT = 82;
	const table = $derived(
		[7, 6, 5, 4, 3, 2, 1, 0].map((k) => ({
			k,
			bits: [(k >> 2) & 1, (k >> 1) & 1, k & 1],
			out: outcome(rule, (k >> 2) & 1, (k >> 1) & 1, k & 1)
		}))
	);
	function flip(k: number) {
		if (editable) setParam('rule', rule ^ (1 << k));
	}
	function onKey(e: KeyboardEvent, k: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		flip(k);
	}

	// ---- side panel -----------------------------------------------------------------------------
	const PANEL = 700;
	const counts = $derived(rows.slice(0, shown).map(live));
	const maxCount = $derived(Math.max(1, ...rows.map(live)));
	const spark = $derived(
		counts
			.map(
				(n, i) =>
					`${i ? 'L' : 'M'}${(PANEL + (i / (G - 1)) * 220).toFixed(1)} ${(380 - (n / maxCount) * 90).toFixed(1)}`
			)
			.join(' ')
	);
	const behaviour = $derived(settle(rule));
	const fam = $derived(family(rule));
	const SAYS: Record<string, string> = {
		uniform: 'dies out (all one colour)',
		repeats: 'falls into a repeating cycle',
		'keeps changing': 'keeps changing for 1,000 generations'
	};
</script>

<g class="ca-rule">
	<!-- the lookup table -->
	{#each table as e, i (e.k)}
		{@const x = TX + i * SLOT}
		<g
			class:ca-flip={editable}
			role="button"
			tabindex={editable ? 0 : -1}
			aria-disabled={!editable}
			aria-label="Neighbourhood {e.bits.join('')}: next state {e.out}"
			onclick={() => flip(e.k)}
			onkeydown={(ev) => onKey(ev, e.k)}
		>
			<rect x={x - 6} y={18} width={3 * BOX + 12} height={78} rx="6" fill="transparent" />
			{#each e.bits as b, j (j)}
				<rect
					x={x + j * BOX}
					y={26}
					width={BOX - 2}
					height={BOX - 2}
					fill={b ? 'var(--ca-live)' : 'var(--stage-bg)'}
					stroke="var(--text-muted)"
				/>
			{/each}
			<rect
				x={x + BOX}
				y={26 + BOX + 4}
				width={BOX - 2}
				height={BOX - 2}
				fill={e.out ? 'var(--ca-live)' : 'var(--stage-bg)'}
				stroke={editable ? 'var(--ca-changing)' : 'var(--text-muted)'}
				stroke-width={editable ? 2 : 1}
			/>
			<Label
				x={x + 1.5 * BOX - 1}
				y={84}
				text={String(e.out)}
				anchor="middle"
				size={13}
				weight={700}
				tabular
			/>
		</g>
	{/each}
	<Readout id="ca-rule" order={1} label="Rule" value="{rule} = {rule.toString(2).padStart(8, '0')}">
		<Label
			x={TX}
			y={124}
			text="rule {rule} = {rule.toString(2).padStart(8, '0')} in binary, read along the table"
			anchor="start"
			size={14}
			weight={600}
			tabular
		/>
	</Readout>

	<!-- the generations -->
	<rect x={X0} y={Y0} width={W * CW} height={G * CH} fill="none" stroke="var(--border-strong)" />
	{#each cells as c, i (i)}
		<rect x={c.x} y={c.y} width={c.w} height={c.h} fill="var(--ca-live)" />
	{/each}
	<Label x={X0 + W * CW + 6} y={Y0 + 10} text="time ↓" anchor="start" size={11} muted />

	<!-- live cells over time -->
	<Readout
		id="ca-live"
		order={2}
		label="Live cells"
		value="{counts[counts.length - 1]} in generation {shown - 1}"
	>
		<Label x={PANEL} y={270} text="live cells per generation" anchor="start" size={12} muted />
		<line x1={PANEL} y1={380} x2={PANEL + 220} y2={380} stroke="var(--text-muted)" />
		<path d={spark} fill="none" stroke="var(--ca-changing)" stroke-width="2" />
		<Label
			x={PANEL + 220}
			y={398}
			text="{counts[counts.length - 1]} now"
			anchor="end"
			size={12}
			tabular
		/>
	</Readout>
	<Readout id="ca-behaviour" order={3} label="On a random ring" value={SAYS[behaviour.behaviour]}>
		<Label x={PANEL} y={176} text="on a random ring of 61 cells:" anchor="start" size={12} muted />
		<Label
			x={PANEL}
			y={198}
			text={SAYS[behaviour.behaviour]}
			anchor="start"
			size={13}
			weight={600}
			color={behaviour.behaviour === 'keeps changing' ? 'var(--ca-changing)' : undefined}
		/>
	</Readout>
	{#if phase === 'families'}
		<Readout id="ca-family" order={4} label="Family" value={fam.join(', ')}>
			<Label x={PANEL} y={436} text="family (mirror, swap):" anchor="start" size={12} muted />
			<Label
				x={PANEL}
				y={458}
				text={fam.join(' · ')}
				anchor="start"
				size={15}
				weight={700}
				tabular
			/>
		</Readout>
	{/if}
</g>

<style>
	.ca-flip {
		cursor: pointer;
		outline: none;
	}
	.ca-flip:focus-visible rect:first-child {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
