<script lang="ts">
	/**
	 * A ship sailing away, twice. Top: seen from the side, the watcher's eye on the beach or a cliff
	 * at the left, the sea flat or curving down as on a ball (heights stretched about seventy times
	 * against distances, both real), the lines of sight to the masthead and to the lowest part still
	 * in view, and the part hidden behind the sea. Bottom: what the eye sees, the ship at its real
	 * apparent size against the horizon, or through 7× binoculars aimed at it. Every height and
	 * angle comes from the model.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { cycle, Handle, Label, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		elevation,
		EYE,
		hiddenHeight,
		horizonDip,
		horizonDistance,
		seaDrop,
		SHIP
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'sail'));
	const world = $derived(String(step.hints?.world ?? 'round'));

	const D_MIN = 2;
	const D_MAX = 30;
	const MAG = 7;
	const targetD = $derived(
		phase === 'sail' ? Number(params.distance ?? 8) : Number(step.hints?.ship ?? 16)
	);
	const targetCliff = $derived(phase === 'cliff' ? Number(params.cliff ?? 0) : 0);
	const targetMag = $derived(
		phase === 'cliff' ? MAG : phase === 'binoculars' && params.binoculars === true ? MAG : 1
	);

	const opts = { duration: 800, easing: cubicInOut };
	const dist = new Tween(8, opts);
	const cliffH = new Tween(0, opts);
	const mag = new Tween(1, opts);
	const round = new Tween(1, opts);
	$effect(() => {
		const [d, c, m, r] = [targetD, targetCliff, targetMag, world === 'round' ? 1 : 0];
		untrack(() => {
			const o = { duration: reduced ? 0 : 800 };
			dist.set(d, o);
			cliffH.set(c, o);
			mag.set(m, o);
			round.set(r, o);
		});
	});

	const d = $derived(dist.current * 1000);
	const eye = $derived(cliffH.current + EYE);
	const r = $derived(round.current);
	/** Hidden height, m: the round world's, faded in and out with the sea's curve between steps. */
	const hidden = $derived(r * hiddenHeight(d, eye));
	const shown = $derived(Math.min(hidden, SHIP.top));
	const elev = (y: number) =>
		r * elevation(y, d, eye, 'round') + (1 - r) * elevation(y, d, eye, 'flat');
	const dip = $derived(r * horizonDip(eye, 'round'));
	const f = (v: number) => v.toFixed(1);

	// ---- the side view -----------------------------------------------------------------------------
	const X0 = 96;
	/** px per km along the sea, px per m up. */
	const KX = 26;
	const VY = 1.8;
	const Y0 = 176;
	const BOTTOM = 318;
	/** How much taller than real the side view draws heights, against its distances. */
	const STRETCH = Math.round(VY / (KX / 1000) / 10) * 10;
	const sx = (m: number) => X0 + (m / 1000) * KX;
	const sy = (x: number, y: number) => Y0 + (r * seaDrop(x) - y) * VY;

	const seaPath = $derived.by(() => {
		let p = `M${X0 - 6} ${f(sy(0, 0))}`;
		for (let k = 0; k <= 32; k += 1) p += `L${f(sx(k * 1000))} ${f(sy(k * 1000, 0))}`;
		return p;
	});
	const seaFill = $derived(`${seaPath}L${f(sx(32000))} ${BOTTOM}L${X0 - 6} ${BOTTOM}Z`);
	// The surface's wave crests, drifting slowly towards the shore.
	const crests = $derived.by(() => {
		const out: { x: number; y: number; k: number }[] = [];
		const ph = reduced ? 0.3 : cycle(t, 9);
		for (let k = 0; k < 14; k++) {
			const km = ((k + 1 - ph) * 31) / 14;
			out.push({ x: sx(km * 1000), y: sy(km * 1000, 0) + 7, k });
		}
		return out;
	});

	const shipX = $derived(sx(d));
	const shipY = $derived(sy(d, 0));
	const eyeX = X0 - 4;
	const eyeY = $derived(Y0 - eye * VY);
	const cliffTop = $derived(Y0 - cliffH.current * VY);
	const horizonKm = $derived(horizonDistance(eye) / 1000);
	const seeAll = $derived(hidden < 0.05);
	const allGone = $derived(hidden >= SHIP.top - 0.05);

	/** The ship, in metres: x along it (bow to the right), y up from the waterline. */
	const HULL = [
		[-30, 7],
		[31, 7],
		[26, 0],
		[-26, 0]
	];
	const MASTS = [
		{ x: -16, top: 31 },
		{ x: 0, top: SHIP.top },
		{ x: 15, top: 31 }
	];
	const SAILS = MASTS.flatMap((m) => {
		const out: number[][][] = [];
		const levels = [SHIP.sailFoot, SHIP.sailFoot + 8, SHIP.sailFoot + 15, m.top - 2];
		for (let i = 0; i < 3; i++) {
			const w0 = 8 - i * 1.6;
			const w1 = 7 - i * 1.6;
			out.push([
				[m.x - w0, levels[i] + 0.6],
				[m.x + w0, levels[i] + 0.6],
				[m.x + w1, levels[i + 1] - 0.4],
				[m.x - w1, levels[i + 1] - 0.4]
			]);
		}
		return out;
	});
	const shape = (pts: number[][], px: (x: number) => number, py: (y: number) => number) =>
		'M' + pts.map(([x, y]) => `${f(px(x))} ${f(py(y))}`).join('L') + 'Z';

	// Side view: the ship is drawn 1 px per 1.5 m along (its real length would be under 2 px).
	const sideX = (x: number) => shipX + x / 1.5;
	const sideY = (y: number) => shipY - y * VY;

	// ---- the eye view ------------------------------------------------------------------------------
	const VX0 = 16;
	const VX1 = 944;
	const VT = 342;
	const VB = 584;
	const VCX = 480;
	/** px per degree for the naked eye. */
	const S = 250;
	const scale = $derived(S * mag.current);
	// Binoculars aim at the middle of the ship; the naked eye looks level, eye level near the bottom.
	const zoom = $derived((mag.current - 1) / (MAG - 1));
	const aim = $derived((elev(0) + elev(SHIP.top)) / 2);
	const centreElev = $derived(zoom * aim);
	const centreY = $derived(zoom * 464 + (1 - zoom) * 520);
	const ey = (deg: number) => centreY - (deg - centreElev) * scale;
	const horizonY = $derived(Math.min(VB, ey(dip)));
	/** Eye-view position of a point of the ship, from its height (metres per degree vary little). */
	const viewY = (y: number) => ey(elev(y));
	const viewX = (x: number) => VCX + ((x / d) * 180 * scale) / Math.PI;
	const beyond = $derived(r > 0.5 && d > horizonDistance(eye));

	const binoLens = $derived(zoom > 0.02);
	const lensR = 116;

	// ---- drag the ship -----------------------------------------------------------------------------
	const setDistance = (km: number) =>
		setParam('distance', Math.min(D_MAX, Math.max(D_MIN, Math.round(km * 2) / 2)));

	const hiddenText = $derived(
		world === 'flat'
			? 'nothing: it only looks smaller'
			: allGone
				? 'all of it'
				: seeAll
					? 'nothing yet'
					: hidden < SHIP.hull
						? `the bottom ${Math.max(1, Math.round(hidden))} m of the hull`
						: hidden < SHIP.sailFoot
							? 'the whole hull'
							: `the hull and the bottom ${Math.round(hidden - SHIP.sailFoot)} m of the sails`
	);
	const km = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
</script>

<g>
	<defs>
		<clipPath id="eb-view-clip">
			{#if binoLens}
				<circle cx={VCX - 92} cy={464} r={lensR} />
				<circle cx={VCX + 92} cy={464} r={lensR} />
			{:else}
				<rect x={VX0} y={VT} width={VX1 - VX0} height={VB - VT} rx="10" />
			{/if}
		</clipPath>
		<linearGradient id="eb-sky-grad" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--eb-sky-top)" />
			<stop offset="1" stop-color="var(--eb-sky)" />
		</linearGradient>
	</defs>

	<!-- ============================== side view ============================== -->
	<rect
		x="16"
		y="16"
		width="928"
		height={BOTTOM - 16}
		rx="10"
		fill="url(#eb-sky-grad)"
		opacity="0.55"
	/>
	<path d={seaFill} fill="var(--eb-sea)" opacity="0.85" />
	<path d={seaPath} fill="none" stroke="var(--eb-sea-edge)" stroke-width="2" />
	{#each crests as c (c.k)}
		<path
			d="M{f(c.x - 6)} {f(c.y)}q3 -3 6 0t6 0"
			fill="none"
			stroke="var(--eb-crest)"
			stroke-width="1.3"
			opacity="0.7"
		/>
	{/each}

	<!-- the beach and the cliff -->
	<path
		d="M16 {BOTTOM}L16 {f(cliffTop)}L{X0 - 2} {f(cliffTop)}L{X0 + 4} {Y0 + 2}L{X0 + 14} {BOTTOM}Z"
		fill="var(--eb-sand)"
		stroke="var(--eb-sand-edge)"
		stroke-width="1.2"
	/>
	{#if cliffH.current > 0.5}
		<Label
			x={52}
			y={f(cliffTop + 18)}
			text="cliff {Math.round(cliffH.current)} m"
			size={12}
			muted
		/>
	{/if}

	<!-- lines of sight -->
	{#if !allGone}
		<line
			x1={eyeX}
			y1={f(eyeY)}
			x2={f(sideX(0))}
			y2={f(sideY(SHIP.top))}
			stroke="var(--eb-sight)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
		<line
			x1={eyeX}
			y1={f(eyeY)}
			x2={f(sideX(0))}
			y2={f(sideY(shown))}
			stroke="var(--eb-sight)"
			stroke-width="2"
		/>
	{:else}
		<!-- the view skims the sea at the horizon and passes over the masthead -->
		<line
			x1={eyeX}
			y1={f(eyeY)}
			x2={f(sideX(0))}
			y2={f(sideY(hidden))}
			stroke="var(--eb-sight)"
			stroke-width="2"
		/>
	{/if}
	{#if r > 0.5 && !seeAll}
		<circle
			cx={f(sx(horizonKm * 1000))}
			cy={f(sy(horizonKm * 1000, 0))}
			r="4.5"
			fill="var(--eb-sight)"
		/>
		<Label
			x={sx(horizonKm * 1000)}
			y={sy(horizonKm * 1000, 0) + 24}
			text="horizon, {Math.round(horizonKm)} km"
			size={13}
			weight={600}
			anchor="middle"
		/>
	{/if}

	<!-- the ship, side view; the part behind the sea faded and dashed -->
	<g>
		<clipPath id="eb-side-clip">
			<rect
				x={f(shipX - 40)}
				y={f(sideY(SHIP.top + 4))}
				width="80"
				height={f(Math.max(0, sideY(shown) - sideY(SHIP.top + 4)))}
			/>
		</clipPath>
		<g opacity="0.28">
			<path d={shape(HULL, sideX, sideY)} fill="var(--eb-hull)" />
			{#each SAILS as s, i (i)}<path d={shape(s, sideX, sideY)} fill="var(--eb-sail)" />{/each}
		</g>
		<g clip-path="url(#eb-side-clip)">
			{#each MASTS as m, i (i)}
				<line
					x1={f(sideX(m.x))}
					x2={f(sideX(m.x))}
					y1={f(sideY(SHIP.hull))}
					y2={f(sideY(m.top))}
					stroke="var(--eb-mast)"
					stroke-width="1.6"
				/>
			{/each}
			<path d={shape(HULL, sideX, sideY)} fill="var(--eb-hull)" />
			{#each SAILS as s, i (i)}
				<path
					d={shape(s, sideX, sideY)}
					fill="var(--eb-sail)"
					stroke="var(--eb-sail-edge)"
					stroke-width="0.8"
				/>
			{/each}
		</g>
		{#if !seeAll && !allGone}
			<line
				x1={f(shipX - 36)}
				x2={f(shipX + 36)}
				y1={f(sideY(shown))}
				y2={f(sideY(shown))}
				stroke="var(--eb-hidden)"
				stroke-width="1.5"
				stroke-dasharray="3 3"
			/>
		{/if}
	</g>

	<!-- the eye -->
	<g transform="translate({eyeX} {f(eyeY)})">
		<path
			d="M-11 0Q0 -9 11 0Q0 9 -11 0Z"
			fill="var(--eb-eye-white)"
			stroke="var(--eb-eye)"
			stroke-width="1.6"
		/>
		<circle cx="2" r="3.6" fill="var(--eb-eye)" />
	</g>
	<Label x={eyeX - 4} y={f(eyeY - 16)} text="you" size={14} weight={700} anchor="middle" />

	{#if phase === 'sail'}
		<Handle
			x={shipX}
			y={sideY(SHIP.top) - 14}
			r={11}
			color="var(--eb-handle)"
			label="The ship"
			value={dist.current}
			min={D_MIN}
			max={D_MAX}
			valuetext="{km(targetD)} kilometres out"
			onmove={(p: Point) => setDistance((p.x - X0) / KX)}
			onkey={(k) => setDistance(k === 'start' ? D_MIN : k === 'end' ? D_MAX : targetD + k * 0.5)}
		/>
	{/if}

	<Label
		x={32}
		y={40}
		text={world === 'flat'
			? 'From the side: a flat sea'
			: `From the side: the round sea (its curve drawn ${STRETCH} times taller)`}
		size={15}
		weight={700}
		anchor="start"
	/>
	<Readout id="eb-ship" order={1} label="The ship" value="{km(targetD)} km out">
		<Label
			x={928}
			y={40}
			text="ship {km(targetD)} km out"
			size={15}
			weight={700}
			anchor="end"
			tabular
		/>
	</Readout>
	<Readout id="eb-hidden" order={2} label="Hidden behind the sea" value={hiddenText}>
		<Label
			x={928}
			y={62}
			text="hidden behind the sea: {hiddenText}"
			size={13}
			anchor="end"
			muted={world === 'flat' || seeAll}
			color={world === 'round' && !seeAll ? 'var(--eb-hidden)' : undefined}
			weight={world === 'round' && !seeAll ? 600 : 400}
		/>
	</Readout>
	{#if phase === 'sail'}
		<Readout id="eb-drag" order={3} label="Try it" value="drag the ship out to sea">
			<Label x={928} y={84} text="drag the ship out to sea" size={12} anchor="end" italic muted />
		</Readout>
	{/if}

	<!-- ============================== eye view ============================== -->
	<g clip-path="url(#eb-view-clip)">
		<rect x={VX0} y={VT} width={VX1 - VX0} height={VB - VT} fill="url(#eb-sky-grad)" />
		{#snippet ship()}
			<g>
				{#each MASTS as m, i (i)}
					<line
						x1={f(viewX(m.x))}
						x2={f(viewX(m.x))}
						y1={f(viewY(SHIP.hull))}
						y2={f(viewY(m.top))}
						stroke="var(--eb-mast)"
						stroke-width={Math.max(0.6, Math.min(3, (0.6 / d) * scale * 57.3))}
					/>
				{/each}
				<path d={shape(HULL, viewX, viewY)} fill="var(--eb-hull)" />
				{#each SAILS as s, i (i)}
					<path
						d={shape(s, viewX, viewY)}
						fill="var(--eb-sail)"
						stroke="var(--eb-sail-edge)"
						stroke-width="0.6"
					/>
				{/each}
			</g>
		{/snippet}
		{#if beyond}{@render ship()}{/if}
		<rect
			x={VX0}
			y={f(horizonY)}
			width={VX1 - VX0}
			height={f(Math.max(0, VB - horizonY))}
			fill="var(--eb-sea)"
		/>
		<line
			x1={VX0}
			x2={VX1}
			y1={f(horizonY)}
			y2={f(horizonY)}
			stroke="var(--eb-sea-edge)"
			stroke-width="1.2"
		/>
		{#if !beyond}{@render ship()}{/if}
	</g>
	{#if binoLens}
		<g fill="none" stroke="var(--eb-lens)" stroke-width="5" opacity={zoom}>
			<circle cx={VCX - 92} cy={464} r={lensR} />
			<circle cx={VCX + 92} cy={464} r={lensR} />
		</g>
	{:else}
		<rect
			x={VX0}
			y={VT}
			width={VX1 - VX0}
			height={VB - VT}
			rx="10"
			fill="none"
			stroke="var(--border)"
			stroke-width="1.2"
		/>
	{/if}
	<Label
		x={32}
		y={VT + 24}
		text={binoLens ? 'Through the binoculars (7 times bigger)' : 'What your eyes see'}
		size={15}
		weight={700}
		anchor="start"
	/>
	{#if r > 0.5 && !seeAll && !allGone}
		<Label
			x={VCX + (binoLens ? 220 : 130)}
			y={horizonY + 22}
			text="the sea hides the bottom"
			size={13}
			weight={600}
			color="var(--eb-hidden)"
			anchor="start"
		/>
	{/if}
	{#if allGone}
		<Label
			x={VCX}
			y={horizonY - 30}
			text="the whole ship is behind the sea"
			size={14}
			weight={600}
			anchor="middle"
			color="var(--eb-hidden)"
		/>
	{/if}
</g>
