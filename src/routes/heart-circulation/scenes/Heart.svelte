<script lang="ts">
	/**
	 * The heart in cross-section, driven by the circulation model: the four
	 * chambers swell and shrink with their computed volumes, the valves open
	 * only while blood flows forward through them (and show the backward jet of
	 * a leak), dashes in the vessels move by the volume that has flowed, and the
	 * electrical signal runs from the sinoatrial node over the atria, waits at
	 * the AV node and spreads through the ventricles, on the model's clock.
	 *
	 * Drawn in a local 460 × 480 box (see `heart.ts`), placed with x, y, scale.
	 * `signal`: 0–1 emphasis of the conduction system (above 0.5 the moving
	 * signal is drawn); `dim`: opacity of the whole drawing. Names are placed by
	 * the scenes, at the anchors in `heart.ts`.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { LA, LV, RA, RV, type Beat } from '../circulation';
	import {
		CH,
		CONDUCTION,
		NODES,
		REF,
		VALVES,
		VESSELS,
		VP,
		at,
		atriumPath,
		passedAt,
		sizeOf,
		tauOf,
		fibres,
		ventriclePath
	} from './heart';

	interface Props {
		beat: Beat;
		beats: number;
		x?: number;
		y?: number;
		scale?: number;
		signal?: number;
		dim?: number;
		/** Show the moving flow dashes in the vessels. */
		vessels?: boolean;
		/** Opacity of the vessels (paler when they join a larger drawing). */
		tubes?: number;
	}
	let {
		beat,
		beats,
		x = 0,
		y = 0,
		scale = 1,
		signal = 0.35,
		dim = 1,
		vessels = true,
		tubes = 1
	}: Props = $props();

	const T = $derived(beat.timing);
	const tau = $derived(tauOf(beat, beats));

	// ---- chambers ----------------------------------------------------------
	const sRA = $derived(sizeOf(at(beat, beat.v[RA], beats), REF.ra));
	const sRV = $derived(sizeOf(at(beat, beat.v[RV], beats), REF.rv));
	const sLA = $derived(sizeOf(at(beat, beat.v[LA], beats), REF.la));
	const sLV = $derived(sizeOf(at(beat, beat.v[LV], beats), REF.lv));
	const ra = $derived(atriumPath(CH.ra.cx, CH.ra.w, CH.ra.h, sRA));
	const la = $derived(atriumPath(CH.la.cx, CH.la.w, CH.la.h, sLA));
	const rv = $derived(ventriclePath(CH.rv.xs, -1, CH.rv.w, CH.rv.depth, sRV));
	const lv = $derived(ventriclePath(CH.lv.xs, 1, CH.lv.w, CH.lv.depth, sLV));
	// The bundle runs down the septum to about half the depth of the smaller
	// ventricle, then its branches follow each ventricle's wall.
	const split = $derived(VP + 0.45 * Math.min(CH.rv.depth * sRV, CH.lv.depth * sLV));
	const bundle = $derived(`M${NODES.av.x} ${NODES.av.y} L222 ${VP + 12} L222 ${split.toFixed(1)}`);
	const leftBranch = $derived(fibres(CH.lv.xs, 1, CH.lv.w, CH.lv.depth, sLV, split));
	const rightBranch = $derived(fibres(CH.rv.xs, -1, CH.rv.w, CH.rv.depth, sRV, split));

	// ---- valves --------------------------------------------------------------
	const leakValve = $derived(beat.settings.leak > 0 ? beat.settings.valve : null);
	const gap = $derived(Math.min(12, beat.settings.leak * 26));
	const valves = $derived(
		(['tricuspid', 'pulmonary', 'mitral', 'aortic'] as const).map((id) => {
			const v = VALVES[id];
			const q = at(beat, beat.flow[id], beats);
			const open = Math.sqrt(clamp(q / 80));
			const leaky = leakValve === id;
			const back = q < 0 ? clamp(-q / 150) : 0;
			// Leaflets hinged at both ends of the opening; closed they meet in the
			// middle (leaving a gap if leaky), open they swing into the flow.
			const len = v.half - (leaky ? gap / 2 : 0) - 1;
			const angle = open * 1.25; // radians from closed
			const tip = (side: -1 | 1) => ({
				x: v.x + side * v.half - side * len * Math.cos(angle),
				y: v.y + v.dir * len * Math.sin(angle)
			});
			return { id, ...v, q, open, back, l: tip(-1), r: tip(1) };
		})
	);

	// ---- flow dashes in the vessels (move by the volume passed) -----------------
	const PX_PER_ML = 1.1;
	const dash = $derived({
		svc: -0.5 * passedAt(beat, 'venous', beats) * PX_PER_ML,
		ivc: -0.5 * passedAt(beat, 'venous', beats) * PX_PER_ML,
		pa: -passedAt(beat, 'pulmonary', beats) * PX_PER_ML,
		aorta: -passedAt(beat, 'aortic', beats) * PX_PER_ML,
		pv: -0.5 * passedAt(beat, 'lungVeins', beats) * PX_PER_ML
	});

	// ---- the electrical signal --------------------------------------------------
	const P_END = 0.09; // the signal has crossed the atria
	const QRS = 0.08; // the signal crosses the ventricles in about 80 ms
	const atriaFront = $derived(clamp(tau / P_END));
	const ventFront = $derived(clamp((tau - T.pr) / QRS));
	const avHold = $derived(tau > P_END * 0.9 && tau < T.pr + 0.01);
	// Depolarised muscle glows faintly: atria from P to the end of their squeeze,
	// ventricles from QRS to the end of T.
	const atriaGlow = $derived(
		smoothstep(0, P_END, tau) *
			(1 - smoothstep(T.atria + T.atriaDur * 0.6, T.atria + T.atriaDur, tau))
	);
	const ventGlow = $derived(
		smoothstep(T.pr, T.pr + QRS, tau) * (1 - smoothstep(T.pr + T.qt - 0.08, T.pr + T.qt, tau))
	);
	const showFront = (u: number) => u > 0 && u < 1;
</script>

{#snippet tube(d: string, w: number, color: string, offset: number, show: boolean)}
	<path {d} fill="none" stroke="var(--hc-muscle-edge)" stroke-width={w + 4} stroke-linecap="butt" />
	<path {d} fill="none" stroke={color} stroke-width={w} stroke-linecap="butt" />
	{#if show}
		<path
			{d}
			fill="none"
			stroke="var(--surface)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-dasharray="2 16"
			stroke-dashoffset={offset}
			opacity="0.75"
		/>
	{/if}
{/snippet}

<g transform="translate({x} {y}) scale({scale})" opacity={dim}>
	<!-- vessels, behind the chambers -->
	<g opacity={tubes}>
		{@render tube(VESSELS.svc.d, VESSELS.svc.w, 'var(--hc-deoxy)', dash.svc, vessels)}
		{@render tube(VESSELS.ivc.d, VESSELS.ivc.w, 'var(--hc-deoxy)', dash.ivc, vessels)}
		{@render tube(VESSELS.pv1.d, VESSELS.pv1.w, 'var(--hc-oxy)', dash.pv, vessels)}
		{@render tube(VESSELS.pv2.d, VESSELS.pv2.w, 'var(--hc-oxy)', dash.pv, vessels)}
		{@render tube(VESSELS.pa.d, VESSELS.pa.w, 'var(--hc-deoxy)', dash.pa, vessels)}
		{@render tube(VESSELS.aorta.d, VESSELS.aorta.w, 'var(--hc-oxy)', dash.aorta, vessels)}
	</g>

	<!-- muscle: walls (thick strokes), drawn before the blood -->
	<g fill="var(--hc-muscle)" stroke="var(--hc-muscle)" stroke-linejoin="round">
		<path d={ra} stroke-width="14" />
		<path d={la} stroke-width="14" />
		<path d={rv} stroke-width="12" />
		<path d={lv} stroke-width="30" />
	</g>
	<g
		fill="none"
		stroke="var(--hc-muscle-edge)"
		stroke-width="1.2"
		stroke-linejoin="round"
		opacity="0.8"
	>
		<path d={ra} stroke-width="16" stroke-opacity="0.25" />
		<path d={la} stroke-width="16" stroke-opacity="0.25" />
		<path d={rv} stroke-width="14" stroke-opacity="0.25" />
		<path d={lv} stroke-width="32" stroke-opacity="0.25" />
	</g>
	<!-- electrical glow of depolarised muscle -->
	<g fill="none" stroke="var(--hc-signal)" stroke-linejoin="round">
		<path d={ra} stroke-width="14" opacity={0.5 * atriaGlow * signal} />
		<path d={la} stroke-width="14" opacity={0.5 * atriaGlow * signal} />
		<path d={rv} stroke-width="12" opacity={0.45 * ventGlow * signal} />
		<path d={lv} stroke-width="30" opacity={0.45 * ventGlow * signal} />
	</g>

	<!-- blood -->
	<path d={ra} fill="var(--hc-deoxy)" />
	<path d={rv} fill="var(--hc-deoxy)" />
	<path d={la} fill="var(--hc-oxy)" />
	<path d={lv} fill="var(--hc-oxy)" />
	<!-- the fibrous wall between atria and ventricles, pierced by the valves -->
	<rect x="44" y={VP - 6} width="362" height="12" rx="4" fill="var(--hc-muscle)" />
	<rect
		x={VALVES.tricuspid.x - VALVES.tricuspid.half}
		y={VP - 8}
		width={2 * VALVES.tricuspid.half}
		height="16"
		fill="var(--hc-deoxy)"
	/>
	<rect
		x={VALVES.mitral.x - VALVES.mitral.half}
		y={VP - 8}
		width={2 * VALVES.mitral.half}
		height="16"
		fill="var(--hc-oxy)"
	/>
	<rect x={194 - 14} y={VP - 14} width="28" height="30" fill="var(--hc-deoxy)" />
	<rect x={252 - 15} y={VP - 14} width="30" height="30" fill="var(--hc-oxy)" />

	<!-- valves -->
	{#each valves as v (v.id)}
		{@const line = 'var(--stage-ink)'}
		<g stroke-linecap="round">
			<line x1={v.x - v.half} y1={v.y} x2={v.l.x} y2={v.l.y} stroke={line} stroke-width="3.2" />
			<line x1={v.x + v.half} y1={v.y} x2={v.r.x} y2={v.r.y} stroke={line} stroke-width="3.2" />
		</g>
		{#if v.open > 0.05}
			<!-- forward flow through the open valve -->
			<path
				d="M{v.x - 7} {v.y - v.dir * 4} L{v.x} {v.y + v.dir * 6} L{v.x + 7} {v.y - v.dir * 4}"
				fill="none"
				stroke="var(--surface)"
				stroke-width="2.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={0.9 * v.open}
			/>
		{/if}
		{#if v.back > 0.02}
			<!-- a leak: a jet back through the gap -->
			<path
				d="M{v.x} {v.y + v.dir * 4} L{v.x} {v.y - v.dir * (14 + 26 * v.back)}"
				stroke="var(--hc-leak)"
				stroke-width={3 + 3 * v.back}
				stroke-linecap="round"
				opacity={0.4 + 0.6 * v.back}
			/>
			<path
				d="M{v.x - 7} {v.y - v.dir * (8 + 26 * v.back)} L{v.x} {v.y -
					v.dir * (18 + 26 * v.back)} L{v.x + 7} {v.y - v.dir * (8 + 26 * v.back)}"
				fill="none"
				stroke="var(--hc-leak)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={0.4 + 0.6 * v.back}
			/>
		{/if}
	{/each}

	<!-- the electrical system -->
	{#if signal > 0}
		<g fill="none" stroke="var(--hc-signal)" stroke-linecap="round" stroke-linejoin="round">
			<g opacity={0.15 + 0.6 * signal} stroke-width="2" stroke-dasharray="3 4">
				<path d={CONDUCTION.atria} />
				<path d={CONDUCTION.atriaLeft} />
				<path d={bundle} />
				<path d={leftBranch} />
				<path d={rightBranch} />
			</g>
			{#if signal > 0.5}
				<g stroke-width="4.5" opacity={signal}>
					{#if showFront(atriaFront)}
						<path d={CONDUCTION.atria} pathLength="1" stroke-dasharray="{atriaFront} 1" />
						<path d={CONDUCTION.atriaLeft} pathLength="1" stroke-dasharray="{atriaFront} 1" />
					{/if}
					{#if ventFront > 0 && ventFront < 1}
						<path d={bundle} pathLength="1" stroke-dasharray="{clamp(ventFront * 3)} 1" />
						<path
							d={leftBranch}
							pathLength="1"
							stroke-dasharray="{clamp(ventFront * 1.5 - 0.5)} 1"
						/>
						<path
							d={rightBranch}
							pathLength="1"
							stroke-dasharray="{clamp(ventFront * 1.5 - 0.5)} 1"
						/>
					{/if}
				</g>
			{/if}
		</g>
		<circle
			cx={NODES.sa.x}
			cy={NODES.sa.y}
			r={6 + (signal > 0.5 && tau < 0.04 ? 3 : 0)}
			fill="var(--hc-signal)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			opacity={0.4 + 0.6 * signal}
		/>
		<circle
			cx={NODES.av.x}
			cy={NODES.av.y}
			r={5 + (signal > 0.5 && avHold ? 2.5 : 0)}
			fill="var(--hc-signal)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			opacity={0.4 + 0.6 * signal}
		/>
	{/if}
</g>
