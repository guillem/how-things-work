<script lang="ts">
	/**
	 * The molecule builder: a centre atom and the atoms bonded to it, drawn in 3D (ball and
	 * stick, orthographic, z up) from `analyse()` in ../model.ts, turnable by dragging the
	 * empty space or with the arrow keys, and turning slowly by itself (a pure function of
	 * t; still under reduced motion).
	 *
	 * Modes (`step.hints.mode`):
	 * - build / shapes / polar: the reader's molecule lives in `params['mol:<step id>']`
	 *   (`serialize()`), starting from `hints.start`. Atoms are added from the palette on the
	 *   left (drag onto the molecule, or click / Enter), removed by clicking them; the centre
	 *   is picked in the row at the top; the chips at the bottom load examples.
	 *   `shapes` adds the family of shapes to the readout, `polar` the charge map
	 *   (`params.charges`) and the polarity verdict.
	 * - compare: CH4 / NH3 / H2O from `params.lpMol`, with their bond angles side by side.
	 *
	 * Transitions: every electron domain has an id (b<ligand>, l<k> lone pair, s<k> unpaired
	 * electron). When the molecule changes, each domain turns from where it was to its new
	 * direction (one Tween, wall-clock time, a reaction to a control); a new domain starts
	 * where a vanished one was, so a new atom flies in onto the unpaired electron it pairs
	 * with.
	 *
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, smoothstep, startDrag, toSvg, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CENTRES,
		TERMINALS,
		analyse,
		capacity,
		parse,
		refusal,
		serialize,
		type Molecule,
		type Sym,
		type Vec
	} from '../model';
	import { ATOM, NEG, POS, atomRadius, bondLength, projector, slerpish } from '../look';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'build'));
	const editable = $derived(mode !== 'compare');
	const paramKey = $derived(`mol:${step.id}`);

	const COMPARE: Record<string, Molecule> = {
		CH4: { centre: 'C', ligands: ['H', 'H', 'H', 'H'] },
		NH3: { centre: 'N', ligands: ['H', 'H', 'H'] },
		H2O: { centre: 'O', ligands: ['H', 'H'] }
	};
	const molecule = $derived.by((): Molecule => {
		if (mode === 'compare') return COMPARE[String(params.lpMol ?? 'H2O')] ?? COMPARE.H2O;
		const start = parse(String(step.hints?.start ?? 'C:'), { centre: 'C', ligands: [] });
		const saved = params[paramKey];
		return parse(typeof saved === 'string' ? saved : null, start);
	});
	const molKey = $derived(serialize(molecule));
	const a = $derived(analyse(molecule));
	const charges = $derived(mode === 'polar' && params.charges !== false);

	// ---- editing ----------------------------------------------------------------------------
	let notice = $state<string | null>(null);
	const save = (m: Molecule) => {
		notice = null;
		setParam(paramKey, serialize(m));
	};
	function add(sym: Sym) {
		const why = refusal(molecule, sym);
		if (why) {
			notice = why;
			return;
		}
		save({ centre: molecule.centre, ligands: [...molecule.ligands, sym] });
	}
	function removeAt(i: number) {
		save({ centre: molecule.centre, ligands: molecule.ligands.filter((_, j) => j !== i) });
	}
	const setCentre = (c: Sym) => save({ centre: c, ligands: [] });
	const load = (s: string) => save(parse(s, molecule));
	const onKey = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	// ---- 3D view ------------------------------------------------------------------------------
	const CX = 410;
	const CY = 292;
	let yawOff = $state(0);
	let pitch = $state(0.3);
	// The slow turn pauses while the pointer is over the pad or an atom, so atoms hold still
	// to be clicked. The atoms are drawn over the pad, not inside it: stepping onto one
	// leaves the pad, so each atom holds too (leave-then-enter at the same t resumes
	// nothing). Event handlers may read t; effects never do.
	let pausedAt = $state<number | null>(null);
	let shift = $state(0);
	const hold = () => {
		if (pausedAt === null) pausedAt = t;
	};
	const release = () => {
		if (pausedAt === null) return;
		shift += 0.12 * (t - pausedAt);
		pausedAt = null;
	};
	const yaw = $derived(yawOff + 0.55 + (reduced ? 0 : 0.12 * (pausedAt ?? t) - shift));
	const project = $derived(projector(yaw, pitch, CX, CY));

	// ---- transitions between molecules ---------------------------------------------------------
	interface Dom {
		id: string;
		kind: 'bond' | 'lone' | 'single';
		ligand?: number;
		dir: Vec;
	}
	const targets = $derived.by((): Dom[] => {
		const count = { lone: 0, single: 0 };
		return a.domains.map((d) => {
			const id =
				d.kind === 'bond'
					? `b${d.ligand}`
					: d.kind === 'lone'
						? `l${count.lone++}`
						: `s${count.single++}`;
			return { id, kind: d.kind, ligand: d.ligand, dir: d.dir };
		});
	});
	const prog = new Tween(1, { duration: 700, easing: cubicInOut });
	let from = $state.raw<Record<string, Vec>>({});
	let fresh = $state.raw<string[]>([]);
	let lastTargets: Record<string, Vec> = {};
	let shownKey = '';
	$effect.pre(() => {
		const key = molKey;
		const next = targets;
		untrack(() => {
			if (key === shownKey) return;
			const first = shownKey === '';
			shownKey = key;
			// Where each domain is now (mid-transition included).
			const now: Record<string, Vec> = {};
			for (const [id, to] of Object.entries(lastTargets))
				now[id] = slerpish(from[id] ?? to, to, prog.current);
			const vanished = Object.keys(now).filter((id) => !next.some((d) => d.id === id));
			const start: Record<string, Vec> = {};
			const added: string[] = [];
			for (const d of next) {
				if (now[d.id]) start[d.id] = now[d.id];
				else {
					// Prefer an unpaired electron that disappeared (the new atom pairs with it).
					const k = vanished.findIndex((id) => id.startsWith('s'));
					const v = vanished.splice(k >= 0 ? k : 0, 1)[0];
					start[d.id] = v ? now[v] : d.dir;
					if (!first) added.push(d.id);
				}
			}
			from = start;
			fresh = added;
			lastTargets = Object.fromEntries(next.map((d) => [d.id, d.dir]));
			prog.set(0, { duration: 0 });
			prog.set(1, { duration: reduced || first ? 0 : 700 });
		});
	});

	// Zoom so that small molecules fill the view and large ones fit (tweened between).
	const zoomTarget = $derived(
		clamp(
			170 / Math.max(100, ...molecule.ligands.map((l) => bondLength(molecule.centre, l, 1))),
			1,
			1.75
		)
	);
	const zoom = Tween.of(() => zoomTarget, { duration: 600, easing: cubicInOut });
	const ballK = $derived(0.55 + 0.5 * zoom.current);
	const centreR = $derived(atomRadius(molecule.centre, ballK));
	interface Drawn {
		key: string;
		depth: number;
		kind: 'atom' | 'bond' | 'lone' | 'single';
		x: number;
		y: number;
		x2?: number;
		y2?: number;
		r?: number;
		sym?: Sym;
		ligand?: number;
		order?: number;
		angle?: number;
		stretch?: number;
		opacity: number;
		charge?: number;
	}
	const scene = $derived.by(() => {
		const p = prog.current;
		const items: Drawn[] = [];
		const c = project([0, 0, 0]);
		items.push({
			key: 'centre',
			depth: 0,
			kind: 'atom',
			x: c.x,
			y: c.y,
			r: centreR,
			sym: molecule.centre,
			opacity: 1,
			charge: a.charges[0]
		});
		const ligandPos: Record<number, Vec> = {};
		for (const d of targets) {
			const dir = slerpish(from[d.id] ?? d.dir, d.dir, p);
			const isNew = fresh.includes(d.id);
			const op = isNew ? smoothstep(0, 0.35, p) : 1;
			if (d.kind === 'bond' && d.ligand !== undefined) {
				const sym = molecule.ligands[d.ligand];
				const L =
					bondLength(molecule.centre, sym, zoom.current, a.orders[d.ligand]) *
					(isNew ? lerp(1.9, 1, p) : 1);
				const v: Vec = [dir[0] * L, dir[1] * L, dir[2] * L];
				ligandPos[d.ligand] = v;
				const s = project(v);
				items.push({
					key: d.id,
					depth: s.depth,
					kind: 'atom',
					x: s.x,
					y: s.y,
					r: atomRadius(sym, ballK),
					sym,
					ligand: d.ligand,
					opacity: op,
					charge: a.charges[d.ligand + 1]
				});
				items.push({
					key: `${d.id}-bond`,
					depth: s.depth / 2 - 0.01,
					kind: 'bond',
					x: c.x,
					y: c.y,
					x2: s.x,
					y2: s.y,
					r: atomRadius(sym, ballK),
					order: a.orders[d.ligand],
					opacity: op
				});
			} else {
				const L = centreR + (d.kind === 'lone' ? 30 : 20);
				const s = project([dir[0] * L, dir[1] * L, dir[2] * L]);
				const dx = s.x - c.x;
				const dy = s.y - c.y;
				items.push({
					key: d.id,
					// Drawn over the centre atom unless well behind it: they sit on its surface.
					depth: s.depth + L * 0.7,
					kind: d.kind,
					x: s.x,
					y: s.y,
					angle: (Math.atan2(dy, dx) * 180) / Math.PI,
					stretch: Math.hypot(dx, dy) / L,
					opacity: op
				});
			}
		}
		items.sort((m, n) => m.depth - n.depth);
		return { items, ligandPos };
	});

	// ---- the angle arc --------------------------------------------------------------------------
	// Screen-space angle of a 3D direction from the centre.
	const dirAngle = (v: Vec) => {
		const s = project(v);
		return Math.atan2(s.y - CY, s.x - CX);
	};
	const wrap = (x: number) =>
		((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
	const arc = $derived.by(() => {
		if (!a.complete || molecule.ligands.length < 2 || prog.current < 0.98) return null;
		const m = a.measured[0];
		const value = m?.degrees ?? a.ideal;
		if (value == null || value === 180) return null;
		const want = m?.between ?? [molecule.ligands[0], molecule.ligands[1]];
		const i = molecule.ligands.findIndex((l) => l === want[0]);
		const j = molecule.ligands.findIndex((l, k) => k !== i && l === want[1]);
		const pi = scene.ligandPos[i];
		const pj = scene.ligandPos[j];
		if (!pi || !pj) return null;
		const ui = slerpish(pi, pi, 1);
		const uj = slerpish(pj, pj, 1);
		const R = centreR + 30;
		const pts: Point[] = [];
		for (let k = 0; k <= 16; k++) {
			const v = slerpish(ui, uj, k / 16);
			const s = project([v[0] * R, v[1] * R, v[2] * R]);
			pts.push({ x: s.x, y: s.y });
		}
		const mid = slerpish(ui, uj, 0.5);
		const lab = project([mid[0] * (R + 30), mid[1] * (R + 30), mid[2] * (R + 30)]);
		const chord = Math.hypot(pts[0].x - pts[16].x, pts[0].y - pts[16].y);
		// How far the nearest other domain sits from the projected wedge (radians;
		// negative when one falls inside it: the arc would cross its bond or blob).
		// The wedge runs from ui's screen angle through mid's to uj's and can span more than
		// half a turn on screen, so each domain's angle is counted from the wedge's start all
		// the way round (`sense` makes the wedge's direction positive).
		const ai = dirAngle(ui);
		const am = wrap(dirAngle(mid) - ai);
		let span = wrap(dirAngle(uj) - ai);
		if (Math.sign(am) !== Math.sign(span) || Math.abs(am) > Math.abs(span))
			span += span > 0 ? -2 * Math.PI : 2 * Math.PI;
		const sense = span < 0 ? -1 : 1;
		const width = Math.abs(span);
		let room = Infinity;
		for (const d of targets) {
			if (d.kind === 'bond' && (d.ligand === i || d.ligand === j)) continue;
			// A domain pointing (nearly) at or away from the viewer has no meaningful screen
			// angle, and it is drawn over or behind the centre atom, clear of the arc.
			const s = project(d.dir);
			if (Math.hypot(s.x - CX, s.y - CY) < 0.35) continue;
			const rel =
				(((sense * (dirAngle(d.dir) - ai)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
			const clear =
				rel < width ? -Math.min(rel, width - rel) : Math.min(rel - width, 2 * Math.PI - rel);
			room = Math.min(room, clear);
		}
		return {
			d: 'M' + pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('L'),
			x: lab.x,
			y: lab.y + 4,
			label: `${value === 180 ? '180' : value.toFixed(1)}°`,
			// Fade out when the arc is seen edge-on (a thin sliver) or when another bond or
			// lone pair projects into the wedge (the arc would cross it).
			opacity: smoothstep(14, 32, chord) * smoothstep(0.05, 0.22, room)
		};
	});

	// ---- polarity arrow -------------------------------------------------------------------------
	const dipole = $derived.by(() => {
		if (!a.polar) return null;
		let v = a.dipole;
		if (Math.hypot(...v) < 0.05) {
			// Bonds cancel (or nearly): the lone pairs set the negative end.
			v = [0, 0, 0];
			for (const d of a.domains)
				if (d.kind === 'lone') v = [v[0] + d.dir[0], v[1] + d.dir[1], v[2] + d.dir[2]];
		}
		const l = Math.hypot(...v) || 1;
		const u: Vec = [v[0] / l, v[1] / l, v[2] / l];
		const L = 150;
		const tail = project([-u[0] * L * 0.75, -u[1] * L * 0.75, -u[2] * L * 0.75]);
		const head = project([u[0] * L, u[1] * L, u[2] * L]);
		const len2d = Math.hypot(head.x - tail.x, head.y - tail.y);
		return { tail, head, ang: Math.atan2(head.y - tail.y, head.x - tail.x), len2d };
	});

	// Colour of an atom's patch on the charge map.
	const chargeFill = (q: number) => (q < 0 ? NEG : POS);
	const chargeOpacity = (q: number) => 0.12 + 0.6 * clamp(Math.abs(q) / 1.4);

	/** Distance from (px, py) to the segment (x1, y1)–(x2, y2). */
	const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const l2 = dx * dx + dy * dy;
		const u = l2 ? clamp(((px - x1) * dx + (py - y1) * dy) / l2) : 0;
		return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
	};

	// Where the centre atom's charge label goes: the direction around the ball with the
	// most room, so it lands neither on a bond line nor on a lone pair.
	const centreLabel = $derived.by(() => {
		const bonds = scene.items.filter((it) => it.kind === 'bond');
		const blobs = scene.items.filter((it) => it.kind !== 'bond' && it.key !== 'centre');
		let best = -Math.PI / 2;
		let room = -Infinity;
		for (let k = 0; k < 24; k++) {
			const a0 = (k / 24) * 2 * Math.PI;
			const px = CX + Math.cos(a0) * (centreR + 15);
			const py = CY + Math.sin(a0) * (centreR + 15);
			let clear = 1.5 * Math.cos(a0 + Math.PI / 2); // prefer up on ties
			for (const b of bonds)
				clear = Math.min(clear, segDist(px, py, b.x, b.y, b.x2 ?? b.x, b.y2 ?? b.y) - 5);
			for (const bl of blobs)
				clear = Math.min(
					clear,
					Math.hypot(px - bl.x, py - bl.y) - (bl.kind === 'lone' ? 24 : (bl.r ?? 20))
				);
			if (clear > room) {
				room = clear;
				best = a0;
			}
		}
		return { x: CX + Math.cos(best) * (centreR + 15), y: CY + Math.sin(best) * (centreR + 15) };
	});

	// ---- dragging: turning the view, and atoms from the palette ---------------------------------
	let last: Point | null = null;
	function turn(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (last) {
					yawOff += (p.x - last.x) * 0.012;
					pitch = clamp(pitch + (p.y - last.y) * 0.012, -1.4, 1.4);
				}
				last = p;
			},
			() => (last = null)
		);
	}
	function turnKey(e: KeyboardEvent) {
		const k = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') yawOff -= k;
		else if (e.key === 'ArrowRight') yawOff += k;
		else if (e.key === 'ArrowUp') pitch = clamp(pitch - k, -1.4, 1.4);
		else if (e.key === 'ArrowDown') pitch = clamp(pitch + k, -1.4, 1.4);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	const PX = 62; // palette column
	const palette = TERMINALS.map((sym, i) => ({ sym, x: PX, y: 160 + i * 70 }));
	let drag = $state<{ sym: Sym; x: number; y: number; x0: number; y0: number } | null>(null);
	function grab(e: PointerEvent, sym: Sym) {
		const p0 = toSvg(e, e.currentTarget as Element);
		startDrag(
			e,
			(p) => (drag = { sym, x: p.x, y: p.y, x0: p0.x, y0: p0.y }),
			() => {
				const d = drag;
				drag = null;
				if (!d) return;
				const moved = Math.hypot(d.x - d.x0, d.y - d.y0) > 8;
				if (!moved || Math.hypot(d.x - CX, d.y - CY) < 230) add(sym);
			}
		);
	}
	const dropHot = $derived(drag != null && Math.hypot(drag.x - CX, drag.y - CY) < 230);

	const examples = [
		{ s: 'O:H,H', label: 'H₂O' },
		{ s: 'N:H,H,H', label: 'NH₃' },
		{ s: 'C:H,H,H,H', label: 'CH₄' },
		{ s: 'C:O,O', label: 'CO₂' },
		{ s: 'C:H,N', label: 'HCN' },
		{ s: 'C:H,H,O', label: 'CH₂O' },
		{ s: 'C:Cl,Cl,Cl,Cl', label: 'CCl₄' },
		{ s: 'C:H,H,H,Cl', label: 'CH₃Cl' },
		{ s: 'N:N', label: 'N₂' }
	];

	// ---- readout ----------------------------------------------------------------------------------
	const RX = 664;
	const status = $derived.by(() => {
		if (notice) return { text: notice, warn: true };
		if (a.complete) return { text: 'Every outer shell is full.', warn: false };
		if (!molecule.ligands.length)
			return {
				text: `${molecule.centre} has ${a.open} unpaired electron${a.open === 1 ? '' : 's'}: add atoms.`,
				warn: false
			};
		return {
			text: `${a.open} more bond${a.open === 1 ? '' : 's'} to fill ${molecule.centre}'s shell.`,
			warn: false
		};
	});
	const pairsLine = $derived(
		`${molecule.ligands.length} bonded atom${molecule.ligands.length === 1 ? '' : 's'}, ${a.lone} lone pair${a.lone === 1 ? '' : 's'}`
	);
	const angleLine = $derived.by(() => {
		if (!a.complete || molecule.ligands.length < 2) return null;
		const m = a.measured[0];
		if (m) {
			const v = m.degrees === 180 ? '180' : m.degrees.toFixed(1);
			return {
				main: `${m.between[0]}–${molecule.centre}–${m.between[1]} angle: ${v}°`,
				note: a.bySymmetry ? 'exact, fixed by the symmetry' : 'measured (NIST CCCBDB)'
			};
		}
		return {
			main: `Angle: about ${a.ideal === 180 ? '180' : (a.ideal ?? 0).toFixed(1)}°`,
			note: 'ideal VSEPR angle (no measured value here)'
		};
	});

	const FAMILY = [
		{ shape: 'linear', dom: '2 domains, 0 lone', ex: 'CO₂, HCN' },
		{ shape: 'trigonal planar', dom: '3 domains, 0 lone', ex: 'CH₂O' },
		{ shape: 'tetrahedral', dom: '4 domains, 0 lone', ex: 'CH₄' },
		{ shape: 'trigonal pyramidal', dom: '4 domains, 1 lone', ex: 'NH₃' },
		{ shape: 'bent', dom: '4 domains, 2 lone (or 3, 1)', ex: 'H₂O' }
	];
	const compareRows = $derived(
		(['CH4', 'NH3', 'H2O'] as const).map((k) => {
			const r = analyse(COMPARE[k]);
			return {
				k,
				label: r.formula,
				lone: r.lone,
				deg: r.measured[0].degrees,
				on: String(params.lpMol ?? 'H2O') === k
			};
		})
	);
	const degX = (d: number) => RX + 10 + ((d - 100) / 10) * 250;

	// Phone readouts: the readout column as rows under the stage.
	const shapeNote = $derived.by(() => {
		const parts: string[] = [];
		if (angleLine) parts.push(`${angleLine.main}, ${angleLine.note}`);
		if (mode === 'shapes') {
			const f = FAMILY.find((f) => f.shape === a.shape);
			if (f && molecule.ligands.length > 1) parts.push(`${f.dom}, like ${f.ex}`);
		}
		return parts.join(' · ') || undefined;
	});
	const compareValue = $derived(
		compareRows.map((r) => `${r.label} ${r.deg.toFixed(1)}°`).join(' · ')
	);
	const compareNote = $derived(
		`lone pairs ${compareRows.map((r) => r.lone).join(' · ')}; measured (NIST CCCBDB)`
	);
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
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet ball(x: number, y: number, r: number, sym: Sym, dim = false)}
	<g opacity={dim ? 0.4 : 1}>
		<circle cx={x} cy={y} {r} fill={ATOM[sym].fill} stroke={ATOM[sym].edge} stroke-width="1.5" />
		<circle
			cx={x - r * 0.32}
			cy={y - r * 0.34}
			r={r * 0.38}
			fill="#ffffff"
			opacity={sym === 'H' ? 0.5 : 0.22}
		/>
		<text
			{x}
			y={y + r * 0.36}
			text-anchor="middle"
			font-weight="700"
			font-size={Math.max(11, r * 0.95)}
			style:fill={ATOM[sym].ink}>{sym}</text
		>
	</g>
{/snippet}

<g>
	<!-- drag / keyboard target for turning the molecule -->
	<rect
		class="turn"
		x={CX - 240}
		y={CY - 240}
		width="480"
		height="480"
		rx="16"
		fill={dropHot ? 'var(--stage-grid)' : 'transparent'}
		role="slider"
		tabindex="0"
		aria-label="Turn the molecule: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360}
		onpointerdown={turn}
		onkeydown={turnKey}
		onpointerenter={hold}
		onpointerleave={release}
	/>

	<!-- the charge map: a soft coloured patch around every atom -->
	{#if charges && a.complete}
		<g opacity="0.9" style:pointer-events="none">
			{#each scene.items.filter((it) => it.kind === 'atom') as it (it.key)}
				<circle
					cx={it.x}
					cy={it.y}
					r={(it.r ?? 20) + 22}
					fill={chargeFill(it.charge ?? 0)}
					fill-opacity={chargeOpacity(it.charge ?? 0) * it.opacity}
				/>
			{/each}
		</g>
	{/if}

	<!-- the molecule, back to front -->
	{#each scene.items as it (it.key)}
		{#if it.kind === 'bond'}
			{@const dx = (it.x2 ?? 0) - it.x}
			{@const dy = (it.y2 ?? 0) - it.y}
			{@const l = Math.hypot(dx, dy) || 1}
			{@const ux = dx / l}
			{@const uy = dy / l}
			{@const a0 = Math.min(centreR * 0.8, l / 2)}
			{@const a1 = Math.max(l - (it.r ?? 20) * 0.8, l / 2)}
			{@const nx = -uy}
			{@const ny = ux}
			{@const n = it.order ?? 1}
			<g opacity={it.opacity} style:pointer-events="none">
				{#each Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * 8) as off (off)}
					<line
						x1={it.x + ux * a0 + nx * off}
						y1={it.y + uy * a0 + ny * off}
						x2={it.x + ux * a1 + nx * off}
						y2={it.y + uy * a1 + ny * off}
						stroke="var(--stage-ink-muted)"
						stroke-width={n === 1 ? 7 : 4.5}
						stroke-linecap="round"
					/>
				{/each}
			</g>
		{:else if it.kind === 'lone'}
			<g
				transform="translate({it.x} {it.y}) rotate({it.angle})"
				opacity={it.opacity}
				style:pointer-events="none"
			>
				<ellipse
					rx={10 + 16 * (it.stretch ?? 1)}
					ry="15"
					fill={charges && a.complete ? NEG : 'var(--stage-ink-muted)'}
					fill-opacity={charges && a.complete ? 0.35 : 0.28}
					stroke="var(--stage-ink-muted)"
					stroke-opacity="0.8"
					stroke-dasharray="3 3"
				/>
				<circle cx="0" cy="-4.5" r="3" fill="var(--stage-ink)" />
				<circle cx="0" cy="4.5" r="3" fill="var(--stage-ink)" />
			</g>
		{:else if it.kind === 'single'}
			<g opacity={it.opacity} style:pointer-events="none">
				<circle cx={it.x} cy={it.y} r="9" fill="var(--atom-electron)" opacity="0.2" />
				<circle cx={it.x} cy={it.y} r="3.6" fill="var(--atom-electron)" />
			</g>
		{:else if it.sym}
			{#if it.ligand !== undefined && editable}
				{@const li = it.ligand}
				<g
					class="atom"
					opacity={it.opacity}
					role="button"
					tabindex="0"
					aria-label="Remove this {it.sym} atom"
					onclick={() => removeAt(li)}
					onpointerenter={hold}
					onpointerleave={release}
					onkeydown={(e) => onKey(e, () => removeAt(li))}
				>
					{@render ball(it.x, it.y, it.r ?? 20, it.sym)}
				</g>
			{:else}
				<g opacity={it.opacity} style:pointer-events="none">
					{@render ball(it.x, it.y, it.r ?? 20, it.sym)}
				</g>
			{/if}
			{#if charges && a.complete && Math.abs(it.charge ?? 0) > 0.05}
				{@const ox = it.x - CX}
				{@const oy = it.y - CY}
				{@const ol = Math.hypot(ox, oy)}
				{@const out = ol > 8 && it.ligand !== undefined}
				{@render txt(
					out ? it.x + (ox / ol) * ((it.r ?? 20) + 16) : centreLabel.x,
					out ? it.y + (oy / ol) * ((it.r ?? 20) + 16) + 5 : centreLabel.y + 5,
					(it.charge ?? 0) < 0 ? 'δ−' : 'δ+',
					14,
					{ weight: 700, anchor: 'middle', color: (it.charge ?? 0) < 0 ? NEG : POS }
				)}
			{/if}
		{/if}
	{/each}

	<!-- the angle between two bonds -->
	{#if arc && arc.opacity > 0.02 && !charges}
		<g opacity={arc.opacity} style:pointer-events="none" data-testid="angle-arc">
			<path d={arc.d} fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
			<Readout id="arc-label">
				{@render txt(arc.x, arc.y, arc.label, 13, { anchor: 'middle', weight: 700 })}
			</Readout>
		</g>
	{/if}

	<!-- polarity arrow (points to the negative end; the cross marks the positive end) -->
	{#if charges && dipole && dipole.len2d > 30}
		{@const mx = dipole.tail.x + Math.cos(dipole.ang) * 16}
		{@const my = dipole.tail.y + Math.sin(dipole.ang) * 16}
		{@const px = -Math.sin(dipole.ang) * 9}
		{@const py = Math.cos(dipole.ang) * 9}
		<g style:pointer-events="none">
			<line
				x1={dipole.tail.x}
				y1={dipole.tail.y}
				x2={dipole.head.x}
				y2={dipole.head.y}
				stroke="var(--stage-ink)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
			<line
				x1={mx - px}
				y1={my - py}
				x2={mx + px}
				y2={my + py}
				stroke="var(--stage-ink)"
				stroke-width="3"
			/>
		</g>
	{/if}

	{#if editable}
		<!-- centre picker -->
		{@render txt(186, 40, 'Centre atom:', 13, { weight: 600 })}
		{#each CENTRES as c, i (c)}
			{@const x = 296 + i * 44}
			<g
				class="chip"
				role="button"
				tabindex="0"
				aria-label="Make {c} the centre atom"
				aria-pressed={molecule.centre === c}
				onclick={() => setCentre(c)}
				onkeydown={(e) => onKey(e, () => setCentre(c))}
			>
				{#if molecule.centre === c}
					<circle cx={x} cy="35" r="20" fill="none" stroke="var(--focus)" stroke-width="2.5" />
				{/if}
				{@render ball(x, 35, 15, c)}
			</g>
		{/each}

		<!-- palette -->
		{@render txt(24, 104, 'Add an atom', 13, { weight: 700 })}
		<Readout id="palette-hint">
			{@render txt(24, 121, 'drag it in, or click', 11, { muted: true })}
		</Readout>
		{#each palette as p (p.sym)}
			{@const why = refusal(molecule, p.sym)}
			{@const cap = capacity(p.sym)}
			<g
				class="token"
				class:refused={why !== null}
				role="button"
				tabindex="0"
				aria-label="Add {p.sym}"
				onpointerdown={(e) => grab(e, p.sym)}
				onkeydown={(e) => onKey(e, () => add(p.sym))}
			>
				<rect x={p.x - 40} y={p.y - 28} width="112" height="56" rx="12" fill="transparent" />
				{@render ball(p.x, p.y, 21, p.sym, why !== null)}
				{@render txt(p.x + 30, p.y - 2, `${cap} bond${cap > 1 ? 's' : ''}`, 12, {
					weight: 600,
					muted: why !== null
				})}
				<Readout id="palette-{p.sym}">
					{@render txt(
						p.x + 30,
						p.y + 13,
						cap === 1 ? 'single' : cap === 2 ? 'double' : 'triple',
						11,
						{ muted: true }
					)}
				</Readout>
			</g>
		{/each}

		<!-- examples -->
		{@render txt(24, 573, 'Try:', 13, { weight: 600 })}
		{#each examples as ex, i (ex.s)}
			{@const x = 62 + i * 70}
			{@const on = molKey === ex.s}
			<g
				class="chip"
				role="button"
				tabindex="0"
				aria-label="Build {ex.label}"
				aria-pressed={on}
				onclick={() => load(ex.s)}
				onkeydown={(e) => onKey(e, () => load(ex.s))}
			>
				<rect
					{x}
					y="553"
					width="62"
					height="28"
					rx="14"
					fill={on ? 'var(--focus)' : 'var(--surface)'}
					fill-opacity={on ? 0.18 : 1}
					stroke={on ? 'var(--focus)' : 'var(--border-strong)'}
				/>
				{@render txt(x + 31, 572, ex.label, 13, { anchor: 'middle', weight: 600 })}
			</g>
		{/each}
		<Readout id="hint">
			{@render txt(
				CX,
				530,
				'Drag the empty space to turn it · click an outer atom to remove it',
				11,
				{ anchor: 'middle', muted: true }
			)}
		</Readout>
	{:else}
		<Readout id="hint">
			{@render txt(CX, 560, 'Drag to turn the molecule', 11, { anchor: 'middle', muted: true })}
		</Readout>
	{/if}

	<!-- the palette atom being dragged -->
	{#if drag}
		<g style:pointer-events="none" opacity="0.85">
			{@render ball(drag.x, drag.y, atomRadius(drag.sym, ballK), drag.sym)}
		</g>
	{/if}

	<!-- readout -->
	<g transform="translate({RX} 0)">
		<Readout id="formula" order={1} label="Molecule" value={a.formula} note={a.name ?? undefined}>
			{@render txt(0, 92, a.formula, 26, { weight: 700 })}
			{#if a.name}
				{@render txt(0, 116, a.name, 14, { muted: true })}
			{/if}
		</Readout>
		<Readout
			id="status"
			order={2}
			label="Outer shells"
			value={status.text}
			note="around {molecule.centre}: {a.centreElectrons} electrons · {pairsLine}"
			color={status.warn ? 'var(--atom-proton)' : undefined}
		>
			{@render txt(0, 146, status.text, 13, {
				weight: 600,
				color: status.warn ? 'var(--atom-proton)' : undefined
			})}
			{@render txt(0, 168, `Around ${molecule.centre}: ${a.centreElectrons} electrons`, 13)}
			{@render txt(0, 186, pairsLine, 12, { muted: true })}
		</Readout>
		{#if a.complete}
			<Readout
				id="shape"
				order={3}
				label="Shape"
				value={molecule.ligands.length === 1 ? 'linear (two atoms)' : a.shape}
				note={shapeNote}
			>
				{@render txt(0, 222, molecule.ligands.length === 1 ? 'linear (two atoms)' : a.shape, 18, {
					weight: 700
				})}
				{#if angleLine}
					{@render txt(0, 244, angleLine.main, 13, { weight: 600 })}
					{@render txt(0, 261, angleLine.note, 11, { muted: true })}
				{/if}
			</Readout>
		{/if}
	</g>

	{#if mode === 'shapes'}
		<!-- on phones the shape row's note names the family -->
		<Readout id="family">
			<g transform="translate({RX} 296)">
				{@render txt(0, 0, 'The family of shapes', 13, { weight: 700 })}
				{#each FAMILY as f, i (f.shape)}
					{@const on = a.complete && a.shape === f.shape && molecule.ligands.length > 1}
					<rect
						x="-8"
						y={12 + i * 42}
						width="288"
						height="38"
						rx="8"
						fill={on ? 'var(--focus)' : 'var(--surface)'}
						fill-opacity={on ? 0.16 : 0.7}
						stroke={on ? 'var(--focus)' : 'var(--border)'}
					/>
					{@render txt(4, 29 + i * 42, f.shape, 13, { weight: on ? 700 : 600 })}
					{@render txt(4, 44 + i * 42, f.dom, 11, { muted: true })}
					{@render txt(270, 29 + i * 42, f.ex, 12, { anchor: 'end' })}
				{/each}
			</g>
		</Readout>
	{/if}

	{#if mode === 'polar'}
		<g transform="translate({RX} 300)">
			{#if a.complete}
				<Readout
					id="polarity"
					order={4}
					label="Polarity"
					value={a.polar ? 'Polar' : 'Not polar'}
					note={a.polarity.replace(/^(not )?polar: /, '') +
						(charges && a.polar ? '; the arrow points to the negative end' : '')}
					color={a.polar ? NEG : undefined}
				>
					{@render txt(0, 0, a.polar ? 'Polar' : 'Not polar', 20, {
						weight: 700,
						color: a.polar ? NEG : undefined
					})}
					{@render txt(0, 22, a.polarity.replace(/^(not )?polar: /, ''), 12)}
				</Readout>
			{:else}
				<Readout
					id="polarity"
					order={4}
					label="Polarity"
					value="finish the molecule to see whether it is polar"
				>
					{@render txt(0, 0, 'Finish the molecule to see', 13, { muted: true })}
					{@render txt(0, 18, 'whether it is polar.', 13, { muted: true })}
				</Readout>
			{/if}
			{#if charges}
				<Readout id="key-neg" order={10} label="δ− electrons pulled here" color={NEG} />
				<Readout id="key-pos" order={11} label="δ+ electrons pulled away" color={POS} />
				<Readout id="legend">
					<circle cx="8" cy="56" r="8" fill={NEG} fill-opacity="0.7" />
					{@render txt(24, 61, 'δ− electrons pulled here', 12)}
					<circle cx="8" cy="80" r="8" fill={POS} fill-opacity="0.7" />
					{@render txt(24, 85, 'δ+ electrons pulled away', 12)}
					{#if a.polar}
						<line
							x1="0"
							y1="106"
							x2="30"
							y2="106"
							stroke="var(--stage-ink)"
							stroke-width="2.5"
							marker-end="url(#arrowhead)"
						/>
						<line x1="6" y1="100" x2="6" y2="112" stroke="var(--stage-ink)" stroke-width="2.5" />
						{@render txt(42, 110, 'points to the negative end', 12)}
					{/if}
					{@render txt(0, 140, 'Colours: a guide from electronegativity,', 11, { muted: true })}
					{@render txt(0, 155, 'not a computed charge.', 11, { muted: true })}
				</Readout>
			{/if}
		</g>
	{/if}

	{#if mode === 'compare'}
		<g transform="translate(0 300)">
			<Readout id="compare" order={4} label="Bond angles" value={compareValue} note={compareNote}>
				{@render txt(RX, 0, 'Angle between two bonds', 13, { weight: 700 })}
			</Readout>
			{#each [100, 105, 110] as d (d)}
				<line
					x1={degX(d)}
					y1="14"
					x2={degX(d)}
					y2="150"
					stroke="var(--stage-grid)"
					stroke-width="1.5"
				/>
				{@render txt(degX(d), 168, `${d}°`, 11, { anchor: 'middle', muted: true })}
			{/each}
			{#each compareRows as r, i (r.k)}
				{@const y = 26 + i * 44}
				<rect
					x={degX(100)}
					{y}
					width={degX(r.deg) - degX(100)}
					height="22"
					rx="4"
					fill="var(--focus)"
					fill-opacity={r.on ? 0.75 : 0.25}
				/>
				<Readout id="compare-{r.k}">
					{@render txt(degX(r.deg) + 6, y + 16, `${r.deg.toFixed(1)}°`, 13, {
						weight: r.on ? 700 : 500
					})}
					{@render txt(
						RX + 10,
						y + 36,
						`${r.label}: ${r.lone} lone pair${r.lone === 1 ? '' : 's'}`,
						11,
						{ muted: !r.on }
					)}
				</Readout>
			{/each}
			<Readout id="compare-source">
				{@render txt(RX, 194, 'Measured values (NIST CCCBDB);', 11, { muted: true })}
				{@render txt(RX, 209, 'axis starts at 100°.', 11, { muted: true })}
			</Readout>
		</g>
	{/if}
</g>

<style>
	.turn {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.turn:active {
		cursor: grabbing;
	}
	.turn:focus-visible,
	.chip:focus-visible,
	.token:focus-visible,
	.atom:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.chip,
	.atom {
		cursor: pointer;
		outline: none;
	}
	.token {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.token.refused {
		cursor: not-allowed;
	}
	.atom:hover {
		opacity: 0.8;
	}
</style>
