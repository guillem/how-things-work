<script lang="ts">
	/**
	 * The adaptive immune system's library of receptors, and what happens to
	 * the few that fit.
	 *
	 * A sample of naive lymphocytes in a lymph node (T cells purple, B cells
	 * green), each with its own receptor: a profile of three steps whose
	 * heights stand for the three gene segments joined at random (V, D, J).
	 * A viral fragment fits a receptor whose profile is its exact complement.
	 *
	 * Views (step.hints.view):
	 *   library — receptors are assembled from segments, cell by cell; a few
	 *             that fit the body's own molecules are removed;
	 *   match   — a dendritic cell presents a viral fragment; it is compared
	 *             with every receptor, and the two that fit light up;
	 *   expand  — the matching T cell divides again and again; the counter is
	 *             the model's e^(pC·age): about 1,300 cells after 6 days;
	 *   memory  — the expanded clone after the virus has gone: the model's
	 *             killer T cells fall from their peak, a twentieth stays;
	 *   recap   — the three moves side by side, with the model's first and
	 *             second antibody responses.
	 * The drawn sample is tiny and enriched: in a real node only about one
	 * cell in a hundred thousand would fit (the page says so).
	 */
	import { Label, clamp, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CAO, MEMORY, antibody, at, effectors, peak } from '../model';
	import { count, retime, run } from '../run';

	let { step, t, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'library'));
	const tt = $derived(reduced ? 30 : t);

	// ---- the sample of naive cells -----------------------------------------------------
	const COLS = 12;
	const ROWS = 6;
	const GX0 = 70;
	const GY0 = 150;
	const DX = 54;
	const DY = 64;
	const TARGET = 37; // the receptor shape that fits the viral fragment
	const MATCH_T = 41;
	const MATCH_B = 66;
	const SELF = [9, 23, 52, 63]; // receptors that fit the body's own molecules

	/** Heights (0–3) of the three steps of receptor shape `id` (0–63). */
	const steps3 = (id: number) => [id & 3, (id >> 2) & 3, (id >> 4) & 3];
	const shapeOf = (i: number) => {
		if (i === MATCH_T || i === MATCH_B) return TARGET;
		const id = Math.floor(hash(i, 50) * 64);
		return id === TARGET ? (id + 1) % 64 : id;
	};
	const cells = Array.from({ length: COLS * ROWS }, (_, i) => ({
		i,
		x: GX0 + (i % COLS) * DX,
		y: GY0 + Math.floor(i / COLS) * DY,
		kind: (i === MATCH_B || (i !== MATCH_T && hash(i, 51) < 0.45) ? 'b' : 't') as 'b' | 't',
		shape: shapeOf(i)
	}));
	/** Depth of each of the three steps of the cradle floor, below its rim. */
	const floor = (id: number) => steps3(id).map((v) => 3 + 4 * v);
	/** Receptor on top of a cell at (x, y): a cradle whose floor has three steps. */
	const cup = (x: number, y: number, id: number) => {
		const r = y - 32;
		const [a, b, c] = floor(id).map((d) => r + d);
		return `M${x - 15} ${y - 15} V${r} H${x - 13} V${a} H${x - 4.3} V${b} H${x + 4.3} V${c} H${x + 13} V${r} H${x + 15} V${y - 15}`;
	};
	/** The viral fragment that fits receptor TARGET, as it sits in the cradle of a cell at (x, y). */
	const fragment = (x: number, y: number) => {
		const r = y - 32;
		const [a, b, c] = floor(TARGET).map((d) => r + d - 0.8);
		return `M${x - 12.4} ${r - 8} H${x + 12.4} V${c} H${x + 4.3} V${b} H${x - 4.3} V${a} H${x - 12.4} Z`;
	};
	const color = (k: 'b' | 't') => (k === 't' ? 'var(--im-tcell)' : 'var(--im-bcell)');

	// ---- library: cells appear one by one -------------------------------------------------
	const built = $derived(view === 'library' ? clamp((tt - 0.8) / 10) * cells.length : cells.length);
	const removed = $derived(view === 'library' ? smoothstep(12, 13.5, tt) : 1);
	const showSelf = $derived(view === 'library');
	/** The segment picker for the cell being built now. */
	const building = $derived(Math.min(cells.length - 1, Math.floor(built)));
	const pick = $derived(steps3(cells[building].shape));

	// ---- match: the fragment is compared with every receptor ------------------------------
	const scan = $derived(view === 'match' ? clamp((tt - 1.5) / 7) : 1);
	const scanned = $derived(scan * cells.length);
	const lit = $derived(
		view === 'match' ? smoothstep(MATCH_T, MATCH_T + 2, scanned) : view === 'library' ? 0 : 1
	);
	const litB = $derived(view === 'match' ? smoothstep(MATCH_B, MATCH_B + 2, scanned) : lit);

	// ---- expand: one cell becomes many ----------------------------------------------------
	const age = $derived(view === 'expand' ? clamp((tt - 1) / 14) * CAO.tauC : CAO.tauC);
	const cloneSize = $derived(Math.exp(CAO.pC * age));
	const drawn = $derived(Math.min(64, Math.pow(2, Math.floor(Math.log2(cloneSize)))));
	const cluster = (n: number, cx: number, cy: number, spread = 1) =>
		Array.from({ length: n }, (_, k) => {
			const a = k * 2.39996;
			const r = 11 * Math.sqrt(k) * spread;
			return { k, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) * 0.8 };
		});

	// ---- memory: the model's effector T cells after the peak ------------------------------
	const series = $derived(run({ days: 30 }));
	const peakE = $derived(peak(series, effectors));
	const memoryCells = $derived(MEMORY.share * peakE.v);
	/** Drawn memory cells: 5% of the 64 drawn, spread through the clone. */
	const MEMORY_DRAWN = [5, 27, 50];
	const memDay = $derived(view === 'memory' ? peakE.t + clamp((tt - 1) / 12) * (30 - peakE.t) : 30);
	const nowE = $derived(effectors(at(series, memDay)));
	const sxM = scale([0, 30], [600, 920]);
	const syM = scale([0, 5], [420, 240]);
	const lgE = (v: number) => (v >= 1 ? Math.log10(v) : 0);
	const ePath = $derived(
		linePath(
			series.filter((p) => p.t <= memDay),
			(p) => p.t,
			(p) => lgE(effectors(p)),
			sxM,
			syM
		)
	);

	// ---- recap: the model's first and second antibody responses --------------------------
	const second = $derived(run({ days: 200, reinfectAt: 180 }));
	const ab1 = $derived(retime(second, 0, 20));
	const ab2 = $derived(retime(second, 180, 20));
	const sxR = scale([0, 20], [664, 912]);
	const syR = scale([0, 4.5], [500, 330]);
	const lgA = (v: number) => (v >= 1 ? Math.log10(v) : 0);

	/** Where the fragment is during the scan: hopping along the cells. */
	const probe = $derived.by(() => {
		const k = Math.min(cells.length - 1, Math.floor(scanned));
		const c = cells[k];
		const settle = lit > 0.5 ? cells[MATCH_T] : c;
		return { x: settle.x, y: settle.y - 40 };
	});
</script>

<g>
	{#if view === 'library' || view === 'match'}
		<!-- the lymph node, with its sample of naive cells -->
		<rect
			x={36}
			y={84}
			width={COLS * DX + 20}
			height={ROWS * DY + 28}
			rx="22"
			fill="var(--im-node)"
			stroke="var(--im-node-edge)"
			stroke-width="1.4"
		/>
		{#each cells as c (c.i)}
			{@const shown = view === 'library' ? clamp(built - c.i) : 1}
			{@const isSelf = SELF.includes(c.i)}
			{@const fade = isSelf && showSelf ? 1 - 0.75 * removed : 1}
			{@const isMatch = c.i === MATCH_T ? lit : c.i === MATCH_B ? litB : 0}
			{@const dim = view === 'match' ? 0.45 + 0.55 * isMatch : 1}
			{#if shown > 0.01 && !(isSelf && view === 'match')}
				<g opacity={shown * fade * dim}>
					<circle cx={c.x} cy={c.y} r="16" fill={color(c.kind)} opacity="0.85" />
					<path
						d={cup(c.x, c.y, c.shape)}
						fill="none"
						stroke={color(c.kind)}
						stroke-width="2.4"
						stroke-linejoin="round"
					/>
					{#if isMatch > 0.5}
						<circle
							cx={c.x}
							cy={c.y - 8}
							r="30"
							fill="none"
							stroke="var(--im-virus)"
							stroke-width="2"
						/>
					{/if}
				</g>
				{#if isSelf && showSelf && removed > 0.05}
					<path
						d="M{c.x - 14} {c.y - 14} L{c.x + 14} {c.y + 14} M{c.x + 14} {c.y - 14} L{c.x -
							14} {c.y + 14}"
						stroke="var(--stage-ink)"
						stroke-width="2"
						opacity={removed}
					/>
				{/if}
			{/if}
		{/each}
		<Readout id="node-key" label="A sample of naive B cells (green) and T cells (purple)">
			<text x={46} y={74} font-size="12" class="muted"
				>a sample of naive lymphocytes in a lymph node: <tspan style:fill="var(--im-bcell)"
					>B cells</tspan
				>,
				<tspan style:fill="var(--im-tcell)">T cells</tspan></text
			>
		</Readout>
	{/if}

	{#if view === 'library'}
		<!-- the segment picker: one of each kind, joined at random -->
		{@const PX = 760}
		<text x={PX} y={110} font-size="13" font-weight="600">building a receptor gene</text>
		{#each ['V', 'D', 'J'] as seg, j (seg)}
			<text x={PX} y={150 + j * 56} font-size="12" class="muted">{seg} segments</text>
			{#each [0, 1, 2, 3] as h (h)}
				<rect
					x={PX + h * 40}
					y={158 + j * 56}
					width="32"
					height="18"
					rx="3"
					fill={pick[j] === h ? 'var(--im-memory)' : 'var(--stage-grid)'}
					stroke="var(--stage-line)"
				/>
				<rect
					x={PX + h * 40 + 6}
					y={161 + j * 56}
					width="20"
					height={1 + h * 4}
					fill="var(--stage-ink)"
					opacity={pick[j] === h ? 0.9 : 0.35}
				/>
			{/each}
		{/each}
		<text x={PX} y={340} font-size="12">joined, the three choices give</text>
		<text x={PX} y={356} font-size="12">this cell’s receptor shape:</text>
		<circle cx={PX + 70} cy={410} r="16" fill={color(cells[building].kind)} opacity="0.85" />
		<path
			d={cup(PX + 70, 410, cells[building].shape)}
			fill="none"
			stroke={color(cells[building].kind)}
			stroke-width="2.4"
		/>
		<Readout
			id="repertoire"
			order={2}
			label="Different T-cell receptors in an adult"
			value="at least 100 million"
		>
			<text x={PX} y={470} font-size="13" font-weight="600">in a real adult:</text>
			<text x={PX} y={490} font-size="13">at least 100 million</text>
			<text x={PX} y={506} font-size="13">different T-cell receptors</text>
		</Readout>
		<Readout
			id="self"
			order={3}
			label="Crossed out"
			value="receptors that fit the body itself are removed"
			opacity={removed}
		>
			<g opacity={removed}>
				<text x={46} y={540} font-size="12"
					><tspan font-weight="600">✕</tspan> fits the body’s own molecules: removed before the cell is
					released</text
				>
			</g>
		</Readout>
	{/if}

	{#if view === 'match'}
		<!-- the dendritic cell with the viral fragment -->
		{@const dc = { x: 820, y: 230 }}
		<path
			d="M{dc.x} {dc.y - 44} L{dc.x + 14} {dc.y - 14} L{dc.x + 46} {dc.y - 10} L{dc.x + 18} {dc.y +
				10} L{dc.x + 30} {dc.y + 44} L{dc.x} {dc.y + 22} L{dc.x - 30} {dc.y + 44} L{dc.x -
				18} {dc.y + 10} L{dc.x - 46} {dc.y - 10} L{dc.x - 14} {dc.y - 14} Z"
			fill="var(--im-interferon)"
			opacity="0.35"
			stroke="var(--im-interferon)"
			stroke-width="1.4"
			stroke-linejoin="round"
		/>
		<Readout id="dc" order={1} label="Dendritic cell, carrying a piece of the virus">
			<text x={dc.x} y={dc.y + 70} font-size="12" text-anchor="middle">dendritic cell</text>
			<text x={dc.x} y={dc.y + 86} font-size="11" class="muted" text-anchor="middle"
				>with a piece of the virus</text
			>
		</Readout>
		<path
			d={fragment(dc.x, dc.y - 18)}
			fill="var(--im-virus)"
			opacity={1 - smoothstep(0, 0.05, scan)}
		/>
		<!-- the fragment tries every receptor in turn -->
		{#if scan > 0}
			{@const p = probe}
			<path d={fragment(p.x, p.y + 40 - 12 * (1 - lit))} fill="var(--im-virus)" />
		{/if}
		<Readout
			id="fits"
			order={2}
			label="Cells that fit"
			value={lit > 0.5
				? litB > 0.5
					? `2 of ${cells.length} here`
					: `1 of ${cells.length} here`
				: 'searching…'}
		>
			<text x={760} y={400} font-size="13" font-weight="600"
				>{lit > 0.5
					? litB > 0.5
						? `two of these ${cells.length} fit`
						: `one of these ${cells.length} fits`
					: 'trying every receptor…'}</text
			>
			<text x={760} y={420} font-size="12" class="muted">in a real lymph node only about</text>
			<text x={760} y={436} font-size="12" class="muted">1 naive T cell in 100,000 fits</text>
			<text x={760} y={452} font-size="12" class="muted">any one piece of a virus</text>
		</Readout>
	{/if}

	{#if view === 'expand'}
		{@const cx = 300}
		{@const cy = 300}
		{#each cluster(drawn, cx, cy, drawn > 32 ? 1.05 : 1.2) as c (c.k)}
			<g transform="translate({c.x} {c.y}) scale(0.55)">
				<circle r="16" fill="var(--im-tcell)" opacity="0.9" />
				<path d={cup(0, 0, TARGET)} fill="none" stroke="var(--im-tcell)" stroke-width="3" />
			</g>
		{/each}
		<Readout
			id="clone"
			order={1}
			label="One switched-on T cell after {age.toFixed(1)} days"
			value="{count(cloneSize)} cells"
		>
			<text x={300} y={84} font-size="16" font-weight="600" text-anchor="middle"
				>{count(cloneSize)} cell{cloneSize < 1.5 ? '' : 's'}</text
			>
			<text x={300} y={104} font-size="12" class="muted" text-anchor="middle"
				>from one T cell that fitted, after {age.toFixed(1)} days</text
			>
		</Readout>
		<Readout id="clone-note">
			<text x={300} y={540} font-size="11" class="muted" text-anchor="middle"
				>drawn: up to 64 · all with the same receptor</text
			>
		</Readout>
		<!-- the model's multiplication, on a log chart -->
		{@const sxE = scale([0, CAO.tauC], [600, 920])}
		{@const syE = scale([0, 4], [470, 170])}
		{#each [0, 1, 2, 3, 4] as n (n)}
			<line x1={600} x2={920} y1={syE(n)} y2={syE(n)} stroke="var(--stage-grid)" />
			<text x={592} y={syE(n) + 4} font-size="11" class="muted" text-anchor="end"
				>{['1', '10', '100', '1,000', '10,000'][n]}</text
			>
		{/each}
		{#each [0, 2, 4, 6] as d (d)}
			<text x={sxE(d)} y={490} font-size="11" class="muted" text-anchor="middle">{d}</text>
		{/each}
		<text x={920} y={508} font-size="11" class="muted" text-anchor="end"
			>days since it was switched on</text
		>
		<text x={600} y={156} font-size="11" class="muted">cells in the clone (log scale)</text>
		<path
			d={Array.from({ length: 61 }, (_, k) => {
				const d = (k / 60) * age;
				return `${k ? 'L' : 'M'}${sxE(d).toFixed(1)} ${syE(Math.log10(Math.exp(CAO.pC * d))).toFixed(1)}`;
			}).join('')}
			fill="none"
			stroke="var(--im-tcell)"
			stroke-width="2.6"
		/>
		<circle cx={sxE(age)} cy={syE(Math.log10(cloneSize))} r="4" fill="var(--im-tcell)" />
		<Readout
			id="total"
			order={2}
			label="All 100 matching T cells together, at the peak"
			value="about {count(peakE.v)} killer T cells"
			opacity={smoothstep(5.5, 6, age)}
		>
			<g opacity={smoothstep(5.5, 6, age)}>
				<Label
					x={760}
					y={130}
					text="× 100 cells that fit ≈ {count(peakE.v)} at the peak"
					size={12}
					weight={600}
					color="var(--im-tcell)"
				/>
			</g>
		</Readout>
	{/if}

	{#if view === 'memory'}
		<!-- the clone shrinks; a twentieth stays as memory -->
		{@const share = nowE / peakE.v}
		{@const n = Math.round(64 * share)}
		{#each cluster(64, 300, 310, 1.05) as c (c.k)}
			{@const mem = MEMORY_DRAWN.includes(c.k)}
			{@const alive = mem || c.k < n}
			<g opacity={alive ? 1 : 0.12}>
				<circle
					cx={c.x}
					cy={c.y}
					r="9"
					fill={mem ? 'var(--im-memory)' : 'var(--im-tcell)'}
					opacity="0.9"
				/>
				{#if mem}
					<circle
						cx={c.x}
						cy={c.y}
						r="13"
						fill="none"
						stroke="var(--im-memory)"
						stroke-width="1.6"
					/>
				{/if}
			</g>
		{/each}
		<Readout id="mem-day" order={1} label="Day" value={memDay.toFixed(0)}>
			<text x={300} y={84} font-size="16" font-weight="600" text-anchor="middle"
				>day {memDay.toFixed(0)} · effector killer T cells: {count(nowE)}</text
			>
		</Readout>
		<Readout
			id="mem-count"
			order={2}
			label="Memory T cells left"
			value="about {count(memoryCells)}, 30 times the 100 naive cells"
			color="var(--im-memory)"
		>
			<text x={300} y={540} font-size="12" text-anchor="middle"
				><tspan style:fill="var(--im-memory)" font-weight="600"
					>memory cells: about {count(memoryCells)}</tspan
				>
				— {Math.round(memoryCells / CAO.Cn0)} times the {CAO.Cn0} naive cells that fitted</text
			>
		</Readout>
		<!-- the model's killer T cells over the month -->
		{#each [0, 1, 2, 3, 4, 5] as k (k)}
			<line x1={600} x2={920} y1={syM(k)} y2={syM(k)} stroke="var(--stage-grid)" />
			<text x={592} y={syM(k) + 4} font-size="11" class="muted" text-anchor="end"
				>{['1', '10', '100', '1,000', '10,000', '100,000'][k]}</text
			>
		{/each}
		{#each [0, 10, 20, 30] as d (d)}
			<text x={sxM(d)} y={440} font-size="11" class="muted" text-anchor="middle">{d}</text>
		{/each}
		<text x={920} y={458} font-size="11" class="muted" text-anchor="end">days after infection</text>
		<text x={600} y={226} font-size="11" class="muted">killer T cells (log scale)</text>
		<line
			x1={sxM(peakE.t)}
			x2={920}
			y1={syM(lgE(memoryCells))}
			y2={syM(lgE(memoryCells))}
			stroke="var(--im-memory)"
			stroke-width="2"
			stroke-dasharray="5 4"
			opacity={smoothstep(peakE.t + 3, peakE.t + 5, memDay)}
		/>
		<Label
			x={918}
			y={syM(lgE(memoryCells)) - 8}
			text="memory: 5% of the peak"
			size={11}
			anchor="end"
			color="var(--im-memory)"
			opacity={smoothstep(peakE.t + 3, peakE.t + 5, memDay)}
		/>
		<path d={ePath} fill="none" stroke="var(--im-tcell)" stroke-width="2.6" />
	{/if}

	{#if view === 'recap'}
		{@const panels = [
			{ x: 36, title: '1 · make a vast range in advance' },
			{ x: 340, title: '2 · multiply the few that fit' },
			{ x: 644, title: '3 · keep some as memory' }
		]}
		{#each panels as p, i (p.x)}
			{@const o = reduced ? 1 : smoothstep(0.6 + i * 2.2, 1.6 + i * 2.2, t)}
			<g opacity={o}>
				<rect
					x={p.x}
					y={70}
					width={280}
					height={460}
					rx="16"
					fill="var(--im-node)"
					stroke="var(--im-node-edge)"
				/>
				<text x={p.x + 140} y={104} font-size="15" font-weight="600" text-anchor="middle"
					>{p.title}</text
				>
			</g>
		{/each}
		<!-- 1: many different receptors -->
		<g opacity={reduced ? 1 : smoothstep(0.6, 1.6, t)}>
			{#each cells.slice(0, 30) as c, k (c.i)}
				{@const x = 66 + (k % 6) * 44}
				{@const y = 170 + Math.floor(k / 6) * 62}
				<circle cx={x} cy={y} r="13" fill={color(c.kind)} opacity="0.85" />
				<path d={cup(x, y + 3, c.shape)} fill="none" stroke={color(c.kind)} stroke-width="2.2" />
			{/each}
			<text x={176} y={500} font-size="12" class="muted" text-anchor="middle"
				>each cell its own receptor, made at random</text
			>
		</g>
		<!-- 2: the matching clone -->
		<g opacity={reduced ? 1 : smoothstep(2.8, 3.8, t)}>
			{#each cluster(48, 480, 300, 1.05) as c (c.k)}
				<circle cx={c.x} cy={c.y} r="9" fill="var(--im-tcell)" opacity="0.9" />
			{/each}
			<path d={fragment(480, 196)} fill="var(--im-virus)" />
			<text x={480} y={150} font-size="11" class="muted" text-anchor="middle"
				>a piece of the virus</text
			>
			<text x={480} y={480} font-size="12" text-anchor="middle"
				>100 cells that fit → {count(peakE.v)}</text
			>
			<text x={480} y={500} font-size="12" class="muted" text-anchor="middle"
				>killer T cells in a week</text
			>
		</g>
		<!-- 3: memory, and a faster, bigger second response -->
		<g opacity={reduced ? 1 : smoothstep(5, 6, t)}>
			{#each cluster(10, 784, 190, 1.2) as c (c.k)}
				<circle cx={c.x} cy={c.y} r="8" fill="var(--im-memory)" />
				<circle
					cx={c.x}
					cy={c.y}
					r="11.5"
					fill="none"
					stroke="var(--im-memory)"
					stroke-width="1.4"
				/>
			{/each}
			<line x1={664} x2={912} y1={500} y2={500} stroke="var(--stage-line)" />
			<path
				d={linePath(
					ab1,
					(p) => p.t,
					(p) => lgA(antibody(p)),
					sxR,
					syR
				)}
				fill="none"
				stroke="var(--im-antibody)"
				stroke-width="1.6"
				stroke-dasharray="4 3"
			/>
			<path
				d={linePath(
					ab2,
					(p) => p.t,
					(p) => lgA(antibody(p)),
					sxR,
					syR
				)}
				fill="none"
				stroke="var(--im-antibody)"
				stroke-width="2.6"
			/>
			<text x={664} y={318} font-size="11" class="muted">antibodies (log scale), 20 days</text>
			<Readout
				id="recap-ab"
				order={3}
				label="Antibodies at the peak: first → second infection"
				value="{count(peak(ab1, antibody).v)} → {count(peak(ab2, antibody).v)} pg/mL"
			>
				<text x={784} y={520} font-size="11" text-anchor="middle"
					><tspan class="muted">first (dashed)</tspan>
					{count(peak(ab1, antibody).v)} · second {count(peak(ab2, antibody).v)} pg/mL</text
				>
			</Readout>
		</g>
	{/if}
</g>
