<script lang="ts">
	/**
	 * The timeline of deep time: a globe of the continents at the cursor's age (Merdith et al.
	 * 2021), and tracks along the time axis for the geological time scale (ICS 2024/12), the
	 * global temperature (PhanDA), the oxygen in the air (Mills et al. 2023, and the Precambrian
	 * bounds) and the major groups of life. The reader scrubs the cursor (the step's `time`
	 * control, or by dragging on the tracks) and, on some steps, zooms the window.
	 *
	 * Phases (`step.hints.phase`) choose what is in focus:
	 * - whole: the eons and eras; dating: a zircon crystal replaces the globe;
	 * - drift / before: the globe, with the map's quality under the timeline;
	 * - temperature, oxygen, life, extinctions: that track; zoom, sliver: everything.
	 *
	 * Moving parts: the globe rocks gently about the land's centre, and the cursor's head pulses.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import T from './T.svelte';
	import { cycle, hash, startDrag, toSvg } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		EARTH_AGE,
		EONS,
		ERAS,
		EXTINCTIONS,
		GLACIATIONS,
		LIFE,
		O2_TODAY,
		OXYGEN_START,
		PERIODS,
		PRECAMBRIAN_O2,
		STAGES,
		TEMPERATURE_START,
		ZOOMS,
		ageFromRatio,
		ageText,
		leadPerUranium,
		oxygenAt,
		placeIn,
		shareText,
		sunBrightness,
		temperatureAt,
		uraniumLeft,
		zoomSpan,
		type Unit
	} from '../deeptime';
	import {
		MAX_MA,
		equatorPath,
		graticulePath,
		landAt,
		landCentre,
		ringsPath,
		type View
	} from '../globe';
	import { O2 } from '../data/records';
	import { TW, X0, X1, ageAtX, axisTicks, inkOn, lifeColor, n0, xOf } from './ui';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	type Phase =
		| 'whole'
		| 'dating'
		| 'drift'
		| 'before'
		| 'temperature'
		| 'oxygen'
		| 'life'
		| 'extinctions'
		| 'zoom'
		| 'sliver';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'whole');
	const timeId = $derived(String(step.hints?.time ?? 'tWhole'));
	const zoomKey = $derived(String(step.hints?.zoom ?? 'all'));
	const zoomId = $derived(String(params[zoomKey] ?? zoomKey));
	const span = $derived(zoomSpan(zoomId));
	const zoomInfo = $derived(ZOOMS.find((z) => z.id === zoomId) ?? ZOOMS[0]);

	// the window, tweened in log space so that zooming glides
	const logSpan = new Tween(
		untrack(() => Math.log(span)),
		{
			duration: 800,
			easing: cubicInOut
		}
	);
	$effect(() => {
		const v = Math.log(span);
		untrack(() => logSpan.set(v, { duration: reduced ? 0 : 800 }));
	});
	const sp = $derived(Math.exp(logSpan.current));

	// ---- the cursor ------------------------------------------------------------------
	const control = $derived(step.controls?.find((c) => c.id === timeId));
	const rawValue = $derived(
		Number(params[timeId] ?? (control && control.type === 'range' ? control.default : 0))
	);
	// keep the control inside the window when the window shrinks
	$effect(() => {
		const lo = EARTH_AGE - span;
		const v = rawValue;
		const id = timeId;
		if (v < lo - 1e-9) untrack(() => setParam(id, lo));
	});
	const playing = $derived(phase === 'drift' && params.driftPlay === true);
	const age = $derived.by(() => {
		if (playing) {
			const u = Math.min(1, (t % 54) / 50);
			return MAX_MA * (1 - u);
		}
		return Math.max(0, Math.min(span, EARTH_AGE - rawValue));
	});
	const cx = $derived(xOf(age, sp));

	function ondown(e: PointerEvent) {
		if (playing) return;
		const svg = (e.currentTarget as Element).closest('svg');
		if (!svg) return;
		const set = (x: number) => {
			const a = Math.max(0, Math.min(span, ageAtX(Math.max(X0, Math.min(X1, x)), span)));
			setParam(timeId, EARTH_AGE - a);
		};
		set(toSvg(e, svg).x);
		startDrag(e, (p) => set(p.x));
	}

	// ---- focus -----------------------------------------------------------------------
	const fade = (on: () => number) => {
		const tw = new Tween(on(), { duration: 700, easing: cubicInOut });
		$effect(() => {
			const v = on();
			untrack(() => tw.set(v, { duration: reduced ? 0 : 700 }));
		});
		return tw;
	};
	const DIM = 0.4;
	const all = $derived(phase === 'zoom' || phase === 'sliver');
	const fScale = fade(() => (phase === 'whole' || phase === 'dating' || all ? 1 : 0.7));
	const fTemp = fade(() => (phase === 'temperature' || phase === 'extinctions' || all ? 1 : DIM));
	const fO2 = fade(() => (phase === 'oxygen' || all ? 1 : DIM));
	const fLife = fade(() => (phase === 'life' || phase === 'extinctions' || all ? 1 : DIM));
	const fExt = fade(() => (phase === 'extinctions' ? 1 : 0));
	const fCover = fade(() => (phase === 'before' || phase === 'drift' ? 1 : 0));
	const fZircon = fade(() => (phase === 'dating' ? 1 : 0));

	// ---- geometry of the tracks ------------------------------------------------------
	const EON_Y = 40;
	const ERA_Y = 60;
	const COVER_Y = 76;
	const TEMP = { y: 102, h: 98, lo: 8, hi: 40 };
	const O2T = { y: 222, h: 84 };
	const LIFE_Y = 326;
	const ROW = 19;
	const AXIS_Y = LIFE_Y + LIFE.length * ROW + 6;

	const tY = (c: number) => TEMP.y + TEMP.h - ((c - TEMP.lo) / (TEMP.hi - TEMP.lo)) * TEMP.h;
	const L_HI = Math.log10(2);
	const L_LO = -6;
	const oY = (pal: number) =>
		O2T.y + ((L_HI - Math.log10(Math.max(pal, 1e-7))) / (L_HI - L_LO)) * O2T.h;
	const clampX = (x: number) => Math.max(X0, Math.min(X1, x));

	const units = (list: Unit[]) =>
		list
			.map((u) => {
				const xa = clampX(xOf(u.base, sp));
				const xb = clampX(xOf(u.top, sp));
				return { u, x: xa, w: xb - xa };
			})
			.filter((b) => b.w > 0.2);
	const eonBars = $derived(units(EONS));
	const lowerBars = $derived(sp <= 1100 ? units(PERIODS) : units(ERAS));
	const labelFits = (text: string, w: number, size: number) => text.length * size * 0.56 + 8 < w;

	// temperature: steps per stage
	const tempPaths = $derived.by(() => {
		let band90 = '';
		let band68 = '';
		let mid = '';
		for (const s of STAGES) {
			const xa = xOf(s.base, sp);
			const xb = xOf(s.top, sp);
			if (xb < X0 || xa > X1) continue;
			const a = clampX(xa).toFixed(1);
			const b = clampX(xb).toFixed(1);
			band90 += `M${a} ${tY(s.p95).toFixed(1)}H${b}V${tY(s.p05).toFixed(1)}H${a}Z`;
			band68 += `M${a} ${tY(s.p84).toFixed(1)}H${b}V${tY(s.p16).toFixed(1)}H${a}Z`;
			mid += `${mid ? 'L' : 'M'}${a} ${tY(s.p50).toFixed(1)}H${b}`;
		}
		return { band90, band68, mid };
	});
	const tempStartX = $derived(xOf(TEMPERATURE_START, sp));
	const iceBars = $derived(
		GLACIATIONS.map((g) => ({
			g,
			x: clampX(xOf(g.base, sp)),
			w: clampX(xOf(g.top, sp)) - clampX(xOf(g.base, sp))
		})).filter((b) => b.w > 0)
	);

	// oxygen: the Phanerozoic curve, and the Precambrian bounds
	const o2Paths = $derived.by(() => {
		let upper = '';
		let lower = '';
		let mid = '';
		const pts = O2.filter(([a]) => a <= sp * 1.01 + 1);
		pts.forEach(([a, m, lo, hi], i) => {
			const x = clampX(xOf(a, sp)).toFixed(1);
			upper += `${i ? 'L' : 'M'}${x} ${oY(hi / O2_TODAY).toFixed(1)}`;
			lower = `L${x} ${oY(lo / O2_TODAY).toFixed(1)}` + lower;
			mid += `${i ? 'L' : 'M'}${x} ${oY(m / O2_TODAY).toFixed(1)}`;
		});
		return { band: upper ? upper + lower + 'Z' : '', mid };
	});
	const o2Boxes = $derived(
		PRECAMBRIAN_O2.map((b) => {
			const xa = clampX(xOf(b.base, sp));
			const xb = clampX(xOf(b.top, sp));
			const lo = 'lo' in b ? b.lo : undefined;
			const hi = 'hi' in b ? b.hi : undefined;
			return {
				id: b.id,
				x: xa,
				w: xb - xa,
				yTop: hi ? oY(hi) : O2T.y,
				yBot: lo ? oY(lo) : O2T.y + O2T.h,
				lo,
				hi
			};
		}).filter((b) => b.w > 0.5)
	);
	const PAL_LINES = [
		{ v: 1, text: 'today' },
		{ v: 0.1, text: '10%' },
		{ v: 1e-3, text: '0.1%' },
		{ v: 1e-5, text: '0.001%' }
	];

	// life: one row per group
	const lifeRows = $derived(
		LIFE.map((g, i) => {
			const xa = xOf(g.from, sp);
			const xb = xOf(g.to ?? 0, sp);
			const y = LIFE_Y + i * ROW + ROW / 2;
			const visible = xb >= X0 - 0.5;
			const a = clampX(xa);
			const w = Math.max(1.6, clampX(xb) - a);
			const alive = age <= g.from && age >= (g.to ?? 0);
			// the name to the left of the bar's start if it fits there, else inside the bar
			const left = a - 8 - X0 > g.name.length * 6.0 || g.id === 'sapiens';
			return { g, y, a, w, visible, alive, left };
		})
	);

	const extLines = $derived(
		EXTINCTIONS.map((e, i) => ({ e, x: xOf(e.age, sp), i })).filter((l) => l.x >= X0 && l.x <= X1)
	);

	const axis = $derived(axisTicks(sp));

	// ---- the globe -------------------------------------------------------------------
	const G = { cx: 188, cy: 194, r: 146 };
	const land = $derived(landAt(age));
	const centre = $derived(landCentre(land));
	const rock = $derived(reduced ? 0 : 28 * Math.sin((2 * Math.PI * t) / 36));
	const view: View = $derived({
		lon: centre[0] + rock,
		lat: Math.max(-40, Math.min(40, centre[1] * 0.7)),
		cx: G.cx,
		cy: G.cy,
		r: G.r
	});
	const solidLand = $derived(
		ringsPath(
			land.filter((r) => r.opacity >= 0.99).map((r) => r.pts),
			view
		)
	);
	const fadingLand = $derived(
		land
			.filter((r) => r.opacity < 0.99)
			.map((r) => ({ id: r.id, o: r.opacity, d: ringsPath([r.pts], view) }))
	);
	const grat = $derived(graticulePath(view));
	const equator = $derived(equatorPath(view));
	/** How well the map is known: from the ocean floor, from the continents alone, or not at all. */
	const quality = $derived(age <= 180 ? 'good' : age <= MAX_MA ? 'fair' : 'none');
	const QUALITY_TEXT = {
		good: 'well known: the ocean floor records it',
		fair: 'latitudes from rock magnetism; longitudes guessed',
		none: 'no reliable map this far back'
	};
	const unknownFog = $derived(age > MAX_MA ? 1 : 0);

	// ---- the zircon ------------------------------------------------------------------
	const ATOMS = Array.from({ length: 100 }, (_, i) => ({
		i,
		x: G.cx - 81 + (i % 10) * 18,
		y: G.cy - 81 + Math.floor(i / 10) * 18,
		rank: hash(i, 7)
	}));
	const rankOrder = [...ATOMS].sort((a, b) => a.rank - b.rank).map((a) => a.i);
	const decayedSet = $derived.by(() => {
		const nLead = Math.round(100 * (1 - uraniumLeft(age)));
		return new Set(rankOrder.slice(0, nLead));
	});
	const uLeft = $derived(uraniumLeft(age));
	const ratio = $derived(leadPerUranium(age));

	// ---- readouts --------------------------------------------------------------------
	const place = $derived(placeIn(age));
	const placeText = $derived.by(() => {
		if (age <= 0) return 'Quaternary period · Cenozoic era';
		const p = place;
		if (p.period) return `${p.period.name} period · ${p.era?.name} era`;
		if (p.era) return `${p.era.name} era · ${p.eon?.name} eon`;
		return `${p.eon?.name ?? 'Hadean'} eon`;
	});
	const temp = $derived(temperatureAt(age));
	const tempText = $derived(
		temp ? `${temp.p50.toFixed(1)} °C (${temp.p05.toFixed(0)}–${temp.p95.toFixed(0)})` : 'no record'
	);
	const o2 = $derived(oxygenAt(age));
	const o2Bound = $derived(
		PRECAMBRIAN_O2.find((b) => age >= b.top && age < b.base && b.id !== 'oxic') ??
			PRECAMBRIAN_O2.find((b) => age >= b.top && age < b.base)
	);
	const o2Text = $derived(
		o2 ? `${o2.mid.toFixed(0)}% of the air` : age > OXYGEN_START ? (o2Bound?.text ?? '—') : '—'
	);
	const living = $derived(LIFE.filter((g) => age <= g.from && age >= (g.to ?? 0)));
	const newest = $derived(living.at(-1));
	const nextExt = $derived(
		[...EXTINCTIONS].sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age))[0]
	);
	const pulse = $derived(reduced ? 0.5 : cycle(t, 2.4));
	const headY = 30;
	const CARD = { x: 24, y: 360, w: 330, h: 186 };
</script>

<g class="time-scene">
	<defs>
		<clipPath id="time-scene-clip">
			<rect x={X0} y={EON_Y - 4} width={TW} height={AXIS_Y - EON_Y + 4} />
		</clipPath>
		<clipPath id="time-scene-globe">
			<circle cx={G.cx} cy={G.cy} r={G.r} />
		</clipPath>
		<pattern
			id="time-scene-hatch"
			width="6"
			height="6"
			patternUnits="userSpaceOnUse"
			patternTransform="rotate(45)"
		>
			<path d="M0 0 V6" stroke="var(--dt-o2)" stroke-width="1.4" opacity="0.55" />
		</pattern>
	</defs>

	<!-- ================= globe / zircon ================= -->
	<g opacity={1 - fZircon.current}>
		<circle
			cx={G.cx}
			cy={G.cy}
			r={G.r}
			fill="var(--dt-sea)"
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
		<g clip-path="url(#time-scene-globe)">
			<path d={grat} fill="none" stroke="var(--stage-grid)" stroke-width="0.8" />
			<g opacity={1 - unknownFog}>
				<!-- the ring edges include the borders between the model's blocks: keep them faint -->
				<path
					d={solidLand}
					fill="var(--dt-land)"
					fill-opacity={quality === 'fair' ? 0.75 : 1}
					stroke="var(--dt-land-edge)"
					stroke-width="0.6"
					stroke-opacity="0.45"
					stroke-linejoin="round"
				/>
				{#each fadingLand as r (r.id)}
					<path
						d={r.d}
						fill="var(--dt-land)"
						fill-opacity={r.o * 0.75}
						stroke="var(--dt-land-edge)"
						stroke-opacity={r.o * 0.45}
						stroke-width="0.6"
					/>
				{/each}
			</g>
			<path
				d={equator}
				fill="none"
				stroke="var(--dt-equator)"
				stroke-width="1.8"
				opacity={0.9 * (1 - unknownFog)}
			/>
			<circle cx={G.cx} cy={G.cy} r={G.r} fill="var(--dt-fog)" opacity={unknownFog * 0.85} />
		</g>
		{#if unknownFog}
			<text
				x={G.cx}
				y={G.cy + 22}
				text-anchor="middle"
				style:font-size="64px"
				font-weight="700"
				class="muted">?</text
			>
			<T x={G.cx} y={G.cy + 56} text="positions unknown" size={13} weight={600} />
		{/if}
		<Readout
			id="map"
			order={5}
			label="The map"
			value={QUALITY_TEXT[quality]}
			opacity={phase === 'drift' || phase === 'before' || phase === 'sliver' ? 1 : 0}
		>
			<T
				x={G.cx}
				y={G.cy + G.r + 18}
				text="Map: {QUALITY_TEXT[quality]}"
				size={11}
				muted
				opacity={phase === 'dating' ? 0 : 1}
			/>
		</Readout>
	</g>

	<g opacity={fZircon.current}>
		{#if fZircon.current > 0.01}
			<path
				d="M{G.cx - 64} {G.cy - 112} L{G.cx} {G.cy - 146} L{G.cx + 64} {G.cy - 112} L{G.cx +
					108} {G.cy - 60} L{G.cx + 108} {G.cy + 60} L{G.cx + 64} {G.cy + 112} L{G.cx} {G.cy +
					146} L{G.cx - 64} {G.cy + 112} L{G.cx - 108} {G.cy + 60} L{G.cx - 108} {G.cy - 60} Z"
				fill="var(--surface)"
				stroke="var(--border)"
				stroke-width="1.4"
			/>
			{#each ATOMS as a (a.i)}
				{@const lead = decayedSet.has(a.i)}
				<circle
					cx={a.x}
					cy={a.y}
					r="6.5"
					fill={lead ? 'var(--dt-lead)' : 'var(--dt-uranium)'}
					stroke="var(--stage-bg)"
					stroke-width="1"
				/>
			{/each}
			<Readout
				id="zircon-key"
				order={1}
				label="A zircon crystal: 100 atoms that started as uranium"
			>
				<circle cx={G.cx - 120} cy={G.cy + 168} r="6" fill="var(--dt-uranium)" />
				<text x={G.cx - 110} y={G.cy + 172} style:font-size="12px">uranium-238</text>
				<circle cx={G.cx + 10} cy={G.cy + 168} r="6" fill="var(--dt-lead)" />
				<text x={G.cx + 20} y={G.cy + 172} style:font-size="12px">lead-206</text>
			</Readout>
		{/if}
	</g>

	<!-- ================= the card under the globe ================= -->
	<rect
		x={CARD.x}
		y={CARD.y + 18}
		width={CARD.w}
		height={CARD.h - 18}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="age" order={0} label="When" value={ageText(age)}>
		<text x={CARD.x + 16} y={CARD.y + 46} style:font-size="18px" font-weight="700"
			>{ageText(age)}</text
		>
	</Readout>
	<Readout id="unit" order={1} label="Time scale" value={placeText}>
		<text x={CARD.x + 16} y={CARD.y + 66} style:font-size="12px" class="muted">{placeText}</text>
	</Readout>
	<g transform="translate({CARD.x + 16} {CARD.y + 94})" style:font-size="13px">
		{#if phase === 'dating'}
			<Readout id="u" order={2} label="Uranium-238 left" value="{(uLeft * 100).toFixed(0)}%">
				<text y="0"
					>Uranium-238 left: <tspan font-weight="700">{(uLeft * 100).toFixed(1)}%</tspan></text
				>
			</Readout>
			<Readout id="ratio" order={3} label="Lead atoms per uranium atom" value={ratio.toFixed(2)}>
				<text y="22"
					>Lead per uranium atom: <tspan font-weight="700">{ratio.toFixed(2)}</tspan></text
				>
			</Readout>
			<Readout
				id="readback"
				order={4}
				label="Age read from the ratio"
				value="{n0(ageFromRatio(ratio))} million years"
			>
				<text y="44"
					>Age from the ratio: <tspan font-weight="700"
						>{n0(ageFromRatio(ratio))} million years</tspan
					></text
				>
			</Readout>
			<Readout id="halflife">
				<text y="70" style:font-size="11px" class="muted"
					>half-life of uranium-238: 4,468 million years</text
				>
			</Readout>
		{:else if phase === 'temperature'}
			<Readout
				id="temp"
				order={2}
				label="Global temperature"
				value={tempText}
				color="var(--dt-temp)"
			>
				<text y="0">Global temperature: <tspan font-weight="700">{tempText}</tspan></text>
			</Readout>
			<Readout
				id="sun"
				order={3}
				label="Sunlight"
				value="{Math.round(sunBrightness(age) * 100)}% of today’s"
			>
				<text y="22"
					>The Sun: <tspan font-weight="700">{Math.round(sunBrightness(age) * 100)}%</tspan> as bright
					as today</text
				>
			</Readout>
			{#if temp}
				<Readout id="stage">
					<text y="48" style:font-size="11px" class="muted">PhanDA stage: {temp.stage}</text>
				</Readout>
			{/if}
		{:else if phase === 'oxygen'}
			<Readout id="o2" order={2} label="Oxygen in the air" value={o2Text} color="var(--dt-o2)">
				<text y="0">Oxygen: <tspan font-weight="700">{o2 ? o2Text : ''}</tspan></text>
				{#if !o2}
					<text y="20" style:font-size="12px" font-weight="600">{o2Text}</text>
				{/if}
			</Readout>
			{#if o2}
				<Readout id="o2range">
					<text y="22" style:font-size="11px" class="muted"
						>range of estimates {o2.min.toFixed(0)}–{o2.max.toFixed(0)}% (today 21%)</text
					>
				</Readout>
			{/if}
		{:else if phase === 'life' || phase === 'extinctions'}
			<Readout
				id="living"
				order={2}
				label="Groups alive then"
				value={living.length ? `${living.length} of ${LIFE.length}` : 'none yet'}
			>
				<text y="0"
					>Groups alive: <tspan font-weight="700"
						>{living.length ? `${living.length} of ${LIFE.length}` : 'none yet'}</tspan
					></text
				>
			</Readout>
			{#if newest}
				<Readout id="newest" order={3} label="Newest group" value={newest.name}>
					<text y="22">Newest: <tspan font-weight="700">{newest.name}</tspan></text>
					<text y="40" style:font-size="11px" class="muted">{newest.evidence}</text>
				</Readout>
			{/if}
			{#if phase === 'extinctions'}
				<Readout
					id="ext"
					order={4}
					label="Nearest mass extinction"
					value="{nextExt.name}, {ageText(nextExt.age)}"
				>
					<text y="64" style:font-size="12px"
						>Nearest extinction: <tspan font-weight="600">{nextExt.name}</tspan></text
					>
				</Readout>
			{/if}
		{:else if phase === 'zoom' || phase === 'sliver'}
			<Readout
				id="window"
				order={2}
				label="The window"
				value="{zoomInfo.label}: {shareText(span)} of Earth’s history"
			>
				<text y="0"
					>Window: <tspan font-weight="700">{shareText(span)}</tspan> of Earth’s history</text
				>
			</Readout>
			<Readout id="temp2" order={3} label="Temperature" value={tempText}>
				<text y="22">Temperature: <tspan font-weight="600">{tempText}</tspan></text>
			</Readout>
			<Readout id="o22" order={4} label="Oxygen" value={o2Text}>
				<text y="44">Oxygen: <tspan font-weight="600">{o2 ? o2Text : 'see the track'}</tspan></text>
			</Readout>
		{:else}
			<Readout
				id="since"
				order={2}
				label="Share of Earth’s history since then"
				value={shareText(age)}
			>
				<text y="0"
					>Share of the history since then: <tspan font-weight="700">{shareText(age)}</tspan></text
				>
			</Readout>
			{#if phase === 'drift' || phase === 'before'}
				<Readout id="equator">
					<text y="22" style:font-size="11px" class="muted"
						>white line: the equator at the time</text
					>
				</Readout>
			{/if}
		{/if}
	</g>

	<!-- ================= the tracks ================= -->
	<Readout id="window-title">
		<text x={X0} y={headY - 6} style:font-size="14px" font-weight="600"
			>{zoomInfo.label} · {ageText(span).replace(' ago', '')}</text
		>
	</Readout>
	<g clip-path="url(#time-scene-clip)">
		<!-- eons and eras / periods -->
		<g opacity={fScale.current * (dark ? 0.85 : 1)}>
			{#each eonBars as b (b.u.name)}
				<rect x={b.x} y={EON_Y} width={b.w} height="17" fill={b.u.color} />
				{#if labelFits(b.u.name, b.w, 11)}
					<text
						x={b.x + b.w / 2}
						y={EON_Y + 12.5}
						text-anchor="middle"
						style:font-size="11px"
						font-weight="600"
						style:fill={inkOn(b.u.color)}>{b.u.name}</text
					>
				{/if}
			{/each}
			{#each lowerBars as b (b.u.name)}
				<rect x={b.x} y={ERA_Y} width={b.w} height="13" fill={b.u.color} opacity="0.9" />
				{#if labelFits(b.u.name, b.w, 9.5)}
					<text
						x={b.x + b.w / 2}
						y={ERA_Y + 9.8}
						text-anchor="middle"
						style:font-size="9.5px"
						style:fill={inkOn(b.u.color)}>{b.u.name}</text
					>
				{/if}
			{/each}
		</g>
		<!-- how well the map is known -->
		<g opacity={fCover.current}>
			{#each [['good', 0, 180], ['fair', 180, MAX_MA], ['none', MAX_MA, EARTH_AGE]] as [q, a, b] (q)}
				{@const xa = clampX(xOf(Number(b), sp))}
				{@const xb = clampX(xOf(Number(a), sp))}
				<rect x={xa} y={COVER_Y} width={Math.max(0, xb - xa)} height="6" fill="var(--dt-{q})" />
			{/each}
		</g>

		<!-- temperature -->
		<g opacity={fTemp.current}>
			<path d={tempPaths.band90} fill="var(--dt-temp-band)" opacity="0.3" />
			<path d={tempPaths.band68} fill="var(--dt-temp-band)" opacity="0.45" />
			<path d={tempPaths.mid} fill="none" stroke="var(--dt-temp)" stroke-width="1.8" />
			{#each iceBars as b (b.g.id)}
				<rect
					x={b.x}
					y={TEMP.y + TEMP.h - 14}
					width={Math.max(1.5, b.w)}
					height="10"
					rx="2"
					fill="var(--dt-ice)"
				/>
			{/each}
			{#if iceBars.length && labelFits('ice', iceBars[0].w + 40, 10.5)}
				<T
					x={iceBars[0].x + iceBars[0].w / 2}
					y={TEMP.y + TEMP.h - 18}
					text={sp > 2000 ? 'ice ages' : 'Snowball Earth'}
					size={10.5}
					color="var(--dt-ice)"
				/>
			{/if}
			{#if tempStartX - X0 > 170}
				<text
					x={(X0 + tempStartX) / 2}
					y={TEMP.y + TEMP.h / 2 + 4}
					text-anchor="middle"
					style:font-size="11px"
					class="muted">no global temperature record</text
				>
			{/if}
		</g>
		<!-- oxygen -->
		<g opacity={fO2.current}>
			{#each PAL_LINES as l (l.v)}
				<path
					d="M{X0} {oY(l.v).toFixed(1)}H{X1}"
					stroke="var(--stage-grid)"
					stroke-width="0.8"
					stroke-dasharray={l.v === 1 ? undefined : '2 3'}
				/>
			{/each}
			{#each o2Boxes as b (b.id)}
				{#if b.id === 'anoxic'}
					<rect
						x={b.x}
						y={b.yTop}
						width={b.w}
						height={b.yBot - b.yTop}
						fill="url(#time-scene-hatch)"
					/>
					<path d="M{b.x} {b.yTop}H{b.x + b.w}" stroke="var(--dt-o2)" stroke-width="1.6" />
				{:else if b.id === 'goe'}
					<rect
						x={b.x}
						y={O2T.y}
						width={b.w}
						height={O2T.h}
						fill="var(--dt-o2-band)"
						opacity="0.25"
					/>
				{:else if b.id === 'boring'}
					<rect
						x={b.x}
						y={b.yTop}
						width={b.w}
						height={b.yBot - b.yTop}
						fill="var(--dt-o2-band)"
						fill-opacity="0.3"
						stroke="var(--dt-o2)"
						stroke-dasharray="4 3"
					/>
				{:else}
					<path d="M{b.x} {b.yBot}H{b.x + b.w}" stroke="var(--dt-o2)" stroke-width="1.6" />
					{#each Array.from({ length: Math.floor(b.w / 34) }, (_, k) => k) as k (k)}
						{@const ax = b.x + 17 + k * 34}
						<path
							d="M{ax} {b.yBot} v-12 m-3.5 4 l3.5 -4 l3.5 4"
							fill="none"
							stroke="var(--dt-o2)"
							stroke-width="1.2"
						/>
					{/each}
				{/if}
			{/each}
			{#each o2Boxes as b (b.id)}
				{@const text =
					b.id === 'anoxic'
						? 'almost none'
						: b.id === 'goe'
							? 'oxygen rises'
							: b.id === 'boring'
								? 'disputed'
								: ''}
				{#if text && labelFits(text, b.w, 10.5)}
					<T
						x={b.x + b.w / 2}
						y={b.id === 'anoxic' ? b.yTop - 6 : b.id === 'goe' ? O2T.y + 12 : b.yTop - 5}
						{text}
						size={10.5}
						color="var(--dt-o2)"
					/>
				{/if}
			{/each}
			<path d={o2Paths.band} fill="var(--dt-o2-band)" opacity="0.4" />
			<path d={o2Paths.mid} fill="none" stroke="var(--dt-o2)" stroke-width="1.8" />
		</g>

		<!-- life -->
		<g opacity={fLife.current}>
			{#each lifeRows as r (r.g.id)}
				{#if r.visible}
					<rect
						x={r.a}
						y={r.y - 4}
						width={r.w}
						height="8"
						rx="2"
						fill={lifeColor(r.g)}
						opacity={r.alive ? 0.95 : 0.55}
					/>
					<T
						x={r.left ? r.a - 8 : Math.min(r.a + 6, X1 - 4)}
						y={r.y + 4}
						text={r.g.id === 'sapiens' && sp > 1000
							? `${r.g.name}: ${((TW * r.g.from) / sp).toFixed(2)} px of this bar`
							: r.g.name}
						size={11}
						weight={r.alive ? 600 : 500}
						anchor={r.left ? 'end' : 'start'}
					/>
				{/if}
			{/each}
		</g>

		<!-- mass extinctions -->
		<g opacity={fExt.current}>
			{#each extLines as l (l.e.id)}
				<path
					d="M{l.x} {TEMP.y} V{AXIS_Y}"
					stroke="var(--dt-extinct)"
					stroke-width="1.4"
					stroke-dasharray="4 3"
				/>
				<T
					x={l.x}
					y={TEMP.y - (l.i % 2 ? -10 : 2) + 12}
					text={l.e.name.replace(', the “Great Dying”', '')}
					size={10.5}
					weight={600}
					color="var(--dt-extinct)"
				/>
			{/each}
		</g>

		<!-- the cursor -->
		<path d="M{cx} {EON_Y - 4} V{AXIS_Y}" stroke="var(--dt-cursor)" stroke-width="2" />
		<circle
			{cx}
			cy={AXIS_Y}
			r={5 + pulse * 7}
			fill="none"
			stroke="var(--dt-cursor)"
			stroke-width="1.5"
			opacity={1 - pulse}
		/>
		<circle {cx} cy={AXIS_Y} r="5" fill="var(--dt-cursor)" />
	</g>

	<!-- track titles and scales (outside the clip) -->
	<g style:font-size="11px">
		<g opacity={Math.max(0.6, fTemp.current)}>
			<Readout id="temp-title">
				<text x={X0} y={TEMP.y - 4} font-weight="600" style:fill="var(--dt-temp)"
					>Temperature, °C</text
				>
			</Readout>
			{#each [10, 20, 30] as c (c)}
				<text x={X1 + 4} y={tY(c) + 4} class="muted" style:font-size="9.5px">{c}</text>
			{/each}
		</g>
		<g opacity={Math.max(0.6, fO2.current)}>
			<Readout id="o2-title">
				<text x={X0} y={O2T.y - 4} font-weight="600" style:fill="var(--dt-o2)"
					>Oxygen, share of today’s level</text
				>
			</Readout>
			{#each PAL_LINES as l (l.v)}
				<text x={X1 + 4} y={oY(l.v) + 3.5} class="muted" style:font-size="9.5px">{l.text}</text>
			{/each}
		</g>
		<Readout id="life-title">
			<text x={X0} y={LIFE_Y - 6} font-weight="600" opacity={Math.max(0.6, fLife.current)}
				>Life: from the oldest fossils</text
			>
		</Readout>
	</g>

	<!-- axis -->
	<g>
		<path d="M{X0} {AXIS_Y}H{X1}" stroke="var(--stage-line)" stroke-width="1" />
		{#each axis.ticks as k (k.age)}
			{@const x = xOf(k.age, sp)}
			{#if x >= X0 - 0.5 && x < X1 - 30}
				<path d="M{x} {AXIS_Y}v5" stroke="var(--stage-line)" />
				<text {x} y={AXIS_Y + 18} text-anchor="middle" style:font-size="10.5px" class="muted"
					>{k.text}</text
				>
			{/if}
		{/each}
		<text x={X1} y={AXIS_Y + 18} text-anchor="end" style:font-size="10.5px" font-weight="600"
			>today</text
		>
		<Readout id="axis-unit">
			<text x={X0} y={AXIS_Y + 34} style:font-size="10.5px" class="muted">{axis.unit}</text>
		</Readout>
	</g>

	<!-- drag surface -->
	<rect
		class="scrub"
		x={X0}
		y={EON_Y - 6}
		width={TW}
		height={AXIS_Y - EON_Y + 14}
		fill="transparent"
		role="presentation"
		onpointerdown={ondown}
	/>

	<Readout id="sources">
		<text x="944" y="592" style:font-size="9.5px" text-anchor="end" class="muted"
			>ICS chart 2024/12 · Merdith et al. 2021 · PhanDA (Judd et al. 2024) · Mills et al. 2023</text
		>
	</Readout>
</g>

<style>
	.scrub {
		cursor: ew-resize;
		touch-action: pan-y;
	}
	.muted {
		fill: var(--stage-ink-muted);
	}
</style>
