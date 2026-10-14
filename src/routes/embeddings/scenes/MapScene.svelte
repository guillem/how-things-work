<script lang="ts">
	/**
	 * The map of all 3,292 words (left, 640 × 568) with a panel on the right.
	 *
	 * Phases (`step.hints.phase`):
	 *   map      — the t-SNE map coloured by k-means cluster; the panel is the cluster legend.
	 *              Landmark and frequent words are labelled on the map; the legend names each
	 *              group by the words closest to its centre.
	 *   search   — a search box; the word's ten nearest neighbours (cosine in 100-D) are listed
	 *              and joined to it on the map. The view flies to the word.
	 *   distort  — as search, plus `params.proj` (t-SNE or PCA): the dots glide between the two
	 *              maps (a tween), and the panel marks which true neighbours are among the ten
	 *              closest dots on the current map.
	 *   summary  — the whole map with the clumps named, and the page's three conclusions.
	 *
	 * Explore controls: drag to pan, wheel or the on-stage + / − buttons to zoom, arrow keys and
	 * + / − when the map has focus, point at a dot to read it, click a dot to search it. The view
	 * is kept in `params['view:map']` ("x,y,zoom") so it survives step changes.
	 *
	 * Dots are drawn as one `<path>` per cluster (a zero-length segment per word, round caps) in
	 * map units inside a transformed group with non-scaling strokes, so panning and zooming only
	 * change one transform. Word labels are placed greedily (frequent words first, no overlaps)
	 * from the view; nothing here depends on `t` except the reveal of the neighbour lines at the
	 * start of a step and a slow pulse on the searched word.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { clamp, smoothstep, wave, startDrag, toSvg } from '#lib/draw/index.ts';
	import { load, type Embeddings } from '../embeddings';
	import Txt from './Txt.svelte';
	import WordInput from './WordInput.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	let emb = $state.raw<Embeddings | null>(null);
	$effect(() => {
		load().then((e) => (emb = e));
	});

	// ---- layout ---------------------------------------------------------------------------
	const MAP = { x: 16, y: 16, w: 640, h: 568 };
	const PL = 680; // panel left
	const PR = 944; // panel right
	const BASE = Math.min(MAP.w, MAP.h) / 2 - 16; // screen units per map unit at zoom 1
	const MIN_Z = 1;
	const MAX_Z = 24;
	const NEIGHBOURS = 10;

	const phase = $derived(String(step.hints?.phase ?? 'map'));
	const searching = $derived(phase === 'search' || phase === 'distort');
	const query = $derived(
		String(params.query ?? 'king')
			.trim()
			.toLowerCase()
	);
	const known = $derived(emb !== null && emb.has(query));

	// ---- t-SNE ↔ PCA ----------------------------------------------------------------------
	const proj = $derived(phase === 'distort' && params.proj === 'pca' ? 'pca' : 'tsne');
	const mix = new Tween(0, { duration: 1100, easing: cubicInOut });
	$effect(() => {
		const p = proj;
		untrack(() => mix.set(p === 'pca' ? 1 : 0, { duration: reduced ? 0 : 1100 }));
	});
	/** Current dot positions in map units (x, y per word), between the two maps. */
	const pos = $derived.by(() => {
		if (!emb) return new Float32Array(0);
		const a = emb.maps.tsne;
		const b = emb.maps.pca;
		const m = mix.current;
		if (m <= 0) return a;
		if (m >= 1) return b;
		return a.map((v, i) => v + (b[i] - v) * m);
	});

	// ---- the view ---------------------------------------------------------------------------
	interface View {
		x: number;
		y: number;
		z: number;
	}
	const WHOLE: View = { x: 0, y: 0, z: 1 };
	const clampView = (v: View): View => {
		const z = clamp(v.z, MIN_Z, MAX_Z);
		const lim = 1.1;
		return { x: clamp(v.x, -lim, lim), y: clamp(v.y, -lim, lim), z };
	};
	function parseView(raw: unknown): View | null {
		if (typeof raw !== 'string') return null;
		const [x, y, z] = raw.split(',').map(Number);
		return [x, y, z].every(Number.isFinite) ? clampView({ x, y, z }) : null;
	}
	const view = new Tween<View>(WHOLE, { duration: 800, easing: cubicInOut });
	/** Where the view is going (readouts and labels use it, not every frame of a flight). */
	let target = $state.raw<View>(WHOLE);
	function setView(v: View, ms = 0) {
		const c = clampView(v);
		target = c;
		setParam('view:map', `${c.x},${c.y},${c.z}`);
		view.set(c, { duration: reduced ? 0 : ms });
	}
	const scale = $derived(BASE * view.current.z);
	const sx = (mx: number) => MAP.x + MAP.w / 2 + (mx - view.current.x) * scale;
	const sy = (my: number) => MAP.y + MAP.h / 2 + (my - view.current.y) * scale;
	const mxOf = (x: number) => view.current.x + (x - MAP.x - MAP.w / 2) / scale;
	const myOf = (y: number) => view.current.y + (y - MAP.y - MAP.h / 2) / scale;

	/** Flies to the searched word, zoomed in enough to see its clump. */
	function flyToQuery(ms: number) {
		if (!emb || !emb.has(query)) return;
		const i = emb.indexOf(query);
		const m = emb.maps[proj];
		const x = m[2 * i];
		const y = m[2 * i + 1];
		// Zoom so that the closer half of the neighbours spreads over ~120 px.
		const d = emb
			.neighbours(query, NEIGHBOURS)
			.map((n) => {
				const j = emb!.indexOf(n.word);
				return Math.hypot(m[2 * j] - x, m[2 * j + 1] - y);
			})
			.sort((a, b) => a - b);
		const z = clamp(120 / (BASE * Math.max(d[4] ?? 0.1, 1e-3)), 2, 12);
		setView({ x, y, z }, ms);
	}

	// Step changes: the whole map for map and summary, the searched word for search and distort.
	let mounted = false;
	$effect(() => {
		const s = searching;
		const ready = emb !== null;
		untrack(() => {
			if (!ready) return;
			const ms = mounted ? 900 : 0;
			mounted = true;
			if (!s) setView(phase === 'summary' ? WHOLE : (parseView(params['view:map']) ?? WHOLE), ms);
			else flyToQuery(ms);
		});
	});
	// A new search: fly there.
	let lastQuery: string | undefined;
	$effect(() => {
		const q = query;
		const ok = known;
		untrack(() => {
			if (lastQuery !== undefined && q !== lastQuery && ok && searching) flyToQuery(700);
			lastQuery = q;
		});
	});
	// Switching maps: follow the searched word to its new place, zoomed to fit its neighbours.
	$effect(() => {
		const p = proj;
		untrack(() => {
			if (p && emb && known && phase === 'distort') flyToQuery(reduced ? 0 : 1100);
		});
	});

	// ---- dots -------------------------------------------------------------------------------
	const U = 1000; // map units → path units (keeps the numbers short)
	const clusterPaths = $derived.by(() => {
		if (!emb) return [];
		const parts: string[][] = Array.from({ length: emb.clusterCount }, () => []);
		for (let i = 0; i < emb.size; i++) {
			const x = Math.round(pos[2 * i] * U);
			const y = Math.round(pos[2 * i + 1] * U);
			parts[emb.clusters[i]].push(`M${x} ${y}h0`);
		}
		return parts.map((p, c) => ({ c, d: p.join('') }));
	});
	const names = $derived(emb ? emb.clusterNames(3) : []);
	const dotWidth = $derived(clamp(3.4 + (view.current.z - 1) * 0.35, 3.4, 8));

	// ---- the searched word and its neighbours ------------------------------------------------
	const neighbours = $derived(emb && known ? emb.neighbours(query, NEIGHBOURS) : []);
	const closeOnMap = $derived(
		emb && known && phase === 'distort' ? new Set(emb.mapNeighbours(proj, query, NEIGHBOURS)) : null
	);
	const keptCount = $derived(
		closeOnMap ? neighbours.filter((n) => closeOnMap.has(n.word)).length : 0
	);
	const suggestions = $derived.by(() => {
		if (!emb || known || query.length === 0) return [];
		const out: string[] = [];
		for (const w of emb.words) {
			if (w.startsWith(query.slice(0, Math.max(2, query.length - 1)))) out.push(w);
			if (out.length >= 4) break;
		}
		return out;
	});
	const pt = (w: string) => {
		const i = emb!.indexOf(w);
		return { x: sx(pos[2 * i]), y: sy(pos[2 * i + 1]) };
	};
	const inMap = (p: { x: number; y: number }, pad = 0) =>
		p.x >= MAP.x + pad &&
		p.x <= MAP.x + MAP.w - pad &&
		p.y >= MAP.y + pad &&
		p.y <= MAP.y + MAP.h - pad;
	/** Reveal of the neighbour lines when the step starts (complete under reduced motion). */
	const reveal = (k: number) => (reduced ? 1 : smoothstep(0.3 + k * 0.12, 0.9 + k * 0.12, t));
	const pulse = $derived(reduced ? 0.5 : wave(t, 2.4));

	// ---- labels -----------------------------------------------------------------------------
	type Box = [number, number, number, number];
	const overlaps = (b: Box, boxes: Box[]) =>
		boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
	/** Where the segment from a (inside the map) to b leaves the map, inset by `pad`. */
	function edgePoint(a: { x: number; y: number }, b: { x: number; y: number }, pad: number) {
		const x0 = MAP.x + pad;
		const x1 = MAP.x + MAP.w - pad;
		const y0 = MAP.y + pad;
		const y1 = MAP.y + MAP.h - pad;
		let u = 1;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		if (dx > 0) u = Math.min(u, (x1 - a.x) / dx);
		if (dx < 0) u = Math.min(u, (x0 - a.x) / dx);
		if (dy > 0) u = Math.min(u, (y1 - a.y) / dy);
		if (dy < 0) u = Math.min(u, (y0 - a.y) / dy);
		u = Math.max(0, u);
		return { x: a.x + dx * u, y: a.y + dy * u };
	}
	interface NbLabel {
		word: string;
		x: number;
		y: number;
		anchor: 'start' | 'middle' | 'end';
		box: Box;
		/** Rank among the neighbours (−1 for the searched word), for the reveal. */
		rank?: number;
	}
	/**
	 * Labels for the searched word and its neighbours: each tries above, below, right and left
	 * of its dot and takes the first place that is free; a neighbour with no free place keeps
	 * only its dot (it is listed in the panel anyway).
	 */
	const nbLabels = $derived.by((): NbLabel[] => {
		if (!emb || !searching || !known) return [];
		const out: NbLabel[] = [];
		const boxes: Box[] = [];
		const q = pt(query);
		const qw = query.length * 8.6 + 6;
		const qb: Box = [q.x - qw / 2, q.y - 32, q.x + qw / 2, q.y - 12];
		boxes.push(qb, [q.x - 8, q.y - 8, q.x + 8, q.y + 8]);
		out.push({ word: query, x: q.x, y: q.y - 17, anchor: 'middle', box: qb });
		for (const n of neighbours) {
			const p = pt(n.word);
			boxes.push([p.x - 5, p.y - 5, p.x + 5, p.y + 5]);
		}
		for (const [k, n] of neighbours.entries()) {
			const p = pt(n.word);
			const w = n.word.length * 7 + 4;
			if (!inMap(p, 4)) {
				// Off the map: label the point where its line leaves the view.
				const e = edgePoint(q, p, 16);
				const anchor = e.x < MAP.x + 60 ? 'start' : e.x > MAP.x + MAP.w - 60 ? 'end' : 'middle';
				const x0 = anchor === 'start' ? e.x : anchor === 'end' ? e.x - w : e.x - w / 2;
				const y = clamp(e.y + 4, MAP.y + 30, MAP.y + MAP.h - 40);
				const box: Box = [x0, y - 13, x0 + w, y + 3];
				if (!overlaps(box, boxes)) {
					boxes.push(box);
					out.push({ word: n.word + ' …', x: e.x, y, anchor, box, rank: k });
				}
				continue;
			}
			const tries: NbLabel[] = [
				{
					word: n.word,
					x: p.x,
					y: p.y - 9,
					anchor: 'middle',
					box: [p.x - w / 2, p.y - 22, p.x + w / 2, p.y - 6]
				},
				{
					word: n.word,
					x: p.x,
					y: p.y + 19,
					anchor: 'middle',
					box: [p.x - w / 2, p.y + 6, p.x + w / 2, p.y + 22]
				},
				{
					word: n.word,
					x: p.x + 9,
					y: p.y + 4,
					anchor: 'start',
					box: [p.x + 7, p.y - 8, p.x + 9 + w, p.y + 8]
				},
				{
					word: n.word,
					x: p.x - 9,
					y: p.y + 4,
					anchor: 'end',
					box: [p.x - 9 - w, p.y - 8, p.x - 7, p.y + 8]
				}
			];
			const ok = tries.find(
				(c) =>
					!overlaps(c.box, boxes) &&
					inMap({ x: c.box[0], y: c.box[1] }) &&
					inMap({ x: c.box[2], y: c.box[3] })
			);
			if (ok) {
				boxes.push(ok.box);
				out.push({ ...ok, rank: k });
			}
		}
		return out;
	});

	interface Placed {
		word: string;
		x: number;
		y: number;
		c: number;
	}
	/**
	 * Landmarks: everyday words labelled first, so the zoomed-out map names its clumps (months,
	 * countries, names, sport, money, war, family, food…). Their positions are the real ones.
	 */
	const LANDMARKS = (
		'march july monday china japan france germany israel iraq john david smith team football ' +
		'season million dollars market oil war troops police king queen mother daughter women ' +
		'children food fish fruit city university church music film air car plane good think ' +
		'small large body earth california'
	).split(' ');
	/**
	 * Word labels: landmarks first, then frequent words, skipping any that would overlap a label
	 * already placed (or the searched word and its neighbours, labelled separately). More labels
	 * fit as the view zooms in. Depends on the view and positions, never on `t`.
	 */
	const labels = $derived.by((): Placed[] => {
		if (!emb) return [];
		const z = view.current.z;
		const max = Math.round(clamp(30 + (z - 1) * 22, 30, 110));
		const boxes: Box[] = nbLabels.map((l) => l.box);
		const out: Placed[] = [];
		// Plain local sets, rebuilt on every run of this $derived (no reactivity needed).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const reserved = new Set<string>();
		if (searching && known) {
			reserved.add(query);
			for (const n of neighbours) {
				reserved.add(n.word);
				const p = pt(n.word);
				boxes.push([p.x - 5, p.y - 5, p.x + 5, p.y + 5]);
			}
		}
		// Zoom buttons (top right of the map).
		boxes.push([MAP.x + MAP.w - 60, MAP.y, MAP.x + MAP.w, MAP.y + 160]);
		const order = [...LANDMARKS.map((w) => emb!.indexOf(w)).filter((i) => i >= 0)];
		for (let i = 0; i < emb.size; i++) order.push(i);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Set<number>();
		for (const i of order) {
			if (out.length >= max) break;
			if (seen.has(i)) continue;
			seen.add(i);
			const w = emb.words[i];
			if (reserved.has(w)) continue;
			const x = sx(pos[2 * i]);
			const y = sy(pos[2 * i + 1]);
			if (!inMap({ x, y }, 24)) continue;
			const wd = w.length * 6.6 + 6;
			const b: Box = [x - wd / 2, y - 19, x + wd / 2, y - 2];
			if (overlaps(b, boxes)) continue;
			boxes.push(b);
			out.push({ word: w, x, y, c: emb.clusters[i] });
		}
		return out;
	});

	// ---- hover and click --------------------------------------------------------------------
	let hover = $state<string | null>(null);
	function nearestDot(x: number, y: number): string | null {
		if (!emb) return null;
		let best = -1;
		let bestD = 12 * 12;
		for (let i = 0; i < emb.size; i++) {
			const dx = sx(pos[2 * i]) - x;
			const dy = sy(pos[2 * i + 1]) - y;
			const d = dx * dx + dy * dy;
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		return best < 0 ? null : emb.words[best];
	}
	let dragging = $state(false);
	function onpointerdown(e: PointerEvent) {
		if (!emb) return;
		const v0 = target;
		let start: { x: number; y: number } | null = null;
		let moved = false;
		dragging = true;
		startDrag(
			e,
			(p) => {
				if (!start) {
					start = p;
					return;
				}
				if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < 4) return;
				moved = true;
				const s = BASE * v0.z;
				setView({ x: v0.x - (p.x - start.x) / s, y: v0.y - (p.y - start.y) / s, z: v0.z });
			},
			() => {
				dragging = false;
				if (!moved && start && searching) {
					const w = nearestDot(start.x, start.y);
					if (w) setParam('query', w);
				}
			}
		);
	}
	function onpointermove(e: PointerEvent) {
		if (dragging) return;
		const p = toSvg(e, e.currentTarget as Element);
		hover = nearestDot(p.x, p.y);
	}
	function zoomAt(f: number, px: number, py: number, ms = 0) {
		const v = target;
		const z = clamp(v.z * f, MIN_Z, MAX_Z);
		const g = v.z / z;
		const mx = mxOf(px);
		const my = myOf(py);
		setView({ x: mx + (v.x - mx) * g, y: my + (v.y - my) * g, z }, ms);
	}
	const zoomIn = () => zoomAt(1.6, MAP.x + MAP.w / 2, MAP.y + MAP.h / 2, 300);
	const zoomOut = () => zoomAt(1 / 1.6, MAP.x + MAP.w / 2, MAP.y + MAP.h / 2, 300);
	const reset = () => setView(WHOLE, 600);
	function wheel(node: SVGGElement) {
		const onwheel = (e: WheelEvent) => {
			e.preventDefault();
			const p = toSvg(e, node);
			const f = clamp(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), 0.25, 4);
			zoomAt(f, p.x, p.y);
		};
		node.addEventListener('wheel', onwheel, { passive: false });
		return () => node.removeEventListener('wheel', onwheel);
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const d = (e.shiftKey ? 0.3 : 0.1) / target.z;
		const v = target;
		if (e.key === 'ArrowLeft') setView({ ...v, x: v.x - d });
		else if (e.key === 'ArrowRight') setView({ ...v, x: v.x + d });
		else if (e.key === 'ArrowUp') setView({ ...v, y: v.y - d });
		else if (e.key === 'ArrowDown') setView({ ...v, y: v.y + d });
		else if (e.key === '+' || e.key === '=') zoomIn();
		else if (e.key === '-' || e.key === '_') zoomOut();
		else if (e.key === '0') reset();
		else return;
		e.preventDefault();
	}
	function buttonKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}

	const fmt = (v: number) => v.toFixed(2).replace(/^-/, '−');
	const colour = (c: number) => `var(--emb-c${c})`;
	const dim = $derived(searching && known ? 0.3 : 1);
</script>

{#snippet zbutton(x: number, y: number, label: string, glyph: string, act: () => void)}
	<g
		class="emb-btn"
		role="button"
		tabindex="0"
		aria-label={label}
		onclick={act}
		onkeydown={(e) => buttonKey(e, act)}
	>
		<rect class="ring" x={x - 3} y={y - 3} width="46" height="46" rx="11" />
		<rect {x} {y} width="40" height="40" rx="9" fill="var(--surface)" stroke="var(--border)" />
		<Txt
			x={x + 20}
			y={y + 28}
			text={glyph}
			size={glyph.length > 1 ? 13 : 22}
			anchor="middle"
			weight={600}
			halo={false}
		/>
	</g>
{/snippet}

<g>
	<defs>
		<clipPath id="embmap-clip">
			<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx="12" />
		</clipPath>
	</defs>

	<!-- the map: an interactive 'application' (drag, wheel, keys) -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<g
		class="emb-map"
		class:dragging
		role="application"
		tabindex="0"
		aria-label="Map of {emb?.size ??
			''} words. Drag or use the arrow keys to move, + and − to zoom{searching
			? ', click a dot to search it'
			: ''}."
		{onkeydown}
		{onpointerdown}
		{onpointermove}
		onpointerleave={() => (hover = null)}
		{@attach wheel}
	>
		<rect
			x={MAP.x}
			y={MAP.y}
			width={MAP.w}
			height={MAP.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<g clip-path="url(#embmap-clip)">
			{#if emb}
				<g
					transform="translate({sx(0)} {sy(0)}) scale({scale / U})"
					opacity={dim}
					style:pointer-events="none"
				>
					{#each clusterPaths as p (p.c)}
						<path
							d={p.d}
							fill="none"
							stroke={colour(p.c)}
							stroke-width={dotWidth}
							stroke-linecap="round"
							vector-effect="non-scaling-stroke"
							opacity="0.8"
						/>
					{/each}
				</g>

				<!-- word labels -->
				<Readout id="map-labels">
					<g style:pointer-events="none" opacity={searching && known ? 0.6 : 1}>
						{#each labels as l (l.word)}
							<Txt
								x={l.x}
								y={l.y - 6}
								text={l.word}
								size={11.5}
								anchor="middle"
								weight={searching && known ? 500 : 600}
								muted={searching && known}
							/>
						{/each}
					</g>
				</Readout>

				<!-- the searched word, its neighbours and the lines to them -->
				{#if searching && known}
					{@const q = pt(query)}
					<g style:pointer-events="none">
						{#each neighbours as n, k (n.word)}
							{@const p = pt(n.word)}
							{@const u = reveal(k)}
							{@const kept = closeOnMap?.has(n.word) ?? true}
							<line
								x1={q.x}
								y1={q.y}
								x2={q.x + (p.x - q.x) * u}
								y2={q.y + (p.y - q.y) * u}
								stroke="var(--stage-ink)"
								stroke-width="1.25"
								stroke-dasharray={kept ? undefined : '4 3'}
								opacity={0.55 * u}
							/>
						{/each}
						{#each neighbours as n, k (n.word)}
							{@const p = pt(n.word)}
							{@const u = reveal(k)}
							<g opacity={u}>
								<circle
									cx={p.x}
									cy={p.y}
									r="5"
									fill={colour(emb.clusters[emb.indexOf(n.word)])}
									stroke="var(--surface)"
									stroke-width="1.5"
								/>
							</g>
						{/each}
						<circle
							cx={q.x}
							cy={q.y}
							r={11 + 3 * pulse}
							fill="none"
							stroke="var(--explainer-accent, var(--accent))"
							stroke-width="2"
							opacity={0.5 + 0.4 * (1 - pulse)}
						/>
						<circle
							cx={q.x}
							cy={q.y}
							r="6.5"
							fill="var(--explainer-accent, var(--accent))"
							stroke="var(--surface)"
							stroke-width="2"
						/>
						{#each nbLabels as l, k (l.word)}
							<Txt
								x={l.x}
								y={l.y}
								text={l.word}
								size={k === 0 ? 15 : 12}
								anchor={l.anchor}
								weight={k === 0 ? 700 : 600}
								opacity={k === 0 ? 1 : reveal(l.rank ?? 0)}
							/>
						{/each}
					</g>
				{/if}

				<!-- the word under the pointer -->
				{#if hover && !dragging}
					{@const p = pt(hover)}
					{@const w = hover.length * 7.6 + 18}
					<g style:pointer-events="none">
						<circle
							cx={p.x}
							cy={p.y}
							r="6"
							fill="none"
							stroke="var(--stage-ink)"
							stroke-width="1.5"
						/>
						<rect
							x={p.x - w / 2}
							y={p.y - 36}
							width={w}
							height="24"
							rx="12"
							fill="var(--stage-ink)"
						/>
						<Txt
							x={p.x}
							y={p.y - 19.5}
							text={hover}
							size={13}
							anchor="middle"
							weight={600}
							color="var(--stage-bg)"
							halo={false}
						/>
					</g>
				{/if}
			{:else}
				<Txt
					x={MAP.x + MAP.w / 2}
					y={MAP.y + MAP.h / 2}
					text="Loading 3,292 word vectors…"
					size={15}
					anchor="middle"
					muted
				/>
			{/if}
		</g>
		<rect class="ring" x={MAP.x - 3} y={MAP.y - 3} width={MAP.w + 6} height={MAP.h + 6} rx="15" />
	</g>

	<!-- zoom buttons -->
	{@render zbutton(MAP.x + MAP.w - 52, MAP.y + 12, 'Zoom in', '+', zoomIn)}
	{@render zbutton(MAP.x + MAP.w - 52, MAP.y + 60, 'Zoom out', '−', zoomOut)}
	{#if target.z > 1.01}
		{@render zbutton(MAP.x + MAP.w - 52, MAP.y + 108, 'Show the whole map', '1:1', reset)}
	{/if}
	<Readout id="map-kind">
		<Txt
			x={MAP.x + 14}
			y={MAP.y + MAP.h - 14}
			text="{mix.current < 0.5 ? 't-SNE' : 'PCA'} map · zoom × {target.z.toFixed(1)}"
			size={11}
			muted
		/>
	</Readout>

	<!-- ------------------------------------------------------------------ panel -->
	{#if emb}
		{#if phase === 'map'}
			<Readout
				id="legend-title"
				order={1}
				label="Colours"
				value="12 groups found by k-means in the full 100-D space"
			>
				<Txt x={PL} y={40} text="12 groups, found in 100-D" size={15} weight={700} />
				<Txt x={PL} y={60} text="k-means on the full vectors; each named" size={11} muted />
				<Txt x={PL} y={75} text="by the words nearest its centre" size={11} muted />
			</Readout>
			<Readout id="legend">
				{#each names as n, c (c)}
					<circle cx={PL + 6} cy={100 + c * 38} r="6" fill={colour(c)} />
					<Txt x={PL + 20} y={104 + c * 38} text={n.join(', ')} size={12.5} />
				{/each}
			</Readout>
		{:else if searching}
			<Txt
				x={PL}
				y={34}
				text={phase === 'distort' ? 'True neighbours (100-D)' : 'Search a word'}
				size={15}
				weight={700}
			/>
			<WordInput
				x={PL}
				y={46}
				w={PR - PL}
				value={String(params.query ?? 'king')}
				label="Word to search"
				invalid={!known}
				oninput={(v: string) => setParam('query', v)}
			/>
			{#if known}
				<Readout id="nb-head">
					<Txt x={PL} y={110} text="nearest by cosine" size={11} muted />
					<Txt x={PR} y={110} text="cos θ" size={11} anchor="end" muted />
				</Readout>
				{#each neighbours as n, k (n.word)}
					{@const y = 134 + k * 30}
					{@const kept = closeOnMap?.has(n.word)}
					<Readout
						id="nb-{k}"
						order={10 + k}
						label="{k + 1}. {n.word}"
						value={fmt(n.cos)}
						opacity={k < (phase === 'distort' ? 3 : 4) ? 1 : 0}
					>
						<Txt x={PL} {y} text={String(k + 1)} size={11} muted />
						<Txt x={PL + 20} {y} text={n.word} size={13} weight={600} />
						<rect
							x={PL + 128}
							y={y - 10}
							width={(PR - PL - 176) * clamp(n.cos)}
							height="11"
							rx="3"
							fill="var(--explainer-accent, var(--accent))"
							opacity="0.55"
						/>
						<Txt x={PR} {y} text={fmt(n.cos)} size={12} anchor="end" />
						{#if closeOnMap}
							<Txt
								x={PL + 118}
								{y}
								text={kept ? '●' : '○'}
								size={11}
								anchor="end"
								color={kept ? 'var(--emb-result)' : 'var(--stage-ink-muted)'}
								halo={false}
							/>
						{/if}
					</Readout>
				{/each}
				{#if phase === 'distort'}
					<Readout
						id="kept"
						order={2}
						label="Close on this map"
						value="{keptCount} of {NEIGHBOURS}"
						note="of its 10 true neighbours are among its 10 closest dots"
					>
						<circle cx={PL + 5} cy={443} r="4.5" fill="var(--emb-result)" />
						<Txt
							x={PL + 16}
							y={448}
							text="among its 10 closest dots: {keptCount} of {NEIGHBOURS}"
							size={13}
							weight={600}
						/>
						<circle cx={PL + 5} cy={463} r="4" fill="none" stroke="var(--stage-ink-muted)" />
						<Txt x={PL + 16} y={468} text="not among them (dashed lines)" size={12} muted />
						<Txt x={PL} y={494} text="Every neighbour is computed in the full" size={11} muted />
						<Txt x={PL} y={509} text="100-D space; only the map changes." size={11} muted />
					</Readout>
				{:else}
					<Readout id="search-note">
						<Txt
							x={PL}
							y={448}
							text="Out of our {emb.size.toLocaleString('en-US')} words, computed in the"
							size={11}
							muted
						/>
						<Txt x={PL} y={463} text="full 100-D space, not on the map." size={11} muted />
					</Readout>
				{/if}
			{:else if query.length > 0}
				<Readout
					id="unknown"
					order={2}
					label="Not found"
					value="“{query}” is not among our {emb.size.toLocaleString('en-US')} words"
				>
					<Txt
						x={PL}
						y={112}
						text="“{query}” is not among"
						size={13}
						color="var(--emb-warn)"
						weight={600}
					/>
					<Txt
						x={PL}
						y={130}
						text="our {emb.size.toLocaleString('en-US')} words."
						size={13}
						color="var(--emb-warn)"
						weight={600}
					/>
					{#if suggestions.length}
						<Txt x={PL} y={156} text="Try: {suggestions.join(', ')}" size={12} muted />
					{/if}
				</Readout>
			{/if}
		{:else}
			<!-- summary -->
			<Txt x={PL} y={40} text="Meaning as position" size={16} weight={700} />
			{#each [['Distance stands for similarity:', 'cat and dog, cos θ = 0.88'], ['Directions stand for relationships:', 'man → woman ≈ king → queen'], ['The flat map is only a picture:', 'measure in the full 100-D space']] as [a, b], k (k)}
				{@const y = 84 + k * 70}
				{@const u = reduced ? 1 : smoothstep(0.4 + k * 0.6, 1 + k * 0.6, t)}
				<Readout id="take-{k}" order={k + 1} label={a.replace(':', '')} value={b} opacity={u}>
					<g opacity={u}>
						<circle cx={PL + 8} cy={y - 4} r="8" fill="var(--explainer-accent, var(--accent))" />
						<Txt
							x={PL + 8}
							{y}
							text={String(k + 1)}
							size={11}
							anchor="middle"
							weight={700}
							color="var(--surface)"
							halo={false}
						/>
						<Txt x={PL + 24} {y} text={a} size={13} weight={600} />
						<Txt x={PL + 24} y={y + 20} text={b} size={12} muted />
					</g>
				</Readout>
			{/each}
		{/if}
	{/if}
</g>

<style>
	.emb-map {
		cursor: grab;
		outline: none;
		touch-action: none;
	}
	.emb-map.dragging {
		cursor: grabbing;
	}
	.ring {
		fill: none;
		stroke: transparent;
		stroke-width: 2.5;
	}
	.emb-map:focus-visible .ring,
	.emb-btn:focus-visible .ring {
		stroke: var(--focus);
	}
	.emb-btn {
		cursor: pointer;
		outline: none;
	}
</style>
