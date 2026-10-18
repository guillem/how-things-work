<script lang="ts">
	/**
	 * The energy ladder: one bar per molecular orbital at α + xβ (β < 0, so larger x is lower),
	 * with its electrons as spin arrows, on an energy axis from α + 2β to α − 2β. A ring's levels
	 * sit at the corners of Frost's polygon inside a circle of radius 2|β|, which puts the two
	 * orbitals of a degenerate pair side by side. Clicking a bar selects its orbital.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Solution } from '../huckel';
	import { levelText, onKey } from './look';

	interface Props {
		sol: Solution;
		selected: number | null;
		onSelect?: (k: number) => void;
		/** Centre of the bars (and of Frost's circle). */
		cx?: number;
		/** Height of α, and drawing units per |β|. */
		y0?: number;
		s?: number;
		/** x of the energy axis. */
		axisX?: number;
		frost?: boolean;
		/** Draw the HOMO → LUMO arrow with this text. */
		gapText?: string | null;
	}
	let {
		sol,
		selected,
		onSelect,
		cx = 762,
		y0 = 300,
		s = 80,
		axisX = 572,
		frost = false,
		gapText = null
	}: Props = $props();

	const ring = $derived(sol.mol.ring && sol.mol.n >= 3);
	const showFrost = $derived(frost && ring);
	const n = $derived(sol.mol.n);
	const yOf = (x: number) => y0 + x * s;

	const bars = $derived.by(() => {
		const out = sol.orbitals.map((o, k) => {
			let x = cx;
			let w = 110;
			if (showFrost) {
				// Frost: corner m of the polygon standing on a vertex has x = 2cos(2πm/N).
				const lv = sol.orbitals.filter((p) => p.level === o.level);
				const first = sol.orbitals.findIndex((p) => p.level === o.level);
				const side = lv.length === 2 ? (k === first ? -1 : 1) : 0;
				const c = Math.max(-1, Math.min(1, o.x / 2));
				x = cx + side * 2 * s * Math.sqrt(1 - c * c);
				w = 40;
			}
			return { k, o, x, y: yOf(o.x), w };
		});
		return out;
	});
	/** Room between neighbouring levels, for the electrons' arrows. */
	const spacing = $derived.by(() => {
		const ys = [...new Set(bars.map((b) => Math.round(b.y * 10) / 10))].sort((a, b) => a - b);
		let m = Infinity;
		for (let i = 1; i < ys.length; i++) m = Math.min(m, ys[i] - ys[i - 1]);
		return m;
	});
	const arrowH = $derived(Math.max(5, Math.min(18, spacing * 0.8)));
	const tags = $derived.by(() => {
		const out: { k: string; x: number; y: number; text: string }[] = [];
		const add = (k: number, text: string) => {
			if (k < 0) return;
			const b = bars[k];
			const same = bars.filter((q) => q.o.level === b.o.level);
			const right = Math.max(...same.map((q) => q.x + q.w / 2));
			if (showFrost && same.length === 2) out.push({ k: text, x: cx, y: b.y + 4, text });
			else out.push({ k: text, x: right + 8, y: b.y + 4, text });
		};
		// A partly filled level holds the singly occupied orbitals (SOMOs).
		const homo = sol.homo >= 0 ? sol.orbitals[sol.homo] : null;
		const level = homo ? sol.orbitals.filter((o) => o.level === homo.level) : [];
		const inLevel = level.reduce((t, o) => t + o.occ, 0);
		const partly = inLevel < 2 * level.length;
		if (homo && partly && level.length === 2)
			add(sol.homo, inLevel === 2 ? 'half-filled pair' : 'partly filled pair');
		else add(sol.homo, homo && partly ? 'SOMO' : 'HOMO');
		if (sol.lumo >= 0 && !(homo && sol.orbitals[sol.lumo].level === homo.level))
			add(sol.lumo, 'LUMO');
		return out;
	});
	const ticks = [2, 1, 0, -1, -2];
	const polygon = $derived(
		Array.from({ length: n }, (_, m) => {
			const a = (2 * Math.PI * m) / n;
			return `${(cx + 2 * s * Math.sin(a)).toFixed(1)},${(y0 + 2 * s * Math.cos(a)).toFixed(1)}`;
		}).join(' ')
	);
	const arrow = (x: number, y: number, up: boolean) => {
		const h = arrowH / 2;
		const t = up ? y - h : y + h;
		const b = up ? y + h : y - h;
		const d = up ? 1 : -1;
		const hw = Math.min(4, arrowH * 0.3);
		return `M${x} ${b} L${x} ${t} M${x - hw} ${t + d * hw * 1.3} L${x} ${t} L${x + hw} ${t + d * hw * 1.3}`;
	};
	const homoBar = $derived(sol.homo >= 0 ? bars[sol.homo] : null);
	const lumoBar = $derived(sol.lumo >= 0 ? bars[sol.lumo] : null);
</script>

<g>
	<!-- energy axis -->
	<line
		x1={axisX}
		x2={axisX}
		y1={y0 + 2.25 * s}
		y2={y0 - 2.45 * s}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
	/>
	<path
		d="M{axisX - 5} {y0 - 2.45 * s + 8} L{axisX} {y0 - 2.45 * s} L{axisX + 5} {y0 - 2.45 * s + 8}"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
	/>
	<Label x={axisX + 8} y={y0 - 2.45 * s + 6} text="energy" size={11} muted anchor="start" />
	{#each ticks as v (v)}
		<line
			x1={axisX - 4}
			x2={axisX}
			y1={yOf(v)}
			y2={yOf(v)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
		/>
		<Label
			x={axisX - 8}
			y={yOf(v) + 4}
			text={levelText(v, 0).replace('1β', 'β')}
			size={11}
			muted
			anchor="end"
			tabular
		/>
	{/each}
	<line
		x1={axisX}
		x2={cx + 2 * s + 6}
		y1={y0}
		y2={y0}
		stroke="var(--stage-grid)"
		stroke-width="1"
		stroke-dasharray="3 4"
	/>

	{#if showFrost}
		<circle {cx} cy={y0} r={2 * s} fill="none" stroke="var(--stage-line)" stroke-dasharray="3 4" />
		<polygon
			points={polygon}
			fill="var(--hk-pos)"
			fill-opacity="0.05"
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
	{/if}

	<!-- levels -->
	{#each bars as b (b.k)}
		{@const on = selected === b.k}
		<g
			class="level"
			class:on
			role="button"
			tabindex={onSelect ? 0 : -1}
			aria-label="Orbital {b.k + 1}: {levelText(b.o.x)}, {b.o.occ} electron{b.o.occ === 1
				? ''
				: 's'}"
			aria-pressed={on}
			data-level={b.k + 1}
			onclick={() => onSelect?.(b.k)}
			onkeydown={(e) => onKey(e, () => onSelect?.(b.k))}
		>
			<rect x={b.x - b.w / 2 - 4} y={b.y - 9} width={b.w + 8} height="18" fill="transparent" />
			<rect
				x={b.x - b.w / 2}
				y={b.y - (on ? 2.5 : 1.5)}
				width={b.w}
				height={on ? 5 : 3}
				rx="1.5"
				fill={on ? 'var(--hk-electron)' : 'var(--stage-ink)'}
				opacity={on ? 1 : 0.8}
			/>
			{#if b.o.occ >= 1}
				<path
					d={arrow(b.x - (b.o.occ === 2 ? 8 : 0), b.y, true)}
					stroke="var(--hk-electron)"
					stroke-width="2"
					fill="none"
					stroke-linecap="round"
				/>
			{/if}
			{#if b.o.occ === 2}
				<path
					d={arrow(b.x + 8, b.y, false)}
					stroke="var(--hk-electron)"
					stroke-width="2"
					fill="none"
					stroke-linecap="round"
				/>
			{/if}
		</g>
	{/each}

	{#if gapText && homoBar && lumoBar && homoBar.y - lumoBar.y > 6}
		{@const ax = cx + 34}
		{@const tx = homoBar.x + homoBar.w / 2 + 8}
		<line
			x1={ax}
			x2={ax}
			y1={homoBar.y - 3}
			y2={lumoBar.y + 7}
			stroke="var(--hk-gap)"
			stroke-width="2.2"
		/>
		<path
			d="M{ax - 5} {lumoBar.y + 11} L{ax} {lumoBar.y + 3} L{ax + 5} {lumoBar.y + 11}"
			fill="none"
			stroke="var(--hk-gap)"
			stroke-width="2.2"
		/>
		<Readout id="ladder-gap">
			<Label
				x={tx}
				y={(homoBar.y + lumoBar.y) / 2 + 4}
				text={gapText}
				size={12}
				weight={600}
				anchor="start"
				color="var(--hk-gap)"
			/>
		</Readout>
	{/if}

	{#each tags as t (t.k)}
		<Readout id="ladder-tag-{t.k}">
			<Label
				x={t.x}
				y={t.y}
				text={t.text}
				size={11}
				weight={600}
				anchor={t.x === cx ? 'middle' : 'start'}
				muted
			/>
		</Readout>
	{/each}
</g>

<style>
	.level {
		cursor: pointer;
		outline: none;
	}
	.level:focus-visible rect:first-child {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
