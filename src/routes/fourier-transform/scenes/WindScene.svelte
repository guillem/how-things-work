<script lang="ts">
	/**
	 * How the transform measures one frequency (step `wind`).
	 *
	 * Top left: eight seconds of the chosen waveform (it repeats every second),
	 * with a dot running along it. Right: the same eight seconds wound round a
	 * circle at `params.windK` turns per second, clockwise: the value at time s
	 * is drawn at distance |value| from the middle, at angle −2πks (on the
	 * opposite side when it is negative). Eight seconds rather than one keep the
	 * leftovers between whole frequencies small, so the peaks stand out. A
	 * dot runs along the wound curve in step with the one on the signal. The
	 * centre of mass of the wound curve is marked; twice its distance from
	 * the middle is the strength of that frequency (`wind`, `strengthAt`).
	 * Bottom: the strength at every winding speed from 0 to 8, with the
	 * current one marked. It peaks at the waveform's own frequencies.
	 */
	import { cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { num, strengthAt, wind } from '../fourier';
	import { samplesPath, theWave, waveSource } from '../signals';

	let { t, params, reduced }: StageProps = $props();

	const TAU = 2 * Math.PI;
	const SECONDS = 8; // seconds of signal wound
	const SWEEP = 32; // seconds of animation for the dot to run through them

	// ---- geometry ----------------------------------------------------------
	const SX0 = 40;
	const SX1 = 440;
	const SCY = 170;
	const SU = 72;
	const WX = 708; // the winding's middle
	const WY = 214;
	const WR = 150; // px for the waveform's largest value
	const PX0 = 60; // the strength plot
	const PX1 = 920;
	const PY = 540;
	const PH = 120;
	const KMAX = 8;

	const shape = $derived(String(params.shape ?? 'square'));
	const samples = $derived(waveSource(shape, String(params['ft:wave'] ?? '')));
	const k = $derived(Math.max(0, Math.min(KMAX, Number(params.windK ?? 1))));
	const peakAbs = $derived(samples ? Math.max(...samples.map(Math.abs), 0.2) : 1);
	const wr = $derived(WR / peakAbs);

	const wound = $derived(samples ? wind(samples, k, SECONDS) : null);
	const woundPath = $derived.by(() => {
		if (!wound) return '';
		const pts = wound.points;
		let d = '';
		for (let j = 0; j <= pts.length; j++) {
			const p = pts[j % pts.length];
			d += `${j ? 'L' : 'M'}${(WX + wr * p.re).toFixed(1)} ${(WY - wr * p.im).toFixed(1)}`;
		}
		return d;
	});
	const centre = $derived(wound ? wound.centre : { re: 0, im: 0 });
	const dist = $derived(Math.hypot(centre.re, centre.im));
	const strength = $derived(k < 1e-9 ? dist : 2 * dist);
	const signalPath = $derived.by(() => {
		if (!samples) return '';
		const w = (SX1 - SX0) / SECONDS;
		return Array.from({ length: SECONDS }, (_, i) =>
			samplesPath(samples, SX0 + i * w, SX0 + (i + 1) * w, SCY, SU)
		).join(' ');
	});

	// The strength at every winding speed, worked out once per waveform.
	const curve = $derived.by(() => {
		if (!samples) return { path: '', max: 1 };
		const ks = Array.from({ length: KMAX * 100 + 1 }, (_, i) => i / 100);
		const s = ks.map((kk) => strengthAt(samples, kk, SECONDS));
		const max = Math.max(...s, 0.3);
		const path = ks
			.map(
				(kk, i) =>
					`${i ? 'L' : 'M'}${(PX0 + ((PX1 - PX0) * kk) / KMAX).toFixed(1)} ${(PY - (PH * s[i]) / max).toFixed(1)}`
			)
			.join(' ');
		return { path, max };
	});
	const kx = $derived(PX0 + ((PX1 - PX0) * k) / KMAX);
	const ky = $derived(PY - (PH * strength) / curve.max);

	// The running dot: time u in the signal, and where it lands on the winding.
	const u = $derived(cycle(reduced ? 2.5 : t, SWEEP));
	const value = $derived.by(() => {
		if (!samples) return 0;
		const N = samples.length;
		const f = ((u * SECONDS) % 1) * N;
		const i = Math.floor(f);
		return samples[i % N] * (1 - (f - i)) + samples[(i + 1) % N] * (f - i);
	});
	const angle = $derived(-TAU * k * SECONDS * u);
	const dot = $derived({
		x: WX + wr * value * Math.cos(angle),
		y: WY - wr * value * Math.sin(angle)
	});
	// The direction the winding points now (a faint arm, both ways for negative values).
	const arm = $derived({
		x: WX + (WR + 18) * Math.cos(angle),
		y: WY - (WR + 18) * Math.sin(angle)
	});
	const isWhole = $derived(Math.abs(k - Math.round(k)) < 1e-6);
	const kText = $derived(isWhole ? `${Math.round(k)}` : num(k));
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	{#if !samples}
		<!-- <Readout>: on narrow screens these are listed as HTML under the stage -->
		<Readout
			id="empty"
			order={1}
			label="Nothing drawn yet"
			value="draw a waveform on the top graph of “The spectrum” or “Draw any waveform”"
			note="or pick one of the other waveforms"
		>
			{@render txt(480, 280, 'Nothing drawn yet', 22, { anchor: 'middle', weight: 600 })}
			{@render txt(
				480,
				312,
				'Draw a waveform on the top graph of “The spectrum” or “Draw any waveform”,',
				14,
				{ anchor: 'middle', muted: true }
			)}
			{@render txt(480, 334, 'or pick one of the other waveforms.', 14, {
				anchor: 'middle',
				muted: true
			})}
		</Readout>
	{:else}
		<!-- ================= the signal ================= -->
		<Readout id="signal" order={1} label="Top left" value="{SECONDS} seconds of {theWave(shape)}">
			{@render txt(SX0, 40, `${SECONDS} seconds of ${theWave(shape)}`, 17, {
				weight: 600
			})}
		</Readout>
		{#each [-1, 1] as v (v)}
			<line x1={SX0} x2={SX1} y1={SCY - SU * v} y2={SCY - SU * v} stroke="var(--stage-grid)" />
		{/each}
		<line x1={SX0} x2={SX1} y1={SCY} y2={SCY} stroke="var(--stage-line)" />
		<path d={signalPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.2" />
		<line
			x1={SX0 + (SX1 - SX0) * u}
			x2={SX0 + (SX1 - SX0) * u}
			y1={SCY}
			y2={SCY - SU * value}
			stroke="var(--ft-wind)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle
			cx={SX0 + (SX1 - SX0) * u}
			cy={SCY - SU * value}
			r="6"
			fill="var(--ft-wind)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		{@render txt(SX0, SCY + SU + 26, '0 s', 12, { muted: true })}
		{@render txt(SX1, SCY + SU + 26, `${SECONDS} s`, 12, { anchor: 'end', muted: true })}

		<!-- readouts -->
		<Readout
			id="winding"
			order={2}
			label="Winding"
			value="{kText} turn{k === 1 ? '' : 's'} per second, clockwise"
			color="var(--ft-wind)"
		>
			{@render txt(
				SX0,
				322,
				`Winding: ${kText} turn${k === 1 ? '' : 's'} per second, clockwise`,
				15,
				{
					weight: 600,
					color: 'var(--ft-wind)'
				}
			)}
		</Readout>
		<Readout
			id="centre"
			order={3}
			label="Centre of mass"
			value="{num(dist, 3)} from the middle"
			note="of the wound curve"
			color="var(--ft-bar)"
		>
			{@render txt(SX0, 348, `centre of mass: ${num(dist, 3)} from the middle`, 15, {
				weight: 600,
				color: 'var(--ft-bar)'
			})}
		</Readout>
		<Readout
			id="strength"
			order={4}
			label={k < 1e-9 ? 'No winding' : `Strength of ${kText} Hz`}
			value={k < 1e-9
				? `the centre is the average, ${num(centre.re, 3)}`
				: `2 × ${num(dist, 3)} = ${num(strength, 3)}`}
		>
			{@render txt(
				SX0,
				374,
				k < 1e-9
					? `no winding: the centre is the average, ${num(centre.re, 3)}`
					: `strength of ${kText} Hz = 2 × ${num(dist, 3)} = ${num(strength, 3)}`,
				15,
				{ weight: 700 }
			)}
		</Readout>

		<!-- ================= the winding ================= -->
		<circle cx={WX} cy={WY} r={wr} fill="none" stroke="var(--stage-grid)" stroke-dasharray="4 5" />
		<line x1={WX - WR - 24} x2={WX + WR + 24} y1={WY} y2={WY} stroke="var(--stage-grid)" />
		<line x1={WX} x2={WX} y1={WY - WR - 24} y2={WY + WR + 24} stroke="var(--stage-grid)" />
		<line
			x1={2 * WX - arm.x}
			y1={2 * WY - arm.y}
			x2={arm.x}
			y2={arm.y}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 5"
			opacity="0.7"
		/>
		<path
			d={woundPath}
			fill="var(--ft-wind)"
			fill-opacity="0.07"
			stroke="var(--ft-wind)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<circle
			cx={dot.x}
			cy={dot.y}
			r="6"
			fill="var(--ft-wind)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<!-- the centre of mass -->
		<line
			x1={WX}
			y1={WY}
			x2={WX + wr * centre.re}
			y2={WY - wr * centre.im}
			stroke="var(--ft-bar)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={WX} cy={WY} r="3" fill="var(--stage-ink)" />
		<circle
			cx={WX + wr * centre.re}
			cy={WY - wr * centre.im}
			r="8"
			fill="var(--ft-bar)"
			stroke="var(--stage-bg)"
			stroke-width="2.5"
		/>
		<Readout id="centre-label">
			{@render txt(WX + WR + 30, 50, 'centre of mass', 13, {
				anchor: 'end',
				weight: 600,
				color: 'var(--ft-bar)'
			})}
			{@render txt(WX + WR + 30, 68, 'of the wound curve', 12, { anchor: 'end', muted: true })}
		</Readout>

		<!-- ================= strength at every winding speed ================= -->
		<line x1={PX0} x2={PX1} y1={PY} y2={PY} stroke="var(--stage-line)" stroke-width="1.5" />
		{#each Array.from({ length: KMAX + 1 }, (_, i) => i) as n (n)}
			{@const x = PX0 + ((PX1 - PX0) * n) / KMAX}
			<line x1={x} x2={x} y1={PY} y2={PY + 5} stroke="var(--stage-line)" />
			{@render txt(x, PY + 20, `${n}`, 12, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt(PX1, PY + 38, 'winding speed (turns per second) →', 12, {
			anchor: 'end',
			muted: true
		})}
		<Readout
			id="curve-key"
			order={10}
			label="bottom: strength found at each winding speed"
			color="var(--ft-bar)"
		>
			{@render txt(PX0, PY - PH - 14, 'strength found at each winding speed', 13, {
				weight: 600
			})}
		</Readout>
		<path d={curve.path} fill="none" stroke="var(--ft-bar)" stroke-width="2" opacity="0.85" />
		<line
			x1={kx}
			x2={kx}
			y1={PY}
			y2={ky}
			stroke="var(--ft-wind)"
			stroke-width="2"
			stroke-dasharray="3 3"
		/>
		<circle cx={kx} cy={ky} r="6" fill="var(--ft-bar)" stroke="var(--stage-bg)" stroke-width="2" />
	{/if}
</g>
