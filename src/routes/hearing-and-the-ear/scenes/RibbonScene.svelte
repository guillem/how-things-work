<script lang="ts">
	/**
	 * The cochlea unrolled: a tube of fluid 3.5 cm long (drawn hugely enlarged), entrance on the
	 * left with the stirrup in the window, and the ribbon (basilar membrane) along its middle. The
	 * ribbon's shape is the cochlea-hearing model's travelling wave for the step's notes: each
	 * note's velocity along the ribbon (its size and its timing), drawn on a squeezed scale (0 at
	 * the threshold of hearing, full height 60 dB above it) and slowed right down. The shaded band
	 * is the bump: how far the ribbon shakes at each spot.
	 *
	 * Focus: 'unroll' (one middle note, the snail unrolled), 'pitch' (the note's pitch from
	 * `params.pitch`, its peak's place), 'sensors' (a row of 70 dots, 50 inner hair cells each,
	 * lit where the ribbon shakes above the threshold, with their nerve fibres), 'two' (a second
	 * note, `params.second`), 'loud' (the note's loudness, `params.loud`, against a dashed outline
	 * of the soft note's bump) and 'next'.
	 */
	import { Label, TAU, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		LENGTH_MM,
		PLACES,
		SECTIONS,
		SENSORS,
		SOFT,
		bumps,
		dbRe,
		drawnShake,
		loudnessName,
		peakCm,
		pitchHz,
		respond,
		sensorsSignalling,
		shakes,
		soundsLike,
		type Response
	} from '../model';
	import HearButton from './HearButton.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'pitch'));
	const f1 = $derived(focus === 'unroll' ? 1000 : pitchHz(Number(params.pitch ?? 5)));
	const f2 = $derived(pitchHz(Number(params.second ?? 8)));
	const level = $derived(focus === 'loud' ? Number(params.loud ?? SOFT) : SOFT);
	const notes = $derived(focus === 'two' ? [f1, f2] : [f1]);

	const responses: Response[] = $derived(notes.map((f) => respond(f, level)));
	const shake = $derived(drawnShake(responses));
	const softShake = $derived(focus === 'loud' ? drawnShake([respond(f1, SOFT)]) : null);

	// ---- geometry ---------------------------------------------------------------------------
	const X0 = 130;
	const X1 = 900;
	const MID = 232;
	const TOP = 112;
	const BOT = 352;
	const AMP = 100;
	const xAt = (mm: number) => X0 + (mm / LENGTH_MM) * (X1 - X0);
	const N = 480;
	const samples = Array.from({ length: N }, (_, i) => {
		const j = Math.round((i / (N - 1)) * (SECTIONS - 1));
		return { j, x: xAt(PLACES[j]) };
	});

	// ---- the ripple: each note at its own (slowed) rate, travelling away from the entrance ----
	const tt = $derived(reduced ? 2.5 : t);
	/** Shakes a second as drawn, a little faster for a higher note. */
	const drawnRate = (f: number) => 0.35 + 0.1 * Math.log2(f / 31.25);
	const ribbon = $derived.by(() => {
		const parts: string[] = [];
		for (const s of samples) {
			let sum = 0;
			let tot = 0;
			for (const r of responses) tot += r.mag[s.j] * r.mag[s.j];
			tot = Math.sqrt(tot) || 1;
			for (const r of responses) {
				const ph = Math.atan2(r.im[s.j], r.re[s.j]);
				sum += (r.mag[s.j] / tot) * Math.cos(TAU * drawnRate(r.f) * tt + ph);
			}
			const y = MID - AMP * shake[s.j] * sum;
			parts.push(`${s.x.toFixed(1)} ${y.toFixed(1)}`);
		}
		return 'M' + parts.join(' L');
	});
	function band(sh: Float64Array) {
		const up = samples.map((s) => `${s.x.toFixed(1)} ${(MID - AMP * sh[s.j]).toFixed(1)}`);
		const down = samples
			.slice()
			.reverse()
			.map((s) => `${s.x.toFixed(1)} ${(MID + AMP * sh[s.j]).toFixed(1)}`);
		return `M${up.join(' L')} L${down.join(' L')} Z`;
	}
	const bump = $derived(band(shake));
	const softBand = $derived(softShake ? band(softShake) : '');

	// ---- the stirrup in the window, pushing in and out with the first note --------------------
	const push = $derived(5 * Math.sin(TAU * drawnRate(f1) * tt));

	// ---- peaks --------------------------------------------------------------------------------
	const tops = $derived(bumps(responses));
	const merged = $derived(focus === 'two' && tops.length < 2);
	const pins = $derived.by(() => {
		const list = merged
			? [
					{
						k: 0,
						mm: (PLACES[responses[0].peak] + PLACES[responses[1].peak]) / 2,
						text: 'one blurred bump'
					}
				]
			: responses.map((r, k) => ({ k, mm: PLACES[r.peak], text: shakes(r.f) }));
		const out = list.map((p) => {
			const j = Math.min(SECTIONS - 1, Math.round((p.mm / LENGTH_MM) * SECTIONS));
			return { ...p, x: xAt(p.mm), y: MID - AMP * shake[j] - 6, lx: xAt(p.mm) };
		});
		// keep two labels apart, and inside the stage
		if (out.length === 2) {
			const [a, b] = out[0].x < out[1].x ? [out[0], out[1]] : [out[1], out[0]];
			const gap = 200;
			if (b.lx - a.lx < gap) {
				const c = (a.lx + b.lx) / 2;
				a.lx = c - gap / 2;
				b.lx = c + gap / 2;
			}
		}
		for (const p of out) p.lx = clamp(p.lx, 110, 850);
		return out;
	});

	const placeWords = (cm: number) =>
		cm < 0.35
			? 'just inside the entrance'
			: `about ${(Math.round(cm * 2) / 2).toLocaleString('en-GB')} cm in`;

	// ---- sensors ------------------------------------------------------------------------------
	const showSensors = $derived(focus === 'sensors' || focus === 'two' || focus === 'loud');
	const DOTS = 70;
	const DOT_Y = 424;
	const dots = $derived.by(() => {
		const out: { i: number; x: number; on: number }[] = [];
		for (let i = 0; i < DOTS; i++) {
			const j = Math.round(((i + 0.5) / DOTS) * SECTIONS);
			let s = 0;
			for (const r of responses) s += r.mag[j] * r.mag[j];
			const db = dbRe(Math.sqrt(s));
			const on = db > 0 ? 0.35 + 0.65 * clamp(db / 40) : 0;
			out.push({ i, x: X0 + ((i + 0.5) / DOTS) * (X1 - X0), on });
		}
		return out;
	});
	const signalling = $derived(sensorsSignalling(responses));
	const roundCount = (n: number) => (n < 100 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100);

	// ---- words --------------------------------------------------------------------------------
	const headline = $derived.by(() => {
		switch (focus) {
			case 'unroll':
				return 'Each push sends a ripple along the ribbon';
			case 'sensors':
				return `About ${roundCount(signalling).toLocaleString('en-GB')} of the ${SENSORS.toLocaleString('en-GB')} sensors are signalling`;
			case 'two':
				return merged ? 'Too close: the two bumps blur into one' : 'Two notes, two bumps';
			case 'loud':
				return `As loud as ${loudnessName(level)}`;
			case 'next':
				return 'Each note shakes its own spot';
			default:
				return `The peak is ${placeWords(peakCm(responses[0]))}`;
		}
	});
	const sub = $derived.by(() => {
		switch (focus) {
			case 'unroll':
				return 'it grows as it goes, peaks at one spot, then dies away';
			case 'sensors':
				return 'each dot is 50 sensors: the brightest sit under the peak';
			case 'two':
				return `${shakes(f1)} and ${shakes(f2)}`;
			case 'loud':
				return `the bump is ${placeWords(peakCm(responses[0]))}; about ${roundCount(signalling).toLocaleString('en-GB')} sensors signal`;
			case 'next':
				return 'high notes near the entrance, low notes at the far end';
			default:
				return `it sounds ${soundsLike(f1)}`;
		}
	});

	// ---- the snail, unrolled (an icon) -----------------------------------------------------------
	const snail = (() => {
		const pts: string[] = [];
		const turns = 2.5;
		const k = Math.log(46 / 9) / (turns * TAU);
		for (let i = 0; i <= 80; i++) {
			const th = (i / 80) * turns * TAU;
			const r = 46 * Math.exp(-k * th);
			pts.push(
				`${(92 + r * Math.cos(Math.PI + th)).toFixed(1)} ${(486 + r * Math.sin(Math.PI + th)).toFixed(1)}`
			);
		}
		return 'M' + pts.join(' L');
	})();
	const unroll = $derived(focus === 'unroll');
	const ticks = [1, 2, 3];
</script>

<g class="he-ribbon">
	<!-- the tube: fluid above and below the ribbon, closed at the far end -->
	<path
		d="M{X0} {TOP} L{X1 - 40} {TOP} Q {X1 + 30} {TOP} {X1 + 30} {MID} Q {X1 + 30} {BOT} {X1 -
			40} {BOT} L{X0} {BOT} Z"
		fill="var(--he-fluid)"
		stroke="var(--he-fluid-edge)"
		stroke-width="2"
	/>
	<!-- entrance wall, with the window (stirrup) above the ribbon and the round window below -->
	<line x1={X0} y1={TOP} x2={X0} y2={BOT} stroke="var(--he-bone-edge)" stroke-width="5" />
	<line
		x1={X0 + push}
		y1={TOP + 22}
		x2={X0 + push}
		y2={TOP + 66}
		stroke="var(--he-ossicle-edge)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<path
		d="M{X0 - 40 + push} {TOP + 44} Q {X0 - 18 + push} {TOP + 20} {X0 - 3 + push} {TOP + 26} M{X0 -
			40 +
			push} {TOP + 44} Q {X0 - 18 + push} {TOP + 68} {X0 - 3 + push} {TOP + 62}"
		fill="none"
		stroke="var(--he-ossicle-edge)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<path
		d="M{X0} {BOT - 66} Q {X0 - 12 - push * 1.2} {BOT - 44} {X0} {BOT - 22}"
		fill="none"
		stroke="var(--he-drum)"
		stroke-width="3"
	/>

	<!-- the bump (how far the ribbon shakes at each spot) and the ribbon itself -->
	{#if softShake}
		<path
			d={softBand}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
	{/if}
	<path d={bump} fill="var(--he-accent)" opacity="0.18" />
	<path
		d={ribbon}
		fill="none"
		stroke="var(--he-ribbon)"
		stroke-width="5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>

	<!-- the peaks -->
	{#each pins as p (p.k)}
		<line
			x1={p.x}
			y1={p.y}
			x2={p.lx}
			y2={TOP - 10}
			stroke="var(--he-accent)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<circle cx={p.x} cy={p.y} r="5" fill="var(--he-accent)" />
		<Readout
			id="he-pin-{p.k}"
			order={3 + p.k}
			label={merged ? 'Bump' : p.k === 0 ? 'Note' : 'Second note'}
			value={p.text}
		>
			<Label
				x={p.lx}
				y={TOP - 16}
				text={p.text}
				size={15}
				weight={700}
				color="var(--he-accent-text)"
			/>
		</Readout>
	{/each}

	<!-- ruler under the tube -->
	<line
		x1={X0}
		y1={BOT + 14}
		x2={X1}
		y2={BOT + 14}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	{#each ticks as cm (cm)}
		<line
			x1={xAt(cm * 10)}
			y1={BOT + 8}
			x2={xAt(cm * 10)}
			y2={BOT + 20}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<Readout id="he-tick-{cm}">
			<Label x={xAt(cm * 10)} y={BOT + 36} text="{cm} cm" size={13} muted />
		</Readout>
	{/each}
	<Readout id="he-entrance" order={8} label="Entrance" marker={1} at={[X0 + 4, BOT + 30]}>
		<Label x={X0} y={BOT + 36} text="entrance" size={14} weight={600} anchor="start" />
	</Readout>
	<Readout id="he-far" order={9} label="Far end" marker={2} at={[X1 + 10, BOT + 30]}>
		<Label x={X1 + 30} y={BOT + 36} text="far end" size={14} weight={600} anchor="end" />
	</Readout>

	{#if focus === 'pitch' || focus === 'next'}
		<Readout id="he-high">
			<Label
				x={X0 + 10}
				y={BOT + 72}
				text="← high notes shake here"
				size={15}
				anchor="start"
				color="var(--he-accent-text)"
			/>
		</Readout>
		<Readout id="he-low">
			<Label
				x={X1 + 20}
				y={BOT + 72}
				text="low notes shake here →"
				size={15}
				anchor="end"
				color="var(--he-accent-text)"
			/>
		</Readout>
	{/if}

	{#if unroll}
		<Readout id="he-u-ribbon" order={10} label="Ribbon" marker={1} at={[300, MID - 14]}>
			<Label x={300} y={MID - 16} text="the ribbon" size={15} weight={600} />
		</Readout>
		<Readout id="he-u-fluid" order={11} label="Fluid" marker={2} at={[300, TOP + 30]}>
			<Label x={300} y={TOP + 34} text="fluid" size={14} muted />
		</Readout>
		<Readout id="he-u-fluid2">
			<Label x={300} y={BOT - 22} text="fluid" size={14} muted />
		</Readout>
		<Readout
			id="he-u-stirrup"
			order={12}
			label="Stirrup in the window"
			marker={3}
			at={[X0 - 30, TOP + 44]}
		>
			<Label x={X0 - 22} y={TOP - 10} text="stirrup" size={14} />
		</Readout>
	{/if}

	<!-- the snail, unrolled -->
	{#if !showSensors}<g opacity={unroll ? 1 : 0.45}>
			<path
				d={snail}
				fill="none"
				stroke="var(--he-fluid-edge)"
				stroke-width="11"
				stroke-linecap="round"
			/>
			<path
				d={snail}
				fill="none"
				stroke="var(--he-fluid)"
				stroke-width="7"
				stroke-linecap="round"
			/>
			<Readout id="he-snail">
				<Label x={92} y={562} text="the snail, unrolled" size={13} muted />
			</Readout>
		</g>{/if}

	<!-- sensors and their nerve fibres -->
	{#if showSensors}
		{#each dots as d (d.i)}
			<line
				x1={d.x}
				y1={DOT_Y + 8}
				x2={515 + (d.x - 515) * 0.12}
				y2={520}
				stroke={d.on > 0 ? 'var(--he-nerve)' : 'var(--stage-line)'}
				stroke-width={d.on > 0 ? 1.6 : 1}
				opacity={d.on > 0 ? d.on : 0.6}
			/>
		{/each}
		{#each dots as d (d.i)}
			<circle
				cx={d.x}
				cy={DOT_Y}
				r="5"
				fill={d.on > 0 ? 'var(--he-sensor)' : 'var(--stage-bg)'}
				fill-opacity={d.on > 0 ? d.on : 1}
				stroke={d.on > 0 ? 'var(--he-sensor)' : 'var(--stage-ink-muted)'}
				stroke-width="1.5"
			/>
		{/each}
		<line
			x1="515"
			y1="520"
			x2="515"
			y2="556"
			stroke="var(--he-nerve)"
			stroke-width="8"
			stroke-linecap="round"
		/>
		<Readout id="he-brain">
			<Label x={540} y={556} text="to the brain" size={14} anchor="start" />
		</Readout>
		<Readout id="he-sensors-label">
			<Label x={X0 - 8} y={DOT_Y + 5} text="sensors" size={13} anchor="end" muted />
		</Readout>
	{/if}

	<!-- headline -->
	<Readout id="he-r-head" order={1} label="Ribbon" value={headline} note={sub}>
		<Label x={480} y={36} text={headline} size={20} weight={700} />
	</Readout>
	<Readout id="he-r-sub">
		<Label x={480} y={60} text={sub} size={14} muted />
	</Readout>

	{#if focus === 'pitch' || focus === 'two' || focus === 'sensors'}
		<HearButton x={860} y={550} {notes} />
	{/if}
</g>
