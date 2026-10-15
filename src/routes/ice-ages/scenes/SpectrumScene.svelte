<script lang="ts">
	/**
	 * The rhythms of a record: its amplitude spectrum, computed on the page
	 * (`spectrum` in the model), over periods from 10,000 to 160,000 years on a
	 * logarithmic axis. Top: the series analysed (800,000 years). Bottom: the
	 * strength of each rhythm, as a share of the strongest, with the orbital
	 * periods marked. The `series` control picks Antarctic temperature, CO₂ or
	 * the 65° N summer sunshine; the curve glides between them.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CO2,
		TEMPERATURE,
		orbitSeries,
		resample,
		spectrum,
		spectrumPeriods
	} from '../milankovitch';

	let { t, params, reduced }: StageProps = $props();

	const PERIODS = spectrumPeriods(240, 10, 160);
	const SUMMER = orbitSeries(800, 0).map((p) => p.summer);
	const SETS = {
		temp: {
			name: 'Antarctic temperature',
			unit: '°C',
			digits: 1,
			color: 'var(--ia-temp)',
			series: resample(TEMPERATURE, 800, 0)
		},
		co2: {
			name: 'CO₂ in the air',
			unit: 'ppm',
			digits: 0,
			color: 'var(--ia-co2)',
			series: resample(CO2, 800, 0)
		},
		summer: {
			name: 'summer sunshine at 65° N',
			unit: 'W/m²',
			digits: 0,
			color: 'var(--ia-sun)',
			series: SUMMER
		}
	};
	type Key = keyof typeof SETS;
	const SPECTRA = Object.fromEntries(
		Object.entries(SETS).map(([k, s]) => {
			const amps = spectrum(s.series, PERIODS);
			const top = Math.max(...amps);
			return [k, { amps, rel: amps.map((a) => a / top) }];
		})
	) as Record<Key, { amps: number[]; rel: number[] }>;

	const key = $derived(
		(String(params.series ?? 'temp') in SETS ? String(params.series ?? 'temp') : 'temp') as Key
	);
	const set = $derived(SETS[key]);
	const shape = new Tween(
		untrack(() => SPECTRA[key].rel),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const k = key;
		untrack(() => shape.set(SPECTRA[k].rel));
	});

	// ------------------------------------------------------------ the series (top)
	const X0 = 110;
	const X1 = 900;
	const tx = scale([800, 0], [X0, X1]);
	const seriesPath = $derived.by(() => {
		const s = set.series;
		const lo = Math.min(...s);
		const hi = Math.max(...s);
		const sy = scale([lo, hi], [176, 70]);
		return linePath(
			s.map((v, i) => ({ ka: 800 - i, v })),
			(p) => p.ka,
			(p) => p.v,
			tx,
			sy
		);
	});

	// ------------------------------------------------------------ the spectrum (bottom)
	const px = (p: number) =>
		X0 + ((Math.log(p) - Math.log(10)) / (Math.log(160) - Math.log(10))) * (X1 - X0);
	const SB = 520;
	const ST = 270;
	const sy = scale([0, 1.08], [SB, ST]);
	const draw = $derived(reduced ? 1 : smoothstep(0.2, 2.2, t));
	const specPts = $derived(
		PERIODS.map((p, i) => ({ p, v: shape.current[i] ?? 0 })).filter(
			(d) => px(d.p) <= X0 + (X1 - X0) * draw + 1
		)
	);
	const specLine = $derived(
		specPts.map((d, i) => `${i ? 'L' : 'M'}${px(d.p).toFixed(1)} ${sy(d.v).toFixed(1)}`).join('')
	);
	const specArea = $derived(
		specPts.length > 1
			? `${specLine}L${px(specPts[specPts.length - 1].p).toFixed(1)} ${SB}L${px(specPts[0].p).toFixed(1)} ${SB}Z`
			: ''
	);
	const marks = [
		{ p: 19, name: 'wobble', sub: '19,000' },
		{ p: 23, name: 'wobble', sub: '23,000' },
		{ p: 41, name: 'tilt', sub: '41,000' },
		{ p: 100, name: 'stretch', sub: '~100,000' }
	];
	const markColor: Record<string, string> = {
		wobble: 'var(--ia-prec)',
		tilt: 'var(--ia-tilt)',
		stretch: 'var(--ia-ecc)'
	};
	const ticks = [10, 15, 20, 30, 50, 70, 100, 150];
	/** Strength of the record's beat near each orbital period (the largest within ±12%). */
	const beatAt = (k: Key, p: number) =>
		Math.max(...SPECTRA[k].amps.filter((_, i) => PERIODS[i] > p * 0.88 && PERIODS[i] < p * 1.12));
	const beats = $derived([100, 41, 23, 19].map((p) => ({ period: p, amp: beatAt(key, p) })));
	const thousand = (p: number) => `${Math.round(p)},000`;
	const beatText = $derived(
		beats.map((p) => `${thousand(p.period)} yr ±${p.amp.toFixed(set.digits)}`).join(' · ')
	);
</script>

<g>
	<Readout id="series" order={0} label="Record" value="{set.name}, 800,000 years">
		<Label
			x={X0}
			y={44}
			text="{set.name}, the last 800,000 years"
			anchor="start"
			size={14}
			weight={700}
			color={set.color}
		/>
	</Readout>
	<line x1={X0} x2={X1} y1={182} y2={182} stroke="var(--stage-line)" />
	{#each [800, 600, 400, 200, 0] as v (v)}
		<text x={tx(v)} y={198} text-anchor="middle" font-size="11" class="muted"
			>{v === 0 ? 'today' : `${v},000 yr ago`}</text
		>
	{/each}
	<path d={seriesPath} fill="none" stroke={set.color} stroke-width="1.3" />

	<Readout id="spec-title">
		<Label
			x={X0}
			y={ST - 26}
			text="Its rhythms: how strong each steady beat is (Fourier transform)"
			anchor="start"
			size={14}
			weight={700}
		/>
	</Readout>
	<!-- grid and axes -->
	{#each [0.25, 0.5, 0.75, 1] as g (g)}
		<line x1={X0} x2={X1} y1={sy(g)} y2={sy(g)} stroke="var(--stage-grid)" />
	{/each}
	<line x1={X0} x2={X1} y1={SB} y2={SB} stroke="var(--stage-line)" />
	<line x1={X0} x2={X0} y1={ST} y2={SB} stroke="var(--stage-line)" />
	<text x={X0 - 8} y={sy(1) + 4} text-anchor="end" font-size="11" class="muted">strongest</text>
	<text x={X0 - 8} y={sy(0) + 4} text-anchor="end" font-size="11" class="muted">0</text>
	{#each ticks as v (v)}
		<line x1={px(v)} x2={px(v)} y1={SB} y2={SB + 4} stroke="var(--stage-line)" />
		<text x={px(v)} y={SB + 17} text-anchor="middle" font-size="11" class="muted">{v}</text>
	{/each}
	<text x={X1} y={SB + 34} text-anchor="end" font-size="11" class="muted"
		>period, thousand years (log scale)</text
	>

	<!-- orbital periods -->
	{#each marks as m (m.p)}
		<line
			x1={px(m.p)}
			x2={px(m.p)}
			y1={ST - 6}
			y2={SB}
			stroke={markColor[m.name]}
			stroke-width="1.3"
			stroke-dasharray="4 4"
		/>
	{/each}
	<path d={specArea} fill={set.color} opacity="0.15" />
	<path d={specLine} fill="none" stroke={set.color} stroke-width="2.5" stroke-linejoin="round" />
	<Readout id="marks">
		{#each marks as m (m.p)}
			<Label
				x={px(m.p) + (m.p === 19 ? -4 : m.p === 23 ? 4 : 0)}
				y={ST - 10}
				text={m.p === 19 || m.p === 23 ? m.sub : `${m.name} ${m.sub}`}
				anchor={m.p === 19 ? 'end' : m.p === 23 ? 'start' : 'middle'}
				size={11}
				weight={600}
				color={markColor[m.name]}
			/>
		{/each}
		<Label
			x={(px(19) + px(23)) / 2}
			y={ST + 8}
			text="wobble"
			size={11}
			weight={600}
			color="var(--ia-prec)"
		/>
	</Readout>

	{#if draw >= 1}
		<Readout
			id="peaks"
			order={1}
			label="Beats at the orbital periods"
			value="{beatText} {set.unit}"
			color={set.color}
		>
			<Label
				x={X1}
				y={572}
				text="beats: {beatText} {set.unit}"
				anchor="end"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
