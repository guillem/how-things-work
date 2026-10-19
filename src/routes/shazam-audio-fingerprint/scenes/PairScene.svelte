<script lang="ts">
	/**
	 * Four seconds of one tune's constellation, close up. An anchor walks along the peaks, its
	 * target zone is drawn, and it is paired with the first peaks there; one pair is spelled out
	 * as a fingerprint (two frequencies and a gap) and, in the `bits` phase, as the 22-bit number
	 * that stores it.
	 *
	 * Phases: pairs, bits. Params: `tune`.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BINS,
		BIN_HZ,
		BITS_DT,
		BITS_F,
		CLIPS,
		FAN_OUT,
		FRAME_S,
		HASH_BITS,
		ZONE_DF,
		ZONE_DT0,
		ZONE_DT1,
		clipPrint,
		pack,
		targets
	} from '../model';
	import { fmt, spectrogramUrl, thousands, tuneOf } from './shared';

	let { step, t, params, reduced, dark }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'pairs'));
	const id = $derived(tuneOf(params));
	const fp = $derived(clipPrint(id));

	// ---- layout: frames F0..F1 of the tune, all 256 bins --------------------------------
	const F0 = 90;
	const F1 = 215;
	const X0 = 92;
	const X1 = 640;
	const Y0 = 64;
	const Y1 = 432;
	const xOf = (f: number) => X0 + ((f - F0 + 0.5) / (F1 - F0)) * (X1 - X0);
	const yOf = (b: number) => Y1 - ((b + 0.5) / BINS) * (Y1 - Y0);

	const inView = $derived(fp.peaks.filter((p) => p.t >= F0 && p.t < F1));
	const anchors = $derived(
		inView
			.filter((p) => p.t >= F0 + 2 && p.t < F1 - ZONE_DT1)
			.map((p) => ({ p, ts: targets(fp.peaks, p) }))
			.filter((a) => a.ts.length >= 3)
			.sort((a, b) => a.p.t - b.p.t || a.p.f - b.p.f)
	);
	/** One anchor every 2.4 s. */
	const PERIOD = 2.4;
	const tt = $derived(reduced ? 2.5 : t);
	const k = $derived(anchors.length ? Math.floor(tt / PERIOD) % anchors.length : 0);
	const a = $derived(anchors[k]);
	/** Fraction of the current anchor's turn: the pairs are drawn one after another. */
	const u = $derived(reduced ? 1 : (tt % PERIOD) / PERIOD);
	const shown = $derived(a ? Math.max(1, Math.ceil(Math.min(1, u / 0.5) * a.ts.length)) : 0);
	/** The pair spelled out: the middle one of the anchor's targets. */
	const pick = $derived(a ? a.ts[Math.min(a.ts.length - 1, Math.floor(a.ts.length / 2))] : null);
	const hash = $derived(a && pick ? pack(a.p.f, pick.f, pick.t - a.p.t) : 0);

	const specUrl = $derived(spectrogramUrl(fp.spec, dark));
	const specX = $derived(xOf(0) - (X1 - X0) / (F1 - F0) / 2);
	const specW = $derived((fp.spec.frames * (X1 - X0)) / (F1 - F0));

	// ---- focus --------------------------------------------------------------------------
	const o = new Tween({ bits: 0 }, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'bits' ? 1 : 0;
		untrack(() => o.set({ bits: v }));
	});

	const hz = (b: number) => `${thousands(b * BIN_HZ)} Hz`;
	const ms = (frames: number) => `${thousands(frames * FRAME_S * 1000)} ms`;
	const bitsOf = (v: number, n: number) => v.toString(2).padStart(n, '0').split('');
	const fields = $derived(
		a && pick
			? [
					{
						id: 'f1',
						name: 'first pitch',
						bits: bitsOf(a.p.f, BITS_F),
						color: 'var(--sz-anchor)',
						value: a.p.f
					},
					{
						id: 'f2',
						name: 'second pitch',
						bits: bitsOf(pick.f, BITS_F),
						color: 'var(--sz-target)',
						value: pick.f
					},
					{
						id: 'dt',
						name: 'gap',
						bits: bitsOf(pick.t - a.p.t, BITS_DT),
						color: 'var(--sz-gap)',
						value: pick.t - a.p.t
					}
				]
			: []
	);
	const BW = 34;
	const BX0 = (960 - HASH_BITS * BW - 2 * 14) / 2;
	const bitX = (field: number, i: number) =>
		BX0 + (field === 0 ? 0 : field === 1 ? BITS_F * BW + 14 : 2 * BITS_F * BW + 28) + i * BW;
</script>

<defs>
	<clipPath id="pair-scene-view">
		<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
	</clipPath>
</defs>

<g>
	<Label
		x={X0}
		y={40}
		text="{CLIPS[id].name}: four seconds, close up"
		anchor="start"
		size={15}
		weight={700}
		halo={false}
	/>

	<rect
		x={X0}
		y={Y0}
		width={X1 - X0}
		height={Y1 - Y0}
		fill="var(--stage-bg)"
		stroke="var(--stage-line)"
	/>
	<g clip-path="url(#pair-scene-view)">
		<image
			href={specUrl}
			x={specX}
			y={Y0}
			width={specW}
			height={Y1 - Y0}
			preserveAspectRatio="none"
			opacity="0.22"
		/>
		{#if a}
			<!-- the target zone -->
			<rect
				x={xOf(a.p.t + ZONE_DT0) - 3}
				y={yOf(Math.min(BINS - 1, a.p.f + ZONE_DF))}
				width={xOf(a.p.t + ZONE_DT1) - xOf(a.p.t + ZONE_DT0) + 6}
				height={yOf(Math.max(0, a.p.f - ZONE_DF)) - yOf(Math.min(BINS - 1, a.p.f + ZONE_DF))}
				rx="6"
				fill="var(--sz-zone)"
				fill-opacity="0.16"
				stroke="var(--sz-zone)"
				stroke-dasharray="5 4"
			/>
		{/if}
		{#each inView as p (p.t * 1000 + p.f)}
			<circle cx={xOf(p.t)} cy={yOf(p.f)} r="3.6" fill="var(--sz-peak)" opacity="0.75" />
		{/each}
		{#if a}
			{#each a.ts.slice(0, shown) as q (q.t * 1000 + q.f)}
				{@const main = q === pick}
				<line
					x1={xOf(a.p.t)}
					y1={yOf(a.p.f)}
					x2={xOf(q.t)}
					y2={yOf(q.f)}
					stroke={main ? 'var(--sz-target)' : 'var(--sz-anchor)'}
					stroke-width={main ? 2.5 : 1.2}
					opacity={main ? 1 : 0.6}
				/>
				<circle
					cx={xOf(q.t)}
					cy={yOf(q.f)}
					r={main ? 6 : 4.5}
					fill={main ? 'var(--sz-target)' : 'var(--sz-peak)'}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/each}
			<circle
				cx={xOf(a.p.t)}
				cy={yOf(a.p.f)}
				r="7"
				fill="var(--sz-anchor)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/if}
	</g>
	{#if a}
		<Readout id="zone">
			<Label
				x={Math.min(X1 - 8, xOf(a.p.t + ZONE_DT1))}
				y={Math.max(Y0 + 16, yOf(Math.min(BINS - 1, a.p.f + ZONE_DF)) - 8)}
				text="target zone"
				anchor="end"
				size={12}
				color="var(--sz-zone-text)"
			/>
		</Readout>
	{/if}
	<!-- axes -->
	{#each [0, 1000, 2000, 3000, 4000] as f (f)}
		{@const y = Y1 - (f / (BINS * BIN_HZ)) * (Y1 - Y0)}
		<line x1={X0 - 5} x2={X0} y1={y} y2={y} stroke="var(--stage-line)" />
		<Label
			x={X0 - 9}
			y={y + 4}
			text={f === 0 ? '0' : `${f / 1000} kHz`}
			anchor="end"
			size={11}
			muted
			halo={false}
		/>
	{/each}
	{#each [3, 4, 5, 6] as s (s)}
		{@const x = xOf(s / FRAME_S - 1)}
		<line x1={x} x2={x} y1={Y1} y2={Y1 + 5} stroke="var(--stage-line)" />
		<Label {x} y={Y1 + 19} text="{s} s" size={11} muted halo={false} />
	{/each}

	<!-- the fingerprint card -->
	{#if a && pick}
		<Readout
			id="fp-f1"
			order={1}
			label="Anchor (first pitch)"
			value={hz(a.p.f)}
			note="at {fmt(a.p.t * FRAME_S, 2)} s in the tune"
			color="var(--sz-anchor-text)"
		/>
		<Readout
			id="fp-f2"
			order={2}
			label="Partner (second pitch)"
			value={hz(pick.f)}
			color="var(--sz-target-text)"
		/>
		<Readout
			id="fp-dt"
			order={3}
			label="Gap"
			value={ms(pick.t - a.p.t)}
			note="{pick.t - a.p.t} slices of 32 ms"
			color="var(--sz-gap-text)"
		/>
		<Readout id="card">
			<g style:pointer-events="none">
				<rect
					x={668}
					y={Y0}
					width={276}
					height={250}
					rx="14"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				<text x={688} y={Y0 + 30} font-size="14" font-weight="700">One fingerprint</text>
				<text x={688} y={Y0 + 62} class="muted" font-size="12">first pitch (the anchor)</text>
				<text
					x={688}
					y={Y0 + 84}
					font-size="18"
					font-weight="700"
					style:fill="var(--sz-anchor-text)">{hz(a.p.f)}</text
				>
				<text x={688} y={Y0 + 114} class="muted" font-size="12">second pitch (its partner)</text>
				<text
					x={688}
					y={Y0 + 136}
					font-size="18"
					font-weight="700"
					style:fill="var(--sz-target-text)">{hz(pick.f)}</text
				>
				<text x={688} y={Y0 + 166} class="muted" font-size="12">gap between them</text>
				<text x={688} y={Y0 + 188} font-size="18" font-weight="700" style:fill="var(--sz-gap-text)"
					>{ms(pick.t - a.p.t)}</text
				>
				<text x={688} y={Y0 + 222} class="muted" font-size="11">stored with: {CLIPS[id].name},</text
				>
				<text x={688} y={Y0 + 238} class="muted" font-size="11"
					>anchor at {fmt(a.p.t * FRAME_S, 2)} s</text
				>
			</g>
		</Readout>
		<Readout
			id="count"
			order={4}
			label="This anchor"
			value="{a.ts.length} pairs"
			note="up to {FAN_OUT} per anchor"
		>
			<Label
				x={806}
				y={Y0 + 282}
				text="this anchor: {a.ts.length} pairs (at most {FAN_OUT})"
				size={12}
				muted
				halo={false}
			/>
		</Readout>
		<Readout
			id="total"
			order={5}
			label="Whole tune"
			value="{thousands(fp.hashes.length)} fingerprints"
			note="from {fp.peaks.length} peaks"
		>
			<Label
				x={806}
				y={Y0 + 304}
				text="whole tune: {thousands(fp.hashes.length)} fingerprints from {fp.peaks.length} peaks"
				size={12}
				muted
				halo={false}
			/>
		</Readout>

		<!-- the bits -->
		<g opacity={0.12 + 0.88 * o.current.bits}>
			{#each fields as fd, fi (fd.id)}
				{#each fd.bits as b, i (i)}
					<rect
						x={bitX(fi, i)}
						y={492}
						width={BW - 4}
						height={36}
						rx="5"
						fill={fd.color}
						fill-opacity={b === '1' ? 0.9 : 0.12}
						stroke={fd.color}
					/>
					<text
						x={bitX(fi, i) + (BW - 4) / 2}
						y={516}
						text-anchor="middle"
						font-size="15"
						font-weight="700"
						style:fill={b === '1' ? 'var(--surface)' : 'var(--stage-ink)'}
						font-family="ui-monospace, monospace">{b}</text
					>
				{/each}
				<Readout id="bits-{fd.id}">
					<Label
						x={bitX(fi, 0) + (fd.bits.length * BW - 4) / 2}
						y={482}
						text="{fd.name}: {fd.value} ({fd.bits.length} bits)"
						size={12}
						halo={false}
					/>
				</Readout>
			{/each}
			<Readout
				id="hash"
				order={6}
				label="As one number"
				value={thousands(hash)}
				note="{HASH_BITS} bits: one of {thousands(2 ** HASH_BITS)} possible fingerprints"
				opacity={o.current.bits}
			>
				<Label
					x={480}
					y={556}
					text="= {thousands(hash)}, one of 2²² = {thousands(2 ** HASH_BITS)} possible fingerprints"
					size={13}
					weight={600}
					halo={false}
				/>
				<Label
					x={480}
					y={578}
					text="a single peak alone: {BITS_F} bits, one of {2 ** BITS_F} values"
					size={12}
					muted
					halo={false}
				/>
			</Readout>
		</g>
	{/if}
</g>
