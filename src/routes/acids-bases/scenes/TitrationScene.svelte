<script lang="ts">
	/**
	 * A titration: a burette of 0.1 mol/L NaOH above a flask of 25 mL of 0.1 mol/L
	 * acid with an indicator, beside the pH curve plotted up to the volume added.
	 *
	 * Every pH comes from `titrationPH` (exact charge balance); the equivalence volume
	 * from stoichiometry (`equivalenceVolume`), never from where the pH crosses 7.
	 * The solution's colour mixes the indicator's two forms by the share its pKIn sets.
	 *
	 * Modes (`step.hints.mode`):
	 *   auto   — the base runs in by itself, a pure function of t (fast, slow near the
	 *            equivalence point, fast again), then the picture holds
	 *   full   — the whole curve at once (no burette motion)
	 *   manual — the volume is the control `hints.vol`; the "Add a drop" / "Add 1 mL" /
	 *            "Empty the flask" buttons change it with setParam. The drawn volume
	 *            follows it with a short Tween (wall-clock, sanctioned: the drops in
	 *            flight while the flask catches up), and drops fall only while it moves.
	 * Focus (`hints.focus`): curve, jump (the last-drops panel), indicator / choose (the
	 * indicator's band and where its colour changed), buffer (the strong-acid curve
	 * for comparison and the half-way point pH = pKa), equivalence (both markers).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Axes, Label, clamp, cycle, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import type { RangeControl } from '#lib/explainer/types.ts';
	import {
		ACIDS,
		DROP,
		INDICATORS,
		equivalenceVolume,
		indicatorBase,
		indicatorColor,
		ionsInCube,
		standard,
		titrationCurve,
		titrationPH,
		type AcidId,
		type IndicatorId
	} from '../model';
	import { fmtCount, ml } from '../look';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const VMAX = 50;
	const mode = $derived(String(step.hints?.mode ?? 'auto'));
	const focus = $derived(String(step.hints?.focus ?? 'curve'));
	const acidId = $derived(
		String(step.hints?.acid ?? params[String(step.hints?.acidParam ?? '')] ?? 'hcl') as AcidId
	);
	const acid = $derived(ACIDS[acidId] ?? ACIDS.hcl);
	const indId = $derived(
		String(
			step.hints?.indicator ?? params[String(step.hints?.indicatorParam ?? '')] ?? 'phenolphthalein'
		) as IndicatorId
	);
	const ind = $derived(INDICATORS[indId] ?? INDICATORS.phenolphthalein);
	const T = $derived(standard(acid));
	const veq = $derived(equivalenceVolume(T));
	const curve = $derived(titrationCurve(T, VMAX));
	const strongCurve = titrationCurve(standard(ACIDS.hcl), VMAX);

	// ---- the volume ------------------------------------------------------------------------
	const volId = $derived(String(step.hints?.vol ?? ''));
	const volControl = $derived(
		step.controls?.find((c): c is RangeControl => c.type === 'range' && c.id === volId)
	);
	const target = $derived(
		mode === 'manual' ? Number(params[volId] ?? volControl?.default ?? 0) : 0
	);
	const shown = new Tween(
		untrack(() => target),
		{ duration: 0 }
	);
	let lastStep = '';
	$effect(() => {
		const v = target;
		const id = step.id;
		untrack(() => {
			const d = Math.abs(v - shown.current);
			// A newly opened step jumps; within a step the flask catches up drop by drop.
			const fresh = id !== lastStep;
			lastStep = id;
			const duration = reduced || fresh ? 0 : clamp(250 + d * 70, 250, 1600);
			void shown.set(v, { duration, easing: cubicOut });
		});
	});

	// Auto mode: 0 → 22 mL in 6 s, 22 → 28 mL in 7 s, 28 → 50 mL in 5 s.
	const LEAD = 0.8;
	function autoVolume(time: number) {
		const s = time - LEAD;
		if (s <= 0) return 0;
		if (s < 6) return (22 * s) / 6;
		if (s < 13) return 22 + (6 * (s - 6)) / 7;
		if (s < 18) return 28 + (22 * (s - 13)) / 5;
		return VMAX;
	}
	const vb = $derived(
		mode === 'full' ? VMAX : mode === 'auto' ? (reduced ? VMAX : autoVolume(t)) : shown.current
	);
	const flowing = $derived(
		!reduced &&
			(mode === 'auto' ? t > LEAD && vb < VMAX : mode === 'manual' && Math.abs(target - vb) > 0.002)
	);
	const ph = $derived(titrationPH(T, vb));
	const color = $derived(indicatorColor(ind, ph));

	// Action buttons: apply the presses since the last counts seen.
	const counts = $derived({
		drop: Number(params.drop ?? 0),
		ml: Number(params.ml ?? 0),
		restart: Number(params.restart ?? 0)
	});
	let seen: { drop: number; ml: number; restart: number } | null = null;
	$effect(() => {
		const c = counts;
		untrack(() => {
			if (!seen || !volControl) {
				seen = { ...c };
				return;
			}
			let v = target;
			if (c.restart > seen.restart) v = volControl.min;
			v += (c.drop - seen.drop) * DROP + (c.ml - seen.ml) * 1;
			const changed = c.drop !== seen.drop || c.ml !== seen.ml || c.restart !== seen.restart;
			seen = { ...c };
			if (changed) setParam(volId, Number(clamp(v, volControl.min, volControl.max).toFixed(2)));
		});
	});

	// ---- the plot -----------------------------------------------------------------------------
	const PX0 = 400;
	const PX1 = 920;
	const PY0 = 104;
	const PY1 = 470;
	const sx = scale([0, VMAX], [PX0, PX1]);
	const sy = scale([0, 14], [PY1, PY0]);
	const drawn = $derived.by(() => {
		const out = curve.filter((p) => p.v < vb);
		out.push({ v: vb, ph });
		return out;
	});
	const curveColor = $derived(
		acid.id === 'hcl'
			? 'var(--ab-strong)'
			: acid.id === 'acetic'
				? 'var(--ab-weak)'
				: 'var(--ab-weaker)'
	);
	const eqPH = $derived(titrationPH(T, veq));
	const reachedEq = $derived(vb >= veq - 1e-6);
	const eqShow = $derived(focus === 'equivalence' || mode === 'full' || reachedEq ? 1 : 0);
	const halfShow = $derived(focus === 'buffer' && acid.pKa !== null && vb >= veq / 2 ? 1 : 0);
	const showBand = $derived(focus === 'indicator' || focus === 'choose');
	const compare = $derived(focus === 'buffer' || (focus === 'equivalence' && acid.id !== 'hcl'));

	// Where the indicator's colour changed (half its molecules switched: pH = pKIn).
	const vChange = $derived.by(() => {
		const k = curve.findIndex((p) => p.ph >= ind.pKIn);
		if (k <= 0) return k === 0 ? 0 : NaN;
		let lo = curve[k - 1].v;
		let hi = curve[k].v;
		for (let i = 0; i < 40; i++) {
			const mid = (lo + hi) / 2;
			if (titrationPH(T, mid) >= ind.pKIn) hi = mid;
			else lo = mid;
		}
		return hi;
	});
	const changedShow = $derived(showBand && Number.isFinite(vChange) && vb >= vChange ? 1 : 0);

	// ---- the last drops (jump focus) ------------------------------------------------------------
	const IX = 410;
	const IY = 112;
	const IW = 236;
	const IH = 204;
	const lastDrops = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const k = i - 3;
			const v = veq + k * DROP;
			return {
				k,
				v,
				ph: titrationPH(T, v),
				done: vb >= v - 1e-6
			};
		})
	);

	// ---- apparatus ----------------------------------------------------------------------------------
	const BUR_X = 150;
	const BUR_TOP = 64;
	const BUR_BOT = 330;
	const burY = (v: number) => BUR_TOP + 6 + (v / VMAX) * (BUR_BOT - BUR_TOP - 6);
	const TIP = 372;
	const FLASK = 'M128 404 V440 L58 548 Q52 562 68 562 H232 Q248 562 242 548 L172 440 V404 Z';
	const level = $derived(520 - (vb / VMAX) * 66);
	const DROP_PERIOD = 0.3;
	const dropU = $derived(cycle(t, DROP_PERIOD));
	const dropY = $derived(TIP + 6 + dropU * (level - TIP - 10));

	const status = $derived.by(() => {
		if (Math.abs(vb - veq) < DROP / 2)
			return { text: 'equivalence: the base matches the acid', color: 'var(--stage-ink)' };
		if (vb < veq) {
			const left = 1 - vb / veq;
			const pct = left * 100;
			return {
				text: `acid left: ${pct >= 9.95 ? Math.round(pct) : pct >= 0.95 ? pct.toFixed(1) : pct.toFixed(2)} %`,
				color: 'var(--ab-acid)'
			};
		}
		return { text: `base in excess: ${ml(vb - veq)}`, color: 'var(--ab-base)' };
	});
	const hText = $derived(fmtCount(ionsInCube(ph).h));
	const flaskText = $derived(`25 mL ${acid.formula} + ${ind.name}`);
	const colourName = $derived.by(() => {
		const f = indicatorBase(ind, ph);
		if (f < 0.1) return ind.acidName;
		if (f > 0.9) return ind.baseName;
		return `${ind.acidName} → ${ind.baseName}`;
	});
	const liquidOpacity = $derived(0.15 + 0.75 * color.alpha);
</script>

{#snippet tint(
	x: number,
	y: number,
	text: string,
	fill: string,
	size: number,
	anchor: 'start' | 'middle' | 'end',
	weight = 600
)}
	<text {x} {y} class="halo" text-anchor={anchor} font-size={size} font-weight={weight} style:fill
		>{text}</text
	>
{/snippet}

<g style:font-variant-numeric="tabular-nums">
	<clipPath id="titration-flask"><path d={FLASK} /></clipPath>

	<!-- readouts -->
	<Readout id="vol" order={1} label="NaOH added" value={ml(vb)}>
		<text x={PX0} y={32} font-size="12" class="muted">NaOH added</text>
		<text x={PX0} y={54} font-size="18" font-weight="600">{ml(vb)}</text>
	</Readout>
	<Readout id="ph" order={2} label="pH" value={ph.toFixed(2)} color={curveColor}>
		<text x={PX0 + 150} y={32} font-size="12" class="muted">pH</text>
		<text x={PX0 + 150} y={54} font-size="18" font-weight="600" style:fill={curveColor}
			>{ph.toFixed(2)}</text
		>
	</Readout>
	<Readout id="h" order={4} label="H⁺ in a 1 µm cube" value={hText}>
		<text x={PX0 + 230} y={32} font-size="12" class="muted">H⁺ in a 1 µm cube</text>
		<text x={PX0 + 230} y={54} font-size="15" font-weight="600">{hText}</text>
	</Readout>
	<Readout id="status" order={3} label="In the flask" value={status.text} color={status.color}>
		{@render tint(PX1, 54, status.text, status.color, 13, 'end')}
	</Readout>

	<!-- plot -->
	<Axes
		{sx}
		{sy}
		xLabel="NaOH added (mL)"
		yLabel="pH"
		xTicks={[0, 10, 20, 25, 30, 40, 50]}
		yTicks={[0, 2, 4, 6, 7, 8, 10, 12, 14]}
	/>
	<line
		x1={PX0}
		x2={PX1}
		y1={sy(7)}
		y2={sy(7)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="6 4"
	/>
	<Readout id="neutral">
		<Label x={PX1 - 4} y={sy(7) - 6} text="pH 7: neutral" size={11} anchor="end" muted />
	</Readout>

	{#if showBand}
		<rect
			x={PX0}
			y={sy(ind.range[1])}
			width={PX1 - PX0}
			height={sy(ind.range[0]) - sy(ind.range[1])}
			fill={indicatorColor(ind, ind.range[1]).rgb}
			opacity="0.16"
		/>
		<Readout
			id="band"
			order={5}
			label="{ind.name} changes"
			value="pH {ind.range[0]}–{ind.range[1]}"
		>
			{@render tint(
				PX0 + 6,
				sy(ind.range[1]) - 5,
				`${ind.name} changes colour: pH ${ind.range[0]}–${ind.range[1]}`,
				'var(--stage-ink)',
				11,
				'start',
				500
			)}
		</Readout>
	{/if}

	{#if compare}
		<path
			d={linePath(
				strongCurve,
				(p) => p.v,
				(p) => p.ph,
				sx,
				sy
			)}
			fill="none"
			stroke="var(--ab-strong)"
			stroke-width="1.6"
			opacity="0.35"
		/>
		<Readout id="compare" order={8} label="faint: hydrochloric acid" color="var(--ab-strong)">
			{@render tint(sx(31), sy(4.2), 'hydrochloric acid', 'var(--ab-strong)', 11, 'start', 500)}
		</Readout>
	{/if}

	<path
		d={linePath(
			drawn,
			(p) => p.v,
			(p) => p.ph,
			sx,
			sy
		)}
		fill="none"
		stroke={curveColor}
		stroke-width="2.6"
		stroke-linejoin="round"
	/>
	<circle cx={sx(vb)} cy={sy(ph)} r="4.5" fill={curveColor} />

	<!-- equivalence -->
	{#if eqShow > 0}
		<g opacity={eqShow}>
			<line
				x1={sx(veq)}
				x2={sx(veq)}
				y1={PY0}
				y2={PY1}
				stroke="var(--stage-ink)"
				stroke-dasharray="3 4"
				opacity="0.6"
			/>
			<circle
				cx={sx(veq)}
				cy={sy(eqPH)}
				r="6"
				fill="var(--stage-bg)"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<Readout id="eq" order={6} label="Equivalence" value="{ml(veq)} · pH {eqPH.toFixed(2)}">
				{@render tint(
					sx(veq) + 10,
					sy(eqPH) + 4,
					`equivalence: pH ${eqPH.toFixed(2)}`,
					'var(--stage-ink)',
					13,
					'start'
				)}
			</Readout>
		</g>
	{/if}
	{#if focus === 'equivalence' && acid.id !== 'hcl'}
		<circle
			cx={sx(veq)}
			cy={sy(7)}
			r="4.5"
			fill="var(--stage-bg)"
			stroke="var(--ab-strong)"
			stroke-width="2"
			opacity="0.7"
		/>
		<Readout
			id="eq-strong"
			order={7}
			label="HCl's equivalence"
			value="pH 7.00"
			color="var(--ab-strong)"
		>
			{@render tint(sx(veq) - 10, sy(7) + 16, 'HCl: pH 7.00', 'var(--ab-strong)', 11, 'end', 500)}
		</Readout>
	{/if}
	{#if halfShow > 0}
		{@const hp = titrationPH(T, veq / 2)}
		<circle
			cx={sx(veq / 2)}
			cy={sy(hp)}
			r="5"
			fill="var(--stage-bg)"
			stroke={curveColor}
			stroke-width="2"
		/>
		<Readout id="half" order={7} label="Half-way" value="pH {hp.toFixed(2)} = pKa">
			{@render tint(
				sx(veq / 2),
				sy(hp) + 30,
				`half-way: pH ${hp.toFixed(2)} = pKa`,
				curveColor,
				12,
				'middle'
			)}
		</Readout>
		<Readout id="buffer">
			{@render tint(
				sx(veq / 2),
				sy(hp) + 46,
				'buffer region: the pH barely moves',
				'var(--stage-ink-muted)',
				11,
				'middle',
				500
			)}
		</Readout>
	{/if}
	{#if changedShow > 0}
		<line
			x1={sx(vChange)}
			x2={sx(vChange)}
			y1={sy(ind.pKIn)}
			y2={PY1}
			stroke={indicatorColor(ind, 14).rgb}
			stroke-width="2"
		/>
		<Readout id="changed" order={6} label="Colour changed at" value={ml(vChange)}>
			{@render tint(
				sx(vChange) + (vChange > 40 ? -6 : 6),
				PY1 - 10,
				`colour changed at ${ml(vChange)}`,
				'var(--stage-ink)',
				12,
				vChange > 40 ? 'end' : 'start'
			)}
		</Readout>
	{/if}

	<!-- the last drops: one row per drop, its pH as a bar -->
	{#if focus === 'jump'}
		<rect
			x={IX}
			y={IY}
			width={IW}
			height={IH}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout id="drops-title">
			<text x={IX + 12} y={IY + 20} font-size="12" font-weight="600"
				>the last drops, 0.05 mL each</text
			>
			<text x={IX + 12} y={IY + 38} font-size="10" class="muted">NaOH added</text>
			<text x={IX + 98} y={IY + 38} font-size="10" class="muted" text-anchor="end">pH</text>
		</Readout>
		{#each lastDrops as d, i (d.k)}
			{@const y = IY + 58 + i * 21}
			<g opacity={d.done ? 1 : 0.4}>
				<rect
					x={IX + 108}
					y={y - 9}
					width={(d.ph / 14) * (IW - 120)}
					height="12"
					rx="3"
					fill={curveColor}
					opacity={d.k === 0 ? 1 : 0.75}
				/>
				<Readout id="drop-{d.k}">
					<text x={IX + 12} y={y + 1} font-size="11" font-weight={d.k === 0 ? 700 : 400}
						>{ml(d.v)}</text
					>
					<text
						x={IX + 98}
						y={y + 1}
						font-size="11"
						font-weight={d.k === 0 ? 700 : 600}
						text-anchor="end">{d.ph.toFixed(1)}</text
					>
				</Readout>
			</g>
		{/each}
	{/if}

	<!-- burette -->
	<rect
		x={BUR_X - 12}
		y={BUR_TOP}
		width="24"
		height={BUR_BOT - BUR_TOP}
		rx="4"
		fill="var(--surface)"
		stroke="var(--ab-glass)"
	/>
	<rect
		x={BUR_X - 10}
		y={burY(vb)}
		width="20"
		height={Math.max(0, BUR_BOT - burY(vb) - 2)}
		fill="var(--ab-liquid)"
	/>
	<line
		x1={BUR_X - 10}
		x2={BUR_X + 10}
		y1={burY(vb)}
		y2={burY(vb)}
		stroke="var(--ab-base)"
		stroke-width="1.5"
	/>
	{#each [0, 10, 20, 30, 40, 50] as v (v)}
		<line x1={BUR_X - 12} x2={BUR_X - 4} y1={burY(v)} y2={burY(v)} stroke="var(--ab-glass)" />
		<text x={BUR_X - 18} y={burY(v) + 4} font-size="10" text-anchor="end" class="muted">{v}</text>
	{/each}
	<path
		d="M{BUR_X - 12} {BUR_BOT} L{BUR_X - 3} {BUR_BOT + 22} V{TIP} H{BUR_X + 3} V{BUR_BOT +
			22} L{BUR_X + 12} {BUR_BOT}"
		fill="var(--surface)"
		stroke="var(--ab-glass)"
	/>
	<rect x={BUR_X - 14} y={BUR_BOT + 26} width="28" height="8" rx="3" fill="var(--ab-glass)" />
	<Readout id="burette" order={9} label="Burette" value="0.1 mol/L NaOH">
		<text x={BUR_X + 22} y={BUR_TOP + 14} font-size="12" font-weight="600">burette</text>
		<text x={BUR_X + 22} y={BUR_TOP + 30} font-size="11" class="muted">0.1 mol/L NaOH</text>
	</Readout>
	{#if flowing}
		<ellipse
			cx={BUR_X}
			cy={dropY}
			rx="3"
			ry="4"
			fill="var(--ab-base)"
			opacity={smoothstep(0, 0.1, dropU) * (1 - smoothstep(0.9, 1, dropU))}
		/>
	{/if}

	<!-- flask -->
	<path d={FLASK} fill="var(--surface)" />
	<g clip-path="url(#titration-flask)">
		<rect x="40" y={level} width="220" height={570 - level} fill="var(--ab-liquid)" />
		<rect
			x="40"
			y={level}
			width="220"
			height={570 - level}
			fill={color.rgb}
			opacity={liquidOpacity * color.alpha}
		/>
	</g>
	<path d={FLASK} fill="none" stroke="var(--ab-glass)" stroke-width="1.5" />
	<Readout id="flask" order={10} label="Flask" value={flaskText}>
		<Label x={150} y={584} text={flaskText} size={12} />
	</Readout>
	<Readout id="colour" order={5} label="Colour" value={colourName}>
		<Label x={246} y={478} text="colour: {colourName}" size={12} anchor="start" muted />
	</Readout>
</g>
