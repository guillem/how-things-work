<script lang="ts">
	/**
	 * Grover's search, simulated on the state vector.
	 *
	 * Phases (`step.hints.phase`):
	 *   oracle   — three qubits after H on each: eight equal amplitudes; at t = 1–2 s the
	 *              oracle flips the marked one's sign. The probabilities below are those of
	 *              the state before and after, and do not move. "Measure" samples one string
	 *              (seeded by the press number).
	 *   amplify  — `ops` operations (oracle, diffusion, …) applied; the bars glide (Tween);
	 *              the dashed line is the mean of the amplitudes, which the diffusion reflects
	 *              them about (and keeps). "Measure" as above.
	 *   rotation — `gn` qubits: the state in the plane of "marked" and "the rest", one arrow
	 *              per iteration up to `iters`, and P(marked) against the number of
	 *              iterations: dots simulated, the curve sin²((2k + 1)θ).
	 *   speedup  — questions needed for N = 2ⁿ: (N + 1)/2 by trial and error, the best
	 *              number of Grover iterations, on a log axis; and where quantum computers
	 *              help, and where they don't.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, rng, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bestIterations,
		classicalTries,
		diffuse,
		grover,
		label,
		meanAmplitude,
		measure,
		oracle,
		probabilities,
		uniform
	} from '../qubits';
	import T from './T.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'oracle'));
	const isBars = $derived(phase === 'oracle' || phase === 'amplify');
	const marked = $derived(clamp(Math.round(Number(params.marked ?? 5)), 0, 7));
	const ops = $derived(phase === 'amplify' ? clamp(Math.round(Number(params.ops ?? 0)), 0, 6) : 1);

	// ---- three qubits: the bars ------------------------------------------------------------
	const psi = $derived(grover(3, marked, ops));
	// The oracle step plays the flip at t = 1–2 s.
	const flip = $derived(phase === 'oracle' ? (reduced ? 1 : smoothstep(1, 2, t)) : 1);
	const target = $derived.by(() => {
		const a = Array.from(psi.re);
		if (phase === 'oracle') a[marked] = (1 - 2 * flip) * Math.abs(a[marked]);
		return a;
	});
	const amps = Tween.of(() => target, { duration: () => (reduced ? 0 : 800), easing: cubicInOut });
	const probs = $derived(Array.from(probabilities(psi)));
	const mean = $derived(meanAmplitude(psi));
	const pMarked = $derived(probs[marked]);

	// measurements
	let results = $state<{ key: string; list: number[] }>({ key: '', list: [] });
	const key = $derived(`${phase}|${marked}|${ops}`);
	$effect(() => {
		const c = Number(params.groverMeasure ?? 0);
		untrack(() => {
			const seen = Number(params['qc:groverSeen'] ?? 0);
			if (c === seen) return;
			setParam('qc:groverSeen', c);
			if (!isBars) return;
			const list = results.key === key ? [...results.list] : [];
			for (let i = seen; i < c; i++) list.push(measure(psi, rng(4241 * (i + 1))()).outcome);
			results = { key, list: list.slice(-10) };
		});
	});
	const shownResults = $derived(results.key === key ? results.list : []);
	const lastResult = $derived(shownResults.length ? shownResults[shownResults.length - 1] : null);

	// geometry of the bars
	const BX = (k: number) => 90 + k * 68;
	const BW = 44;
	const ZERO = 300;
	const AMP_PX = 200; // px per unit amplitude
	const PROB_Y = 560;
	const PROB_PX = 90;

	const opName = (i: number) => (i === 0 ? 'H' : i % 2 === 1 ? 'oracle' : 'diffusion');

	// ---- rotation ------------------------------------------------------------------------------
	const gn = $derived(clamp(Math.round(Number(params.gn ?? 4)), 2, 10));
	const N = $derived(2 ** gn);
	const best = $derived(bestIterations(N));
	const kMax = $derived(2 * best + 2);
	const k = $derived(clamp(Math.round(Number(params.iters ?? 1)), 0, kMax));
	const theta = $derived(Math.asin(1 / Math.sqrt(N)));
	/** The simulated run: for each iteration, the marked amplitude and one other's. */
	const sim = $derived.by(() => {
		if (phase !== 'rotation') return [] as { m: number; o: number; p: number }[];
		let s = uniform(gn);
		const out: { m: number; o: number; p: number }[] = [];
		for (let i = 0; i <= kMax; i++) {
			out.push({ m: s.re[0], o: s.re[1], p: s.re[0] ** 2 + s.im[0] ** 2 });
			s = diffuse(oracle(s, 0));
		}
		return out;
	});
	const RC = { x: 215, y: 330, r: 175 };
	const angleOf = (e: { m: number; o: number }) => Math.atan2(e.m, e.o * Math.sqrt(N - 1));
	const PP = { x0: 470, x1: 920, y0: 80, y1: 400 };
	const ppx = (i: number) => PP.x0 + (i / kMax) * (PP.x1 - PP.x0);
	const ppy = (p: number) => PP.y1 - p * (PP.y1 - PP.y0);
	const theory = $derived.by(() => {
		if (phase !== 'rotation') return '';
		let d = '';
		for (let i = 0; i <= 200; i++) {
			const kk = (i / 200) * kMax;
			d += `${i ? 'L' : 'M'}${ppx(kk).toFixed(1)} ${ppy(Math.sin((2 * kk + 1) * theta) ** 2).toFixed(1)}`;
		}
		return d;
	});
	const kTween = Tween.of(() => k, { duration: () => (reduced ? 0 : 600), easing: cubicInOut });

	// ---- speedup -------------------------------------------------------------------------------
	const bits = $derived(clamp(Math.round(Number(params.bits ?? 20)), 4, 64));
	const SP = { x0: 90, x1: 520, y0: 70, y1: 470 };
	const LOGMAX = 20;
	const spx = (n: number) => SP.x0 + ((n - 4) / 60) * (SP.x1 - SP.x0);
	const spy = (q: number) => SP.y1 - (clamp(Math.log10(q), 0, LOGMAX) / LOGMAX) * (SP.y1 - SP.y0);
	const groverQ = (n: number) => bestIterations(2 ** n);
	const lines = $derived.by(() => {
		if (phase !== 'speedup') return { c: '', g: '' };
		let c = '';
		let g = '';
		for (let n = 4; n <= 64; n++) {
			c += `${n > 4 ? 'L' : 'M'}${spx(n).toFixed(1)} ${spy(classicalTries(2 ** n)).toFixed(1)}`;
			g += `${n > 4 ? 'L' : 'M'}${spx(n).toFixed(1)} ${spy(groverQ(n)).toFixed(1)}`;
		}
		return { c, g };
	});
	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const big = (v: number) => {
		if (v < 1e6) return Math.round(v).toLocaleString('en-US');
		const e = Math.floor(Math.log10(v));
		return `${(v / 10 ** e).toFixed(1)} × 10${String(e)
			.split('')
			.map((c) => SUP[Number(c)])
			.join('')}`;
	};
	const TABLE = [
		{
			task: 'Factoring (Shor)',
			gain: 'huge: polynomial time',
			more: 'against super-polynomial for the best known classical method',
			level: 3
		},
		{
			task: 'Simulating molecules',
			gain: 'large for many problems',
			more: '(expected; the target of much research)',
			level: 2.5
		},
		{
			task: 'Unstructured search (Grover)',
			gain: 'quadratic: √N against N',
			more: 'and proven to be the best possible',
			level: 1.5
		},
		{ task: 'Sorting', gain: 'none', more: 'about N log N comparisons on any computer', level: 0 },
		{
			task: 'Most everyday computing',
			gain: 'none',
			more: 'and far slower, noisier hardware',
			level: 0
		}
	];

	const pct = (p: number) => `${Math.round(p * 100 + 1e-9)}%`;
	const pct1 = (p: number) => (p > 0.9995 ? '100%' : `${(p * 100).toFixed(1)}%`);
	const f2 = (v: number) => (Math.abs(v) < 5e-3 ? '0' : v.toFixed(2).replace('-', '−'));
</script>

<g>
	{#if isBars}
		<!-- ============ circuit ============ -->
		<Readout id="circ-ttl">
			<T x={30} y={40} text="the circuit (one line per qubit)" size={13} muted />
		</Readout>
		{#each [0, 1, 2] as q (q)}
			<line x1={50} x2={640} y1={62 + q * 16} y2={62 + q * 16} stroke="var(--stage-ink-muted)" />
		{/each}
		{#each Array.from({ length: (phase === 'amplify' ? 6 : 1) + 1 }, (_, i) => i) as i (i)}
			{@const done = i <= ops}
			{@const name = opName(i)}
			<rect
				x={60 + i * 82}
				y={52}
				width={72}
				height={52}
				rx="5"
				fill="var(--surface)"
				stroke={i === ops
					? name === 'oracle'
						? 'var(--qc-neg)'
						: 'var(--qc-state)'
					: 'var(--stage-line)'}
				stroke-width={i === ops ? 2.5 : 1.2}
				opacity={done ? 1 : 0.35}
			/>
			<text
				x={96 + i * 82}
				y={83}
				text-anchor="middle"
				font-weight="700"
				opacity={done ? 1 : 0.4}
				style:font-size="13px">{name === 'H' ? 'H H H' : name}</text
			>
		{/each}

		<!-- ============ amplitudes ============ -->
		<Readout id="amp-ttl">
			<T x={30} y={140} text="amplitudes" size={13} weight={600} muted />
		</Readout>
		<line x1={70} x2={640} y1={ZERO} y2={ZERO} stroke="var(--stage-line)" stroke-width="1.5" />
		{#each [0, 1, 2, 3, 4, 5, 6, 7] as s (s)}
			{@const a = amps.current[s] ?? 0}
			{@const isM = s === marked}
			<rect
				x={BX(s)}
				y={a >= 0 ? ZERO - a * AMP_PX : ZERO}
				width={BW}
				height={Math.max(0.5, Math.abs(a) * AMP_PX)}
				rx="3"
				fill={isM ? 'var(--qc-marked)' : 'var(--qc-bar)'}
				opacity={isM ? 1 : 0.75}
			/>
			<Readout id="av{s}">
				<T
					x={BX(s) + BW / 2}
					y={a >= 0 ? ZERO - a * AMP_PX - 8 : ZERO - 8}
					text={f2(a)}
					size={11}
					anchor="middle"
					color={a < -0.005 ? 'var(--qc-neg)' : undefined}
					muted={a >= -0.005}
				/>
			</Readout>
			<T
				x={BX(s) + BW / 2}
				y={412}
				text={label(3, s)}
				size={13}
				weight={isM ? 700 : 500}
				anchor="middle"
				color={isM ? 'var(--qc-marked)' : undefined}
			/>
			<!-- probability -->
			<rect
				x={BX(s)}
				y={PROB_Y - probs[s] * PROB_PX}
				width={BW}
				height={Math.max(0.5, probs[s] * PROB_PX)}
				rx="2"
				fill={isM ? 'var(--qc-marked)' : 'var(--qc-bar)'}
				opacity={isM ? 0.9 : 0.55}
			/>
		{/each}
		<line x1={70} x2={640} y1={PROB_Y} y2={PROB_Y} stroke="var(--stage-line)" />
		<Readout id="prob-ttl">
			<T x={30} y={440} text="probabilities (amplitude²)" size={13} weight={600} muted />
		</Readout>
		{#if phase === 'amplify'}
			<line
				x1={70}
				x2={640}
				y1={ZERO - mean * AMP_PX}
				y2={ZERO - mean * AMP_PX}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
				opacity={0.8}
			/>
			<Readout id="mean-l">
				<T x={644} y={ZERO - mean * AMP_PX + 4} text="mean" size={11} muted />
			</Readout>
		{/if}

		<!-- ============ panel ============ -->
		<Readout
			id="pm"
			order={1}
			label="Chance of finding {label(3, marked)}"
			value={pct1(pMarked)}
			color="var(--qc-marked)"
		>
			<T x={700} y={150} text="chance a measurement finds" size={13} muted />
			<T x={700} y={168} text="the marked string {label(3, marked)}" size={13} muted />
			<T x={700} y={206} text={pct1(pMarked)} size={32} weight={700} color="var(--qc-marked)" />
			<T
				x={700}
				y={230}
				text={phase === 'oracle'
					? 'the same as a guess: 1 in 8'
					: ops === 0
						? '1 in 8: a guess'
						: ''}
				size={12}
				muted
			/>
		</Readout>
		{#if phase === 'oracle'}
			<Readout
				id="flip"
				order={2}
				label="The oracle"
				value="flipped the sign of {label(3, marked)}: no probability changed"
			>
				<T x={700} y={290} text="the oracle flipped one sign;" size={13} />
				<T x={700} y={308} text="no probability changed" size={13} weight={600} />
				<T x={700} y={326} text="(−a)² = a²" size={13} muted />
			</Readout>
		{:else}
			<Readout id="op" order={2} label="Operations" value="{ops}: {opName(ops)}">
				<T x={700} y={290} text="after {ops} operation{ops === 1 ? '' : 's'}:" size={13} muted />
				<T
					x={700}
					y={310}
					text={ops === 0 ? 'H on every qubit' : `${opName(ops)} (iteration ${Math.ceil(ops / 2)})`}
					size={14}
					weight={600}
				/>
				<T
					x={700}
					y={330}
					text={ops === 0
						? 'all eight equal'
						: ops % 2 === 1
							? 'marked sign flipped; mean dips'
							: 'reflected about the mean'}
					size={12}
					muted
				/>
			</Readout>
		{/if}
		<Readout
			id="meas"
			order={3}
			label="Measured"
			value={lastResult === null
				? 'press Measure'
				: `${label(3, lastResult)} ${lastResult === marked ? '(right)' : '(wrong)'}`}
		>
			<T x={700} y={392} text="measure: one string at random" size={13} muted />
			{#if lastResult === null}
				<T x={700} y={424} text="press Measure" size={15} weight={600} muted />
			{:else}
				<T
					x={700}
					y={428}
					text="{label(3, lastResult)} {lastResult === marked ? '✓ right' : '✗ wrong'}"
					size={22}
					weight={700}
					color={lastResult === marked ? 'var(--qc-marked)' : 'var(--qc-neg)'}
				/>
			{/if}
			{#each shownResults as r, i (i)}
				<rect
					x={700 + (i % 5) * 46}
					y={446 + Math.floor(i / 5) * 30}
					width="40"
					height="24"
					rx="4"
					fill={r === marked ? 'var(--qc-marked)' : 'var(--qc-bar)'}
					opacity={i === shownResults.length - 1 ? 1 : 0.6}
				/>
				<text
					x={720 + (i % 5) * 46}
					y={463 + Math.floor(i / 5) * 30}
					text-anchor="middle"
					font-weight="700"
					style:font-size="12px"
					style:fill="#fff">{label(3, r)}</text
				>
			{/each}
		</Readout>
	{/if}

	{#if phase === 'rotation' && sim.length}
		<!-- ============ the plane ============ -->
		{@const kk = kTween.current}
		<circle
			cx={RC.x}
			cy={RC.y}
			r={RC.r}
			fill="none"
			stroke="var(--stage-grid)"
			stroke-width="1.2"
		/>
		<line
			x1={RC.x - RC.r - 10}
			x2={RC.x + RC.r + 14}
			y1={RC.y}
			y2={RC.y}
			stroke="var(--stage-line)"
		/>
		<line
			x1={RC.x}
			x2={RC.x}
			y1={RC.y + RC.r + 10}
			y2={RC.y - RC.r - 14}
			stroke="var(--stage-line)"
		/>
		<Readout id="ax-m">
			<T
				x={RC.x + 8}
				y={RC.y - RC.r - 18}
				text="the marked string"
				size={13}
				weight={700}
				color="var(--qc-marked)"
			/>
		</Readout>
		<Readout id="ax-r">
			<T
				x={RC.x + RC.r + 6}
				y={RC.y + 22}
				text="the rest"
				size={13}
				weight={700}
				anchor="end"
				color="var(--qc-bar)"
			/>
			<T
				x={RC.x + RC.r + 6}
				y={RC.y + 38}
				text="(even mix of N − 1)"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
		{#each sim.slice(0, k + 1) as e, i (i)}
			{@const a = angleOf(e)}
			{@const isNow = i === k}
			{#if !isNow}
				<line
					x1={RC.x}
					y1={RC.y}
					x2={RC.x + Math.cos(a) * RC.r}
					y2={RC.y - Math.sin(a) * RC.r}
					stroke="var(--qc-state)"
					stroke-width="1.2"
					opacity={0.35}
				/>
			{/if}
		{/each}
		{@const i0 = Math.floor(kk)}
		{@const a0 = angleOf(sim[Math.min(i0, sim.length - 1)])}
		{@const a1 = angleOf(sim[Math.min(i0 + 1, sim.length - 1)])}
		{@const aNow = a0 + (a1 - a0) * (kk - i0)}
		<line
			x1={RC.x}
			y1={RC.y}
			x2={RC.x + Math.cos(aNow) * RC.r}
			y2={RC.y - Math.sin(aNow) * RC.r}
			stroke="var(--qc-state)"
			stroke-width="4"
			stroke-linecap="round"
		/>
		<circle
			cx={RC.x + Math.cos(aNow) * RC.r}
			cy={RC.y - Math.sin(aNow) * RC.r}
			r="7"
			fill="var(--qc-state)"
		/>
		<!-- the projection on "marked": its length² is the chance -->
		<line
			x1={RC.x + Math.cos(aNow) * RC.r}
			y1={RC.y - Math.sin(aNow) * RC.r}
			x2={RC.x}
			y2={RC.y - Math.sin(aNow) * RC.r}
			stroke="var(--qc-marked)"
			stroke-dasharray="4 4"
		/>
		<line
			x1={RC.x}
			y1={RC.y}
			x2={RC.x}
			y2={RC.y - Math.sin(aNow) * RC.r}
			stroke="var(--qc-marked)"
			stroke-width="5"
			opacity="0.7"
		/>
		<Readout
			id="theta"
			order={1}
			label="N, θ"
			value="N = {N}, θ = {((theta * 180) / Math.PI).toFixed(1)}°, each round turns 2θ"
		>
			<T
				x={30}
				y={40}
				text="N = {N}: starts θ = {((theta * 180) / Math.PI).toFixed(1)}° above “the rest”"
				size={13}
			/>
			<T x={30} y={58} text="each round (oracle + diffusion) turns it 2θ" size={13} muted />
		</Readout>

		<!-- ============ P against k ============ -->
		<line x1={PP.x0} x2={PP.x1} y1={PP.y1} y2={PP.y1} stroke="var(--stage-line)" />
		<line x1={PP.x0} x2={PP.x0} y1={PP.y0} y2={PP.y1} stroke="var(--stage-line)" />
		{#each [0, 0.5, 1] as p (p)}
			<line x1={PP.x0} x2={PP.x1} y1={ppy(p)} y2={ppy(p)} stroke="var(--stage-grid)" />
			<Readout id="ppy{p}">
				<T x={PP.x0 - 6} y={ppy(p) + 4} text={pct(p)} size={11} anchor="end" muted />
			</Readout>
		{/each}
		{#each [0, best, kMax] as v (v)}
			<Readout id="ppx{v}">
				<T x={ppx(v)} y={PP.y1 + 16} text={String(v)} size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<Readout id="pp-ttl">
			<T
				x={PP.x0}
				y={PP.y0 - 14}
				text="chance of the right answer, against the number of rounds"
				size={12}
				muted
			/>
		</Readout>
		<path d={theory} fill="none" stroke="var(--qc-marked)" stroke-width="1.5" opacity="0.6" />
		{#each sim as e, i (i)}
			<circle
				cx={ppx(i)}
				cy={ppy(e.p)}
				r={i === k ? 7 : kMax > 30 ? 2.5 : 4}
				fill={i <= k ? 'var(--qc-marked)' : 'var(--stage-bg)'}
				stroke="var(--qc-marked)"
				stroke-width="1.5"
			/>
		{/each}
		<line
			x1={ppx(best)}
			x2={ppx(best)}
			y1={PP.y0}
			y2={PP.y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Readout id="best-l">
			<T x={ppx(best) + 6} y={PP.y0 + 12} text="best: {best} (≈ π/4 · √N)" size={12} />
		</Readout>
		<Readout
			id="pk"
			order={2}
			label="After {k} round{k === 1 ? '' : 's'}"
			value="P = {pct1(sim[k].p)}"
			color="var(--qc-marked)"
		>
			<T x={PP.x0} y={455} text="after {k} round{k === 1 ? '' : 's'}:" size={13} muted />
			<T
				x={PP.x0}
				y={488}
				text="P = {pct1(sim[k].p)}"
				size={26}
				weight={700}
				color="var(--qc-marked)"
			/>
			<T
				x={PP.x0 + 170}
				y={486}
				text={k < best
					? 'keep going'
					: k === best
						? 'stop here and measure'
						: 'overshot: it rotates past'}
				size={14}
				weight={600}
			/>
		</Readout>
		<Readout
			id="cmp"
			order={3}
			label="Trial and error"
			value="{classicalTries(N)} tries on average"
		>
			<T
				x={PP.x0}
				y={530}
				text="trial and error: {classicalTries(N)} tries on average; Grover: {best} rounds"
				size={13}
				muted
			/>
			<T
				x={PP.x0}
				y={550}
				text="dots: simulated state vector · line: sin²((2k + 1)θ)"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	{#if phase === 'speedup'}
		<!-- ============ questions against n ============ -->
		<line x1={SP.x0} x2={SP.x1} y1={SP.y1} y2={SP.y1} stroke="var(--stage-line)" />
		<line x1={SP.x0} x2={SP.x0} y1={SP.y0} y2={SP.y1} stroke="var(--stage-line)" />
		{#each [0, 5, 10, 15, 20] as e (e)}
			<line x1={SP.x0} x2={SP.x1} y1={spy(10 ** e)} y2={spy(10 ** e)} stroke="var(--stage-grid)" />
			<Readout id="spy{e}">
				<T
					x={SP.x0 - 6}
					y={spy(10 ** e) + 4}
					text={e === 0
						? '1'
						: `10${String(e)
								.split('')
								.map((c) => SUP[Number(c)])
								.join('')}`}
					size={11}
					anchor="end"
					muted
				/>
			</Readout>
		{/each}
		{#each [4, 20, 40, 64] as n (n)}
			<Readout id="spx{n}">
				<T x={spx(n)} y={SP.y1 + 16} text="n = {n}" size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<Readout id="sp-ttl">
			<T
				x={SP.x0}
				y={SP.y0 - 30}
				text="questions to the oracle to find one item among N = 2ⁿ"
				size={13}
				muted
			/>
		</Readout>
		<path d={lines.c} fill="none" stroke="var(--qc-one)" stroke-width="2.5" />
		<path d={lines.g} fill="none" stroke="var(--qc-marked)" stroke-width="2.5" />
		<line
			x1={spx(bits)}
			x2={spx(bits)}
			y1={SP.y0}
			y2={SP.y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<circle cx={spx(bits)} cy={spy(classicalTries(2 ** bits))} r="6" fill="var(--qc-one)" />
		<circle cx={spx(bits)} cy={spy(groverQ(bits))} r="6" fill="var(--qc-marked)" />
		<Readout
			id="sp-c"
			order={1}
			label="Trial and error"
			value="{big(classicalTries(2 ** bits))} questions on average"
			color="var(--qc-one)"
		>
			<T
				x={spx(40)}
				y={spy(classicalTries(2 ** 40)) - 22}
				text="trial and error, (N + 1)/2"
				size={12}
				weight={600}
				color="var(--qc-one)"
				anchor="end"
			/>
		</Readout>
		<Readout
			id="sp-g"
			order={2}
			label="Grover"
			value="{big(groverQ(bits))} questions"
			color="var(--qc-marked)"
		>
			<T
				x={spx(40)}
				y={spy(groverQ(40)) + 26}
				text="Grover, ≈ (π/4)√N"
				size={12}
				weight={600}
				color="var(--qc-marked)"
			/>
		</Readout>
		<Readout id="sp-n">
			<T
				x={SP.x0 + 8}
				y={SP.y0 - 8}
				text="n = {bits}: {big(classicalTries(2 ** bits))} against {big(groverQ(bits))}"
				size={13}
				weight={600}
			/>
		</Readout>

		<!-- ============ where it helps ============ -->
		<Readout id="tbl-ttl">
			<T
				x={560}
				y={40}
				text="speed-up on a quantum computer (roughly)"
				size={13}
				weight={600}
				muted
			/>
		</Readout>
		{#each TABLE as row, i (row.task)}
			{@const y = 80 + i * 88}
			<Readout id="row{i}">
				<T x={560} {y} text={row.task} size={14} weight={700} />
				<T
					x={560}
					y={y + 20}
					text={row.gain}
					size={13}
					color={row.level === 0 ? 'var(--qc-neg)' : 'var(--qc-marked)'}
					weight={600}
				/>
				<T x={560} y={y + 38} text={row.more} size={11} muted />
				{#each [0, 1, 2] as d (d)}
					<circle
						cx={880 + d * 18}
						cy={y + 10}
						r="6"
						fill={row.level > d ? 'var(--qc-marked)' : 'none'}
						fill-opacity={row.level > d && row.level < d + 1 ? 0.45 : 1}
						stroke={row.level > d ? 'var(--qc-marked)' : 'var(--stage-line)'}
						stroke-width="1.5"
					/>
				{/each}
			</Readout>
		{/each}
		<Readout
			id="gains"
			order={3}
			label="Speed-up on a quantum computer"
			value="factoring: huge · molecules: large (expected) · search: quadratic · sorting and most tasks: none"
		/>
		<Readout id="take">
			<T
				x={SP.x0}
				y={530}
				text="Amplitudes are steered so that wrong answers cancel and the right one adds up;"
				size={13}
				weight={600}
			/>
			<T
				x={SP.x0}
				y={550}
				text="a big gain for a few problems, little or none for most."
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
