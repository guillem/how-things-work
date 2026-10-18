<script lang="ts">
	/**
	 * One drug's blood level against time, with the body drawn beside it as a tank on the same
	 * level scale. `step.hints.mode` picks the regimen (see `regimens.ts`): `single` (one
	 * injection, its half-lives marked on the curve), `tablet` (a tablet against the same dose
	 * injected), `repeat` (tablets at an interval, a dose that can be missed), `drip` (a drip,
	 * optionally after a loading dose), `double` (digoxin at one and two doses a day, each one's
	 * 90% mark), `loading` (digoxin with and without a loading dose), `kidney` (lithium as the
	 * kidneys fail) and `saturable` (phenytoin: the tank gives way to its plateau against the
	 * daily dose).
	 *
	 * A cursor sweeps the time axis over the first 12 seconds and draws the curve behind it; the
	 * tank shows the level at the cursor. Reduced motion shows the whole curve with the cursor at
	 * the end. The read-outs are about the whole regimen, so they don't move with the cursor.
	 */
	import { Label, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DRUGS } from '../drugs';
	import {
		bodyOf,
		elimination,
		halfLifeAt,
		levelAt,
		range,
		repeated,
		shareAfter,
		simulate,
		steadyAverage,
		timeToShare,
		type Dose,
		type Series
	} from '../model';
	import { linearTwin, planFor } from '../regimens';
	import DoseStrip from './DoseStrip.svelte';
	import LevelChart from './LevelChart.svelte';
	import Tank from './Tank.svelte';
	import { C, L, duration, highest, level, levelMax, pathOf } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'single'));
	const plan = $derived(planFor(mode, params));
	const drug = $derived(plan.drug);
	const span = $derived(plan.span);
	const main = $derived(plan.main);
	const ghost = $derived(plan.ghost);

	const PLAY = 12;
	const tabletInfo = $derived.by(() => {
		if (mode !== 'tablet') return null;
		let tp = 0;
		let cp = 0;
		const s = main.series;
		for (let i = 0; i < s.t.length; i++)
			if (s.c[i] > cp) {
				cp = s.c[i];
				tp = s.t[i];
			}
		const auc = 300 / main.body.CL;
		return { tp, cp, auc, iv: ghost ? levelAt(ghost.series, 0) : 0 };
	});

	/** Under reduced motion the curve is whole and the tank shows a telling moment. */
	const still = $derived(
		mode === 'single' ? plan.halfLife : mode === 'tablet' ? (tabletInfo?.tp ?? span) : span
	);
	const tc = $derived(reduced ? still : span * clamp(t / PLAY));
	const sx = $derived(scale([0, span], [L.PX0, L.PX1]));
	const yMax = $derived(
		levelMax(drug, Math.max(highest(main.series), ghost ? highest(ghost.series) : 0))
	);
	const sy = $derived(scale([0, yMax], [L.PY0, L.PY1]));

	const mainPath = $derived(pathOf(main.series, sx, sy, reduced ? Infinity : tc));
	const ghostPath = $derived(ghost ? pathOf(ghost.series, sx, sy, Infinity) : '');
	const now = $derived(levelAt(main.series, tc));

	// ---------------------------------------------------------------- the tank
	const usual = $derived(mode === 'tablet' ? 300 : drug.dose);
	const gutNow = $derived.by(() => {
		if (!main.doses.some((d) => d.form === 'tablet')) return null;
		const n = main.series.t.length - 1;
		const i = Math.min(n, Math.round(tc / main.series.dt));
		return main.series.g[i] / (drug.F * usual);
	});
	const pouring = $derived(
		main.doses.some(
			(d) =>
				d.form !== 'tablet' &&
				tc >= d.t &&
				tc < d.t + Math.max(d.duration ?? 0, span * 0.012) &&
				tc < span - 1e-9
		)
	);
	const drain = $derived(
		elimination(main.body, now) / Math.max(1e-9, elimination(main.body, yMax))
	);
	const fmtL = (v: number) => `${v < 100 ? v.toFixed(0) : Math.round(v / 10) * 10} L`;
	const fmtCL = (v: number) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)} L/h`;
	const clText = $derived(main.body.saturable ? 'falls as the level rises' : fmtCL(main.body.CL));

	// ---------------------------------------------------------------- half-life marks
	const t12 = $derived(plan.halfLife);
	const halfMarks = $derived.by(() => {
		if (!['repeat', 'drip', 'double', 'loading', 'kidney'].includes(mode)) return [];
		const out: { t: number; n: number; text: string }[] = [];
		for (let n = 1; n <= 5; n++) {
			const time = n * t12;
			if (time > span) break;
			out.push({
				t: time,
				n,
				text: n === 3 ? '87.5%' : `${Math.round(shareAfter(n) * 100)}%`
			});
		}
		return out;
	});
	const singleMarks = $derived.by(() => {
		if (mode !== 'single') return [];
		const c0 = levelAt(main.series, 0);
		const names = ['½', '¼', '⅛', '1/16', '1/32'];
		const out: { t: number; c: number; text: string; label: boolean }[] = [];
		for (let n = 1; n <= 5; n++) {
			if (n * t12 > span) break;
			out.push({ t: n * t12, c: c0 / 2 ** n, text: names[n - 1], label: n <= 3 });
		}
		return out;
	});

	// ---------------------------------------------------------------- mode read-outs
	const fmtH = (h: number) => duration(h);
	/** Steady-state trough of a linear regimen, from the last dose's trough. */
	const troughPlateau = (s: Series, doses: readonly Dose[], halfLife: number) => {
		const last = doses[doses.length - 1];
		if (!last || last.t <= 0) return NaN;
		return levelAt(s, last.t - 1e-6) / shareAfter(last.t / halfLife);
	};

	const dripReached = $derived(
		mode !== 'drip'
			? ''
			: params.load4 === true
				? `with the label’s 320 mg loading dose: ${level(levelAt(main.series, 0.5), drug)} after 30 minutes`
				: `drip alone: 94% of the plateau after 4 half-lives, ${duration(4 * t12)}`
	);

	const repeatInfo = $derived.by(() => {
		if (mode !== 'repeat') return null;
		const r = range(main.series, span - 24, span);
		return r;
	});

	const ninety = $derived.by(() => {
		if (mode !== 'double') return null;
		const p = troughPlateau(main.series, main.doses, t12);
		return timeToShare(main.series, main.doses, p, 0.9);
	});

	const loadingInfo = $derived.by(() => {
		if (mode !== 'loading') return null;
		const day1 = levelAt(main.series, 24 - 1e-6);
		const base = ghost ?? main;
		const p = troughPlateau(base.series, base.doses, t12);
		const plainDay1 = levelAt(base.series, 24 - 1e-6);
		return { day1, share: day1 / p, plainShare: plainDay1 / p };
	});

	// saturable: the plateau and the time to reach 90% of it (from a 90-day run)
	const satInfo = $derived.by(() => {
		if (mode !== 'saturable') return null;
		const daily = Number(params.dose9 ?? 300);
		const long = 90 * 24;
		const doses = repeated({ amount: daily / 3, interval: 8, form: 'tablet', until: long });
		const s = simulate(main.body, doses, long, 2400);
		const trough = levelAt(s, long - 8 - 1e-6);
		const t90 = timeToShare(s, doses, trough, 0.9);
		const css = steadyAverage(main.body, daily, 24, 'tablet');
		return { daily, css, t90, halfLife: halfLifeAt(main.body, Number.isFinite(css) ? css : 0) };
	});

	// saturable: the inset of plateau against daily dose
	const IX0 = 64;
	const IX1 = 282;
	const IY0 = 440;
	const IY1 = 200;
	const DMIN = 200;
	const DMAX = 520;
	const IYMAX = 60;
	const ix = scale([DMIN, DMAX], [IX0, IX1]);
	const iy = scale([0, IYMAX], [IY0, IY1]);
	const twin = $derived(linearTwin(DRUGS.phenytoin));
	const satBody = bodyOf(DRUGS.phenytoin);
	const insetPath = (b: typeof satBody) => {
		let d = '';
		for (let mg = DMIN; mg <= DMAX; mg += 2) {
			const c = steadyAverage(b, mg, 24, 'tablet');
			const y = Number.isFinite(c) ? Math.max(IY1 - 6, iy(Math.min(c, IYMAX + 2))) : IY1 - 6;
			d += `${d ? 'L' : 'M'}${ix(mg).toFixed(1)} ${y.toFixed(1)}`;
			if (!Number.isFinite(c) || c > IYMAX) break;
		}
		return d;
	};
	const satPath = insetPath(satBody);
	const linPath = $derived(insetPath(twin));
	const satOn = $derived(params.sat9 === undefined ? true : params.sat9 === true);
	const reveal = $derived(reduced ? 1 : smoothstep(0, 1.2, t));
</script>

<g>
	<LevelChart {sx} {sy} {drug} {span} ghost={ghost?.label ?? null} />

	<!-- half-life marks: the share of the steady state reached -->
	{#if halfMarks.length}
		<Readout id="half-title">
			<Label
				x={L.PX0 - 8}
				y={L.HALF + 4}
				anchor="end"
				text="after n half-lives:"
				size={11}
				color={C.half}
			/>
		</Readout>
		{#each halfMarks as m (m.n)}
			<line
				x1={sx(m.t)}
				x2={sx(m.t)}
				y1={L.HALF + 8}
				y2={L.PY0}
				stroke={C.half}
				stroke-width="1"
				stroke-dasharray="2 4"
				opacity="0.7"
			/>
			<Readout id="half-{m.n}">
				<Label x={sx(m.t)} y={L.HALF + 4} text={m.text} size={11} weight={600} color={C.half} />
			</Readout>
		{/each}
	{/if}

	<!-- the comparison curve -->
	{#if ghost}
		<path
			d={ghostPath}
			fill="none"
			stroke={C.ghost}
			stroke-width="2"
			stroke-dasharray="5 4"
			opacity={reveal}
		/>
	{/if}
	<path d={mainPath} fill="none" stroke={C.curve} stroke-width="2.6" stroke-linejoin="round" />

	<!-- the cursor -->
	<line
		x1={sx(tc)}
		x2={sx(tc)}
		y1={L.PY1}
		y2={L.PY0}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.35"
	/>
	{#if mode !== 'saturable'}
		<line
			x1={L.TX + L.TW / 2 + 70}
			x2={sx(tc)}
			y1={sy(now)}
			y2={sy(now)}
			stroke={C.water}
			stroke-width="1.2"
			stroke-dasharray="1 4"
			opacity="0.9"
		/>
	{/if}
	<circle cx={sx(tc)} cy={sy(now)} r="5" fill={C.curve} stroke="var(--stage-bg)" stroke-width="2" />

	<DoseStrip {sx} {drug} doses={main.doses} missed={plan.missed} {span} />

	<!-- single: the halvings on the curve -->
	{#each singleMarks as m (m.text)}
		<circle
			cx={sx(m.t)}
			cy={sy(m.c)}
			r="4"
			fill="var(--stage-bg)"
			stroke={C.half}
			stroke-width="2"
			opacity={reduced || tc >= m.t ? 1 : 0}
		/>
		{#if m.label}
			<Readout id="halving-{m.text}">
				<Label
					x={sx(m.t) + 4}
					y={sy(m.c) - 10}
					anchor="start"
					text="{m.text} after {m.t === t12 ? '' : `${Math.round(m.t / t12)} × `}t½"
					size={11}
					weight={600}
					color={C.half}
					opacity={reduced || tc >= m.t ? 1 : 0}
				/>
			</Readout>
		{/if}
	{/each}

	<!-- double: the 90% mark, the same for both doses -->
	{#if mode === 'double' && ninety !== null && Number.isFinite(ninety)}
		<line
			x1={sx(ninety)}
			x2={sx(ninety)}
			y1={L.PY1 + 4}
			y2={L.PY0}
			stroke={C.curve}
			stroke-width="1.6"
			stroke-dasharray="6 3"
			opacity={reveal}
		/>
		<circle
			cx={sx(ninety)}
			cy={sy(levelAt(main.series, ninety - 1e-6))}
			r="5"
			fill={C.curve}
			opacity={reveal}
		/>
		{#if ghost}
			<circle
				cx={sx(ninety)}
				cy={sy(levelAt(ghost.series, ninety - 1e-6))}
				r="5"
				fill={C.ghost}
				opacity={reveal}
			/>
		{/if}
		<Readout id="ninety-mark">
			<Label
				x={sx(ninety) + 8}
				y={L.PY1 + 18}
				anchor="start"
				text="90% of its own plateau"
				size={11}
				weight={600}
				color={C.curve}
				opacity={reveal}
			/>
		</Readout>
	{/if}

	<!-- the body, or (saturable) the plateau against the dose -->
	{#if mode !== 'saturable'}
		<Tank
			surface={sy(now)}
			widthScale={main.body.V / drug.V}
			gut={gutNow}
			{pouring}
			{drain}
			volumeText={fmtL(main.body.V)}
			clearanceText={clText}
			halfText={Number.isFinite(t12) ? fmtH(t12) : null}
			{t}
			{reduced}
		/>
	{:else if satInfo}
		<g>
			<rect x={ix(DMIN)} y={iy(20)} width={IX1 - IX0} height={iy(10) - iy(20)} fill={C.band} />
			<line x1={IX0} x2={IX1} y1={IY0} y2={IY0} stroke="var(--stage-line)" />
			<line x1={IX0} x2={IX0} y1={IY1} y2={IY0} stroke="var(--stage-line)" />
			{#each [200, 300, 400, 500] as mg (mg)}
				<line x1={ix(mg)} x2={ix(mg)} y1={IY0} y2={IY0 + 4} stroke="var(--stage-line)" />
				<Readout id="ix-{mg}">
					<text x={ix(mg)} y={IY0 + 17} font-size="11" text-anchor="middle" class="muted">{mg}</text
					>
				</Readout>
			{/each}
			{#each [0, 20, 40, 60] as c (c)}
				<Readout id="iy-{c}">
					<text x={IX0 - 6} y={iy(c) + 4} font-size="11" text-anchor="end" class="muted">{c}</text>
				</Readout>
			{/each}
			<Readout
				id="inset-title"
				label="Left chart"
				value="steady level (mcg/mL) against the daily dose (mg)"
			>
				<Label
					x={IX0 - 30}
					y={IY1 - 22}
					anchor="start"
					text="steady level against daily dose"
					size={12}
					weight={600}
				/>
				<Label x={IX1} y={IY0 + 34} anchor="end" text="mg a day" size={11} muted />
			</Readout>
			<path
				d={linPath}
				fill="none"
				stroke={C.ghost}
				stroke-width="2"
				stroke-dasharray="5 4"
				opacity={satOn ? 0.8 : 1}
			/>
			<path
				d={satPath}
				fill="none"
				stroke={C.curve}
				stroke-width="2.4"
				opacity={satOn ? 1 : 0.35}
			/>
			<Readout id="inset-keys">
				<Label
					x={ix(470)}
					y={iy(Math.min(55, steadyAverage(twin, 470, 24, 'tablet'))) + 18}
					text="linear"
					size={11}
					muted
				/>
				<Label
					x={ix(455)}
					y={iy(52)}
					anchor="end"
					text="saturable"
					size={11}
					weight={600}
					color={C.curve}
				/>
			</Readout>
			<circle
				cx={ix(satInfo.daily)}
				cy={Number.isFinite(satInfo.css) ? iy(Math.min(satInfo.css, IYMAX)) : IY1}
				r="6"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		</g>
	{/if}

	<!-- read-outs -->
	{#if mode === 'single'}
		<Readout
			id="r1"
			order={0}
			label="Dose"
			value="320 mg injected: V = {fmtL(main.body.V)}, CL = {fmtCL(main.body.CL)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="320 mg of theophylline injected · V = {fmtL(main.body.V)}, CL = {fmtCL(main.body.CL)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="r2" order={1} label="Half-life" value="0.693 × V / CL = {fmtH(t12)}">
			<Label
				x={24}
				y={60}
				anchor="start"
				text="half-life = 0.693 × V / CL = {fmtH(t12)} · starts at {level(
					levelAt(main.series, 0),
					drug
				)}"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'tablet' && tabletInfo}
		<Readout
			id="r1"
			order={0}
			label="Tablet"
			value="peak {level(tabletInfo.cp, drug)} after {fmtH(tabletInfo.tp)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="300 mg tablet: peak {level(tabletInfo.cp, drug)} after {fmtH(tabletInfo.tp)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="r2" order={1} label="Injected" value="{level(tabletInfo.iv, drug)} at once">
			<Label
				x={24}
				y={60}
				anchor="start"
				text="the same dose injected: {level(tabletInfo.iv, drug)} at once (dashed)"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="r3"
			order={2}
			label="Area under each curve"
			value="{tabletInfo.auc.toFixed(0)} mg·h/L, the same"
		>
			<Label
				x={24}
				y={84}
				anchor="start"
				text="area under each curve: dose ÷ CL = {tabletInfo.auc.toFixed(
					0
				)} mg·h/L, the same for both"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'repeat' && repeatInfo}
		<Readout
			id="r1"
			order={0}
			label="Regimen"
			value="300 mg every {params.tau3 ?? 8} h: average {level(plan.plateau, drug)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="300 mg every {params.tau3 ?? 8} hours: steady average {level(plan.plateau, drug)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="r2"
			order={1}
			label="Last day"
			value="peaks {level(repeatInfo.max, drug)}, troughs {level(repeatInfo.min, drug)}"
		>
			<Label
				x={24}
				y={60}
				anchor="start"
				text="last day: peaks {level(repeatInfo.max, drug)}, troughs {level(repeatInfo.min, drug)}"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="r3" order={2} label="94% of the way" value="after 4 half-lives, {fmtH(4 * t12)}">
			<Label
				x={24}
				y={84}
				anchor="start"
				text="half-life {fmtH(t12)}: 94% of the way after 4 half-lives, {fmtH(4 * t12)}"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'drip'}
		<Readout
			id="r1"
			order={0}
			label="Drip"
			value="{params.rate4 ?? 28} mg/h: plateau {level(plan.plateau, drug)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="drip of {params.rate4 ?? 28} mg/h: plateau = rate ÷ CL = {level(plan.plateau, drug)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="r2" order={1} label="Reached" value={dripReached}>
			<Label x={24} y={60} anchor="start" text={dripReached} size={13} tabular />
		</Readout>
	{:else if mode === 'double'}
		<Readout
			id="r1"
			order={0}
			label="Daily dose"
			value="{params.dbl5 === true ? 500 : 250} mcg: plateau {level(plan.plateau, drug)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="digoxin {params.dbl5 === true ? 500 : 250} mcg a day: steady average {level(
					plan.plateau,
					drug
				)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="r2"
			order={1}
			label="90% of its plateau"
			value="after {ninety !== null ? fmtH(ninety) : '—'}, whatever the dose"
		>
			<Label
				x={24}
				y={60}
				anchor="start"
				text="90% of its own plateau after {ninety !== null
					? fmtH(ninety)
					: '—'}, whatever the dose · half-life {fmtH(t12)}"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'loading' && loadingInfo}
		<Readout id="r1" order={0} label="Regimen" value={main.label}>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="digoxin {main.label}: steady average {level(plan.plateau, drug)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="r2"
			order={1}
			label="After day 1"
			value="{Math.round(loadingInfo.share * 100)}% of the plateau"
		>
			<Label
				x={24}
				y={60}
				anchor="start"
				text="after day 1: {Math.round(loadingInfo.share * 100)}% of the plateau{params.load6 ===
				true
					? ` (without loading: ${Math.round(loadingInfo.plainShare * 100)}%)`
					: ''}"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'kidney'}
		<Readout
			id="r1"
			order={0}
			label="Lithium"
			value="600 mg twice a day, kidneys at {Math.round(Number(params.kid7 ?? 1) * 100)}%"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="lithium 600 mg twice a day, kidneys at {Math.round(
					Number(params.kid7 ?? 1) * 100
				)}%: average {level(plan.plateau, drug)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="r2" order={1} label="Half-life" value="{fmtH(t12)}: 94% after {fmtH(4 * t12)}">
			<Label
				x={24}
				y={60}
				anchor="start"
				text="half-life {fmtH(t12)}: 94% of the way after {fmtH(4 * t12)}"
				size={13}
				tabular
			/>
		</Readout>
	{:else if mode === 'saturable' && satInfo}
		<Readout
			id="r1"
			order={0}
			label="Phenytoin"
			value="{satInfo.daily} mg a day: plateau {level(satInfo.css, drug)}"
		>
			<Label
				x={24}
				y={34}
				anchor="start"
				text="phenytoin {satInfo.daily} mg a day ({satOn
					? 'saturable'
					: 'linear'}): steady average {level(satInfo.css, drug)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="r2"
			order={1}
			label="Half-life there"
			value="{fmtH(satInfo.halfLife)}{satOn ? ', and it grows with the level' : ''}"
		>
			<Label
				x={24}
				y={60}
				anchor="start"
				text="half-life at that level: {fmtH(satInfo.halfLife)}{satOn
					? ' (it grows with the level)'
					: ''} · 90% of the plateau after {fmtH(satInfo.t90)}"
				size={13}
				tabular
			/>
		</Readout>
	{/if}

	<Readout
		id="advice"
		order={20}
		label="Note"
		value="an educational model of one 70 kg adult, not dosing advice"
	>
		<Label
			x={L.PX1}
			y={588}
			anchor="end"
			text="educational model of one 70 kg adult · not dosing advice"
			size={11}
			muted
		/>
	</Readout>
</g>
