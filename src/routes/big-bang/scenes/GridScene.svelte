<script lang="ts">
	/**
	 * The expanding lattice of galaxies (see `GridView`) with, beside it, what the viewpoint
	 * measures. Phases (`step.hints.phase`):
	 *   hubble   — the film runs (3 → 20 → 3 Gyr); speed against distance on the right
	 *   view     — the same, from the galaxy picked with `params.view` or by clicking
	 *   split    — two windows, from the Milky Way and from galaxy B, same moment
	 *   history  — time from `params.time`; the scale factor a(t) on the right
	 *   contents — the same, with the mix of radiation, matter and dark energy
	 * Everything comes from the Friedmann model in `cosmology.ts`. Under reduced motion the
	 * film stops at today.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		AGE,
		T0,
		acceleration,
		composition,
		hubble,
		hubblePerGyr,
		scaleAt,
		timeAt
	} from '../cosmology';
	import { gyrText, tempText } from '../format';
	import { ARROW_TIME, NAMED, S, filmTime, galaxy, sample, viewIndex } from './grid';
	import GridView from './GridView.svelte';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'hubble'));
	const film = $derived(phase === 'hubble' || phase === 'view' || phase === 'split');
	const filmed = $derived(reduced ? { time: AGE, forward: true } : filmTime(t, AGE));
	const time = $derived(film ? filmed.time : Number(params.time ?? AGE));
	const a = $derived(scaleAt(time));
	const H = $derived(hubblePerGyr(a));

	// ---- the viewpoint, eased between galaxies ------------------------------------------
	const viewKey = $derived(phase === 'view' ? String(params.view ?? 'mw') : 'mw');
	const vIdx = $derived(viewIndex(viewKey));
	const target = $derived(galaxy(vIdx.i, vIdx.j));
	const cam = new Tween({ x: 0, y: 0 }, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const g = target;
		untrack(() => cam.set({ x: g.x, y: g.y }, { duration: reduced ? 0 : 800 }));
	});
	const pick = (i: number, j: number) => {
		const named = Object.entries(NAMED).find(([, n]) => n.i === i && n.j === j);
		setParam('view', named ? named[0] : `${i},${j}`);
	};
	const viewName = $derived(
		viewKey === 'mw'
			? 'the Milky Way'
			: NAMED[viewKey]
				? `galaxy ${NAMED[viewKey].name}`
				: 'the galaxy you picked'
	);

	// ---- geometry -------------------------------------------------------------------------
	const MAP = { x: 16, y: 16, w: 600, h: 568 };
	const RX = 632;
	const RW = 312;

	// ---- the Hubble plot ----------------------------------------------------------------
	const HP = { x: RX + 50, y: 98, w: RW - 72, h: 204 };
	const DMAX = 7;
	const VMAX = 1.2;
	const hx = (d: number) => HP.x + (d / DMAX) * HP.w;
	const hy = (v: number) => HP.y + HP.h - (v / VMAX) * HP.h;
	const points = $derived(
		film && phase !== 'split'
			? sample(vIdx.i, vIdx.j, cam.current, a, MAP.w / 2, MAP.h / 2, 30)
					.filter((s) => s.d > 0.05 && s.d <= DMAX && H * s.d <= VMAX)
					.slice(0, 160)
			: []
	);
	const lineEnd = $derived(Math.min(DMAX, VMAX / H));
	const hubbleD = $derived(1 / H); // Gly: where v = c

	// ---- a(t) ---------------------------------------------------------------------------
	const AP = $derived(
		phase === 'contents'
			? { x: RX + 46, y: 70, w: RW - 66, h: 170 }
			: { x: RX + 46, y: 70, w: RW - 66, h: 230 }
	);
	const TMIN = -1;
	const TMAX = 30;
	const AMAX = 3;
	const ax = (tt: number) => AP.x + ((tt - TMIN) / (TMAX - TMIN)) * AP.w;
	const ay = (v: number) => AP.y + AP.h - (v / AMAX) * AP.h;
	/** The curve, split where the expansion turns from slowing to speeding up. */
	const curve = Array.from({ length: 241 }, (_, k) => {
		const tt = 0.002 + (TMAX * k) / 240;
		const sa = scaleAt(tt);
		return { tt, a: sa, acc: acceleration(sa) > 0 };
	});
	/** When the expansion began to speed up: ä = 0, found by bisection on a. */
	const tAcc = (() => {
		let lo = 0.3;
		let hi = 1;
		for (let k = 0; k < 50; k++) {
			const mid = (lo + hi) / 2;
			if (acceleration(mid) < 0) lo = mid;
			else hi = mid;
		}
		return timeAt(lo);
	})();
	const pathOf = (pts: { tt: number; a: number }[]) =>
		pts.map((p, k) => `${k ? 'L' : 'M'}${ax(p.tt).toFixed(1)} ${ay(p.a).toFixed(1)}`).join(' ');
	const dPast = $derived(pathOf(curve.filter((p) => !p.acc || phase !== 'contents')));
	const dSlow = $derived(pathOf(curve.filter((p) => !p.acc)));
	const dFast = $derived(pathOf(curve.filter((p) => p.acc || p.tt >= tAcc - 0.2)));
	// today's speed, kept steady: a = 1 + H0 (t − t0)
	const H0G = hubblePerGyr(1);
	const tZero = AGE - 1 / H0G;
	const mix = $derived(composition(a));
	const speeding = $derived(acceleration(a) > 0);

	const pct = (v: number) =>
		v >= 0.1 ? `${(v * 100).toFixed(1)}%` : v >= 0.001 ? `${(v * 100).toFixed(2)}%` : '< 0.1%';
	const timeLabel = $derived(
		film
			? `${gyrText(time)} after the Big Bang · ${reduced ? 'today' : filmed.forward ? 'running forward ▶' : '◀ running backward'}`
			: `${gyrText(time)} after the Big Bang${Math.abs(time - AGE) < 0.03 ? ' (today)' : time > AGE ? ' (future)' : ''}`
	);
</script>

{#snippet legend(x: number, y: number)}
	<g style:pointer-events="none">
		<rect {x} {y} width="180" height="46" rx="8" fill="var(--surface)" stroke="var(--border)" />
		<defs>
			<linearGradient id="grid-legend" x1="0" x2="1">
				<stop offset="0" style:stop-color="var(--bb-gal)" />
				<stop offset="0.5" style:stop-color="var(--bb-mid)" />
				<stop offset="1" style:stop-color="var(--bb-red)" />
			</linearGradient>
		</defs>
		<rect x={x + 10} y={y + 24} width="160" height="7" rx="3" fill="url(#grid-legend)" />
		<T x={x + 10} y={y + 17} text="redshift of the light you see" size={11} muted />
		<T x={x + 10} y={y + 42} text="0" size={10.5} muted />
		<T x={x + 90} y={y + 42} text="0.3" size={10.5} anchor="middle" muted />
		<T x={x + 170} y={y + 42} text="1.5+" size={10.5} anchor="end" muted />
	</g>
{/snippet}

{#snippet ruler(x: number, y: number)}
	<g style:pointer-events="none">
		<line x1={x} x2={x + S} y1={y} y2={y} stroke="var(--stage-ink)" stroke-width="2" />
		<line x1={x} x2={x} y1={y - 5} y2={y + 5} stroke="var(--stage-ink)" stroke-width="1.5" />
		<line
			x1={x + S}
			x2={x + S}
			y1={y - 5}
			y2={y + 5}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<T x={x + S + 8} y={y + 4} text="1 billion light years" size={11.5} />
	</g>
{/snippet}

<g>
	{#if phase === 'split'}
		{#each [{ key: 'mw', x: 16 }, { key: 'b', x: 488 }] as v (v.key)}
			{@const g = galaxy(NAMED[v.key].i, NAMED[v.key].j)}
			<GridView
				id="split-{v.key}"
				x={v.x}
				y={52}
				w={456}
				h={474}
				cam={g}
				vi={NAMED[v.key].i}
				vj={NAMED[v.key].j}
				{a}
				gap={58}
				t={reduced ? 0 : t}
			/>
			<Readout
				id="split-title-{v.key}"
				order={v.key === 'mw' ? 3 : 4}
				label={v.key === 'mw' ? 'Left' : 'Right'}
				value={v.key === 'mw' ? 'seen from the Milky Way' : 'seen from galaxy B'}
			>
				<T
					x={v.x + 228}
					y={38}
					text={v.key === 'mw' ? 'Seen from the Milky Way' : 'Seen from galaxy B'}
					size={14}
					weight={700}
					anchor="middle"
				/>
			</Readout>
		{/each}
		<Readout id="split-time" order={1} label="Time" value={timeLabel}>
			<T x={480} y={552} text={timeLabel} size={13.5} weight={650} anchor="middle" />
		</Readout>
		<Readout
			id="split-note"
			order={2}
			label="Both views"
			value="everything recedes, farther is faster"
		>
			<T
				x={480}
				y={574}
				text="Same universe, same moment: each galaxy sees all the others recede, farther ones faster."
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
	{:else}
		<GridView
			id="grid-map"
			{...MAP}
			cam={cam.current}
			vi={vIdx.i}
			vj={vIdx.j}
			{a}
			onpick={phase === 'view' ? pick : undefined}
			t={reduced ? 0 : t}
		/>
		<Readout id="time" order={1} label="Time" value={timeLabel}>
			<rect
				x={MAP.x + 10}
				y={MAP.y + 10}
				width={Math.min(MAP.w - 20, timeLabel.length * 6.6 + 26)}
				height="28"
				rx="14"
				fill="var(--surface)"
				stroke="var(--border)"
				style:pointer-events="none"
			/>
			<T x={MAP.x + 22} y={MAP.y + 29} text={timeLabel} size={13} weight={650} />
		</Readout>
		<Readout id="ruler">
			{@render ruler(MAP.x + 18, MAP.y + MAP.h - 22)}
		</Readout>
		<Readout id="legend">
			{@render legend(MAP.x + MAP.w - 192, MAP.y + MAP.h - 58)}
		</Readout>

		{#if phase === 'hubble' || phase === 'view'}
			<Card x={RX} y={16} w={RW} h={330} />
			<T x={RX + 16} y={44} text="Speed against distance" size={15} weight={700} />
			<T x={RX + 16} y={64} text="as measured from {viewName}" size={11.5} muted />
			<!-- axes -->
			{#each [0, 0.5, 1] as v (v)}
				<line
					x1={HP.x}
					x2={HP.x + HP.w}
					y1={hy(v)}
					y2={hy(v)}
					stroke="var(--stage-grid)"
					stroke-dasharray={v === 1 ? '4 4' : undefined}
				/>
				<T
					x={HP.x - 6}
					y={hy(v) + 4}
					text={v === 0 ? '0' : v === 1 ? 'c' : '½c'}
					size={11}
					anchor="end"
					muted
				/>
			{/each}
			{#each [0, 2, 4, 6] as d (d)}
				<T x={hx(d)} y={HP.y + HP.h + 16} text={String(d)} size={11} anchor="middle" muted />
			{/each}
			<line
				x1={HP.x}
				x2={HP.x + HP.w}
				y1={HP.y + HP.h}
				y2={HP.y + HP.h}
				stroke="var(--stage-line)"
			/>
			<line x1={HP.x} x2={HP.x} y1={HP.y} y2={HP.y + HP.h} stroke="var(--stage-line)" />
			<T
				x={HP.x + HP.w}
				y={HP.y + HP.h + 32}
				text="distance now, billion light years"
				size={11}
				anchor="end"
				muted
			/>
			<T x={HP.x - 6} y={HP.y - 8} text="speed" size={11} muted />
			<line
				x1={hx(0)}
				y1={hy(0)}
				x2={hx(lineEnd)}
				y2={hy(H * lineEnd)}
				stroke="var(--bb-arrow)"
				stroke-width="2"
				opacity="0.7"
			/>
			{#each points as p (p.key)}
				<circle cx={hx(p.d)} cy={hy(H * p.d)} r="2.6" fill="var(--bb-gal)" opacity="0.8" />
			{/each}
			{#if hubbleD < DMAX}
				<T
					x={hx(hubbleD) - 4}
					y={hy(1) - 6}
					text="faster than light beyond {hubbleD.toFixed(1)}"
					size={10.5}
					anchor={hubbleD > 3.5 ? 'end' : 'start'}
					muted
				/>
			{/if}

			<Card x={RX} y={362} w={RW} h={222} />
			<Readout
				id="h"
				order={2}
				label="Expansion rate H"
				value="{hubble(a).toFixed(1)} km/s per Mpc"
			>
				<T x={RX + 16} y={388} text="Expansion rate H (the slope)" size={12.5} muted />
				<T
					x={RX + RW - 16}
					y={410}
					text="{hubble(a).toFixed(1)} km/s per megaparsec"
					size={14}
					weight={700}
					anchor="end"
					color="var(--bb-arrow)"
				/>
			</Readout>
			<Readout
				id="scale"
				order={3}
				label="Distances compared with today"
				value="{(a * 100).toFixed(0)}%"
			>
				<T x={RX + 16} y={438} text="Distances compared with today" size={12.5} muted />
				<T x={RX + RW - 16} y={460} text="× {a.toFixed(2)}" size={14} weight={700} anchor="end" />
			</Readout>
			<Readout id="growth">
				<T x={RX + 16} y={488} text="Every distance grows by" size={12.5} muted />
				<T
					x={RX + RW - 16}
					y={510}
					text="{(H * 100).toFixed(1)}% per billion years"
					size={14}
					weight={700}
					anchor="end"
				/>
				<T x={RX + 16} y={556} text="Arrows: where each galaxy would be after" size={11} muted />
				<T
					x={RX + 16}
					y={572}
					text="{gyrText(ARROW_TIME / H)} at its present speed"
					size={11}
					muted
				/>
			</Readout>
		{:else}
			<!-- a(t) -->
			<Card x={RX} y={16} w={RW} h={phase === 'contents' ? 268 : 350} />
			<T x={RX + 16} y={44} text="Size of the universe, a" size={15} weight={700} />
			{#each [0, 1, 2, 3] as v (v)}
				<line x1={AP.x} x2={AP.x + AP.w} y1={ay(v)} y2={ay(v)} stroke="var(--stage-grid)" />
				<T x={AP.x - 6} y={ay(v) + 4} text={String(v)} size={11} anchor="end" muted />
			{/each}
			{#each [0, 10, 20, 30] as tt (tt)}
				<T x={ax(tt)} y={AP.y + AP.h + 16} text={String(tt)} size={11} anchor="middle" muted />
			{/each}
			<line
				x1={AP.x}
				x2={AP.x + AP.w}
				y1={AP.y + AP.h}
				y2={AP.y + AP.h}
				stroke="var(--stage-line)"
			/>
			<line x1={ax(0)} x2={ax(0)} y1={AP.y} y2={AP.y + AP.h} stroke="var(--stage-line)" />
			<T
				x={AP.x + AP.w}
				y={AP.y + AP.h + 32}
				text="billion years after the Big Bang"
				size={11}
				anchor="end"
				muted
			/>
			{#if phase === 'contents'}
				<path d={dSlow} fill="none" stroke="var(--bb-matter)" stroke-width="2.6" />
				<path d={dFast} fill="none" stroke="var(--bb-de)" stroke-width="2.6" />
				<line
					x1={ax(tAcc)}
					x2={ax(tAcc)}
					y1={AP.y + 22}
					y2={AP.y + AP.h}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 3"
				/>
				<T x={ax(tAcc) - 5} y={AP.y + 16} text="← slowing" size={11} anchor="end" />
				<T x={ax(tAcc) + 5} y={AP.y + 16} text="speeding up →" size={11} />
			{:else}
				<!-- today's speed, kept steady -->
				<line
					x1={ax(tZero)}
					y1={ay(0)}
					x2={ax(TMAX)}
					y2={ay(1 + H0G * (TMAX - AGE))}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.4"
					stroke-dasharray="5 4"
				/>
				<path d={dPast} fill="none" stroke="var(--bb-curve)" stroke-width="2.6" />
				<Readout id="steady">
					<line
						x1={RX + 16}
						x2={RX + 40}
						y1={AP.y + AP.h + 49}
						y2={AP.y + AP.h + 49}
						stroke="var(--stage-ink-muted)"
						stroke-width="1.4"
						stroke-dasharray="5 4"
					/>
					<T
						x={RX + 46}
						y={AP.y + AP.h + 53}
						text="today’s speed kept: 0 at {(AGE - tZero).toFixed(1)} Gyr ago"
						size={11}
						muted
					/>
				</Readout>
			{/if}
			<circle cx={ax(AGE)} cy={ay(1)} r="3.5" fill="none" stroke="var(--stage-ink)" />
			<T x={ax(AGE) + 6} y={ay(1) + 16} text="today" size={11} muted />
			<circle cx={ax(time)} cy={ay(a)} r="6" fill="var(--bb-view)" />

			{#if phase === 'history'}
				<Card x={RX} y={382} w={RW} h={202} />
				<Readout id="a" order={2} label="Scale factor a" value={a.toFixed(3)}>
					<T x={RX + 16} y={412} text="Distances compared with today" size={12.5} muted />
					<T x={RX + RW - 16} y={412} text="× {a.toFixed(2)}" size={14} weight={700} anchor="end" />
				</Readout>
				<Readout
					id="density"
					order={3}
					label="Density of matter"
					value="{(1 / a ** 3).toPrecision(3)} × today"
				>
					<T x={RX + 16} y={446} text="Density of matter" size={12.5} muted />
					<T
						x={RX + RW - 16}
						y={446}
						text="{(1 / a ** 3).toPrecision(3)} × today’s"
						size={14}
						weight={700}
						anchor="end"
					/>
				</Readout>
				<Readout id="temp" order={4} label="Temperature of the light" value={tempText(T0 / a)}>
					<T x={RX + 16} y={480} text="Temperature of the light" size={12.5} muted />
					<T x={RX + RW - 16} y={480} text={tempText(T0 / a)} size={14} weight={700} anchor="end" />
				</Readout>
				<Readout id="hd">
					<T x={RX + 16} y={518} text="Earlier: denser and hotter, everywhere" size={12} />
					<T x={RX + 16} y={538} text="at once. At a = 0, no limit." size={12} />
					<T x={RX + 16} y={566} text="Age today: {AGE.toFixed(2)} billion years" size={12} muted />
				</Readout>
			{:else}
				<!-- the mix -->
				<Card x={RX} y={300} w={RW} h={284} />
				<T x={RX + 16} y={328} text="What fills the universe" size={15} weight={700} />
				{@const BX = RX + 16}
				{@const BW = RW - 32}
				<rect x={BX} y={344} width={BW * mix.radiation} height="22" fill="var(--bb-radiation)" />
				<rect
					x={BX + BW * mix.radiation}
					y={344}
					width={BW * mix.matter}
					height="22"
					fill="var(--bb-matter)"
				/>
				<rect
					x={BX + BW * (mix.radiation + mix.matter)}
					y={344}
					width={BW * mix.darkEnergy}
					height="22"
					fill="var(--bb-de)"
				/>
				<rect x={BX} y={344} width={BW} height="22" rx="3" fill="none" stroke="var(--border)" />
				{#each [{ k: 'radiation', label: 'Radiation (light, neutrinos)', v: mix.radiation, c: 'var(--bb-radiation)' }, { k: 'matter', label: 'Matter (mostly dark)', v: mix.matter, c: 'var(--bb-matter)' }, { k: 'de', label: 'Dark energy', v: mix.darkEnergy, c: 'var(--bb-de)' }] as row, i (row.k)}
					<Readout
						id="mix-{row.k}"
						order={2 + i}
						label={row.label}
						value={pct(row.v)}
						color={row.c}
					>
						<rect x={BX} y={388 + i * 30} width="12" height="12" rx="2" fill={row.c} />
						<T x={BX + 20} y={399 + i * 30} text={row.label} size={12.5} />
						<T
							x={RX + RW - 16}
							y={399 + i * 30}
							text={pct(row.v)}
							size={13.5}
							weight={700}
							anchor="end"
						/>
					</Readout>
				{/each}
				<Readout
					id="pace"
					order={5}
					label="The expansion is"
					value={speeding ? 'speeding up' : 'slowing down'}
				>
					<T x={BX} y={502} text="The expansion is" size={12.5} muted />
					<T
						x={RX + RW - 16}
						y={502}
						text={speeding ? 'speeding up' : 'slowing down'}
						size={14}
						weight={700}
						anchor="end"
						color={speeding ? 'var(--bb-de)' : 'var(--bb-matter)'}
					/>
				</Readout>
				<Readout id="pace-note">
					<T x={BX} y={534} text="Matter’s pull slows it; dark energy," size={12} />
					<T x={BX} y={554} text="which never thins out, speeds it up" size={12} />
					<T x={BX} y={574} text="(since {tAcc.toFixed(1)} billion years)." size={12} />
				</Readout>
			{/if}
		{/if}
	{/if}
</g>
