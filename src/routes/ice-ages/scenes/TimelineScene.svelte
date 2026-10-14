<script lang="ts">
	/**
	 * The three orbital cycles over the last 800,000 years (La2004), the 65° N
	 * June-solstice sunshine they add up to, and the Dome C temperature record,
	 * on one time axis (800,000 years ago on the left, today on the right).
	 * - play: a cursor plays forward at 20,000 years a second (the `play`
	 *   toggle; the `ka` slider stops it and moves the cursor). The orbital
	 *   curves are drawn in full, bright behind the cursor; the temperature is
	 *   drawn up to the cursor.
	 * - puzzle: no playback; the terminations found in the record are shaded,
	 *   and the stretch row is in focus.
	 */
	import { untrack } from 'svelte';
	import { Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		TEMPERATURE,
		climaticPrecession,
		orbitSeries,
		terminations,
		valueAt
	} from '../milankovitch';
	import { agoText } from '../steps';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'play'));
	const puzzle = $derived(phase === 'puzzle');
	const hasPlay = $derived((step.controls ?? []).some((c) => c.id === 'play'));

	// ------------------------------------------------------------ layout
	const X0 = 160;
	const X1 = 920;
	const sx = scale([800, 0], [X0, X1]);
	const RATE = 20; // thousand years per second of playback
	const SERIES = orbitSeries(800, 0);

	interface Row {
		id: string;
		name: string;
		sub: string;
		color: string;
		top: number;
		bottom: number;
		domain: [number, number];
		path: string;
		value: (ka: number) => string;
	}
	const row = (
		id: string,
		name: string,
		sub: string,
		color: string,
		top: number,
		bottom: number,
		domain: [number, number],
		v: (i: number) => number,
		value: (ka: number) => string
	): Row => {
		const sy = scale(domain, [bottom, top]);
		const path = linePath(
			SERIES.map((p, i) => ({ ka: p.ka, v: v(i) })),
			(p) => p.ka,
			(p) => p.v,
			sx,
			sy
		);
		return { id, name, sub, color, top, bottom, domain, path, value };
	};
	const at = (ka: number) => SERIES[clamp(Math.round(800 - ka), 0, 800)];
	const rows: Row[] = [
		row(
			'tilt',
			'Tilt',
			'41,000-year nod',
			'var(--ia-tilt)',
			58,
			118,
			[22, 24.6],
			(i) => SERIES[i].o.tilt,
			(ka) => `${at(ka).o.tilt.toFixed(2)}°`
		),
		row(
			'ecc',
			'Stretch',
			'100,000 & 405,000',
			'var(--ia-ecc)',
			136,
			196,
			[0, 0.052],
			(i) => SERIES[i].o.e,
			(ka) => at(ka).o.e.toFixed(3)
		),
		row(
			'prec',
			'Wobble × stretch',
			'up: closer in June',
			'var(--ia-prec)',
			214,
			274,
			[-0.05, 0.05],
			(i) => -climaticPrecession(SERIES[i].o),
			(ka) => (-climaticPrecession(at(ka).o)).toFixed(3)
		),
		row(
			'sun',
			'Summer sunshine',
			'65° N, June, W/m²',
			'var(--ia-sun)',
			292,
			362,
			[425, 560],
			(i) => SERIES[i].summer,
			(ka) => `${at(ka).summer.toFixed(0)} W/m²`
		)
	];
	const TT = 388;
	const TB = 520;
	const ty = scale([-10.5, 4.5], [TB, TT]);
	const tempPath = linePath(
		TEMPERATURE,
		(p) => p.ka,
		(p) => p.v,
		sx,
		ty
	);
	const signed = (v: number) => (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + Math.abs(v).toFixed(1);

	// ------------------------------------------------------------ playback
	// A run starts when `play` goes on, from the slider's position (or from
	// 800,000 years ago if the slider is at today); `t` going back (a step
	// reset) restarts it from 800,000 years ago.
	const playing = $derived(hasPlay && Boolean(params.play) && !reduced);
	let runFrom = $state(800);
	let runAt = $state(0);
	const runCursor = (tt: number) =>
		tt < runAt ? Math.max(0, 800 - RATE * tt) : Math.max(0, runFrom - RATE * (tt - runAt));
	let wasPlaying = false;
	let stoppedBySlider = false;
	$effect(() => {
		const on = playing;
		untrack(() => {
			if (on) {
				const k = Number(params.ka);
				runFrom = k <= 0.5 ? 800 : k;
				runAt = t;
			} else if (wasPlaying && hasPlay && !stoppedBySlider) {
				// stopped with the toggle: leave the cursor where it was shown
				setParam('ka', Math.round(runCursor(t)));
			}
			wasPlaying = on;
			stoppedBySlider = false;
		});
	});
	// moving the slider during playback stops it
	let lastKa = untrack(() => Number(params.ka));
	$effect(() => {
		const k = Number(params.ka);
		untrack(() => {
			if (k !== lastKa && playing) {
				stoppedBySlider = true;
				setParam('play', false);
			}
			lastKa = k;
		});
	});
	const cursor = $derived(playing ? runCursor(t) : clamp(Number(params.ka), 0, 800));
	const cx = $derived(sx(cursor));

	// ------------------------------------------------------------ terminations (puzzle)
	const ends = terminations();
	const dimRow = (id: string) => (puzzle ? (id === 'ecc' || id === 'sun' ? 1 : 0.4) : 1);
</script>

<g>
	<defs>
		<clipPath id="timeline-past">
			<rect x={X0 - 2} y={0} width={puzzle ? 960 : Math.max(0, cx - X0 + 2)} height={600} />
		</clipPath>
	</defs>

	{#if puzzle}
		{#each ends as tr (tr.to)}
			<rect
				x={sx(tr.from)}
				y={50}
				width={Math.max(3, sx(tr.to) - sx(tr.from))}
				height={TB - 50}
				fill="var(--ia-now)"
				opacity="0.14"
			/>
		{/each}
		<Readout
			id="term-key"
			order={1}
			label="Shaded"
			value="the terminations: an ice age ends"
			color="var(--ia-now)"
		>
			<Label
				x={X1}
				y={36}
				text="shaded: terminations, when an ice age ends"
				anchor="end"
				size={12}
				weight={600}
				color="var(--ia-now)"
			/>
		</Readout>
	{/if}

	{#each rows as r (r.id)}
		<g opacity={dimRow(r.id)}>
			<line x1={X0} x2={X1} y1={r.bottom} y2={r.bottom} stroke="var(--stage-grid)" />
			<path d={r.path} fill="none" stroke={r.color} stroke-width="1.3" opacity="0.3" />
			<path
				d={r.path}
				fill="none"
				stroke={r.color}
				stroke-width="1.8"
				clip-path="url(#timeline-past)"
			/>
			<Readout id="row-{r.id}" order={10} label={r.name} value={r.value(cursor)} color={r.color}>
				<Label
					x={X0 - 12}
					y={r.top + 18}
					text={r.name}
					anchor="end"
					size={12}
					weight={700}
					color={r.color}
				/>
				<Label x={X0 - 12} y={r.top + 33} text={r.sub} anchor="end" size={10} muted />
				<Label
					x={X0 - 12}
					y={r.top + 52}
					text={r.value(cursor)}
					anchor="end"
					size={12}
					weight={600}
				/>
			</Readout>
		</g>
	{/each}

	<!-- temperature -->
	<g opacity={puzzle ? 1 : 1}>
		<line
			x1={X0}
			x2={X1}
			y1={ty(0)}
			y2={ty(0)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 3"
			opacity="0.6"
		/>
		<path
			d={tempPath}
			fill="none"
			stroke="var(--ia-temp)"
			stroke-width="1.5"
			clip-path="url(#timeline-past)"
		/>
		<Readout
			id="row-temp"
			order={11}
			label="Antarctic temperature"
			value="{signed(valueAt(TEMPERATURE, cursor))} °C"
			color="var(--ia-temp)"
		>
			<Label
				x={X0 - 12}
				y={TT + 30}
				text="Antarctica"
				anchor="end"
				size={12}
				weight={700}
				color="var(--ia-temp)"
			/>
			<Label x={X0 - 12} y={TT + 45} text="°C vs last 1,000 yr" anchor="end" size={10} muted />
			<Label
				x={X0 - 12}
				y={TT + 64}
				text="{signed(valueAt(TEMPERATURE, cursor))} °C"
				anchor="end"
				size={12}
				weight={600}
			/>
			<Label x={X0 + 4} y={ty(0) - 5} text="0" anchor="start" size={10} muted />
		</Readout>
	</g>

	<!-- time axis -->
	<line x1={X0} x2={X1} y1={TB + 6} y2={TB + 6} stroke="var(--stage-line)" />
	{#each [800, 700, 600, 500, 400, 300, 200, 100, 0] as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={TB + 6} y2={TB + 10} stroke="var(--stage-line)" />
		<text x={sx(v)} y={TB + 24} text-anchor="middle" font-size="11" class="muted"
			>{v === 0 ? 'today' : v}</text
		>
	{/each}
	<text x={X1} y={TB + 40} text-anchor="end" font-size="11" class="muted">thousand years ago</text>

	<!-- cursor -->
	<line
		x1={cx}
		x2={cx}
		y1={50}
		y2={TB + 6}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		opacity="0.6"
	/>
	<circle
		{cx}
		cy={ty(valueAt(TEMPERATURE, cursor))}
		r="4.5"
		fill="var(--ia-temp)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout id="when" order={0} label="Time" value={agoText(cursor)}>
		<Label
			x={clamp(cx, X0 + 80, X1 - 80)}
			y={TB + 62}
			text={agoText(cursor)}
			size={14}
			weight={700}
			pill
		/>
	</Readout>
	{#if !puzzle}
		<Readout id="title">
			<Label
				x={X0}
				y={36}
				text="Three orbital cycles, the summer sunshine they make, and the ice-core record"
				anchor="start"
				size={14}
				weight={700}
			/>
		</Readout>
	{/if}
</g>
