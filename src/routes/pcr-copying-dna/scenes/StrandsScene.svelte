<script lang="ts">
	/**
	 * Every strand after the first cycles (`params.cycles_s`, 0–4), from the model's `Tube`: each
	 * double strand a pair of bars over the template's positions, coloured by kind (the original
	 * template, an overlong copy, exactly the target), with each copy's primer at its start. The
	 * strands the latest cycle made grow from their primers when the slider moves (a Tween). A
	 * table on the right counts the double strands and those exactly the target, cycle by cycle.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LAYOUT, Tube, kindOf, type Duplex, type Strand } from '../pcr';
	import { KIND_COLOR } from './shared';

	let { params, reduced }: StageProps = $props();

	const MAX = 4;
	const n = $derived(Math.max(0, Math.min(MAX, Math.round(Number(params.cycles_s ?? 3)))));

	/** The tube after each cycle, 0…MAX. */
	const tubes = (() => {
		const out: { duplexes: Duplex[]; total: number; exact: number }[] = [];
		const tube = new Tube(LAYOUT);
		for (let c = 0; c <= MAX; c++) {
			out.push({
				duplexes: [...tube.duplexes],
				total: tube.duplexes.length,
				exact: tube.targetDuplexes()
			});
			tube.step();
		}
		return out;
	})();

	const rank = (d: Duplex) => {
		const k = [kindOf(d.top, LAYOUT), kindOf(d.bottom, LAYOUT)];
		if (k.includes('original')) return 0;
		if (k.includes('long')) return 1;
		return 2;
	};
	const rows = $derived(
		tubes[n].duplexes
			.map((d, i) => ({ d, i, r: rank(d), s: d.top.from * 1000 + d.bottom.to }))
			.sort((p, q) => p.r - q.r || p.s - q.s || p.i - q.i)
	);

	const grow = new Tween(1, { duration: 1200, easing: cubicOut });
	$effect(() => {
		void n;
		untrack(() => {
			if (reduced) {
				void grow.set(1, { duration: 0 });
				return;
			}
			void grow.set(0, { duration: 0 });
			void grow.set(1);
		});
	});

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 70;
	const W = 440;
	const { length: L, a, b, lf, lr } = LAYOUT;
	const x = (pos: number) => X0 + (pos / L) * W;
	const TOP = 96;
	const BOTTOM = 548;
	const pitch = $derived(Math.min(46, (BOTTOM - TOP) / Math.max(1, rows.length)));
	const GAP = 5;

	/** The drawn extent of a strand: a new one grows from its primer. */
	function extent(s: Strand): [number, number] {
		if (s.born !== n || n === 0) return [s.from, s.to];
		const g = grow.current;
		return s.sense === 'top'
			? [s.from, s.from + lf + (s.to - s.from - lf) * g]
			: [s.to - lr - (s.to - s.from - lr) * g, s.to];
	}
	const primerPart = (s: Strand): [number, number] | null =>
		s.born === 0 ? null : s.sense === 'top' ? [s.from, s.from + lf] : [s.to - lr, s.to];

	const TX = 580;
	const current = $derived(tubes[n]);
</script>

<g>
	<!-- primer sites -->
	{#each [{ pos: a, w: lf, text: 'forward primer site' }, { pos: b - lr, w: lr, text: 'reverse primer site' }] as site (site.text)}
		<rect
			x={x(site.pos)}
			y={TOP - 14}
			width={x(site.pos + site.w) - x(site.pos)}
			height={BOTTOM - TOP + 18}
			fill="var(--pcr-primer)"
			opacity="0.08"
		/>
		<Readout id="site-{site.pos}">
			<Label
				x={x(site.pos + site.w / 2)}
				y={TOP - 26}
				text={site.text}
				size={12}
				muted
				anchor="middle"
			/>
		</Readout>
	{/each}
	<Readout id="title" order={1} label="After cycle {n}" value="{current.total} double strands">
		<Label
			anchor="start"
			x={X0 - 40}
			y={44}
			text="After cycle {n}: {current.total} double strand{current.total === 1 ? '' : 's'}"
			size={16}
			weight={700}
		/>
	</Readout>

	{#each rows as row, j (row.i)}
		{@const y = TOP + (j + 0.5) * pitch}
		{#each [row.d.top, row.d.bottom] as s, k (k)}
			{@const e = extent(s)}
			{@const yy = y + (k === 0 ? -GAP / 2 - 1 : GAP / 2 + 1)}
			{@const pp = primerPart(s)}
			<line
				x1={x(e[0])}
				x2={x(e[1])}
				y1={yy}
				y2={yy}
				stroke={KIND_COLOR[kindOf(s, LAYOUT)]}
				stroke-width={pitch > 20 ? 3.5 : 3}
				stroke-linecap="round"
			/>
			{#if pp}
				<line
					x1={x(pp[0])}
					x2={x(pp[1])}
					y1={yy}
					y2={yy}
					stroke="var(--pcr-primer)"
					stroke-width={pitch > 20 ? 3.5 : 3}
				/>
			{/if}
		{/each}
		{#if rank(row.d) === 2}
			<Readout id="exact-{row.i}">
				<Label
					anchor="start"
					x={x(b) + 8}
					y={y + 4}
					text="exact"
					size={11}
					color="var(--pcr-target)"
					weight={600}
					halo={false}
				/>
			</Readout>
		{/if}
	{/each}

	<!-- the table -->
	<Readout id="table">
		<rect
			x={TX}
			y={96}
			width={340}
			height={250}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label anchor="start" x={TX + 20} y={126} text="cycle" size={12} muted halo={false} />
		<Label x={TX + 170} y={126} text="double strands" size={12} muted halo={false} anchor="end" />
		<Label
			x={TX + 320}
			y={126}
			text="exactly the target"
			size={12}
			muted
			halo={false}
			anchor="end"
		/>
		{#each tubes as row, c (c)}
			{@const yy = 160 + c * 40}
			{#if c === n}
				<rect
					x={TX + 8}
					y={yy - 22}
					width={324}
					height={32}
					rx="8"
					fill="var(--pcr-target)"
					opacity="0.12"
				/>
			{/if}
			<Label
				anchor="start"
				x={TX + 26}
				y={yy}
				text={String(c)}
				size={15}
				weight={c === n ? 700 : 500}
				halo={false}
				tabular
			/>
			<Label
				x={TX + 170}
				y={yy}
				text={String(row.total)}
				size={15}
				weight={c === n ? 700 : 500}
				anchor="end"
				halo={false}
				tabular
			/>
			<Label
				x={TX + 320}
				y={yy}
				text={String(row.exact)}
				size={15}
				weight={c === n ? 700 : 500}
				anchor="end"
				halo={false}
				tabular
				color={row.exact > 0 ? 'var(--pcr-target)' : undefined}
			/>
		{/each}
	</Readout>
	<Readout
		id="exact"
		order={2}
		label="Exactly the target"
		value="{current.exact} of {current.total}"
		color="var(--pcr-target)"
	/>

	<!-- the key -->
	<Readout
		id="key"
		label="Grey: the original template; amber: overlong copies; violet: exactly the target; blue: a copy's primer"
	>
		{#each [{ c: 'var(--pcr-template)', t: 'original template' }, { c: 'var(--pcr-long)', t: 'overlong copy' }, { c: 'var(--pcr-target)', t: 'exactly the target' }, { c: 'var(--pcr-primer)', t: 'primer (part of the copy)' }] as item, i (item.t)}
			{@const yy = 392 + i * 30}
			<line
				x1={TX + 10}
				x2={TX + 40}
				y1={yy - 4}
				y2={yy - 4}
				stroke={item.c}
				stroke-width="3.5"
				stroke-linecap="round"
			/>
			<Label anchor="start" x={TX + 50} y={yy} text={item.t} size={13} halo={false} />
		{/each}
	</Readout>
</g>
