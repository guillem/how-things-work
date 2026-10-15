<script lang="ts">
	/**
	 * A D–T plasma in its vessel, and its power balance.
	 *
	 * Left, in both phases: deuterium and tritium ions flying about (speed ∝ √T, number ∝ log
	 * density); fusions flash at random places at a rate that grows with the fusion power,
	 * each sending a neutron out through the wall and leaving an alpha behind; red arrows
	 * show outside heating, blue ones the heat leaking out.
	 *
	 * Phases (`step.hints.phase`):
	 *   balance — right: the steady power balance at the chosen settings (fusion power; heat
	 *             in = alphas + heaters; heat out = leaks + X-rays) and the gain Q
	 *   run     — the heaters hold the plasma at its temperature, then switch off; right: its
	 *             temperature through time (`coast` in the model), and what happened
	 *
	 * Fusion events are a pure function of t: time is cut into slots of 1/20 s and a slot
	 * holds a fusion when its hash is under the current rate × slot length.
	 */
	import { Axes, Label, clamp, hash, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { coast, powers, T_MAX, T_MIN } from '../model';
	import { kelvinText, plasmaOf, powerText, qText, sci } from './settings';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'balance'));
	const plasma = $derived(plasmaOf(params));
	const p0 = $derived(powers(plasma));
	const logN = $derived(Math.log10(plasma.n));

	// ---- the run (phase 'run') -------------------------------------------------------------
	const LEAD = 2.5; // seconds with the heaters on before they switch off
	const SWEEP = 10; // seconds of animation for the whole run after switch-off
	const PRE_SPANS = 2; // confinement times of "heating on" drawn before switch-off
	const run = $derived(phase === 'run' ? coast(plasma, 8, 400) : null);
	const runKey = $derived(
		`${phase}|${plasma.t}|${plasma.n}|${plasma.tau}|${Number(params.run ?? 0)}`
	);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e9;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});
	/** Share of the run after switch-off shown so far (0–1); negative while heating. */
	const u = $derived(phase === 'run' ? (elapsed - LEAD) / SWEEP : 0);
	const heatersOn = $derived(phase !== 'run' || u < 0);
	const sampleAt = (v: number) => {
		if (!run) return { t: plasma.t, fusion: p0.fusion };
		const x = clamp(v) * (run.samples.length - 1);
		const k = Math.min(run.samples.length - 2, Math.floor(x));
		const f = x - k;
		const a = run.samples[k];
		const b = run.samples[k + 1];
		return { t: lerp(a.t, b.t, f), fusion: lerp(a.fusion, b.fusion, f) };
	};
	const now = $derived(sampleAt(u));
	const tNow = $derived(now.t);
	const pNow = $derived(powers({ ...plasma, t: tNow }));

	// ---- the vessel ----------------------------------------------------------------------
	const VX0 = 56;
	const VX1 = 404;
	const VY0 = 150;
	const VY1 = 470;
	const PAD = 26;
	const count = $derived(Math.round(16 + 24 * (logN - 19)));
	const speed = $derived(14 * Math.sqrt(clamp(tNow, 0.2, 100)) + 4);
	const time = $derived(reduced ? 2.5 : t);
	/** Folds a coordinate back into [lo, hi] like a ball bouncing between two walls. */
	const bounce = (v: number, lo: number, hi: number) => {
		const w = hi - lo;
		const m = (((v - lo) % (2 * w)) + 2 * w) % (2 * w);
		return lo + (m < w ? m : 2 * w - m);
	};
	// Ion positions accumulate speed × dt so a change of temperature does not jump them.
	let travelled = 0;
	let lastT = 0;
	const dist = $derived.by(() => {
		const dt = time - lastT;
		lastT = time;
		if (dt > 0 && dt < 0.25 && !reduced) travelled += dt * speed;
		return travelled + (reduced ? 2.5 * speed : 0);
	});
	const ions = $derived(
		Array.from({ length: count }, (_, i) => {
			const a = hash(i, 1) * Math.PI * 2;
			const s = 0.6 + 0.8 * hash(i, 2);
			return {
				id: i,
				x: bounce(lerp(VX0, VX1, hash(i, 3)) + Math.cos(a) * s * dist, VX0 + PAD, VX1 - PAD),
				y: bounce(lerp(VY0, VY1, hash(i, 4)) + Math.sin(a) * s * dist, VY0 + PAD, VY1 - PAD),
				tritium: i % 2 === 1
			};
		})
	);

	// Fusion events: visual rate from the fusion power (W/m³), on a log scale.
	const rate = $derived(now.fusion > 0 ? clamp(0.4 + 1.6 * (Math.log10(now.fusion) - 3), 0, 9) : 0);
	const SLOT = 0.05;
	const LIFE = 0.9;
	const events = $derived.by(() => {
		const out: { id: number; x: number; y: number; nx: number; ny: number; age: number }[] = [];
		if (rate <= 0) return out;
		const last = Math.floor(time / SLOT);
		for (let k = Math.max(0, last - Math.ceil(LIFE / SLOT)); k <= last; k++) {
			if (hash(k, 11) > rate * SLOT) continue;
			const age = time - k * SLOT;
			if (age < 0 || age > LIFE) continue;
			const a = hash(k, 12) * Math.PI * 2;
			out.push({
				id: k,
				x: lerp(VX0 + 60, VX1 - 60, hash(k, 13)),
				y: lerp(VY0 + 50, VY1 - 50, hash(k, 14)),
				nx: Math.cos(a),
				ny: Math.sin(a),
				age
			});
		}
		return out;
	});
	/** Distance from an event to the vessel wall along its neutron's direction. */
	const wallDistance = (e: { x: number; y: number; nx: number; ny: number }) => {
		const dx = e.nx > 0 ? (VX1 - e.x) / e.nx : e.nx < 0 ? (VX0 - e.x) / e.nx : Infinity;
		const dy = e.ny > 0 ? (VY1 - e.y) / e.ny : e.ny < 0 ? (VY0 - e.y) / e.ny : Infinity;
		return Math.min(dx, dy);
	};
	const glow = $derived(clamp((Math.log10(clamp(tNow, 0.2, 100)) + 0.3) / 2.3));
	const heatW = $derived(
		heatersOn && p0.heating > 0 ? 2 + 6 * clamp(p0.heating / (p0.conduction + p0.brems)) : 0
	);
	const leakW = $derived(1.5 + 4 * clamp(Math.log10(1 + pNow.conduction / 1e4) / 3));

	// ---- balance bars --------------------------------------------------------------------
	const BX = 520;
	const BY0 = 150;
	const BY1 = 440;
	const barMax = $derived(Math.max(p0.fusion, p0.conduction + p0.brems));
	const bh = (w: number) => ((BY1 - BY0) * w) / barMax;
	const heatIn = $derived(Math.max(0, p0.heating));
	const aliveBar = $derived(reduced ? 1 : smoothstep(0.2, 1.2, t));
	const columns = $derived([
		{
			id: 'fusion',
			x: BX,
			title: 'fusion',
			parts: [
				{ id: 'alpha', v: p0.alpha, color: 'var(--nf-alpha)', label: 'alphas' },
				{
					id: 'neutrons',
					v: p0.fusion - p0.alpha,
					color: 'var(--nf-neutron-power)',
					label: 'neutrons'
				}
			]
		},
		{
			id: 'in',
			x: BX + 140,
			title: 'heat in',
			parts: [
				{ id: 'alpha', v: p0.alpha, color: 'var(--nf-alpha)', label: 'alphas' },
				{ id: 'heaters', v: heatIn, color: 'var(--nf-heat)', label: 'heaters' }
			]
		},
		{
			id: 'out',
			x: BX + 280,
			title: 'heat out',
			parts: [
				{ id: 'leak', v: p0.conduction, color: 'var(--nf-loss)', label: 'leaks' },
				{ id: 'xrays', v: p0.brems, color: 'var(--nf-brems)', label: 'X-rays' }
			]
		}
	]);
	const surplus = $derived(p0.heating < 0 ? -p0.heating : 0);

	// ---- temperature plot (run) -----------------------------------------------------------
	const PX0 = 520;
	const PX1 = 900;
	const PY0 = 150;
	const PY1 = 430;
	const span = $derived(run ? run.duration : 8);
	const tau = $derived(plasma.tau);
	const px = $derived(scale([-PRE_SPANS * tau, span], [PX0, PX1]));
	const py = scale([Math.log10(0.2), 2], [PY1, PY0]);
	const ly = (v: number) => py(Math.log10(clamp(v, 0.2, 100)));
	const curve = $derived.by(() => {
		if (!run) return '';
		const x0 = px(-PRE_SPANS * tau);
		const y0 = ly(plasma.t).toFixed(1);
		if (u <= 0) return `M${x0.toFixed(1)} ${y0} L${cursorX.toFixed(1)} ${y0}`;
		let d = `M${x0.toFixed(1)} ${y0} L${px(0).toFixed(1)} ${y0}`;
		const n = Math.max(2, Math.round(clamp(u) * (run.samples.length - 1)) + 1);
		for (const sm of run.samples.slice(0, n)) {
			d += ` L${px(sm.time).toFixed(1)} ${ly(sm.t).toFixed(1)}`;
			if (sm.t <= T_MIN) break; // below the bottom of the chart (and of the model's range)
		}
		return d;
	});
	const cursorX = $derived(
		u <= 0 ? px(-PRE_SPANS * tau * (1 - clamp(elapsed / LEAD))) : px(clamp(u) * span)
	);
	const done = $derived(u >= 1);
	const outcome = $derived.by(() => {
		if (!run) return '';
		if (run.outcome === 'ignites')
			return run.capped
				? `ignites: heats itself past ${T_MAX} keV`
				: `ignites: burns steadily at ${Math.round(run.final)} keV`;
		if (run.outcome === 'steady') return 'holds steady: on the edge of ignition';
		return 'cools: fusion fizzles out';
	});
	const fmtT = (v: number) =>
		v <= T_MIN ? `under ${T_MIN}` : v >= 10 ? Math.round(v).toString() : v.toFixed(1);
	const fmtS = (s: number) => {
		const a = Math.abs(s);
		const sign = s < 0 ? '−' : '';
		return a >= 1
			? `${sign}${Number(a.toPrecision(2))} s`
			: `${sign}${Number((a * 1000).toPrecision(2))} ms`;
	};
	const xTicks = $derived([-PRE_SPANS * tau, 0, 2 * tau, 4 * tau, 6 * tau, 8 * tau]);
</script>

<g>
	<!-- vessel -->
	<rect
		x={VX0}
		y={VY0}
		width={VX1 - VX0}
		height={VY1 - VY0}
		rx="40"
		fill="var(--nf-vessel)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<ellipse
		cx={(VX0 + VX1) / 2}
		cy={(VY0 + VY1) / 2}
		rx={(VX1 - VX0) / 2 - 22}
		ry={(VY1 - VY0) / 2 - 22}
		fill="var(--nf-plasma)"
		opacity={0.12 + 0.4 * glow}
		filter="url(#glow)"
	/>
	{#each ions as ion (ion.id)}
		<circle
			cx={ion.x}
			cy={ion.y}
			r="4.5"
			fill={ion.tritium ? 'var(--nf-proton)' : 'var(--nf-fuel)'}
			opacity="0.9"
		/>
	{/each}
	{#each events as e (e.id)}
		{@const flash = 1 - smoothstep(0, 0.3, e.age)}
		{@const nd = Math.min(40 + 260 * e.age, wallDistance(e) + 30)}
		<circle
			cx={e.x}
			cy={e.y}
			r={6 + 16 * (1 - flash)}
			fill="var(--nf-fusion)"
			opacity={0.8 * flash}
		/>
		<circle
			cx={e.x + e.nx * nd}
			cy={e.y + e.ny * nd}
			r="3.5"
			fill="var(--nf-neutron)"
			opacity={smoothstep(0, 0.1, e.age) * (1 - smoothstep(0.7, 0.9, e.age))}
		/>
		<circle
			cx={e.x - e.nx * 12 * Math.sqrt(e.age)}
			cy={e.y - e.ny * 12 * Math.sqrt(e.age)}
			r="3.5"
			fill="var(--nf-alpha)"
			opacity={1 - smoothstep(0.4, 0.9, e.age)}
		/>
	{/each}
	<!-- heaters and leaks -->
	{#if heatW > 0}
		{#each [VX0 - 6, VX1 + 6] as x, i (i)}
			<line
				x1={x + (i ? 32 : -32)}
				y1={(VY0 + VY1) / 2}
				x2={x + (i ? 4 : -4)}
				y2={(VY0 + VY1) / 2}
				stroke="var(--nf-heat)"
				stroke-width={heatW}
				marker-end="url(#arrowhead)"
			/>
		{/each}
	{/if}
	{#each [VX0 + 90, VX1 - 90] as x, i (i)}
		<line
			x1={x}
			y1={VY0 - 4}
			x2={x}
			y2={VY0 - 32}
			stroke="var(--nf-loss)"
			stroke-width={leakW}
			marker-end="url(#arrowhead)"
			opacity="0.8"
		/>
		<line
			x1={x}
			y1={VY1 + 4}
			x2={x}
			y2={VY1 + 32}
			stroke="var(--nf-loss)"
			stroke-width={leakW}
			marker-end="url(#arrowhead)"
			opacity="0.8"
		/>
	{/each}
	<Readout id="key-leak">
		<Label x={(VX0 + VX1) / 2} y={VY0 - 14} text="heat leaks out" size={11} muted />
	</Readout>
	<Readout id="key-ions">
		<g transform="translate({VX0} {VY1 + 58})">
			<circle cx="6" cy="0" r="5" fill="var(--nf-fuel)" />
			<text x="15" y="4" font-size="11">deuterium</text>
			<circle cx="92" cy="0" r="5" fill="var(--nf-proton)" />
			<text x="101" y="4" font-size="11">tritium</text>
			<circle cx="164" cy="0" r="5" fill="var(--nf-alpha)" />
			<text x="173" y="4" font-size="11">alpha</text>
			<circle cx="220" cy="0" r="5" fill="var(--nf-neutron)" />
			<text x="229" y="4" font-size="11">neutron</text>
			{#if heatW > 0}
				<line x1="290" x2="310" y1="0" y2="0" stroke="var(--nf-heat)" stroke-width="3" />
				<text x="315" y="4" font-size="11">heating</text>
			{/if}
		</g>
	</Readout>

	<!-- settings -->
	<Readout
		id="settings"
		order={0}
		label="Plasma"
		value="{fmtT(tNow)} keV · {sci(plasma.n)} ions/m³ · τ_E = {fmtS(tau)}"
	>
		<Label
			x={VX0}
			y={58}
			text="{fmtT(tNow)} keV ({kelvinText(tNow)}) · {sci(plasma.n)} ions/m³ · τ_E = {fmtS(tau)}"
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>

	{#if phase === 'balance'}
		<Label
			x={BX - 20}
			y={110}
			text={surplus > 0
				? 'Power per cubic metre: the alphas out-heat the losses'
				: 'Power per cubic metre, held steady'}
			anchor="start"
			size={14}
			weight={600}
		/>
		{#each columns as c (c.id)}
			{@const total = c.parts.reduce((s, p) => s + p.v, 0)}
			<text x={c.x + 40} y={BY1 + 22} text-anchor="middle" font-size="12" font-weight="600"
				>{c.title}</text
			>
			<text
				x={c.x + 40}
				y={BY1 - bh(total) * aliveBar - 8}
				text-anchor="middle"
				font-size="11"
				class="muted">{powerText(total)}</text
			>
			{#each c.parts as part, k (part.id)}
				{@const below = c.parts.slice(0, k).reduce((s, p) => s + p.v, 0)}
				{@const h = bh(part.v) * aliveBar}
				{@const y = BY1 - bh(below) * aliveBar - h}
				<rect x={c.x} {y} width="80" height={Math.max(0, h)} fill={part.color} opacity="0.85" />
				{#if h > 16}
					<text
						x={c.x + 40}
						y={y + h / 2 + 4}
						text-anchor="middle"
						font-size="11"
						fill="var(--nf-bar-ink)"
						font-weight="600">{part.label}</text
					>
				{/if}
			{/each}
		{/each}
		<line x1={BX - 10} x2={BX + 370} y1={BY1} y2={BY1} stroke="var(--stage-line)" />
		<Readout id="q" order={1} label="Gain Q" value={qText(p0.q)} color="var(--nf-fusion)">
			<Label
				x={BX - 20}
				y={BY1 + 64}
				text="gain Q = fusion ÷ heaters = {qText(p0.q)}"
				anchor="start"
				size={16}
				weight={700}
				color="var(--nf-fusion)"
			/>
		</Readout>
		<Readout
			id="heat"
			order={2}
			label="Heaters must supply"
			value={surplus > 0 ? 'nothing: the alphas are enough' : powerText(heatIn)}
		>
			<Label
				x={BX - 20}
				y={BY1 + 90}
				text={surplus > 0
					? 'heaters: none needed — the alphas alone keep it hot'
					: `heaters must supply ${powerText(heatIn)}`}
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
		<Readout id="fusionP" order={3} label="Fusion power" value={powerText(p0.fusion)} />
	{:else if run}
		<Label
			x={PX0 - 20}
			y={110}
			text="Temperature after the heaters switch off"
			anchor="start"
			size={14}
			weight={600}
		/>
		<rect
			x={px(-PRE_SPANS * tau)}
			y={PY0}
			width={px(0) - px(-PRE_SPANS * tau)}
			height={PY1 - PY0}
			fill="var(--nf-heat)"
			opacity="0.08"
		/>
		<Axes
			sx={px}
			sy={py}
			{xTicks}
			xFormat={(v: number) => (Math.abs(v) < 1e-12 ? 'off' : fmtS(v))}
			yTicks={[Math.log10(0.2), 0, Math.log10(5), 1, Math.log10(50), 2]}
			yFormat={(v: number) => String(Number((10 ** v).toPrecision(1)))}
			xLabel="time"
			yLabel="keV"
		/>
		<Readout id="heaters-on">
			<Label
				x={(px(-PRE_SPANS * tau) + px(0)) / 2}
				y={PY1 - 10}
				text="heaters on"
				size={11}
				color="var(--nf-heat)"
			/>
		</Readout>
		<path
			d={curve}
			fill="none"
			stroke="var(--nf-fusion)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		{#if !done}
			<circle
				cx={cursorX}
				cy={ly(tNow)}
				r="6"
				fill="var(--nf-fusion)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		<Readout id="tnow" order={1} label="Temperature now" value="{fmtT(tNow)} keV">
			<Label x={PX1} y={PY0 - 14} text="now {fmtT(tNow)} keV" anchor="end" size={13} weight={600} />
		</Readout>
		<Readout id="q0" order={2} label="Gain with heaters on" value={qText(p0.q)}>
			<Label
				x={PX0 - 20}
				y={PY1 + 66}
				text="with heaters on, gain Q = {qText(p0.q)}"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
		<Readout
			id="outcome"
			order={3}
			label="Heaters off"
			value={done ? outcome : u < 0 ? 'heating…' : 'watching…'}
			color="var(--nf-fusion)"
		>
			<Label
				x={PX0 - 20}
				y={PY1 + 92}
				text={done ? outcome : u < 0 ? 'heaters on: holding the temperature' : 'heaters off…'}
				anchor="start"
				size={16}
				weight={700}
				color={done ? 'var(--nf-fusion)' : undefined}
			/>
		</Readout>
	{/if}
</g>
