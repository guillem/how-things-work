<script lang="ts">
	/**
	 * Two close targets around 9 km and one pulse (../model.ts `echo`, sampled every 7.5 m of
	 * range). Top: the pulse that was sent, drawn as long as it is in range (cτ/2) with a
	 * schematic carrier, its cycles tightening for a chirp. Middle: the raw echo in dB above the
	 * noise of one sample. Bottom: the matched filter's output in dB above its noise floor, with
	 * the 13 dB detection threshold. A copy of the pulse slides along the raw echo and the output
	 * is drawn behind it (5 s, then a second's pause); reduced motion shows it complete. Hint
	 * `mode` 'plain' (the `tau` control) or 'chirp' (the `wave`, `bw` and `ctau` controls);
	 * `rcs` the targets' cross-section.
	 */
	import { Axes, Label, clamp, cycle, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, bandwidthOf, countEchoes, echo, snrDb, type Waveform } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const chirpStep = $derived(step.hints?.mode === 'chirp');
	const rcs = $derived(Number(step.hints?.rcs ?? 1));
	const gap = $derived(Number(params.gap ?? 400));
	const w: Waveform = $derived(
		chirpStep
			? String(params.wave ?? 'chirp') === 'plain'
				? { kind: 'plain', duration: Number(params.ctau ?? 20) * 1e-6 }
				: {
						kind: 'chirp',
						duration: Number(params.ctau ?? 20) * 1e-6,
						bandwidth: Number(params.bw ?? 5) * 1e6
					}
			: { kind: 'plain', duration: Number(params.tau ?? 2) * 1e-6 }
	);
	const r1 = $derived(9000 - gap / 2);
	const r2 = $derived(9000 + gap / 2);

	const R0 = 5500;
	const R1 = 12500;
	const sx = scale([R0, R1], [90, 900]);
	const syRaw = scale([-10, 40], [270, 150]);
	const syOut = scale([-5, 50], [520, 330]);

	const tr = $derived(
		echo(
			w,
			[
				{ r: r1, rcs },
				{ r: r2, rcs, phase: Math.PI / 2 }
			],
			R0,
			R1,
			20e6,
			{ seed: 21 }
		)
	);
	const pts = $derived(
		Array.from(tr.range, (r, i) => ({
			r,
			raw: clamp(tr.raw[i], -10, 40),
			out: clamp(tr.out[i], -5, 50)
		}))
	);
	const rawPath = $derived(
		linePath(
			pts,
			(d) => d.r,
			(d) => d.raw,
			sx,
			syRaw
		)
	);

	// the sliding copy of the pulse: its start sweeps the window
	const u = $derived(reduced ? 1 : clamp((cycle(t, 6) * 6) / 5));
	const at = $derived(R0 + u * (R1 - R0));
	const outPath = $derived(
		linePath(
			reduced ? pts : pts.filter((d) => d.r <= at),
			(d) => d.r,
			(d) => d.out,
			sx,
			syOut
		)
	);
	const outFaint = $derived(
		linePath(
			pts,
			(d) => d.r,
			(d) => d.out,
			sx,
			syOut
		)
	);

	const len = $derived((C * w.duration) / 2); // the pulse's length in range
	const res = $derived(C / (2 * bandwidthOf(w)));
	const snr = $derived(snrDb(9000, rcs, w.duration));
	const seen = $derived(
		countEchoes(tr.out, 13, 3, w.kind === 'chirp' ? Math.round((3 * res) / 7.5) : 0)
	);

	// the pulse that was sent, schematic: up to 40 carrier cycles over its length
	const sent = $derived.by(() => {
		const x0 = sx(R0);
		const px = sx(R0 + len) - x0;
		const n = 240;
		const cycles = clamp(w.duration * 1e6 * 2, 1.5, 40);
		let d = '';
		for (let i = 0; i <= n; i++) {
			const v = i / n;
			// a chirp's phase runs as the square of time: its cycles tighten as it goes
			const ph =
				w.kind === 'chirp'
					? 2 * Math.PI * cycles * (0.25 * v + 0.75 * v * v)
					: 2 * Math.PI * cycles * v;
			d += `${i ? 'L' : 'M'}${(x0 + v * px).toFixed(1)} ${(92 - 16 * Math.sin(ph)).toFixed(1)}`;
		}
		return d;
	});
	const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
	const mhz = $derived((bandwidthOf(w) / 1e6).toFixed(bandwidthOf(w) < 1e6 ? 2 : 1));
	const wname = $derived(
		w.kind === 'chirp'
			? `chirp, ${(w.duration * 1e6).toFixed(0)} µs sweeping ${mhz} MHz`
			: `plain pulse, ${+(w.duration * 1e6).toFixed(1)} µs`
	);
</script>

<g>
	<Readout id="title" order={1} label="Sent" value={wname}>
		<Label x={24} y={34} text="sent: {wname}" size={15} weight={600} anchor="start" />
	</Readout>
	<path
		d={sent}
		fill="none"
		stroke="var(--rs-pulse)"
		stroke-width={w.duration < 1e-6 ? 2.5 : 1.4}
		stroke-linejoin="round"
	/>
	<Readout id="len">
		<Label
			x={Math.min(880, sx(R0 + len) + 10)}
			y={96}
			text="{fmtM(len)} long in range (c × τ ÷ 2)"
			size={11}
			anchor={sx(R0 + len) > 700 ? 'end' : 'start'}
			muted
		/>
	</Readout>

	<!-- raw echo -->
	<Axes {sx} sy={syRaw} xTicks={[]} yTicks={[0, 20, 40]} yLabel="raw (dB)" />
	<path d={rawPath} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1" />
	{#if !reduced && u < 1}
		<rect
			x={sx(at)}
			y={syRaw(40)}
			width={Math.max(2, sx(Math.min(R1, at + len)) - sx(at))}
			height={syRaw(-10) - syRaw(40)}
			fill="var(--rs-pulse)"
			opacity="0.12"
		/>
		<line
			x1={sx(at)}
			x2={sx(at)}
			y1={syRaw(40)}
			y2={syOut(-5)}
			stroke="var(--rs-pulse)"
			stroke-width="1.2"
			opacity="0.6"
		/>
	{/if}
	<Readout id="rawlab">
		<Label x={900} y={140} text="what comes back: echoes plus noise" size={12} anchor="end" muted />
	</Readout>

	<!-- matched filter output -->
	<Axes
		{sx}
		sy={syOut}
		xTicks={[6000, 7000, 8000, 9000, 10000, 11000, 12000]}
		xFormat={(v) => `${v / 1000}`}
		yTicks={[0, 10, 20, 30, 40, 50]}
		xLabel="range (km)"
		yLabel="filtered (dB)"
	/>
	<line
		x1={sx(R0)}
		x2={sx(R1)}
		y1={syOut(13)}
		y2={syOut(13)}
		stroke="var(--rs-hit)"
		stroke-dasharray="5 4"
		opacity="0.8"
	/>
	<Readout id="thr">
		<Label
			x={sx(R1) - 4}
			y={syOut(13) - 6}
			text="13 dB: detection threshold"
			size={11}
			anchor="end"
			color="var(--rs-hit)"
		/>
	</Readout>
	<path d={outFaint} fill="none" stroke="var(--rs-a)" stroke-width="1" opacity="0.2" />
	<path d={outPath} fill="none" stroke="var(--rs-a)" stroke-width="1.8" stroke-linejoin="round" />
	{#each [r1, r2] as r, i (i)}
		<path d="M{sx(r)} {syOut(-5) + 4} l-5 9 h10 Z" fill={i === 0 ? 'var(--rs-a)' : 'var(--rs-b)'} />
	{/each}
	<Readout id="truth">
		<Label
			x={sx(r2) + 10}
			y={syOut(-5) + 13}
			text="the two targets, {Math.round(gap)} m apart"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
	<Readout id="mflab">
		<Label x={900} y={322} text="after the matched filter" size={12} anchor="end" muted />
	</Readout>

	<!-- readouts -->
	<g>
		<Readout id="res" order={2} label="Range resolution" value="c ÷ (2B) ≈ {fmtM(res)}">
			<Label
				x={24}
				y={578}
				text="bandwidth ≈ {mhz} MHz → resolution c ÷ (2B) ≈ {fmtM(res)}"
				size={13}
				anchor="start"
				weight={600}
				tabular
			/>
		</Readout>
		<Readout id="snr" order={3} label="Peak above the noise" value="{snr.toFixed(0)} dB">
			<Label
				x={560}
				y={578}
				text="echo energy → {snr.toFixed(0)} dB above the noise"
				size={13}
				anchor="middle"
				tabular
			/>
		</Readout>
		<Readout
			id="seen"
			order={4}
			label="Echoes over the threshold"
			value={seen === 0 ? 'none' : String(seen)}
			color={seen === 2 ? 'var(--rs-a)' : 'var(--rs-hit)'}
		>
			<Label
				x={936}
				y={578}
				text="echoes over the threshold: {seen === 0 ? 'none' : seen}"
				size={13}
				anchor="end"
				weight={700}
				color={seen === 2 ? 'var(--rs-a)' : 'var(--rs-hit)'}
			/>
		</Readout>
	</g>
</g>
