<script lang="ts">
	/**
	 * The 2-D model on the plane. Modes (`step.hints.mode`):
	 * - forward: 400 points of the two moons noised step by step (the real 1,000-step chain, each
	 *   step shrink + fresh normal kick), shown at the step t the playhead reaches;
	 * - denoise: 120 points noised to step t in one go, with an arrow from each to the trained
	 *   network's guess x̂₀ of its clean point (computed here, one network run);
	 * - reverse: 400 points sampled from noise by the trained network, in a Web Worker
	 *   (../sampler.svelte.ts), replayed at the playhead; points coloured by the moon they end on.
	 * Faint dashed curves show the moons' centre lines throughout.
	 */
	import Label from './Label.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { rng } from '#lib/draw/math.ts';
	import { T, alphaBar, decodeWeights, gaussian, noisy, predict } from '../ddpm';
	import { MOONS, WEIGHTS } from '../moons-model';
	import { LABELS, ON_DATA, moon, moonCurve, nearestMoon, onMoons } from '../moons';
	import { POINTS, request, runKey, runs } from '../sampler.svelte';
	import { PLANE, dotsPath, fmt, int, num, pct, px, py, paceForward, paceReverse } from './shared';
	import { useScrub } from './scrub.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'forward'));
	const scrub = useScrub({
		step: () => step,
		params: () => params,
		t: () => t,
		reduced: () => reduced,
		setParam: (id, v) => setParam(id, v),
		run: 8,
		pace: (v) => (mode === 'reverse' ? paceReverse(v) : paceForward(v))
	});
	const u = $derived(scrub.u);

	const wt = decodeWeights(MOONS, WEIGHTS);

	// ---- the data and the forward chain (computed once) -----------------------------------
	const DATA = (() => {
		const r = rng(2024);
		const g = gaussian(2025);
		const xy = new Float32Array(POINTS * 2);
		const label = new Uint8Array(POINTS);
		for (let i = 0; i < POINTS; i++) {
			label[i] = i % 2;
			const [x, y] = moon(r, g, label[i]);
			xy[2 * i] = x;
			xy[2 * i + 1] = y;
		}
		return { xy, label };
	})();
	let chain: Float32Array | null = null;
	/** x_t of the step-by-step chain, t = 0 … T: x_t = √(1 − β_t) x_{t−1} + √β_t ε */
	function chainAt(tt: number): Float32Array {
		if (!chain) {
			const n = POINTS * 2;
			chain = new Float32Array((T + 1) * n);
			chain.set(DATA.xy, 0);
			const g = gaussian(77);
			for (let s = 1; s <= T; s++) {
				const beta = 1 - alphaBar(s) / alphaBar(s - 1);
				const a = Math.sqrt(1 - beta);
				const b = Math.sqrt(beta);
				for (let i = 0; i < n; i++) chain[s * n + i] = a * chain[(s - 1) * n + i] + b * g();
			}
		}
		const n = POINTS * 2;
		const s = Math.max(0, Math.min(T, Math.round(tt)));
		return chain.subarray(s * n, (s + 1) * n);
	}

	// ---- forward ------------------------------------------------------------------------------
	const tNoise = $derived(Math.round(u * T));
	const fwd = $derived(mode === 'forward' ? chainAt(tNoise) : null);

	// ---- denoise: arrows to the network's guess -----------------------------------------------
	const ARROWS = 120;
	const EPS = (() => {
		const g = gaussian(31);
		return Float32Array.from({ length: ARROWS * 2 }, () => g());
	})();
	const guess = $derived.by(() => {
		if (mode !== 'denoise') return null;
		const tt = Math.max(1, tNoise);
		const x = noisy(DATA.xy.subarray(0, ARROWS * 2), EPS, tt);
		const x0 = predict(wt, x, tt, null, 0);
		let d = 0;
		for (let i = 0; i < ARROWS; i++) d += nearestMoon(x0[2 * i], x0[2 * i + 1]).d;
		return { x, x0, onData: onMoons(x0).any, spread: d / ARROWS };
	});
	const arrowPath = $derived.by(() => {
		if (!guess) return '';
		let d = '';
		for (let i = 0; i < ARROWS; i++) {
			const x1 = px(guess.x[2 * i]);
			const y1 = py(guess.x[2 * i + 1]);
			const x2 = px(guess.x0[2 * i]);
			const y2 = py(guess.x0[2 * i + 1]);
			if (x1 < PLANE.x || x1 > PLANE.x + PLANE.w || y1 < PLANE.y || y1 > PLANE.y + PLANE.h)
				continue;
			d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
		}
		return d;
	});

	// ---- reverse: a run of the sampler ----------------------------------------------------------
	const ctl = (prefix: string) => step.controls?.find((c) => c.id.startsWith(prefix))?.id;
	const stepsN = $derived.by(() => {
		const id = ctl('steps-');
		return id ? num(params, id, 100) : 100;
	});
	const seedN = $derived.by(() => {
		const id = ctl('seed-');
		return id ? num(params, id, 1) : 1;
	});
	const label = $derived.by(() => {
		const id = ctl('prompt-');
		const v = id ? String(params[id] ?? 'none') : 'none';
		return v === '0' || v === '1' ? Number(v) : null;
	});
	const scale = $derived.by(() => {
		const id = ctl('g-');
		return id ? num(params, id, 1) : 1;
	});
	const key = $derived(runKey(stepsN, seedN, label, scale));
	$effect(() => {
		if (mode === 'reverse') request(stepsN, seedN, label, scale);
	});
	const run = $derived(mode === 'reverse' ? runs[key] : undefined);
	const ready = $derived(!!run?.frames);

	// with few steps each one is a visible jump (the point of the few-steps step); with many, the
	// display slides between them
	const smooth = $derived(stepsN >= 50);
	const kNow = $derived(smooth ? u * stepsN : Math.round(u * stepsN));
	const rev = $derived.by(() => {
		const f = run?.frames;
		if (!f) return null;
		const n = POINTS * 2;
		const k0 = Math.min(stepsN, Math.floor(kNow));
		const k1 = Math.min(stepsN, k0 + 1);
		const w = kNow - k0;
		const a = f.subarray(k0 * n, (k0 + 1) * n);
		if (w <= 0 || k1 === k0) return a;
		const b = f.subarray(k1 * n, (k1 + 1) * n);
		return Float32Array.from(a, (v, i) => v + (b[i] - v) * w);
	});
	const finalOf = $derived.by(() => {
		const f = run?.frames;
		if (!f) return null;
		const n = POINTS * 2;
		const last = f.subarray(stepsN * n, (stepsN + 1) * n);
		const cls = new Int8Array(POINTS);
		for (let i = 0; i < POINTS; i++) {
			const m = nearestMoon(last[2 * i], last[2 * i + 1]);
			cls[i] = m.d <= ON_DATA ? m.label : -1;
		}
		return { cls, on: onMoons(last) };
	});
	const onNow = $derived(rev ? onMoons(rev) : null);
	const tReached = $derived(run ? run.ts[Math.min(stepsN, Math.round(kNow))] : T);

	// ---- what is drawn ---------------------------------------------------------------------------
	const curves = [0, 1].map((l) => ({
		l,
		d: moonCurve(l)
			.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(y).toFixed(1)}`)
			.join('')
	}));
	const dots = $derived.by(() => {
		if (mode === 'forward' && fwd)
			return [
				{ id: 'up', d: dotsPath(fwd, (i) => DATA.label[i] === 0), c: 'var(--dm-upper)' },
				{ id: 'lo', d: dotsPath(fwd, (i) => DATA.label[i] === 1), c: 'var(--dm-lower)' }
			];
		if (mode === 'denoise' && guess)
			return [
				{ id: 'noisy', d: dotsPath(guess.x), c: 'var(--dm-point)' },
				{ id: 'guess', d: dotsPath(guess.x0), c: 'var(--dm-guess)' }
			];
		if (mode === 'reverse' && rev && finalOf) {
			const cls = finalOf.cls;
			return [
				{ id: 'off', d: dotsPath(rev, (i) => cls[i] === -1), c: 'var(--dm-point)' },
				{ id: 'up', d: dotsPath(rev, (i) => cls[i] === 0), c: 'var(--dm-upper)' },
				{ id: 'lo', d: dotsPath(rev, (i) => cls[i] === 1), c: 'var(--dm-lower)' }
			];
		}
		return [];
	});

	// ---- the panel --------------------------------------------------------------------------------
	const P = { x: 648, y: 40 };
	const evals = $derived(stepsN * (label !== null && scale !== 0 && scale !== 1 ? 2 : 1));
	const promptText = $derived(label === null ? 'none' : `“${LABELS[label]}”`);
	const askedOn = $derived.by(() => {
		if (!finalOf || label === null) return null;
		return label === 0 ? finalOf.on.upper : finalOf.on.lower;
	});
	const title = $derived(
		mode === 'forward'
			? 'Adding noise, step by step'
			: mode === 'denoise'
				? 'The network’s guesses'
				: 'Denoising from pure noise'
	);
	// the time axis: T on the left (noise) … 0 on the right (data) for the reverse process
	const TL = { x: 660, w: 270, y: 470 };
	const tAxis = $derived(mode === 'reverse' ? tReached : tNoise);
	const markX = $derived(
		mode === 'reverse' ? TL.x + TL.w * (1 - tAxis / T) : TL.x + TL.w * (tAxis / T)
	);
</script>

<g>
	<defs>
		<clipPath id="plane-clip">
			<rect x={PLANE.x} y={PLANE.y} width={PLANE.w} height={PLANE.h} rx="10" />
		</clipPath>
	</defs>
	<rect
		x={PLANE.x}
		y={PLANE.y}
		width={PLANE.w}
		height={PLANE.h}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#plane-clip)">
		<!-- axes through the origin -->
		<path
			d="M{PLANE.x} {PLANE.cy}H{PLANE.x + PLANE.w}M{PLANE.cx} {PLANE.y}V{PLANE.y + PLANE.h}"
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		{#each curves as c (c.l)}
			<path
				d={c.d}
				fill="none"
				stroke={c.l === 0 ? 'var(--dm-upper)' : 'var(--dm-lower)'}
				stroke-width={2 * ON_DATA * PLANE.s}
				stroke-linecap="round"
				opacity="0.12"
			/>
		{/each}
		{#if mode === 'denoise'}
			<path d={arrowPath} stroke="var(--dm-guess)" stroke-width="1" opacity="0.45" fill="none" />
		{/if}
		{#each dots as s (s.id)}
			<path
				d={s.d}
				stroke={s.c}
				stroke-width={s.id === 'noisy' ? 4 : 6}
				stroke-linecap="round"
				opacity={s.id === 'noisy' ? 0.55 : 0.85}
			/>
		{/each}
	</g>
	{#if mode === 'reverse' && !ready}
		<Readout
			id="computing"
			order={1}
			label="Sampling"
			value="{int(run?.done ?? 0)} of {int(stepsN)} steps"
		>
			<Label
				x={PLANE.cx}
				y={PLANE.cy}
				size={15}
				pill
				text="sampling… {int(run?.done ?? 0)} of {int(stepsN)} steps"
			/>
		</Readout>
	{/if}

	<!-- the panel -->
	<Readout id="title">
		<Label x={P.x} y={P.y + 14} anchor="start" size={16} weight={650} text={title} />
	</Readout>
	{#if mode === 'forward'}
		<Readout id="t" order={2} label="Step" value="t = {tNoise} of {T}">
			<Label x={P.x} y={P.y + 52} anchor="start" size={15} text="step t = {tNoise} of {T}" />
		</Readout>
		<Readout
			id="sig"
			order={3}
			label="Signal left √ᾱₜ"
			value={fmt(Math.sqrt(alphaBar(tNoise)), 3)}
			color="var(--dm-signal)"
		>
			<Label
				x={P.x}
				y={P.y + 82}
				anchor="start"
				text="signal left √ᾱₜ = {fmt(Math.sqrt(alphaBar(tNoise)), 3)}"
				color="var(--dm-signal)"
			/>
		</Readout>
		<Readout
			id="noi"
			order={4}
			label="Noise √(1 − ᾱₜ)"
			value={fmt(Math.sqrt(1 - alphaBar(tNoise)), 3)}
		>
			<Label
				x={P.x}
				y={P.y + 106}
				anchor="start"
				text="noise √(1 − ᾱₜ) = {fmt(Math.sqrt(1 - alphaBar(tNoise)), 3)}"
				muted
			/>
		</Readout>
		<Readout id="legend">
			<circle cx={P.x + 4} cy={P.y + 146} r="4" fill="var(--dm-upper)" />
			<Label x={P.x + 16} y={P.y + 150} anchor="start" size={12} text="from the upper moon" />
			<circle cx={P.x + 4} cy={P.y + 170} r="4" fill="var(--dm-lower)" />
			<Label x={P.x + 16} y={P.y + 174} anchor="start" size={12} text="from the lower moon" />
		</Readout>
	{:else if mode === 'denoise' && guess}
		<Readout id="t" order={2} label="Step" value="t = {Math.max(1, tNoise)}">
			<Label
				x={P.x}
				y={P.y + 52}
				anchor="start"
				size={15}
				text="noise level: step t = {Math.max(1, tNoise)}"
			/>
		</Readout>
		<Readout
			id="ond"
			order={3}
			label="Guesses on a moon"
			value={pct(guess.onData)}
			color="var(--dm-guess)"
		>
			<Label
				x={P.x}
				y={P.y + 82}
				anchor="start"
				text="guesses on a moon: {pct(guess.onData)}"
				color="var(--dm-guess)"
			/>
		</Readout>
		<Readout id="legend">
			<circle cx={P.x + 4} cy={P.y + 122} r="3" fill="var(--dm-point)" />
			<Label x={P.x + 16} y={P.y + 126} anchor="start" size={12} text="noisy point xₜ" />
			<circle cx={P.x + 4} cy={P.y + 146} r="4" fill="var(--dm-guess)" />
			<Label x={P.x + 16} y={P.y + 150} anchor="start" size={12} text="the network’s guess x̂₀" />
			<Label
				x={P.x}
				y={P.y + 182}
				anchor="start"
				size={12}
				muted
				text="faint bands: where the data lie"
			/>
		</Readout>
	{:else if mode === 'reverse'}
		<Readout
			id="t"
			order={2}
			label="Denoising"
			value="step {int(Math.round(kNow))} of {int(stepsN)} · t = {tReached}"
		>
			<Label
				x={P.x}
				y={P.y + 52}
				anchor="start"
				size={15}
				text="step {int(Math.round(kNow))} of {int(stepsN)} · t = {tReached}"
			/>
		</Readout>
		<Readout
			id="prompt"
			order={3}
			label="Prompt"
			value="{promptText}{label === null ? '' : `, s = ${fmt(scale, 1)}`}"
		>
			<Label
				x={P.x}
				y={P.y + 80}
				anchor="start"
				text="prompt {promptText}{label === null ? '' : ` · guidance s = ${fmt(scale, 1)}`}"
			/>
		</Readout>
		{#if onNow}
			<Readout id="on" order={4} label="On a moon now" value={pct(onNow.any)}>
				<Label x={P.x} y={P.y + 108} anchor="start" text="points on a moon now: {pct(onNow.any)}" />
			</Readout>
		{/if}
		{#if askedOn !== null && label !== null}
			<Readout
				id="asked"
				order={5}
				label="End on the {LABELS[label]}"
				value={pct(askedOn)}
				color={label === 0 ? 'var(--dm-upper)' : 'var(--dm-lower)'}
			>
				<Label
					x={P.x}
					y={P.y + 132}
					anchor="start"
					text="end on the {LABELS[label]}: {pct(askedOn)}"
					color={label === 0 ? 'var(--dm-upper)' : 'var(--dm-lower)'}
				/>
			</Readout>
		{/if}
		<Readout id="evals">
			<Label
				x={P.x}
				y={P.y + 160}
				anchor="start"
				size={12}
				muted
				text="network runs: {int(evals)} ({POINTS} points each)"
			/>
		</Readout>
		<Readout id="legend">
			<circle cx={P.x + 4} cy={P.y + 192} r="4" fill="var(--dm-upper)" />
			<Label x={P.x + 16} y={P.y + 196} anchor="start" size={12} text="ends on the upper moon" />
			<circle cx={P.x + 4} cy={P.y + 216} r="4" fill="var(--dm-lower)" />
			<Label x={P.x + 16} y={P.y + 220} anchor="start" size={12} text="ends on the lower moon" />
			<circle cx={P.x + 4} cy={P.y + 240} r="4" fill="var(--dm-point)" />
			<Label x={P.x + 16} y={P.y + 244} anchor="start" size={12} text="ends off the data" />
		</Readout>
	{/if}

	<!-- the time axis -->
	<Readout id="axis">
		<line
			x1={TL.x}
			y1={TL.y}
			x2={TL.x + TL.w}
			y2={TL.y}
			stroke="var(--stage-line)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<Label
			x={TL.x}
			y={TL.y + 24}
			size={12}
			muted
			text={mode === 'reverse' ? 'noise (t = 1000)' : 'data (t = 0)'}
			anchor="start"
		/>
		<Label
			x={TL.x + TL.w}
			y={TL.y + 24}
			size={12}
			muted
			text={mode === 'reverse' ? 'data (t = 0)' : 'noise (t = 1000)'}
			anchor="end"
		/>
		<circle
			cx={markX}
			cy={TL.y}
			r="7"
			fill={mode === 'denoise' ? 'var(--dm-guess)' : 'var(--stage-ink)'}
		/>
		<Label
			x={TL.x}
			y={TL.y - 18}
			size={12}
			muted
			anchor="start"
			text={mode === 'reverse' ? 'reverse process →' : 'forward process →'}
		/>
	</Readout>
</g>
