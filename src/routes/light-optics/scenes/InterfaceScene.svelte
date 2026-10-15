<script lang="ts">
	/**
	 * One flat boundary between air (top) and a material of index `params.n`
	 * (bottom), with a lamp you drag round the point where the ray meets it.
	 *
	 * Phases (`step.hints.phase`):
	 *   snell — the lamp in the air (`params.angle`): the refracted ray, the
	 *           faint partial reflection (its brightness from the Fresnel
	 *           equations), both angles and n₁ sin θ₁ = n₂ sin θ₂.
	 *   tir   — the lamp inside the material (`params.inside`), shining up: the
	 *           ray outside swings down to the surface at the critical angle,
	 *           and beyond it all the light is reflected. The critical cone is
	 *           drawn dashed.
	 *
	 * The rays are traced by optics.ts (the same tracer as everywhere else).
	 */
	import { Handle, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		block,
		criticalAngle,
		refractAngle,
		reflectance,
		toDeg,
		toRad,
		trace,
		type Vec
	} from '../optics';
	import Card from './Card.svelte';
	import Lamp from './Lamp.svelte';
	import Rays from './Rays.svelte';
	import { fmt } from './ui';

	let { step, t, params, setParam }: StageProps = $props();

	const tir = $derived(step.hints?.phase === 'tir');
	const Y0 = 300;
	const O = { x: 470, y: Y0 };
	const LR = 200; // lamp distance from O
	const BOX: [number, number, number, number] = [16, 16, 944, 584];

	const n = $derived(clamp(Number(params.n ?? 1.52), 1, 2.42));
	const id = $derived(tir ? 'inside' : 'angle');
	const theta = $derived(clamp(Number(params[id] ?? (tir ? 30 : 40)), 0, 85));
	const n1 = $derived(tir ? n : 1);
	const n2 = $derived(tir ? 1 : n);
	const theta2 = $derived(refractAngle(n1, n2, theta));
	const R = $derived(reflectance(n1, n2, theta));
	const crit = $derived(criticalAngle(n, 1));

	// The lamp: up-left of O in the air, or down-left of it inside the material.
	const side = $derived(tir ? 1 : -1);
	const lampAt = $derived({
		x: O.x - LR * Math.sin(toRad(theta)),
		y: O.y + side * LR * Math.cos(toRad(theta))
	});
	const aim = $derived({ x: Math.sin(toRad(theta)), y: -side * Math.cos(toRad(theta)) });
	const glass = $derived(block('glass', { x: 480, y: Y0 + 1000 }, 4000, 2000, 0, () => n));
	const paths = $derived(
		trace([glass], { x: lampAt.x + aim.x * 4, y: lampAt.y + aim.y * 4 }, aim, {
			box: BOX,
			minPower: 0.001
		})
	);
	const drawn = $derived(
		paths
			.slice(0, 2)
			.map((p, i) => ({ key: `p${i}`, legs: p.legs, color: 'var(--lo-ray)', width: 3 }))
	);

	function onmove(p: Vec) {
		// Angle from the normal, on the lamp's side of the boundary.
		const dy = (p.y - O.y) * side;
		const a = toDeg(Math.atan2(O.x - p.x, Math.max(1, dy)));
		setParam(id, Math.round(clamp(a, 0, 85) * 2) / 2);
	}
	function onkey(k: number | 'start' | 'end') {
		setParam(id, k === 'start' ? 0 : k === 'end' ? 85 : clamp(theta + k, 0, 85));
	}

	/** Arc of radius r around O between screen angles a and b (degrees, 0 = right). */
	function arc(a: number, b: number, r: number) {
		const p = (d: number) => `${O.x + r * Math.cos(toRad(d))} ${O.y + r * Math.sin(toRad(d))}`;
		const sweep = b > a ? 1 : 0;
		return `M${p(a)} A${r} ${r} 0 0 ${sweep} ${p(b)}`;
	}
	/** Point at radius r around O at screen angle d. */
	const at = (d: number, r: number) => ({
		x: O.x + r * Math.cos(toRad(d)),
		y: O.y + r * Math.sin(toRad(d))
	});
	// Screen angles of the normal on the lamp's side and on the far side.
	const nearNormal = $derived(tir ? 90 : -90);
	const farNormal = $derived(tir ? -90 : 90);
	// The incoming ray, seen from O, points back to the lamp.
	const inAngle = $derived(nearNormal + (tir ? theta : -theta));
	const outAngle = $derived(theta2 === null ? null : farNormal + (tir ? theta2 : -theta2));
	const name = $derived(
		(
			[
				[1, 'air'],
				[1.33, 'water'],
				[1.46, 'fused silica'],
				[1.52, 'crown glass'],
				[1.78, 'flint glass'],
				[2.42, 'diamond']
			] as [number, string][]
		).find(([m]) => Math.abs(m - n) < 0.005)?.[1] ?? 'material'
	);
	const pct = (r: number) =>
		r > 0.995 ? '100%' : r < 0.1 ? `${fmt(r * 100, 1)}%` : `${fmt(r * 100, 0)}%`;
	const sinText = (nn: number, a: number) => fmt(nn * Math.sin(toRad(a)), 3);
</script>

{#snippet labelText(
	x: number,
	y: number,
	s: string,
	o: {
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		muted?: boolean;
		color?: string;
		weight?: number;
		keep?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={o.muted}
		text-anchor={o.anchor ?? 'middle'}
		font-size={o.size ?? 13}
		style:fill={o.color}
		font-weight={o.weight ?? 500}>{s}</text
	>
{/snippet}

<!-- Stage labels leave the drawing on phones (see <Readout>), unless `keep`. -->
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
		keep?: boolean;
	} = {}
)}
	<Readout id="label">
		{#snippet narrow()}
			{#if o.keep}{@render labelText(x, y, s, o)}{/if}
		{/snippet}
		{@render labelText(x, y, s, o)}
	</Readout>
{/snippet}

<g>
	<rect
		x={BOX[0]}
		y={Y0}
		width={BOX[2] - BOX[0]}
		height={BOX[3] - Y0}
		rx="10"
		fill="var(--lo-glass)"
		opacity={clamp((n - 1) / 0.4, 0, 1)}
	/>
	<line x1={BOX[0]} y1={Y0} x2={BOX[2]} y2={Y0} stroke="var(--lo-glass-edge)" stroke-width="1.5" />
	{@render label(32, Y0 - 16, 'air · n = 1.00', { anchor: 'start', muted: true, size: 13 })}
	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="key-medium" order={1} label="Below the line: {name}, n = {fmt(n, 2)}">
		{@render label(32, Y0 + 28, `${name} · n = ${fmt(n, 2)}`, {
			anchor: 'start',
			muted: true,
			size: 13
		})}
	</Readout>

	<!-- normal -->
	<line
		x1={O.x}
		y1={Y0 - 250}
		x2={O.x}
		y2={Y0 + 250}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.4"
		stroke-dasharray="6 5"
	/>
	{@render label(O.x + 8, tir ? Y0 - 236 : Y0 + 246, 'normal', {
		muted: true,
		size: 12,
		anchor: 'start'
	})}

	{#if tir && crit !== null}
		<!-- the critical angle, both sides of the normal -->
		{#each [-1, 1] as s (s)}
			{@const p = at(90 + s * crit, 250)}
			<line
				x1={O.x}
				y1={O.y}
				x2={p.x}
				y2={p.y}
				stroke="var(--lo-theta2)"
				stroke-width="1.4"
				stroke-dasharray="3 5"
				opacity="0.8"
			/>
		{/each}
	{/if}

	<!-- angle arcs -->
	{#if theta > 0.5}
		<path
			d={arc(nearNormal, inAngle, 64)}
			fill="none"
			stroke="var(--lo-theta1)"
			stroke-width="2.5"
		/>
		{@const m = at((nearNormal + inAngle) / 2, 108)}
		{#if theta >= 12}
			{@render label(m.x, m.y + 5, `${fmt(theta, 0)}°`, {
				color: 'var(--lo-theta1)',
				weight: 700,
				size: 14
			})}
		{/if}
	{/if}
	{#if outAngle !== null && theta2 !== null && theta2 > 0.5}
		<path
			d={arc(farNormal, outAngle, 72)}
			fill="none"
			stroke="var(--lo-theta2)"
			stroke-width="2.5"
		/>
		{@const m = at((farNormal + outAngle) / 2, 116)}
		{#if theta2 >= 12}
			{@render label(m.x, m.y + 5, `${fmt(theta2, 0)}°`, {
				color: 'var(--lo-theta2)',
				weight: 700,
				size: 14
			})}
		{/if}
	{/if}

	<Rays paths={drawn} {t} spacing={50} r={3.4} />

	<Lamp x={lampAt.x} y={lampAt.y} deg={toDeg(Math.atan2(aim.y, aim.x))} color="var(--lo-ray)" />
	<Handle
		x={lampAt.x - aim.x * 52}
		y={lampAt.y - aim.y * 52}
		r={8}
		label="Lamp"
		value={theta}
		min={0}
		max={85}
		valuetext="{fmt(theta, 1)} degrees from the normal"
		{onmove}
		{onkey}
	/>

	{#if tir}
		<Card
			x={24}
			y={24}
			w={328}
			h={84}
			cells={[
				{ id: 'in', label: 'Inside', value: `${fmt(theta, 1)}°`, color: 'var(--lo-theta1)' },
				{
					id: 'out',
					label: 'Outside',
					value: theta2 === null ? 'none' : `${fmt(theta2, 1)}°`,
					color: 'var(--lo-theta2)',
					sub: theta2 === null ? 'no way out' : undefined
				},
				{
					id: 'r',
					label: 'Reflected',
					value: pct(R),
					sub: theta2 === null ? 'total' : 'of the light'
				}
			]}
		/>
		{#if theta2 === null}
			{@render label(188, 134, 'Total internal reflection', { weight: 700, size: 15 })}
		{/if}
		{#if crit !== null}
			<Readout
				id="crit"
				order={20}
				label="Critical angle (dashed)"
				value="{fmt(crit, 1)}°"
				color="var(--lo-theta2)"
			>
				{@render label(
					188,
					theta2 === null ? 156 : 134,
					`critical angle ${fmt(crit, 1)}° (dashed)`,
					{
						color: 'var(--lo-theta2)',
						size: 13,
						weight: 600
					}
				)}
			</Readout>
		{:else}
			<Readout
				id="crit"
				order={20}
				label="Critical angle"
				value="none"
				note="n is 1, the same as air"
			>
				{@render label(188, 134, 'no critical angle: n is 1, the same as air', {
					muted: true,
					size: 12
				})}
			</Readout>
		{/if}
	{:else}
		<Card
			x={604}
			y={24}
			w={328}
			h={84}
			cells={[
				{ id: 'a', label: 'In the air', value: `${fmt(theta, 1)}°`, color: 'var(--lo-theta1)' },
				{
					id: 'b',
					label: `In the ${name === 'air' ? 'air below' : 'material'}`,
					value: `${fmt(theta2 ?? 0, 1)}°`,
					color: 'var(--lo-theta2)'
				},
				{ id: 'r', label: 'Reflected', value: pct(R), sub: 'of the light' }
			]}
		/>
		<Readout
			id="snell"
			order={20}
			label="n × sin θ, both sides"
			value="{sinText(1, theta)} = {sinText(n, theta2 ?? 0)}"
			note="1.00 × sin {fmt(theta, 1)}° = {fmt(n, 2)} × sin {fmt(theta2 ?? 0, 1)}°"
		>
			{@render label(768, 134, `1.00 × sin ${fmt(theta, 1)}° = ${sinText(1, theta)}`, {
				size: 13,
				color: 'var(--lo-theta1)',
				weight: 600
			})}
			{@render label(
				768,
				154,
				`${fmt(n, 2)} × sin ${fmt(theta2 ?? 0, 1)}° = ${sinText(n, theta2 ?? 0)}`,
				{
					size: 13,
					color: 'var(--lo-theta2)',
					weight: 600
				}
			)}
		</Readout>
	{/if}
</g>
