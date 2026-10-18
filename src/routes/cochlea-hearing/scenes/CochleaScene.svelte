<script lang="ts">
	/**
	 * The uncoiled cochlea with its basilar membrane, and a chart along the same place axis.
	 * Focus (`step.hints.focus`): 'map' (Greenwood's map as the chart, the tone's place marked on
	 * the membrane), 'wave' (one soft tone's travelling wave and its excitation pattern), 'mix'
	 * (the sound chosen with `params.sound`: tones, a chord or a vowel, each tone solved alone
	 * and the patterns added), 'amp' (`params.ohc`: the amplifier on or off, the other state
	 * dashed) and 'level' (`params.level`: the tone's level, with an inset of the peak against
	 * the level, live and passive).
	 *
	 * The responses are steady states of the model, solved when a control changes; the drawing
	 * only turns each tone's phase with `t`, slowed down enormously (each tone at its own slow
	 * rate, higher tones a little faster). The `play` action plays the sound, quietly.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HEALTHY,
		LENGTH_MM,
		PASSIVE,
		PLACES,
		cfAt,
		dbRe,
		excitation,
		peakWidth,
		placeOf,
		respond,
		respondAll,
		type Ear,
		type Response
	} from '../model.ts';
	import { VOWELS } from '../implant.ts';
	import { SOFT, pitchHz, tonesOf, type SoundId } from '../sounds.ts';
	import { playTones, stopAll } from './audio';
	import Duct from './Duct.svelte';
	import { DRAWN, X0, X1, hz, membraneWidth, xAt } from './geometry';

	let { step, t, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'wave'));
	const f = $derived(pitchHz(Number(params.pitch ?? 3)));
	const level = $derived(focus === 'level' ? Number(params.level ?? 40) : SOFT);
	const ohcOn = $derived(focus === 'amp' || focus === 'level' ? params.ohc !== false : true);
	const ear: Ear = $derived(ohcOn ? HEALTHY : PASSIVE);
	const soundId = $derived(
		focus === 'mix' ? ((params.sound ?? 'chord') as SoundId) : ('tone' as SoundId)
	);
	const tones = $derived(tonesOf(soundId, f, level));

	const responses: Response[] = $derived(respondAll(tones, ear));
	const pattern = $derived(excitation(responses));
	/** The other state of the amplifier, for comparison. */
	const other = $derived(
		focus === 'amp' || focus === 'level'
			? excitation(respondAll(tones, ohcOn ? PASSIVE : HEALTHY))
			: null
	);

	// ---- sound ---------------------------------------------------------------------------------
	let lastPlay: number | undefined;
	$effect(() => {
		const c = Number(params.play ?? 0);
		untrack(() => {
			if (lastPlay !== undefined && c !== lastPlay) playTones(tones);
			lastPlay = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- layout --------------------------------------------------------------------------------
	const TOP = 84;
	const BOTTOM = 204;
	const MID = (TOP + BOTTOM) / 2;
	const AMP = 30;
	const CT = 272;
	const CB = 412;
	const sx = scale([0, LENGTH_MM], [X0, X1]);
	const sy = scale([-30, 80], [CB, CT]);
	const syMap = scale([Math.log10(15), Math.log10(25000)], [CB, CT]);
	const mapTicks = [20, 100, 1000, 10000].map(Math.log10);

	// ---- the moving membrane -------------------------------------------------------------------
	const fmin = $derived(Math.min(...tones.map((x) => x.f)));
	/** Drawing rate of each tone (cycles per second of `t`). */
	const rates = $derived(responses.map((r) => 0.6 * (1 + 0.5 * Math.log2(r.f / fmin))));
	/** The largest envelope, to scale the drawing. */
	const top = $derived.by(() => {
		let m = 0;
		for (const j of DRAWN) {
			let s = 0;
			for (const r of responses) s += r.mag[j] * r.mag[j];
			m = Math.max(m, Math.sqrt(s));
		}
		return m || 1;
	});
	const still = $derived(focus === 'map');
	const membrane = $derived.by(() => {
		const upper: string[] = [];
		const lower: string[] = [];
		const phases = rates.map((r) => 2 * Math.PI * r * t);
		const cs = phases.map(Math.cos);
		const sn = phases.map(Math.sin);
		for (const j of DRAWN) {
			let d = 0;
			if (!still) {
				for (let k = 0; k < responses.length; k++) {
					const r = responses[k];
					d += r.re[j] * cs[k] - r.im[j] * sn[k];
				}
			}
			const y = MID - (AMP * d) / top;
			const x = xAt(PLACES[j]);
			const w = membraneWidth(PLACES[j]) / 2;
			upper.push(`${x.toFixed(1)} ${(y - w).toFixed(1)}`);
			lower.push(`${x.toFixed(1)} ${(y + w).toFixed(1)}`);
		}
		return `M${upper.join('L')}L${lower.reverse().join('L')}Z`;
	});
	const envelope = $derived.by(() => {
		if (still) return '';
		const up: string[] = [];
		const dn: string[] = [];
		for (const j of DRAWN) {
			let s = 0;
			for (const r of responses) s += r.mag[j] * r.mag[j];
			const e = (AMP * Math.sqrt(s)) / top;
			const x = xAt(PLACES[j]).toFixed(1);
			up.push(`${x} ${(MID - e).toFixed(1)}`);
			dn.push(`${x} ${(MID + e).toFixed(1)}`);
		}
		return `M${up.join('L')} M${dn.join('L')}`;
	});
	const push = $derived(still ? 0 : 3 * Math.sin(2 * Math.PI * (rates[0] ?? 0.6) * t));

	// ---- the chart ------------------------------------------------------------------------------
	const clamp = (v: number) => Math.max(-30, Math.min(80, v));
	const curve = (e: Float64Array) =>
		linePath(
			DRAWN,
			(j) => PLACES[j],
			(j) => clamp(e[j]),
			sx,
			sy
		);
	const mapCurve = linePath(
		Array.from({ length: 141 }, (_, i) => (i * LENGTH_MM) / 140),
		(mm) => mm,
		(mm) => Math.log10(Math.max(15, cfAt(mm))),
		sx,
		syMap
	);

	// ---- readouts -------------------------------------------------------------------------------
	const peakIndex = $derived.by(() => {
		let b = 0;
		for (let j = 0; j < pattern.length; j++) if (pattern[j] > pattern[b]) b = j;
		return b;
	});
	const peakMm = $derived(PLACES[peakIndex]);
	const peakDb = $derived(pattern[peakIndex]);
	const mapMm = $derived(placeOf(f));
	const width = $derived(focus === 'amp' ? peakWidth(responses[0]) : null);
	const otherPeak = $derived.by(() => {
		if (!other) return null;
		let b = 0;
		for (let j = 0; j < other.length; j++) if (other[j] > other[b]) b = j;
		return { mm: PLACES[b], db: other[b] };
	});

	// ---- the level inset ------------------------------------------------------------------------
	const LEVELS = Array.from({ length: 23 }, (_, i) => i * 5);
	const io = $derived.by(() => {
		if (focus !== 'level') return null;
		const run = (e: Ear) => {
			let prev: Float64Array | undefined;
			return LEVELS.map((L) => {
				const r = respond(f, L, e, prev);
				prev = r.gamma;
				return { L, db: dbRe(r.mag[r.peak]) };
			});
		};
		return { live: run(HEALTHY), dead: run(PASSIVE) };
	});
	const ix = scale([0, 110], [640, 920]);
	const iy = scale([-40, 80], [566, 486]);
	const slope = $derived.by(() => {
		if (!io) return 0;
		const a = io.live.find((p) => p.L === 40)!;
		const b = io.live.find((p) => p.L === 80)!;
		return (b.db - a.db) / 40;
	});

	// ---- the vowel's formants, marked on the place axis -----------------------------------------
	const formants = $derived(soundId === 'ah' || soundId === 'ee' ? VOWELS[soundId].formants : null);

	const soundLabel: Record<SoundId, string> = {
		tone: 'one tone',
		pair: 'two tones, 500 Hz and 3 kHz',
		close: 'two close tones, 1 and 1.05 kHz',
		chord: 'the chord C4–E4–G4 (262, 330, 392 Hz)',
		ah: 'the vowel “ah”: harmonics of 120 Hz',
		ee: 'the vowel “ee”: harmonics of 120 Hz'
	};
	const title = $derived(
		focus === 'map'
			? 'each place on the membrane is tuned to one frequency'
			: focus === 'mix'
				? soundLabel[soundId]
				: `a tone of ${hz(f)} at ${level} dB SPL` +
					(focus === 'amp' || focus === 'level'
						? ohcOn
							? ' · amplifier on'
							: ' · amplifier off'
						: '')
	);
</script>

<g>
	<Readout id="title" order={1} label="Sound" value={title}>
		<Label anchor="start" x={24} y={34} text={title} size={15} weight={600} />
	</Readout>

	<Duct top={TOP} bottom={BOTTOM} {push} />

	<!-- the basilar membrane -->
	<path d={membrane} fill="var(--co-membrane)" stroke="var(--co-membrane-edge)" stroke-width="1" />
	{#if envelope}
		<path
			d={envelope}
			fill="none"
			stroke="var(--co-wave)"
			stroke-width="1.2"
			stroke-dasharray="4 3"
			opacity="0.8"
		/>
	{/if}

	{#if focus === 'map'}
		<!-- the tone's place -->
		<circle cx={xAt(mapMm)} cy={MID} r="9" fill="var(--co-wave)" opacity="0.25" />
		<circle cx={xAt(mapMm)} cy={MID} r="4" fill="var(--co-wave)" />
		<line
			x1={xAt(mapMm)}
			x2={xAt(mapMm)}
			y1={BOTTOM + 50}
			y2={syMap(Math.log10(f))}
			stroke="var(--co-wave)"
			stroke-dasharray="3 3"
		/>
		<Label
			x={xAt(mapMm)}
			y={TOP - 8}
			text="{hz(f)} · {mapMm.toFixed(1)} mm"
			size={12}
			weight={600}
			color="var(--co-wave-text)"
			tabular
		/>
		<Label anchor="start" x={24} y={58} text="narrow and stiff at the base" size={12} muted />
		<Label anchor="end" x={936} y={58} text="wide and floppy at the apex" size={12} muted />
	{:else}
		<Readout
			id="peak"
			order={2}
			label="Largest motion"
			value="{peakMm.toFixed(1)} mm from the base"
			note={focus === 'mix' ? undefined : `Greenwood's map: ${mapMm.toFixed(1)} mm`}
		>
			<Label
				anchor="start"
				x={24}
				y={58}
				text={focus === 'mix'
					? `largest motion at ${peakMm.toFixed(1)} mm from the base`
					: `peak at ${peakMm.toFixed(1)} mm from the base · Greenwood's map: ${mapMm.toFixed(1)} mm`}
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}

	<!-- the chart -->
	{#if focus === 'map'}
		<Axes
			{sx}
			sy={syMap}
			yTicks={mapTicks}
			yFormat={(v: number) => hz(Math.pow(10, v)).replace('.00', '')}
			xLabel="mm from the base"
			yLabel="tuned to (log scale)"
		/>
		<path d={mapCurve} fill="none" stroke="var(--co-wave)" stroke-width="2.2" />
		<circle cx={xAt(mapMm)} cy={syMap(Math.log10(f))} r="5" fill="var(--co-wave)" />
		<Readout
			id="formula"
			order={3}
			label="Greenwood's map"
			value="F = 165.4 (10^(2.1 x) − 0.88) Hz"
		>
			<Label
				anchor="start"
				x={X0 + 300}
				y={CT + 18}
				text="F = 165.4 · (10^(2.1x) − 0.88) Hz,  x = fraction of the length from the apex"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Axes
			{sx}
			{sy}
			yTicks={[-20, 0, 20, 40, 60, 80]}
			xLabel="mm from the base"
			yLabel="motion of each place (dB above threshold)"
		/>
		<line x1={X0} x2={X1} y1={sy(0)} y2={sy(0)} stroke="var(--co-threshold)" stroke-width="1.2" />
		<Readout id="threshold-label">
			<Label
				anchor="end"
				x={X1}
				y={sy(0) - 6}
				text="threshold"
				size={11}
				color="var(--co-threshold-text)"
			/>
		</Readout>
		{#if other}
			<path
				d={curve(other)}
				fill="none"
				stroke={ohcOn ? 'var(--co-dead)' : 'var(--co-wave)'}
				stroke-width="1.8"
				stroke-dasharray="5 4"
			/>
		{/if}
		<path
			d={curve(pattern)}
			fill="none"
			stroke={ohcOn ? 'var(--co-wave)' : 'var(--co-dead)'}
			stroke-width="2.4"
		/>
		{#if formants}
			{#each formants as fm, i (i)}
				<line
					x1={xAt(placeOf(fm))}
					x2={xAt(placeOf(fm))}
					y1={CT}
					y2={CB}
					stroke="var(--co-formant)"
					stroke-dasharray="2 4"
				/>
				<!-- F1 to the right of its line, F2 and F3 to the left, F3 a row lower -->
				<Label
					anchor={i === 0 ? 'start' : 'end'}
					x={xAt(placeOf(fm)) + (i === 0 ? 5 : -5)}
					y={CT + (i === 2 ? 30 : 14)}
					text="F{i + 1} {hz(fm)}"
					size={11}
					color="var(--co-formant-text)"
				/>
			{/each}
		{/if}
	{/if}

	<!-- the bottom band: legend, numbers and the level inset -->
	{#if focus === 'amp' && otherPeak && width}
		<Readout
			id="amp"
			order={3}
			label={ohcOn ? 'Without the amplifier' : 'With the amplifier'}
			value="{otherPeak.db - peakDb >= 0 ? '+' : ''}{(otherPeak.db - peakDb).toFixed(
				0
			)} dB, at {otherPeak.mm.toFixed(1)} mm"
			note="10 dB width now: {width.mm.toFixed(1)} mm, {width.octaves.toFixed(2)} octave"
		>
			<line x1={24} x2={60} y1={490} y2={490} stroke="var(--co-wave)" stroke-width="2.4" />
			<Label anchor="start" x={68} y={494} text="outer hair cells working" size={12} />
			<line
				x1={24}
				x2={60}
				y1={514}
				y2={514}
				stroke="var(--co-dead)"
				stroke-width="1.8"
				stroke-dasharray="5 4"
			/>
			<Label anchor="start" x={68} y={518} text="passive (no amplifier)" size={12} />
			<Label
				anchor="start"
				x={300}
				y={494}
				text="peak {peakDb.toFixed(0)} dB at {peakMm.toFixed(1)} mm · {ohcOn
					? 'without'
					: 'with'} the amplifier: {otherPeak.db.toFixed(0)} dB at {otherPeak.mm.toFixed(1)} mm"
				size={12}
				tabular
			/>
			<Label
				anchor="start"
				x={300}
				y={518}
				text="within 10 dB of the peak: {width.mm.toFixed(1)} mm, {width.octaves.toFixed(
					2
				)} octave of the map"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{:else if focus === 'level' && io && otherPeak}
		<Readout
			id="level-read"
			order={3}
			label="Peak"
			value="{peakDb.toFixed(0)} dB at {peakMm.toFixed(1)} mm"
			note="growth 40→80 dB SPL: {slope.toFixed(2)} dB per dB (passive: 1)"
		>
			<Label
				anchor="start"
				x={24}
				y={494}
				text="peak {peakDb.toFixed(0)} dB above threshold, at {peakMm.toFixed(1)} mm"
				size={13}
				weight={600}
				tabular
			/>
			<Label
				anchor="start"
				x={24}
				y={518}
				text="live growth from 40 to 80 dB SPL: {slope.toFixed(2)} dB per dB"
				size={12}
				muted
				tabular
			/>
			<Label anchor="start" x={24} y={540} text="passive growth: 1 dB per dB" size={12} muted />
		</Readout>
		<Axes
			sx={ix}
			sy={iy}
			xTicks={[0, 20, 40, 60, 80, 100]}
			yTicks={[-40, 0, 40, 80]}
			yLabel="peak (dB) vs level"
		/>
		<path
			d={linePath(
				io.dead,
				(p) => p.L,
				(p) => Math.max(-40, p.db),
				ix,
				iy
			)}
			fill="none"
			stroke="var(--co-dead)"
			stroke-width="1.8"
			stroke-dasharray="5 4"
		/>
		<path
			d={linePath(
				io.live,
				(p) => p.L,
				(p) => Math.max(-40, p.db),
				ix,
				iy
			)}
			fill="none"
			stroke="var(--co-wave)"
			stroke-width="2.2"
		/>
		<circle
			cx={ix(level)}
			cy={iy(Math.max(-40, Math.min(80, peakDb)))}
			r="5"
			fill={ohcOn ? 'var(--co-wave)' : 'var(--co-dead)'}
		/>
	{:else if focus === 'mix'}
		<Readout id="mix-note" label="Each tone is solved alone and the patterns added">
			<Label
				anchor="start"
				x={24}
				y={494}
				text="each tone is solved as if it were alone, and the patterns are added"
				size={12}
				muted
			/>
		</Readout>
	{:else if focus === 'wave'}
		<Readout id="wave-note" label="Dashed: the envelope, the largest swing at each place">
			<Label
				anchor="start"
				x={24}
				y={494}
				text="dashed: the envelope, the largest swing at each place · drawn slowed down enormously"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
