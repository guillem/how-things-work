<script lang="ts">
	/**
	 * Electron domains repelling: `params.pairs` (2–6) balloons around a central atom start
	 * bunched on one side and spread out by the real calculation in `relax()` (../model.ts:
	 * charges on a sphere pushing each other with the inverse-square law). The frame shown is
	 * a pure function of t at the start of the step; changing the number of pairs replays the
	 * spreading with a Tween (wall-clock time, a reaction to a control). Once settled, the
	 * nearest-neighbour edges of the shape fade in and the readout lists the angles.
	 * Turnable by dragging or with the arrow keys; turns slowly by itself.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG presentation
	 * attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { clamp, smoothstep, startDrag, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { pairAngles, relax, type Vec } from '../model';
	import { projector } from '../look';

	let { t, params, reduced }: StageProps = $props();

	const n = $derived(clamp(Math.round(Number(params.pairs ?? 4)), 2, 6));
	// 60 frames of 6 small steps each: settled (to 0.5°) for every n by the last frame.
	const FRAMES = 61;
	const cache: Record<number, Vec[][]> = {};
	/** Rotation (Rodrigues) taking unit vector a onto b, applied to v. */
	function turnOnto(a: Vec, b: Vec, v: Vec): Vec {
		const k: Vec = [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0]
		];
		const s = Math.hypot(...k);
		const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
		if (s < 1e-9) return c > 0 ? v : [-v[0], -v[1], -v[2]];
		const u: Vec = [k[0] / s, k[1] / s, k[2] / s];
		const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
		const x: Vec = [
			u[1] * v[2] - u[2] * v[1],
			u[2] * v[0] - u[0] * v[2],
			u[0] * v[1] - u[1] * v[0]
		];
		return [0, 1, 2].map((i) => v[i] * c + x[i] * s + u[i] * d * (1 - c)) as Vec;
	}
	const frames = $derived.by(() => {
		let f = cache[n];
		if (!f) {
			const raw = relax(n, FRAMES, 6, 0.02);
			// Turn the whole run so the settled first pair points straight up: a clear first view.
			const a = raw[FRAMES - 1][0];
			f = raw.map((pts) => pts.map((v) => turnOnto(a, [0, 0, 1], v)));
			cache[n] = f;
		}
		return f;
	});

	// Progress of the spreading: by t at the step's start, by a replay Tween after a change.
	const replay = new Tween(1, { duration: 3000 });
	let seen = untrack(() => n);
	$effect(() => {
		const k = n;
		untrack(() => {
			if (k === seen) return;
			seen = k;
			replay.set(0, { duration: 0 });
			replay.set(1, { duration: reduced ? 0 : 3000 });
		});
	});
	const progress = $derived(reduced ? 1 : Math.min(smoothstep(0.3, 3.5, t), replay.current));
	const pts = $derived(frames[Math.round(progress * (FRAMES - 1))]);
	const settled = $derived(smoothstep(0.9, 1, progress));

	const CX = 360;
	const CY = 300;
	const R = 150;
	let yawOff = $state(0);
	let pitch = $state(0.35);
	const yaw = $derived(yawOff + 0.4 + (reduced ? 0 : 0.15 * t));
	const project = $derived(projector(yaw, pitch, CX, CY));

	const lobes = $derived(
		pts
			.map((p, i) => {
				const tip = project([p[0] * R, p[1] * R, p[2] * R]);
				const mid = project([p[0] * R * 0.55, p[1] * R * 0.55, p[2] * R * 0.55]);
				const dx = tip.x - CX;
				const dy = tip.y - CY;
				return {
					i,
					tip,
					mid,
					depth: tip.depth,
					angle: (Math.atan2(dy, dx) * 180) / Math.PI,
					stretch: Math.hypot(dx, dy) / R
				};
			})
			.sort((a, b) => a.depth - b.depth)
	);
	const behind = $derived(lobes.filter((l) => l.depth < 0));
	const front = $derived(lobes.filter((l) => l.depth >= 0));

	// Edges between nearest neighbours: the outline of the shape.
	const edges = $derived.by(() => {
		const final = frames[FRAMES - 1];
		const angs = pairAngles(final);
		const min = angs[0];
		const out: { k: string; a: number; b: number }[] = [];
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) {
				const d = final[i][0] * final[j][0] + final[i][1] * final[j][1] + final[i][2] * final[j][2];
				const ang = (Math.acos(clamp(d, -1, 1)) * 180) / Math.PI;
				if (n === 2 || ang < min + 35) out.push({ k: `${i}-${j}`, a: i, b: j });
			}
		return out;
	});
	const tipOf = (i: number) => project([pts[i][0] * R, pts[i][1] * R, pts[i][2] * R]);

	// Rounded to half a degree, so that a settled tetrahedron reads 109.5°.
	const distinct = $derived([...new Set(pairAngles(pts).map((a) => Math.round(a * 2) / 2))]);

	const INFO: Record<number, { shape: string; example: string; note?: string }> = {
		2: { shape: 'linear', example: 'CO₂, HCN' },
		3: { shape: 'trigonal planar', example: 'formaldehyde, CH₂O' },
		4: { shape: 'tetrahedral', example: 'methane, CH₄' },
		5: { shape: 'trigonal bipyramidal', example: 'PCl₅', note: 'atoms from the third row down' },
		6: { shape: 'octahedral', example: 'SF₆', note: 'atoms from the third row down' }
	};
	const info = $derived(INFO[n]);

	let last: Point | null = null;
	function turn(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (last) {
					yawOff += (p.x - last.x) * 0.012;
					pitch = clamp(pitch + (p.y - last.y) * 0.012, -1.4, 1.4);
				}
				last = p;
			},
			() => (last = null)
		);
	}
	function turnKey(e: KeyboardEvent) {
		const k = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') yawOff -= k;
		else if (e.key === 'ArrowRight') yawOff += k;
		else if (e.key === 'ArrowUp') pitch = clamp(pitch - k, -1.4, 1.4);
		else if (e.key === 'ArrowDown') pitch = clamp(pitch + k, -1.4, 1.4);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}
	const PX = 640;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet lobe(l: (typeof lobes)[number])}
	<g transform="translate({l.mid.x} {l.mid.y}) rotate({l.angle})">
		<ellipse
			rx={18 + 64 * l.stretch}
			ry="34"
			fill="var(--focus)"
			fill-opacity={0.16 + 0.12 * clamp(l.depth / R + 0.5)}
			stroke="var(--focus)"
			stroke-width="1.5"
		/>
		<circle cx={40 * l.stretch} cy="-6" r="4" fill="var(--stage-ink)" />
		<circle cx={40 * l.stretch} cy="6" r="4" fill="var(--stage-ink)" />
	</g>
{/snippet}

<g>
	<rect
		class="turn"
		x={CX - 250}
		y={CY - 250}
		width="500"
		height="500"
		rx="16"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Turn the electron pairs: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360}
		onpointerdown={turn}
		onkeydown={turnKey}
	/>
	<g style:pointer-events="none">
		{#each behind as l (l.i)}
			{@render lobe(l)}
		{/each}
		<!-- the outline of the shape, once settled -->
		{#each edges as e (e.k)}
			{@const p = tipOf(e.a)}
			{@const q = tipOf(e.b)}
			<line
				x1={p.x}
				y1={p.y}
				x2={q.x}
				y2={q.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 5"
				opacity={settled}
			/>
		{/each}
		<circle cx={CX} cy={CY} r="24" fill="var(--carbon)" stroke="var(--stage-ink-muted)" />
		<text
			x={CX}
			y={CY + 6}
			text-anchor="middle"
			font-weight="700"
			style:font-size="16px"
			style:fill="#ffffff">A</text
		>
		{#each front as l (l.i)}
			{@render lobe(l)}
		{/each}
	</g>

	<!-- readout -->
	{@render txt(PX, 70, `${n} electron domains`, 22, { weight: 700 })}
	{@render txt(PX, 96, settled > 0.5 ? info.shape : 'spreading out…', 17, {
		weight: 600,
		muted: settled <= 0.5
	})}
	{@render txt(PX, 130, 'Angles between domains now:', 13, { weight: 600 })}
	{@render txt(
		PX,
		150,
		distinct.length > 4 ? 'still changing…' : distinct.map((a) => `${a}°`).join(', '),
		14,
		{ weight: 700 }
	)}
	{#if settled > 0.5}
		{@render txt(PX, 188, `Like the ${n} domains around the centre of`, 13)}
		{@render txt(PX, 206, info.example, 13, { weight: 600 })}
		{#if info.note}
			{@render txt(PX, 224, `(${info.note}: they can hold more than 8)`, 11, { muted: true })}
		{/if}
	{/if}
	{#if n === 4}
		{@render txt(PX, 268, 'Flat, four would be 90° apart;', 12, { muted: true })}
		{@render txt(PX, 284, 'in 3D they get 109.5°.', 12, { muted: true })}
	{/if}
	<g transform="translate({PX} 330)">
		<ellipse
			cx="30"
			cy="0"
			rx="30"
			ry="16"
			fill="var(--focus)"
			fill-opacity="0.2"
			stroke="var(--focus)"
		/>
		<circle cx="42" cy="-5" r="3.5" fill="var(--stage-ink)" />
		<circle cx="42" cy="5" r="3.5" fill="var(--stage-ink)" />
		{@render txt(72, -2, 'one electron domain: a bond', 12)}
		{@render txt(72, 14, '(single, double or triple) or a lone pair', 12, { muted: true })}
	</g>
	{@render txt(PX, 400, 'The spreading is computed: charges on a', 11, { muted: true })}
	{@render txt(PX, 415, 'sphere pushing each other apart (1/r²).', 11, { muted: true })}
	{@render txt(CX, 584, 'Drag to turn · change the number of domains to replay', 11, {
		anchor: 'middle',
		muted: true
	})}
</g>

<style>
	.turn {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.turn:active {
		cursor: grabbing;
	}
	.turn:focus-visible {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
