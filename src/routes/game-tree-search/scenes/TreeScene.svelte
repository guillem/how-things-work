<script lang="ts">
	/**
	 * The whole game tree below a noughts-and-crosses position with four squares left (the
	 * computer plays O and is to move): one row per move, boards for the first three rows and a
	 * score badge on every position (hover or tap one to see its board).
	 *
	 * Phases (`step.hints.phase`):
	 * - 'leaves': the ends of the games are scored one after another, win / draw / loss for the
	 *   computer; every other position still shows "?".
	 * - 'up': the scores pass up a row at a time (the best for the computer on its turns, the
	 *   worst for it on yours), then the line both sides play lights up.
	 * - 'prune': every score at once; with `params.prune` the positions alpha-beta never looks at
	 *   fade to grey and the scores of positions it abandoned become bounds (≤ or ≥).
	 *
	 * Under reduced motion every phase shows its finished frame.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Label, clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { outcome, searchTree, type TreeNode } from '../noughts';
	import { TREE_PRESETS } from '../presets';
	import MiniBoard from './MiniBoard.svelte';
	import { fmt, onKey, outcomeColor, outcomeLetter, outcomeOf, outcomeText } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'leaves'));
	const preset = $derived(TREE_PRESETS.find((p) => p.id === params.treePos) ?? TREE_PRESETS[0]);
	const pruneOn = $derived(phase === 'prune' && params.prune === true);
	const full = $derived(searchTree(preset.board));
	const cut = $derived(searchTree(preset.board, true));

	// ---- layout: leaves in equal slots, a parent centred over its children -------------
	const X0 = 170;
	const X1 = 944;
	const ROW_Y = [64, 176, 290, 400, 494];
	const BOARD = [62, 50, 36, 0, 0];

	interface Placed {
		id: string;
		node: TreeNode;
		cutNode: TreeNode;
		level: number;
		x: number;
		y: number;
		parent: number;
		/** Index among the leaves, in reading order (for the 'leaves' phase). */
		leaf: number;
		/** On the line both sides play. */
		main: boolean;
	}
	const layout = $derived.by(() => {
		const out: Placed[] = [];
		let leaves = 0;
		const countLeaves = (n: TreeNode): number =>
			n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
		const total = countLeaves(full);
		const slot = (X1 - X0) / total;
		const place = (
			n: TreeNode,
			c: TreeNode,
			level: number,
			parent: number,
			id: string,
			main: boolean
		): number => {
			const k = out.length;
			out.push({
				id,
				node: n,
				cutNode: c,
				level,
				x: 0,
				y: ROW_Y[level],
				parent,
				leaf: -1,
				main
			});
			if (!n.children.length) {
				out[k].x = X0 + slot * (leaves + 0.5);
				out[k].leaf = leaves++;
			} else {
				// The line both sides play: at each position, the first child with the parent's score.
				const pick = n.children.findIndex((ch) => ch.score === n.score);
				const xs = n.children.map((ch, i) =>
					place(ch, c.children[i], level + 1, k, `${id}.${ch.move}`, main && i === pick)
				);
				out[k].x = (out[xs[0]].x + out[xs[xs.length - 1]].x) / 2;
			}
			return k;
		};
		place(full, cut, 0, -1, 'r', true);
		return { nodes: out, leaves: total, slot };
	});

	// ---- what is shown, as a function of time -------------------------------------------
	const tt = $derived(reduced ? 1e6 : t);
	/** 0–1: how far the score of a position is shown. */
	function shown(p: Placed): number {
		if (phase === 'prune') return 1;
		if (phase === 'leaves') {
			if (p.leaf < 0) return 0;
			const at = 0.6 + (3.6 * p.leaf) / Math.max(1, layout.leaves - 1);
			return smoothstep(at, at + 0.35, tt);
		}
		// 'up': the leaves first, then one row at a time from the bottom.
		if (p.leaf >= 0) return 1;
		const at = 1 + (4 - p.level) * 1.25;
		return smoothstep(at, at + 0.5, tt);
	}
	const mainOn = $derived(phase === 'up' ? smoothstep(6.4, 7.2, tt) : phase === 'prune' ? 1 : 0);
	const rowOn = (level: number) =>
		phase === 'up' ? smoothstep(1 + (4 - level) * 1.25, 1.5 + (4 - level) * 1.25, tt) : 1;

	// Pruning fades in and out (the toggle), as a tween.
	const fade = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = pruneOn ? 1 : 0;
		untrack(() => fade.set(v, { duration: reduced ? 0 : 700 }));
	});

	/** Score badge of a position, from the computer's (O's) side. */
	function badge(p: Placed) {
		const usePruned = fade.current > 0.5;
		const n = usePruned ? p.cutNode : p.node;
		const oc = outcomeOf(-outcome(n.score));
		// X's lower bound is O's upper bound and the other way round.
		const bound = !usePruned || n.bound === 'exact' ? '' : n.bound === 'lower' ? '≤' : '≥';
		if (usePruned && !n.visited) return { oc, bound: '', text: '' };
		return { oc, bound, text: bound + outcomeLetter[oc] };
	}

	const visitedCount = $derived(layout.nodes.filter((p) => p.cutNode.visited).length);
	const dim = (p: Placed) => (p.cutNode.visited ? 1 : 1 - 0.78 * fade.current);

	// Edges, one path per kind.
	const edges = $derived.by(() => {
		let plain = '';
		let skipped = '';
		let main = '';
		for (const p of layout.nodes) {
			if (p.parent < 0) continue;
			const q = layout.nodes[p.parent];
			const y0 = q.y + (BOARD[q.level] ? BOARD[q.level] / 2 + 14 : 12);
			const y1 = p.y - (BOARD[p.level] ? BOARD[p.level] / 2 + 2 : 10);
			const d = `M${q.x} ${y0}L${p.x} ${y1}`;
			if (p.main) main += d;
			if (pruneOn && !p.cutNode.visited) skipped += d;
			else plain += d;
		}
		return { plain, skipped, main };
	});

	// Hover or tap a position to see its board.
	let hover = $state<string | null>(null);
	const inspected = $derived(layout.nodes.find((p) => p.id === hover) ?? null);

	const rows = [
		{ who: 'Now', role: 'computer (O) to move' },
		{ who: 'After 1 move', role: 'you (X) to move' },
		{ who: 'After 2 moves', role: 'computer (O) to move' },
		{ who: 'After 3 moves', role: 'you (X) to move' },
		{ who: 'After 4 moves', role: 'board full' }
	];
	const rule = (level: number) =>
		level === 4 ? '' : level % 2 === 0 ? 'takes the best for O' : 'assume the worst for O';
	const rootBest = $derived(full.children.find((c) => c.score === full.score)?.move ?? -1);
</script>

<g>
	<!-- row labels -->
	{#each rows as r, level (level)}
		{@const y = ROW_Y[level]}
		<Readout id="row-{level}">
			<Label x={20} y={y - 6} text={r.who} size={12} weight={700} anchor="start" />
			<Label x={20} y={y + 9} text={r.role} size={11} muted anchor="start" />
			{#if phase !== 'leaves' && rule(level)}
				<Label
					x={20}
					y={y + 24}
					text={rule(level)}
					size={11}
					weight={600}
					color={level % 2 === 0 ? 'var(--gt-win-text)' : 'var(--gt-loss-text)'}
					opacity={rowOn(level)}
					anchor="start"
				/>
			{/if}
		</Readout>
	{/each}

	<!-- edges -->
	<path d={edges.plain} stroke="var(--stage-line)" stroke-width="1.2" fill="none" />
	<path
		d={edges.skipped}
		stroke="var(--gt-pruned)"
		stroke-width="1.2"
		stroke-dasharray="3 3"
		fill="none"
		opacity={1 - 0.5 * fade.current}
	/>
	<path
		d={edges.main}
		stroke="var(--gt-o)"
		stroke-width="3.5"
		stroke-linecap="round"
		fill="none"
		opacity={0.85 * mainOn}
	/>

	<!-- positions -->
	{#each layout.nodes as p (p.id)}
		{@const size = BOARD[p.level]}
		{@const b = badge(p)}
		{@const s = shown(p)}
		{@const by = size ? p.y + size / 2 + 6 : p.y}
		{@const bw = b.bound ? 30 : 20}
		<g opacity={dim(p)}>
			{#if size}
				<MiniBoard
					x={p.x - size / 2}
					y={p.y - size / 2}
					{size}
					board={p.node.board}
					mark={p.node.move}
					outline={p.level === 1 && p.node.move === rootBest && mainOn > 0.5
						? 'var(--gt-o)'
						: undefined}
				/>
			{/if}
			<g
				class="node"
				role="button"
				tabindex="-1"
				aria-label="Position after square {p.node.move + 1}"
				onpointerenter={() => (hover = p.id)}
				onpointerleave={() => (hover = hover === p.id ? null : hover)}
				onclick={() => (hover = hover === p.id ? null : p.id)}
				onkeydown={(e) => onKey(e, () => (hover = hover === p.id ? null : p.id))}
			>
				<rect
					x={p.x - bw / 2}
					y={by - 9}
					width={bw}
					height="18"
					rx="9"
					fill={s > 0.5 ? outcomeColor[b.oc] : 'var(--surface)'}
					fill-opacity={s > 0.5 ? 0.2 + 0.1 * s : 1}
					stroke={s > 0.5 ? outcomeColor[b.oc] : 'var(--border-strong)'}
					stroke-width="1.2"
				/>
				<text
					x={p.x}
					y={by + 4}
					text-anchor="middle"
					font-size="11"
					font-weight="700"
					fill={s > 0.5 ? outcomeText[b.oc] : 'var(--stage-ink-muted)'}
					style:pointer-events="none">{s > 0.5 ? b.text : '?'}</text
				>
			</g>
		</g>
	{/each}

	<!-- inspector -->
	{#if inspected && BOARD[inspected.level] < 50}
		{@const ix = clamp(inspected.x - 50, 150, 840)}
		{@const iy = inspected.y > 300 ? inspected.y - 150 : inspected.y + 30}
		<g style:pointer-events="none">
			<rect
				x={ix - 8}
				y={iy - 8}
				width="116"
				height="124"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border-strong)"
			/>
			<MiniBoard
				x={ix + 8}
				y={iy}
				size={84}
				board={inspected.node.board}
				mark={inspected.node.move}
				card={false}
			/>
			<Label
				x={ix + 50}
				y={iy + 106}
				text={inspected.node.children.length ? 'game goes on' : 'game over'}
				size={11}
				muted
			/>
		</g>
	{/if}

	<!-- key and counts -->
	<Readout
		id="tree-key"
		order={1}
		label="Scores"
		value="W win · D draw · L loss, for the computer (O)"
	>
		<Label
			x={20}
			y={580}
			text="W win · D draw · L loss, for the computer (O)"
			size={12}
			anchor="start"
		/>
	</Readout>
	{#if phase === 'prune'}
		<Readout
			id="tree-count"
			order={2}
			label="Positions examined"
			value="{fmt(pruneOn ? visitedCount : layout.nodes.length)} of {layout.nodes.length}"
		>
			<Label
				x={944}
				y={580}
				text="Positions examined: {pruneOn ? visitedCount : layout.nodes.length} of {layout.nodes
					.length}"
				size={14}
				weight={700}
				anchor="end"
				tabular
			/>
		</Readout>
	{:else if phase === 'up'}
		<Readout
			id="tree-choice"
			order={2}
			label="The computer plays"
			value="square {rootBest + 1}: {outcomeOf(-outcome(full.score))}"
			opacity={mainOn}
		>
			<Label
				x={944}
				y={580}
				text="The only move that doesn't lose: a {outcomeOf(-outcome(full.score))}"
				size={13}
				weight={700}
				anchor="end"
				opacity={mainOn}
			/>
		</Readout>
	{:else}
		<Readout id="tree-leaves" order={2} label="Ends of the game" value="{layout.leaves} leaves">
			<Label
				x={944}
				y={580}
				text="{layout.leaves} ways the game can end from here"
				size={13}
				weight={600}
				anchor="end"
			/>
		</Readout>
	{/if}
</g>

<style>
	.node {
		outline: none;
		cursor: pointer;
	}
</style>
