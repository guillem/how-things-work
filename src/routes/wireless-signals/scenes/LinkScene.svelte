<script lang="ts">
	/**
	 * A Wi-Fi link: distance, free-space loss and a neighbouring network.
	 *
	 * `step.hints.phase`:
	 * - `distance`: top, a transmitter and the receiver on a logarithmic distance
	 *   axis (1 m – 31.6 km, `params.logd`), with wavefronts leaving the antenna;
	 *   left, the link budget (transmit power, received power after free-space
	 *   loss, thermal noise, the SNR between them); right, QPSK symbols received
	 *   at that SNR. `params.band` picks 2.4 GHz (channel 6) or 5 GHz (channel 36).
	 * - `neighbour`: top, the 2.4 GHz channel map with ours (6) and the
	 *   neighbour's (`params.nbCh`); the overlapping part of its power
	 *   (`params.nbDb` relative to ours × the overlap) joins the noise. The
	 *   symbols get it as extra Gaussian noise (a Wi-Fi signal is OFDM, see `Interferer`).
	 *
	 * Wavefronts are a pure function of t; the cloud arrives as in ChannelScene.
	 */
	import { cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		TX_DBM,
		channelMHz,
		dbToLin,
		link,
		linToDb,
		measureBer,
		overlap,
		transmit
	} from '../radio';
	import { count, db, distanceText, num, rate } from '../format';
	import Constellation from './Constellation.svelte';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const SHOW_MAX = 1000;
	const OUR_CH = 6;

	const phase = $derived(String(step.hints?.phase ?? 'distance'));
	const logd = $derived(Number(params.logd ?? 3));
	const d = $derived(10 ** logd);
	const band = $derived(phase === 'neighbour' ? '2.4' : String(params.band ?? '2.4'));
	const freq = $derived(band === '5' ? 5.18e9 : channelMHz(OUR_CH) * 1e6);
	const budget = $derived(link(d, freq, 20e6));

	const nbCh = $derived(Math.round(Number(params.nbCh ?? 8)));
	const nbDb = $derived(Number(params.nbDb ?? -6));
	const ov = $derived(phase === 'neighbour' ? overlap(OUR_CH, nbCh) : 0);
	/** Neighbour's power inside our channel, relative to our signal (linear). */
	const iRel = $derived(ov * dbToLin(nbDb));
	const nbInDbm = $derived(iRel > 0 ? budget.rxDbm + linToDb(iRel) : -Infinity);
	const sinrDb = $derived(
		budget.rxDbm - linToDb(dbToLin(budget.noiseDbm) + (iRel > 0 ? dbToLin(nbInDbm) : 0))
	);

	const tx = $derived(
		transmit('qpsk', budget.snrDb, SHOW_MAX, 5, iRel > 0 ? { power: iRel } : undefined)
	);
	const ber = $derived(
		measureBer('qpsk', budget.snrDb, 200_000, 23, iRel > 0 ? { power: iRel } : undefined)
	);
	const shown = $derived(reduced ? SHOW_MAX : Math.min(SHOW_MAX, 120 + Math.floor(t * 160)));

	// ---- top: the distance axis --------------------------------------------------------------
	const DX0 = 130;
	const DX1 = 910;
	const dx = (lg: number) => DX0 + (lg / 4.5) * (DX1 - DX0);
	const AY = 120;
	const waves = $derived(
		[0, 1, 2, 3].map((k) => {
			const u = reduced ? (k + 0.5) / 4 : cycle(t, 2.4, k / 4);
			return { k, r: 20 + u * 240, o: 0.7 * (1 - u) };
		})
	);

	// ---- the channel map ---------------------------------------------------------------------
	const fx = (mhz: number) => 70 + ((mhz - 2395) / (2490 - 2395)) * 840;

	// ---- left: the link budget ladder --------------------------------------------------------------
	const LX = 110;
	const ly = (dbm: number) => 262 + ((20 - dbm) / 140) * 290;
	const level = (v: number) => ly(Math.max(-120, Math.min(20, v)));

	const berText = $derived(
		ber.errors === 0 ? `0 wrong in ${count(ber.bits)} bits` : `${rate(ber.ber)} of bits wrong`
	);
	const top = $derived(level(budget.rxDbm));
	const bottom = $derived(
		phase === 'neighbour' && iRel > 0
			? Math.min(level(nbInDbm), level(budget.noiseDbm))
			: level(budget.noiseDbm)
	);
	/** Label heights on the ladder, pushed apart so that they never overlap. */
	const labelY = $derived.by(() => {
		const items = [
			{ id: 'rx', y: level(budget.rxDbm) + 4 },
			{ id: 'noise', y: level(budget.noiseDbm) + 4 }
		];
		if (phase === 'neighbour' && iRel > 0) items.push({ id: 'nb', y: level(nbInDbm) + 4 });
		items.sort((a, b) => a.y - b.y);
		for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + 16);
		return Object.fromEntries(items.map((it) => [it.id, it.y]));
	});
	const snrShown = $derived(phase === 'neighbour' ? sinrDb : budget.snrDb);
</script>

<g>
	{#if phase === 'distance'}
		<!-- the link: transmitter, waves, receiver on a log distance axis -->
		<Readout
			id="title"
			order={0}
			label="Link"
			value="Wi-Fi at {band} GHz, {distanceText(logd)} away"
		>
			<T
				x={24}
				y={34}
				text="Wi-Fi at {band} GHz, 100 mW, in open space: {distanceText(logd)}"
				size={15}
				weight={700}
			/>
		</Readout>
		<defs>
			<clipPath id="link-waves-clip">
				<rect x="0" y="40" width="960" height="104" />
			</clipPath>
		</defs>
		<g clip-path="url(#link-waves-clip)">
			{#each waves as w (w.k)}
				<path
					d="M{DX0 - 70 + w.r * Math.cos(-0.5)} {AY -
						6 +
						w.r * Math.sin(-0.5)} A{w.r} {w.r} 0 0 1 {DX0 - 70 + w.r * Math.cos(0.5)} {AY -
						6 +
						w.r * Math.sin(0.5)}"
					fill="none"
					stroke="var(--ws-wave)"
					stroke-width="2"
					opacity={w.o}
				/>
			{/each}
		</g>
		<!-- transmitter -->
		<line
			x1={DX0 - 70}
			x2={DX0 - 70}
			y1={AY - 34}
			y2={AY + 26}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
		<circle cx={DX0 - 70} cy={AY - 36} r="4" fill="var(--ws-wave)" />
		<Readout id="tx-label">
			<T x={DX0 - 70} y={AY + 46} text="router" size={12} anchor="middle" muted />
		</Readout>
		<!-- distance axis -->
		<line x1={DX0} x2={DX1} y1={AY + 30} y2={AY + 30} stroke="var(--stage-line)" />
		{#each [0, 1, 2, 3, 4] as lg (lg)}
			<line x1={dx(lg)} x2={dx(lg)} y1={AY + 26} y2={AY + 34} stroke="var(--stage-line)" />
			<Readout id="tick-{lg}">
				<T
					x={dx(lg)}
					y={AY + 50}
					text={['1 m', '10 m', '100 m', '1 km', '10 km'][lg]}
					size={11}
					anchor="middle"
					muted
				/>
			</Readout>
		{/each}
		<!-- receiver -->
		<rect
			x={dx(logd) - 14}
			y={AY - 10}
			width="28"
			height="20"
			rx="4"
			fill="var(--surface)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<line
			x1={dx(logd)}
			x2={dx(logd)}
			y1={AY - 10}
			y2={AY - 30}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Readout id="rx-label">
			<T x={dx(logd)} y={AY - 38} text="receiver" size={12} anchor="middle" weight={600} />
		</Readout>
	{:else}
		<!-- the 2.4 GHz channel map -->
		<Readout id="title" order={0} label="Neighbour" value="channel {nbCh}, {db(nbDb, 0)} vs yours">
			<T
				x={24}
				y={34}
				text="2.4 GHz Wi-Fi channels: yours is 6, the neighbour’s {nbCh}"
				size={15}
				weight={700}
			/>
		</Readout>
		<line x1={fx(2400)} x2={fx(2484)} y1={190} y2={190} stroke="var(--stage-line)" />
		{#each Array.from({ length: 13 }, (_, i) => i + 1) as ch (ch)}
			<line
				x1={fx(channelMHz(ch))}
				x2={fx(channelMHz(ch))}
				y1="186"
				y2="194"
				stroke="var(--stage-line)"
			/>
			<Readout id="ch-{ch}">
				<T
					x={fx(channelMHz(ch))}
					y={210}
					text={String(ch)}
					size={11}
					anchor="middle"
					muted={ch !== OUR_CH && ch !== nbCh}
					weight={ch === OUR_CH || ch === nbCh ? 700 : 500}
				/>
			</Readout>
		{/each}
		<Readout id="mhz">
			<T x={fx(2400)} y={226} text="2400 MHz" size={11} muted anchor="start" />
			<T x={fx(2484)} y={226} text="2484 MHz" size={11} muted anchor="end" />
			<T x={fx(2442)} y={226} text="channel number" size={11} muted anchor="middle" />
		</Readout>
		<!-- ours -->
		<rect
			x={fx(channelMHz(OUR_CH) - 10)}
			y="80"
			width={fx(2410) - fx(2390)}
			height="106"
			rx="3"
			fill="var(--ws-band)"
			stroke="var(--ws-wave)"
			stroke-width="2"
		/>
		<!-- neighbour (height = its strength relative to ours) -->
		{@const nh = Math.max(8, 106 * Math.sqrt(dbToLin(nbDb)))}
		<rect
			x={fx(channelMHz(nbCh) - 10)}
			y={186 - nh}
			width={fx(2410) - fx(2390)}
			height={nh}
			rx="3"
			fill="var(--ws-nb-fill)"
			fill-opacity="0.6"
			stroke="var(--ws-nb)"
			stroke-width="2"
			stroke-dasharray="6 3"
		/>
		{#if ov > 0}
			<rect
				x={fx(Math.max(channelMHz(OUR_CH), channelMHz(nbCh)) - 10)}
				y={186 - nh}
				width={fx(2410 - Math.abs(channelMHz(OUR_CH) - channelMHz(nbCh))) - fx(2390)}
				height={nh}
				fill="var(--ws-nb)"
				opacity="0.45"
			/>
		{/if}
		<Readout
			id="ov"
			order={1}
			label="Overlap"
			value="{Math.round(ov * 100)}% of the neighbour’s signal is in your channel"
			color="var(--ws-nb)"
		>
			<T
				x={936}
				y={70}
				text="{Math.round(ov * 100)}% of the neighbour’s signal falls in your channel"
				size={13}
				weight={700}
				anchor="end"
				color="var(--ws-nb)"
			/>
			<T
				x={fx(channelMHz(OUR_CH))}
				y={100}
				text="yours"
				size={12}
				anchor="middle"
				weight={700}
				color="var(--ws-wave)"
			/>
		</Readout>
	{/if}

	<!-- ===== the link budget ===== -->
	<Readout id="budget-title">
		<T x={24} y={252} text="Power at the receiver" size={14} weight={700} />
	</Readout>
	<line x1={LX} x2={LX} y1={ly(20)} y2={ly(-120)} stroke="var(--stage-line)" />
	{#each [20, 0, -20, -40, -60, -80, -100, -120] as v (v)}
		<line x1={LX - 4} x2={LX} y1={ly(v)} y2={ly(v)} stroke="var(--stage-line)" />
		<Readout id="dbm-{v}">
			<T x={LX - 8} y={ly(v) + 4} text="{num(v, 0)} dBm" size={11} anchor="end" muted />
		</Readout>
	{/each}
	<!-- sent -->
	<line
		x1={LX}
		x2={LX + 120}
		y1={ly(TX_DBM)}
		y2={ly(TX_DBM)}
		stroke="var(--ws-wave)"
		stroke-width="3"
	/>
	<Readout id="sent">
		<T x={LX + 128} y={ly(TX_DBM) + 4} text="sent: 20 dBm (100 mW)" size={12} weight={600} />
	</Readout>
	<!-- loss -->
	<path
		d="M{LX + 60} {ly(TX_DBM) + 4} L{LX + 60} {level(budget.rxDbm) - 8}"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="loss">
		<T
			x={LX + 68}
			y={(ly(TX_DBM) + level(budget.rxDbm)) / 2 + 4}
			text="lost on the way: {db(budget.lossDb)}"
			size={12}
			muted
		/>
	</Readout>
	<!-- received -->
	<line
		x1={LX}
		x2={LX + 200}
		y1={level(budget.rxDbm)}
		y2={level(budget.rxDbm)}
		stroke="var(--ws-wave)"
		stroke-width="3"
	/>
	<Readout
		id="rx"
		order={4}
		label={phase === 'distance' ? 'Received (sent 20 dBm)' : undefined}
		value="{num(budget.rxDbm)} dBm"
		note="after {db(budget.lossDb)} of free-space loss"
	>
		<T x={LX + 208} y={labelY.rx} text="received: {num(budget.rxDbm)} dBm" size={12} weight={600} />
	</Readout>
	<!-- noise -->
	<line
		x1={LX}
		x2={LX + 200}
		y1={level(budget.noiseDbm)}
		y2={level(budget.noiseDbm)}
		stroke="var(--stage-ink-muted)"
		stroke-width="3"
		stroke-dasharray="2 3"
	/>
	<Readout
		id="noise"
		order={5}
		label={phase === 'distance' ? 'Noise in 20 MHz' : undefined}
		value="{num(budget.noiseDbm)} dBm"
	>
		<T x={LX + 208} y={labelY.noise} text="noise: {num(budget.noiseDbm)} dBm" size={12} muted />
	</Readout>
	{#if phase === 'neighbour' && iRel > 0}
		<line
			x1={LX}
			x2={LX + 200}
			y1={level(nbInDbm)}
			y2={level(nbInDbm)}
			stroke="var(--ws-nb)"
			stroke-width="3"
			stroke-dasharray="6 3"
		/>
		<Readout
			id="nb"
			order={6}
			label="Neighbour in your channel"
			value="{num(nbInDbm)} dBm"
			color="var(--ws-nb)"
		>
			<T
				x={LX + 208}
				y={labelY.nb}
				text="neighbour: {num(nbInDbm)} dBm"
				size={12}
				weight={600}
				color="var(--ws-nb)"
			/>
		</Readout>
	{/if}
	<!-- SNR bracket -->
	{#if bottom - top > 6}
		<path
			d="M{LX + 30} {top + 3} L{LX + 30} {bottom - 3}"
			stroke="var(--ws-ok)"
			stroke-width="2.5"
		/>
	{/if}
	<Readout
		id="snr"
		order={1}
		label={phase === 'neighbour' ? 'Signal / (noise + neighbour)' : 'SNR'}
		value={db(snrShown)}
		color="var(--ws-ok)"
	>
		<T
			x={24}
			y={584}
			text="{phase === 'neighbour' ? 'signal ÷ (noise + neighbour)' : 'signal-to-noise ratio'}: {db(
				snrShown
			)}"
			size={14}
			weight={700}
			color={snrShown < 10 ? 'var(--ws-bad)' : 'var(--ws-ok)'}
		/>
	</Readout>

	<!-- ===== the received symbols ===== -->
	<Readout id="rx-title">
		<T x={560} y={252} text="Received QPSK symbols" size={14} weight={700} />
	</Readout>
	<Constellation scheme="qpsk" {tx} {shown} cx={740} cy={420} half={150} uid="link" range={1.6} />
	<Readout id="ber" order={7} label="Bits read wrong" value={berText} color="var(--ws-bad)">
		<T
			x={936}
			y={252}
			text={berText}
			size={13}
			weight={700}
			anchor="end"
			color={ber.errors > 0 ? 'var(--ws-bad)' : undefined}
		/>
	</Readout>
</g>
