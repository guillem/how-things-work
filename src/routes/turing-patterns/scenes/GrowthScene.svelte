<script lang="ts">
	/**
	 * A strip of skin that settles into stripes and then grows fivefold (`Strip` in the model).
	 * Top: the strip now, drawn to scale, with its stripes as bars. Below: its history, time
	 * running down, each row drawn at the strip's length then (centred), so the stripes move
	 * apart and new ones appear in the gaps.
	 *
	 * The whole run is computed once per restart (a one-dimensional run is cheap) and revealed
	 * as t runs; reduced motion shows the finished run.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DT, GROWTH, Strip, fastestMode, uniformState } from '../model';
	import { coatRamp, shade, type RGB } from './paint';

	let { t, params, reduced, dark }: StageProps = $props();

	const restarts = $derived(Number(params.regrow ?? 0));

	/** Lifetimes per second of the clock. */
	const RATE = 20;
	const ROWS = 280;

	interface History {
		rows: Float32Array[];
		length: number[];
		peaks: number[][];
		times: number[];
		total: number;
	}
	const history = $derived.by((): History => {
		const s = new Strip(GROWTH, 1 + restarts);
		const total = s.total;
		const every = Math.round(total / DT / ROWS);
		const rows: Float32Array[] = [];
		const length: number[] = [];
		const peaks: number[][] = [];
		const times: number[] = [];
		for (let r = 0; r < ROWS; r++) {
			s.step(every);
			rows.push(Float32Array.from(s.a));
			length.push(s.length());
			peaks.push(s.peaks());
			times.push(s.time);
		}
		return { rows, length, peaks, times, total };
	});

	const row = $derived(
		reduced
			? ROWS - 1
			: Math.max(0, Math.min(ROWS - 1, Math.floor((t * RATE * ROWS) / history.total)))
	);
	const level = uniformState(GROWTH).a;
	const lam = fastestMode(GROWTH).wavelength;
	const L1 = 200;

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 40;
	const W = 880;
	const px = W / L1;
	const STRIP_Y = 112;
	const STRIP_H = 56;
	const KY = 232;
	const KH = 300;

	// ---- painting ------------------------------------------------------------------------------
	let ramp = $state.raw<RGB[] | null>(null);
	$effect(() => {
		void dark;
		untrack(() => {
			ramp = coatRamp();
		});
	});
	let cv: HTMLCanvasElement | null = null;
	function canvasURL(w: number, h: number, fill: (data: Uint8ClampedArray) => void) {
		if (typeof document === 'undefined') return '';
		cv ??= document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		const ctx = cv.getContext('2d');
		if (!ctx) return '';
		const img = ctx.createImageData(w, h);
		fill(img.data);
		ctx.putImageData(img, 0, 0);
		return cv.toDataURL();
	}
	/** The whole history, one row per record, each centred at its length. */
	const kymo = $derived.by(() => {
		const lut = ramp;
		if (!lut) return '';
		const CW = 440;
		const { rows, length } = history;
		return canvasURL(CW, ROWS, (data) => {
			for (let r = 0; r < ROWS; r++) {
				const L = length[r];
				const a = rows[r];
				const n = a.length;
				for (let c = 0; c < CW; c++) {
					const x = ((c + 0.5) / CW - 0.5) * L1 + L / 2;
					if (x < 0 || x >= L) continue;
					const col = lut[shade(a[Math.floor((x / L) * n)] / level)];
					const k = 4 * (r * CW + c);
					data[k] = col[0];
					data[k + 1] = col[1];
					data[k + 2] = col[2];
					data[k + 3] = 255;
				}
			}
		});
	});
	/** The strip now. */
	const stripImg = $derived.by(() => {
		const lut = ramp;
		if (!lut) return '';
		const a = history.rows[row];
		return canvasURL(a.length, 1, (data) => {
			for (let i = 0; i < a.length; i++) {
				const col = lut[shade(a[i] / level)];
				data[4 * i] = col[0];
				data[4 * i + 1] = col[1];
				data[4 * i + 2] = col[2];
				data[4 * i + 3] = 255;
			}
		});
	});

	const Lnow = $derived(history.length[row]);
	const stripX = $derived(X0 + (W - Lnow * px) / 2);
	const count = $derived(history.peaks[row].length);
	/** Mean distance between neighbouring stripes, cells. */
	const spacing = $derived.by(() => {
		const pk = history.peaks[row];
		return pk.length > 1 ? ((pk[pk.length - 1] - pk[0]) * Lnow) / (pk.length - 1) : null;
	});
	const timeNow = $derived(history.times[row]);
	const revealY = $derived(KY + ((row + 1) / ROWS) * KH);
	/** The run's first row of each new stripe count: marks where stripes were inserted. */
	const events = $derived.by(() => {
		const out: { r: number; n: number }[] = [];
		let last = -1;
		for (let r = 0; r < ROWS; r++) {
			const n = history.peaks[r].length;
			if (n > last && last >= 2) out.push({ r, n });
			last = n;
		}
		return out;
	});
	const tickY = (r: number) => KY + ((r + 0.5) / ROWS) * KH;
</script>

<g>
	<defs>
		<clipPath id="growth-reveal">
			<rect x={X0 - 2} y={KY} width={W + 4} height={revealY - KY} />
		</clipPath>
	</defs>
	<Readout
		id="strip"
		order={1}
		label="Strip length"
		value="{Math.round(Lnow)} cells · {count} stripes"
		note="t = {Math.round(timeNow)} lifetimes"
	>
		<Label anchor="start" x={X0} y={56} text="a growing strip of skin" size={15} weight={600} />
		<Label
			anchor="start"
			x={X0}
			y={78}
			text="length {Math.round(Lnow)} cells · {count} stripes · t = {Math.round(timeNow)} lifetimes"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout
		id="spacing"
		order={2}
		label="Spacing"
		value={spacing ? `${spacing.toFixed(1)} cells` : '—'}
		note="fastest-growing wavelength {lam.toFixed(1)} cells"
	>
		<Label
			anchor="end"
			x={X0 + W}
			y={56}
			text={spacing ? `spacing ${spacing.toFixed(1)} cells` : 'spacing —'}
			size={14}
			weight={600}
			color="var(--tp-high-text)"
			tabular
		/>
		<Label
			anchor="end"
			x={X0 + W}
			y={78}
			text="fastest-growing wavelength {lam.toFixed(1)} cells"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- the strip now -->
	<rect
		x={stripX - 1}
		y={STRIP_Y - 1}
		width={Lnow * px + 2}
		height={STRIP_H + 2}
		rx="6"
		fill="var(--tp-mid)"
		stroke="var(--stage-line)"
	/>
	{#if stripImg}
		<image
			href={stripImg}
			x={stripX}
			y={STRIP_Y}
			width={Lnow * px}
			height={STRIP_H}
			preserveAspectRatio="none"
		/>
	{/if}

	<!-- the history -->
	<Readout id="history-title" label="Below: the strip's history, time running down">
		<Label
			anchor="start"
			x={X0}
			y={KY - 16}
			text="history: one row per moment, time running down"
			size={12}
			muted
		/>
	</Readout>
	{#if kymo}
		<image
			href={kymo}
			x={X0}
			y={KY}
			width={W}
			height={KH}
			preserveAspectRatio="none"
			clip-path="url(#growth-reveal)"
		/>
	{/if}
	<line
		x1={X0}
		x2={X0 + W}
		y1={revealY}
		y2={revealY}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="3 3"
		opacity={row < ROWS - 1 ? 1 : 0}
	/>
	{#each events as e (e.r)}
		{#if e.r <= row}
			<Readout id="ev-{e.r}">
				<Label
					anchor="start"
					x={X0 + 4}
					y={tickY(e.r) + 4}
					text="{e.n} stripes"
					size={11}
					color="var(--tp-high-text)"
				/>
			</Readout>
		{/if}
	{/each}
	<Readout
		id="time-axis"
		label="Top of the history: start · bottom: {Math.round(history.total)} lifetimes"
	>
		<Label
			anchor="end"
			x={X0 + W}
			y={KY + KH + 22}
			text="↓ time: {Math.round(history.total)} lifetimes in all; grows ×5 from t = 60"
			size={11}
			muted
		/>
	</Readout>
</g>
