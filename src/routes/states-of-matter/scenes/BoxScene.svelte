<script lang="ts">
	/**
	 * The box of molecules (left) and a side panel (right): the three states,
	 * the pair energy, the phase diagram or a close-up of the ice.
	 *
	 * Hints (see ../steps.ts): `sub` / `subParam` (substance), `T` / `tParam`
	 * (°C), `P` / `pParam` (log₁₀ atm), `panel`.
	 *
	 * The box is a `BoxRun` (../md.ts), integrated lazily frame by frame and
	 * driven by a set point derived from the reader's temperature and pressure
	 * (../mapping.ts). When the set point changes, the run carries on from its
	 * current state with the new set point, so the reader watches it melt, boil
	 * or condense; the run, its start time and the last set point are the only
	 * remembered values, kept in plain variables inside a `$derived` (as in the
	 * entropy box). A new run starts when the step or the substance changes, or
	 * when t goes back (a restart). Reduced motion: a fresh run at the current
	 * set point, shown 2.5 s after its (pre-settled) start.
	 */
	import { Label } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BoxRun,
		FPS,
		MODELS,
		bondPairs,
		lattice,
		stats,
		type Frame,
		type Setpoint,
		type Start
	} from '../md';
	import { MODEL_OF, setpointFor } from '../mapping';
	import { ATM, KELVIN, SUBSTANCES, type Phase, type Substance } from '../phase';
	import { formatAtm, formatCelsius } from '../format';
	import DiagramPanel from '../parts/DiagramPanel.svelte';
	import EnergyPanel from '../parts/EnergyPanel.svelte';
	import StatesPanel from '../parts/StatesPanel.svelte';
	import RingPanel from '../parts/RingPanel.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const hints = $derived(step.hints ?? {});
	const panel = $derived(String(hints.panel ?? 'diagram'));
	const sub = $derived<Substance>(
		(hints.subParam ? String(params[String(hints.subParam)]) : String(hints.sub ?? 'co2')) ===
			'water'
			? 'water'
			: 'co2'
	);
	const celsius = $derived(Number(hints.tParam ? params[String(hints.tParam)] : (hints.T ?? 20)));
	const logAtm = $derived(Number(hints.pParam ? params[String(hints.pParam)] : (hints.P ?? 0)));
	const T = $derived(celsius + KELVIN);
	const P = $derived(ATM * 10 ** logAtm);
	const model = $derived(MODEL_OF[sub]);
	const sp = $derived(setpointFor(sub, T, P));
	const spKey = $derived(`${sp.T.toFixed(4)}|${sp.P.toFixed(5)}|${sp.solid}`);

	const startFor = (phase: Phase): Start =>
		phase === 'solid' ? 'solid' : phase === 'liquid' ? 'liquid' : 'gas';

	// ---- the run --------------------------------------------------------------------
	const REDUCED_FRAME = 150;
	let run: BoxRun | null = null;
	let runKey = '';
	let lastSp = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, BoxRun>();

	const current = $derived.by((): { run: BoxRun; fi: number } => {
		const time = t;
		const setpoint: Setpoint & { phase: Phase } = sp;
		const key = `${step.id}|${model}`;
		if (reduced) {
			const rk = `${model}|${spKey}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = new BoxRun(model, startFor(setpoint.phase), setpoint);
				reducedRuns.set(rk, r);
			}
			return { run: r, fi: REDUCED_FRAME };
		}
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = new BoxRun(model, startFor(setpoint.phase), setpoint);
			runKey = key;
			lastSp = spKey;
			t0 = time;
		} else if (spKey !== lastSp) {
			run.set(setpoint);
			lastSp = spKey;
		}
		lastT = time;
		return { run, fi: Math.max(0, Math.round((time - t0) * FPS)) };
	});
	const frame = $derived<Frame>(current.run.frame(current.fi));
	const measured = $derived(stats(current.run, frame));

	// ---- geometry ---------------------------------------------------------------------
	const BX = 40;
	const BOTTOM = 522;
	/** Height of the box's inside, px. */
	const BH = 440;
	const spec = $derived(MODELS[model]);
	/** Drawn radius of a molecule (model units): σ/2. */
	const rDraw = $derived(model === 'mb' ? 0.35 : 0.5);
	/** The walls push from wallRange away; draw them where the molecules' edges touch. */
	const off = $derived(spec.wallRange - rDraw);
	const scale = $derived(BH / (spec.height - 2 * off));
	const BW = $derived((spec.width - 2 * off) * scale);
	const px = (x: number) => BX + (x - off) * scale;
	const py = (y: number) => BOTTOM - (y - off) * scale;
	const top = $derived(py(spec.height - off));
	const pistonY = $derived(py(frame.piston - off));
	const atStop = $derived(frame.piston >= spec.height - 0.05);

	const dots = $derived(
		Array.from({ length: frame.x.length }, (_, i) => ({ i, x: px(frame.x[i]), y: py(frame.y[i]) }))
	);
	const ARM_LEN = 0.45;
	const arms = $derived.by(() => {
		if (model !== 'mb') return '';
		let d = '';
		for (let i = 0; i < frame.x.length; i++) {
			const x = px(frame.x[i]);
			const y = py(frame.y[i]);
			for (let a = 0; a < 3; a++) {
				const ang = frame.phi[i] + (a * 2 * Math.PI) / 3;
				d += `M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(ang) * ARM_LEN * scale).toFixed(1)} ${(-Math.sin(ang) * ARM_LEN * scale).toFixed(1)}`;
			}
		}
		return d;
	});
	const bonds = $derived.by(() => {
		if (model !== 'mb') return '';
		return bondPairs(frame)
			.map(
				([i, j]) =>
					`M${px(frame.x[i]).toFixed(1)} ${py(frame.y[i]).toFixed(1)}L${px(frame.x[j]).toFixed(1)} ${py(frame.y[j]).toFixed(1)}`
			)
			.join('');
	});
	/** Where the piston rests on the ice, for comparison in the water steps. */
	const iceLine = $derived(
		model === 'mb' ? py(Math.max(...lattice('mb').y) + spec.wallRange - off) : null
	);

	// ---- the tracked molecule (the three-states steps) --------------------------------
	/** The tracked molecule: the one nearest the middle of the bottom layers at the run's start. */
	const tracked = $derived.by(() => {
		const f = current.run.frame(0);
		let best = 0;
		let bd = Infinity;
		for (let i = 0; i < f.x.length; i++) {
			const d = (f.x[i] - spec.width / 2) ** 2 + (f.y[i] - 3) ** 2;
			if (d < bd) {
				bd = d;
				best = i;
			}
		}
		return best;
	});
	const TRAIL = 6 * FPS;
	const showTrail = $derived(panel === 'states');
	const trail = $derived.by(() => {
		if (!showTrail) return '';
		const { run, fi } = current;
		let d = '';
		for (let k = Math.max(0, fi - TRAIL); k <= fi; k += 2) {
			const f = run.frame(k);
			d += `${d ? 'L' : 'M'}${px(f.x[tracked]).toFixed(1)} ${py(f.y[tracked]).toFixed(1)}`;
		}
		return d;
	});

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const freezing = $derived(frame.freezing >= 0);
</script>

<g>
	<!-- heading -->
	<Label
		x={BX}
		y={48}
		text="{SUBSTANCES[sub].name} ({SUBSTANCES[sub].formula}) · {formatCelsius(
			celsius
		)} · {formatAtm(P / ATM)}"
		size={14}
		weight={600}
		anchor="start"
	/>

	<!-- the box -->
	<rect
		x={BX - 4}
		y={top - 4}
		width={BW + 8}
		height={BOTTOM - top + 8}
		rx="6"
		fill="var(--som-box)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#if iceLine !== null}
		<line
			x1={BX}
			x2={BX + BW}
			y1={iceLine}
			y2={iceLine}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="5 5"
		/>
	{/if}

	{#if model === 'mb'}
		<path
			d={bonds}
			fill="none"
			stroke="var(--som-bond)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
	{/if}

	{#each dots as d (d.i)}
		<circle
			cx={d.x}
			cy={d.y}
			r={rDraw * scale}
			fill={model === 'mb' ? 'var(--som-water)' : 'var(--som-co2)'}
			stroke={model === 'mb' ? 'var(--stage-bg)' : 'var(--som-co2-edge)'}
			stroke-width="1"
		/>
	{/each}
	{#if showTrail}
		<circle
			cx={dots[tracked].x}
			cy={dots[tracked].y}
			r={rDraw * scale + 1}
			fill="var(--som-trail)"
			fill-opacity="0.45"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
	{/if}
	{#if showTrail}
		<path
			d={trail}
			fill="none"
			stroke="var(--som-trail)"
			stroke-width="2"
			stroke-linejoin="round"
			opacity="0.9"
		/>
	{/if}
	{#if model === 'mb'}
		<path d={arms} fill="none" stroke="var(--som-arm)" stroke-width="1.6" stroke-linecap="round" />
	{/if}

	<!-- the piston, pushed down by the pressure -->
	<rect
		x={BX - 2}
		y={pistonY - 12}
		width={BW + 4}
		height="12"
		rx="3"
		fill="var(--som-piston)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{#if !atStop && pistonY - top > 50}
		{#each [0.2, 0.5, 0.8] as u (u)}
			<line
				x1={BX + BW * u}
				x2={BX + BW * u}
				y1={pistonY - 40}
				y2={pistonY - 17}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
		{/each}
	{/if}
	<Label
		x={BX + BW + 12}
		y={pistonY - 10}
		text={atStop ? 'piston at' : 'piston'}
		size={12}
		anchor="start"
		muted
	/>
	<Label
		x={BX + BW + 12}
		y={pistonY + 6}
		text={atStop ? 'its stop' : formatAtm(P / ATM)}
		size={12}
		anchor="start"
		muted
	/>

	<!-- what the box measures -->
	<Label
		x={BX}
		y={BOTTOM + 30}
		text="molecules in a crystal pattern: {pct(measured.order)}"
		size={12}
		anchor="start"
		muted
	/>
	{#if model === 'mb'}
		<Label
			x={BX}
			y={BOTTOM + 50}
			text="hydrogen bonds per molecule: {measured.bonds.toFixed(1)}"
			size={12}
			anchor="start"
			muted
		/>
	{:else}
		<Label
			x={BX}
			y={BOTTOM + 50}
			text="molecules flying free: {pct(measured.free)}"
			size={12}
			anchor="start"
			muted
		/>
	{/if}
	{#if freezing}
		<Label
			x={BX + BW / 2}
			y={top + 24}
			text="shortcut: gliding into the ice lattice"
			size={12}
			pill
		/>
	{/if}

	<!-- side panel -->
	{#if panel === 'states'}
		<StatesPanel phase={sp.phase} />
	{:else if panel === 'energy'}
		<EnergyPanel kinetic={sp.T} phase={sp.phase} />
	{:else if panel === 'ring'}
		<RingPanel {t} />
	{:else}
		<DiagramPanel {sub} {T} {P} phase={sp.phase} />
	{/if}
</g>
