<script lang="ts">
	/**
	 * Locating the 2015 Gorkha earthquake from real seismograms (`locate.ts`).
	 *
	 * Phases (`step.hints.phase`):
	 * - lag: the Ankara recording (up–down and sideways motion), with the P arrival picked and an
	 *   S marker the reader drags (`params.lagAnto`, S − P in seconds), and the ak135 chart of
	 *   S − P against distance turning that gap into a distance.
	 * - locate: a map with a circle of that distance round each of three stations (Ankara,
	 *   Taipei, Diego Garcia; `params.lagAnto`, `lagTato`, `lagDgar`), drawn on the sphere, and
	 *   the three recordings. When the circles meet, the epicentre is marked.
	 *
	 * Wiggle heights are compressed (signed power 0.6) so that the small P wave shows next to
	 * the big S wave.
	 */
	import { Handle, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { land } from '../../plate-tectonics/globe';
	import { EARTH_R, arrivalOf, sMinusP } from '../earth';
	import { ORIGIN, bestFit, distanceFor, gcDistance, smallCircle, stations } from '../locate';

	let { step, params, setParam }: StageProps = $props();

	type Phase = 'lag' | 'locate';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'lag');

	const IDS = ['lagAnto', 'lagTato', 'lagDgar'] as const;
	const DEFAULTS = [300, 420, 250];
	const COLORS = ['var(--eq-p)', 'var(--eq-station)', 'var(--eq-quake)'];
	const lags = $derived(IDS.map((id, i) => Number(params[id] ?? DEFAULTS[i])));
	const dists = $derived(lags.map((l) => distanceFor(l)));
	const KM = (Math.PI / 180) * EARTH_R;
	const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
	const minSec = (v: number) =>
		`${Math.floor(v / 60)} min ${String(Math.round(v % 60)).padStart(2, '0')} s`;

	// ---- seismograms ----------------------------------------------------------------------
	const T0 = 330;
	const T1 = 1100;
	interface Box {
		x0: number;
		x1: number;
		y: number;
		h: number;
	}
	const boxes = $derived<Box[]>(
		phase === 'lag'
			? [{ x0: 70, x1: 570, y: 100, h: 230 }]
			: [0, 1, 2].map((i) => ({ x0: 610, x1: 930, y: 84 + i * 168, h: 104 }))
	);
	const shown = $derived(phase === 'lag' ? [0] : [0, 1, 2]);
	const xOf = (b: Box, s: number) => b.x0 + ((s - T0) / (T1 - T0)) * (b.x1 - b.x0);
	const sOf = (b: Box, x: number) => T0 + ((x - b.x0) / (b.x1 - b.x0)) * (T1 - T0);
	const squash = (v: number) => Math.sign(v) * Math.pow(Math.abs(v) / 1000, 0.6) * 0.85;
	/** The envelope of one trace as vertical strokes, one per second. */
	function trace(env: number[], b: Box, mid: number, half: number) {
		let d = '';
		for (let s = T0; s < T1; s++) {
			const lo = squash(env[2 * s]);
			const hi = squash(env[2 * s + 1]);
			const x = xOf(b, s).toFixed(1);
			d += `M${x} ${(mid - Math.min(1.15, hi) * half).toFixed(1)}V${(mid - Math.max(-1.15, lo) * half).toFixed(1)}`;
		}
		return d;
	}
	const traces = $derived(
		shown.map((k, j) => {
			const b = boxes[j];
			const rec = stations[k].rec;
			const half = b.h / 4 - 4;
			return {
				k,
				b,
				z: trace(rec.z, b, b.y + b.h / 4, half),
				t: trace(rec.t, b, b.y + (3 * b.h) / 4, half)
			};
		})
	);

	function dragS(k: number, b: Box, x: number) {
		const s = sOf(b, x);
		setParam(IDS[k], Math.round(Math.max(120, Math.min(600, s - stations[k].rec.pPick))));
	}
	function keyS(k: number, step: number | 'start' | 'end') {
		const v = step === 'start' ? 120 : step === 'end' ? 600 : lags[k] + step;
		setParam(IDS[k], Math.max(120, Math.min(600, v)));
	}
	/** Within this many seconds of the S − P that ak135 predicts at the true distance. */
	const onS = (k: number) => Math.abs(lags[k] - stations[k].lag) < 15;

	// ---- S − P chart (lag) ------------------------------------------------------------------
	const CH = { x0: 650, x1: 930, y0: 120, y1: 420, dmax: 100, lmax: 12 * 60 };
	const cx = (d: number) => CH.x0 + (d / CH.dmax) * (CH.x1 - CH.x0);
	const cy = (l: number) => CH.y1 - (l / CH.lmax) * (CH.y1 - CH.y0);
	const curve = Array.from({ length: 50 }, (_, i) => {
		const d = 1 + i * 2;
		return `${i ? 'L' : 'M'}${cx(d).toFixed(1)} ${cy(sMinusP(d, ORIGIN.depth) ?? 0).toFixed(1)}`;
	}).join('');
	// The same chart for an Earth of the same rock all through: the same gap, a different distance.
	const lagUniform = (d: number) =>
		arrivalOf('S', d, ORIGIN.depth, 'uniform')! - arrivalOf('P', d, ORIGIN.depth, 'uniform')!;
	const uniformTo = (() => {
		let d = 1;
		while (lagUniform(d + 1) <= CH.lmax) d++;
		return d;
	})();
	const curveUniform = Array.from({ length: uniformTo }, (_, i) => {
		const d = 1 + i;
		return `${i ? 'L' : 'M'}${cx(d).toFixed(1)} ${cy(lagUniform(d)).toFixed(1)}`;
	}).join('');

	// ---- map (locate) -----------------------------------------------------------------------
	const MAP = { x: 16, y: 70, w: 560, lon0: 15, lon1: 155, lat1: 72 };
	const PPD = MAP.w / (MAP.lon1 - MAP.lon0);
	const MAP_H = 470;
	const lat0 = MAP.lat1 - MAP_H / PPD;
	const mx = (lon: number) => MAP.x + (lon - MAP.lon0) * PPD;
	const my = (lat: number) => MAP.y + (MAP.lat1 - lat) * PPD;
	const landPath = land
		.filter((ring) =>
			ring.some(([lon, lat]) => lon > MAP.lon0 - 30 && lon < MAP.lon1 + 30 && lat > lat0 - 20)
		)
		.map(
			(ring) =>
				ring
					.map(([lon, lat], i) => `${i ? 'L' : 'M'}${mx(lon).toFixed(1)} ${my(lat).toFixed(1)}`)
					.join('') + 'Z'
		)
		.join('');
	const circles = $derived(
		dists.map((d, k) => {
			const pts = smallCircle(stations[k].rec.lat, stations[k].rec.lon, d, 240);
			let path = '';
			let prev: number | null = null;
			for (const [lon, lat] of pts) {
				const jump = prev !== null && Math.abs(lon - prev) > 180;
				path += `${path === '' || jump ? 'M' : 'L'}${mx(lon).toFixed(1)} ${my(lat).toFixed(1)}`;
				prev = lon;
			}
			return path;
		})
	);
	const fit = $derived(
		phase === 'locate'
			? bestFit(
					stations.map((s) => s.rec),
					dists
				)
			: null
	);
	/** Found when every S marker is on its S wave (the same test as the ✓). Readings by eye are
	 * good to several seconds, so the circles then cross within a degree or two of each other. */
	const found = $derived(fit !== null && [0, 1, 2].every((k) => onS(k)));
	const missKm = $derived(fit ? gcDistance(fit.lat, fit.lon, ORIGIN.lat, ORIGIN.lon) * KM : 0);
</script>

<g class="locate-scene">
	{#if phase === 'locate'}
		<!-- the map -->
		<defs>
			<clipPath id="locate-scene-map">
				<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP_H} rx="6" />
			</clipPath>
		</defs>
		<rect
			x={MAP.x}
			y={MAP.y}
			width={MAP.w}
			height={MAP_H}
			rx="6"
			fill="var(--pt-map-sea)"
			stroke="var(--border)"
		/>
		<g clip-path="url(#locate-scene-map)">
			<path d={landPath} fill="var(--pt-land)" stroke="var(--pt-land-edge)" stroke-width="0.6" />
			{#each circles as c, k (k)}
				<path d={c} fill="none" stroke={COLORS[k]} stroke-width="2.2" opacity="0.9" />
			{/each}
			{#each stations as s, k (s.rec.sta)}
				<path
					transform="translate({mx(s.rec.lon)} {my(s.rec.lat)})"
					d="M0 -8 L7 5 L-7 5 Z"
					fill={COLORS[k]}
					stroke="var(--stage-bg)"
					stroke-width="1"
				/>
				<Readout id="m-{s.rec.sta}">
					<Label
						x={mx(s.rec.lon)}
						y={my(s.rec.lat) + 20}
						text={s.rec.name}
						size={12}
						weight={600}
					/>
				</Readout>
			{/each}
			{#if fit && fit.rms < 2}
				<circle
					cx={mx(fit.lon)}
					cy={my(fit.lat)}
					r="9"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.6"
				/>
			{/if}
			{#if found}
				<path
					transform="translate({mx(ORIGIN.lon)} {my(ORIGIN.lat)})"
					d="M0 -11 L3.2 -3.7 11 -3.4 4.9 1.7 6.8 9.8 0 5.4 -6.8 9.8 -4.9 1.7 -11 -3.4 -3.2 -3.7 Z"
					fill="var(--eq-quake)"
					stroke="var(--stage-bg)"
				/>
			{/if}
		</g>
		<Readout
			id="m-result"
			order={1}
			label={found ? 'Epicentre found' : 'The circles'}
			value={found
				? `Nepal, ${fmt(missKm)} km from where the USGS put it`
				: 'don’t meet yet: move the S markers'}
		>
			<text x={MAP.x} y={MAP.y - 26} font-size="15" style:font-weight="600">
				{found ? 'They meet: the epicentre, in Nepal' : 'Where do the three circles meet?'}
			</text>
			{#if found}
				<text x={MAP.x} y={MAP.y - 8} class="muted" font-size="12"
					>{fmt(missKm)} km from the USGS location (28.23° N, 84.73° E)</text
				>
			{/if}
		</Readout>
	{/if}

	<!-- seismograms -->
	{#each traces as tr (tr.k)}
		{@const s = stations[tr.k]}
		{@const b = tr.b}
		{@const xp = xOf(b, s.rec.pPick)}
		{@const xs = xOf(b, s.rec.pPick + lags[tr.k])}
		<Readout
			id="tr-{s.rec.sta}"
			order={2 + tr.k}
			label="{s.rec.name}: S − P"
			value="{minSec(lags[tr.k])} → {Math.round(dists[tr.k])}° · {fmt(dists[tr.k] * KM)} km"
			color={phase === 'locate' ? COLORS[tr.k] : undefined}
		>
			<text
				x={b.x0}
				y={b.y - 8}
				style:font-weight="600"
				style:fill={phase === 'locate' ? COLORS[tr.k] : undefined}
				>{s.rec.name}{phase === 'lag' ? ` (${s.rec.net}.${s.rec.sta}), 25 April 2015` : ''}</text
			>
			<text x={b.x1} y={b.y - 8} text-anchor="end" font-size="12"
				>S − P {minSec(lags[tr.k])} → {fmt(dists[tr.k] * KM)} km</text
			>
		</Readout>
		<rect
			x={b.x0}
			y={b.y}
			width={b.x1 - b.x0}
			height={b.h}
			fill="var(--surface)"
			stroke="var(--border)"
			rx="4"
		/>
		<path d={tr.z} stroke="var(--stage-ink)" stroke-width="1" opacity="0.8" />
		<path d={tr.t} stroke="var(--stage-ink)" stroke-width="1" opacity="0.8" />
		<Readout id="tr-lab-{s.rec.sta}">
			<Label x={b.x0 + 4} y={b.y + 13} text="up–down" size={11} anchor="start" muted />
			<Label
				x={b.x0 + 4}
				y={b.y + b.h / 2 + 13}
				text="side to side"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
		<!-- P picked, S dragged -->
		<path d="M{xp} {b.y}V{b.y + b.h}" stroke="var(--eq-p)" stroke-width="2" />
		<Label x={xp} y={b.y + b.h + 14} text="P" size={12} weight={700} color="var(--eq-p)" />
		<path d="M{xp} {b.y + b.h + 24}H{xs}" stroke="var(--stage-ink-muted)" stroke-width="1" />
		<path d="M{xs} {b.y}V{b.y + b.h}" stroke="var(--eq-s)" stroke-width="2" />
		<Handle
			x={xs}
			y={b.y + b.h + 24}
			r={7}
			label="S arrival at {s.rec.name}"
			value={lags[tr.k]}
			min={120}
			max={600}
			valuetext="{minSec(lags[tr.k])} after P"
			color="var(--eq-s)"
			onmove={(p: { x: number; y: number }) => dragS(tr.k, b, p.x)}
			onkey={(k: number | 'start' | 'end') => keyS(tr.k, k)}
		/>
		<Label
			x={xs + 14}
			y={b.y + b.h + 28}
			text={onS(tr.k) ? 'S ✓' : 'S'}
			size={12}
			weight={700}
			anchor="start"
			color="var(--eq-s)"
		/>
		{#if phase === 'lag'}
			{#each [6, 8, 10, 12, 14, 16, 18] as m (m)}
				<path d="M{xOf(b, m * 60)} {b.y + b.h}v5" stroke="var(--stage-ink-muted)" />
				<Readout id="tt-{m}">
					<text
						x={xOf(b, m * 60)}
						y={b.y + b.h + 50}
						text-anchor="middle"
						class="muted"
						font-size="11">{m} min</text
					>
				</Readout>
			{/each}
		{/if}
	{/each}

	{#if phase === 'lag'}
		<Readout id="tt-axis">
			<text x={320} y={404} text-anchor="middle" class="muted" font-size="11"
				>minutes after the earthquake</text
			>
		</Readout>
		<Readout
			id="lag-note"
			order={6}
			label="Drag"
			value="the S marker to where the sideways shaking jumps"
		>
			<text x={70} y={450} font-size="13"
				>Drag the <tspan style:fill="var(--eq-s)" style:font-weight="600">S marker</tspan> to where the
				side-to-side shaking suddenly grows.</text
			>
			<text x={70} y={472} class="muted" font-size="12"
				>The P wave was picked automatically, where the up-and-down shaking first jumps.</text
			>
			<text x={70} y={490} class="muted" font-size="12"
				>Wiggle heights are compressed so the small ones show.</text
			>
		</Readout>
		<!-- the chart: S − P against distance -->
		<Readout id="ch-title">
			<text x={CH.x0 - 30} y={CH.y0 - 30} font-size="14" style:font-weight="600"
				>S − P against distance (ak135)</text
			>
		</Readout>
		<rect
			x={CH.x0}
			y={CH.y0}
			width={CH.x1 - CH.x0}
			height={CH.y1 - CH.y0}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each [0, 20, 40, 60, 80, 100] as d (d)}
			<path d="M{cx(d)} {CH.y0}V{CH.y1}" stroke="var(--stage-grid)" />
			<Readout id="chx-{d}">
				<text x={cx(d)} y={CH.y1 + 16} text-anchor="middle" class="muted" font-size="11">{d}°</text>
			</Readout>
		{/each}
		{#each [0, 4, 8, 12] as m (m)}
			<path d="M{CH.x0} {cy(m * 60)}H{CH.x1}" stroke="var(--stage-grid)" />
			<Readout id="chy-{m}">
				<text x={CH.x0 - 6} y={cy(m * 60) + 4} text-anchor="end" class="muted" font-size="11"
					>{m} min</text
				>
			</Readout>
		{/each}
		<Readout id="ch-axis">
			<text x={(CH.x0 + CH.x1) / 2} y={CH.y1 + 34} text-anchor="middle" class="muted" font-size="11"
				>distance round the Earth</text
			>
		</Readout>
		<path
			d={curveUniform}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
			fill="none"
		/>
		<Readout
			id="ch-uniform"
			order={8}
			label="Dashed line"
			value="if the Earth were the same rock all through"
		>
			<text x={cx(uniformTo) - 30} y={CH.y0 + 16} text-anchor="end" class="muted" font-size="11"
				><tspan x={cx(uniformTo) - 30}>if the Earth were</tspan><tspan
					x={cx(uniformTo) - 30}
					dy="14">the same rock all through</tspan
				></text
			>
		</Readout>
		<path d={curve} stroke="var(--stage-ink)" stroke-width="2.2" fill="none" />
		<path
			d="M{CH.x0} {cy(lags[0])}H{cx(dists[0])}V{CH.y1}"
			stroke="var(--eq-s)"
			stroke-width="1.6"
			stroke-dasharray="4 3"
			fill="none"
		/>
		<circle cx={cx(dists[0])} cy={cy(lags[0])} r="4.5" fill="var(--eq-s)" />
		<Readout
			id="ch-read"
			order={7}
			label="Ankara is"
			value="{Math.round(dists[0])}° · {fmt(dists[0] * KM)} km from the earthquake"
		>
			<text x={CH.x0} y={CH.y1 + 64} font-size="14">
				→ <tspan style:font-weight="600">{Math.round(dists[0])}°</tspan> round the Earth: {fmt(
					dists[0] * KM
				)} km
			</text>
		</Readout>
	{/if}
</g>
