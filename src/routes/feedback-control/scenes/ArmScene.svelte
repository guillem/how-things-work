<script lang="ts">
	/**
	 * A two-joint arm reaching for a target the reader drags. Left: the arm in its
	 * vertical plane (shoulder on a post), the pose its joint targets describe (faint,
	 * dashed), the hand's recent path and the target handle. Right: the readout card,
	 * the hand's distance from the target and the two motors' torques since the target
	 * last moved.
	 *
	 * Each change of target or gains starts a new 10 s run (`moveArm`) from the state
	 * the arm is in at that moment, so it carries on smoothly from where it was (the
	 * guide's sanctioned memo, as in oscillations-resonance/DrivenScene); it starts from
	 * hanging straight down. After 10 s it holds its last pose (the run has settled, or
	 * is held by the motors' limits). Reduced motion: the settled pose of a run from
	 * hanging down.
	 */
	import { Handle, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ARM, joints, moveArm, reach, type ArmRun, type ArmState, type Gains } from '../control';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import Txt from './Txt.svelte';
	import { seriesPath, type Cell } from './shared';

	let { t, params, reduced, setParam }: StageProps = $props();

	const tx = $derived(Number(params.armX ?? 0.55));
	const ty = $derived(Number(params.armY ?? 0.35));
	const gains = $derived<Gains>({
		kp: Number(params.armKp ?? 100),
		kd: Number(params.armKd ?? 10),
		ki: Number(params.armKi ?? 60)
	});
	const goal = $derived(reach(tx, ty));
	const SECONDS = 10;
	const HANGING: ArmState = [-Math.PI / 2, 0, 0, 0, 0, 0];

	// ---- the run: restarted from the current state whenever the target or gains change ----
	let memo: { key: string; start: number; run: ArmRun | null } = { key: '', start: 0, run: null };
	const stateAt = (run: ArmRun, s: number) =>
		run.state[Math.max(0, Math.min(run.state.length - 1, Math.round(s / run.sample)))];
	const current = $derived.by(() => {
		const key = `${goal.q1}|${goal.q2}|${gains.kp}|${gains.kd}|${gains.ki}|${reduced}`;
		if (reduced) {
			if (memo.key !== key)
				memo = { key, start: 0, run: moveArm(HANGING, goal.q1, goal.q2, gains, SECONDS) };
			return memo;
		}
		if (key !== memo.key || t < memo.start) {
			const from = memo.run ? stateAt(memo.run, Math.max(0, t - memo.start)) : HANGING;
			memo = { key, start: memo.run ? t : 0, run: moveArm(from, goal.q1, goal.q2, gains, SECONDS) };
		}
		return memo;
	});
	const run = $derived(current.run!);
	const now = $derived(reduced ? SECONDS : Math.min(SECONDS, Math.max(0, t - current.start)));
	const k = $derived(Math.min(run.q1.length - 1, Math.round(now / run.sample)));
	const q1 = $derived(run.q1[k]);
	const q2 = $derived(run.q2[k]);
	const pose = $derived(joints(q1, q2));
	const aim = $derived(joints(goal.q1, goal.q2));

	// ---- the drawing ------------------------------------------------------------------------------
	const SX = 250;
	const SY = 320;
	const PXM = 280;
	const px = (x: number) => SX + x * PXM;
	const py = (y: number) => SY - y * PXM;
	const trail = $derived.by(() => {
		let d = '';
		const k0 = Math.max(0, k - 45);
		for (let i = k0; i <= k; i++) {
			const j = joints(run.q1[i], run.q2[i]);
			d += `${i === k0 ? 'M' : 'L'}${px(j.hx).toFixed(1)} ${py(j.hy).toFixed(1)}`;
		}
		return d;
	});
	const onmove = (p: Point) => {
		setParam('armX', Math.round(Math.max(0.1, Math.min(0.85, (p.x - SX) / PXM)) * 100) / 100);
		setParam('armY', Math.round(Math.max(-0.6, Math.min(0.75, (SY - p.y) / PXM)) * 100) / 100);
	};
	const onkey = (s: number | 'start' | 'end') => {
		const v = s === 'start' ? 0.1 : s === 'end' ? 0.85 : tx + s * 0.01;
		setParam('armX', Math.round(Math.max(0.1, Math.min(0.85, v)) * 100) / 100);
	};

	// ---- plots -------------------------------------------------------------------------------------
	const P0 = 600;
	const P1 = 928;
	const DP = { top: 140, bottom: 320 };
	const QP = { top: 392, bottom: 540 };
	const sx = scale([0, SECONDS], [P0, P1]);
	const sd = scale([0, 40], [DP.bottom, DP.top]);
	const sq = scale([-60, 60], [QP.bottom, QP.top]);
	const dist = $derived(
		run.q1.map((a, i) => {
			const j = joints(a, run.q2[i]);
			return Math.hypot(j.hx - goal.x, j.hy - goal.y) * 100;
		})
	);
	const distPath = $derived(seriesPath(dist, run.sample, sx, sd, 1, 0, 42));
	const tau1Path = $derived(seriesPath(run.tau1, run.sample, sx, sq, 1));
	const tau2Path = $derived(seriesPath(run.tau2, run.sample, sx, sq, 1));
	const off = $derived(dist[k]);

	const cells: Cell[] = $derived([
		{
			id: 'off',
			label: 'hand to target',
			value: off < 0.5 ? 'on it' : `${off.toFixed(1)} cm`,
			sub: goal.clamped
				? 'target out of reach'
				: gains.ki === 0 && off > 0.5
					? 'sagging: no integral'
					: undefined,
			color: 'var(--fc-response)'
		},
		{
			id: 'shoulder',
			label: 'shoulder motor',
			value: `${run.tau1[k].toFixed(1)} N·m`,
			sub: `limit ${ARM.max1}`,
			color: 'var(--fc-arm)'
		},
		{
			id: 'elbow',
			label: 'elbow motor',
			value: `${run.tau2[k].toFixed(1)} N·m`,
			sub: `limit ${ARM.max2}`,
			color: 'var(--fc-arm2)'
		}
	]);
</script>

<g>
	<defs>
		<clipPath id="arm-plots">
			<rect x={P0} y={DP.top - 4} width={sx(now) - P0 + 1} height={QP.bottom - DP.top + 8} />
		</clipPath>
	</defs>

	<!-- reach: the ring the hand can get to -->
	<circle
		cx={SX}
		cy={SY}
		r={(ARM.l1 + ARM.l2) * PXM}
		fill="none"
		stroke="var(--stage-grid)"
		stroke-width="1.5"
		stroke-dasharray="3 5"
	/>
	<!-- the post -->
	<rect
		x={SX - 14}
		y={SY}
		width="28"
		height={570 - SY}
		rx="4"
		fill="var(--fc-ground)"
		stroke="var(--fc-road)"
	/>
	<line x1="40" x2="460" y1="570" y2="570" stroke="var(--fc-road)" stroke-width="2" />

	<!-- where the joint targets would put the arm -->
	<path
		d="M{SX} {SY} L{px(aim.ex)} {py(aim.ey)} L{px(aim.hx)} {py(aim.hy)}"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
		stroke-dasharray="5 5"
		opacity="0.6"
	/>
	<path d={trail} fill="none" stroke="var(--fc-response)" stroke-width="2" opacity="0.5" />

	<!-- the arm -->
	<line
		x1={SX}
		y1={SY}
		x2={px(pose.ex)}
		y2={py(pose.ey)}
		stroke="var(--fc-arm)"
		stroke-width="14"
		stroke-linecap="round"
	/>
	<line
		x1={px(pose.ex)}
		y1={py(pose.ey)}
		x2={px(pose.hx)}
		y2={py(pose.hy)}
		stroke="var(--fc-arm2)"
		stroke-width="10"
		stroke-linecap="round"
	/>
	<circle cx={SX} cy={SY} r="13" fill="var(--fc-body)" stroke="var(--stage-bg)" stroke-width="2" />
	<circle
		cx={px(pose.ex)}
		cy={py(pose.ey)}
		r="10"
		fill="var(--fc-body)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<circle
		cx={px(pose.hx)}
		cy={py(pose.hy)}
		r="6"
		fill="var(--fc-response)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout id="arm-labels">
		<Txt x={SX - 22} y={SY + 4} text="shoulder" size={11} anchor="end" muted />
		<Txt x={px(pose.ex)} y={py(pose.ey) - 18} text="elbow" size={11} anchor="middle" muted />
	</Readout>

	<!-- the target -->
	<line
		x1={px(goal.x) - 14}
		x2={px(goal.x) + 14}
		y1={py(goal.y)}
		y2={py(goal.y)}
		stroke="var(--fc-target)"
		stroke-width="1.5"
	/>
	<line
		x1={px(goal.x)}
		x2={px(goal.x)}
		y1={py(goal.y) - 14}
		y2={py(goal.y) + 14}
		stroke="var(--fc-target)"
		stroke-width="1.5"
	/>
	<Handle
		x={px(tx)}
		y={py(ty)}
		label="Target for the hand"
		value={tx}
		min={0.1}
		max={0.85}
		valuetext="{Math.round(tx * 100)} cm across, {Math.round(ty * 100)} cm up"
		color="var(--fc-out)"
		{onmove}
		{onkey}
	/>
	<Readout id="drag">
		<Txt
			x={px(tx)}
			y={py(ty) - 22}
			text="drag the target"
			size={11}
			anchor="middle"
			color="var(--fc-out)"
			weight={600}
		/>
	</Readout>

	<Card {cells} x={472} y={16} w={472} h={68} />

	<Plot
		{sx}
		sy={sd}
		xTicks={[0, 2, 4, 6, 8, 10]}
		yTicks={[0, 10, 20, 30, 40]}
		xFormat={(s) => (s === SECONDS ? `${s} s` : String(s))}
		yFormat={(s) => `${s} cm`}
	/>
	<Readout id="dist-title">
		<Txt x={P0} y={DP.top - 10} text="hand to target, since it last moved" size={12} muted />
	</Readout>
	<Plot
		{sx}
		sy={sq}
		xTicks={[0, 2, 4, 6, 8, 10]}
		yTicks={[-60, 0, 60]}
		xFormat={() => ''}
		yFormat={(s) => `${s}`}
	/>
	<Readout id="torque-title">
		<Txt x={P0} y={QP.top - 8} text="motor torques, N·m" size={12} muted />
		<Txt
			x={P1}
			y={QP.top - 8}
			text="shoulder"
			size={11}
			anchor="end"
			color="var(--fc-arm)"
			weight={600}
		/>
		<Txt
			x={P1 - 62}
			y={QP.top - 8}
			text="elbow"
			size={11}
			anchor="end"
			color="var(--fc-arm2)"
			weight={600}
		/>
	</Readout>
	<g clip-path="url(#arm-plots)">
		<path d={distPath} fill="none" stroke="var(--fc-response)" stroke-width="2.2" />
		<path d={tau1Path} fill="none" stroke="var(--fc-arm)" stroke-width="1.8" />
		<path d={tau2Path} fill="none" stroke="var(--fc-arm2)" stroke-width="1.8" />
	</g>
</g>
