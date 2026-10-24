<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Label, Handle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { receivedPower, rulerFrequency, rulerPath, waveDisplacement } from '../model';
	let { step, t, reduced, params, setParam }: StageProps = $props();
	const blue = '#228be6',
		orange = '#f59f00';
	let jar = $derived(step.id === 'jar');
	let length = $derived(step.id === 'pitch' ? Number(params.length ?? 10) : 10);
	let strength = $derived(step.id === 'louder' ? Number(params.strength ?? 2) / 2 : 1);
	let distance = $derived(step.id === 'distance' ? Number(params.distance ?? 2) : 1);
	let earX = $derived(step.id === 'distance' ? 550 + distance * 40 : 820);
	let air = $derived(jar ? Number(params.air ?? 100) / 100 : 1);
	let frequency = $derived(jar ? 440 : rulerFrequency(length));
	let offset = $state(0);
	let observedStep = $state('');
	$effect(() => {
		if (observedStep !== step.id) {
			observedStep = step.id;
			offset = 0;
		}
	});
	let age = $derived(((reduced ? 2.5 : Math.max(0, t - offset)) % 7) / 80);
	let deflection = $derived(35 * waveDisplacement(0, age, frequency, strength));
	let relative = $derived(receivedPower(strength, distance, air));
	let summary = $derived(
		jar
			? air === 0
				? 'No air: no airborne sound'
				: `${Math.round(air * 100)}% of the air remains`
			: step.id === 'pitch'
				? `${length} cm: ${Math.round(frequency)} wobbles each second`
				: step.id === 'louder'
					? `${strength === 0.5 ? 'Gentle' : strength === 2 ? 'Strongest' : 'Bigger'} twang: the same note`
					: step.id === 'distance'
						? `${distance} ${distance === 1 ? 'metre' : 'metres'} away: ${Math.round(relative * 100)}% of the energy`
						: 'Air jiggles here; the push travels on'
	);
	let audio: AudioContext | null = null;
	let audioMessage = $state('Sound plays only when you press the button');
	function keyValue(
		k: number | 'start' | 'end',
		value: number,
		min: number,
		max: number,
		id: string
	) {
		setParam(id, k === 'start' ? min : k === 'end' ? max : Math.max(min, Math.min(max, value + k)));
	}
	async function listen() {
		offset = t;
		if (typeof AudioContext === 'undefined') {
			audioMessage = 'Audio is unavailable in this browser';
			return;
		}
		if (audio && audio.state !== 'closed') await audio.close();
		if (relative === 0) {
			audioMessage = 'No airborne sound reaches the ear';
			return;
		}
		const context = new AudioContext();
		audio = context;
		await context.resume();
		const oscillator = context.createOscillator(),
			gain = context.createGain();
		oscillator.frequency.value = frequency;
		const now = context.currentTime,
			volume = 0.09 * Math.sqrt(relative);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(volume, now + 0.012);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.00001, volume * 0.01), now + 1.1);
		gain.gain.setValueAtTime(0, now + 1.15);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start();
		oscillator.stop(now + 1.2);
		audioMessage = air === 0 ? 'No airborne sound reaches the ear' : 'Playing the model’s note';
		oscillator.onended = () => {
			if (context.state !== 'closed') void context.close();
		};
	}
	onDestroy(() => {
		if (audio && audio.state !== 'closed') void audio.close();
	});
</script>

<g>
	<Label
		x={480}
		y={46}
		anchor="middle"
		text={jar ? 'A ringing bell, even with the air gone' : 'A ruler, a wobble, a travelling push'}
		size={25}
		weight={650}
	/>
	{#if jar}
		<path
			d="M140 295 V165 a110 110 0 0 1 220 0 V295 Z"
			fill="var(--sky)"
			fill-opacity="0.35"
			stroke="var(--stage-line)"
			stroke-width="3"
		/>
		<rect
			x="125"
			y="295"
			width="250"
			height="17"
			rx="5"
			fill="var(--membrane)"
			stroke="var(--stage-line)"
		/>
		{#each Array.from({ length: 35 }, (_, k) => k) as k (k)}
			{#if k < Math.round(air * 35)}<circle
					cx={165 + (k % 7) * 27 + 3 * Math.sin(age * 500 + k)}
					cy={140 + Math.floor(k / 7) * 30}
					r="3"
					fill={blue}
					opacity="0.45"
				/>{/if}
		{/each}
		<path d="M245 120 V155" stroke="var(--stage-ink)" stroke-width="4" />
		<g transform={`rotate(${12 * Math.sin(2 * Math.PI * 440 * age)},245,158)`}>
			<path
				d="M208 230 Q218 220 218 193 a27 27 0 0 1 54 0 Q272 220 282 230 Z"
				fill={orange}
				fill-opacity="0.75"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<circle cx="245" cy="240" r="7" fill="var(--stage-ink)" />
		</g>
		<path d="M350 300 H405 V267" fill="none" stroke="var(--stage-line)" stroke-width="6" />
		<rect
			x="385"
			y="235"
			width="75"
			height="36"
			rx="6"
			fill="var(--surface)"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		<Label x={423} y={258} anchor="middle" text="pump" size={17} />
		<Label
			x={650}
			y={180}
			anchor="middle"
			text={air === 0 ? 'The bell still vibrates' : 'Less air, a fainter sound'}
			size={23}
		/>
		<Label
			x={650}
			y={216}
			anchor="middle"
			text={air === 0
				? 'Nothing carries its sound across the jar'
				: 'The bell’s motion stays the same'}
			size={18}
			muted
		/>
	{:else}
		<rect
			x="65"
			y="280"
			width="165"
			height="28"
			rx="4"
			fill="var(--membrane)"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		<path d="M90 308 V345 M210 308 V345" stroke="var(--stage-line)" stroke-width="12" />
		<path d="M95 270 H230" stroke="var(--stage-ink-muted)" stroke-width="10" />
		<path
			d={rulerPath(length, 0)}
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
			stroke-dasharray="5 6"
		/>
		<path
			d={rulerPath(length, deflection)}
			fill="none"
			stroke={blue}
			stroke-width="9"
			stroke-linecap="round"
		/>
		<rect
			x="186"
			y="241"
			width="48"
			height="40"
			rx="5"
			fill="var(--protein)"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		<Label x={145} y={220} anchor="middle" text="held still" size={18} />
		<Label x={345} y={170} anchor="middle" text="free to wobble" size={19} color={blue} />
		{#if step.id === 'pitch'}
			<Handle
				x={230 + length * 12}
				y={270 + deflection}
				label="Length of free ruler"
				value={length}
				min={5}
				max={15}
				valuetext={`${length} centimetres`}
				onmove={(p: { x: number; y: number }) =>
					setParam('length', Math.round(Math.max(5, Math.min(15, (p.x - 230) / 12))))}
				onkey={(k: number | 'start' | 'end') => keyValue(k, length, 5, 15, 'length')}
			/>
		{/if}
		<path
			d={`M480 230 C${(480 + earX) / 2} 170 ${earX - 50} 170 ${earX - 30} 230 M480 250 C${(480 + earX) / 2} 310 ${earX - 50} 310 ${earX - 30} 250`}
			fill="none"
			stroke={blue}
			stroke-width="2"
			stroke-dasharray="8 8"
			opacity="0.4"
		/>
		<path
			d={`M480 240 H${earX - 50}`}
			stroke={blue}
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
		<Label x={650} y={156} anchor="middle" text="the sound spreads out" size={20} />
		<g transform={`translate(${earX},190)`}
			><path
				d="M0 72 C-35 60 -25 0 8 0 C52 0 57 51 25 76 C15 83 23 111 1 111 C-13 111 -21 95 -16 85 M-2 73 C20 58 26 32 6 29 C-8 26 -12 42 -10 49"
				fill="var(--surface)"
				stroke="var(--stage-ink)"
				stroke-width="4"
				stroke-linecap="round"
			/></g
		>
		<Label x={earX + 10} y={336} anchor="middle" text="ear" size={20} />
	{/if}
	<Readout
		id="row"
		label="Air, enlarged and slowed"
		value={air === 0
			? 'No pushes cross the empty jar'
			: 'Each bit of air stays near its resting mark'}
		><Label
			x={480}
			y={385}
			anchor="middle"
			text="A closer look along the sound’s path"
			size={19}
			muted
		/></Readout
	>
	{#each Array.from({ length: 41 }, (_, k) => k) as k (k)}
		{@const x = 95 + k * 19}
		{@const d = ((step.id === 'distance' ? distance : 4) * k) / 40}
		{@const shift =
			air === 0 ? 0 : (waveDisplacement(d, age, frequency, strength) * 24) / Math.max(1, d)}
		<path d={`M${x} 418 V444`} stroke="var(--stage-line)" stroke-width="1" opacity="0.6" />
		<circle
			cx={x + shift}
			cy="431"
			r={k === 20 ? 8 : 5}
			fill={k === 20 ? orange : blue}
			opacity={jar ? Math.max(0.15, air) : 0.8}
		/>
	{/each}
	<path
		d="M105 471 H845"
		stroke="var(--stage-line)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="summary" label={jar ? 'Bell jar' : 'Sound'} value={summary}
		><Label x={480} y={519} anchor="middle" text={summary} size={23} weight={600} /></Readout
	>
	{#if step.id === 'distance' || jar}
		<rect x="540" y="290" width="180" height="12" rx="6" fill="var(--stage-grid)" />
		<rect x="540" y="290" width={180 * Math.min(1, relative)} height="12" rx="6" fill={blue} />
	{/if}
	<g
		transform={jar ? 'translate(480,0)' : undefined}
		role="button"
		tabindex="0"
		aria-label={jar ? 'Ring and hear' : 'Twang and hear'}
		onclick={() => void listen()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				void listen();
			}
		}}
		style="cursor:pointer"
	>
		<rect
			x="55"
			y="76"
			width="225"
			height="48"
			rx="24"
			fill="var(--surface)"
			stroke={blue}
			stroke-width="2"
		/>
		<path d="M78 92 L78 108 L91 100 Z" fill={blue} />
		<Label
			x={176}
			y={107}
			anchor="middle"
			text={jar ? 'Ring and hear' : 'Twang and hear'}
			size={19}
			color={blue}
		/>
	</g>
	<Readout id="audio" label="Speakers" value={audioMessage}
		><Label x={480} y={567} anchor="middle" text={audioMessage} size={16} muted /></Readout
	>
</g>
