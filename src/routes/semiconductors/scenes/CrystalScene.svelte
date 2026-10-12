<script lang="ts">
	/**
	 * Bands and gaps (`step.hints.phase`):
	 * - levels: N atoms (2^params.atoms) come together and each of two atomic levels splits
	 *   into N levels (tight-binding chain, `chainLevels`), forming two bands with a gap.
	 *   The lower band is full (two electrons per level), the upper one empty.
	 * - material (`hints.material` = metal | insulator | semiconductor): the crystal on the
	 *   left, its energy bands on the right on one shared eV scale, and the gaps of
	 *   germanium, silicon and diamond to the same scale beside kT. With `params.field` a
	 *   voltage is applied (− left, + right): the metal's electron sea drifts right, the
	 *   insulator's bonded electrons stay put, and in silicon a thermal electron–hole pair
	 *   (one at a time, much more often than in reality, as the notes say) drifts apart:
	 *   the electron to +, the hole to − as neighbouring bond electrons hop into it.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG presentation
	 * attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { GAPS, KT, NI_SI, N_SI, chainLevels, sci } from '../model';
	import {
		bondDot,
		bondPath,
		dotsPath,
		holeAt,
		makeLattice,
		missingDots,
		wander
	} from '../lattice';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'material'));
	const material = $derived(String(step.hints?.material ?? 'semiconductor'));
	const time = $derived(reduced ? 2.5 : t);
	const fieldOn = $derived(params.field !== false);

	// ---- levels ----------------------------------------------------------------------------
	const N = $derived(2 ** Math.round(Number(params.atoms ?? 3)));
	/** 0 → atoms apart (sharp atomic levels), 1 → bonded (levels spread into bands). */
	const grow = new Tween(1, { duration: 900, easing: cubicInOut });
	$effect(() => {
		void N;
		untrack(() => {
			if (reduced) return;
			grow.set(0, { duration: 0 });
			grow.set(1, { duration: 1200, delay: 150 });
		});
	});
	const together = $derived(Math.min(grow.current, smoothstep(0.2, 1.6, time)));
	const atomsDrawn = $derived.by(() => {
		const cols = Math.ceil(Math.sqrt(N));
		const rows = Math.ceil(N / cols);
		const s = Math.min(110, 330 / cols) * lerp(1.7, 1, together);
		const r = Math.min(30, (330 / cols) * 0.33);
		return Array.from({ length: N }, (_, i) => ({
			i,
			x: 240 + ((i % cols) - (cols - 1) / 2) * s,
			y: 300 + (Math.floor(i / cols) - (rows - 1) / 2) * s,
			r
		}));
	});
	const LX0 = 590;
	const LX1 = 800;
	const LOW = { y: 420, hw: 60 };
	const HIGH = { y: 200, hw: 70 };
	const levelYs = (band: { y: number; hw: number }) =>
		chainLevels(N, 0, 1).map((e) => band.y - (e / 2) * band.hw * together);
	const lowYs = $derived(levelYs(LOW));
	const highYs = $derived(levelYs(HIGH));
	const linesPath = (ys: number[]) => ys.map((y) => `M${LX0} ${y.toFixed(1)}H${LX1}`).join('');

	// ---- material: lattice -------------------------------------------------------------------
	const L = makeLattice(6, 5, 90, 175, 64);
	const ATOM_R = 19;
	const allBonds = bondPath(L, ATOM_R);
	const allDots = dotsPath(L, 3.6);
	const drift = $derived(fieldOn ? 26 : 0);

	// Metal: a sea of free electrons, one per ion (copper gives about one each).
	const sea = Array.from({ length: L.atoms.length }, (_, i) => ({
		i,
		x: L.atoms[i].x + 32 * (hash(i, 1) - 0.5) + 16,
		y: L.atoms[i].y + 32 * (hash(i, 2) - 0.5) + 16
	}));
	const seaNow = $derived(
		sea.map((e) => ({ i: e.i, ...wander(L, e, time, e.i + 11, drift * 1.4) }))
	);

	// Semiconductor: one thermal pair at a time, born every PERIOD seconds on a seeded bond.
	const PERIOD = 6.5;
	const pair = $derived.by(() => {
		const k = Math.floor(time / PERIOD);
		const s = time - k * PERIOD;
		const bond = 6 + Math.floor(hash(k, 5) * (L.bonds.length - 12));
		const from = bondDot(L, bond, 0);
		const free = { x: from.x + 18, y: from.y - 26 };
		const jump = smoothstep(0.4, 1.1, s);
		const life = smoothstep(0.2, 0.5, s) * (1 - smoothstep(5.6, 6.2, s));
		const e =
			s < 1.1
				? {
						x: lerp(from.x, free.x, jump),
						y: lerp(from.y, free.y, jump) - Math.sin(jump * Math.PI) * 14,
						opacity: 1
					}
				: wander(L, free, s - 1.1, k + 3, drift);
		const hole = holeAt(L, bond, k + 1, Math.max(0, s - 1.3), 0.9, fieldOn ? -1 : 0);
		return { k, s, bond, e, hole, life, jump };
	});
	const holeMissing = $derived(
		pair.life <= 0.01 ? null : missingDots(pair.hole.cur, pair.hole.p > 0 ? pair.hole.next : null)
	);
	const semiDots = $derived(holeMissing ? dotsPath(L, 3.6, holeMissing) : allDots);
	const hopper = $derived.by(() => {
		const { cur, next, p } = pair.hole;
		if (p <= 0 || p >= 1) return null;
		const a = bondDot(L, next, 0);
		const b = bondDot(L, cur, 0);
		if (Math.hypot(a.x - b.x, a.y - b.y) > L.gap * 1.2) return null;
		return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
	});
	/** Where the hole is drawn: on its bond, sliding to the next while the electron hops in. */
	const holePos = $derived.by(() => {
		const a = bondDot(L, pair.hole.cur, 0);
		if (!hopper) return a;
		const b = bondDot(L, pair.hole.next, 0);
		return { x: lerp(a.x, b.x, pair.hole.p), y: lerp(a.y, b.y, pair.hole.p) };
	});

	// ---- material: bands ---------------------------------------------------------------------
	const PX_PER_EV = 40;
	const VB_TOP = 430;
	const BAND_H = 2.6; // eV drawn for each band
	const yE = (e: number) => VB_TOP - PX_PER_EV * e;
	const gapTarget = $derived(
		material === 'metal' ? 0 : material === 'insulator' ? GAPS.C.gap : GAPS.Si.gap
	);
	const gap = Tween.of(() => gapTarget, { duration: 800, easing: cubicInOut });
	const metalMix = Tween.of(() => (material === 'metal' ? 1 : 0), {
		duration: 700,
		easing: cubicInOut
	});
	const BX0 = 520;
	const BX1 = 740;
	/** Lattice x → band-diagram x, so carriers line up between the two pictures. */
	const toBand = (x: number) =>
		BX0 + 10 + ((x - L.box.x0) / (L.box.x1 - L.box.x0)) * (BX1 - BX0 - 20);
	const fermi = $derived(lerp(gap.current / 2, 0, metalMix.current));
	// Metal: electrons near the Fermi level, moving into the empty levels just above it.
	const nearEF = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const u = (hash(i, 9) + (drift ? time * 0.09 : 0)) % 1;
			return {
				i,
				x: BX0 + 110 + u * (BX1 - BX0 - 122),
				y: yE(0) - 5 - (drift ? 4 : 0) + 3 * Math.sin(time * 2 + i)
			};
		})
	);
	const RULER = [
		{ key: 'kT', label: 'kT', gap: KT, x: 802 },
		{ key: 'Ge', label: 'Ge', gap: GAPS.Ge.gap, x: 840 },
		{ key: 'Si', label: 'Si', gap: GAPS.Si.gap, x: 878 },
		{ key: 'C', label: 'C', gap: GAPS.C.gap, x: 916 }
	];
	const current = $derived(
		material === 'insulator' ? 'C' : material === 'semiconductor' ? 'Si' : ''
	);

	const TITLES: Record<string, [string, string]> = {
		metal: ['Copper: a metal', 'positive ions in a sea of free electrons'],
		insulator: ['Diamond: an insulator', 'every electron locked in a bond'],
		semiconductor: ['Silicon: a semiconductor', 'the same bonds, but a smaller gap']
	};
	const title = $derived(TITLES[material] ?? TITLES.semiconductor);
	const readout = $derived(
		material === 'metal'
			? 'About one free electron per atom: 8.5 × 10²² per cm³'
			: material === 'insulator'
				? 'Practically no free electrons: the gap is over 200 × kT'
				: `${sci(NI_SI, 2)} free electrons per cm³: one per ${sci(N_SI / NI_SI, 1)} atoms`
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	{#if phase === 'levels'}
		<!-- atoms coming together -->
		{@render txt(240, 70, N === 1 ? 'One atom' : `${N} atoms`, 16, { weight: 700 })}
		{@render txt(
			240,
			92,
			N === 1
				? 'on its own'
				: together < 0.5
					? 'far apart'
					: 'close enough to share their outer electrons',
			12,
			{ muted: true }
		)}
		{#each atomsDrawn as a (a.i)}
			<circle cx={a.x} cy={a.y} r={a.r * 1.5} fill="var(--semi-filled)" opacity="0.35" />
			<circle
				cx={a.x}
				cy={a.y}
				r={a.r * 0.55}
				fill="var(--semi-si)"
				stroke="var(--semi-si-edge)"
				stroke-width="1.2"
			/>
		{/each}

		<!-- energy levels -->
		<line
			x1="548"
			y1="520"
			x2="548"
			y2="120"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
		{@render txt(540, 110, 'energy', 12, { anchor: 'start', muted: true })}
		{#if N >= 16}
			<rect
				x={LX0}
				y={LOW.y - LOW.hw * together - 3}
				width={LX1 - LX0}
				height={2 * LOW.hw * together + 6}
				fill="var(--semi-filled)"
				opacity="0.6"
				rx="3"
			/>
		{/if}
		<path
			d={linesPath(lowYs)}
			stroke="var(--stage-ink)"
			stroke-width={N >= 32 ? 0.8 : 1.6}
			fill="none"
		/>
		<path
			d={linesPath(highYs)}
			stroke="var(--stage-ink-muted)"
			stroke-width={N >= 32 ? 0.8 : 1.6}
			fill="none"
		/>
		{#if N <= 8}
			{#each lowYs as y, k (k)}
				{#each [0, 1] as j (j)}
					<circle
						cx={LX0 + 90 + j * 26 + 3 * Math.sin(time * 1.7 + k + j * 2)}
						cy={y}
						r="4"
						fill="var(--semi-electron)"
					/>
				{/each}
			{/each}
		{/if}
		{@render txt(LX1 + 14, HIGH.y + 4, N === 1 ? 'next atomic level' : `${N} levels`, 13, {
			anchor: 'start',
			weight: 600
		})}
		{@render txt(LX1 + 14, HIGH.y + 21, 'empty', 12, { anchor: 'start', muted: true })}
		{@render txt(LX1 + 14, LOW.y + 4, N === 1 ? 'outer level' : `${N} levels`, 13, {
			anchor: 'start',
			weight: 600
		})}
		{@render txt(LX1 + 14, LOW.y + 21, 'full: 2 electrons each', 12, {
			anchor: 'start',
			muted: true
		})}
		{#if N > 1}
			{@const top = LOW.y - LOW.hw * together}
			{@const bot = HIGH.y + HIGH.hw * together}
			<g opacity={together}>
				<line
					x1={(LX0 + LX1) / 2}
					y1={top - 6}
					x2={(LX0 + LX1) / 2}
					y2={bot + 6}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="4 4"
				/>
				{@render txt((LX0 + LX1) / 2 + 10, (top + bot) / 2 + 5, 'gap: no levels', 13, {
					anchor: 'start',
					weight: 600
				})}
			</g>
		{/if}
		{@render txt(
			480,
			568,
			N >= 16
				? 'So many levels, so close together: a continuous band. Its width does not grow.'
				: N === 1
					? 'A single atom: sharp energy levels.'
					: `${N} atoms: each level splits into ${N}. The band keeps the same width.`,
			14,
			{ weight: 600 }
		)}
	{:else}
		<!-- ===================== crystal ===================== -->
		{@render txt(250, 58, title[0], 16, { weight: 700 })}
		{@render txt(250, 80, title[1], 12, { muted: true })}

		<!-- battery plates -->
		<g opacity={fieldOn ? 1 : 0.25}>
			<rect
				x={L.box.x0 - 26}
				y={L.box.y0}
				width="8"
				height={L.box.y1 - L.box.y0}
				rx="3"
				fill="var(--circ-low)"
			/>
			<rect
				x={L.box.x1 + 18}
				y={L.box.y0}
				width="8"
				height={L.box.y1 - L.box.y0}
				rx="3"
				fill="var(--circ-high)"
			/>
			{@render txt(L.box.x0 - 22, L.box.y0 - 10, '−', 18, { weight: 700 })}
			{@render txt(L.box.x1 + 22, L.box.y0 - 10, '+', 18, { weight: 700 })}
		</g>

		{#if material === 'metal'}
			{#each L.atoms as a (a.i)}
				<circle cx={a.x} cy={a.y} r="17" fill="var(--circ-copper)" stroke="var(--semi-si-edge)" />
				<text
					x={a.x}
					y={a.y + 5}
					text-anchor="middle"
					font-weight="700"
					style:font-size="14px"
					style:fill="#fff">+</text
				>
			{/each}
			{#each seaNow as e (e.i)}
				<circle cx={e.x} cy={e.y} r="4.5" fill="var(--semi-electron)" opacity={e.opacity} />
			{/each}
		{:else}
			{@const semi = material === 'semiconductor'}
			<path d={allBonds} stroke="var(--semi-bond)" stroke-width="1.4" fill="none" />
			<path d={semi ? semiDots : allDots} fill="var(--semi-electron)" />
			{#each L.atoms as a (a.i)}
				<circle
					cx={a.x}
					cy={a.y}
					r={ATOM_R}
					fill={semi ? 'var(--semi-si)' : 'var(--carbon)'}
					stroke="var(--semi-si-edge)"
					stroke-width="1.2"
				/>
				<text
					x={a.x}
					y={a.y + 5}
					text-anchor="middle"
					font-weight="700"
					style:font-size="13px"
					style:fill={semi ? 'var(--stage-ink)' : '#fff'}>{semi ? 'Si' : 'C'}</text
				>
			{/each}
			{#if semi && pair.life > 0.01}
				<g opacity={pair.life}>
					<circle
						cx={holePos.x}
						cy={holePos.y}
						r="6"
						fill="var(--stage-bg)"
						stroke="var(--semi-hole)"
						stroke-width="2.2"
					/>
					{#if hopper}
						<circle cx={hopper.x} cy={hopper.y} r="3.6" fill="var(--semi-electron)" />
					{/if}
					<circle
						cx={pair.e.x}
						cy={pair.e.y}
						r="5.5"
						fill="var(--semi-electron)"
						stroke="var(--stage-bg)"
						stroke-width="1.5"
						opacity={pair.e.opacity}
					/>
					{#if pair.s < 3.2}
						<g opacity={smoothstep(0.9, 1.3, pair.s) * (1 - smoothstep(2.8, 3.2, pair.s))}>
							{@render txt(pair.e.x, pair.e.y - 14, 'free electron', 12, {
								weight: 600,
								color: 'var(--semi-electron)'
							})}
							{@render txt(holePos.x, holePos.y + 24, 'hole', 12, {
								weight: 600,
								color: 'var(--semi-hole)'
							})}
						</g>
					{/if}
				</g>
			{/if}
		{/if}
		{@render txt(250, 492, readout, 13, { weight: 600 })}
		{@render txt(
			250,
			512,
			fieldOn
				? material === 'metal'
					? 'The electron sea drifts towards +: a current.'
					: material === 'insulator'
						? 'Voltage on, yet nothing moves: no current.'
						: 'The electron drifts to +, the hole to −: a tiny current.'
				: 'No voltage: carriers only wander at random.',
			12,
			{ muted: true }
		)}
		{#if material === 'semiconductor'}
			{@render txt(
				250,
				548,
				'Drawn: one thermal pair at a time (really one per 5 trillion atoms).',
				11,
				{
					muted: true
				}
			)}
		{/if}

		<!-- ===================== bands ===================== -->
		{@const g = gap.current}
		{@const cbBottom = yE(g)}
		{@render txt((BX0 + BX1) / 2, 58, 'Energy bands', 15, { weight: 700 })}
		{@render txt((BX0 + BX1) / 2, 80, 'same scale for every material', 12, { muted: true })}
		<!-- conduction band -->
		<rect
			x={BX0}
			y={yE(g + BAND_H)}
			width={BX1 - BX0}
			height={PX_PER_EV * BAND_H}
			rx="4"
			fill="var(--semi-band)"
			stroke="var(--semi-band-edge)"
		/>
		<!-- valence band (full) -->
		<rect
			x={BX0}
			y={yE(0)}
			width={BX1 - BX0}
			height={PX_PER_EV * BAND_H}
			rx="4"
			fill="var(--semi-filled)"
			stroke="var(--semi-band-edge)"
		/>
		<!-- metal: the two halves read as one half-full band -->
		<rect
			x={BX0 + 1}
			y={yE(0) - 4}
			width={BX1 - BX0 - 2}
			height="8"
			fill="var(--semi-band)"
			opacity={metalMix.current}
		/>
		<rect
			x={BX0 + 1}
			y={yE(0)}
			width={BX1 - BX0 - 2}
			height="4"
			fill="var(--semi-filled)"
			opacity={metalMix.current}
		/>
		<!-- Fermi level -->
		<line
			x1={BX0 - 8}
			x2={BX1 + 8}
			y1={yE(fermi)}
			y2={yE(fermi)}
			stroke="var(--stage-ink)"
			stroke-width="1.4"
			stroke-dasharray="6 4"
		/>
		{@render txt(BX0 + 6, yE(fermi) - 6, 'Fermi level', 11, { anchor: 'start', weight: 600 })}

		<g opacity={1 - metalMix.current}>
			{@render txt((BX0 + BX1) / 2, yE(g + BAND_H) + 22, 'conduction band', 13, { weight: 600 })}
			{@render txt((BX0 + BX1) / 2, yE(g + BAND_H) + 40, 'empty', 12, { muted: true })}
			{@render txt((BX0 + BX1) / 2, yE(0) + 60, 'valence band', 13, { weight: 600 })}
			{@render txt((BX0 + BX1) / 2, yE(0) + 78, 'full: the bond electrons', 12, { muted: true })}
			{#if g > 0.4}
				<line
					x1={BX1 - 26}
					x2={BX1 - 26}
					y1={cbBottom + 3}
					y2={yE(0) - 3}
					stroke="var(--stage-ink)"
					stroke-width="1.4"
					marker-end="url(#arrowhead)"
					marker-start="url(#arrowhead)"
				/>
				{@render txt(BX1 - 36, cbBottom + 15, `gap ${g.toFixed(2)} eV`, 13, {
					anchor: 'end',
					weight: 700
				})}
			{/if}
		</g>
		<g opacity={metalMix.current}>
			{@render txt((BX0 + BX1) / 2, yE(BAND_H) + 22, 'empty levels', 13, { weight: 600 })}
			{@render txt((BX0 + BX1) / 2, yE(0) + 60, 'filled levels', 13, { weight: 600 })}
			{@render txt((BX0 + BX1) / 2, yE(0) + 78, 'one band, about half full', 12, { muted: true })}
			{#each nearEF as e (e.i)}
				<circle cx={e.x} cy={e.y} r="4" fill="var(--semi-electron)" />
			{/each}
		</g>
		{#if material === 'semiconductor' && pair.life > 0.01}
			<g opacity={pair.life}>
				{#if pair.jump < 1}
					<line
						x1={toBand(bondDot(L, pair.bond, 0).x)}
						x2={toBand(bondDot(L, pair.bond, 0).x)}
						y1={yE(0) - 2}
						y2={lerp(yE(0) - 2, cbBottom - 8, pair.jump)}
						stroke="var(--semi-electron)"
						stroke-width="2"
						opacity={pair.jump > 0 ? 1 : 0}
					/>
				{/if}
				<circle
					cx={toBand(pair.jump < 1 ? bondDot(L, pair.bond, 0).x : pair.e.x)}
					cy={lerp(yE(0) + 8, cbBottom - 10, pair.jump)}
					r="5.5"
					fill="var(--semi-electron)"
					opacity={pair.jump < 1 ? 1 : pair.e.opacity}
				/>
				<circle
					cx={toBand(holePos.x)}
					cy={yE(0) + 10}
					r="5.5"
					fill="var(--stage-bg)"
					stroke="var(--semi-hole)"
					stroke-width="2.2"
					opacity={pair.jump}
				/>
			</g>
		{/if}

		<!-- gaps to scale -->
		{@render txt(865, 58, 'Gaps to scale', 13, { weight: 700 })}
		{#each RULER as r (r.key)}
			{@const on = r.key === current || (r.key === 'kT' && material === 'insulator')}
			<rect
				x={r.x - 11}
				y={yE(r.gap)}
				width="22"
				height={Math.max(1.5, PX_PER_EV * r.gap)}
				rx="2"
				fill={r.key === 'kT' ? 'var(--semi-hole)' : 'var(--stage-ink-muted)'}
				opacity={on || current === '' ? 0.9 : 0.4}
			/>
			{@render txt(r.x, VB_TOP + 20, r.label, 12, { weight: on ? 700 : 500 })}
			{@render txt(r.x, yE(r.gap) - 8, r.key === 'kT' ? '0.026' : r.gap.toFixed(2), 11, {
				muted: !on
			})}
		{/each}
		{@render txt(865, VB_TOP + 38, 'eV', 11, { muted: true })}
		{#if material === 'metal'}
			{@render txt(865, VB_TOP + 62, 'metal: no gap', 12, { weight: 600 })}
		{/if}
	{/if}
</g>
