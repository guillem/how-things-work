<script lang="ts">
	/**
	 * The slice of the Pacific, from the Japanese coast through the 2011 epicentre to Crescent
	 * City: the real sea floor (ETOPO 2022) and the sea surface of the running model, in one of
	 * three views (`step.hints.view`, see `VIEWS` in scenario.ts): the source region, the whole
	 * ocean, or the Californian shelf. The bottom panel (`step.hints.panel`) holds the arrival
	 * times at the stations, the speed along the slice, or what passes and bounces off a ridge.
	 *
	 * The run is an `Ocean` advanced to the view's model time for t (at most CAP steps a frame),
	 * kept in plain variables inside a `$derived`, as in the ECG sheet: it starts again on a new
	 * step, a changed setting, the earthquake button or when t goes back. Reduced motion: a fresh
	 * run per setting, shown at REDUCED_S.
	 */
	import { Handle, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		COAST_KM,
		JAPAN_KM,
		MIN_DEPTH,
		N,
		STATIONS,
		RIDGE_KM,
		UPLIFT_KM,
		cellAt,
		firstCrest,
		floorJump,
		kmOf,
		kmh,
		shallowSpeed,
		waveSpeed,
		type Ocean
	} from '../model';
	import { REDUCED_S, VIEWS, W_COAST, W_OFFSHORE, hoursMinutes, runTo, setup } from '../scenario';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const viewId = $derived(String(step.hints?.view ?? 'ocean'));
	const view = $derived(VIEWS[viewId]);
	const panel = $derived(String(step.hints?.panel ?? ''));
	const s = $derived(setup(step.id, params));
	const key = $derived(`${step.id}|${JSON.stringify(s)}`);
	const quakes = $derived(Number(params.quake ?? 0));

	// ---- the run --------------------------------------------------------------------------------
	const CAP = 400;
	let run: Ocean | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	let quakesSeen = 0;
	// a plain cache of settled runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, [Ocean, Ocean | null]>();
	/** The ridge step also runs the open ocean alongside, to tell what the ridge sent back. */
	const withFree = $derived(step.id === 'ridge');
	let free: Ocean | null = null;

	const current = $derived.by((): { o: Ocean; free: Ocean | null; time: number } => {
		const time = t;
		const k = key;
		const v = view;
		const plain = { uplift: s.uplift, edit: {} };
		if (reduced) {
			let r = reducedRuns.get(k);
			if (!r) {
				const at = REDUCED_S[step.id] ?? v.startS;
				r = [runTo(s, at), withFree ? runTo(plain, at) : null];
				if (reducedRuns.size > 6) reducedRuns.clear();
				reducedRuns.set(k, r);
			}
			return { o: r[0], free: r[1], time: r[0].time };
		}
		if (!run || k !== runKey || time < lastT - 1e-6 || quakes !== quakesSeen) {
			run = runTo(s, v.startS);
			free = withFree ? runTo(plain, v.startS) : null;
			runKey = k;
			t0 = time;
			quakesSeen = quakes;
		}
		lastT = time;
		const target = Math.min(v.endS, v.startS + Math.max(0, time - t0 - v.delay) * v.rate);
		run.advanceTo(target, CAP);
		free?.advanceTo(run.time);
		return { o: run, free, time: run.time };
	});
	const o = $derived(current.o);
	const now = $derived(current.time);
	/** Before the jump (the source view's first seconds): the floor and the sea still flat. */
	const before = $derived(!reduced && viewId === 'source' && t - t0 < view.delay);

	// ---- geometry ---------------------------------------------------------------------------------
	const X0 = 40;
	const X1 = 920;
	const SEA_Y = 236;
	const FLOOR_Y1 = 470;
	const sx = $derived(scale([view.from, view.to], [X0, X1]));
	const dy = $derived(scale([0, view.maxDepth], [SEA_Y, FLOOR_Y1]));
	const etaY = (eta: number) => SEA_Y - Math.max(-140, Math.min(170, eta * view.etaPx));

	/** Cells in view, at most one point per drawing unit (the largest |η| of each column). */
	const columns = $derived.by(() => {
		const i0 = Math.max(0, cellAt(view.from));
		const i1 = Math.min(N - 1, cellAt(view.to));
		const out: { i0: number; i1: number; x: number }[] = [];
		const per = Math.max(1, (i1 - i0) / (X1 - X0));
		for (let a = i0; a <= i1; a += per) {
			const lo = Math.floor(a);
			const hi = Math.min(i1, Math.floor(a + per) - (per > 1 ? 1 : 0));
			out.push({ i0: lo, i1: Math.max(lo, hi), x: sx(kmOf(lo)) });
		}
		return out;
	});

	/**
	 * The floor's outline (deepest point of each column) and, in the source view once it has
	 * jumped, its outline before the jump and the band between the two.
	 */
	const floor = $derived.by(() => {
		const h = o.h;
		const showJump = !before && viewId === 'source';
		const base: string[] = [];
		const moved: string[] = [];
		for (const c of columns) {
			let deep = 0;
			for (let i = c.i0; i <= c.i1; i++) deep = Math.max(deep, h[i]);
			const y = deep <= 0 ? SEA_Y - 14 : dy(Math.min(view.maxDepth, deep));
			const lift = showJump ? floorJump(kmOf(c.i0), s.uplift) * view.etaPx : 0;
			base.push(`${c.x.toFixed(1)} ${y.toFixed(1)}`);
			moved.push(`${c.x.toFixed(1)} ${(y - lift).toFixed(1)}`);
		}
		const last = columns.at(-1)!;
		return {
			fill: `M${moved.join('L')}L${last.x.toFixed(1)} ${FLOOR_Y1 + 4}L${columns[0].x.toFixed(1)} ${FLOOR_Y1 + 4}Z`,
			base: showJump ? `M${base.join('L')}` : '',
			band: showJump ? `M${moved.join('L')}L${[...base].reverse().join('L')}Z` : ''
		};
	});

	/** The sea surface, exaggerated. */
	const surface = $derived.by(() => {
		void now;
		const eta = o.eta;
		const pts: string[] = [];
		for (const c of columns) {
			let v = 0;
			for (let i = c.i0; i <= c.i1; i++) if (Math.abs(eta[i]) > Math.abs(v)) v = eta[i];
			if (before) v = 0;
			pts.push(`${c.x.toFixed(1)} ${etaY(v).toFixed(1)}`);
		}
		return pts;
	});
	const surfacePath = $derived(`M${surface.join('L')}`);
	const seaPath = $derived(
		`M${surface.join('L')}L${columns.at(-1)!.x.toFixed(1)} ${FLOOR_Y1}L${columns[0].x.toFixed(1)} ${FLOOR_Y1}Z`
	);

	// the coasts: land beyond the first and last wet cells
	const japanX = $derived(sx(JAPAN_KM - 1));
	const coastX = $derived(sx(COAST_KM + 1));

	// ---- the front and its speed --------------------------------------------------------------
	const level = $derived(Math.max(0.02, 0.03 * s.uplift));
	const front = $derived.by(() => {
		void now;
		return o.frontEast(level);
	});
	const frontDepth = $derived(front >= 0 ? Math.max(MIN_DEPTH, o.h[front]) : 0);
	const frontSpeed = $derived(front >= 0 ? kmh(shallowSpeed(frontDepth)) : 0);
	const showGauge = $derived(viewId !== 'source');

	// ---- stations ---------------------------------------------------------------------------------
	const arrivals = $derived.by(() => {
		void now;
		return STATIONS.map((_, k) => {
			const c = firstCrest(o.records[k], level);
			// a crest is only known once the record has turned down after it
			return c ? c.minute : null;
		});
	});
	const STAGGER = [0, 1, 0, 0];

	// ---- the source view --------------------------------------------------------------------------
	const jumpPeak = $derived(sx(UPLIFT_KM));

	// ---- the shelf --------------------------------------------------------------------------------
	const offshorePeak = $derived.by(() => {
		void now;
		return Math.max(0, ...o.records[W_OFFSHORE]);
	});
	const coastPeak = $derived.by(() => {
		void now;
		return Math.max(0, ...o.records[W_COAST]);
	});
	const rampKm = $derived(Number(params.ramp ?? 120));
	const footKm = $derived(COAST_KM - rampKm);
	const footDepth = $derived(o.h[cellAt(footKm)]);
	function dragFoot(p: { x: number }) {
		const km = sx.invert(p.x);
		const r = Math.round(Math.max(10, Math.min(300, COAST_KM - km)) / 5) * 5;
		setParam('reshape', true);
		setParam('ramp', r);
	}

	// ---- the ridge --------------------------------------------------------------------------------
	const ridgeKm = $derived(Number(params.ridgeKm ?? 3000));
	const ridgeTop = $derived(Number(params.ridgeTop ?? 1500));
	function dragRidge(p: { x: number; y: number }) {
		const km = Math.round(Math.max(1000, Math.min(6500, sx.invert(p.x))) / 50) * 50;
		const top = Math.round(Math.max(0, Math.min(4000, dy.invert(p.y))) / 50) * 50;
		setParam('ridgeKm', km);
		setParam('ridgeTop', top);
	}
	/** What got past the ridge and what bounced off it, once the wave has reached it. */
	const ridgeSplit = $derived.by(() => {
		void now;
		if (panel !== 'ridge') return null;
		const reached = (current.free?.frontEast(level) ?? -1) >= cellAt(ridgeKm + 150);
		if (!reached) return null;
		const f = current.free;
		if (!f) return null;
		// what bounced back: the difference from the open ocean, west of the ridge, now
		let back = 0;
		for (let i = cellAt(UPLIFT_KM + 300); i < cellAt(ridgeKm - 2 * RIDGE_KM); i++)
			back = Math.max(back, Math.abs(o.eta[i] - f.eta[i]));
		// what went on: the highest the sea has been east of it, with and without the ridge
		let on = 0;
		let open = 0;
		for (let i = cellAt(ridgeKm + 2 * RIDGE_KM); i < cellAt(COAST_KM - 600); i++) {
			on = Math.max(on, o.peak[i]);
			open = Math.max(open, f.peak[i]);
		}
		return { back, on, open };
	});

	// ---- the speed chart --------------------------------------------------------------------------
	const CH_Y0 = 504;
	const CH_Y1 = 574;
	const sv = scale([0, 1000], [CH_Y1, CH_Y0]);
	const speedPath = $derived.by(() => {
		let d = '';
		for (const c of columns) {
			let deep = 0;
			for (let i = c.i0; i <= c.i1; i++) deep = Math.max(deep, o.h[i]);
			d += `${d ? 'L' : 'M'}${c.x.toFixed(1)} ${sv(kmh(shallowSpeed(Math.max(MIN_DEPTH, deep)))).toFixed(1)}`;
		}
		return d;
	});
	const windPath = $derived.by(() => {
		let d = '';
		for (const c of columns) {
			const deep = Math.max(MIN_DEPTH, o.h[c.i0]);
			d += `${d ? 'L' : 'M'}${c.x.toFixed(1)} ${sv(kmh(waveSpeed(10, deep))).toFixed(1)}`;
		}
		return d;
	});

	// ---- labels -----------------------------------------------------------------------------------
	const clock = $derived(hoursMinutes(before ? 0 : now));
	const fmtM = (v: number) =>
		v < 10 ? v.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : String(Math.round(v));
	const depthLabel = (m: number) => `${Math.round(m).toLocaleString('en-GB')} m`;
	/** How much taller the drawing makes depths and the wave than the widths. */
	const exaggeration = $derived.by(() => {
		const mPerPxX = ((view.to - view.from) * 1000) / (X1 - X0);
		const depthPxPerM = (FLOOR_Y1 - SEA_Y) / view.maxDepth;
		const r = (k: number) => {
			const p = 10 ** Math.floor(Math.log10(k));
			return Math.round(k / p) * p;
		};
		return { floor: r(mPerPxX * depthPxPerM), wave: r(mPerPxX * view.etaPx) };
	});
	const nf = (v: number) => v.toLocaleString('en-GB');
</script>

<g class="ocean-scene">
	<!-- the sea, the floor and the land -->
	<path d={seaPath} fill="var(--tsu-sea)" />
	<line
		x1={X0}
		x2={X1}
		y1={SEA_Y}
		y2={SEA_Y}
		stroke="var(--tsu-wave)"
		stroke-width="1"
		stroke-dasharray="3 4"
		opacity="0.45"
	/>
	<path d={floor.fill} fill="var(--tsu-floor)" stroke="var(--tsu-floor-edge)" stroke-width="1.2" />
	{#if floor.band}
		<path d={floor.band} fill="var(--tsu-uplift)" opacity="0.35" />
		<path
			d={floor.base}
			fill="none"
			stroke="var(--tsu-uplift)"
			stroke-width="1"
			stroke-dasharray="3 3"
			opacity="0.8"
		/>
	{/if}
	{#if japanX > X0}
		<path
			d="M{X0 - 24} {SEA_Y - 16} L{japanX} {SEA_Y - 16} L{japanX + 2} {FLOOR_Y1 + 4} L{X0 -
				24} {FLOOR_Y1 + 4} Z"
			fill="var(--tsu-land)"
			stroke="var(--tsu-floor-edge)"
			stroke-width="1"
		/>
		<Label x={X0 - 10} y={FLOOR_Y1 + 22} text="Japan" size={13} weight={600} anchor="start" />
	{/if}
	{#if coastX < X1}
		<path
			d="M{coastX - 1} {SEA_Y - 16} L{X1 + 24} {SEA_Y - 16} L{X1 + 24} {FLOOR_Y1 + 4} L{coastX -
				2} {FLOOR_Y1 + 4} Z"
			fill="var(--tsu-land)"
			stroke="var(--tsu-floor-edge)"
			stroke-width="1"
		/>
		<Label x={X1 + 10} y={FLOOR_Y1 + 22} text="California" size={13} weight={600} anchor="end" />
	{/if}
	<path
		d={surfacePath}
		fill="none"
		stroke="var(--tsu-wave)"
		stroke-width="2.2"
		stroke-linejoin="round"
	/>

	<!-- the source: where the floor jumped -->
	{#if viewId === 'source'}
		<g opacity={before ? 0.5 : 1}>
			<path
				d="M{jumpPeak} {dy(6800)} V{dy(5300)} M{jumpPeak - 6} {dy(5300) + 8} L{jumpPeak} {dy(
					5300
				)} L{jumpPeak + 6} {dy(5300) + 8}"
				fill="none"
				stroke="var(--tsu-uplift)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<Readout id="jump" order={3} label="The floor jumps" value="up {fmtM(s.uplift)} m">
				<Label
					x={jumpPeak + 12}
					y={dy(6200)}
					text={before ? `about to jump up ${fmtM(s.uplift)} m` : `jumped up ${fmtM(s.uplift)} m`}
					color="var(--tsu-uplift-text)"
					weight={600}
					anchor="start"
				/>
			</Readout>
			<Label x={sx(-45)} y={dy(1800)} text="sinks" color="var(--tsu-uplift-text)" anchor="middle" />
		</g>
		<Readout id="trench">
			<Label x={sx(198)} y={dy(7428) + 18} text="Japan Trench, 7.4 km" muted anchor="middle" />
		</Readout>
		<Readout id="epi">
			<g transform="translate({sx(0)} {dy(989) + 22})">
				<path
					d="M0 -7 L2 -2 L7 -2 L3 1 L5 7 L0 3 L-5 7 L-3 1 L-7 -2 L-2 -2 Z"
					fill="var(--tsu-uplift)"
				/>
			</g>
			<Label x={sx(0)} y={dy(989) + 24} text="epicentre" muted anchor="middle" />
		</Readout>
	{/if}

	<!-- stations -->
	{#if viewId === 'ocean'}
		{#each STATIONS as st, k (st.id)}
			{@const x = sx(st.km)}
			{@const lift = STAGGER[k] * 46}
			{@const arrived = arrivals[k]}
			{#if st.kind === 'buoy'}
				<line
					x1={x}
					x2={x}
					y1={SEA_Y - 30 - lift}
					y2={dy(5600)}
					stroke="var(--stage-ink-muted)"
					stroke-width="0.8"
					stroke-dasharray="2 3"
					opacity="0.6"
				/>
				<rect x={x - 4} y={SEA_Y - 6} width="8" height="6" rx="1.5" fill="var(--tsu-buoy)" />
			{:else}
				<line
					x1={x - 6}
					x2={x - 6}
					y1={SEA_Y - 30 - lift}
					y2={SEA_Y - 4}
					stroke="var(--stage-ink-muted)"
					stroke-width="0.8"
					stroke-dasharray="2 3"
					opacity="0.6"
				/>
			{/if}
			<Readout
				id="st-{st.id}"
				order={10 + k}
				label={st.name}
				value={arrived !== null
					? `model ${hoursMinutes(arrived * 60)} · real ${hoursMinutes(st.crestMin * 60)}`
					: `real ${hoursMinutes(st.crestMin * 60)}`}
			>
				<Label
					x={st.kind === 'gauge' ? x - 10 : x}
					y={SEA_Y - 64 - lift}
					text={st.name}
					size={12}
					weight={600}
					anchor={st.kind === 'gauge' ? 'end' : 'middle'}
				/>
				<Label
					x={st.kind === 'gauge' ? x - 10 : x}
					y={SEA_Y - 48 - lift}
					text={arrived !== null
						? `model ${hoursMinutes(arrived * 60)} · real ${hoursMinutes(st.crestMin * 60)}`
						: `real ${hoursMinutes(st.crestMin * 60)}`}
					size={11}
					muted={arrived === null}
					color={arrived !== null ? 'var(--tsu-wave-text)' : undefined}
					anchor={st.kind === 'gauge' ? 'end' : 'middle'}
					tabular
				/>
			</Readout>
		{/each}
	{/if}

	<!-- the shelf: the foot of the slope -->
	{#if viewId === 'shelf'}
		{#if params.reshape === true}
			<Label
				x={Math.max(X0 + 4, Math.min(X1 - 200, sx(footKm) - 90))}
				y={dy(footDepth) + 26}
				text="foot of the slope, {rampKm} km out"
				anchor="start"
				size={12}
			/>
		{:else}
			<Label
				x={sx(COAST_KM - 120)}
				y={dy(footDepth) + 26}
				text="the real shelf off Crescent City"
				anchor="middle"
				size={12}
				muted
			/>
		{/if}
		<Handle
			x={sx(params.reshape === true ? footKm : COAST_KM - 120)}
			y={dy(params.reshape === true ? footDepth : o.h[cellAt(COAST_KM - 120)])}
			label="Foot of the slope"
			value={params.reshape === true ? rampKm : 120}
			min={10}
			max={300}
			valuetext="{params.reshape === true ? rampKm : 120} km from the coast"
			onmove={dragFoot}
			onkey={(k) => {
				const r = params.reshape === true ? rampKm : 120;
				const next =
					k === 'start' ? 10 : k === 'end' ? 300 : Math.max(10, Math.min(300, r - k * 5));
				setParam('reshape', true);
				setParam('ramp', next);
			}}
		/>
		<line
			x1={sx(COAST_KM - 250)}
			x2={sx(COAST_KM - 250)}
			y1={SEA_Y - 60}
			y2={SEA_Y + 40}
			stroke="var(--stage-ink-muted)"
			stroke-width="0.8"
			stroke-dasharray="2 3"
		/>
		<Readout id="offshore" order={4} label="250 km out" value="highest {fmtM(offshorePeak)} m">
			<Label
				x={sx(COAST_KM - 250) + 6}
				y={SEA_Y - 66}
				text="250 km out, {depthLabel(o.h[cellAt(COAST_KM - 250)])} deep"
				size={12}
				anchor="start"
			/>
			<Label
				x={sx(COAST_KM - 250) + 6}
				y={SEA_Y - 50}
				text="highest so far {fmtM(offshorePeak)} m"
				size={12}
				color="var(--tsu-wave-text)"
				tabular
				anchor="start"
			/>
		</Readout>
		<Readout id="coast" order={5} label="At the coast" value="highest {fmtM(coastPeak)} m">
			<Label x={X1} y={34} text="at the coast" size={12} anchor="end" halo={false} />
			<Label
				x={X1}
				y={54}
				text="highest so far {fmtM(coastPeak)} m"
				size={12}
				anchor="end"
				color="var(--tsu-wave-text)"
				weight={600}
				tabular
			/>
		</Readout>
	{/if}

	<!-- the ridge -->
	{#if panel === 'ridge'}
		<Handle
			x={sx(ridgeKm)}
			y={ridgeTop <= 0 ? SEA_Y - 14 : dy(ridgeTop)}
			label="Top of the ridge"
			value={ridgeTop}
			min={0}
			max={4000}
			valuetext={ridgeTop === 0 ? 'an island' : `${ridgeTop} m below the surface`}
			onmove={dragRidge}
			onkey={(k) => {
				const next =
					k === 'start' ? 0 : k === 'end' ? 4000 : Math.max(0, Math.min(4000, ridgeTop - k * 50));
				setParam('ridgeTop', next);
			}}
		/>
		<Readout
			id="ridge-top"
			order={3}
			label="Ridge top"
			value={ridgeTop === 0 ? 'an island' : `${nf(ridgeTop)} m down`}
		>
			<Label
				x={sx(ridgeKm) + 16}
				y={ridgeTop < 900 ? SEA_Y - 30 : dy(ridgeTop) + 22}
				text={ridgeTop === 0 ? 'an island: in a slice, a wall' : `top ${nf(ridgeTop)} m down`}
				size={12}
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- clock -->
	<Readout id="clock" order={1} label="Since the earthquake" value={clock}>
		<Label x={24} y={34} text="since the earthquake" size={12} muted halo={false} anchor="start" />
		<Label x={24} y={56} text={clock} size={20} weight={600} tabular halo={false} anchor="start" />
	</Readout>

	<!-- the speed gauge -->
	{#if showGauge}
		{@const gx = viewId === 'shelf' ? 600 : 840}
		{@const gy = 74}
		{@const R = 50}
		{@const ang = (v: number) => Math.PI * (1 - Math.min(1, v / 1000))}
		<g>
			<path
				d="M{gx - R} {gy} A{R} {R} 0 0 1 {gx + R} {gy}"
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="7"
				stroke-linecap="round"
			/>
			{#each [0, 250, 500, 750, 1000] as v (v)}
				<line
					x1={gx + (R - 9) * Math.cos(ang(v))}
					y1={gy - (R - 9) * Math.sin(ang(v))}
					x2={gx + (R + 4) * Math.cos(ang(v))}
					y2={gy - (R + 4) * Math.sin(ang(v))}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
				/>
			{/each}
			<Label x={gx - R - 4} y={gy + 14} text="0" size={10} muted anchor="middle" halo={false} />
			<Label
				x={gx + R + 4}
				y={gy + 14}
				text="1,000 km/h"
				size={10}
				muted
				anchor="middle"
				halo={false}
			/>
			{#if front >= 0}
				<line
					x1={gx}
					y1={gy}
					x2={gx + (R - 6) * Math.cos(ang(frontSpeed))}
					y2={gy - (R - 6) * Math.sin(ang(frontSpeed))}
					stroke="var(--tsu-wave)"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
			{/if}
			<circle cx={gx} cy={gy} r="3.5" fill="var(--tsu-wave)" />
			<Readout
				id="speed"
				order={2}
				label="Front of the wave"
				value={front >= 0
					? `${nf(Math.round(frontSpeed))} km/h over ${depthLabel(frontDepth)}`
					: 'not yet'}
			>
				<Label
					x={gx - R - 18}
					y={gy - 38}
					text="front of the wave"
					size={12}
					muted
					anchor="end"
					halo={false}
				/>
				<Label
					x={gx - R - 18}
					y={gy - 18}
					text={front >= 0 ? `${nf(Math.round(frontSpeed))} km/h` : '—'}
					size={17}
					weight={600}
					anchor="end"
					color="var(--tsu-wave-text)"
					tabular
					halo={false}
				/>
				<Label
					x={gx - R - 18}
					y={gy}
					text={front >= 0 ? `over ${depthLabel(frontDepth)} of water` : ''}
					size={12}
					anchor="end"
					tabular
					halo={false}
				/>
			</Readout>
		</g>
	{/if}

	<!-- bottom panel -->
	{#if panel === 'speed'}
		<line x1={X0} x2={X1} y1={CH_Y1} y2={CH_Y1} stroke="var(--stage-line)" />
		{#each [250, 500, 750, 1000] as v (v)}
			<line x1={X0} x2={X1} y1={sv(v)} y2={sv(v)} stroke="var(--stage-grid)" />
			<Label x={X0 - 4} y={sv(v) + 4} text={String(v)} size={10} muted anchor="end" halo={false} />
		{/each}
		<path d={speedPath} fill="none" stroke="var(--tsu-wave)" stroke-width="1.6" />
		<path
			d={windPath}
			fill="none"
			stroke="var(--tsu-wind)"
			stroke-width="1.6"
			stroke-dasharray="5 4"
		/>
		{#if front >= 0}
			<circle
				cx={sx(kmOf(front))}
				cy={sv(frontSpeed)}
				r="4.5"
				fill="var(--tsu-wave)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		<Readout id="chart-t">
			<Label
				x={480}
				y={CH_Y0 - 10}
				text="speed of a tsunami, √(g × depth), km/h"
				size={11}
				color="var(--tsu-wave-text)"
				anchor="middle"
			/>
		</Readout>
		<Readout
			id="wind"
			order={6}
			label="A wind wave, 10 s period"
			value="{Math.round(kmh(waveSpeed(10, 4600)))} km/h"
			color="var(--tsu-wind)"
		>
			<Label
				x={sx(4200)}
				y={sv(56) - 8}
				text="a wind wave, crests 10 s apart: {Math.round(kmh(waveSpeed(10, 4600)))} km/h"
				size={11}
				color="var(--tsu-wind-text)"
				anchor="start"
			/>
		</Readout>
	{:else if panel === 'arrivals'}
		<Readout id="note">
			<Label
				x={480}
				y={506}
				text="Times: when the first crest passed, in the model and in the real 2011 records"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
	{:else if panel === 'ridge'}
		<Readout
			id="split"
			order={4}
			label="The wave at the ridge"
			value={ridgeSplit
				? `past it ${fmtM(ridgeSplit.on)} m (${fmtM(ridgeSplit.open)} m with no ridge) · bounced back ${fmtM(ridgeSplit.back)} m`
				: 'the wave hasn’t reached the ridge'}
		>
			<Label
				x={480}
				y={506}
				text={ridgeSplit
					? `past the ridge: ${fmtM(ridgeSplit.on)} m high (${fmtM(ridgeSplit.open)} m with no ridge) · bounced back: ${fmtM(ridgeSplit.back)} m`
					: 'the wave hasn’t passed the ridge yet'}
				size={13}
				anchor="middle"
				tabular
			/>
		</Readout>
	{/if}

	<!-- scale note -->
	<Readout id="scale">
		<Label
			x={480}
			y={panel === 'speed' ? 590 : 556}
			text="Not to scale: depths drawn {nf(exaggeration.floor)} times taller, the wave {nf(
				exaggeration.wave
			)} times"
			size={11}
			muted
			anchor="middle"
		/>
	</Readout>
	{#if viewId !== 'source' && panel !== 'speed'}
		<Readout id="bound">
			<Label
				x={480}
				y={532}
				text="One slice of the ocean: the wave can’t spread sideways, so far from the source its heights come out too large"
				size={11}
				muted
				anchor="middle"
			/>
		</Readout>
	{/if}
</g>
