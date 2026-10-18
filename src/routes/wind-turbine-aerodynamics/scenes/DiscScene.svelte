<script lang="ts">
	/**
	 * The actuator disc in a stream, side view. Air parcels flow along the streamlines of the
	 * stream tube that passes through the disc (and a few outside it). The tube's width follows
	 * mass conservation, with the speed along it from the classical actuator-disc result for the
	 * axis, u/V = 1 − a(1 + ξ/√(1 + ξ²)) (ξ: distance from the disc in disc radii), which is V far
	 * upstream, (1 − a)V at the disc and (1 − 2a)V far downstream.
	 *
	 * Modes (`step.hints.mode`):
	 *   wind   — no disc yet: the rotor's outline, the cube law chart and the power in the wind.
	 *   disc   — the disc slows the air by a (handle or slider): the speed and pressure along the
	 *            axis, the pressure step (= CT), and CP, CT as functions of a.
	 *   betz   — the same, with CP(a) emphasised, the 16/27 line and a > 1/2 marked invalid.
	 *   thrust — CT(a) from momentum theory and Buhl's empirical fit (after Glauert) above a = 0.4.
	 *
	 * Motion: the parcels' travel is a frame-to-frame accumulator of the flow speed (the scene
	 * guide's sanctioned exception), since the wind speed slider changes the rate; static under
	 * reduced motion.
	 */
	import { Axes, Handle, Label, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { disc, ROTOR_AREA, thrustCorrected, windPower } from '../model';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { num, watts } from './fmt';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type Mode = 'wind' | 'disc' | 'betz' | 'thrust';
	const mode = $derived(String(step.hints?.mode ?? 'disc') as Mode);
	const V = $derived(Math.max(0, Number(params.v ?? 10)));
	const aSet = $derived(Math.min(0.5, Math.max(0, Number(params.a ?? 0.15))));
	const a = $derived(mode === 'wind' ? 0 : aSet);
	const d = $derived(disc(a));

	// ---------------------------------------------------------------- geometry
	const X0 = 84;
	const X1 = 630;
	const XD = 284;
	const CY = 190;
	const RD = 60;
	const HMAX = 128;
	/** Baseline of the speed labels under the stream. */
	const LY = 356;
	const xi = (x: number) => (x - XD) / RD;
	/** Speed on the axis as a fraction of V. */
	const speed = (aa: number, s: number) => 1 - aa * (1 + s / Math.sqrt(1 + s * s));
	const N = 120;
	const xs = Array.from({ length: N + 1 }, (_, i) => X0 + ((X1 - X0) * i) / N);
	/** Half-height of the stream tube through the disc, at each x. */
	const half = $derived(xs.map((x) => RD * Math.sqrt((1 - a) / Math.max(0.02, speed(a, xi(x))))));
	const h0 = $derived(RD * Math.sqrt(1 - a));
	const capped = $derived(half.map((h) => Math.min(HMAX, h)));
	const cut = $derived(half[N] > HMAX);

	const tubePath = $derived.by(() => {
		let top = '';
		let bot = '';
		xs.forEach((x, i) => {
			top += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(CY - capped[i]).toFixed(1)} `;
			bot = `L${x.toFixed(1)} ${(CY + capped[i]).toFixed(1)} ` + bot;
		});
		return `${top}${bot.replace(/^L/, 'L')}Z`;
	});
	/** Streamlines: inside the tube at fractions of its half-height, outside displaced around it. */
	const inside = [-0.8, -0.4, 0, 0.4, 0.8];
	const outside = [-1.55, -1.25, 1.25, 1.55];
	const lineY = (f: number, i: number) => {
		if (Math.abs(f) < 1.01) return CY + f * capped[i];
		const y0 = Math.abs(f) * RD;
		const r = Math.min(138, Math.sqrt(y0 * y0 + half[i] ** 2 - h0 * h0));
		return CY + Math.sign(f) * Math.max(r, capped[i] + 6);
	};
	const linePath = (f: number) =>
		xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${lineY(f, i).toFixed(1)}`).join(' ');

	/** Travel time (in units of RD / V-drawing-speed) from X0 to each x, inside the tube. */
	const tau = $derived.by(() => {
		const out = [0];
		for (let i = 1; i <= N; i++) {
			const u = Math.max(0.03, speed(a, xi((xs[i] + xs[i - 1]) / 2)));
			out.push(out[i - 1] + (xs[i] - xs[i - 1]) / u);
		}
		return out;
	});
	const xAtTau = (tt: number) => {
		const T = tau;
		let lo = 0;
		let hi = N;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (T[m] <= tt) lo = m;
			else hi = m;
		}
		const u = T[hi] === T[lo] ? 0 : (tt - T[lo]) / (T[hi] - T[lo]);
		return { i: lo, x: xs[lo] + (xs[hi] - xs[lo]) * u };
	};

	/** Flow clock: distance (px) a free-stream parcel has travelled. */
	const vDraw = $derived(mode === 'wind' ? 9.8 * V : 98);
	let acc = { t: 0, s: 0 };
	const flow = $derived.by(() => {
		if (reduced) return 2.5 * 98;
		const dt = t - acc.t;
		if (dt > 0 && dt < 0.5) acc = { t, s: acc.s + dt * vDraw };
		else if (dt !== 0) acc = { t, s: dt < 0 ? t * vDraw : acc.s };
		return acc.s;
	});

	const PER = 7;
	const parcels = $derived.by(() => {
		const out: { key: string; x: number; y: number; o: number }[] = [];
		const T = tau[N];
		inside.forEach((f, j) => {
			for (let k = 0; k < PER; k++) {
				const span = (X1 - X0) / PER;
				const tt = (((flow + k * span + j * 37) % (X1 - X0)) / (X1 - X0)) * T;
				const p = xAtTau(tt);
				const u = (p.x - X0) / (X1 - X0);
				out.push({
					key: `i${j}-${k}`,
					x: p.x,
					y: lineY(f, p.i),
					o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.92, 1, u))
				});
			}
		});
		outside.forEach((f, j) => {
			for (let k = 0; k < PER; k++) {
				const span = (X1 - X0) / PER;
				const s = (flow + k * span + j * 53) % (X1 - X0);
				const x = X0 + s;
				const i = Math.round(((x - X0) / (X1 - X0)) * N);
				const u = s / (X1 - X0);
				out.push({
					key: `o${j}-${k}`,
					x,
					y: lineY(f, i),
					o: 0.55 * smoothstep(0, 0.06, u) * (1 - smoothstep(0.92, 1, u))
				});
			}
		});
		return out;
	});

	// ---------------------------------------------------------------- axis plot (speed, pressure)
	const px = scale([xi(X0), xi(X1)], [X0, X1]);
	const py = scale([-0.5, 1.1], [552, 386]);
	const axisSpeed = $derived(
		xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${py(speed(a, xi(x))).toFixed(1)}`).join(' ')
	);
	/** p − p∞ over ½ρV²: Bernoulli on each side of the disc. */
	const axisPressure = $derived.by(() => {
		const uw2 = (1 - 2 * a) ** 2;
		const up: string[] = [];
		const down: string[] = [];
		for (const x of xs) {
			const u = speed(a, xi(x));
			if (x <= XD) up.push(`${up.length ? 'L' : 'M'}${x.toFixed(1)} ${py(1 - u * u).toFixed(1)}`);
			if (x >= XD)
				down.push(`${down.length ? 'L' : 'M'}${x.toFixed(1)} ${py(uw2 - u * u).toFixed(1)}`);
		}
		return { up: up.join(' '), down: down.join(' ') };
	});
	const pBefore = $derived(1 - (1 - a) ** 2);
	const pAfter = $derived((1 - 2 * a) ** 2 - (1 - a) ** 2);

	const snap = (v: number) => Math.round(Math.min(0.5, Math.max(0, v)) / 0.005) * 0.005;
	const onmove = (p: Point) => setParam('a', snap(1 - py.invert(p.y)));
	const onkey = (s: number | 'start' | 'end') =>
		setParam('a', s === 'start' ? 0 : s === 'end' ? 0.5 : snap(aSet + s * 0.005));

	// ---------------------------------------------------------------- coefficient chart
	const cx = scale([0, 1], [700, 920]);
	const cy = $derived(mode === 'thrust' ? scale([0, 2.1], [330, 84]) : scale([0, 1.05], [330, 84]));
	const curve = (f: (aa: number) => number, from: number, to: number) => {
		const n = 60;
		return Array.from({ length: n + 1 }, (_, i) => {
			const aa = from + ((to - from) * i) / n;
			return `${i ? 'L' : 'M'}${cx(aa).toFixed(1)} ${cy(f(aa)).toFixed(1)}`;
		}).join(' ');
	};
	const cpF = (aa: number) => 4 * aa * (1 - aa) ** 2;
	const ctF = (aa: number) => 4 * aa * (1 - aa);
	const showCp = $derived(mode !== 'thrust');
	const ctOpacity = $derived(mode === 'betz' ? 0.35 : 1);

	// ---------------------------------------------------------------- cube-law chart (wind mode)
	const wx = scale([0, 30], [90, 600]);
	const wy = scale([0, 18], [552, 400]);
	const perM2 = (v: number) => windPower(1, v) / 1000;
	const cubePath = Array.from({ length: 61 }, (_, i) => {
		const v = (30 * i) / 60;
		return `${i ? 'L' : 'M'}${wx(v).toFixed(1)} ${wy(Math.min(18.5, perM2(v))).toFixed(1)}`;
	}).join(' ');

	const title = $derived(
		{
			wind: 'The power in the wind: ½ρAV³',
			disc: 'An actuator disc slows the air by a',
			betz: 'The Betz limit: CP = 4a(1 − a)² peaks at 16/27',
			thrust: 'Thrust: momentum theory and the turbulent wake'
		}[mode]
	);
	const wakeLabel = $derived(
		a >= 0.4999 ? 'far wake: stopped (theory fails)' : `far wake: (1 − 2a)V = ${num(d.uWake, 2)}V`
	);
</script>

<g>
	<Readout id="title" order={0} label="Chart" value={title}>
		<Label x={24} y={34} anchor="start" size={15} weight={700} text={title} />
	</Readout>

	<!-- ===================== the stream ===================== -->
	{#if mode !== 'wind'}
		<path d={tubePath} fill="var(--wt-tube)" stroke="var(--wt-air)" stroke-width="1.2" />
	{/if}
	{#each [...inside, ...outside] as f (f)}
		<path
			d={linePath(f)}
			fill="none"
			stroke="var(--wt-air)"
			stroke-width="1"
			opacity={Math.abs(f) > 1 ? 0.25 : 0.35}
		/>
	{/each}
	{#each parcels as p (p.key)}
		<circle cx={p.x} cy={p.y} r="3.2" fill="var(--wt-air)" opacity={p.o} />
	{/each}

	{#if mode === 'wind'}
		<ellipse
			cx={XD}
			cy={CY}
			rx="10"
			ry={RD}
			fill="none"
			stroke="var(--wt-blade)"
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
		<Readout id="rotor-label">
			<Label x={XD} y={LY} text="rotor, 126 m across" size={12} muted />
		</Readout>
		<Readout id="v-label">
			<Label x={X0} y={LY} anchor="start" text="V = {V.toFixed(1)} m/s" size={13} weight={600} />
		</Readout>
	{:else}
		<rect
			x={XD - 4}
			y={CY - RD}
			width="8"
			height={RD * 2}
			rx="3"
			fill="var(--wt-blade)"
			opacity="0.9"
		/>
		<!-- thrust on the disc -->
		{#if d.ct > 0.01}
			<line
				x1={XD + 6}
				y1={CY}
				x2={XD + 6 + 70 * d.ct}
				y2={CY}
				stroke="var(--wt-thrust)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
		{/if}
		<Readout id="tube-label">
			<Label x={X0} y={LY} anchor="start" text="upstream: V" size={12.5} weight={600} />
		</Readout>
		<Readout id="disc-label">
			<Label
				x={XD}
				y={LY}
				text="at the disc: (1 − a)V = {num(d.uDisc, 2)}V"
				size={12.5}
				weight={600}
			/>
		</Readout>
		<Readout id="wake-label">
			<Label x={X1} y={LY} anchor="end" text={wakeLabel} size={12.5} weight={600} />
		</Readout>
		{#if cut}
			<Readout id="cut-label">
				<Label x={X1} y={48} anchor="end" text="(wake wider than drawn)" size={11} muted />
			</Readout>
		{/if}
		<Readout id="thrust-label">
			<Label
				x={XD + 12 + 70 * d.ct}
				y={CY + 4}
				anchor="start"
				text="thrust"
				size={12}
				color="var(--wt-thrust)"
				opacity={d.ct > 0.01 ? 1 : 0}
			/>
		</Readout>
	{/if}

	<!-- ===================== lower left: along the axis, or the cube law ===================== -->
	{#if mode === 'wind'}
		<Axes sx={wx} sy={wy} xLabel="wind speed (m/s)" yLabel="kW per m²" yTicks={[0, 5, 10, 15]} />
		<path d={cubePath} fill="none" stroke="var(--wt-power)" stroke-width="2.5" />
		<circle
			cx={wx(Math.min(30, V))}
			cy={wy(Math.min(18.5, perM2(V)))}
			r="6"
			fill="var(--wt-power)"
		/>
		<Readout id="cube-note">
			<Label
				x={wx(4)}
				y={wy(15)}
				anchor="start"
				text="twice the speed, eight times the power"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Axes
			sx={px}
			sy={py}
			xTicks={[]}
			yTicks={[-0.5, 0, 0.5, 1]}
			yFormat={(v: number) => num(v, 1)}
		/>
		<line
			x1={XD}
			x2={XD}
			y1={py.range[1]}
			y2={py.range[0]}
			stroke="var(--stage-line)"
			stroke-dasharray="3 3"
		/>
		<path d={axisSpeed} fill="none" stroke="var(--wt-air)" stroke-width="2.5" />
		<path d={axisPressure.up} fill="none" stroke="var(--wt-thrust)" stroke-width="2" />
		<path d={axisPressure.down} fill="none" stroke="var(--wt-thrust)" stroke-width="2" />
		<line
			x1={XD}
			x2={XD}
			y1={py(pBefore)}
			y2={py(pAfter)}
			stroke="var(--wt-thrust)"
			stroke-width="3"
			opacity="0.5"
		/>
		<Readout id="speed-key">
			<Label
				x={X0 + 30}
				y={py(1) - 8}
				anchor="start"
				text="speed on the axis, u/V"
				size={12}
				color="var(--wt-air)"
			/>
		</Readout>
		<Readout id="pressure-key">
			<Label
				x={X1 - 4}
				y={py(-0.5) + 4 - 12}
				anchor="end"
				text="pressure, (p − p∞) ÷ ½ρV²"
				size={12}
				color="var(--wt-thrust)"
			/>
		</Readout>
		<Readout id="step-label">
			<Label
				x={XD + 10}
				y={py(pAfter) + 18}
				anchor="start"
				text="pressure step = CT = {num(d.ct, 2)}"
				size={12}
				weight={600}
				color="var(--wt-thrust)"
				opacity={d.ct > 0.05 ? 1 : 0}
			/>
		</Readout>
		<Handle
			x={XD}
			y={py(d.uDisc)}
			label="Speed of the air at the disc"
			value={a}
			min={0}
			max={0.5}
			valuetext="a = {a.toFixed(3)}, air at the disc at {num(d.uDisc, 2)} of the wind speed"
			color="var(--wt-air)"
			{onmove}
			{onkey}
		/>
	{/if}

	<!-- ===================== right: coefficients, or the wind's power ===================== -->
	{#if mode === 'wind'}
		<Card x={660} y={84} w={276} h={196} />
		<Row id="v" order={1} x={680} y={116} w={236} label="Wind speed" value="{V.toFixed(1)} m/s" />
		<Row
			id="perm2"
			order={2}
			x={680}
			y={150}
			w={236}
			label="Power per m²"
			value={watts(windPower(1, V))}
			color="var(--wt-power)"
		/>
		<Row
			id="rotor"
			order={3}
			x={680}
			y={184}
			w={236}
			label="Through the 126 m rotor"
			value={watts(windPower(ROTOR_AREA, V))}
			color="var(--wt-power)"
		/>
		<Row
			id="area"
			order={4}
			x={680}
			y={218}
			w={236}
			label="Swept area"
			value="{Math.round(ROTOR_AREA).toLocaleString('en-US')} m²"
			minor
		/>
		<Readout id="rho">
			<Label
				x={680}
				y={256}
				anchor="start"
				text="ρ = 1.225 kg/m³ (sea level, 15 °C)"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		{#if mode === 'betz'}
			<rect
				x={cx(0.5)}
				y={cy.range[1]}
				width={cx(1) - cx(0.5)}
				height={cy.range[0] - cy.range[1]}
				fill="var(--stage-grid)"
				opacity="0.6"
			/>
			<Readout id="invalid">
				<Label x={cx(1) - 4} y={cy.range[1] + 16} anchor="end" text="wake would" size={11} muted />
				<Label
					x={cx(1) - 4}
					anchor="end"
					y={cy.range[1] + 30}
					text="flow backwards"
					size={11}
					muted
				/>
			</Readout>
		{/if}
		{#if mode === 'thrust'}
			<rect
				x={cx(0.4)}
				y={cy.range[1]}
				width={cx(1) - cx(0.4)}
				height={cy.range[0] - cy.range[1]}
				fill="var(--wt-measured)"
				opacity="0.08"
			/>
			<Readout id="turbulent">
				<Label x={cx(0.7)} y={cy.range[1] + 16} text="turbulent wake" size={11} muted />
			</Readout>
		{/if}
		<Axes
			sx={cx}
			sy={cy}
			xLabel="a"
			xTicks={[0, 0.25, 0.5, 0.75, 1]}
			yTicks={mode === 'thrust' ? [0, 0.5, 1, 1.5, 2] : [0, 0.25, 0.5, 0.75, 1]}
			xFormat={(v) => String(v)}
			yFormat={(v) => String(v)}
		/>
		{#if showCp}
			<line
				x1={cx(0)}
				x2={cx(1)}
				y1={cy(16 / 27)}
				y2={cy(16 / 27)}
				stroke="var(--wt-betz)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity={mode === 'betz' ? 1 : 0.6}
			/>
			<path d={curve(cpF, 0, 0.5)} fill="none" stroke="var(--wt-power)" stroke-width="2.5" />
			<path
				d={curve(cpF, 0.5, 1)}
				fill="none"
				stroke="var(--wt-power)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
				opacity="0.7"
			/>
		{/if}
		<g opacity={ctOpacity}>
			<path d={curve(ctF, 0, 0.5)} fill="none" stroke="var(--wt-thrust)" stroke-width="2" />
			<path
				d={curve(ctF, 0.5, 1)}
				fill="none"
				stroke="var(--wt-thrust)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
				opacity="0.7"
			/>
		</g>
		{#if mode === 'thrust'}
			<path
				d={curve((aa) => thrustCorrected(aa), 0.4, 1)}
				fill="none"
				stroke="var(--wt-measured)"
				stroke-width="2.5"
			/>
			<circle cx={cx(a)} cy={cy(thrustCorrected(a))} r="5" fill="var(--wt-measured)" />
			<Readout
				id="measured-key"
				order={7}
				label="Purple line"
				value="empirical fit (Glauert, Buhl)"
			>
				<Label
					x={cx(1) - 2}
					y={cy(2) + 18}
					anchor="end"
					text="empirical fit"
					size={12}
					color="var(--wt-measured)"
				/>
			</Readout>
			<Readout id="momentum-key">
				<Label
					x={cx(0.36)}
					y={cy(1.08)}
					anchor="end"
					text="momentum theory"
					size={12}
					color="var(--wt-thrust)"
				/>
			</Readout>
		{:else}
			<Readout id="betz-key" order={7} label="Green line" value="Betz limit 16/27 = 0.593">
				<Label
					x={cx(1) - 2}
					y={cy(16 / 27) - 7}
					anchor="end"
					text="Betz 16/27"
					size={12}
					color="var(--wt-betz)"
				/>
			</Readout>
			<Readout id="ct-key">
				<Label
					x={cx(0.14) - 4}
					y={cy(0.7)}
					anchor="end"
					text="CT"
					size={12}
					color="var(--wt-thrust)"
					opacity={ctOpacity}
				/>
			</Readout>
			<Readout id="cp-key">
				<Label x={cx(0.36)} y={cy(0.59) + 26} text="CP" size={12} color="var(--wt-power)" />
			</Readout>
		{/if}
		{#if showCp}
			<circle cx={cx(a)} cy={cy(d.cp)} r="6" fill="var(--wt-power)" />
		{/if}
		<circle cx={cx(a)} cy={cy(d.ct)} r="4.5" fill="var(--wt-thrust)" opacity={ctOpacity} />
		{#if mode === 'betz' && Math.abs(a - 1 / 3) < 0.004}
			<Readout id="peak">
				<Label
					x={cx(a)}
					y={cy(d.cp) - 14}
					text="the peak"
					size={12}
					weight={650}
					color="var(--wt-power)"
				/>
			</Readout>
		{/if}

		<Card x={660} y={372} w={276} h={186} />
		<Row id="a" order={1} x={680} y={402} w={236} label="Induction a" value={a.toFixed(3)} />
		<Row
			id="udisc"
			order={2}
			x={680}
			y={430}
			w={236}
			label="Air at the disc"
			value="{num(d.uDisc, 3)} V"
			color="var(--wt-air)"
		/>
		<Row
			id="uwake"
			order={3}
			x={680}
			y={458}
			w={236}
			label="Air in the far wake"
			value="{num(d.uWake, 3)} V"
			color="var(--wt-air)"
			minor
		/>
		<Row
			id="cp"
			order={4}
			x={680}
			y={486}
			w={236}
			label="Power coefficient CP"
			value={d.cp.toFixed(3)}
			color="var(--wt-power)"
		/>
		<Row
			id="ct"
			order={5}
			x={680}
			y={514}
			w={236}
			label={mode === 'thrust' && a > 0.4 ? 'CT theory / empirical' : 'Thrust coefficient CT'}
			value={mode === 'thrust' && a > 0.4
				? `${d.ct.toFixed(2)} / ${thrustCorrected(a).toFixed(2)}`
				: d.ct.toFixed(3)}
			color="var(--wt-thrust)"
		/>
		<Readout id="share">
			<Label
				x={680}
				y={542}
				anchor="start"
				text="{((d.cp / (16 / 27)) * 100).toFixed(0)}% of the Betz limit"
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>
