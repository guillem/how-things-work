<script lang="ts">
	/**
	 * A flyby of Jupiter (`flyby()` in `space.ts`). Left: Jupiter's view. The craft comes in
	 * from ahead of Jupiter (Jupiter, moving faster round the Sun, catches it up), swings
	 * round behind it on a hyperbola with closest approach `params.closest` Jupiter radii, and
	 * leaves at the same speed it came, turned. The view zooms so the closest approach stays
	 * in frame; the scale bar shows by how much. Right: the Sun's view as velocity arrows:
	 * Jupiter's velocity plus the craft's velocity relative to Jupiter, before and after; the
	 * circle is every velocity the turn can give. The flyby lasts 6 s on screen, then repeats.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { at, conic, flyby, JUPITER, type Vec } from '../space';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const PANEL = { x: 16, y: 16, w: 584, h: 568 };
	const CARD = { x: 616, y: 16, w: 328, h: 568 };
	const CL = CARD.x + 20;
	const CR = CARD.x + CARD.w - 20;
	const CX = 330;
	const CY = 290;

	const closestRJ = $derived(clamp(Number(params.closest ?? 8), 1.1, 40));
	const fb = $derived(flyby(closestRJ * JUPITER.radius));
	const pxPerRJ = $derived(clamp(110 / closestRJ, 2.6, 40));
	const K = $derived(pxPerRJ / JUPITER.radius);
	const toS = (r: Vec) => ({ x: CX + r.x * K, y: CY - r.y * K });

	// The hyperbola, from its closest point: velocity there along the bisector of the in and
	// out directions; the craft goes round anticlockwise, so the closest point is to the right
	// of that velocity.
	const hyper = $derived.by(() => {
		const ui = { x: fb.infIn.x / fb.vInf, y: fb.infIn.y / fb.vInf };
		const uo = { x: fb.infOut.x / fb.vInf, y: fb.infOut.y / fb.vInf };
		const b = { x: ui.x + uo.x, y: ui.y + uo.y };
		const bl = Math.hypot(b.x, b.y);
		const vhat = { x: b.x / bl, y: b.y / bl };
		const rhat = { x: vhat.y, y: -vhat.x };
		const rp = closestRJ * JUPITER.radius;
		const vp = Math.sqrt(fb.vInf ** 2 + (2 * JUPITER.gm) / rp);
		const o = conic(
			JUPITER.gm,
			{ x: rhat.x * rp, y: rhat.y * rp },
			{ x: vhat.x * vp, y: vhat.y * vp }
		);
		// Long enough to leave the frame either side.
		const reach = 380 / K;
		const span = reach / fb.vInf;
		let d = '';
		for (let i = 0; i <= 160; i++) {
			const s = -span + (2 * span * i) / 160;
			const p = toS(at(o, s).r);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return { o, span, d, peri: toS({ x: rhat.x * rp, y: rhat.y * rp }) };
	});

	/** Label spots beside the path where it enters and leaves the view. */
	const spot = (sign: number) => {
		const inside = (p: { x: number; y: number }) =>
			p.x > PANEL.x + 90 &&
			p.x < PANEL.x + PANEL.w - 24 &&
			p.y > PANEL.y + 110 &&
			p.y < PANEL.y + PANEL.h - 60;
		for (let i = 0; i <= 60; i++) {
			const p = toS(at(hyper.o, sign * hyper.span * (1 - i / 60)).r);
			if (inside(p)) return { x: p.x - 12, y: p.y + (sign < 0 ? -10 : 18) };
		}
		return { x: PANEL.x + PANEL.w - 24, y: PANEL.y + 130 };
	};
	const inAt = $derived(spot(-1));
	const outAt = $derived(spot(1));

	const FLY = 6;
	const HOLD = 2;
	const local = $derived(reduced ? FLY * 0.75 : t % (FLY + HOLD));
	const u = $derived(clamp(local / FLY));
	const craft = $derived(at(hyper.o, -hyper.span + 2 * hyper.span * u));
	const cs = $derived(toS(craft.r));
	const relSpeed = $derived(Math.hypot(craft.v.x, craft.v.y));
	const fade = $derived(smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u)));

	// ---- the Sun's view: velocity arrows ------------------------------------------------------
	const VK = 12.5 / 1000; // px per m/s
	const O = { x: CL + 6, y: CARD.y + 318 };
	const vs = (v: Vec) => ({ x: O.x + v.x * VK, y: O.y - v.y * VK });
	const J = $derived(vs(fb.vJupiter));
	const pin = $derived(vs(fb.vIn));
	const pout = $derived(vs(fb.vOut));
	const fmt = (v: number, d = 1) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const escapeR = $derived(fb.escape * VK);
</script>

<g>
	<defs>
		<clipPath id="flyby-panel">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#flyby-panel)">
		<path
			d={hyper.d}
			fill="none"
			stroke="var(--rk-path)"
			stroke-width="2"
			stroke-dasharray="5 5"
			opacity="0.8"
		/>
		<circle cx={CX} cy={CY} r={pxPerRJ} fill="var(--rk-jupiter)" />
		<ellipse
			cx={CX}
			cy={CY - pxPerRJ * 0.3}
			rx={pxPerRJ * 0.97}
			ry={pxPerRJ * 0.12}
			fill="var(--stage-ink)"
			opacity="0.12"
		/>
		<ellipse
			cx={CX}
			cy={CY + pxPerRJ * 0.25}
			rx={pxPerRJ * 0.98}
			ry={pxPerRJ * 0.1}
			fill="var(--stage-ink)"
			opacity="0.1"
		/>
		<line
			x1={CX}
			y1={CY}
			x2={hyper.peri.x}
			y2={hyper.peri.y}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 3"
		/>
		<circle
			cx={cs.x}
			cy={cs.y}
			r="5"
			fill="var(--stage-ink)"
			stroke="var(--orb-space)"
			stroke-width="1.5"
			opacity={fade}
		/>
	</g>
	<!-- Jupiter's motion -->
	<line
		x1={PANEL.x + 24}
		x2={PANEL.x + 110}
		y1={PANEL.y + 80}
		y2={PANEL.y + 80}
		stroke="var(--rk-jupiter)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="labels">
		<T x={PANEL.x + 20} y={PANEL.y + 32} text="Jupiter's view" size={14} weight={700} />
		<T
			x={PANEL.x + 20}
			y={PANEL.y + 50}
			text="(it is moving this way round the Sun at 13.1 km/s)"
			size={11}
			muted
		/>
		<T x={PANEL.x + 120} y={PANEL.y + 84} text="Jupiter's motion" size={11} muted />
		<T
			x={CX + pxPerRJ + 8}
			y={CY + pxPerRJ + 14}
			text="Jupiter"
			size={12}
			color="var(--rk-jupiter)"
		/>
		<T x={inAt.x} y={inAt.y} text="comes in" size={12} anchor="end" muted />
		<T x={outAt.x} y={outAt.y} text="leaves" size={12} anchor="end" muted />
		<T
			x={PANEL.x + 20}
			y={PANEL.y + PANEL.h - 32}
			text="speed relative to Jupiter: {fmt(relSpeed / 1000, 1)} km/s"
			size={12}
			weight={600}
		/>
		<T
			x={PANEL.x + 20}
			y={PANEL.y + PANEL.h - 14}
			text="scale: Jupiter's disc; closest approach {fmt(closestRJ, 1)} Jupiter radii"
			size={11}
			muted
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- card -->
	<Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />
	<Readout id="title">
		<T x={CL} y={CARD.y + 32} text="The Sun's view" size={16} weight={700} />
		<T x={CL} y={CARD.y + 50} text="velocity = Jupiter's + relative to Jupiter" size={11} muted />
	</Readout>
	<Readout
		id="rel"
		order={2}
		label="Relative to Jupiter"
		value="{fmt(fb.vInf / 1000, 2)} km/s in and out"
	>
		<T x={CL} y={CARD.y + 82} text="Relative to Jupiter, in and out" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 82}
			text="{fmt(fb.vInf / 1000, 2)} km/s"
			size={13}
			weight={600}
			anchor="end"
		/>
	</Readout>
	<Readout id="turn" order={1} label="Turned through" value="{fmt((fb.turn * 180) / Math.PI, 0)}°">
		<T x={CL} y={CARD.y + 104} text="Turned through" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 104}
			text="{fmt((fb.turn * 180) / Math.PI, 0)}°"
			size={13}
			weight={600}
			anchor="end"
		/>
	</Readout>
	<Readout
		id="sun"
		order={3}
		label="Round the Sun"
		value="{fmt(fb.speedIn / 1000, 1)} → {fmt(fb.speedOut / 1000, 1)} km/s"
		color="var(--rk-speed)"
	>
		<T x={CL} y={CARD.y + 130} text="Speed round the Sun" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 130}
			text="{fmt(fb.speedIn / 1000, 1)} → {fmt(fb.speedOut / 1000, 1)} km/s"
			size={14}
			weight={700}
			anchor="end"
			color="var(--rk-speed)"
		/>
		<T
			x={CR}
			y={CARD.y + 150}
			text="+{fmt(fb.gain / 1000, 1)} km/s, free"
			size={12}
			weight={600}
			anchor="end"
			color="var(--rk-spin)"
		/>
	</Readout>

	<!-- vector diagram -->
	<circle
		cx={J.x}
		cy={J.y}
		r={fb.vInf * VK}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
		opacity="0.6"
	/>
	<line
		x1={O.x + escapeR}
		x2={O.x + escapeR}
		y1={O.y - 92}
		y2={O.y + 92}
		stroke="var(--rk-gravity)"
		stroke-dasharray="4 4"
		opacity="0.7"
	/>
	<line
		x1={O.x}
		y1={O.y}
		x2={J.x}
		y2={J.y}
		stroke="var(--rk-jupiter)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={J.x}
		y1={J.y - 6}
		x2={pin.x}
		y2={pin.y - 6}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={J.x}
		y1={J.y}
		x2={pout.x}
		y2={pout.y}
		stroke="var(--rk-path)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={O.x}
		y1={O.y + 7}
		x2={pin.x}
		y2={pin.y + 7}
		stroke="var(--rk-orbit)"
		stroke-width="2"
		opacity="0.9"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={O.x}
		y1={O.y}
		x2={pout.x}
		y2={pout.y}
		stroke="var(--rk-speed)"
		stroke-width="2.5"
		marker-end="url(#arrowhead)"
	/>
	<circle cx={O.x} cy={O.y} r="3" fill="var(--stage-ink)" />
	<Readout id="vec-labels">
		<T x={O.x + escapeR + 4} y={O.y - 80} text="Sun's escape" size={10} muted />
		<T x={O.x + escapeR + 4} y={O.y - 68} text="{fmt(fb.escape / 1000, 1)} km/s" size={10} muted />
		<T
			x={(O.x + J.x) / 2}
			y={O.y - 12}
			text="Jupiter 13.1"
			size={11}
			anchor="middle"
			color="var(--rk-jupiter)"
		/>
		<T
			x={pin.x}
			y={O.y + 20}
			text="before {fmt(fb.speedIn / 1000, 1)}"
			size={11}
			anchor="middle"
			muted
		/>
		<T
			x={pout.x + (pout.y < O.y ? 0 : 0)}
			y={pout.y + (pout.y < O.y ? -10 : 18)}
			text="after {fmt(fb.speedOut / 1000, 1)}"
			size={11}
			anchor="middle"
			color="var(--rk-speed)"
		/>
	</Readout>
	<Readout id="notes">
		<T
			x={CL}
			y={CARD.y + 436}
			text="Dashed circle: all the ways the turn can point"
			size={11}
			muted
		/>
		<T
			x={CL}
			y={CARD.y + 452}
			text="the craft, at the same speed relative to Jupiter."
			size={11}
			muted
		/>
		<T x={CL} y={CARD.y + 478} text="The craft arrives on a Hohmann ellipse from" size={11} muted />
		<T
			x={CL}
			y={CARD.y + 494}
			text="the Earth, so Jupiter catches it up from behind."
			size={11}
			muted
		/>
		<T
			x={CL}
			y={CARD.y + 520}
			text="Pass closer for a sharper turn and more speed."
			size={11}
			muted
		/>
	</Readout>
</g>
