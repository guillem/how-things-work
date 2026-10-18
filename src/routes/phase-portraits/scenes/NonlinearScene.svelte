<script lang="ts">
	/**
	 * The phase portrait of a nonlinear system with its fixed points (found by
	 * Newton's method), the separatrices of its saddles, and, for the chosen
	 * fixed point, a magnifier comparing the real orbits with those of the
	 * linearisation. For the Hopf normal form and van der Pol, the limit cycle
	 * the orbits settle on, measured by following an orbit until it settles.
	 *
	 * Phases (`step.hints.phase`, system `hints.sys`):
	 *   pendulum  — the damped pendulum; the magnifier when a fixed point is chosen (`hints.at`)
	 *   linearise — the same, with the magnifier's size from the `zoom` control
	 *   predator  — Lotka–Volterra, the magnifier on (0, 0) or (3, 2)
	 *   hopf      — the normal form, μ from `muH`; the eigenvalues on the complex plane
	 *   vanderpol — van der Pol, μ from `muV`; x against time on the settled cycle
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		eigenvector,
		fixedPoints,
		flow,
		linearOverlay,
		orbit,
		overlayStarts,
		period,
		rk4,
		settledAmplitude,
		systems,
		type FixedPoint,
		type SystemId,
		type Vec
	} from '../phase';
	import {
		AT,
		PANEL,
		PLANE,
		SYSTEM_STARTS,
		TEXT,
		eigenText,
		fixed,
		kindColor,
		matText,
		scales,
		type Rect
	} from './frame';
	import EigenPlane from './EigenPlane.svelte';
	import Portrait from './Portrait.svelte';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'pendulum'));
	const sysId = $derived(String(step.hints?.sys ?? 'pendulum') as SystemId);
	const sys = $derived(systems[sysId]);
	const text = $derived(TEXT[sysId]);
	const atId = $derived(step.hints?.at ? String(step.hints.at) : '');
	const atValue = $derived(atId ? String(params[atId] ?? 'none') : 'none');

	const num = (id: string, fallback: number) => {
		const v = Number(params[id]);
		return Number.isFinite(v) ? v : fallback;
	};
	const p = $derived({
		gamma: num('gamma', 0.3),
		mu: sysId === 'hopf' ? num('muH', 0.25) : sysId === 'vanderpol' ? num('muV', 1) : 0
	});
	const field = $derived(sys.field(p));
	const sc = $derived(scales(PLANE, sys.box));
	const fps = $derived(fixedPoints(sys, p));
	const cycles = $derived(sysId === 'hopf' || sysId === 'vanderpol');

	// ---- separatrices: the orbits into and out of each saddle ----------------------------
	const separatrices = $derived.by(() => {
		if (cycles) return [];
		const out: { key: string; d: string }[] = [];
		const back = (x: number, y: number): Vec => {
			const [u, v] = field(x, y);
			return [-u, -v];
		};
		for (const fp of fps) {
			if (fp.kind !== 'saddle') continue;
			for (const k of [0, 1]) {
				const v = eigenvector(fp.jacobian, fp.eigen.re[k]);
				if (!v) continue;
				const f = fp.eigen.re[k] > 0 ? field : back;
				for (const s of [1, -1]) {
					const o = orbit(f, fp.x + s * 1e-4 * v[0], fp.y + s * 1e-4 * v[1], {
						box: sys.box,
						tMax: 30,
						back: false,
						stopSpeed: 0
					});
					let d = `M${sc.sx(fp.x).toFixed(1)} ${sc.sy(fp.y).toFixed(1)}`;
					for (let i = 0; i < o.x.length; i++)
						d += `L${sc.sx(o.x[i]).toFixed(1)} ${sc.sy(o.y[i]).toFixed(1)}`;
					out.push({ key: `${fp.x}:${fp.y}:${k}:${s}`, d });
				}
			}
		}
		return out;
	});

	// ---- the chosen fixed point and the magnifier ---------------------------------------------
	const chosen = $derived.by((): FixedPoint | null => {
		const target = AT[atValue];
		if (!target) return null;
		return (
			fps.find((f) => Math.hypot(f.x - target[0], f.y - target[1]) < 1e-6) ??
			fps.reduce<FixedPoint | null>(
				(best, f) =>
					!best ||
					Math.hypot(f.x - target[0], f.y - target[1]) <
						Math.hypot(best.x - target[0], best.y - target[1])
						? f
						: best,
				null
			)
		);
	});
	const selectable = $derived(
		atId
			? Object.entries(AT)
					.filter(([id]) =>
						sysId === 'pendulum'
							? id === 'bottom' || id === 'top'
							: id === 'origin' || id === 'coexist'
					)
					.map(([id, v]) => ({ id, x: v[0], y: v[1] }))
			: []
	);
	const R = $derived(phase === 'linearise' ? num('zoom', 1) : 0.8);
	const corner = $derived(sysId === 'predator' && chosen !== null && chosen.x === 0);
	const overlay = $derived.by(() => {
		if (!chosen) return null;
		const lam = Math.max(
			...[0, 1].map((k) => Math.hypot(chosen.eigen.re[k], chosen.eigen.im[k])),
			1e-6
		);
		return linearOverlay(
			field,
			chosen,
			overlayStarts(R, corner),
			R,
			Math.min(10, (2 * Math.PI) / lam)
		);
	});
	const INSET = { cx: 772, cy: 388, r: 132 };
	/** Magnifier coordinates of an offset from the chosen fixed point (the corner case shows a quadrant). */
	const ix = (u: number) =>
		INSET.cx + (corner ? -INSET.r * 0.85 : 0) + (u / R) * INSET.r * (corner ? 1.7 : 1);
	const iy = (v: number) =>
		INSET.cy + (corner ? INSET.r * 0.85 : 0) - (v / R) * INSET.r * (corner ? 1.7 : 1);
	const ipath = (pts: Vec[]) =>
		pts.map(([u, v], i) => `${i ? 'L' : 'M'}${ix(u).toFixed(1)} ${iy(v).toFixed(1)}`).join('');
	const insetPaths = $derived(
		overlay
			? overlay.real.map((r, i) => ({ key: i, real: ipath(r), lin: ipath(overlay.lin[i]) }))
			: []
	);
	const ringRx = $derived(R * ((PLANE.right - PLANE.left) / (sys.box.x[1] - sys.box.x[0])));
	const ringRy = $derived(R * ((PLANE.bottom - PLANE.top) / (sys.box.y[1] - sys.box.y[0])));

	const pointName = (f: { x: number; y: number }) => {
		const nx =
			sysId === 'pendulum' && Math.abs(f.x) > 1e-9
				? `${f.x < 0 ? '−' : ''}${Math.abs(Math.round(f.x / Math.PI)) === 1 ? '' : Math.abs(Math.round(f.x / Math.PI))}π`
				: fixed(f.x, Number.isInteger(Math.round(f.x * 1e6) / 1e6) ? 0 : 2);
		return `(${nx}, ${fixed(f.y, Number.isInteger(Math.round(f.y * 1e6) / 1e6) ? 0 : 2)})`;
	};

	// ---- limit cycles -------------------------------------------------------------------------------
	const cycle = $derived.by(() => {
		if (!cycles || !(p.mu > 0)) return null;
		if (sysId === 'hopf') {
			const settle = Math.min(3000, 30 / p.mu);
			const r = settledAmplitude(field, [1, 0], settle, 7);
			return { amp: r, period: 2 * Math.PI, pts: [] as Vec[] };
		}
		// van der Pol: settle, then record one period
		const h = 0.005;
		const settle = Math.min(400, 40 / p.mu);
		const T = period(field, [0.1, 0], settle, 2, h);
		let s = flow(field, 0.1, 0, settle, Math.ceil(settle / h));
		const pts: Vec[] = [];
		let amp = 0;
		const n = Math.ceil((2.2 * T) / h);
		for (let i = 0; i <= n; i++) {
			if (i % 4 === 0) pts.push(s);
			amp = Math.max(amp, Math.abs(s[0]));
			s = rk4(field, s[0], s[1], h);
		}
		return { amp, period: T, pts };
	});
	const cyclePath = $derived.by(() => {
		if (!cycle) return '';
		if (sysId === 'hopf') return '';
		const n = Math.ceil(cycle.period / (0.005 * 4)) + 1;
		return cycle.pts
			.slice(0, n)
			.map(([x, y], i) => `${i ? 'L' : 'M'}${sc.sx(x).toFixed(1)} ${sc.sy(y).toFixed(1)}`)
			.join('');
	});

	// x against time on the van der Pol cycle
	const TS: Rect = { left: 652, right: 930, top: 300, bottom: 470 };
	const tsX = $derived(scale([0, 30], [TS.left, TS.right]));
	const tsY = scale([-2.5, 2.5], [TS.bottom, TS.top]);
	/** x against time over 30 time units, from a point on the settled cycle. */
	const tsSeries = $derived.by(() => {
		if (!cycle || sysId !== 'vanderpol') return '';
		const step = 0.005;
		let s = cycle.pts[0];
		let d = '';
		for (let i = 0; i <= 30 / step; i++) {
			if (i % 4 === 0)
				d += `${i ? 'L' : 'M'}${tsX(i * step).toFixed(1)} ${tsY(Math.max(-2.5, Math.min(2.5, s[0]))).toFixed(1)}`;
			s = rk4(field, s[0], s[1], step);
		}
		return d;
	});

	const origin = $derived(fps.find((f) => Math.hypot(f.x, f.y) < 1e-9) ?? null);

	// ---- portrait settings per system ---------------------------------------------------------------
	const tMax = $derived(
		sysId === 'pendulum' ? 16 : sysId === 'predator' ? 14 : sysId === 'vanderpol' ? 30 : 40
	);
	const h = $derived(sysId === 'vanderpol' ? 0.005 : 0.01);

	const choose = (id: string) => {
		if (atId && atValue !== id) setParam(atId, id);
	};
	/** A non-hyperbolic kind is only what the linearisation says. */
	const kindSays = (f: FixedPoint) => (f.hyperbolic ? f.kind : `linearisation says ${f.kind}`);
	const fpLabel = (f: FixedPoint) => `${pointName(f)}: ${kindSays(f)}`;
	const verdict = $derived(
		chosen
			? chosen.hyperbolic
				? 'hyperbolic: the linearisation decides'
				: 'eigenvalues on the imaginary axis: linearisation can’t decide'
			: ''
	);
	const hopfCycleText = $derived(
		p.mu > 0 && cycle
			? `orbits settle at r = ${cycle.amp.toFixed(3)}; √μ = ${Math.sqrt(p.mu).toFixed(3)}`
			: p.mu === 0
				? 'no cycle: orbits spiral in, slowly (r′ = −r³)'
				: 'no cycle: orbits spiral into the origin'
	);
	const vdpCycleText = $derived(
		cycle
			? `limit cycle: amplitude ${cycle.amp.toFixed(2)}, period ${cycle.period.toFixed(2)}`
			: 'μ = 0: a centre, closed orbits, no limit cycle'
	);
</script>

<g>
	<!-- ================================================================ the phase plane -->
	<Axes
		sx={sc.sx}
		sy={sc.sy}
		xLabel={text.xLabel}
		yLabel={text.yLabel}
		xTicks={sysId === 'pendulum' ? [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI] : undefined}
		xFormat={sysId === 'pendulum'
			? (v: number) =>
					v === 0
						? '0'
						: `${v < 0 ? '−' : ''}${Math.abs(Math.round(v / Math.PI)) === 1 ? '' : '2'}π`
			: (v: number) => fixed(v, 0)}
		yFormat={(v: number) => fixed(v, 0)}
		grid={false}
	/>
	<Portrait
		rect={PLANE}
		box={sys.box}
		{field}
		starts={SYSTEM_STARTS[sysId]}
		{t}
		id="pp-nl"
		back={!cycles}
		{tMax}
		{h}
		rate={sysId === 'vanderpol' ? 2.4 : sysId === 'hopf' ? 2 : 1.6}
		loop={cycles ? 36 : 14}
	/>
	<g clip-path="url(#pp-nl-clip)" pointer-events="none">
		{#each separatrices as s (s.key)}
			<path d={s.d} fill="none" stroke="var(--pp-sep)" stroke-width="2.4" stroke-linejoin="round" />
		{/each}
		{#if cycle && sysId === 'hopf'}
			<circle
				cx={sc.sx(0)}
				cy={sc.sy(0)}
				r={cycle.amp * ((PLANE.right - PLANE.left) / (sys.box.x[1] - sys.box.x[0]))}
				fill="none"
				stroke="var(--pp-cycle)"
				stroke-width="3.5"
				opacity="0.85"
			/>
		{/if}
		{#if cyclePath}
			<path d={cyclePath} fill="none" stroke="var(--pp-cycle)" stroke-width="3.5" opacity="0.85" />
		{/if}
		{#if chosen}
			<ellipse
				cx={sc.sx(chosen.x)}
				cy={sc.sy(chosen.y)}
				rx={ringRx}
				ry={ringRy}
				fill="none"
				stroke="var(--pp-lin)"
				stroke-width="1.8"
				stroke-dasharray="5 4"
			/>
		{/if}
	</g>

	<!-- fixed points -->
	{#each fps as f (`${f.x}:${f.y}`)}
		{@const c = kindColor(f.kind)}
		{@const pick = selectable.find((s) => Math.hypot(s.x - f.x, s.y - f.y) < 1e-6)}
		{#if pick}
			<g
				class="pp-fp"
				role="button"
				tabindex="0"
				aria-label="Linearise at {pointName(f)}, {f.kind}"
				onclick={() => choose(pick.id)}
				onpointerenter={() => choose(pick.id)}
				onfocus={() => choose(pick.id)}
				onkeydown={(e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						choose(pick.id);
					}
				}}
			>
				<circle cx={sc.sx(f.x)} cy={sc.sy(f.y)} r="16" fill="transparent" />
				<circle
					cx={sc.sx(f.x)}
					cy={sc.sy(f.y)}
					r={chosen === f ? 8.5 : 7}
					fill={f.kind.startsWith('stable') ? c : 'var(--stage-bg)'}
					stroke={c}
					stroke-width="2.6"
				/>
			</g>
		{:else}
			<circle
				cx={sc.sx(f.x)}
				cy={sc.sy(f.y)}
				r="6"
				fill={f.kind.startsWith('stable') ? c : 'var(--stage-bg)'}
				stroke={c}
				stroke-width="2.2"
			/>
		{/if}
	{/each}

	<!-- ================================================================ the panel -->
	<Readout id="system" order={1} label={text.title} value={text.lines.filter(Boolean).join(', ')}>
		<Label x={PANEL} y={58} text={text.title} anchor="start" size={15} weight={600} />
		<Label x={PANEL} y={84} text={text.lines[0]} anchor="start" size={14} tabular />
		{#if text.lines[1]}
			<Label x={PANEL} y={104} text={text.lines[1]} anchor="start" size={14} tabular />
		{/if}
	</Readout>

	{#if !cycles}
		<Readout id="found">
			<Label
				x={PANEL}
				y={130}
				text="{fps.length} fixed points, found by Newton's method"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
		{#if chosen}
			<Readout
				id="chosen"
				order={3}
				label="Linearised at"
				value="{fpLabel(chosen)}; λ = {eigenText(chosen.eigen)}"
				color={kindColor(chosen.kind)}
			>
				<Label
					x={PANEL}
					y={156}
					text={fpLabel(chosen)}
					anchor="start"
					size={14}
					weight={700}
					color={kindColor(chosen.kind)}
				/>
				<Label
					x={PANEL}
					y={176}
					text="J = {matText(chosen.jacobian)}"
					anchor="start"
					size={12}
					tabular
				/>
				<Label
					x={PANEL}
					y={194}
					text="λ = {eigenText(chosen.eigen)}"
					anchor="start"
					size={12}
					tabular
				/>
			</Readout>
			<Readout id="verdict" order={4} label="Hartman–Grobman" value={verdict}>
				<Label x={PANEL} y={214} text={verdict} anchor="start" size={12} muted />
			</Readout>
		{:else}
			<Readout id="hint">
				<Label
					x={PANEL}
					y={160}
					text="point at a fixed point to linearise there"
					anchor="start"
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{:else if origin}
		<Readout
			id="origin"
			order={2}
			label="Origin"
			value="{kindSays(origin)}; λ = {eigenText(origin.eigen)}"
			color={kindColor(origin.kind)}
		>
			<Label
				x={PANEL}
				y={136}
				text="origin: {kindSays(origin)}"
				anchor="start"
				size={14}
				weight={700}
				color={kindColor(origin.kind)}
			/>
			<Label
				x={PANEL}
				y={156}
				text="λ = {eigenText(origin.eigen)}"
				anchor="start"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="cycle"
			order={3}
			label="Limit cycle"
			value={sysId === 'hopf' ? hopfCycleText : vdpCycleText}
			color="var(--pp-cycle)"
		>
			<Label
				x={PANEL}
				y={sysId === 'hopf' ? 214 : 184}
				text={sysId === 'hopf' ? hopfCycleText : vdpCycleText}
				anchor="start"
				size={13}
				weight={600}
				color="var(--pp-cycle)"
				tabular
			/>
		</Readout>
	{/if}

	<!-- the magnifier -->
	{#if chosen && overlay}
		<defs>
			<clipPath id="pp-inset-clip">
				{#if corner}
					<rect
						x={INSET.cx - INSET.r}
						y={INSET.cy - INSET.r}
						width={INSET.r * 2}
						height={INSET.r * 2}
					/>
				{:else}
					<circle cx={INSET.cx} cy={INSET.cy} r={INSET.r} />
				{/if}
			</clipPath>
		</defs>
		{#if corner}
			<rect
				x={INSET.cx - INSET.r}
				y={INSET.cy - INSET.r}
				width={INSET.r * 2}
				height={INSET.r * 2}
				fill="var(--surface)"
				stroke="var(--pp-lin)"
				stroke-width="1.8"
				stroke-dasharray="5 4"
			/>
		{:else}
			<circle
				cx={INSET.cx}
				cy={INSET.cy}
				r={INSET.r}
				fill="var(--surface)"
				stroke="var(--pp-lin)"
				stroke-width="1.8"
				stroke-dasharray="5 4"
			/>
		{/if}
		<g clip-path="url(#pp-inset-clip)" pointer-events="none">
			{#each insetPaths as ip (ip.key)}
				<path d={ip.real} fill="none" stroke="var(--pp-orbit)" stroke-width="2.4" />
				<path
					d={ip.lin}
					fill="none"
					stroke="var(--pp-lin)"
					stroke-width="2"
					stroke-dasharray="6 5"
				/>
			{/each}
			<circle
				cx={ix(0)}
				cy={iy(0)}
				r="6"
				fill={chosen.kind.startsWith('stable') ? kindColor(chosen.kind) : 'var(--surface)'}
				stroke={kindColor(chosen.kind)}
				stroke-width="2.4"
			/>
		</g>
		<Readout
			id="gap"
			order={5}
			label="In the circle"
			value="radius {R.toFixed(2)}: largest gap {(overlay.gap * 100).toFixed(1)} % of it"
		>
			<Label
				x={INSET.cx}
				y={INSET.cy + INSET.r + 22}
				text="solid: real orbits · dashed: linearisation"
				size={12}
				muted
			/>
			<Label
				x={INSET.cx}
				y={INSET.cy + INSET.r + 42}
				text="largest gap: {(overlay.gap * 100).toFixed(1)} % of the radius {R.toFixed(2)}"
				size={13}
				weight={600}
				tabular
			/>
		</Readout>
	{/if}

	<!-- the eigenvalues of the Hopf normal form -->
	{#if sysId === 'hopf' && origin}
		<EigenPlane
			rect={{ left: 652, right: 930, top: 252, bottom: 412 }}
			re={[-1.2, 1.2]}
			im={[-1.45, 1.45]}
			eigen={origin.eigen}
			color={kindColor(origin.kind)}
		/>
	{/if}

	<!-- x against time on van der Pol's cycle -->
	{#if sysId === 'vanderpol' && tsSeries}
		<Axes
			sx={tsX}
			sy={tsY}
			xLabel="t"
			yLabel="x"
			xTicks={[0, 10, 20, 30]}
			yTicks={[-2, 0, 2]}
			yFormat={(v: number) => fixed(v, 0)}
			grid={false}
		/>
		<path d={tsSeries} fill="none" stroke="var(--pp-cycle)" stroke-width="2.2" />
	{/if}
</g>

<style>
	.pp-fp {
		cursor: pointer;
		outline: none;
	}
	.pp-fp:focus-visible circle:last-child {
		stroke-width: 4;
	}
</style>
