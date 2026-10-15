<script lang="ts">
	/**
	 * Rasterising one triangle on a coarse 32 × 20 grid of pixels. Its three corners are
	 * draggable `<Handle>`s (stored in `params.tri` as "x0,y0,x1,y1,x2,y2" in pixel units). The
	 * model's `coverage` gives the pixels whose centres are inside (the edge-function test over
	 * the bounding box); a scan, a pure function of t, walks the box row by row, colouring tested
	 * pixels and filling covered ones, with the three edge-function signs of the current pixel
	 * shown on the right. Under reduced motion the scan is complete, and the readout shows a pixel
	 * inside.
	 */
	import { Handle, Label, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { coverage, edge } from '../render';

	let { t, params, setParam, reduced }: StageProps = $props();

	const GW = 32;
	const GH = 20;
	const C = 23;
	const X0 = 16;
	const Y0 = 16;
	const DEFAULT: [number, number][] = [
		[4.3, 16.8],
		[27.6, 3.2],
		[19.4, 18.5]
	];

	const tri = $derived.by<[number, number][]>(() => {
		const raw = params.tri;
		if (typeof raw === 'string') {
			const v = raw.split(',').map(Number);
			if (v.length === 6 && v.every(Number.isFinite))
				return [
					[v[0], v[1]],
					[v[2], v[3]],
					[v[4], v[5]]
				];
		}
		return DEFAULT;
	});
	function setCorner(k: number, p: [number, number]) {
		const next = tri.map((q, i) => (i === k ? p : q));
		setParam(
			'tri',
			next
				.flat()
				.map((v) => v.toFixed(2))
				.join(',')
		);
	}
	const clampG = (v: number, n: number) => Math.min(n, Math.max(0, v));

	const cov = $derived(coverage(tri, GW, GH));
	const box = $derived(cov.box);
	const boxW = $derived(box[2] - box[0] + 1);
	const n = $derived(Math.max(0, boxW * (box[3] - box[1] + 1)));

	const SCAN = 9; // seconds to scan the box
	const PERIOD = SCAN + 3;
	const u = $derived(reduced ? 1 : Math.min(1, (t % PERIOD) / SCAN));
	const done = $derived(Math.floor(u * n));

	/** The pixel being tested (or, when done, a pixel inside near the middle). */
	const cur = $derived.by<[number, number]>(() => {
		if (done < n) return [box[0] + (done % boxW), box[1] + Math.floor(done / boxW)];
		const cx = Math.floor((tri[0][0] + tri[1][0] + tri[2][0]) / 3);
		const cy = Math.floor((tri[0][1] + tri[1][1] + tri[2][1]) / 3);
		return [clampG(cx, GW - 1), clampG(cy, GH - 1)];
	});

	const paths = $derived.by(() => {
		let tested = '';
		let inside = '';
		let covered = 0;
		for (let k = 0; k < Math.min(done, n); k++) {
			const i = box[0] + (k % boxW);
			const j = box[1] + Math.floor(k / boxW);
			const r = `M${X0 + i * C} ${Y0 + j * C}h${C}v${C}h${-C}z`;
			if (cov.inside[j * GW + i]) {
				inside += r;
				covered++;
			} else tested += r;
		}
		return { tested, inside, covered };
	});
	const centres = (() => {
		let d = '';
		for (let j = 0; j < GH; j++)
			for (let i = 0; i < GW; i++) d += `M${X0 + (i + 0.5) * C - 1.2} ${Y0 + (j + 0.5) * C}h2.4`;
		return d;
	})();

	const S = (p: [number, number]) => ({ x: X0 + p[0] * C, y: Y0 + p[1] * C });
	const pts = $derived(tri.map(S));
	const area = $derived(edge(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1]));
	/** Edge-function values of the current pixel's centre, oriented so that inside is ≥ 0. */
	const signs = $derived.by(() => {
		const px = cur[0] + 0.5;
		const py = cur[1] + 0.5;
		const s = Math.sign(area) || 1;
		return [
			[1, 2],
			[2, 0],
			[0, 1]
		].map(([a, b]) => s * edge(tri[a][0], tri[a][1], tri[b][0], tri[b][1], px, py));
	});
	const curInside = $derived(signs.every((v) => v >= 0));
	const edgeColor = ['var(--g3-eye)', 'var(--g3-reflect)', 'var(--g3-refract)'];
	const RX = 784;
</script>

<g>
	<rect x={X0} y={Y0} width={GW * C} height={GH * C} fill="var(--surface)" stroke="var(--border)" />
	<path d={paths.tested} fill="var(--g3-tested)" />
	<path d={paths.inside} fill="var(--g3-inside)" fill-opacity="0.75" />
	<!-- the grid and pixel centres -->
	<path
		d={Array.from({ length: GW + 1 }, (_, i) => `M${X0 + i * C} ${Y0}v${GH * C}`).join('') +
			Array.from({ length: GH + 1 }, (_, j) => `M${X0} ${Y0 + j * C}h${GW * C}`).join('')}
		stroke="var(--stage-grid)"
		stroke-width="1"
	/>
	<path d={centres} stroke="var(--stage-ink-muted)" stroke-width="2.4" stroke-opacity="0.55" />
	<!-- bounding box -->
	<rect
		x={X0 + box[0] * C}
		y={Y0 + box[1] * C}
		width={boxW * C}
		height={(box[3] - box[1] + 1) * C}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="6 4"
		stroke-width="1.5"
	/>
	<!-- edges, one colour each -->
	{#each [[1, 2], [2, 0], [0, 1]] as [a, b], k (k)}
		<line
			x1={pts[a].x}
			y1={pts[a].y}
			x2={pts[b].x}
			y2={pts[b].y}
			stroke={edgeColor[k]}
			stroke-width="2.5"
			stroke-linecap="round"
		/>
	{/each}
	<!-- current pixel -->
	<rect
		x={X0 + cur[0] * C - 1}
		y={Y0 + cur[1] * C - 1}
		width={C + 2}
		height={C + 2}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>
	{#each pts as p, k (k)}
		<Handle
			x={p.x}
			y={p.y}
			r={8}
			label="Corner {k + 1} of the triangle"
			value={Math.round(tri[k][0] * 10) / 10}
			min={0}
			max={GW}
			valuetext="corner {k + 1} at {tri[k][0].toFixed(1)}, {tri[k][1].toFixed(1)}"
			color="var(--g3-inside)"
			onmove={(q: Point) => setCorner(k, [clampG((q.x - X0) / C, GW), clampG((q.y - Y0) / C, GH)])}
			onkey={(s) => {
				if (typeof s === 'number') setCorner(k, [clampG(tri[k][0] + s * 0.25, GW), tri[k][1]]);
			}}
		/>
	{/each}

	<!-- readouts -->
	<rect
		x={RX - 8}
		y={Y0}
		width={960 - 16 - RX + 8}
		height={GH * C}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="tested" order={1} label="Pixels tested (the box)" value={String(n)}>
		<Label anchor="start" x={RX + 6} y={Y0 + 28} text="Box round it" size={12.5} muted />
		<Label anchor="start" x={RX + 6} y={Y0 + 50} text="{n} pixels tested" size={15} weight={700} />
	</Readout>
	<Readout
		id="inside"
		order={2}
		label="Pixel centres inside"
		value={String(cov.covered)}
		color="var(--g3-inside)"
	>
		<Label anchor="start" x={RX + 6} y={Y0 + 84} text="Centres inside" size={12.5} muted />
		<Label
			anchor="start"
			x={RX + 6}
			y={Y0 + 106}
			text="{u < 1 ? paths.covered : cov.covered} of {cov.covered} filled"
			size={15}
			weight={700}
			color="var(--g3-inside)"
		/>
	</Readout>
	<Readout
		id="signs"
		order={3}
		label="This pixel's three edge tests"
		value={signs.map((v) => (v >= 0 ? '+' : '−')).join(' ') +
			(curInside ? ' → inside' : ' → outside')}
	>
		<Label anchor="start" x={RX + 6} y={Y0 + 150} text="This pixel's centre," size={12.5} muted />
		<Label anchor="start" x={RX + 6} y={Y0 + 168} text="side of each edge:" size={12.5} muted />
		{#each signs as v, k (k)}
			<Label
				anchor="start"
				x={RX + 6}
				y={Y0 + 196 + 26 * k}
				text="edge {k + 1}:  {v >= 0 ? '+ inner side' : '− outer side'}"
				size={13.5}
				weight={650}
				color={edgeColor[k]}
			/>
		{/each}
		<Label
			anchor="start"
			x={RX + 6}
			y={Y0 + 292}
			text={curInside ? 'all three +: inside' : 'a −: outside'}
			size={14}
			weight={700}
			color={curInside ? 'var(--g3-inside)' : undefined}
		/>
	</Readout>
	<Readout id="hint">
		<Label anchor="start" x={RX + 6} y={Y0 + 420} text="Drag the corners" size={12.5} muted />
		<Label anchor="start" x={RX + 6} y={Y0 + 440} text="of the triangle." size={12.5} muted />
	</Readout>

	<Readout id="legend">
		<g>
			<rect x={X0} y={500} width="16" height="16" fill="var(--g3-tested)" stroke="var(--border)" />
			<Label anchor="start" x={X0 + 24} y={513} text="tested, outside" size={13} />
			<rect
				x={X0 + 150}
				y={500}
				width="16"
				height="16"
				fill="var(--g3-inside)"
				fill-opacity="0.75"
			/>
			<Label
				anchor="start"
				x={X0 + 174}
				y={513}
				text="tested, centre inside: the triangle's pixels"
				size={13}
			/>
			<Label
				anchor="start"
				x={X0}
				y={546}
				text="Edge test for an edge a → b and pixel centre p:  (b − a) × (p − a) = (bx − ax)(py − ay) − (by − ay)(px − ax)"
				size={13}
				muted
			/>
			<Label
				anchor="start"
				x={X0}
				y={570}
				text="Its sign says which side of the edge p is on. Inside = on the inner side of all three."
				size={13}
				muted
			/>
		</g>
	</Readout>
</g>
