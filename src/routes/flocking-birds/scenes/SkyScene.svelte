<script lang="ts">
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		initialFlock,
		advance,
		steering,
		agreement,
		crowdedPairs,
		neighbourDistance,
		hawkAt,
		displacement,
		WIDTH,
		HEIGHT,
		type Bird,
		type Rules,
		type Vector
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(step.id);
	const rules: Rules = $derived({
		separation:
			phase === 'space'
				? params.spacing !== false
				: phase === 'try'
					? params.missing !== 'separation'
					: true,
		alignment:
			phase === 'direction'
				? params.alignment !== false
				: phase === 'try'
					? params.missing !== 'alignment'
					: true,
		cohesion:
			phase === 'together'
				? params.cohesion !== false
				: phase === 'try'
					? params.missing !== 'cohesion'
					: true,
		hawk: phase === 'hawk' && params.hawk === true
	});
	const config = $derived(
		`${phase}/${rules.separation}/${rules.alignment}/${rules.cohesion}/${rules.hawk}`
	);
	const followed = $derived(phase === 'follow' ? (Number(params.follow ?? 0) * 37) % 100 : 42);

	// Fixed-step deterministic integration, cached between frames. A reset or backwards clock
	// replays from the same initial flock. No wall-clock animation or effect reading t.
	let cached: Bird[] = initialFlock();
	let frame = 0;
	let lastConfig = '';
	let origin = 0;
	let lastT = 0;
	const snapshot = $derived.by(() => {
		const key = config;
		const now = t;
		if (key !== lastConfig || now < lastT) {
			cached = initialFlock();
			frame = 0;
			lastConfig = key;
			origin = now;
		}
		lastT = now;
		const target = Math.floor((reduced ? (rules.hawk ? 10 : 18) : Math.max(0, now - origin)) * 30);
		while (frame < target) {
			cached = advance(cached, rules, frame / 30);
			frame++;
		}
		return { birds: cached, time: frame / 30 };
	});
	const birds = $derived(snapshot.birds);
	const one = $derived(birds[followed]);
	const response = $derived(steering(birds, followed, rules, snapshot.time));
	const order = $derived(agreement(birds));
	const crowded = $derived(crowdedPairs(birds));
	const gap = $derived(Math.round(neighbourDistance(birds)));
	const birdLengths = $derived(Math.round((gap / 17) * 2) / 2);
	const agreementText = $derived(
		order > 0.85
			? 'Mostly the same way'
			: order > 0.5
				? 'Coming into line'
				: 'Many different directions'
	);
	const hawkVisible = $derived(rules.hawk && snapshot.time >= 3 && snapshot.time < 21);
	const predator = $derived(hawkAt(snapshot.time));
	const showNeighbours = $derived(
		['space', 'direction', 'together', 'try', 'follow'].includes(phase)
	);
	const caption = $derived(
		rules.hawk
			? hawkVisible
				? 'Nearby birds turn away from the hawk'
				: snapshot.time < 3
					? 'The hawk is about to enter'
					: 'The hawk has passed · neighbours gather again'
			: '100 birds · no leader · seven neighbours each'
	);
	const arrows = $derived([
		{
			name: 'Space',
			key: 'separation',
			vector: response.separation,
			on: rules.separation,
			color: 'var(--flock-space)'
		},
		{
			name: 'Same way',
			key: 'alignment',
			vector: response.alignment,
			on: rules.alignment,
			color: 'var(--flock-align)'
		},
		{
			name: 'Stay near',
			key: 'cohesion',
			vector: response.cohesion,
			on: rules.cohesion,
			color: 'var(--flock-cohere)'
		}
	]);
	function endpoint(v: Vector): Vector {
		const length = Math.hypot(v.x, v.y);
		const scale = length > 0.3 ? Math.min(50, 10 + length * 0.8) / length : 0;
		return { x: v.x * scale, y: v.y * scale };
	}
</script>

<g class="flocking-sky">
	<defs
		><clipPath id="flock-sky-clip"
			><rect x="50" y="98" width={WIDTH} height={HEIGHT} rx="16" /></clipPath
		></defs
	>
	<Label x={480} y={43} text="A flock from three small rules" size={24} weight={650} />
	<Readout id="caption" label="The flock" value={caption} order={0}>
		<Label x={480} y={75} text={caption} size={17} muted />
	</Readout>
	<rect
		x="50"
		y="98"
		width={WIDTH}
		height={HEIGHT}
		rx="16"
		fill="var(--flock-sky)"
		stroke="var(--stage-line)"
	/>
	<g clip-path="url(#flock-sky-clip)">
		<!-- Faint cloud lines stay behind the birds and never carry important labels. -->
		<path
			d="M90 145 q25 -20 50 0 t50 0 M670 410 q25 -20 50 0 t50 0"
			fill="none"
			stroke="var(--stage-line)"
			opacity="0.4"
			stroke-width="3"
		/>
		{#if showNeighbours}
			{#each response.neighbours as neighbour (neighbour)}
				{@const d = displacement(one, birds[neighbour])}
				<line
					x1={50 + one.x}
					y1={98 + one.y}
					x2={50 + one.x + d.x}
					y2={98 + one.y + d.y}
					stroke="var(--flock-neighbour)"
					stroke-width="1.4"
					opacity="0.7"
				/>
			{/each}
		{/if}
		{#each birds as bird, i (i)}
			<g
				transform="translate({50 + bird.x} {98 + bird.y}) rotate({(Math.atan2(bird.vy, bird.vx) *
					180) /
					Math.PI})"
			>
				<path
					d="M10 0 L-7 -6 L-3 0 L-7 6 Z"
					fill={i === followed ? 'var(--flock-focus)' : 'var(--flock-bird)'}
					opacity={showNeighbours && i !== followed && !response.neighbours.includes(i) ? 0.5 : 1}
				/>
			</g>
		{/each}
		<circle
			cx={50 + one.x}
			cy={98 + one.y}
			r="15"
			fill="none"
			stroke="var(--flock-focus)"
			stroke-width="2.5"
		/>
		{#if showNeighbours}
			{#each arrows as arrow (arrow.key)}
				{@const end = endpoint(arrow.vector)}
				{#if arrow.on && Math.hypot(end.x, end.y) > 0}
					<line
						x1={50 + one.x}
						y1={98 + one.y}
						x2={50 + one.x + end.x}
						y2={98 + one.y + end.y}
						stroke={arrow.color}
						stroke-width="3"
					/>
					<path
						d="M0 0 L-9 -4 L-9 4 Z"
						fill={arrow.color}
						transform="translate({50 + one.x + end.x} {98 + one.y + end.y}) rotate({(Math.atan2(
							end.y,
							end.x
						) *
							180) /
							Math.PI})"
					/>
				{/if}
			{/each}
		{/if}
		{#if hawkVisible}
			<circle
				cx={50 + predator.x}
				cy={98 + predator.y}
				r="110"
				fill="var(--flock-space)"
				opacity="0.07"
			/>
			<path
				d="M-24 0 L17 -21 L9 -3 L24 0 L9 3 L17 21 Z"
				transform="translate({50 + predator.x} {98 + predator.y})"
				fill="var(--flock-space)"
			/>
			<Label
				x={50 + predator.x}
				y={98 + predator.y + 38}
				text="hawk"
				size={18}
				color="var(--flock-space)"
			/>
		{/if}
	</g>
	{#each arrows as arrow, i (arrow.key)}
		<Readout
			id={arrow.key}
			label={arrow.name}
			value={arrow.on ? 'on' : 'off'}
			color={arrow.color}
			order={i + 1}
		>
			<circle cx={124 + i * 280} cy="498" r="6" fill={arrow.color} opacity={arrow.on ? 1 : 0.3} />
			<Label
				x={143 + i * 280}
				y={504}
				text={`${arrow.name} · ${arrow.on ? 'on' : 'off'}`}
				anchor="start"
				size={18}
				color={arrow.color}
				opacity={arrow.on ? 1 : 0.6}
			/>
		</Readout>
	{/each}
	<Readout
		id="result"
		label={phase === 'space' || (phase === 'try' && !rules.separation)
			? 'Very close pairs'
			: phase === 'together' || (phase === 'try' && !rules.cohesion)
				? 'Nearest bird'
				: 'Direction'}
		value={phase === 'space' || (phase === 'try' && !rules.separation)
			? `${crowded}`
			: phase === 'together' || (phase === 'try' && !rules.cohesion)
				? `about ${birdLengths} bird lengths away`
				: agreementText}
		order={5}
	>
		<Label
			x={480}
			y={548}
			text={phase === 'space' || (phase === 'try' && !rules.separation)
				? `${crowded} very close pairs`
				: phase === 'together' || (phase === 'try' && !rules.cohesion)
					? `Nearest bird: about ${birdLengths} bird lengths away (on average)`
					: agreementText}
			size={19}
			weight={600}
		/>
	</Readout>
	<Readout id="minor"
		><Label
			x={480}
			y={581}
			text={showNeighbours
				? 'Arrows: the ringed bird’s turns · lines: its seven neighbours'
				: 'A simplified model of flocking, not a measured bird population'}
			size={15}
			muted
		/></Readout
	>
</g>
