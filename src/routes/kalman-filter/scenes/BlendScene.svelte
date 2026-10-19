<script lang="ts">
	/**
	 * Two Gaussian guesses of a robot's position on a rail (../model.ts `blend`): the prediction
	 * at 10 m and the measurement at 16 m, each with the σ of its control, and their product,
	 * renormalised: the estimate, between them and narrower than both. All three are true
	 * densities on one vertical scale (fitted to the tallest), so the narrower curve is the
	 * taller. The prediction appears, then the measurement, then the estimate slides out of the
	 * prediction to its place (complete by 2.2 s, so the reduced-motion frame shows all three).
	 * Under the axis, the gain K as the share of the way from the prediction to the reading.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Label, clamp, easeInOut, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { blend } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const MP = 10;
	const Z = 16;
	const sp = $derived(Number(params.priorSigma ?? 3));
	const sm = $derived(Number(params.measSigma ?? 2));
	const b = $derived(blend(MP, sp * sp, Z, sm * sm));
	const se = $derived(Math.sqrt(b.variance));

	const X0 = 70;
	const X1 = 890;
	const BASE = 430;
	const H = 300;
	const sx = scale([-4, 30], [X0, X1]);
	const pdf = (x: number, m: number, s: number) =>
		Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

	// the vertical scale follows the tallest curve, smoothly
	const peak = $derived(pdf(0, 0, Math.min(sp, sm, se)));
	const top = new Tween(0.2, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = peak;
		untrack(() => top.set(p));
	});
	const sy = (d: number) => BASE - (d / top.current) * H;

	function curve(m: number, s: number) {
		const pts: string[] = [];
		const lo = Math.max(-4, m - 4.5 * s);
		const hi = Math.min(30, m + 4.5 * s);
		for (let i = 0; i <= 120; i++) {
			const x = lo + ((hi - lo) * i) / 120;
			pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(pdf(x, m, s)).toFixed(1)}`);
		}
		return pts.join(' ');
	}
	const area = (d: string, m: number, s: number) =>
		`${d} L${sx(Math.min(30, m + 4.5 * s)).toFixed(1)} ${BASE} L${sx(Math.max(-4, m - 4.5 * s)).toFixed(1)} ${BASE} Z`;

	const tt = $derived(reduced ? 10 : t);
	const oPred = $derived(smoothstep(0, 0.6, tt));
	const oMeas = $derived(smoothstep(0.6, 1.2, tt));
	const u = $derived(easeInOut(clamp((tt - 1.3) / 0.9)));
	const oEst = $derived(smoothstep(1.2, 1.5, tt));
	// the estimate grows out of the prediction
	const em = $derived(MP + (b.mean - MP) * u);
	const es = $derived(sp + (se - sp) * u);

	const pPath = $derived(curve(MP, sp));
	const mPath = $derived(curve(Z, sm));
	const ePath = $derived(curve(em, es));

	const KY = 500;
	const fmt = (v: number, d = 1) => v.toFixed(d);
</script>

<g>
	<Readout id="title" order={1} label="On a rail" value="a prediction and a measurement">
		<Label
			x={24}
			y={34}
			text="where is the robot? a prediction, a measurement, and Bayes' rule"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- axis -->
	<line x1={X0} x2={X1} y1={BASE} y2={BASE} stroke="var(--stage-line)" stroke-width="1.2" />
	{#each [0, 5, 10, 15, 20, 25, 30] as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={BASE} y2={BASE + 6} stroke="var(--stage-line)" />
		<Label x={sx(v)} y={BASE + 22} text={String(v)} size={11} muted halo={false} />
	{/each}
	<Label x={X1} y={BASE + 40} text="position on the rail (m)" size={11} anchor="end" muted />

	<!-- prediction -->
	<g opacity={oPred}>
		<path d={area(pPath, MP, sp)} fill="var(--kf-pred)" opacity="0.12" />
		<path d={pPath} fill="none" stroke="var(--kf-pred)" stroke-width="2.2" />
		<line
			x1={sx(MP)}
			x2={sx(MP)}
			y1={BASE}
			y2={sy(pdf(0, 0, sp))}
			stroke="var(--kf-pred)"
			stroke-dasharray="3 3"
		/>
		<Readout
			id="pred"
			order={2}
			label="Prediction"
			value="10 m ± {fmt(sp)} m"
			color="var(--kf-pred)"
		>
			<Label
				x={Math.max(200, sx(MP - 1.18 * sp)) - 8}
				y={sy(pdf(0, 0, sp) / 2) - 6}
				text="prediction 10 m, σ {fmt(sp)} m"
				size={12}
				anchor="end"
				color="var(--kf-pred)"
				weight={600}
			/>
		</Readout>
	</g>

	<!-- measurement -->
	<g opacity={oMeas}>
		<path d={area(mPath, Z, sm)} fill="var(--kf-meas)" opacity="0.12" />
		<path d={mPath} fill="none" stroke="var(--kf-meas)" stroke-width="2.2" />
		<line
			x1={sx(Z)}
			x2={sx(Z)}
			y1={BASE}
			y2={sy(pdf(0, 0, sm))}
			stroke="var(--kf-meas)"
			stroke-dasharray="3 3"
		/>
		<Readout
			id="meas"
			order={3}
			label="Measurement"
			value="16 m ± {fmt(sm)} m"
			color="var(--kf-meas)"
		>
			<Label
				x={Math.min(750, sx(Z + 1.18 * sm)) + 8}
				y={sy(pdf(0, 0, sm) / 2) - 6}
				text="measurement 16 m, σ {fmt(sm)} m"
				size={12}
				anchor="start"
				color="var(--kf-meas)"
				weight={600}
			/>
		</Readout>
	</g>

	<!-- estimate -->
	<g opacity={oEst}>
		<path d={area(ePath, em, es)} fill="var(--kf-est)" opacity="0.18" />
		<path d={ePath} fill="none" stroke="var(--kf-est)" stroke-width="3" />
		<line
			x1={sx(em)}
			x2={sx(em)}
			y1={BASE}
			y2={sy(pdf(0, 0, es))}
			stroke="var(--kf-est)"
			stroke-width="1.5"
		/>
		<Readout
			id="est"
			order={4}
			label="Estimate"
			value="{fmt(b.mean)} m ± {fmt(se, 2)} m"
			color="var(--kf-est)"
		>
			<Label
				x={sx(em)}
				y={Math.max(62, sy(pdf(0, 0, es)) - 14)}
				text="estimate {fmt(b.mean)} m, σ {fmt(se, 2)} m"
				size={13}
				weight={700}
				color="var(--kf-est)"
			/>
		</Readout>
	</g>

	<!-- the gain: how far the estimate moves from the prediction towards the reading -->
	<g opacity={oEst}>
		<line
			x1={sx(MP)}
			x2={sx(Z)}
			y1={KY}
			y2={KY}
			stroke="var(--stage-line)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={sx(MP)}
			x2={sx(MP + (Z - MP) * b.K * u)}
			y1={KY}
			y2={KY}
			stroke="var(--kf-est)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<circle cx={sx(MP)} cy={KY} r="5" fill="var(--kf-pred)" />
		<circle cx={sx(Z)} cy={KY} r="5" fill="var(--kf-meas)" />
		<Readout
			id="gain"
			order={5}
			label="Gain K"
			value="{fmt(b.K, 2)}: {Math.round(b.K * 100)} % of the way to the reading"
		>
			<Label
				x={sx(MP) - 14}
				y={KY + 5}
				text="gain K = σp² ÷ (σp² + σm²) = {fmt(b.K, 2)}"
				size={13}
				anchor="end"
				weight={600}
				tabular
			/>
			<Label
				x={sx(Z) + 14}
				y={KY + 5}
				text="{Math.round(b.K * 100)} % of the way to the reading"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
		<Readout id="narrower">
			<Label
				x={480}
				y={KY + 46}
				text={se < Math.min(sp, sm)
					? `the estimate's σ, ${fmt(se, 2)} m, is smaller than both: ${fmt(sp)} m and ${fmt(sm)} m`
					: ''}
				size={12}
				muted
			/>
		</Readout>
	</g>
</g>
