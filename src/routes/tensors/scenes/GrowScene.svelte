<script lang="ts">
	/**
	 * One number grows into a vector, a matrix and a 3D block (steps scalar → block).
	 *
	 * The number of axes comes from `step.hints.axes` (0–3), or from `params.axes` on the block
	 * step, where the lengths come from `params.n0` (layers, deep), `n1` (rows, down) and `n2`
	 * (columns, across); the earlier steps use the defaults 2, 3, 4. Axes and lengths are tweened,
	 * so cells fade in one by one as an axis grows. Columns grow first, then rows, then layers:
	 * the newest axis is axis 0, as when NumPy stacks arrays.
	 *
	 * A cursor walks through every number in stored (row-major) order, one every 0.7 s, and the
	 * panel reads its indices: a tensor with k axes needs k indices to pick one number.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const C = 64; // cell size
	const DX = 34; // offset of each layer further back
	const DY = -28;
	const PX = 620; // panel

	const onBlock = $derived(step.id === 'block');
	const axes = $derived(
		onBlock ? clamp(Math.round(Number(params.axes ?? 3)), 0, 3) : Number(step.hints?.axes ?? 0)
	);
	const len = (id: string, def: number) =>
		onBlock ? clamp(Math.round(Number(params[id] ?? def)), 1, 5) : def;
	const nL = $derived(len('n0', 2));
	const nR = $derived(len('n1', 3));
	const nC = $derived(len('n2', 4));

	const opts = { duration: 800, easing: cubicInOut };
	const g = new Tween(0, opts);
	const tl = new Tween(2, opts);
	const tr = new Tween(3, opts);
	const tc = new Tween(4, opts);
	$effect(() => {
		const [a, l, r, c] = [axes, nL, nR, nC];
		untrack(() => {
			const o = { duration: reduced ? 0 : 800 };
			g.set(a, o);
			tl.set(l, o);
			tr.set(r, o);
			tc.set(c, o);
		});
	});
	/** Drawn lengths: an axis that isn't there yet has length 1. */
	const eC = $derived(1 + (tc.current - 1) * clamp(g.current, 0, 1));
	const eR = $derived(1 + (tr.current - 1) * clamp(g.current - 1, 0, 1));
	const eL = $derived(1 + (tl.current - 1) * clamp(g.current - 2, 0, 1));
	const shown = (L: number, i: number) => clamp(L - i, 0, 1);

	// Centre the block in the left part of the stage.
	const X0 = $derived(310 - (eC * C + (eL - 1) * DX) / 2);
	const Y0 = $derived(330 - (eR * C) / 2 - ((eL - 1) * DY) / 2);
	const cellAt = (l: number, r: number, c: number): Point => ({
		x: X0 + c * C + l * DX,
		y: Y0 + r * C + l * DY
	});

	/** A number for every cell (just digits to look at; cell [0, 0, 0] is 7). */
	const value = (l: number, r: number, c: number) =>
		(7 + 3 * c + 7 * r + 5 * l + c * c + r * c) % 10;

	const cells = $derived.by(() => {
		const out: { k: string; l: number; r: number; c: number; o: number; p: Point }[] = [];
		const L = Math.ceil(eL - 1e-6);
		const R = Math.ceil(eR - 1e-6);
		const K = Math.ceil(eC - 1e-6);
		for (let l = L - 1; l >= 0; l--)
			for (let r = 0; r < R; r++)
				for (let c = 0; c < K; c++) {
					const o = shown(eL, l) * shown(eR, r) * shown(eC, c);
					if (o > 0.01) out.push({ k: `${l}-${r}-${c}`, l, r, c, o, p: cellAt(l, r, c) });
				}
		return out;
	});

	// ---- the shape, as axes from 0 ----------------------------------------------------
	type Ax = { name: string; n: number; color: string; dir: 'deep' | 'down' | 'across' };
	const axisList = $derived.by(() => {
		const out: Ax[] = [];
		if (axes >= 3) out.push({ name: 'layers', n: nL, color: 'var(--tn-deep)', dir: 'deep' });
		if (axes >= 2) out.push({ name: 'rows', n: nR, color: 'var(--tn-down)', dir: 'down' });
		if (axes >= 1) out.push({ name: 'columns', n: nC, color: 'var(--tn-across)', dir: 'across' });
		return out;
	});
	const total = $derived(axisList.reduce((a, x) => a * x.n, 1));
	const kind = $derived(['a scalar', 'a vector', 'a matrix', 'a 3D block'][axes]);
	const letter = $derived(['s', 'v', 'M', 'B'][axes]);

	// ---- the cursor: every number in stored order ---------------------------------------
	const k = $derived(total > 1 ? Math.floor(t / 0.7) % total : 0);
	const idx = $derived.by(() => {
		const out: number[] = [];
		let rest = k;
		for (let a = axisList.length - 1; a >= 0; a--) {
			out[a] = rest % axisList[a].n;
			rest = Math.floor(rest / axisList[a].n);
		}
		return out;
	});
	const at = $derived({
		l: axes >= 3 ? idx[0] : 0,
		r: axes >= 2 ? idx[axes - 2] : 0,
		c: axes >= 1 ? idx[axes - 1] : 0
	});
	const cur = $derived(cellAt(at.l, at.r, at.c));
	const curValue = $derived(value(at.l, at.r, at.c));
	const settled = $derived(Math.abs(g.current - axes) < 0.02);

	// ---- axis arrows, with handles on the block step ---------------------------------
	const front = $derived({ x0: X0, x1: X0 + eC * C, y0: Y0, y1: Y0 + eR * C });
	const across = $derived({
		a: { x: front.x0, y: front.y1 + 24 },
		b: { x: front.x1, y: front.y1 + 24 }
	});
	const down = $derived({
		a: { x: front.x0 - 24, y: front.y0 },
		b: { x: front.x0 - 24, y: front.y1 }
	});
	const deep = $derived({
		a: { x: front.x1 + 14, y: front.y0 - 8 },
		b: { x: front.x1 + 14 + (eL - 1) * DX + DX, y: front.y0 - 8 + (eL - 1) * DY + DY }
	});
	const axisNo = (dir: Ax['dir']) => axisList.findIndex((a) => a.dir === dir);
	const op = (dir: Ax['dir']) =>
		dir === 'across'
			? clamp(g.current, 0, 1)
			: dir === 'down'
				? clamp(g.current - 1, 0, 1)
				: clamp(g.current - 2, 0, 1);

	function moveAcross(p: Point) {
		setParam('n2', clamp(Math.round((p.x - front.x0) / C), 1, 5));
	}
	function moveDown(p: Point) {
		setParam('n1', clamp(Math.round((p.y - front.y0) / C), 1, 5));
	}
	function moveDeep(p: Point) {
		// Project onto the layer direction, from the front face's top-right corner.
		const ux = DX / Math.hypot(DX, DY);
		const uy = DY / Math.hypot(DX, DY);
		const d = (p.x - (front.x1 + 14)) * ux + (p.y - (front.y0 - 8)) * uy;
		setParam('n0', clamp(Math.round(d / Math.hypot(DX, DY)), 1, 5));
	}
	const keyed = (id: string, n: number) => (s: number | 'start' | 'end') =>
		setParam(id, s === 'start' ? 1 : s === 'end' ? 5 : clamp(n + Math.sign(s), 1, 5));

	/** Indices for the panel, e.g. "[1, 0, 3]". */
	const idxText = $derived(axes === 0 ? '' : `[${idx.join(', ')}]`);
</script>

<g>
	<!-- the cells, back layers first -->
	{#each cells as cell (cell.k)}
		<g opacity={cell.o}>
			<rect
				x={cell.p.x}
				y={cell.p.y}
				width={C}
				height={C}
				rx="5"
				fill={cell.l === 0 ? 'var(--tn-cell)' : 'var(--tn-cell-back)'}
				stroke="var(--stage-line)"
				stroke-width="1.2"
			/>
			{#if cell.l === 0 || Math.ceil(eL - 1e-6) === 1}
				<text
					x={cell.p.x + C / 2}
					y={cell.p.y + C / 2 + 8}
					text-anchor="middle"
					style:font-size="22px"
					font-weight="600">{value(cell.l, cell.r, cell.c)}</text
				>
			{/if}
		</g>
	{/each}

	<!-- the cursor -->
	{#if settled}
		<rect
			x={cur.x + 2}
			y={cur.y + 2}
			width={C - 4}
			height={C - 4}
			rx="5"
			fill="none"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="4"
		/>
		{#if at.l > 0}
			<!-- a number in a back layer: show it on a badge -->
			<circle
				cx={cur.x + C - 4}
				cy={cur.y + 4}
				r="15"
				fill="var(--explainer-accent, var(--accent))"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<text
				x={cur.x + C - 4}
				y={cur.y + 10}
				text-anchor="middle"
				style:font-size="16px"
				style:fill="#fff"
				font-weight="700">{curValue}</text
			>
		{/if}
	{/if}

	<!-- the axes -->
	{#if op('across') > 0.01}
		<g opacity={op('across')}>
			<line
				x1={across.a.x}
				y1={across.a.y}
				x2={across.b.x}
				y2={across.b.y}
				stroke="var(--tn-across)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Readout id="ax-across">
				<T
					x={(across.a.x + across.b.x) / 2}
					y={across.a.y + 24}
					text="axis {axisNo('across')}: columns · {nC}"
					anchor="middle"
					color="var(--tn-across)"
					weight={600}
				/>
			</Readout>
		</g>
	{/if}
	{#if op('down') > 0.01}
		<g opacity={op('down')}>
			<line
				x1={down.a.x}
				y1={down.a.y}
				x2={down.b.x}
				y2={down.b.y}
				stroke="var(--tn-down)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Readout id="ax-down">
				<g transform="rotate(-90 {down.a.x - 12} {(down.a.y + down.b.y) / 2})">
					<T
						x={down.a.x - 12}
						y={(down.a.y + down.b.y) / 2}
						text="axis {axisNo('down')}: rows · {nR}"
						anchor="middle"
						color="var(--tn-down)"
						weight={600}
					/>
				</g>
			</Readout>
		</g>
	{/if}
	{#if op('deep') > 0.01}
		<g opacity={op('deep')}>
			<line
				x1={deep.a.x}
				y1={deep.a.y}
				x2={deep.b.x}
				y2={deep.b.y}
				stroke="var(--tn-deep)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Readout id="ax-deep">
				<T
					x={deep.b.x + 10}
					y={deep.b.y + 4}
					text="axis 0: layers · {nL}"
					color="var(--tn-deep)"
					weight={600}
				/>
			</Readout>
		</g>
	{/if}
	{#if onBlock}
		{#if axes >= 1}
			<Handle
				x={across.b.x}
				y={across.b.y}
				label="Length of the columns axis"
				value={nC}
				min={1}
				max={5}
				valuetext="{nC} columns"
				color="var(--tn-across)"
				onmove={moveAcross}
				onkey={keyed('n2', nC)}
			/>
		{/if}
		{#if axes >= 2}
			<Handle
				x={down.b.x}
				y={down.b.y}
				label="Length of the rows axis"
				value={nR}
				min={1}
				max={5}
				valuetext="{nR} rows"
				color="var(--tn-down)"
				onmove={moveDown}
				onkey={keyed('n1', nR)}
			/>
		{/if}
		{#if axes >= 3}
			<Handle
				x={deep.b.x}
				y={deep.b.y}
				label="Length of the layers axis"
				value={nL}
				min={1}
				max={5}
				valuetext="{nL} layers"
				color="var(--tn-deep)"
				onmove={moveDeep}
				onkey={keyed('n0', nL)}
			/>
		{/if}
	{/if}

	<!-- the panel -->
	<Readout
		id="shape"
		order={1}
		label="Shape"
		value={axes === 0 ? '()' : `(${axisList.map((a) => a.n).join(', ')}${axes === 1 ? ',' : ''})`}
		note="{kind}: {axes} ax{axes === 1 ? 'is' : 'es'}"
	>
		<T x={PX} y={90} text={kind} size={15} muted />
		<text x={PX} y={136} class="halo" style:font-size="34px" font-weight="700"
			>(<!--
			-->{#each axisList as a, i (a.dir)}<tspan style:fill={a.color}>{a.n}</tspan
				>{#if i < axisList.length - 1}<tspan>,&nbsp;</tspan>{/if}{/each}{#if axes === 1}<tspan
					>,</tspan
				>{/if}<!--
			-->)</text
		>
		<T x={PX} y={166} text="shape: {axes} ax{axes === 1 ? 'is' : 'es'}" size={14} />
	</Readout>
	<Readout
		id="count"
		order={2}
		label="Numbers"
		value={axes <= 1 ? String(total) : `${axisList.map((a) => a.n).join(' × ')} = ${total}`}
	>
		<T
			x={PX}
			y={222}
			text={axes === 0
				? '1 number'
				: axes === 1
					? `${total} number${total === 1 ? '' : 's'}`
					: `${axisList.map((a) => a.n).join(' × ')} = ${total} numbers`}
			size={16}
			weight={600}
		/>
	</Readout>
	<Readout
		id="pick"
		order={3}
		label="Pick one"
		value={axes === 0 ? `s = ${curValue}` : `${letter}${idxText} = ${curValue}`}
		note={axes === 0
			? 'no index needed'
			: `${axes} ind${axes === 1 ? 'ex' : 'ices'}: ${axisList.map((a) => a.name.replace(/s$/, '')).join(', ')}`}
	>
		<T x={PX} y={290} text="To pick one number:" size={14} muted />
		{#if axes === 0}
			<T x={PX} y={326} text="s = {curValue}" size={26} weight={700} />
			<T x={PX} y={354} text="no index needed" size={14} muted />
		{:else}
			<text x={PX} y={326} class="halo" style:font-size="26px" font-weight="700"
				>{letter}[<!--
				-->{#each axisList as a, i (a.dir)}<tspan style:fill={a.color}>{idx[i]}</tspan
					>{#if i < axisList.length - 1}<tspan>,&nbsp;</tspan>{/if}{/each}<!--
				-->] = {curValue}</text
			>
			<T
				x={PX}
				y={354}
				text="{axes} ind{axes === 1 ? 'ex' : 'ices'}: {axisList
					.map((a) => a.name.replace(/s$/, ''))
					.join(', ')}"
				size={14}
				muted
			/>
			<T x={PX} y={378} text="counted from 0" size={13} muted />
		{/if}
	</Readout>
	{#if onBlock}
		<Readout id="hint">
			<T x={PX} y={470} text="Drag the round handles at the ends" size={13} muted />
			<T x={PX} y={490} text="of the axes, or use the sliders." size={13} muted />
		</Readout>
	{/if}
</g>
