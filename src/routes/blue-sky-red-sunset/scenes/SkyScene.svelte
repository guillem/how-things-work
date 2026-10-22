<script lang="ts">
	/**
	 * The sky from 40° north on an equinox, looking south: a panorama from east (left) to west
	 * (right), from the horizon up to straight overhead (the top edge), at one scale both ways.
	 * Every patch of sky and the Sun's disc take the colour the model works out for that
	 * direction, with the Sun where it is at the step's time. Below, swatches of the sky overhead
	 * and the Sun, and the step's readouts.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, Photon, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		NM,
		SKY_EXPOSURE,
		airMass,
		glareColour,
		luminance,
		screenColour,
		skySpectrum,
		sunAt,
		sunlight,
		sunSpectrum,
		transmitted,
		zenithSpectrum,
		type Direction,
		type Sky
	} from '../model';
	import { airName, smokeName } from '../steps';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'look'));
	const targetHour = $derived(
		phase === 'sunset'
			? Number(params.time ?? 12)
			: step.hints?.time !== undefined
				? Number(step.hints.time)
				: 12
	);
	const sky: Sky = $derived(
		phase === 'smoke'
			? { smoke: Number(params.smoke ?? 0) }
			: phase === 'air'
				? { air: Number(params.air ?? 1) }
				: {}
	);

	// The Sun glides to a new step's time; the time slider moves it at once.
	const opts = { duration: 800, easing: cubicInOut };
	const hourT = new Tween(
		untrack(() => targetHour),
		opts
	);
	let lastPhase = untrack(() => phase);
	$effect(() => {
		const h = targetHour;
		const p = phase;
		untrack(() => {
			const instant = reduced || p === lastPhase;
			lastPhase = p;
			void hourT.set(h, instant ? { duration: 0 } : opts);
		});
	});
	const hour = $derived(hourT.current);
	const sun: Direction = $derived.by(() => {
		const s = sunAt(hour);
		return { elevation: Math.max(0, s.elevation), azimuth: s.azimuth };
	});

	// ---- the panorama: 4 px per degree both ways ---------------------------------------------
	const X0 = 60;
	const AZ0 = 75;
	const AZ1 = 285;
	const K = 4;
	const TOP = 34;
	const HY = TOP + 90 * K;
	const PX = (az: number) => X0 + (az - AZ0) * K;
	const PY = (el: number) => HY - el * K;

	const COLS = 35;
	const COL_W = ((AZ1 - AZ0) * K) / COLS;
	// From the top (overhead) down to the horizon: gradient stops must come in order.
	const STOPS = [90, 65, 45, 30, 22, 15, 10, 7, 4, 2, 0];
	const columns = $derived(
		// One column beyond each edge, so the blur that hides the steps between columns has
		// sky to blend with at the edges.
		Array.from({ length: COLS + 2 }, (_, k) => {
			const azimuth = AZ0 + ((k - 0.5) * (AZ1 - AZ0)) / COLS;
			return STOPS.map((elevation) => ({
				offset: 1 - elevation / 90,
				colour: screenColour(skySpectrum({ elevation, azimuth }, sun, sky), SKY_EXPOSURE)
			}));
		})
	);

	const sunSpec = $derived(sunSpectrum(sun.elevation, sky));
	const sunColour = $derived(glareColour(sunSpec));
	const zenith = $derived(screenColour(zenithSpectrum(sun, sky), SKY_EXPOSURE));
	const noonZenith = $derived(screenColour(zenithSpectrum(sunAt(12), sky), SKY_EXPOSURE));
	const sunX = $derived(PX(sun.azimuth));
	const sunY = $derived(PY(sun.elevation));

	/** The Sun's path through the day, dashed. */
	const path = Array.from({ length: 49 }, (_, i) => sunAt(6 + i / 4))
		.map((d, i) => `${i ? 'L' : 'M'}${PX(d.azimuth).toFixed(1)} ${PY(d.elevation).toFixed(1)}`)
		.join(' ');

	// ---- readouts -----------------------------------------------------------------------------
	const clock = $derived.by(() => {
		const m = Math.round(hour * 60);
		return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
	});
	const up = $derived(Math.round(sun.elevation));
	const times = $derived(airMass(sun.elevation));
	const timesText = $derived(times < 1.95 ? times.toFixed(1) : String(Math.round(times)));
	const inHundred = (v: number) =>
		v >= 0.995 ? '100 in 100' : v < 0.005 ? 'almost none' : `${Math.round(v * 100)} in 100`;
	const blueThrough = $derived(inHundred(transmitted(450, sun.elevation, sky)));
	const redThrough = $derived(inHundred(transmitted(700, sun.elevation, sky)));
	const SUN_ABOVE = luminance(NM.map(sunlight));
	const sunThrough = $derived(inHundred(luminance(sunSpec) / SUN_ABOVE));

	// ---- moving light -------------------------------------------------------------------------
	const EYE = { x: PX(180), y: HY - 26 };
	/** Sunlight coming straight on from the Sun to the eye. */
	const beam = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const u = cycle(t, 4, i / 4);
			return {
				x: sunX + (EYE.x - sunX) * u,
				y: sunY + (EYE.y - sunY) * u,
				o: smoothstep(0.05, 0.15, u) * (1 - smoothstep(0.85, 0.95, u))
			};
		})
	);
	const beamAngle = $derived((Math.atan2(EYE.y - sunY, EYE.x - sunX) * 180) / Math.PI);
	/** Blue light bounced by the air towards the eye, from all over the sky. */
	const SPOTS = [
		{ az: 110, el: 62 },
		{ az: 150, el: 80 },
		{ az: 215, el: 70 },
		{ az: 250, el: 40 },
		{ az: 130, el: 30 },
		{ az: 270, el: 18 }
	];
	const bounced = $derived(
		SPOTS.map((s, i) => {
			const u = cycle(t, 3.2, i / SPOTS.length);
			const sx = PX(s.az);
			const sy = PY(s.el);
			return {
				x: sx + (EYE.x - sx) * u,
				y: sy + (EYE.y - sy) * u,
				angle: (Math.atan2(EYE.y - sy, EYE.x - sx) * 180) / Math.PI,
				o: smoothstep(0, 0.12, u) * (1 - smoothstep(0.8, 0.95, u))
			};
		})
	);
	const noAir = $derived((sky.air ?? 1) === 0);
	const compare = $derived(phase === 'smoke' || phase === 'air');
	const swatches = $derived([
		{ id: 'zen', x: 120, colour: zenith, label: compare ? 'sky overhead now' : 'sky overhead' },
		{ id: 'sun', x: 230, colour: sunColour, label: 'the Sun' },
		...(compare ? [{ id: 'noon', x: 340, colour: noonZenith, label: 'sky overhead at noon' }] : [])
	]);
	/** Where the step's words start, right of the swatches. */
	const RX = $derived(compare ? 410 : 300);
</script>

<g class="sb-sky">
	<defs>
		{#each columns as stops, i (i)}
			<linearGradient id="sky-col-{i}" x1="0" y1="0" x2="0" y2="1">
				{#each stops as s (s.offset)}
					<stop offset={s.offset} stop-color={s.colour} />
				{/each}
			</linearGradient>
		{/each}
		<filter id="sky-blur" x="-0.05" y="0" width="1.1" height="1">
			<feGaussianBlur stdDeviation="{COL_W * 0.6} 0" />
		</filter>
		<clipPath id="sky-clip">
			<rect x={X0} y={TOP} width={(AZ1 - AZ0) * K} height={HY - TOP} rx="10" />
		</clipPath>
	</defs>

	<!-- the sky, patch by patch, and the Sun -->
	<g clip-path="url(#sky-clip)">
		<g filter="url(#sky-blur)">
			{#each { length: COLS + 2 }, i (i)}
				<rect
					x={X0 + (i - 1) * COL_W}
					y={TOP}
					width={COL_W + 2}
					height={HY - TOP}
					fill="url(#sky-col-{i})"
				/>
			{/each}
		</g>
		<path
			d={path}
			fill="none"
			stroke="#ffffff"
			stroke-width="1.5"
			stroke-dasharray="3 6"
			opacity="0.45"
		/>
		<circle cx={sunX} cy={sunY} r="34" fill={sunColour} opacity="0.3" />
		<circle cx={sunX} cy={sunY} r="15" fill={sunColour} />

		{#if phase !== 'next'}
			{#each beam as b, i (i)}
				<Photon x={b.x} y={b.y} angle={beamAngle} color={sunColour} opacity={b.o} length={34} />
			{/each}
		{/if}
		{#if phase === 'sky'}
			{#each bounced as b, i (i)}
				<Photon x={b.x} y={b.y} angle={b.angle} color="#4dabf7" opacity={b.o} length={34} />
			{/each}
		{/if}
	</g>
	<rect
		x={X0}
		y={TOP}
		width={(AZ1 - AZ0) * K}
		height={HY - TOP}
		rx="10"
		fill="none"
		stroke="var(--stage-line)"
	/>

	<!-- the ground, a person looking up, the compass -->
	<path
		d="M{X0} {HY} L{X0 + 280} {HY} Q{X0 + 420} {HY - 16} {X0 + 560} {HY} L{X0 + 840} {HY} L{X0 +
			840} {HY + 34} Q{X0 + 840} {HY + 44} {X0 + 830} {HY + 44} L{X0 + 10} {HY + 44} Q{X0} {HY +
			44} {X0} {HY + 34} Z"
		fill="var(--sb-ground)"
	/>
	<g fill="var(--sb-ground)">
		<circle cx={EYE.x} cy={EYE.y - 4} r="7" />
		<path
			d="M{EYE.x - 7} {HY + 4} L{EYE.x - 5} {EYE.y + 6} Q{EYE.x} {EYE.y + 2} {EYE.x + 5} {EYE.y +
				6} L{EYE.x + 7} {HY + 4} Z"
		/>
	</g>
	<Readout id="sb-compass">
		{#each [[90, 'east'], [180, 'south'], [270, 'west']] as const as [az, name] (name)}
			<text x={PX(az)} y={HY + 30} text-anchor="middle" font-size="13" fill="var(--sb-ground-ink)"
				>{name}</text
			>
		{/each}
	</Readout>
	<Readout id="sb-up">
		<Label x={PX(180)} y={TOP + 20} text="↑ straight overhead" size={12} muted />
	</Readout>

	<!-- swatches -->
	{#each swatches as s, i (s.id)}
		<circle
			cx={s.x}
			cy={520}
			r="30"
			fill={s.colour}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<Readout
			id="sb-sw-{s.id}"
			order={10 + i}
			label={s.label[0].toUpperCase() + s.label.slice(1)}
			marker={i + 1}
			at={[s.x, 572]}
		>
			<Label x={s.x} y={570} text={s.label} size={12} />
		</Readout>
	{/each}

	<!-- the step's words -->
	{#if phase === 'look'}
		<Readout id="sb-look" order={1} label="Noon" value="the Sun is 50° up, in the south">
			<Label
				x={RX}
				y={506}
				text="Noon: the Sun is 50° up, in the south"
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout id="sb-look2" order={2} label="The colours" value="worked out from sunlight and air">
			<Label
				x={RX}
				y={532}
				text="every colour here is worked out from sunlight and air"
				anchor="start"
				size={13}
				muted
			/>
		</Readout>
	{:else if phase === 'sky'}
		<Readout
			id="sb-sky"
			order={1}
			label="Blue sky"
			value="sunlight bounced to you by the air, from all over the sky"
		>
			<Label
				x={RX}
				y={506}
				text="blue sky: sunlight that air bounced towards you"
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout id="sb-sky2" order={2} label="The Sun" value="the light that comes straight on">
			<Label
				x={RX}
				y={532}
				text="the Sun: the light that comes straight on"
				anchor="start"
				size={13}
				muted
			/>
		</Readout>
	{:else if phase === 'sunset'}
		<Readout id="sb-time" order={1} label="Time" value="{clock}, the Sun {up}° up">
			<Label
				x={RX}
				y={500}
				text="{clock} · the Sun is {up}° up"
				anchor="start"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="sb-air"
			order={2}
			label="Air crossed"
			value="{timesText} times as much as from overhead"
		>
			<Label
				x={RX}
				y={526}
				text="its light crosses {timesText} times as much air as from overhead"
				anchor="start"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="sb-through"
			order={3}
			label="Getting through"
			value="blue {blueThrough} · red {redThrough}"
		>
			<Label
				x={RX}
				y={548}
				text="getting through: blue {blueThrough} · red {redThrough}"
				anchor="start"
				size={13}
				muted
				tabular
			/>
		</Readout>
	{:else if phase === 'smoke' || phase === 'air'}
		<Readout
			id="sb-what"
			order={1}
			label={phase === 'smoke' ? 'Smoke' : 'Air'}
			value={phase === 'smoke' ? smokeName(sky.smoke ?? 0) : airName(sky.air ?? 1)}
		>
			<Label
				x={RX}
				y={500}
				text={phase === 'smoke' ? smokeName(sky.smoke ?? 0) : airName(sky.air ?? 1)}
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout id="sb-low" order={2} label="Time" value="{clock}, the Sun {up}° up">
			<Label x={RX} y={526} text="{clock} · the Sun is {up}° up" anchor="start" size={13} muted />
		</Readout>
		<Readout
			id="sb-sunlight"
			order={3}
			label="Low Sun’s light getting through"
			value={noAir ? 'all of it' : sunThrough}
		>
			<Label
				x={RX}
				y={548}
				text={noAir
					? 'all of the Sun’s light gets through'
					: `of the low Sun’s light, ${sunThrough} ${sunThrough === 'almost none' ? 'gets' : 'get'} through`}
				anchor="start"
				size={13}
				tabular
			/>
		</Readout>
	{:else}
		<Readout id="sb-next" order={1} label="In short" value="air bounces blue far more than red">
			<Label
				x={RX}
				y={506}
				text="air bounces blue light far more than red"
				anchor="start"
				size={16}
				weight={700}
			/>
		</Readout>
		<Readout id="sb-next2" order={2} label="So" value="the sky is blue, and a low Sun turns orange">
			<Label
				x={RX}
				y={532}
				text="so the sky is blue, and a low Sun turns orange"
				anchor="start"
				size={13}
				muted
			/>
		</Readout>
	{/if}
</g>
