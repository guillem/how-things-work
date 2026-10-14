<script lang="ts">
	/**
	 * Standard sunlight (ASTM G173 AM1.5G) as power per eV of photon energy (`step.hints.phase`):
	 * - sun: the spectrum, the visible part in its colours, photons raining onto it in
	 *   proportion to the photon flux; totals on the right.
	 * - gap: a band gap (`params.gap`, draggable on the energy axis) splits the area under the
	 *   curve: below the gap grey (passes through), above it the gap's share of each photon
	 *   green (kept) and the rest orange (heat); a stacked bar shows the three fractions.
	 * - limit: the green is split again into the electrical output at the maximum power point
	 *   (each absorbed photon delivers Vmp·Jmp/Jsc eV) and the voltage loss (violet).
	 * Areas are powers: each bin's height is its power ÷ 0.01 eV.
	 */
	import {
		Handle,
		clamp,
		cycle,
		hash,
		lerp,
		scale,
		smoothstep,
		wavelengthToColor,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { E_START, E_STEP, FLUX, POWER } from '../spectrum';
	import {
		GAAS_GAP,
		GAPS,
		Q,
		SUN_FLUX,
		SUN_POWER,
		cell,
		photonEnergy,
		split,
		wavelength
	} from '../model';
	import Axes from '#lib/draw/Axes.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'sun'));
	const time = $derived(reduced ? 2.5 : t);
	const showGap = $derived(phase !== 'sun');
	const limit = $derived(phase === 'limit');
	const gap = $derived(clamp(Number(params.gap ?? GAPS.Si.gap), 0.5, 3));

	// ---- chart geometry -----------------------------------------------------------------------
	const X0 = 84;
	const X1 = 700;
	const Y0 = 96;
	const Y1 = 500;
	const EMAX = 4;
	const sx = scale([E_START, EMAX], [X0, X1]);
	const sy = scale([0, 800], [Y1, Y0]);
	const bins = POWER.map((p, i) => ({ i, lo: E_START + E_STEP * i, p: p / E_STEP })).filter(
		(b) => b.lo < EMAX - 1e-9
	);
	const curve = bins
		.map(
			(b, k) =>
				`${k ? 'L' : 'M'}${sx(b.lo).toFixed(1)} ${sy(b.p).toFixed(1)}L${sx(b.lo + E_STEP).toFixed(1)} ${sy(b.p).toFixed(1)}`
		)
		.join('');

	/** Closed area between y = lower(bin) and y = upper(bin) (in W/m²/eV), over bins from e0 to e1. */
	function area(
		e0: number,
		e1: number,
		lower: (b: (typeof bins)[number], e: number) => number,
		upper: (b: (typeof bins)[number], e: number) => number
	) {
		const top: string[] = [];
		const bottom: string[] = [];
		for (const b of bins) {
			const a = Math.max(b.lo, e0);
			const z = Math.min(b.lo + E_STEP, e1);
			if (z <= a) continue;
			const mid = (a + z) / 2;
			const u = sy(upper(b, mid)).toFixed(1);
			const l = sy(lower(b, mid)).toFixed(1);
			top.push(`${sx(a).toFixed(1)} ${u}L${sx(z).toFixed(1)} ${u}`);
			bottom.unshift(`${sx(z).toFixed(1)} ${l}L${sx(a).toFixed(1)} ${l}`);
		}
		if (!top.length) return '';
		return `M${top.join('L')}L${bottom.join('L')}Z`;
	}

	// Sun phase: the visible part in colour, the rest muted.
	const VIS_LO = photonEnergy(700);
	const VIS_HI = photonEnergy(400);
	const fullArea = area(
		E_START,
		EMAX,
		() => 0,
		(b) => b.p
	);
	const rainbowStops = Array.from({ length: 13 }, (_, k) => {
		const nm = 700 - (k * 300) / 12;
		return {
			k,
			offset: (sx(photonEnergy(nm)) - sx(VIS_LO)) / (sx(VIS_HI) - sx(VIS_LO)),
			color: wavelengthToColor(nm)
		};
	});
	const visibleArea = area(
		VIS_LO,
		VIS_HI,
		() => 0,
		(b) => b.p
	);

	// Gap phases: the regions.
	const c = $derived(cell(gap));
	const s = $derived(split(gap));
	/** eV delivered per absorbed photon at the maximum power point. */
	const delivered = $derived((c.vmp * c.jmp) / c.jsc);
	const belowArea = $derived(
		area(
			E_START,
			gap,
			() => 0,
			(b) => b.p
		)
	);
	const heatArea = $derived(
		area(
			gap,
			EMAX,
			(b, e) => (b.p * gap) / e,
			(b) => b.p
		)
	);
	const keptArea = $derived(
		area(
			gap,
			EMAX,
			() => 0,
			(b, e) => (b.p * gap) / e
		)
	);
	const outputArea = $derived(
		area(
			gap,
			EMAX,
			() => 0,
			(b, e) => (b.p * delivered) / e
		)
	);
	const voltageArea = $derived(
		area(
			gap,
			EMAX,
			(b, e) => (b.p * delivered) / e,
			(b, e) => (b.p * gap) / e
		)
	);

	// ---- the bar of fractions -------------------------------------------------------------------
	const BX = 752;
	const BW = 40;
	const slices = $derived(
		(limit
			? [
					{ id: 'below', label: 'passes through', f: s.below, color: 'var(--sc-below)' },
					{ id: 'heat', label: 'heat', f: s.heat, color: 'var(--sc-heat)' },
					{ id: 'voltage', label: 'voltage loss', f: s.voltage, color: 'var(--sc-voltage)' },
					{ id: 'output', label: 'electricity', f: s.output, color: 'var(--sc-output)' }
				]
			: [
					{ id: 'below', label: 'passes through', f: s.below, color: 'var(--sc-below)' },
					{ id: 'heat', label: 'heat', f: s.heat, color: 'var(--sc-heat)' },
					{
						id: 'kept',
						label: 'kept (gap × photons)',
						f: s.voltage + s.output,
						color: 'var(--sc-kept)'
					}
				]
		).reduce<{ id: string; label: string; f: number; color: string; y0: number; y1: number }[]>(
			(acc, sl) => {
				const y0 = acc.length ? acc[acc.length - 1].y1 : Y0;
				acc.push({ ...sl, y0, y1: y0 + sl.f * (Y1 - Y0) });
				return acc;
			},
			[]
		)
	);
	/** Label positions: centred on each slice, pushed apart to at least 34 px. */
	const labelYs = $derived.by(() => {
		const ys = slices.map((sl) => (sl.y0 + sl.y1) / 2);
		for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + 36);
		const over = ys[ys.length - 1] - (Y1 - 8);
		if (over > 0)
			for (let k = ys.length - 1; k >= 0; k--)
				ys[k] = Math.min(ys[k], k === ys.length - 1 ? Y1 - 8 : ys[k + 1] - 36);
		return ys;
	});

	// ---- photons raining onto the spectrum --------------------------------------------------------
	// Energies drawn from the photon flux (inverse of its cumulative sum), so where the rain is
	// dense is where the photons are.
	const cum = FLUX.reduce<number[]>((acc, f) => (acc.push((acc.at(-1) ?? 0) + f), acc), []);
	const energyAt = (u: number) => {
		const target = u * SUN_FLUX;
		const i = cum.findIndex((v) => v >= target);
		return E_START + E_STEP * (Math.max(0, i) + 0.5);
	};
	const N_RAIN = 26;
	const PERIOD = 3.2;
	const rainEnergies = Array.from({ length: 200 }, (_, k) =>
		energyAt((k + hash(k, 5)) / 200)
	).filter((e) => e < EMAX);
	const rain = $derived(
		Array.from({ length: N_RAIN }, (_, k) => {
			const u = cycle(time, PERIOD, k / N_RAIN);
			const n = Math.floor(time / PERIOD + k / N_RAIN) + k * 7;
			const e = rainEnergies[(n * 37 + k * 11) % rainEnergies.length];
			const bin = Math.min(bins.length - 1, Math.max(0, Math.floor((e - E_START) / E_STEP)));
			const yLand = sy(bins[bin].p) - 6;
			const yStart = Y0 + 70;
			const nm = wavelength(e);
			const below = showGap && e < gap;
			// Below the gap the photon falls on through, out under the axis.
			const yEnd = below ? Y1 - 6 : yLand;
			const y = lerp(yStart, yEnd, u);
			const fade = smoothstep(0, 0.12, u) * (1 - smoothstep(below ? 0.82 : 0.86, 1, u));
			const color = nm >= 400 && nm <= 700 ? wavelengthToColor(nm) : 'var(--stage-ink-muted)';
			return { k, x: sx(e), y, fade, color };
		})
	);

	// ---- gap handle ----------------------------------------------------------------------------
	const setGap = (g: number) => setParam('gap', Math.round(clamp(g, 0.5, 3) * 100) / 100);
	const onmove = (p: Point) => setGap(sx.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setGap(0.5) : k === 'end' ? setGap(3) : setGap(gap + k * 0.01);
	const materials = [
		{ id: 'ge', g: GAPS.Ge.gap, name: 'Ge' },
		{ id: 'si', g: GAPS.Si.gap, name: 'Si' },
		{ id: 'gaas', g: GAAS_GAP, name: 'GaAs' }
	];
	const nmTicks = [2000, 1000, 700, 500, 400, 300].filter((nm) => photonEnergy(nm) <= EMAX);
	const meanEv = SUN_POWER / SUN_FLUX / Q;
	const pct = (f: number) => `${(f * 100).toFixed(1)}%`;
</script>

<defs>
	<linearGradient
		id="spectrum-rainbow"
		gradientUnits="userSpaceOnUse"
		x1={sx(VIS_LO)}
		x2={sx(VIS_HI)}
		y1="0"
		y2="0"
	>
		{#each rainbowStops as st (st.k)}
			<stop offset={st.offset} stop-color={st.color} />
		{/each}
	</linearGradient>
</defs>

<g>
	<Axes
		{sx}
		{sy}
		xTicks={[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]}
		yTicks={[0, 200, 400, 600, 800]}
		xLabel="photon energy (eV)"
		yLabel="sunlight’s power per eV of photon energy (W/m² per eV)"
	/>
	<!-- wavelengths along the top -->
	<line x1={X0} x2={X1} y1={Y0 - 44} y2={Y0 - 44} stroke="var(--stage-grid)" />
	{#each nmTicks as nm (nm)}
		<line
			x1={sx(photonEnergy(nm))}
			x2={sx(photonEnergy(nm))}
			y1={Y0 - 48}
			y2={Y0 - 44}
			stroke="var(--stage-line)"
		/>
		<Readout id="nm-{nm}">
			<T x={sx(photonEnergy(nm))} y={Y0 - 54} text="{nm} nm" size={11} anchor="middle" muted />
		</Readout>
	{/each}
	<Readout id="nm-axis">
		<T x={X0 - 8} y={Y0 - 54} text="wavelength" size={11} anchor="end" muted />
	</Readout>

	{#if !showGap}
		<path d={fullArea} fill="var(--stage-ink-muted)" opacity="0.22" />
		<path d={visibleArea} fill="url(#spectrum-rainbow)" opacity="0.85" />
		<Readout id="bands">
			<T x={sx(0.8)} y={sy(80)} text="infrared" size={13} anchor="middle" muted />
			<T
				x={sx((VIS_LO + VIS_HI) / 2)}
				y={sy(560)}
				text="visible"
				size={13}
				anchor="middle"
				weight={700}
			/>
			<T x={sx(3.55)} y={sy(80)} text="ultraviolet" size={13} anchor="middle" muted />
		</Readout>
	{:else}
		<path d={belowArea} fill="var(--sc-below)" opacity="0.55" />
		<path d={heatArea} fill="var(--sc-heat)" opacity="0.55" />
		{#if limit}
			<path d={voltageArea} fill="var(--sc-voltage)" opacity="0.6" />
			<path d={outputArea} fill="var(--sc-output)" opacity="0.65" />
		{:else}
			<path d={keptArea} fill="var(--sc-kept)" opacity="0.65" />
		{/if}
	{/if}
	<path d={curve} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" opacity="0.85" />

	{#each rain as r (r.k)}
		<g transform="translate({r.x} {r.y})" opacity={r.fade}>
			<path d="M0 -12 q3 2 0 4 t0 4 t0 4" fill="none" stroke={r.color} stroke-width="1.6" />
			<circle cx="0" cy="0" r="2.6" fill={r.color} />
		</g>
	{/each}

	{#if showGap}
		<!-- the band gap -->
		<line
			x1={sx(gap)}
			x2={sx(gap)}
			y1={Y0}
			y2={Y1}
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
		<Readout
			id="gap"
			order={1}
			label="Band gap"
			value="{gap.toFixed(2)} eV · {wavelength(gap).toFixed(0)} nm"
		>
			<T
				x={sx(gap) + (gap > 2.6 ? -8 : 8)}
				y={Y0 + 18}
				text="band gap {gap.toFixed(2)} eV"
				size={14}
				weight={700}
				anchor={gap > 2.6 ? 'end' : 'start'}
			/>
		</Readout>
		<Readout id="weak">
			<T
				x={sx(gap) - 8}
				y={Y0 + 40}
				text="← too weak"
				size={12}
				anchor="end"
				muted
				opacity={gap > 0.75 ? 1 : 0}
			/>
			<T
				x={sx(gap) + 8}
				y={Y0 + 40}
				text="absorbed →"
				size={12}
				muted
				opacity={gap < 3.4 ? 1 : 0}
			/>
		</Readout>
		{#each materials as m (m.id)}
			<line x1={sx(m.g)} x2={sx(m.g)} y1={Y1 + 22} y2={Y1 + 27} stroke="var(--stage-ink-muted)" />
			<Readout id="mat-{m.id}">
				<T x={sx(m.g)} y={Y1 + 40} text={m.name} size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<Handle
			x={sx(gap)}
			y={Y1}
			label="Band gap"
			value={gap}
			min={0.5}
			max={3}
			valuetext="{gap.toFixed(2)} electron-volts"
			{onmove}
			{onkey}
		/>

		<!-- stacked bar: where the power goes -->
		{#each slices as sl (sl.id)}
			<rect
				x={BX}
				y={sl.y0}
				width={BW}
				height={Math.max(0, sl.y1 - sl.y0)}
				fill={sl.color}
				opacity="0.8"
			/>
		{/each}
		<rect x={BX} y={Y0} width={BW} height={Y1 - Y0} fill="none" stroke="var(--stage-line)" rx="2" />
		<Readout id="bar-title">
			<T x={BX + BW / 2} y={Y0 - 16} text="sunlight’s power" size={12} anchor="middle" muted />
		</Readout>
		{#each slices as sl, k (sl.id)}
			<line
				x1={BX + BW}
				x2={BX + BW + 10}
				y1={(sl.y0 + sl.y1) / 2}
				y2={labelYs[k]}
				stroke="var(--stage-line)"
			/>
			<Readout id="slice-{sl.id}" order={2 + k} label={sl.label} value={pct(sl.f)} color={sl.color}>
				<T x={BX + BW + 14} y={labelYs[k] - 3} text={sl.label} size={12} muted />
				<T x={BX + BW + 14} y={labelYs[k] + 14} text={pct(sl.f)} size={16} weight={700} />
			</Readout>
		{/each}
		{#if limit}
			<Readout id="eff" order={1.5} label="Ideal cell’s efficiency" value={pct(c.efficiency)}>
				<T
					x={X1 - 4}
					y={Y0 + 40}
					text="efficiency {pct(c.efficiency)}"
					size={16}
					weight={700}
					anchor="end"
				/>
				<T
					x={X1 - 4}
					y={Y0 + 60}
					text="Voc {c.voc.toFixed(2)} V · Vmp {c.vmp.toFixed(2)} V"
					size={12}
					anchor="end"
					muted
				/>
			</Readout>
		{:else}
			<Readout
				id="ceil"
				order={1.5}
				label="Ceiling from the spectrum alone"
				value={pct(s.voltage + s.output)}
			>
				<T
					x={X1 - 4}
					y={Y0 + 40}
					text="kept: {pct(s.voltage + s.output)}"
					size={16}
					weight={700}
					anchor="end"
				/>
				<T x={X1 - 4} y={Y0 + 60} text="not yet the limit" size={12} anchor="end" muted />
			</Readout>
		{/if}
	{:else}
		<Readout id="total" order={1} label="Total power" value="{SUN_POWER.toFixed(0)} W/m²">
			<T x={760} y={150} text="{SUN_POWER.toFixed(0)} W/m²" size={18} weight={700} />
			<T x={760} y={170} text="total power" size={12} muted />
		</Readout>
		<Readout id="count" order={2} label="Photons" value="4.3 × 10²¹ per m² per second">
			<T x={760} y={220} text="4.3 × 10²¹" size={18} weight={700} />
			<T x={760} y={240} text="photons per m² per second" size={12} muted />
		</Readout>
		<Readout id="mean" order={3} label="Average photon" value="{meanEv.toFixed(2)} eV">
			<T x={760} y={290} text="{meanEv.toFixed(2)} eV" size={18} weight={700} />
			<T x={760} y={310} text="average photon energy" size={12} muted />
		</Readout>
		<Readout id="source">
			<T x={760} y={380} text="ASTM G173 AM1.5 global:" size={11} muted />
			<T x={760} y={396} text="the standard test sunlight" size={11} muted />
		</Readout>
	{/if}
</g>
