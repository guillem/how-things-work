<script lang="ts">
	/**
	 * Getting power from a power station to a city (`line` in grid.ts). Top: the generator, a
	 * step-up transformer, three wires on towers, a step-down transformer and the city. Dots on
	 * the wires swing back and forth with the alternating current (the swing grows with the
	 * current); the wires glow with the heat lost in them.
	 *
	 * Modes (`step.hints.mode`):
	 *   transformer — the step-up transformer in focus, the voltage and current on each side,
	 *                 and the three phases a third of a cycle apart
	 *   losses      — the line in focus: current, heat lost and power delivered, and the loss
	 *                 against the voltage (one over the voltage squared) with the five choices
	 *   chain       — the whole chain of voltages down to a home's socket
	 */
	import { Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { AMPACITY, line } from '../grid';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	type Mode = 'transformer' | 'losses' | 'chain';
	const mode = $derived(String(step.hints?.mode ?? 'transformer') as Mode);
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const kv = $derived(Number(params.kv ?? 400));
	const mw = $derived(offered.has('mw') ? Number(params.mw ?? 1000) : 1000);
	const km = $derived(offered.has('km') ? Number(params.km ?? 200) : 200);
	const lineKv = $derived(mode === 'chain' ? 400 : kv);
	const L = $derived(line(mw, lineKv, km));
	const genA = $derived(line(mw, 20, km).current);
	const tt = $derived(reduced ? 2.5 : t);

	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
	const pct = (v: number) => (v < 0.1 ? fmt(v * 100, 1) : fmt(v * 100, 0)) + '%';

	// ---- geometry of the link
	const GY = 170;
	const GEN = { x: 92, y: GY };
	const UP = { x: 228, y: GY };
	const DOWN = { x: 732, y: GY };
	const CITY = { x: 860, y: GY };
	const TOWERS = [300, 420, 540, 660];
	const WIRE_Y = [GY - 46, GY - 30, GY - 14];
	const sag = 22;
	const wirePath = (y: number) => {
		let d = `M${UP.x + 30} ${y + 24}`;
		for (let i = 0; i < TOWERS.length; i++) {
			const x0 = i === 0 ? UP.x + 30 : TOWERS[i - 1];
			const x1 = TOWERS[i];
			d += ` Q${(x0 + x1) / 2} ${y + sag} ${x1} ${y}`;
		}
		d += ` Q${(TOWERS.at(-1)! + DOWN.x - 30) / 2} ${y + sag} ${DOWN.x - 30} ${y + 24}`;
		return d;
	};
	const wireAt = (y: number, x: number) => {
		// height of the sagging wire at x, for the dots
		const pts = [UP.x + 30, ...TOWERS, DOWN.x - 30];
		for (let i = 0; i < pts.length - 1; i++) {
			if (x >= pts[i] && x <= pts[i + 1]) {
				const u = (x - pts[i]) / (pts[i + 1] - pts[i]);
				const ya = i === 0 ? y + 24 : y;
				const yb = i === pts.length - 2 ? y + 24 : y;
				return (1 - u) * (1 - u) * ya + 2 * u * (1 - u) * (y + sag) + u * u * yb;
			}
		}
		return y;
	};

	// ---- focus per mode
	const focus = $derived({
		gen: mode === 'losses' ? 0.45 : 1,
		up: mode === 'losses' ? 0.6 : 1,
		wires: mode === 'transformer' ? 0.55 : 1,
		down: mode === 'transformer' ? 0.45 : 1
	});

	// ---- the current: dots swinging along each wire, amplitude ∝ current
	const swing = $derived(Math.min(60, 14 * Math.sqrt(L.current / 1443)));
	const PHASE_COLORS = ['var(--pg-nuclear)', 'var(--pg-gas)', 'var(--pg-hydro)'];
	const dots = $derived(
		WIRE_Y.flatMap((y, p) =>
			Array.from({ length: 9 }, (_, k) => {
				const x0 = UP.x + 70 + k * 50;
				const x = x0 + swing * Math.sin(2 * Math.PI * (tt * 0.6 - p / 3));
				return { id: `${p}-${k}`, x, y: wireAt(y, x), color: PHASE_COLORS[p] };
			})
		)
	);
	// heat glow: loss per km relative to a 400 kV line carrying 1,000 MW
	const heat = $derived(Math.min(1, L.loss / km / ((5 * 23.5) / 200)));

	// ---- transformer coils
	const ratio = $derived(lineKv / 20);
	const loops = (n: number) => Math.max(3, Math.min(22, Math.round(n)));
	const primaryLoops = 4;
	const secondaryLoops = $derived(loops(4 * Math.sqrt(ratio) * 1.15));
	const coil = (x: number, y0: number, h: number, n: number) => {
		let d = '';
		for (let i = 0; i < n; i++) {
			const y = y0 + (i + 0.5) * (h / n);
			d += `M${x - 9} ${y.toFixed(1)} h18 `;
		}
		return d;
	};

	// ---- three phases (transformer mode)
	const WX0 = 140;
	const WX1 = 520;
	const WY = 470;
	const WA = 54;
	const phases = $derived(
		[0, 1, 2].map((p) => {
			const pts = Array.from({ length: 121 }, (_, i) => {
				const u = i / 120;
				return {
					x: WX0 + u * (WX1 - WX0),
					y: WY - WA * Math.sin(2 * Math.PI * (2 * u - tt * 0.3 - p / 3))
				};
			});
			return {
				p,
				d: pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ')
			};
		})
	);

	// ---- loss against voltage (losses mode)
	const VOLTS = [20, 66, 132, 220, 400];
	const PX0 = 560;
	const PX1 = 920;
	const PY0 = 360;
	const PY1 = 540;
	const px = scale([0, 420], [PX0, PX1]);
	const py = scale([0, 50], [PY1, PY0]);
	const curve = $derived(
		Array.from({ length: 160 }, (_, i) => 20 + (i / 159) * 400).map((v) => ({
			v,
			s: Math.min(50, line(mw, v, km).share * 100)
		}))
	);
	const shareOf = (v: number) => line(mw, v, km).share;

	// ---- the chain (chain mode)
	const CHAIN = [
		{ kv: 20, label: '20 kV', where: 'generator' },
		{ kv: 400, label: '400 kV', where: 'transmission' },
		{ kv: 132, label: '132 kV', where: 'region' },
		{ kv: 20, label: '20 kV', where: 'town' },
		{ kv: 0.4, label: '400 / 230 V', where: 'your street' }
	];
	const chainX = (i: number) => 120 + i * 180;
	const chainH = (v: number) => 20 + 140 * Math.sqrt(v / 400);
	const pulse = $derived(reduced ? 0.5 : (tt * 0.25) % 1);
</script>

<g>
	<!-- ===== the generator -->
	<g opacity={focus.gen}>
		<circle
			cx={GEN.x}
			cy={GEN.y}
			r="40"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<g transform="translate({GEN.x} {GEN.y}) rotate({(tt * 120) % 360})">
			<rect x="-28" y="-9" width="56" height="18" rx="6" fill="var(--pg-rotor)" />
		</g>
		<Readout id="gen" order={1} label="Generator" value="20 kV · {fmt(genA)} A">
			<Label x={GEN.x} y={GEN.y + 62} text="generator" weight={600} />
			<Label x={GEN.x} y={GEN.y + 80} text="20 kV · {fmt(genA)} A" muted />
		</Readout>
		<line
			x1={GEN.x + 40}
			x2={UP.x - 26}
			y1={GEN.y}
			y2={GEN.y}
			stroke="var(--pg-wire)"
			stroke-width="5"
		/>
	</g>

	<!-- ===== step-up transformer -->
	<g opacity={focus.up}>
		<rect
			x={UP.x - 30}
			y={GY - 50}
			width="60"
			height="100"
			rx="6"
			fill="none"
			stroke="var(--pg-coal)"
			stroke-width="7"
		/>
		<path d={coil(UP.x - 30, GY - 40, 80, primaryLoops)} stroke="var(--pg-gas)" stroke-width="3" />
		<path
			d={coil(UP.x + 30, GY - 40, 80, secondaryLoops)}
			stroke="var(--pg-hydro)"
			stroke-width="2"
		/>
		<Readout
			id="up"
			order={2}
			label="Step-up transformer"
			value={mode === 'chain'
				? '20 → 400 kV'
				: `20 → ${lineKv} kV, 1 : ${fmt(ratio, ratio < 10 ? 1 : 0)}`}
		>
			<Label x={UP.x} y={GY + 74} text="transformer" weight={600} />
			<Label x={UP.x} y={GY + 92} text="turns 1 : {fmt(ratio, ratio < 10 ? 1 : 0)}" muted />
		</Readout>
	</g>

	<!-- ===== the line -->
	<g opacity={focus.wires}>
		{#each TOWERS as x (x)}
			<path
				d="M{x - 18} {GY + 90} L{x} {GY - 58} L{x + 18} {GY + 90} M{x - 26} {GY - 46} H{x +
					26} M{x - 22} {GY - 30} H{x + 22} M{x - 18} {GY - 14} H{x + 18} M{x - 12} {GY + 40} H{x +
					12}"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
		{/each}
		{#each WIRE_Y as y, p (p)}
			<path
				d={wirePath(y)}
				fill="none"
				stroke="var(--pg-hot)"
				stroke-width={4 + 6 * heat}
				opacity={0.6 * heat}
			/>
			<path d={wirePath(y)} fill="none" stroke="var(--pg-wire)" stroke-width="1.6" />
		{/each}
		{#each dots as d (d.id)}
			<circle cx={d.x} cy={d.y} r="3.2" fill={d.color} />
		{/each}
		{#if mode !== 'chain'}
			<Readout id="line" order={3} label="In each wire" value="{lineKv} kV · {fmt(L.current)} A">
				<Label
					x={480}
					y={GY + 112}
					text="{lineKv} kV line, {km} km · {fmt(L.current)} A in each wire"
					weight={600}
				/>
			</Readout>
		{/if}
	</g>

	<!-- ===== step-down transformer and the city -->
	<g opacity={focus.down}>
		<rect
			x={DOWN.x - 30}
			y={GY - 50}
			width="60"
			height="100"
			rx="6"
			fill="none"
			stroke="var(--pg-coal)"
			stroke-width="7"
		/>
		<path
			d={coil(DOWN.x - 30, GY - 40, 80, secondaryLoops)}
			stroke="var(--pg-hydro)"
			stroke-width="2"
		/>
		<path
			d={coil(DOWN.x + 30, GY - 40, 80, primaryLoops)}
			stroke="var(--pg-gas)"
			stroke-width="3"
		/>
		<line
			x1={DOWN.x + 30}
			x2={CITY.x - 40}
			y1={GY}
			y2={GY}
			stroke="var(--pg-wire)"
			stroke-width="5"
		/>
		{#each [[-36, 50], [-14, 80], [8, 62], [30, 44]] as [dx, h], i (i)}
			<rect
				x={CITY.x + dx}
				y={GY + 50 - h}
				width="20"
				height={h}
				fill="var(--protein)"
				stroke="var(--protein-edge)"
			/>
		{/each}
		<Readout id="city">
			<Label x={CITY.x} y={GY + 74} text="city" weight={600} />
		</Readout>
	</g>

	{#if mode === 'transformer'}
		<!-- ===== power in = power out, and three phases -->
		<Readout id="power" order={4} label="Power" value="{fmt(mw)} MW on both sides">
			<Txt
				x={480}
				y={42}
				text="{fmt(mw)} MW in = {fmt(mw)} MW out: voltage up {fmt(
					ratio,
					ratio < 10 ? 1 : 0
				)}×, current down {fmt(ratio, ratio < 10 ? 1 : 0)}×"
				size={14}
				weight={600}
			/>
		</Readout>
		<line x1={WX0} x2={WX1} y1={WY} y2={WY} stroke="var(--stage-line)" />
		{#each phases as ph (ph.p)}
			<path d={ph.d} fill="none" stroke={PHASE_COLORS[ph.p]} stroke-width="2.5" />
		{/each}
		<Readout id="phases" order={5} label="Three phases" value="a third of a cycle apart">
			<Txt
				x={WX0}
				y={WY - WA - 26}
				text="three phases, a third of a cycle apart"
				anchor="start"
				size={13}
				weight={600}
			/>
			{#each ['L1', 'L2', 'L3'] as n, i (n)}
				<Label
					x={WX1 + 18}
					y={WY - 22 + i * 22}
					text={n}
					anchor="start"
					color={PHASE_COLORS[i]}
					weight={700}
				/>
			{/each}
		</Readout>
		<Readout id="ac-note">
			<Label
				x={640}
				y={WY - 30}
				text="a transformer needs a changing current:"
				anchor="start"
				muted
			/>
			<Label
				x={640}
				y={WY - 10}
				text="that is why grids use alternating current"
				anchor="start"
				muted
			/>
			<Label
				x={640}
				y={WY + 22}
				text="the three currents add up to zero at every moment,"
				anchor="start"
				muted
			/>
			<Label x={640} y={WY + 42} text="so no return wire is needed" anchor="start" muted />
		</Readout>
	{:else if mode === 'losses'}
		<!-- ===== the numbers, and loss against voltage -->
		<Readout
			id="lost"
			order={4}
			label="Lost as heat"
			value={L.impossible ? 'more than half: impossible' : `${fmt(L.loss)} MW (${pct(L.share)})`}
			color="var(--pg-hot)"
		>
			<Txt x={60} y={380} text="sent: {fmt(mw)} MW" anchor="start" size={14} weight={600} />
			{#if L.impossible}
				<Txt
					x={60}
					y={410}
					text="lost as heat: more than half"
					anchor="start"
					size={14}
					weight={600}
					color="var(--pg-hot)"
				/>
				<Label
					x={60}
					y={438}
					text="the line cannot deliver it: the current would"
					anchor="start"
					muted
				/>
				<Label x={60} y={458} text="melt the wires long before" anchor="start" muted />
			{:else}
				<Txt
					x={60}
					y={410}
					text="lost as heat: {fmt(L.loss)} MW ({pct(L.share)})"
					anchor="start"
					size={14}
					weight={600}
					color="var(--pg-hot)"
				/>
				<Txt
					x={60}
					y={440}
					text="delivered: {fmt(mw - L.loss)} MW"
					anchor="start"
					size={14}
					weight={600}
				/>
			{/if}
		</Readout>
		{#if L.overheated && !L.impossible}
			<Readout
				id="hot"
				order={5}
				label="Warning"
				value="over {fmt(AMPACITY)} A: the wires overheat"
			>
				<Label
					x={60}
					y={474}
					text="over {fmt(AMPACITY)} A: these wires would overheat"
					anchor="start"
					color="var(--pg-hot)"
				/>
			</Readout>
		{/if}
		<Readout id="i2r">
			<Label
				x={60}
				y={520}
				text="loss = 3 × current² × resistance of each wire"
				anchor="start"
				muted
			/>
			<Label x={60} y={540} text="= power² × resistance ÷ voltage²" anchor="start" muted />
		</Readout>
		<line x1={PX0} x2={PX1} y1={PY1} y2={PY1} stroke="var(--stage-line)" />
		<line x1={PX0} x2={PX0} y1={PY0} y2={PY1} stroke="var(--stage-line)" />
		{#each [0, 25, 50] as v (v)}
			<text x={PX0 - 6} y={py(v) + 4} text-anchor="end" font-size="11" class="muted">{v}%</text>
		{/each}
		<Txt
			x={PX0}
			y={PY0 - 14}
			text="lost on this line, at each voltage"
			anchor="start"
			size={13}
			weight={600}
		/>
		<path
			d={linePath(
				curve,
				(c) => c.v,
				(c) => c.s,
				px,
				py
			)}
			fill="none"
			stroke="var(--pg-hot)"
			stroke-width="2"
		/>
		{#each VOLTS as v (v)}
			{@const s = Math.min(50, shareOf(v) * 100)}
			<circle
				cx={px(v)}
				cy={py(s)}
				r={v === kv ? 7 : 4}
				fill={v === kv ? 'var(--pg-hot)' : 'var(--surface)'}
				stroke="var(--pg-hot)"
				stroke-width="2"
			/>
			<text x={px(v)} y={PY1 + 18} text-anchor="middle" font-size="11" class="muted">{v}</text>
		{/each}
		<Label x={PX1} y={PY1 + 36} text="kV" anchor="end" muted />
		{#if shareOf(66) > 0.5}
			<Label x={px(30)} y={py(50) + 18} text="over half: impossible" anchor="start" muted />
		{/if}
		<Readout id="curve-note">
			<Label
				x={px(400)}
				y={py(Math.min(50, shareOf(400) * 100)) - 14}
				text={pct(shareOf(400))}
				anchor="end"
			/>
		</Readout>
	{:else}
		<!-- ===== the chain of voltages -->
		<Txt x={480} y={42} text="from the power station to your socket" size={14} weight={600} />
		<Readout id="balance-note">
			<Label
				x={480}
				y={64}
				text="and at every moment, the power generated equals the power used"
				muted
			/>
		</Readout>
		{#each CHAIN as c, i (i)}
			{@const x = chainX(i)}
			{@const h = chainH(c.kv)}
			<rect
				x={x - 26}
				y={560 - h}
				width="52"
				height={h}
				rx="4"
				fill="var(--pg-hydro)"
				opacity={0.25 + 0.6 * Math.sqrt(c.kv / 400)}
			/>
			<Readout id="chain-{i}" order={10 + i} label={c.where} value={c.label}>
				<Label {x} y={560 - h - 26} text={c.label} weight={700} />
				<Label {x} y={560 - h - 8} text={c.where} muted />
			</Readout>
			{#if i < CHAIN.length - 1}
				<path
					d="M{x + 34} 540 H{chainX(i + 1) - 34}"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
			{/if}
		{/each}
		<circle
			cx={chainX(0) + pulse * (chainX(4) - chainX(0))}
			cy={574}
			r="6"
			fill="var(--pg-solar)"
		/>
		<Readout id="chain-note">
			<Label
				x={480}
				y={584}
				text="voltage stepped down at each substation, closer to where it is used"
				muted
			/>
		</Readout>
	{/if}
</g>
