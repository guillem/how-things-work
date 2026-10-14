<script lang="ts">
	/**
	 * What a passing wave does to free masses. Left: a ring of 24 free masses with
	 * the wave coming straight out of the page; plus: x → x(1 + ½h cos), y → y(1 − ½h cos);
	 * cross: the same turned by 45° (x → x + ½h y cos, y → y + ½h x cos). Optional
	 * arms along x and y with their length change. Right: the same wave seen side on,
	 * travelling to the right; rings edge-on at five places along it change only
	 * across, never along, the direction of travel. The drawn strain is h = 0.5
	 * (±25%), a cycle every 2 s; reduced motion: t = 2.5 s, the most stretched frame.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const H = 0.5;
	const PERIOD = 2;
	const time = $derived(reduced ? 2.5 : t);
	const s = $derived(Math.sin((2 * Math.PI * time) / PERIOD));
	const cross = $derived(params.pol === 'cross');
	const showArms = $derived(Boolean(params.arms));

	const CX = 230;
	const CY = 300;
	const R = 150;
	const N = 24;

	function moved(x: number, y: number, phase: number) {
		const k = (H / 2) * phase;
		return cross ? { x: x + k * y, y: y + k * x } : { x: x * (1 + k), y: y * (1 - k) };
	}
	// screen y is downwards: physical y = −(screen offset)
	const masses = $derived(
		Array.from({ length: N }, (_, i) => {
			const a = (2 * Math.PI * i) / N;
			const p = moved(R * Math.cos(a), R * Math.sin(a), s);
			return { i, x: CX + p.x, y: CY - p.y };
		})
	);
	const ringPath = $derived(
		masses.map((m, i) => `${i ? 'L' : 'M'}${m.x.toFixed(1)} ${m.y.toFixed(1)}`).join(' ') + 'Z'
	);
	const xArm = $derived(moved(R, 0, s));
	const yArm = $derived(moved(0, R, s));
	const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;
	const xChange = $derived(Math.hypot(xArm.x, xArm.y) / R - 1);
	const yChange = $derived(Math.hypot(yArm.x, yArm.y) / R - 1);

	// ---- side view --------------------------------------------------------------------
	const SX0 = 500;
	const SX1 = 928;
	const SY = 330;
	const WL = 214; // drawn wavelength, px
	const SPEED = WL / PERIOD; // px/s
	const at = (x: number) => Math.sin((2 * Math.PI * (time - (x - SX0) / SPEED)) / PERIOD);
	const wavePath = $derived.by(() => {
		let d = '';
		for (let x = SX0; x <= SX1; x += 4)
			d += `${d ? 'L' : 'M'}${x} ${(SY + 150 - 26 * at(x)).toFixed(1)}`;
		return d;
	});
	const rings = $derived(
		[540, 620, 700, 780, 860].map((x) => {
			const k = cross ? 0 : (H / 2) * at(x);
			return { x, half: 90 * (1 - k) };
		})
	);
</script>

<g>
	<rect
		x="16"
		y="16"
		width="448"
		height="568"
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>
	<T x={32} y={44} text="Face on: the wave comes out of the page" size={14} weight={700} />

	<!-- the undisturbed ring -->
	<circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--stage-line)" stroke-dasharray="4 5" />
	<path d={ringPath} fill="none" stroke="var(--gw-crest)" stroke-width="1.2" opacity="0.5" />

	{#if showArms}
		<g>
			<line
				x1={CX}
				y1={CY}
				x2={CX + xArm.x}
				y2={CY - xArm.y}
				stroke="var(--gw-laser)"
				stroke-width="3"
			/>
			<line
				x1={CX}
				y1={CY}
				x2={CX + yArm.x}
				y2={CY - yArm.y}
				stroke="var(--gw-laser)"
				stroke-width="3"
			/>
			<Readout
				id="arm-x"
				order={3}
				label="Arm along x"
				value={pct(xChange)}
				color="var(--gw-laser)"
			>
				<T
					x={CX + 100}
					y={CY + 50}
					text="x arm {pct(xChange)}"
					size={12.5}
					weight={650}
					color="var(--gw-laser)"
				/>
			</Readout>
			<Readout
				id="arm-y"
				order={4}
				label="Arm along y"
				value={pct(yChange)}
				color="var(--gw-laser)"
			>
				<T
					x={CX + 14}
					y={CY - 192}
					text="y arm {pct(yChange)}"
					size={12.5}
					weight={650}
					color="var(--gw-laser)"
				/>
			</Readout>
		</g>
	{/if}

	{#each masses as m (m.i)}
		<circle
			cx={m.x}
			cy={m.y}
			r="6"
			fill="var(--stage-ink)"
			stroke="var(--gw-space)"
			stroke-width="1.5"
		/>
	{/each}
	<circle cx={CX} cy={CY} r="4" fill="var(--stage-ink)" />

	<Readout id="ring-cap">
		<T
			x={32}
			y={548}
			text="dashed: the ring with no wave · free masses, not tied"
			size={12}
			muted
		/>
		<T x={32} y={566} text="strain drawn h = 0.5; a real one is about 10⁻²¹" size={12} muted />
	</Readout>

	<!-- side view -->
	<rect
		x="480"
		y="16"
		width="464"
		height="568"
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>
	<T x={496} y={44} text="Side on: the wave travels to the right" size={14} weight={700} />
	{#each rings as r (r.x)}
		<line
			x1={r.x}
			y1={SY - 90}
			x2={r.x}
			y2={SY + 90}
			stroke="var(--stage-line)"
			stroke-dasharray="3 4"
		/>
		<line
			x1={r.x}
			y1={SY - r.half}
			x2={r.x}
			y2={SY + r.half}
			stroke="var(--gw-crest)"
			stroke-width="2"
			opacity="0.6"
		/>
		<circle cx={r.x} cy={SY - r.half} r="6" fill="var(--stage-ink)" />
		<circle cx={r.x} cy={SY + r.half} r="6" fill="var(--stage-ink)" />
	{/each}
	<path d={wavePath} fill="none" stroke="var(--gw-crest)" stroke-width="2" />
	<line x1={SX0} y1={SY + 150} x2={SX1} y2={SY + 150} stroke="var(--stage-grid)" />
	<line
		x1={SX1 - 60}
		y1={SY + 196}
		x2={SX1 - 6}
		y2={SY + 196}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="side-cap">
		<T x={SX1 - 70} y={SY + 200} text="direction of travel, at c" size={12} anchor="end" muted />
		<T
			x={496}
			y={566}
			text={cross
				? 'cross: from the side, nothing stretches along these lines'
				: 'rings edge-on: they change across the wave, never along it'}
			size={12}
			muted
		/>
	</Readout>

	<Card x={496} y={60} w={432} h={64} />
	<Row
		id="pol"
		order={1}
		x={512}
		y={86}
		w={400}
		label="Polarisation"
		value={cross ? 'cross: stretch along the diagonals' : 'plus: stretch along x, squeeze along y'}
	/>
	<Row
		id="transverse"
		order={2}
		x={512}
		y={110}
		w={400}
		label="Along the direction of travel"
		value="no change"
	/>
</g>
