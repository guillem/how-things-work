<script lang="ts">
	/**
	 * Shannon's limit.
	 *
	 * `step.hints.phase`:
	 * - `width`: a 5 GHz Wi-Fi link at `params.logd` (free space, 100 mW). Top:
	 *   the band from 5150 to 5350 MHz with our channel (20/40/80/160 MHz wide
	 *   from 5170 MHz, `params.width`): the same power spread over a wider block
	 *   is lower per megahertz, while the noise per megahertz stays put. Bottom:
	 *   Shannon's capacity for each width, the chosen one bold, against what
	 *   doubling with every doubling of width would give.
	 * - `shannon`: bits per second per hertz against SNR: the curve log₂(1 + SNR)
	 *   with the region above it shaded, each uncoded scheme at the SNR it needs
	 *   for a BER of 10⁻⁶, and Wi-Fi 5's fastest single-stream rate (4.9 bit/s/Hz)
	 *   from the curve. `params.snr` marks an SNR.
	 *
	 * Static apart from a gentle shimmer of the noise floor (a pure function of t).
	 */
	import { Axes, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		SCHEMES,
		capacity,
		dbToLin,
		link,
		linToDb,
		schemeBits,
		schemeName,
		snrForBer,
		wifiRate,
		type Scheme
	} from '../radio';
	import { bitRate, db, distanceText, num } from '../format';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'width'));

	// ---- width -----------------------------------------------------------------------------
	const WIDTHS = [20, 40, 80, 160];
	const F5 = 5.18e9;
	const logd = $derived(Number(params.logd ?? 3));
	const width = $derived(Number(params.width ?? 20));
	const rows = $derived(
		WIDTHS.map((w) => {
			const l = link(10 ** logd, F5, w * 1e6);
			return { w, snr: l.snrDb, c: capacity(w * 1e6, dbToLin(l.snrDb)) };
		})
	);
	const chosen = $derived(rows.find((r) => r.w === width) ?? rows[0]);
	const base = $derived(rows[0]);
	const fx = (mhz: number) => 80 + ((mhz - 5150) / 200) * 800;
	/** Height of our block: power per MHz, relative to 20 MHz (linear). */
	/** Drawing units per (signal power per MHz at 20 MHz), so that the taller of the two fits. */
	const unit = $derived(130 / Math.max(1, dbToLin(-base.snr)));
	const blockH = $derived(Math.max(2, unit * (20 / width)));
	/** Noise floor height on the same scale: noise per MHz over signal per MHz at 20 MHz. */
	const noiseH = $derived(Math.max(3, unit * dbToLin(-base.snr)));
	const shimmer = (x: number) =>
		reduced ? 0 : 1.5 * Math.sin(x * 0.21 + t * 5) + 1 * Math.sin(x * 0.53 - t * 7);
	const noisePath = $derived.by(() => {
		let d = `M${fx(5150)} 210`;
		for (let x = fx(5150); x <= fx(5350); x += 8)
			d += `L${x.toFixed(1)} ${(210 - noiseH - shimmer(x)).toFixed(1)}`;
		return d + `L${fx(5350)} 210Z`;
	});
	const cMax = $derived(Math.max(...rows.map((r) => r.c), base.c * 8));
	const cx = $derived(scale([0, cMax], [0, 1]));

	// ---- shannon -------------------------------------------------------------------------------
	const sx = scale([-5, 35], [90, 900]);
	const sy = scale([0, 12], [520, 90]);
	const snr = $derived(Number(params.snr ?? 8));
	const shannonPath = (() => {
		let d = '';
		for (let v = -5; v <= 35.001; v += 0.5)
			d += `${v === -5 ? 'M' : 'L'}${sx(v).toFixed(1)} ${sy(Math.log2(1 + dbToLin(v))).toFixed(1)}`;
		return d;
	})();
	const impossible = `${shannonPath}L${sx(35)} ${sy(12)}L${sx(-5)} ${sy(12)}Z`;
	const pts = SCHEMES.map((s: Scheme) => ({
		s,
		x: sx(snrForBer(s, 1e-6)),
		y: sy(schemeBits[s]),
		need: snrForBer(s, 1e-6),
		shannon: linToDb(2 ** schemeBits[s] - 1)
	}));
	const wifiEta = wifiRate(80, 8, 5 / 6) / 80;
	const wifiMin = linToDb(2 ** wifiEta - 1);
	const etaNow = $derived(Math.log2(1 + dbToLin(snr)));
	const fits = $derived(pts.filter((p) => p.need <= snr).map((p) => schemeName[p.s]));
</script>

<g>
	{#if phase === 'width'}
		<Readout id="title" order={0} label="Link" value="5 GHz, {distanceText(logd)}, {width} MHz">
			<T
				x={24}
				y={34}
				text="5 GHz Wi-Fi, 100 mW, {distanceText(logd)} away in open space"
				size={15}
				weight={700}
			/>
		</Readout>
		<!-- the band -->
		<line x1={fx(5150)} x2={fx(5350)} y1="210" y2="210" stroke="var(--stage-line)" />
		{#each [5150, 5200, 5250, 5300, 5350] as f (f)}
			<line x1={fx(f)} x2={fx(f)} y1="210" y2="215" stroke="var(--stage-line)" />
			<Readout id="f-{f}">
				<T x={fx(f)} y={230} text="{f} MHz" size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<rect
			x={fx(5170)}
			y={210 - blockH}
			width={fx(5170 + width) - fx(5170)}
			height={blockH}
			fill="var(--ws-band)"
			stroke="var(--ws-wave)"
			stroke-width="2"
		/>
		<path d={noisePath} fill="var(--stage-ink-muted)" opacity="0.35" />
		<Readout
			id="band-note"
			order={1}
			label="Same power, wider band"
			value="power per MHz ÷ {width / 20}"
		>
			<T
				x={fx(5170)}
				y={210 - Math.max(blockH, noiseH + 4) - 10}
				text="your signal: the same 100 mW spread over {width} MHz"
				size={12}
				weight={600}
				color="var(--ws-wave)"
			/>
			<T
				x={fx(5350)}
				y={210 - noiseH - 10}
				text="noise: the same in every MHz"
				size={12}
				muted
				anchor="end"
			/>
		</Readout>

		<!-- capacity for each width -->
		<Readout id="cap-title">
			<T x={24} y={280} text="Shannon’s best possible rate" size={14} weight={700} />
			<T
				x={24}
				y={300}
				text="grey outline: if the rate doubled with every doubling of width"
				size={12}
				muted
			/>
		</Readout>
		{#each rows as r, i (r.w)}
			{@const y = 330 + i * 60}
			{@const on = r.w === width}
			<Readout id="w-{r.w}">
				<T x={24} y={y + 20} text="{r.w} MHz" size={14} weight={on ? 700 : 500} />
				<T
					x={110}
					y={y + 20}
					text="SNR {db(r.snr)}"
					size={12}
					muted={!on}
					weight={on ? 600 : 500}
				/>
			</Readout>
			<rect
				x="230"
				{y}
				width={Math.min(700, 700 * cx((base.c * r.w) / 20))}
				height="30"
				rx="4"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="4 3"
			/>
			<rect
				x="230"
				{y}
				width={700 * cx(r.c)}
				height="30"
				rx="4"
				fill="var(--ws-shannon)"
				opacity={on ? 0.9 : 0.4}
			/>
			<Readout
				id="c-{r.w}"
				order={2 + i}
				label="{r.w} MHz"
				value="{bitRate(r.c)} at {db(r.snr)} SNR"
				color={on ? 'var(--ws-shannon)' : undefined}
			>
				<T
					x={238 + 700 * cx(r.c)}
					y={y + 20}
					text={bitRate(r.c)}
					size={13}
					weight={on ? 700 : 500}
				/>
			</Readout>
		{/each}
		<Readout
			id="ratio"
			order={7}
			label="Compared with 20 MHz"
			value="{width / 20}× the width, {(chosen.c / base.c).toFixed(1)}× the rate"
		>
			<T
				x={936}
				y={584}
				text="{width / 20}× the width → {(chosen.c / base.c).toFixed(1)}× the rate"
				size={13}
				weight={700}
				anchor="end"
			/>
		</Readout>
	{:else}
		<Readout id="title" order={0} label="Shannon’s limit" value="C = B · log₂(1 + SNR)">
			<T x={24} y={34} text="Shannon’s limit: C = B · log₂(1 + SNR)" size={15} weight={700} />
		</Readout>
		<path d={impossible} fill="var(--ws-bad)" opacity="0.08" />
		<Axes
			{sx}
			{sy}
			xTicks={[-5, 0, 5, 10, 15, 20, 25, 30, 35]}
			yTicks={[0, 2, 4, 6, 8, 10, 12]}
			xFormat={(v: number) => num(v, 0)}
			xLabel="SNR (dB)"
			yLabel="bits per second per hertz"
		/>
		<Readout id="impossible">
			<T
				x={sx(4)}
				y={sy(10)}
				text="impossible: no scheme can work up here"
				size={13}
				weight={600}
				color="var(--ws-bad)"
			/>
		</Readout>
		<path d={shannonPath} fill="none" stroke="var(--ws-shannon)" stroke-width="3" />
		<Readout id="curve-label">
			<T
				x={sx(28)}
				y={sy(Math.log2(1 + dbToLin(28))) - 12}
				text="Shannon’s limit"
				size={13}
				weight={700}
				anchor="end"
				color="var(--ws-shannon)"
			/>
		</Readout>
		<!-- uncoded schemes and their gap -->
		{#each pts as p (p.s)}
			<line
				x1={sx(p.shannon)}
				x2={p.x - 7}
				y1={p.y}
				y2={p.y}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 3"
			/>
			<circle cx={p.x} cy={p.y} r="6" fill="var(--ws-s{SCHEMES.indexOf(p.s)})" />
			<Readout id="pt-{p.s}">
				<T
					x={p.s === 'qam256' ? p.x : p.x + 10}
					y={p.s === 'qam256' ? p.y - 12 : p.y + 4}
					anchor={p.s === 'qam256' ? 'middle' : 'start'}
					text="{schemeName[p.s]} · {num(p.need)} dB"
					size={12}
					weight={600}
				/>
			</Readout>
		{/each}
		<Readout
			id="needs"
			order={10}
			label="SNR needed for 1 error in a million bits, no code"
			value={pts.map((p) => `${schemeName[p.s]} ${num(p.need)}`).join(' · ') + ' dB'}
		/>
		<!-- Wi-Fi 5 -->

		<circle cx={sx(wifiMin)} cy={sy(wifiEta)} r="5" fill="var(--ws-ok)" />
		<Readout
			id="wifi"
			order={20}
			label="Wi-Fi 5, 256-QAM + code"
			value="4.9 bit/s/Hz; Shannon allows it from {db(wifiMin)}"
			color="var(--ws-ok)"
		>
			<T
				x={sx(wifiMin) - 10}
				y={sy(wifiEta) - 10}
				text="Wi-Fi 5 with its error-correcting code: 4.9"
				size={12}
				weight={600}
				anchor="end"
				color="var(--ws-ok)"
			/>
		</Readout>
		<!-- the chosen SNR -->
		<line
			x1={sx(snr)}
			x2={sx(snr)}
			y1={sy(12)}
			y2={sy(0)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<circle cx={sx(snr)} cy={sy(etaNow)} r="5" fill="var(--ws-shannon)" />
		<Readout
			id="now"
			order={1}
			label="At {num(snr)} dB"
			value="at most {etaNow.toFixed(1)} bit/s/Hz: {bitRate(
				capacity(20e6, dbToLin(snr))
			)} in 20 MHz"
		>
			<T
				x={24}
				y={584}
				text="At {num(snr)} dB: at most {etaNow.toFixed(1)} bits per second per hertz, {bitRate(
					capacity(20e6, dbToLin(snr))
				)} in a 20 MHz channel · without a code: {fits.length ? fits.join(', ') : 'none of these'}"
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
