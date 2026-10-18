<script lang="ts">
	/**
	 * What a tsunami looks like at the coast, as a tide gauge sees it: the real Crescent City
	 * record of 11–12 March 2011 with the predicted tide under it (top); the model's Japanese
	 * coast, on the sinking side of the fault, for the first two and a half hours (bottom left);
	 * and one minute of the tsunami's steepest rise beside a surf wave of the same height (bottom
	 * right). A cursor sweeps each record (a pure function of t); under reduced motion it rests on
	 * the biggest wave.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { STATIONS } from '../model';
	import { DEFAULTS, W_JAPAN, hoursMinutes, modelRecords } from '../scenario';

	let { t, params, reduced }: StageProps = $props();

	const cc = STATIONS.find((s) => s.kind === 'gauge')!;
	const tide = cc.tide ?? [];
	/** Observed sea level, m above mean lower low water, a minute from cc.from; null: no data. */
	const level = cc.record.map((v, k) =>
		v === null || tide[k] === null ? null : (v + tide[k]) / 100
	);
	const predicted = tide.map((v) => (v === null ? null : v / 100));
	const fromMin = cc.from;
	const toMin = cc.from + cc.record.length - 1;

	const nf = (v: number, d = 1) =>
		v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });

	// ---- Crescent City -----------------------------------------------------------------------------
	const sx = scale([fromMin / 60, toMin / 60], [80, 920]);
	const sy = scale([-2.5, 5.5], [262, 46]);
	function path(
		values: readonly (number | null)[],
		from: number,
		x: (h: number) => number,
		y: (v: number) => number
	) {
		let d = '';
		let open = false;
		values.forEach((v, k) => {
			if (v === null) {
				open = false;
				return;
			}
			d += `${open ? 'L' : 'M'}${x((from + k) / 60).toFixed(1)} ${y(v).toFixed(1)}`;
			open = true;
		});
		return d;
	}
	const levelPath = path(level, fromMin, sx, sy);
	const tidePath = path(predicted, fromMin, sx, sy);
	const biggestK = (cc.biggestMin ?? cc.crestMin) - fromMin;
	/** The steepest one-minute rise of the record, m. */
	const steepest = (() => {
		let best = 0;
		for (let k = 1; k < level.length; k++) {
			const a = level[k - 1];
			const b = level[k];
			if (a !== null && b !== null) best = Math.max(best, b - a);
		}
		return best;
	})();

	const SWEEP = 30;
	const u = $derived(reduced ? null : (t % SWEEP) / SWEEP);
	const ccK = $derived(
		u === null ? biggestK : Math.min(level.length - 1, Math.floor(u * level.length))
	);
	const ccNow = $derived.by(() => {
		for (let k = ccK; k >= 0; k--)
			if (level[k] !== null) return { k, v: level[k]!, tide: predicted[k] ?? 0 };
		return { k: 0, v: 0, tide: 0 };
	});

	// ---- the Japanese coast (model) ----------------------------------------------------------------
	const uplift = $derived(Number(params.uplift ?? DEFAULTS.uplift));
	const japan = $derived(modelRecords(uplift)[W_JAPAN].slice(0, 151));
	const jx = scale([0, 150], [80, 500]);
	const jMax = $derived(Math.max(4, ...japan.map(Math.abs)) * 1.1);
	const jy = $derived(scale([-jMax, jMax], [560, 350]));
	const japanPath = $derived(path(japan, 0, (h) => jx(h * 60), jy));
	const japanPeak = $derived(japan.indexOf(Math.max(...japan)));
	const japanLow = $derived(japan.slice(0, japanPeak).reduce((m, v) => Math.min(m, v), 0));
	const jK = $derived(
		u === null ? japanPeak : Math.min(japan.length - 1, Math.floor(u * japan.length))
	);

	// ---- one minute ---------------------------------------------------------------------------------
	const mx = scale([0, 60], [600, 920]);
	const my = scale([-1.6, 1.6], [540, 380]);
	const surf = (() => {
		let d = '';
		for (let s = 0; s <= 60; s += 0.5)
			d += `${s ? 'L' : 'M'}${mx(s).toFixed(1)} ${my(Math.sin((2 * Math.PI * s) / 10)).toFixed(1)}`;
		return d;
	})();
	const rise = `M${mx(0)} ${my(-steepest / 2)}L${mx(60)} ${my(steepest / 2)}`;
	const mCursor = $derived(u === null ? 30 : t % 60);
</script>

<g class="gauge-scene">
	<!-- Crescent City -->
	<Label
		x={80}
		y={20}
		text="Crescent City tide gauge, 11–12 March 2011 (real record)"
		size={14}
		weight={600}
		halo={false}
		anchor="start"
	/>
	<Axes
		{sx}
		{sy}
		xLabel="hours after the earthquake"
		yLabel="sea level, m"
		xTicks={[8, 10, 12, 14, 16, 18, 20, 22]}
		yTicks={[-2, 0, 2, 4]}
	/>
	<path d={tidePath} fill="none" stroke="var(--tsu-tide)" stroke-width="2" stroke-dasharray="6 4" />
	<path
		d={levelPath}
		fill="none"
		stroke="var(--tsu-real)"
		stroke-width="1.5"
		stroke-linejoin="round"
	/>
	<Readout
		id="tide"
		order={3}
		label="Dashed"
		value="the tide, from the Moon and the Sun"
		color="var(--tsu-tide)"
	>
		<Label
			x={sx(20.6)}
			y={sy(2.2)}
			text="the tide (predicted): twice a day"
			size={12}
			color="var(--tsu-tide-text)"
			anchor="middle"
		/>
	</Readout>
	<Readout
		id="arrive"
		order={4}
		label="First wave"
		value="{hoursMinutes(cc.onsetMin * 60)} after the earthquake"
	>
		<Label
			x={sx(cc.onsetMin / 60) + 6}
			y={sy(4.1)}
			text="first wave, {hoursMinutes(cc.onsetMin * 60)}"
			size={12}
			anchor="start"
		/>
		<line
			x1={sx(cc.onsetMin / 60)}
			x2={sx(cc.onsetMin / 60)}
			y1={sy(3.8)}
			y2={sy(-2.4)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 3"
			stroke-width="0.8"
		/>
	</Readout>
	<Readout
		id="biggest"
		order={5}
		label="Biggest wave"
		value="{nf((cc.biggestCm ?? 0) / 100)} m above the tide, {hoursMinutes(
			(cc.biggestMin ?? 0) * 60
		)}"
	>
		<Label
			x={sx((cc.biggestMin ?? 0) / 60) + 10}
			y={sy(4.9)}
			text="biggest: {nf((cc.biggestCm ?? 0) / 100)} m above the tide, {hoursMinutes(
				(cc.biggestMin ?? 0) * 60
			)}"
			size={12}
			weight={600}
			color="var(--tsu-real-text)"
			anchor="start"
		/>
	</Readout>
	<!-- cursor -->
	<line
		x1={sx((fromMin + ccNow.k) / 60)}
		x2={sx((fromMin + ccNow.k) / 60)}
		y1={sy(5.5)}
		y2={sy(-2.5)}
		stroke="var(--tsu-real)"
		stroke-width="1"
		opacity="0.5"
	/>
	<circle
		cx={sx((fromMin + ccNow.k) / 60)}
		cy={sy(ccNow.v)}
		r="4"
		fill="var(--tsu-real)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout
		id="now"
		order={1}
		label="Crescent City"
		value="{nf(ccNow.v - ccNow.tide)} m above the tide at {hoursMinutes((fromMin + ccNow.k) * 60)}"
	>
		<Label
			x={920}
			y={20}
			text="{hoursMinutes((fromMin + ccNow.k) * 60)}: {nf(ccNow.v - ccNow.tide)} m above the tide"
			size={12}
			anchor="end"
			tabular
			halo={false}
		/>
	</Readout>

	<!-- the Japanese coast -->
	<Label
		x={80}
		y={322}
		text="The Japanese coast, in the model"
		size={14}
		weight={600}
		anchor="start"
	/>
	<Axes
		sx={jx}
		sy={jy}
		xLabel="minutes"
		xTicks={[0, 30, 60, 90, 120, 150]}
		yTicks={[-Math.floor(jMax / 2) * 1, 0, Math.floor(jMax / 2)]}
	/>
	<path d={japanPath} fill="none" stroke="var(--tsu-wave)" stroke-width="1.8" />
	<circle
		cx={jx(jK)}
		cy={jy(japan[jK] ?? 0)}
		r="4"
		fill="var(--tsu-wave)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout
		id="drawback"
		order={6}
		label="Japan (model)"
		value="sea draws back {nf(-japanLow)} m, then rises {nf(
			japan[japanPeak] ?? 0
		)} m at {japanPeak} min"
	>
		<Label
			x={jx(Math.max(6, japanPeak - 34))}
			y={jy(japanLow) + 22}
			text="the sea draws back {nf(-japanLow)} m"
			size={12}
			anchor="start"
		/>
		<Label
			x={jx(japanPeak) + 8}
			y={jy(japan[japanPeak] ?? 0) + 4}
			text="then floods: {nf(japan[japanPeak] ?? 0)} m at {japanPeak} min"
			size={12}
			color="var(--tsu-wave-text)"
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- one minute -->
	<Label x={600} y={322} text="One minute at the coast" size={14} weight={600} anchor="start" />
	<line x1={600} x2={920} y1={my(0)} y2={my(0)} stroke="var(--stage-line)" />
	<path d={surf} fill="none" stroke="var(--tsu-wind)" stroke-width="1.6" />
	<path d={rise} fill="none" stroke="var(--tsu-real)" stroke-width="2.4" />
	<line
		x1={mx(mCursor)}
		x2={mx(mCursor)}
		y1={my(1.6)}
		y2={my(-1.6)}
		stroke="var(--stage-ink-muted)"
		stroke-width="0.8"
		opacity="0.6"
	/>
	<Readout
		id="surf"
		order={7}
		label="A surf wave 2 m high"
		value="up and down 6 times a minute"
		color="var(--tsu-wind)"
	>
		<Label
			x={600}
			y={348}
			text="a surf wave 2 m high: up and down every 10 s"
			size={12}
			color="var(--tsu-wind-text)"
			anchor="start"
		/>
	</Readout>
	<Readout
		id="steep"
		order={8}
		label="The tsunami's fastest rise"
		value="{Math.round(steepest * 100)} cm in a minute"
		color="var(--tsu-real)"
	>
		<Label
			x={600}
			y={366}
			text="the tsunami’s fastest rise: {Math.round(steepest * 100)} cm in a minute"
			size={12}
			color="var(--tsu-real-text)"
			anchor="start"
		/>
	</Readout>
	<Label x={920} y={566} text="60 s" size={11} muted anchor="end" />
</g>
