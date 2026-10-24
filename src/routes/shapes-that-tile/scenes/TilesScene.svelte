<script lang="ts">
	import { Label, Handle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bentTile,
		cornerAngle,
		cornerFit,
		cornerGap,
		floorTiles,
		points,
		polygon,
		shapeNames
	} from '../model';
	let { step, params, setParam }: StageProps = $props();
	const ink = ['#228be6', '#12b886', '#f59f00', '#845ef7', '#e64980', '#15aabf'];
	let sides = $derived(Number(params[step.id] ?? step.hints?.sides ?? 4));
	let fit = $derived(cornerFit(sides));
	let count = $state(1);
	let previous = $state('');
	$effect(() => {
		const key = `${step.id}-${sides}`;
		if (previous !== key) {
			previous = key;
			count = step.hints?.complete ? fit.copies : 1;
		}
	});
	let isBend = $derived(step.id === 'bend');
	let bend = $derived(Number(params.bend ?? 12));
	let angle = $derived(cornerAngle(sides));
	let total = $derived(count * angle);
	let closed = $derived(Math.abs(total - 360) < 1e-7);
	let status = $derived(
		closed
			? `${count} corners: one full turn`
			: total > 360
				? 'One tile too many: overlap'
				: `${count} ${count === 1 ? 'corner' : 'corners'}: a gap remains`
	);
	let patch = $derived(floorTiles(sides, sides === 6 ? 36 : 46));
	let showGap = $derived(!fit.tiles && count >= fit.copies);
	let floorStatus = $derived(
		total > 360
			? 'Overlap: tap to start again'
			: closed
				? 'No gaps or overlaps'
				: showGap
					? 'A gap this tile cannot fill'
					: 'Keep adding corners'
	);
	let gapFan = $derived(
		Array.from({ length: fit.copies }, (_, k) =>
			polygon(sides, sides >= 6 ? 60 : 86, (k * angle * Math.PI) / 180)
		)
	);
	let gap = $derived(cornerGap(sides, 125));
	let tiles = $derived(
		Array.from({ length: count }, (_, k) =>
			polygon(sides, sides >= 6 ? 72 : 108, (k * angle * Math.PI) / 180)
		)
	);
	function add() {
		count = count >= fit.copies + (fit.tiles ? 0 : 1) ? 1 : count + 1;
	}
	function setBend(value: number) {
		setParam('bend', Math.round(Math.max(-25, Math.min(25, value))));
	}
</script>

<g>
	{#if isBend}
		<Label
			x={480}
			y={55}
			text="The same bend on opposite edges"
			size={25}
			anchor="middle"
			weight={650}
		/>
		{#each Array.from({ length: 4 }, (_, r) => r) as r (r)}
			{#each Array.from({ length: 7 }, (_, c) => c) as c (c)}
				<polygon
					transform={`translate(${140 + c * 96},${100 + r * 96})`}
					points={points(bentTile(96, bend))}
					fill={ink[(r + c) % ink.length]}
					fill-opacity="0.18"
					stroke="var(--stage-ink)"
					stroke-width="1.8"
				/>
			{/each}
		{/each}
		<polygon
			transform="translate(428,196)"
			points={points(bentTile(96, bend))}
			fill="#f59f00"
			fill-opacity="0.45"
			stroke="#f59f00"
			stroke-width="4"
		/>
		<Handle
			x={524 + bend}
			y={220}
			label="Bend the matching edges"
			value={bend}
			min={-25}
			max={25}
			valuetext={bend === 0 ? 'Straight edges' : `${bend} units of bend`}
			color="#f59f00"
			onmove={(p: { x: number; y: number }) => setBend(p.x - 524)}
			onkey={(k: number | 'start' | 'end') =>
				setBend(k === 'start' ? -25 : k === 'end' ? 25 : bend + k)}
		/>
		<Readout
			id="bend"
			label="Matching edges"
			value={bend === 0
				? 'Straight: the squares fit'
				: 'Both edges bend together: the tiles still fit'}
			><Label
				x={480}
				y={540}
				anchor="middle"
				text={bend === 0
					? 'Straight: the squares fit'
					: 'Matching bulges and hollows — still no gaps'}
				size={20}
			/></Readout
		>
	{:else}
		<Label x={245} y={58} anchor="middle" text={shapeNames[sides]} size={25} weight={650} />
		<Label
			x={704}
			y={58}
			anchor="middle"
			text={closed
				? 'Repeat the fit'
				: showGap
					? 'This corner leaves a hole'
					: 'Can it fill a floor?'}
			size={25}
			weight={650}
		/>
		<rect
			x={490}
			y={95}
			width={430}
			height={385}
			rx="18"
			fill="var(--surface)"
			stroke="var(--stage-line)"
		/>
		<g transform="translate(515,130)">
			{#if closed}
				{#each patch as tile, i (i)}
					<polygon
						points={points(tile)}
						fill={ink[i % ink.length]}
						fill-opacity="0.25"
						stroke="var(--stage-ink)"
						stroke-width="1.2"
					/>
				{/each}
			{:else if showGap}
				<g transform="translate(190,140)">
					{#each gapFan as tile, i (i)}<polygon
							points={points(tile)}
							fill={ink[i % ink.length]}
							fill-opacity="0.25"
							stroke="var(--stage-ink)"
							stroke-width="2"
						/>{/each}
					<polygon
						points={points(gap)}
						fill="#fa5252"
						fill-opacity="0.22"
						stroke="#fa5252"
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
					<circle r="5" fill="var(--stage-ink)" />
				</g>
				<Label x={190} y={325} anchor="middle" text="The red space is left uncovered" size={18} />
			{:else}
				<Label x={190} y={145} anchor="middle" text="Try the bright corner" size={21} />
				<Label x={190} y={180} anchor="middle" text="to add another tile" size={19} muted />
			{/if}
		</g>
		<g transform="translate(245,290)">
			<circle
				r="165"
				fill="none"
				stroke="var(--stage-grid)"
				stroke-width="2"
				stroke-dasharray="6 6"
			/>
			{#each tiles as tile, i (i)}
				<polygon
					points={points(tile)}
					fill={total > 360 && i === tiles.length - 1 ? '#fa5252' : ink[i % ink.length]}
					fill-opacity={total > 360 && i === tiles.length - 1 ? 0.5 : 0.28}
					stroke={total > 360 && i === tiles.length - 1 ? '#fa5252' : 'var(--stage-ink)'}
					stroke-width="2.5"
				/>
			{/each}
			<g
				role="button"
				tabindex="0"
				aria-label="Add a tile around the corner"
				onclick={add}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						add();
					}
				}}
				style="cursor:pointer"
			>
				<circle r="30" fill="var(--stage-bg)" stroke="#f59f00" stroke-width="3" />
				<path d="M-10 0 H10 M0 -10 V10" stroke="#f59f00" stroke-width="4" stroke-linecap="round" />
			</g>
		</g>
		<Readout id="corners" label="Around the corner" value={status}
			><Label
				x={245}
				y={510}
				anchor="middle"
				text={status}
				size={20}
				color={total > 360 ? '#fa5252' : undefined}
			/></Readout
		>
		<Readout id="floor" label="Floor" value={floorStatus}
			><Label x={705} y={510} anchor="middle" text={floorStatus} size={19} /></Readout
		>
		<Readout
			id="instruction"
			label="Try it"
			value="Tap the corner again to start over after the last tile"
			><Label
				x={480}
				y={565}
				anchor="middle"
				text="Tap the bright corner to add a tile; after the last, start again."
				size={17}
				muted
			/></Readout
		>
	{/if}
</g>
