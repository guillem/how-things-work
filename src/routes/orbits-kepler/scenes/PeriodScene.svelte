<script lang="ts">
	/**
	 * Kepler's third law: a log–log chart of the year T (years) against the orbit's
	 * size a (AU) with the eight planets on the line T² = a³ (slope 3/2), and the
	 * reader's orbit from `params.ellipseSpeed` (launched straight across at 1 AU,
	 * `elements()` in the model) as a highlighted dot that moves with the slider.
	 *
	 * Beside it, Mercury, Venus, Earth and Mars go round on circles at their true
	 * relative speeds (1 year ≈ 6 s), with the reader's orbit as an ellipse whose
	 * planet follows Kepler's equation, so "bigger orbits, longer years" is seen.
	 * Under reduced motion t is frozen and the frame is a static chart.
	 */
	import { clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { circularSpeed, elements, PLANETS } from '../orbits';

	let { t, params }: StageProps = $props();

	// ---- chart: equal pixels per decade on both axes, so slope 3/2 looks it ----
	const DEC = 110;
	const X0 = 96; // a = 0.1
	const YB = 538; // T = 0.03 (bottom)
	const LX = (a: number) => X0 + Math.log10(a / 0.1) * DEC;
	const LY = (T: number) => YB - Math.log10(T / 0.03) * DEC;
	const XR = LX(100);
	const YT = LY(1000);
	const TICKS = [0.1, 1, 10, 100];
	const fmt = (v: number) => (v < 1 ? String(v) : v.toLocaleString('en-US'));
	const MINOR = (() => {
		const out: { k: string; x?: number; y?: number }[] = [];
		for (const d of [0.1, 1, 10])
			for (let m = 2; m <= 9; m++) out.push({ k: `x${d * m}`, x: LX(d * m) });
		for (const d of [0.01, 0.1, 1, 10, 100])
			for (let m = 1; m <= 9; m++) {
				const v = d * m;
				if (v > 0.03 && v < 1000 && !TICKS.includes(v)) out.push({ k: `y${v}`, y: LY(v) });
			}
		return out;
	})();

	// Label offsets per planet, chosen so names never touch the line or each other.
	const OFF: Record<string, [number, number, 'start' | 'end']> = {
		Mercury: [-10, 5, 'end'],
		Venus: [-10, -6, 'end'],
		Earth: [-10, -6, 'end'],
		Mars: [-10, -8, 'end'],
		Jupiter: [10, 14, 'start'],
		Saturn: [-10, -6, 'end'],
		Uranus: [10, 14, 'start'],
		Neptune: [-10, -6, 'end']
	};

	// ---- the reader's orbit -------------------------------------------------------
	const s = $derived(clamp(Number(params.ellipseSpeed ?? 0.75), 0.3, 1.7));
	const el = $derived(elements({ x: 1, y: 0 }, { x: 0, y: s * circularSpeed(1) }));
	const bound = $derived(el.energy < 0);
	const yourA = $derived(bound ? el.a : Infinity);
	const yourT = $derived(bound ? el.period : Infinity);
	const onChart = $derived(bound && yourT < 1000 && yourA < 100);
	const dot = $derived(
		onChart ? { x: LX(yourA), y: LY(yourT) } : { x: XR, y: YT } // pinned at the corner
	);

	const days = (T: number) => (T < 2 ? `${Math.round(T * 365.25)} days` : `${T.toFixed(1)} years`);
	const yourText = $derived(
		bound
			? `a = ${yourA.toFixed(2)} AU, T = ${days(yourT)}`
			: 'it escapes: no closed orbit, no year'
	);

	// ---- side panel: orbits at true relative speeds -----------------------------------
	const PANEL = { x: 520, y: 16, w: 424, h: 568 };
	const OCX = PANEL.x + PANEL.w / 2;
	const OCY = 224;
	const PX = 96; // px per AU
	const SECONDS_PER_YEAR = 6;
	const SHOWN = PLANETS.filter((p) => p.a < 2);
	const angleOf = (period: number, phase: number) =>
		phase + (2 * Math.PI * t) / (SECONDS_PER_YEAR * period);
	const RX = PANEL.x + 20;
	const RR = PANEL.x + PANEL.w - 20;
	const PHASE: Record<string, number> = { Mercury: 0.6, Venus: 2.4, Earth: 0, Mars: 4.1 };

	/** Position on the reader's ellipse at time t (Kepler's equation, Newton iterations). */
	const yours = $derived.by(() => {
		if (!bound) return null;
		const { a, e, periAngle, period } = el;
		const b = a * Math.sqrt(1 - e * e);
		// At t = 0 the planet is at the launch point (1, 0): aphelion if slower than
		// circular, perihelion if faster.
		const M0 = s < 1 ? Math.PI : 0;
		const M = M0 + (2 * Math.PI * t) / (SECONDS_PER_YEAR * period);
		let E = M;
		for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		const xp = a * (Math.cos(E) - e);
		const yp = b * Math.sin(E);
		const c = Math.cos(periAngle);
		const sn = Math.sin(periAngle);
		// Ellipse centre and the planet, in AU (y up), then to screen.
		return {
			cx: OCX + -a * e * c * PX,
			cy: OCY - -a * e * sn * PX,
			rx: a * PX,
			ry: b * PX,
			rot: (-periAngle * 180) / Math.PI,
			px: OCX + (xp * c - yp * sn) * PX,
			py: OCY - (xp * sn + yp * c) * PX
		};
	});
</script>

<g>
	<defs>
		<clipPath id="period-view">
			<rect x={PANEL.x + 1} y={PANEL.y + 1} width={PANEL.w - 2} height="384" rx="13" />
		</clipPath>
		<clipPath id="period-chart">
			<rect x={X0} y={YT} width={XR - X0} height={YB - YT} />
		</clipPath>
	</defs>

	<!-- ===================================================== chart -->
	{#each MINOR as m (m.k)}
		{#if m.x !== undefined}
			<line x1={m.x} x2={m.x} y1={YT} y2={YB} stroke="var(--stage-grid)" opacity="0.6" />
		{:else}
			<line x1={X0} x2={XR} y1={m.y} y2={m.y} stroke="var(--stage-grid)" opacity="0.6" />
		{/if}
	{/each}
	{#each TICKS as v (v)}
		<line x1={LX(v)} x2={LX(v)} y1={YT} y2={YB} stroke="var(--stage-line)" opacity="0.35" />
		<line x1={X0} x2={XR} y1={LY(v)} y2={LY(v)} stroke="var(--stage-line)" opacity="0.35" />
		{@render txt(LX(v), YB + 18, fmt(v), 12, { anchor: 'middle', muted: true })}
		{@render txt(X0 - 8, LY(v) + 4, fmt(v), 12, { anchor: 'end', muted: true })}
	{/each}
	<line x1={X0} x2={XR} y1={YB} y2={YB} stroke="var(--stage-line)" />
	<line x1={X0} x2={X0} y1={YT} y2={YB} stroke="var(--stage-line)" />
	{@render txt(XR, YB + 38, 'size of the orbit, a (AU) →', 12, { anchor: 'end', muted: true })}
	{@render txt(X0 - 4, YT - 12, '↑ year, T (years)', 12, { muted: true })}

	<!-- T² = a³ -->
	<line
		x1={LX(0.1)}
		y1={LY(0.1 ** 1.5)}
		x2={LX(100)}
		y2={LY(1000)}
		stroke="var(--orb-path)"
		stroke-width="2"
		clip-path="url(#period-chart)"
	/>
	{@render txt(LX(5) - 40, LY(11.2) - 30, 'T² = a³', 15, { weight: 700, anchor: 'end' })}
	{@render txt(LX(5) - 40, LY(11.2) - 12, 'slope 3/2', 11, { muted: true, anchor: 'end' })}

	<!-- planets -->
	{#each PLANETS as p (p.name)}
		{@const o = OFF[p.name]}
		<circle cx={LX(p.a)} cy={LY(p.period)} r="5" fill="var(--stage-ink)" />
		{@render txt(LX(p.a) + o[0], LY(p.period) + o[1], p.name, 12, { anchor: o[2] })}
	{/each}
	{@render txt(LX(0.387) - 20, LY(0.241) + 19, '88 days', 11, { muted: true, anchor: 'end' })}
	{@render txt(LX(30.07) - 10, LY(164.8) + 10, '165 years', 11, { muted: true, anchor: 'end' })}

	<!-- your orbit -->
	{#if bound}
		<line
			x1={dot.x}
			x2={dot.x}
			y1={dot.y}
			y2={YB}
			stroke="var(--orb-planet)"
			stroke-dasharray="3 4"
			opacity="0.7"
		/>
		<line
			x1={X0}
			x2={dot.x}
			y1={dot.y}
			y2={dot.y}
			stroke="var(--orb-planet)"
			stroke-dasharray="3 4"
			opacity="0.7"
		/>
		<circle cx={dot.x} cy={dot.y} r="13" fill="var(--orb-planet)" opacity="0.18" />
		<circle
			cx={dot.x}
			cy={dot.y}
			r="7"
			fill="var(--orb-planet)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		{#if onChart}
			{@render txt(dot.x + 16, dot.y + 22, 'your orbit', 13, {
				weight: 700,
				color: 'var(--orb-planet)'
			})}
		{:else}
			{@render txt(dot.x - 16, dot.y + 22, 'your orbit: off the chart ↗', 13, {
				weight: 700,
				anchor: 'end',
				color: 'var(--orb-planet)'
			})}
		{/if}
	{/if}

	<!-- ===================================================== side panel -->
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<rect
		x={PANEL.x + 1}
		y={PANEL.y + 1}
		width={PANEL.w - 2}
		height="384"
		rx="13"
		fill="var(--orb-space)"
	/>
	<g clip-path="url(#period-view)">
		{#each SHOWN as p (p.name)}
			<circle
				cx={OCX}
				cy={OCY}
				r={p.a * PX}
				fill="none"
				stroke="var(--orb-path)"
				stroke-width="1"
				opacity="0.45"
			/>
		{/each}
		{#if yours}
			<ellipse
				cx={yours.cx}
				cy={yours.cy}
				rx={yours.rx}
				ry={yours.ry}
				transform="rotate({yours.rot} {yours.cx} {yours.cy})"
				fill="none"
				stroke="var(--orb-planet)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}
		<circle cx={OCX} cy={OCY} r="14" fill="var(--orb-star)" opacity="0.25" />
		<circle cx={OCX} cy={OCY} r="9" fill="var(--orb-star)" />
		{#each SHOWN as p (p.name)}
			{@const ang = angleOf(p.period, PHASE[p.name] ?? 0)}
			{@const x = OCX + Math.cos(ang) * p.a * PX}
			{@const y = OCY - Math.sin(ang) * p.a * PX}
			<circle cx={x} cy={y} r="5" fill="var(--stage-ink)" />
			{@render txt(x + 8, y - 7, p.name, 11, { muted: true })}
		{/each}
		{#if yours && (yours.py < PANEL.y || yours.py > PANEL.y + 384 || yours.px < PANEL.x || yours.px > PANEL.x + PANEL.w)}
			<!-- marked below, outside the clip -->
		{:else if yours}
			<circle
				cx={yours.px}
				cy={yours.py}
				r="6.5"
				fill="var(--orb-planet)"
				stroke="var(--orb-space)"
				stroke-width="1.5"
			/>
		{/if}
	</g>
	{#if yours && (yours.py < PANEL.y || yours.py > PANEL.y + 384 || yours.px < PANEL.x || yours.px > PANEL.x + PANEL.w)}
		{@render txt(PANEL.x + PANEL.w - 16, PANEL.y + 372, 'your planet: out of view, far out', 11, {
			anchor: 'end',
			color: 'var(--orb-planet)'
		})}
	{/if}
	{@render txt(PANEL.x + 16, PANEL.y + 26, 'Bigger orbits, longer years', 14, { weight: 700 })}
	{@render txt(PANEL.x + 16, PANEL.y + 44, 'true relative speeds · 1 year ≈ 6 s', 11, {
		muted: true
	})}

	<!-- readout -->
	<circle cx={RX + 6} cy="424" r="6.5" fill="var(--orb-planet)" />
	{@render txt(RX + 20, 429, 'Your orbit (launched across at 1 AU)', 13, { weight: 700 })}
	{@render txt(RX, 456, 'launch speed', 12, { muted: true })}
	{@render txt(RR, 456, `${(s * 29.8).toFixed(1)} km/s (${s.toFixed(2)} × circular)`, 13, {
		anchor: 'end',
		tabular: true
	})}
	{@render txt(RX, 480, yourText, 13, {
		weight: 600,
		color: bound ? undefined : 'var(--orb-planet)',
		tabular: true
	})}
	{#if bound}
		{@render txt(RX, 508, 'T²', 12, { muted: true })}
		{@render txt(
			RX + 30,
			508,
			yourT ** 2 < 1000 ? (yourT ** 2).toFixed(3) : Math.round(yourT ** 2).toLocaleString('en-US'),
			14,
			{
				weight: 700,
				tabular: true
			}
		)}
		{@render txt(RX + 150, 508, 'a³', 12, { muted: true })}
		{@render txt(
			RX + 180,
			508,
			yourA ** 3 < 1000 ? (yourA ** 3).toFixed(3) : Math.round(yourA ** 3).toLocaleString('en-US'),
			14,
			{
				weight: 700,
				tabular: true
			}
		)}
		{@render txt(RR, 508, 'equal', 12, { anchor: 'end', color: 'var(--orb-area)', weight: 700 })}
	{/if}
	{@render txt(RX, 540, 'In years and AU, every orbit round the Sun', 12, { muted: true })}
	{@render txt(RX, 558, 'has T² = a³, whatever its shape.', 12, { muted: true })}
</g>

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
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
