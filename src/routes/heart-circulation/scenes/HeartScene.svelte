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
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
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
	const chambers = [
		{ id: 'ra', n: 1, name: 'right atrium', x: ANCHORS.ra.x + 6, y: ANCHORS.ra.y + 6, size: 12 },
		{ id: 'la', n: 2, name: 'left atrium', x: ANCHORS.la.x, y: ANCHORS.la.y + 2, size: 12 },
		{
			id: 'rv',
			n: 3,
			name: 'right ventricle',
			x: ANCHORS.rv.x + 14,
			y: ANCHORS.rv.y - 26,
			size: 13
		},
		{ id: 'lv', n: 4, name: 'left ventricle', x: ANCHORS.lv.x - 6, y: ANCHORS.lv.y - 24, size: 13 }
	];
	const openValves = $derived(valveRows.filter((v) => v.open).map((v) => v.id));
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
		<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
		{#each chambers as c (c.id)}
			<Readout id={c.id} order={10 + c.n} label={c.name} marker={c.n} at={[X(c.x), Y(c.y)]}>
				{@render inside(c.x, c.y, c.name.split(' '), c.size)}
			</Readout>
		{/each}
		<Readout id="vessels">
			{@render txt(X(ANCHORS.svc.x), Y(ANCHORS.svc.y) - 10, 'from the body', 12, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(X(ANCHORS.ivc.x) + 20, Y(ANCHORS.ivc.y) + 4, 'from the body', 12, {
				muted: true
			})}
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
		</Readout>

		<!-- the panel: two kinds of blood, two pumps -->
		<Readout id="pumps-title">
			{@render txt(PX, 80, 'Two pumps side by side', 16, { weight: 700 })}
		</Readout>
		<Readout
			id="poor"
			order={1}
			label="Oxygen-poor blood"
			value="{Math.round(summary.venousO2 * 100)}% O₂"
			note="body → lungs"
			color="var(--hc-deoxy)"
		/>
		<Readout
			id="rich"
			order={2}
			label="Oxygen-rich blood"
			value="{Math.round(summary.arterialO2 * 100)}% O₂"
			note="lungs → body"
			color="var(--hc-oxy)"
		/>
		<Readout id="blood-kinds">
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
		</Readout>

		<Readout id="vent-title">
			{@render txt(PX, 304, 'blood in each ventricle', 13, { weight: 600 })}
		</Readout>
		{#each [{ id: 'rv', label: 'right', v: vRV, c: 'var(--hc-deoxy)' }, { id: 'lv', label: 'left', v: vLV, c: 'var(--hc-oxy)' }] as row, i (row.id)}
			{@const y = 330 + i * 44}
			<Readout id="vent-{row.id}-name">
				{@render txt(PX, y + 13, row.label, 12, { muted: true })}
			</Readout>
			<rect x={PX + 50} {y} width="220" height="18" rx="5" fill="var(--stage-grid)" />
			<rect x={PX + 50} {y} width={220 * clamp(row.v / VMAX)} height="18" rx="5" fill={row.c} />
			<Readout
				id="vent-{row.id}"
				order={3 + i}
				label="In the {row.label} ventricle"
				value="{Math.round(row.v)} mL"
				color={row.c}
			>
				{@render txt(PX + 280, y + 14, `${Math.round(row.v)} mL`, 13, { weight: 600 })}
			</Readout>
		{/each}
		<Readout
			id="stroke"
			order={5}
			label="Each beat"
			value="both squeeze out ≈ {Math.round(summary.stroke)} mL"
			note="at the same moment"
		>
			{@render txt(
				PX,
				438,
				`Each beat, both ventricles squeeze out about ${Math.round(summary.stroke)} mL —`,
				12,
				{ muted: true }
			)}
			{@render txt(PX, 455, 'the same amount, at the same moment.', 12, { muted: true })}
		</Readout>
	{:else}
		<!-- names of the valves -->
		<Readout
			id="v-tricuspid"
			order={10}
			label="tricuspid"
			marker={1}
			at={[X(VALVES.tricuspid.x), Y(VALVES.tricuspid.y + 30)]}
		>
			{@render inside(VALVES.tricuspid.x, VALVES.tricuspid.y + 34, ['tricuspid'], 12)}
		</Readout>
		<Readout
			id="v-mitral"
			order={11}
			label="mitral"
			marker={2}
			at={[X(VALVES.mitral.x), Y(VALVES.mitral.y + 30)]}
		>
			{@render inside(VALVES.mitral.x, VALVES.mitral.y + 34, ['mitral'], 12)}
		</Readout>
		<line x1={X(178)} y1={Y(200)} x2={X(160)} y2={Y(140)} stroke="var(--stage-ink-muted)" />
		<Readout
			id="v-pulmonary"
			order={12}
			label="pulmonary"
			marker={3}
			at={[X(160) - 14, Y(140) - 10]}
		>
			{@render txt(X(160), Y(140) - 6, 'pulmonary', 12, { anchor: 'end', weight: 600 })}
		</Readout>
		<line x1={X(268)} y1={Y(200)} x2={X(282)} y2={Y(150)} stroke="var(--stage-ink-muted)" />
		<Readout id="v-aortic" order={13} label="aortic" marker={4} at={[X(282) + 14, Y(150) - 10]}>
			{@render txt(X(282) + 4, Y(150) - 4, 'aortic', 12, { weight: 600 })}
		</Readout>
		<Readout id="now" order={1} label="Now" value={stage[0].replace(/[,:]$/, '')} note={stage[1]} />
		<Readout
			id="open"
			order={2}
			label="Valves open"
			value={openValves.length ? openValves.join(', ') : 'none: all four shut'}
		/>
		<Readout id="beat-length" order={3} label="One beat" value="{T.rr.toFixed(1)} s at 75/min" />
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
		<Readout id="beat-title">
			{@render txt(TL.x0, 80, 'One beat', 16, { weight: 700 })}
			{@render txt(TL.x1, 80, `${T.rr.toFixed(1)} s at 75 beats a minute`, 12, {
				anchor: 'end',
				muted: true
			})}
		</Readout>
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
		<Readout id="bar-labels">
			{@render txt(tx((T.atria + mc) / 2), TL.y + 32, 'atria', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(tx((T.atria + mc) / 2), TL.y + 45, 'squeeze', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(tx((ao + ac) / 2), TL.y + 32, 'blood out', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(tx((mo + T.rr) / 2), TL.y + 32, 'filling', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(tx(mc), TL.y - 24, 'lub', 12, { anchor: 'middle', weight: 700 })}
			{@render txt(tx(ac), TL.y - 24, 'dub', 12, { anchor: 'middle', weight: 700 })}
		</Readout>
		<line
			x1={tx(tau)}
			x2={tx(tau)}
			y1={TL.y - 20}
			y2={TL.y + 20}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>

		<Readout id="valve-list">
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
		</Readout>
	{/if}
</g>
