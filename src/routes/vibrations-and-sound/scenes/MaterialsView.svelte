<script lang="ts">
	/**
	 * One push sent at the same moment into ten metres of air, water and steel. Each row's front
	 * moves at that material's real speed of sound, slowed down 500 times so the eye can follow it;
	 * the push's length follows from the same short shove at the source (a faster material spreads
	 * it over more metres). The chosen material is in focus.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { soundSpeed, type Medium } from '../model';
	import ParcelRow from './ParcelRow.svelte';

	interface Props {
		/** Seconds since the step started (the push repeats once the slowest front is across). */
		t: number;
		chosen: Medium;
	}
	let { t, chosen }: Props = $props();

	/** Slow motion: one real second lasts this many seconds on screen. */
	const SLOW = 500;
	/** Metres of material in each row. */
	const LENGTH = 10;
	/** How long the source's single shove lasts, real seconds. */
	const SHOVE = 0.002;
	const X0 = 175;
	const SPACING = 27;
	const BITS = 21;
	const PER_METRE = (SPACING * (BITS - 1)) / LENGTH;

	const rows: { id: Medium; name: string; y: number; fill: string }[] = [
		{ id: 'air', name: 'Air', y: 175, fill: 'var(--surface)' },
		{ id: 'water', name: 'Water', y: 295, fill: 'var(--sky)' },
		{ id: 'steel', name: 'Steel', y: 415, fill: 'var(--membrane)' }
	];

	/** The shove's shape: out and back once, smoothly, over `SHOVE` seconds. */
	const shove = (s: number) => (s <= 0 || s >= SHOVE ? 0 : Math.sin((Math.PI * s) / SHOVE) ** 2);

	/** A new push once air's front has crossed and the row has settled. */
	const CYCLE = (LENGTH / soundSpeed.air) * SLOW + 2.4;
	let real = $derived((t % CYCLE) / SLOW);
	let views = $derived(
		rows.map((row) => {
			const speed = soundSpeed[row.id];
			const front = speed * real;
			const crossing = Math.round((1000 * LENGTH) / speed);
			return {
				...row,
				arrived: front >= LENGTH,
				front: Math.min(front, LENGTH),
				/** The stretch of the row the push covers right now, metres. */
				push: [Math.max(0, front - speed * SHOVE), Math.min(front, LENGTH)],
				crossing: `${crossing} thousandths of a second`,
				shifts: Array.from(
					{ length: BITS },
					(_, k) => 11 * shove(real - (k * LENGTH) / (BITS - 1) / speed)
				),
				source: 11 * shove(real)
			};
		})
	);
</script>

<g>
	<Label
		x={480}
		y={88}
		anchor="middle"
		text="One push sent into 10 metres of each, at the same moment"
		size={19}
		muted
	/>
	{#each views as row, i (row.id)}
		{@const focus = row.id === chosen}
		<g opacity={focus ? 1 : 0.45}>
			<rect
				x="150"
				y={row.y - 34}
				width="590"
				height="68"
				rx="12"
				fill={row.fill}
				stroke="var(--stage-line)"
				stroke-width={focus ? 3 : 1.5}
			/>
			<rect
				x={110 + row.source}
				y={row.y - 30}
				width="32"
				height="60"
				rx="5"
				fill="var(--protein)"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			{#if row.push[1] > row.push[0]}
				<rect
					x={X0 + row.push[0] * PER_METRE}
					y={row.y - 22}
					width={(row.push[1] - row.push[0]) * PER_METRE}
					height="44"
					rx="8"
					fill="var(--vs-front)"
					opacity="0.18"
				/>
			{/if}
			<ParcelRow x={X0} y={row.y} spacing={SPACING} shifts={row.shifts} r={7} opacity={0.85} />
			{#if !row.arrived && row.front > 0}
				<path
					d={`M${X0 + row.front * PER_METRE} ${row.y - 30} V${row.y + 30}`}
					stroke="var(--vs-front)"
					stroke-width="3"
					stroke-linecap="round"
				/>
			{/if}
			<Readout
				id={`front-${row.id}`}
				order={i + 1}
				label={row.name}
				value={`${row.arrived ? 'arrived' : `front at ${row.front.toFixed(1)} m`} · crosses 10 m in ${row.crossing}`}
				><Label x={150} y={row.y - 46} text={row.name} size={20} weight={focus ? 650 : 500} />
				<Label
					x={740}
					y={row.y - 46}
					anchor="end"
					text={`crosses 10 m in ${row.crossing}`}
					size={15}
					muted
				/>
				<Label
					x={756}
					y={row.y + 6}
					text={row.arrived ? 'arrived' : `${row.front.toFixed(1)} m`}
					size={18}
					weight={600}
					color={row.arrived ? undefined : 'var(--vs-front)'}
					tabular
				/></Readout
			>
		</g>
	{/each}
	<Readout id="scale"
		><Label x={X0} y={474} anchor="middle" text="0 m" size={14} muted />
		<Label x={X0 + LENGTH * PER_METRE} y={474} anchor="middle" text="10 m" size={14} muted />
		<Label
			x={480}
			y={474}
			anchor="middle"
			text={`slowed down ${SLOW} times`}
			size={14}
			muted
		/></Readout
	>
</g>
