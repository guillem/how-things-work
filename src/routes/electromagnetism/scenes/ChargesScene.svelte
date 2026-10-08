<script lang="ts">
	/**
	 * Point charges in a plane, at 20 px per cm (the stage is 48 × 30 cm).
	 *
	 * Phases (`step.hints.phase`):
	 *   force — one big charge (`params.charge`, nC) and a draggable +1 nC test
	 *           charge with the Coulomb force on it, rings at 10 and 20 cm
	 *   field — the reader's charges (add, drag, flip, delete) with their field
	 *           lines (`fieldLines` of the model) and the test charge's force
	 *
	 * The reader's charges live in `params['em:charges:<layout>']` as
	 * "x,y,q;…" (stage px, nC) and the test charge in `params['em:test:<layout>']`
	 * as "x,y", written with `setParam`. Field lines are recomputed only when the
	 * charges move; nothing here depends on `t` except a gentle "drag me" pulse.
	 */
	import { untrack } from 'svelte';
	import { clamp } from '#lib/draw/index.ts';
	import { startDrag } from '#lib/draw/pointer.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { fieldAt, fieldLines, type Charge } from '../em';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const PX = 2000; // px per metre
	const NC = 1e-9;
	const Q_TEST = 1; // nC
	const R_CHARGE = 15;
	const MAX = 6;
	const BOX = { x0: 24, y0: 24, x1: 936, y1: 576 };

	interface P {
		x: number;
		y: number;
		q: number;
	}

	const phase = $derived(String(step.hints?.phase ?? 'force'));
	const layout = $derived(String(step.hints?.layout ?? 'single'));
	const PRESETS: Record<string, P[]> = {
		single: [],
		dipole: [
			{ x: 380, y: 310, q: 10 },
			{ x: 620, y: 310, q: -10 }
		]
	};
	const TEST0: Record<string, { x: number; y: number }> = {
		single: { x: 530, y: 300 },
		dipole: { x: 500, y: 190 }
	};
	const BIG = { x: 330, y: 300 };

	// ---- state in params --------------------------------------------------------------
	const chargeKey = $derived(`em:charges:${layout}`);
	const testKey = $derived(`em:test:${layout}`);
	const serialize = (cs: P[]) =>
		cs.map((c) => `${Math.round(c.x)},${Math.round(c.y)},${c.q}`).join(';');
	function parse(s: unknown): P[] | null {
		if (typeof s !== 'string') return null;
		if (s === '') return [];
		const out: P[] = [];
		for (const part of s.split(';')) {
			const [x, y, q] = part.split(',').map(Number);
			if (![x, y, q].every(Number.isFinite)) return null;
			out.push({ x, y, q });
		}
		return out.slice(0, MAX);
	}
	const own = $derived(parse(params[chargeKey]) ?? PRESETS[layout] ?? []);
	const charges: P[] = $derived(
		phase === 'force' ? [{ ...BIG, q: Number(params.charge ?? 10) }] : own
	);
	const test = $derived.by(() => {
		const s = params[testKey];
		if (typeof s === 'string') {
			const [x, y] = s.split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
		}
		return TEST0[layout] ?? { x: 480, y: 200 };
	});
	const save = (cs: P[]) => setParam(chargeKey, serialize(cs));
	const keep = (x: number, y: number) => ({
		x: clamp(x, BOX.x0 + R_CHARGE, BOX.x1 - R_CHARGE),
		y: clamp(y, BOX.y0 + R_CHARGE, BOX.y1 - R_CHARGE)
	});
	const moveTest = (x: number, y: number) => {
		const p = keep(x, y);
		setParam(testKey, `${Math.round(p.x)},${Math.round(p.y)}`);
	};

	// ---- actions: add + / add − / start again ---------------------------------------------
	const SPOTS = [
		{ x: 480, y: 450 },
		{ x: 480, y: 150 },
		{ x: 220, y: 200 },
		{ x: 760, y: 420 },
		{ x: 220, y: 440 },
		{ x: 760, y: 180 },
		{ x: 480, y: 310 }
	];
	function add(q: number) {
		if (own.length >= MAX) return;
		let best = SPOTS[0];
		let bestD = -1;
		for (const s of SPOTS) {
			let d = Math.hypot(s.x - test.x, s.y - test.y);
			for (const c of own) d = Math.min(d, Math.hypot(s.x - c.x, s.y - c.y));
			if (d > bestD) {
				bestD = d;
				best = s;
			}
		}
		save([...own, { ...best, q }]);
	}
	const seen = untrack(() => ({
		plus: Number(params.addPlus ?? 0),
		minus: Number(params.addMinus ?? 0),
		reset: Number(params.resetCharges ?? 0)
	}));
	$effect(() => {
		const plus = Number(params.addPlus ?? 0);
		const minus = Number(params.addMinus ?? 0);
		const reset = Number(params.resetCharges ?? 0);
		untrack(() => {
			if (phase !== 'field') return;
			if (reset !== seen.reset) {
				seen.reset = reset;
				save(PRESETS[layout] ?? []);
				setParam(testKey, `${TEST0[layout].x},${TEST0[layout].y}`);
			}
			if (plus !== seen.plus) {
				seen.plus = plus;
				add(10);
			}
			if (minus !== seen.minus) {
				seen.minus = minus;
				add(-10);
			}
		});
	});
	const full = $derived(own.length >= MAX);

	// ---- the physics -------------------------------------------------------------------------
	const si = $derived<Charge[]>(charges.map((c) => ({ x: c.x / PX, y: c.y / PX, q: c.q * NC })));
	const E = $derived(fieldAt(si, test.x / PX, test.y / PX, (R_CHARGE * 0.6) / PX));
	const Emag = $derived(Math.hypot(E.x, E.y));
	const F = $derived(Emag * Q_TEST * NC); // N
	const lines = $derived.by(() => {
		if (phase !== 'field') return [];
		return fieldLines(si, {
			linesPerUnit: 10,
			unit: 10 * NC,
			bounds: { x0: 0, y0: 0, x1: 960 / PX, y1: 600 / PX },
			step: 4 / PX,
			radius: R_CHARGE / PX,
			maxSteps: 900
		}).map((l, i) => {
			const pts = l.points.map((p) => ({ x: p.x * PX, y: p.y * PX }));
			let d = 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L');
			// Arrowhead partway along, measured from the charge the line touches.
			let len = 0;
			const cum = [0];
			for (let k = 1; k < pts.length; k++) {
				len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
				cum.push(len);
			}
			const at = l.from >= 0 ? Math.min(len / 2, 95) : Math.max(len / 2, len - 95);
			let k = cum.findIndex((c) => c >= at);
			if (k < 1) k = 1;
			const a = pts[k - 1];
			const b = pts[k];
			const ang = Math.atan2(b.y - a.y, b.x - a.x);
			if (pts.length < 2) d = '';
			return { id: i, d, arrow: len > 30 ? { x: b.x, y: b.y, ang } : null };
		});
	});

	// ---- formatting -----------------------------------------------------------------------------
	const sig3 = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
	const fmtForce = (n: number) => (n === 0 ? '0' : `${sig3(n * 1e6)} µN`);
	const fmtField = (v: number) => (v >= 1000 ? `${sig3(v / 1000)} kN/C` : `${v.toFixed(0)} N/C`);
	const fmtQ = (q: number) => (q > 0 ? `+${q} nC` : q < 0 ? `−${-q} nC` : '0 nC');
	const dist = $derived(Math.hypot(test.x - BIG.x, test.y - BIG.y) / 20); // cm

	// Force arrow, proportional (6.67 px per µN), capped.
	const arrow = $derived.by(() => {
		if (F === 0 || !Number.isFinite(F)) return null;
		const L = Math.min(190, F * 1e6 * 6.67);
		const ux = E.x / Emag;
		const uy = E.y / Emag;
		return {
			x2: test.x + ux * L,
			y2: test.y + uy * L,
			ang: Math.atan2(uy, ux),
			capped: F * 1e6 * 6.67 > 190,
			L
		};
	});

	// ---- dragging ------------------------------------------------------------------------------
	let dragging = $state(-2); // −1: test charge, ≥ 0: charge index
	function grabCharge(event: PointerEvent, i: number) {
		const c0 = own[i];
		let moved = false;
		let first: { x: number; y: number } | null = null;
		dragging = i;
		startDrag(
			event,
			(p) => {
				if (!first) first = p;
				if (Math.hypot(p.x - first.x, p.y - first.y) > 3) moved = true;
				if (!moved) return;
				const q = keep(c0.x + p.x - first.x, c0.y + p.y - first.y);
				save(own.map((c, j) => (j === i ? { ...c, ...q } : c)));
			},
			() => {
				dragging = -2;
				if (!moved) flip(i);
			}
		);
	}
	function flip(i: number) {
		save(own.map((c, j) => (j === i ? { ...c, q: -c.q } : c)));
	}
	function chargeKey_(event: KeyboardEvent, i: number) {
		const c = own[i];
		const big = event.shiftKey ? 50 : 10;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-big, 0],
			ArrowRight: [big, 0],
			ArrowUp: [0, -big],
			ArrowDown: [0, big]
		};
		if (moves[event.key]) {
			event.preventDefault();
			const q = keep(c.x + moves[event.key][0], c.y + moves[event.key][1]);
			save(own.map((o, j) => (j === i ? { ...o, ...q } : o)));
		} else if (event.key === 'Enter') {
			event.preventDefault();
			flip(i);
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			save(own.filter((_, j) => j !== i));
		}
	}
	function grabTest(event: PointerEvent) {
		const t0 = test;
		let first: { x: number; y: number } | null = null;
		dragging = -1;
		startDrag(
			event,
			(p) => {
				if (!first) first = p;
				moveTest(t0.x + p.x - first.x, t0.y + p.y - first.y);
			},
			() => (dragging = -2)
		);
	}
	function testKeydown(event: KeyboardEvent) {
		const big = event.shiftKey ? 50 : 10;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-big, 0],
			ArrowRight: [big, 0],
			ArrowUp: [0, -big],
			ArrowDown: [0, big]
		};
		const m = moves[event.key];
		if (!m) return;
		event.preventDefault();
		moveTest(test.x + m[0], test.y + m[1]);
	}

	// A gentle pulse on the test charge at the start of the step: "drag me".
	const pulse = $derived(
		reduced ? 0 : Math.max(0, Math.sin(Math.min(t, 6) * Math.PI)) * (t < 6 ? 1 : 0)
	);

	const cards = $derived(
		phase === 'force'
			? [
					{
						id: 'q',
						label: 'big charge',
						value: fmtQ(Number(params.charge ?? 10)),
						color: Number(params.charge ?? 10) >= 0 ? 'var(--em-plus)' : 'var(--em-minus)'
					},
					{ id: 'r', label: 'distance', value: `${dist.toFixed(1)} cm` },
					{
						id: 'f',
						label: 'force on the test charge',
						value: fmtForce(F),
						color: 'var(--em-force)'
					}
				]
			: [
					{
						id: 'e',
						label: 'field at the test charge',
						value: charges.length ? fmtField(Emag) : '0',
						color: 'var(--em-field)'
					},
					{ id: 'f', label: 'force on +1 nC there', value: fmtForce(F), color: 'var(--em-force)' }
				]
	);
	const CARD = $derived({ x: 16, y: 16, w: phase === 'force' ? 470 : 360, h: 66 });
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

{#snippet head(x: number, y: number, ang: number, size: number, color: string)}
	<path
		d="M{x + Math.cos(ang) * size} {y + Math.sin(ang) * size} L{x + Math.cos(ang + 2.5) * size} {y +
			Math.sin(ang + 2.5) * size} L{x + Math.cos(ang - 2.5) * size} {y +
			Math.sin(ang - 2.5) * size} Z"
		fill={color}
	/>
{/snippet}

<g>
	<!-- field lines -->
	{#each lines as l (l.id)}
		<path d={l.d} fill="none" stroke="var(--em-field)" stroke-width="1.4" opacity="0.75" />
		{#if l.arrow}
			{@render head(l.arrow.x, l.arrow.y, l.arrow.ang, 6, 'var(--em-field)')}
		{/if}
	{/each}

	<!-- distance rings around the big charge -->
	{#if phase === 'force'}
		{#each [10, 20] as cm (cm)}
			<circle
				cx={BIG.x}
				cy={BIG.y}
				r={cm * 20}
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="4 6"
			/>
			{@render txt(BIG.x, BIG.y - cm * 20 - 7, `${cm} cm`, 11, { anchor: 'middle', muted: true })}
		{/each}
	{/if}

	<!-- charges -->
	{#each charges as c, i (i)}
		{@const color = c.q > 0 ? 'var(--em-plus)' : c.q < 0 ? 'var(--em-minus)' : 'var(--em-needle)'}
		{@const r = R_CHARGE + Math.min(8, Math.abs(c.q) / 5)}
		{#if phase === 'field'}
			<g
				class="charge"
				class:dragging={dragging === i}
				role="slider"
				tabindex="0"
				aria-label="{c.q > 0 ? 'Positive' : 'Negative'} charge {i +
					1}: arrows move it, Enter flips its sign, Delete removes it"
				aria-valuenow={Math.round(c.x)}
				aria-valuemin={0}
				aria-valuemax={960}
				aria-valuetext="{fmtQ(c.q)} at {(c.x / 20).toFixed(1)} cm, {(c.y / 20).toFixed(1)} cm"
				onpointerdown={(e) => grabCharge(e, i)}
				onkeydown={(e) => chargeKey_(e, i)}
			>
				<circle cx={c.x} cy={c.y} r={r + 12} fill="transparent" />
				<circle
					class="ring"
					cx={c.x}
					cy={c.y}
					r={r + 5}
					fill="none"
					stroke="var(--focus)"
					stroke-width="2"
				/>
				<circle cx={c.x} cy={c.y} {r} fill={color} stroke="var(--stage-bg)" stroke-width="2" />
				<text
					x={c.x}
					y={c.y + 6}
					text-anchor="middle"
					font-weight="700"
					style:font-size="19px"
					style:fill="#fff">{c.q > 0 ? '+' : '−'}</text
				>
			</g>
		{:else}
			<circle cx={c.x} cy={c.y} {r} fill={color} stroke="var(--stage-bg)" stroke-width="2" />
			<text
				x={c.x}
				y={c.y + 6}
				text-anchor="middle"
				font-weight="700"
				style:font-size="19px"
				style:fill="#fff">{c.q > 0 ? '+' : c.q < 0 ? '−' : '0'}</text
			>
			{@render txt(c.x, c.y + r + 18, fmtQ(c.q), 12, { anchor: 'middle', weight: 600, color })}
		{/if}
	{/each}

	<!-- force on the test charge -->
	{#if arrow}
		<line
			x1={test.x}
			y1={test.y}
			x2={arrow.x2 - Math.cos(arrow.ang) * 8}
			y2={arrow.y2 - Math.sin(arrow.ang) * 8}
			stroke="var(--em-force)"
			stroke-width="3.5"
			stroke-linecap="round"
		/>
		{@render head(arrow.x2, arrow.y2, arrow.ang, 11, 'var(--em-force)')}
	{/if}
	<g
		class="charge"
		class:dragging={dragging === -1}
		role="slider"
		tabindex="0"
		aria-label="Test charge, +1 nC: drag it or use the arrow keys"
		aria-valuenow={Math.round(test.x)}
		aria-valuemin={0}
		aria-valuemax={960}
		aria-valuetext="force {fmtForce(F)}"
		onpointerdown={grabTest}
		onkeydown={testKeydown}
	>
		<circle cx={test.x} cy={test.y} r="22" fill="transparent" />
		<circle
			cx={test.x}
			cy={test.y}
			r={13 + 6 * pulse}
			fill="var(--em-test)"
			opacity={0.25 * pulse}
		/>
		<circle
			class="ring"
			cx={test.x}
			cy={test.y}
			r="14"
			fill="none"
			stroke="var(--focus)"
			stroke-width="2"
		/>
		<circle
			cx={test.x}
			cy={test.y}
			r="9"
			fill="var(--em-test)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<text
			x={test.x}
			y={test.y + 4}
			text-anchor="middle"
			font-weight="700"
			style:font-size="12px"
			style:fill="#000">+</text
		>
	</g>
	{@render txt(
		test.x + (arrow && Math.cos(arrow.ang) > 0.3 ? -16 : 16),
		test.y + (arrow && Math.sin(arrow.ang) > 0.5 ? -14 : 26),
		'test charge',
		12,
		{
			anchor: arrow && Math.cos(arrow.ang) > 0.3 ? 'end' : 'start',
			weight: 600,
			color: 'var(--em-test)'
		}
	)}

	{#if phase === 'field' && charges.length === 0}
		{@render txt(480, 300, 'No charges, no field: add some', 15, { anchor: 'middle', muted: true })}
	{/if}
	{#if phase === 'field' && full}
		{@render txt(944, 584, `at most ${MAX} charges`, 11, { anchor: 'end', muted: true })}
	{/if}

	<!-- readout card -->
	<g style:pointer-events="none">
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each cards as c, i (c.id)}
			{@const w = CARD.w / cards.length}
			{@const x = CARD.x + 16 + i * w}
			{#if i > 0}
				<line
					x1={CARD.x + i * w}
					x2={CARD.x + i * w}
					y1={CARD.y + 14}
					y2={CARD.y + CARD.h - 14}
					stroke="var(--border)"
				/>
			{/if}
			<text {x} y={CARD.y + 25} class="muted" style:font-size="12px">{c.label}</text>
			<text {x} y={CARD.y + 51} font-weight="700" style:font-size="19px" style:fill={c.color}
				>{c.value}</text
			>
		{/each}
	</g>
</g>

<style>
	.charge {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.charge.dragging {
		cursor: grabbing;
	}
	.ring {
		opacity: 0;
	}
	.charge:focus-visible .ring {
		opacity: 1;
	}
</style>
