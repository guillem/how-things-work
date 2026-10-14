<script lang="ts">
	/**
	 * The eye in cross-section (the Gullstrand–Emsley schematic eye, eye.ts), with paraxial rays
	 * traced through glasses, cornea and both faces of the lens. Scale: 15 stage units = 1 mm
	 * inside the eye; the distance to the object is not to scale (a break on the axis).
	 *
	 * Phases (`step.hints.phase`):
	 *   intro  — a distant object; the rays from its foot and from its top, which land upside
	 *            down; the parts of the eye labelled.
	 *   cornea — the powers of cornea, lens and eye; `params.water` puts water in front of it.
	 *   focus  — `params.near` (object closeness, D) and `params.shape` (lens shape 0…1).
	 *   short  — as focus, for an eye 25.0 mm long, with `params.glassesShort`.
	 *   long   — as focus, for an eye 22.5 mm long, with `params.glassesLong`.
	 *
	 * The inset shows the object blurred by the real blur disc (pupil × defocus).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, along, clamp, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		EYES,
		LENS_BACK,
		N_AIR,
		N_WATER,
		PUPIL,
		SHARP,
		VERTEX,
		arrivingVergence,
		blurAngle,
		corneaPower,
		defocus,
		eyePower,
		imageZ,
		lensFor,
		lensPower,
		traceRay,
		type EyeKind,
		type Ray
	} from '../eye';
	import Card from './Card.svelte';
	import { signed, type Cell } from './ui';

	let { step, t, params, setParam }: StageProps = $props();

	const S = 15; // stage units per mm
	const AX = 344; // the optical axis
	const CX = 452; // the corneal apex
	const X = (z: number) => CX + z * S;
	const Y = (y: number) => AX - y * S;
	const Z0 = -16; // where the traced rays start (just right of the break)
	const BREAK = X(Z0) - 8;

	const phase = $derived(String(step.hints?.phase ?? 'intro'));
	const kind: EyeKind = $derived(
		phase === 'short' ? 'short' : phase === 'long' ? 'long' : 'normal'
	);
	const live = $derived(phase === 'focus' || phase === 'short' || phase === 'long');

	// ------------------------------------------------------------------ inputs
	const near = $derived(live ? clamp(Number(params.near ?? 0), 0, 10) : 0);
	const shape = $derived(live ? clamp(Number(params.shape ?? 0), 0, 1) : 0);
	const glasses = $derived(
		phase === 'short'
			? clamp(Number(params.glassesShort ?? 0), -6, 6)
			: phase === 'long'
				? clamp(Number(params.glassesLong ?? 0), -6, 6)
				: 0
	);
	const water = $derived(phase === 'cornea' && params.water === true);
	const outside = $derived(water ? N_WATER : N_AIR);

	// The eye's length eases between the normal, short and long eyes; the lens shape follows the
	// slider closely (a short tween only smooths step changes).
	const lengthT = new Tween(EYES.normal.length, { duration: 800, easing: cubicInOut });
	const shapeT = new Tween(0, { duration: 250, easing: cubicInOut });
	const waterT = new Tween(0, { duration: 700, easing: cubicInOut });
	const glassesT = new Tween(0, { duration: 300, easing: cubicInOut });
	const introT = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const l = EYES[kind].length;
		const s = shape;
		const w = water ? 1 : 0;
		const g = glasses;
		const i = phase === 'intro' ? 1 : 0;
		untrack(() => {
			lengthT.set(l);
			shapeT.set(s);
			waterT.set(w);
			glassesT.set(g);
			introT.set(i);
		});
	});
	const L = $derived(lengthT.current);
	const a = $derived(shapeT.current);
	const G = $derived(Math.abs(glassesT.current) < 0.01 ? 0 : glassesT.current);

	// ------------------------------------------------------------------ optics
	const vObj = $derived(-near); // vergence of the object's light at the cornea (D)
	const dObj = $derived(near > 0 ? 1000 / near : Infinity); // mm in front of the cornea
	const err = $derived(defocus(vObj, a, L, G, outside));
	const sharp = $derived(Math.abs(err) <= SHARP);
	const zImg = $derived(imageZ(arrivingVergence(vObj, G), a, outside));
	const lens = $derived(lensFor(a));

	/** A ray from the object point (height yObj mm; at infinity when dObj is), aimed at pupil height h. */
	function aimed(h: number, yObj: number, fieldAngle: number): Ray[] {
		const zP = lens.front - 0.05; // the iris sits just in front of the lens
		const startAt = (y0: number, nu0: number): Ray =>
			Number.isFinite(dObj)
				? { z: -dObj, y: y0, nu: nu0, n: outside }
				: { z: Z0, y: y0, nu: nu0, n: outside };
		const at = (r: Ray) => {
			const p = traceRay(r, a, G, zP, outside);
			return p[p.length - 1].y;
		};
		let start: Ray;
		if (Number.isFinite(dObj)) {
			// From a point: vary the angle.
			const p0 = at(startAt(yObj, 0));
			const p1 = at(startAt(yObj, 0.001));
			start = startAt(yObj, ((h - p0) / (p1 - p0)) * 0.001);
		} else {
			// From infinity: a parallel bundle at the field angle; vary the height.
			const p0 = at(startAt(0, fieldAngle));
			const p1 = at(startAt(1, fieldAngle));
			start = startAt((h - p0) / (p1 - p0), fieldAngle);
		}
		const zEnd = L;
		const path = traceRay(start, a, G, zEnd, outside).filter((r) => r.z >= Z0 - 1e-9);
		// The part in front of Z0 is not drawn to scale: start the drawn ray at Z0.
		if (start.z < Z0) {
			const first = traceRay(start, a, G, Z0, outside);
			path.unshift(first[first.length - 1]);
		}
		return path;
	}

	const HEIGHTS = [-PUPIL / 2, -PUPIL / 4, 0, PUPIL / 4, PUPIL / 2];
	const toPt = (r: Ray): Point => ({ x: X(r.z), y: Y(r.y) });

	interface Drawn {
		key: string;
		pts: Point[];
		ext: Point | null;
		color: string;
	}
	const XMAX = 940;
	function bundle(key: string, yObj: number, field: number, color: string): Drawn[] {
		return HEIGHTS.map((h, i) => {
			const path = aimed(h, yObj, field);
			const pts = path.map(toPt);
			const last = path[path.length - 1];
			const prev = path[path.length - 2];
			let ext: Point | null = null;
			if (zImg > L + 0.02) {
				// Extend the last leg beyond the retina to where the rays would meet (dashed).
				const zTo = Math.min(zImg, (XMAX - CX) / S);
				const slope = (last.y - prev.y) / (last.z - prev.z);
				ext = toPt({ ...last, z: zTo, y: last.y + slope * (zTo - last.z) });
			}
			return { key: `${key}${i}`, pts, ext, color };
		});
	}
	const axisRays = $derived(bundle('a', 0, 0, 'var(--vc-ray)'));
	// The top of a distant object 9° above the axis (intro only).
	const FIELD = -0.16;
	const tipRays = $derived(introT.current > 0.01 ? bundle('t', 0, FIELD, 'var(--vc-ray-2)') : []);
	const tipImage = $derived.by(() => {
		const r = tipRays[2];
		return r ? r.pts[r.pts.length - 1] : null;
	});

	// ------------------------------------------------------------------ the drawn eye
	// Sclera: an ellipse through the back of the eye (z = L) and the edge of the cornea.
	const JOIN_Y = 5.5;
	const joinZ = 7.8 - Math.sqrt(7.8 * 7.8 - JOIN_Y * JOIN_Y);
	const B_EYE = 12;
	const cz = $derived(
		(joinZ + Math.sqrt(1 - (JOIN_Y / B_EYE) ** 2) * L) / (1 + Math.sqrt(1 - (JOIN_Y / B_EYE) ** 2))
	);
	const aEye = $derived(L - cz);
	const sclera = $derived(
		`M${X(joinZ)} ${Y(JOIN_Y)} A${aEye * S} ${B_EYE * S} 0 1 1 ${X(joinZ)} ${Y(-JOIN_Y)}`
	);
	const cornea = $derived(
		`M${X(joinZ)} ${Y(JOIN_Y)} A${7.8 * S} ${7.8 * S} 0 0 0 ${X(joinZ)} ${Y(-JOIN_Y)}`
	);
	/** A point on the sclera at angle θ from the back of the eye (0 = on the axis). */
	const wall = (th: number): Point => ({
		x: X(cz + aEye * Math.cos(th)),
		y: Y(B_EYE * Math.sin(th))
	});
	const retina = $derived.by(() => {
		const pts = Array.from({ length: 25 }, (_, i) => wall(-1.05 + (2.1 * i) / 24));
		return 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L');
	});
	const nerveAt = $derived(wall(-0.28));

	const sag = (r: number, h: number) => Math.abs(r) - Math.sqrt(r * r - h * h);
	const lensH = $derived.by(() => {
		let lo = 1;
		let hi = Math.min(Math.abs(lens.r1), Math.abs(lens.r2), 4.8) - 1e-6;
		for (let i = 0; i < 40; i++) {
			const m = (lo + hi) / 2;
			if (sag(lens.r1, m) + sag(lens.r2, m) < lens.thickness - 0.7) lo = m;
			else hi = m;
		}
		return (lo + hi) / 2;
	});
	const lensPath = $derived.by(() => {
		const h = lensH;
		const zf = lens.front + sag(lens.r1, h);
		const zb = LENS_BACK - sag(lens.r2, h);
		const r1 = Math.abs(lens.r1) * S;
		const r2 = Math.abs(lens.r2) * S;
		return `M${X(zf)} ${Y(h)} A${r1} ${r1} 0 0 0 ${X(zf)} ${Y(-h)} L${X(zb)} ${Y(-h)} A${r2} ${r2} 0 0 0 ${X(zb)} ${Y(h)} Z`;
	});
	const lensMid = $derived(X((lens.front + LENS_BACK) / 2));
	const irisZ = $derived(lens.front - 0.25);

	// Glasses: a thin lens drawn thicker at the edge (diverging) or in the middle (converging).
	const GX = X(-VERTEX);
	const GH = 120;
	const glassesPath = $derived.by(() => {
		const k = clamp(G / 6, -1, 1) * 9;
		const mid = 4 + Math.max(0, k);
		const edge = 4 + Math.max(0, -k);
		return `M${GX - edge} ${AX - GH} Q${GX - mid * 2 + edge} ${AX} ${GX - edge} ${AX + GH} L${GX + edge} ${AX + GH} Q${GX + mid * 2 - edge} ${AX} ${GX + edge} ${AX - GH} Z`;
	});
	const glassesOpacity = $derived(smoothstep(0, 0.12, Math.abs(glassesT.current)));

	// ------------------------------------------------------------------ the object
	const OBJ_H = 74;
	const objX = $derived(live ? 52 + (near / 10) * 150 : 52);

	// ------------------------------------------------------------------ the inset
	const IN = { x: 24, y: 24, w: 210, h: 168 };
	const PX_PER_DEG = 50;
	const blurPx = $derived(Math.min(46, (blurAngle(err) * 180 * PX_PER_DEG) / Math.PI / 4));

	// ------------------------------------------------------------------ handles
	const TRACK_X = X(LENS_BACK) + 26;
	const TRACK_TOP = 214;
	const TRACK_BOTTOM = 290;
	const shapeY = $derived(TRACK_BOTTOM - a * (TRACK_BOTTOM - TRACK_TOP));
	const accommodation = $derived(eyePower(a) - eyePower(0));
	const OBJ_MIN = 52;
	const OBJ_MAX = 202;

	// ------------------------------------------------------------------ readouts
	const focusCell = $derived.by((): Cell => {
		const d = zImg - L;
		const value = sharp
			? 'on the retina'
			: !Number.isFinite(zImg) || d > 20
				? 'far behind'
				: `${Math.abs(d).toFixed(1)} mm ${d > 0 ? 'behind' : 'in front'}`;
		return {
			id: 'focus',
			label: 'Light meets',
			value,
			sub: sharp ? 'sharp' : `of the retina: blurred`,
			color: sharp ? 'var(--vc-good)' : 'var(--vc-bad)'
		};
	});
	const distanceValue = $derived(near <= 0 ? 'far away' : `${Math.round(100 / near)} cm`);
	const cells = $derived.by((): Cell[] => {
		if (phase === 'intro')
			return [
				{
					id: 'power',
					label: 'Whole eye',
					value: `${eyePower(0).toFixed(1)} D`,
					sub: 'focal length 1.7 cm in air'
				},
				focusCell
			];
		if (phase === 'cornea')
			return [
				{
					id: 'cornea',
					label: 'Cornea',
					value: `${corneaPower(outside).toFixed(1)} D`,
					sub: water ? 'in water' : 'in air'
				},
				{
					id: 'lens',
					label: 'Lens',
					value: `${lensPower(0).toFixed(1)} D`,
					sub: 'between fluids'
				},
				{
					id: 'power',
					label: 'Whole eye',
					value: `${eyePower(0, outside).toFixed(1)} D`,
					sub: water ? 'under water' : 'in air'
				}
			];
		return [{ id: 'object', label: 'Object', value: distanceValue }, focusCell];
	});

	// ------------------------------------------------------------------ light pulses
	const pulses = $derived(
		[...axisRays, ...tipRays].flatMap((r, i) =>
			[0, 0.5].map((o) => {
				const u = cycle(t, 3, o + i * 0.07);
				const p = along(r.pts, u);
				return {
					key: `${r.key}-${o}`,
					x: p.x,
					y: p.y,
					o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.92, 1, u)),
					color: r.color
				};
			})
		)
	);
	const poly = (pts: Point[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
</script>

<g>
	<!-- water in front of the eye -->
	<rect
		x="16"
		y="206"
		width={X(joinZ) - 16}
		height="386"
		rx="10"
		fill="var(--vc-water)"
		opacity={waterT.current * 0.9}
	/>
	{#if waterT.current > 0.05}
		<Label x={130} y={576} text="water" muted opacity={waterT.current} />
	{/if}

	<!-- the axis, with a break: the object is much further away than drawn -->
	<line
		x1="24"
		y1={AX}
		x2={XMAX}
		y2={AX}
		stroke="var(--stage-line)"
		stroke-dasharray="3 5"
		opacity="0.6"
	/>
	<g stroke="var(--stage-ink-muted)" stroke-width="1.5" fill="none">
		<path
			d="M{BREAK - 9} {AX + 12} L{BREAK - 3} {AX - 12} M{BREAK + 3} {AX + 12} L{BREAK + 9} {AX -
				12}"
		/>
	</g>
	<Readout id="scale">
		<Label x={BREAK} y={AX + 34} text="not to scale" size={11} muted />
	</Readout>

	<!-- the eye -->
	<path
		d={sclera}
		fill="var(--vc-humour)"
		stroke="var(--vc-sclera-edge)"
		stroke-width="10"
		opacity="0.9"
	/>
	<path d={sclera} fill="none" stroke="var(--vc-sclera)" stroke-width="7" />
	<path
		d={retina}
		fill="none"
		stroke="var(--vc-retina)"
		stroke-width="3.5"
		stroke-linecap="round"
	/>
	<path
		d="M{nerveAt.x - 4} {nerveAt.y - 16} L{nerveAt.x + 70} {nerveAt.y - 6} L{nerveAt.x +
			70} {nerveAt.y + 30} L{nerveAt.x - 4} {nerveAt.y + 22} Z"
		fill="var(--vc-nerve)"
		stroke="var(--vc-sclera-edge)"
	/>
	<path d={cornea} fill="var(--vc-humour)" stroke="var(--vc-cornea)" stroke-width="5" />
	<!-- iris, with the pupil between its two halves -->
	{#each [1, -1] as s (s)}
		<line
			x1={X(irisZ)}
			y1={Y(s * (PUPIL / 2 + 0.05))}
			x2={X(irisZ)}
			y2={Y(s * 6.4)}
			stroke="var(--vc-iris)"
			stroke-width="7"
			stroke-linecap="round"
		/>
		<!-- the fibres that hold the lens, from its edge to the ring of muscle -->
		<line
			x1={lensMid}
			y1={Y(s * lensH)}
			x2={X(5.6)}
			y2={Y(s * 8.6)}
			stroke="var(--vc-sclera-edge)"
			stroke-width="1"
			stroke-dasharray={a > 0.05 ? '2 3' : undefined}
		/>
		<ellipse
			cx={X(5.6)}
			cy={Y(s * 9.2)}
			rx={10 + 4 * a}
			ry="9"
			fill="var(--vc-nerve)"
			stroke="var(--vc-sclera-edge)"
		/>
	{/each}
	<path
		d={lensPath}
		fill="var(--vc-lens)"
		stroke="var(--vc-lens-edge)"
		stroke-width="1.5"
		opacity="0.95"
	/>

	<!-- glasses -->
	{#if glassesOpacity > 0.01}
		<g opacity={glassesOpacity}>
			<path d={glassesPath} fill="var(--vc-lens)" stroke="var(--vc-glasses)" stroke-width="1.5" />
			<Readout id="glasses" order={5} label="Glasses" value="{signed(glasses)} D">
				<Label x={GX} y={AX + GH + 26} text="glasses {signed(glasses)} D" size={13} weight={600} />
			</Readout>
			<path
				d="M{GX - 6} {AX - GH - 4} L{GX + 6} {AX - GH - 4}"
				stroke="var(--vc-glasses)"
				stroke-width="5"
				stroke-linecap="round"
			/>
		</g>
	{/if}

	<!-- rays -->
	{#each [...axisRays, ...tipRays] as r (r.key)}
		<polyline
			points={poly(r.pts)}
			fill="none"
			stroke={r.color}
			stroke-width="1.6"
			stroke-linejoin="round"
			opacity={r.key.startsWith('t') ? introT.current : 1}
		/>
		{#if r.ext}
			{@const last = r.pts[r.pts.length - 1]}
			<line
				x1={last.x}
				y1={last.y}
				x2={r.ext.x}
				y2={r.ext.y}
				stroke={r.color}
				stroke-width="1.3"
				stroke-dasharray="3 4"
				opacity="0.6"
			/>
		{/if}
		<!-- off the scale: back to the object -->
		<line
			x1={objX}
			y1={r.key.startsWith('t') ? AX - OBJ_H : AX}
			x2={r.pts[0].x}
			y2={r.pts[0].y}
			stroke={r.color}
			stroke-width="1.2"
			stroke-dasharray="2 5"
			opacity={(r.key.startsWith('t') ? introT.current : 1) * 0.45}
		/>
	{/each}
	{#each pulses as p (p.key)}
		<circle cx={p.x} cy={p.y} r="3" fill={p.color} opacity={p.o} />
	{/each}
	{#if zImg > L + 0.02 && Number.isFinite(zImg) && X(zImg) < XMAX}
		<circle cx={X(zImg)} cy={AX} r="4" fill="none" stroke="var(--vc-ray)" stroke-width="1.5" />
	{/if}

	<!-- the object: a card with letters, standing on the axis -->
	<g transform="translate({objX} {AX})">
		<rect
			x="-20"
			y={-OBJ_H}
			width="40"
			height={OBJ_H}
			rx="3"
			fill="var(--surface)"
			stroke="var(--vc-object)"
			stroke-width="2"
		/>
		<text x="0" y={-OBJ_H + 30} text-anchor="middle" style:font-size="26px" font-weight="700"
			>E</text
		>
		<text x="0" y={-OBJ_H + 52} text-anchor="middle" style:font-size="12px" font-weight="700"
			>F P</text
		>
		<text x="0" y={-OBJ_H + 66} text-anchor="middle" style:font-size="8px" font-weight="700"
			>T O Z</text
		>
	</g>
	<Readout id="object-label">
		<Label x={objX} y={AX + 30} text={live ? distanceValue : 'far away'} size={12} muted />
	</Readout>

	<!-- the image of the object's top, upside down on the retina (intro) -->
	{#if tipImage && introT.current > 0.05}
		<g opacity={introT.current}>
			<line
				x1={X(L) - 4}
				y1={AX}
				x2={X(L) - 4}
				y2={tipImage.y}
				stroke="var(--vc-object)"
				stroke-width="4"
				stroke-linecap="round"
			/>
		</g>
	{/if}

	<!-- labels of the parts -->
	{#if phase === 'intro' || phase === 'cornea'}
		<g opacity={phase === 'intro' ? 1 : 0.85}>
			<Readout id="l-cornea" label="Cornea" marker={1} at={[X(0.6) - 30, Y(4.2)]}>
				<line x1={X(0.6)} y1={Y(4.2)} x2={X(0.6) - 40} y2={Y(7.6)} stroke="var(--stage-line)" />
				<Label x={X(0.6) - 44} y={Y(7.6) - 4} text="cornea" anchor="end" />
			</Readout>
			<Readout id="l-iris" label="Iris and pupil" marker={2} at={[X(irisZ), Y(7.6)]}>
				<line
					x1={X(irisZ)}
					y1={Y(6.4)}
					x2={X(irisZ) - 10}
					y2={Y(10.2)}
					stroke="var(--stage-line)"
				/>
				<Label x={X(irisZ) - 10} y={Y(10.2) - 6} text="iris and pupil" anchor="end" />
			</Readout>
			<Readout id="l-lens" label="Lens" marker={3} at={[lensMid + 40, Y(-5.4)]}>
				<line
					x1={lensMid + 8}
					y1={Y(-lensH + 0.6)}
					x2={lensMid + 34}
					y2={Y(-5.2)}
					stroke="var(--stage-line)"
				/>
				<Label x={lensMid + 38} y={Y(-5.4) + 8} text="lens" anchor="start" />
			</Readout>
			<Readout id="l-retina" label="Retina" marker={4} at={[wall(0.7).x + 14, wall(0.7).y - 10]}>
				<Label x={wall(0.75).x + 16} y={wall(0.75).y - 8} text="retina" anchor="start" />
			</Readout>
			<Readout
				id="l-nerve"
				label="Optic nerve, to the brain"
				marker={5}
				at={[nerveAt.x + 60, nerveAt.y + 48]}
			>
				<Label x={nerveAt.x + 40} y={nerveAt.y + 52} text="optic nerve" />
			</Readout>
			<Readout id="l-jelly">
				<Label x={X(L * 0.62)} y={Y(7.4)} text="clear jelly" size={11} muted />
			</Readout>
			{#if phase === 'intro'}
				<Readout
					id="l-image"
					label="Image, upside down"
					marker={6}
					at={[X(L) - 40, (tipImage?.y ?? AX) + 34]}
				>
					<line
						x1={X(L) - 8}
						y1={(tipImage?.y ?? AX) + 4}
						x2={X(L) - 30}
						y2={(tipImage?.y ?? AX) + 30}
						stroke="var(--stage-line)"
					/>
					<Label
						x={X(L) - 32}
						y={(tipImage?.y ?? AX) + 44}
						text="image, upside down"
						anchor="end"
						size={12}
					/>
				</Readout>
				<Readout id="l-key">
					<Label
						x={480}
						y={584}
						text="rays from the foot of the card (orange) and from its top (violet)"
						size={12}
						muted
					/>
				</Readout>
			{/if}
		</g>
	{/if}

	<!-- lens-shape handle (focus phases) -->
	{#if live}
		<line
			x1={TRACK_X}
			y1={TRACK_TOP}
			x2={TRACK_X}
			y2={TRACK_BOTTOM}
			stroke="var(--stage-line)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<Readout
			id="shape-label"
			label="Lens"
			value={a <= 0.005
				? 'relaxed'
				: `${Math.round(a * 100)}% rounded, ${signed(accommodation, 1)} D`}
		>
			<Label x={TRACK_X + 16} y={TRACK_TOP + 4} text="rounder" anchor="start" size={11} muted />
			<Label x={TRACK_X + 16} y={TRACK_BOTTOM + 4} text="flatter" anchor="start" size={11} muted />
			<Label
				x={TRACK_X + 16}
				y={shapeY + 4}
				text={a <= 0.005 ? 'lens relaxed' : `lens ${signed(accommodation, 1)} D`}
				anchor="start"
				size={12}
				opacity={Math.abs(shapeY - TRACK_TOP) > 12 && Math.abs(shapeY - TRACK_BOTTOM) > 12 ? 1 : 0}
			/>
		</Readout>
		<Handle
			x={TRACK_X}
			y={shapeY}
			label="Shape of the lens"
			value={Math.round(a * 100)}
			min={0}
			max={100}
			valuetext={a <= 0 ? 'relaxed' : `${Math.round(a * 100)} per cent rounded`}
			onmove={(p: Point) =>
				setParam(
					'shape',
					Math.round(clamp((TRACK_BOTTOM - p.y) / (TRACK_BOTTOM - TRACK_TOP)) * 100) / 100
				)}
			onkey={(k: number | 'start' | 'end') =>
				setParam(
					'shape',
					k === 'start' ? 0 : k === 'end' ? 1 : clamp(Math.round((shape + k / 100) * 100) / 100)
				)}
		/>
		<Handle
			x={objX}
			y={AX}
			label="Object distance"
			value={near}
			min={0}
			max={10}
			valuetext={distanceValue}
			onmove={(p: Point) =>
				setParam('near', Math.round(clamp((p.x - OBJ_MIN) / (OBJ_MAX - OBJ_MIN)) * 40) / 4)}
			onkey={(k: number | 'start' | 'end') =>
				setParam('near', k === 'start' ? 0 : k === 'end' ? 10 : clamp(near + k / 4, 0, 10))}
		/>
	{/if}

	<!-- what the eye sees -->
	<defs>
		<filter id="eye-blur" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation={blurPx} />
		</filter>
		<clipPath id="eye-inset-clip">
			<rect x={IN.x} y={IN.y + 28} width={IN.w} height={IN.h - 28} rx="10" />
		</clipPath>
	</defs>
	<Readout id="inset-title" label="What this eye sees" value={sharp ? 'sharp' : 'blurred'}>
		<rect
			x={IN.x}
			y={IN.y}
			width={IN.w}
			height={IN.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<text x={IN.x + 14} y={IN.y + 20} class="muted" style:font-size="12px" font-weight="500"
			>What this eye sees</text
		>
	</Readout>
	<g clip-path="url(#eye-inset-clip)">
		<g filter={blurPx > 0.15 ? 'url(#eye-blur)' : undefined}>
			<rect
				x={IN.x + 55}
				y={IN.y + 36}
				width="100"
				height="124"
				rx="4"
				fill="var(--stage-bg)"
				stroke="var(--vc-object)"
				stroke-width="3"
			/>
			<text
				x={IN.x + 105}
				y={IN.y + 88}
				text-anchor="middle"
				style:font-size="44px"
				font-weight="700">E</text
			>
			<text
				x={IN.x + 105}
				y={IN.y + 122}
				text-anchor="middle"
				style:font-size="22px"
				font-weight="700">F P</text
			>
			<text
				x={IN.x + 105}
				y={IN.y + 146}
				text-anchor="middle"
				style:font-size="14px"
				font-weight="700">T O Z</text
			>
		</g>
	</g>

	<Card x={598} y={20} w={340} {cells} order={10} />
</g>
