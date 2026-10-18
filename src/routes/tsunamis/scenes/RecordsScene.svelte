<script lang="ts">
	/**
	 * The real 2011 records at the three DART stations and the Crescent City tide gauge beside
	 * the model's wave at the same places (the real floor, the reader's uplift): each panel spans
	 * the same 100 minutes around the first crest, each line scaled to its own first crest, so
	 * that their timing can be compared while their heights are given as numbers. The lines draw
	 * themselves over the first seconds (a pure function of t); reduced motion shows them whole.
	 */
	import { Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { STATIONS, firstCrest } from '../model';
	import { DEFAULTS, hoursMinutes, modelRecords } from '../scenario';

	let { t, params, reduced }: StageProps = $props();

	const uplift = $derived(Number(params.uplift ?? DEFAULTS.uplift));
	const records = $derived(modelRecords(uplift));
	const reveal = $derived(reduced ? 1 : Math.min(1, t / 6));

	const PANELS = STATIONS.map((st, k) => ({
		st,
		k,
		x0: k % 2 === 0 ? 70 : 520,
		y0: k < 2 ? 70 : 330
	}));
	const PW = 390;
	const PH = 150;
	const BEFORE = 40;
	const AFTER = 60;

	const panels = $derived(
		PANELS.map((p) => {
			const rec = records[p.k];
			const crest = firstCrest(rec, Math.max(0.02, 0.03 * uplift));
			const center = p.st.crestMin;
			const from = center - BEFORE;
			const sx = scale([from, center + AFTER], [p.x0, p.x0 + PW]);
			const sy = scale([-1.4, 1.4], [p.y0 + PH, p.y0]);
			const last = from + reveal * (BEFORE + AFTER);
			const realScale = p.st.crestCm / 100;
			const modelScale = crest ? crest.height : 1;
			let real = '';
			let open = false;
			p.st.record.forEach((v, j) => {
				const m = p.st.from + j;
				if (m < from || m > last || v === null) {
					open = false;
					return;
				}
				real += `${open ? 'L' : 'M'}${sx(m).toFixed(1)} ${sy(Math.max(-1.4, Math.min(1.4, v / 100 / realScale))).toFixed(1)}`;
				open = true;
			});
			let model = '';
			for (let m = Math.max(0, Math.ceil(from)); m <= last && m < rec.length; m++)
				model += `${model ? 'L' : 'M'}${sx(m).toFixed(1)} ${sy(Math.max(-1.4, Math.min(1.4, rec[m] / modelScale))).toFixed(1)}`;
			return { ...p, sx, sy, crest, real, model, from };
		})
	);
	const nf = (v: number, d = 0) => v.toLocaleString('en-GB', { maximumFractionDigits: d });
	const height = (m: number) => (m < 1 ? `${Math.round(m * 100)} cm` : `${nf(m, 1)} m`);
</script>

<g class="records-scene">
	{#each panels as p (p.st.id)}
		<rect x={p.x0} y={p.y0} width={PW} height={PH} rx="4" fill="none" stroke="var(--stage-line)" />
		<line
			x1={p.x0}
			x2={p.x0 + PW}
			y1={p.sy(0)}
			y2={p.sy(0)}
			stroke="var(--stage-grid)"
			stroke-width="1.5"
		/>
		<Label
			x={p.x0}
			y={p.y0 - 30}
			text="{p.st.name}, {p.st.place}"
			size={13}
			weight={600}
			anchor="start"
		/>
		<Label
			x={p.x0}
			y={p.y0 - 12}
			text="{nf(p.st.km)} km from the epicentre"
			size={11}
			muted
			anchor="start"
		/>
		<path
			d={p.model}
			fill="none"
			stroke="var(--tsu-wave)"
			stroke-width="1.8"
			stroke-dasharray="6 3"
		/>
		<path d={p.real} fill="none" stroke="var(--tsu-real)" stroke-width="1.8" />
		<line
			x1={p.sx(p.st.crestMin)}
			x2={p.sx(p.st.crestMin)}
			y1={p.y0 + 4}
			y2={p.y0 + PH - 4}
			stroke="var(--tsu-real)"
			stroke-width="0.8"
			stroke-dasharray="2 3"
			opacity="0.7"
		/>
		<Readout
			id="r-{p.st.id}"
			order={p.k + 1}
			label={p.st.name}
			value="first crest: real {hoursMinutes(p.st.crestMin * 60)}, {height(
				p.st.crestCm / 100
			)} · model {p.crest
				? `${hoursMinutes(p.crest.minute * 60)}, ${height(p.crest.height)}`
				: '—'}"
		>
			<Label
				x={p.x0 + 8}
				y={p.y0 + PH + 18}
				text="real: first crest {hoursMinutes(p.st.crestMin * 60)}, {height(p.st.crestCm / 100)}"
				size={12}
				color="var(--tsu-real-text)"
				tabular
				anchor="start"
			/>
			<Label
				x={p.x0 + 8}
				y={p.y0 + PH + 34}
				text={p.crest
					? `model: ${hoursMinutes(p.crest.minute * 60)}, ${height(p.crest.height)}`
					: 'model: —'}
				size={12}
				color="var(--tsu-wave-text)"
				tabular
				anchor="start"
			/>
		</Readout>
		<Readout id="ax-{p.st.id}">
			<Label
				x={p.x0 + 4}
				y={p.y0 + PH - 6}
				text={hoursMinutes(p.from * 60)}
				size={10}
				muted
				anchor="start"
			/>
			<Label
				x={p.x0 + PW - 4}
				y={p.y0 + PH - 6}
				text={hoursMinutes((p.from + BEFORE + AFTER) * 60)}
				size={10}
				muted
				anchor="end"
			/>
		</Readout>
	{/each}
	<Readout id="key" order={9} label="Lines" value="each scaled to its own first crest">
		<Label
			x={480}
			y={586}
			text="Solid: the real record. Dashed: the model. Each line is scaled to its own first crest; the heights are given in numbers."
			size={11}
			muted
			anchor="middle"
		/>
	</Readout>
</g>
