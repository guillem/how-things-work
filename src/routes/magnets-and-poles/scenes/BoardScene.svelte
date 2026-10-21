<script lang="ts">
	/**
	 * A table seen from above with one or two bar magnets on it (red north end, blue south end).
	 * Everything comes from the pole model: the arrows are the force on each magnet, the compass
	 * needle follows the field plus the Earth's, the iron filings line up along the field, and a
	 * cut magnet's pieces each get two ends. Positions are in centimetres from the board's centre;
	 * a camera (pixels per centimetre and centre) zooms out for the compass. On phones the readouts
	 * move under the stage, so the table fills the whole stage and the camera zooms in.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, hash, smoothstep, startDrag, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import {
		MAGNET_LENGTH,
		SIDE,
		compass,
		cut,
		field,
		force,
		grams,
		inLine,
		magnitude,
		poles,
		pulls,
		type Magnet,
		type Pole
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();
	const readouts = useReadouts();
	/** A phone: the headline and hint are in the panel under the stage, so the table takes it all. */
	const phone = $derived(readouts?.out ?? false);

	const phase = $derived(String(step.hints?.phase ?? 'pull'));
	const L = MAGNET_LENGTH;
	/** Thickness of a bar as seen from above, cm. */
	const THICK = SIDE;

	// ---- where things are, per phase (cm, board centre at 0, 0) --------------------------------
	// Where the two magnets start, 3 cm apart (centred on a phone, where the table is tighter).
	const startA = $derived(phone ? -4.5 : -6);
	const startB = $derived(startA + 9);
	const ax = $derived(Number(params.ax ?? startA));
	const ay = $derived(Number(params.ay ?? 0));
	const bx = $derived(Number(params.bx ?? startB));
	const by = $derived(Number(params.by ?? 0));
	const gap = $derived(Number(params.gap ?? 1));
	const flipped = $derived(params.flip === true);
	const filingsMode = $derived(String(params.filings ?? 'one'));
	const nPieces = $derived(Number(params.pieces ?? 1));
	const cx = $derived(Number(params.cmpx ?? -9));
	const cy = $derived(Number(params.cmpy ?? -5));

	interface Layout {
		ax: number;
		ay: number;
		bx: number;
		by: number;
		bAngle: number;
		bShown: number;
		zoom: number;
	}
	const layout: Layout = $derived.by(() => {
		// Pixels per cm: bigger on a phone, as far as the widest arrangement of the step still fits.
		const near = phone ? 50 : 36;
		const pair = (g: number, flip: boolean): Layout => ({
			ax: -(g / 2 + L / 2),
			ay: 0,
			bx: g / 2 + L / 2,
			by: 0,
			bAngle: flip ? Math.PI : 0,
			bShown: 1,
			zoom: near
		});
		switch (phase) {
			case 'pull':
				return { ax, ay, bx, by, bAngle: 0, bShown: 1, zoom: near };
			case 'push':
				return { ...pair(3, flipped), ax: startA, bx: startB };
			case 'fade':
				// 10 cm apart the two magnets span 22 cm.
				return { ...pair(gap, false), zoom: phone ? 41 : 36 };
			case 'compass':
				return { ax: -16, ay: 0, bx: -16, by: 0, bAngle: 0, bShown: 0, zoom: phone ? 20 : 18 };
			case 'filings':
				return filingsMode === 'one'
					? { ax: 0, ay: 0, bx: 0, by: 0, bAngle: 0, bShown: 0, zoom: near }
					: pair(4, filingsMode === 'push');
			case 'cut':
				return { ax: 0, ay: 0, bx: 0, by: 0, bAngle: 0, bShown: 0, zoom: near };
			default:
				return pair(4, false);
		}
	});

	// Smooth moves between steps; a drag or a control moves things at once.
	const opts = { duration: 750, easing: cubicInOut };
	const pos = new Tween(
		untrack(() => layout),
		opts
	);
	let lastPhase = untrack(() => phase);
	let lastPhone = untrack(() => phone);
	$effect(() => {
		const target = layout;
		const p = phase;
		const ph = phone;
		untrack(() => {
			const instant =
				reduced || ph !== lastPhone || (p === lastPhase && (p === 'pull' || p === 'fade'));
			lastPhase = p;
			lastPhone = ph;
			void pos.set(target, instant ? { duration: 0 } : opts);
		});
	});

	const A: Magnet = $derived({ x: pos.current.ax, y: pos.current.ay, angle: 0, length: L });
	const B: Magnet = $derived({
		x: pos.current.bx,
		y: pos.current.by,
		angle: pos.current.bAngle,
		length: L
	});
	const twoShown = $derived(pos.current.bShown > 0.5);
	const magnets = $derived(phase === 'cut' ? cut(A, nPieces, 1) : twoShown ? [A, B] : [A]);
	/** What is drawn: the right magnet fades out and in between steps. */
	const drawn = $derived(
		phase === 'cut'
			? magnets.map((m) => ({ m, o: 1 }))
			: [{ m: A, o: 1 }, ...(pos.current.bShown > 0.02 ? [{ m: B, o: pos.current.bShown }] : [])]
	);
	const allPoles: Pole[] = $derived(magnets.flatMap((m) => poles(m)));

	// ---- camera ---------------------------------------------------------------------------------
	const U = $derived(pos.current.zoom);
	/** The table, px: under the headline on wide screens, the whole stage on a phone. */
	const board = $derived(
		phone ? { x0: 8, y0: 8, x1: 952, y1: 592 } : { x0: 16, y0: 64, x1: 944, y1: 584 }
	);
	const CX = 480;
	const CY = $derived(phone ? 300 : 330);
	const PX = (x: number) => CX + x * U;
	const PY = (y: number) => CY + y * U;
	/** Visible half-size of the board, cm. */
	const halfW = $derived((board.x1 - CX) / U);
	const halfH = $derived((board.y1 - CY) / U);
	/** Line widths, text sizes and grab margins: thicker on a phone, where the stage is drawn small. */
	const big = $derived(phone ? 1.8 : 1);
	const grab = $derived(phone ? 26 : 8);

	// ---- the pull or push between the two magnets ------------------------------------------------
	const fAB = $derived(twoShown && phase !== 'cut' ? force(A, B) : { x: 0, y: 0 });
	const fMag = $derived(magnitude(fAB));
	const pulling = $derived(twoShown && pulls(A, B));
	/** Arrow length in pixels: a log scale, so both a strong and a faint pull show. */
	const arrowLen = (f: number) => Math.max(0, Math.min(220, 60 * (Math.log10(f) + 3.3)));
	const breathe = $derived(reduced ? 1 : 0.94 + 0.06 * wave(t, 1.6));
	const arrows = $derived.by(() => {
		if (!twoShown || phase === 'cut' || phase === 'filings' || phase === 'next') return [];
		const len = arrowLen(fMag) * breathe;
		if (len < 6) return [];
		const ux = fAB.x / fMag;
		const uy = fAB.y / fMag;
		return [
			{ id: 'b', m: B, dx: ux, dy: uy },
			{ id: 'a', m: A, dx: -ux, dy: -uy }
		].map((a) => {
			// From the end facing away from the tug, so two arrows pulling together never cross.
			const x0 = PX(a.m.x) - a.dx * (L / 2) * U;
			const y0 = PY(a.m.y) - (THICK / 2) * U - 16 * big;
			return { id: a.id, x1: x0, y1: y0, x2: x0 + a.dx * len, y2: y0 + a.dy * len };
		});
	});
	const fadeG = $derived(grams(fMag));
	const atOne = grams(magnitude(force(...inLine(1))));
	const gramsText = (g: number) => (g >= 10 ? `${Math.round(g)} g` : `${g.toFixed(1)} g`);
	const fadeNote = $derived.by(() => {
		if (gap === 1) return 'that is the pull 1 cm apart';
		const r = atOne / fadeG;
		if (r < 1) return `${(1 / r).toFixed(1)} times as strong as 1 cm apart`;
		return `${r < 10 ? r.toFixed(1) : Math.round(r)} times weaker than 1 cm apart`;
	});

	// ---- dragging either magnet (first step) ---------------------------------------------------
	function place(id: 'a' | 'b', x: number, y: number) {
		const other = id === 'a' ? B : A;
		const lx = halfW - L / 2 - 0.3;
		const ly = halfH - THICK / 2 - 0.3;
		let nx = Math.max(-lx, Math.min(lx, x));
		let ny = Math.max(-ly, Math.min(ly, y));
		// Keep the bars from overlapping: push the dragged one out along the shorter way.
		const ox = L + 0.2 - Math.abs(nx - other.x);
		const oy = THICK + 0.4 - Math.abs(ny - other.y);
		if (ox > 0 && oy > 0) {
			if (ox < oy) nx = other.x + Math.sign(nx - other.x || 1) * (L + 0.2);
			else ny = other.y + Math.sign(ny - other.y || 1) * (THICK + 0.4);
		}
		setParam(id + 'x', Math.round(nx * 10) / 10);
		setParam(id + 'y', Math.round(ny * 10) / 10);
	}
	function dragMagnet(e: PointerEvent, id: 'a' | 'b') {
		let first = true;
		let off = { dx: 0, dy: 0 };
		startDrag(e, (p) => {
			const x = (p.x - CX) / U;
			const y = (p.y - CY) / U;
			if (first) {
				off = id === 'a' ? { dx: ax - x, dy: ay - y } : { dx: bx - x, dy: by - y };
				first = false;
			}
			place(id, x + off.dx, y + off.dy);
		});
	}
	function keyMove(e: KeyboardEvent, move: (dx: number, dy: number) => void, stepCm: number) {
		const s = e.shiftKey ? stepCm * 4 : stepCm;
		const d: Record<string, [number, number]> = {
			ArrowRight: [s, 0],
			ArrowLeft: [-s, 0],
			ArrowUp: [0, -s],
			ArrowDown: [0, s]
		};
		const v = d[e.key];
		if (!v) return;
		e.preventDefault();
		e.stopPropagation();
		move(v[0], v[1]);
	}

	// ---- the compass ----------------------------------------------------------------------------
	const COMPASS_R = $derived(phone ? 2.6 : 1.8);
	function placeCompass(x: number, y: number) {
		const lx = halfW - COMPASS_R - 0.5;
		const ly = halfH - COMPASS_R - 0.5;
		let nx = Math.max(-lx, Math.min(lx, x));
		let ny = Math.max(-ly, Math.min(ly, y));
		// Not on top of the magnet.
		const ox = L / 2 + COMPASS_R + 0.3 - Math.abs(nx - A.x);
		const oy = THICK / 2 + COMPASS_R + 0.3 - Math.abs(ny - A.y);
		if (ox > 0 && oy > 0) {
			if (ox < oy) nx = A.x + Math.sign(nx - A.x || 1) * (L / 2 + COMPASS_R + 0.3);
			else ny = A.y + Math.sign(ny - A.y || 1) * (THICK / 2 + COMPASS_R + 0.3);
		}
		setParam('cmpx', Math.round(nx * 2) / 2);
		setParam('cmpy', Math.round(ny * 2) / 2);
	}
	function dragCompass(e: PointerEvent) {
		let first = true;
		let off = { dx: 0, dy: 0 };
		startDrag(e, (p) => {
			const x = (p.x - CX) / U;
			const y = (p.y - CY) / U;
			if (first) {
				off = { dx: cx - x, dy: cy - y };
				first = false;
			}
			placeCompass(x + off.dx, y + off.dy);
		});
	}
	const needle = $derived(compass({ x: cx, y: cy }, poles(A)));
	// The needle swings round smoothly (and the short way).
	const needleAngle = new Tween(
		untrack(() => needle.angle),
		{ duration: 500, easing: cubicInOut }
	);
	$effect(() => {
		const target = needle.angle;
		untrack(() => {
			let a = target;
			const cur = needleAngle.target;
			while (a - cur > Math.PI) a -= 2 * Math.PI;
			while (a - cur < -Math.PI) a += 2 * Math.PI;
			void needleAngle.set(a, reduced ? { duration: 0 } : undefined);
		});
	});
	// The needle quivers for a moment when the step opens, as a real one does when set down.
	const wobble = $derived(reduced ? 0 : 0.35 * Math.exp(-1.6 * t) * Math.sin(9 * t));
	const compassText = $derived(
		needle.vsEarth > 3
			? 'near the magnet: the needle follows the magnet'
			: needle.vsEarth > 0.5
				? 'the magnet and the Earth both turn the needle'
				: 'far away: the Earth wins, and the needle points north'
	);

	// ---- iron filings ---------------------------------------------------------------------------
	const filingsOn = $derived(phase === 'filings' || phase === 'next');
	const settle = $derived(reduced ? 1 : smoothstep(0.2, 1.8, t));
	const filingPaths = $derived.by(() => {
		if (!filingsOn) return ['', '', ''];
		const out = ['', '', ''];
		const sp = 0.5;
		const seg = 0.42;
		const nx = Math.floor(halfW / sp);
		const ny = Math.floor(halfH / sp);
		let k = 0;
		for (let j = -ny; j <= ny; j++) {
			for (let i = -nx; i <= nx; i++) {
				k++;
				const x = i * sp + (hash(k, 3) - 0.5) * sp * 0.8;
				const y = j * sp + (hash(k, 7) - 0.5) * sp * 0.8;
				if (Math.abs(x) > halfW - 0.4 || Math.abs(y) > halfH - 0.4) continue;
				if (
					magnets.some(
						(m) => Math.abs(x - m.x) < m.length / 2 + 0.25 && Math.abs(y - m.y) < THICK / 2 + 0.25
					)
				)
					continue;
				const B = field({ x, y }, allPoles);
				const b = magnitude(B);
				// Where the field is too weak to turn a filing against the paper's grip, it stays where it
				// fell, pointing anywhere: as at the spot between two pushing magnets where their pushes cancel.
				const grip = smoothstep(3e-4, 1.5e-3, b);
				const level = b > 3e-3 ? 0 : b > 1e-3 ? 1 : 2;
				const aim = Math.atan2(B.y, B.x);
				const rand = hash(k, 11) * Math.PI * 2;
				const a = rand + (((aim - rand + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * settle * grip;
				const hx = (Math.cos(a) * seg) / 2;
				const hy = (Math.sin(a) * seg) / 2;
				out[level] +=
					`M${PX(x - hx).toFixed(1)} ${PY(y - hy).toFixed(1)}L${PX(x + hx).toFixed(1)} ${PY(y + hy).toFixed(1)}`;
			}
		}
		return out;
	});
	const filingsText = $derived(
		filingsMode === 'one'
			? 'the lines crowd at the ends and loop from one end to the other'
			: filingsMode === 'pull'
				? 'pulling: the lines run across the gap'
				: 'pushing: the lines bend away, and none cross the gap'
	);

	// ---- cut pieces: the pull across each cut -----------------------------------------------------
	const cutArrows = $derived.by(() => {
		if (phase !== 'cut' || magnets.length < 2) return [];
		return magnets.slice(1).map((m, i) => {
			const left = magnets[i];
			const xGap = (left.x + left.length / 2 + m.x - m.length / 2) / 2;
			return {
				id: i,
				x: PX(xGap),
				y: PY(0) + (THICK / 2) * U + 22 * big,
				pull: pulls(left, m)
			};
		});
	});

	const headline = $derived.by(() => {
		switch (phase) {
			case 'pull':
			case 'push':
				return pulling ? 'pulling together' : 'pushing apart';
			case 'fade':
				return `${gap} cm apart: they pull like a ${gramsText(fadeG)} weight`;
			case 'compass':
				return compassText;
			case 'filings':
				return filingsText;
			case 'cut':
				return nPieces === 1
					? 'one magnet: a red end and a blue end'
					: `${nPieces} pieces: ${nPieces} magnets, each with a red and a blue end`;
			default:
				return 'like ends push apart, unlike ends pull together';
		}
	});
	const subLabel = $derived(phase === 'fade' ? 'Compared' : 'Try');
	const sub = $derived.by(() => {
		switch (phase) {
			case 'pull':
				return 'drag either magnet';
			case 'push':
				return flipped ? 'red faces red' : 'red faces blue';
			case 'fade':
				return fadeNote;
			case 'compass':
				return 'drag the compass';
			default:
				return '';
		}
	});
</script>

<g class="mg-board">
	<!-- the table -->
	<rect
		x={board.x0}
		y={board.y0}
		width={board.x1 - board.x0}
		height={board.y1 - board.y0}
		rx="14"
		fill="var(--mg-board)"
		stroke="var(--border)"
	/>

	<!-- iron filings, darkest where the field is strongest -->
	{#if filingsOn}
		{#each filingPaths as d, i (i)}
			<path
				{d}
				stroke="var(--mg-filing)"
				stroke-width={i === 0 ? 2.2 : 1.8}
				stroke-linecap="round"
				opacity={[0.95, 0.7, 0.32][i]}
				fill="none"
			/>
		{/each}
	{/if}

	<!-- the magnets -->
	{#each drawn as { m, o }, i (i)}
		{@const w = m.length * U}
		{@const h = THICK * U}
		{@const lettered = w >= 50}
		{@const fs = phone ? (U >= 30 ? Math.min(26, U * 0.48) : 16) : U >= 30 ? 17 : 12}
		{@const fy = phone ? fs * 0.36 : U >= 30 ? 6 : 4}
		<g transform="translate({PX(m.x)} {PY(m.y)}) rotate({(m.angle * 180) / Math.PI})" opacity={o}>
			<rect
				x={-w / 2}
				y={-h / 2}
				width={w / 2}
				height={h}
				rx="4"
				fill="var(--mg-south)"
				filter="url(#soft-shadow)"
			/>
			<rect x="0" y={-h / 2} width={w / 2} height={h} rx="4" fill="var(--mg-north)" />
			<rect x={-w / 2 + 3} y={-h / 2} width={w / 2 - 3} height={h} fill="var(--mg-south)" />
			<line x1="0" y1={-h / 2} x2="0" y2={h / 2} stroke="var(--mg-board)" stroke-width="1" />
			{#if lettered}
				<g transform="rotate({(-m.angle * 180) / Math.PI} {w / 4} 0)">
					<text x={w / 4} y={fy} text-anchor="middle" font-size={fs} font-weight="700" fill="#fff"
						>N</text
					>
				</g>
				<g transform="rotate({(-m.angle * 180) / Math.PI} {-w / 4} 0)">
					<text x={-w / 4} y={fy} text-anchor="middle" font-size={fs} font-weight="700" fill="#fff"
						>S</text
					>
				</g>
			{/if}
		</g>
	{/each}

	<!-- on the first step either magnet can be dragged -->
	{#if phase === 'pull'}
		{#each [{ id: 'a' as const, m: A, name: 'Left magnet' }, { id: 'b' as const, m: B, name: 'Right magnet' }] as d (d.id)}
			{@const dist = Math.round(Math.hypot(B.x - A.x, B.y - A.y))}
			<rect
				class="mg-drag"
				x={PX(d.m.x) - (L / 2) * U - grab}
				y={PY(d.m.y) - (THICK / 2) * U - grab}
				width={L * U + 2 * grab}
				height={THICK * U + 2 * grab}
				rx={grab}
				fill="transparent"
				stroke="var(--focus)"
				stroke-width={1.5 * big}
				stroke-dasharray="{5 * big} {5 * big}"
				role="slider"
				tabindex="0"
				aria-label={d.name}
				aria-valuenow={dist}
				aria-valuetext={`${headline}, ${dist} cm between their middles`}
				aria-valuemin={0}
				aria-valuemax={30}
				onpointerdown={(e) => dragMagnet(e, d.id)}
				onkeydown={(e) =>
					keyMove(
						e,
						(dx, dy) =>
							d.id === 'a' ? place('a', ax + dx, ay + dy) : place('b', bx + dx, by + dy),
						0.5
					)}
			/>
		{/each}
	{/if}

	<!-- force arrows: which way each magnet is tugged -->
	{#each arrows as a (a.id)}
		<line
			x1={a.x1}
			y1={a.y1}
			x2={a.x2}
			y2={a.y2}
			stroke={pulling ? 'var(--mg-pull)' : 'var(--mg-push)'}
			stroke-width={5 * big}
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/each}

	<!-- cut pieces pull on each other across every cut -->
	{#each cutArrows as c (c.id)}
		<line
			x1={c.x - 16 * big}
			y1={c.y}
			x2={c.x - 4 * big}
			y2={c.y}
			stroke="var(--mg-pull)"
			stroke-width={3 * big}
			marker-end="url(#arrowhead)"
		/>
		<line
			x1={c.x + 16 * big}
			y1={c.y}
			x2={c.x + 4 * big}
			y2={c.y}
			stroke="var(--mg-pull)"
			stroke-width={3 * big}
			marker-end="url(#arrowhead)"
		/>
	{/each}

	<!-- the compass, which follows the magnet near it and the Earth far away -->
	{#if phase === 'compass'}
		{@const r = COMPASS_R * U}
		{@const nw = 5 * big}
		<g transform="translate({PX(cx)} {PY(cy)})">
			<circle {r} fill="var(--surface)" stroke="var(--stage-ink-muted)" stroke-width={2 * big} />
			<g transform="rotate({((needleAngle.current + wobble) * 180) / Math.PI})">
				<path d="M0 {-nw} L{r - 4 * big} 0 L0 {nw} Z" fill="var(--mg-north)" />
				<path d="M0 {-nw} L{-(r - 4 * big)} 0 L0 {nw} Z" fill="var(--mg-needle)" />
			</g>
			<circle r={3 * big} fill="var(--stage-ink)" />
		</g>
		<circle
			class="mg-drag"
			cx={PX(cx)}
			cy={PY(cy)}
			r={COMPASS_R * U + grab}
			fill="transparent"
			stroke="var(--focus)"
			stroke-width={1.5 * big}
			stroke-dasharray="{5 * big} {5 * big}"
			role="slider"
			tabindex="0"
			aria-label="Compass"
			aria-valuenow={Math.round(Math.hypot(cx - A.x, cy - A.y))}
			aria-valuetext={`${compassText}, ${Math.round(Math.hypot(cx - A.x, cy - A.y))} cm from the magnet`}
			aria-valuemin={0}
			aria-valuemax={60}
			onpointerdown={dragCompass}
			onkeydown={(e) => keyMove(e, (dx, dy) => placeCompass(cx + dx, cy + dy), 1)}
		/>
		<!-- which way is north, and how big the zoomed-out table is -->
		<g transform="translate({phone ? 890 : 900} {phone ? 70 : 120})">
			<line
				x1="0"
				y1={26 * big}
				x2="0"
				y2={-14 * big}
				stroke="var(--stage-ink-muted)"
				stroke-width={3 * big}
				marker-end="url(#arrowhead)"
			/>
			<Label x={0} y={46 * big} text="north" muted size={14 * big} />
		</g>
	{/if}
	{#if U < 30 || phase === 'fade'}
		{@const sy = phone ? 562 : 560}
		<g opacity={U < 30 ? 1 : 0.8}>
			<line
				x1="40"
				y1={sy}
				x2={40 + 10 * U}
				y2={sy}
				stroke="var(--stage-ink-muted)"
				stroke-width={3 * big}
			/>
			{#each [40, 40 + 10 * U] as x (x)}
				<line
					x1={x}
					y1={sy - 7 * big}
					x2={x}
					y2={sy + 7 * big}
					stroke="var(--stage-ink-muted)"
					stroke-width={2 * big}
				/>
			{/each}
			<Label x={40 + 5 * U} y={sy - 14 * big} text="10 cm" muted size={13 * big} />
		</g>
	{/if}

	{#if arrows.length}
		<Readout id="mg-arrow-key">
			<Label
				x={930}
				y={570}
				text="longer arrow, harder pull (drawn squashed)"
				anchor="end"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- readouts -->
	<Readout id="mg-head" order={1} label="Magnets" value={headline}>
		<Label x={480} y={36} text={headline} anchor="middle" size={20} weight={700} tabular />
	</Readout>
	{#if sub}
		<Readout id="mg-sub" order={2} label={subLabel} value={sub}>
			<Label x={480} y={96} text={sub} anchor="middle" size={14} muted tabular />
		</Readout>
	{/if}
</g>

<style>
	.mg-drag {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.mg-drag:focus-visible {
		stroke-width: 3;
	}
</style>
