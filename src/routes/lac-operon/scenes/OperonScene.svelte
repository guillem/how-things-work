<script lang="ts">
	/**
	 * A cell in its medium (../model.ts `cultureCell`): glucose and lactose outside, the glucose
	 * transporter and the LacY permeases in the membrane, and the lac operon on the DNA with the
	 * repressor LacI, CAP-cAMP and RNA polymerase. The number of permeases drawn follows the
	 * operon's output; the repressor sits on the operator or floats free with inducer bound; with
	 * glucose, EIIA-Glc docks under the permeases and blocks them; when the operon is read,
	 * polymerases run along the genes trailing mRNA.
	 *
	 * Controls `glc` and `lac` (each sugar at 2 mM). Focus (`step.hints.focus`): 'operon' (the
	 * parts named), 'loop' (the feedback loop drawn as four numbered arrows).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Label, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cultureCell, cultureSteady } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'operon'));
	const glc = $derived(params.glc === true);
	const lac = $derived(params.lac !== false);
	const cell = $derived(cultureCell(glc ? 2000 : 0, lac ? 2000 : 0));

	// Smooth changes when a sugar is switched.
	const opts = { duration: 800, easing: cubicInOut };
	const out = new Tween(0, opts);
	const bound = new Tween(1, opts);
	const block = new Tween(0, opts);
	const capOn = new Tween(1, opts);
	const loopOn = new Tween(0, opts);
	$effect(() => {
		const c = cell;
		const g = glc;
		const l = focus === 'loop' ? 1 : 0;
		untrack(() => {
			out.set(c.y);
			bound.set(c.bound);
			block.set(c.blocked);
			capOn.set(g ? 0 : 1);
			loopOn.set(l);
		});
	});

	// ---- geometry ----------------------------------------------------------------------------
	const MEM_Y = 150;
	const DNA_Y = 400;
	const SLOTS = [300, 380, 460, 540, 620, 700, 780, 860];
	const nPerm = $derived(out.current < 2 ? 1 : Math.min(8, Math.ceil((8 * out.current) / 100)));
	const permOpacity = (i: number) =>
		i < nPerm ? 1 : i === nPerm ? smoothstep(0, 1, (8 * out.current) / 100 - i + 1) : 0;

	const genes = [
		{ id: 'lacZ', x0: 290, x1: 560, color: 'var(--lo-lacz)', makes: 'β-galactosidase' },
		{ id: 'lacY', x0: 566, x1: 736, color: 'var(--lo-lacy)', makes: 'permease LacY' },
		{ id: 'lacA', x0: 742, x1: 860, color: 'var(--lo-laca)', makes: 'transacetylase' }
	];

	const hex = (r: number) =>
		Array.from({ length: 6 }, (_, k) => {
			const a = (Math.PI / 3) * k + Math.PI / 6;
			return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
		}).join(' ');
	const HEX = hex(7);

	/** Sugar molecules drifting in the medium. */
	const outside = $derived.by(() => {
		const list: { key: string; kind: 'glc' | 'lac'; x: number; y: number }[] = [];
		const tt = reduced ? 2.5 : t;
		for (let i = 0; i < 26; i++) {
			const kind = i % 2 === 0 ? 'glc' : 'lac';
			if ((kind === 'glc' && !glc) || (kind === 'lac' && !lac)) continue;
			const x = 60 + hash(i, 1) * 840 + 14 * Math.sin(tt * 0.6 + i);
			const y = 62 + hash(i, 2) * 52 + 6 * Math.cos(tt * 0.8 + 2 * i);
			list.push({ key: `o${i}`, kind, x, y });
		}
		return list;
	});

	/** Glucose streaming in through its transporter. */
	const glcIn = $derived.by(() => {
		if (!glc || reduced) return [];
		return [0, 1, 2].map((k) => {
			const u = cycle(t, 2.4, k / 3);
			return {
				key: k,
				x: 110 + 10 * Math.sin(u * 6),
				y: 100 + u * 130,
				o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.8, 1, u))
			};
		});
	});

	/** Lactose through the unblocked permeases. */
	const lacIn = $derived.by(() => {
		if (!lac || reduced) return [];
		const open = 1 - block.current;
		if (open < 0.2) return [];
		const list: { key: string; x: number; y: number; o: number }[] = [];
		for (let i = 0; i < nPerm; i++) {
			const u = cycle(t, 2.2, hash(i, 5));
			list.push({
				key: `l${i}`,
				x: SLOTS[i],
				y: 104 + u * 130,
				o: open * smoothstep(0, 0.1, u) * (1 - smoothstep(0.8, 1, u)) * permOpacity(i)
			});
		}
		return list;
	});

	// Repressor: on the operator (bound = 1) or floating above it.
	const OP_X = 258;
	const rep = $derived({
		x: OP_X + (1 - bound.current) * 20,
		y: DNA_Y - 26 - (1 - bound.current) * 92
	});
	/** Inducers carried by the released repressor. */
	const carried = $derived(bound.current < 0.5 && lac ? 2 : 0);

	// Polymerases reading the genes: as many as the output allows.
	const reading = $derived(out.current > 5);
	const polys = $derived.by(() => {
		if (!reading) return [];
		const n = out.current > 60 ? 3 : out.current > 25 ? 2 : 1;
		const tt = reduced ? 2.5 : t;
		return Array.from({ length: n }, (_, k) => {
			const u = cycle(tt, 6, k / n);
			return { key: k, x: 240 + u * 620, u };
		});
	});

	/** The classic four media, settled (each sugar at 2 mM). */
	const MEDIA = [
		{ name: 'neither sugar', glc: false, lac: false },
		{ name: 'lactose only', glc: false, lac: true },
		{ name: 'glucose only', glc: true, lac: false },
		{ name: 'glucose + lactose', glc: true, lac: true }
	].map((m) => ({ ...m, y: cultureSteady(m.glc ? 2000 : 0, m.lac ? 2000 : 0) }));

	const pct = (y: number) => (y < 10 ? y.toFixed(1) : y.toFixed(0));
	const medium = $derived(
		glc && lac ? 'glucose + lactose' : glc ? 'glucose only' : lac ? 'lactose only' : 'neither sugar'
	);
	const loopO = $derived(loopOn.current);
</script>

<g>
	<Readout id="title">
		<Label x={24} y={30} text="medium: {medium}" size={15} weight={600} anchor="start" />
	</Readout>
	<Readout
		id="output"
		order={2}
		label="Lac output"
		value="{pct(cell.y)} % of full"
		color="var(--lo-lacy)"
	>
		<Label
			x={936}
			y={30}
			text="lac output: {pct(out.current)} % of full"
			size={15}
			weight={700}
			anchor="end"
			color="var(--lo-lacy)"
			tabular
		/>
	</Readout>

	<!-- outside -->
	{#each outside as m (m.key)}
		{#if m.kind === 'glc'}
			<polygon
				points={HEX}
				transform="translate({m.x} {m.y})"
				fill="var(--lo-glucose)"
				opacity="0.85"
			/>
		{:else}
			<g transform="translate({m.x} {m.y})" opacity="0.85">
				<polygon points={HEX} transform="translate(-7 0)" fill="var(--lo-lactose)" />
				<polygon points={HEX} transform="translate(7 0)" fill="var(--lo-lactose)" />
			</g>
		{/if}
	{/each}
	<Readout id="key-sugars">
		<g transform="translate(24 58)">
			<polygon points={HEX} fill="var(--lo-glucose)" />
			<Label x={14} y={4} text="glucose" size={11} anchor="start" muted />
			<g transform="translate(0 22)">
				<polygon points={HEX} transform="translate(-4 0) scale(0.7)" fill="var(--lo-lactose)" />
				<polygon points={HEX} transform="translate(5 0) scale(0.7)" fill="var(--lo-lactose)" />
				<Label x={14} y={4} text="lactose" size={11} anchor="start" muted />
			</g>
		</g>
	</Readout>

	<!-- the cell -->
	<rect
		x={20}
		y={MEM_Y - 10}
		width={920}
		height={444}
		rx={44}
		fill="var(--cell)"
		stroke="var(--membrane)"
		stroke-width="16"
	/>
	<rect
		x={20}
		y={MEM_Y - 10}
		width={920}
		height={444}
		rx={44}
		fill="none"
		stroke="var(--membrane-edge)"
		stroke-width="1.2"
	/>

	<!-- glucose transporter and EIIA-Glc -->
	<rect
		x={96}
		y={MEM_Y - 30}
		width={28}
		height={42}
		rx={8}
		fill="var(--protein)"
		stroke="var(--protein-edge)"
	/>
	<Readout id="ptsg" order={8} label="Glucose transporter" marker={1} at={[110, MEM_Y + 40]}>
		<Label x={110} y={MEM_Y + 44} text="glucose transporter" size={11} muted />
	</Readout>
	{#each glcIn as g (g.key)}
		<polygon
			points={HEX}
			transform="translate({g.x} {g.y})"
			fill="var(--lo-glucose)"
			opacity={g.o}
		/>
	{/each}

	<!-- permeases -->
	{#each SLOTS as x, i (x)}
		{@const o = permOpacity(i)}
		{#if o > 0.01}
			<g opacity={o}>
				<rect
					x={x - 12}
					y={MEM_Y - 30}
					width={24}
					height={40}
					rx={7}
					fill="var(--lo-lacy)"
					stroke="var(--protein-edge)"
				/>
				{#if block.current > 0.05}
					<circle
						cx={x}
						cy={MEM_Y + 22}
						r={8}
						fill="var(--protein)"
						stroke="var(--lo-glucose)"
						stroke-width="2.5"
						opacity={block.current}
					/>
				{/if}
			</g>
		{/if}
	{/each}
	{#each lacIn as l (l.key)}
		<g transform="translate({l.x} {l.y}) scale(0.7)" opacity={l.o}>
			<polygon points={HEX} transform="translate(-7 0)" fill="var(--lo-lactose)" />
			<polygon points={HEX} transform="translate(7 0)" fill="var(--lo-lactose)" />
		</g>
	{/each}
	<Readout
		id="perm"
		order={3}
		label="Permeases"
		value={block.current > 0.5
			? 'blocked by glucose (inducer exclusion)'
			: nPerm <= 1
				? 'a few, from the leak'
				: 'many: the operon is on'}
	>
		<Label
			x={300 - 18}
			y={MEM_Y + 50}
			text={block.current > 0.5
				? 'LacY blocked by EIIA-Glc (inducer exclusion)'
				: nPerm <= 1
					? 'LacY: a few, from the leak'
					: 'LacY permeases'}
			size={12}
			anchor="start"
			color="var(--lo-lacy)"
			weight={600}
		/>
	</Readout>

	<!-- inducer inside -->
	{#if lac && block.current < 0.5}
		{#each [0, 1, 2, 3, 4] as k (k)}
			{@const tt = reduced ? 2.5 : t}
			<circle
				cx={420 + 280 * hash(k, 9) + 18 * Math.sin(tt * 0.9 + k)}
				cy={262 + 34 * hash(k, 11) + 10 * Math.cos(tt * 1.1 + k)}
				r={4.5}
				fill="var(--lo-inducer)"
				opacity={Math.min(1, out.current / 30)}
			/>
		{/each}
		<Readout id="allo">
			<Label
				x={720}
				y={252}
				text="allolactose (inducer)"
				size={11}
				anchor="start"
				color="var(--lo-inducer)"
				opacity={Math.min(1, out.current / 30)}
			/>
		</Readout>
	{/if}

	<!-- DNA -->
	<line x1={50} x2={900} y1={DNA_Y - 4} y2={DNA_Y - 4} stroke="var(--lo-dna)" stroke-width="2" />
	<line x1={50} x2={900} y1={DNA_Y + 4} y2={DNA_Y + 4} stroke="var(--lo-dna)" stroke-width="2" />
	<rect x={70} y={DNA_Y - 9} width={64} height={18} rx={4} fill="var(--lo-cap)" opacity="0.25" />
	<rect x={140} y={DNA_Y - 9} width={92} height={18} rx={4} fill="var(--lo-rnap)" opacity="0.2" />
	<rect
		x={236}
		y={DNA_Y - 9}
		width={46}
		height={18}
		rx={4}
		fill="var(--lo-repressor)"
		opacity="0.25"
	/>
	{#each genes as g (g.id)}
		<rect
			x={g.x0}
			y={DNA_Y - 11}
			width={g.x1 - g.x0}
			height={22}
			rx={5}
			fill={g.color}
			opacity="0.85"
		/>
		<Label
			x={(g.x0 + g.x1) / 2}
			y={DNA_Y + 5}
			text={g.id}
			size={13}
			weight={700}
			italic
			halo={false}
			color="var(--stage-bg)"
		/>
		<Readout id="gene-{g.id}">
			<Label x={(g.x0 + g.x1) / 2} y={DNA_Y + 32} text={g.makes} size={11} muted />
		</Readout>
	{/each}
	<Readout id="sites">
		<Label x={102} y={DNA_Y + 32} text="CAP site" size={11} muted />
		<Label x={186} y={DNA_Y + 32} text="promoter" size={11} muted />
		<Label x={259} y={DNA_Y + 50} text="operator" size={11} muted />
	</Readout>

	<!-- CAP-cAMP -->
	<g
		transform="translate({102} {DNA_Y - 24 - (1 - capOn.current) * 70})"
		opacity={0.45 + 0.55 * capOn.current}
	>
		<ellipse rx={20} ry={12} fill="var(--lo-cap)" />
		<circle
			cx={14}
			cy={-10}
			r={5}
			fill="var(--surface)"
			stroke="var(--lo-cap)"
			stroke-width="2"
			opacity={capOn.current}
		/>
	</g>
	<Readout
		id="cap"
		order={4}
		label="CAP-cAMP"
		value={glc ? 'less cAMP: CAP mostly off its site' : 'on its site, helping polymerase'}
		color="var(--lo-cap)"
	>
		<Label
			x={88}
			y={DNA_Y - 44 - (1 - capOn.current) * 70}
			text={glc ? 'CAP (little cAMP)' : 'CAP-cAMP'}
			size={11}
			color="var(--lo-cap)"
			weight={600}
		/>
	</Readout>

	<!-- RNA polymerase at the promoter -->
	<ellipse cx={190} cy={DNA_Y - 22} rx={26} ry={16} fill="var(--lo-rnap)" opacity="0.9" />
	<Readout id="rnap" order={9} label="RNA polymerase" marker={2} at={[190, DNA_Y - 62]}>
		<Label x={200} y={DNA_Y - 62} text="RNA polymerase" size={11} muted />
	</Readout>
	{#each polys as p (p.key)}
		{@const o = smoothstep(0, 0.06, p.u) * (1 - smoothstep(0.94, 1, p.u))}
		<path
			d="M{p.x} {DNA_Y - 30} q -20 -18 -40 -6 t -40 -8"
			fill="none"
			stroke="var(--lo-rnap)"
			stroke-width="2"
			opacity={o * 0.8}
		/>
		<ellipse cx={p.x} cy={DNA_Y - 20} rx={16} ry={12} fill="var(--lo-rnap)" opacity={o} />
	{/each}

	<!-- repressor -->
	<g transform="translate({rep.x} {rep.y})">
		{#each [[-8, -8], [8, -8], [-8, 8], [8, 8]] as d, i (i)}
			<circle cx={d[0]} cy={d[1]} r={9} fill="var(--lo-repressor)" stroke="var(--stage-bg)" />
		{/each}
		{#each Array.from({ length: carried }, (_, i) => i) as i (i)}
			<circle cx={-17 + 34 * i} cy={-15} r={4.5} fill="var(--lo-inducer)" />
		{/each}
	</g>
	<Readout
		id="rep"
		order={5}
		label="Repressor LacI"
		value={bound.current > 0.5
			? 'on the operator: blocks reading'
			: 'off the operator, holding inducer'}
		color="var(--lo-repressor)"
	>
		<Label
			x={rep.x + 26}
			y={rep.y - 18}
			text={bound.current > 0.5 ? 'LacI on the operator' : 'LacI let go'}
			size={12}
			anchor="start"
			color="var(--lo-repressor)"
			weight={600}
		/>
	</Readout>

	<!-- the four media, side by side (operon focus) -->
	{#if loopO < 0.98}
		<Readout id="table">
			<g opacity={1 - loopO}>
				<Label
					x={60}
					y={470}
					text="lac output in each medium (2 mM of each sugar)"
					size={12}
					anchor="start"
					muted
				/>
				{#each MEDIA as m, i (m.name)}
					{@const current = m.glc === glc && m.lac === lac}
					{@const yy = 492 + i * 22}
					<Label
						x={60}
						y={yy + 4}
						text={m.name}
						size={12}
						anchor="start"
						weight={current ? 700 : 500}
						muted={!current}
					/>
					<rect x={200} y={yy - 7} width={260} height={12} rx={3} fill="var(--stage-grid)" />
					<rect
						x={200}
						y={yy - 7}
						width={Math.max(2, (260 * m.y) / 100)}
						height={12}
						rx={3}
						fill="var(--lo-lacy)"
						opacity={current ? 1 : 0.45}
					/>
					<Label
						x={472}
						y={yy + 4}
						text="{pct(m.y)} %"
						size={12}
						anchor="start"
						weight={current ? 700 : 500}
						muted={!current}
						tabular
					/>
				{/each}
			</g>
		</Readout>
	{/if}

	<!-- the feedback loop -->
	{#if loopO > 0.02}
		<g opacity={loopO}>
			<path
				d="M650 {DNA_Y - 16} C 660 300, 640 230, 622 {MEM_Y + 16}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.2"
				marker-end="url(#arrowhead)"
			/>
			<path
				d="M560 {MEM_Y + 14} C 540 220, 500 250, 470 270"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.2"
				marker-end="url(#arrowhead)"
			/>
			<path
				d="M420 280 C 380 290, 340 300, {OP_X + 30} {DNA_Y - 70}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.2"
				marker-end="url(#arrowhead)"
			/>
			<path
				d="M{OP_X + 10} {DNA_Y + 60} C 360 470, 560 470, 640 {DNA_Y + 20}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.2"
				marker-end="url(#arrowhead)"
			/>
		</g>
		<Readout id="l1" order={10} label="1" value="lacY is read: more permease" opacity={loopO}>
			<Label
				x={668}
				y={300}
				text="① more permease"
				size={12}
				anchor="start"
				weight={600}
				pill
				opacity={loopO}
			/>
		</Readout>
		<Readout id="l2" order={11} label="2" value="more lactose in, more allolactose" opacity={loopO}>
			<Label
				x={540}
				y={228}
				text="② more lactose in"
				size={12}
				anchor="start"
				weight={600}
				pill
				opacity={loopO}
			/>
		</Readout>
		<Readout id="l3" order={12} label="3" value="inducer pulls the repressor off" opacity={loopO}>
			<Label
				x={392}
				y={350}
				text="③ repressor let go"
				size={12}
				anchor="start"
				weight={600}
				pill
				opacity={loopO}
			/>
		</Readout>
		<Readout id="l4" order={13} label="4" value="the genes are read more" opacity={loopO}>
			<Label x={460} y={500} text="④ genes read more" size={12} weight={600} pill opacity={loopO} />
		</Readout>
	{/if}
</g>
