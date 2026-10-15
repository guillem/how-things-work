<script lang="ts">
	/**
	 * Height hold. Left: the drone over the ground on a 0–5 m scale, its target dashed,
	 * its thrust (up) and weight (down) as arrows, the parcel and gusts when on. Right:
	 * the readout card, height against time and the thrust, and bars for the
	 * controller's three terms now.
	 *
	 * Terms (`step.hints.terms`): p, pd or pid. Hints `parcel`, `gusts`/`noise` and
	 * `delay` switch on the matching controls. The 30 s flight (`fly`: hovering at
	 * 1 m, told to climb to 3 m at 1 s) is precomputed per setting and replayed in real
	 * time; a change restarts it, and it starts over after a 3 s hold. Reduced motion:
	 * the complete flight.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, scale } from '#lib/draw/index.ts';
	import {
		DRONE,
		G,
		at,
		criticalDelay,
		droneDamping,
		fly,
		gustForce,
		overshoot,
		peak,
		swings,
		type Gains
	} from '../control';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import { restartClock, seriesPath, type Cell } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const terms = $derived(String(step.hints?.terms ?? 'p'));
	const hasParcel = $derived(Boolean(step.hints?.parcel) && Boolean(params.parcel ?? true));
	const hasGusts = $derived(Boolean(step.hints?.gusts) && Boolean(params.gusts ?? true));
	const noiseCm = $derived(step.hints?.noise ? Number(params.noise ?? 1) : 0);
	const delayMs = $derived(step.hints?.delay ? Number(params.delay ?? 100) : 0);
	const gains = $derived<Gains>({
		kp: Number(params.droneKp ?? 4),
		kd: terms === 'p' ? 0 : Number(params.droneKd ?? 2),
		ki: terms === 'pid' ? Number(params.droneKi ?? 1) : 0
	});
	const PARCEL = 0.3;
	const SECONDS = 30;
	const run = $derived(
		fly({
			gains,
			parcel: hasParcel ? PARCEL : 0,
			gusts: hasGusts,
			noise: noiseCm / 100,
			delay: delayMs / 1000,
			seconds: SECONDS
		})
	);
	const gust = gustForce(SECONDS + 1, 7);

	// ---- clock --------------------------------------------------------------------------------
	const clock = restartClock();
	const since = $derived(
		clock(`${JSON.stringify(gains)}|${hasParcel}|${hasGusts}|${noiseCm}|${delayMs}`, t)
	);
	const now = $derived(reduced ? SECONDS : Math.min(SECONDS, since % (SECONDS + 3)));
	const z = $derived(at(run, run.y, now));
	const thrust = $derived(at(run, run.u, now));
	const pNow = $derived(at(run, run.p, now));
	const iNow = $derived(at(run, run.i, now));
	const dNow = $derived(at(run, run.d, now));
	const gNow = $derived(hasGusts ? gust(now) : 0);
	const targetNow = $derived(at(run, run.r, now));

	// ---- the drawing ------------------------------------------------------------------------------
	const COL = 190;
	const GROUND = 560;
	const PXM = 96; // px per metre
	const yOf = (h: number) => GROUND - h * PXM;
	const yd = $derived(yOf(Math.min(5.3, z)));
	const mass = $derived(DRONE.m + (hasParcel ? PARCEL : 0));
	const NPX = 3.2; // px per newton for the force arrows
	const spin = $derived(reduced ? 0.6 : Math.abs(Math.cos(t * 37)));

	// ---- plots -------------------------------------------------------------------------------------
	const P0 = 400;
	const P1 = 928;
	const HP = { top: 128, bottom: 330 };
	const TP = { top: 382, bottom: 498 };
	const sx = scale([0, SECONDS], [P0, P1]);
	const sy = scale([0, 5], [HP.bottom, HP.top]);
	const st = scale([0, 25], [TP.bottom, TP.top]);
	const xTicks = [0, 5, 10, 15, 20, 25, 30];
	const heightPath = $derived(seriesPath(run.y, run.sample, sx, sy, 1, -0.2, 5.2));
	const targetPath = $derived(seriesPath(run.r, run.sample, sx, sy, 3));
	const thrustPath = $derived(seriesPath(run.u, run.sample, sx, st, 1));

	// ---- what the step is about ------------------------------------------------------------------
	const period = $derived(2 * Math.PI * Math.sqrt(mass / gains.kp));
	const zeta = $derived(droneDamping(gains, mass));
	const over = $derived((peak(run, run.y, 1) - 3) / 2);
	const limit = $derived(terms === 'p' ? null : criticalDelay(gains, mass));
	const late = $derived.by(() => {
		if (limit && delayMs / 1000 > limit.delay) return 'too late: unstable';
		const s = swings(run, run.y, 3, 4, SECONDS);
		if (s.length < 4) return 'settles';
		const a = s.slice(-4);
		const g = a[3].a / a[1].a;
		return g < 0.9 ? 'settling' : 'swinging on';
	});
	const shake = $derived.by(() => {
		let s = 0;
		let n = 0;
		for (let i = Math.round(10 / run.sample); i < run.u.length; i++, n++)
			s += (run.u[i] - at(run, run.u, (i - 1) * run.sample)) ** 2;
		return Math.sqrt(s / Math.max(1, n));
	});

	const cells: Cell[] = $derived.by(() => {
		const out: Cell[] = [
			{
				id: 'height',
				label: 'height',
				value: `${z.toFixed(2)} m`,
				sub: `target ${targetNow.toFixed(0)} m`,
				color: 'var(--fc-response)'
			},
			{
				id: 'thrust',
				label: 'thrust',
				value: `${thrust.toFixed(1)} N`,
				sub: `weight ${(mass * G).toFixed(1)} N`,
				color: 'var(--fc-out)'
			}
		];
		if (terms === 'p')
			out.push({
				id: 'period',
				label: 'one swing',
				value: `${period.toFixed(1)} s`,
				sub: '2π√(m ÷ Kp)'
			});
		else if (terms === 'pd')
			out.push(
				{
					id: 'zeta',
					label: 'damping ratio',
					value: `ζ = ${zeta.toFixed(2)}`,
					sub: 'Kd ÷ 2√(m·Kp)'
				},
				{
					id: 'over',
					label: 'overshoot',
					value: over > 0.002 ? `${Math.round(over * 100)}%` : 'none',
					sub: zeta < 1 ? `a spring's: ${Math.round(overshoot(zeta) * 100)}%` : 'ζ ≥ 1: no swing'
				}
			);
		else if (step.hints?.parcel)
			out.push({
				id: 'sag',
				label: hasParcel ? (gains.ki > 0 ? 'integral part' : 'sag, P and D only') : 'parcel',
				value: hasParcel
					? gains.ki > 0
						? `${iNow.toFixed(2)} N`
						: `${((PARCEL * G) / gains.kp).toFixed(2)} m`
					: 'none',
				sub: hasParcel
					? gains.ki > 0
						? `holds up the parcel's ${(PARCEL * G).toFixed(2)} N`
						: '0.3 kg × g ÷ Kp'
					: 'switch it on'
			});
		else if (step.hints?.noise)
			out.push({
				id: 'shake',
				label: 'thrust shake',
				value: `±${shake.toFixed(1)} N`,
				sub: 'per 1/30 s',
				color: 'var(--fc-d)'
			});
		else if (limit)
			out.push({
				id: 'limit',
				label: 'delay it survives',
				value: limit.delay > 0 ? `${Math.round(limit.delay * 1000)} ms` : 'none',
				sub: `now ${delayMs} ms: ${late}`
			});
		return out;
	});

	// term bars
	const BX = 700;
	const BAR = scale([-5, 5], [BX + 10, 920]);
	/** Newtons with a sign, never "−0.0". */
	const fmtN = (v: number) =>
		Math.abs(v) < 0.05 ? '0.0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
	const bars = $derived(
		[
			{ id: 'P', v: pNow, color: 'var(--fc-p)', on: true },
			{ id: 'I', v: iNow, color: 'var(--fc-i)', on: terms === 'pid' },
			{ id: 'D', v: dNow, color: 'var(--fc-d)', on: terms !== 'p' }
		].filter((b) => b.on)
	);
</script>

<g>
	<defs>
		<clipPath id="drone-plots">
			<rect x={P0} y={HP.top - 4} width={sx(now) - P0 + 1} height={TP.bottom - HP.top + 8} />
		</clipPath>
	</defs>

	<!-- the column: ground, height scale, target -->
	<rect x="16" y={GROUND} width="350" height="24" rx="4" fill="var(--fc-ground)" />
	<line x1="16" x2="366" y1={GROUND} y2={GROUND} stroke="var(--fc-road)" stroke-width="2" />
	{#each [1, 2, 3, 4, 5] as h (h)}
		<line x1="52" x2="60" y1={yOf(h)} y2={yOf(h)} stroke="var(--stage-line)" />
		<Readout id="h-{h}">
			<Label x={46} y={yOf(h) + 4} text="{h} m" size={11} anchor="end" muted />
		</Readout>
	{/each}
	<line x1="56" x2="56" y1={yOf(5)} y2={GROUND} stroke="var(--stage-line)" />
	<line
		x1="64"
		x2="350"
		y1={yOf(targetNow)}
		y2={yOf(targetNow)}
		stroke="var(--fc-target)"
		stroke-width="1.5"
		stroke-dasharray="6 5"
	/>
	<Readout id="target-col">
		<Label
			x={350}
			y={yOf(targetNow) - 6}
			text="target"
			size={11}
			anchor="end"
			color="var(--fc-target)"
		/>
	</Readout>

	{#if hasGusts}
		{@const len = gNow * 30}
		{#if Math.abs(len) > 4}
			<g opacity="0.85">
				{#each [-26, 0, 26] as dx (dx)}
					<line
						x1={COL + dx}
						x2={COL + dx}
						y1={yd + (len > 0 ? 60 : -60)}
						y2={yd + (len > 0 ? 60 : -60) - len}
						stroke="var(--fc-gust)"
						stroke-width="2.5"
						stroke-linecap="round"
						marker-end="url(#arrowhead)"
					/>
				{/each}
			</g>
		{/if}
		<Readout id="gust-label">
			<Label
				x={COL - 70}
				y={Math.max(80, yd - 40)}
				text={gNow > 0.3 ? 'gust up' : gNow < -0.3 ? 'gust down' : 'calm'}
				size={11}
				anchor="end"
				color="var(--fc-gust)"
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- forces -->
	<line
		x1={COL + 52}
		x2={COL + 52}
		y1={yd}
		y2={yd - thrust * NPX}
		stroke="var(--fc-out)"
		stroke-width="3"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={COL + 66}
		x2={COL + 66}
		y1={yd}
		y2={yd + mass * G * NPX}
		stroke="var(--stage-ink-muted)"
		stroke-width="3"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="force-labels">
		<Label
			anchor="start"
			x={COL + 74}
			y={yd - thrust * NPX + 10}
			text="thrust"
			size={11}
			color="var(--fc-out)"
			weight={600}
		/>
		<Label anchor="start" x={COL + 74} y={yd + mass * G * NPX} text="weight" size={11} muted />
	</Readout>

	<!-- the drone -->
	{#if hasParcel}
		<line x1={COL} x2={COL} y1={yd + 6} y2={yd + 26} stroke="var(--stage-ink-muted)" />
		<rect
			x={COL - 12}
			y={yd + 26}
			width="24"
			height="18"
			rx="3"
			fill="var(--fc-parcel)"
			stroke="var(--stage-ink)"
		/>
	{/if}
	<g transform="translate({COL} {yd})">
		<line x1="-34" x2="34" y1="-4" y2="-4" stroke="var(--fc-body)" stroke-width="3" />
		{#each [-34, 34] as dx (dx)}
			<line x1={dx} x2={dx} y1="-4" y2="-11" stroke="var(--fc-body)" stroke-width="2" />
			<ellipse cx={dx} cy="-12" rx={4 + 14 * spin} ry="2.5" fill="var(--fc-car)" opacity="0.8" />
		{/each}
		<rect
			x="-14"
			y="-8"
			width="28"
			height="13"
			rx="4"
			fill="var(--fc-car)"
			stroke="var(--stage-ink)"
		/>
	</g>

	<Card {cells} x={392} y={16} w={552} h={68} />

	<!-- height against time -->
	<Plot
		{sx}
		{sy}
		{xTicks}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xFormat={(s) => (s === SECONDS ? `${s} s` : String(s))}
		yFormat={(s) => `${s} m`}
	/>
	<Readout id="height-title">
		<Label anchor="start" x={P0} y={HP.top - 10} text="height" size={12} muted />
	</Readout>
	<!-- thrust against time -->
	<Plot {sx} sy={st} {xTicks} yTicks={[0, 10, 20]} xFormat={() => ''} yFormat={(s) => `${s} N`} />
	<line
		x1={P0}
		x2={P1}
		y1={st(mass * G)}
		y2={st(mass * G)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	<Readout id="thrust-title">
		<Label anchor="start" x={P0} y={TP.top - 8} text="thrust" size={12} muted />
		<Label x={P1} y={st(mass * G) - 5} text="weight" size={11} anchor="end" muted />
	</Readout>
	<g clip-path="url(#drone-plots)">
		<path
			d={targetPath}
			fill="none"
			stroke="var(--fc-target)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		<path
			d={heightPath}
			fill="none"
			stroke="var(--fc-response)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
		<path
			d={thrustPath}
			fill="none"
			stroke="var(--fc-out)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
	</g>
	<circle
		cx={sx(now)}
		cy={sy(Math.max(0, Math.min(5, z)))}
		r="4.5"
		fill="var(--fc-response)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- the controller's terms now -->
	<Readout id="terms">
		<g>
			<Label anchor="start" x={P0} y={524} text="the controller's terms now" size={12} muted />
			<line x1={BAR(0)} x2={BAR(0)} y1={516} y2={580} stroke="var(--stage-line)" />
			{#each bars as b, i (b.id)}
				{@const y = 528 + i * 20}
				{@const w = BAR(Math.max(-5, Math.min(5, b.v))) - BAR(0)}
				<rect
					x={Math.min(BAR(0), BAR(0) + w)}
					y={y - 7}
					width={Math.abs(w)}
					height="12"
					rx="3"
					fill={b.color}
				/>
				<Label
					x={BX - 10}
					y={y + 4}
					text="{b.id} {fmtN(b.v)} N"
					size={12}
					anchor="end"
					weight={600}
					color={b.color}
				/>
			{/each}
		</g>
	</Readout>
	{#each bars as b, i (b.id)}
		<Readout
			id="bar-{b.id}"
			order={10 + i}
			label="{b.id} term"
			value="{fmtN(b.v)} N"
			color={b.color}
		/>
	{/each}
	<Readout id="time" order={20} label="Time" value="{Math.floor(now)} s of {SECONDS}" />
</g>
