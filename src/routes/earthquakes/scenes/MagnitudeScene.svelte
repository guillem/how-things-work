<script lang="ts">
	/**
	 * Magnitude and energy (`magnitude.ts`).
	 *
	 * Phases (`step.hints.phase`):
	 * - scale: two earthquakes (`params.magA`, `params.magB`) as balls whose volume is the
	 *   seismic energy released, over a magnitude scale with real earthquakes marked; the energy
	 *   and wiggle ratios.
	 * - often: the 2015–2024 catalogue (M ≥ 5.5) counted per year in half-magnitude bins (log
	 *   axis), beside each bin's share of the decade's energy.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		NOTABLE,
		TNT_TONNE,
		amplitudeRatio,
		energy,
		energyRatio,
		energyShare,
		perYearAtLeast
	} from '../magnitude';

	let { step, params, reduced }: StageProps = $props();

	type Phase = 'scale' | 'often';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'scale');

	const clampM = (v: unknown, d: number) => Math.max(2, Math.min(9.5, Number(v ?? d)));
	const magA = $derived(clampM(params.magA, 7.8));
	const magB = $derived(clampM(params.magB, 5.8));
	const opts = { duration: 600, easing: cubicInOut };
	const tA = Tween.of(() => magA, opts);
	const tB = Tween.of(() => magB, opts);
	const mA = $derived(reduced ? magA : tA.current);
	const mB = $derived(reduced ? magB : tB.current);

	// ---- balls -----------------------------------------------------------------------------
	/** Radius ∝ energy^(1/3) = 10^(M/2): the largest (9.5) is 150 px. */
	const radius = (m: number) => 150 * 10 ** (0.5 * (m - 9.5));
	const BALL_Y = 236;
	const big = $derived(Math.max(magA, magB));
	const small = $derived(Math.min(magA, magB));
	const ratioE = $derived(energyRatio(big, small));
	const ratioA = $derived(amplitudeRatio(big, small));
	const nice = (x: number) =>
		x < 10
			? x.toFixed(1).replace(/\.0$/, '')
			: x < 1e6
				? Math.round(x).toLocaleString('en-GB', { maximumSignificantDigits: 2 })
				: x < 1e9
					? `${(x / 1e6).toLocaleString('en-GB', { maximumSignificantDigits: 2 })} million`
					: `${(x / 1e9).toLocaleString('en-GB', { maximumSignificantDigits: 2 })} billion`;
	const tnt = (m: number) => {
		const t = energy(m) / TNT_TONNE;
		return t < 1000
			? `${nice(t)} tonnes of TNT`
			: t < 1e6
				? `${nice(t / 1000)} thousand tonnes of TNT`
				: t < 1e9
					? `${nice(t / 1e6)} million tonnes of TNT`
					: `${nice(t / 1e9)} billion tonnes of TNT`;
	};

	// ---- the scale ----------------------------------------------------------------------------
	const AX = { x0: 70, x1: 900, y: 528 };
	const ax = (m: number) => AX.x0 + ((m - 2) / 7.5) * (AX.x1 - AX.x0);
	/** The notable earthquakes, those of the same magnitude on one label. */
	const named = [...new Set(NOTABLE.map((q) => q.mag))]
		.sort((a, b) => a - b)
		.map((mag) => ({
			mag,
			id: String(mag),
			name: NOTABLE.filter((q) => q.mag === mag)
				.map((q) => q.name)
				.join(', ')
		}));

	// ---- how often ------------------------------------------------------------------------------
	const BINS = [5.5, 6, 6.5, 7, 7.5, 8].map((lo) => {
		const hi = lo + 0.5;
		return {
			lo,
			perYear: perYearAtLeast(lo) - perYearAtLeast(hi),
			share: energyShare(lo) - energyShare(hi)
		};
	});
	const LC = { x0: 90, x1: 450, y0: 110, y1: 470 };
	const RC = { x0: 560, x1: 920, y0: 110, y1: 470 };
	const bw = (LC.x1 - LC.x0) / BINS.length;
	/** Log axis 0.01 → 1000 a year. */
	const ly = (n: number) => LC.y1 - ((Math.log10(Math.max(n, 0.01)) + 2) / 5) * (LC.y1 - LC.y0);
	const ry = (f: number) => RC.y1 - (f / 0.5) * (RC.y1 - RC.y0);
	const perYearText = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1));
	const countsText = BINS.map((b) => perYearText(b.perYear)).join(' · ');
	const sharesText = BINS.map((b) => `${Math.round(b.share * 100)}%`).join(' · ');
</script>

<g class="magnitude-scene">
	{#if phase === 'scale'}
		<!-- the two balls -->
		{#each [{ id: 'a', m: mA, x: 290, set: magA, label: 'bigger' }, { id: 'b', m: mB, x: 690, set: magB, label: 'smaller' }] as b (b.id)}
			<circle
				cx={b.x}
				cy={BALL_Y}
				r={Math.max(0.8, radius(b.m))}
				fill={b.id === 'a' ? 'var(--eq-quake)' : 'var(--eq-p)'}
				opacity="0.85"
			/>
			<Readout
				id="ball-{b.id}"
				order={b.id === 'a' ? 1 : 2}
				label="M {b.set.toFixed(1)}"
				value={tnt(b.set)}
				color={b.id === 'a' ? 'var(--eq-quake)' : 'var(--eq-p)'}
			>
				<text
					x={b.x}
					y={BALL_Y + 172}
					text-anchor="middle"
					style:font-size="16px"
					style:font-weight="600">M {b.set.toFixed(1)}</text
				>
				<text x={b.x} y={BALL_Y + 192} text-anchor="middle" class="muted" style:font-size="12px"
					>{tnt(b.set)}</text
				>
			</Readout>
			{#if radius(b.m) < 3}
				<Readout id="tiny-{b.id}">
					<Label x={b.x} y={BALL_Y - 14} text="(a dot: too small to see)" size={11} muted />
				</Readout>
			{/if}
		{/each}
		<Readout id="ratio" order={3} label="Energy" value="{nice(ratioE)} times more">
			<text x="480" y="56" text-anchor="middle" style:font-size="16px" style:font-weight="600">
				{magA === magB
					? 'The same size'
					: `M ${big.toFixed(1)} releases ${nice(ratioE)} times the energy of M ${small.toFixed(1)}`}
			</text>
		</Readout>
		<Readout
			id="ratio-a"
			order={4}
			label="Wiggles on a seismometer"
			value="{nice(ratioA)} times bigger"
		>
			<text x="480" y="78" text-anchor="middle" class="muted" style:font-size="12px">
				{magA === magB
					? ''
					: `and its wiggles on a seismometer at the same distance are ${nice(ratioA)} times bigger · each ball’s volume is the energy`}
			</text>
		</Readout>

		<!-- the magnitude scale, with real earthquakes -->
		<path d="M{AX.x0} {AX.y}H{AX.x1}" stroke="var(--stage-ink)" stroke-width="1.4" />
		{#each [2, 3, 4, 5, 6, 7, 8, 9] as m (m)}
			<path d="M{ax(m)} {AX.y}v6" stroke="var(--stage-ink)" />
			<Readout id="ax-{m}">
				<text x={ax(m)} y={AX.y + 22} text-anchor="middle" style:font-size="12px">{m}</text>
			</Readout>
		{/each}
		<Readout id="ax-name">
			<text x={AX.x0} y={AX.y + 44} class="muted" style:font-size="12px"
				>moment magnitude · each step: × 32 energy, × 10 wiggles</text
			>
		</Readout>
		{#each named as q, i (q.id)}
			<path d="M{ax(q.mag)} {AX.y}v{-14 - (i % 3) * 16}" stroke="var(--stage-ink-muted)" />
			<Readout id="q-{q.id}">
				<Label
					x={ax(q.mag)}
					y={AX.y - 20 - (i % 3) * 16}
					text={q.name}
					size={11}
					anchor="end"
					muted
				/>
			</Readout>
		{/each}
		<path d="M{ax(mA)} {AX.y - 6}l-6 -10h12z" fill="var(--eq-quake)" />
		<path d="M{ax(mB)} {AX.y - 6}l-6 -10h12z" fill="var(--eq-p)" />
		<Readout id="felt">
			<Label x={ax(2.5)} y={AX.y - 20} text="usually not felt" size={11} muted />
		</Readout>
	{:else}
		<!-- counts per year -->
		<Readout
			id="c-title"
			order={1}
			label="Earthquakes a year, 2015–2024"
			value={countsText}
			note="magnitude 5.5–6, 6–6.5, … 8–8.5: about ten times fewer per step"
		>
			<text x={LC.x0 - 50} y={LC.y0 - 40} style:font-size="14px" style:font-weight="600"
				>How many a year (2015–2024)</text
			>
			<text x={LC.x0 - 50} y={LC.y0 - 22} class="muted" style:font-size="12px"
				>each line up: ten times more</text
			>
		</Readout>
		{#each [0.01, 0.1, 1, 10, 100, 1000] as n (n)}
			<path d="M{LC.x0} {ly(n)}H{LC.x1}" stroke="var(--stage-grid)" />
			<Readout id="cy-{n}">
				<text x={LC.x0 - 6} y={ly(n) + 4} text-anchor="end" class="muted" style:font-size="11px"
					>{n >= 1 ? n.toLocaleString('en-GB') : n}</text
				>
			</Readout>
		{/each}
		{#each BINS as b, i (b.lo)}
			{@const x = LC.x0 + i * bw + 6}
			<rect
				{x}
				y={ly(b.perYear)}
				width={bw - 12}
				height={LC.y1 - ly(b.perYear)}
				fill="var(--eq-p)"
				opacity="0.8"
				rx="2"
			/>
			<Readout id="cb-{b.lo}">
				<text
					x={x + (bw - 12) / 2}
					y={ly(b.perYear) - 6}
					text-anchor="middle"
					style:font-size="12px"
					style:font-weight="600">{perYearText(b.perYear)}</text
				>
			</Readout>
			<Readout id="cx-{b.lo}">
				<text x={x + (bw - 12) / 2} y={LC.y1 + 18} text-anchor="middle" style:font-size="11px"
					>{b.lo}–{b.lo + 0.5}</text
				>
			</Readout>
		{/each}
		<Readout id="cx-name">
			<text
				x={(LC.x0 + LC.x1) / 2}
				y={LC.y1 + 38}
				text-anchor="middle"
				class="muted"
				style:font-size="12px">magnitude</text
			>
		</Readout>

		<!-- share of the energy -->
		<Readout
			id="e-title"
			order={10}
			label="Share of the decade’s energy"
			value={sharesText}
			note="the few big ones release most of it"
		>
			<text x={RC.x0 - 30} y={RC.y0 - 40} style:font-size="14px" style:font-weight="600"
				>Share of all their energy</text
			>
			<text x={RC.x0 - 30} y={RC.y0 - 22} class="muted" style:font-size="12px"
				>the few big ones release most of it</text
			>
		</Readout>
		{#each [0, 0.1, 0.2, 0.3, 0.4, 0.5] as f (f)}
			<path d="M{RC.x0} {ry(f)}H{RC.x1}" stroke="var(--stage-grid)" />
			<Readout id="ey-{f}">
				<text x={RC.x0 - 6} y={ry(f) + 4} text-anchor="end" class="muted" style:font-size="11px"
					>{Math.round(f * 100)}%</text
				>
			</Readout>
		{/each}
		{#each BINS as b, i (b.lo)}
			{@const x = RC.x0 + i * bw + 6}
			<rect
				{x}
				y={ry(b.share)}
				width={bw - 12}
				height={RC.y1 - ry(b.share)}
				fill="var(--eq-quake)"
				opacity="0.85"
				rx="2"
			/>
			<Readout id="eb-{b.lo}">
				<text
					x={x + (bw - 12) / 2}
					y={ry(b.share) - 6}
					text-anchor="middle"
					style:font-size="12px"
					style:font-weight="600">{Math.round(b.share * 100)}%</text
				>
			</Readout>
			<Readout id="ex-{b.lo}">
				<text x={x + (bw - 12) / 2} y={RC.y1 + 18} text-anchor="middle" style:font-size="11px"
					>{b.lo}–{b.lo + 0.5}</text
				>
			</Readout>
		{/each}
		<Readout id="ex-name">
			<text
				x={(RC.x0 + RC.x1) / 2}
				y={RC.y1 + 38}
				text-anchor="middle"
				class="muted"
				style:font-size="12px">magnitude</text
			>
		</Readout>
		<Readout id="src">
			<text x="480" y="560" text-anchor="middle" class="muted" style:font-size="12px"
				>USGS catalogue: all {Math.round(perYearAtLeast(5.5) * 10).toLocaleString('en-GB')} earthquakes
				of magnitude 5.5 or more, 2015–2024</text
			>
		</Readout>
	{/if}
</g>
