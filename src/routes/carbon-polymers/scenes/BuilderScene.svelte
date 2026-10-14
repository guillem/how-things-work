<script lang="ts">
	/**
	 * The molecule builder: a carbon skeleton (chain or ring of 1–8 carbons, or benzene) with
	 * at most one feature (a multiple bond or a functional group), drawn flat with every
	 * hydrogen (or as a line drawing, `params.skeletal`), with its name, formula and measured
	 * properties.
	 *
	 * The reader's molecule lives in `params['mol:<step id>']` (`serialize()`), starting from
	 * `hints.start`. The bar at the top adds and removes carbons and closes the ring; features
	 * come from the palette on the left: drag one onto a carbon (a group) or a bond (a multiple
	 * bond), or click it to place it at the first carbon that takes it. Clicking another carbon
	 * or bond moves the feature there; clicking the feature takes it off. Impossible molecules
	 * are refused with the reason (`refusal()`).
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG presentation
	 * attributes.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { startDrag, toSvg } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		FEATURES,
		MAX_CARBONS,
		commonName,
		family,
		formula,
		isBondFeature,
		key,
		molarMass,
		name,
		parse,
		refusal,
		serialize,
		uses,
		type Build,
		type Feature
	} from '../molecule';
	import { COMPOUNDS, BUILDS } from '../compounds';
	import { layout, withHydrogens } from '../structures';
	import { stateAt } from '../polymer';
	import { GEOMETRY } from '../geometry';
	import { celsius } from '../look';
	import StructureView from './StructureView.svelte';

	let { step, params, setParam }: StageProps = $props();

	const paramKey = $derived(`mol:${step.id}`);
	const FALLBACK: Build = { n: 4, ring: false, aromatic: false, feature: null, at: 1 };
	const build = $derived.by((): Build => {
		const start = parse(String(step.hints?.start ?? '4'), FALLBACK);
		const saved = params[paramKey];
		return parse(typeof saved === 'string' ? saved : null, start);
	});
	const skeletal = $derived(params.skeletal === true);
	const structure = $derived(layout(build));
	const compound = $derived(COMPOUNDS[BUILDS[key(build)]]);

	// ---- editing
	let notice = $state<string | null>(null);
	function save(b: Build) {
		const why = refusal(b);
		if (why) {
			notice = why;
			return false;
		}
		notice = null;
		setParam(paramKey, serialize(b));
		return true;
	}
	const withFeature = (f: Feature | null, at: number): Build => ({ ...build, feature: f, at });
	/** First position that takes the feature (the current one if it still fits). */
	function firstFit(f: Feature): Build | null {
		const order = [build.at, ...Array.from({ length: build.n }, (_, i) => i + 1)];
		for (const at of order) {
			const b = withFeature(f, at);
			if (!refusal(b)) return b;
		}
		return null;
	}
	function place(f: Feature) {
		if (build.feature === f) return save(withFeature(null, 1));
		const b = firstFit(f);
		if (b) return save(b);
		notice = refusal(withFeature(f, build.at)) ?? refusal(withFeature(f, 1));
		return false;
	}
	function setCarbons(n: number) {
		const next: Build = { ...build, n, aromatic: build.aromatic && n === 6 };
		if (next.ring && n < 3) next.ring = false;
		if (next.feature) {
			// Keep the feature if it still fits somewhere (nearest the old position first).
			const keep = [Math.min(next.at, n), ...Array.from({ length: n }, (_, i) => i + 1)].find(
				(at) => !refusal({ ...next, at })
			);
			if (keep) next.at = keep;
			else {
				next.feature = null;
				next.at = 1;
			}
		}
		save(next);
	}
	function setRing(ring: boolean, aromatic = false) {
		const next: Build = { ...build, ring, aromatic };
		if (ring && next.n < 3) next.n = aromatic ? 6 : 3;
		if (aromatic) next.n = 6;
		if (next.feature && refusal(next)) {
			const keep = Array.from({ length: next.n }, (_, i) => i + 1).find(
				(at) => !refusal({ ...next, at })
			);
			if (keep) next.at = keep;
			else {
				notice = `${refusal(next)}: the ${LABEL[next.feature]} came off`;
				next.feature = null;
				next.at = 1;
				setParam(paramKey, serialize(next));
				return;
			}
		}
		save(next);
	}

	// ---- palette
	const LABEL: Record<Feature, string> = {
		double: 'C=C',
		triple: 'C≡C',
		OH: '–OH',
		CO: '=O',
		COOH: '–COOH',
		NH2: '–NH₂',
		Cl: '–Cl'
	};
	const KIND: Record<Feature, string> = {
		double: 'double bond',
		triple: 'triple bond',
		OH: 'alcohol',
		CO: 'aldehyde, ketone',
		COOH: 'acid',
		NH2: 'amine',
		Cl: 'chloro-'
	};
	const PX = 70;
	const palette = FEATURES.map((f, i) => ({ f, x: PX, y: 150 + i * 56 }));
	const canPlace = (f: Feature) => build.feature === f || firstFit(f) !== null;

	// ---- the drawing: fit the molecule into the middle of the stage
	const box = $derived.by(() => {
		const atoms = withHydrogens(structure).atoms;
		const xs = atoms.map((a) => a.x);
		const ys = atoms.map((a) => a.y);
		return {
			w: Math.max(...xs) - Math.min(...xs),
			h: Math.max(...ys) - Math.min(...ys),
			cx: (Math.max(...xs) + Math.min(...xs)) / 2,
			cy: (Math.max(...ys) + Math.min(...ys)) / 2
		};
	});
	const CX = 400;
	const CY = 312;
	const unitTarget = $derived(Math.min(100, 420 / Math.max(1, box.w), 360 / Math.max(1, box.h)));
	const unit = Tween.of(() => unitTarget, { duration: 500, easing: cubicInOut });
	const ox = $derived(CX - box.cx * unit.current);
	const oy = $derived(CY - box.cy * unit.current);

	// Feature moves: click a carbon (groups) or a bond (multiple bonds).
	const groupFeature = $derived(build.feature !== null && !isBondFeature(build.feature));
	function atomLabel(i: number) {
		const a = structure.atoms[i];
		if (a.group && groupFeature && a.el !== 'C') return `Remove the ${LABEL[build.feature!]}`;
		if (a.el !== 'C' || !groupFeature) return null;
		if (build.at === a.carbon) return null;
		return `Move the ${LABEL[build.feature!]} to carbon ${a.carbon}`;
	}
	function onAtom(i: number) {
		const a = structure.atoms[i];
		if (a.el !== 'C') save(withFeature(null, 1));
		else if (a.carbon) save(withFeature(build.feature, a.carbon));
	}
	const skeletonBonds = $derived(build.ring ? build.n : build.n - 1);
	function bondLabel(i: number) {
		if (i >= skeletonBonds || !isBondFeature(build.feature) || build.aromatic) return null;
		const f = build.feature!;
		if (i === build.at - 1) return `Remove the ${KIND[f]}`;
		return `Move the ${KIND[f]} to carbons ${i + 1}–${((i + 1) % build.n) + 1}`;
	}
	function onBond(i: number) {
		if (i === build.at - 1) save(withFeature(null, 1));
		else save(withFeature(build.feature, i + 1));
	}

	// ---- dragging a feature from the palette
	let drag = $state<{ f: Feature; x: number; y: number; x0: number; y0: number } | null>(null);
	/** The carbon (group) or skeleton bond (multiple bond) nearest the dragged token. */
	const target = $derived.by(() => {
		if (!drag) return null;
		const d = drag;
		const pos = (i: number) => ({
			x: ox + structure.atoms[i].x * unit.current,
			y: oy + structure.atoms[i].y * unit.current
		});
		let best: { kind: 'atom' | 'bond'; i: number; at: number; dist: number } | null = null;
		if (isBondFeature(d.f)) {
			for (let i = 0; i < skeletonBonds; i++) {
				const bd = structure.bonds[i];
				const p = pos(bd.a);
				const q = pos(bd.b);
				const dist = Math.hypot(d.x - (p.x + q.x) / 2, d.y - (p.y + q.y) / 2);
				if (!best || dist < best.dist) best = { kind: 'bond', i, at: i + 1, dist };
			}
		} else {
			for (let i = 0; i < build.n; i++) {
				const p = pos(i);
				const dist = Math.hypot(d.x - p.x, d.y - p.y);
				if (!best || dist < best.dist) best = { kind: 'atom', i, at: i + 1, dist };
			}
		}
		return best && best.dist < 70 ? best : null;
	});
	function grab(e: PointerEvent, f: Feature) {
		const p0 = toSvg(e, e.currentTarget as Element);
		drag = { f, x: p0.x, y: p0.y, x0: p0.x, y0: p0.y };
		startDrag(
			e,
			(p) => (drag = { f, x: p.x, y: p.y, x0: p0.x, y0: p0.y }),
			() => {
				const d = drag;
				const tg = target;
				drag = null;
				if (!d) return;
				const moved = Math.hypot(d.x - d.x0, d.y - d.y0) > 8;
				if (!moved) place(f);
				else if (tg) save(withFeature(f, tg.at));
			}
		);
	}
	const onKey = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	// ---- readout
	const RX = 664;
	const fam = $derived(family(build));
	const common = $derived(commonName(build));
	const tb = $derived(compound?.tb);
	const tm = $derived(compound?.tm);
	const atRoom = $derived(stateAt(tb, tm));
	const where = $derived(uses(build));
	const len = (mol: string, atoms: string, nth = 0) =>
		Math.round(
			GEOMETRY[mol].coords.filter((c) => c.atoms === atoms && c.kind === 'length')[nth].value * 100
		);
	/** Measured lengths (pm) of each kind of bond, in the simplest molecule that has it. */
	const BOND_PM: Record<string, number> = {
		'C–C': len('ethane', 'CC'),
		'C=C': len('ethylene', 'CC'),
		'C≡C': len('acetylene', 'CC'),
		'C⋯C': len('benzene', 'CC'),
		'C–H': len('ethane', 'CH'),
		'C–O': len('methanol', 'CO'),
		'C=O': len('formaldehyde', 'CO'),
		'C–N': len('methylamine', 'CN'),
		'C–Cl': len('methyl chloride', 'CCl'),
		'O–H': len('methanol', 'OH')
	};
	const bondKinds = $derived.by(() => {
		const full = withHydrogens(structure);
		const seen = new Set<string>();
		for (const b of full.bonds) {
			const [p, q] = [full.atoms[b.a].el, full.atoms[b.b].el].sort((x, y) =>
				x === 'C' ? -1 : y === 'C' ? 1 : x === 'H' ? 1 : y === 'H' ? -1 : 0
			);
			const sym = b.order === 1.5 ? '⋯' : b.order === 2 ? '=' : b.order === 3 ? '≡' : '–';
			const k = `${p}${sym}${q}`;
			if (k in BOND_PM) seen.add(k);
		}
		return Object.keys(BOND_PM).filter((k) => seen.has(k));
	});
	const bondLine = $derived(
		bondKinds.map((k) => `${k === 'C⋯C' ? 'ring C–C' : k} ${BOND_PM[k]}`).join(' · ') + ' pm'
	);
	const STATE_NOTE: Record<string, string> = {
		gas: 'a gas at 25 °C',
		liquid: 'a liquid at 25 °C',
		solid: 'a solid at 25 °C'
	};
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- drop zone highlight -->
	{#if drag}
		<rect
			x="150"
			y="80"
			width="500"
			height="460"
			rx="16"
			fill="var(--stage-grid)"
			opacity="0.5"
			style:pointer-events="none"
		/>
	{/if}

	<!-- skeleton bar -->
	<g>
		{@render txt(166, 42, 'Carbons', 13, { weight: 600 })}
		{#each [{ d: -1, label: '−' }, { d: 1, label: '+' }] as b (b.d)}
			{@const x = b.d < 0 ? 228 : 296}
			{@const can =
				b.d < 0
					? build.n > (build.ring ? 3 : 1) && !build.aromatic
					: build.n < MAX_CARBONS && !build.aromatic}
			<g
				class="chip"
				class:off={!can}
				role="button"
				tabindex="0"
				aria-label={b.d < 0 ? 'Remove a carbon' : 'Add a carbon'}
				aria-disabled={!can}
				onclick={() => can && setCarbons(build.n + b.d)}
				onkeydown={(e) => onKey(e, () => can && setCarbons(build.n + b.d))}
			>
				<rect
					{x}
					y="22"
					width="30"
					height="28"
					rx="8"
					fill="var(--surface)"
					stroke="var(--border-strong)"
				/>
				{@render txt(x + 15, 42, b.label, 17, { anchor: 'middle', weight: 700, muted: !can })}
			</g>
		{/each}
		{@render txt(277, 42, String(build.n), 15, { anchor: 'middle', weight: 700 })}
		{#each [{ id: 'chain', label: 'Chain' }, { id: 'ring', label: 'Ring' }, { id: 'benzene', label: 'Benzene' }] as c, i (c.id)}
			{@const x = 350 + i * 86}
			{@const on =
				c.id === 'chain'
					? !build.ring
					: c.id === 'ring'
						? build.ring && !build.aromatic
						: build.aromatic}
			<g
				class="chip"
				role="button"
				tabindex="0"
				aria-label={c.id === 'chain'
					? 'Open the ring into a chain'
					: c.id === 'ring'
						? 'Close the chain into a ring'
						: 'Make a benzene ring'}
				aria-pressed={on}
				onclick={() => setRing(c.id !== 'chain', c.id === 'benzene')}
				onkeydown={(e) => onKey(e, () => setRing(c.id !== 'chain', c.id === 'benzene'))}
			>
				<rect
					{x}
					y="22"
					width="78"
					height="28"
					rx="14"
					fill={on ? 'var(--focus)' : 'var(--surface)'}
					fill-opacity={on ? 0.18 : 1}
					stroke={on ? 'var(--focus)' : 'var(--border-strong)'}
				/>
				{@render txt(x + 39, 41, c.label, 13, { anchor: 'middle', weight: 600 })}
			</g>
		{/each}
	</g>

	<!-- palette -->
	<Readout id="palette-title">
		{@render txt(24, 96, 'Add a feature', 13, { weight: 700 })}
		{@render txt(24, 112, 'drag onto the molecule, or click', 11, { muted: true })}
	</Readout>
	{#each palette as p (p.f)}
		{@const ok = canPlace(p.f)}
		{@const on = build.feature === p.f}
		<g
			class="token"
			class:refused={!ok}
			role="button"
			tabindex="0"
			aria-label={on ? `Remove the ${KIND[p.f]}` : `Add ${LABEL[p.f]} (${KIND[p.f]})`}
			aria-pressed={on}
			onpointerdown={(e) => grab(e, p.f)}
			onkeydown={(e) => onKey(e, () => place(p.f))}
		>
			<rect
				x={p.x - 50}
				y={p.y - 22}
				width="118"
				height="46"
				rx="10"
				fill={on ? 'var(--cp-group)' : 'var(--surface)'}
				fill-opacity={on ? 0.16 : 1}
				stroke={on ? 'var(--cp-group)' : 'var(--border)'}
				opacity={ok ? 1 : 0.5}
			/>
			{@render txt(p.x - 38, p.y + 2, LABEL[p.f], 16, { weight: 700, muted: !ok })}
			<Readout id="kind-{p.f}">
				{@render txt(p.x - 38, p.y + 17, KIND[p.f], 10.5, { muted: true })}
			</Readout>
		</g>
	{/each}

	<!-- the molecule -->
	<g data-testid="molecule">
		<StructureView
			{structure}
			cx={ox}
			cy={oy}
			unit={unit.current}
			{skeletal}
			focus
			numbers={build.n > 1 && !(build.ring && !build.feature)}
			hotAtom={target?.kind === 'atom' ? target.i : null}
			hotBond={target?.kind === 'bond' ? target.i : null}
			{onAtom}
			{onBond}
			{atomLabel}
			{bondLabel}
		/>
	</g>
	<Readout id="hint">
		{@render txt(
			CX,
			566,
			build.feature
				? 'Click another carbon or bond to move the feature; click it to take it off'
				: 'Numbers count the carbons from the end nearer the feature',
			11,
			{ anchor: 'middle', muted: true }
		)}
	</Readout>

	{#if drag}
		<g style:pointer-events="none" opacity="0.9">
			<rect
				x={drag.x - 32}
				y={drag.y - 16}
				width="64"
				height="32"
				rx="10"
				fill="var(--surface)"
				stroke="var(--cp-group)"
				stroke-width="2"
			/>
			{@render txt(drag.x, drag.y + 6, LABEL[drag.f], 16, { anchor: 'middle', weight: 700 })}
		</g>
	{/if}

	<!-- readout -->
	<g transform="translate({RX} 0)" style:pointer-events="none" data-testid="readout">
		<Readout id="name" order={0} label="Name" value={name(build)} note={common ?? undefined}>
			{@render txt(0, 98, name(build), name(build).length > 16 ? 19 : 23, { weight: 700 })}
			{#if common}
				{@render txt(0, 120, `also: ${common}`, 13, { muted: true })}
			{/if}
		</Readout>
		<Readout id="formula" order={1} label="Formula" value={formula(build)}>
			{@render txt(0, 152, formula(build), 20, { weight: 700 })}
			{@render txt(110, 152, `${molarMass(build).toFixed(1)} g/mol`, 13, { muted: true })}
		</Readout>
		<Readout id="family" order={2} label="Family" value={fam}>
			{@render txt(0, 176, fam, 13, { weight: 600, color: 'var(--cp-group)' })}
		</Readout>
		{#if notice}
			<Readout id="notice" order={3} label="Not possible" value={notice}>
				{@render txt(
					0,
					204,
					notice.length > 44 ? notice.slice(0, notice.lastIndexOf(' ', 44)) : notice,
					12,
					{
						weight: 600,
						color: 'var(--cp-warn)'
					}
				)}
				{#if notice.length > 44}
					{@render txt(0, 220, notice.slice(notice.lastIndexOf(' ', 44) + 1), 12, {
						weight: 600,
						color: 'var(--cp-warn)'
					})}
				{/if}
			</Readout>
		{/if}
		<g transform="translate(0 240)">
			<rect
				x="-12"
				y="0"
				width="290"
				height="150"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout id="boils" order={4} label="Boils at" value={celsius(tb) ?? 'no NIST value'}>
				{@render txt(4, 26, 'boils at', 12, { muted: true })}
				{@render txt(4, 50, celsius(tb) ?? '—', 20, { weight: 700, color: 'var(--cp-hot)' })}
			</Readout>
			<Readout id="melts" order={5} label="Melts at" value={celsius(tm) ?? 'no NIST value'}>
				{@render txt(140, 26, 'melts at', 12, { muted: true })}
				{@render txt(140, 50, celsius(tm) ?? '—', 20, { weight: 700, color: 'var(--cp-cold)' })}
			</Readout>
			{#if atRoom}
				<Readout id="atRoom" order={6} label="At 25 °C" value={atRoom}>
					{@render txt(4, 80, STATE_NOTE[atRoom], 14, { weight: 600 })}
				</Readout>
			{:else}
				<Readout id="atRoom">
					{@render txt(
						4,
						80,
						tb == null ? 'NIST lists no reliable boiling point' : 'no melting point in NIST',
						12,
						{ muted: true }
					)}
				</Readout>
			{/if}
			<Readout id="nist">
				{@render txt(4, 100, 'measured, 1 atm (NIST WebBook)', 11, { muted: true })}
			</Readout>
			{#if where}
				<Readout id="uses" order={7} label="Found in" value={where}>
					{@render txt(4, 128, where, 12, { weight: 500 })}
				</Readout>
			{/if}
		</g>
		<Readout id="bonds" order={8} label="Bond lengths" value={bondLine}>
			{@render txt(0, 418, 'Bond lengths (measured, CCCBDB)', 11, { muted: true })}
			{#each bondLine.match(/[^·]+(?:·[^·]+)?/g) ?? [] as line, i (i)}
				{@render txt(0, 436 + i * 17, line.trim().replace(/·$/, ''), 12)}
			{/each}
		</Readout>
	</g>
</g>

<style>
	.chip,
	.token {
		cursor: pointer;
		outline: none;
	}
	.token {
		cursor: grab;
		touch-action: none;
	}
	.token.refused {
		cursor: not-allowed;
	}
	.chip.off {
		cursor: not-allowed;
	}
	.chip:focus-visible,
	.token:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
