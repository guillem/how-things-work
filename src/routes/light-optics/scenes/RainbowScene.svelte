<script lang="ts">
	/**
	 * A raindrop (a ball of water, Daimon & Masumura indices) lit by parallel
	 * sunlight from the left. Each ray is traced: it bends into the drop,
	 * partly reflects off the back (a few per cent: drawn bright anyway, as the
	 * text says), and bends out again towards the lower left. Most of the light
	 * leaves through the back of the drop (drawn faint). The ray turned back
	 * furthest, the rainbow ray, is highlighted and its angle from the
	 * antisolar direction (straight away from the sun) is measured.
	 *
	 * One colour (`params.nm`): ten rays at different heights. White light
	 * (`params.white`): the rays in white, and the rainbow ray split into ten
	 * colours. The inset shows why the bow is seen at 42°.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { clamp } from '#lib/draw/index.ts';
	import {
		MATERIALS,
		YELLOW,
		ball,
		chain,
		exitDirection,
		rainbowAngle,
		toDeg,
		toRad,
		trace,
		type Leg,
		type Vec
	} from '../optics';
	import Card from './Card.svelte';
	import Rays from './Rays.svelte';
	import { WHITE, fmt, rayColour, type DrawnPath } from './ui';

	let { t, params, dark }: StageProps = $props();

	const water = MATERIALS.water;
	const D = { x: 470, y: 300 };
	const RD = 170;
	const drop = ball('drop', D, RD, water.n);
	const BOX: [number, number, number, number] = [16, 16, 944, 584];
	const HEIGHTS = [0.2, 0.35, 0.5, 0.62, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98];

	const white = $derived(params.white !== false);
	const nm = $derived(Number(params.nm ?? 650));

	interface Traced {
		b: number;
		/** Legs in, reflected at the back, and out again. */
		bow: Leg[];
		/** The rest of the main ray: out through the back of the drop. */
		through: Leg[];
		angle: number;
	}
	function traceAt(b: number, w: number): Traced | null {
		const paths = trace(
			[drop],
			{ x: BOX[0], y: D.y - b * RD },
			{ x: 1, y: 0 },
			{
				nm: w,
				box: BOX,
				minPower: 0.0005,
				maxLegs: 6
			}
		);
		const i = paths.findIndex((p) => p.parent === 0 && p.from === 2);
		if (i < 0) return null;
		const e = exitDirection(paths[i]);
		return {
			b,
			bow: chain(paths, i).map((l) => ({ ...l, power: 1 })),
			through: paths[0].legs.slice(2),
			angle: toDeg(Math.acos(clamp(-e.x, -1, 1)))
		};
	}

	const shown = $derived(white ? YELLOW : nm);
	const rays = $derived(HEIGHTS.flatMap((b) => traceAt(b, shown) ?? []));
	/** The rainbow ray: the height (of a fine scan) that comes back at the largest angle. */
	const bowB = $derived.by(() => {
		let best = { b: 0.86, angle: 0 };
		for (let b = 0.8; b <= 0.92; b += 0.002) {
			const r = traceAt(b, shown);
			if (r && r.angle > best.angle) best = { b, angle: r.angle };
		}
		return best.b;
	});
	const bowRays = $derived(
		(white ? WHITE : [nm]).flatMap((w) => {
			const r = traceAt(bowB, w);
			return r ? [{ nm: w, ...r }] : [];
		})
	);

	/** The legs with the last one cut to `max` long (to keep the picture readable). */
	function trim(legs: Leg[], max: number): Leg[] {
		if (!legs.length) return legs;
		const l = legs[legs.length - 1];
		const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
		if (len <= max) return legs;
		const k = max / len;
		const b = { x: l.a.x + (l.b.x - l.a.x) * k, y: l.a.y + (l.b.y - l.a.y) * k };
		return [...legs.slice(0, -1), { ...l, b }];
	}

	const drawn = $derived.by((): DrawnPath[] => {
		const out: DrawnPath[] = [];
		const base = white ? 'var(--lo-white)' : rayColour(nm, dark);
		for (const r of rays) {
			out.push({ key: `t${r.b}`, legs: trim(r.through, 90), color: base, fade: 0.3, width: 1.4 });
			out.push({
				key: `r${r.b}`,
				legs: trim(r.bow, 120),
				color: base,
				fade: white ? 0.35 : 0.55,
				width: 1.6
			});
		}
		bowRays.forEach((r, j) => {
			// In white light the colours share the way in: draw it once, white.
			if (white && j === 0) out.push({ key: 'in', legs: r.bow.slice(0, 1), color: base, width: 3 });
			out.push({
				key: `bow${r.nm}`,
				legs: r.bow,
				color: rayColour(r.nm, dark),
				skip: white ? 1 : 0,
				width: 3
			});
		});
		return out;
	});

	// The angle mark at the exit point of the (first) rainbow ray.
	const mark = $derived.by(() => {
		const r = bowRays[0];
		if (!r) return null;
		const last = r.bow[r.bow.length - 1];
		const P = last.a;
		const len = Math.hypot(last.b.x - last.a.x, last.b.y - last.a.y);
		const e = { x: (last.b.x - last.a.x) / len, y: (last.b.y - last.a.y) / len };
		const R = 110;
		const a0 = Math.PI; // antisolar direction: straight back towards the left
		const a1 = Math.atan2(e.y, e.x);
		return {
			P,
			ref: { x: P.x - 150, y: P.y },
			arc: `M${P.x - R} ${P.y} A${R} ${R} 0 0 0 ${P.x + R * Math.cos(a1)} ${P.y + R * Math.sin(a1)}`,
			text: {
				x: P.x + (R + 22) * Math.cos((a0 + a1) / 2),
				y: P.y + (R + 22) * Math.sin((a0 + a1) / 2)
			}
		};
	});
	const red = rainbowAngle(water.n(656.3));
	const violet = rainbowAngle(water.n(404.7));
	const here = $derived(rainbowAngle(water.n(nm)));

	// ---- the inset: seen from the ground, sun behind the viewer --------------------
	const IX = 640;
	const IY = 24;
	const IW = 296;
	const IH = 200;
	const eye: Vec = { x: IX + 46, y: IY + 168 };
	const sunDrop = 12; // the sun's elevation in the sketch, degrees
	const anti = { x: Math.cos(toRad(sunDrop)), y: Math.sin(toRad(sunDrop)) };
	const toward = (deg: number, r: number) => ({
		x: eye.x + r * Math.cos(toRad(sunDrop - deg)),
		y: eye.y + r * Math.sin(toRad(sunDrop - deg))
	});
	const pr = toward(red, 170);
	const pv = toward(violet, 170);
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
	<circle
		cx={D.x}
		cy={D.y}
		r={RD}
		fill="var(--lo-water)"
		stroke="var(--lo-water-edge)"
		stroke-width="1.5"
	/>
	{@render label(940, 572, 'The drop is drawn huge: real raindrops are about a millimetre across', {
		muted: true,
		size: 12,
		anchor: 'end'
	})}
	<Rays paths={drawn} {t} spacing={50} r={2.6} />

	{#if mark}
		<line
			x1={mark.P.x}
			y1={mark.P.y}
			x2={mark.ref.x}
			y2={mark.ref.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			stroke-dasharray="6 5"
		/>
		<path d={mark.arc} fill="none" stroke="var(--lo-theta2)" stroke-width="2.2" />
		{@render label(mark.text.x - 6, mark.text.y + 4, white ? '40.6°–42.3°' : `${fmt(here, 1)}°`, {
			color: 'var(--lo-theta2)',
			weight: 700,
			size: 14,
			anchor: 'end'
		})}
		{@render label(mark.ref.x - 8, mark.ref.y + 4, 'straight away from the sun', {
			muted: true,
			size: 12,
			anchor: 'end'
		})}
	{/if}
	{@render label(24, 132, 'sunlight →', { anchor: 'start', muted: true, size: 13, weight: 600 })}

	<Card
		x={24}
		y={24}
		w={400}
		h={84}
		cells={white
			? [
					{
						id: 'r',
						label: 'Red comes back at',
						value: `${fmt(red, 1)}°`,
						color: rayColour(656.3, dark)
					},
					{
						id: 'v',
						label: 'Violet comes back at',
						value: `${fmt(violet, 1)}°`,
						color: rayColour(404.7, dark)
					}
				]
			: [
					{
						id: 'a',
						label: `The bow for ${nm} nm`,
						value: `${fmt(here, 1)}°`,
						color: rayColour(nm, dark),
						sub: 'from straight away from the sun'
					},
					{ id: 'n', label: 'n of water', value: fmt(water.n(nm), 4) }
				]}
	/>

	<!-- inset: why the bow is a circle at 42° round the shadow of your head -->
	<rect x={IX} y={IY} width={IW} height={IH} rx="12" fill="var(--surface)" stroke="var(--border)" />
	{@render label(IX + 14, IY + 22, 'Seen from the side', {
		anchor: 'start',
		size: 13,
		weight: 600
	})}
	{@render label(IX + 14, IY + 40, 'the sun low behind you', {
		anchor: 'start',
		size: 11,
		muted: true
	})}
	<line
		x1={IX + 12}
		y1={eye.y + 16}
		x2={IX + IW - 12}
		y2={eye.y + 16}
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<!-- the viewer -->
	<circle cx={eye.x} cy={eye.y - 4} r="5" fill="var(--stage-ink)" />
	<line
		x1={eye.x}
		y1={eye.y + 1}
		x2={eye.x}
		y2={eye.y + 16}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<!-- the antisolar direction, through the shadow of the head -->
	<line
		x1={eye.x}
		y1={eye.y - 4}
		x2={eye.x + anti.x * 110}
		y2={eye.y - 4 + anti.y * 110}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
		stroke-width="1.2"
	/>
	<line
		x1={eye.x}
		y1={eye.y - 4}
		x2={pr.x}
		y2={pr.y}
		stroke={rayColour(656.3, dark)}
		stroke-width="2"
	/>
	<line
		x1={eye.x}
		y1={eye.y - 4}
		x2={pv.x}
		y2={pv.y}
		stroke={rayColour(404.7, dark)}
		stroke-width="2"
	/>
	<circle cx={pr.x} cy={pr.y} r="4" fill="var(--lo-water-edge)" />
	<circle cx={pv.x} cy={pv.y} r="4" fill="var(--lo-water-edge)" />
	{@render label(pr.x + 9, pr.y - 2, 'red', {
		size: 11,
		anchor: 'start',
		color: rayColour(656.3, dark)
	})}
	{@render label(pv.x + 9, pv.y + 12, 'violet', {
		size: 11,
		anchor: 'start',
		color: rayColour(404.7, dark)
	})}
	{@render label(eye.x + anti.x * 110 + 6, eye.y - 4 + anti.y * 110 + 4, 'shadow of your head', {
		size: 11,
		anchor: 'start',
		muted: true
	})}
</g>
