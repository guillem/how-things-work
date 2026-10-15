<script lang="ts">
	/**
	 * The Lorentz factor γ against the speed, with a marker at the slider's speed.
	 *
	 * Phases (`step.hints.phase`):
	 *   gamma — beside the curve, one tick of a clock at rest and of a moving
	 *           clock as bars (the second γ times longer)
	 *   muon  — beside the curve, a column of atmosphere: a muon born at its top
	 *           decays after τ = 2.2 µs on its own clock; drawn without time
	 *           dilation it gets β·c·τ down, with it γ·β·c·τ
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, gamma, MUON_LIFETIME, muonRange, num, tickAtRest } from '../relativity';
	import { duration } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'gamma'));
	const target = $derived(clamp(Number(params.beta ?? 0.6), 0, 0.99));
	const betaT = new Tween(0.6, { duration: 600, easing: cubicInOut });
	const muonW = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const b = target;
		const m = phase === 'muon' ? 1 : 0;
		untrack(() => {
			betaT.set(b, { duration: reduced ? 0 : 600 });
			muonW.set(m, { duration: reduced ? 0 : 700 });
		});
	});
	const beta = $derived(betaT.current);
	const g = $derived(gamma(beta));
	const wm = $derived(muonW.current);
	const wg = $derived(1 - wm);

	// ---- the plot --------------------------------------------------------------------
	const X0 = 90;
	const X1 = 540;
	const Y0 = 520; // γ = 1
	const Y1 = 80; // γ = 8
	const GMAX = 8;
	const px = (b: number) => X0 + (X1 - X0) * b;
	const py = (gm: number) => Y0 - ((Y0 - Y1) * (gm - 1)) / (GMAX - 1);
	const curve = (() => {
		let d = '';
		const bMax = Math.sqrt(1 - 1 / (GMAX * GMAX));
		for (let i = 0; i <= 160; i++) {
			const b = bMax * (1 - Math.pow(1 - i / 160, 2));
			d += `${i ? 'L' : 'M'}${px(b).toFixed(1)} ${py(gamma(b)).toFixed(1)} `;
		}
		return d;
	})();
	const BETA_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
	const GAMMA_TICKS = [1, 2, 3, 4, 5, 6, 7, 8];
	const REFS = [
		{ b: 0.6, text: '0.6 c → 1.25' },
		{ b: 0.8, text: '0.8 c → 5/3 ≈ 1.67' }
	];
	const M = $derived({ x: px(beta), y: py(g) });

	// ---- phase gamma: two ticks as bars ---------------------------------------------
	const BX = 610;
	const BW = 44; // stage units per tick at rest
	const tick0 = tickAtRest();
	const wide = $derived(BW * g + 10 > 200);

	// ---- phase muon: the atmosphere column ------------------------------------------
	const CX0 = 700; // the two tracks
	const CX1 = 840;
	const TOP = 120;
	const BOTTOM = 520;
	const KM = (BOTTOM - TOP) / 5; // the column shows 5 km
	const depth = (m: number) => TOP + (m / 1000) * KM;
	const range = $derived(muonRange(beta));
	const S_PER_US = 0.25; // seconds of animation per microsecond of muon life
	const life0 = MUON_LIFETIME * 1e6 * S_PER_US; // τ, in animation seconds
	const lifeG = $derived(life0 * g);
	const period = $derived(lifeG + 1.4);
	const tm = $derived(reduced ? lifeG * 0.75 : t % period);
	const muon = (life: number, distance: number) => {
		const u = Math.min(tm, life) / life;
		const y = TOP + (depth(distance) - TOP) * u;
		const decayed = tm >= life;
		const burst = decayed ? smoothstep(life, life + 0.6, tm) : 0;
		return { y, decayed, burst };
	};
	const tracks = $derived([
		{ x: CX0, m: muon(life0, range.naive), d: range.naive, life: MUON_LIFETIME, real: false },
		{ x: CX1, m: muon(lifeG, range.dilated), d: range.dilated, life: range.lifetime, real: true }
	]);
	const KMS = [0, 1, 2, 3, 4, 5];
	const metres = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${num(m / 1000, 2)} km`);
</script>

<g>
	<!-- ============ the γ curve ============ -->
	{#each GAMMA_TICKS as gm (gm)}
		<line x1={X0} x2={X1} y1={py(gm)} y2={py(gm)} stroke="var(--stage-grid)" />
		<Readout id="gt-{gm}">
			<Label x={X0 - 10} y={py(gm) + 4} text={String(gm)} size={11} anchor="end" muted />
		</Readout>
	{/each}
	{#each BETA_TICKS as b (b)}
		<line x1={px(b)} x2={px(b)} y1={Y0} y2={Y1} stroke="var(--stage-grid)" />
		<Readout id="bt-{b}">
			<Label
				x={px(b)}
				y={Y0 + 18}
				text={b === 1 ? 'c' : b === 0 ? '0' : `${num(b, 1)} c`}
				size={11}
				anchor="middle"
				muted
			/>
		</Readout>
	{/each}
	<line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--stage-line)" stroke-width="1.5" />
	<line
		x1={X1}
		x2={X1}
		y1={Y0}
		y2={Y1 - 10}
		stroke="var(--rel-light)"
		stroke-width="2"
		stroke-dasharray="5 5"
	/>
	<Readout id="light-label"
		>{#snippet narrow()}<Label
				x={X1}
				y={Y1 - 22}
				text="c"
				size={30}
				anchor="middle"
				color="var(--rel-light)"
				weight={650}
				italic
			/>{/snippet}
		<Label
			x={X1}
			y={Y1 - 18}
			text="the speed of light"
			size={12}
			anchor="middle"
			color="var(--rel-light)"
			weight={600}
		/>
	</Readout>
	<Readout id="x-caption">
		<Label
			x={(X0 + X1) / 2}
			y={Y0 + 42}
			text={wm > 0.5 ? 'speed of the muon' : 'speed of the train'}
			size={13}
			anchor="middle"
			muted
		/>
	</Readout>
	<Label x={X0 - 10} y={Y1 - 20} text="γ" size={16} anchor="end" italic weight={600} />
	<Readout id="y-caption">
		<Label anchor="start" x={X0 + 8} y={Y1 - 20} text="Lorentz factor" size={12} muted />
	</Readout>

	<path d={curve} fill="none" stroke="var(--rel-train)" stroke-width="3" stroke-linejoin="round" />
	{#each REFS as r (r.b)}
		{@const ry = py(gamma(r.b))}
		{#if Math.abs(r.b - beta) > 0.03}
			<circle cx={px(r.b)} cy={ry} r="4" fill="var(--stage-ink-muted)" />
			<Readout id="ref-{r.b}">
				<Label x={px(r.b) - 10} y={ry - 8} text={r.text} size={11} anchor="end" muted />
			</Readout>
		{/if}
	{/each}

	<!-- the marker at the slider's speed -->
	<line x1={M.x} x2={M.x} y1={Y0} y2={M.y} stroke="var(--rel-train)" stroke-dasharray="3 4" />
	<line x1={X0} x2={M.x} y1={M.y} y2={M.y} stroke="var(--rel-train)" stroke-dasharray="3 4" />
	<circle
		cx={M.x}
		cy={M.y}
		r="7"
		fill="var(--rel-train)"
		stroke="var(--stage-bg)"
		stroke-width="2.5"
	/>
	<Readout
		id="speed"
		order={1}
		label={wm > 0.5 ? 'Speed of the muon' : 'Speed of the train'}
		value="{num(beta)} c → γ = {num(g, 3)}"
	>
		<Label
			x={M.x < 280 ? M.x + 12 : M.x - 12}
			y={M.y - 12}
			anchor={M.x < 280 ? 'start' : 'end'}
			text="{num(beta)} c → γ = {num(g, 3)}"
			size={14}
			weight={650}
		/>
	</Readout>

	<!-- ============ phase gamma: the two ticks ============ -->
	{#if wg > 0.01}
		<g opacity={wg}>
			<Readout id="tick-title">
				<Label
					anchor="start"
					x={BX}
					y={110}
					text="One tick of the light clock"
					size={15}
					weight={650}
				/>
			</Readout>
			<Readout id="rest-caption">
				<Label anchor="start" x={BX} y={156} text="the clock at rest:" size={13} muted />
			</Readout>
			<rect x={BX} y={168} width={BW} height="22" rx="4" fill="var(--rel-plat)" />
			<Readout
				id="tick-rest"
				order={2}
				label="One tick, clock at rest"
				value={duration(tick0)}
				color="var(--rel-plat)"
				opacity={wg}
			>
				<Label
					anchor="start"
					x={BX + BW + 10}
					y={184}
					text={duration(tick0)}
					size={13}
					weight={600}
				/>
			</Readout>
			<Readout id="moving-caption">
				<Label
					anchor="start"
					x={BX}
					y={228}
					text="a clock moving at {num(beta)} c:"
					size={13}
					muted
				/>
			</Readout>
			<rect x={BX} y={240} width={BW * g} height="22" rx="4" fill="var(--rel-train)" />
			{#each Array.from({ length: Math.floor(g - 1e-9) }, (_, i) => i + 1) as i (i)}
				<line
					x1={BX + BW * i}
					x2={BX + BW * i}
					y1={240}
					y2={262}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/each}
			<Readout
				id="tick-moving"
				order={3}
				label="One tick, clock at {num(beta)} c"
				value={duration(tick0 * g)}
				note="= γ × {duration(tick0)}"
				color="var(--rel-train)"
				opacity={wg}
			>
				<Label
					anchor="start"
					x={wide ? BX : BX + BW * g + 10}
					y={wide ? 284 : 256}
					text="{duration(tick0 * g)} = γ × {duration(tick0)}"
					size={13}
					weight={600}
				/>
			</Readout>
			<Readout
				id="everyday"
				order={4}
				label="At everyday speeds"
				value="γ ≈ 1"
				note="jet airliner, 250 m/s: γ = {num(
					gamma(250 / C),
					14
				)} · GPS satellite, 3.9 km/s: γ = {num(gamma(3900 / C), 11)}"
				opacity={wg}
			>
				<Label
					anchor="start"
					x={BX}
					y={340}
					text="at everyday speeds γ is almost exactly 1:"
					size={13}
					muted
				/>
				<Label anchor="start" x={BX} y={364} text="jet airliner, 250 m/s:" size={13} />
				<Label
					anchor="start"
					x={BX + 16}
					y={384}
					text="γ = {num(gamma(250 / C), 14)}"
					size={13}
					weight={600}
				/>
				<Label anchor="start" x={BX} y={410} text="GPS satellite, 3.9 km/s:" size={13} />
				<Label
					anchor="start"
					x={BX + 16}
					y={430}
					text="γ = {num(gamma(3900 / C), 11)}"
					size={13}
					weight={600}
				/>
			</Readout>
		</g>
	{/if}

	<!-- ============ phase muon: the atmosphere ============ -->
	{#if wm > 0.01}
		<g opacity={wm}>
			<rect
				x={CX0 - 60}
				y={TOP}
				width={CX1 - CX0 + 120}
				height={BOTTOM - TOP}
				rx="6"
				fill="var(--rel-plat)"
				opacity="0.08"
			/>
			{#each KMS as km (km)}
				<line
					x1={CX0 - 60}
					x2={CX1 + 60}
					y1={TOP + km * KM}
					y2={TOP + km * KM}
					stroke="var(--stage-grid)"
				/>
				<Readout id="km-{km}">
					<Label x={CX0 - 68} y={TOP + km * KM + 4} text="{km} km" size={11} anchor="end" muted />
				</Readout>
			{/each}
			<Readout id="muon-title">
				<Label
					x={(CX0 + CX1) / 2}
					y={TOP - 50}
					text="A muon at {num(beta)} c: how far, on average,"
					size={14}
					weight={650}
					anchor="middle"
				/>
				<Label
					x={(CX0 + CX1) / 2}
					y={TOP - 32}
					text="before it decays?"
					size={14}
					weight={650}
					anchor="middle"
				/>
			</Readout>
			<Readout
				id="naive"
				order={2}
				label="Dashed: no time dilation"
				value={metres(range.naive)}
				note="after {duration(MUON_LIFETIME)}"
				opacity={wm}
			>
				<Label x={CX0} y={TOP - 8} text="no time dilation" size={12} anchor="middle" muted />
			</Readout>
			<Readout
				id="dilated"
				order={3}
				label="Solid: what happens"
				value={metres(range.dilated)}
				note="after {duration(range.lifetime)}"
				color="var(--rel-muon)"
				opacity={wm}
			>
				<Label
					x={CX1}
					y={TOP - 8}
					text="what happens"
					size={12}
					anchor="middle"
					color="var(--rel-muon)"
					weight={650}
				/>
			</Readout>

			{#each tracks as track (track.x)}
				{@const end = depth(track.d)}
				<line
					x1={track.x}
					x2={track.x}
					y1={TOP}
					y2={end}
					stroke="var(--rel-muon)"
					stroke-width="2"
					stroke-dasharray={track.real ? undefined : '4 4'}
					opacity="0.6"
				/>
				<line
					x1={track.x - 12}
					x2={track.x + 12}
					y1={end}
					y2={end}
					stroke="var(--rel-muon)"
					stroke-width="2"
				/>
				<Readout id="track-{track.x}">
					<Label
						anchor="start"
						x={track.x + 16}
						y={end + 4}
						text={metres(track.d)}
						size={13}
						weight={650}
					/>
					<Label
						anchor="start"
						x={track.x + 16}
						y={end + 20}
						text="after {duration(track.life)}"
						size={11}
						muted
					/>
				</Readout>
				{#if !track.m.decayed}
					<circle cx={track.x} cy={track.m.y} r="6" fill="var(--rel-muon)" filter="url(#glow)" />
				{:else if track.m.burst < 1 && !reduced}
					<circle
						cx={track.x}
						cy={end}
						r={6 + 16 * track.m.burst}
						fill="none"
						stroke="var(--rel-muon)"
						stroke-width="2"
						opacity={1 - track.m.burst}
					/>
				{/if}
			{/each}
			<Readout
				id="own-clock"
				order={4}
				label="On the muon's own clock"
				value="2.2 µs in both"
				note="other times on our clocks"
				opacity={wm}
			>
				<Label
					x={(CX0 + CX1) / 2}
					y={BOTTOM + 24}
					text="on the muon's own clock: 2.2 µs in both"
					size={12}
					anchor="middle"
					muted
				/>
				<Label
					x={(CX0 + CX1) / 2}
					y={BOTTOM + 42}
					text="(times on our clocks; animation slowed 250 000 times)"
					size={11}
					anchor="middle"
					muted
				/>
			</Readout>
		</g>
	{/if}
</g>
