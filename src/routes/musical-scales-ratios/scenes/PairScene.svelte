<script lang="ts">
	/**
	 * Two keys of a one-octave keyboard (C4 to C5) and their waves: the lower
	 * note, the upper note and their sum, drawn over a short window of time that
	 * scrolls slowly (the real waves are hundreds of times faster). A readout
	 * card above; a roughness meter beside the keyboard.
	 *
	 * Phases (`step.hints.phase`):
	 *   notes  — the two waves and their frequencies (a 24 ms window)
	 *   lineup — the same, with the repeats of the sum marked: every q cycles of
	 *            the lower note for a ratio p : q; under equal temperament the
	 *            marks are where it nearly repeats, and the card says by how much
	 *            it drifts
	 *   rough  — a 200 ms window, long enough to see beats; the card gives the
	 *            beat rate of the nearest pair of harmonics
	 *
	 * Params: `keyA`, `keyB` (0 = C4 … 12 = C5), `tuning` ('equal' | 'pure'),
	 * `timbre` ('sine' | 'rich'), `playPair` (an action). Pressing a key on the
	 * stage replaces the key pressed before it and plays the pair; sounds start
	 * only from such presses (see `sound.ts`).
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		C4,
		INTERVALS,
		KEY_NAMES,
		beats,
		cents,
		pairFrequencies,
		partials,
		roughness,
		roughnessScale,
		type Timbre,
		type Tuning
	} from '../scales';
	import Card from './Card.svelte';
	import { playNotes, stopAll } from './sound';
	import { fmt, pathOf, signed, type Cell } from './ui';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'notes'));
	const clampKey = (v: unknown) => Math.max(0, Math.min(12, Math.round(Number(v ?? 0))));
	const keyA = $derived(clampKey(params.keyA ?? 0));
	const keyB = $derived(clampKey(params.keyB ?? 12));
	const lo = $derived(Math.min(keyA, keyB));
	const hi = $derived(Math.max(keyA, keyB));
	const tuning = $derived<Tuning>(params.tuning === 'pure' ? 'pure' : 'equal');
	const timbre = $derived<Timbre>(params.timbre === 'rich' ? 'rich' : 'sine');
	const freqs = $derived(pairFrequencies(lo, hi, tuning));
	const iv = $derived(INTERVALS[hi - lo]);

	// ---- sound ------------------------------------------------------------------------
	/** Which of the two keys was pressed longer ago (the next press replaces it). */
	let older: 'keyA' | 'keyB' = 'keyA';
	function press(k: number) {
		let a = keyA;
		let b = keyB;
		// pressing a key already held makes the other one the next to be replaced
		if (k === a) older = 'keyB';
		else if (k === b) older = 'keyA';
		else {
			if (older === 'keyA') a = k;
			else b = k;
			setParam(older, k);
			older = older === 'keyA' ? 'keyB' : 'keyA';
		}
		const [f1, f2] = pairFrequencies(Math.min(a, b), Math.max(a, b), tuning);
		playNotes(a === b ? [f1] : [f1, f2], timbre);
	}
	let lastPlay: number | undefined;
	$effect(() => {
		const c = Number(params.playPair ?? 0);
		untrack(() => {
			if (lastPlay !== undefined && c !== lastPlay)
				playNotes(lo === hi ? [freqs[0]] : [...freqs], timbre);
			lastPlay = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- waves ------------------------------------------------------------------------
	const X0 = 132;
	const X1 = 930;
	const YA = 152;
	const YB = 222;
	const YS = 306;
	const AMP = 24;
	const AMP_SUM = 40;
	/** Seconds of sound shown across the window. */
	const W = $derived(phase === 'rough' ? 0.2 : 0.0245);
	const N = $derived(phase === 'rough' ? (timbre === 'rich' ? 4000 : 1400) : 700);
	/** The window scrolls through the sound once every 12 s of the clock. */
	const tau = $derived((reduced ? 2.5 : t) * (W / 12));
	const xOf = (s: number) => X0 + (s / W) * (X1 - X0);

	const parts = $derived([partials(freqs[0], timbre), partials(freqs[1], timbre)]);
	const norm = $derived(parts[0].reduce((s, p) => s + p.a, 0));
	const wave = (ps: { f: number; a: number }[], s: number) => {
		let y = 0;
		for (const p of ps) y += p.a * Math.sin(2 * Math.PI * p.f * s);
		return y;
	};
	const traces = $derived.by(() => {
		const a: { x: number; y: number }[] = [];
		const b: { x: number; y: number }[] = [];
		const sum: { x: number; y: number }[] = [];
		for (let i = 0; i <= N; i++) {
			const s = (i / N) * W;
			const ya = wave(parts[0], tau + s) / norm;
			const yb = wave(parts[1], tau + s) / norm;
			const x = xOf(s);
			a.push({ x, y: YA - AMP * ya });
			b.push({ x, y: YB - AMP * yb });
			sum.push({ x, y: YS - (AMP_SUM * (ya + yb)) / 2 });
		}
		return { a: pathOf(a), b: pathOf(b), sum: pathOf(sum) };
	});

	// ---- how the waves line up -----------------------------------------------------------
	const ratio = $derived(freqs[1] / freqs[0]);
	/** The sum repeats (or nearly repeats) every q cycles of the lower note. */
	const repeat = $derived(lo === hi ? 1 : iv.q);
	const period = $derived(repeat / freqs[0]);
	/** Cycles of the upper note by which the pattern slips at each repeat. */
	const drift = $derived(lo === hi ? 0 : repeat * ratio - iv.p);
	const exact = $derived(Math.abs(drift) < 1e-9);
	const marks = $derived.by(() => {
		if (period > W * 0.7) return [];
		const k0 = Math.ceil(tau / period);
		const out: { k: number; x: number }[] = [];
		for (let k = k0; k * period <= tau + W; k++) out.push({ k, x: xOf(k * period - tau) });
		return out;
	});
	const showMarks = $derived(phase === 'lineup' && marks.length > 0);

	// ---- roughness and beats --------------------------------------------------------------
	const scale = $derived(roughnessScale(C4, timbre));
	const rough = $derived(Math.min(1, roughness(freqs[0], freqs[1], timbre) / scale));
	const beat = $derived.by(() => {
		if (lo === hi) return null;
		const list = beats(freqs[0], freqs[1], timbre === 'sine' ? 1 : 6, 40);
		// the most audible: the lowest harmonics that nearly coincide
		return [...list].sort((x, y) => x.m + x.n - (y.m + y.n) || x.rate - y.rate)[0] ?? null;
	});

	const nameOf = (k: number) => KEY_NAMES[k];
	const cells = $derived.by<Cell[]>(() => {
		const name = lo === hi ? 'unison' : iv.name;
		const ratioCell: Cell = {
			id: 'ratio',
			label: 'Frequency ratio',
			value: lo === hi ? '1 : 1' : exact ? `${iv.p} : ${iv.q}` : fmt(ratio, 4),
			sub:
				lo === hi
					? 'the same note'
					: exact
						? `= ${fmt(ratio, 4)}, pure`
						: `${signed(cents(ratio / (iv.p / iv.q)))} cents from ${iv.p} : ${iv.q}`
		};
		if (phase === 'notes')
			return [
				{
					id: 'lo',
					label: 'Lower note',
					value: `${nameOf(lo)} · ${fmt(freqs[0], 1)} Hz`,
					sub: `${fmt(freqs[0] * W, 1)} cycles shown`,
					color: 'var(--ms-a)'
				},
				{
					id: 'hi',
					label: 'Upper note',
					value: `${nameOf(hi)} · ${fmt(freqs[1], 1)} Hz`,
					sub: `${fmt(freqs[1] * W, 1)} cycles shown`,
					color: 'var(--ms-b)'
				},
				ratioCell
			];
		if (phase === 'lineup')
			return [
				{ id: 'iv', label: 'Interval', value: name, sub: `${nameOf(lo)} – ${nameOf(hi)}` },
				ratioCell,
				{
					id: 'rep',
					label: exact ? 'The sum repeats every' : 'The sum nearly repeats every',
					value: `${repeat} cycle${repeat > 1 ? 's' : ''} of ${nameOf(lo)}`,
					sub: exact
						? `and ${lo === hi ? 1 : iv.p} of ${nameOf(hi)}`
						: `slipping ${fmt(Math.abs(drift) * 100, 1)}% of a cycle each time`,
					color: 'var(--ms-sum)'
				}
			];
		return [
			{ id: 'iv', label: 'Interval', value: name, sub: `${nameOf(lo)} – ${nameOf(hi)}` },
			{
				id: 'beat',
				label: 'Beats',
				value: beat ? `${fmt(beat.rate, 1)} per second` : 'none slower than 40 a second',
				sub: beat
					? timbre === 'sine'
						? `${fmt(freqs[1], 1)} − ${fmt(freqs[0], 1)} Hz`
						: `harmonic ${beat.m} of ${nameOf(lo)} against ${beat.n} of ${nameOf(hi)}`
					: lo === hi
						? 'the same note'
						: 'faster ones still count in the roughness',
				color: 'var(--ms-sum)'
			},
			{
				id: 'rough',
				label: 'Roughness',
				value: `${Math.round(rough * 100)} / 100`,
				sub: timbre === 'sine' ? 'two sine tones' : 'six harmonics each',
				color: 'var(--ms-rough)'
			}
		];
	});

	// ---- keyboard ---------------------------------------------------------------------------
	const KX = 132;
	const KY = 398;
	const KW = 62;
	const KH = 176;
	const BW = 36;
	const BH = 106;
	const WHITE = [0, 2, 4, 5, 7, 9, 11, 12];
	const BLACK = [1, 3, 6, 8, 10];
	const keyX = (k: number) => {
		const w = WHITE.indexOf(k);
		if (w >= 0) return KX + w * KW;
		// a black key sits on the line between its two white neighbours
		const left = WHITE.indexOf(k - 1);
		return KX + (left + 1) * KW - BW / 2;
	};
	const keyColor = (k: number) => (k === lo ? 'var(--ms-a)' : k === hi ? 'var(--ms-b)' : undefined);
	function onkey(e: KeyboardEvent, k: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			press(k);
		}
	}

	// ---- meter ------------------------------------------------------------------------------
	const MX = 690;
	const MW = 236;
	const MY = 470;
	const meterOn = $derived(phase === 'rough' ? 1 : 0.45);
</script>

<g>
	<Card x={16} y={16} w={928} h={88} {cells} />

	<!-- the three traces -->
	<g style:pointer-events="none">
		{#each [{ y: YA, l: nameOf(lo), c: 'var(--ms-a)' }, { y: YB, l: nameOf(hi), c: 'var(--ms-b)' }] as row (row.y)}
			<line x1={X0} x2={X1} y1={row.y} y2={row.y} stroke="var(--stage-grid)" />
			<Readout id="row-{row.y}">
				<Label x={24} y={row.y + 5} text={row.l} anchor="start" weight={700} color={row.c} />
			</Readout>
		{/each}
		<line x1={X0} x2={X1} y1={YS} y2={YS} stroke="var(--stage-grid)" />
		<Readout id="row-sum">
			<Label x={24} y={YS - 4} text="together" anchor="start" weight={700} color="var(--ms-sum)" />
			<Label x={24} y={YS + 12} text="(the sum)" anchor="start" size={11} muted />
		</Readout>

		{#if showMarks}
			{#each marks as m, i (m.k)}
				{#if i < marks.length - 1 && m.k % 2 === 0}
					<rect
						x={m.x}
						y={YA - 34}
						width={marks[i + 1].x - m.x}
						height={YS + 48 - (YA - 34)}
						fill="var(--ms-sum)"
						opacity="0.07"
					/>
				{/if}
				<line
					x1={m.x}
					x2={m.x}
					y1={YA - 34}
					y2={YS + 48}
					stroke="var(--ms-sum)"
					stroke-width="1.2"
					stroke-dasharray={exact ? 'none' : '4 4'}
					opacity="0.7"
				/>
			{/each}
		{/if}

		<path d={traces.a} fill="none" stroke="var(--ms-a)" stroke-width="2" />
		<path d={traces.b} fill="none" stroke="var(--ms-b)" stroke-width="2" />
		<path
			d={traces.sum}
			fill="none"
			stroke="var(--ms-sum)"
			stroke-width={phase === 'rough' ? 1.2 : 2.4}
		/>
		<Readout id="window">
			<Label
				x={X1}
				y={YS + 70}
				anchor="end"
				size={11}
				muted
				text={phase === 'rough'
					? 'time → 0.2 seconds shown, scrolling 60 times slower than real'
					: 'time → 24 thousandths of a second, scrolling 500 times slower than real'}
			/>
		</Readout>
	</g>

	<!-- keyboard -->
	<g>
		{#each WHITE as k (k)}
			{@const c = keyColor(k)}
			<rect
				x={keyX(k)}
				y={KY}
				width={KW - 2}
				height={KH}
				rx="5"
				fill={c ?? 'var(--ms-white-key)'}
				fill-opacity={c ? 0.85 : 1}
				stroke="var(--stage-line)"
				role="button"
				tabindex="0"
				aria-label="{KEY_NAMES[k]} key"
				aria-pressed={c !== undefined}
				style:cursor="pointer"
				onclick={() => press(k)}
				onkeydown={(e) => onkey(e, k)}
			/>
			<text
				x={keyX(k) + KW / 2 - 1}
				y={KY + KH - 14}
				text-anchor="middle"
				font-size="13"
				font-weight={c ? 700 : 500}
				fill={c ? '#fff' : '#555'}
				style:pointer-events="none">{KEY_NAMES[k]}</text
			>
		{/each}
		{#each BLACK as k (k)}
			{@const c = keyColor(k)}
			<rect
				x={keyX(k)}
				y={KY}
				width={BW}
				height={BH}
				rx="4"
				fill={c ?? 'var(--ms-black-key)'}
				stroke="var(--stage-line)"
				role="button"
				tabindex="0"
				aria-label="{KEY_NAMES[k]} key"
				aria-pressed={c !== undefined}
				style:cursor="pointer"
				onclick={() => press(k)}
				onkeydown={(e) => onkey(e, k)}
			/>
			<text
				x={keyX(k) + BW / 2}
				y={KY + BH - 10}
				text-anchor="middle"
				font-size="10"
				fill="#fff"
				opacity={c ? 1 : 0.75}
				style:pointer-events="none">{KEY_NAMES[k].replace('4', '')}</text
			>
		{/each}
	</g>

	<!-- roughness meter -->
	<Readout id="meter">
		<g opacity={meterOn} style:pointer-events="none">
			<Label x={MX} y={MY - 40} text="Roughness" anchor="start" weight={700} size={14} />
			<Label
				x={MX}
				y={MY - 20}
				text="Plomp–Levelt curve, summed over harmonics"
				anchor="start"
				size={11}
				muted
			/>
			<rect
				x={MX}
				y={MY}
				width={MW}
				height="22"
				rx="11"
				fill="var(--stage-grid)"
				stroke="var(--stage-line)"
			/>
			<rect
				x={MX}
				y={MY}
				width={Math.max(22, rough * MW)}
				height="22"
				rx="11"
				fill="var(--ms-rough)"
				opacity={0.25 + 0.75 * rough}
			/>
			<text x={MX} y={MY + 44} class="muted" font-size="11">smooth</text>
			<text x={MX + MW} y={MY + 44} class="muted" font-size="11" text-anchor="end">rough</text>
			<text x={MX} y={MY + 82} font-size="12">Press any two keys,</text>
			<text x={MX} y={MY + 100} font-size="12">or Tab to a key and press Enter.</text>
		</g>
	</Readout>
</g>
