<script lang="ts">
	import { Label, Handle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bentTile,
		cornerAngle,
		cornerFit,
		cornerGap,
		floorTiles,
		QUAD,
		quadTiles,
		points,
		polygon,
		shapeNames
	} from '../model';
	let { step, params, setParam }: StageProps = $props();
	const ink = [1, 2, 3, 4, 5, 6].map((k) => `var(--tl-tile-${k})`);
	/** Only the tray steps (those with a shape in their hints) choose a shape; the bend step's
	 * control is a bend, not a side count. */
	let sides = $derived(
		step.hints?.sides === undefined ? 4 : Number(params[step.id] ?? step.hints.sides)
	);
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
	// The "regular is the important word" step shows an irregular tile that does fill a floor.
	let irregular = $derived(step.id === 'not-all');
	const quadFloor = quadTiles(QUAD, 380, 300);
	let floorStatus = $derived(
		irregular
			? 'No gaps or overlaps'
			: total > 360
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
	let bendText = $derived(
		bend === 0
			? 'Straight: the squares fit'
			: bend > 0
				? 'Bulge at the top, hollow below — still no gaps'
				: 'Hollow at the top, bulge below — still no gaps'
	);
	let bendValue = $derived(
		bend === 0
			? 'Straight edges'
			: `S-bend by ${Math.round((Math.abs(bend) / 96) * 100)}% of a side: top half bent ${bend > 0 ? 'out' : 'in'}, bottom half ${bend > 0 ? 'in' : 'out'}`
	);
	const instruction = 'Tap the orange + to add a tile; after the last, start again.';
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
			fill="var(--tl-accent)"
			fill-opacity="0.45"
			stroke="var(--tl-accent)"
			stroke-width="4"
		/>
		<Handle
			x={524 + bend}
			y={220}
			label="Bend the matching edges"
			value={bend}
			min={-25}
			max={25}
			valuetext={bendValue}
			color="var(--tl-accent)"
			onmove={(p: { x: number; y: number }) => setBend(p.x - 524)}
			onkey={(k: number | 'start' | 'end') =>
				setBend(k === 'start' ? -25 : k === 'end' ? 25 : bend + k)}
		/>
		<Readout id="bend" label="Matching edges" value={bendText}
			><Label x={480} y={540} anchor="middle" text={bendText} size={20} /></Readout
		>
	{:else}
		<Label x={245} y={58} anchor="middle" text={shapeNames[sides]} size={25} weight={650} />
		<Label
			x={704}
			y={58}
			anchor="middle"
			text={irregular
				? 'But this four-sided tile fits'
				: closed
					? 'Repeat the fit'
					: total > 360
						? 'Too many: they overlap'
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
			{#if irregular}
				<clipPath id="tl-quad-floor"><rect width={380} height={300} /></clipPath>
				<g clip-path="url(#tl-quad-floor)">
					{#each quadFloor as q, i (i)}
						<polygon
							points={points(q.tile)}
							fill={q.turned ? ink[1] : ink[0]}
							fill-opacity="0.25"
							stroke="var(--stage-ink)"
							stroke-width="1.2"
						/>
					{/each}
				</g>
				<Label
					x={190}
					y={330}
					anchor="middle"
					text="Four different corners meet at every point"
					size={18}
				/>
			{:else if closed}
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
						fill="var(--tl-bad)"
						fill-opacity="0.22"
						stroke="var(--tl-bad)"
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
					<circle r="5" fill="var(--stage-ink)" />
				</g>
				<Label x={190} y={325} anchor="middle" text="The red space is left uncovered" size={18} />
			{:else}
				<Label x={190} y={145} anchor="middle" text="Tap the orange +" size={21} />
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
					fill={total > 360 && i === tiles.length - 1 ? 'var(--tl-bad)' : ink[i % ink.length]}
					fill-opacity={total > 360 && i === tiles.length - 1 ? 0.5 : 0.28}
					stroke={total > 360 && i === tiles.length - 1 ? 'var(--tl-bad)' : 'var(--stage-ink)'}
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
				<circle r="30" fill="var(--stage-bg)" stroke="var(--tl-accent)" stroke-width="3" />
				<path
					d="M-10 0 H10 M0 -10 V10"
					stroke="var(--tl-accent)"
					stroke-width="4"
					stroke-linecap="round"
				/>
			</g>
		</g>
		<Readout id="corners" label="Around the corner" value={status}
			><Label
				x={245}
				y={510}
				anchor="middle"
				text={status}
				size={20}
				color={total > 360 ? 'var(--tl-bad-text)' : undefined}
			/></Readout
		>
		<Readout id="floor" label="Floor" value={floorStatus}
			><Label x={705} y={510} anchor="middle" text={floorStatus} size={19} /></Readout
		>
		<Readout id="instruction" label="Try it" value={instruction}
			><Label x={480} y={565} anchor="middle" text={instruction} size={17} muted /></Readout
		>
	{/if}
</g>
