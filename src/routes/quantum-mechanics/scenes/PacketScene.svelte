<script lang="ts">
	/**
	 * The wave function drawn as Re ψ (blue), Im ψ (orange) and |ψ|² (filled).
	 *
	 * Phases (`step.hints.phase`):
	 *   packet — a free electron packet (energy `params.energy`, starting width
	 *            `params.sigma`) from x = −14 nm, solved exactly with the
	 *            model's free evolution (one FFT pair per frame) on a 2048-point
	 *            grid. 1 s of animation = 4 fs; the run repeats once the packet
	 *            has crossed the view (fading out and in at the ends). Readouts:
	 *            ⟨x⟩, spread now vs at the start, total probability ∫|ψ|²dx.
	 *   box    — stationary states of an infinite square well of width
	 *            `params.boxL`: ψₙ e^(−iEₙt/ħ), or n = 1 and 2 together. The time
	 *            is slowed so that the n = 1 state turns once every 6 s for every
	 *            box width (the readout gives the real period). Panel: the energy
	 *            ladder and a dial showing ψ turning at one point.
	 *
	 * Reduced motion: t is frozen at 2.5 s by the explainer; both frames read
	 * as complete pictures (the packet mid-flight, the state at a moment).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HBAR,
		PLANCK,
		boxEnergy,
		boxState,
		deBroglie,
		freeEvolve,
		gaussian,
		grid,
		moments,
		norm,
		speed,
		waveNumber
	} from '../quantum';
	import T from './T.svelte';

	let { step, t, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'packet'));
	const isBox = $derived(phase === 'box');

	// ---- layout -----------------------------------------------------------------------
	const PX0 = 40;
	const PX1 = 680;
	const BW = 200; // baseline of Re ψ and Im ψ
	const BP = 430; // baseline of |ψ|²
	const AP = 150; // px for the largest |ψ|² at the start
	const AMP = 100; // px for the largest |ψ| at the start

	// ---- the free packet --------------------------------------------------------------
	const E = $derived(clamp(Number(params.energy ?? 1), 0.2, 3));
	const sigma0 = $derived(clamp(Number(params.sigma ?? 1), 0.4, 3));
	const g = grid(2048, 0.05);
	const XMIN = -20;
	const XMAX = 30;
	const X0 = -14;
	const FS_PER_S = 4;
	const psi0 = $derived(gaussian(g, X0, sigma0, waveNumber(E)));
	const v = $derived(speed(E));
	/** Simulated time: the packet runs until its centre is 6 nm past the right edge. */
	const loopT = $derived((XMAX + 6 - X0) / v);
	const simT = $derived(isBox ? 0 : (t * FS_PER_S) % loopT);
	const loopFade = $derived(
		smoothstep(0, 1.2, simT) * (1 - smoothstep(loopT - 3 * (1 / v), loopT, simT))
	);
	const psi = $derived(isBox ? psi0 : freeEvolve(g, psi0, simT));
	const m = $derived(moments(g, psi));
	const total = $derived(norm(g, psi));
	const peak0 = $derived(Math.pow(2 * Math.PI * sigma0 * sigma0, -0.25));
	const sx = (x: number) => PX0 + ((x - XMIN) / (XMAX - XMIN)) * (PX1 - PX0);
	const packetPaths = $derived.by(() => {
		if (isBox) return { re: '', im: '', prob: '' };
		const j0 = Math.round(XMIN / g.dx) + g.n / 2;
		const j1 = Math.round(XMAX / g.dx) + g.n / 2;
		let re = '';
		let im = '';
		let prob = `M${sx(XMIN).toFixed(1)} ${BP}`;
		for (let j = j0; j <= j1; j++) {
			const x = sx(g.x[j]).toFixed(1);
			const a = psi.re[j] / peak0;
			const b = psi.im[j] / peak0;
			re += `${re ? 'L' : 'M'}${x} ${(BW - a * AMP).toFixed(1)}`;
			im += `${im ? 'L' : 'M'}${x} ${(BW - b * AMP).toFixed(1)}`;
			prob += `L${x} ${(BP - (a * a + b * b) * AP).toFixed(1)}`;
		}
		prob += `L${sx(XMAX).toFixed(1)} ${BP}Z`;
		return { re, im, prob };
	});

	// ---- the box --------------------------------------------------------------------------
	const L = $derived(clamp(Number(params.boxL ?? 1), 0.5, 2));
	const level = $derived(String(params.level ?? '1'));
	const states = $derived(level === '1+2' ? [1, 2] : [Number(level) || 1]);
	const E1 = $derived(boxEnergy(1, L));
	/** Real period of the n = 1 state, fs; shown as 6 s. */
	const period1 = $derived(PLANCK / E1);
	const boxT = $derived(isBox ? (t / 6) * period1 : 0); // fs
	const BX0 = 70;
	const BX1 = 610;
	const bx = (x: number) => BX0 + (x / L) * (BX1 - BX0);
	const boxPeak = $derived(Math.sqrt(2 / L) * (level === '1+2' ? Math.SQRT2 : 1));
	const boxPsi = (x: number) => {
		let re = 0;
		let im = 0;
		const c = 1 / Math.sqrt(states.length);
		for (const n of states) {
			const f = c * boxState(n, L, x);
			const ph = (-boxEnergy(n, L) * boxT) / HBAR;
			re += f * Math.cos(ph);
			im += f * Math.sin(ph);
		}
		return { re, im };
	};
	const boxPaths = $derived.by(() => {
		if (!isBox) return { re: '', im: '', prob: '' };
		const N = 240;
		let re = '';
		let im = '';
		let prob = `M${BX0} ${BP}`;
		const s = boxPeak;
		for (let i = 0; i <= N; i++) {
			const x = (i / N) * L;
			const p = boxPsi(x);
			const X = bx(x).toFixed(1);
			re += `${i ? 'L' : 'M'}${X} ${(BW - (p.re / s) * AMP).toFixed(1)}`;
			im += `${i ? 'L' : 'M'}${X} ${(BW - (p.im / s) * AMP).toFixed(1)}`;
			prob += `L${X} ${(BP - ((p.re * p.re + p.im * p.im) / (s * s)) * AP).toFixed(1)}`;
		}
		prob += `L${BX1} ${BP}Z`;
		return { re, im, prob };
	});
	/** Where the probability sits: ⟨x⟩ / L, for the sloshing readout. */
	const boxMean = $derived.by(() => {
		if (!isBox) return 0.5;
		let s = 0;
		let sx2 = 0;
		const N = 200;
		for (let i = 1; i < N; i++) {
			const x = (i / N) * L;
			const p = boxPsi(x);
			const d = p.re * p.re + p.im * p.im;
			s += d;
			sx2 += d * x;
		}
		return sx2 / s / L;
	});
	const dialX = 0.3; // fraction of the box where the dial reads ψ
	const dial = $derived.by(() => {
		const p = boxPsi(dialX * L);
		return { re: p.re / boxPeak, im: p.im / boxPeak };
	});

	// ---- energy ladder ----------------------------------------------------------------------
	const LAD_X = 724;
	const LAD_W = 120;
	const LAD_BASE = 420;
	const LAD_H = 210; // px for 9 E₁
	const ladder = $derived(
		[1, 2, 3].map((n) => ({
			n,
			y: LAD_BASE - (n * n * LAD_H) / 9,
			e: boxEnergy(n, L),
			on: states.includes(n)
		}))
	);

	const focus = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const f = isBox ? 1 : 0;
		untrack(() => focus.set(f));
	});

	const f2 = (x: number) => x.toFixed(2);
	const dialNote = $derived(
		level === '1+2'
			? 'two parts turning at different rates'
			: `turns once every ${f2(period1 / states[0] ** 2)} fs`
	);
	/** 6 s on screen for one real turn of n = 1, as "5 × 10¹⁴". */
	const slowdown = $derived.by(() => {
		const f = 6 / (period1 * 1e-15);
		const e = Math.floor(Math.log10(f));
		const sup = String(e)
			.split('')
			.map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)])
			.join('');
		return `${(f / 10 ** e).toFixed(0)} × 10${sup}`;
	});
	const PL = 724;
</script>

<g>
	<!-- the two baselines: the wave itself (top) and the probability (bottom) -->
	{#each [BW, BP] as y (y)}
		<line
			x1={isBox ? BX0 - 30 : PX0}
			x2={isBox ? BX1 + 30 : PX1}
			y1={y}
			y2={y}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
	{/each}
	<Readout id="row-labels">
		<T x={isBox ? BX0 + 6 : PX0} y={BW - 112} text="the wave ψ" size={12} muted />
		<T x={isBox ? BX0 + 6 : PX0} y={BP - 162} text="probability density |ψ|²" size={12} muted />
	</Readout>

	{#if !isBox}
		<g opacity={loopFade}>
			<path d={packetPaths.re} fill="none" stroke="var(--qm-re)" stroke-width="1.5" />
			<path d={packetPaths.im} fill="none" stroke="var(--qm-im)" stroke-width="1.5" />
			<path
				d={packetPaths.prob}
				fill="var(--qm-prob-fill)"
				stroke="var(--qm-prob)"
				stroke-width="2"
			/>
			<!-- the spread ±σ about the mean -->
			<path
				d="M{sx(m.mean - m.spread)} {BP + 14}v12M{sx(m.mean - m.spread)} {BP + 20}H{sx(
					m.mean + m.spread
				)}M{sx(m.mean + m.spread)} {BP + 14}v12"
				fill="none"
				stroke="var(--qm-prob)"
				stroke-width="2"
			/>
			<circle cx={sx(m.mean)} cy={BP} r="4" fill="var(--stage-ink)" />
			<Readout id="spread-label">
				<T x={sx(m.mean)} y={BP + 42} text="±σ" size={12} anchor="middle" color="var(--qm-prob)" />
			</Readout>
		</g>
		<!-- distance scale -->
		<line x1={PX0} x2={PX1} y1={BP + 60} y2={BP + 60} stroke="var(--stage-line)" />
		{#each [-20, -10, 0, 10, 20, 30] as x (x)}
			<line x1={sx(x)} x2={sx(x)} y1={BP + 60} y2={BP + 66} stroke="var(--stage-line)" />
			<Readout id="tick-{x}">
				<T x={sx(x)} y={BP + 82} text={String(x)} size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<Readout id="axis-unit">
			<T x={PX1} y={BP + 104} text="position x (nm)" size={12} anchor="end" muted />
		</Readout>
	{:else}
		<!-- the box walls -->
		<rect
			x={BX0 - 30}
			y={BW - 100}
			width="30"
			height={BP - BW + 110}
			fill="var(--qm-wall)"
			opacity="0.5"
		/>
		<rect
			x={BX1}
			y={BW - 100}
			width="30"
			height={BP - BW + 110}
			fill="var(--qm-wall)"
			opacity="0.5"
		/>
		<path d={boxPaths.re} fill="none" stroke="var(--qm-re)" stroke-width="2" />
		<path d={boxPaths.im} fill="none" stroke="var(--qm-im)" stroke-width="2" />
		<path d={boxPaths.prob} fill="var(--qm-prob-fill)" stroke="var(--qm-prob)" stroke-width="2" />
		<line
			x1={bx(dialX * L)}
			x2={bx(dialX * L)}
			y1={BW - 100}
			y2={BW + 100}
			stroke="var(--stage-ink)"
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
		<Readout id="box-width">
			<line x1={BX0} x2={BX1} y1={BP + 64} y2={BP + 64} stroke="var(--stage-line)" />
			<line x1={BX0} x2={BX0} y1={BP + 58} y2={BP + 70} stroke="var(--stage-line)" />
			<line x1={BX1} x2={BX1} y1={BP + 58} y2={BP + 70} stroke="var(--stage-line)" />
			<T x={(BX0 + BX1) / 2} y={BP + 86} text="L = {L.toFixed(1)} nm" size={13} anchor="middle" />
		</Readout>
		<Readout
			id="slosh"
			order={4}
			label="Average position"
			value="{Math.round(boxMean * 100)}% of the way across"
		>
			<path d="M{bx(boxMean * L)} {BP + 4}l-6 12h12z" fill="var(--stage-ink)" />
			<T x={bx(boxMean * L)} y={BP + 32} text="average position" size={11} anchor="middle" muted />
		</Readout>
	{/if}

	<!-- key -->
	<Readout id="key" order={1} label="Curves" value="Re ψ (blue), Im ψ (orange), |ψ|² (filled)">
		<g>
			<line x1={PX0} x2={PX0 + 22} y1={48} y2={48} stroke="var(--qm-re)" stroke-width="2" />
			<T x={PX0 + 30} y={52} text="Re ψ" size={13} />
			<line x1={PX0 + 90} x2={PX0 + 112} y1={48} y2={48} stroke="var(--qm-im)" stroke-width="2" />
			<T x={PX0 + 120} y={52} text="Im ψ" size={13} />
			<rect
				x={PX0 + 180}
				y={41}
				width="22"
				height="14"
				rx="2"
				fill="var(--qm-prob-fill)"
				stroke="var(--qm-prob)"
			/>
			<T x={PX0 + 210} y={52} text="|ψ|²: where it is likely to be found" size={13} />
		</g>
	</Readout>

	<!-- panel -->
	{#if !isBox}
		<Readout
			id="lambda"
			order={2}
			label="de Broglie wavelength"
			value="λ = {f2(deBroglie(E))} nm"
			note="speed {Math.round(v * 1000)} km/s"
		>
			<T x={PL} y={110} text="wavelength λ = h/p" size={13} muted />
			<T x={PL} y={134} text="{f2(deBroglie(E))} nm" size={20} weight={600} />
			<T x={PL} y={156} text="speed {Math.round(v * 1000)} km/s" size={12} muted />
		</Readout>
		<Readout
			id="width"
			order={3}
			label="Spread σ"
			value="{f2(m.spread)} nm"
			note="{f2(sigma0)} nm at the start"
		>
			<T x={PL} y={200} text="spread σ" size={13} muted />
			<T x={PL} y={224} text="{f2(m.spread)} nm" size={20} weight={600} color="var(--qm-prob)" />
			<T x={PL} y={246} text="{f2(sigma0)} nm at the start" size={12} muted />
		</Readout>
		<Readout id="total" order={4} label="Total probability" value={total.toFixed(4)}>
			<T x={PL} y={290} text="total probability ∫|ψ|²dx" size={13} muted />
			<T x={PL} y={314} text={total.toFixed(4)} size={20} weight={600} />
		</Readout>
		<Readout id="time">
			<T x={PL} y={358} text="time since the start" size={13} muted />
			<T x={PL} y={382} text="{Math.round(simT)} fs" size={20} weight={600} />
			<T x={PL} y={404} text="(1 fs = 10⁻¹⁵ s)" size={12} muted />
		</Readout>
	{:else}
		<g opacity={focus.current}>
			<T x={LAD_X} y={LAD_BASE - LAD_H - 40} text="energy levels" size={13} muted />
			<line
				x1={LAD_X}
				x2={LAD_X}
				y1={LAD_BASE - LAD_H - 20}
				y2={LAD_BASE}
				stroke="var(--stage-line)"
			/>
			{#each ladder as l (l.n)}
				<line
					x1={LAD_X}
					x2={LAD_X + LAD_W}
					y1={l.y}
					y2={l.y}
					stroke={l.on ? 'var(--qm-prob)' : 'var(--stage-line)'}
					stroke-width={l.on ? 3 : 1.5}
				/>
				<Readout
					id="level-{l.n}"
					order={1 + l.n}
					label="E{['₁', '₂', '₃'][l.n - 1]}"
					value="{f2(l.e)} eV"
				>
					<T
						x={LAD_X + LAD_W + 6}
						y={l.y + 4}
						text="n = {l.n}"
						size={12}
						weight={l.on ? 700 : 500}
					/>
					<T x={LAD_X + 4} y={l.y - 6} text="{f2(l.e)} eV" size={11} muted={!l.on} />
				</Readout>
			{/each}
		</g>
		<!-- the dial: ψ at one point, as a complex number -->
		{@const DC = { x: 790, y: 500 }}
		<circle cx={DC.x} cy={DC.y} r="44" fill="none" stroke="var(--stage-grid)" />
		<line x1={DC.x - 50} x2={DC.x + 50} y1={DC.y} y2={DC.y} stroke="var(--stage-grid)" />
		<line x1={DC.x} x2={DC.x} y1={DC.y - 50} y2={DC.y + 50} stroke="var(--stage-grid)" />
		<line
			x1={DC.x}
			y1={DC.y}
			x2={DC.x + dial.re * 44}
			y2={DC.y - dial.im * 44}
			stroke="var(--qm-prob)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={DC.x + dial.re * 44} cy={DC.y - dial.im * 44} r="4" fill="var(--qm-prob)" />
		<Readout id="dial">
			<T x={DC.x - 60} y={DC.y - 60} text="ψ at the dotted line" size={12} muted />
			<T
				x={DC.x + 56}
				y={DC.y + 4}
				text={dialNote.split(' ').slice(0, 3).join(' ')}
				size={11}
				muted
			/>
			<T
				x={DC.x + 56}
				y={DC.y + 19}
				text={dialNote.split(' ').slice(3).join(' ')}
				size={11}
				muted
			/>
		</Readout>
		<Readout id="slow" order={7} label="Slowed down" value="{slowdown} times">
			<T
				x={BX0 - 30}
				y={570}
				text="slowed down {slowdown} times: n = 1 really turns every {f2(period1)} fs"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
