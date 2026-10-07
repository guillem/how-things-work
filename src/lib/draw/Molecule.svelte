<script lang="ts">
	/**
	 * Draws a molecule, energy carrier or particle at (x, y) in the stage's
	 * coordinate system, with an optional label. Simple molecules are drawn as
	 * space-filling "beads"; sugars as a chain of carbon beads (one bead per
	 * carbon, with phosphate groups as orange "P" circles); carriers as pills.
	 * Carbon beads use the theme token `--carbon` (lighter in the dark theme)
	 * so they keep enough contrast on dark compartments.
	 */
	import { colors } from './palette';

	type Kind =
		| 'CO2'
		| 'H2O'
		| 'O2'
		| 'electron'
		| 'proton'
		| 'ATP'
		| 'ADP'
		| 'NADPH'
		| 'NADP+'
		| 'Pi'
		| 'sugar';

	interface Props {
		kind: Kind;
		x?: number;
		y?: number;
		scale?: number;
		/** Number of carbons for `kind="sugar"`. */
		carbons?: number;
		/** Number of phosphate groups for `kind="sugar"`. */
		phosphates?: number;
		/** Draw sugars as a single labelled blob instead of beads. */
		compact?: boolean;
		label?: string;
		labelPosition?: 'below' | 'above' | 'right' | 'left';
		opacity?: number;
		rotate?: number;
		/** Extra glow for particles. */
		glow?: boolean;
	}
	let {
		kind,
		x = 0,
		y = 0,
		scale = 1,
		carbons = 3,
		phosphates = 0,
		compact = false,
		label,
		labelPosition = 'below',
		opacity = 1,
		rotate = 0,
		glow = false
	}: Props = $props();

	const labelOffset = $derived.by(() => {
		const r = kind === 'sugar' ? (compact ? 16 : 10) : 16;
		switch (labelPosition) {
			case 'above':
				return { dx: 0, dy: -r - 4, anchor: 'middle' as const };
			case 'right':
				return { dx: r + 6, dy: 4, anchor: 'start' as const };
			case 'left':
				return { dx: -r - 6, dy: 4, anchor: 'end' as const };
			default:
				return { dx: 0, dy: r + 13, anchor: 'middle' as const };
		}
	});

	const sugarWidth = $derived(carbons * 12 + phosphates * 12);
</script>

<g
	transform="translate({x} {y}) scale({scale})"
	{opacity}
	class="molecule"
	style:pointer-events="none"
>
	<g transform="rotate({rotate})">
		{#if kind === 'CO2'}
			<line x1="-13" y1="0" x2="13" y2="0" stroke={colors.carbonEdge} stroke-width="3" />
			<circle
				cx="-14"
				cy="0"
				r="6.5"
				fill={colors.oxygen}
				stroke={colors.oxygenEdge}
				stroke-width="1"
			/>
			<circle
				cx="14"
				cy="0"
				r="6.5"
				fill={colors.oxygen}
				stroke={colors.oxygenEdge}
				stroke-width="1"
			/>
			<circle
				cx="0"
				cy="0"
				r="7.5"
				fill="var(--carbon)"
				stroke={colors.carbonEdge}
				stroke-width="1"
			/>
		{:else if kind === 'H2O'}
			<circle
				cx="-8.7"
				cy="6.8"
				r="4.5"
				fill={colors.hydrogen}
				stroke={colors.hydrogenEdge}
				stroke-width="1"
			/>
			<circle
				cx="8.7"
				cy="6.8"
				r="4.5"
				fill={colors.hydrogen}
				stroke={colors.hydrogenEdge}
				stroke-width="1"
			/>
			<circle
				cx="0"
				cy="0"
				r="7.5"
				fill={colors.oxygen}
				stroke={colors.oxygenEdge}
				stroke-width="1"
			/>
		{:else if kind === 'O2'}
			<circle
				cx="-6.5"
				cy="0"
				r="7"
				fill={colors.oxygen}
				stroke={colors.oxygenEdge}
				stroke-width="1"
			/>
			<circle
				cx="6.5"
				cy="0"
				r="7"
				fill={colors.oxygen}
				stroke={colors.oxygenEdge}
				stroke-width="1"
			/>
		{:else if kind === 'electron'}
			{#if glow}<circle r="9" fill={colors.electron} opacity="0.25" />{/if}
			<circle r="4.5" fill={colors.electron} stroke={colors.electronEdge} stroke-width="1" />
			<text
				y="2.4"
				text-anchor="middle"
				font-size="7"
				font-weight="700"
				fill="#083344"
				style="stroke: none">−</text
			>
		{:else if kind === 'proton'}
			{#if glow}<circle r="9" fill={colors.proton} opacity="0.25" />{/if}
			<circle r="4.5" fill={colors.proton} stroke={colors.protonEdge} stroke-width="1" />
			<text
				y="2.6"
				text-anchor="middle"
				font-size="7.5"
				font-weight="700"
				fill="#500724"
				style="stroke: none">+</text
			>
		{:else if kind === 'ATP' || kind === 'ADP'}
			{@const full = kind === 'ATP'}
			<rect
				x="-17"
				y="-9"
				width="34"
				height="18"
				rx="9"
				fill={full ? colors.atp : 'var(--stage-bg)'}
				stroke={colors.atp}
				stroke-width={full ? 0 : 1.5}
			/>
			<text
				y="3.6"
				text-anchor="middle"
				font-size="10"
				font-weight="700"
				fill={full ? '#fff' : colors.atp}
				style="stroke: none">{kind}</text
			>
		{:else if kind === 'NADPH' || kind === 'NADP+'}
			{@const full = kind === 'NADPH'}
			<rect
				x="-25"
				y="-9"
				width="50"
				height="18"
				rx="9"
				fill={full ? colors.nadph : 'var(--stage-bg)'}
				stroke={colors.nadph}
				stroke-width={full ? 0 : 1.5}
			/>
			<text
				y="3.6"
				text-anchor="middle"
				font-size="9.5"
				font-weight="700"
				fill={full ? '#fff' : colors.nadph}
				style="stroke: none">{kind}</text
			>
		{:else if kind === 'Pi'}
			<circle r="7" fill={colors.phosphate} stroke={colors.phosphateEdge} stroke-width="1" />
			<text
				y="3.2"
				text-anchor="middle"
				font-size="8.5"
				font-weight="700"
				fill="#fff"
				style="stroke: none">P</text
			>
		{:else if kind === 'sugar'}
			{#if compact}
				<rect
					x="-18"
					y="-10"
					width="36"
					height="20"
					rx="10"
					fill={colors.sugar}
					stroke={colors.sugarEdge}
					stroke-width="1"
				/>
				<text
					y="3.6"
					text-anchor="middle"
					font-size="9.5"
					font-weight="700"
					fill="#fff"
					style="stroke: none">{carbons}C</text
				>
			{:else}
				{@const start = -sugarWidth / 2 + 6}
				<line
					x1={start}
					y1="0"
					x2={start + (carbons - 1) * 12}
					y2="0"
					stroke={colors.carbonEdge}
					stroke-width="2.5"
				/>
				{#each Array.from({ length: carbons }, (_, i) => i) as i (i)}
					<circle
						cx={start + i * 12}
						cy="0"
						r="6"
						fill="var(--carbon)"
						stroke={colors.carbonEdge}
						stroke-width="1"
					/>
				{/each}
				{#each Array.from({ length: phosphates }, (_, i) => i) as i (i)}
					{@const px = i === 0 ? start - 12 : start + carbons * 12}
					<line
						x1={i === 0 ? start : start + (carbons - 1) * 12}
						y1="0"
						x2={px}
						y2="0"
						stroke={colors.phosphateEdge}
						stroke-width="2"
					/>
					<circle
						cx={px}
						cy="0"
						r="5.5"
						fill={colors.phosphate}
						stroke={colors.phosphateEdge}
						stroke-width="1"
					/>
					<text
						x={px}
						y="2.6"
						text-anchor="middle"
						font-size="7"
						font-weight="700"
						fill="#fff"
						style="stroke: none">P</text
					>
				{/each}
			{/if}
		{/if}
	</g>
	{#if label}
		<text
			class="halo"
			x={labelOffset.dx}
			y={labelOffset.dy}
			text-anchor={labelOffset.anchor}
			font-size="12"
			font-weight="500"
		>
			{label}
		</text>
	{/if}
</g>
