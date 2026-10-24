<script lang="ts">
	import type { Point } from '#lib/draw/math';
	import { Handle, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HAND,
		contactTemperature,
		heatTransferred,
		materials,
		temperatureAt,
		warmthColor
	} from '../model';
	let { step, params, setParam, t, reduced }: StageProps = $props();
	const centers = [150, 370, 590, 810];
	let phase = $derived(step.id);
	let interactive = $derived(phase === 'finger' || phase === 'compare');
	let chosen = $derived(
		interactive
			? Math.max(0, Math.min(3, Math.round(Number(params.finger ?? 0))))
			: phase === 'glove'
				? 3
				: 0
	);
	let material = $derived(materials[chosen]);
	let room = $derived(phase === 'room' ? Number(params.room ?? 20) : phase === 'equal' ? 40 : 20);
	let touch = $derived(phase !== 'table' && phase !== 'equal');
	let contact = $derived(contactTemperature(material, room));
	let direction = $derived(
		room === HAND
			? 'same temperature: no heat flows'
			: room < HAND
				? 'heat leaves the finger'
				: 'heat enters the finger'
	);
	let elapsed = $derived(reduced ? 0.1 : 0.015 + ((t % 8) / 8) * 0.085);
	const cells = Array.from({ length: 80 }, (_, i) => i);
	const flows = Array.from({ length: 9 }, (_, i) => i);
	function pick(x: number) {
		setParam('finger', Math.max(0, Math.min(3, Math.round((x - 150) / 220))));
	}
	function key(n: number | 'start' | 'end') {
		setParam('finger', n === 'start' ? 0 : n === 'end' ? 3 : Math.max(0, Math.min(3, chosen + n)));
	}
</script>

{#snippet object(i: number)}
	{@const m = materials[i]}
	<g transform="translate({centers[i]},260)" opacity={touch && chosen !== i ? 0.45 : 1}>
		{#if i < 2}
			<path
				d="M-15 0 Q-27 26 -11 53 Q1 66 15 53 Q28 28 16 0 Q0 -17 -15 0"
				fill={m.color}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			<rect
				x="-6"
				y="-49"
				width="12"
				height="64"
				rx="6"
				fill={m.color}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			{#if i === 1}
				<path
					d="M-7 15 Q9 25 -5 46 M2 -42 L2 -4"
					fill="none"
					stroke="var(--cold-grain)"
					stroke-width="2"
				/>
			{:else}
				<path
					d="M-7 18 Q-12 32 -6 42"
					fill="none"
					stroke="var(--stage-bg)"
					stroke-width="5"
					opacity="0.65"
				/>
			{/if}
		{:else if i === 2}
			<path
				d="M-47 -24 L-35 60 Q0 70 35 60 L47 -24 Z"
				fill={m.color}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			<ellipse
				cy="-24"
				rx="47"
				ry="12"
				fill="var(--stage-bg)"
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			<path d="M-22 -1 L-15 45" stroke="var(--stage-bg)" stroke-width="6" opacity="0.4" />
		{:else}
			<path
				d="M-36 60 L-40 12 L-69 -13 Q-78 -32 -60 -36 L-39 -13 L-38 -50 Q-35 -65 -22 -55 L-18 -20 L-16 -68 Q-6 -80 2 -64 L3 -20 L9 -62 Q22 -73 28 -57 L24 -18 L34 -43 Q47 -52 52 -36 L43 17 L34 60 Z"
				fill={m.color}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			{#each [0, 1, 2, 3] as row (row)}
				<path
					d="M-30 {8 + row * 12} q9 -9 18 0 t18 0 t18 0"
					fill="none"
					stroke="var(--cold-knit)"
					stroke-width="2"
				/>
			{/each}
		{/if}
	</g>
{/snippet}

<g>
	<Label
		x={480}
		y={45}
		anchor="middle"
		size={23}
		weight={650}
		text={phase === 'table'
			? 'One room. Four identical temperatures.'
			: phase === 'equal'
				? 'In a hot room, metal feels hottest'
				: phase === 'room'
					? 'Warm the objects past the hand’s temperature'
					: phase === 'glove'
						? 'Wool slows the loss of warmth'
						: 'What happens where skin meets the object?'}
	/>
	<rect x="45" y="326" width="870" height="18" rx="8" fill="var(--cold-table)" />
	<path
		d="M80 344 L70 400 M880 344 L890 400"
		stroke="var(--cold-table)"
		stroke-width="10"
		stroke-linecap="round"
	/>
	{#each materials as m, i (m.id)}
		<g>
			<Label x={centers[i]} y={92} anchor="middle" size={18} text={m.object} />
			<rect
				x={centers[i] - 49}
				y="110"
				width="98"
				height="38"
				rx="19"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<circle cx={centers[i] - 28} cy="129" r="6" fill={warmthColor(room)} />
			<Label x={centers[i] + 8} y={135} size={19} anchor="middle" text={`${room} °C`} />
			{@render object(i)}
			{#if phase === 'equal'}
				<Readout
					id={'contact-' + m.id}
					label={m.object}
					value={`${contactTemperature(m, room).toFixed(1)} °C at the skin`}
				>
					<Label
						x={centers[i]}
						y={379}
						anchor="middle"
						size={20}
						weight={600}
						text={`${contactTemperature(m, room).toFixed(1)} °C at the skin`}
					/>
				</Readout>
			{:else if phase === 'compare'}
				<rect x={centers[i] - 76} y="366" width="152" height="12" rx="6" fill="var(--stage-grid)" />
				<rect
					x={centers[i] - 76}
					y="366"
					width={(152 * heatTransferred(m, room, 0.1)) / heatTransferred(materials[0], room, 0.1)}
					height="12"
					rx="6"
					fill="var(--cold-heat)"
				/>
			{/if}
		</g>
	{/each}
	{#if touch}
		<g transform="translate({centers[chosen]},160)">
			<!-- side of a finger: the pad touches the material at y=260 -->
			<path
				d="M-80 21 Q-28 18 -12 31 Q9 43 12 70 Q13 92 0 100 Q-21 107 -34 85 L-55 60 L-80 62 Z"
				fill="var(--cold-skin)"
				stroke="var(--cold-skin-edge)"
				stroke-width="2"
			/>
			<path d="M-15 44 Q-1 49 0 62" fill="none" stroke="var(--cold-skin-edge)" stroke-width="2" />
		</g>
		{#if interactive}
			<Handle
				x={centers[chosen]}
				y={185}
				label="Move the finger"
				value={chosen}
				min={0}
				max={3}
				valuetext={material.object}
				onmove={(p: Point) => pick(p.x)}
				onkey={key}
				color="var(--cold-heat)"
			/>
		{/if}
		<Readout
			id="inset"
			order={1}
			label="Touching"
			value={material.object}
			note="First touch, greatly enlarged; skin and object depth scales differ."
		>
			<Label
				x={80}
				anchor="start"
				y={427}
				size={16}
				text={`First touch · ${material.name.toLowerCase()} · greatly enlarged`}
			/>
		</Readout>
		<!-- Profile is the analytic heat-equation solution, not a decorative gradient.
		     Left: 1 mm of skin. Right: 8 mm of object. This unequal scale is explicit. -->
		{#each cells as i (i)}
			{@const skinSide = i < 40}
			{@const depth = skinSide ? ((39.5 - i) / 40) * 0.001 : ((i - 39.5) / 40) * 0.008}
			<rect
				x={80 + i * 10}
				y="447"
				width="10.1"
				height="54"
				fill={warmthColor(
					temperatureAt(material, room, depth, elapsed, skinSide ? 'skin' : 'object')
				)}
			/>
		{/each}
		<rect x="80" y="447" width="800" height="54" rx="2" fill="none" stroke="var(--stage-line)" />
		<line x1="480" y1="440" x2="480" y2="509" stroke="var(--stage-ink)" stroke-width="2" />
		{#if room !== HAND}
			{#each flows as i (i)}
				{@const u = reduced ? (i + 0.5) / 9 : (t / 3 + i / 9) % 1}
				{@const x = room < HAND ? 310 + u * 340 : 650 - u * 340}
				{@const size =
					2 +
					5 *
						Math.abs(heatTransferred(material, room, 0.1) / heatTransferred(materials[0], 20, 0.1))}
				<circle
					cx={x}
					cy="474"
					r={size}
					fill="var(--cold-flow)"
					stroke="var(--stage-bg)"
					stroke-width="1"
					opacity={Math.sin(Math.PI * u)}
				/>
			{/each}
		{/if}
		<g transform="translate(265,560)">
			<path d="M-23 0 A23 23 0 0 1 46 0" fill="none" stroke="var(--stage-grid)" stroke-width="6" />
			<line
				x1="11.5"
				y1="0"
				x2={11.5 + 28 * Math.cos(Math.PI + Math.max(0, Math.min(1, (contact - 5) / 40)) * Math.PI)}
				y2={28 * Math.sin(Math.PI + Math.max(0, Math.min(1, (contact - 5) / 40)) * Math.PI)}
				stroke="var(--cold-heat)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<circle cx="11.5" cy="0" r="4" fill="var(--stage-ink)" />
		</g>
		<Readout
			id="contact"
			order={2}
			label="Skin at the contact"
			value={`${contact.toFixed(1)} °C`}
			note={direction}
		>
			<Label x={80} anchor="start" y={530} size={16} text="skin · first millimetre" />
			<Label x={880} y={530} size={16} anchor="end" text="object · first eight millimetres" />
			<Label
				x={480}
				y={558}
				size={24}
				weight={650}
				anchor="middle"
				text={`${contact.toFixed(1)} °C at the skin`}
			/>
			<Label x={480} y={580} size={17} anchor="middle" text={direction} />
		</Readout>
	{:else}
		<Readout
			id="same"
			label={phase === 'equal' ? undefined : 'All four objects'}
			value={`${room} °C`}
			note={phase === 'equal'
				? 'Same objects, different skin temperatures.'
				: 'The untouched finger starts at 33 °C.'}
		>
			<Label
				x={480}
				y={471}
				size={30}
				weight={600}
				anchor="middle"
				text={`All four begin at ${room} °C`}
			/>
			<Label
				x={480}
				y={516}
				size={20}
				anchor="middle"
				text={phase === 'equal'
					? 'The hand begins at 33 °C. Heat enters it.'
					: 'The finger begins at 33 °C. Which feels coldest?'}
			/>
		</Readout>
	{/if}
</g>
