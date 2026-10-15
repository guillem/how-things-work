<script lang="ts">
	/**
	 * Pulse-echo ultrasound along one line into the belly (`US_LAYERS`). Left:
	 * the probe on the skin and the layers under it, drawn to true depth; a
	 * pulse travels down and echoes travel back up from every boundary (their
	 * strength sets their opacity). Right: what the scanner records, the echo
	 * strength in dB against time (an "A-mode" trace) with the scanner's depth
	 * scale (1540 m/s) on top, and below it the same line drawn as brightness
	 * (one line of an ultrasound picture). The trace fills in as the echoes
	 * arrive. Times come from `echoes()`: true speeds per layer, impedance
	 * reflection, transmission losses and attenuation α₀·f^b (IT'IS).
	 *
	 * The motion is slowed 25,000 times: 1 μs of sound takes 0.025 s.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C_ASSUMED, US_LAYERS, echoes, wavelengthMm, type Echo } from '../imaging';

	let { t, params, reduced }: StageProps = $props();

	const f = $derived(Number(params.frequency ?? 3.5));
	const gel = $derived(Boolean(params.gel ?? true));
	const list = $derived(echoes(f, gel));

	// ---- the column ----------------------------------------------------------------------
	const COL_X = 150;
	const COL_W = 130;
	const TOP = 92; // probe face
	const PXCM = 36;
	const NAMES: Record<string, string> = {
		skin: 'skin',
		subcutaneousFat: 'fat',
		muscle: 'muscle',
		liver: 'liver',
		blood: 'blood vessel',
		bone: 'bone',
		water: 'gel',
		air: 'air'
	};
	const FILL: Record<string, string> = {
		skin: 'var(--mi-skin)',
		subcutaneousFat: 'var(--mi-fat)',
		muscle: 'var(--mi-muscle)',
		liver: 'var(--mi-liver)',
		blood: 'var(--mi-blood)',
		bone: 'var(--mi-bone)'
	};
	const coupling = $derived(gel ? 0.1 : 0.01);
	const layers = $derived.by(() => {
		let d = coupling;
		return US_LAYERS.map((l, i) => {
			const y0 = TOP + d * PXCM;
			d += l.d;
			return { i, tissue: l.tissue, y0, y1: TOP + d * PXCM };
		});
	});
	const bottom = $derived(layers[layers.length - 1].y1);

	// ---- time ---------------------------------------------------------------------------------
	const SLOW = 0.025; // s of animation per μs
	const T_END = 190; // μs shown
	const CYCLE = T_END * SLOW + 1.5;
	const tau = $derived(reduced ? T_END : Math.min(T_END, (t % CYCLE) / SLOW)); // μs

	/** True depth (cm) the outgoing pulse has reached at time τ (μs), piecewise by layer. */
	const downDepth = (tt: number): number => {
		// echo i's one-way time is list[i].time / 2 at depth list[i].depth
		let prevT = 0;
		let prevD = 0;
		for (const e of list) {
			const et = e.time / 2;
			if (tt <= et) return prevD + ((e.depth - prevD) * (tt - prevT)) / Math.max(et - prevT, 1e-9);
			prevT = et;
			prevD = e.depth;
		}
		return prevD + 1;
	};
	const blocked = $derived(!gel);
	const pulseDepth = $derived(blocked ? Math.min(downDepth(tau), 0.01) : downDepth(tau));
	const pulseOn = $derived(!reduced && tau < (list[list.length - 1]?.time ?? 0) / 2 + 2);

	/** Strength 0–1 for drawing, from dB (−100 dB → 0). */
	const strength = (dB: number) => Math.max(0, Math.min(1, (dB + 100) / 100));
	const upEchoes = $derived(
		list
			.map((e, i) => {
				const half = e.time / 2;
				if (reduced || tau < half || tau > e.time) return null;
				const depth = e.depth * (1 - (tau - half) / half);
				return { i, y: TOP + depth * PXCM, o: strength(e.dB) };
			})
			.filter((e): e is { i: number; y: number; o: number } => e !== null && e.o > 0.02)
	);

	// ---- the trace ----------------------------------------------------------------------------
	const TX = 380;
	const TW = 540;
	const TY = 120;
	const TH = 220;
	const tx = (us: number) => TX + (us / T_END) * TW;
	const ty = (dB: number) => TY + TH - strength(dB) * TH;
	const pulseUs = $derived(2 / f); // two cycles
	const arrived = $derived(list.filter((e) => e.time <= tau));
	const labelled = $derived(
		list.filter((e) => strength(e.dB) > 0.05 && e.R > 1e-4 && !(gel && e.from === 'water'))
	);
	const nm = (k: string) => (k === 'water' && !gel ? 'probe' : (NAMES[k] ?? k));
	const shortName = (e: Echo) => `${nm(e.from)}/${nm(e.to)}`;

	// brightness strip
	const BY = 400;
	const BH = 34;

	const deepest = $derived(list[list.length - 1]);
	const lambda = $derived(wavelengthMm(f));
</script>

<g>
	<!-- probe -->
	<rect x={COL_X + 15} y={TOP - 46} width={COL_W - 30} height={40} rx="8" fill="var(--mi-tube)" />
	<rect x={COL_X + 10} y={TOP - 8} width={COL_W - 20} height={8} rx="2" fill="var(--mi-detector)" />
	<Label x={COL_X + COL_W / 2} y={TOP - 56} text="probe ({f} MHz)" />
	<!-- coupling layer -->
	<rect
		x={COL_X}
		y={TOP}
		width={COL_W}
		height={Math.max(2, coupling * PXCM)}
		fill={gel ? 'var(--mi-gel)' : 'var(--stage-bg)'}
		stroke={gel ? 'none' : 'var(--mi-echo)'}
		stroke-dasharray="2 2"
	/>
	<!-- layers -->
	{#each layers as l (l.i)}
		<rect
			x={COL_X}
			y={l.y0}
			width={COL_W}
			height={l.y1 - l.y0}
			fill={FILL[l.tissue]}
			stroke="var(--stage-line)"
			stroke-width="0.8"
			opacity={blocked ? 0.5 : 1}
		/>
	{/each}
	<Readout id="layers">
		{#each layers as l (l.i)}
			{#if l.y1 - l.y0 > 14}
				<Label x={COL_X - 8} y={(l.y0 + l.y1) / 2 + 4} anchor="end" text={NAMES[l.tissue]} />
			{/if}
		{/each}
		<Label
			x={COL_X - 8}
			y={TOP + 6}
			anchor="end"
			muted
			text={gel ? 'gel, skin' : 'air gap, skin'}
		/>
		{#each [0, 2, 4, 6, 8, 10, 12] as d (d)}
			<line
				x1={COL_X + COL_W}
				y1={TOP + d * PXCM}
				x2={COL_X + COL_W + 5}
				y2={TOP + d * PXCM}
				stroke="var(--stage-ink-muted)"
			/>
			<Label x={COL_X + COL_W + 8} y={TOP + d * PXCM + 4} anchor="start" muted text={String(d)} />
		{/each}
		<Label x={COL_X + COL_W + 8} y={bottom + 20} anchor="start" muted text="cm" />
	</Readout>

	<!-- the pulse and its echoes -->
	{#if pulseOn}
		<rect
			x={COL_X + 4}
			y={TOP + pulseDepth * PXCM - 4}
			width={COL_W - 8}
			height="8"
			rx="3"
			fill="var(--mi-sound)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity="0.9"
		/>
	{/if}
	{#each upEchoes as e (e.i)}
		<rect
			x={COL_X + 14}
			y={e.y - 3}
			width={COL_W - 28}
			height="6"
			rx="2"
			fill="var(--mi-echo)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={0.25 + 0.75 * e.o}
		/>
	{/each}

	<!-- ================= the trace ================= -->
	<text x={TX} y={TY - 40} font-weight="600" font-size="15">What the probe hears</text>
	<line x1={TX} y1={TY + TH} x2={TX + TW} y2={TY + TH} stroke="var(--stage-line)" />
	<line x1={TX} y1={TY} x2={TX} y2={TY + TH} stroke="var(--stage-line)" />
	{#each [0, -50, -100] as d (d)}
		<Label x={TX - 6} y={ty(d) + 4} anchor="end" muted text="{d} dB" />
	{/each}
	{#each [0, 50, 100, 150] as us (us)}
		<Label x={tx(us)} y={TY + TH + 18} muted text="{us} μs" />
	{/each}
	<!-- scanner's depth scale on top -->
	{#each [0, 2, 4, 6, 8, 10, 12, 14] as d (d)}
		{@const us = ((2 * d) / 100 / C_ASSUMED) * 1e6}
		<line x1={tx(us)} y1={TY - 4} x2={tx(us)} y2={TY} stroke="var(--stage-ink-muted)" />
		<Label x={tx(us)} y={TY - 10} muted text={String(d)} />
	{/each}
	<Label
		x={TX + TW}
		y={TY - 24}
		anchor="end"
		muted
		text="depth the scanner draws, cm (at 1540 m/s)"
	/>
	{#if !reduced}
		<line
			x1={tx(tau)}
			y1={TY}
			x2={tx(tau)}
			y2={TY + TH}
			stroke="var(--mi-sound)"
			stroke-width="1"
			opacity="0.5"
		/>
	{/if}
	{#each arrived as e (e.depth)}
		{@const w = Math.max(2, (pulseUs / T_END) * TW)}
		{@const s = strength(e.dB)}
		{#if s > 0}
			<rect
				x={tx(e.time) - w / 2}
				y={ty(e.dB)}
				width={w}
				height={TY + TH - ty(e.dB)}
				fill="var(--mi-echo)"
			/>
		{/if}
	{/each}
	<Readout id="echolabels">
		{#each labelled.filter((e) => e.time <= tau) as e, i (e.depth)}
			<Label
				x={tx(e.time) + 6}
				y={ty(e.dB) - 6 - (i % 2) * 14}
				anchor="start"
				text={shortName(e)}
			/>
		{/each}
	</Readout>

	<!-- brightness line -->
	<rect x={TX} y={BY} width={TW} height={BH} fill="var(--mi-panel)" stroke="var(--border)" />
	{#each arrived as e (e.depth)}
		{@const s = strength(e.dB)}
		{#if s > 0}
			<rect
				x={tx(e.time) - Math.max(1.5, (pulseUs / T_END) * TW) / 2}
				y={BY}
				width={Math.max(1.5, (pulseUs / T_END) * TW)}
				height={BH}
				fill="#fff"
				opacity={s}
			/>
		{/if}
	{/each}
	<Readout id="bhead">
		<Label
			x={TX}
			y={BY - 8}
			anchor="start"
			muted
			text="the same line as brightness: one line of an ultrasound picture"
		/>
	</Readout>

	<!-- readouts -->
	{#if gel}
		{@const fm = list.find((e) => e.from === 'subcutaneousFat')}
		{#if fm}
			<Readout
				id="fm"
				order={1}
				label="Fat → muscle echo"
				value="{fm.time.toFixed(1)} μs → drawn at {fm.shown.toFixed(2)} cm"
				note="true depth {fm.depth.toFixed(2)} cm; {(fm.R * 100).toFixed(1)}% reflected"
			>
				<Label
					x={TX}
					y={470}
					anchor="start"
					text="fat → muscle: echo after {fm.time.toFixed(1)} μs, drawn at {fm.shown.toFixed(
						2
					)} cm (true {fm.depth.toFixed(2)} cm), {(fm.R * 100).toFixed(1)}% reflected"
				/>
			</Readout>
		{/if}
		<Readout
			id="bone"
			order={2}
			label="Echo from the bone"
			value="{(deepest.R * 100).toFixed(0)}% reflected, {deepest.dB.toFixed(0)} dB"
		>
			<Label
				x={TX}
				y={494}
				anchor="start"
				text="liver → bone: {(deepest.R * 100).toFixed(
					0
				)}% reflected; back at the probe {deepest.dB.toFixed(0)} dB"
			/>
		</Readout>
	{:else}
		<Readout
			id="air"
			order={1}
			label="Probe → air"
			value="{(list[0].R * 100).toFixed(2)}% reflected"
			note="no sound gets into the body"
		>
			<Label
				x={TX}
				y={470}
				anchor="start"
				text="probe → air: {(list[0].R * 100).toFixed(
					2
				)}% reflected; the deepest echo comes back at {deepest.dB.toFixed(0)} dB"
			/>
		</Readout>
	{/if}
	<Readout
		id="wave"
		order={3}
		label="Wavelength"
		value="{lambda.toFixed(2)} mm"
		note="pulse of two cycles: echoes {lambda.toFixed(2)} mm apart can be told apart"
	>
		<Label
			x={TX}
			y={518}
			anchor="start"
			muted
			text="wavelength {lambda.toFixed(
				2
			)} mm: a two-cycle pulse separates echoes about {lambda.toFixed(2)} mm apart"
		/>
	</Readout>
	<Readout id="slow">
		<Label
			x={TX}
			y={570}
			anchor="start"
			muted
			text="slowed 25,000 times · all sound, no ionising radiation"
		/>
	</Readout>
</g>
