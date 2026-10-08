<script lang="ts">
	/**
	 * The periodic table (steps `table`, `trends`, `chemistry`). All 118 cells are drawn as a
	 * handful of `<path>`s (one per colour bucket) plus two `<text>`s each, to stay under the node
	 * budget. Phases cross-fade with tweens:
	 * - blocks: cells coloured by s/p/d/f, filling in atomic-number order (a pure function of t),
	 *   with braces marking the 2, 6, 10 and 14 columns of each block;
	 * - trends: a continuous low → high scale for the chosen property (`colourBy`), grey where the
	 *   data has no value, with a colour-bar legend and the two trend arrows;
	 * - chemistry: groups 1 (below hydrogen), 17 and 18 highlighted with their outer-electron counts.
	 * One focusable overlay (role slider) gives a keyboard cursor; hovering or focusing shows a card.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { clamp } from '#lib/draw/math.ts';
	import { toSvg } from '#lib/draw/pointer.ts';
	import { ELEMENTS, cell, element, outerShell, type Element as Elem } from '../atom';

	let { step, t, params, reduced }: StageProps = $props();

	// ------------------------------------------------------------ geometry
	const X0 = 84;
	const PX = 47;
	const CW = 44;
	const Y0 = 66;
	const PY = 48;
	const CH = 45;
	const F_GAP = 14;

	const rowY = (row: number) => Y0 + (row <= 7 ? row - 1 : row - 2) * PY + (row >= 9 ? F_GAP : 0);
	const colX = (col: number) => X0 + (col - 1) * PX;

	interface Cell {
		z: number;
		e: Elem;
		row: number;
		col: number;
		x: number;
		y: number;
	}
	const CELLS: Cell[] = ELEMENTS.map((e) => {
		const { row, col } = cell(e.z);
		return { z: e.z, e, row, col, x: colX(col), y: rowY(row) };
	});
	const GRID = new Map<string, number>(CELLS.map((c) => [`${c.row},${c.col}`, c.z]));
	const ROWS = [1, 2, 3, 4, 5, 6, 7, 9, 10];

	const rectPath = (x: number, y: number, w = CW, h = CH, r = 5) =>
		`M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
	const cellsPath = (list: Cell[]) => list.map((c) => rectPath(c.x, c.y)).join('');
	const ALL_PATH = cellsPath(CELLS);

	// ------------------------------------------------------------ phase
	type Phase = 'blocks' | 'trends' | 'chemistry';
	const phase = $derived((step.hints?.phase as Phase) ?? 'blocks');
	const opts = { duration: 700, easing: cubicInOut };
	const wB = new Tween(0, opts);
	const wT = new Tween(0, opts);
	const wC = new Tween(0, opts);
	let first = true;
	$effect(() => {
		const p = phase;
		untrack(() => {
			const o = first ? { duration: 0 } : {};
			first = false;
			wB.set(p === 'blocks' ? 1 : 0, o);
			wT.set(p === 'trends' ? 1 : 0, o);
			wC.set(p === 'chemistry' ? 1 : 0, o);
		});
	});

	// ------------------------------------------------------------ blocks: the filling sweep
	const BLOCKS = ['s', 'p', 'd', 'f'] as const;
	const SWEEP_START = 0.4;
	const SWEEP_TIME = 4.8;
	/** The atomic number the sweep has reached (fractional); everything when not animating. */
	const front = $derived(
		reduced || phase !== 'blocks' ? 200 : ((t - SWEEP_START) / SWEEP_TIME) * 120
	);
	const fillOf = (z: number) => clamp((front - z + 2) / 2);

	const blockPaths = $derived(
		BLOCKS.map((b) => ({
			b,
			d: cellsPath(CELLS.filter((c) => c.e.block === b && fillOf(c.z) >= 1))
		}))
	);
	const partial = $derived(CELLS.filter((c) => fillOf(c.z) > 0 && fillOf(c.z) < 1));
	const blockFill = (b: string) => `color-mix(in oklab, var(--atom-${b}) 34%, var(--stage-bg))`;

	/** The subshell an element's last electron went into, from its block (as in the data). */
	function subshell(e: Elem) {
		if (e.z <= 2) return '1s';
		const n = e.block === 'd' ? e.period - 1 : e.block === 'f' ? e.period - 2 : e.period;
		return `${n}${e.block}`;
	}
	const SEQUENCE = '1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p'.split(' ');
	const current = $derived(Math.max(1, Math.min(118, Math.floor(front))));
	const sweeping = $derived(phase === 'blocks' && !reduced && front < 120);
	const doneShells = $derived(
		new Set(CELLS.filter((c) => c.z <= current && front >= 1).map((c) => subshell(c.e)))
	);
	const currentShell = $derived(sweeping && front >= 1 ? subshell(element(current)) : '');

	// Braces: s over cols 1–2 and p over cols 13–18 above row 1; d over cols 3–12 above row 4;
	// f under cols 4–17 of the f rows (lanthanum and actinium, in col 3, are d elements).
	function brace(x1: number, x2: number, y: number, dir: 1 | -1) {
		const m = (x1 + x2) / 2;
		const h = 7 * dir;
		return `M${x1} ${y}q0 ${-h} 6 ${-h}H${m - 6}q6 0 6 ${-h}q0 ${h} 6 ${h}H${x2 - 6}q6 0 6 ${h}`;
	}
	const BRACES = [
		{ id: 's', x1: colX(1), x2: colX(2) + CW, y: rowY(1) - 5, dir: 1 as const, n: 2, z: 1 },
		{ id: 'p', x1: colX(13), x2: colX(18) + CW, y: rowY(1) - 5, dir: 1 as const, n: 6, z: 5 },
		{ id: 'd', x1: colX(3), x2: colX(12) + CW, y: rowY(4) - 5, dir: 1 as const, n: 10, z: 21 },
		{
			id: 'f',
			x1: colX(4),
			x2: colX(17) + CW,
			y: rowY(10) + CH + 5,
			dir: -1 as const,
			n: 14,
			z: 58
		}
	];

	// ------------------------------------------------------------ trends
	type Prop = 'radius' | 'ionization' | 'electronegativity';
	const PROPS: Record<Prop, { title: string; unit: string; across: string; down: string }> = {
		radius: {
			title: 'Atomic radius (covalent, pm)',
			unit: 'pm',
			across: 'smaller across a row',
			down: 'bigger down a group'
		},
		ionization: {
			title: 'First ionization energy (eV)',
			unit: 'eV',
			across: 'higher across a row',
			down: 'lower down a group'
		},
		electronegativity: {
			title: 'Electronegativity (Pauling scale)',
			unit: '',
			across: 'higher across a row',
			down: 'lower down a group'
		}
	};
	const RANGE = Object.fromEntries(
		(Object.keys(PROPS) as Prop[]).map((p) => {
			const v = ELEMENTS.map((e) => e[p]).filter((x): x is number => x !== null);
			return [p, { min: Math.min(...v), max: Math.max(...v) }];
		})
	) as Record<Prop, { min: number; max: number }>;
	const norm = (p: Prop, v: number) => (v - RANGE[p].min) / (RANGE[p].max - RANGE[p].min);

	const BUCKETS = 10;
	const bucketFill = (i: number) =>
		`color-mix(in oklab, var(--atom-high) ${Math.round(((i + 0.5) / BUCKETS) * 100)}%, var(--atom-low))`;
	const NODATA = 'color-mix(in oklab, var(--stage-line) 45%, var(--stage-bg))';

	function layer(p: Prop) {
		const groups: Cell[][] = Array.from({ length: BUCKETS + 1 }, () => []);
		for (const c of CELLS) {
			const v = c.e[p];
			groups[v === null ? BUCKETS : Math.min(BUCKETS - 1, Math.floor(norm(p, v) * BUCKETS))].push(
				c
			);
		}
		return groups.map((g, i) => ({
			i,
			fill: i === BUCKETS ? NODATA : bucketFill(i),
			d: cellsPath(g)
		}));
	}
	const LAYERS = {
		radius: layer('radius'),
		ionization: layer('ionization'),
		electronegativity: layer('electronegativity')
	};

	const prop = $derived(
		(['radius', 'ionization', 'electronegativity'].includes(String(params.colourBy))
			? params.colourBy
			: 'radius') as Prop
	);
	// Cross-fade the previous property's layer into the new one.
	let prevProp = $state<Prop>('radius');
	let curProp = $state<Prop>('radius');
	const mix = new Tween(1, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const p = prop;
		untrack(() => {
			if (p === curProp) return;
			prevProp = curProp;
			curProp = p;
			mix.set(0, { duration: 0 });
			mix.set(1);
		});
	});
	const shownProp = $derived(mix.current < 0.5 ? prevProp : curProp);
	const darkText = (c: Cell) => {
		const v = c.e[shownProp];
		return v !== null && norm(shownProp, v) > 0.55;
	};

	// ------------------------------------------------------------ chemistry
	const GROUPS = [
		{
			col: 1,
			color: 'var(--atom-s)',
			name: 'Group 1 · alkali metals',
			line: '1 outer electron: gives it away',
			example: 'sodium fizzes in water'
		},
		{
			col: 17,
			color: 'var(--atom-p)',
			name: 'Group 17 · halogens',
			line: '7 outer electrons: grabs one more',
			example: 'chlorine gas, Cl₂'
		},
		{
			col: 18,
			color: 'var(--atom-f)',
			name: 'Group 18 · noble gases',
			line: 'full outer shell: hardly reacts',
			example: 'neon in glowing signs'
		}
	];
	type Group = (typeof GROUPS)[number];
	const groupOf = (c: Cell): Group | undefined =>
		c.row <= 7 && c.z !== 1 ? GROUPS.find((g) => g.col === c.col) : undefined;
	const CHEM = GROUPS.map((g) => ({
		...g,
		d: cellsPath(CELLS.filter((c) => groupOf(c) === g))
	}));
	const OUTER_CELLS = CELLS.filter((c) => groupOf(c)).map((c) => ({
		c,
		n: outerShell(c.z).electrons
	}));

	// ------------------------------------------------------------ hover and keyboard cursor
	let hover = $state<number | null>(null);
	let cursor = $state(11);
	let focused = $state(false);
	const shown = $derived(hover ?? (focused ? cursor : null));

	function zAt(x: number, y: number) {
		for (const c of CELLS)
			if (x >= c.x - 1.5 && x <= c.x + CW + 1.5 && y >= c.y - 1.5 && y <= c.y + CH + 1.5)
				return c.z;
		return null;
	}
	function onmove(event: PointerEvent) {
		const p = toSvg(event, event.currentTarget as SVGElement);
		hover = zAt(p.x, p.y);
	}
	function ondown(event: PointerEvent) {
		const p = toSvg(event, event.currentTarget as SVGElement);
		const z = zAt(p.x, p.y);
		if (z) cursor = z;
	}
	function nearestInRow(row: number, col: number) {
		let best: number | null = null;
		let bd = Infinity;
		for (let c = 1; c <= 18; c++) {
			const z = GRID.get(`${row},${c}`);
			if (z && Math.abs(c - col) < bd) {
				bd = Math.abs(c - col);
				best = z;
			}
		}
		return best;
	}
	function onkeydown(event: KeyboardEvent) {
		const here = CELLS[cursor - 1];
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			const dir = event.key === 'ArrowRight' ? 1 : -1;
			for (let c = here.col + dir; c >= 1 && c <= 18 && next === null; c += dir)
				next = GRID.get(`${here.row},${c}`) ?? null;
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const i = ROWS.indexOf(here.row) + (event.key === 'ArrowDown' ? 1 : -1);
			if (i >= 0 && i < ROWS.length) next = nearestInRow(ROWS[i], here.col);
		} else if (event.key === 'Home') next = 1;
		else if (event.key === 'End') next = 118;
		else return;
		event.preventDefault();
		if (next) cursor = next;
	}

	// ------------------------------------------------------------ formatting
	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const prettyConfig = (config: string) =>
		config
			.split(/\s+/)
			.map((part) => {
				const m = /^(\d[spdf])(\d*)$/.exec(part);
				return m ? m[1] + [...(m[2] || '1')].map((d) => SUP[+d]).join('') : part;
			})
			.join(' ');
	const fmt = (v: number | null, digits: number, unit = '') =>
		v === null ? 'no data' : `${v.toFixed(digits)}${unit ? ' ' + unit : ''}`;
	const card = $derived.by(() => {
		if (shown === null) return null;
		const e = element(shown);
		return {
			e,
			rows: [
				['Configuration', prettyConfig(e.config)],
				['Atomic mass', e.mass === null ? 'no data' : `${+e.mass.toPrecision(5)} Da`],
				['Covalent radius', fmt(e.radius, 0, 'pm')],
				['Ionization energy', fmt(e.ionization, 2, 'eV')],
				['Electronegativity', fmt(e.electronegativity, 2)]
			]
		};
	});
	const shownCell = $derived(shown === null ? null : CELLS[shown - 1]);
	const cursorCell = $derived(CELLS[cursor - 1]);

	const textOpacity = (c: Cell) =>
		wB.current * (0.3 + 0.7 * fillOf(c.z)) + wT.current + wC.current * (groupOf(c) ? 1 : 0.4);

	// Gap above the d block (rows 1–3, cols 3–12) where phase notes and the card sit.
	const GX = colX(3) + 2;
	const GW = colX(12) + CW - GX - 2;
	const GY = Y0 + 4;
	const GC = GX + GW / 2;

	// Legend under the f rows.
	const LX = colX(5);
	const LW = 320;
	const LY = rowY(10) + CH + 34;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		rotate?: number;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		transform={opts.rotate === undefined ? undefined : `rotate(${opts.rotate} ${x} ${y})`}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<linearGradient id="table-bar" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" style:stop-color="var(--atom-low)" />
			<stop offset="1" style:stop-color="var(--atom-high)" />
		</linearGradient>
	</defs>

	<!-- every cell, empty -->
	<path
		d={ALL_PATH}
		style:fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-opacity="0.6"
		stroke-width="1"
	/>

	<!-- the lanthanide and actinide markers in group 3 -->
	{#each [6, 7] as row (row)}
		<rect
			x={colX(3) + 0.5}
			y={rowY(row) + 0.5}
			width={CW - 1}
			height={CH - 1}
			rx="5"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
			opacity="0.7"
		/>
		{@render txt(colX(3) + CW / 2, rowY(row) + 25, row === 6 ? '57–71' : '89–103', 10, {
			anchor: 'middle',
			muted: true,
			halo: false
		})}
	{/each}
	<path
		d="M{colX(3) + CW / 2} {rowY(7) + CH} V{rowY(9)}"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
		opacity="0.7"
	/>
	{@render txt(colX(3) - 10, rowY(9) + 26, 'lanthanides', 11, { anchor: 'end', muted: true })}
	{@render txt(colX(3) - 10, rowY(10) + 26, 'actinides', 11, { anchor: 'end', muted: true })}

	<!-- blocks layer -->
	{#if wB.current > 0.01}
		<g opacity={wB.current}>
			{#each blockPaths as bp (bp.b)}
				<path d={bp.d} style:fill={blockFill(bp.b)} style:stroke="var(--atom-{bp.b})" />
			{/each}
			{#each partial as c (c.z)}
				<path
					d={rectPath(c.x, c.y)}
					opacity={fillOf(c.z)}
					style:fill={blockFill(c.e.block)}
					style:stroke="var(--atom-{c.e.block})"
				/>
			{/each}
			{#each BRACES as br (br.id)}
				<g opacity={0.2 + 0.8 * fillOf(br.z)}>
					<path
						d={brace(br.x1, br.x2, br.y, br.dir)}
						fill="none"
						style:stroke="var(--atom-{br.id})"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					{@render txt(
						(br.x1 + br.x2) / 2,
						br.dir === 1 ? br.y - 11 : br.y + 22,
						`${br.id} block · ${br.n} columns`,
						12,
						{ anchor: 'middle', weight: 600 }
					)}
				</g>
			{/each}
			{@render txt(34, (rowY(1) + rowY(7) + CH) / 2, 'each row starts a new shell', 12, {
				anchor: 'middle',
				muted: true,
				rotate: -90
			})}
		</g>
	{/if}

	<!-- trends layer: the old property fades out as the new one fades in -->
	{#if wT.current > 0.01}
		<g opacity={wT.current}>
			{#if mix.current < 0.99}
				<g opacity={1 - mix.current}>
					{#each LAYERS[prevProp] as l (l.i)}
						<path d={l.d} style:fill={l.fill} stroke="var(--stage-line)" stroke-opacity="0.5" />
					{/each}
				</g>
			{/if}
			<g opacity={mix.current}>
				{#each LAYERS[curProp] as l (l.i)}
					<path d={l.d} style:fill={l.fill} stroke="var(--stage-line)" stroke-opacity="0.5" />
				{/each}
			</g>
		</g>
	{/if}

	<!-- chemistry layer -->
	{#if wC.current > 0.01}
		<g opacity={wC.current}>
			{#each CHEM as g (g.col)}
				<path
					d={g.d}
					style:fill="color-mix(in oklab, {g.color} 34%, var(--stage-bg))"
					style:stroke={g.color}
					stroke-width="1.5"
				/>
				{@render txt(colX(g.col) + CW / 2, Y0 - 8, `${g.col}`, 13, {
					anchor: 'middle',
					weight: 700,
					color: g.color
				})}
			{/each}
			<!-- the takeaway -->
			{@render txt(
				480,
				rowY(10) + CH + 36,
				'The layout follows from how electrons fill shells;',
				14,
				{ anchor: 'middle', weight: 600 }
			)}
			{@render txt(
				480,
				rowY(10) + CH + 56,
				'the chemistry is set by the outermost electrons.',
				14,
				{ anchor: 'middle', weight: 600 }
			)}
		</g>
	{/if}

	<!-- period numbers -->
	{#each [1, 2, 3, 4, 5, 6, 7] as row (row)}
		{@render txt(X0 - 10, rowY(row) + 26, `${row}`, 12, { anchor: 'end', muted: true })}
	{/each}

	<!-- symbols and atomic numbers -->
	<g style:pointer-events="none">
		{#each CELLS as c (c.z)}
			{@const ink = wT.current > 0.5 && darkText(c) ? 'var(--stage-bg)' : 'var(--stage-ink)'}
			{@const lift = groupOf(c) ? wC.current * 4 : 0}
			<g opacity={textOpacity(c)}>
				<text x={c.x + 4} y={c.y + 11} style:font-size="9px" style:fill={ink} opacity="0.75"
					>{c.z}</text
				>
				<text
					x={c.x + CW / 2}
					y={c.y + 29 - lift}
					text-anchor="middle"
					font-weight="600"
					style:font-size="15px"
					style:fill={ink}>{c.e.symbol}</text
				>
			</g>
		{/each}
		{#if wC.current > 0.01}
			{#each OUTER_CELLS as o (o.c.z)}
				<text
					x={o.c.x + CW / 2}
					y={o.c.y + 39}
					text-anchor="middle"
					font-weight="700"
					opacity={wC.current}
					style:font-size="10px">{o.n} e⁻</text
				>
			{/each}
		{/if}
	</g>

	<!-- trend arrows and legend -->
	{#if wT.current > 0.01}
		{@const P = PROPS[shownProp]}
		{@const R = RANGE[shownProp]}
		<g opacity={wT.current} style:pointer-events="none">
			<path
				d="M{colX(1)} {Y0 - 16} H{colX(18) + CW - 4}"
				stroke="var(--stage-ink)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
			{@render txt(480, Y0 - 25, P.across, 13, { anchor: 'middle', weight: 600 })}
			<path
				d="M52 {rowY(1)} V{rowY(7) + CH - 4}"
				stroke="var(--stage-ink)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
			{@render txt(40, (rowY(1) + rowY(7) + CH) / 2, P.down, 13, {
				anchor: 'middle',
				weight: 600,
				rotate: -90
			})}

			{@render txt(LX, LY - 8, P.title, 13, { weight: 600 })}
			<rect x={LX} y={LY} width={LW} height="12" rx="3" fill="url(#table-bar)" />
			{@render txt(LX, LY + 28, `${+R.min.toFixed(2)}${P.unit ? ' ' + P.unit : ''}`, 11, {
				muted: true
			})}
			{@render txt(LX + LW, LY + 28, `${+R.max.toFixed(2)}${P.unit ? ' ' + P.unit : ''}`, 11, {
				anchor: 'end',
				muted: true
			})}
			<rect
				x={LX + LW + 36}
				y={LY}
				width="22"
				height="12"
				rx="3"
				style:fill={NODATA}
				stroke="var(--stage-line)"
			/>
			{@render txt(LX + LW + 64, LY + 10, 'no data', 12, { muted: true })}
		</g>
	{/if}

	<!-- notes in the gap above the d block (hidden while the card is shown) -->
	{#if !card}
		<g style:pointer-events="none">
			{#if wB.current > 0.01}
				<g opacity={wB.current}>
					<text x={480} y={Y0 + 26} text-anchor="middle" style:font-size="13px">
						<tspan class="muted" style:font-size="12px">Filling order:</tspan>
						{#each SEQUENCE as s (s)}
							<tspan
								dx="6"
								font-weight={s === currentShell ? 800 : 600}
								style:fill="var(--atom-{s[1]})"
								opacity={!sweeping || doneShells.has(s) ? 1 : 0.3}>{s}</tspan
							>
						{/each}
					</text>
					{#if sweeping && front >= 1}
						{@const e = element(current)}
						{@render txt(
							GC,
							GY + 64,
							`${e.name} (Z = ${e.z}): last electron into ${subshell(e)}`,
							14,
							{ anchor: 'middle', weight: 600 }
						)}
					{:else if !sweeping}
						{@render txt(GC, GY + 56, 'Fill the subshells in order of atomic number', 13, {
							anchor: 'middle'
						})}
						{@render txt(GC, GY + 74, 'and the blocks build the shape of the table', 13, {
							anchor: 'middle'
						})}
					{/if}
					{@render txt(GC, GY + 96, 'Helium (1s²) is an s element, set above the noble gases', 11, {
						anchor: 'middle',
						muted: true
					})}
				</g>
			{/if}
			{#if wT.current > 0.01}
				<g opacity={wT.current}>
					{@render txt(GC, GY + 64, 'Hover or focus an element to read its value', 12, {
						anchor: 'middle',
						muted: true
					})}
				</g>
			{/if}
			{#if wC.current > 0.01}
				<g opacity={wC.current}>
					{#each GROUPS as g, i (g.col)}
						{@const y = GY + 22 + i * 38}
						<rect x={GX + 8} y={y - 11} width="12" height="12" rx="3" style:fill={g.color} />
						{@render txt(GX + 28, y, g.name, 13, { weight: 700 })}
						{@render txt(GX + 28, y + 17, `${g.line} (${g.example})`, 12, { muted: true })}
					{/each}
				</g>
			{/if}
		</g>
	{/if}

	<!-- card for the hovered or focused element -->
	{#if card}
		{@const e = card.e}
		<g style:pointer-events="none">
			<rect
				x={GX}
				y={GY}
				width={GW}
				height="106"
				rx="10"
				style:fill="var(--surface)"
				stroke="var(--border)"
			/>
			<text x={GX + 16} y={GY + 26} style:font-size="17px" font-weight="700"
				>{e.name}<tspan dx="8" class="muted" style:font-size="13px" font-weight="500"
					>{e.symbol} · Z = {e.z}</tspan
				></text
			>
			<rect
				x={GX + GW - 76}
				y={GY + 12}
				width="60"
				height="20"
				rx="10"
				style:fill={blockFill(e.block)}
				style:stroke="var(--atom-{e.block})"
			/>
			{@render txt(GX + GW - 46, GY + 26, `${e.block} block`, 11, {
				anchor: 'middle',
				weight: 600,
				halo: false
			})}
			{#each card.rows as r, i (r[0])}
				{@const cx = GX + 16 + (i % 2) * (GW / 2)}
				{@const cy = GY + 52 + Math.floor(i / 2) * 22}
				<text x={cx} y={cy} style:font-size="12px"
					><tspan class="muted">{r[0]}</tspan><tspan dx="6" font-weight="600">{r[1]}</tspan></text
				>
			{/each}
		</g>
	{/if}

	<!-- hovered / keyboard cell outline -->
	{#if shownCell}
		<rect
			x={shownCell.x - 1.5}
			y={shownCell.y - 1.5}
			width={CW + 3}
			height={CH + 3}
			rx="6"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			style:pointer-events="none"
		/>
	{/if}
	{#if focused}
		<rect
			x={cursorCell.x - 3}
			y={cursorCell.y - 3}
			width={CW + 6}
			height={CH + 6}
			rx="7"
			fill="none"
			stroke="var(--focus)"
			stroke-width="3"
			style:pointer-events="none"
		/>
	{/if}

	<!-- one focusable overlay for pointer and keyboard -->
	<rect
		x={X0 - 4}
		y={Y0 - 4}
		width={18 * PX + 4}
		height={rowY(10) + CH - Y0 + 8}
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Periodic table: arrow keys move between elements"
		aria-valuemin="1"
		aria-valuemax="118"
		aria-valuenow={cursor}
		aria-valuetext="{element(cursor).name}, {element(cursor).symbol}, atomic number {cursor}"
		style:outline="none"
		onpointermove={onmove}
		onpointerleave={() => (hover = null)}
		onpointerdown={ondown}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		{onkeydown}
	/>

	{@render txt(944, 584, 'Hover an element, or Tab here and use the arrow keys', 11, {
		anchor: 'end',
		muted: true
	})}
</g>
