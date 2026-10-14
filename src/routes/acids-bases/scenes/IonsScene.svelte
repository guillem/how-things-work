<script lang="ts">
	/**
	 * The zoomed view: a cube of water 1 µm on a side, with its H⁺ (H₃O⁺) and OH⁻ ions
	 * drawn as dots, beside a ladder of the whole pH scale with the counts at each step.
	 *
	 * Counts are the model's averages: N = [ion] × Avogadro × 10⁻¹⁵ L. Above 1 200 of a
	 * kind, one dot stands for 10ᵏ ions (the same k for both kinds, stated on the
	 * stage), so the drawing stays within a few thousand dots, each kind drawn as one
	 * <path>. Dot positions are fixed pseudo-random spots; a subset jiggles with t.
	 * On the `water` step (hint `fixed`) the ions flicker in and out at random spots,
	 * pairs forming and recombining, while the count stays the same.
	 */
	import { Label, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ionsInCube, solvePH, WATER_IN_CUBE } from '../model';
	import { fmtCount, rng, superscript } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const NEUTRAL = solvePH({});
	const fixed = $derived(step.hints?.fixed !== undefined);
	const phParam = $derived(step.id === 'bases' ? 'phBase' : 'ph');
	const ph = $derived(fixed ? NEUTRAL : Number(params[phParam] ?? 7));
	const counts = $derived(ionsInCube(ph));
	const focusOH = $derived(step.id === 'bases');

	// ---- the cube ------------------------------------------------------------------------
	const BX = 56;
	const BY = 100;
	const BS = 372;
	const MAXDOTS = 1200;
	const R = 3.2;
	const k = $derived(Math.max(0, Math.ceil(Math.log10(Math.max(counts.h, counts.oh) / MAXDOTS))));
	const per = $derived(10 ** k);
	const nH = $derived(Math.min(MAXDOTS, Math.floor(counts.h / per)));
	const nOH = $derived(Math.min(MAXDOTS, Math.floor(counts.oh / per)));

	// Fixed spots for each kind (separate streams so the two never share a spot).
	function spots(seed: number) {
		const r = rng(seed);
		return Array.from({ length: MAXDOTS }, () => ({
			x: BX + 8 + r() * (BS - 16),
			y: BY + 8 + r() * (BS - 16),
			w: 0.6 + r() * 0.9,
			p: r() * Math.PI * 2
		}));
	}
	const SPOTS_H = spots(11);
	const SPOTS_OH = spots(29);
	const JIGGLE = 240; // the first dots jiggle; the rest are drawn once per count change

	const circle = (x: number, y: number) =>
		`M${(x - R).toFixed(1)} ${y.toFixed(1)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`;
	function still(list: typeof SPOTS_H, n: number) {
		let d = '';
		for (let i = JIGGLE; i < n; i++) d += circle(list[i].x, list[i].y);
		return d;
	}
	const stillH = $derived(still(SPOTS_H, nH));
	const stillOH = $derived(still(SPOTS_OH, nOH));
	function moving(list: typeof SPOTS_H, n: number, time: number) {
		let d = '';
		for (let i = 0; i < Math.min(n, JIGGLE); i++) {
			const s = list[i];
			d += circle(
				s.x + 3 * Math.sin(time * s.w * 2.1 + s.p),
				s.y + 3 * Math.cos(time * s.w * 1.7 + s.p * 1.3)
			);
		}
		return d;
	}
	const movH = $derived(fixed ? '' : moving(SPOTS_H, nH, t));
	const movOH = $derived(fixed ? '' : moving(SPOTS_OH, nOH, t));

	// Water step: each of the ~60 pairs lives for a few seconds at one spot, then
	// recombines and a new pair forms elsewhere (spot chosen by the life number).
	const LIFE = 4;
	const flicker = $derived.by(() => {
		if (!fixed) return [];
		const out: { id: number; hx: number; hy: number; ox: number; oy: number; o: number }[] = [];
		const n = Math.round(counts.h);
		for (let i = 0; i < n; i++) {
			const off = (i * 0.618) % 1;
			const life = Math.floor(t / LIFE + off);
			const u = reduced ? 0.5 : cycle(t, LIFE, -off * LIFE);
			const r = rng(1000 + i * 97 + life * 7919);
			const x = BX + 14 + r() * (BS - 28);
			const y = BY + 14 + r() * (BS - 28);
			// The pair forms together and drifts apart; the two ions are drawn apart.
			const a = r() * Math.PI * 2;
			const sep = 8 + 26 * smoothstep(0, 0.3, u);
			const o = smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u));
			out.push({
				id: i,
				hx: x + Math.cos(a) * sep * 0.5,
				hy: y + Math.sin(a) * sep * 0.5,
				ox: x - Math.cos(a) * sep * 0.5,
				oy: y - Math.sin(a) * sep * 0.5,
				o
			});
		}
		return out;
	});

	// ---- the ladder ------------------------------------------------------------------------
	const LX = 492;
	const LY = 112;
	const ROW = 27;
	const rows = Array.from({ length: 15 }, (_, p) => ({ p, ...ionsInCube(p) }));
	const rowY = (p: number) => LY + p * ROW;
	const markY = $derived(rowY(Math.min(14, Math.max(0, ph))));
	const COL_P = LX + 26;
	const COL_C = LX + 96;
	const COL_H = LX + 292;
	const COL_OH = LX + 420;

	const kind = $derived(
		Math.abs(ph - NEUTRAL) < 0.05 ? 'neutral' : ph < NEUTRAL ? 'acidic' : 'basic'
	);
	const kindColor = $derived(
		kind === 'neutral'
			? 'var(--stage-ink)'
			: kind === 'acidic'
				? 'var(--ab-acid)'
				: 'var(--ab-base)'
	);
	const dotNote = $derived(k === 0 ? 'each dot is one ion' : `each dot is ${fmtCount(per)} ions`);
	const avg = (n: number) => (n < 1 && n > 0 ? ' on average' : '');
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- title and header -->
	<Readout
		id="ph"
		order={1}
		label="pH"
		value="{ph.toFixed(fixed ? 2 : 1)} · {kind}"
		color={kindColor}
	>
		<text x={BX} y={52} font-size="16" font-weight="600"
			>pH {ph.toFixed(fixed ? 2 : 1)}<tspan dx="10" style:fill={kindColor}>{kind}</tspan></text
		>
	</Readout>
	<Readout id="cube" order={9} label="The cube" value="1 µm across" note="10⁻¹⁵ litre">
		<Label
			x={BX + BS}
			y={52}
			text="a cube of water 1 µm across (10⁻¹⁵ L)"
			size={12}
			anchor="end"
			muted
		/>
	</Readout>

	<!-- the cube -->
	<rect
		x={BX}
		y={BY - 14}
		width={BS}
		height={BS + 14}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<rect
		x={BX}
		y={BY - 14}
		width={BS}
		height={BS + 14}
		rx="10"
		fill="var(--ab-liquid)"
		opacity="0.6"
	/>
	{#if fixed}
		{#each flicker as f (f.id)}
			<g opacity={f.o}>
				<line
					x1={f.hx}
					y1={f.hy}
					x2={f.ox}
					y2={f.oy}
					stroke="var(--stage-line)"
					stroke-dasharray="2 3"
				/>
				<circle cx={f.hx} cy={f.hy} r={R + 0.6} fill="var(--ab-h)" />
				<circle cx={f.ox} cy={f.oy} r={R + 0.6} fill="var(--ab-oh)" />
			</g>
		{/each}
	{:else}
		<g opacity={focusOH ? 0.75 : 1}>
			<path d={stillH} fill="var(--ab-h)" />
			<path d={movH} fill="var(--ab-h)" />
		</g>
		<g opacity={focusOH ? 1 : 0.75}>
			<path d={stillOH} fill="var(--ab-oh)" />
			<path d={movOH} fill="var(--ab-oh)" />
		</g>
	{/if}

	<!-- counts under the cube -->
	<Readout
		id="nh"
		order={2}
		label="H⁺ in the cube"
		value="{fmtCount(counts.h)}{avg(counts.h)}"
		color="var(--ab-h)"
	>
		<circle cx={BX + 6} cy={BY + BS + 26} r="5" fill="var(--ab-h)" />
		<text x={BX + 18} y={BY + BS + 31} font-size="14" font-weight={focusOH ? 400 : 600}
			>H⁺ (H₃O⁺): {fmtCount(counts.h)}{avg(counts.h)}</text
		>
	</Readout>
	<Readout
		id="noh"
		order={3}
		label="OH⁻ in the cube"
		value="{fmtCount(counts.oh)}{avg(counts.oh)}"
		color="var(--ab-oh)"
	>
		<circle cx={BX + 6} cy={BY + BS + 50} r="5" fill="var(--ab-oh)" />
		<text x={BX + 18} y={BY + BS + 55} font-size="14" font-weight={focusOH ? 600 : 400}
			>OH⁻: {fmtCount(counts.oh)}{avg(counts.oh)}</text
		>
	</Readout>
	<Readout id="dots" order={4} label="Drawing" value={dotNote}>
		<Label x={BX + BS} y={BY + BS + 31} text={dotNote} size={12} anchor="end" muted />
	</Readout>
	<Readout id="water">
		<Label
			x={BX + BS}
			y={BY + BS + 55}
			text="+ {fmtCount(WATER_IN_CUBE)} H₂O, not drawn"
			size={12}
			anchor="end"
			muted
		/>
	</Readout>

	<!-- the ladder: every whole pH, with the count of each ion in the cube -->
	<Readout id="ladder">
		<g>
			<text x={COL_P} y={LY - 30} font-size="12" font-weight="600" text-anchor="middle">pH</text>
			<text x={COL_C} y={LY - 30} font-size="12" font-weight="600">H⁺ per litre</text>
			<text x={COL_H} y={LY - 30} font-size="12" font-weight="600" text-anchor="end"
				>H⁺ in the cube</text
			>
			<text x={COL_OH} y={LY - 30} font-size="12" font-weight="600" text-anchor="end"
				>OH⁻ in the cube</text
			>
			<text x={COL_C} y={LY - 16} font-size="11" class="muted">mol/L</text>
			<rect
				x={LX}
				y={markY - ROW / 2}
				width={COL_OH - LX + 10}
				height={ROW}
				rx="6"
				fill={kindColor}
				opacity="0.14"
			/>
			<rect
				x={LX}
				y={markY - ROW / 2}
				width={COL_OH - LX + 10}
				height={ROW}
				rx="6"
				fill="none"
				stroke={kindColor}
				stroke-width="1.5"
			/>
			{#each rows as r (r.p)}
				{@const y = rowY(r.p) + 4}
				<text
					x={COL_P}
					{y}
					font-size="13"
					font-weight="600"
					text-anchor="middle"
					style:fill={r.p < 7 ? 'var(--ab-acid)' : r.p > 7 ? 'var(--ab-base)' : 'var(--stage-ink)'}
					>{r.p}</text
				>
				<text x={COL_C} {y} font-size="12" class="muted"
					>{r.p === 0 ? '1' : `10${superscript(-r.p)}`}</text
				>
				<text
					x={COL_H}
					{y}
					font-size="12"
					text-anchor="end"
					opacity={focusOH ? 0.75 : 1}
					style:fill="var(--ab-h)">{fmtCount(r.h)}</text
				>
				<text
					x={COL_OH}
					{y}
					font-size="12"
					text-anchor="end"
					opacity={focusOH ? 1 : 0.75}
					style:fill="var(--ab-oh)">{fmtCount(r.oh)}</text
				>
			{/each}
			<text x={COL_P + 18} y={rowY(7) + 4} font-size="11" class="muted">neutral</text>
			<!-- each step is ten times -->
			<path
				d="M{LX - 8} {rowY(13)} V{rowY(1)}"
				stroke="var(--ab-acid)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
				fill="none"
			/>
			<Label
				x={LX - 16}
				y={(rowY(1) + rowY(13)) / 2}
				text="each step toward pH 0: ×10 H⁺"
				size={12}
				weight={600}
				rotate={-90}
				color="var(--ab-acid)"
			/>
		</g>
	</Readout>
</g>
