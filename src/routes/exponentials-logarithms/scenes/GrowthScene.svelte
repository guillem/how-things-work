<script lang="ts">
	/**
	 * Growth charts: what repeated multiplication looks like, on an ordinary and on a log axis.
	 *
	 * Phases (`step.hints.phase`):
	 *   fold     — a sheet folded `folds` times: one bar per fold, the axis rescaling to the newest
	 *              (a counter runs 4 folds a second; complete under reduced motion)
	 *   race     — 100 plus `add` a step against 100 × `factor` a step, over 60 steps; a fixed
	 *              axis, so the multiplier leaves the top; where it overtakes
	 *   log      — the same race; the `log` toggle morphs the vertical axis to a log scale, where
	 *              the multiplier is straight and a triangle shows the steps per ×10
	 *   doubling — 1 growing by `rate` % a step up to 1,024; each doubling marked, evenly spaced
	 *   steady   — one growth twice, ordinary axis left and log axis right, with a logistic curve
	 *              that starts with the same factor and slows
	 *   decay    — carbon-14 over 60,000 years; a draggable sample age; `logDecay` morphs the axis
	 *
	 * The log/linear morph is a tween of the vertical mapping: y = lerp(linear y, log y, w).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		Label,
		clamp,
		lerp,
		niceMax,
		scale,
		type Scale,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		arithmetic,
		crossover,
		doublingTime,
		geometric,
		grow,
		logistic,
		ruleOf
	} from '../explog';
	import { fmt, length, pow10, times } from '../format';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'fold'));
	/** Time for the reveal animations; under reduced motion everything is complete. */
	const T = $derived(reduced ? 1e6 : t);

	// ---- the main chart ------------------------------------------------------------------
	const L = 100;
	const R = 650;
	const TOP = 60;
	const BOT = 500;
	const PANEL = 690;

	/** 0 = ordinary vertical axis, 1 = log axis. */
	const wLog = new Tween(0, { duration: 800, easing: cubicInOut });
	const logOn = $derived(
		(phase === 'log' && params.log !== false) || (phase === 'decay' && params.logDecay === true)
	);
	$effect(() => {
		const on = logOn;
		untrack(() => wLog.set(on ? 1 : 0, { duration: reduced ? 0 : 800 }));
	});
	const w = $derived(wLog.current);

	/** A vertical mapping that morphs between an ordinary scale and a log (decades) scale. */
	function morph(lin: Scale, lg: Scale, k: number) {
		return (v: number) => lerp(lin(v), lg(Math.log10(Math.max(v, 1e-12))), k);
	}
	/** Path through points (x, y) already in drawing units. */
	const path = (pts: readonly [number, number][]) =>
		pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
	/** Decade labels for a log axis: 10, 100, 1,000, 10,000, then 10⁵… */
	const decade = (e: number) => (e >= 0 && e <= 4 ? fmt(10 ** e) : pow10(e));

	// ---- fold ----------------------------------------------------------------------------
	const MAXF = 42;
	const nFolds = $derived(clamp(Math.round(Number(params.folds ?? MAXF)), 0, MAXF));
	const fc = $derived(phase === 'fold' ? Math.min(nFolds, T * 4) : 0);
	const foldN = $derived(Math.floor(fc + 1e-9));
	const thick = (k: number) => 0.1 * 2 ** k;
	/** Top of the axis follows the newest fold (continuously, as the counter runs). */
	const foldTop = $derived(thick(fc) * 1.12);
	const unit = $derived(
		foldTop < 1000
			? { name: 'mm', div: 1 }
			: foldTop < 1e7
				? { name: 'm', div: 1000 }
				: { name: 'km', div: 1e6 }
	);
	const fx = scale([-0.5, MAXF + 0.5], [L, R]);
	const fy = $derived(scale([0, foldTop / unit.div], [BOT, TOP]));
	const LANDMARKS: { mm: number; name: string }[] = [
		{ mm: 12.8, name: 'a notebook' },
		{ mm: 1.7e3, name: 'a person' },
		{ mm: 330e3, name: 'the Eiffel Tower' },
		{ mm: 8849e3, name: 'Mount Everest' },
		{ mm: 400e6, name: 'the Space Station' },
		{ mm: 384400e6, name: 'the Moon' }
	];
	const passed = $derived(LANDMARKS.filter((m) => m.mm <= thick(foldN)).at(-1));
	const shownMark = $derived(passed && passed.mm > foldTop * 0.04 ? passed : undefined);

	// ---- race and log --------------------------------------------------------------------
	const N = 60;
	const addV = $derived(clamp(Number(params.add ?? 10), 0, 50));
	const f = $derived(clamp(Number(params.factor ?? 1.05), 1, 1.3));
	const lin = $derived(arithmetic(100, addV, N));
	const geo = $derived(geometric(100, f, N));
	const cross = $derived(crossover(100, addV, f));
	const rc = $derived(phase === 'race' ? Math.min(N, T * 12) : N);
	const rx = scale([0, N], [L, R]);
	const raceMax = $derived(
		niceMax(1.3 * Math.max(lin[N], cross !== null && cross <= N ? geo[cross] : 0, 130))
	);
	const raceLin = $derived(scale([0, raceMax], [BOT, TOP]));
	const raceHi = $derived(Math.max(4, Math.ceil(Math.log10(Math.max(geo[N], lin[N])))));
	const raceLog = $derived(scale([2, raceHi], [BOT, TOP]));
	const ry = $derived(morph(raceLin, raceLog, w));
	const revealed = (values: readonly number[], c: number, x: Scale, y: (v: number) => number) => {
		const pts: [number, number][] = [];
		const whole = Math.floor(c);
		for (let k = 0; k <= whole; k++) pts.push([x(k), y(values[k])]);
		if (c > whole && whole + 1 < values.length) {
			const u = c - whole;
			pts.push([x(c), y(values[whole] * (1 - u) + values[whole + 1] * u)]);
		}
		return pts;
	};
	const linPts = $derived(revealed(lin, rc, rx, ry));
	const geoPts = $derived(
		revealed(
			Array.from({ length: N + 1 }, (_, k) => geo[k]),
			rc,
			rx,
			ry
		)
	);
	/** The step at which the multiplier leaves the top of the ordinary axis. */
	const exitStep = $derived(geo.findIndex((v) => v > raceMax));
	const nowStep = $derived(Math.floor(rc));
	/** Steps per ×10 on the log axis, and the triangle that shows it. */
	const perDecade = $derived(f > 1.0001 ? 1 / Math.log10(f) : Infinity);
	const tri = $derived.by(() => {
		if (!(perDecade <= 50)) return null;
		const s0 = Math.min(6, N - perDecade);
		const s1 = s0 + perDecade;
		const v0 = grow(100, f, s0);
		return { x0: rx(s0), x1: rx(s1), y0: ry(v0), y1: ry(v0 * 10) };
	});

	// ---- doubling ------------------------------------------------------------------------
	const ratePct = $derived(clamp(Number(params.rate ?? 10), 1, 100));
	const dt = $derived(doublingTime(ratePct));
	const dSteps = $derived(10 * dt);
	const dc = $derived(phase === 'doubling' ? Math.min(dSteps, (T / 6) * dSteps) : 0);
	const dx = $derived(scale([0, dSteps * 1.04], [L, R]));
	const dy = scale([0, 1100], [BOT, TOP]);
	const dPts = $derived.by(() => {
		const pts: [number, number][] = [];
		const n = 160;
		for (let i = 0; i <= n; i++) {
			const s = (dc * i) / n;
			pts.push([dx(s), dy(grow(1, 1 + ratePct / 100, s))]);
		}
		return pts;
	});
	const doneDoublings = $derived(Math.floor(dc / dt + 1e-9));
	const r72 = $derived(ruleOf(72, ratePct));
	const r70 = $derived(ruleOf(70, ratePct));
	const off = (v: number) => {
		const p = (v / dt - 1) * 100;
		return `${Math.abs(p).toFixed(1)} % ${p < 0 ? 'short' : 'long'}`;
	};
	const wholeSteps = $derived(dSteps <= 80 ? Math.floor(dc + 1e-9) : -1);

	// ---- steady --------------------------------------------------------------------------
	const CAP = 1e6;
	const SN = $derived(f > 1.0001 ? clamp(Math.ceil(8 / Math.log10(f)), 10, 400) : 100);
	const sExp = $derived(geometric(1, f, SN));
	const sSlow = $derived(logistic(1, f, CAP, SN));
	const sc = $derived(phase === 'steady' ? Math.min(SN, (T / 6) * SN) : 0);
	const BOX = { top: 96, bottom: 470 };
	const A = { left: 100, right: 430 };
	const B = { left: 580, right: 910 };
	const ax = $derived(scale([0, SN], [A.left, A.right]));
	const bx = $derived(scale([0, SN], [B.left, B.right]));
	const ay = scale([0, 2 * CAP], [BOX.bottom, BOX.top]);
	const by = scale([0, 8], [BOX.bottom, BOX.top]);
	const byv = (v: number) => by(Math.log10(Math.max(v, 1)));
	const lastFactor = $derived.by(() => {
		const k = Math.max(1, Math.floor(sc));
		return sSlow[k] / sSlow[k - 1];
	});

	// ---- decay ---------------------------------------------------------------------------
	const HALF = 5700;
	const YEARS = 60000;
	const ageV = $derived(clamp(Number(params.age ?? 11400), 0, YEARS));
	const left = (y: number) => 100 * 0.5 ** (y / HALF);
	const kx = scale([0, YEARS], [L, R]);
	const kLin = scale([0, 100], [BOT, TOP]);
	const kLog = scale([-2, 2], [BOT, TOP]);
	const ky = $derived(morph(kLin, kLog, w));
	const decayPts = $derived(
		Array.from({ length: 241 }, (_, i): [number, number] => {
			const y = (YEARS * i) / 240;
			return [kx(y), ky(left(y))];
		})
	);
	const agePt = $derived({ x: kx(ageV), y: ky(left(ageV)) });
	const pctText = (p: number) => (p >= 1 ? `${p.toFixed(1)} %` : `${p.toPrecision(2)} %`);
</script>

<g>
	<defs>
		<clipPath id="growth-clip">
			<rect x={L} y={TOP - 4} width={R - L} height={BOT - TOP + 8} />
		</clipPath>
		<clipPath id="growth-clip-a">
			<rect x={A.left} y={BOX.top - 4} width={A.right - A.left} height={BOX.bottom - BOX.top + 8} />
		</clipPath>
	</defs>

	{#if phase === 'fold'}
		<Axes
			sx={fx}
			sy={fy}
			xTicks={[0, 7, 14, 21, 28, 35, 42]}
			xLabel="folds"
			yLabel="thickness ({unit.name})"
		/>
		{#each { length: foldN + 1 }, k (k)}
			{@const h = BOT - fy(thick(k) / unit.div)}
			<rect
				x={fx(k) - 5}
				y={BOT - h}
				width="10"
				height={Math.max(0, h)}
				rx="1.5"
				fill="var(--xl-mul)"
				opacity={k === foldN ? 1 : 0.55}
			/>
		{/each}
		{#if shownMark}
			{@const my = fy(shownMark.mm / unit.div)}
			<line
				x1={L}
				x2={R}
				y1={my}
				y2={my}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="5 4"
				stroke-width="1"
			/>
			<Readout id="mark">
				<Label x={L + 10} y={my - 7} text={shownMark.name} anchor="start" size={12} muted />
			</Readout>
		{/if}
		<Readout id="folds" order={1} label="Folds" value={String(foldN)}>
			<Label x={PANEL} y={90} text="folds" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={124}
				text={String(foldN)}
				anchor="start"
				size={30}
				weight={600}
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="layers" order={2} label="Layers" value={fmt(2 ** foldN)}>
			<Label x={PANEL} y={164} text="layers" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={186}
				text={fmt(2 ** foldN)}
				anchor="start"
				size={16}
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="thick" order={3} label="Thickness" value={length(thick(foldN))}>
			<Label x={PANEL} y={226} text="thickness" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={250}
				text={length(thick(foldN))}
				anchor="start"
				size={18}
				weight={600}
				tabular
				color="var(--xl-mul)"
				halo={false}
			/>
		</Readout>
		<Readout id="past" order={4} label="Reaches past" value={passed?.name ?? '—'}>
			<Label x={PANEL} y={290} text="reaches past" anchor="start" size={12} muted halo={false} />
			<Label x={PANEL} y={312} text={passed?.name ?? '—'} anchor="start" size={14} halo={false} />
		</Readout>
		<Readout id="fold-note">
			<Label
				x={PANEL}
				y={372}
				text="each fold adds as much"
				anchor="start"
				size={12}
				muted
				halo={false}
			/>
			<Label
				x={PANEL}
				y={390}
				text="as all the folds before it"
				anchor="start"
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{:else if phase === 'race' || phase === 'log'}
		<Axes
			sx={rx}
			sy={raceLin}
			xLabel="steps"
			yLabel={w < 0.5 ? 'amount' : ''}
			opacity={1 - w}
			xFormat={(v) => String(v)}
		/>
		{#if w > 0.02}
			<Axes
				sx={rx}
				sy={raceLog}
				xTicks={[]}
				yTicks={Array.from({ length: raceHi - 1 }, (_, i) => i + 2)}
				yFormat={decade}
				yLabel={w >= 0.5 ? 'amount (log scale)' : ''}
				opacity={w}
			/>
		{/if}
		<g clip-path="url(#growth-clip)">
			<path
				d={path(linPts)}
				fill="none"
				stroke="var(--xl-add)"
				stroke-width="2.5"
				stroke-linejoin="round"
			/>
			<path
				d={path(geoPts)}
				fill="none"
				stroke="var(--xl-mul)"
				stroke-width="2.5"
				stroke-linejoin="round"
			/>
			{#each geoPts as [x, y], k (k)}
				{#if k % 5 === 0}
					<circle cx={x} cy={y} r="2.5" fill="var(--xl-mul)" />
					<circle cx={x} cy={linPts[k]?.[1] ?? 0} r="2.5" fill="var(--xl-add)" />
				{/if}
			{/each}
		</g>
		{#if cross !== null && cross <= rc}
			{@const cx = rx(cross)}
			{@const cy = ry(geo[cross])}
			<circle
				{cx}
				{cy}
				r="6"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				opacity={cy > TOP ? 1 : 0}
			/>
			<Readout id="cross">
				<Label
					x={cx + 10}
					y={cy + 22}
					text="overtakes at step {cross}"
					anchor="start"
					size={12}
					opacity={cy > TOP ? 1 : 0}
				/>
			</Readout>
		{/if}
		{#if exitStep > 0 && exitStep <= rc && w < 0.98}
			<g opacity={1 - w}>
				<path
					d="M{rx(exitStep)} {TOP + 14} L{rx(exitStep)} {TOP - 2} M{rx(exitStep) - 5} {TOP +
						4} L{rx(exitStep)} {TOP - 3} L{rx(exitStep) + 5} {TOP + 4}"
					fill="none"
					stroke="var(--xl-mul)"
					stroke-width="2"
				/>
				<Readout id="exit">
					<Label
						x={rx(exitStep) < L + 140 ? rx(exitStep) + 12 : rx(exitStep) - 22}
						y={TOP + 10}
						text="off the chart"
						anchor={rx(exitStep) < L + 140 ? 'start' : 'end'}
						size={12}
						color="var(--xl-mul)"
					/>
				</Readout>
			</g>
		{/if}
		{#if phase === 'log' && tri}
			<g opacity={w}>
				<path
					d="M{tri.x0} {tri.y0} L{tri.x1} {tri.y0} L{tri.x1} {tri.y1}"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					stroke-dasharray="4 3"
				/>
				<Readout id="tri">
					<Label
						x={(tri.x0 + tri.x1) / 2}
						y={tri.y0 + 18}
						text="{perDecade.toFixed(1)} steps"
						size={12}
					/>
					<Label x={tri.x1 + 8} y={(tri.y0 + tri.y1) / 2 + 4} text="×10" anchor="start" size={13} />
				</Readout>
			</g>
		{/if}
		<Readout
			id="add"
			order={1}
			label="Adding {addV} a step"
			value={fmt(lin[nowStep])}
			color="var(--xl-add)"
		>
			<line x1={PANEL} x2={PANEL + 22} y1={86} y2={86} stroke="var(--xl-add)" stroke-width="3" />
			<Label
				x={PANEL + 30}
				y={90}
				text="adding {addV} a step"
				anchor="start"
				size={13}
				halo={false}
			/>
			<Label
				x={PANEL + 30}
				y={110}
				text="step {nowStep}: {fmt(lin[nowStep])}"
				anchor="start"
				size={13}
				tabular
				muted
				halo={false}
			/>
		</Readout>
		<Readout
			id="mul"
			order={2}
			label="Multiplying by {times(f)}"
			value={fmt(geo[nowStep])}
			color="var(--xl-mul)"
		>
			<line x1={PANEL} x2={PANEL + 22} y1={146} y2={146} stroke="var(--xl-mul)" stroke-width="3" />
			<Label
				x={PANEL + 30}
				y={150}
				text="multiplying by {times(f)}"
				anchor="start"
				size={13}
				halo={false}
			/>
			<Label
				x={PANEL + 30}
				y={170}
				text="step {nowStep}: {fmt(geo[nowStep])}"
				anchor="start"
				size={13}
				tabular
				muted
				halo={false}
			/>
		</Readout>
		<Readout
			id="who"
			order={3}
			label="Multiplying overtakes"
			value={cross === null ? 'never' : `at step ${cross}`}
		>
			<Label
				x={PANEL}
				y={214}
				text={cross === null
					? 'multiplying never overtakes'
					: `multiplying overtakes at step ${cross}`}
				anchor="start"
				size={13}
				weight={600}
				halo={false}
			/>
		</Readout>
		{#if phase === 'log'}
			<Readout
				id="slope"
				order={4}
				label="Each step on the log axis"
				value={f > 1.0001 ? `up ${Math.log10(f).toFixed(3)} of a ×10` : 'flat'}
				opacity={w}
			>
				<g opacity={w}>
					<Label
						x={PANEL}
						y={258}
						text="each step: up log₁₀ {Number(f.toFixed(2))}"
						anchor="start"
						size={13}
						halo={false}
					/>
					<Label
						x={PANEL}
						y={278}
						text={f > 1.0001 ? `= ${Math.log10(f).toFixed(3)} of a ×10 gridline` : '= 0: flat'}
						anchor="start"
						size={13}
						tabular
						muted
						halo={false}
					/>
					<Label
						x={PANEL}
						y={298}
						text={perDecade < Infinity
							? `×10 every ${perDecade.toFixed(1)} steps`
							: 'never reaches ×10'}
						anchor="start"
						size={13}
						tabular
						muted
						halo={false}
					/>
				</g>
			</Readout>
		{/if}
	{:else if phase === 'doubling'}
		<Axes
			sx={dx}
			sy={dy}
			xLabel="steps"
			yLabel="amount"
			yTicks={[0, 128, 256, 512, 1024]}
			xFormat={(v) => String(v)}
		/>
		{#each { length: 10 }, i (i)}
			{@const j = i + 1}
			{#if j * dt <= dc + 1e-9}
				{@const x = dx(j * dt)}
				<line
					x1={x}
					x2={x}
					y1={dy(2 ** j)}
					y2={BOT}
					stroke="var(--xl-mul)"
					stroke-dasharray="4 3"
					stroke-width="1"
					opacity="0.8"
				/>
				<circle cx={x} cy={dy(2 ** j)} r="3.5" fill="var(--xl-mul)" />
				<Readout id="dbl-{j}">
					<Label {x} y={BOT - 8} text={String(j)} size={11} weight={600} />
					{#if j >= 7}
						<Label x={x - 8} y={dy(2 ** j) - 4} text={fmt(2 ** j)} anchor="end" size={12} />
					{/if}
				</Readout>
			{/if}
		{/each}
		{#if wholeSteps >= 0}
			{#each { length: wholeSteps + 1 }, k (k)}
				<circle cx={dx(k)} cy={dy(grow(1, 1 + ratePct / 100, k))} r="2" fill="var(--xl-mul)" />
			{/each}
		{/if}
		<path d={path(dPts)} fill="none" stroke="var(--xl-mul)" stroke-width="2.5" />
		{#if doneDoublings >= 2}
			{@const y = BOT - 34}
			<path
				d="M{dx(dt)} {y} L{dx(2 * dt)} {y} M{dx(dt)} {y - 5} L{dx(dt)} {y + 5} M{dx(2 * dt)} {y -
					5} L{dx(2 * dt)} {y + 5}"
				stroke="var(--stage-ink)"
				stroke-width="1.2"
			/>
			<Readout id="one-dbl">
				<Label
					x={dx(2 * dt) + 8}
					y={y + 4}
					text="one doubling = {dt.toFixed(2)} steps"
					anchor="start"
					size={12}
				/>
			</Readout>
		{/if}
		<Readout id="count" order={1} label="Doublings" value={String(doneDoublings)}>
			<Label x={PANEL} y={90} text="doublings" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={124}
				text={String(doneDoublings)}
				anchor="start"
				size={30}
				weight={600}
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="exact" order={2} label="One doubling" value="{dt.toFixed(2)} steps">
			<Label
				x={PANEL}
				y={170}
				text="one doubling: {dt.toFixed(2)} steps"
				anchor="start"
				size={14}
				weight={600}
				color="var(--xl-mul)"
				halo={false}
			/>
		</Readout>
		<Readout
			id="r72"
			order={3}
			label="Rule of 72"
			value="72 ÷ {ratePct} = {r72.toFixed(2)} ({off(r72)})"
		>
			<Label
				x={PANEL}
				y={204}
				text="rule of 72: 72 ÷ {ratePct} = {r72.toFixed(2)}"
				anchor="start"
				size={13}
				tabular
				halo={false}
			/>
			<Label x={PANEL} y={222} text={off(r72)} anchor="start" size={12} muted halo={false} />
		</Readout>
		<Readout
			id="r70"
			order={4}
			label="Rule of 70"
			value="70 ÷ {ratePct} = {r70.toFixed(2)} ({off(r70)})"
		>
			<Label
				x={PANEL}
				y={252}
				text="rule of 70: 70 ÷ {ratePct} = {r70.toFixed(2)}"
				anchor="start"
				size={13}
				tabular
				halo={false}
			/>
			<Label x={PANEL} y={270} text={off(r70)} anchor="start" size={12} muted halo={false} />
		</Readout>
	{:else if phase === 'steady'}
		{@const ka = Math.floor(sc)}
		<Axes
			sx={ax}
			sy={ay}
			xLabel="steps"
			yTicks={[0, 1e6, 2e6]}
			yFormat={(v: number) => (v === 0 ? '0' : `${v / 1e6}M`)}
		/>
		<Axes
			sx={bx}
			sy={by}
			xLabel="steps"
			yTicks={[0, 2, 4, 6, 8]}
			yFormat={(e: number) => pow10(e)}
		/>
		<Label x={(A.left + A.right) / 2} y={70} text="ordinary axis" size={14} weight={600} />
		<Label x={(B.left + B.right) / 2} y={70} text="log axis" size={14} weight={600} />
		{@const expA = path(revealed(sExp, sc, ax, (v) => ay(v)))}
		{@const slowA = path(revealed(sSlow, sc, ax, (v) => ay(v)))}
		<g clip-path="url(#growth-clip-a)">
			<path d={slowA} fill="none" stroke="var(--xl-slow)" stroke-width="2.5" />
			<path d={expA} fill="none" stroke="var(--xl-mul)" stroke-width="2.5" />
		</g>
		<path
			d={path(revealed(sSlow, sc, bx, byv))}
			fill="none"
			stroke="var(--xl-slow)"
			stroke-width="2.5"
		/>
		<path
			d={path(revealed(sExp, sc, bx, byv))}
			fill="none"
			stroke="var(--xl-mul)"
			stroke-width="2.5"
		/>
		<Readout
			id="steady"
			order={1}
			label="Steady growth"
			value="{times(f)} every step"
			color="var(--xl-mul)"
		>
			<line x1={100} x2={122} y1={536} y2={536} stroke="var(--xl-mul)" stroke-width="3" />
			<Label
				x={130}
				y={540}
				text="steady: {times(f)} every step, at step {ka} still {times(f)}"
				anchor="start"
				size={13}
				halo={false}
			/>
		</Readout>
		<Readout
			id="slow"
			order={2}
			label="Slowing growth"
			value="{times(f)} at first, now ×{lastFactor.toFixed(3)}"
			color="var(--xl-slow)"
		>
			<line x1={100} x2={122} y1={562} y2={562} stroke="var(--xl-slow)" stroke-width="3" />
			<Label
				x={130}
				y={566}
				text="slowing (food runs out at a million): {times(f)} at first, ×{lastFactor.toFixed(
					3
				)} at step {ka}"
				anchor="start"
				size={13}
				tabular
				halo={false}
			/>
		</Readout>
	{:else if phase === 'decay'}
		<Axes
			sx={kx}
			sy={kLin}
			xLabel="years"
			yLabel={w < 0.5 ? 'carbon-14 left (%)' : ''}
			xTicks={[0, 11400, 22800, 34200, 45600, 57000]}
			opacity={1 - w}
		/>
		{#if w > 0.02}
			<Axes
				sx={kx}
				sy={kLog}
				xTicks={[]}
				yTicks={[-2, -1, 0, 1, 2]}
				yFormat={(e: number) => `${fmt(10 ** e)} %`}
				yLabel={w >= 0.5 ? 'carbon-14 left (log scale)' : ''}
				opacity={w}
			/>
		{/if}
		{#each { length: 10 }, i (i)}
			{@const yr = (i + 1) * HALF}
			<line
				x1={kx(yr)}
				x2={kx(yr)}
				y1={ky(left(yr))}
				y2={BOT}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 3"
				stroke-width="1"
				opacity="0.6"
			/>
			{#if i < 3 && Math.abs(kx(yr) - agePt.x) > 24}
				<Readout id="half-{i}">
					<Label
						x={kx(yr) + 8}
						y={ky(left(yr)) - 8}
						text={['½', '¼', '⅛'][i]}
						anchor="start"
						size={14}
						weight={600}
					/>
				</Readout>
			{/if}
		{/each}
		<path d={path(decayPts)} fill="none" stroke="var(--xl-mul)" stroke-width="2.5" />
		<line
			x1={agePt.x}
			x2={agePt.x}
			y1={agePt.y}
			y2={BOT}
			stroke="var(--stage-ink)"
			stroke-width="1"
		/>
		<Handle
			x={agePt.x}
			y={agePt.y}
			label="Age of the sample"
			value={ageV}
			min={0}
			max={YEARS}
			valuetext="{fmt(ageV)} years"
			color="var(--xl-mul)"
			onmove={(p: Point) =>
				setParam('age', Math.round(clamp(kx.invert(p.x), 0, YEARS) / 100) * 100)}
			onkey={(s) =>
				setParam('age', s === 'start' ? 0 : s === 'end' ? YEARS : clamp(ageV + s * 100, 0, YEARS))}
		/>
		<Readout id="age" order={1} label="Age" value="{fmt(ageV)} years">
			<Label x={PANEL} y={90} text="age" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={114}
				text="{fmt(ageV)} years"
				anchor="start"
				size={18}
				weight={600}
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="hl" order={2} label="Half-lives" value={(ageV / HALF).toFixed(2)}>
			<Label
				x={PANEL}
				y={150}
				text="= {(ageV / HALF).toFixed(2)} half-lives"
				anchor="start"
				size={14}
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="left" order={3} label="Carbon-14 left" value={pctText(left(ageV))}>
			<Label x={PANEL} y={190} text="carbon-14 left" anchor="start" size={12} muted halo={false} />
			<Label
				x={PANEL}
				y={214}
				text={pctText(left(ageV))}
				anchor="start"
				size={18}
				weight={600}
				tabular
				color="var(--xl-mul)"
				halo={false}
			/>
		</Readout>
		<Readout id="halving" order={4} label="Halvings" value="(½)^{(ageV / HALF).toFixed(2)}">
			<Label
				x={PANEL}
				y={250}
				text="½ multiplied {(ageV / HALF).toFixed(2)} times"
				anchor="start"
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{/if}
</g>
