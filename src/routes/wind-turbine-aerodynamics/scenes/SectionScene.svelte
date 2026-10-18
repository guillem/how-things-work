<script lang="ts">
	/**
	 * One blade element of the NREL 5-MW rotor, solved by BEM at the chosen tip-speed ratio and
	 * pitch. Left: the rotor seen from upwind, turning, with the chosen section ringed. Right: the
	 * section seen from the tip, with the rotor plane horizontal, the wind arriving from below and
	 * the blade moving to the left: the velocity triangle ((1 − a)V along the axis, Ωr(1 + a′) in
	 * the rotor plane, the relative wind W at the inflow angle φ), the chord set at twist + pitch,
	 * the angle of attack α = φ − (twist + pitch), and lift and drag resolved into thrust and the
	 * force that turns the rotor.
	 *
	 * Motion: the rotor's angle is a frame-to-frame accumulator of its speed (the scene guide's
	 * sanctioned exception), since λ changes it; static under reduced motion.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bem, stallAngle, TURBINE } from '../model';
	import { BLADE } from '../nrel5mw';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { deg, num } from './fmt';

	let { t, params, reduced }: StageProps = $props();

	const lambda = $derived(Number(params.lambda ?? 7.5));
	const pitch = $derived(Number(params.pitch ?? 0));
	const rWant = $derived(Number(params.r ?? 45));
	const sol = $derived(bem(lambda, pitch));
	const idx = $derived.by(() => {
		let best = 3;
		BLADE.forEach((n, i) => {
			if (i >= 3 && Math.abs(n.r - rWant) < Math.abs(BLADE[best].r - rWant)) best = i;
		});
		return best;
	});
	const el = $derived(sol.elements[idx]);
	const stall = $derived(stallAngle(el.af));
	const stalled = $derived(Number.isFinite(stall) && el.alpha > stall);
	const AF_NAMES = [
		'cylinder',
		'cylinder',
		'DU, 40% thick',
		'DU, 35% thick',
		'DU, 30% thick',
		'DU, 25% thick',
		'DU, 21% thick',
		'NACA 64-618'
	];
	const DEG = Math.PI / 180;

	// ---------------------------------------------------------------- the rotor, from upwind
	const HX = 175;
	const HY = 200;
	const RPX = 128;
	const k = RPX / TURBINE.radius;
	let acc = { t: 0, ang: 0 };
	const rate = $derived(0.18 * lambda);
	const ang = $derived.by(() => {
		if (reduced) return 0.35;
		const dt = t - acc.t;
		if (dt > 0 && dt < 0.5) acc = { t, ang: acc.ang + dt * rate };
		else if (dt !== 0) acc = { t, ang: dt < 0 ? t * rate : acc.ang };
		return acc.ang;
	});
	/** Blade outline in its own frame: along +x from the hub, chord to scale (×1.6 to be seen). */
	const bladePath = (() => {
		const pts = BLADE.map((n) => ({ x: n.r * k, c: n.chord * k * 1.6 }));
		const lead = pts.map((p) => `${p.x.toFixed(1)} ${(-0.35 * p.c).toFixed(1)}`);
		const trail = [...pts].reverse().map((p) => `${p.x.toFixed(1)} ${(0.65 * p.c).toFixed(1)}`);
		return `M${(TURBINE.hubRadius * k).toFixed(1)} -2 L${lead.join(' L')} L${(TURBINE.radius * k).toFixed(1)} 0 L${trail.join(' L')} L${(TURBINE.hubRadius * k).toFixed(1)} 3 Z`;
	})();

	// ---------------------------------------------------------------- the section, from the tip
	/** Leading edge of the section, where the velocity triangle ends. */
	const P = { x: 660, y: 300 };
	const CH = 200;
	const tang = $derived((lambda * el.r * (1 + el.ap)) / TURBINE.radius);
	const axial = $derived(1 - el.a);
	/** Pixels per unit of wind speed V, so that the triangle fits. */
	const kv = $derived(Math.min(70, 280 / Math.max(tang, 1e-3), 200 / Math.max(axial, 1e-3)));
	const S = $derived({ x: P.x - tang * kv, y: P.y + axial * kv });
	const corner = $derived({ x: P.x, y: P.y + axial * kv });
	const setAngle = $derived((el.twist + pitch) * DEG);
	const chordDir = $derived({ x: Math.cos(setAngle), y: -Math.sin(setAngle) });
	const normal = $derived({ x: -Math.sin(setAngle), y: -Math.cos(setAngle) });

	/** NACA-style outline: 18% thick, 2% camber (a schematic shape; the polars are the data). */
	const outline = $derived.by(() => {
		const n = 40;
		const up: string[] = [];
		const lo: string[] = [];
		for (let i = 0; i <= n; i++) {
			const b = (i / n) * Math.PI;
			const x = (1 - Math.cos(b)) / 2;
			const yt =
				5 *
				0.18 *
				(0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
			const yc =
				x < 0.4 ? (0.02 / 0.16) * (0.8 * x - x * x) : (0.02 / 0.36) * (0.2 + 0.8 * x - x * x);
			const at = (h: number) => {
				const sx = P.x + x * CH * chordDir.x + h * CH * normal.x;
				const sy = P.y + x * CH * chordDir.y + h * CH * normal.y;
				return `${sx.toFixed(1)} ${sy.toFixed(1)}`;
			};
			up.push(at(yc + yt));
			lo.unshift(at(yc - yt));
		}
		return `M${up.join(' L')} L${lo.join(' L')} Z`;
	});

	const Wlen = $derived(Math.hypot(tang, axial));
	const wDir = $derived({ x: tang / Wlen, y: -axial / Wlen });
	/** Lift is perpendicular to W, toward the suction side; drag along W. */
	const liftDir = $derived({ x: wDir.y, y: -wDir.x });
	/** Origin of the force inset, and its scale (px per unit of force coefficient). */
	const O = { x: 560, y: 225 };
	const FK = 95;
	const L = $derived({ x: O.x + liftDir.x * el.cl * FK, y: O.y + liftDir.y * el.cl * FK });
	const D = $derived({ x: O.x + wDir.x * el.cd * FK, y: O.y + wDir.y * el.cd * FK });
	const cn = $derived(el.cl * Math.cos(el.phi * DEG) + el.cd * Math.sin(el.phi * DEG));
	const ctan = $derived(el.cl * Math.sin(el.phi * DEG) - el.cd * Math.cos(el.phi * DEG));
	const showForces = $derived(Math.abs(el.cl) > 0.02);

	const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
		const p0 = { x: cx + r * Math.cos(a0), y: cy - r * Math.sin(a0) };
		const p1 = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) };
		const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
		const sweep = a1 > a0 ? 0 : 1;
		return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${r} ${r} 0 ${large} ${sweep} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
	};
	const phiRad = $derived(el.phi * DEG);
	const ldText = $derived(Math.abs(el.cd) > 1e-4 ? `${Math.round(el.cl / el.cd)}` : '—');
</script>

<g>
	<Readout id="title" order={0} label="Chart" value="One blade section of the NREL 5-MW rotor">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={15}
			weight={700}
			text="One blade section, seen from the blade tip"
		/>
	</Readout>

	<!-- ===================== rotor from upwind ===================== -->
	<circle cx={HX} cy={HY} r={RPX} fill="none" stroke="var(--stage-grid)" stroke-width="1" />
	{#each [0, 1, 2] as b (b)}
		<g transform="translate({HX} {HY}) rotate({(-(ang + (b * 2 * Math.PI) / 3) * 180) / Math.PI})">
			<path d={bladePath} fill="var(--wt-blade)" opacity="0.85" />
			{#if b === 0}
				<circle cx={el.r * k} cy="0" r="7" fill="none" stroke="var(--wt-spin)" stroke-width="2.5" />
			{/if}
		</g>
	{/each}
	<circle cx={HX} cy={HY} r="9" fill="var(--wt-blade)" />
	<Readout id="rotor-cap">
		<Label
			x={HX}
			y={HY + RPX + 22}
			text="the rotor from upwind, turning at λ = {lambda.toFixed(2)}"
			size={11}
			muted
		/>
	</Readout>

	<!-- ===================== the section ===================== -->
	<line x1="360" x2="940" y1={P.y} y2={P.y} stroke="var(--stage-line)" stroke-dasharray="6 5" />
	<Readout id="plane">
		<Label x={366} y={P.y - 8} anchor="start" text="rotor plane" size={11} muted />
	</Readout>
	<path d={outline} fill="var(--wt-blade)" opacity="0.9" />
	<line
		x1={P.x}
		y1={P.y}
		x2={P.x + CH * 1.1 * chordDir.x}
		y2={P.y + CH * 1.1 * chordDir.y}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="3 3"
	/>
	<Readout id="chord">
		<Label
			x={P.x + CH * 1.1 * chordDir.x + 6}
			y={P.y + CH * 1.1 * chordDir.y + 4}
			anchor="start"
			text="chord"
			size={11}
			muted
		/>
	</Readout>
	<!-- blade motion -->
	<line
		x1={930}
		y1={P.y + 44}
		x2={850}
		y2={P.y + 44}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
		opacity="0.8"
	/>
	<Readout id="moves">
		<Label x={890} y={P.y + 64} text="blade moves" size={11} muted />
	</Readout>

	<!-- velocity triangle -->
	<line
		x1={S.x}
		y1={S.y}
		x2={corner.x - 3}
		y2={corner.y}
		stroke="var(--wt-spin)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={corner.x}
		y1={corner.y}
		x2={P.x}
		y2={P.y + 4}
		stroke="var(--wt-wind)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={S.x}
		y1={S.y}
		x2={P.x - 4 * wDir.x}
		y2={P.y - 4 * wDir.y}
		stroke="var(--wt-rel)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<path d={arc(S.x, S.y, 60, 0, phiRad)} fill="none" stroke="var(--wt-rel)" stroke-width="1.2" />
	<Readout id="phi-label">
		<Label x={S.x - 8} y={S.y + 4} anchor="end" text="φ = {deg(el.phi)}" size={12} weight={600} />
	</Readout>
	<Readout id="tang-label">
		<Label
			x={(S.x + corner.x) / 2}
			y={corner.y + 20}
			text="Ωr(1 + a′) = {num(tang, 2)} V"
			size={12}
			color="var(--wt-spin)"
		/>
	</Readout>
	<Readout id="axial-label">
		<Label
			x={corner.x + 8}
			y={Math.max(P.y + 18, (corner.y + P.y) / 2 + 4)}
			anchor="start"
			text="(1 − a)V = {num(axial, 2)} V"
			size={12}
			color="var(--wt-wind)"
		/>
	</Readout>
	<Readout id="w-label">
		<Label
			x={(S.x + P.x) / 2 - 10}
			y={(S.y + P.y) / 2 - 10}
			anchor="end"
			text="relative wind W"
			size={12}
			color="var(--wt-rel)"
		/>
	</Readout>
	<!-- angle of attack, between W (extended) and the chord -->
	<line
		x1={P.x}
		y1={P.y}
		x2={P.x + 120 * wDir.x}
		y2={P.y + 120 * wDir.y}
		stroke="var(--wt-rel)"
		stroke-width="1"
		stroke-dasharray="2 3"
		opacity="0.7"
	/>
	<Readout id="alpha-label">
		<Label
			x={P.x - 10}
			y={P.y - 14}
			anchor="end"
			text="α = {deg(el.alpha)}"
			size={13}
			weight={700}
			color={stalled ? 'var(--wt-stall)' : 'var(--wt-lift)'}
		/>
	</Readout>

	<!-- forces, in an inset to their own scale -->
	<Readout id="forces-title">
		<Label
			x={O.x - 150}
			y={62}
			anchor="start"
			text="forces on the section (to scale)"
			size={11}
			muted
		/>
	</Readout>
	{#if showForces}
		<line
			x1={O.x}
			y1={O.y}
			x2={L.x}
			y2={L.y}
			stroke="var(--wt-lift)"
			stroke-width="3"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1={O.x}
			y1={O.y}
			x2={D.x}
			y2={D.y}
			stroke="var(--wt-drag)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<line
			x1={O.x}
			y1={O.y}
			x2={O.x}
			y2={O.y - cn * FK}
			stroke="var(--wt-thrust)"
			stroke-width="1.8"
			stroke-dasharray="5 3"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1={O.x}
			y1={O.y}
			x2={O.x - ctan * FK}
			y2={O.y}
			stroke="var(--wt-power)"
			stroke-width="2.5"
			marker-end={Math.abs(ctan * FK) > 6 ? 'url(#arrowhead)' : undefined}
		/>
		<Readout
			id="lift-label"
			order={6}
			label="Lift"
			value="CL = {num(el.cl, 2)}"
			color="var(--wt-lift)"
		>
			<Label x={L.x - 8} y={L.y + 4} anchor="end" text="lift" size={12} color="var(--wt-lift)" />
		</Readout>
		<Readout id="drag-label">
			<Label x={D.x + 8} y={D.y + 14} anchor="start" text="drag" size={11} color="var(--wt-drag)" />
		</Readout>
		<Readout id="thrust-label">
			<Label
				x={O.x + 8}
				y={O.y - cn * FK + 8}
				anchor="start"
				text="thrust part"
				size={11}
				color="var(--wt-thrust)"
			/>
		</Readout>
		<Readout id="torque-label">
			<Label
				x={O.x - 6}
				y={O.y + 18}
				anchor="end"
				text={ctan > 0 ? 'part that turns the rotor' : 'part that brakes the rotor'}
				size={11}
				color="var(--wt-power)"
			/>
		</Readout>
	{:else}
		<Readout id="no-lift">
			<Label x={O.x} y={O.y - 40} text="no lift here" size={12} muted />
		</Readout>
	{/if}

	<!-- ===================== readouts ===================== -->
	<Card x={20} y={372} w={300} h={210} />
	<Row
		id="r"
		order={1}
		x={38}
		y={400}
		w={264}
		label="Section"
		value="r = {num(el.r, 1)} m · {AF_NAMES[el.af]}"
	/>
	<Row
		id="lr"
		order={2}
		x={38}
		y={426}
		w={264}
		label="Local speed ratio λr/R"
		value={num((lambda * el.r) / TURBINE.radius, 2)}
		minor
	/>
	<Row
		id="set"
		order={3}
		x={38}
		y={452}
		w={264}
		label="Twist + pitch"
		value="{deg(el.twist)} + {deg(pitch)}"
		minor
	/>
	<Row
		id="alpha"
		order={4}
		x={38}
		y={478}
		w={264}
		label="Angle of attack α"
		value="{deg(el.alpha)}{stalled ? ' · stalled' : ''}"
		color={stalled ? 'var(--wt-stall)' : undefined}
	/>
	<Row
		id="ld"
		order={5}
		x={38}
		y={504}
		w={264}
		label="Lift ÷ drag"
		value="{num(el.cl, 2)} ÷ {num(el.cd, 3)} = {ldText}"
	/>
	<Row
		id="ind"
		order={7}
		x={38}
		y={530}
		w={264}
		label="Induction a, a′"
		value="{num(el.a, 3)}, {num(el.ap, 4)}"
		minor
	/>
	<Readout id="stall-note">
		<Label
			x={38}
			y={562}
			anchor="start"
			text={Number.isFinite(stall) ? `this section stalls near α = ${stall.toFixed(1)}°` : ''}
			size={11}
			muted
		/>
	</Readout>
</g>
