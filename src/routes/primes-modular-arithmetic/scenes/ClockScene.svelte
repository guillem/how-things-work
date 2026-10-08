<script lang="ts">
	/**
	 * A clock of m hours (0 at the top, where a wall clock has 12) and arithmetic on it.
	 *
	 * Phases (`step.hints.phase`):
	 * - `add`: the hand starts at 0, walks `params.addA` hours, then `params.addB` more,
	 *   tracing a spiral that moves inwards on each lap; the side panel works out the
	 *   remainder. Loops.
	 * - `times`: every hour k sends a chord to k × `params.times` (mod m); hours never
	 *   reached are struck through. A row of chips shows every multiplier 1 … m − 1 and
	 *   whether it shuffles the clock (click one to choose it).
	 * - `powers`: the powers 1, g, g², … of `params.base` on `params.powHours` hours, hop by
	 *   hop until a value repeats. Loops.
	 *
	 * All arithmetic comes from the model (`modular.ts`). Reduced motion shows the finished
	 * drawing. Text uses `style:` (the stage CSS overrides presentation attributes).
	 */
	import { clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { addOnClock, isPrime, factorText, mod, powerWalk, sup, timesMap } from '../modular';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'add'));
	const num = (id: string, fallback: number, lo: number, hi: number) =>
		clamp(Math.round(Number(params[id] ?? fallback)), lo, hi);

	const m = $derived(phase === 'powers' ? num('powHours', 13, 2, 31) : num('hours', 12, 2, 31));

	// ---- geometry ----------------------------------------------------------------------
	const CX = 290;
	const CY = 300;
	const R = 228;
	const RL = R - 24; // hour labels
	const RC = R - 46; // chord ends
	const ang = (h: number) => -Math.PI / 2 + (2 * Math.PI * h) / m;
	const at = (h: number, r: number) => ({
		x: CX + r * Math.cos(ang(h)),
		y: CY + r * Math.sin(ang(h))
	});
	const HOURS = $derived(Array.from({ length: m }, (_, h) => h));
	const labelSize = $derived(m > 24 ? 13 : 15);

	/** A curved chord from hour i to hour j (a small loop if i = j). */
	function chord(i: number, j: number) {
		const a = at(i, RC);
		if (i === j) {
			const c = at(i, RC - 18);
			return `M${a.x} ${a.y} A9 9 0 1 1 ${c.x} ${c.y} A9 9 0 1 1 ${a.x} ${a.y}`;
		}
		const b = at(j, RC);
		const qx = CX + ((a.x + b.x) / 2 - CX) * 0.45;
		const qy = CY + ((a.y + b.y) / 2 - CY) * 0.45;
		return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
	}
	/** Point at fraction u along `chord(i, j)` (quadratic Bézier). */
	function chordAt(i: number, j: number, u: number) {
		const a = at(i, RC);
		const b = at(j, RC);
		const qx = CX + ((a.x + b.x) / 2 - CX) * 0.45;
		const qy = CY + ((a.y + b.y) / 2 - CY) * 0.45;
		const v = 1 - u;
		return {
			x: v * v * a.x + 2 * v * u * qx + u * u * b.x,
			y: v * v * a.y + 2 * v * u * qy + u * u * b.y
		};
	}

	const PX = 588;

	// ---- add ---------------------------------------------------------------------------
	const a = $derived(num('addA', 9, 0, 30));
	const b = $derived(num('addB', 5, 0, 30));
	const sum = $derived(addOnClock(a, b, m));
	const legDur = (h: number) => (h === 0 ? 0 : clamp(h * 0.14, 0.6, 3));
	const addTimes = $derived.by(() => {
		const s1 = 0.6;
		const e1 = s1 + legDur(a);
		const s2 = e1 + 0.5;
		const e2 = s2 + legDur(b);
		return { s1, e1, s2, e2, period: e2 + 6 };
	});
	const addU = $derived(reduced ? Infinity : cycle(t, addTimes.period) * addTimes.period);
	/** Hours walked so far (continuous). */
	const walked = $derived.by(() => {
		const T = addTimes;
		const u = addU;
		if (u < T.s1) return 0;
		if (u < T.e1) return (a * (u - T.s1)) / (T.e1 - T.s1);
		if (u < T.s2) return a;
		if (u < T.e2) return a + (b * (u - T.s2)) / (T.e2 - T.s2);
		return a + b;
	});
	const addDone = $derived(walked >= a + b && addU >= addTimes.e2);
	const laps = $derived(Math.max(1, Math.ceil((a + b) / m)));
	const gap = $derived(Math.min(18, 110 / laps));
	const spiral = (s: number) => {
		const r = RC + 8 - gap * (s / m);
		return { x: CX + r * Math.cos(ang(s)), y: CY + r * Math.sin(ang(s)) };
	};
	function spiralPath(s0: number, s1: number) {
		if (s1 <= s0) return '';
		const n = Math.max(2, Math.ceil((s1 - s0) * (48 / m)) + 1);
		let d = '';
		for (let i = 0; i <= n; i++) {
			const p = spiral(s0 + ((s1 - s0) * i) / n);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
		}
		return d;
	}
	const handHour = $derived(mod(walked, m));
	/** Fade the walk out just before the loop starts again. */
	const addFade = $derived(
		reduced ? 1 : 1 - smoothstep(addTimes.period - 0.7, addTimes.period, addU)
	);

	// ---- times -------------------------------------------------------------------------
	const mult = $derived(num('times', 3, 1, 30));
	const tm = $derived(timesMap(mult, m));
	const reachedSet = $derived(new Set(tm.reached));
	const tt = $derived(reduced ? Infinity : t);
	const arrowOn = (k: number) => clamp((tt - 0.4 - k * (2.4 / m)) / 0.35, 0, 1);
	const MULTS = $derived(Array.from({ length: m - 1 }, (_, i) => i + 1));
	const shuffleCount = $derived(MULTS.filter((c) => timesMap(c, m).shuffles).length);
	const chipAt = (i: number) => ({ x: PX + (i % 10) * 34, y: 352 + Math.floor(i / 10) * 32 });
	function chipKey(event: KeyboardEvent, c: number) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		setParam('times', c);
	}

	// ---- powers ------------------------------------------------------------------------
	const g = $derived(num('base', 2, 2, 30));
	const pw = $derived(powerWalk(g, m));
	const HOP = 0.55;
	const hops = $derived(pw.seq.length - 1);
	const powPeriod = $derived(0.6 + hops * HOP + 4);
	const powU = $derived(reduced ? Infinity : cycle(t, powPeriod) * powPeriod);
	const powFade = $derived(reduced ? 1 : 1 - smoothstep(powPeriod - 0.6, powPeriod, powU));
	const hopOn = (i: number) => clamp((powU - 0.6 - i * HOP) / (HOP * 0.85), 0, 1);
	/** First exponent at which each hour is reached. */
	const firstExp = $derived.by(() => {
		const out: (number | undefined)[] = [];
		pw.seq.forEach((v, i) => {
			if (out[v] === undefined) out[v] = i;
		});
		return out;
	});
	const hopsShown = $derived(pw.seq.filter((_, i) => i === 0 || hopOn(i - 1) >= 1).length);
	const seqLines = $derived.by(() => {
		const items = pw.seq.slice(0, hopsShown).map(String);
		const out: string[] = [];
		for (let i = 0; i < items.length; i += 11) out.push(items.slice(i, i + 11).join(', '));
		return out;
	});
	const powDone = $derived(hopsShown === pw.seq.length);
	const powVerdict = $derived.by(() => {
		if (mod(g, m) === 0)
			return [`${g} is a multiple of ${m}:`, `from ${g}¹ on, every power lands on 0.`];
		if (pw.returnsToOne) {
			const all = pw.cycleLength === m - 1;
			return [
				`Back to 1 after ${pw.cycleLength} step${pw.cycleLength === 1 ? '' : 's'}`,
				all
					? `— every nonzero hour visited once.`
					: `— ${pw.cycleLength} of the ${m - 1} nonzero hours visited.`
			];
		}
		const loop = pw.seq.slice(pw.cycleStart, -1);
		return ['Never back to 1: stuck going round', `${[...loop, ...loop].join(', ')}, …`];
	});
	const mNote = (n: number) =>
		isPrime(n) ? `${n} is prime` : `${n} = ${factorText(n)} is not prime`;
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
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

<g>
	<!-- the clock face -->
	<circle cx={CX} cy={CY} r={R} fill="var(--pm-face)" stroke="var(--border)" stroke-width="1.5" />
	{#each HOURS as h (h)}
		{@const tick1 = at(h, R)}
		{@const tick2 = at(h, R - 9)}
		<line
			x1={tick1.x}
			y1={tick1.y}
			x2={tick2.x}
			y2={tick2.y}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
	{/each}

	{#if phase === 'add'}
		<!-- the walked spiral: first leg, then second -->
		<g opacity={addFade}>
			<path
				d={spiralPath(0, Math.min(walked, a))}
				fill="none"
				stroke="var(--pm-p2)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{#if walked > a}
				<path
					d={spiralPath(a, walked)}
					fill="none"
					stroke="var(--pm-walk)"
					stroke-width="3"
					stroke-linecap="round"
				/>
			{/if}
		</g>
		<!-- start, first stop, result -->
		{#each HOURS as h (h)}
			{@const p = at(h, RL)}
			{@const isResult = addDone && h === sum.result}
			{@const isA = h === mod(a, m) && walked >= a}
			{#if isResult}
				<circle cx={p.x} cy={p.y} r="15" fill="var(--pm-walk)" />
			{:else if isA}
				<circle cx={p.x} cy={p.y} r="15" fill="none" stroke="var(--pm-p2)" stroke-width="2" />
			{/if}
			{@render txt(p.x, p.y + 5, String(h), labelSize, {
				anchor: 'middle',
				weight: isResult || isA ? 700 : 500,
				color: isResult ? 'var(--stage-bg)' : undefined,
				halo: false
			})}
		{/each}
		<!-- the hand -->
		{@const tip = at(handHour, RC - 4)}
		<line
			x1={CX}
			y1={CY}
			x2={tip.x}
			y2={tip.y}
			stroke="var(--stage-ink)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={CX} cy={CY} r="6" fill="var(--stage-ink)" />

		<!-- working -->
		{@render txt(PX, 96, `${m}-hour clock`, 14, { muted: true, weight: 600 })}
		{@render txt(PX, 140, `${a} + ${b} = ${sum.total}`, 30, { weight: 700 })}
		<g opacity={addDone ? 1 : 0.25}>
			{@render txt(
				PX,
				184,
				sum.laps === 0
					? `${sum.total} is less than ${m}: no wrap`
					: `${sum.total} = ${sum.laps} × ${m} + ${sum.result}`,
				18
			)}
			{@render txt(
				PX,
				210,
				sum.laps === 0
					? 'the hand stays within one lap'
					: `the hand goes ${sum.laps} full lap${sum.laps === 1 ? '' : 's'} round, then ${sum.result} more`,
				13,
				{ muted: true }
			)}
			{@render txt(PX, 262, `${a} + ${b} ≡ ${sum.result}  (mod ${m})`, 24, {
				weight: 700,
				color: 'var(--pm-walk)'
			})}
		</g>
		<!-- legend -->
		<line
			x1={PX}
			y1={326}
			x2={PX + 26}
			y2={326}
			stroke="var(--pm-p2)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{@render txt(PX + 36, 331, `start at ${a}`, 13)}
		<line
			x1={PX}
			y1={352}
			x2={PX + 26}
			y2={352}
			stroke="var(--pm-walk)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{@render txt(PX + 36, 357, `add ${b} hours`, 13)}
		{@render txt(PX, 400, 'Only the remainder after dividing by', 13, { muted: true })}
		{@render txt(PX, 418, `${m} matters: that is where the hand stops.`, 13, { muted: true })}
	{:else if phase === 'times'}
		<!-- chords k → k × mult -->
		{#each HOURS as k (k)}
			{@const on = arrowOn(k)}
			{@const j = tm.image[k]}
			{#if on > 0}
				<path
					d={chord(k, j)}
					pathLength="1"
					stroke-dasharray="{on} 2"
					fill="none"
					stroke="var(--pm-walk)"
					stroke-width="1.8"
					stroke-opacity="0.75"
					marker-end={on >= 1 && k !== j ? 'url(#arrowhead)' : undefined}
				/>
				{#if on >= 1 && !reduced && k !== j}
					{@const d = chordAt(k, j, cycle(t, 2.4, k / m))}
					<circle cx={d.x} cy={d.y} r="3.5" fill="var(--pm-walk)" />
				{/if}
			{/if}
		{/each}
		{#each HOURS as h (h)}
			{@const p = at(h, RL)}
			{@const hit = reachedSet.has(h)}
			{@const shown = arrowOn(m - 1) >= 1}
			{#if shown && hit}
				<circle
					cx={p.x}
					cy={p.y}
					r="14"
					fill="var(--pm-ok)"
					fill-opacity="0.2"
					stroke="var(--pm-ok)"
					stroke-width="1.5"
				/>
			{/if}
			{@render txt(p.x, p.y + 5, String(h), labelSize, {
				anchor: 'middle',
				weight: shown && hit ? 700 : 500,
				opacity: shown && !hit ? 0.35 : 1,
				halo: false
			})}
			{#if shown && !hit}
				<line
					x1={p.x - 10}
					y1={p.y + 9}
					x2={p.x + 10}
					y2={p.y - 9}
					stroke="var(--pm-bad)"
					stroke-width="2"
					stroke-linecap="round"
					opacity="0.8"
				/>
			{/if}
		{/each}

		<!-- panel -->
		{@render txt(PX, 86, `× ${mult} on a ${m}-hour clock`, 22, { weight: 700 })}
		{#if mult >= m}
			{@render txt(PX, 110, `(${mult} ≡ ${mod(mult, m)} on ${m} hours)`, 13, { muted: true })}
		{/if}
		{#if tm.shuffles}
			{@render txt(PX, 146, `Lands on every hour exactly once:`, 15, {
				weight: 600,
				color: 'var(--pm-ok)'
			})}
			{@render txt(PX, 168, 'a shuffle, so it can be undone.', 15, {
				weight: 600,
				color: 'var(--pm-ok)'
			})}
			{#if tm.inverse !== null}
				{@render txt(
					PX,
					200,
					`Undo it with × ${tm.inverse}: ${mod(mult, m)} × ${tm.inverse} = ${mod(mult, m) * tm.inverse} ≡ 1`,
					14
				)}
			{/if}
		{:else}
			{@render txt(PX, 146, `Lands on only ${tm.reached.length} of ${m} hours:`, 15, {
				weight: 600,
				color: 'var(--pm-bad)'
			})}
			{@render txt(
				PX,
				168,
				tm.reached.length <= 10 ? tm.reached.join(', ') : `${tm.reached.slice(0, 9).join(', ')}, …`,
				15,
				{ weight: 600, color: 'var(--pm-bad)' }
			)}
			{#if tm.zeroPartner !== null}
				{@render txt(
					PX,
					200,
					`${mod(mult, m)} × ${tm.zeroPartner} = ${mod(mult, m) * tm.zeroPartner} ≡ 0, though neither is 0.`,
					14
				)}
				{@render txt(PX, 220, `Information is lost: no dividing by ${mod(mult, m)}.`, 14, {
					muted: true
				})}
			{:else}
				{@render txt(PX, 200, 'Everything lands on 0.', 14)}
			{/if}
		{/if}

		{@render txt(
			PX,
			296,
			isPrime(m)
				? `${m} is prime: every multiplier shuffles`
				: `Multipliers on ${m} hours: ${shuffleCount} of ${m - 1} shuffle`,
			14,
			{
				weight: 600,
				color: isPrime(m) ? 'var(--pm-ok)' : undefined
			}
		)}
		{@render txt(PX, 316, 'green: shuffles · red: loses hours · click to try', 12, { muted: true })}
		{#each MULTS as c, i (c)}
			{@const p = chipAt(i)}
			{@const ok = timesMap(c, m).shuffles}
			{@const sel = c === mod(mult, m)}
			<g
				role="button"
				tabindex="0"
				aria-label="Multiply by {c}: {ok ? 'shuffles every hour' : 'loses hours'}"
				aria-pressed={sel}
				class="chip"
				style:cursor="pointer"
				onclick={() => setParam('times', c)}
				onkeydown={(e) => chipKey(e, c)}
			>
				<rect
					x={p.x}
					y={p.y}
					width="30"
					height="26"
					rx="6"
					fill={ok ? 'var(--pm-ok)' : 'var(--pm-bad)'}
					fill-opacity={ok ? 0.22 : 0.08}
					stroke={sel ? 'var(--stage-ink)' : ok ? 'var(--pm-ok)' : 'var(--pm-bad)'}
					stroke-width={sel ? 2.5 : 1.2}
				/>
				{@render txt(p.x + 15, p.y + 18, String(c), 13, {
					anchor: 'middle',
					weight: sel ? 700 : 600,
					halo: false
				})}
			</g>
		{/each}
	{:else}
		<!-- powers: hops 1 → g → g² → … -->
		<g opacity={powFade}>
			{#each pw.seq.slice(0, -1) as v, i (i)}
				{@const on = hopOn(i)}
				{@const w = pw.seq[i + 1]}
				{@const repeatHop = i === hops - 1}
				{#if on > 0}
					<path
						d={chord(v, w)}
						pathLength="1"
						stroke-dasharray="{on} 2"
						fill="none"
						stroke={repeatHop && !pw.returnsToOne ? 'var(--pm-bad)' : 'var(--pm-walk)'}
						stroke-width={on < 1 ? 3 : 2}
						stroke-opacity={on < 1 ? 1 : 0.7}
						marker-end={on >= 1 && v !== w ? 'url(#arrowhead)' : undefined}
					/>
					{#if on < 1 && v !== w}
						{@const d = chordAt(v, w, on)}
						<circle cx={d.x} cy={d.y} r="5" fill="var(--pm-walk)" />
					{/if}
				{/if}
			{/each}
		</g>
		{#each HOURS as h (h)}
			{@const p = at(h, RL)}
			{@const e = firstExp[h]}
			{@const visited = e !== undefined && (e === 0 || hopOn(e - 1) >= 1)}
			{#if visited}
				{@const q = at(h, R + 20)}
				<circle
					cx={p.x}
					cy={p.y}
					r="14"
					fill="var(--pm-walk)"
					fill-opacity={h === 1 ? 0.9 : 0.2}
					stroke="var(--pm-walk)"
					stroke-width="1.5"
				/>
				{@render txt(q.x, q.y + 5, `${g}${sup(e)}`, 13, {
					anchor: 'middle',
					weight: 600,
					color: 'var(--pm-walk)'
				})}
			{/if}
			{@render txt(p.x, p.y + 5, String(h), labelSize, {
				anchor: 'middle',
				weight: visited ? 700 : 500,
				color: visited && h === 1 ? 'var(--stage-bg)' : undefined,
				opacity: visited || h === 1 ? 1 : 0.45,
				halo: false
			})}
		{/each}

		<!-- panel -->
		{@render txt(PX, 86, `Powers of ${g} on a ${m}-hour clock`, 20, { weight: 700 })}
		{@render txt(PX, 110, g >= m ? `${mNote(m)} · ${g} ≡ ${mod(g, m)} here` : mNote(m), 13, {
			muted: true
		})}
		{@render txt(PX, 150, `${g}⁰, ${g}¹, ${g}², … =`, 14, { muted: true })}
		{#each seqLines as line, i (i)}
			{@render txt(PX, 176 + i * 24, line, 16, { weight: 600 })}
		{/each}
		<g opacity={powDone ? 1 : 0}>
			{@render txt(PX, 268, powVerdict[0], 15, {
				weight: 700,
				color: pw.returnsToOne ? 'var(--pm-walk)' : 'var(--pm-bad)'
			})}
			{@render txt(PX, 290, powVerdict[1], 15, {
				weight: 700,
				color: pw.returnsToOne ? 'var(--pm-walk)' : 'var(--pm-bad)'
			})}
			{#if isPrime(m) && mod(g, m) !== 0}
				{@render txt(PX, 330, `${g}${sup(m - 1)} ≡ 1 (mod ${m}): Fermat's little theorem.`, 13)}
				{@render txt(PX, 350, `On a prime clock the powers always return to 1.`, 13, {
					muted: true
				})}
			{:else if !isPrime(m)}
				{@render txt(PX, 330, `On a clock that isn't prime, powers can get stuck`, 13)}
				{@render txt(PX, 350, `or collapse; on a prime clock they never do.`, 13, { muted: true })}
			{/if}
		</g>
		{@render txt(PX, 420, 'Each hop multiplies by', 13, { muted: true })}
		{@render txt(PX, 438, `${g} and keeps the remainder.`, 13, { muted: true })}
	{/if}
</g>

<style>
	.chip:focus {
		outline: none;
	}
	.chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
