<script lang="ts">
	/**
	 * The optical bench.
	 *
	 * Phases (`step.hints.phase`):
	 *   mirror — a lamp aimed at the middle of a flat mirror: the normal and the
	 *            equal angles of incidence and reflection. Drag the lamp (a
	 *            `Grip`), turn the mirror by its end handle or `params.mirror`.
	 *   bench  — a free bench: lamp, converging lens, prism and mirror, all
	 *            movable (and the lamp, prism and mirror turnable). The lens and
	 *            prism are made of `params.material`; the light is white
	 *            (`params.white`, traced as ten colours) or one colour (`params.nm`).
	 *            `params.reset` (a button) puts everything back.
	 *
	 * Rays are traced by optics.ts; the pulses on them run slower inside glass.
	 * Positions live in the scene (they reset when the scene is left).
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		MATERIALS,
		convexLens,
		dir,
		mirror as mirrorEl,
		polygon,
		prismCorners,
		toDeg,
		trace,
		type Element,
		type MaterialId,
		type Vec
	} from '../optics';
	import Card from './Card.svelte';
	import Grip from './Grip.svelte';
	import Lamp from './Lamp.svelte';
	import Rays from './Rays.svelte';
	import { WHITE, fmt, pathOf, rayColour, spectrumPaths, type DrawnPath } from './ui';

	let { step, t, params, setParam, dark }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'mirror'));
	const BOX: [number, number, number, number] = [16, 16, 944, 584];
	const keep = (p: Vec, m = 40): Vec => ({
		x: clamp(p.x, BOX[0] + m, BOX[2] - m),
		y: clamp(p.y, BOX[1] + m, BOX[3] - m)
	});
	const rad = (d: number) => (d * Math.PI) / 180;

	// ---------------------------------------------------------------- mirror phase
	const M = { x: 560, y: 450 };
	const ML = 340;
	const mAngle = $derived(clamp(Number(params.mirror ?? 0), -40, 40));
	/** The mirror's face normal, pointing up off its shiny side. */
	const up = $derived({ x: Math.sin(rad(mAngle)), y: -Math.cos(rad(mAngle)) });
	let lamp1 = $state<Vec>({ x: 230, y: 150 });
	/** Keep the lamp on the shiny side of the mirror, at least 60 above it. */
	function placeLamp1(p: Vec) {
		let q = keep(p);
		const h = (q.x - M.x) * up.x + (q.y - M.y) * up.y;
		if (h < 60) q = { x: q.x + up.x * (60 - h), y: q.y + up.y * (60 - h) };
		lamp1 = keep(q);
	}
	// Turning the mirror under the lamp keeps the lamp on its shiny side.
	$effect(() => {
		void mAngle;
		untrack(() => placeLamp1(lamp1));
	});
	const aim1 = $derived.by(() => {
		const dx = M.x - lamp1.x;
		const dy = M.y - lamp1.y;
		const l = Math.hypot(dx, dy);
		return { x: dx / l, y: dy / l };
	});
	const mirrorPath = $derived(
		phase === 'mirror' ? trace([mirrorEl('m', M, ML, mAngle)], lamp1, aim1, { box: BOX })[0] : null
	);
	const incidence = $derived(toDeg(Math.acos(clamp(-(aim1.x * up.x + aim1.y * up.y), -1, 1))));
	const out1 = $derived.by(() => {
		if (!mirrorPath || mirrorPath.legs.length < 2) return aim1;
		const l = mirrorPath.legs[1];
		const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
		return { x: (l.b.x - l.a.x) / len, y: (l.b.y - l.a.y) / len };
	});
	const reflection = $derived(toDeg(Math.acos(clamp(out1.x * up.x + out1.y * up.y, -1, 1))));
	const back = $derived({ x: -aim1.x, y: -aim1.y });
	/** An arc of radius r around M from direction a to direction b. */
	function arc(a: Vec, b: Vec, r: number) {
		const cross = a.x * b.y - a.y * b.x;
		return `M${M.x + a.x * r} ${M.y + a.y * r} A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${M.x + b.x * r} ${M.y + b.y * r}`;
	}
	/** Unit vector halfway between two directions. */
	function mid(a: Vec, b: Vec): Vec {
		const m = { x: a.x + b.x, y: a.y + b.y };
		const l = Math.hypot(m.x, m.y) || 1;
		return { x: m.x / l, y: m.y / l };
	}
	const midIn = $derived(mid(up, back));
	const midOut = $derived(mid(up, out1));
	const mirrorEnd = $derived({
		x: M.x + (Math.cos(rad(mAngle)) * ML) / 2,
		y: M.y + (Math.sin(rad(mAngle)) * ML) / 2
	});
	function turnMirror(p: Vec) {
		const a = toDeg(Math.atan2(p.y - M.y, p.x - M.x));
		setParam('mirror', Math.round(clamp(a, -40, 40)));
	}
	function keyMirror(k: number | 'start' | 'end') {
		const v = k === 'start' ? -40 : k === 'end' ? 40 : mAngle + k;
		setParam('mirror', clamp(v, -40, 40));
	}

	// ---------------------------------------------------------------- bench phase
	interface Part {
		x: number;
		y: number;
		deg: number;
	}
	const START: Record<'lamp' | 'lens' | 'prism' | 'mirror', Part> = {
		lamp: { x: 100, y: 250, deg: 0 },
		lens: { x: 250, y: 250, deg: 0 },
		prism: { x: 470, y: 262, deg: 32 },
		mirror: { x: 600, y: 520, deg: 34 }
	};
	let lamp = $state<Part>({ ...START.lamp });
	let lens = $state<Part>({ ...START.lens });
	let prism = $state<Part>({ ...START.prism });
	let bmirror = $state<Part>({ ...START.mirror });
	const resets = $derived(Number(params.reset ?? 0));
	$effect(() => {
		if (!resets) return;
		untrack(() => {
			lamp = { ...START.lamp };
			lens = { ...START.lens };
			prism = { ...START.prism };
			bmirror = { ...START.mirror };
		});
	});

	const materialId = $derived.by((): MaterialId => {
		const m = String(params.material ?? 'flint');
		return m in MATERIALS ? (m as MaterialId) : 'flint';
	});
	const material = $derived(MATERIALS[materialId]);
	const white = $derived(params.white !== false);
	const nm = $derived(Number(params.nm ?? 650));
	const LENS_R = 300;
	const LENS_H = 70;
	const PRISM_SIDE = 150;
	const MIRROR_L = 170;
	const prismPts = $derived(prismCorners(prism, PRISM_SIDE, prism.deg));
	const elements = $derived.by((): Element[] => [
		convexLens('lens', lens, LENS_R, LENS_H, material.n),
		polygon('prism', prismPts, material.n),
		mirrorEl('mirror', bmirror, MIRROR_L, bmirror.deg)
	]);
	const lampDir = $derived(dir(lamp.deg));
	const lampTip = $derived({ x: lamp.x + lampDir.x * 4, y: lamp.y + lampDir.y * 4 });
	const benchPaths = $derived.by((): DrawnPath[] => {
		if (phase !== 'bench') return [];
		const opts = { box: BOX, minPower: 0.1, maxLegs: 30 };
		if (white) {
			const sets = WHITE.map((w) => ({
				nm: w,
				paths: trace(elements, lampTip, lampDir, { ...opts, nm: w }).slice(0, 4)
			}));
			return spectrumPaths(sets, dark, 'var(--lo-white)', 'b');
		}
		const color = rayColour(nm, dark);
		const side = { x: -lampDir.y, y: lampDir.x };
		return [-12, 0, 12].flatMap((o) =>
			trace(elements, { x: lampTip.x + side.x * o, y: lampTip.y + side.y * o }, lampDir, {
				...opts,
				nm
			})
				.slice(0, 4)
				.map((p, i) => ({ key: `m${o}-${i}`, legs: p.legs, color }))
		);
	});

	/** A turning handle `r` from a part's centre, at the part's angle + `offset`. */
	const knob = (p: Part, r: number, offset: number) => {
		const d = dir(p.deg + offset);
		return { x: p.x + d.x * r, y: p.y + d.y * r };
	};
	const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
	const angleTo = (p: Part, q: Vec, offset: number) =>
		wrap(Math.round(toDeg(Math.atan2(q.y - p.y, q.x - p.x)) - offset));
	type Key = number | 'start' | 'end';
	const turnKey = (p: Part, k: Key) => (k === 'start' ? -180 : k === 'end' ? 180 : wrap(p.deg + k));

	const lampKnob = $derived(knob(lamp, 62, 180));
	const prismKnob = $derived(knob(prism, 108, -90));
	const mirrorKnob = $derived(knob(bmirror, MIRROR_L / 2 + 16, 0));
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
	{#if phase === 'mirror'}
		<!-- the mirror: a silvered face with hatching behind it -->
		<g transform="rotate({mAngle} {M.x} {M.y})">
			{#each Array.from({ length: 17 }, (_, i) => i) as i (i)}
				<line
					x1={M.x - ML / 2 + i * 20 + 10}
					y1={M.y + 3}
					x2={M.x - ML / 2 + i * 20}
					y2={M.y + 15}
					stroke="var(--lo-mirror)"
					stroke-width="1.2"
					opacity="0.55"
				/>
			{/each}
			<rect x={M.x - ML / 2} y={M.y - 3} width={ML} height="6" rx="2" fill="var(--lo-mirror)" />
		</g>
		<!-- the normal -->
		<line
			x1={M.x}
			y1={M.y}
			x2={M.x + up.x * 190}
			y2={M.y + up.y * 190}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			stroke-dasharray="6 5"
		/>
		{@render label(M.x + up.x * 206, M.y + up.y * 206, 'normal', { muted: true, size: 12 })}
		<!-- angle arcs -->
		<path d={arc(up, back, 70)} fill="none" stroke="var(--lo-theta1)" stroke-width="2.5" />
		<path d={arc(up, out1, 82)} fill="none" stroke="var(--lo-theta2)" stroke-width="2.5" />
		{#if mirrorPath}
			<Rays paths={[{ key: 'm', legs: mirrorPath.legs, color: 'var(--lo-ray)', width: 3 }]} {t} />
		{/if}
		{#if incidence >= 12}
			{@render label(M.x + midIn.x * 104, M.y + midIn.y * 104 + 5, `${fmt(incidence, 0)}°`, {
				color: 'var(--lo-theta1)',
				weight: 700,
				size: 15
			})}
			{@render label(M.x + midOut.x * 118, M.y + midOut.y * 118 + 5, `${fmt(reflection, 0)}°`, {
				color: 'var(--lo-theta2)',
				weight: 700,
				size: 15
			})}
		{/if}

		<Grip x={lamp1.x} y={lamp1.y} label="Lamp" onmove={placeLamp1}>
			<circle cx={lamp1.x} cy={lamp1.y} r="30" fill="transparent" />
			<Lamp x={lamp1.x} y={lamp1.y} deg={toDeg(Math.atan2(aim1.y, aim1.x))} color="var(--lo-ray)" />
		</Grip>
		{@render label(lamp1.x, lamp1.y + (lamp1.y < 300 ? -32 : 44), 'drag the lamp', {
			muted: true,
			size: 12
		})}
		<Handle
			x={mirrorEnd.x}
			y={mirrorEnd.y}
			label="Turn the mirror"
			value={mAngle}
			min={-40}
			max={40}
			valuetext="{fmt(mAngle, 0)} degrees"
			onmove={turnMirror}
			onkey={keyMirror}
		/>

		<Card
			x={612}
			y={32}
			w={316}
			cells={[
				{
					id: 'i',
					label: 'Angle of incidence',
					value: `${fmt(incidence, 1)}°`,
					color: 'var(--lo-theta1)'
				},
				{
					id: 'r',
					label: 'Angle of reflection',
					value: `${fmt(reflection, 1)}°`,
					color: 'var(--lo-theta2)'
				}
			]}
		/>
		{@render label(770, 136, 'both measured from the normal', { muted: true, size: 12 })}
	{:else}
		<!-- ---------------------------------------------------------- the free bench -->
		<!-- lens -->
		<Grip
			x={lens.x}
			y={lens.y}
			label="Lens"
			onmove={(p: Vec) => (lens = { ...lens, ...keep(p, 80) })}
		>
			<path
				d="M{lens.x} {lens.y - LENS_H} A{LENS_R} {LENS_R} 0 0 0 {lens.x} {lens.y +
					LENS_H} A{LENS_R} {LENS_R} 0 0 0 {lens.x} {lens.y - LENS_H} Z"
				fill="var(--lo-glass)"
				stroke="var(--lo-glass-edge)"
				stroke-width="1.5"
			/>
		</Grip>
		<!-- prism -->
		<Grip
			x={prism.x}
			y={prism.y}
			label="Prism"
			onmove={(p: Vec) => (prism = { ...prism, ...keep(p, 80) })}
		>
			<path
				d={pathOf(prismPts, true)}
				fill="var(--lo-glass)"
				stroke="var(--lo-glass-edge)"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		</Grip>
		<line
			x1={prism.x}
			y1={prism.y}
			x2={prismKnob.x}
			y2={prismKnob.y}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>
		<!-- mirror -->
		<Grip
			x={bmirror.x}
			y={bmirror.y}
			label="Mirror"
			onmove={(p: Vec) => (bmirror = { ...bmirror, ...keep(p, 60) })}
		>
			<g transform="rotate({bmirror.deg} {bmirror.x} {bmirror.y})">
				<rect
					x={bmirror.x - MIRROR_L / 2}
					y={bmirror.y - 14}
					width={MIRROR_L}
					height="28"
					fill="transparent"
				/>
				<rect
					x={bmirror.x - MIRROR_L / 2}
					y={bmirror.y - 3}
					width={MIRROR_L}
					height="6"
					rx="2"
					fill="var(--lo-mirror)"
				/>
			</g>
		</Grip>
		<!-- lamp -->
		<Grip x={lamp.x} y={lamp.y} label="Lamp" onmove={(p: Vec) => (lamp = { ...lamp, ...keep(p) })}>
			<circle cx={lamp.x - lampDir.x * 20} cy={lamp.y - lampDir.y * 20} r="28" fill="transparent" />
			<Lamp
				x={lamp.x}
				y={lamp.y}
				deg={lamp.deg}
				color={white ? 'var(--lo-white)' : rayColour(nm, dark)}
			/>
		</Grip>
		<line
			x1={lamp.x - lampDir.x * 44}
			y1={lamp.y - lampDir.y * 44}
			x2={lampKnob.x}
			y2={lampKnob.y}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>

		<Rays paths={benchPaths} {t} spacing={52} r={2.8} />

		<Handle
			x={lampKnob.x}
			y={lampKnob.y}
			r={7}
			label="Turn the lamp"
			value={lamp.deg}
			min={-180}
			max={180}
			valuetext="{lamp.deg} degrees"
			onmove={(p: Vec) => (lamp = { ...lamp, deg: angleTo(lamp, p, 180) })}
			onkey={(k: Key) => (lamp = { ...lamp, deg: turnKey(lamp, k) })}
		/>
		<Handle
			x={prismKnob.x}
			y={prismKnob.y}
			r={7}
			label="Turn the prism"
			value={prism.deg}
			min={-180}
			max={180}
			valuetext="{prism.deg} degrees"
			onmove={(p: Vec) => (prism = { ...prism, deg: angleTo(prism, p, -90) })}
			onkey={(k: Key) => (prism = { ...prism, deg: turnKey(prism, k) })}
		/>
		<Handle
			x={mirrorKnob.x}
			y={mirrorKnob.y}
			r={7}
			label="Turn the mirror"
			value={bmirror.deg}
			min={-180}
			max={180}
			valuetext="{bmirror.deg} degrees"
			onmove={(p: Vec) => (bmirror = { ...bmirror, deg: angleTo(bmirror, p, 0) })}
			onkey={(k: Key) => (bmirror = { ...bmirror, deg: turnKey(bmirror, k) })}
		/>

		{@render label(
			32,
			44,
			`${material.name} lens and prism · ${white ? 'white light' : `${nm} nm light`}`,
			{ anchor: 'start', size: 14, weight: 600 }
		)}
		{@render label(
			32,
			66,
			`n = ${fmt(material.n(white ? 589.3 : nm), 3)}${white ? ' for yellow light' : ''}`,
			{ anchor: 'start', muted: true, size: 12 }
		)}
	{/if}
</g>
