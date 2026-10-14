<script lang="ts">
	/**
	 * An afterimage experiment. Three coloured discs on a grey field for 20 s (stare at the cross),
	 * then plain grey for 12 s, in a loop; `params.grey` switches to the grey at once. During the
	 * grey, the bottom row shows the colours a von Kries model of cone adaptation (colour.ts
	 * `afterimage`) predicts for the grey after the stare.
	 *
	 * The picture is made of fixed screen colours (it is an image, not part of the theme). Its
	 * cone signals come from running the display pipeline backwards (`conesOfRGB`).
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { afterimage, conesOfRGB, cssColour } from '../colour';

	let { t, params }: StageProps = $props();

	const STARE = 20;
	const LOOK = 12;
	const tc = $derived(t % (STARE + LOOK));
	const forced = $derived(params.grey === true);
	const greyAmt = $derived(forced ? 1 : smoothstep(STARE, STARE + 0.3, tc));
	const left = $derived(Math.max(0, Math.ceil(STARE - tc)));

	const GREY: [number, number, number] = [128, 128, 128];
	const greyCss = `rgb(${GREY.join(', ')})`;
	const DISCS = [
		{ id: 'cyan', name: 'cyan', rgb: [0, 190, 190], x: 360, y: 190, after: 'reddish' },
		{ id: 'yellow', name: 'yellow', rgb: [225, 205, 0], x: 600, y: 190, after: 'bluish' },
		{ id: 'magenta', name: 'magenta', rgb: [205, 40, 205], x: 480, y: 344, after: 'greenish' }
	] as const;
	/** How far adaptation goes in a 20 s stare: an illustrative value, not a measurement. */
	const STRENGTH = 0.3;
	const grey = conesOfRGB(...GREY);
	const predicted = DISCS.map((d) => ({
		...d,
		css: cssColour(afterimage(conesOfRGB(...d.rgb), grey, STRENGTH))
	}));

	const PANEL = { x: 180, y: 70, w: 600, h: 360 };
	const message = $derived(
		greyAmt < 0.5
			? `Stare at the cross without moving your eyes: ${left} s`
			: 'Keep looking at the cross: what do you see?'
	);
</script>

<g>
	<Readout id="instruction" label="Now" value={message} order={0}>
		<Label x={480} y={46} text={message} size={15} weight={700} />
	</Readout>

	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill={greyCss}
		stroke="var(--border)"
	/>
	{#each DISCS as d (d.id)}
		<circle cx={d.x} cy={d.y} r="74" fill="rgb({d.rgb.join(', ')})" opacity={1 - greyAmt} />
	{/each}
	<!-- the fixation cross -->
	<g stroke="#1e1e1e" stroke-width="3" stroke-linecap="round">
		<line x1="470" y1="250" x2="490" y2="250" />
		<line x1="480" y1="240" x2="480" y2="260" />
	</g>
	<!-- a thin progress bar for the stare -->
	<rect
		x={PANEL.x + 20}
		y={PANEL.y + PANEL.h - 18}
		width={PANEL.w - 40}
		height="4"
		rx="2"
		fill="#000"
		opacity="0.12"
	/>
	<rect
		x={PANEL.x + 20}
		y={PANEL.y + PANEL.h - 18}
		width={(PANEL.w - 40) * (forced ? 1 : Math.min(1, tc / STARE))}
		height="4"
		rx="2"
		fill="#1e1e1e"
		opacity={0.5 * (1 - greyAmt)}
	/>

	<!-- the model's prediction -->
	<g opacity={greyAmt}>
		<Readout id="pred-title">
			<Label x={480} y={470} text="a model of tired cones predicts, on the grey:" size={12} muted />
		</Readout>
		{#each predicted as p, i (p.id)}
			{@const x = 300 + i * 180}
			<rect
				x={x - 40}
				y={488}
				width="80"
				height="56"
				rx="8"
				fill={greyCss}
				stroke="var(--border)"
			/>
			<circle cx={x} cy={516} r="20" fill={p.css} />
			<Readout
				id="pred-{p.id}"
				label="After {p.name}"
				value={p.after}
				order={1 + i}
				opacity={greyAmt}
			>
				<Label {x} y={566} text="after {p.name}: {p.after}" size={12} />
			</Readout>
		{/each}
	</g>
</g>
