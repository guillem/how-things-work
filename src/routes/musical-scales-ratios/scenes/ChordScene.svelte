<script lang="ts">
	/**
	 * A C major chord, C4–E4–G4, as three rows of harmonics (1 to 6 times each
	 * note's frequency) on a logarithmic frequency axis. Harmonics of two notes
	 * that come within 25 Hz of each other are joined and labelled with their
	 * beat rate; in pure tuning (4 : 5 : 6) they coincide exactly. Below, the
	 * loudness of the strongest clash (C's 5th harmonic with E's 4th) over one
	 * second, scrolling at a quarter of real speed.
	 *
	 * Params: `tuning` ('equal' | 'pure'); `playEqual` and `playPure` (actions)
	 * switch the tuning and play the chord (sounds start only from those presses).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C4, etFrequency, partials, type Tuning } from '../scales';
	import Card from './Card.svelte';
	import { playNotes, stopAll } from './sound';
	import { fmt, pathOf, type Cell } from './ui';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const tuning = $derived<Tuning>(params.tuning === 'pure' ? 'pure' : 'equal');
	const chordOf = (tn: Tuning) =>
		tn === 'pure' ? [C4, (C4 * 5) / 4, (C4 * 3) / 2] : [0, 4, 7].map(etFrequency);
	const freqs = $derived(chordOf(tuning));

	// ---- sound ---------------------------------------------------------------------------
	const counts = {
		playEqual: undefined as number | undefined,
		playPure: undefined as number | undefined
	};
	$effect(() => {
		const e = Number(params.playEqual ?? 0);
		const p = Number(params.playPure ?? 0);
		untrack(() => {
			if (counts.playEqual !== undefined && e !== counts.playEqual) {
				setParam('tuning', 'equal');
				playNotes(chordOf('equal'), 'rich', 3);
			}
			if (counts.playPure !== undefined && p !== counts.playPure) {
				setParam('tuning', 'pure');
				playNotes(chordOf('pure'), 'rich', 3);
			}
			counts.playEqual = e;
			counts.playPure = p;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- the harmonics -------------------------------------------------------------------
	const NOTES = [
		{ id: 'C', name: 'C4', col: 'var(--ms-a)', y: 404 },
		{ id: 'E', name: 'E4', col: 'var(--ms-b)', y: 314 },
		{ id: 'G', name: 'G4', col: 'var(--ms-c)', y: 224 }
	];
	const lf = scale([Math.log10(230), Math.log10(2600)], [120, 920]);
	const fx = (f: number) => lf(Math.log10(f));
	const rows = $derived(
		NOTES.map((nt, i) => ({ ...nt, f: freqs[i], parts: partials(freqs[i], 'rich') }))
	);
	const ord = (k: number) => `${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'}`;
	/** Pairs of harmonics of two different notes within 25 Hz of each other. */
	const links = $derived.by(() => {
		const out: {
			id: string;
			desc: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			rate: number;
		}[] = [];
		for (let i = 0; i < 3; i++)
			for (let j = i + 1; j < 3; j++)
				rows[i].parts.forEach((p, a) =>
					rows[j].parts.forEach((q, b) => {
						const rate = Math.abs(p.f - q.f);
						if (rate < 25)
							out.push({
								id: `${rows[i].id}${a + 1}-${rows[j].id}${b + 1}`,
								desc: `${rows[i].id}’s ${ord(a + 1)} and ${rows[j].id}’s ${ord(b + 1)} harmonic`,
								x1: fx(p.f),
								y1: rows[i].y,
								x2: fx(q.f),
								y2: rows[j].y,
								rate
							});
					})
				);
		return out;
	});

	// ---- the strongest clash, over one second ------------------------------------------------
	const BX0 = 120;
	const BX1 = 920;
	const BY = 530;
	const BH = 30;
	const a5 = 0.88 ** 4;
	const a4 = 0.88 ** 3;
	const wTune = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const target = tuning === 'pure' ? 1 : 0;
		untrack(() => wTune.set(target, { duration: reduced ? 0 : 800 }));
	});
	const ceRate = $derived(Math.abs(5 * freqs[0] - 4 * freqs[1]));
	const band = $derived.by(() => {
		const shift = (reduced ? 2.5 : t) * 0.25;
		const rate = 5 * etFrequency(0) - 4 * etFrequency(4);
		const k = 1 - wTune.current;
		const top: { x: number; y: number }[] = [];
		const bot: { x: number; y: number }[] = [];
		const N = 300;
		for (let i = 0; i <= N; i++) {
			const s = i / N;
			// the two harmonics' summed loudness: it swells and fades at their difference
			const cos = Math.cos(2 * Math.PI * rate * k * (s + shift));
			const env = Math.sqrt(a5 * a5 + a4 * a4 + 2 * a5 * a4 * cos) / (a5 + a4);
			const x = BX0 + s * (BX1 - BX0);
			top.push({ x, y: BY - BH * env });
			bot.push({ x, y: BY + BH * env });
		}
		return pathOf(top) + ' ' + pathOf(bot.reverse()).replace('M', 'L') + ' Z';
	});

	const fastest = $derived(links.filter((l) => l.rate > 1e-6).sort((a, b) => b.rate - a.rate)[0]);
	const cells = $derived<Cell[]>([
		{
			id: 'tuning',
			label: 'Tuning',
			value: tuning === 'pure' ? 'Pure 4 : 5 : 6' : 'Equal-tempered',
			sub: `C ${fmt(freqs[0], 1)} · E ${fmt(freqs[1], 1)} · G ${fmt(freqs[2], 1)} Hz`
		},
		{
			id: 'ce',
			label: 'C’s 5th harmonic against E’s 4th',
			value: ceRate < 1e-6 ? 'no beats' : `${fmt(ceRate, 1)} beats a second`,
			sub:
				ceRate < 1e-6
					? 'they coincide exactly'
					: `${fmt(5 * freqs[0], 1)} vs ${fmt(4 * freqs[1], 1)} Hz`,
			color: 'var(--ms-sum)'
		},
		{
			id: 'fast',
			label: 'Fastest beat in the chord',
			value: fastest ? `${fmt(fastest.rate, 1)} a second` : 'none',
			sub: fastest ? fastest.desc : 'the chord repeats every 4 cycles of C',
			color: 'var(--ms-rough)'
		}
	]);
</script>

<g>
	<Card x={16} y={16} w={928} h={88} {cells} />

	<g style:pointer-events="none">
		<Axes
			sx={lf}
			sy={scale([0, 1], [440, 160])}
			xTicks={[250, 500, 1000, 2000].map((f) => Math.log10(f))}
			yTicks={[]}
			xFormat={(v) => `${Math.round(10 ** v)} Hz`}
			grid={false}
		/>
		{#each rows as r (r.id)}
			<line x1={120} x2={920} y1={r.y} y2={r.y} stroke="var(--stage-grid)" />
			<Readout id="row-{r.id}" label={r.name} value="{fmt(r.f, 1)} Hz" color={r.col}>
				<Label x={24} y={r.y - 4} text={r.name} anchor="start" weight={700} color={r.col} />
				<Label x={24} y={r.y + 12} text="{fmt(r.f, 1)} Hz" anchor="start" size={11} muted />
			</Readout>
		{/each}

		{#each links as l (l.id)}
			{@const exact = l.rate < 1e-6}
			<line
				x1={l.x1}
				y1={l.y1}
				x2={l.x2}
				y2={l.y2}
				stroke={exact ? 'var(--ms-fifth)' : 'var(--ms-rough)'}
				stroke-width={exact ? 3 : 2.5}
				stroke-dasharray={exact ? 'none' : '5 4'}
				opacity="0.85"
			/>
		{/each}

		{#each rows as r (r.id)}
			{#each r.parts as p, i (i)}
				<circle cx={fx(p.f)} cy={r.y} r={3 + 6 * p.a} fill={r.col} />
				<Label
					x={fx(p.f)}
					y={r.id === 'C' ? r.y + 24 : r.y - 14}
					text={String(i + 1)}
					size={10}
					muted
				/>
			{/each}
		{/each}

		{#each links as l (l.id)}
			{@const exact = l.rate < 1e-6}
			<Readout id="link-{l.id}">
				<Label
					x={Math.max(l.x1, l.x2) + 10}
					y={Math.abs(l.y1 - l.y2) > 100 ? 269 : (l.y1 + l.y2) / 2 + 4}
					text={exact ? 'exact' : `${fmt(l.rate, 1)} /s`}
					anchor="start"
					size={12}
					weight={700}
					color={exact ? 'var(--ms-fifth)' : 'var(--ms-rough)'}
				/>
			</Readout>
		{/each}

		<!-- the loudness of C's 5th + E's 4th over one second -->
		<path d={band} fill="var(--ms-sum)" opacity="0.35" />
		<line x1={BX0} x2={BX1} y1={BY} y2={BY} stroke="var(--ms-sum)" opacity="0.6" />
		<Readout id="band-title">
			<Label
				x={BX0}
				y={BY - BH - 12}
				text="Loudness of C’s 5th and E’s 4th harmonic together, over one second"
				anchor="start"
				size={12}
				weight={600}
			/>
			<Label
				x={BX1}
				y={BY + BH + 20}
				text="drawn scrolling at a quarter of real speed"
				anchor="end"
				size={11}
				muted
			/>
		</Readout>
	</g>
</g>
