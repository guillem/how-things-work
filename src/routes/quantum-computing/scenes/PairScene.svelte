<script lang="ts">
	/**
	 * Two qubits, A and B: their four amplitudes, each qubit's own Bloch vector (from the
	 * partial trace, so it shrinks when they are entangled), the circuit so far and, on the
	 * Bell step, measurements along two axes.
	 *
	 * Phases (`step.hints.phase`):
	 *   register — H and X on either qubit; the state is rebuilt from the list of gates kept
	 *              in `params['qc:ops-register']`. The qubit-count slider reads out how many
	 *              amplitudes (and bytes) a classical simulation of n qubits stores.
	 *   entangle — H on A, CNOT, X on B on their own list of gates; "100 pairs" measures
	 *              fresh copies (seeded by the press number) and adds to the 00/01/10/11
	 *              counts while the circuit stays the same.
	 *   bell     — the pair (|00⟩ + |11⟩)/√2, A measured along z or x (0° or 90°), B along
	 *              an axis at the chosen angle from z in the x–z plane: pairs are measured
	 *              at 25 a second (seeded), the agreement is plotted against the angle
	 *              between the axes on the cos²(angle/2) curve, and the CHSH number S is
	 *              estimated from 2000 simulated pairs at each of the four settings, whose
	 *              correlations are listed with the one being measured picked out.
	 *
	 * Animation: the amplitudes and Bloch arrows glide to a new state (Tween, 600 ms); on
	 * the Bell step the pairs keep coming. Reduced motion: 1000 pairs at once.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		GATES,
		apply,
		basis,
		bellPair,
		bloch,
		chsh,
		cnot,
		correlation,
		label,
		pairOutcomes,
		pick,
		tally,
		type State,
		type Vec3
	} from '../qubits';
	import { rng } from '#lib/draw/index.ts';
	import Sphere from './Sphere.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'register'));
	const isBell = $derived(phase === 'bell');

	// ---- the circuit ----------------------------------------------------------------------
	type Op = 'hA' | 'hB' | 'xA' | 'xB' | 'cnotAB';
	const ACTIONS = ['hA', 'hB', 'xA', 'xB', 'cnotAB', 'pairReset', 'pairRuns'] as const;
	const opsKey = $derived(`qc:ops-${phase}`);
	const ops = $derived(
		String(params[opsKey] ?? '')
			.split(',')
			.filter(Boolean) as Op[]
	);
	const run = (list: Op[]): State =>
		list.reduce((s, op) => {
			if (op === 'hA') return apply(s, GATES.H, 0);
			if (op === 'hB') return apply(s, GATES.H, 1);
			if (op === 'xA') return apply(s, GATES.X, 0);
			if (op === 'xB') return apply(s, GATES.X, 1);
			return cnot(s, 0, 1);
		}, basis(2));
	const psi = $derived(isBell ? bellPair() : run(ops));

	let runs = $state({ key: '', counts: [0, 0, 0, 0] });

	$effect(() => {
		const counts = ACTIONS.map((k) => Number(params[k] ?? 0));
		untrack(() => {
			const stored = String(params['qc:pairSeen'] ?? '')
				.split(',')
				.map(Number);
			const seen = ACTIONS.map((_, i) => (Number.isFinite(stored[i]) ? stored[i] : 0));
			if (counts.every((c, i) => c === seen[i])) return;
			setParam('qc:pairSeen', counts.join(','));
			if (isBell) return; // the Bell step measures on its own
			let list = [...ops];
			counts.forEach((c, i) => {
				for (let p = 0; p < c - seen[i]; p++) {
					const key = ACTIONS[i];
					if (key === 'pairReset') list = [];
					else if (key === 'pairRuns') {
						const k = list.join(',');
						const add = tally(run(list), 100, 97 * (seen[i] + p + 1) + 3);
						const base = runs.key === `${phase}|${k}` ? runs.counts : [0, 0, 0, 0];
						runs = { key: `${phase}|${k}`, counts: base.map((v, j) => v + add[j]) };
					} else list = [...list, key].slice(-12);
				}
			});
			setParam(opsKey, list.join(','));
		});
	});
	const runsHere = $derived(runs.key === `${phase}|${ops.join(',')}` ? runs.counts : [0, 0, 0, 0]);
	const runsN = $derived(runsHere.reduce((a, b) => a + b, 0));

	// ---- smooth display ---------------------------------------------------------------------
	const D = () => (reduced ? 0 : 600);
	const amps = Tween.of(() => [...psi.re, ...psi.im], { duration: D, easing: cubicInOut });
	const vA = Tween.of(() => bloch(psi, 0) as number[], { duration: D, easing: cubicInOut });
	const vB = Tween.of(() => bloch(psi, 1) as number[], { duration: D, easing: cubicInOut });
	const lenA = $derived(Math.hypot(...bloch(psi, 0)));
	const lenB = $derived(Math.hypot(...bloch(psi, 1)));
	const probs = $derived([0, 1, 2, 3].map((k) => amps.current[k] ** 2 + amps.current[k + 4] ** 2));
	const entangled = $derived(lenA < 0.999);

	// ---- text ----------------------------------------------------------------------------------
	const f2 = (v: number) => (Math.abs(v) < 5e-3 ? '0' : v.toFixed(2).replace('-', '−'));
	const ampText = (k: number) => {
		const re = psi.re[k];
		const im = psi.im[k];
		if (Math.abs(im) < 5e-3) return f2(re);
		if (Math.abs(re) < 5e-3) return `${f2(im)}i`;
		return `${f2(re)} ${im < 0 ? '−' : '+'} ${f2(Math.abs(im))}i`;
	};
	const ketText = $derived.by(() => {
		const parts: string[] = [];
		for (let k = 0; k < 4; k++) {
			if (psi.re[k] ** 2 + psi.im[k] ** 2 < 1e-6) continue;
			parts.push(`${ampText(k)}|${label(2, k)}⟩`);
		}
		return parts.join(' + ').replace(/\+ −/g, '− ');
	});
	const OP_TEXT: Record<Op, string> = {
		hA: 'H on A',
		hB: 'H on B',
		xA: 'X on A',
		xB: 'X on B',
		cnotAB: 'CNOT'
	};

	// ---- qubit count (register) -----------------------------------------------------------
	const nq = $derived(clamp(Math.round(Number(params.qubits ?? 2)), 1, 60));
	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const sci = (v: number) => {
		if (v < 1e6) return Math.round(v).toLocaleString('en-US');
		const e = Math.floor(Math.log10(v));
		const m = v / 10 ** e;
		return `${m.toFixed(1)} × 10${String(e)
			.split('')
			.map((c) => SUP[Number(c)])
			.join('')}`;
	};
	const bytes = (b: number) => {
		const units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB'];
		let i = 0;
		while (b >= 1000 && i < units.length - 1) {
			b /= 1000;
			i++;
		}
		return `${b < 10 && i > 0 ? b.toFixed(1) : Math.round(b)} ${units[i]}`;
	};

	// ---- Bell ------------------------------------------------------------------------------------
	const DEG = Math.PI / 180;
	const aDeg = $derived(String(params.aliceAxis ?? '0') === '90' ? 90 : 0);
	const a = $derived(aDeg * DEG);
	const bDeg = $derived(clamp(Number(params.bobAxis ?? 0), -90, 180));
	const b = $derived(bDeg * DEG);
	/** The angle between the two axes, 0–180°. */
	const between = $derived.by(() => {
		const d = Math.abs(bDeg - aDeg) % 360;
		return d > 180 ? 360 - d : d;
	});
	const RATE = 25;
	const MAX_PAIRS = 2000;
	// pairs restart when an axis turns: the start time is set when A's or B's axis changes
	// (not on the first setting seen), and drops back to 0 when the clock is scrubbed before it
	let t0 = $state(0);
	let seenAxes: string | null = null;
	$effect(() => {
		const axes = `${aDeg}|${bDeg}`;
		if (!isBell) return;
		untrack(() => {
			if (seenAxes !== null && seenAxes !== axes) t0 = t;
			seenAxes = axes;
		});
	});
	$effect(() => {
		if (t < untrack(() => t0)) t0 = 0;
	});
	const elapsed = $derived(isBell ? Math.max(0, t - t0) : 0);
	const nPairs = $derived(reduced ? 1000 : Math.min(MAX_PAIRS, Math.floor(elapsed * RATE)));
	const bellPairs = $derived.by(() => {
		if (!isBell) return [] as number[];
		const p = pairOutcomes(bellPair(), a, b);
		const r = rng(1000 + bDeg + 1000 * aDeg);
		const out: number[] = [];
		for (let i = 0; i < MAX_PAIRS; i++) out.push(pick(p, r()));
		return out;
	});
	const shownPairs = $derived(bellPairs.slice(0, nPairs));
	const agreeN = $derived(shownPairs.filter((k) => k === 0 || k === 3).length);
	const aliceZero = $derived(shownPairs.filter((k) => k < 2).length);
	const agreeExact = $derived((1 + correlation(bellPair(), a, b)) / 2);
	const S = $derived(isBell ? chsh(bellPair(), 2000, 42) : { S: 0, E: [0, 0, 0, 0] });
	// The four CHSH settings, in the order of S = E(a,b) + E(a,b′) + E(a′,b) − E(a′,b′), and
	// which one (if any) the axes are set to now.
	const SETTINGS = [
		{ a: 0, b: 45 },
		{ a: 0, b: -45 },
		{ a: 90, b: 45 },
		{ a: 90, b: -45 }
	];
	const current = $derived(SETTINGS.findIndex((st) => st.a === aDeg && st.b === bDeg));
	const deg = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`;
	const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;
	const eNow = $derived(nPairs ? (2 * agreeN - nPairs) / nPairs : 0);
	const SExact = 2 * Math.SQRT2;

	// plot of agreement against angle
	const PL = { x0: 500, x1: 920, y0: 70, y1: 300 };
	const px = (deg: number) => PL.x0 + (deg / 180) * (PL.x1 - PL.x0);
	const py = (p: number) => PL.y1 - p * (PL.y1 - PL.y0);
	const curve = $derived.by(() => {
		if (!isBell) return '';
		const s = bellPair();
		let d = '';
		for (let i = 0; i <= 72; i++) {
			const deg = i * 2.5;
			const p = (1 + correlation(s, 0, deg * DEG)) / 2;
			d += `${i ? 'L' : 'M'}${px(deg).toFixed(1)} ${py(p).toFixed(1)}`;
		}
		return d;
	});
	const last = $derived(shownPairs.slice(-16));
	const newest = $derived(reduced ? 1 : smoothstep(0, 0.25, (elapsed * RATE) % 1));

	const pct = (p: number) => `${Math.round(p * 100)}%`;
	const SBAR = { x0: 560, x1: 920, y: 520 };
	const sx = (v: number) => SBAR.x0 + (v / 3) * (SBAR.x1 - SBAR.x0);
</script>

<g>
	{#if !isBell}
		<!-- ============ circuit ============ -->
		<Readout id="circ-ttl">
			<Label anchor="start" x={30} y={40} text="the circuit so far" size={13} muted />
		</Readout>
		{#each [0, 1] as q (q)}
			<line
				x1={70}
				x2={500}
				y1={80 + q * 50}
				y2={80 + q * 50}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
			<Label
				x={60}
				y={85 + q * 50}
				text={q === 0 ? 'A |0⟩' : 'B |0⟩'}
				size={14}
				weight={700}
				anchor="end"
				color={q === 0 ? 'var(--qc-a)' : 'var(--qc-b)'}
			/>
		{/each}
		{#each ops.slice(-9) as op, i (i)}
			{@const x = 100 + i * 44}
			{#if op === 'cnotAB'}
				<line x1={x} x2={x} y1={80} y2={141} stroke="var(--stage-ink)" stroke-width="2" />
				<circle cx={x} cy={80} r="6" fill="var(--stage-ink)" />
				<circle
					cx={x}
					cy={130}
					r="11"
					fill="var(--surface)"
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				<line
					x1={x - 11}
					x2={x + 11}
					y1={130}
					y2={130}
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
			{:else}
				{@const y = op.endsWith('A') ? 80 : 130}
				<rect
					x={x - 15}
					y={y - 16}
					width="30"
					height="32"
					rx="4"
					fill="var(--surface)"
					stroke={op.endsWith('A') ? 'var(--qc-a)' : 'var(--qc-b)'}
					stroke-width="1.5"
				/>
				<text {x} y={y + 6} text-anchor="middle" font-weight="700" font-size="15"
					>{op[0].toUpperCase()}</text
				>
			{/if}
		{/each}
		{#if !ops.length}
			<Label anchor="start" x={100} y={170} text="press a gate button" size={12} muted />
		{/if}
		<Readout
			id="circ"
			order={1}
			label="Circuit"
			value={ops.length ? ops.map((o) => OP_TEXT[o]).join(', ') : '(no gates yet)'}
		/>

		<!-- ============ each qubit's own state ============ -->
		{#each [0, 1] as q (q)}
			{@const v = (q === 0 ? vA.current : vB.current) as Vec3}
			{@const len = q === 0 ? lenA : lenB}
			{@const cx = 135 + q * 250}
			<Sphere
				id="s{q}"
				{cx}
				cy={350}
				R={92}
				{v}
				labels="poles"
				color={q === 0 ? 'var(--qc-a)' : 'var(--qc-b)'}
			/>
			<Readout
				id="len{q}"
				order={4 + q}
				label="Bloch arrow of {q === 0 ? 'A' : 'B'}"
				value={len < 0.01 ? 'length 0: no state of its own' : `length ${len.toFixed(2)}`}
				color={q === 0 ? 'var(--qc-a)' : 'var(--qc-b)'}
			>
				<Label
					x={cx}
					y={490}
					text="qubit {q === 0 ? 'A' : 'B'} on its own"
					size={13}
					weight={700}
					anchor="middle"
					color={q === 0 ? 'var(--qc-a)' : 'var(--qc-b)'}
				/>
				<Label
					x={cx}
					y={508}
					text={len < 0.01 ? 'arrow length 0' : `arrow length ${len.toFixed(2)}`}
					size={12}
					anchor="middle"
					muted
				/>
			</Readout>
		{/each}
		<Readout
			id="verdict"
			order={3}
			label="The pair"
			value={entangled ? 'entangled' : 'a product state: each qubit has its own state'}
		>
			<Label
				x={260}
				y={556}
				text={entangled
					? 'entangled: neither qubit has a state of its own'
					: 'a product state: each qubit has a state of its own'}
				size={14}
				weight={600}
				anchor="middle"
				color={entangled ? 'var(--qc-axis)' : undefined}
			/>
		</Readout>

		<!-- ============ the four amplitudes ============ -->
		<Readout id="amp-ttl">
			<Label
				anchor="start"
				x={600}
				y={40}
				text="the four amplitudes (A's bit first)"
				size={13}
				muted
			/>
		</Readout>
		{#each [0, 1, 2, 3] as k (k)}
			{@const y = 80 + k * 62}
			{@const re = amps.current[k]}
			{@const im = amps.current[k + 4]}
			<Label anchor="start" x={600} y={y + 6} text="|{label(2, k)}⟩" size={16} weight={700} />
			<circle cx={672} cy={y} r="24" fill="none" stroke="var(--stage-grid)" />
			<line x1={648} x2={696} y1={y} y2={y} stroke="var(--stage-grid)" />
			{#if re * re + im * im > 1e-4}
				<line
					x1={672}
					y1={y}
					x2={672 + re * 24}
					y2={y - im * 24}
					stroke={re < -1e-3 ? 'var(--qc-neg)' : 'var(--qc-state)'}
					stroke-width="3"
					stroke-linecap="round"
				/>
			{/if}
			<rect
				x={712}
				y={y - 8}
				width="140"
				height="16"
				rx="3"
				fill="var(--stage-grid)"
				opacity="0.5"
			/>
			<rect x={712} y={y - 8} width={140 * probs[k]} height="16" rx="3" fill="var(--qc-state)" />
			<Readout id="a{k}">
				<Label
					anchor="start"
					x={860}
					y={y + 5}
					text="{ampText(k)} → {pct(psi.re[k] ** 2 + psi.im[k] ** 2)}"
					size={12}
				/>
			</Readout>
		{/each}
		<Readout id="ket" order={2} label="State" value={ketText}>
			<Label anchor="start" x={600} y={340} text={ketText} size={14} weight={600} />
		</Readout>

		{#if phase === 'register'}
			<Readout
				id="nq"
				order={6}
				label="{nq} qubits"
				value="{sci(2 ** nq)} amplitudes, {bytes(16 * 2 ** nq)} to store"
			>
				<Label
					anchor="start"
					x={600}
					y={400}
					text="{nq} qubit{nq > 1 ? 's' : ''}:"
					size={14}
					weight={600}
				/>
				<Label
					anchor="start"
					x={600}
					y={430}
					text="{sci(2 ** nq)} amplitudes"
					size={22}
					weight={700}
					color="var(--qc-state)"
				/>
				<Label
					anchor="start"
					x={600}
					y={456}
					text="{bytes(16 * 2 ** nq)} to store them (16 bytes each)"
					size={13}
				/>
				<Label
					anchor="start"
					x={600}
					y={490}
					text="a measurement still returns {nq} bit{nq > 1 ? 's' : ''}"
					size={13}
					muted
				/>
			</Readout>
		{:else}
			<Readout
				id="runs"
				order={6}
				label="Pairs measured"
				value={runsN
					? `${runsN}: ${runsHere.map((c, k) => `${label(2, k)} ${c}`).join(', ')}`
					: 'none yet'}
			>
				<Label
					anchor="start"
					x={600}
					y={385}
					text="fresh pairs measured: {runsN}"
					size={13}
					muted
				/>
				{#each [0, 1, 2, 3] as k (k)}
					{@const frac = runsN ? runsHere[k] / runsN : 0}
					{@const bx = 610 + k * 82}
					<rect
						x={bx}
						y={400}
						width="56"
						height="120"
						rx="3"
						fill="var(--stage-grid)"
						opacity="0.35"
					/>
					<rect
						x={bx}
						y={520 - 120 * frac}
						width="56"
						height={120 * frac}
						rx="3"
						fill="var(--qc-state)"
					/>
					<Label x={bx + 28} y={540} text={label(2, k)} size={14} weight={700} anchor="middle" />
					<Label x={bx + 28} y={558} text={String(runsHere[k])} size={12} anchor="middle" muted />
				{/each}
			</Readout>
		{/if}
	{:else}
		<!-- ============ Bell: the two measuring axes ============ -->
		{#each [0, 1] as q (q)}
			{@const cx = 120 + q * 250}
			{@const cy = 170}
			{@const ang = q === 0 ? a : b}
			{@const col = q === 0 ? 'var(--qc-a)' : 'var(--qc-b)'}
			<circle
				{cx}
				{cy}
				r="80"
				fill="var(--qc-sphere)"
				stroke="var(--stage-line)"
				stroke-width="1.2"
			/>
			<line x1={cx} x2={cx} y1={cy - 80} y2={cy + 80} stroke="var(--stage-grid)" />
			<line x1={cx - 80} x2={cx + 80} y1={cy} y2={cy} stroke="var(--stage-grid)" />
			<line
				x1={cx - Math.sin(ang) * 80}
				y1={cy + Math.cos(ang) * 80}
				x2={cx + Math.sin(ang) * 80}
				y2={cy - Math.cos(ang) * 80}
				stroke={col}
				stroke-width="3"
				stroke-dasharray="1 0"
			/>
			<circle cx={cx + Math.sin(ang) * 80} cy={cy - Math.cos(ang) * 80} r="6" fill={col} />
			<Readout
				id="axis{q}"
				order={-2 + q}
				label={q === 0 ? 'A measures at' : 'B measures at'}
				value={q === 0 ? `${aDeg}° (${aDeg ? 'x' : 'z'})` : deg(bDeg)}
				color={col}
			>
				<Label
					x={cx}
					y={cy - 114}
					text={q === 0
						? `A measures at ${aDeg}° (${aDeg ? 'x' : 'z'})`
						: `B measures at ${deg(bDeg)}`}
					size={13}
					weight={700}
					anchor="middle"
					color={col}
				/>
			</Readout>
			<Readout id="axl{q}">
				<Label
					x={cx + Math.sin(ang) * 98}
					y={cy - Math.cos(ang) * 98 + 4}
					text="0"
					size={13}
					weight={700}
					anchor="middle"
					color="var(--qc-zero)"
				/>
				<Label
					x={cx - Math.sin(ang) * 98}
					y={cy + Math.cos(ang) * 98 + 4}
					text="1"
					size={13}
					weight={700}
					anchor="middle"
					color="var(--qc-one)"
				/>
			</Readout>
		{/each}
		<Readout id="pair-ttl">
			<Label x={245} y={30} text="each pair: (|00⟩ + |11⟩)/√2" size={13} anchor="middle" muted />
		</Readout>

		<!-- the latest pairs, A over B -->
		<Readout id="latest">
			<Label anchor="start" x={30} y={318} text="A" size={13} weight={700} color="var(--qc-a)" />
			<Label anchor="start" x={30} y={348} text="B" size={13} weight={700} color="var(--qc-b)" />
			{#each last as k, i (nPairs - last.length + i)}
				{@const a = k >> 1}
				{@const bb = k & 1}
				{@const o = i === last.length - 1 ? newest : 1}
				<g opacity={o}>
					<rect
						x={52 + i * 26}
						y={302}
						width="22"
						height="22"
						rx="4"
						fill={a ? 'var(--qc-one)' : 'var(--qc-zero)'}
					/>
					<text
						x={63 + i * 26}
						y={318}
						text-anchor="middle"
						font-size="12"
						style:fill="var(--stage-bg)"
						font-weight="700">{a}</text
					>
					<rect
						x={52 + i * 26}
						y={332}
						width="22"
						height="22"
						rx="4"
						fill={bb ? 'var(--qc-one)' : 'var(--qc-zero)'}
					/>
					<text
						x={63 + i * 26}
						y={348}
						text-anchor="middle"
						font-size="12"
						style:fill="var(--stage-bg)"
						font-weight="700">{bb}</text
					>
					{#if a !== bb}
						<circle cx={63 + i * 26} cy={366} r="3" fill="var(--qc-neg)" />
					{/if}
				</g>
			{/each}
			<Label anchor="start" x={52} y={386} text="red dot: the two results differ" size={11} muted />
		</Readout>
		<Readout
			id="agree"
			order={1}
			label="Agreed"
			value="{nPairs ? pct(agreeN / nPairs) : '–'} of {nPairs} pairs (cos²(angle/2) = {pct(
				agreeExact
			)}), E = {nPairs ? signed(eNow) : '–'}"
		>
			<Label
				anchor="start"
				x={30}
				y={430}
				text="pairs measured: {nPairs} · correlation E = {nPairs ? signed(eNow) : '–'}"
				size={13}
				muted
			/>
			<Label
				anchor="start"
				x={30}
				y={462}
				text="results agreed: {nPairs ? pct(agreeN / nPairs) : '–'}"
				size={20}
				weight={700}
				color="var(--qc-state)"
			/>
			<Label
				anchor="start"
				x={30}
				y={488}
				text="quantum prediction cos²({Math.round(between)}°/2) = {pct(agreeExact)}"
				size={13}
			/>
		</Readout>
		<Readout
			id="alice"
			order={2}
			label="A alone gave 0"
			value={nPairs ? pct(aliceZero / nPairs) : '–'}
		>
			<Label
				anchor="start"
				x={30}
				y={530}
				text="A alone gave 0 in {nPairs
					? pct(aliceZero / nPairs)
					: '–'} of pairs, whatever B's angle:"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={30}
				y={548}
				text="turning B's axis sends nothing to A"
				size={12}
				muted
			/>
		</Readout>

		<!-- agreement plot -->
		<line x1={PL.x0} x2={PL.x1} y1={PL.y1} y2={PL.y1} stroke="var(--stage-line)" />
		<line x1={PL.x0} x2={PL.x0} y1={PL.y0} y2={PL.y1} stroke="var(--stage-line)" />
		{#each [0, 0.5, 1] as p (p)}
			<line x1={PL.x0} x2={PL.x1} y1={py(p)} y2={py(p)} stroke="var(--stage-grid)" />
			<Readout id="py{p}">
				<Label x={PL.x0 - 6} y={py(p) + 4} text={pct(p)} size={11} anchor="end" muted />
			</Readout>
		{/each}
		{#each [0, 45, 90, 135, 180] as d (d)}
			<Readout id="px{d}">
				<Label x={px(d)} y={PL.y1 + 16} text="{d}°" size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<Readout id="pl-ttl">
			<Label
				anchor="start"
				x={PL.x0}
				y={PL.y0 - 14}
				text="how often A and B agree, against the angle between their axes"
				size={12}
				muted
			/>
		</Readout>
		<path d={curve} fill="none" stroke="var(--qc-state)" stroke-width="2.5" />
		<line
			x1={px(between)}
			x2={px(between)}
			y1={PL.y0}
			y2={PL.y1}
			stroke="var(--qc-b)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		{#if nPairs > 0}
			<circle
				cx={px(between)}
				cy={py(agreeN / nPairs)}
				r="6"
				fill="var(--qc-b)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		<Readout id="curve-l">
			<Label
				anchor="start"
				x={px(60)}
				y={py(0.75) - 12}
				text="cos²(angle/2)"
				size={12}
				color="var(--qc-state)"
			/>
		</Readout>

		<!-- CHSH -->
		<Readout
			id="chsh"
			order={3}
			label="Bell–CHSH number S"
			value="{S.S.toFixed(2)} (pre-agreed answers: at most 2; quantum: {SExact.toFixed(2)})"
			note="E at A 0°, B 45°: {signed(S.E[0])}; A 0°, B −45°: {signed(
				S.E[1]
			)}; A 90°, B 45°: {signed(S.E[2])}; A 90°, B −45°: {signed(S.E[3])}"
		>
			<Label
				anchor="start"
				x={560}
				y={350}
				text="Bell's test (CHSH): correlation E from 2000 pairs at each setting"
				size={12}
				muted
			/>
			<Label x={720} y={374} text="B at 45°" size={12} anchor="middle" muted />
			<Label x={840} y={374} text="B at −45°" size={12} anchor="middle" muted />
			{#each SETTINGS as st, k (k)}
				{@const cxk = st.b > 0 ? 720 : 840}
				{@const cyk = st.a ? 428 : 400}
				{#if k === current}
					<rect
						x={cxk - 52}
						y={cyk - 17}
						width="104"
						height="24"
						rx="5"
						fill="none"
						stroke="var(--qc-b)"
						stroke-width="2"
					/>
				{/if}
				<Label
					x={cxk}
					y={cyk}
					text="E = {signed(S.E[k])}"
					size={13}
					weight={k === current ? 700 : 500}
					anchor="middle"
					tabular
				/>
			{/each}
			<Label anchor="start" x={560} y={400} text="A at 0°" size={12} muted />
			<Label anchor="start" x={560} y={428} text="A at 90°" size={12} muted />
			<Label
				anchor="start"
				x={560}
				y={472}
				text="S = {S.S.toFixed(2)}"
				size={24}
				weight={700}
				color="var(--qc-state)"
			/>
			<Label
				anchor="start"
				x={680}
				y={468}
				text="= the first three E − the last (A 90°, B −45°)"
				size={12}
				muted
			/>
			<rect
				x={SBAR.x0}
				y={SBAR.y - 8}
				width={sx(2) - SBAR.x0}
				height="16"
				rx="3"
				fill="var(--stage-grid)"
				opacity="0.7"
			/>
			<rect
				x={sx(2)}
				y={SBAR.y - 8}
				width={SBAR.x1 - sx(2)}
				height="16"
				rx="3"
				fill="var(--qc-axis)"
				opacity="0.18"
			/>
			<line
				x1={sx(2)}
				x2={sx(2)}
				y1={SBAR.y - 18}
				y2={SBAR.y + 18}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<circle
				cx={sx(S.S)}
				cy={SBAR.y}
				r="8"
				fill="var(--qc-state)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Label
				x={sx(2) - 6}
				y={SBAR.y + 34}
				text="pre-agreed answers: at most 2"
				size={12}
				anchor="end"
			/>
			<Label
				x={sx(SExact)}
				y={SBAR.y - 22}
				text="quantum 2√2"
				size={12}
				anchor="middle"
				color="var(--qc-state)"
			/>
			<Label anchor="start" x={SBAR.x0} y={SBAR.y + 34} text="0" size={11} muted />
		</Readout>
	{/if}
</g>
