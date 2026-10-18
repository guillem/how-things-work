<script lang="ts">
	/**
	 * A spin echo. Left: twelve spins of one voxel seen from above, in the frame turning at the
	 * scanner's frequency, from the Bloch equations (spinEchoState): tipped onto +y at 0 ms, a 180°
	 * pulse about y at 25 ms (params.refocus), the echo at 50 ms. Their offsets are quantiles of a
	 * Lorentzian 20 Hz wide; T2 = 100 ms (grey matter). Right: the coil's signal, the length of the
	 * average of 2001 such spins, with and without the 180° pulse, and the T2 envelope.
	 * The animation runs 70 ms of spin time in 10 s; reduced motion shows the echo.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { lorentzSpread, netSignal, spinEchoState } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const T1 = 1.0;
	const T2 = 0.1;
	const TAU = 0.025;
	const WIDTH = 20;
	const END = 0.07;
	const refocus = $derived(params.refocus !== false);
	const ms = $derived(reduced ? 50 : Math.min(70, ((t % 11) / 10) * 70));
	const sec = $derived(ms / 1000);

	const shown = lorentzSpread(12, WIDTH);
	const spins = $derived(spinEchoState(shown, sec, TAU, refocus, T1, T2));
	const many = lorentzSpread(2001, WIDTH);
	const TIMES = Array.from({ length: 141 }, (_, i) => (i / 140) * END);
	const curve = (on: boolean) =>
		TIMES.map((s) => netSignal(spinEchoState(many, s, TAU, on, T1, T2)));
	const withPulse = curve(true);
	const without = curve(false);
	const signal = $derived(netSignal(spinEchoState(many, sec, TAU, refocus, T1, T2)));

	// disc
	const CX = 240;
	const CY = 330;
	const R = 170;
	const hue = (df: number) => {
		const u = Math.max(-1, Math.min(1, df / 60));
		return u >= 0 ? `var(--mk-fast)` : `var(--mk-slow)`;
	};

	// chart
	const sx = scale([0, 70], [520, 920]);
	const sy = scale([0, 1], [470, 150]);
	const path = (vals: number[], upTo = 70) =>
		vals
			.map((v, i) => [TIMES[i] * 1000, v] as const)
			.filter(([m]) => m <= upTo + 1e-9)
			.map(([m, v], i) => `${i ? 'L' : 'M'}${sx(m).toFixed(1)} ${sy(v).toFixed(1)}`)
			.join(' ');
	const envelope = TIMES.map((s) => Math.exp(-s / T2));
	const active = $derived(refocus ? withPulse : without);
	const flash = $derived(refocus && !reduced && ms > 24 && ms < 31);
</script>

<g>
	<!-- the spins, from above -->
	<Label
		x={CX}
		y={86}
		text="12 representative spins of one voxel, from above"
		anchor="middle"
		size={15}
		weight={600}
	/>
	<circle cx={CX} cy={CY} r={R} fill="var(--surface)" stroke="var(--border)" />
	<line x1={CX - R - 10} y1={CY} x2={CX + R + 10} y2={CY} stroke="var(--stage-grid)" />
	<line x1={CX} y1={CY + R + 10} x2={CX} y2={CY - R - 10} stroke="var(--stage-grid)" />
	<Label anchor="start" x={CX + 6} y={CY - R - 14} text="y" size={12} muted />
	<Label anchor="start" x={CX + R + 14} y={CY + 4} text="x" size={12} muted />
	{#each spins as m, i (i)}
		<line
			x1={CX}
			y1={CY}
			x2={CX + m[0] * R * 0.92}
			y2={CY - m[1] * R * 0.92}
			stroke={hue(shown[i])}
			stroke-width="2"
			stroke-linecap="round"
			opacity={0.35 + 0.5 * Math.min(1, Math.abs(shown[i]) / 40)}
		/>
		<circle cx={CX + m[0] * R * 0.92} cy={CY - m[1] * R * 0.92} r="4" fill={hue(shown[i])} />
	{/each}
	<!-- the net magnetisation the coil sees -->
	<line
		x1={CX}
		y1={CY}
		x2={CX}
		y2={CY - signal * R * 0.92}
		stroke="var(--mk-signal)"
		stroke-width="5"
		stroke-linecap="round"
		opacity={signal > 0.02 ? 1 : 0}
	/>
	<circle cx={CX} cy={CY} r="5" fill="var(--stage-ink)" />
	{#if flash}
		<Label x={CX} y={CY + R + 34} text="180° pulse: the fan is flipped over" anchor="middle" pill />
	{/if}
	<Readout
		id="key"
		order={3}
		label="Spins"
		value="orange fast, blue slow; thick: the whole voxel’s average"
	>
		<Label
			anchor="start"
			x={CX - R}
			y={CY + R + 58}
			text="orange: faster · blue: slower · thick: the whole voxel’s average"
			size={12}
			muted
		/>
	</Readout>

	<!-- the signal -->
	<Label anchor="start" x={520} y={86} text="the coil’s signal" size={15} weight={600} />
	<Axes
		{sx}
		{sy}
		xLabel="time (ms)"
		xTicks={[0, 10, 20, 30, 40, 50, 60, 70]}
		yTicks={[0, 0.5, 1]}
	/>
	<path
		d={path(envelope)}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
		stroke-width="1.5"
	/>
	<Label
		x={sx(68)}
		y={sy(Math.exp(-0.068 / T2)) - 8}
		text="e^(−t/T2)"
		anchor="end"
		size={12}
		muted
	/>
	<path
		d={path(refocus ? without : withPulse)}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		opacity="0.4"
	/>
	<path d={path(active)} fill="none" stroke="var(--mk-signal)" stroke-width="1.5" opacity="0.3" />
	<path d={path(active, ms)} fill="none" stroke="var(--mk-signal)" stroke-width="3" />
	<line
		x1={sx(ms)}
		y1={sy(0)}
		x2={sx(ms)}
		y2={sy(1.02)}
		stroke="var(--stage-ink)"
		stroke-opacity="0.35"
	/>
	<!-- pulses -->
	<Label anchor="start" x={sx(0) + 4} y={sy(1.06)} text="90°" size={12} />
	{#if refocus}
		<line x1={sx(25)} y1={sy(0)} x2={sx(25)} y2={sy(1.02)} stroke="var(--mk-rf)" stroke-width="2" />
		<Label x={sx(25)} y={sy(1.06)} text="180°" anchor="middle" size={12} color="var(--mk-rf)" />
		<Label
			x={sx(50)}
			y={sy(Math.exp(-0.5)) - 12}
			text="echo"
			anchor="middle"
			size={13}
			weight={600}
			color="var(--mk-signal)"
		/>
	{/if}
	<Readout id="t" order={1} label="Time" value="{ms.toFixed(0)} ms">
		<Label
			anchor="start"
			x={520}
			y={540}
			text="t = {ms.toFixed(0)} ms"
			size={15}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="s" order={2} label="Signal" value={signal.toFixed(2)}>
		<Label anchor="start" x={660} y={540} text="signal {signal.toFixed(2)}" size={15} tabular />
	</Readout>
	{#if refocus}
		<Readout id="te" order={4} label="Echo" value="e^(−50/100) = 0.61">
			<Label
				anchor="start"
				x={520}
				y={564}
				text="echo at 50 ms: e^(−50/100) = 0.61 of the start"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
