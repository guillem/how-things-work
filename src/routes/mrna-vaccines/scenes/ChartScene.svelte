<script lang="ts">
	/**
	 * Steps "doses" and "infection": the model (`../model.ts`).
	 *
	 * "doses": antibodies (log scale) over 120 days after a first dose, for one
	 * dose or two doses 21 days apart (the other faint, for comparison), with
	 * the peak an infection leaves as a dashed yardstick.
	 *
	 * "infection": the infection of the immune-system page, some months after
	 * the last dose: the virus and the antibodies over 20 days, counted from
	 * the infection, in a vaccinated body (bold) and one that never met the
	 * virus (dashed).
	 *
	 * A cursor sweeps each window in SWEEP seconds and holds the finished
	 * picture; reduced motion shows the finished picture.
	 */
	import { Axes, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Tag from './Tag.svelte';
	import { count, pow10 } from '../../immune-system/run';
	import {
		INTERVAL,
		antibody,
		at,
		infectionAntibodyPeak,
		infectionOutcome,
		peak,
		simulateCached,
		type Point
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'doses'));

	const run = simulateCached;
	const yard = infectionAntibodyPeak();

	const LEAD = 0.8;
	const SWEEP = 14;
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const done = $derived(u >= 1);

	const X0 = 400;
	const X1 = 920;
	const lg = (v: number, lo: number) => (v > 0 ? Math.max(lo, Math.log10(v)) : lo);

	// ===================================================== doses ===========
	const DSPAN = 120;
	const two = $derived(String(params.doses ?? '2') !== '1');
	const runOne = run({ doses: [0], infectAt: null, days: DSPAN });
	const runTwo = run({ doses: [0, INTERVAL], infectAt: null, days: DSPAN });
	const main = $derived(two ? runTwo : runOne);
	const other = $derived(two ? runOne : runTwo);
	const dayD = $derived(u * DSPAN);
	const sxD = scale([0, DSPAN], [X0, X1]);
	const syD = scale([0, 4], [480, 90]);
	const pathAb = (s: readonly Point[], upto = Infinity) =>
		linePath(
			s.filter((p) => p.t <= upto + 1e-9),
			(p) => p.t,
			(p) => lg(antibody(p), 0),
			sxD,
			syD
		);
	const peakOne = peak(runOne, antibody);
	const peakTwo = peak(runTwo, antibody, INTERVAL);
	const nowD = $derived(at(main, dayD));
	const ratio = (v: number) =>
		v / yard >= 1 ? `${(v / yard).toFixed(1)}×` : `${(v / yard).toFixed(2)}×`;

	// ===================================================== infection =======
	const ISPAN = 20;
	const vax = $derived(String(params.vaccine ?? '2'));
	const months = $derived(Number(params.months ?? 6));
	const doses = $derived(vax === '0' ? [] : vax === '1' ? [0] : [0, INTERVAL]);
	const infectAt = $derived(vax === '0' ? 0 : doses[doses.length - 1] + 30 * months);
	const runV = $derived(run({ doses, infectAt, days: infectAt + ISPAN }));
	const runU = run({ doses: [], infectAt: 0, days: ISPAN });
	const vacc = $derived(
		runV.filter((p) => p.t >= infectAt - 1e-9).map((p) => ({ ...p, t: p.t - infectAt }))
	);
	const outV = $derived(infectionOutcome(runV, infectAt));
	const outU = infectionOutcome(runU, 0);
	const dayI = $derived(u * ISPAN);
	const sxI = scale([0, ISPAN], [X0, X1]);
	const syV = scale([-1, 8], [270, 70]);
	const syA = scale([0, 5], [520, 340]);
	const pathV = (s: readonly Point[], upto = Infinity) =>
		linePath(
			s.filter((p) => p.t <= upto + 1e-9),
			(p) => p.t,
			(p) => lg(p.V, -1),
			sxI,
			syV
		);
	const pathAI = (s: readonly Point[], upto = Infinity) =>
		linePath(
			s.filter((p) => p.t <= upto + 1e-9),
			(p) => p.t,
			(p) => lg(antibody(p), 0),
			sxI,
			syA
		);
	const abAtInfection = $derived(antibody(vacc[0] ?? runU[0]));
	const verdict = $derived.by(() => {
		if (vax === '0')
			return {
				text: `Not vaccinated: virus gone on day ${Math.round(outU.cleared ?? ISPAN)}`,
				sub: `at its peak ${count(outU.peakV)} doses per mL`,
				at: outU.cleared ?? ISPAN
			};
		if (outV.stopped)
			return {
				text: 'Leftover antibodies stopped the virus at once',
				sub: `it never grew; gone after ${(outV.cleared ?? 0).toFixed(1)} days`,
				at: 1.5
			};
		return {
			text: `Virus gone after ${(outV.cleared ?? ISPAN).toFixed(1)} days`,
			sub: `not vaccinated: ${Math.round(outU.cleared ?? ISPAN)} days · peak ${count(outV.peakV)} against ${count(outU.peakV)}`,
			at: outV.cleared ?? ISPAN
		};
	});
	const verdictShow = $derived(
		reduced || done ? 1 : smoothstep(0, 0.6, (view === 'infection' ? dayI : 0) - verdict.at)
	);
</script>

<g>
	{#if view === 'doses'}
		<!-- left: the read-outs -->
		<Readout id="d-day" order={1} label="Days after the first dose" value={dayD.toFixed(0)}>
			<text x={24} y={60} style:font-size="16px" font-weight="600"
				>Day {dayD.toFixed(0)} after the first dose</text
			>
		</Readout>
		<Readout
			id="d-now"
			order={2}
			label="Antibodies now"
			value="{count(antibody(nowD))} pg/mL"
			color="var(--im-antibody)"
		>
			<text x={24} y={92} style:font-size="13px"
				>antibodies now <tspan font-weight="600" dx="4">{count(antibody(nowD))} pg/mL</tspan></text
			>
		</Readout>
		<Readout
			id="d-one"
			order={3}
			label="Peak after one dose"
			value="{count(peakOne.v)} pg/mL, {ratio(peakOne.v)} an infection's"
		>
			<g opacity={two ? 0.6 : 1}>
				<text x={24} y={150} style:font-size="13px">peak after one dose</text>
				<text x={24} y={170} style:font-size="15px" font-weight="700"
					>{count(peakOne.v)} pg/mL · {ratio(peakOne.v)} an infection’s</text
				>
			</g>
		</Readout>
		<Readout
			id="d-two"
			order={4}
			label="Peak after two doses"
			value="{count(peakTwo.v)} pg/mL, {ratio(peakTwo.v)} an infection's, {Math.round(
				peakTwo.v / peakOne.v
			)} times one dose"
		>
			<g opacity={two ? 1 : 0.6}>
				<text x={24} y={214} style:font-size="13px">peak after two doses</text>
				<text x={24} y={234} style:font-size="15px" font-weight="700"
					>{count(peakTwo.v)} pg/mL · {ratio(peakTwo.v)} an infection’s</text
				>
				<text x={24} y={254} style:font-size="12px" class="muted"
					>{Math.round(peakTwo.v / peakOne.v)} times the first dose’s peak</text
				>
			</g>
		</Readout>
		<Readout id="d-why">
			<text x={24} y={310} style:font-size="12px" class="muted"
				>the second dose meets memory cells:</text
			>
			<text x={24} y={328} style:font-size="12px" class="muted">more of them, sooner, faster</text>
		</Readout>

		<!-- right: the chart -->
		<Axes
			sx={sxD}
			sy={syD}
			xTicks={[0, 21, 40, 60, 80, 100, 120]}
			yTicks={[0, 1, 2, 3, 4]}
			yFormat={pow10}
			xLabel="days after the first dose"
			yLabel="antibodies, pg/mL (log scale)"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={syD(Math.log10(yard))}
			y2={syD(Math.log10(yard))}
			stroke="var(--im-virus)"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
		<Readout
			id="d-yard"
			order={5}
			label="Dashed line"
			value="the antibody peak after the model's infection"
		>
			<Tag
				x={X1 - 4}
				y={syD(Math.log10(yard)) - 8}
				text="peak after an infection"
				size={11}
				anchor="end"
				color="var(--im-virus)"
			/>
		</Readout>
		<path
			d={pathAb(other)}
			fill="none"
			stroke="var(--im-antibody)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.45"
		/>
		<path
			d={pathAb(main, dayD)}
			fill="none"
			stroke="var(--im-antibody)"
			stroke-width="2.8"
			stroke-linejoin="round"
		/>
		{#each two ? [0, INTERVAL] : [0] as d (d)}
			<g transform="translate({sxD(d)} {syD(0) - 4})">
				<path d="M0 0 L-6 -14 L6 -14 Z" fill="var(--mv-mrna)" />
			</g>
		{/each}
		<Readout id="d-key">
			<Tag
				x={sxD(INTERVAL) + 8}
				y={syD(0) - 22}
				text={two ? 'second dose' : ''}
				size={11}
				anchor="start"
				muted
			/>
			<Tag x={sxD(0) + 8} y={syD(0) - 22} text="dose" size={11} anchor="start" muted />
			<Tag
				x={X1 - 4}
				y={72}
				text={two ? 'faint: one dose only' : 'faint: two doses'}
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
		{#if !done}
			<line
				x1={sxD(dayD)}
				x2={sxD(dayD)}
				y1={90}
				y2={480}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
				opacity="0.7"
			/>
			<circle cx={sxD(dayD)} cy={syD(lg(antibody(nowD), 0))} r="4" fill="var(--im-antibody)" />
		{/if}
	{:else}
		<!-- left: the read-outs -->
		<Readout id="i-day" order={1} label="Days after the infection" value={dayI.toFixed(1)}>
			<text x={24} y={60} style:font-size="16px" font-weight="600"
				>Day {dayI.toFixed(1)} of the infection</text
			>
		</Readout>
		<Readout
			id="i-who"
			order={2}
			label="Before the infection"
			value={vax === '0'
				? 'never vaccinated'
				: `${vax === '1' ? 'one dose' : 'two doses'}, ${months} month${months === 1 ? '' : 's'} earlier`}
		>
			<text x={24} y={88} style:font-size="13px"
				>{vax === '0'
					? 'never vaccinated'
					: `${vax === '1' ? 'one dose' : 'two doses'}, ${months} month${months === 1 ? '' : 's'} before`}</text
			>
		</Readout>
		<Readout
			id="i-ab0"
			order={3}
			label="Antibodies when the virus arrives"
			value="{count(abAtInfection)} pg/mL"
			color="var(--im-antibody)"
		>
			<text x={24} y={124} style:font-size="12px" class="muted"
				>antibodies when the virus arrives</text
			>
			<text x={24} y={144} style:font-size="15px" font-weight="700" style:fill="var(--im-antibody)"
				>{count(abAtInfection)} pg/mL</text
			>
		</Readout>
		<Readout
			id="i-verdict"
			order={4}
			label={verdict.text}
			value={verdict.sub}
			opacity={verdictShow}
		>
			<g opacity={verdictShow}>
				<text x={24} y={210} style:font-size="15px" font-weight="700">{verdict.text}</text>
				<text x={24} y={230} style:font-size="12px" class="muted">{verdict.sub}</text>
			</g>
		</Readout>

		<Axes
			sx={sxI}
			sy={syV}
			xTicks={[]}
			yTicks={[0, 2, 4, 6, 8]}
			yFormat={pow10}
			yLabel="free virus per mL (log scale)"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={syV(0)}
			y2={syV(0)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Readout id="i-cleared">
			<Tag x={X1 - 4} y={syV(0) - 6} text="below 1: cleared" size={11} anchor="end" muted />
		</Readout>
		{#if vax !== '0'}
			<path
				d={pathV(runU)}
				fill="none"
				stroke="var(--im-virus)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.5"
			/>
		{/if}
		<path
			d={pathV(vax === '0' ? runU : vacc, dayI)}
			fill="none"
			stroke="var(--im-virus)"
			stroke-width="2.8"
			stroke-linejoin="round"
		/>

		<Axes
			sx={sxI}
			sy={syA}
			xTicks={[0, 5, 10, 15, 20]}
			yTicks={[0, 1, 2, 3, 4, 5]}
			yFormat={pow10}
			xLabel="days after the infection"
			yLabel="antibodies, pg/mL (log)"
		/>
		{#if vax !== '0'}
			<path
				d={pathAI(runU)}
				fill="none"
				stroke="var(--im-antibody)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.5"
			/>
		{/if}
		<path
			d={pathAI(vax === '0' ? runU : vacc, dayI)}
			fill="none"
			stroke="var(--im-antibody)"
			stroke-width="2.8"
			stroke-linejoin="round"
		/>
		{#if vax !== '0'}
			<Readout id="i-key" label="Dashed: never vaccinated">
				<line
					x1={X1 - 170}
					x2={X1 - 148}
					y1={44}
					y2={44}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="4 3"
				/>
				<text x={X1 - 142} y={48} style:font-size="12px" class="muted">never vaccinated</text>
			</Readout>
		{/if}
		{#if !done}
			{#each [[70, 270], [350, 520]] as [a, b] (a)}
				<line
					x1={sxI(dayI)}
					x2={sxI(dayI)}
					y1={a}
					y2={b}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 3"
					opacity="0.7"
				/>
			{/each}
		{/if}
	{/if}
</g>
