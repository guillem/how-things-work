<script lang="ts">
	/**
	 * The random surfer on a small web, with bars for its share of visits and
	 * marks for the exact PageRank. Steps `surfer`, `converge`, `traps`,
	 * `damping`, `build` and `boost` (`step.hints.phase`).
	 *
	 * - The web is the preset `hints.web`; on editable steps (`hints.edit`) the
	 *   reader's own web lives in `params['web:' + step.id]` (serializeWeb), so
	 *   `build` and `boost` keep their own.
	 * - The surfer is a precomputed `walk` (seed = 1 + restarts). The number of
	 *   hops done is the integral of `params.speed` over `t` (the scene guide's
	 *   sanctioned accumulator), reset when the step, the web, d or the seed
	 *   change. Under reduced motion it is fixed at 3000 hops, with no motion.
	 * - At up to 12 hops/s the surfer travels each hop (rest, then glide) and
	 *   leaves a fading trail: solid for a followed link, dashed for a random
	 *   jump. Faster, it sits on its page with a faint flicker of recent hops.
	 * - Ranks use d = `params.damping` only on steps with the damping control;
	 *   elsewhere 0.85 (the param persists across steps).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { tick, untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Label, along, clamp, easeInOut, type Point } from '#lib/draw/index.ts';
	import { startDrag } from '#lib/draw/pointer.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		DAMPING,
		MAX_PAGES,
		PRESETS,
		STARTER,
		addLink,
		addPage,
		hasLink,
		movePage,
		outLinks,
		pageName,
		pagerank,
		parseWeb,
		removeLink,
		removePage,
		serializeWeb,
		visitsAt,
		walk,
		type Web
	} from '../pagerank';
	import { PAGE_FILL, PAGE_STROKE, PANEL, letterSize, linkGeometry, pageRadius } from '../geometry';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- layout -----------------------------------------------------------------
	const PX = PANEL.x; // the bars panel, the same in every scene
	const PY = PANEL.y;
	const PW = PANEL.w;
	const PH = PANEL.h;
	const TX = PX + 40; // bar track
	const TW = 158;
	const AREA = { x0: 70, x1: 610, y0: 70, y1: 528 }; // where page centres may go
	const HOPS = 60_000;
	const REDUCED_HOPS = 3000;
	const ANIMATE_MAX = 12; // hops/s up to which every hop is animated

	// ---- step -------------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'walk'));
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);
	const editable = $derived(step.hints?.edit === true);
	const webKey = $derived('web:' + step.id);
	const preset = $derived(PRESETS[String(step.hints?.web ?? 'example')] ?? PRESETS.example);
	const web = $derived<Web>((editable ? parseWeb(params[webKey]) : null) ?? preset);
	const n = $derived(web.pages.length);
	const d = $derived(has('damping') ? clamp(Number(params.damping ?? DAMPING), 0, 1) : DAMPING);
	// The first step has a slow surfer to watch hop by hop; later steps use a faster default
	// (their own control id, since control values persist across steps).
	const speedId = $derived(has('speedFast') ? 'speedFast' : 'speed');
	const speed = $derived(Math.max(0, Number(params[speedId] ?? 4)));
	const restarts = $derived(Number(params.restart ?? 0));
	const showMarks = $derived(phase !== 'walk');
	// The page to boost keeps its identity when earlier pages are removed (and
	// renamed): its index is kept in `params['target:' + step.id]`, −1 once
	// the page itself is removed.
	const targetKey = $derived('target:' + step.id);
	const target = $derived.by(() => {
		if (phase !== 'boost' || typeof step.hints?.target !== 'number') return -1;
		const stored = params[targetKey];
		return typeof stored === 'number' && typeof params[webKey] === 'string' && params[webKey]
			? stored
			: step.hints.target;
	});
	const targetStart = pagerank(STARTER, DAMPING).rank[4] ?? 0;

	// ---- ranks and sizes ----------------------------------------------------------
	const exact = $derived(pagerank(web, d).rank);
	const out = $derived(outLinks(web));
	const radiusTarget = $derived(exact.map((r) => pageRadius(r, n)));
	const radii = new Tween<number[]>([], { duration: 300, easing: cubicOut });
	$effect(() => {
		const next = radiusTarget;
		untrack(() => {
			const same = radii.current.length === next.length;
			radii.set(next, { duration: same && !reduced ? 300 : 0 });
		});
	});
	const rad = (i: number) => radii.current[i] ?? radiusTarget[i] ?? 16;
	const links = $derived(
		web.links.map(([a, b]) => ({
			a,
			b,
			key: `${a}>${b}`,
			g: linkGeometry(web, a, b, rad(a), rad(b), radii.current)
		}))
	);
	const linkOf = (a: number, b: number) => links.find((l) => l.a === a && l.b === b);

	// ---- the surfer ---------------------------------------------------------------
	const seed = $derived(1 + restarts);
	/** The link structure alone: moving a page changes neither the walk nor the ranks. */
	const topo = $derived(`${n}|${web.links.map(([a, b]) => `${a}>${b}`).join(',')}`);
	const theWalk = $derived.by(() => {
		const dd = d;
		const sd = seed;
		void topo;
		return untrack(() => walk(web, HOPS, dd, sd));
	});
	const runKey = $derived(`${step.id}|${seed}|${topo}|${d}`);

	// Hops done: the integral of the speed control over t (sanctioned
	// accumulator, see the scene guide). Plain `let`s, never `$state`. dt ≤ 0
	// (pause, step restart) and large jumps (tab in background) add nothing.
	let acc = 0;
	let lastT = -1;
	let lastKey = '';
	const hops = $derived.by(() => {
		const key = runKey;
		const now = t;
		if (reduced) return Math.min(HOPS, REDUCED_HOPS);
		if (key !== lastKey) {
			lastKey = key;
			acc = 0;
			lastT = now;
			return 0;
		}
		const dt = now - lastT;
		lastT = now;
		if (dt > 0 && dt < 0.5) acc = Math.min(HOPS, acc + dt * speed);
		return acc;
	});
	const k = $derived(Math.floor(hops));
	const u = $derived(hops - k);
	const animated = $derived(!reduced && speed <= ANIMATE_MAX && k < HOPS);
	const visits = $derived(visitsAt(theWalk, k));
	const shares = $derived(visits.map((v) => v / (k + 1)));
	const here = $derived(n ? theWalk.path[k] : -1);

	/** Where the surfer rests on page i: above the letter (on the rim of a small page). */
	const rest = (i: number): Point => {
		const p = web.pages[i];
		return { x: p.x, y: p.y - Math.max(rad(i) * 0.6, Math.min(rad(i), 16)) };
	};
	/** A random jump: an arc between the two resting points, or a small loop. */
	function jumpPoints(a: number, b: number): Point[] {
		const A = rest(a);
		if (a === b) {
			const c = { x: A.x, y: A.y - 16 };
			return Array.from({ length: 17 }, (_, s) => {
				const ang = Math.PI / 2 + (s / 16) * Math.PI * 2;
				return { x: c.x + 12 * Math.cos(ang), y: c.y + 14 * Math.sin(ang) };
			});
		}
		const B = rest(b);
		const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
		let nx = (B.y - A.y) / len;
		let ny = -(B.x - A.x) / len;
		if (ny > 0) [nx, ny] = [-nx, -ny]; // bow upwards
		const bow = Math.min(90, len * 0.3);
		const c = { x: (A.x + B.x) / 2 + nx * bow, y: (A.y + B.y) / 2 + ny * bow };
		return Array.from({ length: 17 }, (_, s) => {
			const v = s / 16;
			return {
				x: (1 - v) ** 2 * A.x + 2 * (1 - v) * v * c.x + v * v * B.x,
				y: (1 - v) ** 2 * A.y + 2 * (1 - v) * v * c.y + v * v * B.y
			};
		});
	}
	const pointsD = (pts: Point[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

	/** Hop m goes from path[m − 1] to path[m]. */
	function hopShape(m: number) {
		const a = theWalk.path[m - 1];
		const b = theWalk.path[m];
		const jumped = theWalk.jumped[m] === 1 || !linkOf(a, b);
		if (jumped) return { jumped, d: pointsD(jumpPoints(a, b)), pts: jumpPoints(a, b) };
		const g = linkOf(a, b)!.g;
		const pts = [rest(a), ...Array.from({ length: 13 }, (_, s) => g.at(s / 12)), rest(b)];
		return { jumped, d: g.d, pts };
	}

	const trail = $derived.by(() => {
		if (!n || k === 0) return [];
		const count = animated ? 5 : 10;
		const list = [];
		for (let m = k; m >= Math.max(1, k - count + 1); m--) {
			const age = k - m + (animated ? u : 0.5);
			const fade = clamp(1 - age / count);
			list.push({ m, ...hopShape(m), opacity: (animated ? 0.85 : 0.35) * fade });
		}
		return list;
	});

	const surfer = $derived.by((): Point | null => {
		if (!n || here < 0 || here >= n) return null;
		if (!animated) return rest(here);
		const v = clamp((u - 0.35) / 0.65);
		if (v <= 0) return rest(here);
		const shape = hopShape(k + 1);
		return along(shape.pts, easeInOut(v));
	});

	// ---- bars ---------------------------------------------------------------------
	const scaleTarget = $derived(Math.max(0.2, Math.ceil((Math.max(0, ...exact) * 1.2) / 0.1) * 0.1));
	const scale = new Tween(0.4, { duration: 600, easing: cubicOut });
	$effect(() => {
		const s = scaleTarget;
		untrack(() => scale.set(s, { duration: reduced ? 0 : 600 }));
	});
	const barX = (v: number) => TX + TW * clamp(v / scale.current);
	const rowH = $derived(n <= 6 ? 44 : n <= 8 ? 36 : 31);
	const rowsTop = 104;
	const legendY = $derived(rowsTop + n * rowH + 12);
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
	const fmt = (v: number) => v.toLocaleString('en-US');

	// ---- traps ----------------------------------------------------------------------
	const trapTags = $derived(phase === 'traps' || phase === 'damping');
	const capsule = $derived.by(() => {
		if (!trapTags || n < 6) return null;
		const A = web.pages[3];
		const B = web.pages[4];
		const R = Math.max(rad(3), rad(4)) + 10;
		const len = Math.hypot(B.x - A.x, B.y - A.y);
		const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
		return { cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, len, R, ang };
	});

	// ---- editing --------------------------------------------------------------------
	const tool = $derived(String(params.tool ?? 'link'));
	let source = $state<number | null>(null);
	let rubber = $state<{ from: number; x: number; y: number } | null>(null);
	const pageEls: (SVGGElement | null)[] = $state([]);

	function commit(w: Web) {
		setParam(webKey, serializeWeb(w));
	}
	const hit = (p: Point) =>
		web.pages.findIndex((q, i) => Math.hypot(q.x - p.x, q.y - p.y) <= rad(i) + 6);

	/** The candidate spot farthest from every page (and from the panel edge). */
	function freeSpot(w: Web): Point {
		let best: Point = { x: 340, y: 300 };
		if (!w.pages.length) return best;
		let bestD = -1;
		for (let y = AREA.y0 + 20; y <= AREA.y1 - 20; y += 23) {
			for (let x = AREA.x0 + 20; x <= AREA.x1 - 20; x += 27) {
				let m = Infinity;
				for (const q of w.pages) m = Math.min(m, Math.hypot(q.x - x, q.y - y));
				if (m > bestD + 0.5) {
					bestD = m;
					best = { x, y };
				}
			}
		}
		return best;
	}

	// Action buttons arrive as press counts, shared by `build` and `boost` and
	// kept across steps: act on increases only, re-baseline on step changes.
	let seenAdd = untrack(() => Number(params.addPage ?? 0));
	let seenReset = untrack(() => Number(params.resetWeb ?? 0));
	let seenStep = untrack(() => step.id);
	$effect(() => {
		const add = Number(params.addPage ?? 0);
		const reset = Number(params.resetWeb ?? 0);
		const id = step.id;
		untrack(() => {
			if (id !== seenStep || !editable) {
				seenStep = id;
				seenAdd = add;
				seenReset = reset;
				source = null;
				rubber = null;
				return;
			}
			if (reset > seenReset) {
				setParam(webKey, '');
				if (typeof step.hints?.target === 'number') setParam(targetKey, step.hints.target);
				source = null;
			}
			if (add > seenAdd && reset <= seenReset) {
				let w = web;
				for (let c = 0; c < add - seenAdd; c++) w = addPage(w, freeSpot(w));
				commit(w);
			}
			seenAdd = add;
			seenReset = reset;
		});
	});

	function onpagedown(event: PointerEvent, i: number) {
		if (!editable) return;
		if (tool === 'erase') return;
		event.stopPropagation();
		if (tool === 'link') {
			let last: Point = web.pages[i];
			startDrag(
				event,
				(p) => {
					last = p;
					rubber = { from: i, x: p.x, y: p.y };
				},
				() => {
					const j = hit(last);
					rubber = null;
					if (j >= 0 && j !== i) commit(addLink(web, i, j));
				}
			);
		} else if (tool === 'move') {
			const start = web.pages[i];
			let grab: Point | null = null;

			startDrag(event, (p) => {
				if (!grab) grab = { x: start.x - p.x, y: start.y - p.y };
				const x = clamp(p.x + grab.x, AREA.x0, AREA.x1);
				const y = clamp(p.y + grab.y, AREA.y0, AREA.y1);
				commit(movePage(web, i, { x, y }));
			});
		}
	}
	function onpageclick(i: number) {
		if (editable && tool === 'erase') removeAt(i, false);
	}
	function removeAt(i: number, refocus: boolean) {
		const w = removePage(web, i);
		if (target >= 0) setParam(targetKey, i === target ? -1 : i < target ? target - 1 : target);
		commit(w);
		source = null;
		if (refocus && w.pages.length) {
			const j = Math.min(i, w.pages.length - 1);
			tick().then(() => pageEls[j]?.focus());
		}
	}
	function onlinkclick(a: number, b: number) {
		if (editable && tool === 'erase') commit(removeLink(web, a, b));
	}
	function onpagekey(event: KeyboardEvent, i: number) {
		if (!editable) return;
		const key = event.key;
		if (key === 'Enter' || key === ' ') {
			event.preventDefault();
			if (source === null || source >= n) source = i;
			else if (source === i) source = null;
			else {
				commit(hasLink(web, source, i) ? removeLink(web, source, i) : addLink(web, source, i));
				source = null;
			}
		} else if (key === 'Escape') {
			if (source !== null) {
				event.preventDefault();
				source = null;
			}
		} else if (key === 'Delete' || key === 'Backspace') {
			event.preventDefault();
			removeAt(i, true);
		} else if (tool !== 'move' && key.startsWith('Arrow')) {
			// Arrow keys step through the pages (and so never change the step while editing).
			event.preventDefault();
			const dir = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
			pageEls[(i + dir + n) % n]?.focus();
		} else if (tool === 'move' && key.startsWith('Arrow')) {
			event.preventDefault();
			const s = event.shiftKey ? 40 : 10;
			const p = web.pages[i];
			const dx = key === 'ArrowLeft' ? -s : key === 'ArrowRight' ? s : 0;
			const dy = key === 'ArrowUp' ? -s : key === 'ArrowDown' ? s : 0;
			commit(
				movePage(web, i, {
					x: clamp(p.x + dx, AREA.x0, AREA.x1),
					y: clamp(p.y + dy, AREA.y0, AREA.y1)
				})
			);
		}
	}
	const ariaFor = (i: number) => {
		const to = out[i].map(pageName);
		const where = to.length ? `links to ${to.join(', ')}` : 'links nowhere';
		const pending =
			source !== null && source !== i && source < n
				? `. Press Enter to ${hasLink(web, source, i) ? 'remove' : 'add'} the link from ${pageName(source)}`
				: '';
		return `Page ${pageName(i)}, rank ${pct(exact[i] ?? 0)}, ${where}${pending}`;
	};
	const hoverTarget = $derived(rubber ? hit(rubber) : -1);

	const hint = $derived.by(() => {
		if (!n) return 'No pages left: press “Add a page” or “Start again”.';
		if (source !== null && source < n)
			return `Linking from ${pageName(source)}: press Enter on another page (Esc cancels).`;
		if (n >= MAX_PAGES && tool === 'link')
			return 'Ten pages is the most. Drag from one page to another to add a link.';
		if (tool === 'move') return 'Drag a page to move it (or focus it and use the arrow keys).';
		if (tool === 'erase') return 'Click a page or a link to remove it.';
		return 'Drag from one page to another to add a link (or press Enter on two pages).';
	});

	// ---- boost readout ------------------------------------------------------------
	const boost = $derived.by(() => {
		if (target < 0 || target >= n) return null;
		const now = exact[target] ?? 0;
		return { name: pageName(target), now, factor: now / targetStart };
	});
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		pointer-events="none"
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

<g class="surfer-scene" class:editing={editable} data-tool={editable ? tool : undefined}>
	<!-- traps: the dead end and the trap pair -->
	{#if capsule}
		<g pointer-events="none">
			<rect
				x={capsule.cx - capsule.len / 2 - capsule.R}
				y={capsule.cy - capsule.R}
				width={capsule.len + capsule.R * 2}
				height={capsule.R * 2}
				rx={capsule.R}
				transform="rotate({capsule.ang} {capsule.cx} {capsule.cy})"
				fill="color-mix(in srgb, var(--rank-jump) 7%, transparent)"
				stroke="var(--rank-jump)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
			/>
		</g>
	{/if}

	<!-- links -->
	{#each links as l (l.key)}
		<g class="link" class:erasable={editable && tool === 'erase'}>
			<path d={l.g.d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
			<polygon points={l.g.head} fill="var(--stage-ink-muted)" />
			{#if editable && tool === 'erase'}
				<path
					class="hit"
					d={l.g.d}
					fill="none"
					stroke="transparent"
					stroke-width="16"
					role="presentation"
					onclick={() => onlinkclick(l.a, l.b)}
				/>
			{/if}
		</g>
	{/each}

	<!-- the surfer's trail -->
	<g pointer-events="none">
		{#each trail as h (h.m)}
			<path
				d={h.d}
				fill="none"
				stroke={h.jumped ? 'var(--rank-jump)' : 'var(--rank-surfer)'}
				stroke-width={h.jumped ? 2 : 3}
				stroke-dasharray={h.jumped ? '5 5' : undefined}
				stroke-linecap="round"
				opacity={h.opacity}
			/>
		{/each}
	</g>

	<!-- pages -->
	{#each web.pages as p, i (i)}
		{@const r = rad(i)}
		{@const isSource = source === i}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (a button on editable steps only) -->
		<g
			class="page"
			bind:this={pageEls[i]}
			role={editable ? 'button' : undefined}
			tabindex={editable ? 0 : undefined}
			aria-label={editable ? ariaFor(i) : undefined}
			aria-pressed={editable ? isSource : undefined}
			onpointerdown={(e) => onpagedown(e, i)}
			onclick={() => onpageclick(i)}
			onkeydown={(e) => onpagekey(e, i)}
		>
			{#if i === target}
				<circle
					cx={p.x}
					cy={p.y}
					r={r + 8}
					fill="none"
					stroke="var(--rank-target)"
					stroke-width="3"
				/>
			{/if}
			<circle class="focus-ring" cx={p.x} cy={p.y} r={r + 5} fill="none" stroke-width="2" />
			<circle
				cx={p.x}
				cy={p.y}
				{r}
				fill={PAGE_FILL}
				stroke={isSource || hoverTarget === i ? 'var(--rank-surfer)' : 'var(--rank-page)'}
				stroke-width={isSource || hoverTarget === i
					? 3
					: i === here && animated
						? 2.5
						: PAGE_STROKE}
			/>
			{@render txt(p.x, p.y + (r > 24 ? 6 : 5), pageName(i), letterSize(r), {
				anchor: 'middle',
				weight: 700,
				halo: false
			})}
		</g>
	{/each}

	<!-- rubber band while dragging a new link -->
	{#if rubber && rubber.from < n}
		{@const a = web.pages[rubber.from]}
		<g pointer-events="none">
			<line
				x1={a.x}
				y1={a.y}
				x2={rubber.x}
				y2={rubber.y}
				stroke="var(--rank-surfer)"
				stroke-width="2.5"
				stroke-dasharray="6 4"
			/>
			<circle cx={rubber.x} cy={rubber.y} r="5" fill="var(--rank-surfer)" />
		</g>
	{/if}

	<!-- the surfer -->
	{#if surfer}
		<g pointer-events="none">
			<circle
				cx={surfer.x}
				cy={surfer.y}
				r="7"
				fill="var(--rank-surfer)"
				stroke="var(--stage-bg)"
				stroke-width="2"
				filter="url(#glow)"
			/>
		</g>
	{/if}

	<!-- trap tags -->
	{#if capsule}
		<Label
			x={capsule.cx}
			y={Math.abs(capsule.ang) > 45
				? capsule.cy + capsule.len / 2 + capsule.R + 30
				: capsule.cy - capsule.R - 12}
			text="trap: D ⇄ E"
			pill
			color="var(--rank-jump)"
		/>
	{/if}
	{#if trapTags && n >= 6}
		{@const f = web.pages[5]}
		<Label x={f.x} y={f.y + rad(5) + 24} text="dead end: no links" pill />
	{/if}

	<!-- bottom line: trail legend, or the tool hint -->
	{#if editable}
		{@render txt(24, 580, hint, 12, { muted: true })}
	{:else}
		<g pointer-events="none">
			<line
				x1="24"
				x2="52"
				y1="576"
				y2="576"
				stroke="var(--rank-surfer)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{@render txt(60, 580, 'followed a link', 12, { muted: true })}
			<line
				x1="172"
				x2="200"
				y1="576"
				y2="576"
				stroke="var(--rank-jump)"
				stroke-width="2"
				stroke-dasharray="5 5"
			/>
			{@render txt(208, 580, 'random jump', 12, { muted: true })}
		</g>
	{/if}

	<!-- panel -->
	<g pointer-events="none">
		<rect
			x={PX}
			y={PY}
			width={PW}
			height={PH}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(PX + 16, PY + 30, showMarks ? 'Share of visits' : 'Visits to each page', 16, {
			weight: 700,
			halo: false
		})}
		{@render txt(
			PX + 16,
			PY + 52,
			!n
				? 'no pages yet'
				: k === 0
					? `the surfer starts on ${pageName(here)}`
					: `after ${fmt(k)} hop${k === 1 ? '' : 's'}`,
			12,
			{ muted: true, tabular: true, halo: false }
		)}
		{#if !showMarks}
			{@render txt(PX + PW - 14, PY + 76, 'visits', 12, {
				anchor: 'end',
				muted: true,
				halo: false
			})}
		{/if}

		{#each web.pages.map((_, j) => j) as i (i)}
			{@const y = rowsTop + i * rowH}
			{@const share = shares[i] ?? 0}
			{@const on = i === here && animated}
			{@render txt(PX + 18, y + 9, pageName(i), 13, {
				weight: 650,
				halo: false,
				color: i === target ? 'var(--rank-target)' : undefined
			})}
			<rect x={TX} {y} width={TW} height="10" rx="5" fill="var(--stage-grid)" />
			<rect
				x={TX}
				{y}
				width={Math.max(0, barX(share) - TX)}
				height="10"
				rx="5"
				fill={on ? 'var(--rank-surfer)' : 'var(--rank-page)'}
			/>
			{#if showMarks && exact[i] !== undefined}
				{@const mx = barX(exact[i])}
				<line x1={mx} x2={mx} y1={y - 5} y2={y + 15} stroke="var(--stage-ink)" stroke-width="2" />
			{/if}
			{@render txt(PX + PW - 14, y + 9, showMarks ? pct(share) : fmt(visits[i] ?? 0), 12, {
				anchor: 'end',
				tabular: true,
				halo: false
			})}
			<!-- the exact value in words while there is room for it (the tick always shows it) -->
			{#if showMarks && exact[i] !== undefined && rowH >= 40}
				{@render txt(PX + PW - 14, y + 25, `rank ${pct(exact[i])}`, 12, {
					anchor: 'end',
					muted: true,
					tabular: true,
					halo: false
				})}
			{/if}
		{/each}

		<!-- legend -->
		{#if n}
			<rect x={TX} y={legendY} width="22" height="10" rx="5" fill="var(--rank-page)" />
			{@render txt(
				TX + 30,
				legendY + 9,
				showMarks ? 'share of the surfer’s visits' : 'visits so far',
				12,
				{
					muted: true,
					halo: false
				}
			)}
			{#if showMarks}
				<line
					x1={TX + 11}
					x2={TX + 11}
					y1={legendY + 18}
					y2={legendY + 38}
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				{@render txt(TX + 30, legendY + 32, 'exact PageRank', 12, { muted: true, halo: false })}
			{/if}
		{/if}

		<!-- damping readout -->
		{#if has('damping')}
			{@const cy = PY + PH - 92}
			<line x1={PX + 16} x2={PX + PW - 16} y1={cy} y2={cy} stroke="var(--border)" />
			{@render txt(PX + 16, cy + 26, `Follows a link ${Math.round(d * 100)}%`, 13, {
				weight: 600,
				halo: false
			})}
			{@render txt(
				PX + 16,
				cy + 46,
				d >= 1
					? 'never jumps (except from a dead end)'
					: `jumps at random ${Math.round((1 - d) * 100)}%`,
				12,
				{ color: 'var(--rank-jump)', halo: false }
			)}
			{@render txt(
				PX + 16,
				cy + 66,
				d >= 1
					? 'no page is guaranteed any share'
					: `every page gets at least ${pct((1 - d) / Math.max(1, n))}`,
				12,
				{ muted: true, halo: false }
			)}
		{/if}

		<!-- boost readout -->
		{#if phase === 'boost'}
			{@const cy = PY + PH - 92}
			<line x1={PX + 16} x2={PX + PW - 16} y1={cy} y2={cy} stroke="var(--border)" />
			{#if boost}
				{@render txt(PX + 16, cy + 28, `${boost.name}’s rank now ${pct(boost.now)}`, 14, {
					weight: 650,
					color: 'var(--rank-target)',
					halo: false
				})}
				{@render txt(PX + 16, cy + 50, `at the start ${pct(targetStart)}`, 12, {
					muted: true,
					halo: false
				})}
				{@render txt(PX + PW - 16, cy + 72, `×${boost.factor.toFixed(1)}`, 22, {
					anchor: 'end',
					weight: 700,
					color: 'var(--rank-target)',
					tabular: true,
					halo: false
				})}
				{@render txt(PX + 16, cy + 72, 'change since the start', 12, { muted: true, halo: false })}
			{:else}
				{@render txt(PX + 16, cy + 30, 'The page to boost is gone.', 13, {
					weight: 600,
					halo: false
				})}
				{@render txt(PX + 16, cy + 50, 'Press “Start again” to bring it back.', 12, {
					muted: true,
					halo: false
				})}
			{/if}
		{/if}
	</g>
	<!-- the boost readout announces changes to screen readers -->
	{#if boost}
		<text class="sr" x="0" y="0" aria-live="polite" opacity="0"
			>{`${boost.name}’s rank now ${pct(boost.now)}, ×${boost.factor.toFixed(1)} since the start`}</text
		>
	{/if}
</g>

<style>
	.page {
		outline: none;
	}
	.editing .page {
		cursor: pointer;
		touch-action: none;
	}
	[data-tool='move'] .page {
		cursor: grab;
	}
	.focus-ring {
		stroke: transparent;
	}
	.page:focus-visible .focus-ring {
		stroke: var(--focus);
	}
	.hit {
		cursor: pointer;
	}
	.link.erasable:hover path:first-child {
		stroke: var(--rank-target);
	}
</style>
