<script lang="ts">
	/**
	 * The roughness of two notes against the interval between them: the lower
	 * note fixed on C4, the upper one anywhere from the unison to a little past
	 * the octave. The curve is the sum of the Plomp–Levelt roughness of every
	 * pair of harmonics (see `scales.ts`), scaled so that the roughest interval
	 * of each sound reads 100. The piano's twelve keys are marked along the top.
	 *
	 * Phases (`step.hints.phase`) differ only in the text; `params.curveTimbre`
	 * ('rich' | 'sine') chooses the sound, and the curve morphs between the two.
	 * `params.interval` (cents above C4) places the marker, which can be dragged;
	 * `params.hear` (an action) plays the pair.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Handle, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C4, KEY_NAMES, cents, ratioOf, roughnessCurve, type Timbre } from '../scales';
	import Card from './Card.svelte';
	import { playNotes, stopAll } from './sound';
	import { fmt, signed, type Cell } from './ui';

	let { step, params, reduced, setParam }: StageProps = $props();

	const MAX_C = 1250;
	const timbre = $derived<Timbre>(params.curveTimbre === 'sine' ? 'sine' : 'rich');
	const iv = $derived(Math.max(0, Math.min(MAX_C, Number(params.interval ?? 702))));

	// both curves once, each scaled to its own roughest point
	const scaled = (tb: Timbre) => {
		const c = roughnessCurve(C4, tb, MAX_C, 2);
		const top = Math.max(...c.map((p) => p.r));
		return c.map((p) => ({ c: p.c, r: p.r / top }));
	};
	const RICH = scaled('rich');
	const SINE = scaled('sine');
	const at = (curve: { c: number; r: number }[], c: number) => {
		const i = Math.min(curve.length - 2, Math.floor(c / 2));
		const u = (c - curve[i].c) / 2;
		return curve[i].r * (1 - u) + curve[i + 1].r * u;
	};

	const w = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const target = timbre === 'sine' ? 1 : 0;
		untrack(() => w.set(target, { duration: reduced ? 0 : 800 }));
	});
	const mix = $derived(w.current);
	const curve = $derived(RICH.map((p, i) => ({ c: p.c, r: (1 - mix) * p.r + mix * SINE[i].r })));
	const rNow = $derived((1 - mix) * at(RICH, iv) + mix * at(SINE, iv));

	const sx = scale([0, MAX_C], [96, 924]);
	const sy = scale([0, 1.1], [520, 168]);
	const path = $derived(
		linePath(
			curve,
			(p) => p.c,
			(p) => p.r,
			sx,
			sy
		)
	);
	const area = $derived(path + ` L${sx(MAX_C)} ${sy(0)} L${sx(0)} ${sy(0)} Z`);

	const VALLEYS = [
		{ p: 6, q: 5 },
		{ p: 5, q: 4 },
		{ p: 4, q: 3 },
		{ p: 3, q: 2 },
		{ p: 5, q: 3 },
		{ p: 7, q: 4 },
		{ p: 2, q: 1 }
	].map((v) => ({ ...v, c: cents(v.p / v.q) }));

	// ---- sound -------------------------------------------------------------------------
	let lastHear: number | undefined;
	$effect(() => {
		const c = Number(params.hear ?? 0);
		untrack(() => {
			if (lastHear !== undefined && c !== lastHear) playNotes([C4, C4 * ratioOf(iv)], timbre);
			lastHear = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- readouts ------------------------------------------------------------------------
	const near = $derived(VALLEYS.find((v) => Math.abs(v.c - iv) <= 5));
	const keyIdx = $derived(Math.round(iv / 100));
	const cells = $derived<Cell[]>([
		{
			id: 'iv',
			label: 'Upper note',
			value: `${Math.round(iv)} cents above C4`,
			sub:
				keyIdx <= 12
					? `${KEY_NAMES[keyIdx]} ${signed(iv - keyIdx * 100)} cents`
					: `${signed(iv - 1200)} cents past C5`,
			color: 'var(--ms-b)'
		},
		{
			id: 'ratio',
			label: 'Frequency ratio',
			value: fmt(ratioOf(iv), 4),
			sub: near
				? `${signed(iv - near.c)} cents from ${near.p} : ${near.q}`
				: `${fmt(C4 * ratioOf(iv), 1)} Hz against 261.6 Hz`
		},
		{
			id: 'rough',
			label: 'Roughness',
			value: `${Math.round(rNow * 100)} / 100`,
			sub: timbre === 'sine' ? 'two sine tones' : 'six harmonics each',
			color: 'var(--ms-rough)'
		}
	]);

	const hx = $derived(sx(iv));
	const hy = $derived(sy(rNow));
	function onmove(p: { x: number; y: number }) {
		setParam('interval', Math.round(Math.max(0, Math.min(MAX_C, sx.invert(p.x)))));
	}
	function onkey(s: number | 'start' | 'end') {
		const v = s === 'start' ? 0 : s === 'end' ? MAX_C : iv + s;
		setParam('interval', Math.max(0, Math.min(MAX_C, Math.round(v))));
	}
</script>

<g>
	<Card x={16} y={16} w={928} h={88} {cells} />

	<Axes
		{sx}
		{sy}
		xTicks={[0, 200, 400, 600, 800, 1000, 1200]}
		yTicks={[0, 0.5, 1]}
		yFormat={(v) => String(Math.round(v * 100))}
		xLabel="cents above C4"
	/>

	<Readout id="ylabel">
		<Label x={44} y={sy(0.55)} text="roughness" rotate={-90} size={12} muted halo={false} />
	</Readout>

	<!-- the piano's keys -->
	<g style:pointer-events="none">
		{#each KEY_NAMES as name, k (name)}
			<line
				x1={sx(k * 100)}
				x2={sx(k * 100)}
				y1={sy(1.1)}
				y2={sy(0)}
				stroke="var(--stage-line)"
				stroke-dasharray="2 5"
				opacity="0.6"
			/>
			<Readout id="key-{k}">
				<text
					x={sx(k * 100)}
					y={sy(1.1) - 8}
					text-anchor="middle"
					font-size="11"
					class="muted"
					font-weight={name.includes('♯') || name.includes('♭') ? 400 : 600}
					>{name.replace('4', '')}</text
				>
			</Readout>
		{/each}
	</g>

	<path d={area} fill="var(--ms-rough)" opacity="0.1" style:pointer-events="none" />
	<path
		d={path}
		fill="none"
		stroke="var(--ms-rough)"
		stroke-width="2.5"
		style:pointer-events="none"
	/>

	<!-- the valleys at simple ratios -->
	{#if mix < 0.95}
		<g opacity={1 - mix} style:pointer-events="none">
			{#each VALLEYS as v (v.c)}
				{@const vy = sy(at(RICH, v.c) * (1 - mix) + at(SINE, v.c) * mix)}
				<circle cx={sx(v.c)} cy={vy} r="3.5" fill="var(--ms-fifth)" />
				<Readout id="valley-{v.p}-{v.q}">
					<Label
						x={v.p === 2 ? sx(v.c) - 10 : sx(v.c)}
						y={v.p === 2 ? vy - 10 : vy + 30}
						anchor={v.p === 2 ? 'end' : 'middle'}
						text="{v.p}:{v.q}"
						size={12}
						weight={700}
						color="var(--ms-fifth)"
					/>
				</Readout>
			{/each}
		</g>
	{/if}

	<!-- the marker -->
	<line
		x1={hx}
		x2={hx}
		y1={sy(1.1)}
		y2={hy - 12}
		stroke="var(--ms-b)"
		stroke-width="1.5"
		opacity="0.8"
		style:pointer-events="none"
	/>
	<Handle
		x={hx}
		y={hy}
		label="Upper note, in cents above C4"
		value={Math.round(iv)}
		min={0}
		max={MAX_C}
		valuetext="{Math.round(iv)} cents"
		color="var(--ms-b)"
		{onmove}
		{onkey}
	/>
</g>
