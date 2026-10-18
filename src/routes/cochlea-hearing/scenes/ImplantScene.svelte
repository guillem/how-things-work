<script lang="ts">
	/**
	 * A cochlear implant. Top: the spectrum of the chosen vowel (`params.vowel`) drawn along the
	 * cochlea's place axis (each harmonic at the place tuned to it), the processor's
	 * `params.channels` bands (equal lengths of the cochlea from 200 Hz to 7 kHz) and the one level
	 * each band keeps (measured with the vocoder's own band filters). Lines run from each band to its
	 * electrode. Below: the uncoiled cochlea with the electrode array in the lower channel,
	 * reaching 24 mm from the base, each contact lit by its band's level. The actions play the
	 * vowel and the noise-vocoded vowel, quietly.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LENGTH_MM, cfAt, placeOf } from '../model.ts';
	import {
		BAND_HI,
		BAND_LO,
		INSERTION_MM,
		VOWELS,
		bandEdges,
		bandLevels,
		electrodePlaces,
		vocode,
		vowelHarmonics,
		vowelSound,
		type VowelId
	} from '../implant.ts';
	import { playSamples, stopAll } from './audio';
	import Duct from './Duct.svelte';
	import { MAP_TICKS, X0, X1, hz, xAt } from './geometry';

	let { step, params }: StageProps = $props();

	const vowelId = $derived((params.vowel ?? 'ah') as VowelId);
	const vowel = $derived(VOWELS[vowelId]);
	const n = $derived(Math.max(1, Math.min(22, Math.round(Number(params.channels ?? 8)))));

	const harmonics = $derived(vowelHarmonics(vowel));
	const edges = $derived(bandEdges(n));
	/** The vowel as a sound (cached per vowel). */
	const sample = $derived(vowelSound(vowel));
	/**
	 * Level of each band (dB re the strongest band), measured with the simulation's own band
	 * filters, so the bars and the electrodes show what the vocoder uses.
	 */
	const bands = $derived.by(() => {
		const levels = bandLevels(sample, n);
		const top = Math.max(...levels) || 1;
		return levels.map((v) => (v > 0 ? 20 * Math.log10(v / top) : -Infinity));
	});
	const electrodes = $derived(electrodePlaces(n));

	// ---- sound ---------------------------------------------------------------------------------
	let last: { v: number; i: number } | undefined;
	$effect(() => {
		const v = Number(params.playVowel ?? 0);
		const i = Number(params.playImplant ?? 0);
		untrack(() => {
			if (last && v !== last.v) playSamples(sample);
			else if (last && i !== last.i) playSamples(vocode(sample, n).sound);
			last = { v, i };
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- layout --------------------------------------------------------------------------------
	const ST = 92;
	const SB = 226;
	const sx = scale([0, LENGTH_MM], [X0, X1]);
	const sy = scale([-60, 0], [SB, ST]);
	const dbY = (db: number) => sy(Math.max(-60, db));
	const TOP = 304;
	const BOTTOM = 384;
	const ARRAY_Y = 368;

	const lines = $derived(
		harmonics
			.filter((h) => h.f >= 60)
			.map((h) => {
				const x = xAt(placeOf(h.f)).toFixed(1);
				return `M${x} ${SB}L${x} ${dbY(20 * Math.log10(h.a)).toFixed(1)}`;
			})
			.join('')
	);
	const keep = $derived(
		bands
			.map((db, i) => {
				if (!Number.isFinite(db) || db < -60) return '';
				const a = xAt(placeOf(edges[i])).toFixed(1);
				const b = xAt(placeOf(edges[i + 1])).toFixed(1);
				return `M${a} ${dbY(db).toFixed(1)}L${b} ${dbY(db).toFixed(1)}`;
			})
			.join('')
	);
	const wires = $derived(
		electrodes
			.map((mm, i) => {
				const c = xAt(placeOf(Math.sqrt(edges[i] * edges[i + 1])));
				return `M${c.toFixed(1)} ${SB + 4}C${c.toFixed(1)} ${SB + 40} ${xAt(mm).toFixed(1)} ${TOP - 40} ${xAt(mm).toFixed(1)} ${ARRAY_Y - 6}`;
			})
			.join('')
	);
	/** Brightness of each contact: its band's level, 0 at −40 dB and below. */
	const glow = $derived(bands.map((db) => (Number.isFinite(db) ? Math.max(0, 1 + db / 40) : 0)));
	const deepest = $derived(electrodes[0]);
	const tickMm = MAP_TICKS.map(([f]) => placeOf(f));
	const tickLabel = (mm: number) =>
		MAP_TICKS.find(([f]) => Math.abs(placeOf(f) - mm) < 1e-6)?.[1] ?? '';
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Vowel"
		value="“{vowelId}” as in {vowel.word}"
		note="{n} channel{n === 1 ? '' : 's'}"
	>
		<Label
			anchor="start"
			x={24}
			y={34}
			text="the vowel “{vowelId}” (as in {vowel.word}) through an implant with {n} channel{n === 1
				? ''
				: 's'}"
			size={15}
			weight={600}
		/>
	</Readout>

	<!-- the spectrum along the place axis -->
	{#each edges.slice(0, -1) as e, i (i)}
		{#if i % 2 === 0}
			<rect
				x={xAt(placeOf(edges[i + 1]))}
				y={ST}
				width={xAt(placeOf(e)) - xAt(placeOf(edges[i + 1]))}
				height={SB - ST}
				fill="var(--co-band)"
			/>
		{/if}
	{/each}
	<Axes
		{sx}
		{sy}
		xTicks={tickMm}
		xFormat={tickLabel}
		yTicks={[-60, -40, -20, 0]}
		xLabel="placed along the cochlea"
		yLabel="harmonics (dB)"
	/>
	<path d={lines} stroke="var(--co-wave)" stroke-width="1.6" fill="none" />
	<path
		d={keep}
		stroke="var(--co-electrode)"
		stroke-width="3.5"
		stroke-linecap="round"
		fill="none"
	/>
	<Readout id="key" label="Lines: the vowel's harmonics; bars: the level each band keeps">
		<Label
			anchor="start"
			x={X0 + 10}
			y={ST + 14}
			text="harmonics of 120 Hz"
			size={12}
			color="var(--co-wave-text)"
		/>
		<Label
			anchor="start"
			x={X0 + 10}
			y={ST + 30}
			text="what the implant keeps: one level per band"
			size={12}
			color="var(--co-electrode-text)"
		/>
	</Readout>

	<!-- bands to electrodes -->
	<path d={wires} stroke="var(--co-electrode)" stroke-width="1" opacity="0.55" fill="none" />

	<Duct top={TOP} bottom={BOTTOM} names={false} />
	<line
		x1={X0}
		x2={X1}
		y1={(TOP + BOTTOM) / 2 - 6}
		y2={(TOP + BOTTOM) / 2 - 6}
		stroke="var(--co-membrane-edge)"
		stroke-width="3"
		opacity="0.7"
	/>
	<!-- the electrode array, in through the round window -->
	<path
		d="M{X0 - 46} {ARRAY_Y} L{xAt(INSERTION_MM) + 6} {ARRAY_Y}"
		stroke="var(--co-array)"
		stroke-width="5"
		stroke-linecap="round"
		fill="none"
	/>
	<Readout id="array-name">
		<Label
			anchor="start"
			x={xAt(INSERTION_MM) + 14}
			y={ARRAY_Y + 4}
			text="electrode array (in the scala tympani)"
			size={11}
			muted
		/>
	</Readout>
	{#each electrodes as mm, i (i)}
		<circle
			cx={xAt(mm)}
			cy={ARRAY_Y}
			r={4 + 7 * glow[i]}
			fill="var(--co-electrode)"
			opacity={0.25 * glow[i]}
		/>
		<circle
			cx={xAt(mm)}
			cy={ARRAY_Y}
			r="3.2"
			fill="var(--co-electrode)"
			opacity={0.35 + 0.65 * glow[i]}
		/>
	{/each}

	<Readout
		id="array"
		order={2}
		label="Deepest electrode"
		value="{deepest.toFixed(0)} mm, a place tuned to {hz(cfAt(deepest))}"
		note="it carries the band {hz(edges[0])}–{hz(edges[1])}"
	>
		<Label
			anchor="start"
			x={24}
			y={472}
			text={n === 1
				? `one electrode, at ${deepest.toFixed(0)} mm (the place tuned to ${hz(cfAt(deepest))}), carries everything from ${hz(edges[0])} to ${hz(edges[1])}`
				: `electrodes from ${electrodes.at(-1)!.toFixed(0)} to ${deepest.toFixed(0)} mm; the deepest sits at the place tuned to ${hz(cfAt(deepest))} but carries ${hz(edges[0])}–${hz(edges[1])}`}
			size={12}
			tabular
		/>
		<Label
			anchor="start"
			x={24}
			y={494}
			text="bands from {hz(BAND_LO)} to {hz(
				BAND_HI
			)}, equal lengths of the cochlea; the apex beyond {INSERTION_MM} mm gets no electrode"
			size={12}
			muted
		/>
	</Readout>
	<Readout
		id="formants"
		order={3}
		label="Formants"
		value={vowel.formants.map((f) => hz(f)).join(', ')}
	>
		<Label
			anchor="start"
			x={24}
			y={516}
			text="formants: {vowel.formants.map((f) => hz(f)).join(', ')}"
			size={12}
			muted
		/>
	</Readout>
</g>
