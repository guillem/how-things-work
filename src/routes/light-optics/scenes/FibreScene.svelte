<script lang="ts">
	/**
	 * An optical fibre (a fused-silica rod in air, drawn far too thick) with a
	 * 90° bend of inner radius `params.bend`. A lamp shines a narrow beam into
	 * its flat end at `params.entry` degrees to the axis (drag the lamp to
	 * change it). The rays are traced with total internal reflection at the
	 * walls; where a bend is too tight they meet the wall below the critical
	 * angle and partly escape (the escaping rays are drawn). The readout sums
	 * the light that leaves through the far end face.
	 */
	import { Handle, clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { MATERIALS, criticalAngle, dir, fibre, toDeg, trace, type Vec } from '../optics';
	import Card from './Card.svelte';
	import Lamp from './Lamp.svelte';
	import Rays from './Rays.svelte';
	import { fmt, pathOf, type DrawnPath } from './ui';

	let { t, params, setParam }: StageProps = $props();

	const W = 40; // fibre width
	const START = { x: 240, y: 470 };
	const L1 = 230;
	const TOP = 64; // where the far end sits
	const BOX: [number, number, number, number] = [16, 16, 944, 584];
	const silica = MATERIALS.silica;
	const NM = 589.3;
	const crit = criticalAngle(silica.n(NM), 1) ?? 0;

	const bendR = $derived(clamp(Number(params.bend ?? 160), 5, 220));
	const entry = $derived(clamp(Number(params.entry ?? 25), 0, 60));
	const geo = $derived.by(() => {
		// After the bend the fibre runs straight up to y = TOP.
		const endOfBend = START.y - (bendR + W / 2);
		return fibre(START, W, L1, bendR, 90, Math.max(20, endOfBend - TOP), silica.n);
	});
	const end = $derived(geo.centre[geo.centre.length - 1]);

	// The beam: three rays aimed across the end face, coming down at `entry`.
	const beamDir = $derived(dir(entry));
	const lampAt = $derived({ x: START.x - beamDir.x * 110, y: START.y - beamDir.y * 110 });
	const traced = $derived(
		[-9, 0, 9].map((y) => {
			const target = { x: START.x, y: START.y + y };
			const from = { x: target.x - beamDir.x * 104, y: target.y - beamDir.y * 104 };
			return trace(geo.pieces, from, beamDir, { box: BOX, minPower: 0.04, maxLegs: 70 }).slice(
				0,
				10
			);
		})
	);
	const drawn = $derived(
		traced.flatMap((paths, j) =>
			paths.map((p, i): DrawnPath => ({
				key: `r${j}-${i}`,
				legs: p.legs,
				color: 'var(--lo-ray)',
				width: 2.2
			}))
		)
	);
	/** Share of the beam that leaves through the far end. */
	const delivered = $derived(
		traced
			.flatMap((paths) => paths.map((p) => p.legs[p.legs.length - 1]))
			.filter((l) => l.a.y <= end.y + 1e-6)
			.reduce((s, l) => s + l.power, 0) / traced.length
	);
	const bounces = $derived(traced[1][0].events.filter((e) => e === 'tir').length);
	const outline = $derived(
		pathOf([...geo.outline.outer, ...[...geo.outline.inner].reverse()], true)
	);

	function onmove(p: Vec) {
		const a = toDeg(Math.atan2(START.y - p.y, START.x - p.x));
		setParam('entry', Math.round(clamp(a, 0, 60)));
	}
	function onkey(k: number | 'start' | 'end') {
		setParam('entry', k === 'start' ? 0 : k === 'end' ? 60 : clamp(entry + k, 0, 60));
	}
	const knob = $derived({ x: lampAt.x - beamDir.x * 52, y: lampAt.y - beamDir.y * 52 });
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
	<path d={outline} fill="var(--lo-glass)" stroke="var(--lo-glass-edge)" stroke-width="1.5" />
	<Rays paths={drawn} {t} spacing={44} r={2.8} />
	{@render label(START.x + 110, START.y + W / 2 + 26, 'fused silica, n = 1.46, in air', {
		muted: true,
		size: 12
	})}
	{@render label(end.x + W / 2 + 12, end.y + 8, 'far end', {
		muted: true,
		size: 12,
		anchor: 'start'
	})}

	<Lamp x={lampAt.x} y={lampAt.y} deg={entry} color="var(--lo-ray)" />
	<Handle
		x={knob.x}
		y={knob.y}
		r={8}
		label="Lamp"
		value={entry}
		min={0}
		max={60}
		valuetext="{entry} degrees to the fibre's axis"
		{onmove}
		{onkey}
	/>

	<Card
		x={24}
		y={24}
		w={392}
		h={84}
		cells={[
			{
				id: 'd',
				label: 'Reaches the far end',
				value: `${fmt(delivered * 100, 0)}%`,
				color: delivered > 0.8 ? 'var(--lo-image)' : 'var(--lo-ray)',
				sub: 'of the light'
			},
			{ id: 'c', label: 'Critical angle', value: `${fmt(crit, 1)}°`, sub: 'silica to air' },
			{
				id: 'b',
				label: 'Bend radius',
				value: `${fmt(bendR / W, 1)} ×`,
				sub: 'the fibre width'
			}
		]}
	/>
	{#if delivered < 0.8}
		{@render label(220, 134, 'Too tight: light escapes at the bend', {
			weight: 700,
			size: 14,
			color: 'var(--lo-ray)'
		})}
	{:else}
		{@render label(220, 134, `Trapped: ${bounces} reflections on the way`, {
			weight: 600,
			size: 13,
			muted: true
		})}
	{/if}
</g>
