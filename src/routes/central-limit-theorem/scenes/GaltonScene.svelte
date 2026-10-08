<script lang="ts">
	/**
	 * The Galton board: balls fall through `rows` rows of pins, bouncing left or
	 * right at each, and pile up in the bins underneath.
	 *
	 * Phases (`step.hints.phase`):
	 *   board — the balls fall and the bins fill; once 50 have landed, the
	 *           expected shape (binomial × number landed) is drawn over the bins
	 *   why   — same, plus the normal curve, the number of paths into the end
	 *           and middle bins, and one ball's path traced pin by pin with its
	 *           bounces listed (R / L) and its number of rights = its bin
	 *
	 * The run is `galton(rows, 2000, seed)` with seed = 1 + restart presses.
	 * Ball i is released i / pace seconds after the run started, so what is on
	 * screen is a pure function of the run's elapsed time. The run restarts
	 * (elapsed = 0) when rows, pace or the restart count change; that start time
	 * is the only remembered value, kept in a plain variable inside a `$derived`.
	 * Only the few balls in flight are circles; landed balls are stacks of
	 * circles while there are few, then bar heights (keeps the node count low).
	 * Reduced motion: the whole run has landed; ball 0's path is traced.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { binomial, galton, normalDensity } from '../clt';

	let { step, t, params, reduced }: StageProps = $props();

	const COUNT = 2000;
	const MAX_DRAWN = 36; // balls in flight drawn at most

	const phase = $derived(String(step.hints?.phase ?? 'board'));
	const isWhy = $derived(phase === 'why');
	const whyAmt = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = isWhy ? 1 : 0;
		untrack(() => whyAmt.set(v));
	});

	const rows = $derived(clamp(Math.round(Number(params.rows ?? 12)), 2, 16));
	const pace = $derived(clamp(Number(params.pace ?? 12), 1, 200));
	const restarts = $derived(Number(params.restart ?? 0));
	const run = $derived(galton(rows, COUNT, 1 + restarts));
	const ballBin = $derived(run.paths.map((p) => p.reduce((a, b) => a + b, 0)));

	// ---- run clock: restarts when the controls change ---------------------------
	const runKey = $derived(`${rows}|${pace}|${restarts}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0; // a new step started (t went back to 0)
		return Math.max(0, t - t0);
	});

	// ---- geometry ----------------------------------------------------------------
	const CX = 320;
	const PIN_TOP = 84;
	const BIN_TOP = 352;
	const BIN_BOT = 540;
	const dx = $derived(Math.min(56, 540 / (rows + 1)));
	const dy = $derived(Math.min(246 / rows, 1.2 * dx));
	const pinR = $derived(Math.min(4, dx * 0.12));
	const ballR = $derived(Math.min(6, dx * 0.2));
	const pinY = (r: number) => PIN_TOP + r * dy;
	const binX = (k: number) => CX + (k - rows / 2) * dx;
	const left = $derived(binX(0) - dx / 2);
	const right = $derived(binX(rows) + dx / 2);
	/** Where a ball sits just above pin row r after `rights` right bounces (r = rows: below the board). */
	const level = (r: number, rights: number) => ({
		x: CX + (rights - r / 2) * dx,
		y: pinY(r) - pinR - ballR
	});
	const START_Y = PIN_TOP - 56;

	const pins = $derived.by(() => {
		const out: { id: string; x: number; y: number }[] = [];
		for (let r = 0; r < rows; r++)
			for (let j = 0; j <= r; j++)
				out.push({ id: `${r}-${j}`, x: CX + (j - r / 2) * dx, y: pinY(r) });
		return out;
	});

	// ---- timing --------------------------------------------------------------------
	/** Seconds a ball spends in the air: shorter when many balls fall per second. */
	const flight = $derived(Math.max(0.6, Math.min((rows + 2.5) * 0.17, 40 / pace)));
	const segs = $derived(rows + 2.5); // entry (1) + one per row + final fall (1.5)
	const released = $derived(Math.min(COUNT, Math.floor(elapsed * pace) + 1));
	const landed = $derived(
		elapsed < flight ? 0 : Math.min(COUNT, Math.floor((elapsed - flight) * pace) + 1)
	);

	const counts = $derived.by(() => {
		const c: number[] = new Array(rows + 1).fill(0);
		for (let i = 0; i < landed; i++) c[ballBin[i]]++;
		return c;
	});
	const maxCount = $derived(Math.max(1, ...counts));
	const peakFrac = $derived(binomial(rows, Math.floor(rows / 2)));
	/** Height of one ball in a bin: a ball diameter, squeezed once a bin would overflow. */
	const unit = $derived(
		Math.min(2 * ballR, (BIN_BOT - BIN_TOP - 14) / Math.max(maxCount, peakFrac * landed * 1.04, 1))
	);
	const stacks = $derived(unit >= 5 && landed <= 150);

	const pileTop = (k: number) => BIN_BOT - counts[k] * unit;

	/** Position of ball i at `age` seconds after its release; `seg` = pin row it is leaving (−1 before the first). */
	function ballAt(i: number, age: number) {
		const path = run.paths[i];
		const s = clamp(age / flight) * segs;
		if (s < 1) {
			const p = level(0, 0);
			return { x: p.x, y: lerp(START_Y, p.y, s * s), seg: -1 };
		}
		let rights = 0;
		const r = Math.min(rows, Math.floor(s - 1));
		for (let q = 0; q < r; q++) rights += path[q];
		if (r < rows) {
			const u = s - 1 - r;
			const a = level(r, rights);
			const b = level(r + 1, rights + path[r]);
			return {
				x: lerp(a.x, b.x, smoothstep(0, 1, u)),
				y: lerp(a.y, b.y, u * u) - dy * 0.55 * 4 * u * (1 - u),
				seg: r
			};
		}
		const u = clamp((s - 1 - rows) / 1.5);
		const a = level(rows, rights);
		return { x: a.x, y: lerp(a.y, pileTop(rights) - ballR, u * u), seg: rows };
	}

	// ---- one ball's path (why) ---------------------------------------------------------
	const PERIOD = $derived(Math.max(4.5, flight + 2.5));
	const highlight = $derived.by(() => {
		if (!isWhy) return -1;
		if (reduced) return 0;
		const i = Math.floor(Math.floor(elapsed / PERIOD) * PERIOD * pace);
		return Math.min(i, released - 1, COUNT - 1);
	});
	const hl = $derived.by(() => {
		if (highlight < 0) return null;
		const age = elapsed - highlight / pace;
		const p = ballAt(highlight, age);
		const path = run.paths[highlight];
		const done = age >= flight;
		const lvl = done ? rows : Math.min(rows, p.seg); // last pin row reached
		const shown = done ? rows : Math.min(rows, p.seg + 1); // bounces known so far
		let d = `M${CX} ${START_Y}`;
		const hit: string[] = [];
		let rights = 0;
		for (let r = 0; r <= lvl; r++) {
			const q = level(r, rights);
			d += `L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
			if (r < rows) {
				hit.push(`${r}-${rights}`);
				rights += path[r];
			}
		}
		d += done
			? `L${binX(rights).toFixed(1)} ${BIN_TOP + 6}`
			: `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		const letters = Array.from({ length: rows }, (_, r) => ({
			r,
			ch: path[r] ? 'R' : 'L',
			shown: r < shown
		}));
		return {
			x: p.x,
			y: p.y,
			trail: d,
			hit,
			letters,
			done,
			bin: ballBin[highlight],
			rightsSoFar: letters.filter((l) => l.shown && l.ch === 'R').length,
			fade: reduced ? 1 : 1 - smoothstep(PERIOD - 0.5, PERIOD, age)
		};
	});

	// ---- balls in flight ---------------------------------------------------------------
	const inFlight = $derived.by(() => {
		const n = released - landed;
		const every = Math.max(1, Math.ceil(n / MAX_DRAWN));
		const out: { i: number; x: number; y: number; o: number }[] = [];
		for (let i = landed; i < released; i++) {
			if (i % every !== 0 || i === highlight) continue;
			const age = elapsed - i / pace;
			const p = ballAt(i, age);
			out.push({ i, x: p.x, y: p.y, o: smoothstep(0, 0.12, age / flight) });
		}
		return out;
	});

	// ---- stacks / bars ------------------------------------------------------------------
	const stackBalls = $derived.by(() => {
		if (!stacks) return [];
		const out: { id: string; x: number; y: number }[] = [];
		counts.forEach((c, k) => {
			for (let j = 0; j < c; j++)
				out.push({ id: `${k}-${j}`, x: binX(k), y: BIN_BOT - ballR - j * unit });
		});
		return out;
	});

	// ---- overlays -------------------------------------------------------------------------
	const expectedAmt = $derived(smoothstep(40, 60, landed));
	const expectedPts = $derived(
		Array.from({ length: rows + 1 }, (_, k) => ({
			k,
			x: binX(k),
			y: BIN_BOT - binomial(rows, k) * landed * unit
		}))
	);
	const expectedPath = $derived(
		expectedPts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')
	);
	const normalPath = $derived.by(() => {
		const sigma = Math.sqrt(rows) / 2;
		let d = '';
		const N = 90;
		for (let i = 0; i <= N; i++) {
			const k = -0.5 + ((rows + 1) * i) / N;
			const y = BIN_BOT - normalDensity(k, rows / 2, sigma) * landed * unit;
			d += `${i ? 'L' : 'M'}${binX(k).toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});

	/** C(rows, k): the number of different paths into bin k. */
	const paths = (k: number) => Math.round(binomial(rows, k) * 2 ** rows);
	const pathLabels = $derived(
		[...new Set([0, Math.floor(rows / 2), rows])].map((k) => {
			const c = paths(k);
			return { k, text: `${c.toLocaleString('en-US')} path${c === 1 ? '' : 's'}` };
		})
	);

	// ---- panel ------------------------------------------------------------------------------
	const PL = 646;
	const fmt = (n: number) => n.toLocaleString('en-US');
	const letterRows = $derived(rows > 10 ? 2 : 1);
	const perRow = $derived(Math.ceil(rows / letterRows));
	const binIds = $derived(Array.from({ length: rows + 1 }, (_, k) => k));
	const hlBin = $derived(hl?.done ? hl.bin : -1);
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
	<!-- funnel -->
	<path
		d="M{CX - 34} {PIN_TOP - 70} L{CX - 10} {PIN_TOP - 44} M{CX + 34} {PIN_TOP - 70} L{CX +
			10} {PIN_TOP - 44}"
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="2"
		stroke-linecap="round"
	/>

	<!-- pins -->
	{#each pins as p (p.id)}
		{@const hit = hl?.hit.includes(p.id) ?? false}
		<circle
			cx={p.x}
			cy={p.y}
			r={hit ? pinR + 1.5 : pinR}
			fill={hit ? 'var(--clt-ball)' : 'var(--clt-pin)'}
			opacity={hit ? (hl?.fade ?? 1) : 0.9}
		/>
	{/each}

	<!-- bins -->
	<rect
		x={left}
		y={BIN_TOP}
		width={right - left}
		height={BIN_BOT - BIN_TOP}
		fill="var(--clt-bin)"
		opacity="0.06"
	/>
	{#each Array.from({ length: rows + 2 }, (_, k) => k) as k (k)}
		<line
			x1={left + k * dx}
			x2={left + k * dx}
			y1={BIN_TOP}
			y2={BIN_BOT}
			stroke="var(--stage-line)"
			stroke-width="1"
			opacity="0.7"
		/>
	{/each}
	<line
		x1={left - 6}
		x2={right + 6}
		y1={BIN_BOT}
		y2={BIN_BOT}
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>

	{#if hl?.done}
		<rect
			x={binX(hl.bin) - dx / 2 + 1}
			y={BIN_TOP}
			width={dx - 2}
			height={BIN_BOT - BIN_TOP}
			fill="var(--clt-ball)"
			opacity={0.14 * hl.fade}
		/>
	{/if}

	{#if stacks}
		{#each stackBalls as b (b.id)}
			<circle cx={b.x} cy={b.y} r={Math.min(ballR, unit / 2) - 0.4} fill="var(--clt-bin)" />
		{/each}
	{:else}
		{#each counts as c, k (k)}
			<rect
				x={binX(k) - dx * 0.4}
				y={BIN_BOT - c * unit}
				width={dx * 0.8}
				height={c * unit}
				rx="2"
				fill="var(--clt-bin)"
				opacity="0.85"
			/>
		{/each}
	{/if}

	<!-- expected shape (binomial) and normal curve -->
	{#if expectedAmt > 0}
		<g opacity={expectedAmt}>
			{#if whyAmt.current > 0.01}
				<path
					d={normalPath}
					fill="none"
					stroke="var(--clt-bell)"
					stroke-width="2.5"
					opacity={whyAmt.current}
				/>
			{/if}
			<path
				d={expectedPath}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity="0.75"
			/>
			{#each expectedPts as p (p.k)}
				<circle cx={p.x} cy={p.y} r="2.5" fill="var(--stage-ink)" opacity="0.8" />
			{/each}
		</g>
	{/if}

	<!-- bin numbers = number of right bounces -->
	{@render txt(left - 10, 558, 'rights', 11, { anchor: 'end', muted: true })}
	{#each binIds as k (k)}
		{@render txt(binX(k), 558, String(k), 11, {
			anchor: 'middle',
			muted: hlBin !== k,
			color: hlBin === k ? 'var(--clt-ball)' : undefined,
			weight: hlBin === k ? 700 : 500
		})}
	{/each}
	{#if whyAmt.current > 0.01}
		<g opacity={whyAmt.current}>
			{#each pathLabels as l (l.k)}
				{@render txt(binX(l.k), 580, l.text, 12, { anchor: 'middle', weight: 600 })}
			{/each}
		</g>
	{/if}

	<!-- the traced ball (why) -->
	{#if hl}
		<g opacity={hl.fade * whyAmt.current}>
			<path
				d={hl.trail}
				fill="none"
				stroke="var(--clt-ball)"
				stroke-width="2.5"
				stroke-linejoin="round"
				opacity="0.7"
			/>
			{#if !hl.done}
				<circle
					cx={hl.x}
					cy={hl.y}
					r={ballR + 4}
					fill="none"
					stroke="var(--clt-ball)"
					stroke-width="1.5"
				/>
				<circle
					cx={hl.x}
					cy={hl.y}
					r={ballR + 1}
					fill="var(--clt-ball)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		</g>
	{/if}

	<!-- balls in flight -->
	{#each inFlight as b (b.i)}
		<circle cx={b.x} cy={b.y} r={ballR} fill="var(--clt-ball)" opacity={b.o} />
	{/each}

	<!-- panel -->
	<g>
		{@render txt(PL, 56, 'balls dropped', 13, { muted: true })}
		{@render txt(PL, 90, fmt(released), 30, { weight: 600, tabular: true })}
		{@render txt(PL, 118, `${rows} rows of pins → ${rows + 1} bins`, 13)}
		{@render txt(PL, 137, 'bin = number of bounces to the right', 12, { muted: true })}

		<g opacity={expectedAmt}>
			<line
				x1={PL}
				x2={PL + 26}
				y1={172}
				y2={172}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity="0.75"
			/>
			<circle cx={PL + 13} cy={172} r="2.5" fill="var(--stage-ink)" />
			{@render txt(PL + 36, 176, `expected shape for ${fmt(landed)} balls`, 12)}
		</g>
		{#if whyAmt.current > 0.01}
			<g opacity={whyAmt.current * expectedAmt}>
				<line x1={PL} x2={PL + 26} y1={196} y2={196} stroke="var(--clt-bell)" stroke-width="2.5" />
				{@render txt(PL + 36, 200, 'the normal (bell) curve', 12)}
			</g>
		{/if}

		{#if hl}
			<g opacity={whyAmt.current}>
				{@render txt(PL, 250, 'one ball’s bounces, top to bottom', 13, { muted: true })}
				{#each hl.letters as l (l.r)}
					{@render txt(
						PL + (l.r % perRow) * 24,
						282 + Math.floor(l.r / perRow) * 26,
						l.shown ? l.ch : '·',
						17,
						{
							weight: 700,
							color: l.ch === 'R' ? 'var(--clt-ball)' : 'var(--stage-ink-muted)',
							opacity: l.shown ? 1 : 0.4
						}
					)}
				{/each}
				{@render txt(
					PL,
					282 + letterRows * 26 + 10,
					hl.done
						? `${hl.bin} right${hl.bin === 1 ? '' : 's'} → bin ${hl.bin}`
						: `${hl.rightsSoFar} right${hl.rightsSoFar === 1 ? '' : 's'} so far`,
					16,
					{ weight: 600, color: 'var(--clt-ball)' }
				)}
				{@render txt(PL, 282 + letterRows * 26 + 32, 'number of rights = bin', 12, {
					muted: true
				})}

				{@render txt(PL, 436, 'An end bin needs every bounce to go', 12)}
				{@render txt(PL, 454, `the same way: 1 path out of ${fmt(2 ** rows)}.`, 12)}
				{@render txt(PL, 478, 'The middle bin can be reached by', 12)}
				{@render txt(PL, 496, `${fmt(paths(Math.floor(rows / 2)))} different paths.`, 12)}
			</g>
		{/if}
	</g>
</g>
