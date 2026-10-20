<script lang="ts">
	/**
	 * The benchmark bicycle after a sideways push (or under a steady steering torque), replayed in
	 * real time: the lean seen from behind, the path and steering seen from above, and the lean and
	 * steer angles against time. The linear model is only good for small angles, so a run stops
	 * once the lean passes 45°: the bicycle has fallen.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BENCHMARK, eigenvalues, matrices, simulate, type State } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'push'));
	const counter = $derived(phase === 'counter');
	const v = $derived(counter ? 5 : Number(params.speed ?? 5));
	const torque = $derived(Number(params.torque ?? -0.3));
	const m = matrices(BENCHMARK);
	const DURATION = 6;
	const FALLEN = Math.PI / 4;
	const run: State[] = $derived.by(() => {
		const all = simulate(BENCHMARK, m, v, {
			push: counter ? 0 : 0.5,
			torque: counter ? torque : 0,
			duration: DURATION
		});
		const end = all.findIndex((s) => Math.abs(s.phi) > FALLEN);
		return end < 0 ? all : all.slice(0, end + 1);
	});
	const fell = $derived(Math.abs(run[run.length - 1].phi) > FALLEN);
	const ev = $derived(eigenvalues(m, v));
	const verdict = $derived.by(() => {
		if (counter) return '';
		const grow = ev.filter((e) => e.re > 1e-9);
		if (!grow.length) return 'self-stable: it recovers';
		if (grow.some((e) => e.im !== 0)) return 'weave grows: it falls';
		return 'capsize: it slowly leans over';
	});

	let t0 = $state(0);
	$effect(() => {
		void run;
		void step.id;
		void params.push;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	const endT = $derived(run[run.length - 1].t);
	const time = $derived(reduced ? endT : Math.min(endT, local));
	const idx = $derived(Math.min(run.length - 1, Math.round(time / 0.02)));
	const now = $derived(run[idx]);
	const shown = $derived(run.slice(0, idx + 1));
	const deg = (r: number) => (r * 180) / Math.PI;

	// ---- rear view ----------------------------------------------------------------------------
	const RX = 175;
	const RY = 290;
	const H = 190;
	const lx = $derived(RX + H * Math.sin(now.phi));
	const ly = $derived(RY - H * Math.cos(now.phi));

	// ---- top view: travel to the right, the rider's right downwards ---------------------------------
	const sxTop = $derived(scale([0, Math.max(10, v * DURATION + 3.5)], [380, 930]));
	const sTop = $derived(sxTop(1) - sxTop(0));
	const TY = 150;
	const topPath = $derived(
		shown
			.map((s, i) => `${i ? 'L' : 'M'}${sxTop(s.x).toFixed(1)} ${(TY + s.y * sTop).toFixed(1)}`)
			.join(' ')
	);
	// The bicycle drawn 3 m long so it shows; its front wheel turned by the (doubled) steer angle.
	const BL = 3;
	const rear = $derived({ x: sxTop(now.x), y: TY + now.y * sTop });
	const front = $derived({
		x: rear.x + BL * sTop * Math.cos(now.psi),
		y: rear.y + BL * sTop * Math.sin(now.psi)
	});
	const wheelDir = $derived(now.psi + 2 * now.delta);

	// ---- traces ---------------------------------------------------------------------------------
	const sxT = scale([0, DURATION], [430, 920]);
	const range = $derived(
		Math.max(5, ...run.map((s) => Math.max(Math.abs(deg(s.phi)), Math.abs(deg(s.delta)))))
	);
	const yMax = $derived(Math.min(45, Math.ceil(range / 5) * 5));
	const syT = $derived(scale([-yMax, yMax], [560, 330]));
	const clampDeg = (r: number) => Math.max(-yMax, Math.min(yMax, deg(r)));
</script>

<g class="bk-ride">
	<!-- rear view -->
	<line x1="40" y1={RY} x2="310" y2={RY} stroke="var(--text-muted)" stroke-width="2" />
	<ellipse
		cx={RX + 0.25 * H * Math.sin(now.phi)}
		cy={RY - 0.25 * H * Math.cos(now.phi)}
		rx="9"
		ry={0.25 * H}
		fill="none"
		stroke="var(--text)"
		stroke-width="5"
		transform="rotate({deg(now.phi)} {RX + 0.25 * H * Math.sin(now.phi)} {RY -
			0.25 * H * Math.cos(now.phi)})"
	/>
	<line
		x1={RX}
		y1={RY}
		x2={lx}
		y2={ly}
		stroke="var(--bk-lean)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<circle cx={lx} cy={ly} r="16" fill="var(--bk-lean)" />
	<line
		x1={RX}
		y1={RY}
		x2={RX}
		y2={RY - H - 20}
		stroke="var(--text-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout
		id="bk-rear"
		order={1}
		label="Lean"
		value="{deg(now.phi).toFixed(1)}°{now.phi > 0.002 ? ' right' : now.phi < -0.002 ? ' left' : ''}"
	>
		<Label
			x={RX}
			y={RY + 30}
			text="from behind · lean {Math.abs(deg(now.phi)).toFixed(1)}°{now.phi > 0.002
				? ' right'
				: now.phi < -0.002
					? ' left'
					: ''}"
			anchor="middle"
			tabular
		/>
	</Readout>

	<!-- top view -->
	<clipPath id="bk-top-clip"><rect x="370" y="52" width="580" height="250" /></clipPath>
	<g clip-path="url(#bk-top-clip)">
		<line x1="380" y1={TY} x2="930" y2={TY} stroke="var(--border-strong)" stroke-dasharray="3 5" />
		<path d={topPath} fill="none" stroke="var(--bk-lean)" stroke-width="2" opacity="0.7" />
		<line
			x1={rear.x}
			y1={rear.y}
			x2={front.x}
			y2={front.y}
			stroke="var(--text)"
			stroke-width="4"
			stroke-linecap="round"
		/>
		<line
			x1={front.x - 22 * Math.cos(wheelDir)}
			y1={front.y - 22 * Math.sin(wheelDir)}
			x2={front.x + 22 * Math.cos(wheelDir)}
			y2={front.y + 22 * Math.sin(wheelDir)}
			stroke="var(--bk-steer)"
			stroke-width="7"
			stroke-linecap="round"
		/>
	</g>
	<Readout
		id="bk-top"
		order={2}
		label="From above"
		value="steer {deg(now.delta).toFixed(1)}°, heading {deg(now.psi).toFixed(0)}°"
	>
		<Label
			x={380}
			y={40}
			text="from above · steer {Math.abs(deg(now.delta)).toFixed(1)}°{now.delta > 0.002
				? ' right'
				: now.delta < -0.002
					? ' left'
					: ''} (drawn doubled)"
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- traces -->
	<Axes sx={sxT} sy={syT} xLabel="time (s)" yLabel="angle (°)" />
	<line x1={sxT(0)} y1={syT(0)} x2={sxT(DURATION)} y2={syT(0)} stroke="var(--text-muted)" />
	<path
		d={linePath(
			shown,
			(s) => s.t,
			(s) => clampDeg(s.phi),
			sxT,
			syT
		)}
		fill="none"
		stroke="var(--bk-lean)"
		stroke-width="2.5"
	/>
	<path
		d={linePath(
			shown,
			(s) => s.t,
			(s) => clampDeg(s.delta),
			sxT,
			syT
		)}
		fill="none"
		stroke="var(--bk-steer)"
		stroke-width="2.5"
	/>
	<Readout
		id="bk-legend"
		order={5}
		label="Traces"
		value="blue: lean (+ right); orange: steer (+ right)"
	>
		<Label
			x={sxT(DURATION) - 4}
			y={344}
			text="lean (+ right)"
			anchor="end"
			color="var(--bk-lean)"
			weight={600}
		/>
		<Label
			x={sxT(DURATION) - 4}
			y={362}
			text="steer (+ right)"
			anchor="end"
			color="var(--bk-steer)"
			weight={600}
		/>
	</Readout>

	<!-- verdict -->
	<Readout id="bk-speed" order={3} label="Speed" value="{v.toFixed(1)} m/s">
		<Label x={40} y={40} text="{v.toFixed(1)} m/s" anchor="start" size={18} weight={700} tabular />
	</Readout>
	{#if verdict}
		<Readout id="bk-verdict" order={4} label="Prediction" value={verdict}>
			<Label
				x={40}
				y={64}
				text={verdict}
				anchor="start"
				size={14}
				color={verdict.startsWith('self') ? 'var(--bk-band)' : 'var(--bk-fall)'}
				weight={600}
			/>
		</Readout>
	{/if}
	{#if fell && time >= endT}
		<Readout
			id="bk-fell"
			order={6}
			label="Result"
			value="fallen over (past 45°, where the linear model ends)"
		>
			<Label
				x={40}
				y={380}
				text="fallen over"
				anchor="start"
				size={16}
				weight={700}
				color="var(--bk-fall)"
			/>
			<Label
				x={40}
				y={400}
				text="(past 45°: the linear model ends)"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
	{/if}
	{#if counter}
		<Readout
			id="bk-turn"
			order={4}
			label="Turning"
			value={now.psi > 0.01 ? 'to the right' : now.psi < -0.01 ? 'to the left' : 'straight'}
		>
			<Label
				x={40}
				y={64}
				text="turning {now.psi > 0.01
					? 'right'
					: now.psi < -0.01
						? 'left'
						: 'straight'} · handlebars twisted {torque < 0
					? 'left'
					: torque > 0
						? 'right'
						: 'not at all'}"
				anchor="start"
				size={14}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
