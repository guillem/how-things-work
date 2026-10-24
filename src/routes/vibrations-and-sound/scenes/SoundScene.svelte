<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	// The cochlea page's player: one audio context made within the press, everything stopped on a
	// step change, silent under browser automation.
	import { playSamples, stopAll } from '../../cochlea-hearing/scenes/audio';
	import {
		receivedPower,
		rulerFrequency,
		waveDisplacement,
		parcelDisplacements,
		soundSpeed,
		type Medium
	} from '../model';
	import RulerView from './RulerView.svelte';
	import JarView from './JarView.svelte';
	import MaterialsView from './MaterialsView.svelte';
	import ParcelRow from './ParcelRow.svelte';
	import TwangButton from './TwangButton.svelte';

	let { step, t, playing, reduced, params, setParam }: StageProps = $props();

	const names: Record<Medium, string> = { air: 'Air', water: 'Water', steel: 'Steel' };
	let jar = $derived(step.id === 'jar');
	let materials = $derived(step.id === 'materials');
	let chosen = $derived<Medium>(
		params.material === 'steel' ? 'steel' : params.material === 'air' ? 'air' : 'water'
	);
	let length = $derived(step.id === 'pitch' ? Number(params.length ?? 10) : 10);
	let strength = $derived(step.id === 'louder' ? Number(params.strength ?? 2) / 2 : 1);
	let distance = $derived(step.id === 'distance' ? Number(params.distance ?? 2) : 1);
	let earX = $derived(step.id === 'distance' ? 550 + distance * 40 : 820);
	let air = $derived(jar ? Number(params.air ?? 100) / 100 : 1);
	let frequency = $derived(jar ? 440 : rulerFrequency(length));
	let relative = $derived(receivedPower(strength, distance, air));
	let rowMetres = $derived(step.id === 'distance' ? distance : 4);

	/** The motion is shown this many times slower than it happens. */
	const SLOW = 80;
	/**
	 * Seconds on screen between one twang and the next. The model's ring dies away slowly at this
	 * slow motion, so the picture damps it to rest from RING_END on (the row's far end a little
	 * later, as the last pushes travel); the next twang then starts from a ruler at rest.
	 */
	const LOOP = 16;
	const RING_END = 10.5;
	const fade = (s: number) => 1 - smoothstep(RING_END, RING_END + 3, s);

	/** Scene time of the latest twang (a press of the button restarts it). */
	let offset = $state(0);
	let stepId = $derived(step.id);
	$effect(() => {
		void stepId;
		untrack(() => {
			offset = 0;
			silence();
		});
	});
	/** Seconds on screen since the latest twang. */
	let since = $derived(reduced ? 2.5 : (((t - offset) % LOOP) + LOOP) % LOOP);
	let deflection = $derived(
		35 * waveDisplacement(0, since / SLOW, frequency, strength) * fade(since)
	);
	let parcels = $derived(
		parcelDisplacements(since / SLOW, frequency, strength, rowMetres).map((shift, k) =>
			air === 0 ? 0 : shift * fade(since - (SLOW * rowMetres * k) / 40 / soundSpeed.air)
		)
	);
	/** The bell in the jar keeps ringing steadily. */
	let bellAngle = $derived(12 * Math.sin((2 * Math.PI * 440 * t) / SLOW));

	let summary = $derived(
		jar
			? air === 0
				? 'No air: no airborne sound'
				: `${Math.round(air * 100)}% of the air remains`
			: step.id === 'pitch'
				? `${length} cm: ${Math.round(frequency)} wobbles each second`
				: step.id === 'louder'
					? `${['', 'Gentle', 'Medium', 'Strong', 'Strongest'][Number(params.strength ?? 2)]} twang: the same note`
					: step.id === 'distance'
						? `${distance} ${distance === 1 ? 'metre' : 'metres'} away: ${Math.round(relative * 100)}% of the energy`
						: materials
							? `${names[chosen]} carries the push along`
							: 'Air jiggles here; the push travels on'
	);

	const IDLE = 'Sound plays only when you press the button';
	let audioMessage = $state(IDLE);
	/** Flips the status once the note is over (a status line, not motion: wall-clock time is right). */
	let finished: ReturnType<typeof setTimeout> | undefined;
	function silence() {
		stopAll();
		clearTimeout(finished);
		audioMessage = IDLE;
	}
	/** Samples per second of the note. */
	const RATE = 44100;
	/** The model's note: a quick start, then a ring fading to a hundredth within about a second. */
	function note(f: number, volume: number): Float32Array {
		const n = Math.round(1.15 * RATE);
		const out = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			const s = i / RATE;
			const edges = Math.min(1, s / 0.012, (1.15 - s) / 0.02);
			const ring = Math.exp((Math.log(0.01) * Math.max(0, s - 0.012)) / 1.088);
			out[i] = volume * edges * ring * Math.sin(2 * Math.PI * f * s);
		}
		return out;
	}
	function listen() {
		// While paused, show the twang a quarter swing in (the ruler fully bent) rather than at rest.
		offset = playing ? t : t - SLOW / (4 * frequency);
		stopAll();
		clearTimeout(finished);
		if (typeof AudioContext === 'undefined') {
			audioMessage = 'Audio is unavailable in this browser';
			return;
		}
		if (relative === 0) {
			audioMessage = 'No airborne sound reaches the ear';
			return;
		}
		playSamples(note(frequency, 0.09 * Math.sqrt(relative)), RATE);
		audioMessage = 'Playing the model’s note';
		finished = setTimeout(() => {
			audioMessage = 'Note finished — press to play again';
		}, 1200);
	}
	onDestroy(() => {
		stopAll();
		clearTimeout(finished);
	});
</script>

<g>
	<Label
		x={480}
		y={46}
		anchor="middle"
		text={jar
			? 'A ringing bell, even with the air gone'
			: materials
				? 'Other materials carry vibrations too'
				: 'A ruler, a wobble, a travelling push'}
		size={25}
		weight={650}
	/>
	{#if materials}
		<MaterialsView {t} {chosen} />
	{:else}
		{#if jar}
			<JarView {air} angle={bellAngle} time={t} />
		{:else}
			<RulerView
				{length}
				{deflection}
				{earX}
				adjustable={step.id === 'pitch'}
				onlength={(cm: number) => setParam('length', cm)}
			/>
		{/if}
		<Readout
			id="row"
			label={jar ? 'Air inside the jar, enlarged' : 'Air, enlarged and slowed'}
			value={air === 0
				? 'No pushes cross the empty jar'
				: 'Each bit of air stays near its resting mark'}
			><Label
				x={480}
				y={step.id === 'distance' ? 405 : 385}
				anchor="middle"
				text={jar ? 'The air inside the jar, enlarged' : 'A closer look along the sound’s path'}
				size={19}
				muted
			/></Readout
		>
		<ParcelRow
			x={95}
			y={431}
			spacing={19}
			shifts={parcels}
			marked={20}
			opacity={jar ? (air === 0 ? 0 : Math.max(0.15, air)) : 0.8}
		/>
		<path
			d="M105 471 H845"
			stroke="var(--stage-line)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
	{/if}
	<Readout id="summary" label={jar ? 'Bell jar' : 'Sound'} value={summary}
		><Label x={480} y={519} anchor="middle" text={summary} size={23} weight={600} /></Readout
	>
	{#if step.id === 'distance' || jar}
		<Readout
			id="energy"
			label={jar ? 'Bell → air inside' : 'Energy at the ear'}
			value={jar ? 'Compared with a full jar' : 'Compared with one metre away'}
			><Label
				x={630}
				y={jar ? 275 : 380}
				anchor="middle"
				text={jar ? 'Bell → air inside' : 'Energy at the ear (vs 1 m)'}
				size={16}
			/></Readout
		>
		<rect x="540" y={jar ? 290 : 350} width="180" height="12" rx="6" fill="var(--stage-grid)" />
		<rect
			x="540"
			y={jar ? 290 : 350}
			width={180 * Math.min(1, relative)}
			height="12"
			rx="6"
			fill="var(--vs-wave)"
		/>
	{/if}
	{#if !materials}
		<TwangButton
			x={jar ? 647.5 : 167.5}
			y={100}
			text={jar ? 'Ring and hear' : 'Twang and hear'}
			onplay={listen}
		/>
		<Readout id="audio" label="Speakers" value={audioMessage}
			><Label x={480} y={567} anchor="middle" text={audioMessage} size={16} muted /></Readout
		>
	{/if}
</g>
