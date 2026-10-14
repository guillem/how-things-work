<script lang="ts">
	/**
	 * The pH scale 0–14 with everyday liquids (`liquids.ts`): measured ranges as bars,
	 * computed solutions as dots. The chosen liquid is compared with pure water by a
	 * chain of ×10 arcs, one per whole pH step, so the tenfold steps add up visibly
	 * to the total factor 10^|7 − pH|.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LIQUIDS } from '../liquids';
	import { solvePH } from '../model';
	import { fmtTimes, superscript } from '../look';

	let { params, reduced }: StageProps = $props();

	const NEUTRAL = solvePH({});
	const X0 = 64;
	const X1 = 896;
	const sx = scale([0, 14], [X0, X1]);
	const AXIS = 336;
	const LANE0 = 296;
	const LANE = 34;

	// Greedy lanes: each liquid takes the lowest lane where it does not overlap the
	// previous item's bar and label. Labels go right of the marker (left near the end).
	const items = (() => {
		const ends: number[] = [];
		return LIQUIDS.map((l) => {
			const w = l.name.length * 7.2 + 12;
			const right = sx(l.hi) + w < X1 + 40;
			const x0 = right ? sx(l.lo) - 8 : sx(l.lo) - w - 8;
			const x1 = right ? sx(l.hi) + w : sx(l.hi) + 8;
			let lane = 0;
			while ((ends[lane] ?? -Infinity) > x0) lane++;
			ends[lane] = x1;
			return { ...l, lane, right, y: LANE0 - lane * LANE, mid: (l.lo + l.hi) / 2 };
		});
	})();

	const chosen = $derived(items.find((l) => l.id === String(params.liquid ?? 'lemon')) ?? items[1]);
	const pos = new Tween(
		untrack(() => chosen.mid),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const m = chosen.mid;
		untrack(() => pos.set(m, { duration: reduced ? 0 : 800 }));
	});

	// ×10 arcs from pure water to the chosen liquid.
	const ARC_Y = AXIS + 66;
	const arcs = $derived.by(() => {
		const a = NEUTRAL;
		const b = pos.current;
		const dir = b < a ? -1 : 1;
		const out: { id: number; x0: number; x1: number; whole: boolean }[] = [];
		let p = a;
		let k = 0;
		while (dir * (b - p) > 1e-6 && k < 15) {
			const q = dir * (b - p) >= 1 ? p + dir : b;
			out.push({ id: k, x0: sx(p), x1: sx(q), whole: Math.abs(q - p) > 0.999 });
			p = q;
			k++;
		}
		return out;
	});
	const factor = $derived(10 ** Math.abs(NEUTRAL - chosen.mid));
	const acidic = $derived(chosen.mid < NEUTRAL - 0.02);
	const basic = $derived(chosen.mid > NEUTRAL + 0.02);
	const compare = $derived(
		acidic
			? `${fmtTimes(factor)} times as many H⁺ as pure water`
			: basic
				? `${fmtTimes(factor)} times fewer H⁺ than pure water`
				: 'neutral: as many H⁺ as OH⁻'
	);
	const phText = (l: { lo: number; hi: number }) =>
		l.lo === l.hi ? l.lo.toFixed(l.lo < 10 ? 2 : 1) : `${l.lo.toFixed(1)}–${l.hi.toFixed(1)}`;
	const sideColor = (p: number) =>
		p < NEUTRAL - 0.02
			? 'var(--ab-acid)'
			: p > NEUTRAL + 0.02
				? 'var(--ab-base)'
				: 'var(--stage-ink)';
</script>

<g style:font-variant-numeric="tabular-nums">
	<defs>
		<linearGradient id="scale-band" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="var(--ab-acid)" />
			<stop offset="0.5" stop-color="var(--stage-grid)" />
			<stop offset="1" stop-color="var(--ab-base)" />
		</linearGradient>
	</defs>
	<!-- the band and its ticks -->
	<rect x={X0} y={AXIS} width={X1 - X0} height="12" rx="6" fill="url(#scale-band)" opacity="0.85" />
	<Readout id="ends">
		<Label
			x={X0}
			y={AXIS + 128}
			text="← more acidic"
			size={12}
			weight={600}
			anchor="start"
			color="var(--ab-acid)"
		/>
		<Label
			x={X1}
			y={AXIS + 128}
			text="more basic →"
			size={12}
			weight={600}
			anchor="end"
			color="var(--ab-base)"
		/>
	</Readout>
	{#each Array.from({ length: 15 }, (_, p) => p) as p (p)}
		<line x1={sx(p)} x2={sx(p)} y1={AXIS + 12} y2={AXIS + 17} stroke="var(--stage-line)" />
		<text x={sx(p)} y={AXIS + 31} font-size="13" font-weight="600" text-anchor="middle">{p}</text>
		<text x={sx(p)} y={AXIS + 45} font-size="10" text-anchor="middle" class="muted"
			>{p === 0 ? '1' : `10${superscript(-p)}`}</text
		>
	{/each}
	<Readout id="axis-name">
		<text x={X0 - 8} y={AXIS + 31} font-size="11" text-anchor="end" class="muted">pH</text>
		<text x={X0 - 8} y={AXIS + 45} font-size="10" text-anchor="end" class="muted">H⁺ mol/L</text>
	</Readout>

	<!-- liquids -->
	{#each items as l (l.id)}
		{@const on = l.id === chosen.id}
		{@const c = sideColor(l.mid)}
		<g opacity={on ? 1 : 0.6}>
			<line
				x1={sx(l.mid)}
				x2={sx(l.mid)}
				y1={l.y + 6}
				y2={AXIS - 2}
				stroke={c}
				stroke-dasharray="2 3"
				opacity="0.6"
			/>
			{#if l.measured && l.hi > l.lo}
				<rect
					x={sx(l.lo)}
					y={l.y - 5}
					width={Math.max(4, sx(l.hi) - sx(l.lo))}
					height="10"
					rx="5"
					fill={c}
					opacity={on ? 0.9 : 0.7}
				/>
			{:else if l.measured}
				<rect x={sx(l.lo) - 5} y={l.y - 5} width="10" height="10" rx="5" fill={c} />
			{:else}
				<circle cx={sx(l.lo)} cy={l.y} r="5" fill="var(--stage-bg)" stroke={c} stroke-width="2.4" />
			{/if}
			<Readout id="name-{l.id}">
				<text
					x={l.right ? sx(l.hi) + 10 : sx(l.lo) - 10}
					y={l.y + 4}
					font-size="13"
					font-weight={on ? 700 : 500}
					text-anchor={l.right ? 'start' : 'end'}
					class="halo">{l.name}</text
				>
			</Readout>
		</g>
	{/each}
	<Readout id="legend">
		<g transform="translate({X0} 52)">
			<rect x="0" y="-5" width="22" height="10" rx="5" fill="var(--stage-ink-muted)" />
			<text x="30" y="4" font-size="11" class="muted">measured range</text>
			<circle
				cx="140"
				cy="0"
				r="5"
				fill="var(--stage-bg)"
				stroke="var(--stage-ink-muted)"
				stroke-width="2.4"
			/>
			<text x="152" y="4" font-size="11" class="muted">computed on this page</text>
		</g>
	</Readout>

	<!-- ×10 chain from pure water to the chosen liquid -->
	{#each arcs as a (a.id)}
		{@const mx = (a.x0 + a.x1) / 2}
		{@const h = 8 + 0.25 * Math.abs(a.x1 - a.x0)}
		<path
			d="M{a.x0} {ARC_Y} Q{mx} {ARC_Y + h * 2} {a.x1} {ARC_Y}"
			fill="none"
			stroke={sideColor(chosen.mid)}
			stroke-width="1.6"
		/>
		{#if a.whole}
			<text
				x={mx}
				y={ARC_Y + h + 16}
				font-size="11"
				font-weight="600"
				text-anchor="middle"
				style:fill={sideColor(chosen.mid)}>×10</text
			>
		{/if}
	{/each}
	<circle cx={sx(NEUTRAL)} cy={ARC_Y} r="3.5" fill="var(--stage-ink)" />
	<circle cx={sx(pos.current)} cy={ARC_Y} r="3.5" fill={sideColor(chosen.mid)} />

	<!-- the comparison -->
	<Readout
		id="chosen"
		order={1}
		label={chosen.name}
		value="pH {phText(chosen)}"
		note={chosen.source}
		color={sideColor(chosen.mid)}
	>
		<text x={480} y={512} font-size="17" font-weight="600" text-anchor="middle"
			>{chosen.name}: pH {phText(chosen)}<tspan
				font-size="11"
				font-weight="400"
				class="muted"
				dx="10">{chosen.source}</tspan
			></text
		>
	</Readout>
	<Readout id="factor" order={2} label="Compared with pure water" value={compare}>
		<text
			x={480}
			y={542}
			font-size="15"
			text-anchor="middle"
			style:fill={sideColor(chosen.mid)}
			font-weight="600">{compare}</text
		>
	</Readout>
</g>
