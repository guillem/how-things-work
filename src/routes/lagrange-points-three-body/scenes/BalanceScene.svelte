<script lang="ts">
	/**
	 * Sun–Earth L1 and L2, along the Sun–Earth line, to scale (1.5 million km ≈ 250 px): the
	 * Moon's orbit for scale, the point where the Sun's and Earth's pulls cancel (260,000 km from
	 * Earth), and two spacecraft on loops round L1 and L2 (schematic). Below, for each point, the
	 * accelerations seen from the stars: the Sun's pull, Earth's (against it at L1, with it at L2),
	 * their sum, and what a circle of one year at that distance needs; and the period the Sun's
	 * pull alone would give (Kepler's third law).
	 */
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SYSTEMS, accelUnit, equalPullFromSmall, lagrangePoints, pullsOnAxis } from '../model';
	import { BODY, C, fmtKm } from './shared';

	let { t, reduced }: StageProps = $props();

	const S = SYSTEMS['sun-earth'];
	const mu = S.mu;
	const L = lagrangePoints(mu);
	const u = accelUnit(S) * 1000; // mm/s² per frame unit
	const earthX = 1 - mu;

	// ---- the line, to scale ----------------------------------------------------
	const AX = 210; // y of the Sun–Earth line
	const EX = 480; // Earth on the stage
	const K = 250 / 1.5e6; // px per km
	const X = (x: number) => EX + (x - earthX) * S.a * K;
	const l1X = X(L.L1.x);
	const l2X = X(L.L2.x);
	const moonR = 384_400 * K;
	const cancelKm = equalPullFromSmall(mu) * S.a;
	const cancelX = EX - cancelKm * K;
	const l1Km = (earthX - L.L1.x) * S.a;
	const l2Km = (L.L2.x - earthX) * S.a;

	// moving parts: the Moon (27.3 days) and the two spacecraft (about six months), sped up
	const tt = $derived(reduced ? 2.5 : t);
	const moonA = $derived(2 * Math.PI * cycle(tt, 3.2));
	const craftA = $derived(2 * Math.PI * cycle(tt, 14));

	// ---- the bars ------------------------------------------------------------------
	interface Card {
		id: 'L1' | 'L2';
		x0: number;
		sun: number;
		earth: number;
		total: number;
		needed: number;
		/** Years per circle at that distance under the Sun's pull alone. */
		alone: number;
		/** ... and under the total pull. */
		both: number;
		km: number;
	}
	const card = (id: 'L1' | 'L2', x0: number): Card => {
		const x = L[id].x;
		const p = pullsOnAxis(mu, x);
		// distance from the centre of mass, and the period a pull g gives a circle of that size
		const r = Math.abs(x);
		const period = (g: number) => (2 * Math.PI * Math.sqrt(r / Math.abs(g))) / (2 * Math.PI);
		return {
			id,
			x0,
			sun: Math.abs(p.big) * u,
			earth: (Math.sign(p.small) === Math.sign(p.big) ? 1 : -1) * Math.abs(p.small) * u,
			total: Math.abs(p.big + p.small) * u,
			needed: Math.abs(p.needed) * u,
			alone: period(p.big),
			both: period(p.big + p.small),
			km: id === 'L1' ? l1Km : l2Km
		};
	};
	const cards = [card('L1', 40), card('L2', 500)];
	const CW = 420;
	const B0 = 5.6;
	const B1 = 6.1;
	const bx = (c: Card, a: number) => c.x0 + 20 + ((a - B0) / (B1 - B0)) * (CW - 40);
	const fmt = (a: number) => a.toFixed(3);
</script>

<g>
	<!-- ===================================================== the Sun–Earth line -->
	<line x1="40" x2="920" y1={AX} y2={AX} stroke="var(--stage-line)" stroke-width="1.2" />
	<path d="M60 {AX - 28} l-22 0 m8 -6 l-8 6 l8 6" fill="none" stroke={BODY.Sun} stroke-width="2" />
	<Readout id="sun-dir">
		<Label
			x={70}
			y={AX - 23}
			anchor="start"
			text="to the Sun, 150 million km"
			size={12}
			color={C.bigText}
			weight={600}
		/>
	</Readout>

	<!-- Moon's orbit -->
	<circle
		cx={EX}
		cy={AX}
		r={moonR}
		fill="none"
		stroke={C.orbit}
		stroke-width="1"
		stroke-dasharray="4 4"
	/>
	<circle
		cx={EX + moonR * Math.cos(moonA)}
		cy={AX - moonR * Math.sin(moonA)}
		r="3.5"
		fill={BODY.Moon}
	/>
	<Readout id="moon-orbit">
		<Label x={EX} y={AX + moonR + 18} text="the Moon’s orbit" size={11} muted />
	</Readout>

	<!-- the pulls cancel -->
	<line x1={cancelX} x2={cancelX} y1={AX - 8} y2={AX + 8} stroke={C.small} stroke-width="2.5" />
	<line
		x1={cancelX}
		x2={cancelX - 30}
		y1={AX - 10}
		y2={AX - 62}
		stroke={C.small}
		stroke-width="1"
	/>
	<Readout id="cancel" order={3} label="Pulls cancel" value="{fmtKm(cancelKm)} from Earth">
		<Label
			x={cancelX - 34}
			y={AX - 82}
			anchor="end"
			text="the pulls cancel here,"
			size={12}
			color={C.smallText}
			weight={600}
		/>
		<Label
			x={cancelX - 34}
			y={AX - 66}
			anchor="end"
			text="{fmtKm(cancelKm)} from Earth"
			size={12}
			color={C.smallText}
			tabular
		/>
	</Readout>

	<!-- Earth -->
	<circle cx={EX} cy={AX} r="9" fill={BODY.Earth} stroke="var(--stage-bg)" stroke-width="1.5" />
	<Label x={EX + 14} y={AX - 12} anchor="start" text="Earth" size={12} weight={600} />

	<!-- L1, L2 and the spacecraft loops (schematic) -->
	{#each [{ id: 'L1', x: l1X, km: l1Km, name: 'SOHO', sgn: -1 }, { id: 'L2', x: l2X, km: l2Km, name: 'JWST', sgn: 1 }] as p (p.id)}
		<ellipse
			cx={p.x}
			cy={AX}
			rx="26"
			ry="50"
			fill="none"
			stroke={C.probe}
			stroke-width="1.2"
			stroke-dasharray="3 4"
			opacity="0.8"
		/>
		<circle
			cx={p.x + 26 * Math.cos(craftA + (p.sgn > 0 ? 1.5 : 0))}
			cy={AX - 50 * Math.sin(craftA + (p.sgn > 0 ? 1.5 : 0))}
			r="4"
			fill={C.probe}
		/>
		<circle cx={p.x} cy={AX} r="5.5" fill="var(--stage-bg)" stroke={C.point} stroke-width="2" />
		<Label x={p.x} y={AX + 76} text={p.id} size={14} weight={700} color={C.pointText} />
		<Readout id="craft-{p.id}">
			<Label
				x={p.x + 34}
				y={AX - 40}
				anchor="start"
				text={p.name}
				size={11}
				color={C.probeText}
				weight={600}
			/>
		</Readout>
		<!-- dimension line to Earth -->
		<line
			x1={Math.min(p.x, EX)}
			x2={Math.max(p.x, EX)}
			y1={AX + 104}
			y2={AX + 104}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<line
			x1={p.x}
			x2={p.x}
			y1={AX + 98}
			y2={AX + 110}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<Readout
			id="dist-{p.id}"
			order={p.id === 'L1' ? 1 : 2}
			label="{p.id} from Earth"
			value={fmtKm(p.km)}
		>
			<Label x={(p.x + EX) / 2} y={AX + 98} text={fmtKm(p.km)} size={12} tabular />
		</Readout>
	{/each}
	<line
		x1={EX}
		x2={EX}
		y1={AX + 98}
		y2={AX + 110}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>
	<Readout id="scale">
		<Label
			x={920}
			y={AX - 82}
			anchor="end"
			text="distances to scale; loops schematic"
			size={11}
			muted
		/>
	</Readout>

	<!-- ===================================================== the accelerations -->
	{#each cards as c (c.id)}
		<g>
			<rect
				x={c.x0}
				y="352"
				width={CW}
				height="226"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={c.x0 + 16}
				y={378}
				anchor="start"
				text="at {c.id}, seen from the stars (mm/s²)"
				size={13}
				weight={700}
				halo={false}
			/>
			<!-- Sun -->
			<rect
				x={bx(c, B0)}
				y="394"
				width={bx(c, c.sun) - bx(c, B0)}
				height="16"
				rx="3"
				fill={C.big}
				opacity="0.9"
			/>
			<Label
				x={bx(c, B0)}
				y={426}
				anchor="start"
				text="Sun’s pull {fmt(c.sun)}"
				size={12}
				color={C.bigText}
				halo={false}
				tabular
			/>
			<!-- Earth, stacked on the Sun's bar: against it at L1, with it at L2 -->
			<rect
				x={Math.min(bx(c, c.sun), bx(c, c.sun + c.earth))}
				y="394"
				width={Math.abs(bx(c, c.sun + c.earth) - bx(c, c.sun))}
				height="16"
				fill={C.small}
				opacity={c.earth < 0 ? 0.45 : 0.95}
				stroke={C.small}
				stroke-width="1.5"
				stroke-dasharray={c.earth < 0 ? '3 2' : 'none'}
			/>
			<Label
				x={c.x0 + CW - 16}
				y={426}
				anchor="end"
				text="{c.earth < 0 ? '−' : '+'} Earth’s {fmt(Math.abs(c.earth))}"
				size={12}
				color={C.smallText}
				weight={600}
				halo={false}
				tabular
			/>
			<!-- total and needed -->
			<rect
				x={bx(c, B0)}
				y="444"
				width={bx(c, c.total) - bx(c, B0)}
				height="16"
				rx="3"
				fill="var(--stage-ink-muted)"
				opacity="0.7"
			/>
			<Label
				x={bx(c, B0)}
				y={476}
				anchor="start"
				text="together {fmt(c.total)}"
				size={12}
				halo={false}
				tabular
			/>
			<rect
				x={bx(c, B0)}
				y="490"
				width={bx(c, c.needed) - bx(c, B0)}
				height="16"
				rx="3"
				fill={C.needed}
				opacity="0.9"
			/>
			<Label
				x={bx(c, B0)}
				y={522}
				anchor="start"
				text="a one-year circle here needs {fmt(c.needed)}"
				size={12}
				color={C.neededText}
				weight={600}
				halo={false}
				tabular
			/>
			<line
				x1={bx(c, c.needed)}
				x2={bx(c, c.needed)}
				y1="440"
				y2="510"
				stroke={C.needed}
				stroke-width="1.2"
				stroke-dasharray="3 3"
			/>
			<Readout
				id="period-{c.id}"
				order={c.id === 'L1' ? 4 : 5}
				label="{c.id}: Sun alone / with Earth"
				value="{c.alone.toFixed(3)} yr / {c.both.toFixed(3)} yr"
			>
				<Label
					x={c.x0 + 16}
					y={552}
					anchor="start"
					text="the Sun alone: a circle here takes {c.alone.toFixed(3)} yr"
					size={12}
					muted
					halo={false}
					tabular
				/>
				<Label
					x={c.x0 + 16}
					y={570}
					anchor="start"
					text="with Earth’s pull: {c.both.toFixed(3)} yr, in step with Earth"
					size={12}
					weight={600}
					halo={false}
					tabular
				/>
			</Readout>
			<Label
				x={c.x0 + CW - 16}
				y={378}
				anchor="end"
				text="axis from {B0}"
				size={11}
				muted
				halo={false}
			/>
		</g>
	{/each}
</g>
