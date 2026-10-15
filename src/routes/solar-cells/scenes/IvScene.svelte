<script lang="ts">
	/**
	 * The ideal silicon cell's current–voltage curve (detailed balance, `cell()` of the model),
	 * `step.hints.phase`:
	 * - iv: the curve in full sunlight at 300 K; a handle on it sets `params.v`; Jsc and Voc
	 *   marked on the axes.
	 * - voc: brightness `params.suns` (log₁₀ of the number of suns) rescales the current; the
	 *   band gap is marked on the voltage axis; two bars compare the photons absorbed with the
	 *   photons the cell gives back at the handle's voltage (equal at Voc).
	 * - mpp: the power rectangle V × J under the handle, the power curve, the maximum power
	 *   point and the fill factor's Voc × Jsc rectangle.
	 * - temp: the cell at `params.temp` °C, with the 25 °C curve faint behind it.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Handle, clamp, niceMax, scale, ticks, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GAPS, K_B, cell, cellCurrent, kelvin } from '../model';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, params, setParam }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'iv'));
	const GAP = GAPS.Si.gap;

	const suns = $derived(phase === 'voc' ? 10 ** clamp(Number(params.suns ?? 0), -2, 3) : 1);
	const celsius = $derived(phase === 'temp' ? clamp(Number(params.temp ?? 27), -20, 90) : null);
	const tempK = $derived(celsius === null ? undefined : kelvin(celsius));
	const opts = $derived({ suns, T: tempK });
	const c = $derived(cell(GAP, opts));
	const ref = cell(GAP, { T: kelvin(25) });
	const v = $derived(clamp(Number(params.v ?? 0.5), 0, c.voc));
	const j = $derived(cellCurrent(v, GAP, opts));
	const mA = (aPerM2: number) => aPerM2 / 10;

	// ---- plot ---------------------------------------------------------------------------------
	const X0 = 96;
	const X1 = 600;
	const Y0 = 70;
	const Y1 = 500;
	const sv = scale([0, 1.15], [X0, X1]);
	const yMaxTarget = $derived(niceMax(mA(c.jsc) * 1.12));
	const yMax = Tween.of(() => yMaxTarget, { duration: 500, easing: cubicInOut });
	const sj = $derived(scale([0, yMax.current], [Y1, Y0]));
	const curveOf = (o: { suns: number; T?: number }, voc: number) => {
		let d = '';
		const n = 120;
		for (let i = 0; i <= n; i++) {
			const V = (voc * i) / n;
			d += `${i ? 'L' : 'M'}${sv(V).toFixed(1)} ${sj(mA(cellCurrent(V, GAP, o))).toFixed(1)}`;
		}
		return d;
	};
	const path = $derived(curveOf(opts, c.voc));
	const refPath = $derived(phase === 'temp' ? curveOf({ suns: 1, T: kelvin(25) }, ref.voc) : '');

	// Power curve (mpp) on the same numbers: mW per cm² against mA per cm².
	const sp = $derived(sj);
	const powerPath = $derived.by(() => {
		if (phase !== 'mpp') return '';
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const V = (c.voc * i) / 120;
			d += `${i ? 'L' : 'M'}${sv(V).toFixed(1)} ${sp(mA(V * cellCurrent(V, GAP, opts))).toFixed(1)}`;
		}
		return d;
	});
	const power = $derived(mA(v * j)); // mW/cm²
	const efficiency = $derived((v * j) / c.pin);

	// Photons given back, as a fraction of those absorbed: J₀ e^(qV/kT) / Jsc.
	const kT = $derived(K_B * c.T);
	const givenBack = $derived(clamp((c.j0 * Math.exp(v / kT)) / c.jsc));

	// ---- handle ---------------------------------------------------------------------------------
	const setV = (V: number) =>
		setParam('v', Math.round(clamp(V, 0, Math.floor(c.voc * 1000) / 1000) * 1000) / 1000);
	const onmove = (p: Point) => setV(sv.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setV(0) : k === 'end' ? setV(c.voc) : setV(v + k * 0.005);

	const fmtJ = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
	const sunsText = $derived(
		suns >= 1
			? `${Math.round(suns).toLocaleString('en-US')} × full sun`
			: `${Number(suns.toPrecision(2))} × full sun`
	);
	const hx = $derived(sv(v));
	const hy = $derived(sj(mA(j)));
	const RX = 640;
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(ch)] ?? (ch === '-' ? '⁻' : ch))
			.join('');
	const glowText = $derived.by(() => {
		if (givenBack >= 0.001) return `${(givenBack * 100).toFixed(1)}%`;
		const e = Math.floor(Math.log10(givenBack));
		return `${(givenBack / 10 ** e).toFixed(1)} × 10${sup(e)}`;
	});
</script>

<g>
	<Axes
		sx={sv}
		sy={sj}
		xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
		yTicks={ticks(0, yMaxTarget, 5)}
		xFormat={(x: number) => x.toFixed(1)}
		xLabel="voltage across the cell (V)"
		yLabel={phase === 'mpp' ? 'current (mA per cm²) · power (mW per cm²)' : 'current (mA per cm²)'}
	/>

	{#if phase === 'mpp'}
		<!-- the Voc × Jsc rectangle and the power rectangle -->
		<rect
			x={sv(0)}
			y={sj(mA(c.jsc))}
			width={sv(c.voc) - sv(0)}
			height={Y1 - sj(mA(c.jsc))}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<rect
			x={sv(0)}
			y={hy}
			width={hx - sv(0)}
			height={Y1 - hy}
			fill="var(--sc-power)"
			opacity="0.22"
		/>
		<path
			d={powerPath}
			fill="none"
			stroke="var(--sc-power)"
			stroke-width="2.2"
			stroke-dasharray="7 4"
		/>
		{@const mx = sv(c.vmp)}
		{@const my = sp(mA(c.pmax))}
		<circle cx={mx} cy={my} r="5" fill="var(--sc-power)" />
		<Readout id="mpp-label">
			<T
				x={mx - 8}
				y={my - 10}
				text="maximum power {mA(c.pmax).toFixed(1)} mW/cm²"
				size={12}
				anchor="end"
				color="var(--sc-power)"
				weight={600}
			/>
		</Readout>
		<Readout id="ptitle">
			<T
				x={sv(0.42)}
				y={sp(mA(0.42 * cellCurrent(0.42, GAP, opts))) - 14}
				text="power = V × I"
				size={12}
				color="var(--sc-power)"
				anchor="end"
			/>
		</Readout>
	{/if}

	{#if refPath}
		<path
			d={refPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.6"
			opacity="0.6"
		/>
		<Readout id="ref">
			<T x={sv(ref.voc) + 6} y={Y1 - 30} text="25 °C" size={11} muted />
		</Readout>
	{/if}
	<path d={path} fill="none" stroke="var(--sc-curve)" stroke-width="2.6" />

	<!-- Jsc and Voc on the axes -->
	<circle cx={sv(0)} cy={sj(mA(c.jsc))} r="4" fill="var(--sc-curve)" />
	<Readout
		id="jsc"
		order={3}
		label={phase === 'iv' ? 'Short-circuit current' : undefined}
		value="{fmtJ(mA(c.jsc))} mA/cm²"
	>
		<T
			x={sv(0) + 10}
			y={sj(mA(c.jsc)) - 10}
			text="Jsc {fmtJ(mA(c.jsc))} mA/cm²"
			size={12}
			weight={600}
		/>
	</Readout>
	<circle cx={sv(c.voc)} cy={Y1} r="4" fill="var(--sc-curve)" />
	<Readout
		id="voc"
		order={4}
		label={phase === 'mpp' ? undefined : 'Open-circuit voltage'}
		value="{c.voc.toFixed(3)} V"
	>
		<T
			x={sv(c.voc) - 6}
			y={Y1 - 10}
			text="Voc {c.voc.toFixed(3)} V"
			size={12}
			weight={600}
			anchor="end"
		/>
	</Readout>
	{#if phase === 'voc'}
		<line
			x1={sv(GAP)}
			x2={sv(GAP)}
			y1={Y0 + 20}
			y2={Y1}
			stroke="var(--sc-glow)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
		/>
		<Readout id="gapline">
			<T
				x={sv(GAP) - 6}
				y={Y0 + 34}
				text="band gap 1.12 eV → 1.12 V"
				size={12}
				anchor="end"
				color="var(--sc-glow)"
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- the operating point -->
	<line x1={hx} x2={hx} y1={hy} y2={Y1} stroke="var(--stage-ink-muted)" stroke-dasharray="3 3" />
	<line x1={X0} x2={hx} y1={hy} y2={hy} stroke="var(--stage-ink-muted)" stroke-dasharray="3 3" />
	<Handle
		x={hx}
		y={hy}
		label="Operating point (voltage)"
		value={v}
		min={0}
		max={c.voc}
		valuetext="{v.toFixed(3)} volts, {fmtJ(mA(j))} milliamps per square centimetre"
		{onmove}
		{onkey}
	/>

	<!-- readouts -->
	<Readout id="card">
		<Card
			x={RX}
			y={60}
			w={300}
			h={phase === 'voc' ? 290 : phase === 'mpp' ? 196 : phase === 'temp' ? 196 : 120}
		/>
	</Readout>
	<Readout id="title" order={0}>
		<T
			x={RX + 16}
			y={86}
			text={phase === 'temp'
				? `ideal silicon cell at ${celsius} °C`
				: phase === 'voc'
					? `ideal silicon cell, ${sunsText}`
					: 'ideal silicon cell, full sun, 27 °C'}
			size={13}
			weight={700}
		/>
	</Readout>
	<Readout id="v" order={1} label="Voltage" value="{v.toFixed(3)} V">
		<T x={RX + 16} y={112} text="voltage {v.toFixed(3)} V" size={14} />
	</Readout>
	<Readout id="j" order={2} label="Current" value="{fmtJ(mA(j))} mA/cm²">
		<T x={RX + 16} y={134} text="current {fmtJ(mA(j))} mA per cm²" size={14} />
	</Readout>
	{#if phase === 'iv'}
		<Readout id="hint">
			<T
				x={RX + 16}
				y={160}
				text={v < 0.02
					? 'short circuit: all the current, no voltage'
					: v > c.voc - 0.005
						? 'open circuit: no current flows'
						: 'drag the dot along the curve'}
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'mpp' || phase === 'temp'}
		<Readout
			id="p"
			order={5}
			label="Power"
			value="{power.toFixed(1)} mW/cm² ({(efficiency * 100).toFixed(1)}%)"
			color="var(--sc-power)"
		>
			<T
				x={RX + 16}
				y={160}
				text="power {power.toFixed(1)} mW per cm²"
				size={14}
				weight={700}
				color="var(--sc-power)"
			/>
		</Readout>
		<Readout id="eff">
			<T
				x={RX + 16}
				y={182}
				text="efficiency {(efficiency * 100).toFixed(1)}% of 100 mW/cm²"
				size={13}
			/>
		</Readout>
		{#if phase === 'mpp'}
			<Readout id="ff" order={7} label="Fill factor" value="{(c.ff * 100).toFixed(1)}%">
				<T
					x={RX + 16}
					y={204 + 12}
					text="best: {c.vmp.toFixed(2)} V, {(c.efficiency * 100).toFixed(1)}%"
					size={13}
					weight={600}
				/>
				<T
					x={RX + 16}
					y={226 + 12}
					text="fill factor {(c.ff * 100).toFixed(1)}% (dashed box)"
					size={13}
				/>
			</Readout>
		{:else}
			{@const dV = (c.voc - ref.voc) * 1000}
			{@const dP = (c.pmax / ref.pmax - 1) * 100}
			<Readout
				id="dt"
				order={7}
				label="Compared with 25 °C"
				value="Voc {dV >= 0 ? '+' : ''}{dV.toFixed(0)} mV · best power {dP >= 0
					? '+'
					: ''}{dP.toFixed(1)}%"
			>
				<T
					x={RX + 16}
					y={216}
					text="vs 25 °C: Voc {dV >= 0 ? '+' : '−'}{Math.abs(dV).toFixed(0)} mV"
					size={13}
					weight={600}
				/>
				<T
					x={RX + 16}
					y={238}
					text="best power {dP >= 0 ? '+' : '−'}{Math.abs(dP).toFixed(1)}% ({(
						c.efficiency * 100
					).toFixed(1)}% efficient)"
					size={13}
				/>
			</Readout>
		{/if}
	{:else if phase === 'voc'}
		<!-- photons in and out -->
		{@const BW = 240}
		<rect x={RX + 16} y={180} width={BW} height="18" rx="3" fill="var(--sc-kept)" opacity="0.75" />
		<rect
			x={RX + 16}
			y={236}
			width={Math.max(1, BW * givenBack)}
			height="18"
			rx="3"
			fill="var(--sc-glow)"
			opacity="0.8"
		/>
		<Readout id="in">
			<T x={RX + 16} y={172} text="photons absorbed from the sunlight" size={12} muted />
		</Readout>
		<Readout
			id="out"
			order={6}
			label="Photons given back as glow"
			value="{glowText} of those absorbed"
			color="var(--sc-glow)"
		>
			<T x={RX + 16} y={228} text="photons the cell gives back (glow)" size={12} muted />
			<T
				x={RX + 16}
				y={276}
				text={givenBack < 0.001
					? `${glowText}: next to nothing`
					: `${(givenBack * 100).toFixed(1)}% of those absorbed`}
				size={14}
				weight={700}
				color="var(--sc-glow)"
			/>
		</Readout>
		<Readout id="gapshort">
			<T
				x={RX + 16}
				y={310}
				text="Voc is {((GAP - c.voc) * 1000).toFixed(0)} mV below the gap"
				size={13}
			/>
		</Readout>
	{/if}
</g>
