<script lang="ts">
	/**
	 * A lens on an optical axis, with rays traced through its real spherical
	 * faces (radius `params.radius`, index `params.n`). Scale: 2 stage units = 1 mm.
	 *
	 * Phases (`step.hints.phase`):
	 *   focus — a beam of parallel rays; converging or diverging (`params.lens`).
	 *           The lens can be dragged along the axis. The foci F from the
	 *           lensmaker's equation are marked; for a diverging lens the
	 *           outgoing rays are extended back (dashed) to the virtual focus.
	 *   image — a converging lens and an object (an arrow) at `params.u`
	 *           (drag it). A fan of rays from the arrow's tip is traced; the
	 *           image from the thin-lens equation is drawn, real (inverted) or
	 *           virtual (upright, dashed back-extensions), with u, v and the
	 *           magnification.
	 */
	import { Handle, clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		concaveLens,
		convexLens,
		exitDirection,
		imageDistance,
		thinLensFocal,
		trace,
		type Vec
	} from '../optics';
	import Card from './Card.svelte';
	import Grip from './Grip.svelte';
	import Rays from './Rays.svelte';
	import { fmt, type DrawnPath } from './ui';

	let { step, t, params, setParam }: StageProps = $props();

	const image = $derived(step.hints?.phase === 'image');
	const AX = 310; // the optical axis
	const H_FOCUS = 100; // half the lens's height
	const H_IMAGE = 70;
	const MM = 2; // stage units per millimetre
	const BOX: [number, number, number, number] = [16, 16, 944, 584];

	// The image step uses one fixed lens: crown glass (n = 1.52), faces of radius 85 mm.
	const n = $derived(image ? 1.52 : clamp(Number(params.n ?? 1.52), 1, 2.42));
	const R = $derived(image ? 170 : clamp(Number(params.radius ?? 300), 150, 500));
	const H = $derived(image ? H_IMAGE : H_FOCUS);
	const concave = $derived(!image && params.lens === 'concave');
	// Lensmaker (thin lens): 1/f = (n − 1)(1/R₁ − 1/R₂), R₁ = R, R₂ = −R for the convex lens.
	const f = $derived(n <= 1.0001 ? Infinity : thinLensFocal(n, concave ? -R : R, concave ? R : -R));

	let lensX = $state(330);
	const LX = $derived(image ? 480 : lensX);
	const sag = $derived(R - Math.sqrt(R * R - H * H));
	const lens = $derived(
		concave
			? concaveLens('lens', { x: LX, y: AX }, R, H, 6, () => n)
			: convexLens('lens', { x: LX, y: AX }, R, H, () => n)
	);
	const lensPath = $derived(
		concave
			? `M${LX - 3 - sag} ${AX - H} A${R} ${R} 0 0 1 ${LX - 3 - sag} ${AX + H} L${LX + 3 + sag} ${AX + H} A${R} ${R} 0 0 1 ${LX + 3 + sag} ${AX - H} Z`
			: `M${LX} ${AX - H} A${R} ${R} 0 0 0 ${LX} ${AX + H} A${R} ${R} 0 0 0 ${LX} ${AX - H} Z`
	);

	// ---------------------------------------------------------------- focus phase
	const HEIGHTS = [-80, -60, -40, -20, 0, 20, 40, 60, 80];
	const beam = $derived(
		image
			? []
			: HEIGHTS.map(
					(h) => trace([lens], { x: 20, y: AX + h }, { x: 1, y: 0 }, { box: BOX, minPower: 0.1 })[0]
				)
	);
	/** Where a ray close to the axis crosses it after the lens: the traced focus. */
	const tracedFocus = $derived.by(() => {
		if (image || n <= 1.0001) return null;
		const p = trace(
			[lens],
			{ x: 20, y: AX - 2 },
			{ x: 1, y: 0 },
			{ box: [-4000, -4000, 5000, 5000] }
		)[0];
		const l = p.legs[p.legs.length - 1];
		const d = exitDirection(p);
		if (Math.abs(d.y) < 1e-9) return null;
		return l.a.x + ((AX - l.a.y) / d.y) * d.x - LX;
	});

	// ---------------------------------------------------------------- image phase
	const u = $derived(clamp(Number(params.u ?? 400), 90, 440));
	const OBJ = 64; // height of the object arrow
	const tip = $derived({ x: LX - u, y: AX - OBJ });
	const v = $derived(imageDistance(f, u));
	const fan = $derived(
		image
			? [-50, -25, 0, 25, 50].map((h) => {
					const aim = { x: LX - tip.x, y: AX + h - tip.y };
					return trace([lens], tip, aim, { box: BOX, minPower: 0.1 })[0];
				})
			: []
	);
	const real = $derived(Number.isFinite(v) && v > 0);
	const imgX = $derived(LX + v);
	const imgH = $derived((OBJ * v) / u); // positive: below the axis (inverted)
	const imgOnStage = $derived(
		Number.isFinite(v) && imgX > 40 && imgX < 920 && Math.abs(imgH) < 260
	);

	/** Dashed lines from where each ray leaves the lens back to x = toX. */
	function backLines(paths: typeof fan, toX: number) {
		return paths.flatMap((p, i) => {
			const l = p.legs[p.legs.length - 1];
			const d = exitDirection(p);
			if (d.x <= 0.05) return [];
			const s = (l.a.x - toX) / d.x;
			return [{ i, a: l.a, b: { x: l.a.x - d.x * s, y: l.a.y - d.y * s } }];
		});
	}
	const virtualLines = $derived.by(() => {
		if (image && !real && imgOnStage) return backLines(fan, imgX);
		if (!image && concave && Number.isFinite(f)) return backLines(beam, LX + f);
		return [];
	});

	const drawn = $derived<DrawnPath[]>(
		(image ? fan : beam).map((p, i) => ({
			key: `r${i}`,
			legs: p.legs,
			color: 'var(--lo-ray)',
			width: 2
		}))
	);

	function moveObject(p: Vec) {
		setParam('u', Math.round(clamp(LX - p.x, 90, 440)));
	}
	function keyObject(k: number | 'start' | 'end') {
		// Right arrow moves the object right, towards the lens.
		setParam('u', k === 'start' ? 440 : k === 'end' ? 90 : clamp(u - k * 2, 90, 440));
	}
	const mm = (x: number) => `${fmt(x / MM, 0)} mm`;
	const arrow = (x: number, y0: number, y1: number) => {
		const s = Math.sign(y1 - y0) || 1;
		return `M${x} ${y0} L${x} ${y1} M${x - 7} ${y1 - s * 11} L${x} ${y1} L${x + 7} ${y1 - s * 11}`;
	};
</script>

{#snippet label(
	x: number,
	y: number,
	s: string,
	o: {
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		muted?: boolean;
		color?: string;
		weight?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={o.muted}
		text-anchor={o.anchor ?? 'middle'}
		style:font-size="{o.size ?? 13}px"
		style:fill={o.color}
		font-weight={o.weight ?? 500}>{s}</text
	>
{/snippet}

<g>
	<!-- the optical axis -->
	<line
		x1={BOX[0]}
		y1={AX}
		x2={BOX[2]}
		y2={AX}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="8 6"
		opacity="0.7"
	/>

	{#if image}
		<path d={lensPath} fill="var(--lo-glass)" stroke="var(--lo-glass-edge)" stroke-width="1.5" />
	{:else}
		<Grip
			x={lensX}
			y={AX}
			label="Lens"
			onmove={(p: Vec) => (lensX = Math.round(clamp(p.x, 200, 700)))}
		>
			<rect
				x={LX - sag - 10}
				y={AX - H - 6}
				width={2 * sag + 20}
				height={2 * H + 12}
				fill="transparent"
			/>
			<path d={lensPath} fill="var(--lo-glass)" stroke="var(--lo-glass-edge)" stroke-width="1.5" />
		</Grip>
	{/if}

	<!-- foci -->
	{#if Number.isFinite(f)}
		{#each [-1, 1] as s (s)}
			{@const fx = LX + s * Math.abs(f)}
			{#if fx > 24 && fx < 936}
				<circle cx={fx} cy={AX} r="5" fill="var(--lo-theta2)" />
				{@render label(fx, AX + 24, 'F', { color: 'var(--lo-theta2)', weight: 700, size: 15 })}
			{/if}
		{/each}
	{/if}

	{#each virtualLines as l (l.i)}
		<line
			x1={l.a.x}
			y1={l.a.y}
			x2={l.b.x}
			y2={l.b.y}
			stroke="var(--lo-ray)"
			stroke-width="1.4"
			stroke-dasharray="5 5"
			opacity="0.6"
		/>
	{/each}

	<Rays paths={drawn} {t} spacing={46} r={2.8} />

	{#if image}
		<!-- the object, and its image from the thin-lens equation -->
		<path
			d={arrow(tip.x, AX, tip.y)}
			stroke="var(--lo-theta1)"
			stroke-width="4"
			fill="none"
			stroke-linecap="round"
		/>
		<Handle
			x={tip.x}
			y={AX + 26}
			r={8}
			label="Object"
			value={u}
			min={90}
			max={440}
			valuetext="{mm(u)} from the lens"
			onmove={moveObject}
			onkey={keyObject}
		/>
		{@render label(tip.x - 12, tip.y + 4, 'object', {
			color: 'var(--lo-theta1)',
			weight: 600,
			anchor: 'end'
		})}
		{#if imgOnStage}
			<path
				d={arrow(imgX, AX, AX + imgH)}
				stroke="var(--lo-image)"
				stroke-width="4"
				fill="none"
				stroke-linecap="round"
				stroke-dasharray={real ? 'none' : '7 6'}
			/>
			{@render label(
				imgX,
				real ? AX + imgH + 24 : AX + imgH - 14,
				real ? 'real image' : 'virtual image',
				{
					color: 'var(--lo-image)',
					weight: 600
				}
			)}
		{/if}
		<Card
			x={24}
			y={24}
			w={470}
			h={84}
			cells={[
				{ id: 'f', label: 'Focal length f', value: mm(f), color: 'var(--lo-theta2)' },
				{ id: 'u', label: 'Object at u', value: mm(u), color: 'var(--lo-theta1)' },
				{
					id: 'v',
					label: 'Image at v',
					value: Number.isFinite(v) && Math.abs(v) < 1e5 ? mm(v) : 'infinity',
					color: 'var(--lo-image)',
					sub: real ? 'behind the lens' : 'in front: virtual'
				},
				{
					id: 'm',
					label: 'Size',
					value:
						Number.isFinite(v) && Math.abs(v / u) < 1000 ? `× ${fmt(Math.abs(v / u), 2)}` : '—',
					sub: real ? 'upside down' : 'upright'
				}
			]}
		/>
		{#if !imgOnStage}
			{@render label(
				259,
				132,
				real
					? 'The image forms beyond the edge of the stage'
					: 'The rays come out parallel: no image',
				{
					muted: true,
					size: 12
				}
			)}
		{/if}
	{:else}
		<Card
			x={24}
			y={24}
			w={420}
			h={84}
			cells={[
				{
					id: 'f',
					label: 'Focal length (formula)',
					value: Number.isFinite(f) ? mm(f) : 'none',
					color: 'var(--lo-theta2)',
					sub: concave ? 'negative: diverging' : 'thin-lens estimate'
				},
				{
					id: 't',
					label: concave ? 'Rays seem to come from' : 'Rays near the axis cross',
					value: tracedFocus === null ? '—' : mm(Math.abs(tracedFocus)),
					sub: concave ? 'in front of the lens' : 'behind the lens (traced)'
				}
			]}
		/>
		{@render label(24, AX - 118, 'parallel light', { anchor: 'start', muted: true, size: 12 })}
		{@render label(LX, AX + H + 32, 'drag the lens', { muted: true, size: 12 })}
	{/if}
</g>
