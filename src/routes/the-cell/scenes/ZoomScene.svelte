<script lang="ts">
	/**
	 * The zoom: a chain of drawings from a tissue down to molecules (see
	 * `frames.ts`), each drawn at its true scale, with a scale bar, a
	 * powers-of-ten ruler and the info card of the picked part.
	 *
	 * The width of the view comes from the step's zoom slider (`params[zoom-…]`,
	 * −log₁₀ metres); the camera follows it with a tween on log(width), so the
	 * zoom feels steady across six orders of magnitude. When the branch changes
	 * (another organelle of the same cell) the camera first zooms out to the cell,
	 * switches, and zooms back in; when the kind of cell changes it cross-fades.
	 * Wheel, + and − over the picture write the slider's value (`setParam`).
	 *
	 * Nothing moves with `t` here except what the drawings animate themselves;
	 * under reduced motion every change is instant.
	 */
	import { untrack, type Component } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BRANCH_OF,
		STAGE,
		branchFrames,
		cameraAt,
		currentFrame,
		layers,
		zoomRange,
		type Frame
	} from '../frames';
	import { exploreChain } from '../steps';
	import { STRUCTURES, type CellType } from '../structures';
	import { formatLength, scaleBar, NM, UM } from '../units';
	import type { FrameProps } from '../frames/types';
	import Liver from '../frames/Liver.svelte';
	import Hepatocyte from '../frames/Hepatocyte.svelte';
	import Chromatin from '../frames/Chromatin.svelte';
	import Crista from '../frames/Crista.svelte';
	import Ribosome from '../frames/Ribosome.svelte';
	import Membrane from '../frames/Membrane.svelte';
	import Atoms from '../frames/Atoms.svelte';
	import Leaf from '../frames/Leaf.svelte';
	import Mesophyll from '../frames/Mesophyll.svelte';
	import Thylakoid from '../frames/Thylakoid.svelte';
	import Colony from '../frames/Colony.svelte';
	import Ecoli from '../frames/Ecoli.svelte';
	import Cytoplasm from '../frames/Cytoplasm.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type Drawing = Component<FrameProps & { frame: Frame }>;
	const DRAWINGS: Record<string, Drawing> = {
		liver: Liver,
		hepatocyte: Hepatocyte,
		chromatin: Chromatin,
		crista: Crista,
		ribosome: Ribosome,
		membrane: Membrane,
		atoms: Atoms,
		leaf: Leaf,
		mesophyll: Mesophyll,
		thylakoid: Thylakoid,
		colony: Colony,
		ecoli: Ecoli,
		cytoplasm: Cytoplasm
	};
	/** Drawings in micrometres and world coordinates; the rest in nm from their centre. */
	const MICRO = new Set(['liver', 'hepatocyte', 'leaf', 'mesophyll', 'colony', 'ecoli']);

	// ---- what the step asks for ---------------------------------------------------------------
	const explore = $derived(step.hints?.cell === 'explore');
	const zoomControl = $derived(step.controls?.find((c) => c.id.startsWith('zoom-')));
	const zoomId = $derived(zoomControl?.id ?? 'zoom-explore');
	const wanted = $derived.by(() => {
		if (explore) return exploreChain(params);
		const cell = String(step.hints?.cell ?? 'animal') as CellType;
		const branch = String(step.hints?.branch ?? '');
		return { cell, branch, chain: branchFrames(cell, branch) };
	});
	const wantedKey = $derived(`${wanted.cell}/${wanted.branch}`);
	const wantedLog = $derived.by(() => {
		const raw = Number(params[zoomId] ?? (zoomControl?.type === 'range' ? zoomControl.default : 5));
		const [lo, hi] = zoomRange(wanted.chain);
		return Math.log10(clamp(10 ** -raw, lo, hi));
	});

	// ---- the camera -------------------------------------------------------------------------------
	let active = $state.raw(untrack(() => wanted));
	const logf = new Tween(
		untrack(() => wantedLog),
		{ easing: cubicInOut }
	);
	const fade = new Tween(1, { easing: cubicInOut });
	const ms = (d: number) => (reduced ? 0 : clamp(260 + 420 * Math.abs(d), 260, 2600));
	let seq = 0;
	$effect(() => {
		const key = wantedKey;
		const target = wantedLog;
		const next = wanted;
		untrack(() => {
			const my = ++seq;
			const activeKey = `${active.cell}/${active.branch}`;
			if (key === activeKey) {
				logf.set(target, { duration: ms(target - logf.current) });
				return;
			}
			if (next.cell === active.cell) {
				// zoom out to the cell, switch branch, zoom back in
				const cellLog = Math.log10(active.chain[1].W);
				const out = Math.max(cellLog, logf.current);
				logf.set(out, { duration: ms(out - logf.current) }).then(() => {
					if (my !== seq) return;
					active = next;
					logf.set(target, { duration: ms(target - out) });
				});
				return;
			}
			fade.set(0, { duration: reduced ? 0 : 260 }).then(() => {
				if (my !== seq) return;
				active = next;
				logf.set(target, { duration: 0 });
				fade.set(1, { duration: reduced ? 0 : 320 });
			});
		});
	});

	const f = $derived(10 ** logf.current);
	const cam = $derived(cameraAt(active.chain, f));
	const shown = $derived(layers(active.chain, cam));
	const here = $derived(currentFrame(active.chain, f));

	/** A drawing's transform and the part of it on screen. */
	function place(fr: Frame) {
		const unit = MICRO.has(fr.draw ?? '') ? UM : NM;
		const k = STAGE.w / cam.f;
		const ppu = unit * k;
		// stage = 480 + (world − cam) · k; world = (MICRO ? 0 : c) + d · unit
		const ox = MICRO.has(fr.draw ?? '') ? 0 : fr.c[0];
		const oy = MICRO.has(fr.draw ?? '') ? 0 : fr.c[1];
		const tx = STAGE.w / 2 + (ox - cam.x) * k;
		const ty = STAGE.h / 2 + (oy - cam.y) * k;
		return {
			transform: `translate(${tx} ${ty}) scale(${ppu})`,
			ppu,
			view: { x0: -tx / ppu, y0: -ty / ppu, x1: (STAGE.w - tx) / ppu, y1: (STAGE.h - ty) / ppu }
		};
	}

	// ---- picking ---------------------------------------------------------------------------------------
	let picked = $state.raw<{ id: string; frame: string } | null>(null);
	const stepId = $derived(step.id);
	$effect(() => {
		void stepId;
		untrack(() => (picked = null));
	});
	function pick(id: string) {
		picked = { id, frame: here.id };
		const b = BRANCH_OF[id];
		if (explore && active.cell === 'animal' && b) setParam('branch-animal', b);
	}
	const cardId = $derived(picked && picked.frame === here.id ? picked.id : here.focus);
	const card = $derived(STRUCTURES[cardId]);

	function wrap(text: string, max: number) {
		const lines: string[] = [];
		let line = '';
		for (const w of text.split(' ')) {
			if (line && (line + ' ' + w).length > max) {
				lines.push(line);
				line = w;
			} else line = line ? line + ' ' + w : w;
		}
		if (line) lines.push(line);
		return lines;
	}
	const cardLines = $derived(card ? wrap(card.does, 46) : []);

	// ---- zoom by wheel and keys ------------------------------------------------------------------
	const bounds = $derived.by(() => {
		const [lo, hi] = zoomRange(wanted.chain);
		return [-Math.log10(hi), -Math.log10(lo)] as const;
	});
	function zoomBy(d: number) {
		const raw = Number(params[zoomId] ?? -wantedLog);
		setParam(zoomId, Math.round(clamp(raw + d, bounds[0], bounds[1]) * 100) / 100);
	}
	function wheel(node: SVGGElement) {
		const onwheel = (e: WheelEvent) => {
			e.preventDefault();
			zoomBy(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0016));
		};
		node.addEventListener('wheel', onwheel, { passive: false });
		return () => node.removeEventListener('wheel', onwheel);
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key === '+' || e.key === '=') zoomBy(0.1);
		else if (e.key === '-' || e.key === '_' || e.key === '−') zoomBy(-0.1);
		else return;
		e.preventDefault();
	}
	function buttonKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}

	// ---- scale bar and ruler -----------------------------------------------------------------------
	const bar = $derived(scaleBar(f));
	const RULER = { x0: 600, x1: 920, y: 566 };
	/** Ruler from 1 mm (left) to 0.1 nm (right): position of a width on it. */
	const rx = (m: number) => RULER.x0 + ((-3 - Math.log10(m)) / 7) * (RULER.x1 - RULER.x0);
	const TICKS = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10];
</script>

<g>
	<defs>
		<clipPath id="zoom-clip"><rect x="0" y="0" width={STAGE.w} height={STAGE.h} /></clipPath>
	</defs>

	<!-- the picture; wheel and +/− zoom; clicks on parts pick them -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<g
		class="picture"
		role="application"
		tabindex="0"
		aria-label="Zoomable picture, {formatLength(
			f
		)} across. Use + and − to zoom; tab to the parts to pick one."
		clip-path="url(#zoom-clip)"
		{onkeydown}
		{@attach wheel}
	>
		<rect x="0" y="0" width={STAGE.w} height={STAGE.h} fill="var(--stage-bg)" />
		<g opacity={fade.current}>
			{#each shown as l (l.frame.id)}
				{@const Draw = DRAWINGS[l.frame.draw ?? '']}
				{@const p = place(l.frame)}
				{#if Draw}
					<g
						transform={p.transform}
						opacity={l.opacity}
						style:pointer-events={l.interactive ? 'auto' : 'none'}
					>
						<Draw
							frame={l.frame}
							view={p.view}
							ppu={p.ppu}
							{t}
							sel={picked?.id ?? null}
							{pick}
							interactive={l.interactive}
							{reduced}
						/>
					</g>
				{/if}
			{/each}
		</g>
	</g>

	<!-- info card -->
	{#if card}
		<Readout id="card" order={1} label={card.name} value={card.dims} note={card.does}>
			<g class="card" style:pointer-events="none">
				<rect
					x="620"
					y="16"
					width="324"
					height={64 + cardLines.length * 16}
					rx="10"
					fill="var(--surface)"
					stroke="var(--border)"
					opacity="0.94"
				/>
				<text x="636" y="40" class="title">{card.name}</text>
				<text x="636" y="60" class="dims">{card.dims}</text>
				{#each cardLines as line, i (i)}
					<text x="636" y={82 + i * 16} class="does">{line}</text>
				{/each}
			</g>
		</Readout>
	{/if}

	<!-- scale bar -->
	<Readout id="scalebar" order={2} label="Scale bar" value={bar.label}>
		<g style:pointer-events="none">
			<rect
				x="16"
				y="540"
				width={Math.max(bar.px, 60) + 32}
				height="44"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
				opacity="0.92"
			/>
			<rect x="32" y="566" width={bar.px} height="6" rx="1" fill="var(--stage-ink)" />
			<text x={32 + bar.px / 2} y="560" text-anchor="middle" class="bar">{bar.label}</text>
		</g>
	</Readout>

	<!-- powers-of-ten ruler: the width of the view -->
	<Readout id="field" order={3} label="Width of the view" value={formatLength(f)}>
		<g style:pointer-events="none">
			<rect
				x={RULER.x0 - 16}
				y="528"
				width={RULER.x1 - RULER.x0 + 40}
				height="56"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
				opacity="0.92"
			/>
			<text x={RULER.x0} y="546" class="small"
				>width of the view: <tspan class="strong">{formatLength(f)}</tspan></text
			>
			<line
				x1={RULER.x0}
				x2={RULER.x1}
				y1={RULER.y}
				y2={RULER.y}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			{#each TICKS as m (m)}
				<line
					x1={rx(m)}
					x2={rx(m)}
					y1={RULER.y - 4}
					y2={RULER.y + 4}
					stroke="var(--stage-ink-muted)"
				/>
				<text x={rx(m)} y={RULER.y + 15} text-anchor="middle" class="tick"
					>{formatLength(m, 1)}</text
				>
			{/each}
			<path d="M{rx(f)} {RULER.y - 3} l-6 -9 h12 Z" fill="var(--accent)" />
		</g>
	</Readout>

	<!-- zoom buttons -->
	{#each [{ x: 560, glyph: '+', label: 'Zoom in', d: 0.25 }, { x: 560, glyph: '−', label: 'Zoom out', d: -0.25 }] as b, i (b.label)}
		<Readout id="zbtn{i}">
			<g
				class="zbtn"
				role="button"
				tabindex="0"
				aria-label={b.label}
				onclick={() => zoomBy(b.d)}
				onkeydown={(e) => buttonKey(e, () => zoomBy(b.d))}
			>
				<rect
					x={b.x - 18}
					y={i ? 556 : 516}
					width="36"
					height="34"
					rx="8"
					fill="var(--surface)"
					stroke="var(--stage-line)"
				/>
				<text x={b.x} y={i ? 580 : 540} text-anchor="middle" class="glyph">{b.glyph}</text>
			</g>
		</Readout>
	{/each}
</g>

<style>
	.picture:focus {
		outline: none;
	}
	.title {
		font-size: 15px;
		font-weight: 650;
		fill: var(--stage-ink);
	}
	.dims {
		font-size: 13px;
		font-weight: 600;
		fill: var(--accent);
	}
	.does {
		font-size: 12.5px;
		fill: var(--stage-ink);
	}
	.bar {
		font-size: 13px;
		font-weight: 600;
		fill: var(--stage-ink);
	}
	.small {
		font-size: 12px;
		fill: var(--stage-ink-muted);
	}
	.strong {
		font-weight: 650;
		fill: var(--stage-ink);
	}
	.tick {
		font-size: 10.5px;
		fill: var(--stage-ink-muted);
	}
	.glyph {
		font-size: 22px;
		font-weight: 600;
		fill: var(--stage-ink);
	}
	.zbtn {
		cursor: pointer;
	}
	.zbtn:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
