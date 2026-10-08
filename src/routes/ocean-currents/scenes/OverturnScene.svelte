<script lang="ts">
	/**
	 * Stommel's two-box overturning as a slice through the Atlantic: the
	 * tropics (left, 25 °C) and the far north (right, `params.tpole`), with the
	 * loop of the overturning drawn as a thick track (width ∝ |q|) carrying
	 * chevrons that move with the flow (backwards if it reverses). Above, the
	 * sun's evaporation over the tropics and the fresh water (`params.fresh`)
	 * falling on the north. Right: a readout card, the overturning over time
	 * and, below it, a temperature–salinity diagram with lines of equal density
	 * (phases density, conveyor) or the steady states against fresh water,
	 * showing the tipping point and the hysteresis (phase tipping).
	 *
	 * Time: the box model is integrated (RK4) and replayed at 25 model years per
	 * second. A control change starts a new segment from the current salinity
	 * contrast (the clock memo of DrivenScene in oscillations-resonance, the
	 * guide's sanctioned exception); a new step, or `params.resetOcean`, starts
	 * again from today's state. Reduced motion: the state 600 years after
	 * starting from today's ocean with the current settings.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { cycle, scale, type Scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BOX,
		SV,
		collapseThreshold,
		density,
		equilibria,
		heatTransport,
		restartThreshold,
		runOverturning,
		type Overturn
	} from '../ocean';
	import Card, { type Cell } from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'density'));
	const tpole = $derived(Number(params.tpole ?? BOX.Tpole0));
	const fresh = $derived(Number(params.fresh ?? 1));
	const resets = $derived(Number(params.resetOcean ?? 0));

	// ---- layout ---------------------------------------------------------------------------
	const SX0 = 32; // slice
	const SX1 = 592;
	const MID = 330; // border between the boxes
	const SURF = 150;
	const FLOOR = 520;
	const TRACK = { x0: 84, x1: 548, top: 186, bottom: 474, r: 34 };
	const PX0 = 680; // plots
	const PX1 = 930;
	const TP = { top: 156, bottom: 296 }; // time plot
	const LP = { top: 392, bottom: 548 }; // lower plot
	const YPS = 25; // model years per second of animation
	const WINDOW = 1000; // years on the time plot
	const RUN = 3000; // years computed per segment
	const TODAY_DS = BOX.dS0;

	// ---- the clock: segments of model time --------------------------------------------------
	interface Seg {
		y0: number;
		run: Overturn;
		/** ∫q dt (m³) before this segment. */
		movedBefore: number;
	}
	const at = (run: Overturn, years: number, arr: Float64Array) => {
		const f = Math.max(0, years / run.dt);
		const i = Math.min(arr.length - 2, Math.floor(f));
		const u = Math.min(1, f - i);
		return arr[i] + (arr[i + 1] - arr[i]) * u;
	};
	let memo: { key: string; lastT: number; resets: number; segs: Seg[] } = {
		key: '',
		lastT: 0,
		resets: 0,
		segs: []
	};
	const clock = $derived.by(() => {
		const years = reduced ? 600 : t * YPS;
		const key = `${tpole}|${fresh}`;
		const today = (y0: number) => ({
			y0,
			run: runOverturning(TODAY_DS, tpole, fresh, RUN),
			movedBefore: 0
		});
		if (memo.segs.length === 0 || t < memo.lastT - 1e-6 || (reduced && key !== memo.key)) {
			memo.segs = [today(0)];
		} else if (resets !== memo.resets && !reduced) {
			memo.segs = [today(years)];
		} else if (key !== memo.key && !reduced) {
			const last = memo.segs[memo.segs.length - 1];
			const y = years - last.y0;
			memo.segs.push({
				y0: years,
				run: runOverturning(at(last.run, y, last.run.dS), tpole, fresh, RUN),
				movedBefore: last.movedBefore + at(last.run, y, last.run.moved)
			});
			if (memo.segs.length > 40) memo.segs.splice(0, memo.segs.length - 40);
		}
		memo.key = key;
		memo.resets = resets;
		memo.lastT = t;
		return { years, segs: memo.segs.slice() };
	});

	const segAt = (segs: Seg[], years: number) => {
		let s = segs[0];
		for (const x of segs) if (x.y0 <= years + 1e-9) s = x;
		return s;
	};
	const state = $derived.by(() => {
		const { years, segs } = clock;
		const s = segAt(segs, years);
		const y = years - s.y0;
		return {
			dS: at(s.run, y, s.run.dS),
			q: at(s.run, y, s.run.q),
			moved: s.movedBefore + at(s.run, y, s.run.moved)
		};
	});
	const q = $derived(state.q);
	const sEq = $derived(BOX.S0 + state.dS / 2);
	const sPole = $derived(BOX.S0 - state.dS / 2);
	const rhoEq = $derived(density(BOX.Teq, sEq));
	const rhoPole = $derived(density(tpole, sPole));
	const heat = $derived(heatTransport(tpole, q));

	// ---- the loop: chevrons moving with ∫q dt ----------------------------------------------
	const loopPts = (() => {
		const { x0, x1, top, bottom, r } = TRACK;
		const pts: { x: number; y: number }[] = [];
		const arc = (cx: number, cy: number, a0: number, a1: number) => {
			for (let i = 0; i <= 8; i++) {
				const a = a0 + ((a1 - a0) * i) / 8;
				pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
			}
		};
		// clockwise on screen: east along the top, down in the north, west at depth, up in the tropics
		arc(x0 + r, top + r, Math.PI, 1.5 * Math.PI);
		arc(x1 - r, top + r, 1.5 * Math.PI, 2 * Math.PI);
		arc(x1 - r, bottom - r, 0, 0.5 * Math.PI);
		arc(x0 + r, bottom - r, 0.5 * Math.PI, Math.PI);
		pts.push(pts[0]);
		return pts;
	})();
	const loopLen = (() => {
		let L = 0;
		for (let i = 1; i < loopPts.length; i++)
			L += Math.hypot(loopPts[i].x - loopPts[i - 1].x, loopPts[i].y - loopPts[i - 1].y);
		return L;
	})();
	const loopD =
		loopPts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + 'Z';
	function pointAt(u: number) {
		let target = u * loopLen;
		for (let i = 1; i < loopPts.length; i++) {
			const a = loopPts[i - 1];
			const b = loopPts[i];
			const d = Math.hypot(b.x - a.x, b.y - a.y);
			if (target <= d) {
				const f = d ? target / d : 0;
				return {
					x: a.x + (b.x - a.x) * f,
					y: a.y + (b.y - a.y) * f,
					angle: Math.atan2(b.y - a.y, b.x - a.x)
				};
			}
			target -= d;
		}
		return { x: loopPts[0].x, y: loopPts[0].y, angle: 0 };
	}
	const N_CHEV = 22;
	/** One circuit moves the water of both boxes once (about 370 years at 17 Sv). */
	const circuits = $derived(state.moved / (2 * BOX.V));
	const chevrons = $derived(
		Array.from({ length: N_CHEV }, (_, j) => {
			const p = pointAt(cycle(circuits, 1, j / N_CHEV));
			return { j, ...p, angle: p.angle + (q >= 0 ? 0 : Math.PI) };
		})
	);
	const flowW = $derived(2 + Math.min(14, (Math.abs(q) / SV) * 0.55));
	const flowOpacity = $derived(Math.min(1, 0.2 + Math.abs(q) / (4 * SV)));

	// ---- fresh water and evaporation above (pure functions of t) -------------------------------
	const tv = $derived(reduced ? 2.5 : t);
	const drops = $derived(
		Array.from({ length: Math.round(fresh * 8) }, (_, i) => {
			const u = cycle(tv, 1.4, (i * 0.618) % 1);
			return {
				i,
				x: 418 + ((i * 37) % 130),
				y: 84 + u * (SURF - 94),
				o: Math.min(1, 6 * u) * (1 - Math.max(0, (u - 0.85) / 0.15))
			};
		})
	);

	// ---- time plot ------------------------------------------------------------------------------
	const tx = $derived.by(() => {
		const end = Math.max(WINDOW, clock.years);
		return scale([end - WINDOW, end], [PX0, PX1]);
	});
	const ty = scale([-10, 30], [TP.bottom, TP.top]);
	const clampQ = (v: number) => Math.max(-10, Math.min(30, v));
	const trace = $derived.by(() => {
		const { years, segs } = clock;
		const start = Math.max(0, years - WINDOW);
		const n = 160;
		let d = '';
		for (let i = 0; i <= n; i++) {
			const y = start + ((years - start) * i) / n;
			const s = segAt(segs, y);
			const v = at(s.run, y - s.y0, s.run.q) / SV;
			d += `${i ? 'L' : 'M'}${tx(y).toFixed(1)} ${ty(clampQ(v)).toFixed(1)}`;
		}
		return d;
	});
	const tTicks = $derived.by(() => {
		const [a, b] = tx.domain;
		const out: number[] = [];
		for (let v = Math.ceil(a / 200) * 200; v <= b + 1e-6; v += 200) out.push(v);
		return out;
	});

	// ---- lower plots ------------------------------------------------------------------------------
	const lowerTS = new Tween(1, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'tipping' ? 0 : 1;
		untrack(() => lowerTS.set(v, { duration: reduced ? 0 : 800 }));
	});
	// T–S diagram with lines of equal density: T = 10 + (β(S − 35) − (ρ/ρ0 − 1)) / α
	// wide enough for the saltiest/freshest steady states the controls can reach (ΔS up to ≈ 6.8)
	const S_LO = 31.4;
	const S_HI = 38.6;
	const sxS = scale([S_LO, S_HI], [PX0, PX1]);
	const syT = scale([-4, 28], [LP.bottom, LP.top]);
	const isopycnals = [1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1032].map(
		(rho) => {
			const Tof = (S: number) => 10 + (BOX.betaS * (S - 35) - (rho / BOX.rho0 - 1)) / BOX.alpha;
			return {
				rho,
				d: `M${sxS(S_LO).toFixed(1)} ${syT(Tof(S_LO)).toFixed(1)} L${sxS(S_HI).toFixed(1)} ${syT(Tof(S_HI)).toFixed(1)}`
			};
		}
	);
	const clampS = (v: number) => Math.max(S_LO, Math.min(S_HI, v));
	const tsPole = $derived({ x: sxS(clampS(sPole)), y: syT(Math.max(-4, Math.min(28, tpole))) });
	const tsEq = $derived({ x: sxS(clampS(sEq)), y: syT(BOX.Teq) });
	// steady states against fresh water
	const bx = scale([0, 2.5], [PX0, PX1]);
	const by = scale([-10, 30], [LP.bottom, LP.top]);
	const branches = $derived.by(() => {
		let strong = '';
		let middle = '';
		let reversed = '';
		const Y = (v: number) => by(clampQ(v / SV)).toFixed(1);
		for (let i = 0; i <= 250; i++) {
			const f = i / 100;
			const x = bx(f).toFixed(1);
			for (const e of equilibria(tpole, f)) {
				if (e.stable && e.q > 0) strong += `${strong ? 'L' : 'M'}${x} ${Y(e.q)}`;
				else if (!e.stable) middle += `${middle ? 'L' : 'M'}${x} ${Y(e.q)}`;
				else reversed += `${reversed ? 'L' : 'M'}${x} ${Y(e.q)}`;
			}
		}
		return { strong, middle, reversed };
	});
	const fUp = $derived(collapseThreshold(tpole));
	const fDown = $derived(restartThreshold(tpole));
	const band = $derived({ a: bx(Math.max(0, Math.min(2.5, fDown))), b: bx(Math.min(2.5, fUp)) });
	const tipQ = $derived(
		fUp <= 2.5 ? (equilibria(tpole, fUp - 1e-6).find((e) => e.stable && e.q > 0)?.q ?? 0) : 0
	);
	const now = $derived({ x: bx(Math.min(2.5, fresh)), y: by(clampQ(q / SV)) });

	// ---- readouts ---------------------------------------------------------------------------------
	const fmtQ = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v / SV).toFixed(1)} Sv`;
	const cells: Cell[] = $derived.by(() => {
		const out: Cell[] = [
			{
				id: 'q',
				label: 'overturning',
				value: fmtQ(q),
				sub: q >= 0.5 * SV ? 'sinking in the north' : q <= -0.5 * SV ? 'reversed, weak' : 'stalled',
				color: 'var(--oc-flow)'
			}
		];
		if (phase === 'density')
			out.push({
				id: 'drho',
				label: 'northern water is',
				value: `${rhoPole - rhoEq >= 0 ? '+' : '−'}${Math.abs(rhoPole - rhoEq).toFixed(2)} kg/m³`,
				sub: rhoPole > rhoEq ? 'denser than tropical' : 'lighter than tropical',
				color: 'var(--oc-cold)'
			});
		else
			out.push({
				id: 'heat',
				label: 'heat carried north',
				value: `${heat < 0 ? '−' : ''}${Math.abs(heat / 1e15).toFixed(2)} PW`,
				sub: '1 PW = 10¹⁵ watts',
				color: 'var(--oc-warm)'
			});
		return out;
	});

	const tpoleColor = $derived(
		`color-mix(in oklab, var(--oc-warm) ${Math.round(((tpole + 2) / 27) * 100)}%, var(--oc-cold))`
	);
	const boxes = $derived([
		{
			id: 'eq',
			x: (TRACK.x0 + MID) / 2 + 12,
			T: BOX.Teq,
			S: sEq,
			rho: rhoEq,
			name: 'tropics',
			color: 'var(--oc-warm)'
		},
		{
			id: 'pole',
			x: (MID + TRACK.x1) / 2 - 8,
			T: tpole,
			S: sPole,
			rho: rhoPole,
			name: 'far north',
			color: tpoleColor
		}
	]);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet frame(
	sx: Scale,
	sy: Scale,
	xt: number[],
	yt: number[],
	xf: (v: number) => string,
	yf: (v: number) => string
)}
	{@const l = Math.min(...sx.range)}
	{@const r = Math.max(...sx.range)}
	{@const b = Math.max(...sy.range)}
	{@const tp = Math.min(...sy.range)}
	<g style:pointer-events="none">
		{#each yt as v (v)}
			<line x1={l} x2={r} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
			<text x={l - 6} y={sy(v) + 4} text-anchor="end" class="muted" style:font-size="11px"
				>{yf(v)}</text
			>
		{/each}
		<line x1={l} x2={r} y1={b} y2={b} stroke="var(--stage-line)" />
		<line x1={l} x2={l} y1={tp} y2={b} stroke="var(--stage-line)" />
		{#each xt as v (v)}
			<line x1={sx(v)} x2={sx(v)} y1={b} y2={b + 4} stroke="var(--stage-line)" />
			<text x={sx(v)} y={b + 16} text-anchor="middle" class="muted" style:font-size="11px"
				>{xf(v)}</text
			>
		{/each}
	</g>
{/snippet}

<g>
	<defs>
		<linearGradient
			id="overturn-track"
			gradientUnits="userSpaceOnUse"
			x1="0"
			y1={TRACK.top}
			x2="0"
			y2={TRACK.bottom}
		>
			<stop offset="0" stop-color="var(--oc-warm)" />
			<stop offset="1" stop-color="var(--oc-cold)" />
		</linearGradient>
		<clipPath id="overturn-ts">
			<rect x={PX0} y={LP.top} width={PX1 - PX0} height={LP.bottom - LP.top} />
		</clipPath>
		<clipPath id="overturn-time">
			<rect x={PX0} y={TP.top - 4} width={PX1 - PX0 + 6} height={TP.bottom - TP.top + 8} />
		</clipPath>
	</defs>

	<!-- ===== the slice ===== -->
	<rect x={SX0} y={SURF} width={MID - SX0} height={FLOOR - SURF} fill="var(--oc-sea)" />
	<rect x={MID} y={SURF} width={SX1 - MID} height={FLOOR - SURF} fill="var(--oc-deep)" />
	<rect
		x={SX0}
		y={SURF}
		width={MID - SX0}
		height={FLOOR - SURF}
		fill="var(--oc-warm)"
		opacity="0.16"
	/>
	<rect x={MID} y={SURF} width={SX1 - MID} height={FLOOR - SURF} fill={tpoleColor} opacity="0.12" />
	<line
		x1={MID}
		x2={MID}
		y1={SURF}
		y2={FLOOR}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 5"
		opacity="0.6"
	/>
	<line x1={SX0} x2={SX1} y1={SURF} y2={SURF} stroke="var(--oc-flow)" stroke-width="1.5" />
	<path
		d="M{SX0} {FLOOR + 2} L{SX0} {FLOOR - 6} Q 140 {FLOOR - 26} 220 {FLOOR - 10} T 400 {FLOOR -
			14} T {SX1} {FLOOR - 8} L{SX1} {FLOOR + 2} Z"
		fill="var(--oc-land)"
		stroke="var(--oc-land-edge)"
	/>
	{@render txt(SX0 + 4, FLOOR + 22, 'equator', 11, { muted: true })}
	{@render txt(SX1, FLOOR + 22, '65°N', 11, { anchor: 'end', muted: true })}
	{@render txt(MID, FLOOR + 22, 'a slice through the Atlantic, 4 km deep', 11, {
		anchor: 'middle',
		muted: true
	})}

	<!-- the overturning loop -->
	<path
		d={loopD}
		fill="none"
		stroke="url(#overturn-track)"
		stroke-width={flowW}
		stroke-linejoin="round"
		opacity={0.3 + 0.45 * flowOpacity}
	/>
	{#each chevrons as c (c.j)}
		<path
			d="M-5 -5 L3 0 L-5 5"
			transform="translate({c.x.toFixed(1)} {c.y.toFixed(1)}) rotate({(
				(c.angle * 180) /
				Math.PI
			).toFixed(1)})"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={flowOpacity * 0.85}
		/>
	{/each}

	<!-- box readouts -->
	{#each boxes as b (b.id)}
		{@render txt(b.x, 268, b.name, 14, { anchor: 'middle', weight: 700 })}
		{@render txt(b.x, 292, `${b.T.toFixed(1)} °C`, 13, {
			anchor: 'middle',
			weight: 600,
			color: b.color
		})}
		{@render txt(b.x, 311, `salinity ${b.S.toFixed(2)}`, 12, { anchor: 'middle' })}
		{@render txt(b.x, 336, `${b.rho.toFixed(2)} kg/m³`, 13, { anchor: 'middle', weight: 600 })}
		{@render txt(b.x, 352, 'density', 11, { anchor: 'middle', muted: true })}
	{/each}
	{#if q > 0.5 * SV}
		{@render txt(TRACK.x1 - 22, 420, 'sinks', 12, {
			anchor: 'end',
			weight: 600,
			color: 'var(--oc-cold)'
		})}
	{/if}
	{@render txt(
		(TRACK.x0 + TRACK.x1) / 2,
		TRACK.top - 14,
		q >= 0 ? 'warm water flows north →' : '← surface water flows south',
		12,
		{ anchor: 'middle', weight: 600 }
	)}
	{@render txt(
		(TRACK.x0 + TRACK.x1) / 2,
		TRACK.bottom + 26,
		q >= 0 ? '← cold deep water creeps south' : 'deep water creeps north →',
		12,
		{ anchor: 'middle', weight: 600 }
	)}

	<!-- sky: evaporation in the tropics, fresh water on the north -->
	<circle cx="76" cy="74" r="16" fill="var(--oc-hill)" />
	{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
		{@const a = (k * Math.PI) / 4}
		<line
			x1={76 + 21 * Math.cos(a)}
			y1={74 + 21 * Math.sin(a)}
			x2={76 + 28 * Math.cos(a)}
			y2={74 + 28 * Math.sin(a)}
			stroke="var(--oc-hill)"
			stroke-width="2"
			stroke-linecap="round"
		/>
	{/each}
	{#each [0, 1, 2] as k (k)}
		{@const u = cycle(tv, 2.2, k / 3)}
		<path
			d="M{150 + k * 40} {SURF - 6 - u * 46} q 5 -6 0 -12 q -5 -6 0 -12"
			fill="none"
			stroke="var(--oc-fresh)"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity={Math.sin(Math.PI * u) * 0.9}
		/>
	{/each}
	{@render txt(118, 52, 'evaporation leaves', 11, { muted: true })}
	{@render txt(118, 66, 'the salt behind', 11, { muted: true })}
	<g>
		<ellipse cx="482" cy="70" rx="64" ry="16" fill="var(--oc-cloud)" />
		<ellipse cx="452" cy="62" rx="30" ry="17" fill="var(--oc-cloud)" />
		<ellipse cx="506" cy="58" rx="32" ry="19" fill="var(--oc-cloud)" />
	</g>
	{#each drops as d (d.i)}
		<line
			x1={d.x}
			x2={d.x - 1.5}
			y1={d.y}
			y2={d.y + 8}
			stroke="var(--oc-fresh)"
			stroke-width="2"
			stroke-linecap="round"
			opacity={d.o}
		/>
	{/each}
	{@render txt(
		480,
		28,
		`fresh water: ${fresh === 1 ? "today's" : `${fresh.toFixed(2)} × today's`}`,
		12,
		{ anchor: 'middle', weight: 600, color: 'var(--oc-fresh)' }
	)}

	<!-- ===== right column ===== -->
	<Card x={PX0 - 56} y={16} w={PX1 - PX0 + 72} {cells} row cellH={78} />

	{@render txt(PX0 - 56, TP.top - 14, 'overturning (Sv)', 12, { muted: true })}
	{@render txt(PX1, TP.top - 14, `year ${Math.round(clock.years)} · 25 years a second`, 11, {
		anchor: 'end',
		muted: true
	})}
	{@render frame(
		tx,
		ty,
		tTicks,
		[-10, 0, 10, 20, 30],
		(v) => `${Math.round(v)}`,
		(v) => `${v}`
	)}
	{@render txt(PX1, TP.bottom + 32, 'years', 11, { anchor: 'end', muted: true })}
	<line
		x1={PX0}
		x2={PX1}
		y1={ty(17)}
		y2={ty(17)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	{@render txt(PX1 - 2, ty(17) - 5, "today's 17", 10, { anchor: 'end', muted: true })}
	<g clip-path="url(#overturn-time)">
		<path
			d={trace}
			fill="none"
			stroke="var(--oc-flow)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
	</g>
	<circle
		cx={tx(clock.years)}
		cy={ty(clampQ(q / SV))}
		r="4.5"
		fill="var(--oc-flow)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	{#if lowerTS.current > 0.01}
		<g opacity={lowerTS.current}>
			{@render txt(PX0 - 56, LP.top - 14, 'temperature against salinity', 12, { muted: true })}
			{@render frame(
				sxS,
				syT,
				[32, 34, 36, 38],
				[0, 10, 20],
				(v) => `${v}`,
				(v) => `${v} °C`
			)}
			<g clip-path="url(#overturn-ts)">
				{#each isopycnals as iso (iso.rho)}
					<path
						d={iso.d}
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
						stroke-dasharray="2 4"
						opacity="0.8"
					/>
				{/each}
			</g>
			{@render txt(PX1, LP.top - 14, 'dotted: equal density', 10, { anchor: 'end', muted: true })}
			{@render txt(PX1 - 4, LP.bottom - 8, 'denser ↘', 11, { anchor: 'end', weight: 600 })}
			{@render txt(PX1, LP.bottom + 32, 'salinity', 11, { anchor: 'end', muted: true })}
			<circle
				cx={tsEq.x}
				cy={tsEq.y}
				r="7"
				fill="var(--oc-warm)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(tsEq.x - 12, tsEq.y + 4, 'tropics', 12, { anchor: 'end', weight: 600 })}
			<circle
				cx={tsPole.x}
				cy={tsPole.y}
				r="7"
				fill={tpoleColor}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(tsPole.x + (tsPole.x < PX0 + 80 ? 12 : -12), tsPole.y + 4, 'far north', 12, {
				anchor: tsPole.x < PX0 + 80 ? 'start' : 'end',
				weight: 600
			})}
		</g>
	{/if}
	{#if lowerTS.current < 0.99}
		<g opacity={1 - lowerTS.current}>
			{@render txt(PX0 - 56, LP.top - 14, 'steady overturning (Sv) against fresh water', 12, {
				muted: true
			})}
			{#if band.b > band.a}
				<rect
					x={band.a}
					y={LP.top}
					width={band.b - band.a}
					height={LP.bottom - LP.top}
					fill="var(--oc-hill)"
					opacity="0.14"
				/>
				{@render txt((band.a + band.b) / 2, by(26), 'two possible states', 11, {
					anchor: 'middle',
					weight: 600
				})}
			{/if}
			{@render frame(
				bx,
				by,
				[0, 0.5, 1, 1.5, 2, 2.5],
				[-10, 0, 10, 20, 30],
				(v) => (v === 2.5 ? '2.5×' : `${v}`),
				(v) => `${v}`
			)}
			{@render txt(PX1, LP.bottom + 32, "× today's fresh water", 11, {
				anchor: 'end',
				muted: true
			})}
			<path d={branches.strong} fill="none" stroke="var(--oc-flow)" stroke-width="2.5" />
			<path d={branches.reversed} fill="none" stroke="var(--oc-flow)" stroke-width="2.5" />
			<path
				d={branches.middle}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
			/>
			{#if fUp <= 2.5}
				{@render txt(bx(fUp) + 6, by(clampQ(tipQ / SV)) - 8, 'tips', 11, { weight: 700 })}
			{/if}
			<circle
				cx={now.x}
				cy={now.y}
				r="6"
				fill="var(--oc-warm)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(
				now.x + (now.x > PX1 - 40 ? -10 : 10),
				now.y + (q > 22 * SV ? 20 : -10),
				'now',
				11,
				{
					anchor: now.x > PX1 - 40 ? 'end' : 'start',
					weight: 700,
					color: 'var(--oc-warm)'
				}
			)}
		</g>
	{/if}
</g>
