<script lang="ts">
	/**
	 * A star's life, run from its MIST track: the HR diagram (left), a cutaway of what is
	 * fusing where (right) and the real timeline (bottom).
	 *
	 * Hints: `mass` (initial mass; on the free step, the `mass` control instead), `from` and
	 * `to` (stage keys of `STAGE`, or `end`): the part of the life this step runs. The run
	 * moves through the track's rows at an even pace — so by stage, not by year — in RUN
	 * seconds, then holds the last frame; "Run again" and a change of mass start it over.
	 * Under reduced motion the frame shows the end of the step's part.
	 *
	 * The cutaway is drawn by mass: each layer's area is its share of the star's present mass
	 * (envelope with hydrogen, helium layer, carbon–oxygen core), from the model's helium- and
	 * carbon-core masses; on the main sequence the burning core is drawn at a fixed tenth of the
	 * mass, its colour turning from hydrogen to helium as the centre's hydrogen runs out. A glow
	 * marks each burning region, with a strength that follows that fuel's share of the
	 * luminosity.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, easeInOut, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import HrPlot from './HrPlot.svelte';
	import Txt from './Txt.svelte';
	import SkyLabel from './SkyLabel.svelte';
	import { LOG_T, hrScales, type Box } from './hr';
	import {
		AU_IN_RSUN,
		FUEL_PRODUCTS,
		STAGE,
		UNIVERSE_AGE,
		at,
		burning,
		fate,
		lastIndex,
		round2,
		stageName,
		starColour,
		track,
		years,
		type Track
	} from '../star';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- which star, which part of its life ---------------------------------------------------
	const free = $derived(Boolean(step.hints?.free));
	const mass = $derived(free ? Number(params.mass ?? 1) : Number(step.hints?.mass ?? 1));
	const tr: Track = $derived(track(mass));
	const n = $derived(lastIndex(tr));
	// A star that has not left the main sequence by the end of its track (0.5 M☉) stops just
	// before the track's last row, where the model's hydrogen has run out.
	const last = $derived(fate(mass).kind === 'not-yet' ? n - 1 : n);
	const stageIndex = (key: string) =>
		key === 'end' ? last : Math.min(last, (STAGE as Record<string, number>)[key] ?? 0);
	const from = $derived(stageIndex(String(step.hints?.from ?? 'zams')));
	const to = $derived(stageIndex(String(step.hints?.to ?? 'end')));
	const RUN = $derived(free ? 26 : 16);
	const LEAD = 0.6;

	// Time since the run started: restarts on a new step, mass or press of "Run again".
	const runs = $derived(Number(params.run ?? 0));
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${step.id}|${mass}|${runs}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return Math.max(0, t - memo.start);
	});
	const u = $derived(reduced ? 1 : clamp((since - LEAD) / RUN));
	const index = $derived(lerp(from, to, easeInOut(u) * 0.15 + u * 0.85));
	const now = $derived(at(tr, index));
	const burn = $derived(burning(now));
	const done = $derived(u >= 1);

	// ---- HR diagram -------------------------------------------------------------------------
	const BOX: Box = { x: 62, y: 28, w: 456, h: 404 };
	const { sx, sy } = hrScales(BOX);
	const hot = (lt: number) => Math.min(lt, LOG_T[0]);
	const travelled = $derived.by(() => {
		let d = '';
		const last = Math.floor(index);
		for (let i = 0; i <= last; i++)
			d += `${i ? 'L' : 'M'}${sx(tr.logT[i]).toFixed(1)} ${sy(tr.logL[i]).toFixed(1)}`;
		d += `L${sx(now.logT).toFixed(1)} ${sy(now.logL).toFixed(1)}`;
		return d;
	});
	const dotX = $derived(sx(hot(now.logT)));
	const dotY = $derived(sy(now.logL));
	const offChart = $derived(now.logT > LOG_T[0]);

	// ---- cutaway (drawn by mass) -------------------------------------------------------------
	const CX = 690;
	const CY = 196;
	const RC = 118;
	const rOf = (m: number) => RC * Math.sqrt(clamp(m / Math.max(now.M, 1e-6)));
	const onMS = $derived(now.phase === 0 && now.heCore < 1e-3);
	const rHe = $derived(onMS ? 0 : rOf(now.heCore));
	const rCO = $derived(rOf(now.cCore));
	const MS_CORE = RC * Math.sqrt(0.1);
	const heShare = $derived(clamp(1 - now.xH / 0.715));
	const coreLabel = $derived(now.xNe > 0.1 ? 'oxygen, neon, magnesium' : 'carbon, oxygen');
	const strength = (lx: number) => smoothstep(-2, -0.7, lx - now.logL);
	const glowH = $derived(burn.core === 'H' ? 1 : 0);
	const hShell = $derived(now.heCore > 1e-3 && now.xH < 1e-3 ? strength(now.logLH) : 0);
	const heShell = $derived(now.cCore > 1e-3 && now.xHe < 1e-3 ? strength(now.logLHe) : 0);
	const coreBurn = $derived(burn.core);
	const coreR = $derived(
		coreBurn === 'H'
			? MS_CORE
			: coreBurn === 'He'
				? Math.max(10, rHe * 0.6)
				: Math.max(8, rCO * 0.6)
	);
	const surface = $derived(starColour(now.T));
	const remnantStage = $derived(now.phase === 6 && now.R < 1);

	// ---- the timeline ------------------------------------------------------------------------
	const TL = { x: 62, y: 520, w: 876 };
	const span = $derived.by(() => {
		const a0 = tr.age[0];
		const a1 = Math.max(tr.age[n], fate(mass).kind === 'not-yet' ? UNIVERSE_AGE : 0);
		return { a0, a1 };
	});
	const tx = $derived(scale([span.a0, span.a1], [TL.x, TL.x + TL.w]));
	interface Segment {
		key: string;
		name: string;
		i0: number;
		i1: number;
		colour: string;
	}
	const segments = $derived.by((): Segment[] => {
		const end = n;
		const s = (key: string, name: string, i0: number, i1: number, colour: string) =>
			i1 > i0 ? [{ key, name, i0: Math.min(i0, end), i1: Math.min(i1, end), colour }] : [];
		const massive = mass >= 8;
		return [
			...s('ms', 'main sequence', 0, Math.min(STAGE.tams, end), 'var(--st-h)'),
			...s('giant', massive ? 'supergiant' : 'red giant', STAGE.tams, STAGE.rgbTip, 'var(--st-o)'),
			...s('he', 'helium burning', STAGE.rgbTip, STAGE.tachb, 'var(--st-he)'),
			...s(
				'late',
				massive ? 'carbon' : 'last giant stage',
				STAGE.tachb,
				massive ? end : STAGE.postAgb,
				'var(--st-co)'
			),
			...(massive ? [] : s('wd', 'white dwarf', STAGE.postAgb, end, 'var(--st-wd)'))
		].filter((g) => g.i1 > g.i0);
	});
	const mark = $derived(tx(now.age));
	const late = $derived(segments.filter((g) => g.key !== 'ms'));
	const ageText = $derived(years(now.age - tr.age[0]));

	// ---- the end -----------------------------------------------------------------------------
	const ending = $derived(fate(mass));
	const endText = $derived.by(() => {
		const f = ending;
		if (f.kind === 'not-yet')
			return `still on the main sequence after ${years(tr.age[n] - tr.age[0])}`;
		if (f.kind === 'white-dwarf') return `ends as a white dwarf of ${f.remnant!.toFixed(2)} M☉`;
		if (f.kind === 'neutron-star') return 'core collapses: supernova, leaving a neutron star';
		return `core collapses: a black hole of about ${Math.round(f.remnant!)} M☉`;
	});
	const showEnd = $derived(to === last ? smoothstep(0.96, 1, u) : 0);

	// Focus of the step: a gentle tween of the trail's opacity when the step changes.
	const focus = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		void step.id;
		untrack(() => {
			focus.set(0, { duration: 0 });
			focus.set(1, { duration: reduced ? 0 : 700 });
		});
	});
	const big = $derived(now.R >= 50);
	const kx = 830;
</script>

<g>
	<HrPlot name="life" box={BOX} {sx} {sy} dots={0.35} />

	<!-- the track so far -->
	<g clip-path="url(#life-hr-clip)" opacity={focus.current}>
		<path
			d={travelled}
			fill="none"
			stroke="#ffd8a8"
			stroke-width="2.2"
			stroke-linejoin="round"
			opacity="0.9"
		/>
	</g>
	<circle cx={dotX} cy={dotY} r="14" fill={surface} opacity="0.25" />
	<circle cx={dotX} cy={dotY} r="7.5" fill={surface} stroke="var(--st-sky)" stroke-width="1.5" />
	{#if offChart}
		<SkyLabel
			x={BOX.x + 8}
			y={dotY - 14}
			text="→ off the chart: {round2(now.T)} K"
			anchor="start"
			size={11}
		/>
	{/if}
	{#if done && ending.kind === 'white-dwarf' && to === last}
		<path
			d="M{dotX} {dotY} Q {dotX + 30} {dotY + 110} {sx(3.95)} {sy(-3.6)}"
			fill="none"
			stroke="#ffd8a8"
			stroke-width="1.6"
			stroke-dasharray="4 5"
			marker-end="url(#arrowhead)"
			opacity="0.8"
		/>
		<SkyLabel
			x={sx(4.3)}
			y={sy(-1.0)}
			text="then cools for billions of years"
			size={11}
			opacity={showEnd}
		/>
	{/if}
	<Readout id="mass-start" order={0} label="Starting mass" value="{mass} M☉">
		<SkyLabel
			x={BOX.x + 12}
			y={BOX.y + 22}
			text="{mass} M☉ star"
			anchor="start"
			size={13}
			weight={700}
		/>
	</Readout>

	<!-- stage and age -->
	<Readout id="stage" order={1} label="Stage" value={stageName(tr, now)}>
		<Txt x={560} y={40} text={stageName(tr, now)} size={16} weight={700} anchor="start" />
	</Readout>
	<Readout id="age" order={2} label="Age" value={ageText}>
		<Txt x={560} y={62} text="age: {ageText}" anchor="start" muted size={12} />
	</Readout>

	<!-- the cutaway -->
	<circle cx={CX} cy={CY} r={RC + 4} fill={surface} opacity="0.9" />
	<circle cx={CX} cy={CY} r={RC} fill="var(--st-h)" />
	{#if onMS}
		<circle
			cx={CX}
			cy={CY}
			r={MS_CORE}
			fill="var(--st-h)"
			stroke="var(--stage-line)"
			stroke-dasharray="3 3"
		/>
		<circle cx={CX} cy={CY} r={MS_CORE} fill="var(--st-he)" opacity={heShare} />
	{:else}
		{#if rHe > 0.5}
			<circle cx={CX} cy={CY} r={Math.max(3, rHe)} fill="var(--st-he)" />
		{/if}
		{#if rCO > 0.5}
			<circle
				cx={CX}
				cy={CY}
				r={Math.max(2.5, rCO)}
				fill={now.xNe > 0.1 ? 'var(--st-ne)' : 'var(--st-co)'}
			/>
		{/if}
	{/if}
	<!-- burning regions -->
	{#if coreBurn}
		<circle
			cx={CX}
			cy={CY}
			r={coreR}
			fill="var(--st-burn)"
			opacity={0.25 + 0.1 * glowH}
			filter="url(#glow)"
		/>
		<circle cx={CX} cy={CY} r={Math.max(4, coreR * 0.45)} fill="var(--st-burn)" opacity="0.7" />
	{/if}
	{#if hShell > 0.02}
		<circle
			cx={CX}
			cy={CY}
			r={Math.max(4, rHe)}
			fill="none"
			stroke="var(--st-burn)"
			stroke-width="4"
			opacity={hShell}
			filter="url(#glow)"
		/>
	{/if}
	{#if heShell > 0.02}
		<circle
			cx={CX}
			cy={CY}
			r={Math.max(3, rCO)}
			fill="none"
			stroke="#e03131"
			stroke-width="3"
			opacity={heShell}
			filter="url(#glow)"
		/>
	{/if}
	<Readout id="cut">
		<Txt x={CX} y={CY + RC + 22} text="inside, drawn by mass" size={11} muted />
	</Readout>

	<!-- key to the cutaway -->
	<rect
		x={kx - 8}
		y={84}
		width={120}
		height={200}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
		opacity="0.92"
	/>
	<Readout id="k-h" order={10} label="hydrogen and helium (the envelope)" color="var(--st-h)">
		<rect x={kx} y={98} width="12" height="12" rx="3" fill="var(--st-h)" stroke="var(--border)" />
		<Txt x={kx + 18} y={109} text="hydrogen" anchor="start" size={12} />
	</Readout>
	<Readout id="k-he" order={11} label="helium" color="var(--st-he)">
		<rect x={kx} y={124} width="12" height="12" rx="3" fill="var(--st-he)" stroke="var(--border)" />
		<Txt x={kx + 18} y={135} text="helium" anchor="start" size={12} />
	</Readout>
	<Readout
		id="k-co"
		order={12}
		label={coreLabel}
		color={now.xNe > 0.1 ? 'var(--st-ne)' : 'var(--st-co)'}
	>
		<rect
			x={kx}
			y={150}
			width="12"
			height="12"
			rx="3"
			fill={now.xNe > 0.1 ? 'var(--st-ne)' : 'var(--st-co)'}
			stroke="var(--border)"
		/>
		<Txt
			x={kx + 18}
			y={161}
			text={now.xNe > 0.1 ? 'O, Ne, Mg' : 'carbon, oxygen'}
			anchor="start"
			size={12}
		/>
	</Readout>
	<circle cx={kx + 6} cy={182} r="6" fill="var(--st-burn)" opacity="0.8" />
	<Txt x={kx + 18} y={186} text="fusing" anchor="start" size={12} />
	<!-- what is burning -->
	<Readout
		id="burn"
		order={3}
		label="Fusing"
		value={[
			coreBurn ? `${FUEL_PRODUCTS[coreBurn]} in the core` : '',
			burn.hShell ? 'hydrogen in a shell' : '',
			burn.heShell ? 'helium in a shell' : ''
		]
			.filter(Boolean)
			.join('; ') || 'nothing: it is cooling'}
	>
		<Txt
			x={kx}
			y={214}
			text={coreBurn ? `core: ${coreBurn} →` : 'core: no fusion'}
			anchor="start"
			size={12}
			weight={600}
		/>
		<Txt
			x={kx}
			y={232}
			text={coreBurn
				? FUEL_PRODUCTS[coreBurn].split('→ ')[1]
				: remnantStage
					? 'cooling'
					: 'contracting'}
			anchor="start"
			size={11}
			muted
		/>
		<Txt
			x={kx}
			y={256}
			text={burn.hShell && burn.heShell
				? 'shells: H and He'
				: burn.hShell
					? 'shell: H → He'
					: burn.heShell
						? 'shell: He → C, O'
						: 'no shells'}
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>

	<!-- numbers -->
	<rect
		x={552}
		y={346}
		width={386}
		height={112}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="lum" order={4} label="Luminosity" value="{round2(now.L)} × the Sun">
		<Txt x={568} y={372} text="luminosity: {round2(now.L)} × Sun" anchor="start" size={12} />
	</Readout>
	<Readout id="temp" order={5} label="Surface" value="{round2(now.T)} K">
		<Txt x={760} y={372} text="surface: {round2(now.T)} K" anchor="start" size={12} />
	</Readout>
	<Readout
		id="radius"
		order={6}
		label="Radius"
		value="{round2(now.R)} × the Sun{big
			? ` (${(now.R / AU_IN_RSUN).toFixed(1)} × Earth's orbit)`
			: ''}"
	>
		<Txt
			x={568}
			y={398}
			text="radius: {round2(now.R)} × Sun{big
				? ` = ${(now.R / AU_IN_RSUN).toFixed(1)} × Earth’s orbit`
				: ''}"
			anchor="start"
			size={12}
		/>
	</Readout>
	<Readout id="mass" order={7} label="Mass now" value="{now.M.toFixed(now.M < 10 ? 2 : 1)} M☉">
		<Txt
			x={568}
			y={424}
			text="mass now: {now.M.toFixed(now.M < 10 ? 2 : 1)} M☉"
			anchor="start"
			size={12}
		/>
	</Readout>
	<Readout id="core-t" order={8} label="Centre" value="{round2(now.Tc / 1e6)} million K">
		<Txt x={760} y={424} text="centre: {round2(now.Tc / 1e6)} million K" anchor="start" size={12} />
	</Readout>
	{#if showEnd > 0.01}
		<Readout id="end" order={9} label="The end" value={endText} opacity={showEnd}>
			<Txt
				x={568}
				y={448}
				text={endText}
				anchor="start"
				size={12}
				weight={700}
				color="var(--st-pressure)"
				opacity={showEnd}
			/>
		</Readout>
	{/if}

	<!-- the timeline, to scale in years -->
	{#each segments as g (g.key)}
		{@const x0 = tx(tr.age[g.i0])}
		{@const x1 = tx(tr.age[g.i1])}
		<rect
			x={x0}
			y={TL.y}
			width={Math.max(1.5, x1 - x0)}
			height="14"
			fill={g.colour}
			stroke="var(--border)"
			stroke-width="0.5"
		/>
		{#if x1 - x0 > 110}
			<Readout id="seg-{g.key}">
				<Txt
					x={(x0 + x1) / 2}
					y={TL.y + 34}
					text="{g.name}: {years(tr.age[g.i1] - tr.age[g.i0])}"
					size={11}
					muted
				/>
			</Readout>
		{/if}
	{/each}
	{#if ending.kind === 'not-yet'}
		{@const ux = tx(UNIVERSE_AGE)}
		<line
			x1={ux}
			x2={ux}
			y1={TL.y - 6}
			y2={TL.y + 20}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Txt x={ux} y={TL.y + 34} text="age of the universe" size={11} />
	{/if}
	{#if late.length}
		{@const lx = tx(tr.age[late[0].i0])}
		<Readout id="seg-late">
			<Txt
				x={Math.min(lx, TL.x + TL.w) - 4}
				y={TL.y + 34}
				text="everything after: {years(tr.age[n] - tr.age[late[0].i0])}"
				size={11}
				muted
				anchor="end"
			/>
		</Readout>
	{/if}
	<path d="M{mark} {TL.y - 2} l-6 -9 h12 z" fill="var(--stage-ink)" />
	<Txt x={TL.x} y={TL.y - 14} text="life, to scale in years" anchor="start" size={11} muted />
</g>
