<script lang="ts">
	/**
	 * A beam of one colour of light crossing a box of air, seen close up: bits of light fly from
	 * the Sun to the right, and some hit a bit of air and bounce off in a new direction. The share
	 * that bounces is the model's, for a crossing of four times the air above us (so the drawing
	 * shows enough bounces); the readout gives the share for one trip straight down.
	 */
	import { Label, Photon, cycle, hash, smoothstep, wavelengthToColor } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { rayleighDepth, transmitted } from '../model';
	import { colourName } from '../steps';

	let { t, params }: StageProps = $props();

	const nm = $derived(Number(params.nm ?? 450));
	const colour = $derived(wavelengthToColor(nm));
	const name = $derived(colourName(nm));
	/** Shares bounced off: for the drawing's box (four times the air), and straight down. */
	const DRAWN_AIR = 4;
	const boxBounce = $derived(1 - transmitted(nm, 90) ** DRAWN_AIR);
	const downBounce = $derived(Math.round((1 - transmitted(nm, 90)) * 100));
	const vsRed = $derived(rayleighDepth(nm) / rayleighDepth(700));

	// ---- layout -------------------------------------------------------------------------------
	const BOX = { x0: 170, x1: 880, y0: 150, y1: 440 };
	const SUN = { x: 80, y: 295 };
	const MOLECULES = Array.from({ length: 46 }, (_, i) => ({
		x: BOX.x0 + 20 + hash(i, 1) * (BOX.x1 - BOX.x0 - 40),
		y: BOX.y0 + 16 + hash(i, 2) * (BOX.y1 - BOX.y0 - 32)
	}));

	const LANES = 12;
	const PERIOD = 4;
	const photons = $derived(
		Array.from({ length: LANES * 2 }, (_, i) => {
			const lane = i % LANES;
			const offset = (i * 0.61803) % 1;
			const run = Math.floor(t / PERIOD + offset);
			const u = cycle(t, PERIOD, offset);
			const y = BOX.y0 + 22 + (lane * (BOX.y1 - BOX.y0 - 44)) / (LANES - 1);
			// Each run, this bit of light either bounces (at a random point of the box) or not.
			const bounces = hash(i * 31 + run, 7) < boxBounce;
			const at = 0.25 + 0.55 * hash(i * 31 + run, 8);
			const turn = (hash(i * 31 + run, 9) - 0.5) * 300 + (hash(i, 3) < 0.5 ? 0 : 180);
			const xStart = SUN.x + 44;
			const xEnd = BOX.x1 + 40;
			const xAt = xStart + (xEnd - xStart) * at;
			let x = xStart + (xEnd - xStart) * u;
			let py = y;
			let angle = 0;
			let fade = 1;
			if (bounces && u > at) {
				const d = (u - at) * (xEnd - xStart);
				const r = (turn * Math.PI) / 180;
				x = xAt + d * Math.cos(r);
				py = y + d * Math.sin(r);
				angle = turn;
				fade = 1 - smoothstep(0.15, 0.3, u - at);
			}
			return {
				x,
				y: py,
				angle,
				o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.9, 1, u)) * fade
			};
		})
	);
</script>

<g class="sb-beam">
	<rect
		x={BOX.x0}
		y={BOX.y0}
		width={BOX.x1 - BOX.x0}
		height={BOX.y1 - BOX.y0}
		rx="16"
		fill="var(--sb-air)"
		stroke="var(--stage-line)"
	/>
	<Label x={BOX.x0 + 14} y={BOX.y0 - 12} text="air, seen up close" anchor="start" size={13} muted />
	{#each MOLECULES as m, i (i)}
		<circle cx={m.x} cy={m.y} r="4" fill="var(--sb-molecule)" />
	{/each}

	<circle cx={SUN.x} cy={SUN.y} r="44" fill="#fff3bf" opacity="0.5" />
	<circle cx={SUN.x} cy={SUN.y} r="30" fill="#ffd43b" />
	<Label x={SUN.x} y={SUN.y + 66} text="sunlight" size={13} />

	<defs>
		<clipPath id="beam-clip">
			<rect x="0" y={BOX.y0 - 40} width="960" height={BOX.y1 - BOX.y0 + 80} />
		</clipPath>
	</defs>
	<g clip-path="url(#beam-clip)">
		{#each photons as p, i (i)}
			<Photon x={p.x} y={p.y} angle={p.angle} color={colour} opacity={p.o} length={34} />
		{/each}
	</g>

	<Readout
		id="sb-bounce"
		order={1}
		label="Coming straight down through the air"
		value="{downBounce} in 100 bits of {name} light bounce off"
	>
		<Label
			x={480}
			y={506}
			text="{name} light: {downBounce} in 100 bits bounce off, coming straight down through the air"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="sb-vsred"
		order={2}
		label="Compared with red"
		value={nm >= 690 ? 'red bounces least' : `${vsRed.toFixed(1)} times as often as red`}
	>
		<Label
			x={480}
			y={532}
			text={nm >= 690
				? 'red light bounces least of all'
				: `that is ${vsRed.toFixed(1)} times as often as red light`}
			size={13}
			tabular
		/>
	</Readout>
	<Readout id="sb-drawn">
		<Label
			x={480}
			y={556}
			text="(the box holds four times the air above you, so more bits bounce)"
			size={12}
			muted
		/>
	</Readout>
</g>
