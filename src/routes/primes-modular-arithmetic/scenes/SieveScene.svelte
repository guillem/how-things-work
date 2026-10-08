<script lang="ts">
	/**
	 * The numbers 1–100 on a 10 × 10 grid.
	 *
	 * Phases (`step.hints.phase`):
	 * - `divisors`: the number `params.pick` (click a cell, or focus the grid and use the
	 *   arrow keys) with its divisors lighting up in turn, its divisor pairs and its prime
	 *   factorisation.
	 * - `sieve`: the sieve of Eratosthenes after `params.sieve` stages (0–4: the primes 2, 3,
	 *   5, 7). The latest stage plays as a cascade from the moment it was reached; numbers
	 *   already struck by a smaller prime flash but keep their first colour. "Next prime"
	 *   (`params.nextPrime`, a press count) moves the slider on; the counts already applied
	 *   are kept in `params['pm:seen']` so leaving and returning does not replay them.
	 * - `done`: the finished sieve; the multiples of 11 are shown to be struck already, then
	 *   the 25 primes light up.
	 *
	 * All numbers come from `sieve(100)` in the model. Reduced motion (or a paused stage
	 * for the cascade) shows the finished frame. Text uses `style:` (the stage CSS
	 * overrides presentation attributes).
	 */
	import { untrack } from 'svelte';
	import { clamp, smoothstep, toSvg, wave } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { divisors, factorText, isPrime, sieve, struckAfter } from '../modular';

	let { step, t, params, setParam, reduced, playing }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'divisors'));
	const S = sieve(100);
	const STAGE_PRIMES = S.stages.map((s) => s.prime);
	const COLOR: Record<number, string> = {
		2: 'var(--pm-p2)',
		3: 'var(--pm-p3)',
		5: 'var(--pm-p5)',
		7: 'var(--pm-p7)'
	};

	// ---- layout ------------------------------------------------------------------------
	const CELL = 46;
	const PITCH = 50;
	const X0 = 36;
	const Y0 = 52;
	const NUMS = Array.from({ length: 100 }, (_, i) => i + 1);
	const cx = (n: number) => X0 + ((n - 1) % 10) * PITCH + CELL / 2;
	const cy = (n: number) => Y0 + Math.floor((n - 1) / 10) * PITCH + CELL / 2;
	const PX = 580;

	// ---- divisors phase ----------------------------------------------------------------
	const pick = $derived(clamp(Math.round(Number(params.pick ?? 60)), 2, 100));
	const divs = $derived(divisors(pick));
	const tv = $derived(reduced ? Infinity : t);
	/** 0–1: how far divisor number i (in increasing order) has lit up. */
	const divOn = (i: number) => clamp((tv - 0.3 - i * 0.18) / 0.25, 0, 1);
	const pairs = $derived(
		divs.slice(0, Math.ceil(divs.length / 2)).map((d, i) => ({ d, e: pick / d, i }))
	);

	// ---- sieve phase -------------------------------------------------------------------
	const k = $derived(clamp(Math.round(Number(params.sieve ?? 1)), 0, 4));

	// "Next prime" presses → slider, against a baseline kept in params.
	$effect(() => {
		const count = Number(params.nextPrime ?? 0);
		untrack(() => {
			const seen = Number(params['pm:seen'] ?? 0);
			if (count === seen) return;
			setParam('pm:seen', count);
			if (count > seen) setParam('sieve', clamp(k + (count - seen), 0, 4));
		});
	});

	// Time since the stage last moved forward (restart pattern). Moving back shows the
	// finished frame at once.
	let lastK = -1;
	let t0 = 0;
	let lastT = 0;
	const tk = $derived.by(() => {
		if (k !== lastK) {
			t0 = lastK === -1 || k > lastK ? (lastK === -1 ? 0 : t) : -Infinity;
			lastK = k;
		}
		if (t < lastT && t0 !== -Infinity) t0 = Math.min(t0, t, 0);
		lastT = t;
		return reduced || !playing ? Infinity : t - t0;
	});
	const LEAD = 0.5;
	const cur = $derived(phase === 'sieve' && k > 0 ? S.stages[k - 1] : null);
	const dt = $derived(cur ? Math.min(0.09, 2 / cur.multiples.length) : 0);
	/** Index of each multiple in the current cascade. */
	const curIndex = $derived(new Map(cur ? cur.multiples.map((m, i) => [m, i]) : []));
	const cascadeEnd = $derived(cur ? LEAD + cur.multiples.length * dt + 0.3 : 0);
	const struck = $derived(struckAfter(S, phase === 'sieve' ? k : 4));

	/** 0–1: how far n's strike has drawn (1 when struck by an earlier stage). */
	function strikeOf(n: number) {
		const p = struck[n];
		if (!p) return 0;
		if (cur && p === cur.prime) {
			const i = curIndex.get(n) ?? 0;
			return clamp((tk - LEAD - i * dt) / 0.25, 0, 1);
		}
		return 1;
	}
	/** Flash on a number the current prime hits that was already struck. */
	function flashOf(n: number) {
		if (!cur || struck[n] === cur.prime) return 0;
		const i = curIndex.get(n);
		if (i === undefined) return 0;
		const u = (tk - LEAD - i * dt) / 0.6;
		return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
	}
	const foundPrimes = $derived(phase === 'sieve' ? STAGE_PRIMES.slice(0, k) : []);
	const nextCandidate = $derived(k < 4 ? STAGE_PRIMES[k] : S.stopPrime);
	/** Numbers not (yet) struck, counting down as the cascade plays. */
	const standing = $derived(NUMS.filter((n) => n > 1 && strikeOf(n) === 0).length);

	// ---- done phase --------------------------------------------------------------------
	const ELEVEN = [22, 33, 44, 55, 66, 77, 88, 99];
	const PRIME_T0 = 2.4;
	/** 0–1 flash on the i-th multiple of 11. */
	const elevenFlash = (i: number) => {
		const u = (t - 0.6 - i * 0.18) / 0.7;
		return reduced ? 0 : u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
	};
	const primeOn = (i: number) => (reduced ? 1 : clamp((t - PRIME_T0 - i * 0.07) / 0.3, 0, 1));
	const primeIndex = new Map(S.primes.map((p, i) => [p, i]));
	const shownPrimes = $derived(S.primes.filter((_, i) => primeOn(i) > 0).length);

	// ---- per-cell style ----------------------------------------------------------------
	function cellStyle(n: number) {
		if (phase === 'divisors') {
			const i = divs.indexOf(n);
			const on = i >= 0 ? divOn(i) : 0;
			const self = n === pick;
			return {
				fill: self ? 'var(--pm-walk)' : on > 0 ? 'var(--pm-walk)' : 'var(--pm-cell)',
				fillOpacity: self ? 0.9 : on > 0 ? 0.22 * on : 1,
				stroke: on > 0 || self ? 'var(--pm-walk)' : 'var(--border)',
				strokeOpacity: self ? 1 : on > 0 ? on : 0.6,
				text: self ? 'var(--stage-bg)' : on > 0.5 ? 'var(--pm-walk)' : undefined,
				weight: on > 0.5 || self ? 700 : 500,
				textOpacity: 1,
				strike: 0,
				strikeColor: ''
			};
		}
		if (phase === 'done') {
			const p = struck[n];
			const pi = primeIndex.get(n);
			const on = pi === undefined ? 0 : primeOn(pi);
			return {
				fill: p ? COLOR[p] : on > 0 ? 'var(--pm-prime)' : 'var(--pm-cell)',
				fillOpacity: p ? 0.1 : on > 0 ? 0.2 * on : 1,
				stroke: on > 0 ? 'var(--pm-prime)' : 'var(--border)',
				strokeOpacity: on > 0 ? on : 0.5,
				text: on > 0.5 ? 'var(--pm-prime)' : undefined,
				weight: on > 0.5 ? 700 : 500,
				textOpacity: p ? 0.4 : 1,
				strike: p ? 1 : 0,
				strikeColor: p ? COLOR[p] : ''
			};
		}
		const p = struck[n];
		const s = strikeOf(n);
		const found = foundPrimes.includes(n);
		return {
			fill: s > 0 ? COLOR[p] : found ? 'var(--pm-prime)' : 'var(--pm-cell)',
			fillOpacity: s > 0 ? 0.16 * s : found ? 0.2 : 1,
			stroke: found ? 'var(--pm-prime)' : 'var(--border)',
			strokeOpacity: found ? 1 : 0.6,
			text: found ? 'var(--pm-prime)' : undefined,
			weight: found ? 700 : 500,
			textOpacity: 1 - 0.5 * s,
			strike: s,
			strikeColor: s > 0 ? COLOR[p] : ''
		};
	}

	// ---- pointer and keyboard (divisors phase) -----------------------------------------
	let focused = $state(false);
	function numAt(x: number, y: number) {
		const col = Math.floor((x - X0) / PITCH);
		const row = Math.floor((y - Y0) / PITCH);
		if (col < 0 || col > 9 || row < 0 || row > 9) return null;
		return row * 10 + col + 1;
	}
	function ondown(event: PointerEvent) {
		const p = toSvg(event, event.currentTarget as SVGElement);
		const n = numAt(p.x, p.y);
		if (n && n >= 2) setParam('pick', n);
	}
	function onkeydown(event: KeyboardEvent) {
		const d: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 };
		let next: number;
		if (event.key in d) next = pick + d[event.key];
		else if (event.key === 'Home') next = 2;
		else if (event.key === 'End') next = 100;
		else return;
		event.preventDefault();
		setParam('pick', clamp(next, 2, 100));
	}

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const lines = (xs: number[], per: number) =>
		Array.from({ length: Math.ceil(xs.length / per) }, (_, i) =>
			xs.slice(i * per, i * per + per).join('  ')
		);
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
	<!-- the grid -->
	{#each NUMS as n (n)}
		{@const c = cellStyle(n)}
		<rect
			x={cx(n) - CELL / 2}
			y={cy(n) - CELL / 2}
			width={CELL}
			height={CELL}
			rx="8"
			fill={c.fill}
			fill-opacity={c.fillOpacity}
			stroke={c.stroke}
			stroke-opacity={c.strokeOpacity}
			stroke-width={c.weight === 700 ? 2 : 1}
		/>
		{#if c.strike > 0}
			<line
				x1={cx(n) - 15}
				y1={cy(n) + 15}
				x2={cx(n) - 15 + 30 * c.strike}
				y2={cy(n) + 15 - 30 * c.strike}
				stroke={c.strikeColor}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		{/if}
		{@render txt(cx(n), cy(n) + 5.5, String(n), 15, {
			anchor: 'middle',
			weight: c.weight,
			color: c.text,
			opacity: c.textOpacity,
			halo: false,
			muted: n === 1 && phase !== 'divisors'
		})}
	{/each}

	{#if phase === 'divisors'}
		<!-- divisor pairs: the side panel -->
		{@render txt(PX, 92, String(pick), 44, { weight: 700, color: 'var(--pm-walk)' })}
		{@render txt(
			PX + 30 + String(pick).length * 24,
			92,
			isPrime(pick) ? 'is prime' : `= ${factorText(pick)}`,
			22,
			{
				weight: 600
			}
		)}
		{@render txt(
			PX,
			132,
			`${plural(divs.length, 'divisor')}, in pairs that multiply to ${pick}:`,
			14,
			{
				muted: true
			}
		)}
		{#each pairs as q (q.d)}
			{@const on = Math.min(divOn(q.i), divOn(divs.length - 1 - q.i))}
			{@render txt(
				PX + 12,
				166 + q.i * 28,
				q.d === q.e ? `${q.d} × ${q.e}` : `${q.d} × ${q.e}`,
				17,
				{
					weight: 600,
					opacity: 0.25 + 0.75 * on
				}
			)}
		{/each}
		{@render txt(
			PX,
			166 + pairs.length * 28 + 22,
			isPrime(pick)
				? 'Only 1 and itself: a prime.'
				: `More than two divisors: composite, built from primes.`,
			14,
			{ weight: 600, color: isPrime(pick) ? 'var(--pm-prime)' : undefined }
		)}
		{@render txt(PX, 560, 'Click a number, or Tab to the grid and use the arrow keys', 11, {
			muted: true
		})}

		{#if focused}
			<rect
				x={cx(pick) - CELL / 2 - 4}
				y={cy(pick) - CELL / 2 - 4}
				width={CELL + 8}
				height={CELL + 8}
				rx="10"
				fill="none"
				stroke="var(--focus)"
				stroke-width="3"
				style:pointer-events="none"
			/>
		{/if}
		<rect
			x={X0 - 4}
			y={Y0 - 4}
			width={10 * PITCH + 4}
			height={10 * PITCH + 4}
			fill="transparent"
			role="slider"
			tabindex="0"
			aria-label="Number grid: arrow keys pick a number"
			aria-valuemin="2"
			aria-valuemax="100"
			aria-valuenow={pick}
			aria-valuetext="{pick}: {isPrime(pick) ? 'prime' : factorText(pick)}"
			style:outline="none"
			style:cursor="pointer"
			onpointerdown={ondown}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			{onkeydown}
		/>
	{:else if phase === 'sieve'}
		<!-- a dashed ring on the next candidate -->
		{#if k < 4 && tk > cascadeEnd}
			<rect
				x={cx(nextCandidate) - CELL / 2 - 4}
				y={cy(nextCandidate) - CELL / 2 - 4}
				width={CELL + 8}
				height={CELL + 8}
				rx="11"
				fill="none"
				stroke="var(--pm-prime)"
				stroke-width="2"
				stroke-dasharray="5 4"
				opacity={reduced ? 1 : 0.45 + 0.55 * wave(t, 1.6)}
			/>
		{/if}
		<!-- flashes on numbers the current prime hits a second time -->
		{#if cur}
			{#each cur.multiples as m (m)}
				{@const f = flashOf(m)}
				{#if f > 0}
					<rect
						x={cx(m) - CELL / 2 - 2}
						y={cy(m) - CELL / 2 - 2}
						width={CELL + 4}
						height={CELL + 4}
						rx="9"
						fill="none"
						stroke={COLOR[cur.prime]}
						stroke-width="2.5"
						opacity={f}
					/>
				{/if}
			{/each}
		{/if}

		<!-- panel -->
		{@render txt(PX, 80, 'Strike out the multiples of', 15, { weight: 600 })}
		{#each S.stages as st, i (st.prime)}
			{@const y = 120 + i * 46}
			{@const done = i < k}
			<g opacity={done ? 1 : 0.4}>
				<rect
					x={PX}
					y={y - 17}
					width="30"
					height="30"
					rx="7"
					fill={COLOR[st.prime]}
					fill-opacity="0.18"
					stroke={COLOR[st.prime]}
				/>
				{@render txt(PX + 15, y + 4, String(st.prime), 16, {
					anchor: 'middle',
					weight: 700,
					color: COLOR[st.prime],
					halo: false
				})}
				{@render txt(
					PX + 44,
					y + 4,
					done
						? st.fresh.length === st.multiples.length
							? `${st.multiples.length} multiples, all new`
							: `${st.multiples.length} multiples, ${st.fresh.length} new`
						: 'not yet',
					14
				)}
			</g>
		{/each}
		{@render txt(PX, 330, `Still standing: ${standing} numbers (besides 1)`, 15, { weight: 600 })}
		{#if k < 4}
			{@render txt(PX, 362, `Next: ${nextCandidate} — the smallest number left.`, 14)}
			{@render txt(PX, 384, 'Nothing smaller divides it, so it is prime.', 14, { muted: true })}
		{:else}
			{@render txt(PX, 362, `Next would be 11, but 11 × 11 = 121 > 100:`, 14)}
			{@render txt(PX, 384, 'every number left is prime.', 14, {
				weight: 700,
				color: 'var(--pm-prime)'
			})}
		{/if}
		{@render txt(PX, 430, 'Colour = the prime that struck it first', 12, { muted: true })}
		{@render txt(PX, 448, '(its smallest prime factor)', 12, { muted: true })}
	{:else}
		<!-- done: 11's multiples are already gone, then the primes light up -->
		<rect
			x={cx(11) - CELL / 2 - 4}
			y={cy(11) - CELL / 2 - 4}
			width={CELL + 8}
			height={CELL + 8}
			rx="11"
			fill="none"
			stroke="var(--pm-prime)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
		{#each ELEVEN as m, i (m)}
			{@const f = elevenFlash(i)}
			{#if f > 0}
				<rect
					x={cx(m) - CELL / 2 - 2}
					y={cy(m) - CELL / 2 - 2}
					width={CELL + 4}
					height={CELL + 4}
					rx="9"
					fill="none"
					stroke="var(--pm-prime)"
					stroke-width="2.5"
					opacity={f}
				/>
			{/if}
		{/each}
		{@render txt(PX, 80, '11 × 11 = 121 is off the grid,', 15, { weight: 600 })}
		{@render txt(PX, 102, 'and 22, 33, … 99 are already struck', 14)}
		{@render txt(PX, 122, '(22 = 2 × 11, 33 = 3 × 11, …).', 14, { muted: true })}
		{@render txt(
			PX,
			172,
			shownPrimes > 0
				? `${shownPrimes} prime${shownPrimes === 1 ? '' : 's'} up to 100`
				: 'Primes up to 100: …',
			22,
			{
				weight: 700,
				color: 'var(--pm-prime)',
				opacity: shownPrimes > 0 ? 1 : 0.4
			}
		)}
		{#each lines(S.primes, 7) as line, i (i)}
			{@const firstIdx = i * 7}
			{@render txt(PX, 206 + i * 26, line, 16, {
				weight: 600,
				opacity: smoothstep(0, 1, primeOn(firstIdx))
			})}
		{/each}
		{@render txt(PX, 330, '1 is neither prime nor composite.', 13, { muted: true })}
		{@render txt(PX, 372, 'Sieving with 2, 3, 5 and 7 — the primes up to', 13)}
		{@render txt(PX, 392, '√100 = 10 — is enough for every number to 100.', 13)}
	{/if}
</g>
