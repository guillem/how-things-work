<script lang="ts">
	/**
	 * A π system and its Hückel orbitals. Left: the molecule with the selected orbital's lobes
	 * (and the bond orders); below it, depending on the step, the Hückel matrix with the selected
	 * eigenvector, benzene's two Kekulé drawings, the ring-closure comparison, or chips of named
	 * molecules. Right: the energy ladder (Frost's circle for rings) with the electrons; clicking
	 * a level selects its orbital. Bottom right: the π energy, the delocalisation and the shell.
	 *
	 * The molecule comes from `hints.mol` (a named one), or from the step's controls:
	 * `source: 'chain'` (chainN, neutral), `'ring'` (ringN, ringCharge) or `'build'` (atoms,
	 * closed, charge). The selected orbital lives in `params['mo:<step id>']` as
	 * `<molecule key>:<index>`, so it falls back to the HOMO when the molecule changes.
	 */
	import { Label, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PRESETS, presetFor, ringClosure, solve, type Molecule } from '../huckel';
	import Ladder from './Ladder.svelte';
	import OrbitalView from './OrbitalView.svelte';
	import { energyText, formula, layout, levelText, onKey, shellText } from './look';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const hint = (k: string) => step.hints?.[k];
	const num = (k: string, d: number) => {
		const v = Number(params[k]);
		return Number.isFinite(v) ? v : d;
	};

	const mol = $derived.by((): Molecule => {
		const named = PRESETS.find((p) => p.id === hint('mol'));
		if (named) return named;
		const src = hint('source');
		if (src === 'chain') {
			const n = num('chainN', 6);
			return { n, ring: false, electrons: n };
		}
		if (src === 'ring') {
			const n = num('ringN', 5);
			return { n, ring: true, electrons: clamp(n - num('ringCharge', -1), 0, 2 * n) };
		}
		const n = num('atoms', 6);
		return {
			n,
			ring: params.closed !== false && n >= 3,
			electrons: clamp(n - num('charge', 0), 0, 2 * n)
		};
	});
	const sol = $derived(solve(mol));
	const key = $derived(`${mol.n}${mol.ring ? 'r' : 'c'}${mol.electrons}`);
	const paramKey = $derived(`mo:${step.id}`);
	const selected = $derived.by(() => {
		const saved = String(params[paramKey] ?? '');
		const [k, i] = saved.split(':');
		const idx = Number(i);
		if (k === key && Number.isInteger(idx) && idx >= 0 && idx < mol.n) return idx;
		return Math.max(0, sol.homo);
	});
	const select = (k: number) => setParam(paramKey, `${key}:${k}`);
	const orb = $derived(sol.orbitals[selected]);

	// ---- layout
	const panel = $derived(
		hint('matrix') === true
			? 'matrix'
			: hint('kekule') === true
				? 'kekule'
				: hint('closure') === true
					? 'closure'
					: hint('chips')
						? 'chips'
						: null
	);
	const box = $derived(panel ? { cy: 246, h: 226 } : { cy: 300, h: 380 });
	// ---- building by clicking (the free-build step)
	const editing = $derived(hint('source') === 'build');
	/** A chain being built leaves room for the next carbon (the "+" drawn at its place). */
	const roomForNext = $derived(editing && !mol.ring && mol.n < 12);
	const full = $derived(layout(roomForNext ? mol.n + 1 : mol.n, mol.ring, 285, box.cy, 420, box.h));
	const geo = $derived({ pts: full.pts.slice(0, mol.n), L: full.L });
	const pulse = $derived(reduced ? 1 : 1 + 0.035 * Math.sin((2 * Math.PI * t) / 2.6));
	const last = $derived(geo.pts[geo.pts.length - 1]);
	const ghost = $derived(full.pts[full.pts.length - 1]);
	/** A dashed arc under the chain from its last atom back to its first. */
	const closeLink = $derived.by(() => {
		const a = geo.pts[0];
		const b = last;
		const dip = Math.max(a.y, b.y) + 1.4 * geo.L;
		return `M${b.x} ${b.y} C${b.x} ${dip}, ${a.x} ${dip}, ${a.x} ${a.y}`;
	});

	// ---- titles
	const preset = $derived(presetFor(mol));
	const title = $derived(
		preset
			? `${preset.name} · ${preset.formula}`
			: `${mol.n}-carbon ${mol.ring ? 'ring' : 'chain'} · ${formula(mol)}`
	);
	const orbLine = $derived(
		`orbital ${selected + 1}: ${levelText(orb.x)} · ${orb.nodes} nodal plane${orb.nodes === 1 ? '' : 's'}` +
			(orb.occ ? ` · ${orb.occ} electron${orb.occ === 1 ? '' : 's'}` : ' · empty')
	);
	const shell = $derived(shellText(sol));

	// ---- matrix (small molecules)
	const MX = 64;
	const MY = 420;
	const cell = 40;
	const n = $derived(mol.n);
	const vx = $derived(MX + n * cell + 52);
	const isBond = (i: number, j: number) =>
		sol.bonds.some(([a, b]) => (a === i && b === j) || (a === j && b === i));

	// ---- ring closure
	const closure = $derived(mol.ring ? ringClosure(mol.n, mol.electrons) : 0);
	const chainE = $derived(solve({ ...mol, ring: false }).energy);

	const showClosure = $derived(mol.ring && panel === 'chips');
	const y0 = $derived(showClosure ? 506 : 528);
	const closureText = $derived(
		Math.abs(closure) < 5e-4
			? 'the same'
			: `${closure < 0 ? 'higher' : 'lower'} by ${Math.abs(closure).toFixed(3)}|β|`
	);

	// ---- chips
	const chipSet = $derived(
		hint('chips') === 'rings'
			? PRESETS.filter((p) => p.ring)
			: PRESETS.filter((p) =>
					[
						'ethene',
						'allyl',
						'butadiene',
						'hexatriene',
						'cyclobutadiene',
						'cyclopentadienyl-anion',
						'benzene',
						'tropylium',
						'cyclooctatetraene'
					].includes(p.id)
				)
	);
	const chips = $derived(
		chipSet.map((p, i) => {
			const perRow = 4;
			return { p, x: 28 + (i % perRow) * 122, y: 452 + Math.floor(i / perRow) * 40 };
		})
	);
	function choose(p: (typeof PRESETS)[number]) {
		if (hint('chips') === 'rings') {
			setParam('ringN', p.n);
			setParam('ringCharge', p.n - p.electrons);
		} else {
			setParam('atoms', p.n);
			setParam('closed', p.ring);
			setParam('charge', p.n - p.electrons);
		}
	}
	const kekule = (cx: number, cy: number, shift: number) => {
		const pts = layout(6, true, cx, cy, 70, 70).pts;
		return pts.map((p, j) => {
			const q = pts[(j + 1) % 6];
			const dbl = (j + shift) % 2 === 0;
			// inner second line for a double bond
			const ix = (cx - (p.x + q.x) / 2) * 0.22;
			const iy = (cy - (p.y + q.y) / 2) * 0.22;
			return { j, p, q, dbl, ix, iy };
		});
	};
</script>

<g>
	<!-- titles -->
	<Readout id="title" order={0} label="Molecule" value={title}>
		<Label x={24} y={38} text={title} size={16} weight={700} anchor="start" />
	</Readout>
	<Readout
		id="orbital"
		order={1}
		label="Orbital {selected + 1}"
		value="{levelText(orb.x)}, {orb.nodes} nodal plane{orb.nodes === 1 ? '' : 's'}"
		color="var(--hk-electron)"
	>
		<Label
			x={24}
			y={62}
			text={orbLine}
			size={13}
			anchor="start"
			color="var(--hk-electron)"
			weight={600}
		/>
	</Readout>
	<Readout id="hint">
		<Label
			x={24}
			y={82}
			text={editing
				? `${mol.electrons} π electrons · click + to add a carbon, an end atom to remove it, the dashed arc to close the ring, a bond to open it`
				: `${mol.electrons} π electrons · click a level on the ladder to draw its orbital`}
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- molecule -->
	<g data-testid="molecule">
		<OrbitalView
			{sol}
			pts={geo.pts}
			L={geo.L}
			orbital={selected}
			{pulse}
			orders={hint('orders') === true}
			numbers={panel === 'matrix'}
		/>
		{#if editing}
			{#if !mol.ring}
				{#if mol.n < 12}
					<line
						x1={last.x}
						y1={last.y}
						x2={ghost.x}
						y2={ghost.y}
						stroke="var(--stage-ink-muted)"
						stroke-width="2"
						stroke-dasharray="3 4"
					/>
					<g
						class="chip ghost"
						role="button"
						tabindex="0"
						aria-label="Add a carbon at the end of the chain"
						onclick={() => setParam('atoms', mol.n + 1)}
						onkeydown={(e) => onKey(e, () => setParam('atoms', mol.n + 1))}
					>
						<circle
							cx={ghost.x}
							cy={ghost.y}
							r="12"
							fill="var(--surface)"
							stroke="var(--hk-electron)"
							stroke-width="1.6"
							stroke-dasharray="3 2"
						/>
						<text
							x={ghost.x}
							y={ghost.y + 5}
							text-anchor="middle"
							font-size="16"
							font-weight="700"
							fill="var(--hk-electron)">+</text
						>
					</g>
				{/if}
				{#if mol.n > 2}
					<g
						class="chip"
						role="button"
						tabindex="0"
						aria-label="Take the end carbon off"
						onclick={() => setParam('atoms', mol.n - 1)}
						onkeydown={(e) => onKey(e, () => setParam('atoms', mol.n - 1))}
					>
						<circle cx={last.x} cy={last.y} r="11" fill="transparent" />
					</g>
				{/if}
				{#if mol.n >= 3}
					<g
						class="chip"
						role="button"
						tabindex="0"
						aria-label="Close the chain into a ring"
						onclick={() => setParam('closed', true)}
						onkeydown={(e) => onKey(e, () => setParam('closed', true))}
					>
						<path d={closeLink} fill="none" stroke="transparent" stroke-width="14" />
						<path
							d={closeLink}
							fill="none"
							stroke="var(--hk-electron)"
							stroke-width="1.6"
							stroke-dasharray="5 5"
							opacity="0.7"
						/>
					</g>
				{/if}
			{:else}
				{#each sol.bonds as [i, j], b (b)}
					<g
						class="chip"
						role="button"
						tabindex="0"
						aria-label="Open the ring at bond {b + 1}"
						onclick={() => setParam('closed', false)}
						onkeydown={(e) => onKey(e, () => setParam('closed', false))}
					>
						<line
							x1={geo.pts[i].x}
							y1={geo.pts[i].y}
							x2={geo.pts[j].x}
							y2={geo.pts[j].y}
							stroke="transparent"
							stroke-width="12"
						/>
					</g>
				{/each}
			{/if}
		{/if}
	</g>

	<!-- legend of the lobes -->
	<Readout id="legend">
		<g transform="translate(400 {panel ? 104 : 108})">
			<circle cx="0" cy="0" r="6" fill="var(--hk-pos)" fill-opacity="0.42" stroke="var(--hk-pos)" />
			<Label x={10} y={4} text="+" size={12} anchor="start" />
			<circle
				cx="34"
				cy="0"
				r="6"
				fill="var(--hk-neg)"
				fill-opacity="0.42"
				stroke="var(--hk-neg)"
			/>
			<Label x={44} y={4} text="−" size={12} anchor="start" />
			<line
				x1="66"
				x2="84"
				y1="0"
				y2="0"
				stroke="var(--hk-node)"
				stroke-width="1.6"
				stroke-dasharray="4 3"
			/>
			<Label x={90} y={4} text="node" size={11} anchor="start" muted />
		</g>
	</Readout>

	<!-- bottom-left panel -->
	{#if panel === 'matrix'}
		<g data-testid="matrix">
			<Readout id="matrix-title">
				<Label x={24} y={MY - 22} text="Hückel matrix H" size={12} weight={600} anchor="start" />
			</Readout>
			<path
				d="M{MX + 6} {MY - 4} h-6 v{n * cell + 8} h6 M{MX + n * cell - 6} {MY - 4} h6 v{n * cell +
					8} h-6"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.4"
			/>
			{#each Array.from({ length: n }, (_, i) => i) as i (i)}
				{#each Array.from({ length: n }, (_, j) => j) as j (j)}
					{@const v = i === j ? 'α' : isBond(i, j) ? 'β' : '0'}
					<text
						x={MX + j * cell + cell / 2}
						y={MY + i * cell + cell / 2 + 5}
						text-anchor="middle"
						font-size="15"
						font-weight={v === '0' ? 400 : 700}
						fill={v === 'β'
							? 'var(--hk-electron)'
							: v === '0'
								? 'var(--stage-ink-muted)'
								: 'var(--stage-ink)'}
						font-style="italic">{v}</text
					>
				{/each}
			{/each}
			<Label x={vx - 26} y={MY + (n * cell) / 2 + 5} text="·" size={20} />
			<path
				d="M{vx + 6} {MY - 4} h-6 v{n * cell + 8} h6 M{vx + 60} {MY - 4} h6 v{n * cell + 8} h-6"
				fill="none"
				stroke="var(--hk-electron)"
				stroke-width="1.4"
			/>
			{#each orb.c as c, i (i)}
				<text
					x={vx + 33}
					y={MY + i * cell + cell / 2 + 5}
					text-anchor="middle"
					font-size="13"
					fill="var(--hk-electron)"
					class="tab">{(Math.abs(c) < 5e-4 ? 0 : c).toFixed(3).replace('-', '−')}</text
				>
			{/each}
			<Readout id="matrix-eq">
				<Label
					x={vx + 82}
					y={MY + (n * cell) / 2 + 5}
					text="= ({levelText(orb.x)}) ·"
					size={13}
					anchor="start"
					color="var(--hk-electron)"
				/>
				<Label
					x={vx + 82}
					y={MY + (n * cell) / 2 + 25}
					text="the same column"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		</g>
	{:else if panel === 'kekule'}
		<g data-testid="kekule">
			{#each [0, 1] as k (k)}
				{@const cx = 80 + k * 130}
				{#each kekule(cx, 480, k) as b (b.j)}
					<line
						x1={b.p.x}
						y1={b.p.y}
						x2={b.q.x}
						y2={b.q.y}
						stroke="var(--stage-ink-muted)"
						stroke-width="1.6"
					/>
					{#if b.dbl}
						<line
							x1={b.p.x + b.ix + (b.q.x - b.p.x) * 0.15}
							y1={b.p.y + b.iy + (b.q.y - b.p.y) * 0.15}
							x2={b.q.x + b.ix - (b.q.x - b.p.x) * 0.15}
							y2={b.q.y + b.iy - (b.q.y - b.p.y) * 0.15}
							stroke="var(--stage-ink-muted)"
							stroke-width="1.6"
						/>
					{/if}
				{/each}
			{/each}
			<Label x={145} y={485} text="or" size={20} muted />
			<Readout id="kekule-note">
				<Label x={290} y={466} text="Two Kekulé drawings:" size={12} weight={600} anchor="start" />
				<Label x={290} y={484} text="a way of writing it, not two" size={12} anchor="start" />
				<Label x={290} y={502} text="structures it flips between." size={12} anchor="start" />
				<Label
					x={290}
					y={526}
					text="Above: all six bonds 0.667."
					size={12}
					anchor="start"
					weight={600}
				/>
			</Readout>
		</g>
	{:else if panel === 'closure'}
		<g data-testid="closure">
			<Readout
				id="closure"
				order={5}
				label="Closing the ring"
				value="{closure < 0 ? 'costs' : 'gains'} {Math.abs(closure).toFixed(3)}|β|"
			>
				<Label
					x={24}
					y={450}
					text="Same atoms and electrons, as an open chain:"
					size={12}
					anchor="start"
					weight={600}
				/>
				<Label
					x={24}
					y={472}
					text="chain  {energyText(mol.electrons, chainE)}"
					size={13}
					anchor="start"
					tabular
				/>
				<Label
					x={24}
					y={494}
					text="ring    {energyText(mol.electrons, sol.energy)}"
					size={13}
					anchor="start"
					tabular
				/>
				<Label
					x={24}
					y={522}
					text="closing the ring {closure < 0 ? 'raises' : 'lowers'} the π energy by {Math.abs(
						closure
					).toFixed(3)}|β|"
					size={13}
					weight={700}
					anchor="start"
					color={closure < 0 ? 'var(--hk-warn)' : 'var(--hk-good)'}
				/>
			</Readout>
		</g>
	{:else if panel === 'chips'}
		<Readout id="chips-title">
			<Label x={24} y={436} text="Named molecules" size={12} weight={600} anchor="start" />
		</Readout>
		{#each chips as c (c.p.id)}
			{@const on = preset?.id === c.p.id}
			<g
				class="chip"
				role="button"
				tabindex="0"
				aria-label="Build {c.p.name}"
				aria-pressed={on}
				onclick={() => choose(c.p)}
				onkeydown={(e) => onKey(e, () => choose(c.p))}
			>
				<rect
					x={c.x}
					y={c.y}
					width="112"
					height="30"
					rx="15"
					fill={on ? 'var(--hk-electron)' : 'var(--surface)'}
					fill-opacity={on ? 0.18 : 1}
					stroke={on ? 'var(--hk-electron)' : 'var(--border-strong)'}
				/>
				<text x={c.x + 56} y={c.y + 20} text-anchor="middle" font-size="14" font-weight="600"
					>{c.p.formula}</text
				>
			</g>
		{/each}
	{/if}

	<!-- ladder -->
	<g data-testid="ladder">
		<Ladder {sol} {selected} onSelect={select} frost />
	</g>

	<!-- energies -->
	<g data-testid="energies">
		{#if showClosure}
			<Readout
				id="closure-live"
				order={5}
				label="Ring vs open chain"
				value={closureText}
				color={closure < -5e-4 ? 'var(--hk-warn)' : 'var(--hk-good)'}
			>
				<Label
					x={590}
					y={y0 + 40}
					text="π energy vs the open chain: {closureText}"
					size={13}
					anchor="start"
					color={closure < -5e-4 ? 'var(--hk-warn)' : 'var(--hk-good)'}
				/>
			</Readout>
		{/if}
		<Readout id="epi" order={2} label="π energy" value={energyText(mol.electrons, sol.energy)}>
			<Label
				x={590}
				y={y0}
				text="π energy  {energyText(mol.electrons, sol.energy)}"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="deloc"
			order={3}
			label="Delocalisation"
			value="{(Math.abs(sol.delocalisation) < 5e-4 ? 0 : sol.delocalisation).toFixed(3)}|β|"
		>
			<Label
				x={590}
				y={y0 + 20}
				text="delocalisation  {(Math.abs(sol.delocalisation) < 5e-4
					? 0
					: sol.delocalisation
				).toFixed(3)}|β|"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="shell"
			order={4}
			label="Shell"
			value={shell.text}
			color={shell.good ? 'var(--hk-good)' : 'var(--hk-warn)'}
		>
			<Label
				x={590}
				y={showClosure ? y0 + 62 : y0 + 44}
				text={shell.text}
				size={13}
				weight={700}
				anchor="start"
				color={shell.good ? 'var(--hk-good)' : 'var(--hk-warn)'}
			/>
		</Readout>
	</g>
</g>

<style>
	.chip {
		cursor: pointer;
		outline: none;
	}
	.chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
	.tab {
		font-variant-numeric: tabular-nums;
	}
</style>
