<script lang="ts">
	/**
	 * The colours in a light, as bars from violet to red: sunlight above the air, or the light
	 * from the sky overhead at noon (from the model), optionally weighed by how bright each colour
	 * looks to the eye. Bits of light fly from the bars into a swatch: all of them mixed, as the
	 * eye sees them.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, Photon, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		NM,
		SKY_EXPOSURE,
		eyeSensitivity,
		glareColour,
		screenColour,
		sunAt,
		sunlight,
		zenithSpectrum
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'sun'));
	const eye = $derived(phase === 'sky' && params.eye === true);

	/** Every 10 nm from 400 to 700. */
	const BARS = NM.map((nm, i) => ({ nm, i })).filter(
		(b) => b.nm >= 400 && b.nm <= 700 && b.nm % 10 === 0
	);
	const SUN = NM.map(sunlight);
	const SKY = zenithSpectrum(sunAt(12));
	/** The colour of each bar: that one colour of light alone, at full brightness. */
	const barColour = BARS.map((b) => glareColour(NM.map((_, j) => (j === b.i ? 1 : 0))));

	/** Bar heights (0-1), and in the sky phase an outline of plain sunlight with the sky's red. */
	const weighed = (spectrum: number[], weigh: boolean) =>
		BARS.map((b) => spectrum[b.i] * (weigh ? eyeSensitivity(b.nm) : 1));
	const RED = NM.indexOf(700);
	const SUN_AS_SKY = SUN.map((v) => (v * SKY[RED]) / SUN[RED]);
	const target = $derived.by(() => {
		const bars = weighed(phase === 'sky' ? SKY : SUN, eye);
		const outline = weighed(phase === 'sky' ? SUN_AS_SKY : SUN, eye);
		const top = Math.max(...bars);
		return [...bars.map((v) => v / top), ...outline.map((v) => v / top)];
	});
	const heights = Tween.of(() => target, { duration: 800, easing: cubicInOut });
	const all = $derived(reduced ? target : heights.current);
	const shown = $derived(all.slice(0, BARS.length));
	const outline = $derived(all.slice(BARS.length));

	const mixed = $derived(phase === 'sky' ? screenColour(SKY, SKY_EXPOSURE) : glareColour(SUN));

	// ---- layout -------------------------------------------------------------------------------
	const X0 = 90;
	const PITCH = 21;
	const BASE = 450;
	const H = 330;
	const barX = (k: number) => X0 + k * PITCH;
	const SW = { x: 845, y: 290 };
	const NAMES = [
		{ nm: 410, name: 'violet' },
		{ nm: 465, name: 'blue' },
		{ nm: 525, name: 'green' },
		{ nm: 575, name: 'yellow' },
		{ nm: 605, name: 'orange' },
		{ nm: 660, name: 'red' }
	];
	const xOfNm = (nm: number) => X0 + ((nm - 400) / 10) * PITCH + PITCH / 2 - 1;

	/** Bits of light flying from the bars into the swatch, each taking its bar's colour. */
	const flying = $derived(
		Array.from({ length: 9 }, (_, i) => {
			const k = (i * 7 + 3) % BARS.length;
			const u = cycle(t, 3.6, i / 9);
			const x0 = barX(k) + 9;
			const y0 = BASE - shown[k] * H - 10;
			const x = x0 + (SW.x - x0) * u;
			const y = y0 + (SW.y - y0) * u - Math.sin(Math.PI * u) * 60;
			const dx = SW.x - x0;
			const dy = SW.y - y0 - Math.cos(Math.PI * u) * 60 * Math.PI;
			return {
				k,
				x,
				y,
				angle: (Math.atan2(dy, dx) * 180) / Math.PI,
				o: shown[k] * smoothstep(0.05, 0.2, u) * (1 - smoothstep(0.8, 0.95, u))
			};
		})
	);
</script>

<g class="sb-spectrum">
	<!-- bars -->
	{#each BARS as b, k (b.nm)}
		<rect
			x={barX(k)}
			y={BASE - shown[k] * H}
			width={PITCH - 3}
			height={Math.max(0, shown[k] * H)}
			rx="3"
			fill={barColour[k]}
		/>
	{/each}
	{#if phase === 'sky'}
		<path
			d={outline
				.map(
					(h, k) =>
						`${k ? 'L' : 'M'}${barX(k) - 1.5} ${BASE - h * H} L${barX(k) + PITCH - 1.5} ${BASE - h * H}`
				)
				.join(' ')}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-dasharray="4 4"
		/>
	{/if}
	<line
		x1={X0 - 10}
		y1={BASE}
		x2={barX(BARS.length) + 6}
		y2={BASE}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	{#each NAMES as n (n.name)}
		<Label x={xOfNm(n.nm)} y={BASE + 24} text={n.name} size={13} />
	{/each}

	{#each flying as f, i (i)}
		<Photon x={f.x} y={f.y} angle={f.angle} color={barColour[f.k]} opacity={f.o} length={30} />
	{/each}

	<!-- the mix -->
	<circle cx={SW.x} cy={SW.y} r="46" fill={mixed} stroke="var(--stage-line)" stroke-width="1.5" />
	<Readout
		id="sb-mix"
		order={3}
		label="All mixed together"
		value={phase === 'sky' ? 'sky blue' : 'white'}
	>
		<Label x={SW.x} y={SW.y + 72} text="all mixed together:" size={13} muted />
		<Label
			x={SW.x}
			y={SW.y + 92}
			text={phase === 'sky' ? 'sky blue' : 'white'}
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- title -->
	{#if phase === 'sky'}
		<Readout
			id="sb-spec"
			order={1}
			label="Bars"
			value={eye
				? 'how bright each colour from the sky looks'
				: 'light from the sky overhead, at noon'}
		>
			<Label
				x={X0}
				y={70}
				text={eye
					? 'how bright each colour from the sky looks to the eye'
					: 'the light from the sky overhead at noon, colour by colour'}
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout
			id="sb-spec2"
			order={2}
			label="Violet"
			value={eye
				? 'hardly noticed: what is left is white light with extra blue'
				: 'more than blue; dotted: plain sunlight with the same red'}
		>
			<Label
				x={X0}
				y={94}
				text={eye
					? 'the eye hardly notices violet; what is left is white light with extra blue'
					: 'more violet than blue comes down; dotted: plain sunlight with the same red'}
				anchor="start"
				size={13}
				muted
			/>
		</Readout>
	{:else}
		<Readout id="sb-spec" order={1} label="Bars" value="sunlight above the air, colour by colour">
			<Label
				x={X0}
				y={70}
				text="sunlight above the air, colour by colour"
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout id="sb-spec2" order={2} label="In it" value="some of every colour">
			<Label
				x={X0}
				y={94}
				text="some of every colour of the rainbow"
				anchor="start"
				size={13}
				muted
			/>
		</Readout>
	{/if}
</g>
