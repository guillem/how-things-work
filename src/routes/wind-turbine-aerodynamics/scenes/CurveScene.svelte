<script lang="ts">
	/**
	 * The NREL 5-MW turbine operated in a steady wind (the BEM model under a simplified version of
	 * its controller), against wind speed.
	 *
	 * Modes (`step.hints.mode`):
	 *   power  — electrical output, with the power in the wind and the Betz limit's share of it,
	 *            the operating regions (parked, cube law, rated by pitch), and a handle on the
	 *            wind speed; a small rotor turning at its real speed with its pitch shown.
	 *   budget — the same as fractions of the wind's power: the Betz limit, the rotor's CP and
	 *            the electrical output after the 94.4% drivetrain and generator efficiency.
	 *
	 * Motion: the small rotor's angle is a frame-to-frame accumulator of its speed (the scene
	 * guide's sanctioned exception); static under reduced motion.
	 */
	import { Axes, Handle, Label, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BETZ,
		operate,
		ratedWindSpeed,
		ROTOR_AREA,
		TURBINE,
		windPower,
		type Operating
	} from '../model';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { deg, newtons, num, watts } from './fmt';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'power') as 'power' | 'budget');
	const V = $derived(Math.min(30, Math.max(0, Number(params.v ?? 10))));
	const op = $derived(operate(V));

	/** The operating curve, computed once: every 0.25 m/s, with the switch points added. */
	const vr = ratedWindSpeed();
	const curve: Operating[] = (() => {
		const vs = Array.from({ length: 121 }, (_, i) => i * 0.25);
		vs.push(2.999, vr - 0.001, vr, 25.001);
		return vs.sort((x, y) => x - y).map((v) => operate(v));
	})();

	const sx = scale([0, 30], [90, 640]);
	const sp = scale([0, 8], [520, 84]);
	const sf = scale([0, 0.65], [520, 84]);
	const MW = 1e6;

	const linePath = (f: (o: Operating) => number, sy: (v: number) => number, max: number) => {
		let d = '';
		let pen = false;
		for (const o of curve) {
			const v = f(o);
			if (!Number.isFinite(v) || v > max) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${sx(o.v).toFixed(1)} ${sy(v).toFixed(1)} `;
			pen = true;
		}
		return d;
	};
	const elecPath = linePath((o) => o.electric / MW, sp, 8);
	const windPath = linePath((o) => o.wind / MW, sp, 8);
	const betzPath = linePath((o) => (BETZ * o.wind) / MW, sp, 8);
	const cpPath = linePath((o) => (o.region === 'parked' ? NaN : o.cp), sf, 1);
	const elFracPath = linePath(
		(o) => (o.region === 'parked' ? NaN : o.electric / Math.max(1, o.wind)),
		sf,
		1
	);

	const yOf = $derived(
		mode === 'power' ? sp(op.electric / MW) : sf(op.region === 'parked' ? 0 : op.cp)
	);
	const snap = (v: number) => Math.round(Math.min(30, Math.max(0, v)) * 10) / 10;
	const onmove = (p: Point) => setParam('v', snap(sx.invert(p.x)));
	const onkey = (s: number | 'start' | 'end') =>
		setParam('v', s === 'start' ? 0 : s === 'end' ? 30 : snap(V + s * 0.1));

	// ---------------------------------------------------------------- small rotor
	const GX = 800;
	const GY = 130;
	const GR = 62;
	let acc = { t: 0, ang: 0 };
	const omega = $derived((op.rpm * 2 * Math.PI) / 60);
	const ang = $derived.by(() => {
		if (reduced) return 0.5;
		const dt = t - acc.t;
		if (dt > 0 && dt < 0.5) acc = { t, ang: acc.ang + dt * omega };
		else if (dt !== 0) acc = { t, ang: dt < 0 ? t * omega : acc.ang };
		return acc.ang;
	});

	const regionText: Record<Operating['region'], string> = {
		parked: 'parked',
		'below-rated': 'holding the best λ',
		'speed-limit': 'at top rotor speed',
		rated: 'pitching to hold 5 MW'
	};
	const title = $derived(
		mode === 'power'
			? 'Power curve of the NREL 5-MW turbine (BEM model)'
			: 'Shares of the power in the wind'
	);
</script>

<g>
	<Readout id="title" order={0} label="Chart" value={title}>
		<Label x={24} y={34} anchor="start" size={15} weight={700} text={title} />
	</Readout>

	<!-- regions -->
	<rect
		x={sx(0)}
		y={84}
		width={sx(3) - sx(0)}
		height={436}
		fill="var(--stage-grid)"
		opacity="0.6"
	/>
	<rect
		x={sx(25)}
		y={84}
		width={sx(30) - sx(25)}
		height={436}
		fill="var(--stage-grid)"
		opacity="0.6"
	/>
	<rect
		x={sx(vr)}
		y={84}
		width={sx(25) - sx(vr)}
		height={436}
		fill="var(--wt-blade)"
		opacity="0.07"
	/>
	<Readout id="regions">
		<Label x={sx(1.5)} y={100} text="parked" size={11} muted />
		<Label x={sx(27.5)} y={100} text="cut out" size={11} muted />
		<Label x={(sx(3) + sx(vr)) / 2} y={100} text="cube law" size={11} muted />
		<Label x={(sx(vr) + sx(25)) / 2} y={100} text="pitch control" size={11} muted />
	</Readout>

	{#if mode === 'power'}
		<Axes {sx} sy={sp} xLabel="wind speed (m/s)" yLabel="MW" yTicks={[0, 2, 4, 6, 8]} />
		<path
			d={windPath}
			fill="none"
			stroke="var(--wt-air)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
		<path
			d={betzPath}
			fill="none"
			stroke="var(--wt-betz)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
		<path d={elecPath} fill="none" stroke="var(--wt-electric)" stroke-width="3" />
		<Readout
			id="wind-key"
			order={8}
			label="Dashed blue"
			value="power in the wind through the rotor"
			color="var(--wt-air)"
		>
			<Label
				x={sx(8.1)}
				y={sp(7.2)}
				anchor="end"
				text="in the wind"
				size={12}
				color="var(--wt-air)"
			/>
		</Readout>
		<Readout
			id="betz-key"
			order={9}
			label="Dashed green"
			value="16/27 of it, the Betz limit"
			color="var(--wt-betz)"
		>
			<Label
				x={sx(10.3)}
				y={sp(7.2)}
				anchor="start"
				text="Betz limit"
				size={12}
				color="var(--wt-betz)"
			/>
		</Readout>
		<Readout id="out-key">
			<Label
				x={sx(17)}
				y={sp(5) - 10}
				text="electrical output, 5 MW rated"
				size={12}
				color="var(--wt-electric)"
			/>
		</Readout>
	{:else}
		<Axes
			{sx}
			sy={sf}
			xLabel="wind speed (m/s)"
			yLabel="share"
			yTicks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
			yFormat={(v) => `${Math.round(v * 100)}%`}
		/>
		<line
			x1={sx(0)}
			x2={sx(30)}
			y1={sf(BETZ)}
			y2={sf(BETZ)}
			stroke="var(--wt-betz)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<path d={cpPath} fill="none" stroke="var(--wt-power)" stroke-width="2.5" />
		<path d={elFracPath} fill="none" stroke="var(--wt-electric)" stroke-width="2.5" />
		<Readout
			id="betz-key"
			order={8}
			label="Green line"
			value="Betz limit, 59.3%"
			color="var(--wt-betz)"
		>
			<Label
				x={sx(29.5)}
				y={sf(BETZ) - 8}
				anchor="end"
				text="Betz limit 59.3%"
				size={12}
				color="var(--wt-betz)"
			/>
		</Readout>
		<Readout
			id="cp-key"
			order={9}
			label="Orange line"
			value="taken by the rotor (CP)"
			color="var(--wt-power)"
		>
			<Label
				x={sx(14)}
				y={sf(0.4)}
				anchor="start"
				text="taken by the rotor, CP"
				size={12}
				color="var(--wt-power)"
			/>
		</Readout>
		<Readout
			id="el-key"
			order={10}
			label="Purple line"
			value="delivered as electricity"
			color="var(--wt-electric)"
		>
			<Label
				x={sx(15.5)}
				y={sf(0.24)}
				anchor="start"
				text="delivered as electricity"
				size={12}
				color="var(--wt-electric)"
			/>
		</Readout>
	{/if}

	<line
		x1={sx(V)}
		x2={sx(V)}
		y1={84}
		y2={520}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 4"
		opacity="0.7"
	/>
	<Handle
		x={sx(V)}
		y={yOf}
		label="Wind speed"
		value={V}
		min={0}
		max={30}
		valuetext="{V.toFixed(1)} metres per second, output {watts(op.electric)}"
		color="var(--wt-electric)"
		{onmove}
		{onkey}
	/>

	<!-- small rotor -->
	<line
		x1={GX}
		x2={GX}
		y1={GY}
		y2={GY + 110}
		stroke="var(--stage-ink-muted)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	{#each [0, 1, 2] as b (b)}
		{@const th = ang + (b * 2 * Math.PI) / 3}
		<line
			x1={GX}
			y1={GY}
			x2={GX + GR * Math.cos(th)}
			y2={GY - GR * Math.sin(th)}
			stroke="var(--wt-blade)"
			stroke-width={6 - 4 * Math.min(1, op.pitch / 90)}
			stroke-linecap="round"
		/>
	{/each}
	<circle cx={GX} cy={GY} r="7" fill="var(--wt-blade)" />

	<Card x={670} y={258} w={272} h={mode === 'power' ? 262 : 206} />
	<Row id="v" order={1} x={686} y={286} w={240} label="Wind speed" value="{V.toFixed(1)} m/s" />
	<Row
		id="state"
		order={2}
		x={686}
		y={312}
		w={240}
		label="Controller"
		value={regionText[op.region]}
	/>
	<Row
		id="rpm"
		order={3}
		x={686}
		y={338}
		w={240}
		label="Rotor speed"
		value="{num(op.rpm, 1)} rpm"
		minor
	/>
	<Row
		id="lambda"
		order={4}
		x={686}
		y={364}
		w={240}
		label="Tip-speed ratio λ"
		value={op.region === 'parked' ? '—' : num(op.lambda, 2)}
		minor
	/>
	<Row
		id="pitch"
		order={5}
		x={686}
		y={390}
		w={240}
		label="Blade pitch"
		value={op.region === 'parked' ? 'feathered' : deg(op.pitch)}
	/>
	<Row
		id="cp"
		order={6}
		x={686}
		y={416}
		w={240}
		label="Rotor CP"
		value={num(op.cp, 3)}
		color="var(--wt-power)"
	/>
	<Row
		id="out"
		order={7}
		x={686}
		y={442}
		w={240}
		label="Electrical output"
		value={watts(op.electric)}
		color="var(--wt-electric)"
	/>
	{#if mode === 'power'}
		<Row
			id="wind"
			order={8}
			x={686}
			y={468}
			w={240}
			label="Power in the wind"
			value={watts(windPower(ROTOR_AREA, V))}
			color="var(--wt-air)"
			minor
		/>
		<Row
			id="thrust"
			order={9}
			x={686}
			y={494}
			w={240}
			label="Thrust on the rotor"
			value={newtons(op.thrust)}
			color="var(--wt-thrust)"
			minor
		/>
	{/if}
	<Readout id="eff-note">
		<Label
			x={686}
			y={mode === 'power' ? 540 : 486}
			anchor="start"
			text="output = rotor power × {(TURBINE.efficiency * 100).toFixed(1)}%"
			size={11}
			muted
		/>
	</Readout>
</g>
