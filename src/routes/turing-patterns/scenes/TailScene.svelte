<script lang="ts">
	/**
	 * An animal's body tapering into a tail of chosen width (`params.tip`), with the activator
	 * forming spots in the body and, when the tail is narrow enough, bands across the tail. Below:
	 * the tail's width against the cut-off π/k₂ under which no ripple across it can grow, and the
	 * verdict read from the pattern itself.
	 *
	 * The run is a `Field` on the masked grid, advanced to ⌊(t − t₀)·RATE⌋ steps; a new width
	 * starts it again (as does a new step, or t going back). Reduced motion: the settled run.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DT,
		TAIL,
		TAIL_PARAMS,
		bandColumns,
		bandWidth,
		fastestMode,
		tail,
		tailHalfWidth,
		uniformState,
		type Field
	} from '../model';
	import { coatRamp, paintField, type RGB } from './paint';

	let { t, params, reduced, dark }: StageProps = $props();

	const tip = $derived(Number(params.tip ?? 4));

	const RATE = 8;
	const REDUCED_TIME = 200;
	let run: Field | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of settled runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<number, Field>();

	const current = $derived.by((): { f: Field; k: number } => {
		const time = t;
		const w = tip;
		if (reduced) {
			let f = reducedRuns.get(w);
			if (!f) {
				f = tail(TAIL_PARAMS, w, 1);
				f.runTo(REDUCED_TIME);
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(w, f);
			}
			return { f, k: f.steps };
		}
		const key = String(w);
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = tail(TAIL_PARAMS, w, 1);
			runKey = key;
			t0 = time;
		}
		lastT = time;
		const target = Math.floor(((time - t0) * RATE) / DT);
		run.step(Math.max(0, Math.min(300, target - run.steps)));
		return { f: run, k: run.steps };
	});

	// ---- painting ------------------------------------------------------------------------------
	let ramp = $state.raw<RGB[] | null>(null);
	$effect(() => {
		void dark;
		untrack(() => {
			ramp = coatRamp();
		});
	});
	const level = uniformState(TAIL_PARAMS).a;
	const image = $derived.by(() => {
		void current.k;
		if (!ramp) return '';
		const m = current.f.mask!;
		return paintField(current.f.a, TAIL.w, TAIL.h, ramp, level, (i) => m[i] === 1);
	});

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 32;
	const cell = 896 / TAIL.w;
	const Y0 = 120;
	const H = TAIL.h * cell;
	const outline = $derived.by(() => {
		const top: string[] = [];
		const bottom: string[] = [];
		for (let x = 0; x <= TAIL.w; x += 2) {
			const hw = tailHalfWidth(Math.min(x, TAIL.w - 1), tip);
			const sx = (X0 + x * cell).toFixed(1);
			top.push(`${sx} ${(Y0 + H / 2 - hw * cell).toFixed(1)}`);
			bottom.push(`${sx} ${(Y0 + H / 2 + hw * cell).toFixed(1)}`);
		}
		return `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
	});

	// ---- the verdict ---------------------------------------------------------------------------
	const cut = bandWidth(TAIL_PARAMS);
	const lam = fastestMode(TAIL_PARAMS).wavelength;
	const formed = $derived.by(() => {
		void current.k;
		return current.f.contrast() > 0.3;
	});
	const verdict = $derived.by(() => {
		void current.k;
		if (!formed) return 'forming…';
		const cols = bandColumns(current.f)
			.slice(TAIL.taper + 4)
			.filter((b) => b !== null);
		if (cols.length === 0) return 'forming…';
		const bands = cols.filter((b) => b).length / cols.length;
		return bands > 0.9 ? 'bands' : bands > 0.3 ? 'bands and spots' : 'spots';
	});

	// a bar chart of the tail's width against the cut-off
	const BX = 300;
	const BW = 560;
	const MAXW = 24;
	const bx = (w: number) => BX + (w / MAXW) * BW;
	const BY = 470;
</script>

<g>
	<Readout id="title" order={1} label="Tail width" value="{tip} cells" note="body 64 cells across">
		<Label
			anchor="start"
			x={X0}
			y={60}
			text="a body that tapers into a tail"
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={X0}
			y={82}
			text="body 64 cells across · tail {tip} cells · Dₕ/Dₐ = {TAIL_PARAMS.d}"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<path d={outline} fill="var(--tp-mid)" />
	{#if image}
		<image href={image} x={X0} y={Y0} width={TAIL.w * cell} height={H} preserveAspectRatio="none" />
	{/if}
	<path d={outline} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.2" />

	<Readout id="body-label" label="Body: room for ripples in every direction">
		<Label x={X0 + 32 * cell} y={Y0 + H + 24} text="body" size={13} weight={600} />
	</Readout>
	<Readout id="tail-label" order={2} label="Tail" value={verdict} color="var(--tp-high-text)">
		<Label
			x={X0 + ((TAIL.taper + TAIL.w) / 2) * cell}
			y={Y0 + H / 2 + (tip / 2) * cell + 26}
			text="tail: {verdict}"
			size={13}
			weight={600}
			color="var(--tp-high-text)"
		/>
	</Readout>

	<!-- the width against the cut-off -->
	<Readout
		id="cutoff"
		order={3}
		label="No ripple across grows below"
		value="{cut.toFixed(1)} cells"
		note="spacing along the tail ≈ {lam.toFixed(1)} cells"
	>
		<Label anchor="start" x={X0} y={BY - 40} text="width of the tail" size={13} weight={600} />
		<Label
			anchor="start"
			x={X0}
			y={BY - 20}
			text="against the narrowest strip in which a ripple across can grow"
			size={12}
			muted
		/>
		<rect
			x={BX}
			y={BY - 14}
			width={bx(cut) - BX}
			height="28"
			fill="var(--tp-band)"
			stroke="var(--tp-curve)"
			stroke-dasharray="4 3"
		/>
		<Label
			anchor="start"
			x={BX + 6}
			y={BY + 36}
			text="bands only (below {cut.toFixed(1)} cells)"
			size={11}
			color="var(--tp-curve-text)"
		/>
		<line x1={BX} x2={bx(MAXW)} y1={BY} y2={BY} stroke="var(--stage-line)" stroke-width="1" />
		<rect x={BX} y={BY - 6} width={bx(tip) - BX} height="12" rx="3" fill="var(--tp-high)" />
		<Label
			anchor="start"
			x={bx(tip) + 8}
			y={BY + 5}
			text="{tip} cells"
			size={12}
			weight={600}
			tabular
		/>
		{#each [0, 4, 8, 12, 16, 20, 24] as v (v)}
			<line x1={bx(v)} x2={bx(v)} y1={BY + 14} y2={BY + 19} stroke="var(--stage-ink-muted)" />
			<Label x={bx(v)} y={BY + 56} text={String(v)} size={11} muted halo={false} />
		{/each}
		<Label
			anchor="end"
			x={bx(MAXW)}
			y={BY + 76}
			text="cells · fastest-growing wavelength {lam.toFixed(1)}"
			size={11}
			muted
		/>
	</Readout>
</g>
