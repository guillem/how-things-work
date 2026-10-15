<script lang="ts">
	/**
	 * The first chapter: a 28 × 28 digit, a 3 × 3 filter and the feature map it makes.
	 *
	 * mode 'grid'   the digit and a magnifier that wanders over it, showing the pixel values.
	 * mode 'slide'  the filter slides: first slowly along one row (with the arithmetic of each
	 *               position), then over every row until the map is complete. A pure function of
	 *               t; under reduced motion, the complete map with the window parked on that row.
	 * mode 'edit'   the complete map; the nine weights are editable on the stage.
	 * mode 'shift'  the digit moved by `params.shift` pixels (no further than the grid allows): the
	 *               map moves the same way, and the cost of the filter against a fully connected layer.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SIDE } from '../cnn';
	import { PRESETS, divisor, effective, filter, shift, window3, denseWeights } from '../filters';
	import KernelGrid from './KernelGrid.svelte';
	import { Label } from '#lib/draw/index.ts';
	import {
		fmt,
		greyUrl,
		inputOf,
		int,
		kernelOf,
		maxAbs,
		presetOf,
		setKernel,
		signedUrl
	} from './shared';

	let { step, t, params, reduced, dark, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'slide'));
	const input = $derived(inputOf(params));
	/**
	 * How far the digit can move each way before its feature map (the ink plus the filter's reach
	 * of 1 px) runs off the grid: the slider stops the digit there, so the map keeps its shape.
	 */
	const room = $derived.by(() => {
		let a = SIDE;
		let b = -1;
		for (let i = 0; i < input.img.length; i++)
			if (input.img[i] > 0) {
				a = Math.min(a, i % SIDE);
				b = Math.max(b, i % SIDE);
			}
		if (b < 0) return { left: 0, right: 0 };
		return { left: Math.max(0, a - 1), right: Math.max(0, SIDE - 2 - b) };
	});
	const wanted = $derived(mode === 'shift' ? Number(params.shift ?? 0) : 0);
	const dx = $derived(Math.max(-room.left, Math.min(room.right, wanted)));
	const atEdge = $derived(dx !== wanted);
	const img = $derived(dx === 0 ? input.img : shift(input.img, dx, 0));
	// the slide step is about the Sobel filter its text describes, whatever was picked elsewhere
	const k = $derived(mode === 'slide' ? [...PRESETS.vertical.k] : kernelOf(params));
	const d = $derived(divisor(k));
	const out = $derived(filter(img, k));
	const scale = $derived(maxAbs(out) || 1);
	const inUrl = $derived(greyUrl(img, SIDE, SIDE, dark));
	const outUrl = $derived(signedUrl(out, SIDE, SIDE, scale, dark));
	const edited = $derived(
		k.some((v, i) => v !== PRESETS[presetOf(params)].k[i]) ? ' (edited)' : ''
	);
	const filterName = $derived(
		mode === 'slide' ? PRESETS.vertical.name : PRESETS[presetOf(params)].name + edited
	);

	// ---- layout ---------------------------------------------------------------------------
	const PX = 12;
	const A = { x: 40, y: 92 }; // input
	const B = { x: 584, y: 92 }; // output
	const W = SIDE * PX; // 336
	const KC = 52; // kernel cell
	const KX = 402;
	const KY = 150;

	// ---- the slide ------------------------------------------------------------------------
	/** The row the slow part walks along: the one with the strongest responses. */
	const row = $derived.by(() => {
		let best = 14;
		let bestSum = -1;
		for (let y = 6; y < 22; y++) {
			let s = 0;
			for (let x = 0; x < SIDE; x++) s += Math.abs(out[y * SIDE + x]);
			if (s > bestSum) [best, bestSum] = [y, s];
		}
		return best;
	});
	/** The ink's extent on that row, where the slow walk goes. */
	const span = $derived.by(() => {
		let a = SIDE;
		let b = -1;
		for (let x = 0; x < SIDE; x++)
			if (Math.abs(out[row * SIDE + x]) > 1e-6 || img[row * SIDE + x] > 0) {
				a = Math.min(a, x);
				b = Math.max(b, x);
			}
		return b < 0 ? [8, 19] : [Math.max(0, a - 1), Math.min(SIDE - 1, b + 1)];
	});
	const SLOW = 0.55; // seconds per position in the slow walk
	const slowEnd = $derived((span[1] - span[0] + 1) * SLOW + 0.6);
	const FAST = 12; // seconds for the full sweep
	const slide = $derived.by(() => {
		if (mode !== 'slide') return { phase: 'done', x: -1, y: -1, p: SIDE * SIDE };
		if (reduced) {
			const x = Math.round((span[0] + span[1]) / 2);
			return { phase: 'done', x, y: row, p: SIDE * SIDE };
		}
		if (t < slowEnd) {
			const i = Math.min(span[1] - span[0], Math.floor(t / SLOW));
			return { phase: 'slow', x: span[0] + i, y: row, p: -1 };
		}
		const u = (t - slowEnd) / FAST;
		if (u >= 1) return { phase: 'done', x: span[1], y: row, p: SIDE * SIDE };
		const p = Math.floor(u * SIDE * SIDE);
		return { phase: 'fast', x: p % SIDE, y: Math.floor(p / SIDE), p };
	});
	const showWindow = $derived(mode === 'slide' && slide.x >= 0);
	/** Rectangles that hide the part of the map not computed yet. */
	const veils = $derived.by(() => {
		const r: { key: string; x: number; y: number; w: number; h: number }[] = [];
		if (mode !== 'slide' || slide.phase === 'done') return r;
		if (slide.phase === 'slow') {
			const done0 = span[0];
			const done1 = slide.x;
			r.push({ key: 'above', x: 0, y: 0, w: SIDE, h: slide.y });
			r.push({ key: 'left', x: 0, y: slide.y, w: done0, h: 1 });
			r.push({ key: 'right', x: done1 + 1, y: slide.y, w: SIDE - done1 - 1, h: 1 });
			r.push({ key: 'below', x: 0, y: slide.y + 1, w: SIDE, h: SIDE - slide.y - 1 });
		} else {
			r.push({ key: 'right', x: slide.x + 1, y: slide.y, w: SIDE - slide.x - 1, h: 1 });
			r.push({ key: 'below', x: 0, y: slide.y + 1, w: SIDE, h: SIDE - slide.y - 1 });
		}
		return r.filter((v) => v.w > 0 && v.h > 0);
	});
	const win = $derived(showWindow ? window3(img, slide.x, slide.y) : []);
	const eff = $derived(effective(k));
	const sum = $derived(showWindow ? out[slide.y * SIDE + slide.x] : 0);

	// ---- the magnifier ----------------------------------------------------------------------
	const MAG = 5;
	/** Places worth magnifying: 5 × 5 windows on the edge of the ink, a few pixels apart. */
	const stops = $derived.by(() => {
		const list: [number, number][] = [];
		for (let y0 = 1; y0 <= SIDE - MAG - 1; y0 += 3)
			for (let x0 = 1; x0 <= SIDE - MAG - 1; x0 += 3) {
				let ink = 0;
				for (let j = 0; j < MAG; j++)
					for (let i = 0; i < MAG; i++) ink += img[(y0 + j) * SIDE + x0 + i];
				if (ink > 4 && ink < 18) list.push([x0, y0]);
			}
		// every few, so the magnifier jumps around the digit
		const picked = list.filter((_, i) => i % 3 === 0);
		return picked.length ? picked : [[11, 11] as [number, number]];
	});
	const DWELL = 2.2;
	const mag = $derived.by(() => {
		const tt = reduced ? 0 : t;
		const [x0, y0] = stops[Math.floor(tt / DWELL) % stops.length];
		const cells = [];
		for (let j = 0; j < MAG; j++)
			for (let i = 0; i < MAG; i++) {
				const v = img[(y0 + j) * SIDE + x0 + i];
				cells.push({ key: `${i}-${j}`, i, j, v });
			}
		return { x0, y0, cells };
	});
	const MC = 66; // magnifier cell
	const MX = 548;
	const MY = 98;

	// ---- the shift --------------------------------------------------------------------------
	/** Centre of the ink (columns), to mark where the digit was and where it is. */
	const inkX = (a: Float32Array) => {
		let m = 0;
		let mx = 0;
		for (let i = 0; i < a.length; i++) {
			m += a[i];
			mx += a[i] * ((i % SIDE) + 0.5);
		}
		return m > 0 ? mx / m : SIDE / 2;
	};
	const x0Ink = $derived(inkX(input.img));
	const dense = denseWeights(SIDE * SIDE, SIDE * SIDE);

	const editCell = (i: number, v: number) => {
		const next = [...k];
		next[i] = v;
		setKernel(params, setParam, next);
	};

	const caption = $derived(
		input.empty
			? 'nothing drawn yet: draw a digit on the “Draw a digit” step'
			: input.label === null
				? 'your drawing, as the network sees it'
				: `a handwritten ${input.label} from the MNIST test set`
	);
</script>

<g>
	<!-- input -->
	<Readout id="cv-in" order={1} label="Input" value={caption}>
		<Label
			anchor="start"
			x={A.x}
			y={A.y - 18}
			text="input · 28 × 28 pixels"
			size={14}
			weight={600}
		/>
		<Label anchor="start" x={A.x} y={A.y + W + 22} text={caption} size={12} muted />
	</Readout>
	<rect x={A.x - 1} y={A.y - 1} width={W + 2} height={W + 2} fill="none" stroke="var(--border)" />
	<image href={inUrl} x={A.x} y={A.y} width={W} height={W} class="cv-px" />

	{#if mode === 'grid'}
		<!-- the magnifier -->
		<rect
			x={A.x + mag.x0 * PX}
			y={A.y + mag.y0 * PX}
			width={MAG * PX}
			height={MAG * PX}
			fill="none"
			stroke="var(--cv-window)"
			stroke-width="2.5"
		/>
		<line
			x1={A.x + (mag.x0 + MAG) * PX}
			y1={A.y + mag.y0 * PX}
			x2={MX}
			y2={MY}
			stroke="var(--cv-window)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		<line
			x1={A.x + (mag.x0 + MAG) * PX}
			y1={A.y + (mag.y0 + MAG) * PX}
			x2={MX}
			y2={MY + MAG * MC}
			stroke="var(--cv-window)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		{#each mag.cells as c (c.key)}
			<rect
				x={MX + c.i * MC}
				y={MY + c.j * MC}
				width={MC}
				height={MC}
				fill="var(--stage-ink)"
				fill-opacity={c.v * 0.92}
				stroke="var(--stage-line)"
			/>
			<text
				x={MX + c.i * MC + MC / 2}
				y={MY + c.j * MC + MC / 2 + 5}
				text-anchor="middle"
				font-weight="600"
				style:font-size="15px"
				style:fill={c.v > 0.5 ? 'var(--stage-bg)' : 'var(--stage-ink)'}
				style:pointer-events="none">{fmt(c.v)}</text
			>
		{/each}
		<rect
			x={MX}
			y={MY}
			width={MAG * MC}
			height={MAG * MC}
			fill="none"
			stroke="var(--cv-window)"
			stroke-width="2.5"
		/>
		<Readout id="cv-mag" order={2} label="Magnifier" value="0 = paper, 1 = ink">
			<Label
				anchor="start"
				x={MX}
				y={MY + MAG * MC + 28}
				text="the numbers under the magnifier: 0 = paper, 1 = ink"
				size={13}
			/>
			<Label
				anchor="start"
				x={MX}
				y={MY + MAG * MC + 48}
				text="784 of them in all: the network's whole input"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<!-- the filter -->
		<Readout id="cv-filter" order={2} label="Filter" value={filterName}>
			<Label
				x={KX + (3 * KC) / 2}
				y={KY - 22}
				text="filter: {filterName}"
				size={13}
				weight={600}
				anchor="middle"
			/>
		</Readout>
		<KernelGrid x={KX} y={KY} cell={KC} {k} edit={mode === 'edit' ? editCell : undefined} />
		<Label
			x={KX + (3 * KC) / 2}
			y={KY + 3 * KC + 24}
			text={d === 1 ? 'sum not divided' : `sum ÷ ${d}`}
			size={13}
			anchor="middle"
		/>
		{#if mode === 'edit'}
			<Readout id="cv-edit">
				<Label
					x={KX + (3 * KC) / 2}
					y={KY + 3 * KC + 46}
					text="click ▲ / ▼ on a cell"
					size={11}
					anchor="middle"
					muted
				/>
			</Readout>
		{/if}
		<path
			d="M {KX + 10} {KY + 3 * KC + 70} L {KX + 3 * KC - 10} {KY + 3 * KC + 70}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>

		<!-- the output -->
		<Label
			anchor="start"
			x={B.x}
			y={B.y - 18}
			text="feature map · 28 × 28"
			size={14}
			weight={600}
		/>
		<rect x={B.x - 1} y={B.y - 1} width={W + 2} height={W + 2} fill="none" stroke="var(--border)" />
		<image href={outUrl} x={B.x} y={B.y} width={W} height={W} class="cv-px" />
		{#each veils as v (v.key)}
			<rect
				x={B.x + v.x * PX}
				y={B.y + v.y * PX}
				width={v.w * PX}
				height={v.h * PX}
				fill="var(--stage-bg)"
			/>
		{/each}
		<Readout id="cv-key" order={3} label="Colours" value="blue: positive sum · orange: negative">
			<rect x={B.x} y={B.y + W + 12} width="12" height="12" fill="var(--cv-pos)" />
			<Label anchor="start" x={B.x + 18} y={B.y + W + 22} text="positive" size={12} />
			<rect x={B.x + 92} y={B.y + W + 12} width="12" height="12" fill="var(--cv-neg)" />
			<Label anchor="start" x={B.x + 110} y={B.y + W + 22} text="negative" size={12} />
			<Label anchor="start" x={B.x + 190} y={B.y + W + 22} text="paper colour: 0" size={12} muted />
		</Readout>

		{#if showWindow}
			<!-- the window on the input and the pixel it makes -->
			<rect
				x={A.x + (slide.x - 1) * PX}
				y={A.y + (slide.y - 1) * PX}
				width={3 * PX}
				height={3 * PX}
				fill="var(--cv-window)"
				fill-opacity="0.18"
				stroke="var(--cv-window)"
				stroke-width="2.5"
			/>
			<rect
				x={B.x + slide.x * PX}
				y={B.y + slide.y * PX}
				width={PX}
				height={PX}
				fill="none"
				stroke="var(--cv-window)"
				stroke-width="2.5"
			/>
			<!-- the arithmetic at this position -->
			<Readout
				id="cv-sum"
				order={4}
				label="At ({slide.x}, {slide.y})"
				value="sum of pixel × weight = {fmt(sum)}"
			>
				<Label
					anchor="start"
					x={A.x}
					y={492}
					text="at ({slide.x}, {slide.y}):"
					size={13}
					weight={600}
				/>
				{#each win as v, i (i)}
					<Label
						anchor="start"
						x={190 + (i % 3) * 136}
						y={492 + Math.floor(i / 3) * 24}
						text="{fmt(v)} × {fmt(eff[i], d === 1 ? 0 : 3)}{i % 3 < 2 ? '  +' : ''}"
						size={13}
						opacity={Math.abs(v * eff[i]) > 1e-9 ? 1 : 0.5}
					/>
				{/each}
				<Label anchor="start" x={610} y={516} text="= {fmt(sum)}" size={18} weight={700} />
				<Label
					anchor="start"
					x={610}
					y={540}
					text={slide.phase === 'fast' ? 'every position, row by row' : 'one output pixel'}
					size={12}
					muted
				/>
			</Readout>
		{/if}

		{#if mode === 'shift'}
			{@const was = x0Ink}
			{@const now = x0Ink + dx}
			{#each [A, B] as P (P.x)}
				<line
					x1={P.x + was * PX}
					y1={P.y - 4}
					x2={P.x + was * PX}
					y2={P.y + W + 4}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="5 4"
					stroke-width="1.5"
				/>
				<line
					x1={P.x + now * PX}
					y1={P.y - 4}
					x2={P.x + now * PX}
					y2={P.y + W + 4}
					stroke="var(--cv-window)"
					stroke-width="2"
				/>
			{/each}
			<Readout
				id="cv-moved"
				order={4}
				label="Moved"
				value={(dx === 0
					? 'not moved'
					: `digit and map both ${Math.abs(dx)} px ${dx < 0 ? 'left' : 'right'}`) +
					(atEdge ? ', as far as the grid allows' : '')}
			>
				<Label
					x={480}
					y={B.y + W / 2 + 120}
					text={atEdge
						? dx === 0
							? `no room: the map already touches the ${wanted < 0 ? 'left' : 'right'} edge`
							: `both moved ${Math.abs(dx)} px ${dx < 0 ? 'left' : 'right'}: the edge of the grid`
						: dx === 0
							? 'move the digit with the slider'
							: `both moved ${Math.abs(dx)} px ${dx < 0 ? 'left' : 'right'}`}
					size={13}
					anchor="middle"
					weight={600}
				/>
			</Readout>
			<!-- the cost: one filter against a fully connected layer -->
			<Readout
				id="cv-cost"
				order={5}
				label="Weights"
				value="this filter: 9 · fully connected: {int(dense)}"
			>
				<Label
					anchor="start"
					x={A.x}
					y={500}
					text="weights needed to make this map"
					size={13}
					weight={600}
				/>
				<rect x={290} y={518} width={3} height={14} fill="var(--cv-window)" rx="1" />
				<Label anchor="start" x={A.x} y={530} text="this filter, used everywhere" size={12} />
				<Label anchor="start" x={300} y={530} text="9" size={12} weight={700} />
				<rect x={290} y={546} width={470} height={14} fill="var(--cv-neg)" opacity="0.75" rx="2" />
				<Label anchor="start" x={A.x} y={558} text="a fully connected layer" size={12} />
				<Label
					anchor="start"
					x={770}
					y={558}
					text="784 × 784 = {int(dense)}"
					size={12}
					weight={700}
				/>
			</Readout>
		{/if}
	{/if}
</g>

<style>
	.cv-px {
		image-rendering: pixelated;
	}
</style>
