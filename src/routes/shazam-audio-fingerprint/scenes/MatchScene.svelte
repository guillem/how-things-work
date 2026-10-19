<script lang="ts">
	/**
	 * A recording looked up in the library. `record`: the recording's spectrogram and peaks above
	 * the same stretch of the tune, with the recording's peaks laid over the tune's. The other
	 * phases: the recording in a strip on top, the verdict beside it, and one small chart per
	 * tune below: the time pairs of its hits (`scatter`) or the histogram of their time
	 * differences (`hist`, `noise`, `limits`).
	 *
	 * Params: `recTune`, `start`, `noise`, `cough`, `seconds`, `again` and `playRec` (actions),
	 * `version` (limits only).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BINS,
		CLIPS,
		CLIP_S,
		DB_SIZE,
		FRAME_S,
		CLUSTER,
		MIN_RATIO,
		MIN_SCORE,
		UNKNOWN,
		clipPrint,
		recordAndSearch
	} from '../model';
	import { dB, dots, fmt, loudest, recordingOf, spectrogramUrl, thousands } from './shared';
	import { playSamples, stopSound } from './sound';

	let { step, t, params, reduced, dark }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'record'));
	const rec = $derived(recordingOf(params, phase === 'limits'));
	const found = $derived(recordAndSearch(rec));
	const result = $derived(found.result);
	const recFp = $derived(result.recording);
	const orig = $derived(clipPrint(rec.clip));
	const offTrue = $derived(rec.start / FRAME_S);

	// ---- sound -------------------------------------------------------------------------
	let lastPlay: number | undefined;
	$effect(() => {
		const c = Number(params.playRec ?? 0);
		untrack(() => {
			if (lastPlay !== undefined && c !== lastPlay) playSamples(found.rec.samples);
			lastPlay = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopSound();
	});

	// ---- focus --------------------------------------------------------------------------
	const o = new Tween({ record: 1 }, { duration: 650, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'record' ? 1 : 0;
		untrack(() => o.set({ record: v }));
	});
	/** Reveal of the lookup: the share of the recording whose hashes have been looked up. */
	const tt = $derived(reduced ? 99 : t);
	const reveal = $derived(
		phase === 'scatter'
			? Math.min(1, Math.max(0, (tt - 0.5) / 6))
			: Math.min(1, Math.max(0, tt / 2.5))
	);
	const upto = $derived(reveal * recFp.spec.frames);

	// ---- the record layout --------------------------------------------------------------
	const RX0 = 96;
	const RPX = 100;
	const A0 = 66;
	const A1 = 266;
	const B0 = 330;
	const B1 = 530;
	const recW = $derived(rec.seconds * RPX);
	const top = $derived(loudest(orig.spec));
	const recUrl = $derived(spectrogramUrl(recFp.spec, dark, top + 6));
	const origUrl = $derived(spectrogramUrl(orig.spec, dark));
	const xRec = (f: number, px: number, x0: number) => x0 + (f * FRAME_S + 0.032) * px;
	const yIn = (b: number, y0: number, y1: number) => y1 - ((b + 0.5) / BINS) * (y1 - y0);
	const recPeaksA = $derived(
		dots(recFp.peaks.map((p) => ({ x: xRec(p.t, RPX, RX0), y: yIn(p.f, A0, A1) })))
	);
	const recPeaksB = $derived(
		dots(recFp.peaks.map((p) => ({ x: xRec(p.t, RPX, RX0), y: yIn(p.f, B0, B1) })))
	);
	const off0 = $derived(Math.round(offTrue));
	const origInWin = $derived(
		orig.peaks.filter((p) => p.t - off0 >= 2 && p.t - off0 < recFp.spec.frames - 2)
	);
	const origRings = $derived(
		origInWin.map((p) => ({
			k: p.t * 1000 + p.f,
			x: xRec(p.t - offTrue, RPX, RX0),
			y: yIn(p.f, B0, B1)
		}))
	);
	const survived = $derived.by(() => {
		const set = new Set(recFp.peaks.map((p) => p.t * 1000 + p.f));
		let n = 0;
		for (const p of origInWin) {
			let hit = false;
			for (let dt = -1; dt <= 1 && !hit; dt++)
				for (let df = -1; df <= 1 && !hit; df++)
					if (set.has((p.t - off0 + dt) * 1000 + p.f + df)) hit = true;
			if (hit) n++;
		}
		return n;
	});
	const cough = $derived(found.rec.cough);

	// ---- the grid layout ----------------------------------------------------------------
	const SX0 = 96;
	const SPX = 52;
	const S0 = 52;
	const S1 = 150;
	const recUrlSmall = $derived(recUrl);
	const recPeaksS = $derived(
		dots(recFp.peaks.map((p) => ({ x: xRec(p.t, SPX, SX0), y: yIn(p.f, S0, S1) })))
	);

	const PW = 222;
	const PH = 114;
	const panelX = (i: number) => 24 + (i % 4) * 234;
	const panelY = (i: number) => 194 + Math.floor(i / 4) * 126;
	const CX0 = 10;
	const CX1 = PW - 10;
	const CY0 = 40;
	const CY1 = PH - 10;
	/** Histogram x axis: offsets from −8 s to 12 s, in frames. */
	const D0 = Math.round(-8 / FRAME_S);
	const D1 = Math.round(CLIP_S / FRAME_S);
	const hx = (d: number) => CX0 + ((d - D0) / (D1 - D0)) * (CX1 - CX0);
	const hScale = $derived(
		Math.max(6, ...result.matches.map((m) => Math.max(0, ...m.histogram.values())))
	);

	const panels = $derived(
		result.matches.map((m) => {
			const shownPairs = m.pairs.filter(([tq]) => tq <= upto);
			// in the winning tune, the hits on its diagonal (its spike) in its own colour
			const onLine = (tq: number, td: number) =>
				m.clip === result.winner && Math.abs(td - tq - m.offset) <= CLUSTER;
			const pt = ([tq, td]: [number, number]) => ({
				x: CX0 + (tq / (rec.seconds / FRAME_S)) * (CX1 - CX0),
				y: CY1 - (td / (CLIP_S / FRAME_S)) * (CY1 - CY0)
			});
			const scatter = dots(shownPairs.filter(([a, b]) => !onLine(a, b)).map(pt));
			const line = dots(shownPairs.filter(([a, b]) => onLine(a, b)).map(pt));
			const counts: Record<number, number> = {};
			for (const [tq, td] of shownPairs) counts[td - tq] = (counts[td - tq] ?? 0) + 1;
			let hist = '';
			for (const [ds, c] of Object.entries(counts)) {
				const d = Number(ds);
				const x = hx(d).toFixed(1);
				hist += `M${x} ${CY1}V${(CY1 - (Math.min(c, hScale) / hScale) * (CY1 - CY0)).toFixed(1)}`;
			}
			return { m, scatter, line, hist, n: shownPairs.length };
		})
	);
	const winner = $derived(result.winner);
	const best = $derived(result.matches[result.ranking[0]]);
	const second = $derived(result.matches[result.ranking[1]]);
	const playing = $derived(rec.clip < DB_SIZE ? rec.clip : -1);
	const histPhase = $derived(phase !== 'scatter');

	const verdict = $derived(
		winner !== null
			? {
					value: `${CLIPS[winner].name}`,
					note: `spike of ${best.score} at ${fmt(best.offset * FRAME_S, 2)} s; the next best tune ${second.score}`
				}
			: {
					value: 'No clear match',
					note: `tallest spike ${best.score} (${CLIPS[best.clip].name}), next ${second.score}: a match needs ${MIN_SCORE} and ${MIN_RATIO}× the next`
				}
	);
	const versionText = $derived(
		rec.clip === UNKNOWN
			? 'a tune not in the database'
			: rec.version === 'higher'
				? `${CLIPS[rec.clip].name}, ${rec.semitones === 1 ? 'a semitone' : 'a tone'} higher`
				: rec.version === 'cover'
					? `${CLIPS[rec.clip].name}, played by another band`
					: CLIPS[rec.clip].name
	);
</script>

<defs>
	<clipPath id="match-scene-b">
		<rect x={RX0} y={B0} width={recW} height={B1 - B0} />
	</clipPath>
</defs>

<g>
	<!-- ===================================================================== record -->
	{#if o.current.record > 0.01}
		<g opacity={o.current.record}>
			<Label
				x={RX0}
				y={40}
				text="The recording: {fmt(rec.seconds, 1)} s of {versionText}, at {dB(rec.snrDb)}{rec.cough
					? ', with a cough'
					: ''}"
				anchor="start"
				size={15}
				weight={700}
				halo={false}
			/>
			<rect
				x={RX0}
				y={A0}
				width={recW}
				height={A1 - A0}
				fill="var(--stage-bg)"
				stroke="var(--stage-line)"
			/>
			<image
				href={recUrl}
				x={RX0 + 0.032 * RPX - (FRAME_S * RPX) / 2}
				y={A0}
				width={recFp.spec.frames * FRAME_S * RPX}
				height={A1 - A0}
				preserveAspectRatio="none"
				opacity="0.85"
			/>
			<path d={recPeaksA} stroke="var(--sz-rec)" stroke-width="5" stroke-linecap="round" />
			{#if cough}
				<line
					x1={RX0 + cough[0] * RPX}
					x2={RX0 + Math.min(rec.seconds, cough[1]) * RPX}
					y1={A0 - 6}
					y2={A0 - 6}
					stroke="var(--sz-cough)"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<Readout id="cough-label">
					<Label
						x={RX0 + ((cough[0] + Math.min(rec.seconds, cough[1])) / 2) * RPX}
						y={A0 - 12}
						text="cough"
						size={12}
						weight={600}
						color="var(--sz-cough-text)"
						halo={false}
					/>
				</Readout>
			{/if}
			<Readout id="rec-axis">
				<Label
					x={RX0 - 10}
					y={(A0 + A1) / 2 + 4}
					text="phone"
					anchor="end"
					size={12}
					muted
					halo={false}
				/>
				<Label
					x={RX0}
					y={A1 + 18}
					text="0 s: the phone starts listening"
					anchor="start"
					size={11}
					muted
					halo={false}
				/>
				<Label
					x={RX0 + recW}
					y={A1 + 18}
					text="{fmt(rec.seconds, 1)} s"
					anchor="end"
					size={11}
					muted
					halo={false}
				/>
			</Readout>

			<rect
				x={RX0}
				y={B0}
				width={recW}
				height={B1 - B0}
				fill="var(--stage-bg)"
				stroke="var(--stage-line)"
			/>
			<g clip-path="url(#match-scene-b)">
				<image
					href={origUrl}
					x={RX0 - rec.start * RPX + 0.032 * RPX - (FRAME_S * RPX) / 2}
					y={B0}
					width={orig.spec.frames * FRAME_S * RPX}
					height={B1 - B0}
					preserveAspectRatio="none"
					opacity="0.3"
				/>
				{#each origRings as r (r.k)}
					<circle
						cx={r.x}
						cy={r.y}
						r="5.5"
						fill="none"
						stroke="var(--sz-peak)"
						stroke-width="1.6"
					/>
				{/each}
				<path d={recPeaksB} stroke="var(--sz-rec)" stroke-width="4" stroke-linecap="round" />
			</g>
			<Readout id="orig-axis">
				<Label
					x={RX0 - 10}
					y={(B0 + B1) / 2 + 4}
					text="tune"
					anchor="end"
					size={12}
					muted
					halo={false}
				/>
				<Label
					x={RX0}
					y={B1 + 18}
					text="{fmt(rec.start, 1)} s into the tune"
					anchor="start"
					size={11}
					muted
					halo={false}
				/>
				<Label
					x={RX0 + recW}
					y={B1 + 18}
					text="{fmt(rec.start + rec.seconds, 1)} s"
					anchor="end"
					size={11}
					muted
					halo={false}
				/>
			</Readout>
			<Readout
				id="survived"
				order={2}
				label="The tune’s peaks found again"
				value="{survived} of {origInWin.length}"
				note="rings: the tune’s peaks; dots: the recording’s"
			>
				<Label
					x={RX0 + 4}
					y={B0 - 12}
					text="The same stretch of the tune: its peaks (rings) and the recording's (dots) · {survived} of {origInWin.length} found again"
					anchor="start"
					size={12}
					halo={false}
				/>
			</Readout>
			<Readout
				id="rec-count"
				order={3}
				label="Recording"
				value="{recFp.peaks.length} peaks · {thousands(recFp.hashes.length)} fingerprints"
			>
				<Label
					x={RX0}
					y={B1 + 52}
					text="the recording: {recFp.peaks.length} peaks, {thousands(
						recFp.hashes.length
					)} fingerprints to look up"
					anchor="start"
					size={12}
					muted
					halo={false}
				/>
			</Readout>
		</g>
	{/if}

	<!-- ===================================================================== grid -->
	{#if o.current.record < 0.99}
		<g opacity={1 - o.current.record}>
			<Label
				x={SX0}
				y={36}
				text="The recording: {versionText} · {dB(rec.snrDb)} · {fmt(rec.seconds, 1)} s"
				anchor="start"
				size={13}
				weight={700}
				halo={false}
			/>
			<rect
				x={SX0}
				y={S0}
				width={rec.seconds * SPX}
				height={S1 - S0}
				fill="var(--stage-bg)"
				stroke="var(--stage-line)"
			/>
			<image
				href={recUrlSmall}
				x={SX0 + 0.032 * SPX - (FRAME_S * SPX) / 2}
				y={S0}
				width={recFp.spec.frames * FRAME_S * SPX}
				height={S1 - S0}
				preserveAspectRatio="none"
				opacity="0.8"
			/>
			<path d={recPeaksS} stroke="var(--sz-rec)" stroke-width="3.2" stroke-linecap="round" />
			{#if phase === 'scatter' && reveal < 1}
				<line
					x1={SX0 + reveal * rec.seconds * SPX}
					x2={SX0 + reveal * rec.seconds * SPX}
					y1={S0 - 4}
					y2={S1 + 4}
					stroke="var(--sz-anchor)"
					stroke-width="2"
				/>
			{/if}
			<Readout id="rec-small">
				<Label
					x={SX0}
					y={S1 + 16}
					text="{thousands(recFp.hashes.length)} fingerprints looked up"
					anchor="start"
					size={11}
					muted
					halo={false}
				/>
			</Readout>

			<!-- verdict -->
			<Readout
				id="verdict"
				order={1}
				label={winner !== null ? 'Match' : 'Verdict'}
				value={verdict.value}
				note={verdict.note}
				color={winner !== null ? 'var(--sz-match-text)' : undefined}
			>
				<rect
					x={560}
					y={S0 - 6}
					width={384}
					height={S1 - S0 + 12}
					rx="12"
					fill="var(--surface)"
					stroke={winner !== null ? 'var(--sz-match)' : 'var(--border)'}
					stroke-width={winner !== null ? 2 : 1}
				/>
				<text x={578} y={S0 + 20} class="muted" font-size="12"
					>{winner !== null ? 'Match' : 'Verdict'}</text
				>
				<text
					x={578}
					y={S0 + 48}
					font-size="20"
					font-weight="700"
					style:fill={winner !== null ? 'var(--sz-match-text)' : 'var(--stage-ink)'}
					>{verdict.value}</text
				>
				{#if winner !== null}
					<text x={578} y={S0 + 72} class="muted" font-size="12"
						>the recording started {fmt(best.offset * FRAME_S, 2)} s into it</text
					>
					<text x={578} y={S0 + 90} class="muted" font-size="12"
						>spike {best.score} · the next best tune {second.score}</text
					>
				{:else}
					<text x={578} y={S0 + 72} class="muted" font-size="12"
						>tallest spike {best.score} ({CLIPS[best.clip].name}), next {second.score}</text
					>
					<text x={578} y={S0 + 90} class="muted" font-size="12"
						>a match needs {MIN_SCORE} and {MIN_RATIO} times the next</text
					>
				{/if}
			</Readout>

			<Readout id="grid-axis">
				<Label
					x={24}
					y={186}
					text={histPhase
						? 'Each tune: hits counted by time in the tune − time in the recording'
						: 'Each tune: one dot per hit, at (time in the recording →, time in the tune ↑)'}
					anchor="start"
					size={12}
					muted
					halo={false}
				/>
			</Readout>
			{#each panels as p (p.m.clip)}
				{@const x = panelX(p.m.clip)}
				{@const y = panelY(p.m.clip)}
				{@const win = winner === p.m.clip}
				<g transform="translate({x} {y})">
					<rect
						width={PW}
						height={PH}
						rx="8"
						fill="var(--surface)"
						stroke={win ? 'var(--sz-match)' : 'var(--border)'}
						stroke-width={win ? 2 : 1}
					/>
					<text
						x={10}
						y={17}
						font-size="12"
						font-weight={win ? 700 : 600}
						style:fill={win ? 'var(--sz-match-text)' : 'var(--stage-ink)'}
						>{CLIPS[p.m.clip].name}</text
					>
					<text x={10} y={32} font-size="11" class="muted"
						>{p.n === 1 ? '1 hit' : `${p.n} hits`}{histPhase ? ` · spike ${p.m.score}` : ''}{p.m
							.clip === playing
							? ' · the tune playing'
							: ''}</text
					>
					{#if histPhase}
						<line x1={CX0} x2={CX1} y1={CY1} y2={CY1} stroke="var(--stage-line)" />
						<line x1={hx(0)} x2={hx(0)} y1={CY0} y2={CY1} stroke="var(--stage-grid)" />
						<path d={p.hist} stroke={win ? 'var(--sz-match)' : 'var(--sz-hit)'} stroke-width="2" />
					{:else}
						<rect
							x={CX0}
							y={CY0}
							width={CX1 - CX0}
							height={CY1 - CY0}
							fill="none"
							stroke="var(--stage-grid)"
						/>
						<path d={p.scatter} stroke="var(--sz-hit)" stroke-width="3.2" stroke-linecap="round" />
						<path d={p.line} stroke="var(--sz-match)" stroke-width="4" stroke-linecap="round" />
					{/if}
				</g>
			{/each}
			<Readout id="hist-ticks">
				{#if histPhase}
					{@const x0 = panelX(8)}
					<Label x={x0 + hx(0)} y={panelY(8) + PH + 14} text="0 s" size={10} muted halo={false} />
					<Label
						x={x0 + hx(D1)}
						y={panelY(8) + PH + 14}
						text="{CLIP_S} s"
						anchor="end"
						size={10}
						muted
						halo={false}
					/>
				{/if}
			</Readout>
		</g>
	{/if}
</g>
