<script lang="ts">
	/**
	 * A Michelson interferometer seen from above: laser, beam splitter, two arms
	 * with hanging end mirrors, and the light sensor at the output.
	 *
	 * A wave of "plus" polarisation, lined up with the arms, stretches the x arm by
	 * ½hL while it squeezes the y arm by ½hL (`params.pol` = cross: neither arm
	 * changes). The drawn mirror swing is 14 px, and the drawn light has a
	 * wavelength of 112 px, so that the arms' difference reaches a quarter
	 * wavelength (half a wavelength there and back) and the output goes from dark
	 * to fully bright: a real change is a few 10⁻¹² of a wavelength.
	 * The wave has a period of 3 s here. `params.wave` off fades the swing out.
	 *
	 * Right: the two beams returning to the sensor (each drawn on its own) and their
	 * sum, and the sensor's brightness over the last 6 s. Reduced motion: t = 2.5 s.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { Label } from '#lib/draw/index.ts';
	import Title from './Title.svelte';

	let { t, params, reduced }: StageProps = $props();

	const time = $derived(reduced ? 2.5 : t);
	const PERIOD = 3;
	const on = $derived(params.wave !== false && params.pol !== 'cross');
	const amp = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = on ? 1 : 0;
		untrack(() => amp.set(v, { duration: reduced ? 0 : 700 }));
	});
	const SWING = 14; // px, each mirror
	const LAMBDA = 112; // px, the drawn light
	const wave = (tt: number) => Math.sin((2 * Math.PI * tt) / PERIOD);
	const dx = $derived(SWING * amp.current * wave(time));
	/** Output brightness for an arm difference d (px): dark at d = 0. */
	const bright = (d: number) => Math.sin((2 * Math.PI * d) / LAMBDA) ** 2;
	const I = $derived(bright(2 * dx));

	// ---- geometry ----------------------------------------------------------------------
	const BX = 250;
	const BY = 420;
	const ARM = 320;
	const LASER = { x: 40, y: BY };
	const mx = $derived(BX + ARM + dx); // x mirror
	const my = $derived(BY - ARM + dx); // y mirror (squeezed: moves down when x stretches)
	const SENSOR = { x: BX, y: 540 };
	const march = $derived(-(reduced ? 0 : time * 60) % 24);

	// ---- the two returning beams ---------------------------------------------------------
	const WX0 = 676;
	const WX1 = 928;
	const yX = 120;
	const yY = 200;
	const yS = 290;
	const beam = (y0: number, shift: number, sign: number, a: number) => {
		let d = '';
		for (let x = WX0; x <= WX1; x += 4) {
			const v = sign * a * Math.sin((2 * Math.PI * (x - WX0 - shift)) / LAMBDA);
			d += `${d ? 'L' : 'M'}${x} ${(y0 - v).toFixed(1)}`;
		}
		return d;
	};
	// the x beam travels 2·dx further than at rest, the y beam 2·dx less: the
	// round trips differ by 4·dx; at rest the two are exactly out of step
	const bx = $derived(beam(yX, 2 * dx, 1, 16));
	const by = $derived(beam(yY, -2 * dx, -1, 16));
	const sum = $derived.by(() => {
		let d = '';
		for (let x = WX0; x <= WX1; x += 4) {
			const u = (2 * Math.PI * (x - WX0)) / LAMBDA;
			const k = (2 * Math.PI * 2 * dx) / LAMBDA;
			const v = 16 * (Math.sin(u - k) - Math.sin(u + k));
			d += `${d ? 'L' : 'M'}${x} ${(yS - v).toFixed(1)}`;
		}
		return d;
	});
	// brightness over the last 6 s
	const strip = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const tt = time - 6 + (6 * i) / 120;
			const v = bright(2 * SWING * amp.current * wave(tt));
			d += `${d ? 'L' : 'M'}${(WX0 + ((WX1 - WX0) * i) / 120).toFixed(1)} ${(500 - 70 * v).toFixed(1)}`;
		}
		return d;
	});
</script>

<g>
	<rect
		x="16"
		y="16"
		width="624"
		height="568"
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>

	<!-- beams -->
	<g stroke="var(--gw-laser)" stroke-width="3" opacity="0.85">
		<line x1={LASER.x + 30} y1={BY} x2={BX} y2={BY} />
		<line x1={BX} y1={BY} x2={mx} y2={BY} stroke-dasharray="14 10" stroke-dashoffset={march} />
		<line x1={BX} y1={BY} x2={BX} y2={my} stroke-dasharray="14 10" stroke-dashoffset={march} />
		<line x1={BX} y1={BY} x2={BX} y2={SENSOR.y - 14} opacity={0.15 + 0.85 * I} />
	</g>

	<!-- laser -->
	<rect x={LASER.x} y={BY - 14} width="30" height="28" rx="4" fill="var(--stage-ink)" />
	<!-- beam splitter -->
	<line
		x1={BX - 16}
		y1={BY + 16}
		x2={BX + 16}
		y2={BY - 16}
		stroke="var(--gw-mirror)"
		stroke-width="5"
	/>
	<!-- end mirrors on their wires -->
	<line
		x1={mx}
		y1={BY - 26}
		x2={mx}
		y2={BY + 26}
		stroke="var(--gw-mirror)"
		stroke-width="8"
		stroke-linecap="round"
	/>
	<line
		x1={BX - 26}
		y1={my}
		x2={BX + 26}
		y2={my}
		stroke="var(--gw-mirror)"
		stroke-width="8"
		stroke-linecap="round"
	/>
	<!-- rest positions -->
	<line
		x1={BX + ARM}
		y1={BY - 36}
		x2={BX + ARM}
		y2={BY + 36}
		stroke="var(--stage-line)"
		stroke-dasharray="3 3"
	/>
	<line
		x1={BX - 36}
		y1={BY - ARM}
		x2={BX + 36}
		y2={BY - ARM}
		stroke="var(--stage-line)"
		stroke-dasharray="3 3"
	/>
	<!-- sensor -->
	<circle
		cx={SENSOR.x}
		cy={SENSOR.y}
		r={10 + 14 * I}
		fill="var(--gw-laser)"
		opacity={0.15 + 0.6 * I}
	/>
	<rect x={SENSOR.x - 12} y={SENSOR.y - 8} width="24" height="16" rx="3" fill="var(--stage-ink)" />

	<Readout id="ifo-labels">
		<Label x={LASER.x + 15} y={BY - 24} text="laser" anchor="middle" size={12} weight={600} />
		<Label x={BX - 24} y={BY - 22} text="beam splitter" anchor="end" size={12} />
		<Label x={BX + ARM - 12} y={BY + 50} text="mirror (hangs free)" anchor="middle" size={12} />
		<Label anchor="start" x={BX + 40} y={BY - ARM + 4} text="mirror" size={12} />
		<Label x={BX + ARM / 2} y={BY + 26} text="x arm, 4 km" anchor="middle" size={12} muted />
		<Label x={BX - 14} y={BY - ARM / 2} text="y arm, 4 km" anchor="end" size={12} muted />
		<Label anchor="start" x={BX + 22} y={SENSOR.y + 5} text="light sensor" size={12} weight={600} />
		<Label
			anchor="start"
			x={32}
			y={44}
			text="Seen from above; mirror motion exaggerated about 10²⁰ times"
			size={12.5}
			weight={650}
		/>
	</Readout>

	<!-- right: the waves at the sensor -->
	<Card x={656} y={16} w={288} h={568} />
	<Title x={672} y={44} text="At the light sensor" size={14} weight={700} />
	<path d={bx} fill="none" stroke="var(--gw-h1)" stroke-width="1.8" />
	<path d={by} fill="none" stroke="var(--gw-l1)" stroke-width="1.8" />
	<path d={sum} fill="none" stroke="var(--gw-laser)" stroke-width="2.4" />
	<line x1={WX0} x2={WX1} y1={yS} y2={yS} stroke="var(--stage-grid)" />
	<Readout id="beam-labels">
		<Label anchor="start" x={672} y={yX - 26} text="light back from the x arm" size={12} muted />
		<Label anchor="start" x={672} y={yY - 26} text="light back from the y arm" size={12} muted />
		<Label
			anchor="start"
			x={672}
			y={yS - 30}
			text="together: what reaches the sensor"
			size={12}
			weight={600}
		/>
	</Readout>
	<line x1={WX0} x2={WX1} y1={500} y2={500} stroke="var(--stage-line)" />
	<path d={strip} fill="none" stroke="var(--gw-laser)" stroke-width="2" />
	<Readout id="strip-cap">
		<Label
			anchor="start"
			x={672}
			y={410}
			text="brightness at the sensor, last 6 s"
			size={12}
			muted
		/>
		<Label x={WX1} y={518} text="now" anchor="end" size={11} muted />
	</Readout>
	<Row
		id="arms"
		order={1}
		x={672}
		y={548}
		w={256}
		label="Arm difference"
		value={on || amp.current > 0.02
			? `${dx >= 0 ? '+' : '−'}${Math.abs((4 * dx) / LAMBDA).toFixed(2)} λ (round trip)`
			: 'none'}
	/>
	<Row
		id="state"
		order={2}
		x={672}
		y={570}
		w={256}
		label="Sensor"
		value={I < 0.03 ? 'dark: the beams cancel' : `${Math.round(I * 100)}% bright`}
		color="var(--gw-laser)"
	/>
</g>
