<script lang="ts">
	/**
	 * Tensors in physics: the same thing described in turned axes (steps axes-turn, stress,
	 * rotate, meanings).
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   arrow    — a 5 N force F = (4, 3) N, and the axes x′, y′ turned by θ (`params.theta`,
	 *              dragged at the tip of x′): F's components along them, F′ = Rᵀ F
	 *   stress   — a square of a steel plate under σ = [[80, 30], [30, 20]] MPa; a cut with normal
	 *              n at `params.cut` (dragged at n's tip) and its traction t = σ n, split into the
	 *              part across the cut and the part along it
	 *   rotate   — the square drawn along x′, y′ with the stresses σ′ = Rᵀ σ R on its faces; the
	 *              principal axes (22.5°, 112.5°) dashed
	 *   meanings — the same, smaller, beside a pixel's (red, green, blue), which has no rule
	 *
	 * The face arrows breathe gently (a function of t) so the loaded plate reads as loaded; they
	 * are still under reduced motion.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { VectorHandle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		det,
		num,
		principal,
		stress,
		tensorInAxes,
		trace,
		traction,
		unit,
		vectorInAxes,
		type Vec2
	} from '../tensor';
	import Arrow from './Arrow.svelte';
	import Mat from './Mat.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phases = ['arrow', 'stress', 'rotate', 'meanings'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'arrow') as Phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived(
		Object.fromEntries(phases.map((p) => [p, weights[p].current])) as Record<Phase, number>
	);

	// ---- the plane --------------------------------------------------------------------------
	/** Centre of the drawing: moves left on the last step to make room for the comparison. */
	const centre = Tween.of(() => (phase === 'meanings' ? 230 : 300), {
		duration: 700,
		easing: cubicInOut
	});
	const CX = $derived(centre.current);
	const CY = 310;
	/** A point at (x, y) in plane units of `k` stage units each (y up). */
	const P = (v: Vec2, k: number): Point => ({ x: CX + v[0] * k, y: CY - v[1] * k });
	const PX = 610;
	/** Half-length of the drawn axes (shorter on the last step). */
	const axes = Tween.of(() => (phase === 'meanings' ? 180 : 236), {
		duration: 700,
		easing: cubicInOut
	});
	const AX = $derived(axes.current);

	const theta = $derived(clamp(Number(params.theta ?? -20), -180, 180));
	const xp = $derived(unit(theta));
	const yp = $derived(unit(theta + 90));
	const showTurned = $derived(phase !== 'stress');

	function moveAxis(p: Point) {
		const deg = (Math.atan2(CY - p.y, p.x - CX) * 180) / Math.PI;
		setParam('theta', Math.round(deg * 2) / 2);
	}
	function keyAxis(dx: number, dy: number) {
		// → and ↑ turn the axes anticlockwise, ← and ↓ clockwise; Shift for 10°.
		const k = Math.abs(dx) + Math.abs(dy) > 1 ? 10 : 1;
		const s = Math.sign(dx + dy);
		let next = theta + s * k;
		if (next > 180) next -= 360;
		if (next < -180) next += 360;
		setParam('theta', next);
	}

	// ---- phase arrow: the force ---------------------------------------------------------
	const F: Vec2 = [4, 3];
	const KF = 40; // stage units per newton
	const Fp = $derived(vectorInAxes(F, theta));
	/** Feet of F's perpendiculars on x′ and y′. */
	const footX = $derived(P([Fp[0] * xp[0], Fp[0] * xp[1]], KF));
	const footY = $derived(P([Fp[1] * yp[0], Fp[1] * yp[1]], KF));
	/** Component labels beside the feet, on the side away from F (half way along each). */
	const labX = $derived.by(() => {
		const sd = Fp[1] >= 0 ? -1 : 1;
		return P(
			[(Fp[0] * KF * xp[0]) / 2 + sd * 16 * yp[0], (Fp[0] * KF * xp[1]) / 2 + sd * 16 * yp[1]],
			1
		);
	});
	const labY = $derived.by(() => {
		const sd = Fp[0] >= 0 ? -1 : 1;
		return P(
			[(Fp[1] * KF * yp[0]) / 2 + sd * 16 * xp[0], (Fp[1] * KF * yp[1]) / 2 + sd * 16 * xp[1]],
			1
		);
	});

	// ---- the stress ---------------------------------------------------------------------
	const S = stress(80, 20, 30);
	const pr = principal(S);
	const cut = $derived(clamp(Number(params.cut ?? 0), -180, 180));
	const n = $derived(unit(cut));
	const tr = $derived(traction(S, n));
	const sn = $derived(tr[0] * n[0] + tr[1] * n[1]); // across the cut
	const along = $derived<Vec2>([tr[0] - sn * n[0], tr[1] - sn * n[1]]); // along the cut
	const shearMag = $derived(Math.hypot(...along));
	const KS = 1.7; // stage units per MPa
	const KN = 96; // length of n
	const HALF = 104; // half side of the drawn square of material
	function moveCut(p: Point) {
		setParam('cut', Math.round((Math.atan2(CY - p.y, p.x - CX) * 180) / Math.PI));
	}
	function keyCut(dx: number, dy: number) {
		const k = Math.abs(dx) + Math.abs(dy) > 1 ? 10 : 1;
		let next = cut + Math.sign(dx + dy) * k;
		if (next > 180) next -= 360;
		if (next < -180) next += 360;
		setParam('cut', next);
	}
	/** The cut line across the square, at right angles to n. */
	const cutLine = $derived.by(() => {
		const d: Vec2 = [-n[1], n[0]];
		const L = HALF * 1.45;
		return { a: P([d[0] * L, d[1] * L], 1), b: P([-d[0] * L, -d[1] * L], 1) };
	});

	// ---- phase rotate: σ′ on the faces of the turned square -----------------------------
	const Sp = $derived(tensorInAxes(S, theta));
	const breathe = $derived(reduced ? 1 : 0.92 + 0.08 * Math.sin(t * 2.4));
	const principalNow = $derived(Math.abs(Sp[0][1]) < 0.5);
	/** The square along the turned axes, half side h, as a path. */
	const square = (h: number, a: Vec2, b: Vec2) => {
		const c = [
			[1, 1],
			[-1, 1],
			[-1, -1],
			[1, -1]
		].map(([i, j]) => P([h * (i * a[0] + j * b[0]), h * (i * a[1] + j * b[1])], 1));
		return `M${c.map((q) => `${q.x} ${q.y}`).join(' L')} Z`;
	};
	const HR = $derived(phase === 'meanings' || w.meanings > 0.5 ? 70 : 92); // half side, rotate
	const KR = $derived(HR / 92); // shrink the arrows with the square
	interface FaceArrow {
		k: string;
		from: Point;
		to: Point;
		color: string;
		label: string;
		lp: Point;
	}
	/** Normal and shear arrows on the four faces of the turned square. */
	const faces = $derived.by((): FaceArrow[] => {
		const out: FaceArrow[] = [];
		const sxx = Sp[0][0];
		const syy = Sp[1][1];
		const txy = Sp[0][1];
		const kk = 1.25 * KR * breathe;
		const add = (k: string, base: Vec2, dir: Vec2, mag: number, color: string, label: string) => {
			const from = P(base, 1);
			const to = P([base[0] + dir[0] * mag * kk, base[1] + dir[1] * mag * kk], 1);
			const lp = P(
				[
					base[0] + dir[0] * (mag * kk + 16 * Math.sign(mag || 1)),
					base[1] + dir[1] * (mag * kk + 16 * Math.sign(mag || 1))
				],
				1
			);
			out.push({ k, from, to, color, label, lp });
		};
		for (const s of [1, -1]) {
			// ± x′ faces: normal σ′xx outward along ±x′, shear τ′xy along ±y′
			const fx: Vec2 = [s * HR * xp[0], s * HR * xp[1]];
			add(
				`nx${s}`,
				fx,
				[s * xp[0], s * xp[1]],
				sxx,
				'var(--tn-force)',
				s > 0 ? `σ′xx = ${num(sxx, 1)}` : ''
			);
			const shx: Vec2 = [
				fx[0] - (s * txy * 1.25 * KR * yp[0]) / 2,
				fx[1] - (s * txy * 1.25 * KR * yp[1]) / 2
			];
			add(
				`sx${s}`,
				shx,
				[s * yp[0], s * yp[1]],
				txy,
				'var(--tn-shear)',
				s > 0 ? `τ′xy = ${num(txy, 1)}` : ''
			);
			// ± y′ faces
			const fy: Vec2 = [s * HR * yp[0], s * HR * yp[1]];
			add(
				`ny${s}`,
				fy,
				[s * yp[0], s * yp[1]],
				syy,
				'var(--tn-force)',
				s > 0 ? `σ′yy = ${num(syy, 1)}` : ''
			);
			const shy: Vec2 = [
				fy[0] - (s * txy * 1.25 * KR * xp[0]) / 2,
				fy[1] - (s * txy * 1.25 * KR * xp[1]) / 2
			];
			add(`sy${s}`, shy, [s * xp[0], s * xp[1]], txy, 'var(--tn-shear)', '');
		}
		return out;
	});

	// ---- phase meanings: a pixel -----------------------------------------------------------
	const PIXEL = [212, 23, 22] as const; // pixel [24, 22] of the photo on the image steps
	const fmt = (v: number) => num(v, 1);
	/** A square in the panel: (−4)², not −4². */
	const sq = (v: number) => (num(v).startsWith('−') ? `(${num(v)})²` : `${num(v)}²`);
	const angleText = $derived(`${num(theta, 1)}°`);
</script>

<g>
	<!-- the fixed axes x, y -->
	<g opacity={0.9}>
		<line x1={CX - AX} y1={CY} x2={CX + AX} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
		<line x1={CX} y1={CY - AX} x2={CX} y2={CY + AX} stroke="var(--stage-line)" stroke-width="1.5" />
		<Readout id="xy">
			<T x={CX + AX + 6} y={CY + 5} text="x" size={15} italic muted />
			<T x={CX + 8} y={CY - AX + 4} text="y" size={15} italic muted />
		</Readout>
	</g>

	<!-- ============ phase stress: the plate, the cut, n and t ============ -->
	{#if w.stress > 0.01}
		<g opacity={w.stress}>
			<rect
				x={CX - HALF}
				y={CY - HALF}
				width={2 * HALF}
				height={2 * HALF}
				rx="4"
				fill="var(--tn-plate)"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			<!-- the loads on the square's faces, faint: σxx on ±x, σyy on ±y, τxy along them -->
			{#each [1, -1] as s (s)}
				<Arrow
					from={{ x: CX + s * HALF, y: CY }}
					to={{ x: CX + s * (HALF + 80 * 0.7 * breathe), y: CY }}
					color="var(--tn-force)"
					width={2.5}
					opacity={0.45}
				/>
				<Arrow
					from={{ x: CX, y: CY - s * HALF }}
					to={{ x: CX, y: CY - s * (HALF + 20 * 0.7 * breathe) }}
					color="var(--tn-force)"
					width={2.5}
					opacity={0.45}
				/>
				<Arrow
					from={{ x: CX + s * (HALF + 8), y: CY + s * 30 * 0.6 * breathe }}
					to={{ x: CX + s * (HALF + 8), y: CY - s * 30 * 0.6 * breathe }}
					color="var(--tn-shear)"
					width={2}
					opacity={0.45}
				/>
				<Arrow
					from={{ x: CX - s * 30 * 0.6 * breathe, y: CY - s * (HALF + 8) }}
					to={{ x: CX + s * 30 * 0.6 * breathe, y: CY - s * (HALF + 8) }}
					color="var(--tn-shear)"
					width={2}
					opacity={0.45}
				/>
			{/each}
			<Readout id="loads">
				<T
					x={CX - HALF - 70}
					y={CY + HALF + 74}
					text="faint arrows: the loads on the square's faces"
					size={12}
					muted
				/>
				<T
					x={CX - HALF - 70}
					y={CY + HALF + 92}
					text="σxx = 80 and σyy = 20 MPa pull, τxy = 30 MPa shears"
					size={12}
					muted
				/>
			</Readout>
			<!-- the cut -->
			<line
				x1={cutLine.a.x}
				y1={cutLine.a.y}
				x2={cutLine.b.x}
				y2={cutLine.b.y}
				stroke="var(--stage-ink)"
				stroke-width="2.5"
				stroke-dasharray="8 5"
			/>
			<!-- traction t, split across and along the cut -->
			<line
				x1={P([tr[0] * KS, tr[1] * KS], 1).x}
				y1={P([tr[0] * KS, tr[1] * KS], 1).y}
				x2={P([sn * n[0] * KS, sn * n[1] * KS], 1).x}
				y2={P([sn * n[0] * KS, sn * n[1] * KS], 1).y}
				stroke="var(--tn-force)"
				stroke-dasharray="3 4"
				opacity="0.8"
			/>
			<Arrow
				from={P([0, 0], 1)}
				to={P([sn * n[0] * KS, sn * n[1] * KS], 1)}
				color="var(--tn-force)"
				width={2}
				opacity={0.5}
				dashed
			/>
			<Arrow
				from={P([0, 0], 1)}
				to={P([tr[0] * KS, tr[1] * KS], 1)}
				color="var(--tn-force)"
				width={4.5}
				head={18}
			/>
			<Arrow
				from={P([0, 0], 1)}
				to={P([n[0] * KN, n[1] * KN], 1)}
				color="var(--tn-normal)"
				width={4}
				head={16}
			/>
			<Readout id="tn-labels">
				<T
					x={P([tr[0] * KS + (tr[0] >= 0 ? 10 : -10), tr[1] * KS], 1).x}
					y={P([0, tr[1] * KS + (tr[1] >= 0 ? 12 : -22)], 1).y}
					text="t"
					size={20}
					weight={700}
					italic
					anchor={tr[0] >= 0 ? 'start' : 'end'}
					color="var(--tn-force)"
				/>
				<T
					x={P([n[0] * (KN + 22) + n[1] * 18, 0], 1).x}
					y={P([0, n[1] * (KN + 22) - n[0] * 18], 1).y + 6}
					text="n"
					size={20}
					weight={700}
					italic
					anchor="middle"
					color="var(--tn-normal)"
				/>
			</Readout>
			<VectorHandle
				x={P([n[0] * KN, n[1] * KN], 1).x}
				y={P([n[0] * KN, n[1] * KN], 1).y}
				label="Normal of the cut"
				value={cut}
				valuetext="n at {cut}°"
				color="var(--tn-normal)"
				onmove={moveCut}
				onkey={keyCut}
			/>
		</g>
		<Readout
			id="sigma"
			order={1}
			label="Stress σ"
			value="[[80, 30], [30, 20]] MPa"
			opacity={w.stress}
		>
			<g opacity={w.stress}>
				<T x={PX} y={86} text="the stress tensor (MPa)" size={14} muted />
				<T x={PX} y={128} text="σ =" size={20} weight={700} />
				<Mat
					x={PX + 42}
					y={98}
					cells={[
						['80', '30'],
						['30', '20']
					]}
					col={44}
				/>
			</g>
		</Readout>
		<Readout
			id="normal"
			order={2}
			label="Cut normal n"
			value="({num(n[0], 3)}, {num(n[1], 3)})"
			note="at {cut}° from x"
			color="var(--tn-normal)"
			opacity={w.stress}
		>
			<T
				x={PX}
				y={196}
				text="n = ({num(n[0], 3)}, {num(n[1], 3)})  at {cut}°"
				size={16}
				weight={600}
				color="var(--tn-normal)"
				opacity={w.stress}
			/>
		</Readout>
		<Readout
			id="traction"
			order={3}
			label="Traction t = σn"
			value="({fmt(tr[0])}, {fmt(tr[1])}) MPa"
			note="{fmt(Math.hypot(...tr))} MPa: {fmt(sn)} across the cut, {fmt(shearMag)} along it"
			color="var(--tn-force)"
			opacity={w.stress}
		>
			<g opacity={w.stress}>
				<T
					x={PX}
					y={236}
					text="t = σ n = ({fmt(tr[0])}, {fmt(tr[1])}) MPa"
					size={16}
					weight={700}
					color="var(--tn-force)"
				/>
				<T x={PX} y={262} text="size {fmt(Math.hypot(...tr))} MPa:" size={14} />
				<T x={PX} y={284} text="{fmt(sn)} pulling straight across the cut," size={14} />
				<T x={PX} y={304} text="{fmt(shearMag)} sliding along it (shear)" size={14} />
				<T x={PX} y={360} text="Drag the tip of n to turn the cut." size={13} muted />
			</g>
		</Readout>
	{/if}

	<!-- ============ the turned axes (arrow, rotate, meanings) ============ -->
	{#if showTurned || w.stress < 0.99}
		<g opacity={1 - w.stress}>
			<line
				x1={P([-xp[0] * AX, -xp[1] * AX], 1).x}
				y1={P([-xp[0] * AX, -xp[1] * AX], 1).y}
				x2={P([xp[0] * AX, xp[1] * AX], 1).x}
				y2={P([xp[0] * AX, xp[1] * AX], 1).y}
				stroke="var(--tn-turned)"
				stroke-width="2"
			/>
			<line
				x1={P([-yp[0] * AX, -yp[1] * AX], 1).x}
				y1={P([-yp[0] * AX, -yp[1] * AX], 1).y}
				x2={P([yp[0] * AX, yp[1] * AX], 1).x}
				y2={P([yp[0] * AX, yp[1] * AX], 1).y}
				stroke="var(--tn-turned)"
				stroke-width="2"
			/>
			<Readout id="turned">
				<T
					x={P([xp[0] * (AX + 32), 0], 1).x}
					y={P([0, xp[1] * (AX + 32)], 1).y + 5}
					text="x′"
					size={16}
					weight={700}
					anchor="middle"
					color="var(--tn-turned)"
				/>
				<T
					x={P([yp[0] * (AX + 16), 0], 1).x}
					y={P([0, yp[1] * (AX + 16)], 1).y + 5}
					text="y′"
					size={16}
					weight={700}
					anchor="middle"
					color="var(--tn-turned)"
				/>
			</Readout>
		</g>
	{/if}

	<!-- ============ phase arrow: the force and its components ============ -->
	{#if w.arrow > 0.01}
		<g opacity={w.arrow}>
			<!-- components along x and y, faint -->
			<line
				x1={P(F, KF).x}
				y1={P(F, KF).y}
				x2={P([F[0], 0], KF).x}
				y2={CY}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 4"
			/>
			<line
				x1={P(F, KF).x}
				y1={P(F, KF).y}
				x2={CX}
				y2={P([0, F[1]], KF).y}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 4"
			/>
			<!-- components along x′ and y′ -->
			<line
				x1={P(F, KF).x}
				y1={P(F, KF).y}
				x2={footX.x}
				y2={footX.y}
				stroke="var(--tn-turned)"
				stroke-dasharray="4 4"
			/>
			<line
				x1={P(F, KF).x}
				y1={P(F, KF).y}
				x2={footY.x}
				y2={footY.y}
				stroke="var(--tn-turned)"
				stroke-dasharray="4 4"
			/>
			<line
				x1={CX}
				y1={CY}
				x2={footX.x}
				y2={footX.y}
				stroke="var(--tn-turned)"
				stroke-width="6"
				stroke-linecap="round"
				opacity="0.5"
			/>
			<line
				x1={CX}
				y1={CY}
				x2={footY.x}
				y2={footY.y}
				stroke="var(--tn-turned)"
				stroke-width="6"
				stroke-linecap="round"
				opacity="0.5"
			/>
			<Arrow from={P([0, 0], 1)} to={P(F, KF)} color="var(--tn-force)" width={5} head={20} />
			<Readout id="f-label">
				<T
					x={P(F, KF).x + 12}
					y={P(F, KF).y - 8}
					text="F = 5 N"
					size={16}
					weight={700}
					color="var(--tn-force)"
				/>
				<T
					x={labX.x}
					y={labX.y + 5}
					text="F′x = {num(Fp[0])}"
					size={13}
					weight={600}
					anchor={labX.x >= footX.x ? 'start' : 'end'}
					color="var(--tn-turned)"
				/>
				<T
					x={labY.x}
					y={labY.y + 5}
					text="F′y = {num(Fp[1])}"
					size={13}
					weight={600}
					anchor={labY.x >= footY.x ? 'start' : 'end'}
					color="var(--tn-turned)"
				/>
			</Readout>
		</g>
		<Readout id="f-xy" order={1} label="Along x, y" value="F = (4, 3) N" opacity={w.arrow}>
			<g opacity={w.arrow}>
				<T x={PX} y={96} text="along x and y:" size={14} muted />
				<T x={PX} y={124} text="F = (4, 3) N" size={22} weight={700} color="var(--tn-force)" />
			</g>
		</Readout>
		<Readout
			id="f-turned"
			order={2}
			label="Along x′, y′ (θ = {angleText})"
			value="F′ = ({num(Fp[0])}, {num(Fp[1])}) N"
			note="F′ = Rᵀ F"
			color="var(--tn-turned)"
			opacity={w.arrow}
		>
			<g opacity={w.arrow}>
				<T x={PX} y={180} text="along x′ and y′, turned by θ = {angleText}:" size={14} muted />
				<T
					x={PX}
					y={210}
					text="F′ = ({num(Fp[0])}, {num(Fp[1])}) N"
					size={22}
					weight={700}
					color="var(--tn-turned)"
				/>
				<T x={PX} y={238} text="F′ = Rᵀ F: one factor of R" size={14} />
			</g>
		</Readout>
		<Readout
			id="f-len"
			order={3}
			label="Length"
			value="{num(Math.hypot(...Fp))} N in every axes"
			opacity={w.arrow}
		>
			<g opacity={w.arrow}>
				<T
					x={PX}
					y={300}
					text="√({sq(Fp[0])} + {sq(Fp[1])}) = {num(Math.hypot(...Fp))} N"
					size={16}
					weight={600}
				/>
				<T x={PX} y={322} text="the arrow itself never changes" size={14} muted />
				<T x={PX} y={380} text="Drag the end of the x′ axis." size={13} muted />
			</g>
		</Readout>
	{/if}

	<!-- ============ phases rotate and meanings: σ′ on the turned square ============ -->
	{#if w.rotate + w.meanings > 0.01}
		<g opacity={w.rotate + w.meanings}>
			<!-- the principal axes -->
			{#each [pr.deg, pr.deg + 90] as d (d)}
				{@const u = unit(d)}
				<line
					x1={P([-u[0] * AX * 0.85, -u[1] * AX * 0.85], 1).x}
					y1={P([-u[0] * AX * 0.85, -u[1] * AX * 0.85], 1).y}
					x2={P([u[0] * AX * 0.85, u[1] * AX * 0.85], 1).x}
					y2={P([u[0] * AX * 0.85, u[1] * AX * 0.85], 1).y}
					stroke="var(--tn-keep)"
					stroke-dasharray="2 6"
					stroke-width="2"
					opacity={principalNow ? 0.9 : 0.5}
				/>
			{/each}
			<path
				d={square(HR, xp, yp)}
				fill="var(--tn-plate)"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			{#each faces as f (f.k)}
				<Arrow from={f.from} to={f.to} color={f.color} width={3} head={12} />
			{/each}
			<Readout id="face-key">
				<T
					x={24}
					y={562}
					text="arrows on the faces: pulls (σ′xx, σ′yy)"
					size={12}
					color="var(--tn-force)"
					weight={600}
				/>
				<T x={24} y={580} text="and shear (τ′xy)" size={12} color="var(--tn-shear)" weight={600} />
			</Readout>
			<Readout id="principal-label">
				<T
					x={P([-unit(pr.deg)[0] * (AX * 0.85 + 6), 0], 1).x}
					y={P([0, -unit(pr.deg)[1] * (AX * 0.85 + 6)], 1).y + 16}
					text="principal axis"
					opacity={w.rotate}
					anchor="end"
					size={12}
					color="var(--tn-keep)"
					weight={600}
				/>
			</Readout>
		</g>
	{/if}
	{#if w.rotate > 0.01}
		<Readout
			id="sp"
			order={1}
			label="σ′ (θ = {angleText})"
			value="[[{fmt(Sp[0][0])}, {fmt(Sp[0][1])}], [{fmt(Sp[1][0])}, {fmt(Sp[1][1])}]] MPa"
			note="σ′ = Rᵀ σ R"
			opacity={w.rotate}
		>
			<g opacity={w.rotate}>
				<T x={PX} y={86} text="in axes turned by θ = {angleText} (MPa):" size={14} muted />
				<T x={PX} y={136} text="σ′ =" size={20} weight={700} />
				<Mat
					x={PX + 48}
					y={104}
					cells={[
						[fmt(Sp[0][0]), fmt(Sp[0][1])],
						[fmt(Sp[1][0]), fmt(Sp[1][1])]
					]}
				/>
				<T x={PX} y={192} text="σ′ = Rᵀ σ R: one factor of R per axis" size={14} />
			</g>
		</Readout>
		<Readout
			id="inv"
			order={2}
			label="Unchanged"
			value="trace {fmt(trace(Sp))} MPa, det {fmt(det(Sp))} MPa²"
			opacity={w.rotate}
		>
			<g opacity={w.rotate}>
				<T x={PX} y={236} text="never changes:" size={14} muted />
				<T
					x={PX}
					y={262}
					text="σ′xx + σ′yy = {fmt(trace(Sp))} MPa"
					size={16}
					weight={600}
					color="var(--tn-keep)"
				/>
				<T
					x={PX}
					y={288}
					text="σ′xx σ′yy − τ′xy² = {fmt(det(Sp))} MPa²"
					size={16}
					weight={600}
					color="var(--tn-keep)"
				/>
			</g>
		</Readout>
		<Readout
			id="principal"
			order={3}
			label="Principal axes"
			value="{fmt(pr.s1)} and {fmt(pr.s2)} MPa at {fmt(pr.deg)}°"
			note={principalNow ? 'now: no shear' : 'turn to 22.5° for no shear'}
			opacity={w.rotate}
		>
			<g opacity={w.rotate}>
				<T
					x={PX}
					y={346}
					text={principalNow
						? 'No shear: these are the principal axes,'
						: 'At θ = 22.5° the shear vanishes:'}
					size={14}
					weight={principalNow ? 700 : 500}
					color={principalNow ? 'var(--tn-keep)' : undefined}
				/>
				<T x={PX} y={368} text="pure pulls of {fmt(pr.s1)} and {fmt(pr.s2)} MPa" size={14} />
				<T x={PX} y={420} text="Drag the end of the x′ axis." size={13} muted />
			</g>
		</Readout>
	{/if}

	<!-- ============ phase meanings: physics tensor vs plain array ============ -->
	{#if w.meanings > 0.01}
		<g opacity={w.meanings}>
			<rect
				x={PX - 140 + 30}
				y={70}
				width={440}
				height={180}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect
				x={PX - 140 + 30}
				y={276}
				width={440}
				height={180}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
		</g>
		<Readout
			id="m-phys"
			order={1}
			label="Physics tensor: stress"
			value="σ′ = [[{fmt(Sp[0][0])}, {fmt(Sp[0][1])}], [{fmt(Sp[1][0])}, {fmt(Sp[1][1])}]] MPa"
			note="changes by σ′ = Rᵀ σ R"
			opacity={w.meanings}
		>
			<g opacity={w.meanings}>
				<T
					x={PX - 90}
					y={100}
					text="Physics: the stress tensor, at θ = {angleText}"
					size={14}
					weight={700}
				/>
				<T x={PX - 90} y={150} text="σ′ =" size={20} weight={700} color="var(--tn-turned)" />
				<Mat
					x={PX - 40}
					y={118}
					cells={[
						[fmt(Sp[0][0]), fmt(Sp[0][1])],
						[fmt(Sp[1][0]), fmt(Sp[1][1])]
					]}
					color="var(--tn-turned)"
				/>
				<T x={PX - 90} y={198} text="its numbers change by a rule: σ′ = Rᵀ σ R" size={14} />
				<T x={PX - 90} y={220} text="(the steel and its load don't change)" size={13} muted />
			</g>
		</Readout>
		<Readout
			id="m-array"
			order={2}
			label="Just an array: a pixel"
			value="(212, 23, 22)"
			note="no rule: turning the axes of space means nothing to it"
			opacity={w.meanings}
		>
			<g opacity={w.meanings}>
				<T
					x={PX - 90}
					y={306}
					text="An array: one pixel of the photo, at θ = {angleText}"
					size={14}
					weight={700}
				/>
				<rect x={PX - 90} y={322} width="48" height="48" rx="6" fill="rgb({PIXEL.join(' ')})" />
				<T
					x={PX - 26}
					y={354}
					text="(red {PIXEL[0]}, green {PIXEL[1]}, blue {PIXEL[2]})"
					size={18}
					weight={700}
				/>
				<T x={PX - 90} y={404} text="no rule: turning the axes of space" size={14} />
				<T x={PX - 90} y={426} text="means nothing to it, and its numbers stay put" size={14} />
			</g>
		</Readout>
	{/if}

	<!-- the handle on the x′ axis -->
	{#if showTurned}
		<VectorHandle
			x={P([xp[0] * AX, xp[1] * AX], 1).x}
			y={P([xp[0] * AX, xp[1] * AX], 1).y}
			label="End of the x′ axis"
			value={theta}
			valuetext="axes turned by {num(theta, 1)}°"
			color="var(--tn-turned)"
			onmove={moveAxis}
			onkey={keyAxis}
		/>
	{/if}
	{#if !reduced && w.stress < 0.5}
		<!-- an inviting pulse on the handle at the start of the step -->
		{@const pulse = (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5))}
		{#if pulse > 0.01}
			<circle
				cx={P([xp[0] * AX, xp[1] * AX], 1).x}
				cy={P([xp[0] * AX, xp[1] * AX], 1).y}
				r={20 + 10 * pulse}
				fill="none"
				stroke="var(--tn-turned)"
				stroke-width="2"
				opacity={0.5 * pulse}
			/>
		{/if}
	{/if}
</g>
