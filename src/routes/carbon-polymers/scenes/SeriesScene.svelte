<script lang="ts">
	/**
	 * The n-alkanes from methane to polyethylene: measured melting and boiling points (NIST,
	 * C1–C44) against chain length on a log axis, Broadhurst's melting-point fit beyond C44
	 * climbing towards its 141 °C limit, room temperature, and a strip under the chart with
	 * each length's state at 25 °C. `params.chainLog` (log₁₀ of the carbons) picks a chain:
	 * a marker on the chart and its readout. The points are drawn in left to right over the
	 * first two seconds (a pure function of t; complete in the reduced-motion frame).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ALKANES } from '../compounds';
	import {
		BROADHURST_FROM,
		PE_LIMIT,
		alkaneBoiling,
		alkaneMass,
		alkaneMelting,
		alkaneState,
		broadhurst,
		toC,
		type State
	} from '../polymer';

	let { t, params }: StageProps = $props();

	const logN = $derived(clamp(Number(params.chainLog ?? 0.9), 0, 5));
	const n = $derived(Math.max(1, Math.round(10 ** logN)));
	const shownLog = Tween.of(() => Math.log10(n), { duration: 500, easing: cubicInOut });

	const P = { x: 80, y: 70, w: 520, h: 380 };
	const sx = scale([0, 5], [P.x, P.x + P.w]);
	const sy = scale([-200, 300], [P.y + P.h, P.y]);
	const reveal = $derived(smoothstep(0, 2, t));
	const shown = (lg: number) => smoothstep(lg - 0.3, lg, reveal * 5.3);

	const melt = ALKANES.filter((a) => a.tm != null).map((a) => ({ n: a.n, c: toC(a.tm!) }));
	const boil = ALKANES.filter((a) => a.tb != null).map((a) => ({ n: a.n, c: toC(a.tb!) }));
	const fitPath = (() => {
		const pts: string[] = [];
		for (let lg = Math.log10(BROADHURST_FROM); lg <= 5.0001; lg += 0.02) {
			const nn = 10 ** lg;
			pts.push(`${sx(lg).toFixed(1)} ${sy(toC(broadhurst(nn))).toFixed(1)}`);
		}
		return 'M' + pts.join('L');
	})();

	// State at 25 °C along the strip, run by run.
	const strip = (() => {
		const runs: { s: State; from: number; to: number }[] = [];
		for (let k = 1; k <= 100000; k = k < 100 ? k + 1 : Math.ceil(k * 1.05)) {
			const s = alkaneState(k);
			if (!s) continue;
			const last = runs[runs.length - 1];
			if (last && last.s === s) last.to = k;
			else runs.push({ s, from: k, to: k });
		}
		return runs;
	})();
	const FILL: Record<State, string> = {
		gas: 'var(--cp-gas)',
		liquid: 'var(--cp-liquid)',
		solid: 'var(--cp-solid)'
	};

	// ---- the chosen chain
	const m = $derived(alkaneMelting(n));
	const b = $derived(alkaneBoiling(n));
	const st = $derived(alkaneState(n));
	const what = $derived(
		n <= 4
			? 'natural gas, bottled gas'
			: n <= 10
				? 'petrol'
				: n <= 17
					? 'kerosene, diesel'
					: n <= 40
						? 'paraffin wax'
						: n < 1000
							? 'hard waxes'
							: 'polyethylene'
	);
	const sub = (v: number) => [...String(v)].map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');
	const formulaN = $derived(n === 1 ? 'CH₄' : `C${sub(n)}H${sub(2 * n + 2)}`);
	const fmt = (c: number) => `${Math.round(c)} °C`.replace('-', '−');
	const mass = $derived(alkaneMass(n));
	const massText = $derived(
		mass < 10000 ? `${mass.toFixed(1)} g/mol` : `${Math.round(mass).toLocaleString('en-GB')} g/mol`
	);
	const mx = $derived(sx(shownLog.current));
	const RX = 650;
	const xTicks = [0, 1, 2, 3, 4, 5];
	const xFormat = (v: number) => (10 ** v).toLocaleString('en-GB');
</script>

<g style:pointer-events="none">
	<Axes
		{sx}
		{sy}
		{xTicks}
		{xFormat}
		yTicks={[-200, -100, 0, 100, 200, 300]}
		yFormat={(v) => `${v}`.replace('-', '−')}
		xLabel="carbons in the chain (log scale)"
		yLabel="°C"
	/>

	<!-- room temperature and the polyethylene limit -->
	<line
		x1={P.x}
		x2={P.x + P.w}
		y1={sy(25)}
		y2={sy(25)}
		stroke="var(--stage-ink)"
		stroke-dasharray="3 4"
		stroke-width="1.2"
	/>
	<Readout id="room">
		<text x={P.x + 8} y={sy(25) - 6} class="halo" style:font-size="11px">25 °C</text>
	</Readout>
	<line
		x1={sx(2)}
		x2={P.x + P.w}
		y1={sy(toC(PE_LIMIT))}
		y2={sy(toC(PE_LIMIT))}
		stroke="var(--cp-chain)"
		stroke-dasharray="6 5"
		stroke-width="1.2"
		opacity="0.7"
	/>
	<Readout id="limit">
		<text
			x={P.x + P.w - 4}
			y={sy(toC(PE_LIMIT)) - 7}
			class="halo"
			text-anchor="end"
			style:font-size="11px"
			style:fill="var(--cp-chain)">limit 141 °C (endless chain)</text
		>
	</Readout>

	<!-- data -->
	<path
		d={fitPath}
		fill="none"
		stroke="var(--cp-cold)"
		stroke-width="2.5"
		stroke-dasharray="7 4"
		opacity={shown(4.5)}
	/>
	{#each boil as d (d.n)}
		<circle
			cx={sx(Math.log10(d.n))}
			cy={sy(d.c)}
			r="4"
			fill="var(--cp-hot)"
			opacity={shown(Math.log10(d.n))}
		/>
	{/each}
	{#each melt as d (d.n)}
		<circle
			cx={sx(Math.log10(d.n))}
			cy={sy(d.c)}
			r="4"
			fill="var(--cp-cold)"
			opacity={shown(Math.log10(d.n))}
		/>
	{/each}
	<Readout id="legend">
		<g transform="translate({P.x + 250} {P.y + P.h - 70})">
			<circle cx="0" cy="0" r="4" fill="var(--cp-hot)" />
			<text x="10" y="4" class="halo" style:font-size="11px">boils (NIST)</text>
			<circle cx="0" cy="18" r="4" fill="var(--cp-cold)" />
			<text x="10" y="22" class="halo" style:font-size="11px">melts (NIST)</text>
			<line
				x1="-6"
				x2="6"
				y1="36"
				y2="36"
				stroke="var(--cp-cold)"
				stroke-width="2.5"
				stroke-dasharray="4 2"
			/>
			<text x="10" y="40" class="halo" style:font-size="11px"
				>melts (Broadhurst’s fit, beyond C₄₄)</text
			>
		</g>
	</Readout>

	<!-- state at 25 °C -->
	{#each strip as r (r.from)}
		{@const x0 = sx(
			Math.log10(r.from) - (r.from === 1 ? 0 : 0.5 * (Math.log10(r.from) - Math.log10(r.from - 1)))
		)}
		{@const x1 =
			r.to >= 100000
				? P.x + P.w
				: sx(Math.log10(r.to) + 0.5 * (Math.log10(r.to + 1) - Math.log10(r.to)))}
		<rect
			x={x0}
			y={P.y + P.h + 40}
			width={Math.max(1, x1 - x0)}
			height="26"
			fill={FILL[r.s]}
			stroke="var(--border)"
		/>
		<Readout id="strip-{r.s}-{r.from}">
			<text
				x={(x0 + x1) / 2}
				y={P.y + P.h + 57}
				text-anchor="middle"
				font-weight="600"
				style:font-size="11px">{r.s}</text
			>
		</Readout>
	{/each}
	<Readout id="strip-title">
		<text x={P.x - 8} y={P.y + P.h + 57} text-anchor="end" class="muted" style:font-size="11px"
			>at 25 °C</text
		>
	</Readout>

	<!-- the chosen chain -->
	<line
		x1={mx}
		x2={mx}
		y1={P.y}
		y2={P.y + P.h + 66}
		stroke="var(--focus)"
		stroke-width="2"
		opacity="0.8"
	/>
	{#if m}
		<circle
			cx={mx}
			cy={sy(toC(m.k))}
			r="7"
			fill="none"
			stroke="var(--cp-cold)"
			stroke-width="2.5"
		/>
	{/if}
	{#if b != null}
		<circle cx={mx} cy={sy(toC(b))} r="7" fill="none" stroke="var(--cp-hot)" stroke-width="2.5" />
	{/if}

	<g transform="translate({RX} 0)">
		<Readout id="formula" order={0} label="Chain" value={`${n.toLocaleString('en-GB')} carbons`}>
			<text x="0" y="96" class="halo" font-weight="700" style:font-size={n > 99 ? '18px' : '24px'}
				>{formulaN}</text
			>
			<text x="0" y="120" class="halo muted" style:font-size="13px">{massText}</text>
		</Readout>
		<Readout
			id="melts"
			order={1}
			label="Melts at"
			value={m ? fmt(toC(m.k)) : 'no NIST value'}
			color="var(--cp-cold)"
		>
			<text x="0" y="160" class="halo muted" style:font-size="12px">melts at</text>
			<text
				x="0"
				y="184"
				class="halo"
				font-weight="700"
				style:font-size="20px"
				style:fill="var(--cp-cold)">{m ? fmt(toC(m.k)) : '—'}</text
			>
			<text x="0" y="202" class="halo muted" style:font-size="11px"
				>{m
					? m.measured
						? 'measured (NIST)'
						: 'Broadhurst’s fit'
					: 'no reliable NIST value'}</text
			>
		</Readout>
		<Readout
			id="boils"
			order={2}
			label="Boils at"
			value={b != null ? fmt(toC(b)) : 'no NIST value'}
			color="var(--cp-hot)"
		>
			<text x="140" y="160" class="halo muted" style:font-size="12px">boils at</text>
			<text
				x="140"
				y="184"
				class="halo"
				font-weight="700"
				style:font-size="20px"
				style:fill="var(--cp-hot)">{b != null ? fmt(toC(b)) : '—'}</text
			>
			<text x="140" y="202" class="halo muted" style:font-size="11px"
				>{b != null
					? 'measured (NIST)'
					: n >= 100
						? 'breaks down before it boils'
						: 'no reliable NIST value'}</text
			>
		</Readout>
		{#if st}
			<Readout id="state" order={3} label="At 25 °C" value={st}>
				<rect
					x="-6"
					y="226"
					width="270"
					height="70"
					rx="12"
					fill={FILL[st]}
					stroke="var(--border)"
				/>
				<text x="8" y="252" font-weight="700" style:font-size="16px">a {st} at 25 °C</text>
				<text x="8" y="276" style:font-size="12px">molecules this size: {what}</text>
			</Readout>
		{/if}
	</g>
</g>
