<script lang="ts">
	/**
	 * The pulse sequence, top right: the radio pulse (RF), the three gradients and the signal on a
	 * 12 ms time line, with a play head running through the part the step is about.
	 * step.hints.mode:
	 *   slice   — left, the head from the side in the slice gradient (params.gz, mT/m) with the
	 *             slice the pulse (params.offset, kHz) picks; bottom right, the slice zoomed in: how
	 *             far the pulse tips the spins at each height (tipAt, Bloch), arrows tipping while
	 *             the play head crosses the pulse.
	 *   phase   — left, the T2-weighted head with the wave the phase gradient (params.line3 turns
	 *             across the 24 cm) leaves on it, and a column of arrows: each row's twist.
	 *   readout — the same, the readout gradient sweeping kx from −64 to +63 turns at the line's
	 *             ky (params.line4); the signal is the line of the head's exact k-space.
	 */
	import { Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { greyImage } from '../../medical-imaging/scenes/raster';
	import {
		GAMMA_HZ_T,
		magnitude,
		reconstruct,
		sliceThicknessMm,
		slicePositionMm,
		tipAt
	} from '../model';
	import { K_FLOOR, N, WAVE_NEG, WAVE_POS, WHITE, logMagnitude, scan, waveImage } from './shared';

	let { step, t, params, reduced }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'slice'));

	// ---- time ----------------------------------------------------------------------------
	// slice: the pulse (0–4 ms) over 3 s, then 2 s hold. phase: the lobe over 2 s, 2 s hold.
	// readout: 1 s of prephasing, 6 s of sampling, 1 s hold. Reduced motion: a finished pulse,
	// a full twist, the echo's centre.
	const tt = $derived(reduced ? (mode === 'readout' ? 4 : mode === 'phase' ? 3 : 4.5) : t);
	const sliceU = $derived(Math.min(1, (tt % 5) / 3));
	const phaseU = $derived(Math.min(1, (tt % 4) / 2));
	const readT = $derived(tt % 8);
	/** Readout sample index (0–127), or −1 while still prephasing. */
	const sample = $derived(readT < 1 ? -1 : Math.min(N - 1, Math.floor(((readT - 1) / 6) * N)));
	const prephaseU = $derived(Math.min(1, readT));

	const playMs = $derived(
		mode === 'slice'
			? sliceU * 4
			: mode === 'phase'
				? 4 + phaseU * 2
				: readT < 1
					? 4 + prephaseU * 2
					: 6 + Math.min(1, (readT - 1) / 6) * 5
	);

	// ---- the sequence diagram --------------------------------------------------------------
	const DX0 = 560;
	const DX1 = 930;
	const dx = scale([0, 12], [DX0, DX1]);
	const ROWS = { rf: 92, gz: 140, gy: 188, gx: 236, sig: 290 } as const;
	const H = 16;
	const focus = $derived({
		rf: mode === 'slice' ? 1 : 0.4,
		gz: mode === 'slice' ? 1 : 0.4,
		gy: mode === 'phase' || mode === 'readout' ? 1 : 0.4,
		gx: mode === 'readout' ? 1 : 0.4,
		sig: mode === 'readout' ? 1 : 0.4
	});
	const rfPath = (() => {
		const pts: string[] = [];
		for (let i = 0; i <= 80; i++) {
			const ms = (i / 80) * 4;
			const x = 4 * (ms / 4 - 0.5) * 2;
			const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
			const w = 0.54 + 0.46 * Math.cos(2 * Math.PI * (ms / 4 - 0.5));
			pts.push(`${i ? 'L' : 'M'}${dx(ms).toFixed(1)} ${(ROWS.rf - s * w * H).toFixed(1)}`);
		}
		return pts.join(' ');
	})();
	const trap = (y: number, segs: [number, number, number][]) =>
		`M${dx(0)} ${y} ` +
		segs
			.map(
				([a, b, h]) => `L${dx(a)} ${y} L${dx(a) + 3} ${y - h} L${dx(b) - 3} ${y - h} L${dx(b)} ${y}`
			)
			.join(' ') +
		` L${dx(12)} ${y}`;
	const gzPath = trap(ROWS.gz, [
		[0, 4, 12],
		[4, 6, -12]
	]);
	const gxPath = trap(ROWS.gx, [
		[4, 6, -10],
		[6, 11, 8]
	]);
	const lineNow = $derived(
		mode === 'phase'
			? Number(params.line3 ?? 3)
			: mode === 'readout'
				? Number(params.line4 ?? 0)
				: 0
	);
	const gyH = (m: number) => (m / 8) * 14;
	const gyPath = $derived(trap(ROWS.gy, [[4, 6, gyH(lineNow) * (mode === 'phase' ? phaseU : 1)]]));

	// ---- the head ----------------------------------------------------------------------------
	const t2 = scan('t2');
	const base = (() => {
		const m = magnitude(reconstruct(t2));
		return m.map((v) => Math.min(1, v / WHITE));
	})();
	const kTop = Math.log1p(Math.hypot(t2.re[(N / 2) * N + N / 2], 0) / K_FLOOR);
	const kUrl = greyImage(logMagnitude(t2, K_FLOOR), N, N, 0, kTop);

	/** Wave left on the spins: phase 2π(kx x + ky y), kx and ky in turns across the field of view. */
	const turnsX = $derived(mode === 'readout' ? (sample < 0 ? -64 * prephaseU : sample - 64) : 0);
	const turnsY = $derived(
		mode === 'phase' ? Math.round(lineNow * phaseU * 20) / 20 : mode === 'readout' ? lineNow : 0
	);
	const waveUrl = $derived.by(() => {
		if (mode === 'slice') return '';
		const w = new Float64Array(N * N);
		for (let r = 0; r < N; r++) {
			const y = (r - N / 2) / N;
			for (let c = 0; c < N; c++) {
				const x = (c - N / 2) / N;
				w[r * N + c] = Math.cos(2 * Math.PI * (turnsX * x + turnsY * y));
			}
		}
		return waveImage(base, w, N, N, WAVE_POS, WAVE_NEG);
	});
	const IMX = 40;
	const IMY = 100;
	const IMS = 360;

	// twist arrows: one per row band, 32 rows
	const ARROWS = Array.from({ length: 24 }, (_, i) => i);
	const arrowAngle = (i: number) => 2 * Math.PI * turnsY * ((i + 0.5) / 24 - 0.5);

	// the signal along the line
	const lineRow = $derived(Math.round(lineNow) + N / 2);
	const F0 = t2.re[(N / 2) * N + N / 2];
	const sigPath = (part: 're' | 'im', upTo: number) => {
		if (upTo < 0) return '';
		const pts: string[] = [];
		const arr = part === 're' ? t2.re : t2.im;
		for (let c = 0; c <= upTo; c++) {
			const v = arr[lineRow * N + c] / F0;
			const ms = 6 + (c / (N - 1)) * 5;
			pts.push(`${c ? 'L' : 'M'}${dx(ms).toFixed(1)} ${(ROWS.sig - v * 26).toFixed(1)}`);
		}
		return pts.join(' ');
	};
	const shownSample = $derived(mode === 'readout' ? sample : mode === 'phase' ? -1 : -1);
	const sigNow = $derived(
		mode === 'readout' && sample >= 0
			? Math.hypot(t2.re[lineRow * N + sample], t2.im[lineRow * N + sample]) / F0
			: null
	);

	// small k-space map
	const MX = 570;
	const MY = 372;
	const MS = 200;
	const mcell = MS / N;

	// ---- slice --------------------------------------------------------------------------------
	const gz = $derived(Number(params.gz ?? 10));
	const offset = $derived(Number(params.offset ?? 0));
	const thick = $derived(sliceThicknessMm(gz));
	const z0 = $derived(slicePositionMm(gz, offset * 1000));
	const zs = Array.from({ length: 121 }, (_, i) => -12 + i * 0.2);
	/** The zoomed chart is centred on the slice, to the nearest millimetre; zs are relative to it. */
	const zc = $derived(Math.round(z0));
	const profile = $derived(zs.map((z) => tipAt(zc + z, gz, offset * 1000)));
	const zTicks = $derived(
		Array.from({ length: 25 }, (_, i) => i - 12).filter((r) => (zc + r) % 5 === 0)
	);
	const pzx = scale([-12, 12], [570, 920]);
	const pzy = scale([0, 1], [552, 462]);
	const profilePath = $derived(
		profile.map((v, i) => `${i ? 'L' : 'M'}${pzx(zs[i]).toFixed(1)} ${pzy(v).toFixed(1)}`).join(' ')
	);
	const SPIN_Z = Array.from({ length: 25 }, (_, i) => -12 + i);
	const spinTips = $derived(SPIN_Z.map((z) => tipAt(zc + z, gz, offset * 1000, sliceU)));
	// the head from the side: 19 cm tall over 300 px
	const HX = 210;
	const HY = 330;
	const PXCM = 300 / 19;
	const bandY = $derived(HY - (z0 / 10) * PXCM);
	const bandH = $derived(Math.max(2, (thick / 10) * PXCM));
	const kHzPerMm = $derived((GAMMA_HZ_T * gz * 1e-3 * 1e-3) / 1000);
</script>

<g>
	<!-- ================= the sequence diagram ================= -->
	<Label
		anchor="start"
		x={DX0}
		y={56}
		text="the pulse sequence (one repetition)"
		size={14}
		weight={600}
	/>
	{#each [['rf', 'RF'], ['gz', 'G_z slice'], ['gy', 'G_y phase'], ['gx', 'G_x read'], ['sig', 'signal']] as [id, name] (id)}
		{@const y = ROWS[id as keyof typeof ROWS]}
		<g opacity={focus[id as keyof typeof focus]}>
			<line x1={DX0} y1={y} x2={DX1} y2={y} stroke="var(--stage-grid)" />
			<Label x={DX0 - 8} y={y + 4} text={name.replace('_', '')} anchor="end" size={12} />
		</g>
	{/each}
	<path d={rfPath} fill="none" stroke="var(--mk-rf)" stroke-width="2" opacity={focus.rf} />
	<path
		d={gzPath}
		fill="var(--mk-gz)"
		fill-opacity="0.25"
		stroke="var(--mk-gz)"
		stroke-width="1.5"
		opacity={focus.gz}
	/>
	<g opacity={focus.gy}>
		{#each [-8, -4, 4, 8] as m (m)}
			<line
				x1={dx(4) + 3}
				y1={ROWS.gy - gyH(m)}
				x2={dx(6) - 3}
				y2={ROWS.gy - gyH(m)}
				stroke="var(--mk-gy)"
				stroke-opacity="0.35"
				stroke-dasharray="2 2"
			/>
		{/each}
		<path
			d={gyPath}
			fill="var(--mk-gy)"
			fill-opacity="0.3"
			stroke="var(--mk-gy)"
			stroke-width="1.5"
		/>
	</g>
	<path
		d={gxPath}
		fill="var(--mk-gx)"
		fill-opacity="0.25"
		stroke="var(--mk-gx)"
		stroke-width="1.5"
		opacity={focus.gx}
	/>
	{#if mode === 'readout'}
		<path
			d={sigPath('im', N - 1)}
			fill="none"
			stroke="var(--mk-signal)"
			stroke-width="1"
			opacity="0.15"
		/>
		<path
			d={sigPath('re', N - 1)}
			fill="none"
			stroke="var(--mk-signal)"
			stroke-width="1"
			opacity="0.2"
		/>
		<path
			d={sigPath('im', shownSample)}
			fill="none"
			stroke="var(--mk-signal-2)"
			stroke-width="1.5"
		/>
		<path d={sigPath('re', shownSample)} fill="none" stroke="var(--mk-signal)" stroke-width="2" />
	{/if}
	<line
		x1={dx(playMs)}
		y1={ROWS.rf - 26}
		x2={dx(playMs)}
		y2={ROWS.sig + 28}
		stroke="var(--stage-ink)"
		stroke-opacity="0.55"
		stroke-width="1.5"
	/>
	<Label x={dx(0)} y={ROWS.sig + 44} text="0" anchor="middle" size={11} muted />
	<Label x={dx(12)} y={ROWS.sig + 44} text="12 ms" anchor="end" size={11} muted />

	{#if mode === 'slice'}
		<!-- ================= the head from the side ================= -->
		<Label x={HX} y={56} text="the head from the side" anchor="middle" size={14} weight={600} />
		<line
			x1={50}
			y1={HY + 170}
			x2={50}
			y2={HY - 175}
			stroke="var(--mk-gz)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
		<Label anchor="start" x={60} y={HY - 168} text="z" size={13} weight={600} />
		<Label anchor="start" x={60} y={HY + 168} text="weaker field" size={11} muted />
		<Label anchor="start" x={60} y={HY - 150} text="stronger field" size={11} muted />
		<ellipse
			cx={HX}
			cy={HY}
			rx={120}
			ry={150}
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<ellipse
			cx={HX + 6}
			cy={HY + 4}
			rx={100}
			ry={128}
			fill="none"
			stroke="var(--border)"
			stroke-dasharray="3 3"
		/>
		<rect
			x={HX - 125}
			y={bandY - bandH / 2}
			width={250}
			height={bandH}
			fill="var(--mk-line)"
			opacity="0.85"
		/>
		<line
			x1={HX + 125}
			y1={bandY}
			x2={560}
			y2={pzy(1) - 14}
			stroke="var(--mk-line)"
			stroke-dasharray="3 3"
			opacity="0.7"
		/>
		<Readout
			id="slice"
			order={1}
			label="Slice"
			value="{thick.toFixed(2)} mm thick at {z0 >= 0 ? '+' : '−'}{Math.abs(z0).toFixed(1)} mm"
		>
			<Label
				x={HX}
				y={HY + 204}
				text="slice {thick.toFixed(2)} mm thick, at {z0 >= 0 ? '+' : '−'}{Math.abs(z0).toFixed(
					1
				)} mm"
				anchor="middle"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>
		<Readout id="freq" order={2} label="Frequency change" value="{kHzPerMm.toFixed(2)} kHz per mm">
			<Label
				x={HX}
				y={HY + 226}
				text="frequency changes {kHzPerMm.toFixed(2)} kHz per mm"
				anchor="middle"
				size={12}
				muted
				tabular
			/>
		</Readout>

		<!-- ================= the slice, zoomed ================= -->
		<Label
			anchor="start"
			x={570}
			y={392}
			text="the slice zoomed: how far the pulse tips the spins"
			size={13}
			weight={600}
		/>
		<line x1={pzx(-12)} y1={pzy(0)} x2={pzx(12)} y2={pzy(0)} stroke="var(--stage-line)" />
		{#each zTicks as z (z)}
			<line x1={pzx(z)} y1={pzy(0)} x2={pzx(z)} y2={pzy(0) + 4} stroke="var(--stage-line)" />
			<Label x={pzx(z)} y={pzy(0) + 18} text={String(zc + z)} anchor="middle" size={11} muted />
		{/each}
		<Label x={pzx(12)} y={pzy(0) + 34} text="height z (mm)" anchor="end" size={11} muted />
		<path
			d={profilePath}
			fill="var(--mk-line)"
			fill-opacity="0.15"
			stroke="var(--mk-line)"
			stroke-width="2"
		/>
		{#each SPIN_Z as z, i (z)}
			{@const a = Math.asin(Math.min(1, spinTips[i]))}
			<line
				x1={pzx(z)}
				y1={440}
				x2={pzx(z) + Math.sin(a) * 16}
				y2={440 - Math.cos(a) * 16}
				stroke="var(--mk-spin)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
	{:else}
		<!-- ================= the head with its wave ================= -->
		<Label
			anchor="start"
			x={IMX}
			y={78}
			text={mode === 'phase' ? 'the twist each row is left with' : 'the wave the coil is measuring'}
			size={14}
			weight={600}
		/>
		<rect x={IMX - 1} y={IMY - 1} width={IMS + 2} height={IMS + 2} rx="3" fill="#000" />
		<image href={waveUrl} x={IMX} y={IMY} width={IMS} height={IMS} preserveAspectRatio="none" />
		{#each mode === 'phase' ? ARROWS : [] as i (i)}
			{@const y = IMY + ((i + 0.5) / 24) * IMS}
			{@const a = arrowAngle(i)}
			<circle cx={IMX + IMS + 28} cy={y} r="6.5" fill="none" stroke="var(--stage-line)" />
			<line
				x1={IMX + IMS + 28}
				y1={y}
				x2={IMX + IMS + 28 + Math.sin(a) * 6.5}
				y2={y - Math.cos(a) * 6.5}
				stroke="var(--mk-spin)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
		<Readout id="key" order={4} label="Colours" value="orange and blue: opposite phases">
			<Label
				anchor="start"
				x={IMX}
				y={IMY + IMS + 22}
				text="orange and blue: spins pointing opposite ways"
				size={12}
				muted
			/>
		</Readout>
		<Readout
			id="turns"
			order={1}
			label="Turns across 24 cm"
			value="{turnsX.toFixed(0)} left–right, {turnsY.toFixed(mode === 'phase' ? 1 : 0)} top–bottom"
		>
			<Label
				anchor="start"
				x={IMX}
				y={IMY + IMS + 44}
				text="{mode === 'readout' ? `${turnsX.toFixed(0)} turns left–right, ` : ''}{turnsY.toFixed(
					mode === 'phase' ? 1 : 0
				)} turns top to bottom"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>

		<!-- ================= small k-space map ================= -->
		<Label
			anchor="start"
			x={MX}
			y={MY - 12}
			text="where this is in k-space"
			size={13}
			weight={600}
		/>
		<rect x={MX - 1} y={MY - 1} width={MS + 2} height={MS + 2} fill="#000" />
		<image
			href={kUrl}
			x={MX}
			y={MY}
			width={MS}
			height={MS}
			preserveAspectRatio="none"
			opacity="0.45"
		/>
		{#if mode === 'readout'}
			<line
				x1={MX}
				y1={MY + (lineRow + 0.5) * mcell}
				x2={MX + (Math.max(0, sample) + 0.5) * mcell}
				y2={MY + (lineRow + 0.5) * mcell}
				stroke="var(--mk-line)"
				stroke-width="2"
				opacity={sample >= 0 ? 1 : 0}
			/>
		{/if}
		<circle
			cx={MX + (turnsX + N / 2 + 0.5) * mcell}
			cy={MY + (turnsY + N / 2 + 0.5) * mcell}
			r="4.5"
			fill="var(--mk-line)"
			stroke="#000"
		/>
		{#if sigNow !== null}
			<Readout id="sig" order={2} label="Signal" value="{(sigNow * 100).toFixed(1)}% of the centre">
				<Label anchor="start" x={790} y={MY + 40} text="signal" size={12} muted />
				<Label
					anchor="start"
					x={790}
					y={MY + 60}
					text="{(sigNow * 100).toFixed(1)}% of"
					size={14}
					weight={600}
					tabular
				/>
				<Label anchor="start" x={790} y={MY + 78} text="the centre’s" size={12} muted />
			</Readout>
		{/if}
		<Readout id="ky" order={3} label="ky" value="{lineNow} / 24 cm">
			<Label
				anchor="start"
				x={790}
				y={MY + 120}
				text="ky = {lineNow} / 24 cm"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}
</g>
