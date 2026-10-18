<script lang="ts">
	/**
	 * The sheared crystal (top left), its stress–strain curve (bottom left) and a
	 * logarithmic stress gauge (right).
	 *
	 * Hints (see ../steps.ts): `setup` (`perfect`, `one`, `solutes`, `pileup`, or `pick`:
	 * the `pick` control), `view` (`plain`; `bonds`: zoomed on the core with the bonds
	 * across the slip plane; `strain`: atoms coloured by how squeezed or stretched they
	 * are), `real` (the gauge shows the measured band of real pure metals).
	 *
	 * The crystal is a `Crystal` (../crystal.ts), integrated lazily frame by frame
	 * (60 frames a second of animation). The run, its start time and the last time
	 * seen are the only remembered values, kept in plain variables inside a
	 * `$derived` (as in the states-of-matter box). A new run starts when the step or
	 * the crystal's controls change, or when t goes back (a restart). Reduced motion:
	 * a run cached per crystal, shown at a frame where its story is told (the
	 * perfect crystal just after it slipped, the dislocation part-way across).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		A0,
		BOTTOM,
		Crystal,
		FPS,
		TOP,
		cores,
		localStrain,
		slipBonds,
		type Frame
	} from '../crystal';
	import {
		GLIDE_STRESS,
		IDEAL_STRENGTH,
		SHEAR_MODULUS,
		specFor,
		type Setup,
		type SetupParams
	} from '../setups';

	let { step, t, params, reduced }: StageProps = $props();

	const hints = $derived(step.hints ?? {});
	const view = $derived(String(hints.view ?? 'plain'));
	const real = $derived(hints.real === true);
	const setup = $derived<Setup>(
		(hints.setup === 'pick' ? String(params.pick ?? 'solutes') : String(hints.setup)) as Setup
	);
	const sp = $derived<SetupParams>({
		fraction: Number(params.fraction ?? 5) / 100,
		size: params.size === 'small' ? 0.88 : 1.12,
		count: Number(params.count ?? 3)
	});
	const runKey = $derived(
		setup === 'solutes'
			? `${setup}|${sp.fraction}|${sp.size}`
			: setup === 'pileup'
				? `${setup}|${sp.count}`
				: setup
	);

	// ---- the run --------------------------------------------------------------------
	/** Frames shown under reduced motion: after the slip, or with the core part-way. */
	const REDUCED_FRAME: Record<Setup, number> = {
		perfect: 470,
		one: 330,
		solutes: 420,
		pileup: 520
	};
	/** At most this many frames are integrated per drawn frame (a slow machine falls behind). */
	const CATCH_UP = 90;
	let run: Crystal | null = null;
	let key = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, Crystal>();

	const current = $derived.by((): { run: Crystal; fi: number } => {
		const time = t;
		const k = `${step.id}|${runKey}`;
		if (reduced) {
			let r = reducedRuns.get(runKey);
			if (!r) {
				r = new Crystal(specFor(setup, sp));
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(runKey, r);
			}
			return { run: r, fi: REDUCED_FRAME[setup] };
		}
		if (!run || k !== key || time < lastT - 1e-6) {
			run = new Crystal(specFor(setup, sp));
			key = k;
			t0 = time;
		}
		lastT = time;
		const target = Math.max(0, Math.round((time - t0) * FPS));
		return { run, fi: Math.min(target, run.computed + CATCH_UP) };
	});
	const c = $derived(current.run);
	const frame = $derived<Frame>(c.frame(current.fi));
	const coreXs = $derived(cores(c, frame));
	/** The shown frame's index, read after the frame is integrated (the curve grows with it). */
	const fi = $derived.by(() => {
		void frame;
		return current.fi;
	});

	// ---- camera: the whole crystal, or zoomed on the core ---------------------------
	const PANEL = { x: 24, y: 58, w: 640, h: 262 };
	const S = 15.2;
	const ZOOM = 2.7;
	const zoomed = $derived(view === 'bonds' ? 1 : 0);
	const zoom = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const z = zoomed;
		untrack(() => zoom.set(z, { duration: reduced ? 0 : 800 }));
	});
	const wrap = (dx: number, W: number) => dx - W * Math.round(dx / W);
	const cam = $derived.by(() => {
		const u = zoom.current;
		const W = c.width;
		// the pile-up's particle sits near the box's right end: show it at four fifths of the panel
		const base = setup === 'pileup' ? 0.65 * W : W / 2;
		const core = coreXs.length ? coreXs[0] : base;
		const midY = (c.spec.rows - 1) * ((A0 * Math.sqrt(3)) / 2) * 0.5;
		return {
			x: base + u * wrap(core - base, W),
			y: midY + u * (c.slipY - midY),
			s: S * (1 + (ZOOM - 1) * u)
		};
	});
	const cx = PANEL.x + PANEL.w / 2;
	const cy = PANEL.y + PANEL.h / 2 + 4;
	const px = (x: number) => cx + wrap(x - cam.x, c.width) * cam.s;
	const py = (y: number) => cy - (y - cam.y) * cam.s;

	// ---- the atoms --------------------------------------------------------------------
	/** The marked column: per row, the atom nearest a vertical line, picked at the run's start. */
	const columnOf = new WeakMap<Crystal, Uint8Array>();
	const column = $derived.by(() => {
		let col = columnOf.get(c);
		if (!col) {
			col = new Uint8Array(c.n);
			const f0 = c.frame(0);
			const xm = c.width * (setup === 'one' || setup === 'solutes' ? 0.45 : 0.5);
			const best: { i: number; d: number }[] = [];
			for (let i = 0; i < c.n; i++) {
				const d = Math.abs(wrap(f0.x[i] - xm, c.width));
				const b = best[c.row[i]] as { i: number; d: number } | undefined;
				if (!b || d < b.d) best[c.row[i]] = { i, d };
			}
			for (const b of best) if (b) col[b.i] = 1;
			columnOf.set(c, col);
		}
		return col;
	});

	const STRAIN_BINS = 9;
	const STRAIN_MAX = 0.05;
	const circle = (x: number, y: number, r: number) =>
		`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

	const atoms = $derived.by(() => {
		const strainView = view === 'strain';
		const strain = strainView ? localStrain(c, frame) : null;
		const out = {
			host: '',
			grip: '',
			column: '',
			solute: '',
			hard: '',
			bins: Array.from({ length: STRAIN_BINS }, () => '')
		};
		const left = PANEL.x - 20;
		const right = PANEL.x + PANEL.w + 20;
		for (let i = 0; i < c.n; i++) {
			const x = px(frame.x[i]);
			if (x < left || x > right) continue;
			const y = py(frame.y[i]);
			const r = 0.43 * cam.s * c.sigma[i];
			const d = circle(x, y, r);
			if (c.hard[i]) out.hard += d;
			else if (c.sigma[i] !== 1) out.solute += d;
			else if (column[i]) out.column += d;
			else if (c.role[i] === TOP || c.role[i] === BOTTOM) out.grip += d;
			else if (strain) {
				const u = Math.max(-1, Math.min(1, strain[i] / STRAIN_MAX));
				const b = Math.round(((u + 1) / 2) * (STRAIN_BINS - 1));
				out.bins[b] += d;
			} else out.host += d;
		}
		return out;
	});
	/** Fill of a strain bin: squeezed (blue) through the host colour to stretched (red). */
	const binFill = (b: number) => {
		const u = (b / (STRAIN_BINS - 1)) * 2 - 1;
		const pct = Math.round(Math.abs(u) * 85);
		const end = u < 0 ? 'var(--da-squeezed)' : 'var(--da-stretched)';
		return `color-mix(in oklab, ${end} ${pct}%, var(--da-atom))`;
	};

	// ---- bonds across the slip plane (the zoomed view) -------------------------------
	const bonds = $derived.by(() => {
		if (zoom.current < 0.02) return { calm: '', strained: '' };
		let calm = '';
		let strained = '';
		for (const b of slipBonds(c, frame)) {
			const x1 = px(frame.x[b.i]);
			const x2 = px(frame.x[b.j]);
			if (Math.abs(x1 - x2) > 4 * cam.s) continue;
			if (Math.min(x1, x2) < PANEL.x - 10 || Math.max(x1, x2) > PANEL.x + PANEL.w + 10) continue;
			const seg = `M${x1.toFixed(1)} ${py(frame.y[b.i]).toFixed(1)}L${x2.toFixed(1)} ${py(frame.y[b.j]).toFixed(1)}`;
			if (b.length > 1.18) strained += seg;
			else calm += seg;
		}
		return { calm, strained };
	});

	// ---- geometry of the crystal's frame ----------------------------------------------
	const rowH = (A0 * Math.sqrt(3)) / 2;
	const gripTop = $derived(py((c.spec.rows - 2.5) * rowH));
	const gripTopEdge = $derived(py((c.spec.rows - 0.5) * rowH));
	const gripBottom = $derived(py(1.5 * rowH));
	const gripBottomEdge = $derived(py(-0.5 * rowH));
	const slipLineY = $derived(py(c.slipY));
	const showSlip = $derived(setup !== 'perfect');

	// ---- the curve -----------------------------------------------------------------------
	const G = SHEAR_MODULUS;
	const CHART = { x: 92, y: 384, w: 560, h: 158 };
	const SPAN: Record<Setup, number> = { perfect: 0.26, one: 0.08, solutes: 0.08, pileup: 0.14 };
	const Y_RANGE: Record<Setup, [number, number]> = {
		perfect: [0, 0.18],
		one: [0, 0.0015],
		solutes: [-0.006, 0.018],
		pileup: [-0.01, 0.07]
	};
	/** Running mean of the stress over SMOOTH frames (the gauge and the curve). */
	const SMOOTH = 15;
	const smoothed = (i: number) => {
		const s = c.curve.stress;
		let sum = 0;
		let k = 0;
		for (let j = Math.max(0, i - SMOOTH + 1); j <= i; j++) {
			sum += s[j];
			k++;
		}
		return sum / k / G;
	};
	const strainNow = $derived(frame.strain);
	const sx = $derived.by(() => {
		const span = SPAN[setup];
		const hi = Math.max(span, strainNow);
		return scale([hi - span, hi], [CHART.x, CHART.x + CHART.w]);
	});
	/** The chart's stress range: the setup's, widened (in steps of 0.005) to hold the whole curve. */
	const yDomain = $derived.by((): [number, number] => {
		const [lo, hi] = Y_RANGE[setup];
		if (setup === 'perfect' || setup === 'one') return [lo, hi];
		let mn = lo;
		let mx = hi;
		for (let i = 0; i <= fi; i++) {
			const v = smoothed(i);
			if (v > mx) mx = v;
			if (v < mn) mn = v;
		}
		const q = 0.005;
		return [Math.floor(mn / q) * q, Math.ceil(mx / q) * q];
	});
	const sy = $derived(scale(yDomain, [CHART.y + CHART.h, CHART.y]));
	const curvePath = $derived.by(() => {
		const [lo] = sx.domain;
		const strain = c.curve.strain;
		let start = 0;
		while (start < fi && strain[start] < lo) start++;
		const step = Math.max(1, Math.ceil((fi - start) / 400));
		const [ylo, yhi] = sy.domain;
		let d = '';
		for (let i = start; i <= fi; i += step) {
			const v = Math.max(ylo, Math.min(yhi, smoothed(i)));
			d += `${d ? 'L' : 'M'}${sx(strain[i]).toFixed(1)} ${sy(v).toFixed(1)}`;
		}
		return d;
	});
	const fmtStress = (v: number) => {
		if (v === 0) return '0';
		const a = Math.abs(v);
		const digits = a >= 0.01 ? 2 : a >= 0.001 ? 3 : 4;
		return v.toFixed(digits).replace('-', '−');
	};
	const xFmt = (v: number) => `${(v * 100).toFixed(0)} %`;

	// ---- the gauge -----------------------------------------------------------------------
	const GAUGE = { x: 742, top: 84, bottom: 544, w: 24 };
	/** Decades shown: from G down to G/10⁵. */
	const DECADES = 5;
	const gy = (v: number) =>
		GAUGE.top +
		(Math.min(DECADES, Math.max(0, -Math.log10(Math.max(v, 1e-9)))) / DECADES) *
			(GAUGE.bottom - GAUGE.top);
	const now = $derived(smoothed(fi));
	const peak = $derived.by(() => {
		let m = -Infinity;
		for (let i = 0; i <= fi; i++) m = Math.max(m, smoothed(i));
		return m;
	});
	const TICKS = [
		{ v: 1, label: 'G' },
		{ v: 0.1, label: 'G/10' },
		{ v: 0.01, label: 'G/100' },
		{ v: 0.001, label: 'G/1000' },
		{ v: 1e-4, label: 'G/10⁴' },
		{ v: 1e-5, label: 'G/10⁵' }
	];
	/** The measured band of real pure-metal crystals, 0.5–10 MPa over G = 50,000 MPa. */
	const REAL = { lo: 0.5 / 50000, hi: 10 / 50000 };
	const idealMark = IDEAL_STRENGTH / G;
	const glideMark = GLIDE_STRESS / G;

	const names: Record<Setup, string> = {
		perfect: 'Perfect crystal: no dislocation',
		one: 'Pure crystal with one edge dislocation',
		solutes: 'Alloy: one dislocation among foreign atoms',
		pileup: 'Dislocations driven against a hard particle'
	};
	const title = $derived.by(() => {
		if (setup === 'solutes')
			return `Alloy: ${Math.round((sp.fraction ?? 0) * 100)} % ${sp.size && sp.size > 1 ? 'larger' : 'smaller'} foreign atoms`;
		if (setup === 'pileup')
			return `${sp.count} dislocation${sp.count === 1 ? '' : 's'} against a hard particle`;
		return names[setup];
	});
	const ratioText = (v: number) => {
		if (v <= 0) return '≤ 0';
		const inv = 1 / v;
		if (inv < 100) return `G/${inv.toFixed(inv < 10 ? 1 : 0)}`;
		const r =
			Math.round(inv / 10 ** Math.floor(Math.log10(inv) - 1)) *
			10 ** Math.floor(Math.log10(inv) - 1);
		return `G/${r.toLocaleString('en-US')}`;
	};
	const tick = (x: number, y: number, r: number) => `M${x - r} ${y}h${2 * r}M${x} ${y}v${-r * 1.3}`;
</script>

<g>
	<defs>
		<clipPath id="crystal-clip">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="10" />
		</clipPath>
		<clipPath id="crystal-chart-clip">
			<rect x={CHART.x} y={CHART.y - 4} width={CHART.w} height={CHART.h + 8} />
		</clipPath>
	</defs>

	<!-- heading -->
	<Readout id="heading" order={1} label="Crystal" value={title}>
		<Label x={PANEL.x} y={34} text={title} anchor="start" size={15} weight={600} halo={false} />
	</Readout>
	<Readout id="strain" order={2} label="Shear strain" value="{(strainNow * 100).toFixed(1)} %">
		<Label
			x={PANEL.x + PANEL.w}
			y={34}
			text="shear strain {(strainNow * 100).toFixed(1)} %"
			anchor="end"
			size={13}
			muted
			tabular
			halo={false}
		/>
	</Readout>

	<!-- the crystal -->
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#crystal-clip)">
		<rect
			x={PANEL.x}
			y={gripTopEdge - 4}
			width={PANEL.w}
			height={gripTop - gripTopEdge + 8}
			fill="var(--da-grip-band)"
		/>
		<rect
			x={PANEL.x}
			y={gripBottom - 4}
			width={PANEL.w}
			height={gripBottomEdge - gripBottom + 8}
			fill="var(--da-grip-band)"
		/>
		{#if showSlip}
			<line
				x1={PANEL.x}
				x2={PANEL.x + PANEL.w}
				y1={slipLineY}
				y2={slipLineY}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="5 5"
				opacity="0.7"
			/>
		{/if}
		<path d={bonds.calm} stroke="var(--da-bond)" stroke-width="2" opacity={zoom.current} />
		<path d={atoms.host} fill="var(--da-atom)" />
		{#each atoms.bins as d, b (b)}
			<path {d} fill={binFill(b)} />
		{/each}
		<path d={atoms.grip} fill="var(--da-grip)" />
		<path d={atoms.column} fill="var(--da-column)" />
		<path d={atoms.solute} fill="var(--da-solute)" stroke="var(--stage-ink)" stroke-width="1.5" />
		<path d={atoms.hard} fill="var(--da-hard)" />
		<path
			d={bonds.strained}
			stroke="var(--da-bond-strained)"
			stroke-width="3.5"
			stroke-linecap="round"
			opacity={zoom.current}
		/>
		{#each coreXs as x, k (k)}
			{@const X = px(x)}
			{@const Y = py(c.slipY)}
			<path
				d={tick(X, Y, 9 + 4 * zoom.current)}
				stroke="var(--da-core)"
				stroke-width="3.5"
				stroke-linecap="round"
				fill="none"
			/>
		{/each}
	</g>
	<Readout id="grips">
		<Label
			x={PANEL.x + 12}
			y={gripTopEdge + 1}
			text="grip, pulled right at a steady rate →"
			anchor="start"
			size={12}
			weight={600}
			opacity={1 - zoom.current}
		/>
		<Label
			x={PANEL.x + 12}
			y={gripBottomEdge - 1}
			text="held still"
			anchor="start"
			size={12}
			weight={600}
			opacity={1 - zoom.current}
		/>
		{#if showSlip}
			<Label
				x={PANEL.x + PANEL.w - 10}
				y={slipLineY - 2}
				text="slip plane"
				anchor="end"
				size={11}
				muted
				opacity={1 - zoom.current}
			/>
		{/if}
	</Readout>
	{#if view === 'bonds'}
		<Readout
			id="zoom"
			label="Zoomed in on the core"
			value="bonds across the slip plane; orange: stretched"
		>
			<Label
				x={PANEL.x + 12}
				y={PANEL.y + 20}
				text="zoomed in, following the core ⊥"
				anchor="start"
				size={12}
				weight={600}
				opacity={zoom.current}
			/>
			<Label
				x={PANEL.x + PANEL.w - 12}
				y={PANEL.y + 20}
				text="orange: stretched bonds across the slip plane"
				anchor="end"
				size={12}
				color="var(--da-bond-strained)"
				weight={600}
				opacity={zoom.current}
			/>
		</Readout>
	{/if}

	<!-- legend under the crystal -->
	<g transform="translate({PANEL.x} {PANEL.y + PANEL.h + 22})">
		{#if view === 'strain'}
			<Readout id="legend" label="Colours" value="blue: squeezed; red: stretched">
				<text x="0" y="0" font-size="12" class="muted">squeezed</text>
				{#each Array.from({ length: STRAIN_BINS }, (_, b) => b) as b (b)}
					<rect x={62 + b * 15} y="-10" width="13" height="12" rx="3" fill={binFill(b)} />
				{/each}
				<text x={62 + STRAIN_BINS * 15 + 6} y="0" font-size="12" class="muted">stretched</text>
			</Readout>
		{:else}
			<Readout id="legend" label="Shaded column" value="atoms that started in one vertical line">
				<circle cx="6" cy="-4" r="6" fill="var(--da-column)" />
				<text x="18" y="0" font-size="12" class="muted">atoms that started in one column</text>
			</Readout>
		{/if}
		{#if c.spec.soluteFraction > 0 && c.spec.soluteSize !== 1}
			<Readout id="legend-solute" label="Outlined" value="foreign atoms">
				<circle
					cx="330"
					cy="-4"
					r="6"
					fill="var(--da-solute)"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<text x="342" y="0" font-size="12" class="muted">foreign atom</text>
			</Readout>
		{/if}
		{#if c.spec.obstacle >= 0}
			<Readout id="legend-hard" label="Dark" value="hard particle">
				<circle cx="330" cy="-4" r="6" fill="var(--da-hard)" />
				<text x="342" y="0" font-size="12" class="muted">hard particle</text>
			</Readout>
		{/if}
		{#if coreXs.length}
			<Readout id="legend-core" label="⊥" value="edge dislocation">
				<path
					d={tick(472, -2, 7)}
					stroke="var(--da-core)"
					stroke-width="3"
					stroke-linecap="round"
					fill="none"
				/>
				<text x="486" y="0" font-size="12" class="muted">edge dislocation</text>
			</Readout>
		{/if}
	</g>

	<!-- the curve -->
	<Axes {sx} {sy} xLabel="shear strain" yLabel="stress / G" xFormat={xFmt} yFormat={fmtStress} />
	{#if yDomain[0] < 0}
		<line
			x1={CHART.x}
			x2={CHART.x + CHART.w}
			y1={sy(0)}
			y2={sy(0)}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
	{/if}
	<g clip-path="url(#crystal-chart-clip)">
		{#if setup === 'solutes' || setup === 'pileup'}
			<line
				x1={CHART.x}
				x2={CHART.x + CHART.w}
				y1={sy(glideMark)}
				y2={sy(glideMark)}
				stroke="var(--da-glide)"
				stroke-width="1.5"
				stroke-dasharray="6 4"
			/>
		{/if}
		<path
			d={curvePath}
			fill="none"
			stroke="var(--da-curve)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
	</g>
	<Readout id="chart-notes">
		{#if setup === 'one'}
			<Label
				x={CHART.x + CHART.w - 8}
				y={CHART.y + 12}
				text="the perfect crystal's peak, 0.15, is a hundred times higher than this chart's top"
				anchor="end"
				size={11}
				muted
			/>
		{:else if setup === 'solutes' || setup === 'pileup'}
			<Label
				x={CHART.x + CHART.w - 8}
				y={sy(glideMark) + 14}
				text="pure crystal, one dislocation"
				anchor="end"
				size={11}
				color="var(--da-glide)"
			/>
		{/if}
	</Readout>

	<!-- the gauge -->
	<Readout id="gauge-title">
		<Label x={GAUGE.x + GAUGE.w / 2} y={GAUGE.top - 20} text="stress" size={13} weight={600} />
	</Readout>
	{#if real}
		<rect
			x={GAUGE.x - 6}
			y={gy(REAL.hi)}
			width={GAUGE.w + 12}
			height={gy(REAL.lo) - gy(REAL.hi)}
			rx="4"
			fill="var(--da-real)"
			opacity="0.35"
		/>
	{/if}
	<rect
		x={GAUGE.x}
		y={GAUGE.top}
		width={GAUGE.w}
		height={GAUGE.bottom - GAUGE.top}
		rx="6"
		fill="none"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	<rect
		x={GAUGE.x + 3}
		y={gy(Math.max(now, 1e-5))}
		width={GAUGE.w - 6}
		height={Math.max(0, GAUGE.bottom - 3 - gy(Math.max(now, 1e-5)))}
		rx="3"
		fill="var(--da-curve)"
	/>
	<line
		x1={GAUGE.x - 4}
		x2={GAUGE.x + GAUGE.w + 4}
		y1={gy(Math.max(peak, 1e-5))}
		y2={gy(Math.max(peak, 1e-5))}
		stroke="var(--da-peak)"
		stroke-width="2.5"
	/>
	{#each TICKS as tk (tk.v)}
		<line
			x1={GAUGE.x - 6}
			x2={GAUGE.x}
			y1={gy(tk.v)}
			y2={gy(tk.v)}
			stroke="var(--stage-ink-muted)"
		/>
		<Readout id="tick-{tk.label}">
			<Label
				x={GAUGE.x - 10}
				y={gy(tk.v) + 4}
				text={tk.label}
				anchor="end"
				size={11}
				muted
				tabular
			/>
		</Readout>
	{/each}
	<!-- marks on the right of the gauge -->
	<line
		x1={GAUGE.x + GAUGE.w}
		x2={GAUGE.x + GAUGE.w + 10}
		y1={gy(idealMark)}
		y2={gy(idealMark)}
		stroke="var(--da-ideal)"
		stroke-width="2"
	/>
	<Readout id="mark-ideal" order={5} label="Perfect crystal's peak" value={ratioText(idealMark)}>
		<Label
			x={GAUGE.x + GAUGE.w + 14}
			y={gy(idealMark) + 4}
			text="perfect crystal"
			anchor="start"
			size={12}
			color="var(--da-ideal)"
			weight={600}
		/>
	</Readout>
	<line
		x1={GAUGE.x + GAUGE.w}
		x2={GAUGE.x + GAUGE.w + 10}
		y1={gy(glideMark)}
		y2={gy(glideMark)}
		stroke="var(--da-glide)"
		stroke-width="2"
	/>
	<Readout id="mark-glide" order={6} label="One dislocation glides at" value={ratioText(glideMark)}>
		<Label
			x={GAUGE.x + GAUGE.w + 14}
			y={gy(glideMark) + 4}
			text="one dislocation"
			anchor="start"
			size={12}
			color="var(--da-glide)"
			weight={600}
		/>
	</Readout>
	{#if real}
		<Readout
			id="mark-real"
			order={7}
			label="Real pure-metal crystals"
			value="G/100,000 to G/5,000 (0.5–10 MPa)"
		>
			<Label
				x={GAUGE.x + GAUGE.w + 14}
				y={gy(Math.sqrt(REAL.lo * REAL.hi)) - 4}
				text="real pure metals"
				anchor="start"
				size={12}
				color="var(--da-real-text)"
				weight={600}
			/>
			<Label
				x={GAUGE.x + GAUGE.w + 14}
				y={gy(Math.sqrt(REAL.lo * REAL.hi)) + 11}
				text="(measured)"
				anchor="start"
				size={11}
				color="var(--da-real-text)"
			/>
		</Readout>
	{/if}
	<Readout id="now" order={3} label="Stress now" value={ratioText(now)} color="var(--da-curve)">
		<Label
			x={GAUGE.x + GAUGE.w / 2}
			y={GAUGE.bottom + 22}
			text="now {ratioText(now)}"
			size={12}
			weight={600}
			color="var(--da-curve)"
			tabular
		/>
	</Readout>
	<Readout
		id="peak"
		order={4}
		label="Highest so far"
		value={ratioText(peak)}
		color="var(--da-peak)"
	>
		<Label
			x={GAUGE.x + GAUGE.w / 2}
			y={GAUGE.bottom + 40}
			text="highest {ratioText(peak)}"
			size={12}
			weight={600}
			color="var(--da-peak)"
			tabular
		/>
	</Readout>
</g>
