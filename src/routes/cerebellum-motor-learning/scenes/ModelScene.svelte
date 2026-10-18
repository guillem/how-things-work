<script lang="ts">
	/**
	 * The models on a fixed schedule of reaches, plotted as correction (how far the reach turned
	 * against the rotation) against reach number.
	 *
	 * Mode (`step.hints.mode`):
	 *   single   — one rate, x(n+1) = A·x + B·e, with the A and B sliders; its plateau and time
	 *              constant marked. Schedule: baseline, 150 rotated reaches, 50 with no cursor.
	 *   two      — the two-rate model on the same schedule: fast, slow and their sum.
	 *   recovery — Smith et al.'s protocol: adapt, reverse until the sum is zero, hide the errors;
	 *              optionally one rate on the same protocol.
	 *   patients — the two-rate model with healthy B and with both B scaled down (slider).
	 *   strategy — target error with and without an explicit strategy that aims 30° the other way.
	 *
	 * Motion: the curves draw themselves in over the first three seconds; reduced motion shows
	 * them whole.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ADAPT,
		adaptThenHide,
		BASELINE,
		block,
		ONE_RATE,
		plateau,
		recoveryProtocol,
		ROTATION,
		runOneRate,
		runTwoRate,
		scaleB,
		SMITH_FIT,
		strategyErrors,
		timeConstant,
		type Trial
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	type Mode = 'single' | 'two' | 'recovery' | 'patients' | 'strategy';
	const mode = $derived(String(step.hints?.mode ?? 'single') as Mode);
	const A = $derived(Number(params.A ?? ONE_RATE.A));
	const B = $derived(Number(params.B ?? ONE_RATE.B));
	const damage = $derived(Number(params.damage ?? 0.33));
	const showOne = $derived(params.oneRate !== false);

	interface Series {
		id: string;
		values: number[];
		color: string;
		width: number;
		dash?: string;
		label: string;
	}

	const recovery = recoveryProtocol();
	/**
	 * The single rate through the same protocol, with its own (longer) reversal until zero: its
	 * adaptation is shortened by the difference so that its hidden block starts on the same reach.
	 */
	const oneRecovery = (() => {
		const reverseOf = (adapt: number) => {
			const head = [...block(BASELINE, 0), ...block(adapt, ROTATION)];
			let k = 0;
			let x: number[];
			do {
				k++;
				x = runOneRate([...head, ...block(k, -ROTATION)], ONE_RATE.A, ONE_RATE.B);
			} while (x[x.length - 1] > 0 && k < 200);
			return k;
		};
		let adapt = ADAPT;
		for (let i = 0; i < 5; i++) adapt = ADAPT + recovery.reverse - reverseOf(adapt);
		const k = ADAPT + recovery.reverse - adapt;
		const trials = [
			...block(BASELINE, 0),
			...block(adapt, ROTATION),
			...block(k, -ROTATION),
			...block(60, 0, false)
		];
		return {
			values: runOneRate(trials, ONE_RATE.A, ONE_RATE.B).slice(0, trials.length),
			from: BASELINE + adapt,
			reverse: k
		};
	})();
	const strategy = strategyErrors(ADAPT);

	const schedule = $derived<Trial[]>(
		mode === 'recovery'
			? recovery.trials
			: mode === 'strategy'
				? [...block(BASELINE, 0), ...block(ADAPT, ROTATION)]
				: adaptThenHide()
	);
	const total = $derived(schedule.length);

	const series = $derived.by((): Series[] => {
		const n = total;
		if (mode === 'single') {
			return [
				{
					id: 'one',
					values: runOneRate(schedule, A, B).slice(0, n),
					color: 'var(--cb-model)',
					width: 2.5,
					label: 'one rate: x'
				}
			];
		}
		if (mode === 'patients') {
			const h = runTwoRate(schedule).slice(0, n);
			const p = runTwoRate(schedule, scaleB(SMITH_FIT, damage)).slice(0, n);
			return [
				{
					id: 'healthy',
					values: h.map((s) => s.total),
					color: 'var(--cb-model)',
					width: 2.5,
					label: 'healthy'
				},
				{
					id: 'patient',
					values: p.map((s) => s.total),
					color: 'var(--cb-patient)',
					width: 2.5,
					label: `cerebellar damage: B × ${damage.toFixed(2)}`
				}
			];
		}
		if (mode === 'strategy') {
			const pad = Array.from({ length: BASELINE }, () => 0);
			return [
				{
					id: 'plain',
					values: [...pad, ...strategy.plain],
					color: 'var(--cb-model)',
					width: 2.5,
					label: 'no strategy'
				},
				{
					id: 'strategy',
					values: [...pad, ...strategy.strategy],
					color: 'var(--cb-patient)',
					width: 2.5,
					label: 'aiming 30° the other way'
				}
			];
		}
		const s = runTwoRate(schedule).slice(0, n);
		const out: Series[] = [
			{
				id: 'fast',
				values: s.map((x) => x.fast),
				color: 'var(--cb-fast)',
				width: 2,
				label: 'fast'
			},
			{
				id: 'slow',
				values: s.map((x) => x.slow),
				color: 'var(--cb-slow)',
				width: 2,
				label: 'slow'
			},
			{
				id: 'total',
				values: s.map((x) => x.total),
				color: 'var(--cb-model)',
				width: 3,
				label: 'fast + slow'
			}
		];
		if (mode === 'recovery' && showOne)
			out.unshift({
				id: 'one',
				values: oneRecovery.values,
				color: 'var(--stage-ink-muted)',
				width: 2,
				dash: '6 4',
				label: 'one rate (its own reversal)'
			});
		return out;
	});

	const sx = $derived(scale([0, total], [100, 920]));
	const sy = $derived(
		mode === 'strategy' || mode === 'recovery'
			? scale([-35, 35], [530, 120])
			: scale([-10, 35], [530, 120])
	);
	const yTicks = $derived(
		mode === 'strategy' || mode === 'recovery' ? [-30, -15, 0, 15, 30] : [-10, 0, 10, 20, 30]
	);

	const grow = $derived(reduced ? 1 : smoothstep(0, 3, t));
	const upto = $derived(Math.max(2, Math.round(total * grow)));
	const pathOf = (v: number[]) =>
		v
			.slice(0, upto)
			.map((y, i) => `${i === 0 ? 'M' : 'L'}${sx(i + 0.5).toFixed(1)} ${sy(y).toFixed(1)}`)
			.join(' ');

	/** The rotation (or, for the strategy, the target), trial by trial. */
	const rotPath = $derived.by(() => {
		if (mode === 'strategy') return '';
		let d = '';
		schedule.forEach((tr, i) => {
			const r = tr.feedback ? tr.rotation : 0;
			d += `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)} ${sy(r).toFixed(1)} L${sx(i + 1).toFixed(1)} ${sy(r).toFixed(1)} `;
		});
		return d;
	});
	/** The trials with no cursor, shaded. */
	const hiddenFrom = $derived(schedule.findIndex((tr) => !tr.feedback));

	const fmt1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}°`;
	const fmt = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}°`;

	// single: plateau and time constant
	const tau = $derived(B > 0 ? timeConstant(A, B) : Infinity);
	const top = $derived(B > 0 ? plateau(A, B) : 0);
	const tauText = $derived(
		Number.isFinite(tau) ? `${tau < 10 ? tau.toFixed(1) : Math.round(tau)} reaches` : 'no learning'
	);

	// recovery: the rebound's peak
	const rec = $derived.by(() => {
		if (mode !== 'recovery') return null;
		const tot = series.find((s) => s.id === 'total')?.values ?? [];
		const from = BASELINE + ADAPT + recovery.reverse;
		let k = from;
		for (let i = from; i < tot.length; i++) if (tot[i] > tot[k]) k = i;
		return { at: k, value: tot[k], from };
	});

	// patients: the end of adaptation
	const endAdapt = BASELINE + ADAPT;
	const title = $derived(
		{
			single: 'One error-driven learner: x(n+1) = A·x(n) + B·e(n)',
			two: 'Two learners, one error: fast + slow (Smith et al. 2006 fit)',
			recovery: 'Adapt, reverse until zero, then hide the errors',
			patients: 'The same model with weaker error sensitivity',
			strategy: 'Cursor error at the target, with and without a strategy'
		}[mode]
	);
</script>

<g>
	<Readout id="title" order={0} label="Chart" value={title}>
		<Label x={24} y={34} anchor="start" size={15} weight={700} text={title} />
	</Readout>

	<!-- phases -->
	{#if hiddenFrom >= 0}
		<rect
			x={sx(hiddenFrom)}
			y={sy.range[1]}
			width={sx(total) - sx(hiddenFrom)}
			height={sy.range[0] - sy.range[1]}
			fill="var(--stage-grid)"
			opacity="0.6"
		/>
		<Readout id="hidden-label">
			<Label
				x={(sx(hiddenFrom) + sx(total)) / 2}
				y={sy.range[1] + 16}
				size={11}
				muted
				text={mode === 'recovery' ? 'errors hidden' : 'cursor hidden'}
			/>
		</Readout>
	{/if}
	{#if mode === 'recovery'}
		{@const r0 = BASELINE + ADAPT}
		<rect
			x={sx(r0)}
			y={sy.range[1]}
			width={sx(r0 + recovery.reverse) - sx(r0)}
			height={sy.range[0] - sy.range[1]}
			fill="var(--cb-fast)"
			opacity="0.12"
		/>
		{#if showOne}
			<rect
				x={sx(oneRecovery.from)}
				y={sy.range[0] - 10}
				width={sx(oneRecovery.from + oneRecovery.reverse) - sx(oneRecovery.from)}
				height="10"
				fill="var(--stage-ink-muted)"
				opacity="0.35"
			/>
			<Readout id="one-rev">
				<Label
					x={sx(oneRecovery.from) - 6}
					y={sy.range[0] - 2}
					anchor="end"
					size={11}
					muted
					text="one rate's reversal: {oneRecovery.reverse} reaches"
				/>
			</Readout>
		{/if}
	{/if}

	<Axes
		{sx}
		{sy}
		{yTicks}
		yFormat={(v) => `${v}°`}
		xLabel="reach"
		yLabel={mode === 'strategy' ? 'cursor error (°)' : 'correction (°)'}
	/>
	<line
		x1={sx(0)}
		x2={sx(total)}
		y1={sy(0)}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>
	{#if rotPath}
		<path
			d={rotPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
	{/if}

	{#if mode === 'single' && Number.isFinite(top)}
		<line
			x1={sx(BASELINE)}
			x2={sx(BASELINE + ADAPT)}
			y1={sy(top)}
			y2={sy(top)}
			stroke="var(--cb-model)"
			stroke-width="1"
			stroke-dasharray="2 3"
		/>
		{#if Number.isFinite(tau) && tau < ADAPT}
			{@const xt = sx(BASELINE + tau)}
			<line
				x1={xt}
				x2={xt}
				y1={sy(0)}
				y2={sy(top * (1 - Math.exp(-1)))}
				stroke="var(--cb-model)"
				stroke-width="1"
				stroke-dasharray="2 3"
			/>
			<circle cx={xt} cy={sy(top * (1 - Math.exp(-1)))} r="4" fill="var(--cb-model)" />
		{/if}
	{/if}

	{#each series as s (s.id)}
		<path
			d={pathOf(s.values)}
			fill="none"
			stroke={s.color}
			stroke-width={s.width}
			stroke-dasharray={s.dash}
			stroke-linejoin="round"
		/>
	{/each}

	<!-- legend -->
	{#each series as s, i (s.id)}
		<Readout id="key-{s.id}" order={2 + i} label={s.label} value="" color={s.color}>
			<line
				x1={110 + i * 190}
				x2={134 + i * 190}
				y1={72}
				y2={72}
				stroke={s.color}
				stroke-width={s.width}
				stroke-dasharray={s.dash}
			/>
			<Label x={140 + i * 190} y={76} anchor="start" size={12} text={s.label} color={s.color} />
		</Readout>
	{/each}
	{#if mode !== 'strategy'}
		<Readout id="key-rot">
			<Label
				x={sx(BASELINE + 4)}
				y={sy(ROTATION) - 8}
				anchor="start"
				size={11}
				muted
				text="rotation 30°"
			/>
		</Readout>
	{/if}

	<!-- mode-specific readouts -->
	{#if mode === 'single'}
		<Readout id="tau" order={10} label="Time constant −1/ln(A − B)" value={tauText}>
			<Label
				x={560}
				y={480}
				anchor="start"
				size={14}
				weight={600}
				tabular
				text="time constant: {tauText}"
			/>
		</Readout>
		<Readout
			id="top"
			order={11}
			label="Plateau B·30° / (1 − A + B)"
			value={Number.isFinite(top) ? fmt(top) : '—'}
		>
			<Label
				x={560}
				y={502}
				anchor="start"
				size={14}
				weight={600}
				tabular
				text="plateau: {Number.isFinite(top) ? fmt(top) : '—'} of 30°"
			/>
		</Readout>
	{:else if mode === 'two'}
		{@const s = runTwoRate(schedule)}
		<Readout
			id="ten"
			order={10}
			label="After 10 reaches"
			value="{fmt(s[BASELINE + 10].total)} ({fmt(s[BASELINE + 10].fast)} fast)"
		>
			<Label
				x={sx(BASELINE + 12)}
				y={sy(s[BASELINE + 10].total) - 26}
				anchor="start"
				size={12}
				text="10 reaches: {fmt(s[BASELINE + 10].total)}, {fmt(s[BASELINE + 10].fast)} of it fast"
				opacity={grow > 0.15 ? 1 : 0}
			/>
		</Readout>
		<Readout
			id="end"
			order={11}
			label="After 150"
			value="{fmt(s[endAdapt].total)} ({fmt(s[endAdapt].slow)} slow)"
		>
			<Label
				x={sx(endAdapt) - 6}
				y={sy(s[endAdapt].total) - 14}
				anchor="end"
				size={12}
				text="150 reaches: {fmt(s[endAdapt].total)}, {fmt(s[endAdapt].slow)} slow"
				opacity={grow > 0.75 ? 1 : 0}
			/>
		</Readout>
	{:else if mode === 'recovery' && rec}
		<Readout
			id="zero"
			order={10}
			label="After the reversal"
			value="sum 0°, fast {fmt(
				series.find((s) => s.id === 'fast')?.values[rec.from] ?? 0
			)}, slow {fmt(series.find((s) => s.id === 'slow')?.values[rec.from] ?? 0)}"
		>
			<Label
				x={sx(rec.from) - 8}
				y={sy(-24)}
				anchor="end"
				size={12}
				text="reversed {recovery.reverse} reaches: sum crossed zero ({fmt1(
					series.find((s) => s.id === 'total')?.values[rec.from] ?? 0
				)})"
				opacity={grow > 0.8 ? 1 : 0}
			/>
		</Readout>
		<Readout
			id="peak"
			order={11}
			label="Rebound"
			value="{fmt(rec.value)}, {rec.at - rec.from} reaches later"
		>
			<Label
				x={sx(rec.at) + 8}
				y={sy(rec.value) - 12}
				anchor="start"
				size={12}
				weight={600}
				text="rebound: {fmt(rec.value)}"
				opacity={grow > 0.95 ? 1 : 0}
			/>
		</Readout>
	{:else if mode === 'patients'}
		{@const h = series[0].values}
		{@const p = series[1].values}
		<Readout
			id="ends"
			order={10}
			label="After 150 reaches"
			value="healthy {fmt(h[endAdapt - 1])}, patient {fmt(p[endAdapt - 1])}"
		>
			<Label
				x={sx(endAdapt) - 6}
				y={sy(p[endAdapt - 1]) + 22}
				anchor="end"
				size={12}
				text="patient: {fmt(p[endAdapt - 1])} after 150 reaches"
				color="var(--cb-patient)"
				opacity={grow > 0.75 ? 1 : 0}
			/>
		</Readout>
	{:else if mode === 'strategy'}
		<Readout
			id="drift"
			order={10}
			label="With the strategy, after 150"
			value="{fmt(strategy.strategy[ADAPT - 1])} past the target"
		>
			<Label
				x={sx(BASELINE + ADAPT) - 6}
				y={sy(strategy.strategy[ADAPT - 1]) + 22}
				anchor="end"
				size={12}
				weight={600}
				color="var(--cb-patient)"
				text="drifts {fmt(-strategy.strategy[ADAPT - 1])} past the target"
				opacity={grow > 0.75 ? 1 : 0}
			/>
		</Readout>
		<Readout id="hit">
			<Label x={sx(1)} y={sy(0) - 8} anchor="start" size={11} muted text="0: on target" />
		</Readout>
	{/if}
</g>
