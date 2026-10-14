<script lang="ts">
	/**
	 * A flat structural drawing of a `Structure` (structures.ts): bonds as lines (two or three
	 * for double and triple bonds, a circle inside an aromatic ring) and atoms as small balls
	 * with their symbols. `skeletal` draws the chemist's line drawing instead: carbons are
	 * the corners, hydrogens on carbon are left out, other atoms are written with their own
	 * hydrogens (OH, NH₂).
	 *
	 * Drawn at (cx, cy) with `unit` px per C–C bond. Optional handlers make atoms and bonds
	 * buttons (the builder uses them to move or remove its feature); `hotAtom` / `hotBond`
	 * highlight a drop target, `focus` marks the atoms of the functional group.
	 */
	import { freeDirections, withHydrogens, type SAtom, type Structure } from '../structures';
	import { ATOM } from '../look';

	interface Props {
		structure: Structure;
		cx: number;
		cy: number;
		unit: number;
		skeletal?: boolean;
		/** Emphasise the group's atoms (and its bonds). */
		focus?: boolean;
		hotAtom?: number | null;
		hotBond?: number | null;
		onAtom?: (i: number) => void;
		onBond?: (i: number) => void;
		atomLabel?: (i: number) => string | null;
		bondLabel?: (i: number) => string | null;
		/** Show carbon numbers (locants) next to the skeleton carbons. */
		numbers?: boolean;
		opacity?: number;
	}
	let {
		structure,
		cx,
		cy,
		unit,
		skeletal = false,
		focus = false,
		hotAtom = null,
		hotBond = null,
		onAtom,
		onBond,
		atomLabel,
		bondLabel,
		numbers = false,
		opacity = 1
	}: Props = $props();

	const full = $derived(withHydrogens(structure));
	const heavy = $derived(structure.atoms.length);
	const X = (x: number) => cx + x * unit;
	const Y = (y: number) => cy + y * unit;

	// Hydrogens on each heteroatom (for the skeletal labels "OH", "NH₂").
	const hOn = $derived(
		full.atoms.map(
			(_, i) =>
				full.bonds.filter(
					(b) =>
						(b.a === i && full.atoms[b.b].el === 'H') || (b.b === i && full.atoms[b.a].el === 'H')
				).length
		)
	);
	/** An atom of the functional group other than carbon and hydrogen (O, N, Cl). */
	/** Font size of the line drawing's atom labels. */
	const fs = $derived(Math.min(20, Math.max(12, 0.36 * unit)));
	const hetero = (a: SAtom) => !!a.group && a.el !== 'C' && a.el !== 'H';
	const ballR = (el: string) => (el === 'H' ? 0.17 : el === 'Cl' ? 0.25 : 0.22) * unit;

	const ringCentre = $derived.by(() => {
		const r = structure.aromatic;
		if (!r?.length) return null;
		const x = r.reduce((s, i) => s + structure.atoms[i].x, 0) / r.length;
		const y = r.reduce((s, i) => s + structure.atoms[i].y, 0) / r.length;
		const rad = Math.hypot(structure.atoms[r[0]].x - x, structure.atoms[r[0]].y - y);
		return { x, y, r: rad * 0.62 };
	});

	const shown = $derived(
		full.atoms
			.map((a, i) => ({ a, i }))
			.filter(({ a, i }) => {
				if (!skeletal) return true;
				if (a.el === 'H') return false;
				// A lone carbon (methane) still needs its symbol.
				if (a.el === 'C') return heavy === 1;
				return i >= 0;
			})
	);
	const bonds = $derived(
		full.bonds
			.map((b, i) => ({ b, i }))
			.filter(({ b }) => !skeletal || (full.atoms[b.a].el !== 'H' && full.atoms[b.b].el !== 'H'))
	);

	// Where each skeleton carbon's number goes: the middle of the widest gap between its bonds.
	const numberSpot = (i: number) => {
		const src = skeletal ? structure : full;
		const a = src.atoms[i];
		const taken = src.bonds
			.filter((b) => b.a === i || b.b === i)
			.map((b) => {
				const o = src.atoms[b.a === i ? b.b : b.a];
				return Math.atan2(o.y - a.y, o.x - a.x);
			});
		const th = taken.length ? freeDirections(taken, 1)[0] : -Math.PI / 2;
		const d = skeletal ? 0.34 : 0.4;
		return { x: X(a.x + d * Math.cos(th)), y: Y(a.y + d * Math.sin(th)) + 4 };
	};
	const sub = (n: number) => (n > 1 ? '₂₃₄'[n - 2] : '');
	const skelLabel = (i: number) => {
		const a = full.atoms[i];
		if (a.el === 'C') return `CH${sub(hOn[i])}`.replace(/CH$/, hOn[i] ? 'CH' : 'C');
		return hOn[i] ? `${a.el}H${sub(hOn[i])}` : a.el;
	};
	const onKey = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};
</script>

{#snippet atom(a: SAtom, i: number, x: number, y: number, r: number, ring: boolean | undefined)}
	{#if hotAtom === i}
		<circle cx={x} cy={y} r={r + 12} fill="var(--focus)" fill-opacity="0.25" />
	{/if}
	{#if skeletal}
		{@const label = skelLabel(i)}
		<rect
			x={x - label.length * 0.31 * fs}
			y={y - 0.56 * fs}
			width={label.length * 0.62 * fs}
			height={1.1 * fs}
			rx="4"
			fill="var(--stage-bg)"
		/>
		<text
			{x}
			y={y + 0.36 * fs}
			text-anchor="middle"
			font-weight="700"
			style:font-size="{fs}px"
			style:fill={a.el === 'C'
				? 'var(--stage-ink)'
				: ATOM[a.el].fill === '#f3f4f6'
					? 'var(--stage-ink)'
					: ATOM[a.el].edge}>{label}</text
		>
	{:else}
		{#if ring}
			<circle cx={x} cy={y} r={r + 4} fill="none" stroke="var(--cp-group)" stroke-width="2" />
		{/if}
		<circle cx={x} cy={y} {r} fill={ATOM[a.el].fill} stroke={ATOM[a.el].edge} stroke-width="1.3" />
		<text
			{x}
			y={y + r * 0.38}
			text-anchor="middle"
			font-weight="700"
			style:font-size="{Math.max(9, r * (a.el === 'Cl' ? 0.95 : 1.05))}px"
			style:fill={ATOM[a.el].ink}>{a.el}</text
		>
	{/if}
{/snippet}

<g {opacity}>
	<!-- bonds -->
	{#each bonds as { b, i } (i)}
		{@const p = full.atoms[b.a]}
		{@const q = full.atoms[b.b]}
		{@const dx = X(q.x) - X(p.x)}
		{@const dy = Y(q.y) - Y(p.y)}
		{@const l = Math.hypot(dx, dy) || 1}
		{@const nx = -dy / l}
		{@const ny = dx / l}
		{@const n = b.order >= 2.5 ? 3 : b.order >= 2 ? 2 : 1}
		{@const shrinkP = skeletal && p.el !== 'C' ? 0.24 * unit : 0}
		{@const shrinkQ = skeletal && q.el !== 'C' ? 0.24 * unit : 0}
		{@const x1 = X(p.x) + (dx / l) * shrinkP}
		{@const y1 = Y(p.y) + (dy / l) * shrinkP}
		{@const x2 = X(q.x) - (dx / l) * shrinkQ}
		{@const y2 = Y(q.y) - (dy / l) * shrinkQ}
		{@const isGroup = focus && ((!!p.group && !!q.group) || hetero(p) || hetero(q))}
		{@const hot = hotBond === i}
		{@const gap = Math.max(4, unit * 0.08)}
		<g style:pointer-events="none">
			{#if hot}
				<line
					{x1}
					{y1}
					{x2}
					{y2}
					stroke="var(--focus)"
					stroke-opacity="0.35"
					stroke-width={gap * 5}
					stroke-linecap="round"
				/>
			{/if}
			{#each Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * gap) as off (off)}
				<line
					x1={x1 + nx * off}
					y1={y1 + ny * off}
					x2={x2 + nx * off}
					y2={y2 + ny * off}
					stroke={isGroup ? 'var(--cp-group)' : 'var(--stage-ink-muted)'}
					stroke-width={isGroup ? 3 : 2.4}
					stroke-linecap="round"
				/>
			{/each}
		</g>
		{#if onBond && i < structure.bonds.length && bondLabel?.(i)}
			<line
				class="hit"
				{x1}
				{y1}
				{x2}
				{y2}
				stroke="transparent"
				stroke-width={Math.max(14, unit * 0.3)}
				role="button"
				tabindex="0"
				aria-label={bondLabel(i)}
				onclick={() => onBond(i)}
				onkeydown={(e) => onKey(e, () => onBond(i))}
			/>
		{/if}
	{/each}

	{#if ringCentre}
		<circle
			cx={X(ringCentre.x)}
			cy={Y(ringCentre.y)}
			r={ringCentre.r * unit}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2.4"
			style:pointer-events="none"
		/>
	{/if}

	<!-- atoms -->
	{#each shown as { a, i } (i)}
		{@const r = ballR(a.el)}
		{@const x = X(a.x)}
		{@const y = Y(a.y)}
		{@const interactive = !!onAtom && i < heavy && !!atomLabel?.(i)}
		{@const ring = focus && a.group && a.el !== 'H'}
		{#if interactive}
			<g
				class="hit"
				role="button"
				tabindex="0"
				aria-label={atomLabel?.(i)}
				onclick={() => onAtom?.(i)}
				onkeydown={(e) => onKey(e, () => onAtom?.(i))}
			>
				{@render atom(a, i, x, y, r, ring)}
				<circle cx={x} cy={y} r={Math.max(r + 6, 16)} fill="transparent" />
			</g>
		{:else}
			<g style:pointer-events="none">{@render atom(a, i, x, y, r, ring)}</g>
		{/if}
	{/each}

	{#if numbers}
		{#each structure.atoms as a, i (i)}
			{#if a.carbon && structure.atoms.length > 1}
				{@const spot = numberSpot(i)}
				<text
					x={spot.x}
					y={spot.y}
					class="halo"
					text-anchor="middle"
					style:font-size="11px"
					style:fill="var(--cp-number)"
					style:pointer-events="none">{a.carbon}</text
				>
			{/if}
		{/each}
	{/if}
</g>

<style>
	.hit {
		cursor: pointer;
		outline: none;
	}
	.hit:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
