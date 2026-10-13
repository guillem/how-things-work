<script lang="ts">
	/**
	 * Dispersion: a lamp shines on the left face of an equilateral prism of
	 * `params.material` (sourced Sellmeier indices); the light is white
	 * (`params.white`, traced as ten colours from red to violet) or one colour
	 * (`params.nm`). Drag the lamp round the face to change the angle of
	 * incidence; choosing a material sets it to that material's angle of
	 * minimum deviation (for yellow light). The light lands on a curved screen,
	 * where each colour leaves a spot.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		MATERIALS,
		YELLOW,
		dir,
		exitDirection,
		polygon,
		prismCorners,
		toDeg,
		toRad,
		trace,
		type Element,
		type MaterialId,
		type RayPath,
		type Vec
	} from '../optics';
	import Card from './Card.svelte';
	import Lamp from './Lamp.svelte';
	import Rays from './Rays.svelte';
	import { WHITE, fmt, pathOf, rayColour, spectrumPaths, type DrawnPath } from './ui';

	let { t, params, dark }: StageProps = $props();

	const C0 = { x: 400, y: 330 };
	const SIDE = 230;
	const corners = prismCorners(C0, SIDE, 0); // apex, right base, left base
	const leftMid = { x: (corners[0].x + corners[2].x) / 2, y: (corners[0].y + corners[2].y) / 2 };
	const rightMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
	const BOX: [number, number, number, number] = [16, 16, 944, 584];
	const SCREEN_R = 330;
	// The screen: an arc round the right face, from 25° above to 55° below the horizontal.
	const screenPts = Array.from({ length: 17 }, (_, i) => {
		const a = toRad(-25 + i * 5);
		return { x: rightMid.x + SCREEN_R * Math.cos(a), y: rightMid.y + SCREEN_R * Math.sin(a) };
	});
	const screens: Element[] = screenPts.slice(1).map((b, i) => ({
		kind: 'screen',
		id: `s${i}`,
		a: screenPts[i],
		b
	}));

	const materialId = $derived.by((): MaterialId => {
		const m = String(params.material ?? 'flint');
		return m in MATERIALS ? (m as MaterialId) : 'flint';
	});
	const material = $derived(MATERIALS[materialId]);
	const white = $derived(params.white !== false);
	const nm = $derived(Number(params.nm ?? 650));
	const prism = $derived(polygon('prism', corners, material.n));
	const elements = $derived([prism, ...screens]);

	/** Angle of incidence for minimum deviation of yellow light: sin i = n sin 30°. */
	function bestIncidence(n: number) {
		const s = n * Math.sin(toRad(30));
		return s >= 1 ? 50 : Math.round(toDeg(Math.asin(s)));
	}
	let incidence = $state(63);
	$effect(() => {
		const n = material.n(YELLOW);
		untrack(() => (incidence = bestIncidence(n)));
	});

	// The left face's inward normal points along 30° (down-right); the beam is turned
	// from it by the angle of incidence, upwards.
	const beamDir = $derived(dir(30 - incidence));
	const lampAt = $derived({ x: leftMid.x - beamDir.x * 250, y: leftMid.y - beamDir.y * 250 });
	const from = $derived({ x: lampAt.x + beamDir.x * 4, y: lampAt.y + beamDir.y * 4 });
	const opts = { box: BOX, minPower: 0.1, maxLegs: 12 };

	const sets = $derived(
		(white ? WHITE : [nm]).map((w) => ({
			nm: w,
			paths: trace(elements, from, beamDir, { ...opts, nm: w }).slice(0, 4)
		}))
	);
	const drawn = $derived.by((): DrawnPath[] => {
		if (white) return spectrumPaths(sets, dark, 'var(--lo-white)', 'p');
		const color = rayColour(nm, dark);
		return sets[0].paths.map((p, i) => ({ key: `m${i}`, legs: p.legs, color }));
	});
	/** Spots on the screen: the ends of the paths that landed there. */
	const spots = $derived(
		sets.flatMap((s) =>
			s.paths
				.filter((p) => p.end === 'screen')
				.map((p) => ({
					key: `${s.nm}-${p.legs.length}`,
					at: p.legs[p.legs.length - 1].b,
					nm: s.nm
				}))
		)
	);
	const outOf = (p: RayPath) => p.events.length >= 2 && p.events[p.events.length - 1] === 'refract';
	/** Angle (degrees) between the beam and the light leaving the prism, for one colour. */
	function deviation(w: number): number | null {
		const p = trace([prism], from, beamDir, { ...opts, nm: w })[0];
		if (!outOf(p) || p.events.includes('tir')) return null;
		const e = exitDirection(p);
		return toDeg(Math.acos(clamp(e.x * beamDir.x + e.y * beamDir.y, -1, 1)));
	}
	const devRed = $derived(deviation(656.3));
	const devViolet = $derived(deviation(404.7));
	const devHere = $derived(deviation(white ? YELLOW : nm));

	function onmove(p: Vec) {
		// The lamp's direction seen from the face's middle, against the outward normal (210°).
		const a = toDeg(Math.atan2(leftMid.y - p.y, leftMid.x - p.x));
		incidence = Math.round(clamp(30 - a, 0, 85));
	}
	function onkey(k: number | 'start' | 'end') {
		incidence = k === 'start' ? 0 : k === 'end' ? 85 : clamp(incidence + k, 0, 85);
	}
	const knob = $derived({ x: lampAt.x - beamDir.x * 52, y: lampAt.y - beamDir.y * 52 });
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
		style:font-size="{o.size ?? 13}px"
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
	<path
		d={pathOf(corners, true)}
		fill="var(--lo-glass)"
		stroke="var(--lo-glass-edge)"
		stroke-width="1.5"
		stroke-linejoin="round"
	/>
	<Readout id="key-prism" order={1} label="{material.name} prism">
		{@render label(C0.x + 14, corners[0].y - 4, `${material.name} prism`, {
			muted: true,
			size: 12,
			anchor: 'start'
		})}
	</Readout>
	<path
		d={pathOf(screenPts)}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	{@render label(screenPts[16].x - 10, screenPts[16].y + 24, 'screen', { muted: true, size: 12 })}

	<Rays paths={drawn} {t} spacing={50} r={2.8} />
	{#each spots as s (s.key)}
		<circle cx={s.at.x} cy={s.at.y} r="5" fill={rayColour(s.nm, dark)} />
	{/each}

	<Lamp
		x={lampAt.x}
		y={lampAt.y}
		deg={toDeg(Math.atan2(beamDir.y, beamDir.x))}
		color={white ? 'var(--lo-white)' : rayColour(nm, dark)}
	/>
	<Handle
		x={knob.x}
		y={knob.y}
		r={8}
		label="Lamp"
		value={incidence}
		min={0}
		max={85}
		valuetext="{incidence} degrees from the face's normal"
		{onmove}
		{onkey}
	/>

	<Card
		x={24}
		y={24}
		w={600}
		h={84}
		cells={[
			{
				id: 'r',
				label: 'n for red (656 nm)',
				value: fmt(material.n(656.3), 3),
				color: rayColour(656.3, dark)
			},
			{
				id: 'v',
				label: 'n for violet (405 nm)',
				value: fmt(material.n(404.7), 3),
				color: rayColour(404.7, dark)
			},
			{
				id: 'd',
				label: white ? 'Yellow is turned by' : 'This colour turns by',
				value: devHere === null ? '—' : `${fmt(devHere, 1)}°`
			},
			{
				id: 's',
				label: 'Spread of the colours',
				value: devRed !== null && devViolet !== null ? `${fmt(devViolet - devRed, 1)}°` : '—',
				sub: devRed !== null && devViolet !== null ? 'violet bent most' : 'not all get out'
			}
		]}
	/>
	{#if devHere === null}
		<Readout
			id="tir"
			order={2}
			label="Total internal reflection"
			value="no light out"
			note="it cannot get out through the far face"
			color="var(--lo-theta2)"
		>
			{@render label(932, 48, 'Total internal reflection:', {
				size: 13,
				weight: 700,
				anchor: 'end',
				color: 'var(--lo-theta2)'
			})}
			{@render label(932, 68, 'the light cannot get out through the far face', {
				size: 13,
				anchor: 'end',
				color: 'var(--lo-theta2)'
			})}
		</Readout>
	{/if}
	{@render label(lampAt.x + 10, lampAt.y + 48, 'drag the lamp', { muted: true, size: 12 })}
</g>
