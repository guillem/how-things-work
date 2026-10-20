<script lang="ts">
	/**
	 * A pinhole camera: a lamp (bulb on top, base below) in front of a shoebox with a hole, and the
	 * upside-down picture on the box's back wall. The lines from the lamp's top and bottom cross at
	 * the hole. A bigger hole lets in more light but blurs each point into a spot. The lamp is 78 cm
	 * from the hole and the box 60 cm deep, drawn to scale (the hole and the blur enlarged).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { blur, brightness, imageOf, type Pinhole } from '../model';

	let { params }: StageProps = $props();

	const holeMm = $derived(Number(params.hole ?? 1));
	// A big box: the lamp 78 cm in front of the hole, the back wall 60 cm behind it.
	const p: Pinhole = $derived({ front: 0.78, back: 0.6, hole: holeMm / 1000 });
	const LAMP_H = 0.4;
	const imageH = $derived(Math.abs(imageOf(p, LAMP_H)));
	const spot = $derived(blur(p));
	const bright = $derived(brightness(p));

	// ---- drawing: 500 px per metre across and up, so the rays are true to the numbers ----------
	const K = 500;
	const AXIS = 300;
	const LX = 150;
	const HOLE_X = $derived(LX + p.front * K);
	const BACK_X = $derived(HOLE_X + p.back * K);
	const OBJ = LAMP_H * K;
	const IMG = $derived(imageH * K);
	const sc = $derived(IMG / OBJ);
	// The hole drawn 3 px per mm, so it shows.
	const holePx = $derived(Math.max(3, holeMm * 3));
	// Blur: the sharp picture spread over a disc as wide as the geometric spot (drawn 10x, 5 px per
	// mm): copies at the disc's centre and on two rings, each with an equal share of the light.
	const blurPx = $derived(spot * 1000 * 5);
	const offsets = $derived([
		[0, 0],
		...Array.from({ length: 6 }, (_, i) => [
			0.25 * blurPx * Math.cos((i * Math.PI) / 3),
			0.25 * blurPx * Math.sin((i * Math.PI) / 3)
		]),
		...Array.from({ length: 10 }, (_, i) => [
			0.45 * blurPx * Math.cos((i * Math.PI) / 5),
			0.45 * blurPx * Math.sin((i * Math.PI) / 5)
		])
	]);
	// Light into the picture, proportional to the hole's area, shown through one fixed mapping.
	const shown = $derived(1 - Math.exp(-bright / 6));
</script>

<g class="sh-pinhole">
	<!-- the lamp: bulb on top, stand and base below -->
	<circle cx={LX} cy={AXIS - OBJ / 2 + 14} r="16" fill="var(--sh-light)" />
	<line
		x1={LX}
		y1={AXIS - OBJ / 2 + 30}
		x2={LX}
		y2={AXIS + OBJ / 2 - 10}
		stroke="var(--text)"
		stroke-width="5"
	/>
	<rect x={LX - 26} y={AXIS + OBJ / 2 - 12} width="52" height="12" rx="3" fill="var(--sh-flame)" />
	<Label x={LX} y={AXIS + OBJ / 2 + 30} text="lamp" anchor="middle" size={14} />

	<!-- rays from the top and the bottom, crossing at the hole -->
	<line
		x1={LX}
		y1={AXIS - OBJ / 2 + 14}
		x2={BACK_X}
		y2={AXIS + IMG / 2 - 14 * (IMG / OBJ)}
		stroke="var(--sh-ray)"
		stroke-width="2.5"
	/>
	<line
		x1={LX}
		y1={AXIS + OBJ / 2 - 6}
		x2={BACK_X}
		y2={AXIS - IMG / 2 + 6 * (IMG / OBJ)}
		stroke="color-mix(in srgb, var(--sh-flame) 60%, transparent)"
		stroke-width="2.5"
	/>

	<!-- the box -->
	<rect
		x={HOLE_X}
		y={AXIS - 150}
		width={BACK_X - HOLE_X}
		height="300"
		fill="color-mix(in srgb, var(--sh-dark) 30%, transparent)"
		stroke="var(--text)"
		stroke-width="3"
	/>
	<rect x={HOLE_X - 4} y={AXIS - holePx / 2} width="8" height={holePx} fill="var(--stage-bg)" />
	<Label x={HOLE_X} y={AXIS - 166} text="pinhole" anchor="middle" size={13} />
	<Label x={BACK_X} y={AXIS - 166} text="back wall" anchor="middle" size={13} />

	<!-- the picture on the back wall, upside down -->
	<!-- the picture on the back wall, upside down, spread over the blur disc -->
	{#each offsets as [dx, dy], k (k)}
		<g
			transform="translate({dx} {dy}) translate({BACK_X - 14} {AXIS}) scale(1 -1) translate({-(
				BACK_X - 14
			)} {-AXIS})"
			opacity={Math.min(1, (shown / offsets.length) * 4)}
		>
			<circle cx={BACK_X - 14} cy={AXIS - IMG / 2 + 14 * sc} r={16 * sc} fill="var(--sh-light)" />
			<line
				x1={BACK_X - 14}
				y1={AXIS - IMG / 2 + 30 * sc}
				x2={BACK_X - 14}
				y2={AXIS + IMG / 2 - 10 * sc}
				stroke="var(--text)"
				stroke-width="4"
			/>
			<rect
				x={BACK_X - 14 - 26 * sc}
				y={AXIS + IMG / 2 - 12 * sc}
				width={52 * sc}
				height={12 * sc}
				fill="var(--sh-flame)"
			/>
		</g>
	{/each}

	<!-- readouts -->
	<Readout
		id="sh-pic"
		order={1}
		label="Picture"
		value="upside down, {Math.round(imageH * 100)} cm tall (the lamp is {Math.round(
			LAMP_H * 100
		)} cm)"
	>
		<Label
			x={480}
			y={60}
			text="an upside-down picture, {Math.round(imageH * 100)} cm tall"
			anchor="middle"
			size={18}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="sh-hole"
		order={2}
		label="Hole"
		value="{holeMm} mm: {bright.toFixed(
			bright < 10 ? 1 : 0
		)} times as bright as with a 1 mm hole, each point a {(spot * 1000).toFixed(1)} mm spot"
	>
		<Label
			x={480}
			y={500}
			text="{bright < 1.05
				? 'as bright as a 1 mm hole'
				: `${bright.toFixed(bright < 10 ? 1 : 0)} times as bright as a 1 mm hole`} · each point blurred into a {(
				spot * 1000
			).toFixed(1)} mm spot"
			anchor="middle"
			size={14}
			tabular
		/>
	</Readout>
</g>
