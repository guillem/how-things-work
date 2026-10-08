<script lang="ts">
	/**
	 * The beating heart, large, at rest (75 beats a minute).
	 *
	 * Phases (`step.hints.phase`):
	 *   anatomy — names of the four chambers and the vessels; a panel with the
	 *             two kinds of blood and the volume in each ventricle, live, to
	 *             show both pumps squeezing out the same amount together
	 *   valves  — names of the four valves; a timeline of one beat (filling,
	 *             atria squeeze, all valves shut, ejection, relaxing) computed
	 *             from the model's valve openings, with a cursor, the state of
	 *             each valve and “lub” / “dub” when the valves slam shut
	 *
	 * Time: a beat clock (`beatClock`, integrated from the rate); reduced
	 * motion freezes on the middle of ejection.
	 */
	import { clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { LV, NORMAL, RV, steadyBeat, valveEvents } from '../circulation';
	import Heart from './Heart.svelte';
	import { ANCHORS, VALVES, at, beatClock, tauOf } from './heart';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'anatomy'));
	const { beat, summary } = steadyBeat(NORMAL);
	const T = beat.timing;
	const mitral = valveEvents(beat, 'mitral');
	const aortic = valveEvents(beat, 'aortic');
	const mc = mitral.close[0];
	const mo = mitral.open[0];
	const ao = aortic.open[0];
	const ac = aortic.close[0];

	const clock = beatClock();
	const beats = $derived(reduced ? 3 + (ao + ac) / 2 / T.rr : clock(t, T.rr));
	const tau = $derived(tauOf(beat, beats));

	// Heart placement.
	const HX = 36;
	const HY = 44;
	const S = 1.04;
	const X = (lx: number) => HX + S * lx;
	const Y = (ly: number) => HY + S * ly;

	// ---- anatomy panel ---------------------------------------------------------
	const PX = 590;
	const vLV = $derived(at(beat, beat.v[LV], beats));
	const vRV = $derived(at(beat, beat.v[RV], beats));
	const VMAX = 140;

	// ---- valves panel: one beat as a timeline -------------------------------------
	const TL = { x0: 590, x1: 932, y: 150 };
	const tx = (s: number) => TL.x0 + ((TL.x1 - TL.x0) * s) / T.rr;
	const segments = [
		{ id: 'f0', a: 0, b: T.atria, label: '', color: 'var(--hc-la)' },
		{ id: 'as', a: T.atria, b: mc, label: 'atria squeeze', color: 'var(--hc-signal)' },
		{ id: 'iv', a: mc, b: ao, label: '', color: 'var(--stage-ink-muted)' },
		{ id: 'ej', a: ao, b: ac, label: 'ventricles push blood out', color: 'var(--hc-oxy)' },
		{ id: 'ir', a: ac, b: mo, label: '', color: 'var(--stage-ink-muted)' },
		{ id: 'f1', a: mo, b: T.rr, label: 'ventricles fill', color: 'var(--hc-la)' }
	];
	const stage = $derived(
		tau < T.atria || tau >= mo
			? ['The ventricles relax and fill.', 'Inlet valves open, exit valves shut.']
			: tau < mc
				? ['The atria squeeze,', 'topping up the ventricles.']
				: tau < ao
					? ['The ventricles squeeze.', 'The inlet valves shut: the pressure builds.']
					: tau < ac
						? ['The exit valves are pushed open:', 'blood rushes out.']
						: ['The ventricles relax.', 'The exit valves shut: the pressure falls.']
	);
	const flash = (when: number) => {
		const d = tau - when;
		return d >= 0 && d < 0.14 ? 1 - d / 0.14 : 0;
	};
	const lub = $derived(reduced ? 0 : flash(mc));
	const dub = $derived(reduced ? 0 : flash(ac));
	const valveRows = $derived(
		(['tricuspid', 'mitral', 'pulmonary', 'aortic'] as const).map((id, i) => {
			const q = at(beat, beat.flow[id], beats);
			return { id, i, open: q > 0.5 };
		})
	);
	const valveNames: Record<string, string> = {
		tricuspid: 'tricuspid',
		mitral: 'mitral',
		pulmonary: 'pulmonary',
		aortic: 'aortic'
	};
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; halo?: boolean } = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet inside(lx: number, ly: number, lines: string[], size: number)}
	{#each lines as line, i (i)}
		<text
			x={X(lx)}
			y={Y(ly) + i * (size + 2)}
			text-anchor="middle"
			font-weight="700"
			style:font-size="{size}px"
			style:fill="var(--surface)">{line}</text
		>
	{/each}
{/snippet}

<g>
	<Heart {beat} {beats} x={HX} y={HY} scale={S} signal={0} />

	{#if phase === 'anatomy'}
		<!-- names of the chambers (inside) and the vessels (outside) -->
		{@render inside(ANCHORS.ra.x + 6, ANCHORS.ra.y + 6, ['right', 'atrium'], 12)}
		{@render inside(ANCHORS.la.x, ANCHORS.la.y + 2, ['left', 'atrium'], 12)}
		{@render inside(ANCHORS.rv.x + 14, ANCHORS.rv.y - 26, ['right', 'ventricle'], 13)}
		{@render inside(ANCHORS.lv.x - 6, ANCHORS.lv.y - 24, ['left', 'ventricle'], 13)}
		{@render txt(X(ANCHORS.svc.x), Y(ANCHORS.svc.y) - 10, 'from the body', 12, {
			anchor: 'middle',
			muted: true
		})}
		{@render txt(X(ANCHORS.ivc.x) + 20, Y(ANCHORS.ivc.y) + 4, 'from the body', 12, { muted: true })}
		{@render txt(X(ANCHORS.pa.x), Y(ANCHORS.pa.y) - 10, 'to the lungs', 12, {
			anchor: 'middle',
			muted: true
		})}
		{@render txt(X(ANCHORS.aorta.x), Y(ANCHORS.aorta.y) + 22, 'to the body', 12, {
			anchor: 'middle',
			muted: true
		})}
		{@render txt(X(ANCHORS.pv.x) + 6, Y(ANCHORS.pv.y) - 3, 'from the', 12, { muted: true })}
		{@render txt(X(ANCHORS.pv.x) + 6, Y(ANCHORS.pv.y) + 12, 'lungs', 12, { muted: true })}
		<line
			x1={X(222)}
			x2={X(222)}
			y1={Y(408)}
			y2={Y(470)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		{@render txt(X(222), Y(486), 'septum', 12, { anchor: 'middle', muted: true })}

		<!-- the panel: two kinds of blood, two pumps -->
		{@render txt(PX, 80, 'Two pumps side by side', 16, { weight: 700 })}
		<rect x={PX} y={102} width="18" height="18" rx="4" fill="var(--hc-deoxy)" />
		{@render txt(PX + 28, 116, 'oxygen-poor blood', 13, { weight: 600 })}
		{@render txt(
			PX + 28,
			133,
			`about ${Math.round(summary.venousO2 * 100)}% saturated, back from the body`,
			12,
			{ muted: true }
		)}
		<rect x={PX} y={150} width="18" height="18" rx="4" fill="var(--hc-oxy)" />
		{@render txt(PX + 28, 164, 'oxygen-rich blood', 13, { weight: 600 })}
		{@render txt(
			PX + 28,
			181,
			`${Math.round(summary.arterialO2 * 100)}% saturated, fresh from the lungs`,
			12,
			{ muted: true }
		)}

		{@render txt(PX, 230, 'right side: body → lungs', 13, {
			weight: 600,
			color: 'var(--hc-deoxy)'
		})}
		{@render txt(PX, 250, 'left side: lungs → body', 13, { weight: 600, color: 'var(--hc-oxy)' })}

		{@render txt(PX, 304, 'blood in each ventricle', 13, { weight: 600 })}
		{#each [{ id: 'rv', label: 'right', v: vRV, c: 'var(--hc-deoxy)' }, { id: 'lv', label: 'left', v: vLV, c: 'var(--hc-oxy)' }] as row, i (row.id)}
			{@const y = 330 + i * 44}
			{@render txt(PX, y + 13, row.label, 12, { muted: true })}
			<rect x={PX + 50} {y} width="220" height="18" rx="5" fill="var(--stage-grid)" />
			<rect x={PX + 50} {y} width={220 * clamp(row.v / VMAX)} height="18" rx="5" fill={row.c} />
			{@render txt(PX + 280, y + 14, `${Math.round(row.v)} mL`, 13, { weight: 600 })}
		{/each}
		{@render txt(
			PX,
			438,
			`Each beat, both ventricles squeeze out about ${Math.round(summary.stroke)} mL —`,
			12,
			{ muted: true }
		)}
		{@render txt(PX, 455, 'the same amount, at the same moment.', 12, { muted: true })}
	{:else}
		<!-- names of the valves -->
		{@render inside(VALVES.tricuspid.x, VALVES.tricuspid.y + 34, ['tricuspid'], 12)}
		{@render inside(VALVES.mitral.x, VALVES.mitral.y + 34, ['mitral'], 12)}
		<line x1={X(178)} y1={Y(200)} x2={X(160)} y2={Y(140)} stroke="var(--stage-ink-muted)" />
		{@render txt(X(160), Y(140) - 6, 'pulmonary', 12, { anchor: 'end', weight: 600 })}
		<line x1={X(268)} y1={Y(200)} x2={X(282)} y2={Y(150)} stroke="var(--stage-ink-muted)" />
		{@render txt(X(282) + 4, Y(150) - 4, 'aortic', 12, { weight: 600 })}
		{#if lub > 0}
			{@render txt(X(222), Y(300), 'lub', 22 + 6 * lub, {
				anchor: 'middle',
				weight: 800,
				color: 'var(--stage-ink)'
			})}
		{/if}
		{#if dub > 0}
			{@render txt(X(222), Y(160), 'dub', 22 + 6 * dub, {
				anchor: 'middle',
				weight: 800,
				color: 'var(--stage-ink)'
			})}
		{/if}

		<!-- one beat as a timeline -->
		{@render txt(TL.x0, 80, 'One beat', 16, { weight: 700 })}
		{@render txt(TL.x1, 80, `${T.rr.toFixed(1)} s at 75 beats a minute`, 12, {
			anchor: 'end',
			muted: true
		})}
		{#each segments as sgm (sgm.id)}
			<rect
				x={tx(sgm.a)}
				y={TL.y - 14}
				width={Math.max(0, tx(sgm.b) - tx(sgm.a) - 1)}
				height="28"
				rx="4"
				fill={sgm.color}
				opacity={tau >= sgm.a && tau < sgm.b ? 0.75 : 0.28}
			/>
		{/each}
		<!-- labels under the bar -->
		{@render txt(tx((T.atria + mc) / 2), TL.y + 32, 'atria', 11, { anchor: 'middle', muted: true })}
		{@render txt(tx((T.atria + mc) / 2), TL.y + 45, 'squeeze', 11, {
			anchor: 'middle',
			muted: true
		})}
		{@render txt(tx((ao + ac) / 2), TL.y + 32, 'blood out', 11, { anchor: 'middle', muted: true })}
		{@render txt(tx((mo + T.rr) / 2), TL.y + 32, 'filling', 11, { anchor: 'middle', muted: true })}
		{@render txt(tx(mc), TL.y - 24, 'lub', 12, { anchor: 'middle', weight: 700 })}
		{@render txt(tx(ac), TL.y - 24, 'dub', 12, { anchor: 'middle', weight: 700 })}
		<line
			x1={tx(tau)}
			x2={tx(tau)}
			y1={TL.y - 20}
			y2={TL.y + 20}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>

		{@render txt(TL.x0, 226, stage[0], 13, { weight: 600 })}
		{@render txt(TL.x0, 244, stage[1], 13, { muted: true })}

		<!-- state of each valve -->
		{#each valveRows as v (v.id)}
			{@const y = 290 + v.i * 40}
			<rect
				x={TL.x0}
				y={y - 16}
				width="342"
				height="30"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(TL.x0 + 14, y + 4, `${valveNames[v.id]} valve`, 13, {
				weight: 600,
				halo: false
			})}
			{@render txt(
				TL.x0 + 140,
				y + 4,
				v.i < 2
					? v.i === 0
						? 'right atrium → ventricle'
						: 'left atrium → ventricle'
					: v.i === 2
						? 'right ventricle → lungs'
						: 'left ventricle → body',
				11,
				{ muted: true, halo: false }
			)}
			<rect
				x={TL.x0 + 288}
				y={y - 10}
				width="46"
				height="18"
				rx="9"
				fill={v.open ? 'var(--hc-la)' : 'var(--stage-grid)'}
			/>
			<text
				x={TL.x0 + 311}
				y={y + 3}
				text-anchor="middle"
				font-weight="700"
				style:font-size="11px"
				style:fill={v.open ? 'var(--surface)' : 'var(--stage-ink-muted)'}
				>{v.open ? 'open' : 'shut'}</text
			>
		{/each}
		{@render txt(TL.x0, 470, 'Valves open and shut only because of the pressure', 12, {
			muted: true
		})}
		{@render txt(TL.x0, 487, 'on either side: blood can only go one way.', 12, { muted: true })}
	{/if}
</g>
