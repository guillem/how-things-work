<script lang="ts">
	/**
	 * The photograph as a (48, 36, 3) block (steps image, slice, reshape, grey, average).
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   image   — the photo comes apart into its three channel layers (a function of t); a marker
	 *             picks a pixel (`params.row`, `params.col`) and the panel reads its 3 numbers
	 *   slice   — one index fixed along `params.sliceAxis` at `params.sliceAt`: the slice is
	 *             highlighted in the block and drawn beside it, with its shape
	 *   reshape — the stored list of numbers on top, read with the shape `params.shape`
	 *             below; a cursor walks through the first 48 numbers and is marked in both
	 *   grey    — the channel axis combined with the weights `params.wr/wg/wb`; a probe sweeps
	 *             along row 24 and the panel works out its sum
	 *   average — the axes in `params.combine` averaged away, and what is left
	 *
	 * All pictures are data URLs computed from the real array (`pictures.ts`); they change only
	 * when a control does.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Handle, Label, type Point, smoothstep, VectorHandle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { get, num, shapeText } from '../tensor';
	import {
		H,
		W,
		TINTS,
		averageOf,
		channelGreyUrl,
		colourUrl,
		flatUrl,
		greyOf,
		photo,
		pixelListUrl,
		reshapedUrl,
		sliceOf,
		tintUrl,
		type Combine,
		type SliceAxis
	} from '../pictures';
	import Sheet from './Sheet.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phases = ['image', 'slice', 'reshape', 'grey', 'average'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'image') as Phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived(
		Object.fromEntries(phases.map((p) => [p, weights[p].current])) as Record<Phase, number>
	);

	const CH = ['red', 'green', 'blue'];
	const CH_COLOR = ['var(--tn-red)', 'var(--tn-green)', 'var(--tn-blue)'];
	const rgb = (r: number, g: number, b: number) =>
		`rgb(${Math.round(clamp(r, 0, 255))} ${Math.round(clamp(g, 0, 255))} ${Math.round(clamp(b, 0, 255))})`;
	const pix = (i: number, j: number) => [0, 1, 2].map((c) => get(photo, [i, j, c]));
	const PX = 744; // panel

	// ---- a slanted stack of the three channel layers ----------------------------------------
	interface Stack {
		x: number;
		y: number;
		a: number;
		b: number;
		c: number;
		sx: number;
		sy: number;
	}
	/** Top-left corner of layer d, and where pixel (column u, row v) of that layer lands. */
	const origin = (s: Stack, d: number): Point => ({ x: s.x + d * s.sx, y: s.y + d * s.sy });
	const at = (s: Stack, d: number, u: number, v: number): Point => {
		const o = origin(s, d);
		return { x: o.x + s.a * u, y: o.y + s.b * u + s.c * v };
	};
	/** A parallelogram over pixel columns u0…u1 and rows v0…v1 of layer d. */
	const band = (s: Stack, d: number, u0: number, u1: number, v0: number, v1: number) => {
		const p = [at(s, d, u0, v0), at(s, d, u1, v0), at(s, d, u1, v1), at(s, d, u0, v1)];
		return `M${p.map((q) => `${q.x} ${q.y}`).join(' L')} Z`;
	};
	/** The stack used by slice, grey and average. */
	const LEFT: Stack = { x: 56, y: 196, a: 3.3, b: -1.3, c: 6.4, sx: 112, sy: -22 };

	// ============================================================ phase image
	const row = $derived(clamp(Math.round(Number(params.row ?? 24)), 0, H - 1));
	const col = $derived(clamp(Math.round(Number(params.col ?? 22)), 0, W - 1));
	const P = 7;
	const PHOTO = { x: 40, y: 150 };
	const FINAL: Stack = { x: 336, y: 190, a: 3.5, b: -1.4, c: 6.6, sx: 124, sy: -22 };
	/** How far the layers have come out of the photo (0 → 1 between t = 0.6 and 2.2 s). */
	const apart = $derived(reduced ? 1 : smoothstep(0.6, 2.2, t));
	const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
	const moving = $derived<Stack>({
		x: lerp(PHOTO.x, FINAL.x, apart),
		y: lerp(PHOTO.y, FINAL.y, apart),
		a: lerp(P, FINAL.a, apart),
		b: lerp(0, FINAL.b, apart),
		c: lerp(P, FINAL.c, apart),
		sx: FINAL.sx * apart,
		sy: FINAL.sy * apart
	});
	const probe = $derived(pix(row, col));
	function movePixel(p: Point) {
		setParam('col', clamp(Math.floor((p.x - PHOTO.x) / P), 0, W - 1));
		setParam('row', clamp(Math.floor((p.y - PHOTO.y) / P), 0, H - 1));
	}
	function keyPixel(dx: number, dy: number) {
		// ← → move along the row, ↑ ↓ to the row above or below (Shift: 5 at a time).
		setParam('col', clamp(col + dx, 0, W - 1));
		setParam('row', clamp(row - dy, 0, H - 1));
	}

	// ============================================================ phase slice
	const sliceAxis = $derived(String(params.sliceAxis ?? 'channel') as SliceAxis);
	const sliceMax = $derived(sliceAxis === 'height' ? H - 1 : sliceAxis === 'width' ? W - 1 : 2);
	const sliceAt = $derived(clamp(Math.round(Number(params.sliceAt ?? 0)), 0, sliceMax));
	const sl = $derived(sliceOf(sliceAxis, sliceAt));
	const sliceCode = $derived(
		sliceAxis === 'channel'
			? `img[:, :, ${sliceAt}]`
			: sliceAxis === 'height'
				? `img[${sliceAt}, :, :]`
				: `img[:, ${sliceAt}, :]`
	);
	const sliceWhat = $derived(
		sliceAxis === 'channel'
			? `the ${CH[sliceAt]} layer`
			: sliceAxis === 'height'
				? `row ${sliceAt} of the picture`
				: `column ${sliceAt} of the picture`
	);
	const sliceHandle = $derived.by((): Point => {
		if (sliceAxis === 'channel') {
			const o = origin(LEFT, sliceAt);
			return { x: o.x + LEFT.a * W * 0.5, y: o.y + LEFT.b * W * 0.5 - 12 };
		}
		if (sliceAxis === 'height') return { ...at(LEFT, 0, 0, sliceAt + 0.5), x: LEFT.x - 14 };
		const p = at(LEFT, 0, sliceAt + 0.5, H);
		return { x: p.x, y: p.y + 14 };
	});
	function moveSlice(p: Point) {
		let i: number;
		if (sliceAxis === 'channel') i = Math.round((p.x - LEFT.x - (LEFT.a * W) / 2) / LEFT.sx);
		else if (sliceAxis === 'height') i = Math.floor((p.y - LEFT.y) / LEFT.c);
		else i = Math.floor((p.x - LEFT.x) / LEFT.a);
		setParam('sliceAt', clamp(i, 0, sliceMax));
	}
	function keySlice(s: number | 'start' | 'end') {
		const i = s === 'start' ? 0 : s === 'end' ? sliceMax : sliceAt + Math.sign(s);
		setParam('sliceAt', clamp(i, 0, sliceMax));
	}
	/** Where the slice's picture goes, and how big its cells are. */
	const RES = { x: 500, y: 168 };
	const slicePic = $derived(
		sliceAxis === 'channel'
			? { w: W, h: H, cw: 6.4, ch: 6.4 }
			: { w: 3, h: sliceAxis === 'height' ? W : H, cw: 34, ch: sliceAxis === 'height' ? 8.6 : 6.4 }
	);
	const firstNumbers = $derived(
		Array.from(sl.tensor.data.subarray(0, 6))
			.map((v) => num(v, 0))
			.join(', ')
	);

	// ============================================================ phase reshape
	const shape = $derived(String(params.shape ?? 'pixels'));
	const STRIP = { x: 40, y: 76, cw: 18, n: 48 };
	const k = $derived(Math.floor(t / 0.5) % STRIP.n);
	const kPixel = $derived(Math.floor(k / 3));
	const kChannel = $derived(k % 3);
	const tint = (c: number, v: number) =>
		rgb(...(TINTS[c].map((x) => (x * v) / 255) as [number, number, number]));
	const stripCells = Array.from({ length: STRIP.n }, (_, o) => ({
		o,
		fill: tint(o % 3, photo.data[o])
	}));
	const shapeName = $derived(
		(
			{
				image: '(48, 36, 3)',
				pixels: '(1728, 3)',
				flat: '(5184,)',
				reshape3: '(3, 48, 36)',
				transpose: '(3, 48, 36)'
			} as Record<string, string>
		)[shape] ?? '(1728, 3)'
	);
	const TABLE_ROWS = 16;
	const tableRows = Array.from({ length: TABLE_ROWS }, (_, p) => ({ p, v: pix(0, p) }));
	const LAYERS3 = { x: 52, y: 214, P: 5.2, gap: 222 };
	/** Where number k lands in the (3, 48, 36) views: layer, row, column. */
	const kAt3 = $derived(
		shape === 'transpose'
			? { layer: kChannel, r: 0, c: kPixel }
			: { layer: 0, r: Math.floor(k / W), c: k % W }
	);

	// ============================================================ phase grey
	const wr = $derived(clamp(Number(params.wr ?? 0.299), 0, 1));
	const wg = $derived(clamp(Number(params.wg ?? 0.587), 0, 1));
	const wb = $derived(clamp(Number(params.wb ?? 0.114), 0, 1));
	const grey = $derived(greyOf([wr, wg, wb]));
	const sweep = $derived(Math.floor(t / 0.35) % W);
	const gp = $derived(pix(24, sweep));
	const gv = $derived(get(grey.tensor, [24, sweep]));
	const wsum = $derived(wr + wg + wb);

	// ============================================================ phase average
	const combine = $derived(String(params.combine ?? 'hw') as Combine);
	const avg = $derived(averageOf(combine));
	const combined = $derived({
		h: combine.includes('h'),
		w: combine.includes('w'),
		c: combine.includes('c')
	});
	const avgShape = $derived(shapeText(avg.tensor.shape));
	const avgText = $derived(
		combine === 'hw'
			? `(${Array.from(avg.tensor.data)
					.map((v) => num(v, 1))
					.join(', ')})`
			: combine === 'hwc'
				? num(avg.tensor.data[0], 1)
				: ''
	);
	const avgWhat = $derived(
		(
			{
				c: 'a grey picture: the mean of red, green and blue at each pixel',
				h: 'each column’s average colour',
				w: 'each row’s average colour',
				hw: 'the average colour of the whole photo',
				hwc: 'one number: the average brightness'
			} as Record<Combine, string>
		)[combine]
	);
	const keepColor = (on: boolean) => (on ? 'var(--tn-combine)' : 'var(--tn-keep)');
</script>

{#snippet stackAxes(
	id: string,
	s: Stack,
	colors: { h: string; w: string; c: string },
	words: { h: string; w: string; c: string }
)}
	<!-- height along layer 0's left edge, width along its bottom edge, then the channel axis on
	     from its bottom-right corner through the layers behind -->
	{@const top = at(s, 0, 0, 0)}
	{@const bot = at(s, 0, 0, H)}
	{@const right = at(s, 0, W, H)}
	{@const back = at(s, 2, W, H)}
	<line
		x1={top.x - 10}
		y1={top.y}
		x2={bot.x - 10}
		y2={bot.y}
		stroke={colors.h}
		stroke-width="3"
		stroke-linecap="round"
	/>
	<line
		x1={bot.x}
		y1={bot.y + 12}
		x2={right.x}
		y2={right.y + 12}
		stroke={colors.w}
		stroke-width="3"
		stroke-linecap="round"
	/>
	<line
		x1={right.x + 6}
		y1={right.y + 12}
		x2={back.x}
		y2={back.y + 12}
		stroke={colors.c}
		stroke-width="3"
		stroke-dasharray="2 5"
		stroke-linecap="round"
	/>
	<Readout id="{id}-axes">
		<g transform="rotate(-90 {top.x - 18} {(top.y + bot.y) / 2})">
			<Label
				x={top.x - 18}
				y={(top.y + bot.y) / 2}
				text={words.h}
				anchor="middle"
				color={colors.h}
				weight={600}
			/>
		</g>
		<g
			transform="rotate({(Math.atan2(s.b, s.a) * 180) / Math.PI} {(bot.x + right.x) / 2} {(bot.y +
				right.y) /
				2})"
		>
			<Label
				x={(bot.x + right.x) / 2}
				y={(bot.y + right.y) / 2 + 30}
				text={words.w}
				anchor="middle"
				color={colors.w}
				weight={600}
			/>
		</g>
		<g
			transform="rotate({(Math.atan2(s.sy, s.sx) * 180) / Math.PI} {(right.x + back.x) /
				2} {(right.y + back.y) / 2})"
		>
			<Label
				x={(right.x + back.x) / 2}
				y={(right.y + back.y) / 2 + 32}
				text={words.c}
				anchor="middle"
				color={colors.c}
				weight={600}
			/>
		</g>
	</Readout>
{/snippet}

{#snippet stack(s: Stack, opacity: (d: number) => number, href: (d: number) => string)}
	{#each [2, 1, 0] as d (d)}
		<Sheet
			href={href(d)}
			w={W}
			h={H}
			x={origin(s, d).x}
			y={origin(s, d).y}
			a={s.a}
			b={s.b}
			c={s.c}
			opacity={opacity(d)}
		/>
	{/each}
	<!-- the block's edges from layer to layer -->
	{#each [[0, 0], [W, 0], [0, H], [W, H]] as [u, v] (`${u}-${v}`)}
		{@const p0 = at(s, 0, u, v)}
		{@const p2 = at(s, 2, u, v)}
		<line
			x1={p0.x}
			y1={p0.y}
			x2={p2.x}
			y2={p2.y}
			stroke="var(--stage-line)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>
	{/each}
{/snippet}

{#snippet shapeBig(x: number, y: number, parts: { n: string; color: string }[], size = 30)}
	<text {x} {y} class="halo" font-size={size} font-weight="700"
		>(<!--
		-->{#each parts as part, i (i)}<tspan style:fill={part.color}>{part.n}</tspan
			>{#if i < parts.length - 1}<tspan>,&nbsp;</tspan>{/if}{/each}{#if parts.length === 1}<tspan
				>,</tspan
			>{/if}<!--
		-->)</text
	>
{/snippet}

<g>
	<!-- ============ phase image ============ -->
	{#if w.image > 0.01}
		<g opacity={w.image}>
			<Label
				anchor="start"
				x={PHOTO.x}
				y={PHOTO.y - 16}
				text="the photo: 48 × 36 pixels"
				size={14}
				weight={600}
			/>
			<image
				href={colourUrl()}
				x={PHOTO.x}
				y={PHOTO.y}
				width={W * P}
				height={H * P}
				preserveAspectRatio="none"
				style:image-rendering="pixelated"
			/>
			<rect
				x={PHOTO.x + col * P}
				y={PHOTO.y + row * P}
				width={P}
				height={P}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<rect
				x={PHOTO.x + col * P - 2}
				y={PHOTO.y + row * P - 2}
				width={P + 4}
				height={P + 4}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			{@render stack(moving, () => apart, tintUrl)}
			<g opacity={smoothstep(0.7, 1, apart)}>
				{#each [0, 1, 2] as d (d)}
					{@const top = at(moving, d, W / 2, 0)}
					{@const pp = at(moving, d, col + 0.5, row + 0.5)}
					<Readout id="layer-{d}">
						<Label
							x={top.x}
							y={top.y - 12}
							text="{d}: {CH[d]}"
							anchor="middle"
							color={CH_COLOR[d]}
							weight={700}
						/>
					</Readout>
					<circle
						cx={pp.x}
						cy={pp.y}
						r="6"
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="2"
					/>
				{/each}
				{@render stackAxes(
					'image',
					moving,
					{ h: 'var(--tn-down)', w: 'var(--tn-across)', c: 'var(--tn-deep)' },
					{ h: 'axis 0: height · 48', w: 'axis 1: width · 36', c: 'axis 2: channel · 3' }
				)}
			</g>
			<VectorHandle
				x={PHOTO.x + (col + 0.5) * P}
				y={PHOTO.y + (row + 0.5) * P}
				r={7}
				label="Pixel"
				value={col}
				valuetext="row {row}, column {col}"
				color="var(--stage-ink)"
				onmove={movePixel}
				onkey={keyPixel}
			/>
		</g>
		<Readout
			id="img-shape"
			order={1}
			label="Shape"
			value="(48, 36, 3)"
			note="height, width, channel: 5184 numbers"
			opacity={w.image}
		>
			<g opacity={w.image}>
				<Label anchor="start" x={PX} y={96} text="a 3-axis tensor" size={14} muted />
				{@render shapeBig(PX, 134, [
					{ n: '48', color: 'var(--tn-down)' },
					{ n: '36', color: 'var(--tn-across)' },
					{ n: '3', color: 'var(--tn-deep)' }
				])}
				<Label anchor="start" x={PX} y={162} text="48 × 36 × 3 = 5184 numbers" size={14} />
			</g>
		</Readout>
		<Readout
			id="img-pixel"
			order={2}
			label="img[{row}, {col}]"
			value="({probe.join(', ')})"
			note="red, green, blue: 0–255"
			color={rgb(probe[0], probe[1], probe[2])}
			opacity={w.image}
		>
			<g opacity={w.image}>
				<Label anchor="start" x={PX} y={240} text="one pixel: two indices" size={14} muted />
				<Label anchor="start" x={PX} y={270} text="img[{row}, {col}] =" size={20} weight={700} />
				{#each [0, 1, 2] as c (c)}
					<Label
						anchor="start"
						x={PX}
						y={302 + c * 26}
						text="{CH[c]}: {probe[c]}"
						size={16}
						weight={600}
						color={CH_COLOR[c]}
					/>
				{/each}
				<rect
					x={PX + 120}
					y={286}
					width="56"
					height="56"
					rx="6"
					fill={rgb(probe[0], probe[1], probe[2])}
					stroke="var(--stage-line)"
				/>
				<Label anchor="start" x={PX} y={410} text="Drag the marker on the photo." size={13} muted />
			</g>
		</Readout>
	{/if}

	<!-- ============ phase slice ============ -->
	{#if w.slice > 0.01}
		<g opacity={w.slice}>
			{@render stack(
				LEFT,
				(d) => (sliceAxis === 'channel' ? (d === sliceAt ? 1 : 0.3) : 0.55),
				tintUrl
			)}
			{#each [0, 1, 2] as d (d)}
				{@const top = at(LEFT, d, W / 2, 0)}
				<Readout id="s-layer-{d}">
					<Label
						x={top.x}
						y={top.y - 34}
						text={CH[d]}
						anchor="middle"
						color={CH_COLOR[d]}
						weight={700}
						opacity={sliceAxis === 'channel' && d !== sliceAt ? 0.5 : 1}
					/>
				</Readout>
				{#if sliceAxis === 'channel'}
					{#if d === sliceAt}
						<path
							d={band(LEFT, d, 0, W, 0, H)}
							fill="none"
							stroke="var(--explainer-accent, var(--accent))"
							stroke-width="3"
						/>
					{/if}
				{:else if sliceAxis === 'height'}
					<path
						d={band(LEFT, d, 0, W, sliceAt, sliceAt + 1)}
						fill="var(--explainer-accent, var(--accent))"
						fill-opacity="0.35"
						stroke="var(--explainer-accent, var(--accent))"
						stroke-width="2"
					/>
				{:else}
					<path
						d={band(LEFT, d, sliceAt, sliceAt + 1, 0, H)}
						fill="var(--explainer-accent, var(--accent))"
						fill-opacity="0.35"
						stroke="var(--explainer-accent, var(--accent))"
						stroke-width="2"
					/>
				{/if}
			{/each}
			{@render stackAxes(
				'slice',
				LEFT,
				{
					h: sliceAxis === 'height' ? 'var(--explainer-accent, var(--accent))' : 'var(--tn-down)',
					w: sliceAxis === 'width' ? 'var(--explainer-accent, var(--accent))' : 'var(--tn-across)',
					c: sliceAxis === 'channel' ? 'var(--explainer-accent, var(--accent))' : 'var(--tn-deep)'
				},
				{
					h: sliceAxis === 'height' ? `height fixed at ${sliceAt}` : 'height · 48',
					w: sliceAxis === 'width' ? `width fixed at ${sliceAt}` : 'width · 36',
					c: sliceAxis === 'channel' ? `channel fixed at ${sliceAt}` : 'channel · 3'
				}
			)}
			<!-- the slice itself -->
			<image
				href={sl.href}
				x={RES.x}
				y={RES.y}
				width={slicePic.w * slicePic.cw}
				height={slicePic.h * slicePic.ch}
				preserveAspectRatio="none"
				style:image-rendering="pixelated"
			/>
			<rect
				x={RES.x}
				y={RES.y}
				width={slicePic.w * slicePic.cw}
				height={slicePic.h * slicePic.ch}
				fill="none"
				stroke="var(--stage-line)"
			/>
			{#if sliceAxis !== 'channel'}
				{#each [0, 1, 2] as c (c)}
					<Label
						x={RES.x + (c + 0.5) * slicePic.cw}
						y={RES.y - 8}
						text={['R', 'G', 'B'][c]}
						anchor="middle"
						color={CH_COLOR[c]}
						weight={700}
					/>
				{/each}
				<Readout id="slice-dims">
					<Label
						anchor="start"
						x={RES.x + 3 * slicePic.cw + 12}
						y={RES.y + 16}
						text="{slicePic.h} pixels down"
						size={12}
						muted
					/>
					<Label
						anchor="start"
						x={RES.x + 3 * slicePic.cw + 12}
						y={RES.y + 32}
						text="× 3 channels across"
						size={12}
						muted
					/>
				</Readout>
			{:else}
				<Readout id="slice-dims">
					<Label
						anchor="start"
						x={RES.x}
						y={RES.y + H * 6.4 + 22}
						text="one number per pixel, drawn as grey"
						size={12}
						muted
					/>
					<Label
						anchor="start"
						x={RES.x}
						y={RES.y + H * 6.4 + 38}
						text="(0 black, 255 white)"
						size={12}
						muted
					/>
				</Readout>
			{/if}
			<Handle
				x={sliceHandle.x}
				y={sliceHandle.y}
				r={8}
				label="Slice position along the {sliceAxis} axis"
				value={sliceAt}
				min={0}
				max={sliceMax}
				valuetext="{sliceAxis} index {sliceAt}"
				onmove={moveSlice}
				onkey={keySlice}
			/>
		</g>
		<Readout
			id="slice-code"
			order={1}
			label="Slice"
			value={sliceCode}
			note={sliceWhat}
			opacity={w.slice}
		>
			<g opacity={w.slice}>
				<Label anchor="start" x={PX} y={96} text="fix one index:" size={14} muted />
				<Label anchor="start" x={PX} y={128} text={sliceCode} size={22} weight={700} />
				<Label anchor="start" x={PX} y={154} text={sliceWhat} size={14} />
			</g>
		</Readout>
		<Readout
			id="slice-shape"
			order={2}
			label="Shape"
			value={shapeText(sl.tensor.shape)}
			note="2 axes: one fewer than (48, 36, 3)"
			opacity={w.slice}
		>
			<g opacity={w.slice}>
				<Label anchor="start" x={PX} y={214} text="(48, 36, 3) →" size={16} muted />
				<Label
					anchor="start"
					x={PX}
					y={250}
					text={shapeText(sl.tensor.shape)}
					size={30}
					weight={700}
				/>
				<Label anchor="start" x={PX} y={276} text="2 axes: one fewer" size={14} />
				<Label anchor="start" x={PX} y={330} text="first numbers:" size={13} muted />
				<Label anchor="start" x={PX} y={350} text="{firstNumbers}, …" size={13} />
			</g>
		</Readout>
	{/if}

	<!-- ============ phase reshape ============ -->
	{#if w.reshape > 0.01}
		<g opacity={w.reshape}>
			<Label
				anchor="start"
				x={STRIP.x}
				y={STRIP.y - 14}
				text="In memory: one list of 5184 numbers (the first 48 shown)"
				size={14}
				weight={600}
			/>
			{#each stripCells as cell (cell.o)}
				<rect
					x={STRIP.x + cell.o * STRIP.cw}
					y={STRIP.y}
					width={STRIP.cw - 2}
					height="26"
					rx="2"
					fill={cell.fill}
				/>
				<rect
					x={STRIP.x + cell.o * STRIP.cw}
					y={STRIP.y}
					width={STRIP.cw - 2}
					height="4"
					fill={CH_COLOR[cell.o % 3]}
				/>
				<text
					x={STRIP.x + (cell.o + 0.5) * STRIP.cw - 1}
					y={STRIP.y + 19}
					text-anchor="middle"
					font-size="9"
					style:fill={photo.data[cell.o] > 140 ? '#000' : '#fff'}>{photo.data[cell.o]}</text
				>
			{/each}
			{#each Array.from({ length: 16 }, (_, p) => p) as p (p)}
				<Readout id="strip-px-{p}">
					<Label
						x={STRIP.x + (p * 3 + 1.5) * STRIP.cw - 1}
						y={STRIP.y + 42}
						text={String(p * 3)}
						size={10}
						anchor="middle"
						muted
					/>
				</Readout>
			{/each}
			<Label
				anchor="start"
				x={STRIP.x + STRIP.n * STRIP.cw + 6}
				y={STRIP.y + 18}
				text="… 5184"
				size={13}
				muted
			/>
			<rect
				x={STRIP.x + k * STRIP.cw - 2}
				y={STRIP.y - 3}
				width={STRIP.cw + 2}
				height="32"
				rx="3"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.5"
			/>

			{#if shape === 'image'}
				<image
					href={colourUrl()}
					x={60}
					y={150}
					width={W * 9}
					height={H * 9}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect
					x={60}
					y={150}
					width={W * 9}
					height={9}
					fill="none"
					stroke="var(--explainer-accent, var(--accent))"
					stroke-width="2"
				/>
				<rect
					x={60 + kPixel * 9 - 1.5}
					y={148.5}
					width={12}
					height={12}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="2.5"
				/>
				<Readout id="rs-note">
					<Label
						anchor="start"
						x={400}
						y={170}
						text="row 0 = numbers 0–107"
						size={14}
						weight={600}
						color="var(--explainer-accent, var(--accent))"
					/>
					<Label anchor="start" x={400} y={194} text="row 1 = numbers 108–215, …" size={14} muted />
					<Label
						anchor="start"
						x={400}
						y={240}
						text="number {k} = {CH[kChannel]} of pixel (0, {kPixel})"
						size={14}
					/>
				</Readout>
			{:else if shape === 'pixels'}
				<Label anchor="start" x={60} y={140} text="pixel" size={12} muted />
				{#each [0, 1, 2] as c (c)}
					<Label
						x={180 + c * 56}
						y={140}
						text={['R', 'G', 'B'][c]}
						size={12}
						anchor="end"
						weight={700}
						color={CH_COLOR[c]}
					/>
				{/each}
				{#each tableRows as r (r.p)}
					{@const y = 162 + r.p * 22}
					<g opacity={r.p === kPixel ? 1 : 0.75}>
						<Label anchor="start" x={60} {y} text={String(r.p)} size={12} muted />
						<rect
							x={92}
							y={y - 13}
							width="26"
							height="17"
							rx="3"
							fill={rgb(r.v[0], r.v[1], r.v[2])}
							stroke="var(--stage-line)"
						/>
						{#each [0, 1, 2] as c (c)}
							<Label
								x={180 + c * 56}
								{y}
								text={String(r.v[c])}
								size={13}
								anchor="end"
								weight={r.p === kPixel && c === kChannel ? 800 : 500}
							/>
						{/each}
					</g>
				{/each}
				<rect
					x={52}
					y={162 + kPixel * 22 - 16}
					width={250}
					height="22"
					rx="4"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				<Label
					anchor="start"
					x={60}
					y={162 + TABLE_ROWS * 22}
					text="⋮  1728 rows"
					size={13}
					muted
				/>
				<image
					href={pixelListUrl()}
					x={360}
					y={130}
					width={60}
					height={420}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect x={360} y={130} width={60} height={420} fill="none" stroke="var(--stage-line)" />
				<Readout id="rs-note">
					<Label anchor="start" x={436} y={146} text="all 1728 rows," size={13} muted />
					<Label anchor="start" x={436} y={164} text="squeezed into this strip" size={13} muted />
					<Label anchor="start" x={436} y={300} text="one row per pixel:" size={14} />
					<Label
						anchor="start"
						x={436}
						y={322}
						text="row {kPixel} = numbers {kPixel * 3}–{kPixel * 3 + 2}"
						size={14}
						weight={600}
					/>
				</Readout>
			{:else if shape === 'flat'}
				<image
					href={flatUrl()}
					x={40}
					y={230}
					width={864}
					height={60}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect x={40} y={230} width={864} height={60} fill="none" stroke="var(--stage-line)" />
				<Readout id="rs-note">
					<Label
						anchor="start"
						x={40}
						y={216}
						text="all 5184 numbers in one row, squeezed: one axis, length 5184"
						size={14}
					/>
					<Label
						anchor="start"
						x={40}
						y={330}
						text="v[{k}] = {photo.data[k]} — the same number, now found with one index"
						size={14}
						weight={600}
					/>
					<Label
						anchor="start"
						x={40}
						y={370}
						text="Same list, same order: only the shape changed."
						size={14}
						muted
					/>
				</Readout>
			{:else}
				{#each [0, 1, 2] as layer (layer)}
					{@const x = LAYERS3.x + layer * LAYERS3.gap}
					<image
						href={shape === 'transpose' ? channelGreyUrl(layer) : reshapedUrl(layer)}
						{x}
						y={LAYERS3.y}
						width={W * LAYERS3.P}
						height={H * LAYERS3.P}
						preserveAspectRatio="none"
						style:image-rendering="pixelated"
					/>
					<rect
						{x}
						y={LAYERS3.y}
						width={W * LAYERS3.P}
						height={H * LAYERS3.P}
						fill="none"
						stroke="var(--stage-line)"
					/>
					<Readout id="rs-layer-{layer}">
						<Label
							anchor="start"
							{x}
							y={LAYERS3.y - 26}
							text="layer {layer}"
							size={13}
							weight={700}
						/>
						<Label
							anchor="start"
							{x}
							y={LAYERS3.y - 10}
							text={shape === 'transpose'
								? `= the ${CH[layer]} channel`
								: `= numbers ${layer * 1728}–${layer * 1728 + 1727}`}
							size={12}
							muted
						/>
					</Readout>
				{/each}
				<rect
					x={LAYERS3.x + kAt3.layer * LAYERS3.gap + kAt3.c * LAYERS3.P - 2}
					y={LAYERS3.y + kAt3.r * LAYERS3.P - 2}
					width={LAYERS3.P + 4}
					height={LAYERS3.P + 4}
					fill="none"
					stroke="var(--explainer-accent, var(--accent))"
					stroke-width="2.5"
				/>
				<Readout id="rs-note">
					<Label
						anchor="start"
						x={LAYERS3.x}
						y={LAYERS3.y + H * LAYERS3.P + 30}
						text={shape === 'transpose'
							? 'Each layer is one colour: the numbers were moved to keep their meaning.'
							: 'Each layer mixes red, green and blue: right shape, wrong picture.'}
						size={14}
						weight={600}
					/>
				</Readout>
			{/if}
		</g>
		<Readout
			id="rs-shape"
			order={1}
			label="Shape"
			value={shapeName}
			note={shape === 'transpose'
				? 'axes reordered: the numbers move'
				: 'the same list of 5184 numbers'}
			opacity={w.reshape}
		>
			<g opacity={w.reshape}>
				<Label
					anchor="start"
					x={PX}
					y={160}
					text={shape === 'transpose' ? 'transpose →' : shape === 'image' ? 'shape' : 'reshape →'}
					size={14}
					muted
				/>
				<Label anchor="start" x={PX} y={196} text={shapeName} size={30} weight={700} />
				<Label
					anchor="start"
					x={PX}
					y={222}
					text={shape === 'transpose' ? 'numbers moved' : 'same list, same order'}
					size={14}
				/>
			</g>
		</Readout>
	{/if}

	<!-- ============ phase grey ============ -->
	{#if w.grey > 0.01}
		<g opacity={w.grey}>
			{@render stack(LEFT, () => 1, tintUrl)}
			{#each [0, 1, 2] as d (d)}
				{@const top = at(LEFT, d, W / 2, 0)}
				{@const pp = at(LEFT, d, sweep + 0.5, 24.5)}
				<Label
					x={top.x}
					y={top.y - 26}
					text="× {num([wr, wg, wb][d], 3)}"
					anchor="middle"
					color={CH_COLOR[d]}
					weight={700}
					size={14}
				/>
				<circle cx={pp.x} cy={pp.y} r="6" fill="none" stroke="#fff" stroke-width="3" />
				<circle cx={pp.x} cy={pp.y} r="6" fill="none" stroke="#000" stroke-width="1.2" />
			{/each}
			{@render stackAxes(
				'grey',
				LEFT,
				{ h: 'var(--tn-keep)', w: 'var(--tn-keep)', c: 'var(--tn-combine)' },
				{ h: 'height · kept', w: 'width · kept', c: 'channel: summed away' }
			)}
			<Label x={448} y={340} text="→" size={34} anchor="middle" weight={700} />
			<image
				href={grey.href}
				x={RES.x}
				y={RES.y}
				width={W * 6.4}
				height={H * 6.4}
				preserveAspectRatio="none"
				style:image-rendering="pixelated"
			/>
			<rect
				x={RES.x}
				y={RES.y}
				width={W * 6.4}
				height={H * 6.4}
				fill="none"
				stroke="var(--tn-keep)"
				stroke-width="2"
			/>
			<rect
				x={RES.x + sweep * 6.4 - 2}
				y={RES.y + 24 * 6.4 - 2}
				width={10.4}
				height={10.4}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<Label
				anchor="start"
				x={RES.x}
				y={RES.y - 12}
				text="grey: (48, 36)"
				size={14}
				weight={600}
				color="var(--tn-keep)"
			/>
		</g>
		<Readout
			id="grey-shape"
			order={1}
			label="Shapes"
			value="(48, 36, 3) · (3,) → (48, 36)"
			opacity={w.grey}
		>
			<g opacity={w.grey}>
				<text x={PX} y={96} class="halo" font-size="16" font-weight="700"
					>(48, 36, <tspan style:fill="var(--tn-combine)">3</tspan>) · (<tspan
						style:fill="var(--tn-combine)">3</tspan
					>,)</text
				>
				<Label
					anchor="start"
					x={PX}
					y={122}
					text="→ (48, 36)"
					size={16}
					weight={700}
					color="var(--tn-keep)"
				/>
			</g>
		</Readout>
		<Readout
			id="grey-sum"
			order={2}
			label="grey[24, {sweep}]"
			value="{num(wr, 3)}×{gp[0]} + {num(wg, 3)}×{gp[1]} + {num(wb, 3)}×{gp[2]} = {num(gv, 1)}"
			opacity={w.grey}
		>
			<g opacity={w.grey}>
				<Label anchor="start" x={PX} y={190} text="grey[24, {sweep}] =" size={16} weight={700} />
				{#each [0, 1, 2] as c (c)}
					<Label
						anchor="start"
						x={PX}
						y={218 + c * 24}
						text="{c ? '+ ' : '  '}{num([wr, wg, wb][c], 3)} × {gp[c]}"
						size={15}
						color={CH_COLOR[c]}
						weight={600}
					/>
				{/each}
				<Label anchor="start" x={PX} y={300} text="= {num(gv, 1)}" size={20} weight={700} />
			</g>
		</Readout>
		<Readout
			id="grey-wsum"
			order={3}
			label="Weights add up to"
			value={num(wsum, 3)}
			note={Math.abs(wsum - 1) < 0.0005
				? 'white stays white'
				: wsum > 1
					? 'brighter than the original (values over 255 clip)'
					: 'darker than the original'}
			opacity={w.grey}
		>
			<g opacity={w.grey}>
				<Label
					anchor="start"
					x={PX}
					y={360}
					text="weights add up to {num(wsum, 3)}"
					size={13}
					muted
				/>
				<Label
					anchor="start"
					x={PX}
					y={378}
					text={Math.abs(wsum - 1) < 0.0005
						? 'so white stays white'
						: wsum > 1
							? 'brighter (over 255 clips)'
							: 'darker than the original'}
					size={13}
					muted
				/>
			</g>
		</Readout>
	{/if}

	<!-- ============ phase average ============ -->
	{#if w.average > 0.01}
		<g opacity={w.average}>
			{@render stack(LEFT, () => 1, tintUrl)}
			{@render stackAxes(
				'average',
				LEFT,
				{ h: keepColor(combined.h), w: keepColor(combined.w), c: keepColor(combined.c) },
				{
					h: combined.h ? 'height: averaged' : 'height · kept',
					w: combined.w ? 'width: averaged' : 'width · kept',
					c: combined.c ? 'channel: averaged' : 'channel · kept'
				}
			)}
			<Label x={448} y={340} text="→" size={34} anchor="middle" weight={700} />
			{#if combine === 'c'}
				<image
					href={avg.href}
					x={RES.x}
					y={RES.y}
					width={W * 6.4}
					height={H * 6.4}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect
					x={RES.x}
					y={RES.y}
					width={W * 6.4}
					height={H * 6.4}
					fill="none"
					stroke="var(--tn-keep)"
					stroke-width="2"
				/>
			{:else if combine === 'h'}
				<image
					href={avg.href}
					x={RES.x}
					y={300}
					width={W * 6.4}
					height={60}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect
					x={RES.x}
					y={300}
					width={W * 6.4}
					height={60}
					fill="none"
					stroke="var(--tn-keep)"
					stroke-width="2"
				/>
			{:else if combine === 'w'}
				<image
					href={avg.href}
					x={RES.x + 80}
					y={RES.y}
					width={60}
					height={H * 6.4}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<rect
					x={RES.x + 80}
					y={RES.y}
					width={60}
					height={H * 6.4}
					fill="none"
					stroke="var(--tn-keep)"
					stroke-width="2"
				/>
			{:else}
				<rect
					x={RES.x + 30}
					y={250}
					width="170"
					height="170"
					rx="10"
					fill={combine === 'hw'
						? rgb(avg.tensor.data[0], avg.tensor.data[1], avg.tensor.data[2])
						: rgb(avg.tensor.data[0], avg.tensor.data[0], avg.tensor.data[0])}
					stroke="var(--stage-line)"
				/>
			{/if}
			<Readout id="avg-what">
				<Label
					anchor="start"
					x={RES.x}
					y={530}
					text={avgWhat}
					size={14}
					weight={600}
					color="var(--tn-keep)"
				/>
			</Readout>
		</g>
		<Readout
			id="avg-shape"
			order={1}
			label="Shape left"
			value={avgShape}
			note={avgWhat}
			opacity={w.average}
		>
			<g opacity={w.average}>
				<Label anchor="start" x={PX} y={160} text="(48, 36, 3) →" size={16} muted />
				<Label
					anchor="start"
					x={PX}
					y={198}
					text={avgShape}
					size={30}
					weight={700}
					color="var(--tn-keep)"
				/>
				<Label
					anchor="start"
					x={PX}
					y={224}
					text="{3 - avg.tensor.shape.length} ax{3 - avg.tensor.shape.length === 1
						? 'is'
						: 'es'} combined"
					size={14}
				/>
			</g>
		</Readout>
		{#if avgText}
			<Readout id="avg-value" order={2} label="Value" value={avgText} opacity={w.average}>
				<Label
					anchor="start"
					x={PX}
					y={290}
					text={avgText}
					size={18}
					weight={700}
					opacity={w.average}
				/>
			</Readout>
		{/if}
	{/if}
</g>
