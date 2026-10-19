<script lang="ts">
	/**
	 * The plane tracker (./runs.ts `trackRun`): a 60 s drive simulated from the filter's own
	 * motion model, GPS fixes with the `gps` control's σ, and the filter's estimate. Left, the
	 * whole drive: the true path, the fixes so far, the estimate's trail and its 95 % ellipse,
	 * with the close-up's window. Middle, the close-up following the estimate through each
	 * one-second cycle: predict (the ellipse grows from the last one, dashed, moving along the
	 * velocity arrow), the fix arriving with its own 95 % circle, update (the ellipse shrinks,
	 * the estimate moving K × the innovation). Right, the same belief along x as position
	 * against velocity: the prediction shears it (F adds the velocity to the position), the fix
	 * squeezes it along position and, through the tilt, corrects the velocity too. Position
	 * ellipses are circles here because both axes have the same noise. Hint `focus`:
	 * 'predict' | 'update' run a cycle every 1.6 s, 'gain' every 0.4 s. The drive starts 6 s in
	 * and holds at its end. Reduced motion: the last second, frozen after the prediction
	 * ('predict') or after the update (otherwise).
	 */
	import { Label, clamp, easeInOut } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fixErrors, positionCov, rms, sigmaOf } from '../model';
	import {
		TRACK,
		bounds,
		covEllipseAttrs,
		ellipseAttrs,
		fit,
		fmt,
		mix,
		trackRun,
		xvCov
	} from './runs';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'predict'));
	const r = $derived(Number(params.gps ?? 8));
	const run = $derived(trackRun(r));
	const N = TRACK.n;

	// ---- time: cycle k, phase u in [0, 1)
	const period = $derived(focus === 'gain' ? 0.4 : 1.6);
	const K0 = 6;
	const clock = $derived.by(() => {
		if (reduced) return { k: N - 1, u: focus === 'predict' ? 0.399 : 1 };
		const c = K0 + t / period;
		if (c >= N) return { k: N - 1, u: 1 };
		return { k: Math.floor(c), u: c - Math.floor(c) };
	});
	const k = $derived(clock.k);
	const u = $derived(clock.u);
	// phases: predict 0–0.4, the fix arrives 0.4–0.55, update 0.55–0.9, hold
	const uPred = $derived(easeInOut(clamp(u / 0.4)));
	const uFix = $derived(clamp((u - 0.4) / 0.15));
	const uUpd = $derived(easeInOut(clamp((u - 0.55) / 0.35)));
	const phase = $derived(u < 0.4 ? 'predict' : u < 0.55 ? 'fix' : 'update');
	const predColor = $derived(u < 0.55 ? 'var(--kf-pred)' : 'var(--kf-est)');

	const S = $derived(run.steps[k]);
	const prevPost = $derived(run.steps[k - 1].post);
	const belief = $derived(u < 0.4 ? mix(prevPost, S.prior, uPred) : mix(S.prior, S.post, uUpd));
	const ghost = $derived(u < 0.55 ? prevPost : S.prior);
	const fix = $derived(S.z);
	// the truth moves through the cycle with the prediction
	const truthNow = $derived.by(() => {
		const a = run.truth.states[k - 1];
		const b = run.truth.states[k];
		const w = u < 0.4 ? uPred : 1;
		return a.map((v, i) => v + (b[i] - v) * w);
	});

	// ---- the map
	const box = bounds(trackRun(8).truth.states);
	const map = fit(box, { x: 24, y: 76, w: 410, h: 470 }, 14);
	const line = (
		pts: readonly (readonly number[])[],
		x: (m: number) => number,
		y: (m: number) => number
	) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
	const truthAll = $derived(line(run.truth.states, map.x, map.y));
	const truthDone = $derived(line(run.truth.states.slice(0, k + 1), map.x, map.y));
	const trail = $derived(
		line([...run.steps.slice(0, k).map((s) => s.post.x), belief.x], map.x, map.y)
	);
	const fixesShown = $derived(
		run.fixes.slice(0, u >= 0.4 ? k + 1 : k).flatMap((z, i) => (z ? [{ z, i }] : []))
	);

	// ---- the close-up of position
	const ZX = 456;
	const ZY = 76;
	const ZW = 232;
	const W = $derived(Math.max(10, 3.2 * r));
	const zs = $derived(ZW / (2 * W));
	const zx = (m: number) => ZX + ZW / 2 + (m - belief.x[0]) * zs;
	const zy = (m: number) => ZY + ZW / 2 - (m - belief.x[1]) * zs;
	const gridStep = $derived(W > 60 ? 25 : W > 25 ? 10 : 5);
	const gridLines = (c: number) => {
		const out: number[] = [];
		for (let v = Math.ceil((c - W) / gridStep) * gridStep; v <= c + W; v += gridStep) out.push(v);
		return out;
	};
	const zoomTruth = $derived(
		line(run.truth.states.slice(Math.max(0, k - 6), Math.min(N, k + 4)), zx, zy)
	);
	const recentFixes = $derived(
		run.fixes.slice(Math.max(0, k - 5), k).flatMap((z, i) => (z ? [{ z, i }] : []))
	);
	const fixR = $derived(Math.sqrt(-2 * Math.log(0.05)) * r * zs);

	// ---- position against velocity, along x
	const VX = 704;
	const VW = 232;
	// velocity range: a few σ of the predicted velocity, fixed for each GPS noise
	const WV = $derived(Math.max(1, 3.2 * Math.sqrt(run.steps[N - 1].prior.P[2][2])));
	const vsx = $derived(VW / (2 * W));
	const vsy = $derived(VW / (2 * WV));
	const vcx = VX + VW / 2;
	const vcy = ZY + ZW / 2;

	// ---- readouts
	const gain = $derived(S.K ? S.K[0][0] : 0);
	const claimed = $derived(sigmaOf(positionCov(S.post.P)));
	const realKf = $derived(rms(run.errors.slice(5)) / Math.SQRT2);
	const realGps = $derived(rms(fixErrors(run.truth, run.fixes).slice(5)) / Math.SQRT2);
	const oPred = $derived(focus === 'update' ? 0.5 : 1);
	const oUpd = $derived(focus === 'predict' ? 0.5 : 1);
</script>

<g>
	<defs>
		<clipPath id="kf-track-zoom">
			<rect x={ZX} y={ZY} width={ZW} height={ZW} rx="8" />
		</clipPath>
		<clipPath id="kf-track-map">
			<rect x="16" y="70" width="424" height="486" />
		</clipPath>
		<clipPath id="kf-track-xv">
			<rect x={VX} y={ZY} width={VW} height={ZW} rx="8" />
		</clipPath>
	</defs>
	<Readout id="title" order={1} label="Tracking a car" value="GPS σ {r} m per axis">
		<Label
			x={24}
			y={34}
			text="a car tracked from GPS fixes (σ {r} m per axis) by a Kalman filter"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={48} y1={58} y2={58} stroke="var(--stage-ink)" stroke-width="1.6" />
		<Label x={54} y={62} text="true path" size={11} anchor="start" muted />
		<circle cx={130} cy={58} r="3" fill="var(--kf-meas)" />
		<Label x={138} y={62} text="GPS fixes" size={11} anchor="start" muted />
		<line x1={206} x2={230} y1={58} y2={58} stroke="var(--kf-est)" stroke-width="2.4" />
		<Label x={236} y={62} text="estimate, 95 % ellipse" size={11} anchor="start" muted />
	</Readout>

	<!-- the map -->
	<g clip-path="url(#kf-track-map)">
		<path d={truthAll} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" opacity="0.25" />
		<path d={truthDone} fill="none" stroke="var(--stage-ink)" stroke-width="1.6" opacity="0.8" />
		{#each fixesShown as f (f.i)}
			<circle cx={map.x(f.z[0])} cy={map.y(f.z[1])} r="2.4" fill="var(--kf-meas)" opacity="0.7" />
		{/each}
		<path d={trail} fill="none" stroke="var(--kf-est)" stroke-width="2.2" />
		<ellipse
			{...ellipseAttrs(belief.P, map.x(belief.x[0]), map.y(belief.x[1]), map.s)}
			fill={predColor}
			fill-opacity="0.2"
			stroke={predColor}
			stroke-width="1.4"
		/>
		<circle cx={map.x(truthNow[0])} cy={map.y(truthNow[1])} r="4" fill="var(--stage-ink)" />
		<rect
			x={map.x(belief.x[0] - W)}
			y={map.y(belief.x[1] + W)}
			width={2 * W * map.s}
			height={2 * W * map.s}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
			rx="3"
		/>
	</g>
	<Readout id="scalebar">
		<line
			x1={24}
			x2={24 + 50 * map.s}
			y1={566}
			y2={566}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<Label x={30 + 50 * map.s} y={570} text="50 m" size={11} anchor="start" muted />
	</Readout>

	<!-- the close-up of position -->
	<rect x={ZX} y={ZY} width={ZW} height={ZW} rx="8" fill="var(--surface)" stroke="var(--border)" />
	<g clip-path="url(#kf-track-zoom)">
		{#each gridLines(belief.x[0]) as gx (gx)}
			<line x1={zx(gx)} x2={zx(gx)} y1={ZY} y2={ZY + ZW} stroke="var(--stage-grid)" />
		{/each}
		{#each gridLines(belief.x[1]) as gy (gy)}
			<line x1={ZX} x2={ZX + ZW} y1={zy(gy)} y2={zy(gy)} stroke="var(--stage-grid)" />
		{/each}
		<path d={zoomTruth} fill="none" stroke="var(--stage-ink)" stroke-width="1.4" opacity="0.5" />
		{#each recentFixes as f (f.i)}
			<circle cx={zx(f.z[0])} cy={zy(f.z[1])} r="3" fill="var(--kf-meas)" opacity="0.35" />
		{/each}
		<ellipse
			{...ellipseAttrs(ghost.P, zx(ghost.x[0]), zy(ghost.x[1]), zs)}
			fill="none"
			stroke={u < 0.55 ? 'var(--kf-est)' : 'var(--kf-pred)'}
			stroke-width="1.4"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
		{#if fix}
			<g opacity={uFix * oUpd}>
				<circle
					cx={zx(fix[0])}
					cy={zy(fix[1])}
					r={fixR}
					fill="var(--kf-meas)"
					fill-opacity="0.07"
					stroke="var(--kf-meas)"
					stroke-dasharray="2 3"
				/>
				<line
					x1={zx(S.prior.x[0])}
					y1={zy(S.prior.x[1])}
					x2={zx(fix[0])}
					y2={zy(fix[1])}
					stroke="var(--kf-meas)"
					stroke-width="1.4"
					stroke-dasharray="4 3"
				/>
				<circle cx={zx(fix[0])} cy={zy(fix[1])} r="5" fill="var(--kf-meas)" />
			</g>
		{/if}
		<ellipse
			{...ellipseAttrs(belief.P, zx(belief.x[0]), zy(belief.x[1]), zs)}
			fill={predColor}
			fill-opacity="0.16"
			stroke={predColor}
			stroke-width="2.2"
		/>
		<line
			x1={zx(belief.x[0])}
			y1={zy(belief.x[1])}
			x2={zx(belief.x[0] + belief.x[2])}
			y2={zy(belief.x[1] + belief.x[3])}
			stroke="var(--kf-pred)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
			opacity={oPred}
		/>
		<circle cx={zx(truthNow[0])} cy={zy(truthNow[1])} r="5" fill="var(--stage-ink)" />
		<circle
			cx={zx(belief.x[0])}
			cy={zy(belief.x[1])}
			r="4.5"
			fill={predColor}
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	</g>
	<Readout id="zoomlabel">
		<Label
			x={ZX + 8}
			y={ZY + 18}
			text="position · grid {gridStep} m"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- position against velocity, along x -->
	<rect x={VX} y={ZY} width={VW} height={ZW} rx="8" fill="var(--surface)" stroke="var(--border)" />
	<g clip-path="url(#kf-track-xv)">
		<line x1={VX} x2={VX + VW} y1={vcy} y2={vcy} stroke="var(--stage-grid)" />
		<line x1={vcx} x2={vcx} y1={ZY} y2={ZY + ZW} stroke="var(--stage-grid)" />
		<ellipse
			{...covEllipseAttrs(
				xvCov(ghost.P),
				vcx + (ghost.x[0] - belief.x[0]) * vsx,
				vcy - (ghost.x[2] - belief.x[2]) * vsy,
				vsx,
				vsy
			)}
			fill="none"
			stroke={u < 0.55 ? 'var(--kf-est)' : 'var(--kf-pred)'}
			stroke-width="1.4"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
		<ellipse
			{...covEllipseAttrs(xvCov(belief.P), vcx, vcy, vsx, vsy)}
			fill={predColor}
			fill-opacity="0.16"
			stroke={predColor}
			stroke-width="2.2"
		/>
		<circle
			cx={vcx + (truthNow[0] - belief.x[0]) * vsx}
			cy={vcy - (truthNow[2] - belief.x[2]) * vsy}
			r="5"
			fill="var(--stage-ink)"
		/>
		<circle cx={vcx} cy={vcy} r="4.5" fill={predColor} stroke="var(--surface)" stroke-width="1.5" />
	</g>
	<Readout id="xvlabel">
		<Label
			x={VX + 8}
			y={ZY + 18}
			text="along x: position vs velocity"
			size={11}
			anchor="start"
			muted
		/>
		<Label
			x={VX + VW - 8}
			y={ZY + ZW - 8}
			text="position x ±{Math.round(W)} m →"
			size={11}
			anchor="end"
			muted
		/>
		<Label
			x={VX + 14}
			y={vcy}
			text="velocity vₓ ±{fmt(WV)} m/s"
			size={11}
			anchor="middle"
			rotate={-90}
			muted
		/>
	</Readout>

	<Readout
		id="phase"
		order={2}
		label={phase === 'update' ? 'Update' : 'Predict'}
		value={phase === 'update'
			? `K = ${fmt(gain, 2)}: move ${Math.round(gain * 100)} % of the way to the fix`
			: 'x⁻ = F x, P⁻ = F P Fᵀ + Q: the ellipse grows and shears'}
		color={phase === 'update' ? 'var(--kf-est)' : 'var(--kf-pred)'}
	>
		<Label
			x={(ZX + VX + VW) / 2}
			y={ZY + ZW + 26}
			text={phase === 'update'
				? `update: K = ${fmt(gain, 2)}, move ${Math.round(gain * 100)} % of the way to the fix; the ellipses shrink`
				: phase === 'fix'
					? 'a GPS fix arrives, with its own 95 % circle'
					: 'predict: x⁻ = F x,  P⁻ = F P Fᵀ + Q: the ellipses grow and shear'}
			size={13}
			weight={700}
			color={phase === 'update'
				? 'var(--kf-est)'
				: phase === 'fix'
					? 'var(--kf-meas)'
					: 'var(--kf-pred)'}
		/>
	</Readout>

	<!-- readouts -->
	<Readout id="time" order={3} label="Time" value="{k} s of {N - 1}">
		<Label
			x={ZX}
			y={392}
			text="t = {k} s · gain on position K = {fmt(gain, 2)}"
			size={14}
			weight={700}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="claim"
		order={4}
		label="Per axis"
		value="GPS {fmt(realGps)} m · filter {fmt(realKf)} m (claims {fmt(claimed)} m)"
	>
		<Label
			x={ZX}
			y={420}
			text="the filter claims σ {fmt(claimed)} m per axis, against the GPS's {r} m"
			size={12}
			anchor="start"
			color="var(--kf-est)"
			weight={600}
			tabular
		/>
		<Label
			x={ZX}
			y={448}
			text="real error over the drive, rms per axis: GPS {fmt(realGps)} m · filter {fmt(realKf)} m"
			size={12}
			anchor="start"
			tabular
		/>
	</Readout>
	{#if focus === 'gain'}
		<Readout id="lean">
			<Label
				x={ZX}
				y={476}
				text={gain < 0.25
					? 'noisy fixes: the filter leans on its model'
					: gain > 0.45
						? 'precise fixes: the filter mostly follows them'
						: 'the gain balances the model against the fixes'}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
