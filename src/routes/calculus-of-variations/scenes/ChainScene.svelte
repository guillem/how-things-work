<script lang="ts">
	/**
	 * A chain of 40 links hung between two hooks 4 m apart (`../chain.ts`).
	 *
	 * Phases (`step.hints.phase`):
	 *   chain — the chain (length `params.chain`) with the parabola of the same
	 *           length dashed, the pull at the hooks (the Lagrange multiplier) and
	 *           the horizontal pull at the bottom
	 *   arch  — the hanging chain and the same chain upside down, both nudged by
	 *           `params.nudge` with every link's length kept; the chart plots how
	 *           each one's energy changes with the nudge
	 *
	 * Nothing here moves with time: both frames are static, driven by the controls.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, linePath, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { G, RHO, energyOf, hangingChain, nudged, parabolaPoints } from '../chain';
	import type { Pt } from '../brachistochrone';

	let { step, params }: StageProps = $props();

	const SPAN = 4; // m
	const phase = $derived(String(step.hints?.phase ?? 'chain'));
	const length = $derived(clamp(Number(params.chain ?? 6), 4.4, 9));
	const eps = $derived(clamp(Number(params.nudge ?? 0.2), -0.3, 0.3));

	const chain = $derived(hangingChain(SPAN, length, 40));
	// The energies the readouts quote, from a finer chain.
	const fine = $derived(hangingChain(SPAN, length, 400));
	const parabola = $derived(parabolaPoints(SPAN, length, 200));
	const parabolaEnergy = $derived(energyOf(parabolaPoints(SPAN, length, 2000)));
	const sag = $derived(-Math.min(...fine.pts.map((p) => p.y)));

	const arch = $derived(phase === 'arch');
	const archTween = Tween.of(() => (arch ? 1 : 0), { duration: 800, easing: cubicInOut });
	const u = $derived(archTween.current);

	// ---- layout -------------------------------------------------------------------------
	// Chain step: one large chain, hooks at y = 110. Arch step: the chain on the left and the
	// arch on the right, smaller, over the chart.
	const big = { cx: 360, top: 116, k: 100 };
	const left = { cx: 236, top: 92, k: 62 };
	const right = { cx: 716, top: 92 + 3.9 * 62, k: 62 };
	const lerp = (a: number, b: number) => a + (b - a) * u;
	const frameL = $derived({
		cx: lerp(big.cx, left.cx),
		top: lerp(big.top, left.top),
		k: lerp(big.k, left.k)
	});
	const toL = (p: Pt) => ({ x: frameL.cx + frameL.k * p.x, y: frameL.top - frameL.k * p.y });
	const toR = (p: Pt) => ({ x: right.cx + right.k * p.x, y: right.top - right.k * p.y });
	const path = (pts: readonly Pt[], to: (p: Pt) => { x: number; y: number }) =>
		pts
			.map((p, i) => {
				const q = to(p);
				return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
			})
			.join('');

	const hanging = $derived(arch ? nudged(chain, SPAN, eps).pts : chain.pts);
	const archPts = $derived(nudged(chain, SPAN, eps, true).pts);
	const flipped = $derived(chain.pts.map((p) => ({ x: p.x, y: -p.y })));
	const dHang = $derived(nudged(chain, SPAN, eps).energy - chain.energy);
	const dArch = $derived(nudged(chain, SPAN, eps, true).energy + chain.energy);

	// ---- the chart (arch step) ------------------------------------------------------------
	const CH = { left: 120, right: 600, top: 430, bottom: 548 };
	const chart = $derived.by(() => {
		const data = Array.from({ length: 41 }, (_, i) => {
			const e = -0.3 + (0.6 * i) / 40;
			return {
				e,
				hang: nudged(chain, SPAN, e).energy - chain.energy,
				arch: nudged(chain, SPAN, e, true).energy + chain.energy
			};
		});
		const top = Math.max(...data.map((d) => d.hang));
		const ext = niceMax(top * 1.05);
		const csx = scale([-0.3, 0.3], [CH.left, CH.right]);
		const csy = scale([-ext, ext], [CH.bottom, CH.top]);
		return {
			csx,
			csy,
			ext,
			hang: linePath(
				data,
				(d) => d.e,
				(d) => d.hang,
				csx,
				csy
			),
			arch: linePath(
				data,
				(d) => d.e,
				(d) => d.arch,
				csx,
				csy
			)
		};
	});

	// ---- the pulls at the hooks (chain step) -----------------------------------------------
	const ARROW = 70; // px
	const hookPull = $derived.by(() => {
		// The chain pulls each hook along its end link, towards the chain.
		const a = chain.angles[0];
		return { dx: Math.cos(a), dy: -Math.sin(a) };
	});
	const hl = $derived(toL({ x: -SPAN / 2, y: 0 }));
	const hr = $derived(toL({ x: SPAN / 2, y: 0 }));
	const bottom = $derived(toL({ x: 0, y: -sag }));
	const fl = toR({ x: -SPAN / 2, y: 0 });
	const fr = toR({ x: SPAN / 2, y: 0 });
	const PX = 690; // the energy panel

	const fmt = (v: number, d = 1) => v.toFixed(d).replace('-', '−');
	const signed = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
	const weight = $derived(RHO * G * length);
</script>

<g>
	<!-- ===================== the hanging chain (both steps) ===================== -->
	<line
		x1={hl.x - 30}
		y1={hl.y - 8}
		x2={hr.x + 30}
		y2={hl.y - 8}
		stroke="var(--stage-ink-muted)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	{#each [hl, hr] as h, i (i)}
		<line
			x1={h.x}
			y1={h.y - 8}
			x2={h.x}
			y2={h.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
	{/each}

	{#if !arch || u < 1}
		<path
			d={path(parabola, toL)}
			fill="none"
			stroke="var(--cv-arc)"
			stroke-width="2"
			stroke-dasharray="7 5"
			opacity={1 - u}
		/>
	{/if}
	{#if arch}
		<path
			d={path(chain.pts, toL)}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="3 4"
			opacity={u}
		/>
	{/if}
	<path
		d={path(hanging, toL)}
		fill="none"
		stroke="var(--cv-chain)"
		stroke-width="4"
		stroke-linejoin="round"
	/>
	{#each hanging as p, i (i)}
		{@const q = toL(p)}
		<circle
			cx={q.x}
			cy={q.y}
			r={lerp(2.8, 2)}
			fill="var(--stage-bg)"
			stroke="var(--cv-chain)"
			stroke-width="1.4"
		/>
	{/each}
	{#each [hl, hr] as h, i (i)}
		<circle cx={h.x} cy={h.y} r="4.5" fill="var(--stage-ink)" />
	{/each}

	{#if !arch}
		<!-- the pull at the hooks, and the horizontal pull at the bottom -->
		<line
			x1={hl.x}
			y1={hl.y}
			x2={hl.x + ARROW * hookPull.dx}
			y2={hl.y + ARROW * hookPull.dy}
			stroke="var(--cv-cycloid)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1={hr.x}
			y1={hr.y}
			x2={hr.x - ARROW * hookPull.dx}
			y2={hr.y + ARROW * hookPull.dy}
			stroke="var(--cv-cycloid)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<Readout
			id="hook"
			order={3}
			label="Pull at each hook = λ"
			value="{fmt(fine.support)} N"
			color="var(--cv-cycloid)"
		>
			<Label
				x={hl.x - 14}
				y={hl.y + 30}
				text="{fmt(fine.support)} N"
				size={13}
				weight={600}
				anchor="end"
				color="var(--cv-cycloid)"
				tabular
			/>
			<Label x={hl.x - 14} y={hl.y + 46} text="= λ" size={12} anchor="end" muted />
		</Readout>
		<Readout id="horizontal">
			<line
				x1={bottom.x}
				y1={bottom.y + 18}
				x2={bottom.x + 54}
				y2={bottom.y + 18}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
			/>
			<Label
				x={bottom.x + 62}
				y={bottom.y + 22}
				text="{fmt(fine.H)} N everywhere"
				size={12}
				tabular
				anchor="start"
			/>
		</Readout>
		<!-- the sag -->
		<line
			x1={hr.x + 40}
			y1={hr.y}
			x2={hr.x + 40}
			y2={bottom.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			marker-start="url(#arrowhead)"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="sag" order={2} label="Sag" value="{fmt(sag, 2)} m">
			<Label
				x={hr.x + 48}
				y={(hr.y + bottom.y) / 2 + 4}
				text="sag {fmt(sag, 2)} m"
				size={12}
				tabular
				anchor="start"
			/>
		</Readout>
		<Readout id="span" order={1} label="Chain" value="{fmt(length)} m between hooks 4 m apart">
			<Label
				x={(hl.x + hr.x) / 2}
				y={hl.y - 22}
				text="{fmt(length)} m of chain, hooks 4 m apart"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>

		<!-- the energies -->
		<Readout id="energy-title">
			<Label
				x={PX}
				y={150}
				text="Potential energy"
				size={15}
				weight={600}
				halo={false}
				anchor="start"
			/>
			<Label
				x={PX}
				y={168}
				text="relative to the hooks"
				size={11}
				muted
				halo={false}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="e-chain"
			order={5}
			label="Energy, the chain (catenary)"
			value="{fmt(fine.energy, 2)} J"
			color="var(--cv-chain)"
		>
			<line
				x1={PX}
				y1={196}
				x2={PX + 16}
				y2={196}
				stroke="var(--cv-chain)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<Label x={PX + 24} y={200} text="chain" size={13} halo={false} anchor="start" />
			<Label
				x={940}
				y={200}
				text="{fmt(fine.energy, 2)} J"
				size={13}
				weight={600}
				anchor="end"
				tabular
				halo={false}
			/>
		</Readout>
		<Readout
			id="e-parabola"
			order={6}
			label="Energy, the parabola"
			value="{fmt(parabolaEnergy, 2)} J"
			color="var(--cv-arc)"
		>
			<line
				x1={PX}
				y1={226}
				x2={PX + 16}
				y2={226}
				stroke="var(--cv-arc)"
				stroke-width="2"
				stroke-dasharray="5 3"
			/>
			<Label
				x={PX + 24}
				y={230}
				text="parabola, same length"
				size={13}
				halo={false}
				anchor="start"
			/>
			<Label
				x={940}
				y={230}
				text="{fmt(parabolaEnergy, 2)} J"
				size={13}
				weight={600}
				anchor="end"
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="e-diff" order={7}>
			<Label
				x={PX}
				y={258}
				text="the parabola is {fmt(parabolaEnergy - fine.energy, 2)} J higher"
				size={12}
				muted
				halo={false}
				anchor="start"
			/>
		</Readout>
		<Readout id="weight">
			<Label x={PX} y={300} text="weight {fmt(weight)} N:" size={12} halo={false} anchor="start" />
			<Label
				x={PX}
				y={318}
				text="each hook holds half, {fmt(weight / 2)} N up,"
				size={12}
				halo={false}
				anchor="start"
			/>
			<Label
				x={PX}
				y={336}
				text="and {fmt(fine.H)} N sideways"
				size={12}
				halo={false}
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- ===================== the arch (arch step) ===================== -->
	{#if arch}
		<g opacity={u}>
			<line
				x1={fl.x - 30}
				y1={fl.y + 8}
				x2={fr.x + 30}
				y2={fl.y + 8}
				stroke="var(--stage-ink-muted)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d={path(flipped, toR)}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="3 4"
			/>
			<path
				d={path(archPts, toR)}
				fill="none"
				stroke="var(--cv-arch)"
				stroke-width="4"
				stroke-linejoin="round"
			/>
			{#each archPts as p, i (i)}
				{@const q = toR(p)}
				<circle
					cx={q.x}
					cy={q.y}
					r="2"
					fill="var(--stage-bg)"
					stroke="var(--cv-arch)"
					stroke-width="1.4"
				/>
			{/each}
			{#each [fl, fr] as h, i (i)}
				<circle cx={h.x} cy={h.y} r="4.5" fill="var(--stage-ink)" />
			{/each}

			<Readout
				id="hang-d"
				order={1}
				label="Hanging chain, nudged"
				value="{signed(dHang)} J: a minimum"
				color="var(--cv-chain)"
			>
				<Label x={left.cx} y={60} text="hanging chain" size={14} weight={600} anchor="middle" />
				<Label
					x={left.cx}
					y={left.top + 3.9 * left.k + 28}
					text="nudged: {signed(dHang)} J"
					size={13}
					anchor="middle"
					tabular
				/>
				<Label
					x={left.cx}
					y={left.top + 3.9 * left.k + 46}
					text="a minimum"
					size={12}
					anchor="middle"
					muted
				/>
			</Readout>
			<Readout
				id="arch-d"
				order={2}
				label="Arch, nudged"
				value="{signed(dArch)} J: a maximum"
				color="var(--cv-arch)"
			>
				<Label
					x={right.cx}
					y={60}
					text="the same chain upside down"
					size={14}
					weight={600}
					anchor="middle"
				/>
				<Label
					x={right.cx}
					y={right.top + 36}
					text="nudged: {signed(dArch)} J"
					size={13}
					anchor="middle"
					tabular
				/>
				<Label x={right.cx} y={right.top + 54} text="a maximum" size={12} anchor="middle" muted />
			</Readout>

			<!-- the chart -->
			<Axes
				sx={chart.csx}
				sy={chart.csy}
				xLabel="nudge ε"
				yLabel="energy change (J)"
				xTicks={[-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]}
				yTicks={[-chart.ext, 0, chart.ext]}
				xFormat={(v) => String(v).replace('-', '−')}
				yFormat={(v) => String(v).replace('-', '−')}
			/>
			<path d={chart.hang} fill="none" stroke="var(--cv-chain)" stroke-width="2.4" />
			<path d={chart.arch} fill="none" stroke="var(--cv-arch)" stroke-width="2.4" />
			<circle
				cx={chart.csx(eps)}
				cy={chart.csy(dHang)}
				r="5"
				fill="var(--cv-chain)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<circle
				cx={chart.csx(eps)}
				cy={chart.csy(dArch)}
				r="5"
				fill="var(--cv-arch)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<Readout id="chart-key">
				<Label
					x={CH.right + 14}
					y={chart.csy(chart.ext * 0.6)}
					text="chain: up either way"
					size={12}
					color="var(--cv-chain)"
					anchor="start"
				/>
				<Label
					x={CH.right + 14}
					y={chart.csy(-chart.ext * 0.6) + 4}
					text="arch: down either way"
					size={12}
					color="var(--cv-arch)"
					anchor="start"
				/>
				<Label
					x={CH.right + 14}
					y={chart.csy(0) + 4}
					text="flat at ε = 0: stationary"
					size={12}
					muted
					anchor="start"
				/>
			</Readout>
		</g>
	{/if}
</g>
