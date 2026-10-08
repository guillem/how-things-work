<script lang="ts">
	/**
	 * Counting microstates.
	 *
	 * Phases (`step.hints.phase`):
	 *   positions — N particles start in the left half of a small box (a wall
	 *               lifts at 1 s) and spread. Beside it, the number of
	 *               microstates C(N, k) of every macrostate "k particles in the
	 *               left half", with the current k highlighted, and a trace of k
	 *               over time.
	 *   energy    — Q = 50 packets per particle shared between a left group of
	 *               nL and a right group of nR particles. The chart shows the
	 *               number of ways C(qL + nL − 1, qL) · C(qR + nR − 1, qR) for
	 *               every share of the energy (linear, relative to the peak);
	 *               the reader drags the share (a Handle, synced with the slider).
	 *
	 * The positions phase runs `GasRun` (see ../gas.ts); its clock restarts when N
	 * or the restart count change (plain variables inside a `$derived`, as in
	 * the box scene). The energy phase is static apart from the particles'
	 * jiggle, whose size follows each group's energy per particle.
	 * Reduced motion: the gas 12 s after release; no jiggle.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { Handle, clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		FPS,
		GasRun,
		H,
		PACKETS_PER_PARTICLE,
		R,
		W,
		WALL,
		choose,
		formatCount,
		lnChoose,
		lnEnergyWays,
		shareCurve,
		sup,
		toLog10
	} from '../gas';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'positions'));

	/** Colour on the cold → hot scale for a temperature (0.5 … 8). */
	function heat(T: number) {
		const f = clamp(Math.log(T / 0.5) / Math.log(16));
		const p = Math.round(f * 20) * 5;
		return `color-mix(in oklab, var(--ent-hot) ${p}%, var(--ent-cold))`;
	}
	const fmt = (n: number) => n.toLocaleString('en-US');
	const each = (v: number) => (v >= 100 ? fmt(Math.round(v)) : v.toFixed(1));

	// ================================================================ positions
	const N = $derived(clamp(Math.round(Number(params.particles ?? 40)), 2, 100));
	const restarts = $derived(Number(params.restart ?? 0));
	const WALL_LIFT = 1;

	const runKey = $derived(`${N}|${restarts}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 12;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});

	const run = $derived(
		phase === 'positions'
			? new GasRun({
					n: N,
					tLeft: 3,
					tRight: 3,
					layout: 'left',
					wallUntil: WALL_LIFT,
					reversals: [],
					nudge: 0,
					seed: 1 + restarts
				})
			: null
	);
	const fi = $derived(GasRun.index(elapsed));
	const frame = $derived(run ? run.frame(fi) : null);
	const k = $derived(frame ? frame.stats.nLeft : 0);

	// small box
	const BX = 40;
	const BY = 70;
	const SC = 180;
	const BW = W * SC;
	const BH = H * SC;
	const bx = (x: number) => BX + x * SC;
	const by = (y: number) => BY + BH - y * SC;
	const wallLift = $derived(smoothstep(WALL_LIFT - 0.4, WALL_LIFT, elapsed));
	const dots = $derived(
		frame
			? Array.from({ length: N }, (_, i) => ({
					i,
					x: bx(frame.x[i]),
					y: by(frame.y[i]),
					left: frame.x[i] < W / 2
				}))
			: []
	);

	// k over time
	const KX0 = 64;
	const KX1 = 400;
	const KY0 = 452;
	const KY1 = 322;
	const SPAN = 20;
	const tFrom = $derived(Math.max(0, elapsed - SPAN));
	const tTo = $derived(Math.max(SPAN, elapsed));
	const kx = (s: number) => KX0 + ((s - tFrom) / (tTo - tFrom)) * (KX1 - KX0);
	const ky = (v: number) => KY0 - (v / N) * (KY0 - KY1);
	const kPath = $derived.by(() => {
		if (!run) return '';
		let d = '';
		const i0 = GasRun.index(tFrom);
		for (let i = i0; i <= fi; i += 2)
			d += `${d ? 'L' : 'M'}${kx(i / FPS).toFixed(1)} ${ky(run.statsAt(i).nLeft).toFixed(1)}`;
		return d + `L${kx(fi / FPS).toFixed(1)} ${ky(k).toFixed(1)}`;
	});

	// bars C(N, j)
	const CX0 = 486;
	const CX1 = 920;
	const CY0 = 372;
	const CY1 = 96;
	const lnPeak = $derived(lnChoose(N, Math.floor(N / 2)));
	const barW = $derived((CX1 - CX0) / (N + 1));
	const bars = $derived(
		Array.from({ length: N + 1 }, (_, j) => {
			const h = Math.exp(lnChoose(N, j) - lnPeak) * (CY0 - CY1);
			return { j, x: CX0 + j * barW, h };
		})
	);
	const barTicks = $derived(
		N <= 12
			? Array.from({ length: N + 1 }, (_, j) => j)
			: [...new Set([0, Math.floor(N / 4), Math.floor(N / 2), Math.floor((3 * N) / 4), N])]
	);
	const smallN = $derived(N <= 12);
	const total = $derived(2n ** BigInt(N));

	// ================================================================ energy
	const nL = $derived(clamp(Math.round(Number(params.countLeft ?? 40)), 2, 100));
	const nR = $derived(clamp(Math.round(Number(params.countRight ?? 40)), 2, 100));
	const share = $derived(clamp(Number(params.share ?? 80), 0, 100));
	const Q = $derived(PACKETS_PER_PARTICLE * (nL + nR));
	const qL = $derived(Math.round((share / 100) * Q));
	const qR = $derived(Q - qL);
	const curve = $derived(phase === 'energy' ? shareCurve(nL, nR, Q) : []);
	const peakQ = $derived.by(() => {
		let b = 0;
		for (let q = 1; q < curve.length; q++) if (curve[q] > curve[b]) b = q;
		return b;
	});
	const lnMax = $derived(curve.length ? curve[peakQ] : 0);
	const lnNow = $derived(curve.length ? curve[qL] : 0);
	/** Temperature (on the box's scale) of a group: 2.5 × its energy per particle ÷ the average. */
	const tempOf = (q: number, n: number) => (2.5 * (q / n)) / PACKETS_PER_PARTICLE;
	const startShare = $derived((100 * 4 * nL) / (4 * nL + nR));

	const EX0 = 486;
	const EX1 = 900;
	const EY0 = 372;
	const EY1 = 110;
	const ex = (pct: number) => EX0 + (pct / 100) * (EX1 - EX0);
	const ey = (rel: number) => EY0 - rel * (EY0 - EY1);
	const ePath = $derived.by(() => {
		if (!curve.length) return '';
		let d = '';
		const steps = 240;
		for (let s = 0; s <= steps; s++) {
			const q = Math.round((s / steps) * Q);
			d += `${s ? 'L' : 'M'}${ex((100 * q) / Q).toFixed(1)} ${ey(Math.exp(curve[q] - lnMax)).toFixed(1)}`;
		}
		// fill the narrow peak exactly
		return d;
	});
	const eArea = $derived(ePath ? `${ePath}L${EX1} ${EY0}L${EX0} ${EY0}Z` : '');

	// two groups of particles, jiggling by their energy per particle
	function groupDots(n: number, x0: number, w: number, temp: number, salt: number) {
		const cols = Math.ceil(Math.sqrt((n * w) / 150));
		const rows = Math.ceil(n / cols);
		const cw = w / cols;
		const ch = 150 / rows;
		const amp = reduced ? 0 : Math.min(cw, ch) * 0.28 * Math.sqrt(clamp(temp / 8, 0, 1));
		return Array.from({ length: n }, (_, i) => {
			const c = i % cols;
			const r = Math.floor(i / cols);
			const ph = i * 2.39 + salt;
			const f = 2.2 + ((i * 7) % 5) * 0.35;
			return {
				i,
				x: x0 + (c + 0.5) * cw + amp * Math.sin(f * t + ph),
				y: 98 + (r + 0.5) * ch + amp * Math.cos(f * 1.3 * t + ph * 1.7)
			};
		});
	}
	const tL = $derived(tempOf(qL, nL));
	const tR = $derived(tempOf(qR, nR));
	const leftDots = $derived(phase === 'energy' ? groupDots(nL, 52, 176, tL, 0) : []);
	const rightDots = $derived(phase === 'energy' ? groupDots(nR, 252, 176, tR, 9) : []);
	const dotR = $derived(Math.max(2.5, Math.min(6, 60 / Math.sqrt(Math.max(nL, nR)))));

	const lnWaysText = (ln: number) => formatCount({ log10: toLog10(ln) });
	const peakRatio = $derived(toLog10(lnMax - lnNow));
	const startLabelX = $derived(ex(startShare));
	/** Which side of its line the start label sits on (away from the right edge). */
	const startSide = $derived(startShare > 85 ? -1 : 1);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

<g>
	{#if phase === 'positions'}
		<!-- the small box -->
		{@render txt(bx(W / 4), BY - 12, `left half: ${k}`, 13, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--ent-ways)'
		})}
		{@render txt(bx((3 * W) / 4), BY - 12, `right half: ${N - k}`, 13, {
			anchor: 'middle',
			weight: 600
		})}
		<rect
			x={BX - 3}
			y={BY - 3}
			width={BW + 6}
			height={BH + 6}
			rx="6"
			fill="var(--ent-box)"
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<rect x={BX} y={BY} width={BW / 2} height={BH} fill="var(--ent-ways)" opacity="0.07" />
		<line
			x1={bx(W / 2)}
			x2={bx(W / 2)}
			y1={BY}
			y2={BY + BH}
			stroke="var(--stage-grid)"
			stroke-width="1"
			stroke-dasharray="4 5"
		/>
		{#if wallLift < 1}
			<rect
				x={bx(W / 2 - WALL)}
				y={BY}
				width={2 * WALL * SC}
				height={BH * (1 - wallLift)}
				rx="2"
				fill="var(--ent-wall)"
				opacity="0.85"
			/>
		{/if}
		{#each dots as d (d.i)}
			<circle
				cx={d.x}
				cy={d.y}
				r={R * SC}
				fill={d.left ? 'var(--ent-ways)' : 'var(--stage-ink-muted)'}
				stroke="var(--stage-bg)"
				stroke-width="0.6"
			/>
		{/each}

		<!-- k over time -->
		{@render txt(KX0 - 24, KY1 - 16, 'particles in the left half, over time', 12, { muted: true })}
		<line x1={KX0} x2={KX1} y1={KY0} y2={KY0} stroke="var(--stage-line)" stroke-width="1.2" />
		<line x1={KX0} x2={KX0} y1={KY1} y2={KY0} stroke="var(--stage-line)" stroke-width="1.2" />
		{#each [N, N / 2] as v (v)}
			<line
				x1={KX0}
				x2={KX1}
				y1={ky(v)}
				y2={ky(v)}
				stroke="var(--stage-grid)"
				stroke-width="1"
				stroke-dasharray={v === N / 2 ? '5 4' : undefined}
			/>
			{@render txt(KX0 - 8, ky(v) + 4, Number.isInteger(v) ? String(v) : v.toFixed(1), 11, {
				anchor: 'end',
				muted: true
			})}
		{/each}
		{@render txt(KX0 - 8, KY0 + 4, '0', 11, { anchor: 'end', muted: true })}
		{@render txt(KX1, ky(N) - 6, 'all on the left', 11, { anchor: 'end', muted: true })}
		{@render txt(KX1, ky(N / 2) - 6, 'half', 11, { anchor: 'end', muted: true })}
		<path d={kPath} fill="none" stroke="var(--ent-ways)" stroke-width="2" stroke-linejoin="round" />
		{@render txt(KX1, KY0 + 18, `${Math.floor(tTo)} s`, 11, { anchor: 'end', muted: true })}
		{@render txt(KX0, KY0 + 18, `${Math.floor(tFrom)} s`, 11, { muted: true })}

		<!-- bars: microstates per macrostate -->
		{@render txt(CX0, 60, `microstates for each macrostate, C(${N}, k)`, 13, { muted: true })}
		{#each bars as b (b.j)}
			<rect
				x={b.x + Math.min(1, barW * 0.1)}
				y={CY0 - b.h}
				width={Math.max(1, barW - Math.min(2, barW * 0.2))}
				height={b.h}
				rx={barW > 8 ? 2 : 0}
				fill={b.j === k ? 'var(--ent-ways)' : 'var(--stage-ink-muted)'}
				opacity={b.j === k ? 1 : 0.35}
			/>
			{#if smallN}
				{@render txt(b.x + barW / 2, CY0 - b.h - 6, fmt(Number(choose(N, b.j))), 11, {
					anchor: 'middle',
					weight: b.j === k ? 700 : 500,
					muted: b.j !== k
				})}
			{/if}
		{/each}
		<line x1={CX0} x2={CX1} y1={CY0} y2={CY0} stroke="var(--stage-line)" stroke-width="1.2" />
		<path d="M{CX0 + (k + 0.5) * barW} {CY0 + 3} l-6 9 h12 Z" fill="var(--ent-ways)" />
		{#each barTicks as j (j)}
			{@render txt(CX0 + (j + 0.5) * barW, CY0 + 26, String(j), 11, {
				anchor: 'middle',
				muted: true
			})}
		{/each}
		{@render txt((CX0 + CX1) / 2, CY0 + 44, 'k = particles in the left half (the macrostate)', 12, {
			anchor: 'middle',
			muted: true
		})}

		<!-- readouts -->
		{@render txt(CX0, 446, `now: ${k} on the left → C(${N}, ${k}) =`, 13)}
		{@render txt(
			CX0,
			474,
			`${formatCount(choose(N, k))} microstate${choose(N, k) === 1n ? '' : 's'}`,
			20,
			{
				weight: 600,
				color: 'var(--ent-ways)',
				tabular: true
			}
		)}
		{@render txt(CX0, 506, `all ${N} on the left: 1 microstate`, 13)}
		{@render txt(CX0, 528, `every arrangement: 2${sup(N)} = ${formatCount(total)}`, 13, {
			muted: true
		})}
		{@render txt(CX0, 550, `chance of all on the left: 1 in ${formatCount(total)}`, 13, {
			muted: true
		})}
	{:else}
		<!-- two groups sharing packets of energy -->
		{@render txt(52, 60, 'left', 13, { weight: 600 })}
		{@render txt(252, 60, 'right', 13, { weight: 600 })}
		{@render txt(52, 78, `${nL} particles · ${fmt(qL)} packets`, 12, { muted: true })}
		{@render txt(252, 78, `${nR} particles · ${fmt(qR)} packets`, 12, { muted: true })}
		{#each [{ id: 'l', x: 44 }, { id: 'r', x: 244 }] as g (g.id)}
			<rect
				x={g.x}
				y={90}
				width="192"
				height="166"
				rx="6"
				fill="var(--ent-box)"
				stroke="var(--stage-line)"
				stroke-width="1.2"
			/>
		{/each}
		{#each leftDots as d (d.i)}
			<circle cx={d.x} cy={d.y} r={dotR} style:fill={heat(tL)} />
		{/each}
		{#each rightDots as d (d.i)}
			<circle cx={d.x} cy={d.y} r={dotR} style:fill={heat(tR)} />
		{/each}
		{@render txt(140, 282, `${each(qL / nL)} packets each`, 13, { anchor: 'middle' })}
		{@render txt(340, 282, `${each(qR / nR)} packets each`, 13, { anchor: 'middle' })}

		{@render txt(52, 330, 'ways to share the packets', 13, { muted: true })}
		{@render txt(52, 356, `left:  ${lnWaysText(lnEnergyWays(qL, nL))}`, 15, { tabular: true })}
		{@render txt(52, 380, `right: ${lnWaysText(lnEnergyWays(qR, nR))}`, 15, { tabular: true })}
		<line x1={52} x2={420} y1={394} y2={394} stroke="var(--stage-line)" stroke-width="1" />
		{@render txt(52, 422, `together (left × right): ${lnWaysText(lnNow)}`, 18, {
			weight: 600,
			color: 'var(--ent-ways)',
			tabular: true
		})}
		{@render txt(
			52,
			452,
			peakRatio < 0.05
				? 'this is the most likely share'
				: `the peak has ${formatCount({ log10: peakRatio })} times as many`,
			13
		)}
		{@render txt(52, 480, `${PACKETS_PER_PARTICLE} packets per particle on average`, 12, {
			muted: true
		})}

		<!-- the curve -->
		{@render txt(EX0, 60, 'ways to share the energy, for every split', 13, { muted: true })}
		{@render txt(EX0, 78, '(relative to the most likely split)', 12, { muted: true })}
		<path d={eArea} fill="var(--ent-ways)" opacity="0.18" />
		<path d={ePath} fill="none" stroke="var(--ent-ways)" stroke-width="2.5" />
		<line x1={EX0} x2={EX1} y1={EY0} y2={EY0} stroke="var(--stage-line)" stroke-width="1.2" />
		{#each [0, 25, 50, 75, 100] as p (p)}
			{@render txt(ex(p), EY0 + 18, `${p}%`, 11, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt((EX0 + EX1) / 2, EY0 + 38, 'share of the energy on the left', 12, {
			anchor: 'middle',
			muted: true
		})}
		<!-- peak marker -->
		{@render txt(
			clamp(ex((100 * peakQ) / Q), EX0 + 60, EX1 - 60),
			EY1 - 10,
			'equal temperatures',
			12,
			{
				anchor: 'middle',
				weight: 600
			}
		)}
		<!-- where the gas started -->
		<line
			x1={startLabelX}
			x2={startLabelX}
			y1={EY0 - 60}
			y2={EY0}
			stroke="var(--ent-hot)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		{@render txt(startLabelX + startSide * 8, EY0 - 82, 'the gas’s start', 11, {
			anchor: startSide > 0 ? 'start' : 'end',
			color: 'var(--ent-hot)'
		})}
		{@render txt(startLabelX + startSide * 8, EY0 - 68, '(hot left, cold right)', 11, {
			anchor: startSide > 0 ? 'start' : 'end',
			color: 'var(--ent-hot)'
		})}
		<!-- current split -->
		<line
			x1={ex(share)}
			x2={ex(share)}
			y1={EY1}
			y2={EY0}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			opacity="0.6"
		/>
		<circle
			cx={ex(share)}
			cy={ey(Math.exp(lnNow - lnMax))}
			r="4"
			fill="var(--ent-ways)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Handle
			x={ex(share)}
			y={EY0}
			label="Share of the energy on the left"
			value={share}
			min={0}
			max={100}
			valuetext="{Math.round(share)} percent"
			onmove={(p) =>
				setParam('share', Math.round(clamp(((p.x - EX0) / (EX1 - EX0)) * 100, 0, 100)))}
			onkey={(s) =>
				setParam(
					'share',
					s === 'start' ? 0 : s === 'end' ? 100 : clamp(Math.round(share + s), 0, 100)
				)}
		/>
		{@render txt(
			ex(share),
			EY0 + 56,
			`${Math.round(share)}% · temperatures ${tL.toFixed(1)} and ${tR.toFixed(1)}`,
			12,
			{
				anchor: ex(share) < 600 ? 'start' : ex(share) > 800 ? 'end' : 'middle'
			}
		)}
	{/if}
</g>
