<script lang="ts">
	/**
	 * The palette: the reader places doses on the timeline. A cursor on the time axis (a Handle:
	 * drag it, click the chart, or use the arrow keys) says where; the palette's buttons add an
	 * injection, a tablet, a 24-hour drip or the label's loading dose there; a placed dose is a
	 * button that removes it. Each drug starts with its usual regimen (`Drug.dose` every
	 * `Drug.interval` hours), which "Usual regimen" restores. The tank shows the level at the
	 * cursor. Nothing moves with time except the tank's drain.
	 */
	import { untrack } from 'svelte';
	import { Handle, Label, clamp, scale, toSvg, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DRUGS, type Drug, type Form } from '../drugs';
	import {
		bodyOf,
		elimination,
		hoursInside,
		levelAt,
		range,
		repeated,
		simulate,
		type Dose
	} from '../model';
	import { amountText } from '../regimens';
	import DoseStrip from './DoseStrip.svelte';
	import LevelChart from './LevelChart.svelte';
	import Tank from './Tank.svelte';
	import { C, L, duration, highest, level, levelMax, pathOf } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const num = (v: unknown, fallback: number) => {
		const x = Number(v);
		return Number.isFinite(x) ? x : fallback;
	};
	const drugId = $derived(String(params.drug8 ?? 'theophylline'));
	const drug = $derived(DRUGS[drugId] ?? DRUGS.theophylline);
	const span = $derived(drug.span);
	const body = $derived(
		bodyOf(drug, {
			clearance: num(params.cl8, 1),
			volume: num(params.v8, 1),
			ka: drug.ka * num(params.ka8, 1)
		})
	);

	const usual = (d: Drug): Dose[] =>
		repeated({
			amount: d.dose,
			interval: d.interval,
			form: d.doseForm,
			until: d.span,
			duration: d.doseForm === 'injection' ? d.injectionMinutes / 60 : undefined
		});

	let doses = $state<Dose[]>(usual(DRUGS.theophylline));
	let cursor = $state(18);
	// a new drug starts from its usual regimen
	$effect(() => {
		const d = drug;
		untrack(() => {
			doses = usual(d);
			cursor = Math.round(d.span / 4);
		});
	});

	const series = $derived(simulate(body, doses, span, 1200));
	const sx = $derived(scale([0, span], [L.PX0, L.PX1]));
	const yMax = $derived(levelMax(drug, highest(series)));
	const sy = $derived(scale([0, yMax], [L.PY0, L.PY1]));
	const path = $derived(pathOf(series, sx, sy));
	const now = $derived(levelAt(series, cursor));

	const sorted = $derived([...doses].sort((a, b) => a.t - b.t));
	const first = $derived(sorted.length ? sorted[0].t : 0);
	const peak = $derived(highest(series));
	const lastDay = $derived(range(series, span - 24, span));
	const inRange = $derived(
		drug.window && span > first
			? hoursInside(series, drug.window[0], drug.window[1], first, span) / (span - first)
			: NaN
	);

	// ---------------------------------------------------------------- the palette
	const snap = (h: number) => clamp(Math.round(h), 0, span - 1);
	const at = (h: number) => (span > 96 ? `day ${(h / 24).toFixed(1)}` : `hour ${h}`);
	const add = (form: Form | 'loading') => {
		const h = cursor;
		if (form === 'loading') {
			const ld = drug.loading;
			if (!ld) return;
			const parts = ld.parts.map(([after, amount]): Dose => ({
				t: Math.min(span - 1, h + after),
				form: ld.form,
				amount,
				duration: ld.form === 'injection' ? ld.minutes / 60 : undefined
			}));
			doses = [...doses, ...parts];
			return;
		}
		if (!drug.forms.includes(form)) return;
		const dose: Dose =
			form === 'tablet'
				? { t: h, form, amount: drug.tablet }
				: form === 'injection'
					? { t: h, form, amount: drug.injection, duration: drug.injectionMinutes / 60 }
					: { t: h, form, amount: drug.drip, duration: 24 };
		doses = [...doses, dose];
	};

	interface Chip {
		id: Form | 'loading';
		name: string;
		detail: string;
		ok: boolean;
	}
	const chips = $derived<Chip[]>([
		{
			id: 'injection',
			name: 'injection',
			detail: drug.forms.includes('injection')
				? `${amountText(drug, drug.injection)}${drug.injectionMinutes ? ` over ${drug.injectionMinutes} min` : ''}`
				: 'not given this way',
			ok: drug.forms.includes('injection')
		},
		{
			id: 'tablet',
			name: drug.id === 'phenytoin' ? 'capsule' : drug.id === 'lithium' ? 'capsules' : 'tablet',
			detail: drug.forms.includes('tablet')
				? amountText(drug, drug.tablet)
				: 'not absorbed by mouth',
			ok: drug.forms.includes('tablet')
		},
		{
			id: 'drip',
			name: 'drip, 24 h',
			detail: drug.forms.includes('drip')
				? `${amountText(drug, drug.drip)} per hour`
				: 'not given this way',
			ok: drug.forms.includes('drip')
		},
		{
			id: 'loading',
			name: 'loading dose',
			detail: drug.loading
				? drug.loading.parts.map(([, a]) => amountText(drug, a)).join(' + ')
				: 'none on the label',
			ok: drug.loading !== null
		}
	]);
	const CW = 138;
	const CH = 36;
	const CY = 70;
	const chipX = (i: number) => L.PX0 + i * (CW + 12);

	const reset = () => (doses = usual(drug));
	const clear = () => (doses = []);

	let chart = $state<SVGRectElement>();
	const pick = (e: MouseEvent) => {
		if (!chart) return;
		const p = toSvg(e, chart);
		cursor = snap(sx.invert(p.x));
	};
	const keyStep = $derived(span > 96 ? 6 : 1);

	const drain = $derived(elimination(body, now) / Math.max(1e-9, elimination(body, yMax)));
	const gutNow = $derived.by(() => {
		if (!doses.some((d) => d.form === 'tablet')) return null;
		const i = Math.min(series.t.length - 1, Math.round(cursor / series.dt));
		return series.g[i] / (drug.F * drug.tablet);
	});
	const pouring = $derived(
		doses.some(
			(d) =>
				d.form !== 'tablet' &&
				cursor >= d.t &&
				cursor < d.t + Math.max(d.duration ?? 0, span * 0.012)
		)
	);
	const fmtL = (v: number) => `${v < 100 ? v.toFixed(0) : Math.round(v / 10) * 10} L`;
	const fmtCL = (v: number) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)} L/h`;
	const pctText = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
</script>

{#snippet button(label: string, x: number, y: number, w: number, onpress: () => void, ok = true)}
	<g
		class="chip"
		role="button"
		tabindex={ok ? 0 : -1}
		aria-disabled={!ok}
		aria-label={label}
		style:cursor={ok ? 'pointer' : 'default'}
		onclick={() => ok && onpress()}
		onkeydown={(e) => {
			if (ok && (e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				onpress();
			}
		}}
	>
		<rect
			{x}
			{y}
			width={w}
			height={CH}
			rx="8"
			fill="var(--surface)"
			stroke={ok ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
			stroke-width={ok ? 1.5 : 1}
			opacity={ok ? 1 : 0.6}
		/>
	</g>
{/snippet}

<g>
	<LevelChart {sx} {sy} {drug} {span} />

	<!-- click the chart to move the cursor -->
	<rect
		bind:this={chart}
		x={L.PX0}
		y={L.PY1}
		width={L.PX1 - L.PX0}
		height={L.PY0 - L.PY1}
		fill="transparent"
		role="presentation"
		onclick={pick}
	/>

	<path
		d={path}
		fill="none"
		stroke={C.curve}
		stroke-width="2.6"
		stroke-linejoin="round"
		pointer-events="none"
	/>
	<line
		x1={sx(cursor)}
		x2={sx(cursor)}
		y1={L.STRIP - 16}
		y2={L.PY0}
		stroke="var(--explainer-accent, var(--accent))"
		stroke-width="1.2"
		stroke-dasharray="4 3"
		pointer-events="none"
	/>
	<line
		x1={L.TX + L.TW / 2 + 70}
		x2={sx(cursor)}
		y1={sy(now)}
		y2={sy(now)}
		stroke={C.water}
		stroke-width="1.2"
		stroke-dasharray="1 4"
		pointer-events="none"
	/>
	<circle
		cx={sx(cursor)}
		cy={sy(now)}
		r="5"
		fill={C.curve}
		stroke="var(--stage-bg)"
		stroke-width="2"
		pointer-events="none"
	/>

	<DoseStrip
		{sx}
		{drug}
		{doses}
		{span}
		onremove={(i) => (doses = doses.filter((_, j) => j !== i))}
	/>

	<Handle
		x={sx(cursor)}
		y={L.PY0}
		label="Cursor: where the next dose goes"
		value={cursor}
		min={0}
		max={span - 1}
		valuetext={at(cursor)}
		onmove={(p: Point) => (cursor = snap(sx.invert(p.x)))}
		onkey={(k) =>
			(cursor = k === 'start' ? 0 : k === 'end' ? span - 1 : snap(cursor + k * keyStep))}
	/>

	<!-- the palette -->
	{#each chips as c, i (c.id)}
		{@render button(
			c.ok
				? `Add ${c.name === 'loading dose' ? 'the loading dose' : `a ${c.name}`} at ${at(cursor)}`
				: `${c.name}: ${c.detail}`,
			chipX(i),
			CY,
			CW,
			() => add(c.id),
			c.ok
		)}
		<g pointer-events="none" opacity={c.ok ? 1 : 0.55}>
			<Label
				x={chipX(i) + 12}
				y={CY + 15}
				anchor="start"
				text="+ {c.name}"
				size={12}
				weight={700}
				halo={false}
			/>
			<Label
				x={chipX(i) + 12}
				y={CY + 29}
				anchor="start"
				text={c.detail}
				size={10}
				muted
				halo={false}
			/>
		</g>
	{/each}
	{@render button('Restore the usual regimen', 24, CY, 120, reset)}
	{@render button('Remove every dose', 152, CY, 96, clear)}
	<g pointer-events="none">
		<Label x={84} y={CY + 22} text="usual regimen" size={12} weight={600} halo={false} />
		<Label x={200} y={CY + 22} text="clear all" size={12} weight={600} halo={false} />
	</g>

	<Tank
		surface={sy(now)}
		widthScale={body.V / drug.V}
		gut={gutNow}
		{pouring}
		{drain}
		volumeText={fmtL(body.V)}
		clearanceText={body.saturable ? 'falls as the level rises' : fmtCL(body.CL)}
		halfText={body.saturable ? null : duration((Math.LN2 * body.V) / body.CL)}
		{t}
		{reduced}
	/>

	<!-- read-outs -->
	<Readout id="b1" order={0} label="Drug" value="{drug.what}, {doses.length} doses">
		<Label
			x={24}
			y={30}
			anchor="start"
			text="{drug.what}: {doses.length} dose{doses.length === 1 ? '' : 's'} · cursor at {at(
				cursor
			)}, level {level(now, drug)}"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="b2"
		order={1}
		label="Levels"
		value="highest {level(peak, drug)}; last day {level(lastDay.min, drug, false)}–{level(
			lastDay.max,
			drug
		)}"
	>
		<Label
			x={24}
			y={54}
			anchor="start"
			text="highest {level(peak, drug)} · last day {level(lastDay.min, drug, false)}–{level(
				lastDay.max,
				drug
			)}{drug.window
				? ` · in the target range ${pctText(inRange)} of the time after the first dose`
				: ' · the label gives no target range'}"
			size={13}
			tabular
		/>
	</Readout>

	<Readout
		id="advice"
		order={20}
		label="Note"
		value="an educational model of one 70 kg adult, not dosing advice"
	>
		<Label
			x={L.PX1}
			y={588}
			anchor="end"
			text="educational model of one 70 kg adult · not dosing advice"
			size={11}
			muted
		/>
	</Readout>
</g>
