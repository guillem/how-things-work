<script lang="ts">
	/**
	 * The MNIST model. Modes (`step.hints.mode`):
	 * - forward: a real MNIST test digit noised to step t in one go (x_t = √ᾱ x₀ + √(1 − ᾱ) ε,
	 *   fixed noise), large, with a strip at steps 0, 50, 100, 200, 300, 500, 1000;
	 * - reverse: one precomputed run (prompt, seed; guidance 3, 1000 steps) at the playhead: x_t
	 *   and the network's guess x̂₀ at the latest stored snapshot, and the strip of snapshots;
	 * - steps: the same prompt and noise with 1, 5, 20, 100 and 1000 steps, side by side;
	 * - guidance: guidance 0, 1, 3 and 7 for one prompt, and the reading-rate bars (CHECK).
	 * Snapshots are the stored frames (mnist-sequences.ts): the display jumps from one to the next.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { T, alphaBar, gaussian, noisy } from '../ddpm';
	import { CHECK, DIGITS, SEQUENCES, type Sequence } from '../mnist-sequences';
	import { fmt, imageUrl, num, pct, unpack4, unpack8, paceForward, paceReverse } from './shared';
	import { useScrub } from './scrub.svelte';

	let { step, t, params, reduced, dark, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'forward'));
	const scrub = useScrub({
		step: () => step,
		params: () => params,
		t: () => t,
		reduced: () => reduced,
		setParam: (id, v) => setParam(id, v),
		run: 8,
		pace: (v) => (mode === 'forward' ? paceForward(v) : paceReverse(v))
	});
	const u = $derived(scrub.u);

	const find = (digit: number, seed: number, guidance: number, steps: number) =>
		SEQUENCES.find(
			(s) => s.digit === digit && s.seed === seed && s.guidance === guidance && s.steps === steps
		) as Sequence;

	/** The snapshots of a run: the starting noise, then each stored frame. */
	interface Snap {
		t: number;
		k: number;
		x: Float32Array;
		x0: Float32Array | null;
	}
	// plain caches, not state: filled while rendering, never read reactively
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const snapCache = new Map<Sequence, Snap[]>();
	function snaps(s: Sequence): Snap[] {
		let v = snapCache.get(s);
		if (!v) {
			const ks = s.frames.map((f) => f.k);
			v = [
				{ t: T, k: 0, x: unpack4(s.start), x0: null },
				...s.frames.map((f, i) => ({
					t: f.t,
					k: ks[i],
					x: unpack4(f.x),
					x0: f.x0 ? unpack4(f.x0) : null
				}))
			];
			snapCache.set(s, v);
		}
		return v;
	}
	/** The latest snapshot reached when the run is a fraction u through its steps. */
	const at = (list: Snap[], steps: number, uu: number) => {
		const k = uu * steps;
		let best = list[0];
		for (const s of list) if (s.k <= k + 1e-9) best = s;
		return best;
	};
	const urls = {
		light: new WeakMap<Float32Array, string>(),
		dark: new WeakMap<Float32Array, string>()
	};
	const url = (img: Float32Array) => {
		const m = dark ? urls.dark : urls.light;
		let v = m.get(img);
		if (!v) {
			v = imageUrl(img, dark);
			m.set(img, v);
		}
		return v;
	};

	// ---- forward ---------------------------------------------------------------------------------
	const realIndex = $derived(Math.max(0, Math.min(2, num(params, 'real', 0))));
	const real = $derived(unpack8(DIGITS[realIndex].pixels));
	const EPS = (() => {
		const g = gaussian(123);
		return Float32Array.from({ length: 784 }, () => g());
	})();
	const tNoise = $derived(Math.round(u * T));
	const STRIP = [0, 50, 100, 200, 300, 500, 1000];
	const nearest = $derived(
		STRIP.reduce((b, s, i) => (Math.abs(s - tNoise) < Math.abs(STRIP[b] - tNoise) ? i : b), 0)
	);
	const fwdImg = $derived(mode === 'forward' ? noisy(real, EPS, tNoise) : null);
	const fwdStrip = $derived(
		mode === 'forward' ? STRIP.map((s) => ({ s, img: noisy(real, EPS, s) })) : []
	);

	// ---- reverse --------------------------------------------------------------------------------
	const digit = $derived(Math.max(0, Math.min(9, num(params, 'digit', 3))));
	const seed = $derived(Math.max(1, Math.min(3, num(params, 'dseed', 1))));
	const seq = $derived(find(digit, seed, 3, T));
	const list = $derived(snaps(seq));
	const cur = $derived(at(list, T, u));
	const finished = $derived(cur === list[list.length - 1]);

	// ---- steps and guidance ------------------------------------------------------------------------
	const STEPS = [1, 5, 20, 100, 1000];
	const stepRuns = $derived(
		mode === 'steps'
			? STEPS.map((n) => {
					const s = find(2, 1, 3, n);
					const l = snaps(s);
					return { n, s, cur: at(l, n, u), last: l[l.length - 1] };
				})
			: []
	);
	const gdigit = $derived(num(params, 'gdigit', 4) === 7 ? 7 : 4);
	const SCALES = [0, 1, 3, 7];
	const guideRuns = $derived(
		mode === 'guidance'
			? SCALES.map((g) => {
					const s = find(gdigit, 1, g, T);
					const l = snaps(s);
					return { g, s, cur: at(l, T, u), last: l[l.length - 1] };
				})
			: []
	);

	const tNow = $derived(Math.round(T * (1 - u)));
</script>

<g>
	{#if mode === 'forward' && fwdImg}
		<image href={url(fwdImg)} x={60} y={56} width={308} height={308} class="dm-px" />
		<rect x={59} y={55} width={310} height={310} fill="none" stroke="var(--border)" />
		<Readout id="f-title">
			<Label
				x={420}
				y={80}
				anchor="start"
				size={16}
				weight={650}
				text="An MNIST test digit (a {DIGITS[realIndex].label}), noised"
			/>
		</Readout>
		<Readout id="f-t" order={1} label="Step" value="t = {tNoise} of {T}">
			<Label x={420} y={120} anchor="start" size={15} text="step t = {tNoise} of {T}" />
		</Readout>
		<Readout
			id="f-sig"
			order={2}
			label="Signal left √ᾱₜ"
			value={fmt(Math.sqrt(alphaBar(tNoise)), 3)}
			color="var(--dm-signal)"
		>
			<Label
				x={420}
				y={150}
				anchor="start"
				text="signal left √ᾱₜ = {fmt(Math.sqrt(alphaBar(tNoise)), 3)}"
				color="var(--dm-signal)"
			/>
		</Readout>
		<Readout
			id="f-noi"
			order={3}
			label="Noise √(1 − ᾱₜ)"
			value={fmt(Math.sqrt(1 - alphaBar(tNoise)), 3)}
		>
			<Label
				x={420}
				y={174}
				anchor="start"
				muted
				text="noise √(1 − ᾱₜ) = {fmt(Math.sqrt(1 - alphaBar(tNoise)), 3)}"
			/>
		</Readout>
		<Readout id="f-px">
			<Label
				x={420}
				y={214}
				anchor="start"
				size={12}
				muted
				text="784 pixels, each its own normal kick"
			/>
			<Label
				x={420}
				y={234}
				anchor="start"
				size={12}
				muted
				text="MNIST test digit #{DIGITS[realIndex].index}"
			/>
		</Readout>
		{#each fwdStrip as f, i (f.s)}
			<image href={url(f.img)} x={60 + i * 124} y={418} width={96} height={96} class="dm-px" />
			<rect
				x={59 + i * 124}
				y={417}
				width={98}
				height={98}
				fill="none"
				stroke={i === nearest ? 'var(--dm-guess)' : 'var(--border)'}
				stroke-width={i === nearest ? 3 : 1}
			/>
			<Label x={108 + i * 124} y={538} size={12} text="t = {f.s}" />
		{/each}
	{:else if mode === 'reverse'}
		<image href={url(cur.x)} x={40} y={56} width={252} height={252} class="dm-px" />
		<rect x={39} y={55} width={254} height={254} fill="none" stroke="var(--border)" />
		<Label x={166} y={334} size={13} text="xₜ: the image being denoised" />
		{#if cur.x0}
			<image href={url(cur.x0)} x={330} y={56} width={252} height={252} class="dm-px" />
		{/if}
		<rect
			x={329}
			y={55}
			width={254}
			height={254}
			fill="none"
			stroke="var(--dm-guess)"
			stroke-width="1.5"
		/>
		{#if !cur.x0}
			<Label x={456} y={186} size={13} muted text="no guess yet" />
		{/if}
		<Label
			x={456}
			y={334}
			size={13}
			color="var(--dm-guess)"
			text="x̂₀: the network’s guess of the end"
		/>
		<Readout id="r-step" order={1} label="Denoising" value="step {cur.k} of {T} · t = {cur.t}">
			<Label x={620} y={80} anchor="start" size={15} text="step {cur.k} of {T} · t = {cur.t}" />
		</Readout>
		<Readout id="r-prompt" order={2} label="Prompt" value="“{digit}” · guidance 3 · seed {seed}">
			<Label x={620} y={108} anchor="start" text="prompt “{digit}” · guidance 3 · seed {seed}" />
		</Readout>
		{#if finished}
			<Readout id="r-reads" order={3} label="The vision network reads" value={String(seq.reads)}>
				<Label
					x={620}
					y={136}
					anchor="start"
					text="the vision network reads it as a {seq.reads}"
					color="var(--dm-signal)"
				/>
			</Readout>
		{/if}
		<Readout id="r-note">
			<Label x={620} y={170} anchor="start" size={12} muted text="1,000 steps, precomputed;" />
			<Label x={620} y={188} anchor="start" size={12} muted text="9 snapshots stored per run" />
		</Readout>
		{#each list as s, i (i)}
			<image
				href={url(s.x)}
				x={40 + i * 102}
				y={400}
				width={76}
				height={76}
				class="dm-px"
				opacity={s.k <= cur.k ? 1 : 0.4}
			/>
			<rect
				x={39 + i * 102}
				y={399}
				width={78}
				height={78}
				fill="none"
				stroke={s === cur ? 'var(--dm-guess)' : 'var(--border)'}
				stroke-width={s === cur ? 3 : 1}
			/>
			<Label x={78 + i * 102} y={498} size={11} muted text="t = {s.t}" />
		{/each}
		<Readout id="r-strip">
			<Label
				x={40}
				y={384}
				anchor="start"
				size={12}
				muted
				text="the stored snapshots, from pure noise (t = 1000) to the finished digit (t = 0)"
			/>
		</Readout>
	{:else if mode === 'steps'}
		<Readout id="s-title">
			<Label
				x={480}
				y={70}
				size={16}
				weight={650}
				text="Prompt “2”, the same starting noise, more and more steps"
			/>
		</Readout>
		{#each stepRuns as r, i (r.n)}
			<image href={url(r.cur.x)} x={44 + i * 180} y={130} width={152} height={152} class="dm-px" />
			<rect x={43 + i * 180} y={129} width={154} height={154} fill="none" stroke="var(--border)" />
			<Readout
				id="s-{r.n}"
				order={i + 1}
				label="{r.n} {r.n === 1 ? 'step' : 'steps'}"
				value={r.cur === r.last ? `reads as ${r.s.reads}` : '…'}
			>
				<Label
					x={120 + i * 180}
					y={312}
					size={14}
					weight={600}
					text="{r.n} {r.n === 1 ? 'step' : 'steps'}"
				/>
				<Label
					x={120 + i * 180}
					y={336}
					size={12}
					opacity={r.cur === r.last ? 1 : 0}
					color={r.s.reads === 2 ? 'var(--dm-signal)' : 'var(--dm-upper)'}
					text="read as a {r.s.reads}"
				/>
			</Readout>
		{/each}
		<Readout id="s-note">
			<Label
				x={480}
				y={420}
				size={12}
				muted
				text="each column runs through its own steps in the same time; guidance 3"
			/>
			<Label
				x={480}
				y={442}
				size={12}
				muted
				text="“read as”: what the digit-reading network of the computer vision page sees"
			/>
		</Readout>
	{:else if mode === 'guidance'}
		<Readout id="g-title">
			<Label
				x={40}
				y={60}
				anchor="start"
				size={16}
				weight={650}
				text="Prompt “{gdigit}”, the same noise, four guidance scales"
			/>
		</Readout>
		{#each guideRuns as r, i (r.g)}
			<image href={url(r.cur.x)} x={40 + i * 140} y={90} width={120} height={120} class="dm-px" />
			<rect x={39 + i * 140} y={89} width={122} height={122} fill="none" stroke="var(--border)" />
			<Readout
				id="g-{r.g}"
				order={i + 1}
				label="s = {r.g}"
				value={r.cur === r.last ? `reads as ${r.s.reads}` : '…'}
			>
				<Label x={100 + i * 140} y={236} size={14} weight={600} text="s = {r.g}" />
				<Label
					x={100 + i * 140}
					y={258}
					size={12}
					opacity={r.cur === r.last ? 1 : 0}
					color={r.s.reads === gdigit ? 'var(--dm-signal)' : 'var(--dm-upper)'}
					text="read as a {r.s.reads}"
				/>
			</Readout>
		{/each}
		<!-- the reading rate by guidance -->
		<Readout id="g-chart-title">
			<Label
				x={40}
				y={330}
				anchor="start"
				size={13}
				weight={600}
				text="200 digits per scale (20 of each, 100 steps): read as the digit asked for"
			/>
		</Readout>
		{#each CHECK as c, i (c.guidance)}
			<rect
				x={40 + i * 140}
				y={360}
				width={120}
				height={150}
				rx="4"
				fill="var(--stage-grid)"
				opacity="0.5"
			/>
			<rect
				x={40 + i * 140}
				y={360 + 150 * (1 - c.right / c.of)}
				width={120}
				height={150 * (c.right / c.of)}
				rx="4"
				fill="var(--dm-signal)"
				opacity="0.85"
			/>
			<Readout
				id="g-bar-{c.guidance}"
				order={10 + i}
				label="Read right at s = {c.guidance}"
				value={pct(c.right / c.of)}
			>
				<Label
					x={100 + i * 140}
					y={352 + 150 * (1 - c.right / c.of)}
					size={13}
					weight={600}
					text={pct(c.right / c.of)}
				/>
			</Readout>
			<Label x={100 + i * 140} y={532} size={12} text="s = {c.guidance}" />
		{/each}
		<Readout id="g-tnow">
			<Label
				x={620}
				y={120}
				anchor="start"
				size={12}
				muted
				text={tNow > 0 ? `t = ${tNow}` : 'finished'}
			/>
		</Readout>
	{/if}
</g>

<style>
	.dm-px {
		image-rendering: pixelated;
	}
</style>
