<script lang="ts">
	/**
	 * A straight-chain alkane in 3D (ball and stick, orthographic, z up) from `alkane3d()`:
	 * measured bond lengths and angles. Step `four` shows methane (`hints.n`), step `chain`
	 * the chain of `params.carbons`. It turns slowly by itself (a pure function of t; still
	 * under reduced motion) and the reader turns it by dragging or with the arrow keys. A
	 * changed length zooms smoothly (Tween) so the molecule fills the view.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG presentation
	 * attributes.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep, startDrag, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { projector } from '../../chemical-bonds/look';
	import { alkane3d, angle, MEASURED, type P3 } from '../chain3d';
	import { formula, name } from '../molecule';
	import { ATOM, ballRadius } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const n = $derived(clamp(Math.round(Number(step.hints?.n ?? params.carbons ?? 4)), 1, 8));
	const mol = $derived(alkane3d(n));
	const build = $derived({ n, ring: false, aromatic: false, feature: null, at: 1 });

	// ---- view
	const CX = 380;
	const CY = 300;
	let yawOff = $state(0);
	let pitch = $state(0.32);
	const yaw = $derived(yawOff + 0.35 + (reduced ? 0 : 0.14 * t));
	const extent = $derived(
		Math.max(2.2, ...mol.atoms.map((a) => Math.hypot(a.pos[0], a.pos[1], a.pos[2])))
	);
	const pxTarget = $derived(clamp(270 / extent, 40, 150));
	const px = Tween.of(() => pxTarget, { duration: 700, easing: cubicInOut });
	const project = $derived(projector(yaw, pitch, CX, CY));
	const k = $derived(px.current / 60);

	const scr = (p: P3) => project([p[0] * px.current, p[1] * px.current, p[2] * px.current]);

	interface Item {
		key: string;
		depth: number;
		kind: 'atom' | 'bond';
		x: number;
		y: number;
		x2?: number;
		y2?: number;
		r?: number;
		el?: 'C' | 'H';
	}
	const items = $derived.by(() => {
		const out: Item[] = [];
		const s = mol.atoms.map((a) => scr(a.pos));
		mol.atoms.forEach((a, i) =>
			out.push({
				key: `a${i}`,
				depth: s[i].depth,
				kind: 'atom',
				x: s[i].x,
				y: s[i].y,
				r: ballRadius(a.el, k),
				el: a.el
			})
		);
		mol.bonds.forEach(([a, b]) =>
			out.push({
				key: `b${a}-${b}`,
				depth: (s[a].depth + s[b].depth) / 2 - 0.5,
				kind: 'bond',
				x: s[a].x,
				y: s[a].y,
				x2: s[b].x,
				y2: s[b].y
			})
		);
		return out.sort((p, q) => p.depth - q.depth);
	});

	// ---- the angle arc: H–C–H in methane, C–C–C in a chain, H–C–C in ethane
	const arc = $derived.by(() => {
		const A = mol.atoms;
		let tri: [number, number, number];
		if (n === 1) tri = [1, 0, 2];
		else if (n === 2) tri = [mol.bonds.find(([a, b]) => a === 0 && A[b].el === 'H')![1], 0, 1];
		else tri = [0, 1, 2];
		const [a, c, b] = tri.map((i) => A[i].pos);
		const deg = angle(a, c, b);
		const u = norm3(sub3(a, c));
		const v = norm3(sub3(b, c));
		const R = 0.8;
		const pts: Point[] = [];
		for (let i = 0; i <= 16; i++) {
			const w = norm3(lerp3(u, v, i / 16));
			const q = scr(add3(c, mul3(w, R)));
			pts.push({ x: q.x, y: q.y });
		}
		const mid = norm3(lerp3(u, v, 0.5));
		const lab = scr(add3(c, mul3(mid, R + 0.38)));
		const chord = Math.hypot(pts[0].x - pts[16].x, pts[0].y - pts[16].y);
		return {
			d: 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L'),
			x: lab.x,
			y: lab.y + 4,
			text: `${deg.toFixed(1)}°`,
			opacity: smoothstep(10, 28, chord)
		};
	});
	function sub3(a: P3, b: P3): P3 {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	}
	function add3(a: P3, b: P3): P3 {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	}
	function mul3(a: P3, s: number): P3 {
		return [a[0] * s, a[1] * s, a[2] * s];
	}
	function lerp3(a: P3, b: P3, u: number): P3 {
		return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
	}
	function norm3(a: P3): P3 {
		const l = Math.hypot(a[0], a[1], a[2]) || 1;
		return [a[0] / l, a[1] / l, a[2] / l];
	}

	// ---- turning
	let last: Point | null = null;
	function turn(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (last) {
					yawOff += (p.x - last.x) * 0.012;
					pitch = clamp(pitch + (p.y - last.y) * 0.012, -1.4, 1.4);
				}
				last = p;
			},
			() => (last = null)
		);
	}
	function turnKey(e: KeyboardEvent) {
		const s = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') yawOff -= s;
		else if (e.key === 'ArrowRight') yawOff += s;
		else if (e.key === 'ArrowUp') pitch = clamp(pitch - s, -1.4, 1.4);
		else if (e.key === 'ArrowDown') pitch = clamp(pitch + s, -1.4, 1.4);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// ---- readout
	const RX = 690;
	const pm = (aa: number) => `${Math.round(aa * 100)} pm`;
	const lines = $derived.by(() => {
		if (n === 1)
			return [
				{ id: 'ch', label: 'C–H bond', value: pm(MEASURED.methane.CH) },
				{ id: 'hch', label: 'H–C–H angle', value: '109.5°' }
			];
		if (n === 2)
			return [
				{ id: 'cc', label: 'C–C bond', value: pm(MEASURED.ethane.CC) },
				{ id: 'ch', label: 'C–H bond', value: pm(MEASURED.ethane.CH) },
				{ id: 'hcc', label: 'H–C–C angle', value: `${MEASURED.ethane.HCC.toFixed(1)}°` }
			];
		return [
			{ id: 'cc', label: 'C–C bond', value: pm(MEASURED.propane.CC) },
			{ id: 'ch', label: 'C–H bond', value: '109 pm' },
			{ id: 'ccc', label: 'C–C–C angle', value: `${MEASURED.propane.CCC.toFixed(1)}°` }
		];
	});
	const source = $derived(
		n === 1 ? 'measured: methane' : n === 2 ? 'measured: ethane' : 'measured: propane (CCCBDB)'
	);
</script>

<g>
	<rect
		class="turn"
		x={CX - 330}
		y="40"
		width="660"
		height="520"
		rx="16"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Turn the molecule: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360}
		onpointerdown={turn}
		onkeydown={turnKey}
	/>

	{#each items as it (it.key)}
		{#if it.kind === 'bond'}
			<line
				x1={it.x}
				y1={it.y}
				x2={it.x2}
				y2={it.y2}
				stroke="var(--stage-ink-muted)"
				stroke-width={Math.max(4, 7 * k)}
				stroke-linecap="round"
				style:pointer-events="none"
			/>
		{:else if it.el}
			{@const r = it.r ?? 10}
			<g style:pointer-events="none">
				<circle
					cx={it.x}
					cy={it.y}
					{r}
					fill={ATOM[it.el].fill}
					stroke={ATOM[it.el].edge}
					stroke-width="1.5"
				/>
				<circle
					cx={it.x - r * 0.32}
					cy={it.y - r * 0.34}
					r={r * 0.38}
					fill="#ffffff"
					opacity={it.el === 'H' ? 0.5 : 0.22}
				/>
				{#if r > 11}
					<text
						x={it.x}
						y={it.y + r * 0.36}
						text-anchor="middle"
						font-weight="700"
						style:font-size="{Math.max(10, r * 0.95)}px"
						style:fill={ATOM[it.el].ink}>{it.el}</text
					>
				{/if}
			</g>
		{/if}
	{/each}

	{#if arc.opacity > 0.02}
		<g opacity={arc.opacity} style:pointer-events="none" data-testid="chain-angle">
			<path d={arc.d} fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
			<text
				x={arc.x}
				y={arc.y}
				class="halo"
				text-anchor="middle"
				font-weight="700"
				style:font-size="13px">{arc.text}</text
			>
		</g>
	{/if}

	<Readout id="hint">
		<text x={CX} y="578" class="halo muted" text-anchor="middle" style:font-size="11px"
			>Drag to turn the molecule</text
		>
	</Readout>

	<g transform="translate({RX} 0)" style:pointer-events="none">
		<Readout id="name" order={0} label={name(build)} value={formula(build)}>
			<text x="0" y="96" class="halo" font-weight="700" style:font-size="26px"
				>{formula(build)}</text
			>
			<text x="0" y="122" class="halo muted" style:font-size="15px">{name(build)}</text>
		</Readout>
		{#if n > 1}
			<Readout id="general" order={1} label="Rule" value="CₙH₂ₙ₊₂">
				<text x="0" y="148" class="halo" style:font-size="13px"
					>CₙH₂ₙ₊₂: {n} carbons, {2 * n + 2} hydrogens</text
				>
			</Readout>
		{/if}
		{#each lines as l, i (l.id)}
			<Readout id="geo-{l.id}" order={2 + i} label={l.label} value={l.value}>
				<text x="0" y={196 + i * 46} class="halo muted" style:font-size="12px">{l.label}</text>
				<text x="0" y={216 + i * 46} class="halo" font-weight="700" style:font-size="18px"
					>{l.value}</text
				>
			</Readout>
		{/each}
		<Readout id="source">
			<text x="0" y={196 + lines.length * 46 + 6} class="halo muted" style:font-size="11px"
				>{source}</text
			>
		</Readout>
	</g>
</g>

<style>
	.turn {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.turn:active {
		cursor: grabbing;
	}
	.turn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
