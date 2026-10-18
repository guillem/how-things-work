<script lang="ts">
	/**
	 * The box run forwards in time. Left: the planet (its Sun, its ice, a volcano and rain on
	 * the land) at the cursor's moment, with the readouts. Right: CO₂ (log scale) and the global
	 * mean temperature against time, drawn up to the cursor, with the frozen stretches shaded
	 * and the open balance the box is heading for dashed.
	 *
	 * Experiments (`step.hints.exp`):
	 *   pulse     — start the CO₂ at `start` doublings of 280 ppm, 3 million years
	 *   dim       — dim the Sun at once to `sun` %, 8 million years
	 *   snowball  — start frozen under a 94 % Sun, volcanoes `snowVolc`, 20 million years
	 *   volcanoes — volcanoes at `volc` × today's from today's balance, 4 million years
	 *
	 * The run is solved once per setting. A cursor sweeps it in SWEEP seconds (a pure function
	 * of the time since the setting last changed: the sweep restarts when a control moves, the
	 * same frame-to-frame bookkeeping as `ecg-arrhythmias/SheetScene`), then holds the finished
	 * run. Under reduced motion the whole run is shown at once.
	 */
	import { Axes, Label, clamp, cycle, lerp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		P0,
		SNOWBALL_SUN,
		T0,
		celsiusText,
		co2Text,
		openEquilibrium,
		run,
		runoffFactor,
		toC,
		type Sample
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const LEAD = 0.6;
	const SWEEP = 12;

	type Exp = 'pulse' | 'dim' | 'snowball' | 'volcanoes';
	const exp = $derived(String(step.hints?.exp ?? 'pulse') as Exp);

	const setting = $derived.by(() => {
		switch (exp) {
			case 'pulse':
				return {
					sun: 1,
					volcanoes: 1,
					ppm: P0 * 2 ** Number(params.start ?? 1),
					frozen: false,
					years: 3e6
				};
			case 'dim':
				return {
					sun: Number(params.sun ?? 90) / 100,
					volcanoes: 1,
					ppm: P0,
					frozen: false,
					years: 8e6
				};
			case 'snowball':
				return {
					sun: SNOWBALL_SUN,
					volcanoes: Number(params.snowVolc ?? 1),
					ppm: P0,
					frozen: true,
					years: 20e6
				};
			default:
				return { sun: 1, volcanoes: Number(params.volc ?? 0), ppm: P0, frozen: false, years: 4e6 };
		}
	});
	const key = $derived(JSON.stringify(setting) + exp);
	const samples = $derived(run({ ...setting, samples: 400 }));
	const balance = $derived(openEquilibrium(setting.sun, setting.volcanoes));

	// ---- the cursor, restarted when the setting changes
	let t0 = 0;
	let seen = '';
	const local = $derived.by(() => {
		if (key !== seen) {
			seen = key;
			t0 = t;
		}
		if (t < t0) t0 = 0;
		return t - t0;
	});
	const u = $derived(reduced ? 1 : clamp((local - LEAD) / SWEEP));
	const year = $derived(u * setting.years);
	const now = $derived.by((): Sample => {
		const s = samples;
		const x = u * (s.length - 1);
		const i = Math.min(s.length - 2, Math.floor(x));
		const f = x - i;
		const a = s[i];
		const b = s[i + 1];
		// at a jump (freeze or thaw) take the nearer sample rather than a mixture
		const pick = a.frozen !== b.frozen ? (f < 0.5 ? a : b) : null;
		return pick
			? { ...pick, year: year }
			: {
					year,
					ppm: Math.exp(lerp(Math.log(a.ppm), Math.log(b.ppm), f)),
					k: lerp(a.k, b.k, f),
					w: lerp(a.w, b.w, f),
					frozen: a.frozen,
					ocean: lerp(a.ocean, b.ocean, f)
				};
	});

	// ---- charts
	const X0 = 400;
	const X1 = 900;
	const CO2_TOP = 80;
	const CO2_BOT = 270;
	const T_TOP = 330;
	const T_BOT = 520;
	const myr = $derived(setting.years / 1e6);
	const sx = $derived(scale([0, myr], [X0, X1]));
	const co2Range = $derived<[number, number]>(exp === 'pulse' ? [100, 2000] : [3, 1e6]);
	const sc = $derived(
		scale([Math.log10(co2Range[0]), Math.log10(co2Range[1])], [CO2_BOT, CO2_TOP])
	);
	const tRange = $derived<[number, number]>(exp === 'pulse' ? [5, 25] : [-60, 45]);
	const st = $derived(scale(tRange, [T_BOT, T_TOP]));
	const co2Ticks = $derived(
		exp === 'pulse' ? [100, 200, 500, 1000, 2000] : [10, 100, 1000, 1e4, 1e5, 1e6]
	);
	const tTicks = $derived(exp === 'pulse' ? [5, 10, 15, 20, 25] : [-60, -40, -20, 0, 20, 40]);
	const xTicks = $derived(
		myr <= 4
			? Array.from({ length: myr + 1 }, (_, i) => i)
			: myr <= 8
				? [0, 2, 4, 6, 8]
				: [0, 5, 10, 15, 20]
	);
	const shown = $derived.by(() => {
		const out: Sample[] = [];
		for (const s of samples) {
			if (s.year > year) break;
			out.push(s);
		}
		if (!now.frozen || !out.length || out[out.length - 1].frozen) out.push(now);
		return out;
	});
	/** Runs of the shown samples split where the state jumps, so no line joins the two states. */
	const pieces = $derived.by(() => {
		const out: Sample[][] = [];
		let cur: Sample[] = [];
		for (const s of shown) {
			if (cur.length && cur[cur.length - 1].frozen !== s.frozen) {
				out.push(cur);
				cur = [];
			}
			cur.push(s);
		}
		if (cur.length) out.push(cur);
		return out;
	});
	const frozenBands = $derived.by(() => {
		const out: { a: number; b: number }[] = [];
		let a: number | null = null;
		for (const s of shown) {
			if (s.frozen && a === null) a = s.year;
			if (!s.frozen && a !== null) {
				out.push({ a, b: s.year });
				a = null;
			}
		}
		if (a !== null) out.push({ a, b: year });
		return out;
	});
	const lg = (v: number) => Math.log10(clamp(v, co2Range[0], co2Range[1]));
	const co2Paths = $derived(
		pieces.map((p) =>
			linePath(
				p,
				(s) => s.year / 1e6,
				(s) => lg(s.ppm),
				sx,
				sc
			)
		)
	);
	const tPaths = $derived(
		pieces.map((p) =>
			linePath(
				p,
				(s) => s.year / 1e6,
				(s) => clamp(toC(s.k), tRange[0], tRange[1]),
				sx,
				st
			)
		)
	);
	const fmtPpm = (v: number) => (v >= 1e6 ? '1 bar' : v >= 1e4 ? `${v / 1000}k` : `${v}`);

	// ---- the planet
	const PX = 190;
	const PY = 250;
	const PR = 100;
	/** Latitude of the ice edge drawn, degrees: 0 for a snowball, ~60 today, none in a hothouse. */
	const iceLat = $derived(now.frozen ? 0 : clamp(60 + (now.k - T0) * 1.6, 25, 90));
	const iceY = $derived(PR * Math.sin((iceLat * Math.PI) / 180));
	const sunR = $derived(16 + 14 * Math.sqrt(setting.sun));
	const tt = $derived(reduced ? 2.5 : t);
	const puffs = $derived(
		Array.from({ length: 5 }, (_, i) => {
			const v = cycle(tt, 3, i / 5);
			return {
				x: 237 + v * 14,
				y: 262 - v * 70,
				r: 4 + v * 8,
				o: setting.volcanoes > 0 && i < Math.ceil(setting.volcanoes * 2.5) ? (1 - v) * 0.6 : 0
			};
		})
	);
	const rainOn = $derived(now.frozen ? 0 : clamp(runoffFactor(now.k), 0, 1.6));
	const drops = $derived(
		Array.from({ length: 10 }, (_, i) => {
			const v = cycle(tt, 0.9, (i * 0.618) % 1);
			return {
				x: 128 + (i % 5) * 22 - v * 6,
				y: 192 + v * 46 + (i >= 5 ? 8 : 0),
				o: i < Math.round(6 * rainOn) ? smoothstep(0, 0.1, v) * (1 - smoothstep(0.85, 1, v)) : 0
			};
		})
	);
	const stateText = $derived(
		now.frozen ? 'frozen over: no weathering' : `open: weathering ×${now.w.toFixed(2)}`
	);
	const timeText = $derived(
		year < 1e6
			? `${(Math.round(year / 10000) * 10000).toLocaleString('en-US')} years`
			: `${(year / 1e6).toFixed(1)} million years`
	);
</script>

<g>
	<!-- the planet -->
	<defs>
		<clipPath id="run-globe"><circle cx={PX} cy={PY} r={PR} /></clipPath>
	</defs>
	<circle cx={52} cy={70} r={sunR + 10} fill="var(--cst-sun)" opacity="0.18" />
	<circle cx={52} cy={70} r={sunR} fill="var(--cst-sun)" opacity={0.5 + 0.5 * setting.sun} />
	<Readout id="sun" order={9} label="Sunlight" value="{Math.round(setting.sun * 100)} % of today’s">
		<Label
			x={52 + sunR + 14}
			y={74}
			text="Sun {Math.round(setting.sun * 100)} %"
			anchor="start"
			weight={600}
		/>
	</Readout>
	<g clip-path="url(#run-globe)">
		<circle cx={PX} cy={PY} r={PR} fill="var(--cst-ocean)" />
		<path
			d="M{PX - 70} {PY - 20} q30 -40 70 -20 q20 30 -10 50 q-40 20 -60 -30 Z"
			fill="var(--cst-land)"
		/>
		<path
			d="M{PX + 20} {PY + 10} q40 -10 60 20 q-10 40 -50 30 q-20 -20 -10 -50 Z"
			fill="var(--cst-land)"
		/>
		{#if now.frozen}
			<circle cx={PX} cy={PY} r={PR} fill="var(--cst-ice)" />
		{:else}
			<rect x={PX - PR} y={PY - PR} width={PR * 2} height={PR - iceY} fill="var(--cst-ice)" />
			<rect x={PX - PR} y={PY + iceY} width={PR * 2} height={PR - iceY} fill="var(--cst-ice)" />
		{/if}
	</g>
	<circle
		cx={PX}
		cy={PY}
		r={PR}
		fill="none"
		stroke={now.frozen ? 'var(--cst-ice-edge)' : 'var(--stage-line)'}
		stroke-width="1.5"
	/>
	<!-- volcano and rain -->
	<path d="M218 292 L232 268 L242 268 L256 292 Z" fill="var(--cst-rock)" />
	{#each puffs as p, i (i)}
		<circle cx={p.x} cy={p.y} r={p.r} fill="var(--cst-volc)" opacity={p.o * 0.6} />
	{/each}
	{#each drops as d, i (i)}
		<line
			x1={d.x}
			y1={d.y}
			x2={d.x - 2}
			y2={d.y + 8}
			stroke="var(--cst-weather)"
			stroke-width="1.8"
			stroke-linecap="round"
			opacity={d.o}
		/>
	{/each}

	<Readout id="time" order={1} label="Time" value={timeText}>
		<Label x={PX} y={PY + PR + 40} text={timeText} size={16} weight={700} tabular />
	</Readout>
	<Readout id="co2" order={2} label="CO₂" value={co2Text(now.ppm)} color="var(--cst-co2)">
		<Label
			x={PX}
			y={PY + PR + 66}
			text="CO₂ {co2Text(now.ppm)}"
			size={14}
			weight={700}
			color="var(--cst-co2)"
			tabular
		/>
	</Readout>
	<Readout
		id="temp"
		order={3}
		label="Temperature"
		value={celsiusText(now.k)}
		color="var(--cst-temp)"
	>
		<Label
			x={PX}
			y={PY + PR + 90}
			text="average {celsiusText(now.k)}"
			size={14}
			weight={700}
			color="var(--cst-temp)"
			tabular
		/>
	</Readout>
	<Readout id="state" order={4} label="Planet" value={stateText}>
		<Label x={PX} y={PY + PR + 114} text={stateText} size={12} weight={600} muted />
	</Readout>

	<!-- charts -->
	{#each frozenBands as b, i (i)}
		<rect
			x={sx(b.a / 1e6)}
			y={CO2_TOP}
			width={Math.max(0, sx(b.b / 1e6) - sx(b.a / 1e6))}
			height={T_BOT - CO2_TOP}
			fill="var(--cst-frozen)"
		/>
	{/each}
	<Axes
		{sx}
		sy={sc}
		yLabel="CO₂, µbar (ppm)"
		xTicks={[]}
		yTicks={co2Ticks.map(Math.log10)}
		yFormat={(v: number) => fmtPpm(Math.round(10 ** v))}
	/>
	<Axes
		{sx}
		sy={st}
		xLabel="million years"
		{xTicks}
		yLabel="°C"
		yTicks={tTicks}
		yFormat={(v: number) => (v < 0 ? `−${-v}` : `${v}`)}
	/>
	{#if exp !== 'pulse'}
		<line
			x1={X0}
			x2={X1}
			y1={st(0)}
			y2={st(0)}
			stroke="var(--cst-ice-edge)"
			stroke-dasharray="2 3"
		/>
	{/if}
	{#if balance}
		<line
			x1={X0}
			x2={X1}
			y1={sc(lg(balance.ppm))}
			y2={sc(lg(balance.ppm))}
			stroke="var(--cst-co2)"
			stroke-dasharray="6 4"
			opacity="0.6"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={st(clamp(toC(balance.k), tRange[0], tRange[1]))}
			y2={st(clamp(toC(balance.k), tRange[0], tRange[1]))}
			stroke="var(--cst-temp)"
			stroke-dasharray="6 4"
			opacity="0.6"
		/>
		<Readout
			id="bal"
			order={6}
			label="Open balance"
			value="{co2Text(balance.ppm)}, {celsiusText(balance.k)}"
		>
			<Label
				x={X0 + 8}
				y={sc(lg(balance.ppm)) - 8}
				text="balance {co2Text(balance.ppm)}"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<Readout
			id="nobal"
			order={6}
			label="Open balance"
			value="none: no open planet can match these volcanoes"
		>
			<Label x={X1} y={CO2_TOP + 14} text="no open balance exists" anchor="end" size={11} muted />
		</Readout>
	{/if}
	{#each co2Paths as d, i (i)}
		<path {d} fill="none" stroke="var(--cst-co2)" stroke-width="2.5" />
	{/each}
	{#each tPaths as d, i (i)}
		<path {d} fill="none" stroke="var(--cst-temp)" stroke-width="2.5" />
	{/each}
	<circle
		cx={sx(year / 1e6)}
		cy={sc(lg(now.ppm))}
		r="5"
		fill="var(--cst-co2)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<circle
		cx={sx(year / 1e6)}
		cy={st(clamp(toC(now.k), tRange[0], tRange[1]))}
		r="5"
		fill="var(--cst-temp)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	{#if frozenBands.length}
		<Readout id="frozen-key">
			<Label
				x={sx(frozenBands[0].a / 1e6) + 6}
				y={T_TOP + 14}
				text="frozen"
				anchor="start"
				size={11}
				color="var(--cst-ice-edge)"
				weight={600}
			/>
		</Readout>
	{/if}
</g>
