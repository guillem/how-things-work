<script lang="ts">
	/**
	 * Busy beavers as space-time diagrams: each row is the tape after one more
	 * step (time runs down), 1s dark, the head outlined. The runs are real
	 * (`run` on the champions from bbchallenge's list).
	 *
	 * - default: the 2-, 3- or 4-state champion (the `beaver` select), replayed
	 *   with `createPlayback` and a scrubber, the rule being applied lit in the
	 *   table on the right;
	 * - `five`: the first 10,000 of the 5-state champion's 47,176,870 steps,
	 *   revealed over a few seconds, every 25th row drawn.
	 *
	 * The diagram is drawn once per run as two paths (1s, head) and revealed
	 * with a clip rectangle, so a frame costs a handful of nodes.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '#lib/explainer/playback.ts';
	import {
		BEAVERS,
		countOnes,
		fromStandard,
		run,
		symbolAt,
		type BeaverSize,
		type Run
	} from '../turing';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const five = $derived(Boolean(step.hints?.five));
	const n = $derived<BeaverSize>(
		five ? 5 : (clamp(Number(params.beaver ?? 3), 2, 4) as BeaverSize)
	);
	const m = $derived(fromStandard(BEAVERS[n]));
	const SHOWN5 = 10_000;
	const EVERY5 = 25;
	const rec = $derived<Run>(run(m, '', five ? SHOWN5 : 1000));
	const total = $derived(rec.steps);
	const playing = $derived(five || params.play !== false);
	const pace = $derived(five ? 1400 : Number(params.bbPace ?? 6));
	const runKey = $derived(`beaver|${n}`);

	// ---- playback ------------------------------------------------------------------------
	const position = createPlayback(0.5);
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	let lastK = 0;
	const k = $derived.by(() => {
		const v = reduced
			? playing
				? total
				: clamp(manual, 0, total)
			: position(t, { key: runKey, playing, pace, manual, total });
		if (playing) lastK = v;
		return v;
	});
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.floor(lastK));
			wasPlaying = now;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', runKey);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		lastK = clamp(Math.round(v), 0, total);
		if (playing && !five) setParam('play', false);
		setPosition(v);
	}
	const kk = $derived(Math.min(total, Math.floor(k)));

	// ---- the diagram ---------------------------------------------------------------------------
	const DX = 24;
	const DY = 112;
	const DW = 500;
	const DH = 410;
	const extent = $derived.by(() => {
		let lo = 0;
		let hi = 0;
		for (const f of rec.frames) {
			lo = Math.min(lo, f.origin);
			hi = Math.max(hi, f.origin + f.cells.length - 1);
		}
		return { lo, hi };
	});
	const every = $derived(five ? EVERY5 : 1);
	const rows = $derived(Math.floor(total / every) + 1);
	const width = $derived(extent.hi - extent.lo + 1);
	const cw = $derived(Math.min(30, DW / width));
	const rh = $derived(Math.min(26, DH / rows));
	const left = $derived(DX + (DW - cw * width) / 2);
	const cx = (c: number) => left + (c - extent.lo) * cw;
	const paths = $derived.by(() => {
		let ones = '';
		let head = '';
		const g = cw > 6 ? 1 : 0;
		for (let r = 0; r < rows; r++) {
			const f = rec.frames[r * every];
			const y = DY + r * rh;
			const h = rh > 6 ? rh - 2 : rh + 0.5;
			let run0: number | null = null;
			for (let c = extent.lo; c <= extent.hi + 1; c++) {
				const one = c <= extent.hi && symbolAt(f, c, '0') === '1';
				if (one && run0 === null) run0 = c;
				if (!one && run0 !== null) {
					ones += `M${(cx(run0) + g).toFixed(2)} ${y.toFixed(2)}h${((c - run0) * cw - 2 * g).toFixed(2)}v${h.toFixed(2)}h${(-(c - run0) * cw + 2 * g).toFixed(2)}z`;
					run0 = null;
				}
			}
			if (!five) head += `M${cx(f.head) + 1} ${y}h${cw - 2}v${h}h${-(cw - 2)}z`;
		}
		return { ones, head };
	});
	const revealH = $derived(Math.min(rows, Math.floor(kk / every) + 1) * rh);
	const frame = $derived(rec.frames[kk]);
	const applied = $derived(kk < total ? rec.applied[kk] : undefined);
	const ones = $derived(countOnes(frame));
	const done = $derived(kk >= total);

	// ---- the rule table --------------------------------------------------------------------------
	const TX = 572;
	const TY = 112;
	const RW = 372;
	const RH = $derived(n === 5 ? 26 : 30);
	const active = $derived(done || five ? null : applied);
	const KY = $derived(TY + RH * (m.states.length + 1) + 44);

	// ---- known values ------------------------------------------------------------------------------
	const knownRows = $derived(
		([2, 3, 4] as const).map((s) => {
			const r = run(fromStandard(BEAVERS[s]), '', 1000);
			return {
				n: String(s),
				steps: r.steps.toLocaleString('en'),
				ones: String(countOnes(r.final))
			};
		})
	);
	const KNOWN = $derived([
		...knownRows,
		{ n: '5', steps: '47,176,870', ones: '4,098' },
		{ n: '6', steps: 'unknown: > 2↑↑↑5', ones: '' }
	]);

	const status = $derived.by(() => {
		if (five)
			return `Step ${kk.toLocaleString('en')} of 47,176,870 · ${ones} ones on the tape so far`;
		if (done) return `Halted after ${total} steps with ${ones} ones: S(${n}) = ${total}`;
		return `Step ${kk} · ${ones} ones on the tape`;
	});

	// ---- timeline -------------------------------------------------------------------------------------
	const TL0 = 60;
	const TL1 = 500;
	const TLY = 556;
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? kk / total : 0));
	function onmove(p: Point) {
		scrubTo(((p.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(s: number | 'start' | 'end') {
		if (s === 'start' || s === 'end') return scrubTo(s === 'start' ? 0 : total);
		scrubTo((playing ? Math.round(lastK) : Math.round(manual)) + s);
	}

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fadeIn}>
	<defs>
		<clipPath id="beaver-reveal">
			<rect x={DX - 4} y={DY - 2} width={DW + 8} height={revealH + 2} />
		</clipPath>
	</defs>
	<Readout
		id="bb-title"
		order={1}
		label="{n}-state busy beaver"
		value={status}
		color={done && !five ? 'var(--tm-halt)' : undefined}
	>
		<Txt x={24} y={42} text="The {n}-state busy beaver, from a blank tape" size={18} weight={600} />
		<Txt
			x={24}
			y={68}
			text={status}
			size={14}
			color={done && !five ? 'var(--tm-halt)' : undefined}
		/>
	</Readout>
	<Readout id="bb-axis">
		<Txt
			x={DX}
			y={DY - 12}
			text={five
				? `time runs down: every ${EVERY5}th of the first ${SHOWN5.toLocaleString('en')} steps`
				: 'time runs down, one row per step; green: the head'}
			size={12}
			muted
		/>
	</Readout>

	<Readout id="bb-key" order={3} label="Dark cells" value="1 (light: 0, blank)">
		<rect x={DX + DW - 132} y={DY - 22} width="12" height="12" rx="2" fill="var(--tm-one)" />
		<Txt x={DX + DW - 116} y={DY - 12} text="1" size={12} muted />
		<rect
			x={DX + DW - 96}
			y={DY - 22}
			width="12"
			height="12"
			rx="2"
			fill="var(--tm-cell)"
			stroke="var(--tm-cell-edge)"
		/>
		<Txt x={DX + DW - 80} y={DY - 12} text="0 (blank)" size={12} muted />
	</Readout>

	<!-- the diagram -->
	<rect
		x={left - 2}
		y={DY - 2}
		width={cw * width + 4}
		height={rows * rh + 2}
		rx="4"
		fill="var(--tm-cell)"
		stroke="var(--tm-cell-edge)"
		stroke-width="1"
	/>
	<g clip-path="url(#beaver-reveal)">
		<path d={paths.ones} fill="var(--tm-one)" />
		{#if !five}
			<path
				d={paths.head}
				fill={rh > 8 ? 'none' : 'var(--tm-head)'}
				fill-opacity="0.9"
				stroke={rh > 8 ? 'var(--tm-head)' : 'none'}
				stroke-width="2"
			/>
		{/if}
	</g>
	{#if !five && !done}
		<!-- the row being written -->
		<rect
			x={left - 6}
			y={DY + Math.min(rows - 1, kk) * rh - 1}
			width={cw * width + 12}
			height={rh}
			rx="3"
			fill="none"
			stroke="var(--tm-write)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- the rule table -->
	<Txt x={TX} y={TY - 12} text="Rules: write, move, next (H = halt)" size={13} weight={600} />
	<rect
		x={TX - 6}
		y={TY - 2}
		width={RW + 12}
		height={RH * (m.states.length + 1) + 8}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Txt x={TX + 8} y={TY + RH * 0.7} text="state" size={12} muted halo={false} />
	{#each ['0', '1'] as s, j (s)}
		<Txt
			x={TX + 90 + ((RW - 90) * (j + 0.5)) / 2}
			y={TY + RH * 0.7}
			text="reads {s}"
			size={12}
			anchor="middle"
			muted
			halo={false}
		/>
	{/each}
	{#each m.states as st, i (st)}
		{@const y = TY + RH * (i + 1)}
		<line x1={TX} x2={TX + RW} y1={y} y2={y} stroke="var(--border)" />
		<Txt
			x={TX + 12}
			y={y + RH * 0.68}
			text={st}
			size={13}
			weight={600}
			mono
			halo={false}
			color={active?.state === st ? 'var(--tm-head)' : undefined}
		/>
		{#each ['0', '1'] as s, j (s)}
			{@const r = m.rules[st][s]}
			{@const on = active?.state === st && active.read === s}
			{@const x0 = TX + 90 + ((RW - 90) * j) / 2}
			{#if on}
				<rect
					x={x0 + 4}
					y={y + 2}
					width={(RW - 90) / 2 - 8}
					height={RH - 4}
					rx="6"
					fill="var(--tm-rule)"
					fill-opacity="0.22"
					stroke="var(--tm-rule)"
					stroke-width="2"
				/>
			{/if}
			<Txt
				x={x0 + (RW - 90) / 4}
				y={y + RH * 0.68}
				text={r ? `${r.write} ${r.move} ${r.next}` : '—'}
				size={13}
				anchor="middle"
				mono
				halo={false}
				weight={on ? 700 : 500}
				color={r?.next === 'H' ? 'var(--tm-halt)' : undefined}
			/>
		{/each}
	{/each}

	<!-- known values -->
	<Readout
		id="known"
		order={4}
		label="Champions S(n)"
		value={KNOWN.map((r) => `S(${r.n}) ${r.n === '6' ? '> 2↑↑↑5' : `= ${r.steps}`}`).join(', ')}
	/>
	<Txt
		x={TX}
		y={KY}
		text="Champions: most steps S(n), and the 1s they leave"
		size={13}
		weight={600}
	/>
	{#each KNOWN as row, i (row.n)}
		{@const y = KY + 26 + i * 24}
		{@const on = row.n === String(n)}
		<Readout id="known-{row.n}">
			{#if on}
				<rect
					x={TX - 6}
					y={y - 17}
					width={RW + 12}
					height="24"
					rx="6"
					fill="var(--tm-head)"
					fill-opacity="0.12"
				/>
			{/if}
			<Txt x={TX + 8} {y} text="n = {row.n}" size={13} weight={on ? 700 : 500} halo={false} />
			<Txt
				x={TX + 100}
				{y}
				text={row.steps}
				size={13}
				weight={on ? 700 : 500}
				halo={false}
				mono={row.n !== '6'}
			/>
			<Txt
				x={TX + RW}
				{y}
				text={row.ones ? `${row.ones} ones` : ''}
				size={13}
				anchor="end"
				muted
				halo={false}
			/>
		</Readout>
	{/each}

	{#if five}
		<Readout id="bb5-note">
			<Txt
				x={TX}
				y={548}
				text="Proved the longest of all 5-state machines in 2024"
				size={13}
				weight={600}
				color="var(--tm-head)"
			/>
			<Txt
				x={TX}
				y={568}
				text="(bbchallenge; the run shown is 0.02% of the whole)"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<!-- timeline -->
		<line
			x1={TL0}
			x2={TL1}
			y1={TLY}
			y2={TLY}
			stroke="var(--stage-grid)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={TL0}
			x2={tlx}
			y1={TLY}
			y2={TLY}
			stroke="var(--explainer-accent)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.6"
		/>
		<Readout id="bb-tl">
			<Txt
				x={(TL0 + TL1) / 2}
				y={TLY + 28}
				text="step {kk} of {total}{playing ? '' : ' · paused: drag or use ← →'}"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
		<Handle
			x={tlx}
			y={TLY}
			r={8}
			label="Busy beaver position"
			value={kk}
			min={0}
			max={total}
			valuetext="{kk} of {total} steps"
			{onmove}
			{onkey}
		/>
	{/if}
</g>
