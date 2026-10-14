<script lang="ts">
	/**
	 * A slice through the Earth with an earthquake at the top: P and S rays traced through ak135
	 * (`earth.ts`), revealed as the waves travel, with their wave fronts. The animation runs 100
	 * times faster than the real waves; the clock shows real time.
	 *
	 * Phases (`step.hints.phase`):
	 * - trigger: P and S, with the times they reach a quarter of the way round and the far side.
	 * - bending: P only, beside a chart of the speeds against depth; `params.earth` = 'uniform'
	 *   swaps in an Earth of the same rock all through (straight rays).
	 * - s-shadow: S only; the rays that reach the liquid core stop there; the shadow is marked.
	 * - p-shadow: P only; the shadow between the direct and the core waves is marked; the waves
	 *   that cross or bounce off the inner core are drawn faintly.
	 * - inner-core: P only, with the inner-core waves highlighted; `params.innerCore` = false
	 *   makes the core liquid to the centre.
	 * - station: P and S, with a seismometer the reader drags round the surface
	 *   (`params.station`, degrees) and the arrivals it records.
	 * - summary: P and S, the layers labelled with what the waves showed.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { AK135 } from '../data/ak135';
	import {
		CMB_DEPTH,
		EARTH_R,
		ICB_DEPTH,
		arrivalOf,
		arrivals,
		fan,
		pkpRange,
		reach,
		shadowStart,
		surfaceDistance,
		type EarthModel,
		type Ray,
		type RayKind,
		type Wave
	} from '../earth';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type Phase =
		'trigger' | 'bending' | 's-shadow' | 'p-shadow' | 'inner-core' | 'station' | 'summary';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'trigger');

	// ---- geometry ---------------------------------------------------------------------
	const C = { x: 284, y: 302 };
	const RP = 266;
	const K = RP / EARTH_R;
	const DEPTH = 10; // km: a typical shallow earthquake
	const SPEEDUP = 100;
	const END = 1620; // s of seismic time shown (S reaches 100° after ~25 min)
	const rCmb = (EARTH_R - CMB_DEPTH) * K;
	const rIcb = (EARTH_R - ICB_DEPTH) * K;
	/** A point on the circle of radius `r` px at `deg` degrees round from the top (+ clockwise). */
	const at = (deg: number, r: number): [number, number] => [
		C.x + r * Math.sin((deg * Math.PI) / 180),
		C.y - r * Math.cos((deg * Math.PI) / 180)
	];
	const arc = (a: number, b: number, r: number) => {
		const n = Math.max(2, Math.ceil(Math.abs(b - a) / 2));
		return Array.from({ length: n + 1 }, (_, i) => at(a + ((b - a) * i) / n, r))
			.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
			.join('');
	};

	interface Drawn {
		key: string;
		kind: RayKind;
		xs: Float64Array;
		ys: Float64Array;
		ts: Float64Array;
		total: number;
		full: string;
		/** Where it lands, degrees from the earthquake (both sides alike). */
		land: number;
	}
	/** Ray paths in stage pixels: per wave, one list ordered from the left horizon, down
	 * through the vertical, to the right horizon (neighbours in the list are neighbours in the
	 * wave front). */
	function prepare(model: EarthModel): Record<Wave, Drawn[]> {
		const out = { P: [] as Drawn[], S: [] as Drawn[] };
		for (const wave of ['P', 'S'] as const) {
			const rays = fan(wave, DEPTH, model);
			const one = (r: Ray, side: 1 | -1, i: number): Drawn => {
				// Thin the path to points at least ~4 px apart (the turning point kept).
				const pts = r.points;
				const xs: number[] = [];
				const ys: number[] = [];
				const ts: number[] = [];
				for (let j = 0; j < pts.length; j++) {
					const x = C.x + side * pts[j].r * Math.sin(pts[j].th) * K;
					const y = C.y - pts[j].r * Math.cos(pts[j].th) * K;
					const n = xs.length;
					const last = j === pts.length - 1;
					if (
						n === 0 ||
						last ||
						pts[j].r === r.deepest ||
						Math.hypot(x - xs[n - 1], y - ys[n - 1]) > 4
					) {
						xs.push(x);
						ys.push(y);
						ts.push(pts[j].t);
					}
				}
				const full = xs
					.map((x, j) => `${j ? 'L' : 'M'}${x.toFixed(1)} ${ys[j].toFixed(1)}`)
					.join('');
				return {
					key: `${wave}${side}-${i}`,
					kind: r.kind,
					xs: Float64Array.from(xs),
					ys: Float64Array.from(ys),
					ts: Float64Array.from(ts),
					total: r.time,
					full,
					land: surfaceDistance(r.angle)
				};
			};
			const right = rays.map((r, i) => one(r, 1, i));
			const left = rays.map((r, i) => one(r, -1, i));
			out[wave] = [...left.reverse(), ...right];
		}
		return out;
	}
	const cache = new Map<EarthModel, Record<Wave, Drawn[]>>();
	const raysFor = (m: EarthModel) => {
		let r = cache.get(m);
		if (!r) cache.set(m, (r = prepare(m)));
		return r;
	};

	const model = $derived<EarthModel>(
		phase === 'bending' && params.earth === 'uniform'
			? 'uniform'
			: phase === 'inner-core' && params.innerCore === false
				? 'liquid-core'
				: 'ak135'
	);
	const rays = $derived(raysFor(model));

	// ---- time ---------------------------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${model}|${params.quake ?? 0}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	/** Seismic time, s (reduced motion: everything has arrived). */
	const tau = $derived(reduced ? END : Math.min(END, since * SPEEDUP));
	const clock = (s: number) =>
		`${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;

	// ---- what is shown ------------------------------------------------------------------
	const fade = (on: () => number) => {
		const tw = new Tween(on(), { duration: 700, easing: cubicInOut });
		$effect(() => {
			const v = on();
			untrack(() => tw.set(v, { duration: reduced ? 0 : 700 }));
		});
		return tw;
	};
	const showP = $derived(phase !== 's-shadow');
	const showS = $derived(['trigger', 's-shadow', 'station', 'summary'].includes(phase));
	const oP = fade(() => (showP ? 1 : 0));
	const oS = fade(() => (showS ? 1 : 0));
	const innerFocus = $derived(phase === 'inner-core');
	const innerFaint = $derived(phase === 'p-shadow');
	const oChart = fade(() => (phase === 'bending' ? 1 : 0));
	const liquid = $derived(model === 'liquid-core');

	const colorOf = (kind: RayKind) =>
		kind === 'S' || kind === 'blocked'
			? 'var(--eq-s)'
			: innerFocus && (kind === 'PKIKP' || kind === 'PKiKP')
				? 'var(--eq-inner-wave)'
				: 'var(--eq-p)';
	const rayOpacity = (kind: RayKind) =>
		innerFaint && (kind === 'PKIKP' || kind === 'PKiKP')
			? 0.18
			: innerFocus && kind !== 'PKIKP' && kind !== 'PKiKP'
				? 0.3
				: 0.6;

	/** The part of a ray travelled by time `s`, and its tip. */
	function upTo(d: Drawn, s: number): { d: string; tip: [number, number] | null } {
		if (s >= d.total) return { d: d.full, tip: null };
		let out = '';
		let i = 0;
		for (; i < d.ts.length && d.ts[i] <= s; i++)
			out += `${i ? 'L' : 'M'}${d.xs[i].toFixed(1)} ${d.ys[i].toFixed(1)}`;
		if (i === 0 || i >= d.ts.length) return { d: out, tip: null };
		const u = (s - d.ts[i - 1]) / (d.ts[i] - d.ts[i - 1]);
		const x = d.xs[i - 1] + (d.xs[i] - d.xs[i - 1]) * u;
		const y = d.ys[i - 1] + (d.ys[i] - d.ys[i - 1]) * u;
		return { d: `${out}L${x.toFixed(1)} ${y.toFixed(1)}`, tip: [x, y] };
	}

	/** Rays (partial), wave fronts and the stops of S waves at the core, for one wave. */
	function draw(wave: Wave, s: number) {
		const list = rays[wave];
		const parts = list.map((d) => ({ key: d.key, kind: d.kind, ...upTo(d, s) }));
		let front = '';
		let tips = '';
		for (let i = 0; i < parts.length; i++) {
			const a = parts[i].tip;
			if (!a) continue;
			tips += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}h0`;
			const b = parts[i + 1]?.tip;
			if (b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 46)
				front += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
		}
		let stops = '';
		if (wave === 'S')
			for (const d of list)
				if (d.kind === 'blocked' && s >= d.total) {
					const x = d.xs[d.xs.length - 1];
					const y = d.ys[d.ys.length - 1];
					stops += `M${(x - 3).toFixed(1)} ${(y - 3).toFixed(1)}l6 6M${(x + 3).toFixed(1)} ${(y - 3).toFixed(1)}l-6 6`;
				}
		return { parts, front, tips, stops };
	}
	const pDraw = $derived(showP || oP.current > 0.02 ? draw('P', tau) : null);
	const sDraw = $derived(showS || oS.current > 0.02 ? draw('S', tau) : null);

	// ---- the numbers ---------------------------------------------------------------------
	const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
	const sEdge = $derived(shadowStart('S', DEPTH));
	const pEdge = $derived(shadowStart('P', DEPTH));
	const coreFrom = $derived(pkpRange(DEPTH, model === 'uniform' ? 'ak135' : model)[0]);
	const innerFrom = $derived(
		model === 'ak135' ? Math.min(...reach('PKIKP', DEPTH).map((iv) => iv[0])) : null
	);
	const t90 = arrivalOf('P', 90, DEPTH)!;
	const tFar = arrivalOf('PKIKP', 179.99, DEPTH)!;
	const s90 = arrivalOf('S', 90, DEPTH)!;
	const t90u = arrivalOf('P', 90, DEPTH, 'uniform')!;

	// ---- the seismometer ------------------------------------------------------------------
	const stationDeg = $derived(Math.max(0, Math.min(180, Number(params.station ?? 40))));
	const stationXY = $derived(at(stationDeg, RP + 2));
	/** First arrivals at the seismometer; the waves through and off the inner core, which
	 * arrive within seconds of each other, count as one. */
	const arr = $derived.by(() => {
		if (phase !== 'station') return [];
		const out: { kind: 'P' | 'S' | 'PKP' | 'PKIKP'; time: number }[] = [];
		for (const a of arrivals(stationDeg, DEPTH)) {
			const kind = a.kind === 'PKiKP' ? 'PKIKP' : a.kind;
			if (!out.some((o) => o.kind === kind)) out.push({ kind, time: a.time });
		}
		return out;
	});
	const KIND_NAME: Record<string, string> = {
		P: 'P',
		S: 'S',
		PKP: 'P through the core',
		PKIKP: 'P via the inner core'
	};
	const KIND_SHORT: Record<string, string> = { P: 'P', S: 'S', PKP: 'core', PKIKP: 'inner core' };
	const kindColor = (k: string) =>
		k === 'S' ? 'var(--eq-s)' : k === 'PKIKP' ? 'var(--eq-inner-wave)' : 'var(--eq-p)';
	const near = (d: Drawn) => phase === 'station' && Math.abs(d.land - stationDeg) < 1.6;
	function moveStation(p: { x: number; y: number }) {
		const a = (Math.atan2(p.x - C.x, -(p.y - C.y)) * 180) / Math.PI;
		setParam('station', Math.round(Math.abs(a)));
	}
	const pTime = $derived(arr.find((a) => a.kind === 'P')?.time ?? null);
	const sTime = $derived(arr.find((a) => a.kind === 'S')?.time ?? null);

	// ---- chart of the speeds (bending) ------------------------------------------------------
	const CH = { x0: 690, x1: 936, y0: 96, y1: 548, vmax: 14 };
	const sx = (v: number) => CH.x0 + (v / CH.vmax) * (CH.x1 - CH.x0);
	const sy = (d: number) => CH.y0 + (d / EARTH_R) * (CH.y1 - CH.y0);
	const curve = (col: 1 | 2) =>
		AK135.map((r, i) => `${i ? 'L' : 'M'}${sx(r[col]).toFixed(1)} ${sy(r[0]).toFixed(1)}`).join('');
	const pCurve = curve(1);
	const sCurve = curve(2);
	const LAYERS = [
		{ id: 'crust', top: 0, bot: 35, fill: 'var(--eq-crust)' },
		{ id: 'mantle', top: 35, bot: CMB_DEPTH, fill: 'var(--eq-mantle-deep)' },
		{ id: 'outer', top: CMB_DEPTH, bot: ICB_DEPTH, fill: 'var(--eq-outer)' },
		{ id: 'inner', top: ICB_DEPTH, bot: EARTH_R, fill: 'var(--eq-inner)' }
	];

	// ---- timeline (station) ----------------------------------------------------------------
	const TL = { x0: 630, x1: 930, y: 300, max: 1560 };
	const tx = (s: number) => TL.x0 + (s / TL.max) * (TL.x1 - TL.x0);
</script>

<g class="earth-scene">
	<defs>
		<radialGradient id="earth-scene-mantle" gradientUnits="userSpaceOnUse" cx={C.x} cy={C.y} r={RP}>
			<stop offset={rCmb / RP} stop-color="var(--eq-mantle-deep)" />
			<stop offset="1" stop-color="var(--eq-mantle)" />
		</radialGradient>
	</defs>

	<!-- the layers -->
	<circle cx={C.x} cy={C.y} r={RP} fill="url(#earth-scene-mantle)" />
	<circle cx={C.x} cy={C.y} r={RP} fill="none" stroke="var(--eq-crust)" stroke-width="2.5" />
	<circle cx={C.x} cy={C.y} r={rCmb} fill="var(--eq-outer)" />
	<circle
		cx={C.x}
		cy={C.y}
		r={rIcb}
		fill={liquid ? 'var(--eq-outer)' : 'var(--eq-inner)'}
		stroke={liquid ? 'var(--eq-inner)' : 'none'}
		stroke-dasharray="3 4"
	/>

	<!-- degree marks round the surface (both sides), numbered on the right -->
	{#each [30, 60, 90, 120, 150, 180] as d (d)}
		{@const [x1, y1] = at(d, RP + 2)}
		{@const [x2, y2] = at(d, RP + 8)}
		{@const [lx, ly] = at(d, RP + 14)}
		{@const [x3, y3] = at(-d, RP + 2)}
		{@const [x4, y4] = at(-d, RP + 8)}
		<path
			d="M{x1} {y1}L{x2} {y2}M{x3} {y3}L{x4} {y4}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<Readout id="deg-{d}">
			<Label
				x={lx}
				y={ly + 4}
				text="{d}°"
				size={11}
				muted
				anchor={d === 180 ? 'middle' : 'start'}
			/>
		</Readout>
	{/each}

	<!-- shadow zones, outside the surface -->
	{#if phase === 's-shadow' || phase === 'summary'}
		<path
			d={arc(sEdge, 180, RP + 9)}
			stroke="var(--eq-s)"
			stroke-width="5"
			fill="none"
			opacity="0.35"
		/>
		<path
			d={arc(-sEdge, -180, RP + 9)}
			stroke="var(--eq-s)"
			stroke-width="5"
			fill="none"
			opacity="0.35"
		/>
	{/if}
	{#if phase === 'p-shadow' || phase === 'inner-core' || phase === 'summary'}
		{@const r = phase === 'summary' ? RP + 16 : RP + 9}
		<path
			d={arc(pEdge, coreFrom, r)}
			stroke="var(--eq-p)"
			stroke-width="5"
			fill="none"
			opacity="0.4"
		/>
		<path
			d={arc(-pEdge, -coreFrom, r)}
			stroke="var(--eq-p)"
			stroke-width="5"
			fill="none"
			opacity="0.4"
		/>
		{#if phase === 'inner-core' && innerFrom !== null}
			<path
				d={arc(innerFrom, coreFrom, RP + 9)}
				stroke="var(--eq-inner-wave)"
				stroke-width="2"
				fill="none"
				stroke-dasharray="2 3"
			/>
		{/if}
	{/if}

	<!-- rays and fronts -->
	{#if pDraw}
		<g opacity={oP.current} fill="none" stroke-linecap="round">
			{#each pDraw.parts as r (r.key)}
				{@const d = rays.P.find((x) => x.key === r.key)}
				<path
					d={r.d}
					stroke={colorOf(r.kind)}
					stroke-width={d && near(d) ? 2.4 : 1.1}
					opacity={d && near(d) ? 1 : rayOpacity(r.kind)}
				/>
			{/each}
			<path d={pDraw.front} stroke="var(--eq-p)" stroke-width="3" />
			<path d={pDraw.tips} stroke="var(--eq-p)" stroke-width="4.5" />
		</g>
	{/if}
	{#if sDraw}
		<g opacity={oS.current} fill="none" stroke-linecap="round">
			{#each sDraw.parts as r (r.key)}
				{@const d = rays.S.find((x) => x.key === r.key)}
				<path
					d={r.d}
					stroke="var(--eq-s)"
					stroke-width={d && near(d) ? 2.4 : 1.1}
					opacity={d && near(d) ? 1 : 0.6}
				/>
			{/each}
			<path d={sDraw.front} stroke="var(--eq-s)" stroke-width="3" />
			<path d={sDraw.tips} stroke="var(--eq-s)" stroke-width="4.5" />
			<path d={sDraw.stops} stroke="var(--eq-s)" stroke-width="1.8" />
		</g>
	{/if}

	<!-- the earthquake -->
	<path
		transform="translate({C.x} {C.y - RP + DEPTH * K + 1})"
		d="M0 -9 L2.6 -3 9 -2.8 4 1.4 5.6 8 0 4.4 -5.6 8 -4 1.4 -9 -2.8 -2.6 -3 Z"
		fill="var(--eq-quake)"
		stroke="var(--stage-bg)"
		stroke-width="1"
	/>

	<!-- layer names -->
	{#if phase !== 'bending'}
		{@const strong = phase === 'summary'}
		<Readout id="l-mantle">
			<Label
				x={C.x - 150}
				y={C.y - 88}
				text="mantle"
				size={strong ? 13 : 12}
				weight={strong ? 600 : 500}
				muted={!strong}
			/>
		</Readout>
		<Readout id="l-outer">
			<Label
				x={C.x - 95}
				y={C.y + 4}
				text="outer core"
				size={strong ? 13 : 12}
				weight={strong ? 600 : 500}
				muted={!strong}
			/>
		</Readout>
		<Readout id="l-inner">
			<Label
				x={C.x}
				y={C.y + 4}
				text={liquid ? 'liquid' : phase === 'summary' ? 'inner core' : 'inner'}
				size={11}
				weight={strong ? 600 : 500}
				muted={!strong}
			/>
		</Readout>
	{/if}

	<!-- the seismometer -->
	{#if phase === 'station'}
		<g transform="translate({stationXY[0]} {stationXY[1]}) rotate({stationDeg})">
			<path
				d="M0 -14 L8 0 L-8 0 Z"
				fill="var(--eq-station)"
				stroke="var(--stage-bg)"
				stroke-width="1"
			/>
		</g>
		<Handle
			x={at(stationDeg, RP + 38)[0]}
			y={at(stationDeg, RP + 38)[1]}
			label="Seismometer"
			value={stationDeg}
			min={0}
			max={180}
			valuetext="{stationDeg} degrees from the earthquake"
			color="var(--eq-station)"
			onmove={moveStation}
			onkey={(k) =>
				setParam(
					'station',
					k === 'start' ? 0 : k === 'end' ? 180 : Math.max(0, Math.min(180, stationDeg + k))
				)}
		/>
	{/if}

	<!-- ================================================================ right-hand panel -->
	<g class="panel">
		{#if phase === 'bending'}
			<g opacity={oChart.current}>
				<Readout id="chart-title">
					<text x={CH.x0 - 40} y={50} style:font-size="14px" style:font-weight="600"
						>Speed of the waves at each depth</text
					>
				</Readout>
				{#each LAYERS as l (l.id)}
					<rect
						x={CH.x0}
						y={sy(l.top)}
						width={CH.x1 - CH.x0}
						height={Math.max(1.5, sy(l.bot) - sy(l.top))}
						fill={l.fill}
						opacity="0.55"
					/>
				{/each}
				{#each [5, 10] as v (v)}
					<path d="M{sx(v)} {CH.y0}V{CH.y1}" stroke="var(--stage-grid)" />
					<Readout id="sv-{v}">
						<text x={sx(v)} y={CH.y0 - 8} style:font-size="11px" class="muted" text-anchor="middle"
							>{v} km/s</text
						>
					</Readout>
				{/each}
				{#each [0, 1000, 2000, 3000, 4000, 5000, 6000] as d (d)}
					<Readout id="sd-{d}">
						<text x={CH.x0 - 6} y={sy(d) + 4} style:font-size="11px" class="muted" text-anchor="end"
							>{fmt(d)} km</text
						>
					</Readout>
				{/each}
				<path
					d={pCurve}
					stroke="var(--eq-p)"
					stroke-width="2.4"
					fill="none"
					opacity={model === 'uniform' ? 0.35 : 1}
				/>
				<path
					d={sCurve}
					stroke="var(--eq-s)"
					stroke-width="2.4"
					fill="none"
					opacity={model === 'uniform' ? 0.35 : 1}
				/>
				{#if model === 'uniform'}
					<path
						d="M{sx(5.8)} {CH.y0}V{CH.y1}"
						stroke="var(--eq-p)"
						stroke-width="2.4"
						stroke-dasharray="6 4"
					/>
					<path
						d="M{sx(3.46)} {CH.y0}V{CH.y1}"
						stroke="var(--eq-s)"
						stroke-width="2.4"
						stroke-dasharray="6 4"
					/>
				{/if}
				<Readout
					id="c-p"
					order={1}
					label="P speed, crust → bottom of mantle"
					value="5.8 → 13.7 km/s"
					color="var(--eq-p)"
				>
					<Label x={sx(12.2)} y={sy(1900)} text="P" size={14} weight={700} color="var(--eq-p)" />
				</Readout>
				<Readout
					id="c-s"
					order={2}
					label="S speed, crust → bottom of mantle"
					value="3.5 → 7.3 km/s"
					color="var(--eq-s)"
				>
					<Label x={sx(6.2)} y={sy(1700)} text="S" size={14} weight={700} color="var(--eq-s)" />
				</Readout>
				<Readout id="c-noS">
					<Label x={sx(0.3)} y={sy(3900)} text="no S in the liquid" size={11} anchor="start" />
				</Readout>
				<Readout id="c-names">
					<Label x={CH.x0 + 6} y={sy(1450)} text="mantle" size={11} anchor="start" muted />
					<Label x={CH.x1 - 6} y={sy(4400)} text="outer core" size={11} anchor="end" muted />
					<Label x={CH.x1 - 6} y={sy(5800)} text="inner core" size={11} anchor="end" muted />
				</Readout>
				<Readout
					id="c-time"
					order={3}
					label="P to 90° round the Earth"
					value={model === 'uniform' ? `${clock(t90u)} (same rock all through)` : clock(t90)}
				>
					<text x={CH.x0 - 40} y={584} style:font-size="13px">
						P to 90° round: <tspan style:font-weight="600"
							>{model === 'uniform' ? clock(t90u) : clock(t90)}</tspan
						>
						{model === 'uniform' ? '— rays straight' : '— rays curved'}
					</text>
				</Readout>
			</g>
		{:else}
			<Readout
				id="clock"
				order={1}
				label="Time since the earthquake"
				value={reduced ? 'all waves drawn' : clock(tau)}
			>
				<text x={610} y={60} style:font-size="13px" class="muted">Time since the earthquake</text>
				<text x={610} y={88} style:font-size="24px" style:font-weight="600"
					>{reduced ? '—' : clock(tau)}</text
				>
			</Readout>
			<g transform="translate(610 120)">
				{#if showP}
					<Readout id="key-p" order={2} label="P waves" color="var(--eq-p)">
						<path d="M0 0h24" stroke="var(--eq-p)" stroke-width="3" />
						<text x="32" y="4" style:font-size="13px">P waves</text>
					</Readout>
				{/if}
				{#if showS}
					<Readout id="key-s" order={3} label="S waves" color="var(--eq-s)">
						<path d="M{showP ? 120 : 0} 0h24" stroke="var(--eq-s)" stroke-width="3" />
						<text x={showP ? 152 : 32} y="4" style:font-size="13px">S waves</text>
					</Readout>
				{/if}
				{#if innerFocus && !liquid}
					<Readout
						id="key-i"
						order={4}
						label="P waves that met the inner core"
						color="var(--eq-inner-wave)"
					>
						<path d="M120 0h24" stroke="var(--eq-inner-wave)" stroke-width="3" />
						<text x="152" y="4" style:font-size="13px">met the inner core</text>
					</Readout>
				{/if}
			</g>

			<g transform="translate(610 170)" font-size="13">
				{#if phase === 'trigger'}
					<Readout
						id="f-90"
						order={5}
						label="P reaches 90° (10,000 km)"
						value={tau >= t90 ? clock(t90) : '…'}
					>
						<text y="0" opacity={tau >= t90 ? 1 : 0.4}>P reaches 90° round (10,000 km):</text>
						<text y="20" style:font-weight="600" opacity={tau >= t90 ? 1 : 0.4}
							>{tau >= t90 ? clock(t90) : '…'}</text
						>
					</Readout>
					<Readout id="f-s90" order={6} label="S reaches 90°" value={tau >= s90 ? clock(s90) : '…'}>
						<text y="52" opacity={tau >= s90 ? 1 : 0.4}>S reaches 90° round:</text>
						<text y="72" style:font-weight="600" opacity={tau >= s90 ? 1 : 0.4}
							>{tau >= s90 ? clock(s90) : '…'}</text
						>
					</Readout>
					<Readout
						id="f-far"
						order={7}
						label="P reaches the far side (20,000 km)"
						value={tau >= tFar ? clock(tFar) : '…'}
					>
						<text y="104" opacity={tau >= tFar ? 1 : 0.4}>P reaches the far side (20,000 km):</text>
						<text y="124" style:font-weight="600" opacity={tau >= tFar ? 1 : 0.4}
							>{tau >= tFar ? clock(tFar) : '…'}</text
						>
					</Readout>
				{:else if phase === 's-shadow'}
					<Readout
						id="s-reach"
						order={5}
						label="S waves arrive"
						value="from 0° to {Math.round(sEdge)}°"
					>
						<text y="0"
							>S waves arrive from 0° to <tspan style:font-weight="600">{Math.round(sEdge)}°</tspan
							></text
						>
					</Readout>
					<Readout
						id="s-none"
						order={6}
						label="S-wave shadow"
						value="{Math.round(sEdge)}° to 180°: no S at all"
					>
						<path d="M0 26h24" stroke="var(--eq-s)" stroke-width="5" opacity="0.35" />
						<text x="32" y="30">shadow: no S from {Math.round(sEdge)}° to 180°</text>
					</Readout>
					<Readout id="s-why" order={7} label="So, below 2,890 km" value="a liquid: the outer core">
						<text y="70" style:font-weight="600">S stops at 2,890 km deep (×):</text>
						<text y="90">there must be a liquid there</text>
					</Readout>
				{:else if phase === 'p-shadow' || phase === 'inner-core'}
					<Readout
						id="p-reach"
						order={5}
						label="Direct P waves arrive"
						value="up to {Math.round(pEdge)}°"
					>
						<text y="0"
							>P through the mantle: up to <tspan style:font-weight="600"
								>{Math.round(pEdge)}°</tspan
							></text
						>
					</Readout>
					<Readout
						id="p-core"
						order={6}
						label="P through the core arrives"
						value="from {Math.round(coreFrom)}°"
					>
						<text y="22"
							>P through the core: from <tspan style:font-weight="600"
								>{Math.round(coreFrom)}°</tspan
							></text
						>
					</Readout>
					<Readout
						id="p-zone"
						order={7}
						label="P-wave shadow zone"
						value="{Math.round(pEdge)}° to {Math.round(coreFrom)}°"
					>
						<path d="M0 48h24" stroke="var(--eq-p)" stroke-width="5" opacity="0.4" />
						<text x="32" y="52">shadow zone: {Math.round(pEdge)}° – {Math.round(coreFrom)}°</text>
					</Readout>
					{#if phase === 'inner-core'}
						<Readout
							id="p-inner"
							order={8}
							label={liquid ? 'Core liquid to the centre' : 'Waves that met the inner core'}
							value={liquid ? 'nothing in the shadow zone' : `from ${Math.round(innerFrom ?? 0)}°`}
						>
							<text
								y="86"
								style:font-weight="600"
								style:fill={liquid ? undefined : 'var(--eq-inner-wave)'}
							>
								{liquid ? 'Core liquid to the centre:' : 'Met the inner core:'}
							</text>
							<text y="106">
								{liquid
									? 'the shadow zone stays silent'
									: `faint waves from ${Math.round(innerFrom ?? 0)}° on`}
							</text>
						</Readout>
					{:else}
						<Readout
							id="p-faint"
							order={8}
							label="Faint"
							value="a few weak waves in the shadow (next step)"
						>
							<text y="86" class="muted" style:font-size="12px"
								>a few faint ones inside it: next step</text
							>
						</Readout>
					{/if}
				{:else if phase === 'station'}
					<Readout
						id="st-d"
						order={5}
						label="Seismometer"
						value="{stationDeg}° · {fmt((stationDeg * Math.PI * EARTH_R) / 180)} km away"
					>
						<text y="0"
							>Seismometer <tspan style:font-weight="600">{stationDeg}°</tspan> round · {fmt(
								(stationDeg * Math.PI * EARTH_R) / 180
							)} km</text
						>
					</Readout>
					{#if arr.length === 0}
						<Readout id="st-none" order={6} label="Arrivals" value="none: the shadow zone">
							<text y="28" style:font-weight="600">Nothing arrives here: the shadow zone</text>
						</Readout>
					{/if}
					{#each arr.slice(0, 4) as a, i (a.kind)}
						<Readout
							id="st-{a.kind}"
							order={6 + i}
							label={KIND_NAME[a.kind]}
							value={clock(a.time)}
							color={kindColor(a.kind)}
						>
							<text y={28 + i * 20} opacity={tau >= a.time ? 1 : 0.45}>
								<tspan style:fill={kindColor(a.kind)} style:font-weight="600"
									>{KIND_NAME[a.kind]}</tspan
								>
								after {clock(a.time)}
							</text>
						</Readout>
					{/each}
				{:else if phase === 'summary'}
					{#each [['Crust', '0 – 35 km', 'rock'], ['Mantle', '35 – 2,890 km', 'solid: carries S'], ['Outer core', '2,890 – 5,150 km', 'liquid: stops S, bends P'], ['Inner core', '5,150 – 6,371 km', 'solid: speeds P up']] as [name, depth, what], i (name)}
						<Readout id="sum-{i}" order={5 + i} label={name} value={depth} note={what}>
							<text y={i * 46} style:font-weight="600">{name}</text>
							<text x="96" y={i * 46}>{depth}</text>
							<text y={i * 46 + 19} class="muted" style:font-size="12px">{what}</text>
						</Readout>
					{/each}
					<Readout
						id="sum-s"
						order={10}
						label="S-wave shadow"
						value="beyond {Math.round(sEdge)}°: liquid outer core"
						color="var(--eq-s)"
					>
						<path d="M0 206h24" stroke="var(--eq-s)" stroke-width="5" opacity="0.35" />
						<text x="32" y="210">no S beyond {Math.round(sEdge)}°: the outer core is liquid</text>
					</Readout>
					<Readout
						id="sum-p"
						order={11}
						label="P-wave shadow"
						value="{Math.round(pEdge)}° – {Math.round(coreFrom)}°: the core bends P"
						color="var(--eq-p)"
					>
						<path d="M0 232h24" stroke="var(--eq-p)" stroke-width="5" opacity="0.4" />
						<text x="32" y="236"
							>P shadow {Math.round(pEdge)}°–{Math.round(coreFrom)}°: the core slows P</text
						>
					</Readout>
				{/if}
			</g>

			{#if phase === 'station'}
				<!-- what the seismometer records, on a time line -->
				<g>
					<path d="M{TL.x0} {TL.y}H{TL.x1}" stroke="var(--stage-ink-muted)" stroke-width="1" />
					{#each [0, 5, 10, 15, 20, 25] as m (m)}
						<path d="M{tx(m * 60)} {TL.y}v5" stroke="var(--stage-ink-muted)" />
						<Readout id="tl-{m}">
							<text
								x={tx(m * 60)}
								y={TL.y + 18}
								style:font-size="11px"
								class="muted"
								text-anchor="middle">{m} min</text
							>
						</Readout>
					{/each}
					{#each arr as a, i (a.kind)}
						<path
							d="M{tx(a.time)} {TL.y}v{-34 - (i % 2) * 22}"
							stroke={kindColor(a.kind)}
							stroke-width="2.4"
							opacity={tau >= a.time ? 1 : 0.3}
						/>
						<Readout id="tlk-{a.kind}">
							<text
								x={tx(a.time)}
								y={TL.y - 40 - (i % 2) * 22}
								style:font-size="11px"
								text-anchor="middle"
								style:font-weight="600"
								opacity={tau >= a.time ? 1 : 0.4}>{KIND_SHORT[a.kind]}</text
							>
						</Readout>
					{/each}
					{#if !reduced}
						<path
							d="M{tx(Math.min(tau, TL.max))} {TL.y - 66}v72"
							stroke="var(--stage-ink)"
							stroke-width="1"
							opacity="0.5"
						/>
					{/if}
					{#if pTime !== null && sTime !== null}
						<Readout id="tl-sp" order={12} label="S − P" value={clock(sTime - pTime)}>
							<text x={TL.x0} y={TL.y + 48} style:font-size="14px"
								>S comes <tspan style:font-weight="600">{clock(sTime - pTime)}</tspan> after P</text
							>
						</Readout>
					{/if}
				</g>
			{/if}
		{/if}
	</g>
</g>
