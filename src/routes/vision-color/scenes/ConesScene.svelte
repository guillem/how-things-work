<script lang="ts">
	/**
	 * The measured sensitivities of the three cone types (Stockman & Sharpe 2000, CVRL) over the
	 * visible spectrum, and the cones' responses to light.
	 *
	 * Phases (`step.hints.phase`):
	 *   curves — one light at `params.nm` (drag the line): three bars for the L, M and S responses
	 *            and the colour that light looks.
	 *   one    — two lamps: the left fixed at 600 nm, the right at `params.nmB` with brightness
	 *            `params.powerB`. `params.cone` picks an eye with only one kind of cone (it sees
	 *            each lamp as a grey as bright as that cone's signal) or all three (true colours).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, clamp, wave, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cones, cssColour, exposureFor, response, spectralColour, type Cones } from '../colour';
	import { colourName } from '../steps';

	let { step, t, params, setParam }: StageProps = $props();

	const one = $derived(step.hints?.phase === 'one');

	// ------------------------------------------------------------------ chart geometry
	const C = { x0: 70, x1: 610, y0: 420, y1: 92 }; // 390 nm … 700 nm, sensitivity 0 … 1
	const NMA = 390;
	const NMB = 700;
	const xOf = (nm: number) => C.x0 + ((nm - NMA) / (NMB - NMA)) * (C.x1 - C.x0);
	const yOf = (v: number) => C.y0 - v * (C.y0 - C.y1);
	const nmOf = (x: number) => NMA + ((x - C.x0) / (C.x1 - C.x0)) * (NMB - NMA);

	const KINDS = [
		{ k: 0, id: 'L', name: 'L cones', color: 'var(--vc-l)' },
		{ k: 1, id: 'M', name: 'M cones', color: 'var(--vc-m)' },
		{ k: 2, id: 'S', name: 'S cones', color: 'var(--vc-s)' }
	] as const;

	const curves = KINDS.map(({ k }) => {
		const pts: string[] = [];
		for (let nm = NMA; nm <= NMB; nm += 2)
			pts.push(`${xOf(nm).toFixed(1)},${yOf(cones(nm)[k]).toFixed(1)}`);
		return pts.join(' ');
	});
	/** Peak wavelengths (nm), from the data. */
	const PEAKS = [570, 543, 442];

	const STOPS = Array.from({ length: 32 }, (_, i) => NMA + i * 10).map((nm) => ({
		off: (nm - NMA) / (NMB - NMA),
		c: spectralColour(Math.min(nm, NMB), 0.95)
	}));

	// ------------------------------------------------------------------ inputs
	const nm = $derived(clamp(Number(params.nm ?? 580), NMA, NMB));
	const NM_A = 600;
	const nmB = $derived(clamp(Number(params.nmB ?? 500), 400, 680));
	const powerB = $derived(clamp(Number(params.powerB ?? 1), 0, 3));
	const coneSel = $derived(String(params.cone ?? 'M'));
	const all = $derived(!one || coneSel === 'all');
	const kSel = $derived(coneSel === 'L' ? 0 : coneSel === 'S' ? 2 : 1);

	// Dim the curves of cones the one-cone eye doesn't have.
	const focus = KINDS.map(() => new Tween(1, { duration: 600, easing: cubicInOut }));
	$effect(() => {
		const on = KINDS.map(({ k }) => (all ? 1 : k === kSel ? 1 : 0.25));
		untrack(() => {
			on.forEach((v, i) => void focus[i].set(v));
		});
	});

	// ------------------------------------------------------------------ responses
	const here = $derived(cones(nm));
	const lampA = $derived(response([{ nm: NM_A, power: 1 }]));
	const lampB = $derived(response([{ nm: nmB, power: powerB }]));

	/** The colour a lamp looks to this eye: a grey for one kind of cone, else its true colour. */
	const EXPOSE = exposureFor(response([{ nm: 600, power: 1 }]), 0.9);
	const greyOf = (v: number) => {
		const g = clamp(v);
		const e = g <= 0.0031308 ? 12.92 * g : 1.055 * g ** (1 / 2.4) - 0.055;
		const h = Math.round(e * 255);
		return `rgb(${h}, ${h}, ${h})`;
	};
	const patch = (c: Cones) => (all ? cssColour(c, EXPOSE) : greyOf(c[kSel] / 1.1));
	const same = $derived(
		!all && Math.abs(lampA[kSel] - lampB[kSel]) <= 0.02 * Math.max(lampA[kSel], 0.02)
	);

	// A gentle pulse on the light's line, so the frame visibly runs.
	const glow = $derived(0.55 + 0.25 * wave(t, 2.4));

	const BAR = { x: 676, w: 52, gap: 22, top: 150, h: 230 };
	const fmt = (v: number) => v.toFixed(2);
</script>

<g>
	<defs>
		<linearGradient id="cones-spectrum" x1="0" x2="1" y1="0" y2="0">
			{#each STOPS as s (s.off)}
				<stop offset={s.off} stop-color={s.c} />
			{/each}
		</linearGradient>
	</defs>

	<!-- chart frame -->
	<line x1={C.x0} y1={C.y0} x2={C.x1} y2={C.y0} stroke="var(--stage-line)" />
	<line x1={C.x0} y1={C.y0} x2={C.x0} y2={C.y1 - 8} stroke="var(--stage-line)" />
	{#each [0.25, 0.5, 0.75, 1] as v (v)}
		<line x1={C.x0} y1={yOf(v)} x2={C.x1} y2={yOf(v)} stroke="var(--stage-grid)" />
	{/each}
	<Readout id="axis-y">
		<Label x={C.x0 - 10} y={yOf(1) + 4} text="1" anchor="end" size={11} muted />
		<Label x={C.x0 - 10} y={yOf(0.5) + 4} text="0.5" anchor="end" size={11} muted />
		<Label x={C.x0 - 10} y={C.y0 + 4} text="0" anchor="end" size={11} muted />
		<Label
			x={C.x0}
			y={C.y1 - 22}
			text="how strongly each kind of cone responds"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	<rect x={C.x0} y={C.y0 + 8} width={C.x1 - C.x0} height="26" rx="3" fill="url(#cones-spectrum)" />
	{#each [400, 450, 500, 550, 600, 650, 700] as w (w)}
		<line x1={xOf(w)} y1={C.y0 + 34} x2={xOf(w)} y2={C.y0 + 40} stroke="var(--stage-line)" />
		<Readout id="tick-{w}">
			<Label x={xOf(w)} y={C.y0 + 54} text={String(w)} size={11} muted />
		</Readout>
	{/each}
	<Readout id="axis-x">
		<Label x={(C.x0 + C.x1) / 2} y={C.y0 + 74} text="wavelength (nm)" size={12} muted />
	</Readout>

	<!-- the measured curves -->
	{#each KINDS as kd, i (kd.id)}
		<polyline
			points={curves[i]}
			fill="none"
			stroke={kd.color}
			stroke-width="3"
			stroke-linejoin="round"
			opacity={focus[i].current}
		/>
		<Readout id="name-{kd.id}">
			<Label
				x={xOf(PEAKS[i]) + (i === 0 ? 30 : i === 1 ? -34 : 0)}
				y={yOf(1) - 10}
				text="{kd.id} · {PEAKS[i]} nm"
				color={kd.color}
				weight={700}
				size={13}
				opacity={focus[i].current}
			/>
		</Readout>
	{/each}

	{#if !one}
		<!-- the light: a line across the chart, with the three crossing points -->
		<line
			x1={xOf(nm)}
			y1={C.y1 - 4}
			x2={xOf(nm)}
			y2={C.y0 + 34}
			stroke={spectralColour(nm)}
			stroke-width="3"
			opacity={glow}
		/>
		<line
			x1={xOf(nm)}
			y1={C.y1 - 4}
			x2={xOf(nm)}
			y2={C.y0 + 34}
			stroke="var(--stage-ink)"
			stroke-width="1"
			stroke-dasharray="3 3"
		/>
		{#each KINDS as kd (kd.id)}
			<circle
				cx={xOf(nm)}
				cy={yOf(here[kd.k])}
				r="6"
				fill={kd.color}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/each}
		<Handle
			x={xOf(nm)}
			y={C.y0 + 21}
			label="Wavelength"
			value={nm}
			min={NMA}
			max={NMB}
			valuetext="{nm} nanometres, {colourName(nm)}"
			onmove={(p: Point) => setParam('nm', Math.round(clamp(nmOf(p.x), NMA, NMB)))}
			onkey={(k: number | 'start' | 'end') =>
				setParam('nm', k === 'start' ? NMA : k === 'end' ? NMB : clamp(nm + k, NMA, NMB))}
		/>

		<!-- bars -->
		<Readout id="bars-title">
			<Label
				x={BAR.x + (3 * BAR.w + 2 * BAR.gap) / 2}
				y={BAR.top - 30}
				text="the three signals"
				size={13}
				weight={600}
			/>
		</Readout>
		{#each KINDS as kd, i (kd.id)}
			{@const bx = BAR.x + i * (BAR.w + BAR.gap)}
			<rect
				x={bx}
				y={BAR.top}
				width={BAR.w}
				height={BAR.h}
				rx="4"
				fill="none"
				stroke="var(--stage-grid)"
			/>
			<rect
				x={bx}
				y={BAR.top + BAR.h * (1 - here[kd.k])}
				width={BAR.w}
				height={BAR.h * here[kd.k]}
				rx="4"
				fill={kd.color}
			/>
			<Readout
				id="bar-{kd.id}"
				label="{kd.id} signal"
				value={fmt(here[kd.k])}
				note="peak {PEAKS[i]} nm"
				color={kd.color}
				order={10 + i}
			>
				<Label
					x={bx + BAR.w / 2}
					y={BAR.top + BAR.h + 22}
					text={kd.id}
					weight={700}
					color={kd.color}
				/>
				<Label x={bx + BAR.w / 2} y={BAR.top - 8} text={fmt(here[kd.k])} size={12} />
			</Readout>
		{/each}
		<rect
			x={BAR.x}
			y={BAR.top + BAR.h + 44}
			width={3 * BAR.w + 2 * BAR.gap}
			height="58"
			rx="8"
			fill={spectralColour(nm)}
			stroke="var(--border)"
		/>
		<Readout id="looks" label="Looks" value="{nm} nm, {colourName(nm)}" order={20}>
			<Label
				x={BAR.x + (3 * BAR.w + 2 * BAR.gap) / 2}
				y={BAR.top + BAR.h + 124}
				text="{nm} nm looks {colourName(nm)}"
				size={13}
			/>
		</Readout>
	{:else}
		<!-- two lamps on the chart -->
		{#each [{ id: 'A', w: NM_A, p: 1 }, { id: 'B', w: nmB, p: powerB }] as l (l.id)}
			<line
				x1={xOf(l.w)}
				y1={C.y1 - 4}
				x2={xOf(l.w)}
				y2={C.y0 + 34}
				stroke={spectralColour(l.w)}
				stroke-width="3"
				opacity={l.id === 'B' ? glow : 0.7}
			/>
			<line
				x1={xOf(l.w)}
				y1={C.y1 - 4}
				x2={xOf(l.w)}
				y2={C.y0 + 34}
				stroke="var(--stage-ink)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			{#each KINDS as kd (kd.id)}
				<circle
					cx={xOf(l.w)}
					cy={yOf(cones(l.w)[kd.k])}
					r="5"
					fill={kd.color}
					stroke="var(--stage-bg)"
					stroke-width="2"
					opacity={focus[kd.k].current}
				/>
			{/each}
			<Readout id="lamp-tag-{l.id}">
				<Label
					x={xOf(l.w) + (l.id === 'A' ? -8 : 8)}
					y={C.y1 + 22 + (l.id === 'B' && Math.abs(xOf(nmB) - xOf(NM_A)) < 90 ? 30 : 0)}
					text={l.id === 'A' ? 'left lamp' : 'right lamp'}
					anchor={l.id === 'A' ? 'end' : 'start'}
					size={12}
					weight={600}
					pill
				/>
			</Readout>
		{/each}
		<Handle
			x={xOf(nmB)}
			y={C.y0 + 21}
			label="Right lamp wavelength"
			value={nmB}
			min={400}
			max={680}
			valuetext="{nmB} nanometres"
			onmove={(p: Point) => setParam('nmB', Math.round(clamp(nmOf(p.x), 400, 680)))}
			onkey={(k: number | 'start' | 'end') =>
				setParam('nmB', k === 'start' ? 400 : k === 'end' ? 680 : clamp(nmB + k, 400, 680))}
		/>

		<!-- what the eye sees: two patches, and the signals they send -->
		<Readout
			id="eye-title"
			label="This eye has"
			value={all ? 'all three kinds of cone' : `only ${KINDS[kSel].id} cones`}
			order={1}
		>
			<Label
				x={790}
				y={90}
				text={all ? 'with all three kinds of cone' : `with only ${KINDS[kSel].id} cones`}
				size={13}
				weight={600}
			/>
		</Readout>
		{#each [{ id: 'A', c: lampA, x: 660 }, { id: 'B', c: lampB, x: 800 }] as l (l.id)}
			<rect
				x={l.x}
				y={110}
				width="120"
				height="120"
				rx="10"
				fill={patch(l.c)}
				stroke="var(--border)"
			/>
			<Readout id="lamp-{l.id}">
				<Label
					x={l.x + 60}
					y={252}
					text={l.id === 'A' ? 'left: 600 nm' : `right: ${nmB} nm × ${powerB.toFixed(2)}`}
					size={12}
				/>
			</Readout>
			{#each KINDS as kd (kd.id)}
				{@const show = all || kd.k === kSel}
				{@const v = l.c[kd.k]}
				{@const bw = 120 / 3 - 8}
				{@const bx = l.x + kd.k * (120 / 3) + 4}
				{#if show}
					<rect
						x={bx}
						y={280}
						width={bw}
						height="120"
						rx="3"
						fill="none"
						stroke="var(--stage-grid)"
					/>
					<rect
						x={bx}
						y={400 - 120 * clamp(v / 1.2)}
						width={bw}
						height={120 * clamp(v / 1.2)}
						rx="3"
						fill={kd.color}
					/>
					<Readout
						id="sig-{l.id}-{kd.id}"
						label="{l.id === 'A' ? 'Left' : 'Right'} lamp, {kd.id}"
						value={fmt(v)}
						color={kd.color}
						order={l.id === 'A' ? 2 : 3}
					>
						<Label x={bx + bw / 2} y={418} text={kd.id} size={12} weight={700} color={kd.color} />
						<Label x={bx + bw / 2} y={272} text={fmt(v)} size={11} />
					</Readout>
				{/if}
			{/each}
		{/each}
		<Readout
			id="verdict"
			label="To this eye"
			value={all ? 'two different colours' : same ? 'the same' : 'different brightness'}
			order={0}
		>
			<Label
				x={790}
				y={462}
				text={all
					? 'two different colours'
					: same
						? 'same signal: identical to this eye'
						: 'one is brighter than the other'}
				size={14}
				weight={700}
				color={!all && same ? 'var(--vc-good)' : undefined}
			/>
		</Readout>
	{/if}
	<Readout id="source">
		<Label
			x={C.x0}
			y={584}
			text="Stockman & Sharpe (2000) cone sensitivities, CVRL; each scaled to a peak of 1"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
</g>
