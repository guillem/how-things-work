<script lang="ts">
	/**
	 * The body as one well-mixed tank of volume V, on the same level scale as the chart beside it:
	 * the water line is the blood level at the cursor. Tablets wait in the gut above it and drip
	 * in; an injection or a drip pours in from the top; the drain at the bottom runs at
	 * clearance × level (its drops come faster and thicker as the level rises).
	 */
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { C, L } from './shared';

	interface Props {
		/** y of the water surface. */
		surface: number;
		/** Width relative to the drug's usual volume (1: the usual tank). */
		widthScale?: number;
		/** Share of a usual dose still in the gut (0: none, no gut drawn when null). */
		gut: number | null;
		/** Something is flowing in from a vein (an injection being given, or a drip). */
		pouring: boolean;
		/** Removal rate as a share of the chart's highest (0–1). */
		drain: number;
		volumeText: string;
		clearanceText: string;
		/** The half-life, when it is one number. */
		halfText?: string | null;
		t: number;
		reduced: boolean;
	}
	let {
		surface,
		widthScale = 1,
		gut,
		pouring,
		drain,
		volumeText,
		clearanceText,
		halfText = null,
		t,
		reduced
	}: Props = $props();

	const cx = L.TX + L.TW / 2;
	const w = $derived(Math.min(200, L.TW * Math.sqrt(widthScale)));
	const x0 = $derived(cx - w / 2);
	const top = L.PY1 + 30;
	const bottom = L.PY0;
	/** The gut sits above the tank's left side, its stream entering there. */
	const gx = $derived(x0 + 22);
	const water = $derived(Math.max(top, Math.min(bottom, surface)));

	const drops = [0, 1, 2, 3];
	const dropAt = (i: number) => {
		const u = reduced ? (i + 0.5) / drops.length : cycle(t, 1.1, i / drops.length);
		return { y: bottom + 8 + u * 46, o: (1 - u) * Math.min(1, drain * 1.6) };
	};
	const pills = $derived(gut === null ? 0 : Math.min(6, Math.ceil(gut * 6 - 1e-6)));
</script>

<g>
	<!-- the gut: tablets waiting to be absorbed -->
	{#if gut !== null}
		<rect
			x={gx - 50}
			y={L.PY1 - 46}
			width="100"
			height="30"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each Array.from({ length: pills }, (_, i) => i) as i (i)}
			<rect
				x={gx - 42 + i * 14}
				y={L.PY1 - 35}
				width="11"
				height="8"
				rx="4"
				fill={C.tablet}
				opacity={i === pills - 1 ? Math.max(0.35, gut * 6 - (pills - 1)) : 1}
			/>
		{/each}
		<Readout id="gut">
			<Label x={gx - 58} y={L.PY1 - 26} anchor="end" text="gut" size={11} muted />
		</Readout>
		<line
			x1={gx}
			x2={gx}
			y1={L.PY1 - 16}
			y2={top - 4}
			stroke={C.tablet}
			stroke-width={1 + 3 * Math.min(1, gut ?? 0)}
			opacity={gut && gut > 0.01 ? 0.8 : 0.15}
			stroke-linecap="round"
		/>
	{/if}
	{#if pouring}
		<line
			x1={x0 + w - 18}
			x2={x0 + w - 18}
			y1={top - 26}
			y2={water}
			stroke={C.inject}
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.85"
		/>
	{/if}

	<!-- the tank -->
	<rect x={x0} y={water} width={w} height={bottom - water} fill={C.water} opacity="0.85" />
	<path
		d="M{x0} {top} V{bottom} H{x0 + w} V{top}"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-linejoin="round"
	/>
	<!-- the drain -->
	<path
		d="M{cx - 6} {bottom} V{bottom + 8} M{cx + 6} {bottom} V{bottom + 8}"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	{#each drops as i (i)}
		{@const p = dropAt(i)}
		<circle {cx} cy={p.y} r={2 + 2.5 * Math.min(1, drain)} fill={C.water} opacity={p.o} />
	{/each}

	<Readout id="tank-v">
		<Label x={cx - 14} y={bottom + 28} anchor="end" text="body" size={12} weight={600} />
		<Label x={cx - 14} y={bottom + 43} anchor="end" text="V = {volumeText}" size={11} muted />
		{#if halfText}
			<Label x={cx - 14} y={bottom + 58} anchor="end" text="t½ = {halfText}" size={11} muted />
		{/if}
	</Readout>
	<Readout id="tank-cl">
		<Label x={cx + 14} y={bottom + 28} anchor="start" text="removed:" size={11} muted />
		<Label x={cx + 14} y={bottom + 43} anchor="start" text="CL × level" size={11} muted />
		<Label x={cx + 14} y={bottom + 58} anchor="start" text="CL = {clearanceText}" size={11} muted />
	</Readout>
</g>
