<script lang="ts">
	/**
	 * Steps "display" and "expand".
	 *
	 * "display": left, the edge of a cell that made spikes: whole spikes stick
	 * out of it, and MHC molecules hold up spike fragments. A B cell grabs a
	 * free spike with its receptors; a killer T cell docks on a fragment. Right,
	 * a lymph node: a dendritic cell shows fragments to a crowd of naive T and B
	 * cells with receptors of all shapes; only the few that fit light up.
	 *
	 * "expand": a matching cell divides 1 → 2 → 4 → … (a pure function of t),
	 * beside the numbers of the model after one dose (`simulate`, the
	 * immune-system model met by the vaccine's antigen).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { TAU, cycle, hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Tag from './Tag.svelte';
	import { count } from '../../immune-system/run';
	import { CAO, MEMORY } from '../../immune-system/model';
	import { antibody, effectors, peak, simulate } from '../model';

	let { step, t, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'display'));
	const time = $derived(reduced ? 2.5 : t);

	const mix = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = view === 'expand' ? 1 : 0;
		untrack(() => mix.set(v, { duration: reduced ? 0 : 800 }));
	});

	// ---- display -----------------------------------------------------------------
	/** The cell's edge: a big arc on the left. */
	const CELL = { x: -260, y: 300, r: 470 };
	const onEdge = (a: number) => ({
		x: CELL.x + Math.cos(a) * CELL.r,
		y: CELL.y + Math.sin(a) * CELL.r,
		a
	});
	const SPIKES = [-0.5, -0.3, -0.1, 0.15, 0.32, 0.52].map((a, i) => ({ k: i, ...onEdge(a) }));
	const MHC = [-0.4, 0.05, 0.42].map((a, i) => ({ k: i, ...onEdge(a) }));

	const grab = $derived(reduced ? 1 : smoothstep(0.1, 0.5, cycle(time, 8)));
	const BCELL = { x: 330, y: 150 };
	const freeSpike = $derived({
		x: lerp(250, BCELL.x - 46, grab),
		y: lerp(250, BCELL.y + 4, grab)
	});
	const dock = $derived(reduced ? 1 : smoothstep(0.3, 0.7, cycle(time, 8, 0.4)));
	const TCELL = $derived({ x: lerp(380, MHC[1].x + 58, dock), y: lerp(380, MHC[1].y + 2, dock) });

	const NODE = { x: 735, y: 320, rx: 205, ry: 230 };
	const DC = { x: 640, y: 320 };
	/**
	 * Naive lymphocytes in the node, each with its own receptor shape. Three T
	 * cells fit the fragments the dendritic cell shows; one B cell fits a whole
	 * spike that drained in with the lymph (B cells see intact antigen).
	 */
	const CROWD = Array.from({ length: 16 }, (_, i) => {
		const a = (i / 16) * TAU;
		return {
			k: i,
			x: 740 + Math.cos(a) * (110 + 40 * hash(i, 2)),
			y: 320 + Math.sin(a) * (150 + 30 * hash(i, 3)),
			shape: Math.floor(hash(i, 4) * 4),
			fit: i === 2 || i === 3 || i === 9 || i === 13,
			holds: i === 2,
			b: i % 2 === 0
		};
	});
	const glow = $derived(0.5 + 0.5 * Math.sin(time * 3));

	// ---- expand: the model after one dose ----------------------------------------------
	const run = simulate({ doses: [0], infectAt: null, days: 40 });
	const eMax = peak(run, effectors);
	const firstAb = run.find((s) => antibody(s) > 1)?.t ?? 0;
	const memT = MEMORY.share * eMax.v;
	const gen = $derived(reduced ? 5 : Math.min(5, Math.floor(time / 1.6)));
	const growth = $derived(reduced ? 1 : smoothstep(0, 1.2, time - gen * 1.6));
	/** Cells of generation g laid out in a binary tree. */
	const tree = $derived.by(() => {
		const out: { id: string; x: number; y: number; px: number; py: number; o: number }[] = [];
		for (let g = 0; g <= gen; g++) {
			const n = 2 ** g;
			for (let i = 0; i < n; i++) {
				const x = 70 + g * 70;
				const span = 470;
				const y = 70 + ((i + 0.5) / n) * span;
				const py = 70 + ((Math.floor(i / 2) + 0.5) / (n / 2)) * span;
				const o = g < gen ? 1 : growth;
				out.push({ id: `${g}-${i}`, x, y, px: x - 70, py: g === 0 ? y : py, o });
			}
		}
		return out;
	});
</script>

<g>
	<!-- ===================================================== display ===== -->
	<g opacity={1 - mix.current}>
		<circle
			cx={CELL.x}
			cy={CELL.y}
			r={CELL.r}
			fill="var(--cell)"
			stroke="var(--membrane-edge)"
			stroke-width="3"
		/>
		{#each SPIKES as s (s.k)}
			<g transform="translate({s.x} {s.y}) rotate({(s.a * 180) / Math.PI})">
				<path d="M0 0 L16 0" stroke="var(--mv-s2)" stroke-width="6" stroke-linecap="round" />
				<circle cx="24" r="9" fill="var(--mv-s1)" />
			</g>
		{/each}
		{#each MHC as m (m.k)}
			<g transform="translate({m.x} {m.y}) rotate({(m.a * 180) / Math.PI})">
				<path d="M0 -9 L14 -9 L14 -4 L6 -4 L6 4 L14 4 L14 9 L0 9 Z" fill="var(--im-node-edge)" />
				<rect x="8" y="-3" width="10" height="6" rx="2" fill="var(--mv-spike)" />
			</g>
		{/each}
		<Readout
			opacity={1 - mix.current}
			id="cell"
			order={1}
			label="A cell that made spikes"
			value="whole spikes on its surface, and fragments held up on MHC molecules"
		>
			<Tag x={24} y={282} text="a cell that read" size={13} weight={600} anchor="start" />
			<Tag x={24} y={300} text="the vaccine" size={13} weight={600} anchor="start" />
			<Tag x={24} y={330} text="whole spikes," size={11} anchor="start" muted />
			<Tag x={24} y={346} text="fragments on MHC" size={11} anchor="start" muted />
		</Readout>

		<!-- a free spike and the B cell that grabs it -->
		<g transform="translate({freeSpike.x} {freeSpike.y}) rotate(180)">
			<path d="M0 0 L16 0" stroke="var(--mv-s2)" stroke-width="6" stroke-linecap="round" />
			<circle cx="24" r="9" fill="var(--mv-s1)" />
		</g>
		<circle cx={BCELL.x} cy={BCELL.y} r="34" fill="var(--im-bcell)" opacity="0.85" />
		{#each [0, 1, 2, 3, 4, 5] as j (j)}
			{@const a = Math.PI + (j - 2.5) * 0.45}
			<g
				transform="translate({BCELL.x + Math.cos(a) * 34} {BCELL.y + Math.sin(a) * 34}) rotate({(a *
					180) /
					Math.PI})"
			>
				<path
					d="M0 0 L8 0 M8 0 L14 -5 M8 0 L14 5"
					stroke="var(--im-bcell)"
					stroke-width="2.5"
					stroke-linecap="round"
					fill="none"
				/>
			</g>
		{/each}
		<Readout
			opacity={1 - mix.current}
			id="bcell"
			order={2}
			label="B cell"
			value="its receptor fits the spike's shape: it grabs a whole spike"
			color="var(--im-bcell)"
		>
			<Tag
				x={BCELL.x + 44}
				y={BCELL.y - 8}
				text="B cell: grabs a whole spike"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>

		<!-- the killer T cell docking on a fragment -->
		<circle cx={TCELL.x} cy={TCELL.y} r="30" fill="var(--im-tcell)" opacity="0.85" />
		<rect x={TCELL.x - 40} y={TCELL.y - 5} width="12" height="10" rx="2" fill="var(--im-tcell)" />
		<Readout
			opacity={1 - mix.current}
			id="tcell"
			order={3}
			label="Killer T cell"
			value="its receptor fits one fragment held up on MHC"
			color="var(--im-tcell)"
		>
			<Tag
				x={235}
				y={450}
				text="killer T cell: fits a fragment on MHC"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>

		<!-- the lymph node -->
		<ellipse
			cx={NODE.x}
			cy={NODE.y}
			rx={NODE.rx}
			ry={NODE.ry}
			fill="var(--im-node)"
			stroke="var(--im-node-edge)"
			stroke-width="1.5"
		/>
		<g transform="translate({DC.x} {DC.y})">
			{#each [0, 1, 2, 3, 4, 5, 6] as j (j)}
				<path
					d="M0 0 L{Math.cos((j * TAU) / 7) * 40} {Math.sin((j * TAU) / 7) * 36}"
					stroke="var(--mv-ribosome)"
					stroke-width="8"
					stroke-linecap="round"
					opacity="0.65"
				/>
			{/each}
			<circle r="20" fill="var(--mv-ribosome)" />
			{#each [0, 1, 2] as j (j)}
				<rect
					x={-5 + Math.cos(j * 2.1) * 28}
					y={-3 + Math.sin(j * 2.1) * 26}
					width="10"
					height="6"
					rx="2"
					fill="var(--mv-spike)"
				/>
			{/each}
		</g>
		{#each CROWD as c (c.k)}
			{@const col = c.b ? 'var(--im-bcell)' : 'var(--im-tcell)'}
			<g opacity={c.fit ? 1 : 0.4}>
				{#if c.fit}
					<circle
						cx={c.x}
						cy={c.y}
						r={20 + glow * 5}
						fill="none"
						stroke="var(--mv-spike)"
						stroke-width="2"
					/>
				{/if}
				<circle cx={c.x} cy={c.y} r="14" fill={col} />
				{#if c.holds}
					<g transform="translate({c.x - 18} {c.y}) rotate(180)">
						<path d="M0 0 L10 0" stroke="var(--mv-s2)" stroke-width="4" stroke-linecap="round" />
						<circle cx="15" r="6" fill="var(--mv-s1)" />
					</g>
				{:else if c.shape === 0}
					<rect x={c.x - 20} y={c.y - 3} width="7" height="6" fill={col} />
				{:else if c.shape === 1}
					<circle cx={c.x - 17} cy={c.y} r="4" fill={col} />
				{:else if c.shape === 2}
					<path d="M{c.x - 14} {c.y} l -7 -5 l 0 10 Z" fill={col} />
				{:else}
					<path
						d="M{c.x - 14} {c.y - 4} l -6 0 l 0 8 l 6 0"
						stroke={col}
						stroke-width="2"
						fill="none"
					/>
				{/if}
			</g>
		{/each}
		<Readout
			opacity={1 - mix.current}
			id="node"
			order={4}
			label="In the lymph node"
			value="a dendritic cell shows spike fragments to T cells; B cells catch whole spikes that drain in; only the few that fit are switched on"
		>
			<Tag x={NODE.x} y={NODE.y - NODE.ry + 30} text="lymph node" size={13} weight={600} />
			<Tag x={DC.x} y={DC.y + 62} text="dendritic cell" size={11} pill />
			<Tag
				x={NODE.x}
				y={NODE.y + NODE.ry - 18}
				text="only the few that fit switch on (ringed)"
				size={11}
				muted
			/>
		</Readout>
	</g>

	<!-- ===================================================== expand ===== -->
	<g opacity={mix.current}>
		{#each tree as c (c.id)}
			{#if c.px > 0}
				<line
					x1={c.px + 10}
					y1={c.py}
					x2={c.x - 10}
					y2={c.y}
					stroke="var(--stage-line)"
					opacity={c.o}
				/>
			{/if}
			<circle
				cx={c.x}
				cy={c.y}
				r={Math.max(3, 12 - (c.x - 70) / 40)}
				fill="var(--im-tcell)"
				opacity={c.o}
			/>
		{/each}
		<Readout
			opacity={mix.current}
			id="gen"
			order={1}
			label="Dividing"
			value="1 → {2 ** gen} cells after {gen} divisions"
		>
			<Tag
				x={70}
				y={40}
				text="one matching T cell: 1 → {2 ** gen} after {gen} divisions"
				size={13}
				weight={600}
				anchor="start"
			/>
		</Readout>

		<rect
			x={520}
			y={110}
			width={400}
			height={380}
			rx="14"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<text x={540} y={142} style:font-size="15px" font-weight="600"
			>after one dose, in the model</text
		>
		{#each [{ id: 'naive', label: 'matching naive T cells', value: `${CAO.Cn0}`, c: 'var(--stage-ink-muted)' }, { id: 'peak', label: `killer T cells at the peak, day ${Math.round(eMax.t)}`, value: count(eMax.v), c: 'var(--im-tcell)' }, { id: 'ab', label: 'antibodies from', value: `day ${Math.round(firstAb)}`, c: 'var(--im-antibody)' }, { id: 'mem', label: 'memory T cells left (5% of the peak)', value: count(memT), c: 'var(--im-memory)' }, { id: 'virus', label: 'virus, infected cells', value: 'none', c: 'var(--im-virus)' }] as r, i (r.id)}
			<Readout
				opacity={mix.current}
				id="m-{r.id}"
				order={2 + i}
				label={r.label}
				value={r.value}
				color={r.c}
			>
				<circle cx={548} cy={186 + i * 60} r="6" fill={r.c} />
				<text x={562} y={191 + i * 60} style:font-size="13px">{r.label}</text>
				<text
					x={900}
					y={191 + i * 60}
					style:font-size="16px"
					font-weight="700"
					text-anchor="end"
					style:fill={r.c}>{r.value}</text
				>
			</Readout>
		{/each}
	</g>
</g>
