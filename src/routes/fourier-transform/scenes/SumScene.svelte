<script lang="ts">
	/**
	 * Adding sine waves (steps `sines`, `square`, `gibbs`).
	 *
	 * Phases (`step.hints.phase`), cross-faded:
	 *   sines  — three sine waves (1 Hz × 1, 3 Hz × ⅓, 5 Hz × ⅕) in rows above
	 *            their sum, all at the same vertical scale; a line sweeps across
	 *            the second and the heights at that moment stack up, head to
	 *            tail, to the height of the sum. `params.parts` adds 1–3 of them.
	 *   square — the square wave (dashed) and its rebuilt sum from 1 to
	 *            `params.terms` Hz, the newest ingredient drawn thin, and the
	 *            average (root-mean-square) gap between them; a line sweeps
	 *            across with the momentary sum, square and local gap.
	 *   gibbs  — the same, with the top of the jump magnified in an inset and
	 *            the overshoot measured: about 9% of the jump at any number of terms.
	 *
	 * The square wave's ingredients come from the model: the transform of its
	 * samples (`waveSpectrum`), not from a typed-in formula.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { num, partialSamples, rmsError, shapeSamples, waveSpectrum } from '../fourier';
	import { oneOver, wavePath } from '../signals';

	let { step, t, params, reduced }: StageProps = $props();

	const TAU = 2 * Math.PI;
	// A finely sampled square wave, for the average gap between it and the sum.
	const SQ_N = 2048;
	const SQ = shapeSamples('square', SQ_N);
	const SQ_SPEC = waveSpectrum(SQ);
	// The ingredients themselves: the exact series, 4/(πn) for odd n, all in phase
	// (the sampled transform is a little low at high n, which would make the
	// overshoot readout dip below its limit, 8.95%).
	const amp = (n: number) => (n % 2 ? 4 / (Math.PI * n) : 0);
	const term = (n: number, u: number) => amp(n) * Math.sin(TAU * n * u);
	/** The sum of 1 … T Hz; a fractional T adds that part of the next frequency (while the slider tweens). */
	function sumAt(u: number, T: number) {
		const whole = Math.floor(T);
		let v = 0;
		for (let n = 1; n <= whole; n++) v += term(n, u);
		const frac = T - whole;
		if (frac > 1e-6) v += frac * term(whole + 1, u);
		return v;
	}

	const phase = $derived(String(step.hints?.phase ?? 'sines'));

	// ---- cross-fades -----------------------------------------------------------
	const initial = untrack(() => phase);
	const wSines = new Tween(initial === 'sines' ? 1 : 0, { duration: 700, easing: cubicInOut });
	const wGibbs = new Tween(initial === 'gibbs' ? 1 : 0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		untrack(() => {
			const d = reduced ? 0 : 700;
			wSines.set(p === 'sines' ? 1 : 0, { duration: d });
			wGibbs.set(p === 'gibbs' ? 1 : 0, { duration: d });
		});
	});
	const wSquare = $derived(1 - wSines.current);

	// ---- sines: three waves and their sum ----------------------------------------------
	const SX0 = 190;
	const SX1 = 910;
	const SU = 60; // px per unit, the same in every row
	const ROWS = [
		{ n: 1, a: 1, y: 112, color: 'var(--ft-p1)', label: '1 Hz × 1' },
		{ n: 3, a: 1 / 3, y: 226, color: 'var(--ft-p2)', label: '3 Hz × ⅓' },
		{ n: 5, a: 1 / 5, y: 292, color: 'var(--ft-p3)', label: '5 Hz × ⅕' }
	];
	const SUM_Y = 432;
	const partsN = $derived(Math.max(1, Math.min(3, Math.round(Number(params.parts ?? 3)))));
	const partsT = Tween.of(() => partsN, { duration: 600, easing: cubicInOut });
	const partsShown = $derived(reduced ? partsN : partsT.current);
	/** How much of row i (0-based) is in the sum: 0…1, smooth while the slider tweens. */
	const inSum = (i: number) => Math.max(0, Math.min(1, partsShown - i));
	const rowPaths = ROWS.map((r) =>
		wavePath((u) => r.a * Math.sin(TAU * r.n * u), SX0, SX1, r.y, SU)
	);
	const sinesSum = (u: number) =>
		ROWS.reduce((s, r, i) => s + inSum(i) * r.a * Math.sin(TAU * r.n * u), 0);
	const sinesSumPath = $derived(
		wSines.current > 0.01 ? wavePath(sinesSum, SX0, SX1, SUM_Y, SU, 300) : ''
	);
	// A square wave of the same size for comparison: this sum is π/4 times the square wave.
	const SQH = Math.PI / 4;
	const sweep = $derived(cycle(reduced ? 2.5 : t, 8));
	const sweepX = $derived(SX0 + (SX1 - SX0) * sweep);
	const rowVals = $derived(ROWS.map((r) => r.a * Math.sin(TAU * r.n * sweep)));
	const stack = $derived.by(() => {
		let base = 0;
		return ROWS.map((r, i) => {
			const v = inSum(i) * rowVals[i];
			const seg = { from: base, to: base + v, color: r.color, x: sweepX - 12 + 8 * i, w: inSum(i) };
			base += v;
			return seg;
		});
	});
	const sweepSum = $derived(stack[2].to);
	const sweepText = $derived(
		`at ${num(sweep)} s: ` +
			ROWS.slice(0, partsN)
				.map(
					(_, i) =>
						(i && rowVals[i] >= 0 ? '+ ' : i ? '− ' : '') +
						num(i ? Math.abs(rowVals[i]) : rowVals[i])
				)
				.join(' ') +
			(partsN > 1 ? ` = ${num(sweepSum)}` : '')
	);

	// ---- square and gibbs ------------------------------------------------------------
	const X0 = 110;
	const X1 = 910;
	const CY = 252;
	const U = 120;
	const termsN = $derived(Math.max(1, Math.min(50, Math.round(Number(params.terms ?? 5)))));
	const termsT = Tween.of(() => termsN, { duration: 500, easing: cubicInOut });
	const T = $derived(reduced ? termsN : termsT.current);
	const sumPath = $derived(wSquare > 0.01 ? wavePath((u) => sumAt(u, T), X0, X1, CY, U, 800) : '');
	const xOf = (u: number) => X0 + (X1 - X0) * u;
	const yOf = (v: number) => CY - U * v;
	const squarePath = `M${xOf(0)} ${yOf(0)} L${xOf(0)} ${yOf(1)} L${xOf(0.5)} ${yOf(1)} L${xOf(0.5)} ${yOf(-1)} L${xOf(1)} ${yOf(-1)} L${xOf(1)} ${yOf(0)}`;
	/** The newest odd frequency in the sum (the even ones are zero). */
	const newest = $derived(termsN % 2 ? termsN : termsN - 1);
	const newestPath = $derived(
		wSquare > 0.01 && newest > 1 ? wavePath((u) => term(newest, u), X0, X1, CY, U, 800) : ''
	);
	const oddCount = $derived(Math.ceil(termsN / 2));
	const gap = $derived(rmsError(partialSamples(SQ_SPEC, termsN, SQ_N), SQ));

	// A line sweeps across, as on the sines step, with the sum's and the square's
	// values at that moment and their gap: the frame stays alive. The local gap
	// (largest at the corners) is read above the graph, top right; the average
	// gap is below it.
	const sqSweep = $derived(cycle(reduced ? 2.5 : t, 8));
	const sqTarget = $derived(sqSweep < 0.5 ? 1 : -1);
	const sqSweepV = $derived(wSquare > 0.01 ? sumAt(sqSweep, T) : 0);

	// The overshoot before the jump at 0.5 s: the highest point of the sum
	// between 0.25 s and the jump, on a fine grid (by symmetry the peak after
	// the jump at 0 s is the same height).
	const over = $derived.by(() => {
		let best = -Infinity;
		let at = 0;
		const n = 2000;
		for (let i = 1; i < n; i++) {
			const u = 0.25 + (0.25 * i) / n;
			const v = sumAt(u, termsN);
			if (v > best) {
				best = v;
				at = u;
			}
		}
		return { peak: best, at };
	});

	// The inset: the top of the jump at u = 0.5, magnified.
	const IN = { x0: 540, x1: 910, y0: 458, y1: 586, u0: 0.36, u1: 0.5, v0: 0.82, v1: 1.32 };
	const ix = (u: number) => IN.x0 + ((IN.x1 - IN.x0) * (u - IN.u0)) / (IN.u1 - IN.u0);
	const iy = (v: number) => IN.y1 - ((IN.y1 - IN.y0) * (v - IN.v0)) / (IN.v1 - IN.v0);
	const insetPath = $derived.by(() => {
		if (wGibbs.current < 0.01) return '';
		let d = '';
		const n = 400;
		for (let i = 0; i <= n; i++) {
			const u = IN.u0 + ((IN.u1 - IN.u0) * i) / n;
			const v = Math.max(IN.v0 - 0.05, sumAt(u, T));
			d += `${i ? 'L' : 'M'}${ix(u).toFixed(1)} ${iy(v).toFixed(1)}`;
		}
		return d;
	});
	const peakX = $derived(ix(over.at));
	/** Whether the highest point is next to the jump (with 1 or 2 Hz only, the highest point is the hump at 0.25 s). */
	const nearJump = $derived(over.at > IN.u0);
	const ticks = [0, 0.25, 0.5, 0.75, 1];

	// Phone readouts (the same text as the drawing's).
	const sqSweepText = $derived(
		`at ${num(sqSweep, 2)} s: sum ${num(sqSweepV)} · square ${sqTarget > 0 ? '+1' : '−1'} · gap ${num(
			Math.abs(sqSweepV - sqTarget)
		)}`
	);
	const newestRow = $derived(
		termsN % 2 === 0
			? {
					label: `${termsN} Hz`,
					value: 'added nothing: the square wave contains none of it',
					color: 'var(--ft-p2)'
				}
			: termsN > 1
				? {
						label: 'Newest (thin line)',
						value: `${termsN} Hz with amplitude ${oneOver(termsN)} × 4/π = ${num(amp(termsN), 3)}`,
						color: 'var(--ft-p2)'
					}
				: {
						label: 'One sine wave',
						value: '1 Hz with amplitude 4/π ≈ 1.27',
						color: 'var(--ft-sum)'
					}
	);
	const overRow = $derived(
		nearJump
			? {
					value: `${num(over.peak - 1, 3)} above +1 = ${num((100 * (over.peak - 1)) / 2, 1)}% of the jump`,
					note: `the peak is ${num(1000 * (0.5 - over.at), 0)} ms before the jump; more frequencies: closer, but hardly lower`
				}
			: {
					value: 'too few frequencies for a peak at the jump yet',
					note: 'add some with the slider'
				}
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="sum-inset-clip">
			<rect x={IN.x0} y={IN.y0} width={IN.x1 - IN.x0} height={IN.y1 - IN.y0} />
		</clipPath>
	</defs>

	<!-- ================= sines: three waves and their sum ================= -->
	{#if wSines.current > 0.01}
		<g opacity={wSines.current}>
			<!-- <Readout>: on narrow screens these are listed as HTML under the stage -->
			<Readout id="sines-title">
				{@render txt(24, 40, 'Add the heights at every moment', 18, { weight: 600 })}
			</Readout>
			{#each ROWS as r, i (r.n)}
				{@const on = 0.3 + 0.7 * inSum(i)}
				<line x1={SX0} x2={SX1} y1={r.y} y2={r.y} stroke="var(--stage-line)" />
				<path
					d={rowPaths[i]}
					fill="none"
					stroke={r.color}
					stroke-width="2.5"
					opacity={on}
					stroke-linejoin="round"
				/>
				<Readout id="part-{r.n}" order={10 + i} label={r.label} color={r.color} opacity={on}>
					{@render txt(24, r.y + 5, r.label, 15, { weight: 600, color: r.color, opacity: on })}
				</Readout>
				{#if i > 0}
					{@render txt(162, r.y + 6, '+', 20, { anchor: 'middle', muted: true, opacity: on })}
				{/if}
				<circle
					cx={sweepX}
					cy={r.y - SU * rowVals[i]}
					r="5"
					fill={r.color}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
					opacity={on}
				/>
			{/each}

			<!-- the sum, with a square wave of the same size for comparison -->
			<line x1={SX0} x2={SX1} y1={SUM_Y} y2={SUM_Y} stroke="var(--stage-line)" />
			<path
				d="M{SX0} {SUM_Y - SU * SQH} H{(SX0 + SX1) / 2} V{SUM_Y + SU * SQH} H{SX1}"
				fill="none"
				stroke="var(--ft-target)"
				stroke-dasharray="5 5"
				opacity="0.55"
			/>
			<path
				d={sinesSumPath}
				fill="none"
				stroke="var(--ft-sum)"
				stroke-width="3.5"
				stroke-linejoin="round"
			/>
			<Readout id="sines-sum" order={13} label="sum" color="var(--ft-sum)">
				{@render txt(24, SUM_Y + 5, 'sum', 15, { weight: 700, color: 'var(--ft-sum)' })}
			</Readout>
			{@render txt(162, SUM_Y + 6, '=', 20, { anchor: 'middle', muted: true })}

			<!-- the sweep: the heights at this moment, head to tail -->
			<line
				x1={sweepX}
				x2={sweepX}
				y1={ROWS[0].y - SU - 8}
				y2={SUM_Y + SU + 8}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
			{#each stack as s, i (i)}
				{#if s.w > 0.01 && Math.abs(s.to - s.from) > 0.004}
					<line
						x1={s.x}
						x2={s.x}
						y1={SUM_Y - SU * s.from}
						y2={SUM_Y - SU * s.to}
						stroke={s.color}
						stroke-width="4"
						stroke-linecap="round"
						opacity={s.w}
					/>
				{/if}
			{/each}
			<circle
				cx={sweepX}
				cy={SUM_Y - SU * sweepSum}
				r="6.5"
				fill="var(--ft-sum)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<line
				x1={SX0}
				x2={SX1}
				y1={SUM_Y + SU + 18}
				y2={SUM_Y + SU + 18}
				stroke="var(--stage-line)"
			/>
			{#each ticks as u (u)}
				<line
					x1={SX0 + (SX1 - SX0) * u}
					x2={SX0 + (SX1 - SX0) * u}
					y1={SUM_Y + SU + 18}
					y2={SUM_Y + SU + 24}
					stroke="var(--stage-line)"
				/>
				{@render txt(SX0 + (SX1 - SX0) * u, SUM_Y + SU + 40, `${u} s`, 12, {
					anchor: 'middle',
					muted: true
				})}
			{/each}
			<Readout
				id="sines-sweep"
				order={1}
				label="Heights at the line"
				value={sweepText}
				color="var(--ft-sum)"
				opacity={wSines.current}
			>
				{@render txt(SX0, SUM_Y + SU + 66, sweepText, 14, { weight: 600, color: 'var(--ft-sum)' })}
			</Readout>
			<Readout
				id="sines-dashed"
				order={14}
				label="dashed: a square wave of the same size"
				color="var(--ft-target)"
			>
				{@render txt(SX1, 40, 'dashed: a square wave of the same size', 12, {
					anchor: 'end',
					muted: true
				})}
			</Readout>
		</g>
	{/if}

	<!-- ================= square and gibbs ================= -->
	{#if wSquare > 0.01}
		<g opacity={wSquare}>
			<!-- frame -->
			{#each [-1, 1] as v (v)}
				<line x1={X0} x2={X1} y1={yOf(v)} y2={yOf(v)} stroke="var(--stage-grid)" />
				{@render txt(X0 - 12, yOf(v) + 4, v > 0 ? '+1' : '−1', 12, { anchor: 'end', muted: true })}
			{/each}
			{@render txt(X0 - 12, CY + 4, '0', 12, { anchor: 'end', muted: true })}
			<line x1={X0} x2={X1} y1={CY} y2={CY} stroke="var(--stage-line)" />
			<line x1={X0} x2={X0} y1={yOf(1.3)} y2={yOf(-1.3)} stroke="var(--stage-line)" />
			{#each ticks as u (u)}
				<line
					x1={xOf(u)}
					x2={xOf(u)}
					y1={yOf(-1.3)}
					y2={yOf(-1.3) + 6}
					stroke="var(--stage-line)"
				/>
				{@render txt(xOf(u), yOf(-1.3) + 22, `${u} s`, 12, { anchor: 'middle', muted: true })}
			{/each}

			<!-- the square wave, the newest ingredient and the sum -->
			<path
				d={squarePath}
				fill="none"
				stroke="var(--ft-target)"
				stroke-width="2"
				stroke-dasharray="6 5"
				opacity="0.8"
			/>
			{#if newestPath}
				<path d={newestPath} fill="none" stroke="var(--ft-p2)" stroke-width="1.5" opacity="0.75" />
			{/if}
			<path
				d={sumPath}
				fill="none"
				stroke="var(--ft-sum)"
				stroke-width="3"
				stroke-linejoin="round"
			/>

			<!-- the sweep: the sum and the square at this moment of the second -->
			<line
				x1={xOf(sqSweep)}
				x2={xOf(sqSweep)}
				y1={yOf(1.3)}
				y2={yOf(-1.3)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
			<circle
				cx={xOf(sqSweep)}
				cy={yOf(sqTarget)}
				r="4.5"
				fill="var(--ft-target)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<circle
				cx={xOf(sqSweep)}
				cy={yOf(sqSweepV)}
				r="6"
				fill="var(--ft-sum)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Readout id="sq-sweep" order={2} label="At the line" value={sqSweepText} opacity={wSquare}>
				{@render txt(
					X1,
					88,
					`at ${num(sqSweep, 2)} s: sum ${num(sqSweepV)} · square ${sqTarget > 0 ? '+1' : '−1'} · gap ${num(
						Math.abs(sqSweepV - sqTarget)
					)}`,
					13,
					{ anchor: 'end', weight: 600 }
				)}
			</Readout>

			<!-- readouts -->
			<Readout
				id="sq-sum"
				order={1}
				label="The sum so far"
				value={termsN === 1 ? '1 Hz only' : `1 Hz to ${termsN} Hz`}
				note={phase === 'gibbs'
					? undefined
					: oddCount > 1
						? `${oddCount} sine waves that count (odd frequencies); every even one is zero`
						: '1 sine wave that counts (odd frequencies); every even one is zero'}
				color="var(--ft-sum)"
				opacity={wSquare}
			>
				{@render txt(
					X0,
					40,
					termsN === 1 ? 'The sum so far: 1 Hz only' : `The sum so far: 1 Hz to ${termsN} Hz`,
					20,
					{ weight: 600, color: 'var(--ft-sum)' }
				)}
				{@render txt(
					X0,
					64,
					oddCount > 1
						? `${oddCount} sine waves that count (odd frequencies); every even one is zero`
						: '1 sine wave that counts (odd frequencies); every even one is zero',
					13,
					{ muted: true }
				)}
			</Readout>
			<Readout id="sq-key" order={10} label="square wave (dashed)" color="var(--ft-target)">
				{@render txt(X1, 40, 'square wave', 14, {
					anchor: 'end',
					weight: 600,
					color: 'var(--ft-target)'
				})}
			</Readout>

			<g opacity={1 - wGibbs.current}>
				<Readout
					id="sq-newest"
					order={3}
					label={newestRow.label}
					value={newestRow.value}
					color={newestRow.color}
					opacity={wSquare * (1 - wGibbs.current)}
				>
					{#if termsN % 2 === 0}
						{@render txt(
							X0,
							470,
							`${termsN} Hz added nothing: the square wave contains none of it.`,
							15,
							{ weight: 600, color: 'var(--ft-p2)' }
						)}
					{:else if termsN > 1}
						{@render txt(
							X0,
							470,
							`newest: ${termsN} Hz with amplitude ${oneOver(termsN)} × 4/π = ${num(amp(termsN), 3)} (thin line)`,
							15,
							{ weight: 600, color: 'var(--ft-p2)' }
						)}
					{:else}
						{@render txt(X0, 470, 'one sine wave: 1 Hz with amplitude 4/π ≈ 1.27', 15, {
							weight: 600,
							color: 'var(--ft-sum)'
						})}
					{/if}
				</Readout>
				<Readout
					id="sq-gap"
					order={4}
					label="Average gap from the square wave"
					value={num(gap, 3)}
					note="root-mean-square difference over the second"
					opacity={wSquare * (1 - wGibbs.current)}
				>
					{@render txt(X0, 500, `average gap from the square wave: ${num(gap, 3)}`, 15, {
						weight: 600
					})}
				</Readout>
				<rect
					x={X0}
					y="514"
					width={Math.min(560, 560 * (gap / 0.44))}
					height="12"
					rx="3"
					fill="var(--ft-sum)"
					opacity="0.6"
				/>
				<rect
					x={X0}
					y="514"
					width="560"
					height="12"
					rx="3"
					fill="none"
					stroke="var(--stage-line)"
				/>
				<Readout id="sq-gap-note">
					{@render txt(X0, 548, '(root-mean-square difference over the second)', 12, {
						muted: true
					})}
				</Readout>
			</g>

			<!-- gibbs: the top of the jump, magnified -->
			{#if wGibbs.current > 0.01}
				<g opacity={wGibbs.current}>
					<rect
						x={xOf(IN.u0)}
						y={yOf(IN.v1)}
						width={xOf(IN.u1) - xOf(IN.u0)}
						height={yOf(IN.v0) - yOf(IN.v1)}
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="1.2"
						rx="3"
					/>
					<path
						d="M{xOf(IN.u0)} {yOf(IN.v0)} L{IN.x0} {IN.y0} M{xOf(IN.u1)} {yOf(
							IN.v0
						)} L{IN.x1} {IN.y0}"
						stroke="var(--stage-ink-muted)"
						stroke-dasharray="3 4"
					/>
					<rect
						x={IN.x0}
						y={IN.y0}
						width={IN.x1 - IN.x0}
						height={IN.y1 - IN.y0}
						fill="var(--surface)"
						stroke="var(--border)"
						rx="4"
					/>
					<g clip-path="url(#sum-inset-clip)">
						<line
							x1={IN.x0}
							x2={ix(0.5)}
							y1={iy(1)}
							y2={iy(1)}
							stroke="var(--ft-target)"
							stroke-width="2"
							stroke-dasharray="6 5"
						/>
						{#if nearJump}
							<line
								x1={IN.x0}
								x2={IN.x1}
								y1={iy(over.peak)}
								y2={iy(over.peak)}
								stroke="var(--ft-bar)"
								stroke-dasharray="2 3"
							/>
						{/if}
						<path d={insetPath} fill="none" stroke="var(--ft-sum)" stroke-width="3" />
					</g>
					{#if nearJump}
						<line
							x1={peakX}
							x2={peakX}
							y1={iy(1)}
							y2={iy(over.peak)}
							stroke="var(--ft-bar)"
							stroke-width="3"
							stroke-linecap="round"
						/>
						<Readout id="peak-label">
							{@render txt(peakX - 10, iy(over.peak) - 8, `peak ${num(over.peak, 3)}`, 13, {
								anchor: 'end',
								weight: 600,
								color: 'var(--ft-bar)'
							})}
						</Readout>
					{/if}
					<Readout id="inset-key" order={11} label="box: the top of the jump at 0.5 s, magnified">
						{@render txt(IN.x0, IN.y0 - 8, 'magnified: the top of the jump at 0.5 s', 12, {
							muted: true
						})}
					</Readout>
					<Readout
						id="jump"
						order={3}
						label="The jump"
						value="from +1 down to −1, a drop of 2"
						opacity={wGibbs.current}
					>
						{@render txt(X0, 470, 'The jump: from +1 down to −1, a drop of 2', 15, {
							weight: 600
						})}
					</Readout>
					<Readout
						id="overshoot"
						order={4}
						label="Overshoot"
						value={overRow.value}
						note={overRow.note}
						color="var(--ft-bar)"
						opacity={wGibbs.current}
					>
						{#if nearJump}
							{@render txt(
								X0,
								498,
								`Overshoot: ${num(over.peak - 1, 3)} above +1 = ${num((100 * (over.peak - 1)) / 2, 1)}% of the jump`,
								15,
								{ weight: 600, color: 'var(--ft-bar)' }
							)}
							{@render txt(
								X0,
								526,
								`The peak is ${num(1000 * (0.5 - over.at), 0)} ms before the jump`,
								15,
								{ weight: 600 }
							)}
						{:else}
							{@render txt(X0, 498, 'Too few frequencies for a peak at the jump yet:', 15, {
								weight: 600,
								color: 'var(--ft-bar)'
							})}
							{@render txt(X0, 526, 'add some with the slider', 15, { weight: 600 })}
						{/if}
					</Readout>
					<Readout id="gibbs-note">
						{@render txt(X0, 552, 'more frequencies: closer to the jump, but hardly lower', 12, {
							muted: true
						})}
					</Readout>
				</g>
			{/if}
		</g>
	{/if}
</g>
