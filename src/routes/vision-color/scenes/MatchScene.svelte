<script lang="ts">
	/**
	 * A colour-matching experiment: a split circle, the target light (`params.target`) on the
	 * left half and a mixture of three laser lines (`params.r`, `params.g`, `params.b`) on the
	 * right. Bars compare the two halves' L, M and S cone signals; the spectra underneath show
	 * that the two lights share no wavelengths. Both halves go through the same display pipeline
	 * (colour.ts), so equal cone signals give identical pixels.
	 *
	 * Phases (`step.hints.phase`):
	 *   match   — as above.
	 *   screens — the lamp's spectrum is replaced by a close-up of screen pixels lit at r, g, b,
	 *             and the closest possible match is reported for targets the lasers can't reach.
	 */
	import { Label, clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		MATCHED,
		PRIMARIES,
		TARGETS,
		bestMatch,
		cssColour,
		exposureFor,
		mismatch,
		mixture,
		response,
		spectralColour
	} from '../colour';

	let { step, t, params }: StageProps = $props();

	const screens = $derived(step.hints?.phase === 'screens');
	const target = $derived(TARGETS.find((x) => x.id === params.target) ?? TARGETS[1]);
	const rgb = $derived([
		clamp(Number(params.r ?? 0)),
		clamp(Number(params.g ?? 0)),
		clamp(Number(params.b ?? 0))
	] as [number, number, number]);

	const tc = $derived(response(target.lines));
	const mc = $derived(response(mixture(...rgb)));
	const expose = $derived(exposureFor(tc, 0.85));
	const targetColour = $derived(cssColour(tc, expose));
	const mixColour = $derived(cssColour(mc, expose));
	const off = $derived(mismatch(mc, tc));
	const matched = $derived(off < MATCHED);
	// The best the three lasers can do (searched once per target).
	const best = $derived(bestMatch(tc));
	const reachable = $derived(best.mismatch < MATCHED);

	const KINDS = [
		{ k: 0, id: 'L', color: 'var(--vc-l)' },
		{ k: 1, id: 'M', color: 'var(--vc-m)' },
		{ k: 2, id: 'S', color: 'var(--vc-s)' }
	] as const;
	const scale = $derived(Math.max(...tc));
	const worst = $derived(
		KINDS.reduce((w, kd) => (Math.abs(mc[kd.k] - tc[kd.k]) > Math.abs(mc[w.k] - tc[w.k]) ? kd : w))
	);
	const verdict = $derived.by(() => {
		if (matched) return 'match: the cones can’t tell them apart';
		const kd = worst;
		const more = mc[kd.k] > tc[kd.k];
		return `${kd.id} cones get ${more ? 'too much' : 'too little'} from the mix`;
	});

	// ------------------------------------------------------------------ geometry
	const CIRC = { x: 250, y: 200, r: 112 };
	const LAMP = { x: 62, y: 200 };
	const LASER_X = 448;
	const laserY = [130, 200, 270];
	const BARS = { x: 534, top: 78, h: 220, w: 34, gap: 4, group: 128 };

	const pulses = $derived.by(() => {
		const out: { key: string; x: number; y: number; o: number; c: string }[] = [];
		for (let i = 0; i < 4; i++) {
			const u = cycle(t, 1.6, i / 4);
			out.push({
				key: `lamp${i}`,
				x: LAMP.x + 26 + u * (CIRC.x - CIRC.r - LAMP.x - 30),
				y: LAMP.y,
				o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u)),
				c: targetColour
			});
			PRIMARIES.forEach((p, j) => {
				const x0 = LASER_X - 22;
				const y0 = laserY[j];
				const x1 = CIRC.x + CIRC.r * 0.62;
				const y1 = CIRC.y + (y0 - CIRC.y) * 0.25;
				out.push({
					key: `${p.id}${i}`,
					x: x0 + (x1 - x0) * u,
					y: y0 + (y1 - y0) * u,
					o: rgb[j] > 0.005 ? smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u)) : 0,
					c: spectralColour(p.nm)
				});
			});
		}
		return out;
	});

	// ------------------------------------------------------------------ spectra
	const SP = { y0: 548, h: 92, w: 380 };
	const LEFT = 52;
	const RIGHT = 532;
	const NMA = 390;
	const NMB = 700;
	const xIn = (x0: number, nm: number) => x0 + ((nm - NMA) / (NMB - NMA)) * SP.w;
	const lampCurve = $derived.by(() => {
		if (!target.continuous) return '';
		const peak = Math.max(...target.lines.map((l) => (l.nm <= NMB ? l.power : 0)));
		return target.lines
			.filter((l) => l.nm <= NMB)
			.filter((_, i) => i % 3 === 0)
			.map((l) => `${xIn(LEFT, l.nm).toFixed(1)},${(SP.y0 - (l.power / peak) * SP.h).toFixed(1)}`)
			.join(' ');
	});
	const STOPS = Array.from({ length: 32 }, (_, i) => NMA + i * 10).map((nm) => ({
		off: (nm - NMA) / (NMB - NMA),
		c: spectralColour(Math.min(nm, NMB), 0.95)
	}));
</script>

<g>
	<defs>
		<linearGradient id="match-spectrum" x1="0" x2="1" y1="0" y2="0">
			{#each STOPS as s (s.off)}
				<stop offset={s.off} stop-color={s.c} />
			{/each}
		</linearGradient>
		<clipPath id="match-left">
			<rect
				x={CIRC.x - CIRC.r - 2}
				y={CIRC.y - CIRC.r - 2}
				width={CIRC.r + 1}
				height={2 * CIRC.r + 4}
			/>
		</clipPath>
		<clipPath id="match-right">
			<rect x={CIRC.x + 1} y={CIRC.y - CIRC.r - 2} width={CIRC.r + 2} height={2 * CIRC.r + 4} />
		</clipPath>
	</defs>

	<!-- the lamp and its light -->
	<circle
		cx={LAMP.x}
		cy={LAMP.y}
		r="20"
		fill={targetColour}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<Readout id="lamp-name" label="Left half" value={target.label} order={1}>
		<Label
			x={24}
			y={42}
			text={target.label.replace(/ \(.*\)$/, '')}
			anchor="start"
			size={14}
			weight={600}
		/>
		<Label
			x={24}
			y={60}
			text={target.label.match(/\((.*)\)/)?.[1] ?? ''}
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
	<!-- three lasers -->
	{#each PRIMARIES as p, j (p.id)}
		<rect
			x={LASER_X - 22}
			y={laserY[j] - 9}
			width="58"
			height="18"
			rx="4"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<circle
			cx={LASER_X - 22}
			cy={laserY[j]}
			r="5"
			fill={spectralColour(p.nm)}
			opacity={0.3 + 0.7 * smoothstep(0, 0.05, rgb[j])}
		/>
		<Readout id="laser-{p.id}">
			<Label x={LASER_X + 7} y={laserY[j] + 4} text="{p.nm} nm" size={11} />
		</Readout>
	{/each}
	{#each pulses as p (p.key)}
		<circle cx={p.x} cy={p.y} r="3.2" fill={p.c} opacity={p.o} />
	{/each}

	<!-- the split field -->
	<g clip-path="url(#match-left)">
		<circle cx={CIRC.x} cy={CIRC.y} r={CIRC.r} fill={targetColour} />
	</g>
	<g clip-path="url(#match-right)">
		<circle cx={CIRC.x} cy={CIRC.y} r={CIRC.r} fill={mixColour} />
	</g>
	<circle
		cx={CIRC.x}
		cy={CIRC.y}
		r={CIRC.r}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<line
		x1={CIRC.x}
		y1={CIRC.y - CIRC.r}
		x2={CIRC.x}
		y2={CIRC.y + CIRC.r}
		stroke="var(--stage-bg)"
		stroke-width="2"
		opacity={matched ? 0.3 : 1}
	/>
	<Readout id="halves">
		<Label x={CIRC.x - CIRC.r / 2} y={CIRC.y + CIRC.r + 24} text="lamp" size={12} muted />
		<Label x={CIRC.x + CIRC.r / 2} y={CIRC.y + CIRC.r + 24} text="three lasers" size={12} muted />
	</Readout>

	<!-- cone signals -->
	<Readout id="bars-title">
		<Label
			x={BARS.x + (3 * BARS.group) / 2 - 20}
			y={BARS.top - 22}
			text="cone signals: lamp (outline) and lasers (solid)"
			size={12}
			muted
		/>
	</Readout>
	{#each KINDS as kd (kd.id)}
		{@const gx = BARS.x + kd.k * BARS.group}
		{@const ht = (BARS.h * tc[kd.k]) / scale}
		{@const hm = Math.min(BARS.h * 1.15, (BARS.h * mc[kd.k]) / scale)}
		<line
			x1={gx - 8}
			y1={BARS.top + BARS.h}
			x2={gx + 2 * BARS.w + BARS.gap + 8}
			y2={BARS.top + BARS.h}
			stroke="var(--stage-line)"
		/>
		<rect
			x={gx}
			y={BARS.top + BARS.h - ht}
			width={BARS.w}
			height={ht}
			rx="3"
			fill="none"
			stroke={kd.color}
			stroke-width="2.5"
		/>
		<rect
			x={gx + BARS.w + BARS.gap}
			y={BARS.top + BARS.h - hm}
			width={BARS.w}
			height={hm}
			rx="3"
			fill={kd.color}
		/>
		<Readout
			id="cone-{kd.id}"
			label="{kd.id} cones"
			value="lamp {(tc[kd.k] / scale).toFixed(2)} · lasers {(mc[kd.k] / scale).toFixed(2)}"
			color={kd.color}
			order={10 + kd.k}
		>
			<Label
				x={gx + BARS.w + BARS.gap / 2}
				y={BARS.top + BARS.h + 22}
				text={kd.id}
				weight={700}
				color={kd.color}
			/>
			<Label
				x={gx + BARS.w / 2}
				y={BARS.top + BARS.h + 40}
				text={(tc[kd.k] / scale).toFixed(2)}
				size={11}
				muted
			/>
			<Label
				x={gx + 1.5 * BARS.w + BARS.gap}
				y={BARS.top + BARS.h + 40}
				text={(mc[kd.k] / scale).toFixed(2)}
				size={11}
			/>
		</Readout>
	{/each}
	<Readout
		id="verdict"
		label="Verdict"
		value={verdict}
		order={0}
		color={matched ? 'var(--vc-good)' : undefined}
	>
		<Label
			x={BARS.x + (3 * BARS.group) / 2 - 20}
			y={BARS.top + BARS.h + 74}
			text={verdict}
			size={14}
			weight={700}
			color={matched ? 'var(--vc-good)' : undefined}
		/>
	</Readout>
	{#if screens && !reachable}
		<Readout
			id="best"
			label="Best possible"
			value="{(best.mismatch * 100).toFixed(0)}% off, at {best.rgb
				.map((v) => v.toFixed(2))
				.join(' · ')}"
			order={1}
		>
			<Label
				x={BARS.x + (3 * BARS.group) / 2 - 20}
				y={BARS.top + BARS.h + 96}
				text="closest the three lasers can get: {(best.mismatch * 100).toFixed(0)}% off"
				size={12}
				color="var(--vc-bad)"
			/>
		</Readout>
	{:else if matched && off > 0.001}
		<Readout id="close">
			<Label
				x={BARS.x + (3 * BARS.group) / 2 - 20}
				y={BARS.top + BARS.h + 96}
				text="all three signals within {Math.max(0.1, off * 100).toFixed(1)}%"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- spectra -->
	{#each screens ? [RIGHT] : [LEFT, RIGHT] as x0 (x0)}
		<line x1={x0} y1={SP.y0} x2={x0 + SP.w} y2={SP.y0} stroke="var(--stage-line)" />
		<rect x={x0} y={SP.y0 + 4} width={SP.w} height="8" rx="2" fill="url(#match-spectrum)" />
		<Readout id="sp-ticks-{x0}">
			{#each [400, 500, 600, 700] as w (w)}
				<Label x={xIn(x0, w)} y={SP.y0 + 28} text={w} size={10} muted />
			{/each}
		</Readout>
	{/each}
	{#if !screens}
		<Readout id="sp-lamp">
			<Label
				x={LEFT}
				y={SP.y0 - SP.h - 14}
				text="the lamp’s light: wavelengths it contains"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
		{#if target.continuous}
			<polyline points={lampCurve} fill="none" stroke="var(--stage-ink)" stroke-width="2" />
		{:else}
			{#each target.lines as l (l.nm)}
				<line
					x1={xIn(LEFT, l.nm)}
					y1={SP.y0}
					x2={xIn(LEFT, l.nm)}
					y2={SP.y0 - SP.h}
					stroke={spectralColour(l.nm)}
					stroke-width="4"
				/>
				<Readout id="sp-line-{l.nm}">
					<Label
						x={xIn(LEFT, l.nm) + 8}
						y={SP.y0 - SP.h + 12}
						text="{l.nm} nm only"
						anchor="start"
						size={11}
					/>
				</Readout>
			{/each}
		{/if}
	{:else}
		<!-- a close-up of screen pixels: each a red, a green and a blue light -->
		<Readout id="px-title">
			<Label
				x={LEFT}
				y={SP.y0 - SP.h - 14}
				text="the right half on a screen, close up"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
		{#each [0, 1, 2, 3, 4] as px (px)}
			{#each PRIMARIES as p, j (p.id)}
				<rect
					x={LEFT + 20 + px * 70 + j * 20}
					y={SP.y0 - SP.h + 4}
					width="14"
					height={SP.h - 12}
					rx="3"
					fill={spectralColour(p.nm)}
					opacity={0.08 + 0.92 * rgb[j]}
				/>
			{/each}
		{/each}
	{/if}
	<Readout id="sp-mix">
		<Label
			x={RIGHT}
			y={SP.y0 - SP.h - 14}
			text="the lasers’ light: three wavelengths"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	{#each PRIMARIES as p, j (p.id)}
		<line
			x1={xIn(RIGHT, p.nm)}
			y1={SP.y0}
			x2={xIn(RIGHT, p.nm)}
			y2={SP.y0 - SP.h * rgb[j]}
			stroke={spectralColour(p.nm)}
			stroke-width="4"
			opacity={rgb[j] > 0.005 ? 1 : 0}
		/>
	{/each}
</g>
