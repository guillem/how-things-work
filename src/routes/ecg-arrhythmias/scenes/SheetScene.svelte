<script lang="ts">
	/**
	 * The sheet of heart muscle (left), painted by voltage, with its conduction system drawn
	 * over it, and a side panel chosen by `step.hints.focus`:
	 *   - `wave`: lead II and the voltage of one ventricular cell (the white dot);
	 *   - `leads`: Einthoven's triangle with the heart's vector and its loop, and leads I, II, III;
	 *   - `rhythm`: lead II above a real MIT-BIH strip (`step.hints.record`), with the atria's and
	 *     the ventricles' rates.
	 *
	 * The run is a `Run` (see `scenarios.ts`) advanced to (t − t₀) seconds of heart time, at most
	 * CAP steps per frame (a slow machine falls behind and shows the heart's own clock). It starts
	 * again on a new step, a changed control (other than the action buttons) or when t goes back;
	 * the buttons fire an early beat or a shock into the running heart. The run, its start time and
	 * the last t are plain variables inside a `$derived` (as in the Turing dish). Reduced motion:
	 * a fresh run per setting, shown at REDUCED_MS of heart time.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CABLES,
		ECG_EVERY_MS,
		ECTOPIC,
		H,
		MV_PER_UNIT,
		PROBE_V,
		SA,
		SCAR_C,
		SCAR_R,
		W,
		type Heart,
		type Lead
	} from '../model';
	import { RECORDS } from '../records-data';
	import {
		AUTO_SHOCK_MS,
		CONTROL_DEFAULTS,
		FLAT_SHOCK_MS,
		Run,
		atrialRate,
		intervals,
		setup,
		ventricularRate
	} from '../scenarios';
	import { paintSheet, palette, type Palette } from './paint';

	let { step, t, params, reduced, dark }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'wave'));
	const recordId = $derived(step.hints?.record ? String(step.hints.record) : null);
	const record = $derived(recordId ? (RECORDS.find((r) => r.id === recordId) ?? null) : null);
	const s = $derived(setup(step.id, params));
	const key = $derived(`${step.id}|${JSON.stringify(s)}`);
	const fires = $derived(Number(params.fire ?? 0));
	const shocks = $derived(Number(params.shock ?? 0));
	const coupling = $derived(Number(params.coupling ?? CONTROL_DEFAULTS.coupling));

	// ---- the run --------------------------------------------------------------------------------
	/** Heart steps per frame at most (60 ms of heart time). */
	const CAP = 150;
	/** Heart time shown under reduced motion, per step, ms. */
	const REDUCED_MS: Record<string, number> = {
		wave: 4000,
		leads: 2700,
		block: 6500,
		early: 3200,
		reentry: 5200,
		vf: 5200,
		shock: AUTO_SHOCK_MS + 2600,
		flatline: FLAT_SHOCK_MS + 1500
	};
	let run: Run | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	let firesSeen = 0;
	let shocksSeen = 0;
	// a plain cache of settled runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, Run>();

	const current = $derived.by((): { heart: Heart; time: number } => {
		const time = t;
		const k = key;
		if (reduced) {
			const rk = `${k}|${fires}|${shocks}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = new Run(s);
				const end = REDUCED_MS[step.id] ?? 3000;
				// buttons pressed under reduced motion act half-way through the shown run
				if (fires || shocks) {
					r.advanceTo(end / 2);
					if (fires) r.fire(coupling);
					if (shocks) r.shock();
				}
				r.advanceTo(end);
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(rk, r);
			}
			return { heart: r.heart, time: r.heart.time };
		}
		if (!run || k !== runKey || time < lastT - 1e-6) {
			run = new Run(s);
			runKey = k;
			t0 = time;
			firesSeen = fires;
			shocksSeen = shocks;
		}
		if (fires !== firesSeen) {
			firesSeen = fires;
			run.fire(coupling);
		}
		if (shocks !== shocksSeen) {
			shocksSeen = shocks;
			run.shock();
		}
		lastT = time;
		run.advanceTo((time - t0) * 1000, CAP);
		return { heart: run.heart, time: run.heart.time };
	});
	const heart = $derived(current.heart);
	const now = $derived(current.time);

	// ---- painting -------------------------------------------------------------------------------
	let pal = $state.raw<Palette | null>(null);
	$effect(() => {
		void dark;
		untrack(() => {
			pal = palette();
		});
	});
	const image = $derived.by(() => {
		void now;
		return pal ? paintSheet(heart, pal) : '';
	});

	// ---- the sheet's geometry ---------------------------------------------------------------------
	const S = 3.2;
	const GX = 24;
	const GY = 76;
	const cx = (x: number) => GX + (x + 0.5) * S;
	const cy = (y: number) => GY + (y + 0.5) * S;

	/** Each cable's path, and the parts of it excited now. */
	const cablePaths = CABLES.map((c) =>
		c.pts.map((p, i) => `${i ? 'L' : 'M'}${cx(p[0]).toFixed(1)} ${cy(p[1]).toFixed(1)}`).join('')
	);
	const litPaths = $derived.by(() => {
		void now;
		return CABLES.map((c, ci) => {
			const s0 = heart.cableStart[ci];
			let d = '';
			let open = false;
			for (let k = 0; k < c.pts.length; k++) {
				const on = heart.cu[s0 + k] > 0.5;
				if (on) {
					d += `${open ? 'L' : 'M'}${cx(c.pts[k][0]).toFixed(1)} ${cy(c.pts[k][1]).toFixed(1)}`;
					if (!open && k + 1 < c.pts.length)
						d += `L${cx(c.pts[k + 1][0]).toFixed(1)} ${cy(c.pts[k + 1][1]).toFixed(1)}`;
				}
				open = on;
			}
			return d;
		});
	});
	const showEctopic = $derived(['early', 'reentry', 'vf', 'shock'].includes(step.id));
	const showScar = $derived(heart.o.scar);

	// ---- traces ---------------------------------------------------------------------------------
	const PX0 = 452;
	const PX1 = 936;

	/** A lead's last `ms` as a path between x0 and x1 around baseline y (px per mV). */
	function tracePath(
		h: Heart,
		lead: Lead,
		ms: number,
		x0: number,
		x1: number,
		y: number,
		k: number
	) {
		const n = Math.min(h.samples, Math.floor(ms / ECG_EVERY_MS));
		const first = h.samples - n;
		const end = h.samples * ECG_EVERY_MS;
		let d = '';
		for (let j = first; j < h.samples; j += 2) {
			const x = x1 - ((end - (j + 1) * ECG_EVERY_MS) / ms) * (x1 - x0);
			const v = Math.max(-1.6, Math.min(1.6, h.lead(lead, j)));
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(y - v * k).toFixed(1)}`;
		}
		return d;
	}
	/** Vertical grid lines every 200 ms, moving with the paper. */
	function gridTimes(ms: number) {
		const out: number[] = [];
		for (let g = Math.ceil((now - ms) / 200) * 200; g <= now; g += 200) out.push(g);
		return out;
	}
	const xAt = (time: number, ms: number) => PX1 - ((now - time) / ms) * (PX1 - PX0);

	// wave focus: lead II and one cell
	const WAVE_MS = 3000;
	const waveII = $derived.by(() => {
		void now;
		return focus === 'wave' ? tracePath(heart, 'II', WAVE_MS, PX0, PX1, 214, 90) : '';
	});
	const cellPath = $derived.by(() => {
		void now;
		if (focus !== 'wave') return '';
		const n = Math.min(heart.samples, Math.floor(WAVE_MS / ECG_EVERY_MS));
		let d = '';
		for (let j = heart.samples - n; j < heart.samples; j += 2) {
			const x = xAt((j + 1) * ECG_EVERY_MS, WAVE_MS);
			const v = heart.pu[j % heart.pu.length];
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(450 - Math.max(-0.1, Math.min(1.1, v)) * 110).toFixed(1)}`;
		}
		return d;
	});
	/** P, QRS and T labels of the beats in view. */
	const waveMarks = $derived.by(() => {
		void now;
		if (focus !== 'wave') return [];
		const out: { id: string; x: number; text: string }[] = [];
		for (const b of heart.beats) {
			if (b.onset < now - WAVE_MS + 100 || b.onset + 360 > now) continue;
			const p = heart.sinus.filter((x) => x < b.onset).at(-1);
			if (p !== undefined && b.onset - p < 400 && p + 50 > now - WAVE_MS)
				out.push({ id: `p${p}`, x: xAt(p + 50, WAVE_MS), text: 'P' });
			out.push({ id: `q${b.onset}`, x: xAt(b.onset + 30, WAVE_MS), text: 'QRS' });
			out.push({ id: `t${b.onset}`, x: xAt(b.onset + 250, WAVE_MS), text: 'T' });
		}
		return out;
	});

	// leads focus: the triangle and three traces
	const LEADS_MS = 2400;
	const TRI = { ra: [586, 108], la: [802, 108], ll: [694, 290] } as const;
	const TC: [number, number] = [694, 168];
	const vecK = 110;
	const mv = (v: number) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
	const vector = $derived.by(() => {
		void now;
		const j = (heart.samples - 1 + heart.px.length) % heart.px.length;
		if (heart.samples === 0) return { x: 0, y: 0 };
		return { x: heart.px[j] * MV_PER_UNIT * vecK, y: heart.py[j] * MV_PER_UNIT * vecK };
	});
	const loop = $derived.by(() => {
		void now;
		if (focus !== 'leads') return '';
		let d = '';
		const n = Math.min(heart.samples, 300);
		for (let j = heart.samples - n; j < heart.samples; j++) {
			const i = j % heart.px.length;
			const x = TC[0] + heart.px[i] * MV_PER_UNIT * vecK;
			const y = TC[1] + heart.py[i] * MV_PER_UNIT * vecK;
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});
	const LEAD_Y: Record<Lead, number> = { I: 372, II: 452, III: 532 };
	const leadPaths = $derived.by(() => {
		void now;
		if (focus !== 'leads') return null;
		return (['I', 'II', 'III'] as Lead[]).map((l) => ({
			lead: l,
			d: tracePath(heart, l, LEADS_MS, PX0 + 34, PX1, LEAD_Y[l], 40)
		}));
	});
	const nowLeads = $derived.by(() => {
		void now;
		const k = heart.samples - 1;
		if (k < 0) return { I: 0, II: 0, III: 0 };
		return { I: heart.lead('I', k), II: heart.lead('II', k), III: heart.lead('III', k) };
	});

	// rhythm focus: lead II and a real strip
	const RHYTHM_MS = 4000;
	const rhythmII = $derived.by(() => {
		void now;
		return focus === 'rhythm' ? tracePath(heart, 'II', RHYTHM_MS, PX0, PX1, 180, 55) : '';
	});
	const since = $derived(now - RHYTHM_MS);
	const shockMarks = $derived.by(() => {
		const from = since;
		return heart.shocks.filter((x) => x > from);
	});
	const ectopicMarks = $derived.by(() => {
		const from = since;
		return heart.ectopics.filter((x) => x > from);
	});
	/** Where the real strip starts, s into the excerpt (its interesting part in view). */
	const STRIP_FROM: Record<string, number> = { sinus: 0, pvc: 0.5, block: 0, vt: 1, vfl: 0.4 };
	const strip = $derived.by(() => {
		if (!record) return null;
		const from = STRIP_FROM[record.id] ?? 0;
		const span = RHYTHM_MS / 1000;
		const px = (PX1 - PX0) / span;
		let d = '';
		for (
			let i = Math.round(from * record.fs);
			i < Math.min(record.mv.length, (from + span) * record.fs);
			i++
		) {
			const x = PX0 + (i / record.fs - from) * px;
			const v = Math.max(-2.1, Math.min(2.1, record.mv[i]));
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(466 - v * 42).toFixed(1)}`;
		}
		const marks = record.marks
			.filter((m) => m.t >= from && m.t < from + span && m.s !== '+')
			.map((m) => ({ x: PX0 + (m.t - from) * px, s: m.s }));
		const rhythms = record.marks
			.filter((m) => m.s === '+' && m.t >= from && m.t < from + span)
			.map((m) => ({ x: PX0 + (m.t - from) * px, s: m.aux ?? '' }));
		return { d, marks, rhythms };
	});

	// ---- read-outs ------------------------------------------------------------------------------
	const aRate = $derived.by(() => {
		void now;
		return atrialRate(heart);
	});
	const vRate = $derived.by(() => {
		void now;
		return ventricularRate(heart);
	});
	const iv = $derived.by(() => {
		void now;
		return intervals(heart);
	});
	const perMin = (r: number) => (r > 0 ? `${Math.round(r)} a minute` : 'none');
	const prText = $derived(iv?.pr != null && iv.pr < 1000 ? `${Math.round(iv.pr)} ms` : '—');
	const qrsText = $derived(iv && iv.qrs < 400 ? `${Math.round(iv.qrs)} ms` : '—');
	const rhythmNote = $derived.by(() => {
		void now;
		if (step.id === 'flatline')
			return now < FLAT_SHOCK_MS ? 'no rhythm' : 'shocked: still no rhythm';
		if (step.id === 'shock') return heart.shocks.length === 0 ? 'fibrillation' : 'after the shock';
		return '';
	});
	const seconds = $derived((now / 1000).toFixed(1));
</script>

<g>
	<!-- ------------------------------------------------------------------ the sheet -->
	<Readout id="sheet" order={1} label="Heart time" value="{seconds} s">
		<Label anchor="start" x={GX} y={34} text="a sheet of heart muscle" size={15} weight={600} />
		<Label anchor="start" x={GX} y={54} text="heart time {seconds} s" size={12} muted tabular />
	</Readout>
	{#if image}
		<image
			href={image}
			x={GX}
			y={GY}
			width={W * S}
			height={H * S}
			preserveAspectRatio="none"
			style="image-rendering: pixelated"
		/>
	{/if}
	<!-- the conduction system -->
	{#each cablePaths as d, i (i)}
		<path {d} fill="none" stroke="var(--ecg-cable)" stroke-width="1.6" stroke-linejoin="round" />
	{/each}
	{#each litPaths as d, i (i)}
		{#if d}
			<path
				{d}
				fill="none"
				stroke="var(--ecg-cable-lit)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/if}
	{/each}
	<!-- landmarks -->
	<Readout id="sa" order={10} label="Sinus node" marker={1} at={[cx(SA[0]), cy(SA[1])]}>
		<circle
			cx={cx(SA[0])}
			cy={cy(SA[1])}
			r="7"
			fill="none"
			stroke="var(--ecg-mark)"
			stroke-width="1.6"
		/>
		<Label anchor="start" x={cx(SA[0]) + 11} y={cy(SA[1]) - 8} text="sinus node" size={12} />
	</Readout>
	<Readout id="atria">
		<Label x={cx(70)} y={cy(22)} text="atria" size={12} muted />
	</Readout>
	<Readout id="av" order={12} label="AV node" marker={2} at={[cx(56), cy(34)]}>
		<Label anchor="start" x={cx(63)} y={cy(35) + 4} text="AV node" size={12} />
	</Readout>
	<Readout
		id="his"
		order={13}
		label="His bundle and Purkinje fibres"
		marker={3}
		at={[cx(60), cy(47)]}
	>
		<Label anchor="start" x={cx(63)} y={cy(47) + 4} text="His bundle" size={12} />
		<Label x={cx(98)} y={cy(129)} text="Purkinje fibres" size={11} muted />
	</Readout>
	<Readout id="ventricles">
		<Label x={cx(30)} y={cy(132)} text="ventricles" size={12} muted />
	</Readout>
	{#if showScar}
		<Readout id="scar" order={15} label="Scar (dark)">
			<Label x={cx(SCAR_C[0])} y={cy(SCAR_C[1] - SCAR_R[1]) - 6} text="scar" size={11} />
		</Readout>
	{/if}
	{#if showEctopic}
		<circle
			cx={cx(ECTOPIC[0])}
			cy={cy(ECTOPIC[1])}
			r="9"
			fill="none"
			stroke="var(--ecg-mark)"
			stroke-width="1.6"
			stroke-dasharray="3 2"
		/>
		<Readout id="spot" order={16} label="Early-beat spot (dashed ring)">
			<Label
				anchor="start"
				x={cx(ECTOPIC[0]) + 12}
				y={cy(ECTOPIC[1]) + 18}
				text="early-beat spot"
				size={11}
			/>
		</Readout>
	{/if}
	{#if focus === 'wave'}
		<circle
			cx={cx(PROBE_V[0])}
			cy={cy(PROBE_V[1])}
			r="4.5"
			fill="#ffffff"
			stroke="var(--stage-ink)"
			stroke-width="1.4"
		/>
	{/if}
	<!-- key -->
	<Readout id="key">
		{#each [{ c: 'var(--ecg-rest)', t: 'resting' }, { c: 'var(--ecg-excited)', t: 'excited' }, { c: 'var(--ecg-recovering)', t: 'recovering' }] as k, i (k.t)}
			<rect
				x={GX + i * 116}
				y={548}
				width="14"
				height="14"
				rx="3"
				fill={k.c}
				stroke="var(--border)"
			/>
			<Label anchor="start" x={GX + i * 116 + 20} y={559} text={k.t} size={12} halo={false} />
		{/each}
		<line x1={GX} x2={GX + 22} y1={582} y2={582} stroke="var(--ecg-cable)" stroke-width="2" />
		<Label
			anchor="start"
			x={GX + 28}
			y={586}
			text="conduction system (bright where it is firing)"
			size={11}
			muted
			halo={false}
		/>
	</Readout>

	<!-- ------------------------------------------------------------------ panel: wave -->
	{#if focus === 'wave'}
		<Readout id="ii-title">
			<Label
				anchor="start"
				x={PX0}
				y={64}
				text="ECG, lead II (the sheet’s pseudo-ECG)"
				size={13}
				weight={600}
			/>
		</Readout>
		{#each gridTimes(WAVE_MS) as g (g)}
			<line
				x1={xAt(g, WAVE_MS)}
				x2={xAt(g, WAVE_MS)}
				y1={84}
				y2={300}
				stroke="var(--stage-grid)"
				stroke-width="1"
			/>
		{/each}
		<line x1={PX0} x2={PX1} y1={214} y2={214} stroke="var(--stage-line)" stroke-width="1" />
		<path
			d={waveII}
			fill="none"
			stroke="var(--ecg-trace)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		{#each waveMarks as m (m.id)}
			<Label x={m.x} y={98} text={m.text} size={12} weight={600} color="var(--ecg-mark-text)" />
		{/each}
		<Readout id="cell-title">
			<Label
				anchor="start"
				x={PX0}
				y={322}
				text="one ventricular cell’s voltage (the white dot)"
				size={13}
				weight={600}
			/>
		</Readout>
		<line x1={PX0} x2={PX1} y1={450} y2={450} stroke="var(--stage-line)" stroke-width="1" />
		<line
			x1={PX0}
			x2={PX1}
			y1={450 - 0.15 * 110}
			y2={450 - 0.15 * 110}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="4 3"
		/>
		<Label anchor="end" x={PX1} y={450 - 0.15 * 110 - 6} text="threshold" size={11} muted />
		<path d={cellPath} fill="none" stroke="var(--ecg-cell)" stroke-width="2" />
		<Label anchor="start" x={PX0} y={474} text="200 ms between grid lines" size={11} muted />
		<Readout
			id="rates"
			order={2}
			label="Atria · ventricles"
			value="{perMin(aRate)} · {perMin(vRate)}"
		>
			<Label
				anchor="start"
				x={PX0}
				y={512}
				text="atria {perMin(aRate)} · ventricles {perMin(vRate)}"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>
		<Readout
			id="intervals"
			order={3}
			label="PR · QRS"
			value="{prText} · {qrsText}"
			note="normal: PR 120–200 ms, QRS under 120 ms"
		>
			<Label
				anchor="start"
				x={PX0}
				y={538}
				text="PR {prText} · QRS {qrsText}"
				size={14}
				weight={600}
				tabular
			/>
			<Label
				anchor="start"
				x={PX0}
				y={560}
				text="normal ranges: PR 120–200 ms, QRS under 120 ms"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- ------------------------------------------------------------------ panel: leads -->
	{#if focus === 'leads'}
		<Readout id="tri-title">
			<Label
				anchor="start"
				x={PX0}
				y={64}
				text="Einthoven’s triangle and the heart’s vector"
				size={13}
				weight={600}
			/>
		</Readout>
		<path
			d="M{TRI.ra[0]} {TRI.ra[1]}L{TRI.la[0]} {TRI.la[1]}L{TRI.ll[0]} {TRI.ll[1]}Z"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1.4"
		/>
		<Label x={TRI.ra[0] - 4} y={TRI.ra[1] - 12} text="right arm" size={11} muted />
		<Label x={TRI.la[0] + 4} y={TRI.la[1] - 12} text="left arm" size={11} muted />
		<Label x={TRI.ll[0]} y={TRI.ll[1] + 20} text="left leg" size={11} muted />
		<Label x={(TRI.ra[0] + TRI.la[0]) / 2} y={TRI.ra[1] - 8} text="I" size={13} weight={600} />
		<Label
			x={(TRI.ra[0] + TRI.ll[0]) / 2 - 14}
			y={(TRI.ra[1] + TRI.ll[1]) / 2}
			text="II"
			size={13}
			weight={600}
		/>
		<Label
			x={(TRI.la[0] + TRI.ll[0]) / 2 + 16}
			y={(TRI.la[1] + TRI.ll[1]) / 2}
			text="III"
			size={13}
			weight={600}
		/>
		<path d={loop} fill="none" stroke="var(--ecg-loop)" stroke-width="1.4" />
		{#if Math.hypot(vector.x, vector.y) > 2}
			<line
				x1={TC[0]}
				y1={TC[1]}
				x2={TC[0] + vector.x}
				y2={TC[1] + vector.y}
				stroke="var(--ecg-vector)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
				style="color: var(--ecg-vector)"
			/>
		{/if}
		<circle cx={TC[0]} cy={TC[1]} r="3" fill="var(--stage-ink)" />
		{#if leadPaths}
			{#each gridTimes(LEADS_MS) as g (g)}
				<line
					x1={PX0 + 34 + ((g - now + LEADS_MS) / LEADS_MS) * (PX1 - PX0 - 34)}
					x2={PX0 + 34 + ((g - now + LEADS_MS) / LEADS_MS) * (PX1 - PX0 - 34)}
					y1={334}
					y2={570}
					stroke="var(--stage-grid)"
					stroke-width="1"
				/>
			{/each}
			{#each leadPaths as p (p.lead)}
				<line
					x1={PX0 + 34}
					x2={PX1}
					y1={LEAD_Y[p.lead]}
					y2={LEAD_Y[p.lead]}
					stroke="var(--stage-line)"
					stroke-width="1"
				/>
				<Label anchor="start" x={PX0} y={LEAD_Y[p.lead] + 4} text={p.lead} size={13} weight={600} />
				<path
					d={p.d}
					fill="none"
					stroke="var(--ecg-trace)"
					stroke-width="1.8"
					stroke-linejoin="round"
				/>
			{/each}
		{/if}
		<Readout
			id="einthoven"
			order={2}
			label="Now: I + III and II"
			value="{mv(nowLeads.I + nowLeads.III)} and {mv(nowLeads.II)} mV"
		>
			<Label
				anchor="start"
				x={PX0}
				y={584}
				text="now: I + III = {mv(nowLeads.I + nowLeads.III)} mV, II = {mv(nowLeads.II)} mV"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}

	<!-- ------------------------------------------------------------------ panel: rhythm -->
	{#if focus === 'rhythm'}
		<Readout id="sim-title">
			<Label anchor="start" x={PX0} y={64} text="the sheet’s ECG, lead II" size={13} weight={600} />
		</Readout>
		{#if rhythmNote}
			<Label
				anchor="end"
				x={PX1}
				y={64}
				text={rhythmNote}
				size={12}
				color="var(--ecg-mark-text)"
				weight={600}
			/>
		{/if}
		{#each gridTimes(RHYTHM_MS) as g (g)}
			<line
				x1={xAt(g, RHYTHM_MS)}
				x2={xAt(g, RHYTHM_MS)}
				y1={80}
				y2={276}
				stroke="var(--stage-grid)"
				stroke-width="1"
			/>
		{/each}
		<line x1={PX0} x2={PX1} y1={180} y2={180} stroke="var(--stage-line)" stroke-width="1" />
		{#each shockMarks as m (m)}
			<line
				x1={xAt(m, RHYTHM_MS)}
				x2={xAt(m, RHYTHM_MS)}
				y1={84}
				y2={276}
				stroke="var(--ecg-mark)"
				stroke-width="2"
			/>
			<Label
				x={xAt(m, RHYTHM_MS)}
				y={292}
				text="shock"
				size={11}
				weight={600}
				color="var(--ecg-mark-text)"
			/>
		{/each}
		{#each ectopicMarks as m (m)}
			<Label
				x={xAt(m, RHYTHM_MS)}
				y={92}
				text="early beat"
				size={11}
				color="var(--ecg-mark-text)"
			/>
		{/each}
		<path
			d={rhythmII}
			fill="none"
			stroke="var(--ecg-trace)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<Readout
			id="rates"
			order={2}
			label="Atria · ventricles"
			value="{perMin(aRate)} · {perMin(vRate)}"
		>
			<Label
				anchor="start"
				x={PX0}
				y={316}
				text="atria {perMin(aRate)} · ventricles {perMin(vRate)}"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>
		{#if step.id === 'block'}
			<Readout id="pr" order={3} label="PR interval" value={prText} note="normal 120–200 ms">
				<Label
					anchor="end"
					x={PX1}
					y={316}
					text={prText === '—' ? 'PR —: no P wave led to this beat' : `PR ${prText}`}
					size={14}
					weight={600}
					tabular
				/>
			</Readout>
		{/if}
		{#if record && strip}
			<Readout
				id="real"
				order={4}
				label="Bottom: a real ECG"
				value="MIT-BIH record {record.record}"
				note={record.title}
			>
				<Label
					anchor="start"
					x={PX0}
					y={340}
					text="a real ECG: {record.title}"
					size={13}
					weight={600}
				/>
				<Label
					anchor="start"
					x={PX0}
					y={358}
					text="MIT-BIH Arrhythmia Database, record {record.record}, lead MLII"
					size={11}
					muted
				/>
			</Readout>
			{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as g (g)}
				<line
					x1={PX0 + g * ((PX1 - PX0) / 20)}
					x2={PX0 + g * ((PX1 - PX0) / 20)}
					y1={372}
					y2={556}
					stroke="var(--stage-grid)"
					stroke-width="1"
				/>
			{/each}
			<path
				d={strip.d}
				fill="none"
				stroke="var(--ecg-real)"
				stroke-width="1.6"
				stroke-linejoin="round"
			/>
			<Readout id="labels">
				{#each strip.marks as m, i (i)}
					<Label x={m.x} y={382} text={m.s} size={11} mono color="var(--ecg-mark-text)" />
				{/each}
				{#each strip.rhythms as m, i (i)}
					<Label anchor="start" x={m.x + 2} y={568} text={m.s} size={11} mono muted />
				{/each}
			</Readout>
			<Readout id="scale">
				<Label
					anchor="start"
					x={PX0}
					y={584}
					text="both 4 s across, grid lines 200 ms apart; the sheet’s millivolt scale is its own"
					size={11}
					muted
				/>
			</Readout>
		{/if}
	{/if}
</g>
