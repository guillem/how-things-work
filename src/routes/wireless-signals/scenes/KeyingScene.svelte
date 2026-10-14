<script lang="ts">
	/**
	 * A carrier and what modulation does to it.
	 *
	 * Top: 8 µs of the transmitted wave s(t) = Re{b(t)·e^{j2πf_c t}} (carrier
	 * drawn at 5 MHz), with the bits of each symbol above it. A cursor sweeps the
	 * window once every 8 s of animation time. Bottom left: the measured spectrum
	 * (dB against the strongest bin, 0–10 MHz) with the band that holds 99% of the
	 * power shaded. Bottom right: the carrier's pointer b(t) at the cursor (length
	 * = amplitude, angle = phase against the reference carrier), with the allowed
	 * constellation points for the digital modes and its path over the last
	 * symbol.
	 *
	 * `step.hints.mode`: 'carrier' | 'am' | 'fm' | 'qpsk' | 'digital' (then
	 * `params.keyMode`: ask/fsk/psk). `hints.focus`: 'spectrum' (the rate and
	 * smoothing controls apply; the pointer panel dims) or 'pointer'.
	 */
	import { Axes, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		AM_DEPTH,
		ASK_LOW,
		FC,
		FSK_DEV,
		bitsPerSymbolOf,
		isDigital,
		spectrum,
		synth,
		textBits,
		type Mode
	} from '../radio';
	import T from './T.svelte';

	let { step, t, params }: StageProps = $props();

	const WINDOW = 8; // µs shown
	const FS = 128; // display samples per µs
	const BITS = textBits('Hi');

	const focus = $derived(String(step.hints?.focus ?? ''));
	const mode = $derived.by((): Mode => {
		const h = String(step.hints?.mode ?? 'carrier');
		if (h === 'digital') {
			const k = String(params.keyMode ?? 'psk');
			return k === 'ask' || k === 'fsk' ? k : 'psk';
		}
		return h as Mode;
	});
	const digital = $derived(isDigital(mode));
	const rate = $derived(focus === 'spectrum' ? Number(params.rate ?? 1) : 1);
	const smooth = $derived(
		focus === 'spectrum' || step.id === 'constellation' ? Boolean(params.smooth) : false
	);
	const k = $derived(bitsPerSymbolOf(mode));

	const sig = $derived(synth(mode, BITS, rate, smooth, FS, WINDOW));
	const spec = $derived(spectrum(mode, rate, smooth));

	// ---- the wave -----------------------------------------------------------------------
	const WX = 44;
	const WW = 872;
	const WY = 176;
	const maxAbs = $derived.by(() => {
		let m = 1;
		for (let i = 0; i < sig.re.length; i++) m = Math.max(m, Math.hypot(sig.re[i], sig.im[i]));
		return m;
	});
	const amp = $derived(64 / maxAbs);
	const xOf = (tus: number) => WX + (tus / WINDOW) * WW;
	const carrierAt = (i: number) => {
		const ph = 2 * Math.PI * FC * (i / FS);
		return sig.re[i] * Math.cos(ph) - sig.im[i] * Math.sin(ph);
	};
	const wavePath = $derived.by(() => {
		let d = '';
		for (let i = 0; i < sig.re.length; i++)
			d += `${i ? 'L' : 'M'}${xOf(i / FS).toFixed(1)} ${(WY - amp * carrierAt(i)).toFixed(1)}`;
		return d;
	});
	const refPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i < sig.re.length; i += 2)
			d += `${i ? 'L' : 'M'}${xOf(i / FS).toFixed(1)} ${(WY - amp * Math.cos(2 * Math.PI * FC * (i / FS))).toFixed(1)}`;
		return d;
	});
	/** AM envelope (dashed): the tone's shape riding on the carrier. */
	const envPath = $derived.by(() => {
		if (mode !== 'am') return '';
		let up = '';
		let dn = '';
		for (let i = 0; i < sig.re.length; i += 4) {
			const x = xOf(i / FS).toFixed(1);
			up += `${i ? 'L' : 'M'}${x} ${(WY - amp * sig.re[i]).toFixed(1)}`;
			dn += `${i ? 'L' : 'M'}${x} ${(WY + amp * sig.re[i]).toFixed(1)}`;
		}
		return up + dn;
	});
	const showRef = $derived(mode !== 'carrier' && mode !== 'am' && mode !== 'ask');

	/** Symbols in the window, with their bits. */
	const symbols = $derived.by(() => {
		if (!digital) return [];
		const T0 = 1 / rate;
		const n = Math.floor(WINDOW * rate + 1e-9);
		return Array.from({ length: n }, (_, s) => ({
			s,
			x0: xOf(s * T0),
			x1: xOf((s + 1) * T0),
			bits: Array.from({ length: k }, (_, j) => BITS[(s * k + j) % BITS.length]).join('')
		}));
	});

	// ---- the cursor (pure function of t) ------------------------------------------------------
	const cursorUs = $derived((t % WINDOW) * 0.999);
	const ci = $derived(Math.min(sig.re.length - 1, Math.floor(cursorUs * FS)));

	// ---- the pointer panel -----------------------------------------------------------------
	const PX = 772;
	const PY = 448;
	const PR = 96;
	const pScale = $derived(PR / maxAbs);
	const pointer = $derived({ x: PX + pScale * sig.re[ci], y: PY - pScale * sig.im[ci] });
	const trail = $derived.by(() => {
		const span = Math.round((digital ? 1 / rate : 0.5) * FS);
		const i0 = Math.max(0, ci - span);
		let d = '';
		for (let i = i0; i <= ci; i++)
			d += `${i === i0 ? 'M' : 'L'}${(PX + pScale * sig.re[i]).toFixed(1)} ${(PY - pScale * sig.im[i]).toFixed(1)}`;
		return d;
	});
	const points = $derived.by(() => {
		if (mode === 'ask')
			return [
				{ i: ASK_LOW, q: 0, bits: '0' },
				{ i: 1, q: 0, bits: '1' }
			];
		if (mode === 'psk')
			return [
				{ i: -1, q: 0, bits: '0' },
				{ i: 1, q: 0, bits: '1' }
			];
		if (mode === 'qpsk')
			return [
				{ i: 1, q: 1, bits: '11' },
				{ i: -1, q: 1, bits: '01' },
				{ i: -1, q: -1, bits: '00' },
				{ i: 1, q: -1, bits: '10' }
			].map((p) => ({ ...p, i: p.i * Math.SQRT1_2, q: p.q * Math.SQRT1_2 }));
		return [];
	});
	const currentBits = $derived.by(() => {
		if (!digital) return '';
		const s = Math.min(symbols.length - 1, Math.floor(cursorUs * rate));
		return symbols[s]?.bits ?? '';
	});

	// ---- the spectrum -----------------------------------------------------------------------
	const sx = scale([0, 10], [70, 540]);
	const sy = scale([-50, 0], [556, 336]);
	const specPath = $derived.by(() => {
		let pmax = 0;
		for (let j = 0; j < spec.power.length; j++) pmax = Math.max(pmax, spec.power[j]);
		let d = '';
		let first = true;
		for (let j = 0; j < spec.freq.length; j++) {
			const f = spec.freq[j];
			if (f < 0 || f > 10) continue;
			const v = Math.max(-50, 10 * Math.log10(Math.max(1e-12, spec.power[j] / pmax)));
			d += `${first ? 'M' : 'L'}${sx(f).toFixed(1)} ${sy(v).toFixed(1)}`;
			first = false;
		}
		return d;
	});
	const bandLo = $derived(Math.max(0, spec.lo));
	const bandHi = $derived(Math.min(10, spec.hi));
	const wide = $derived(spec.lo < 0 || spec.hi > 10);
	const occ = $derived(
		spec.occupied < 0.1
			? 'a single frequency'
			: `${spec.occupied < 10 ? spec.occupied.toFixed(1) : Math.round(spec.occupied)} MHz`
	);

	const modeName: Record<Mode, string> = {
		carrier: 'A plain carrier: 5 MHz',
		am: 'AM: the amplitude follows a 0.5 MHz tone',
		fm: 'FM: the frequency follows a 0.5 MHz tone (±1.5 MHz)',
		ask: 'Amplitude keying: strong = 1, weak = 0',
		fsk: `Frequency keying: ${FC + FSK_DEV} MHz = 1, ${FC - FSK_DEV} MHz = 0`,
		psk: 'Phase keying: in step = 1, flipped = 0',
		qpsk: 'QPSK: four phases, two bits per symbol'
	};
	const rateText = $derived(
		`${rate.toFixed(2).replace(/\.?0+$/, '')} million symbols per second · ${k} bit${k > 1 ? 's' : ''} each`
	);
	const fmt = (v: number) => (v === 0 ? '0' : `${v}`);
</script>

<g>
	<!-- ===== the wave ===== -->
	<Readout id="mode" order={0} label="Signal" value={modeName[mode]}>
		<T x={24} y={34} text={modeName[mode]} size={15} weight={700} />
	</Readout>
	{#if digital}
		<Readout id="rate" order={1} label="Symbols" value={rateText}>
			<T x={936} y={34} text={rateText} size={12} anchor="end" muted />
		</Readout>
	{/if}
	<g opacity={focus === 'spectrum' ? 0.8 : 1}>
		{#each symbols as s (s.s)}
			<line
				x1={s.x0}
				x2={s.x0}
				y1="66"
				y2="248"
				stroke="var(--stage-grid)"
				stroke-dasharray="3 4"
			/>
			<text
				x={(s.x0 + s.x1) / 2}
				y="80"
				text-anchor="middle"
				font-weight="700"
				style:font-size={symbols.length > 10 ? '12px' : '15px'}
				style:fill={currentBits &&
				s.bits === currentBits &&
				cursorUs * rate >= s.s &&
				cursorUs * rate < s.s + 1
					? 'var(--ws-wave)'
					: undefined}
				style:font-variant-numeric="tabular-nums">{s.bits}</text
			>
		{/each}
		{#if showRef}
			<path d={refPath} fill="none" stroke="var(--ws-ref)" stroke-width="1" opacity="0.7" />
		{/if}
		{#if envPath}
			<path
				d={envPath}
				fill="none"
				stroke="var(--ws-env)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}
		<path
			d={wavePath}
			fill="none"
			stroke="var(--ws-wave)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<line x1={WX} x2={WX + WW} y1={WY} y2={WY} stroke="var(--stage-line)" opacity="0.5" />
		<line
			x1={xOf(cursorUs)}
			x2={xOf(cursorUs)}
			y1="90"
			y2="256"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			opacity="0.55"
		/>
		<Readout id="time-axis">
			<T x={WX} y={268} text="0" size={11} muted anchor="middle" />
			<T x={WX + WW} y={268} text="8 µs" size={11} muted anchor="middle" />
			<T x={WX + WW / 2} y={268} text="time →" size={11} muted anchor="middle" />
			{#if showRef}
				<T
					x={WX + WW - 50}
					y={268}
					text="thin grey: the steady reference carrier"
					size={11}
					muted
					anchor="end"
				/>
			{/if}
			{#if mode === 'am'}
				<T
					x={WX + WW - 50}
					y={268}
					text="dashed: the tone being sent"
					size={11}
					muted
					anchor="end"
				/>
			{/if}
		</Readout>
	</g>

	<!-- ===== the spectrum ===== -->
	<g opacity={focus === 'pointer' ? 0.6 : 1}>
		<Readout id="spec-title">
			<T x={24} y={304} text="Spectrum" size={14} weight={700} />
			<T x={100} y={304} text="power at each frequency" size={12} muted />
		</Readout>
		{#if spec.occupied >= 0.1}
			<rect
				x={sx(bandLo)}
				y={sy(0) - 4}
				width={Math.max(1, sx(bandHi) - sx(bandLo))}
				height={sy(-50) - sy(0) + 4}
				fill="var(--ws-band)"
				opacity="0.8"
			/>
		{/if}
		<Axes
			{sx}
			{sy}
			xTicks={[0, 2, 4, 5, 6, 8, 10]}
			yTicks={[-50, -40, -30, -20, -10, 0]}
			xFormat={fmt}
			yFormat={(v) => (v === 0 ? '0 dB' : `${v}`.replace('-', '−'))}
			xLabel="frequency (MHz)"
		/>
		<path
			d={specPath}
			fill="none"
			stroke="var(--ws-spec)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<Readout
			id="occupied"
			order={2}
			label="Bandwidth (99% of the power)"
			value={occ + (wide ? ', wider than shown' : '')}
			color="var(--ws-spec)"
		>
			<T
				x={540}
				y={330}
				text={`99% of the power within ${occ}${wide ? ' (wider than shown)' : ''}`}
				size={13}
				weight={700}
				anchor="end"
				color="var(--ws-spec)"
			/>
		</Readout>
	</g>

	<!-- ===== the pointer ===== -->
	<g opacity={focus === 'spectrum' ? 0.6 : 1}>
		<Readout id="ptr-title">
			<T x={612} y={304} text="Pointer: amplitude and phase" size={14} weight={700} />
		</Readout>
		<circle
			cx={PX}
			cy={PY}
			r={pScale}
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="3 4"
		/>
		<line x1={PX - PR - 18} x2={PX + PR + 18} y1={PY} y2={PY} stroke="var(--stage-line)" />
		<line x1={PX} x2={PX} y1={PY - PR - 14} y2={PY + PR + 14} stroke="var(--stage-line)" />
		<Readout id="iq">
			<T x={PX + PR + 22} y={PY + 4} text={mode === 'qpsk' ? 'I' : ''} size={13} weight={700} />
			<T x={PX + 8} y={PY - PR - 4} text={mode === 'qpsk' ? 'Q' : ''} size={13} weight={700} />
		</Readout>
		<path d={trail} fill="none" stroke="var(--ws-wave)" stroke-width="2" opacity="0.35" />
		{#each points as p (p.bits)}
			<circle
				cx={PX + pScale * p.i}
				cy={PY - pScale * p.q}
				r="7"
				fill="var(--ws-point)"
				opacity={p.bits === currentBits ? 1 : 0.45}
			/>
			<Readout id="pt-{p.bits}">
				<T
					x={PX + pScale * p.i + (p.i >= 0 ? 12 : -12)}
					y={PY - pScale * p.q + (p.q > 0 ? -10 : p.q < 0 ? 20 : -12)}
					text={p.bits}
					size={13}
					weight={700}
					anchor={p.i >= 0 ? 'start' : 'end'}
				/>
			</Readout>
		{/each}
		<line
			x1={PX}
			y1={PY}
			x2={pointer.x}
			y2={pointer.y}
			stroke="var(--ws-wave)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={pointer.x} cy={pointer.y} r="5" fill="var(--ws-wave)" />
		<Readout id="ptr-note">
			<T
				x={PX}
				y={584}
				anchor="middle"
				size={12}
				muted
				text={mode === 'carrier'
					? 'a steady carrier: the pointer stands still'
					: mode === 'am'
						? `grows and shrinks (±${Math.round(AM_DEPTH * 100)}%)`
						: mode === 'fm'
							? 'swings: ahead = higher, behind = lower frequency'
							: mode === 'fsk'
								? 'spins one way for 1, the other way for 0'
								: 'jumps between the allowed points'}
			/>
		</Readout>
	</g>
</g>
