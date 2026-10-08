<script lang="ts">
	/**
	 * The Coriolis effect, and why it does not reach your sink.
	 *
	 * Phases (`step.hints.phase`):
	 *   coriolis — three square patches of ground (600 × 600 km) at 60° N, the
	 *              equator and 45° S. From the centre of each, parcels of air are
	 *              pushed off at 10 m/s to the N, E, S and W and coast freely
	 *              (`parcel()`); their paths grow with time (1 day ≈ 10 s), next
	 *              to dashed straight lines (where they would go on a planet that
	 *              does not spin). The animation loops every 12 s. Readouts:
	 *              f = 2Ω sin φ and the loop radius speed ÷ |f| per panel.
	 *   scale    — the Rossby number of everyday flows (`SCALES`) on a log axis,
	 *              one row each, with the line Ro = 1.
	 *
	 * "Send off more air" (`params.launch`, a press count) restarts the launches:
	 * the clock reading at the press is remembered in a frame-to-frame memo
	 * inside a `$derived` (the guide's sanctioned exception, as in
	 * newtons-laws/TrackScene). The paths are computed once per spin value; each
	 * frame only slices them.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { coriolis, parcel, rossby, SCALES, type Parcel } from '../atmosphere';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'coriolis'));
	const spin = $derived(clamp(Number(params.spin ?? 1), 0, 3));
	const launches = $derived(Number(params.launch ?? 0));

	// ---------------------------------------------------------------- coriolis
	const SPEED = 10; // m/s
	const DAY_S = 10; // seconds of animation per simulated day
	const LOOP = 12; // seconds per loop of the animation
	const RUN = 10.8; // seconds of the loop during which the parcels move (1.08 days)
	const STILL = 7; // reduced motion: 0.7 days, about one loop at 60° N and at 45° S
	const DT = 300; // model time step, s
	const STEPS = Math.ceil(((RUN / DAY_S) * 86400) / DT) + 1;
	const HALF_KM = 300; // the patch is 600 × 600 km
	const S = 270; // panel size in stage units
	const K = S / (2 * HALF_KM); // stage units per km
	const PANEL_TOP = 52;
	const HEADINGS = [0, 90, 180, 270];

	const PANELS = [
		{ lat: 60, title: '60° N', sub: 'northern hemisphere', cx: 30 + S / 2 },
		{ lat: 0, title: '0°', sub: 'the equator', cx: 480 },
		{ lat: -45, title: '45° S', sub: 'southern hemisphere', cx: 930 - S / 2 }
	].map((p, i) => ({ ...p, i, cy: PANEL_TOP + S / 2 }));

	const paths = $derived(
		PANELS.map((p) => HEADINGS.map((h) => parcel(p.lat, h, SPEED, spin, STEPS, DT)))
	);

	// Time since the last launch (memo: see the header comment).
	let memo = { key: -1, start: 0, last: 0 };
	const since = $derived.by(() => {
		if (memo.key !== launches || t < memo.last) {
			memo = { key: launches, start: memo.key === -1 || t < memo.last ? 0 : t, last: t };
		}
		memo.last = t;
		return Math.max(0, t - memo.start);
	});
	const tLoop = $derived(reduced ? STILL : cycle(since, LOOP) * LOOP);
	const tRun = $derived(Math.min(tLoop, RUN));
	const tSim = $derived((tRun / DAY_S) * 86400); // seconds of simulated time
	const pathOpacity = $derived(reduced ? 1 : 1 - smoothstep(LOOP - 0.7, LOOP - 0.05, tLoop));
	const days = $derived(tSim / 86400);

	/** The path of parcel `p` up to the current time, in stage units, and its head. */
	function partial(p: Parcel, cx: number, cy: number) {
		const f = Math.min(p.x.length - 1, tSim / p.dt);
		const n = Math.floor(f);
		const u = f - n;
		let d = `M${cx.toFixed(1)} ${cy.toFixed(1)}`;
		for (let i = 1; i <= n; i++)
			d += `L${(cx + p.x[i] * K).toFixed(1)} ${(cy - p.y[i] * K).toFixed(1)}`;
		const j = Math.min(p.x.length - 1, n + 1);
		const hx = cx + (p.x[n] + (p.x[j] - p.x[n]) * u) * K;
		const hy = cy - (p.y[n] + (p.y[j] - p.y[n]) * u) * K;
		d += `L${hx.toFixed(1)} ${hy.toFixed(1)}`;
		return { d, hx, hy };
	}

	const drawn = $derived(PANELS.map((p) => paths[p.i].map((par) => partial(par, p.cx, p.cy))));

	const SUP: Record<string, string> = {
		'-': '⁻',
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹'
	};
	function sci(v: number) {
		if (v === 0) return '0';
		const sign = v < 0 ? '−' : '';
		const a = Math.abs(v);
		let e = Math.floor(Math.log10(a));
		let m = a / 10 ** e;
		if (Number(m.toFixed(2)) >= 10) {
			m /= 10;
			e += 1;
		}
		const sup = String(e)
			.split('')
			.map((c) => SUP[c])
			.join('');
		return `${sign}${m.toFixed(2)} × 10${sup}`;
	}

	const readouts = $derived(
		PANELS.map((p) => {
			const f = p.lat === 0 ? 0 : coriolis(p.lat, spin);
			const turns =
				f === 0
					? p.lat === 0 && spin > 0
						? 'no turn at the equator'
						: 'no turn'
					: f > 0
						? 'turns right'
						: 'turns left';
			const radius = f === 0 ? '∞' : `${Math.round(SPEED / Math.abs(f) / 1000)} km`;
			const fText = f === 0 ? '0' : `${sci(f)} s⁻¹`;
			return { turns, radius, fText, arrow: f === 0 ? '' : f > 0 ? '↻' : '↺' };
		})
	);

	const GRID = [-200, -100, 0, 100, 200];

	// Mini globe (bottom left).
	const G = { cx: 96, cy: 500, r: 58 };
	const latY = (lat: number) => G.cy - G.r * Math.sin((lat * Math.PI) / 180);
	const latHalf = (lat: number) => G.r * Math.cos((lat * Math.PI) / 180);
	const spinTurn = $derived(reduced ? 0.3 : cycle(t, 6 / Math.max(spin, 0.05)));

	// ------------------------------------------------------------------- scale
	const CH_L = 300;
	const CH_R = 920;
	const LOG_MIN = -2;
	const LOG_MAX = 4;
	const xRo = (ro: number) =>
		CH_L + ((Math.log10(ro) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (CH_R - CH_L);
	const X1 = xRo(1);
	const ROW0 = 112;
	const ROW_H = 76;
	const AXIS_Y = ROW0 + SCALES.length * ROW_H - 26;
	const TICKS = [-2, -1, 0, 1, 2, 3, 4];
	const spaced = (v: number) => v.toLocaleString('en').replace(/,/g, ' ');
	const tickLabel = (e: number) => (e < 0 ? `0.${'0'.repeat(-e - 1)}1` : spaced(10 ** e));

	function round1(v: number) {
		const r = Number(v.toPrecision(1));
		return r >= 1 ? spaced(r) : String(r);
	}
	function sizeText(m: number) {
		if (m >= 1000) return `${spaced(m / 1000)} km`;
		if (m < 1) return `${Math.round(m * 100)} cm`;
		return `${m} m`;
	}

	const rows = SCALES.map((s, i) => {
		const ro = rossby(s.speed, s.size);
		return {
			...s,
			i,
			ro,
			y: ROW0 + i * ROW_H,
			x: xRo(ro),
			text: `≈ ${round1(ro)}`,
			detail: `${sizeText(s.size)} across · ${s.speed} m/s`
		};
	});
	/** Entrance: each dot slides out from the Ro = 1 line, one after another. */
	const enter = (i: number) => (reduced ? 1 : smoothstep(0.4 + i * 0.35, 1.4 + i * 0.35, t));
	const swirl = $derived(reduced ? 0 : t * 40);
</script>

<g>
	{#if phase !== 'scale'}
		<!-- ===================================================== coriolis -->
		<defs>
			{#each PANELS as p (p.i)}
				<clipPath id="coriolis-clip-{p.i}">
					<rect x={p.cx - S / 2} y={p.cy - S / 2} width={S} height={S} rx="8" />
				</clipPath>
			{/each}
		</defs>
		{#each PANELS as p (p.i)}
			{@const x0 = p.cx - S / 2}
			{@const y0 = p.cy - S / 2}
			{@const r = readouts[p.i]}
			<g>
				{@render txt(p.cx, 26, p.title, 16, { anchor: 'middle', weight: 700 })}
				{@render txt(p.cx, 42, p.sub, 11, { anchor: 'middle', muted: true })}
				<rect
					x={x0}
					y={y0}
					width={S}
					height={S}
					rx="8"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				<!-- 100 km grid -->
				{#each GRID as g (g)}
					<line
						x1={p.cx + g * K}
						x2={p.cx + g * K}
						y1={y0}
						y2={y0 + S}
						stroke="var(--stage-line)"
						stroke-opacity="0.45"
						stroke-width="1"
					/>
					<line
						x1={x0}
						x2={x0 + S}
						y1={p.cy - g * K}
						y2={p.cy - g * K}
						stroke="var(--stage-line)"
						stroke-opacity="0.45"
						stroke-width="1"
					/>
				{/each}
				<!-- compass -->
				<g transform="translate({x0 + S - 22} {y0 + 30})">
					<path d="M0 -16 L5 0 L0 -4 L-5 0 Z" fill="var(--stage-ink)" />
					{@render txt(0, 14, 'N', 11, { anchor: 'middle', weight: 700 })}
				</g>
				<!-- scale bar -->
				<line
					x1={x0 + 12}
					x2={x0 + 12 + 100 * K}
					y1={y0 + S - 12}
					y2={y0 + S - 12}
					stroke="var(--stage-ink-muted)"
					stroke-width="2"
				/>
				{@render txt(x0 + 12, y0 + S - 18, '100 km', 11, { muted: true })}

				<g clip-path="url(#coriolis-clip-{p.i})">
					<!-- straight on, on a planet that does not spin -->
					{#each HEADINGS as h (h)}
						{@const a = (h * Math.PI) / 180}
						{@const ghost = Math.min((SPEED * tSim) / 1000, 2 * HALF_KM) * K}
						<line
							x1={p.cx}
							y1={p.cy}
							x2={p.cx + Math.sin(a) * HALF_KM * 1.5 * K}
							y2={p.cy - Math.cos(a) * HALF_KM * 1.5 * K}
							stroke="var(--stage-ink-muted)"
							stroke-width="1.3"
							stroke-dasharray="5 5"
							opacity="0.8"
						/>
						{#if !reduced}
							<circle
								cx={p.cx + Math.sin(a) * ghost}
								cy={p.cy - Math.cos(a) * ghost}
								r="3.5"
								fill="var(--surface)"
								stroke="var(--stage-ink-muted)"
								stroke-width="1.3"
								opacity={pathOpacity}
							/>
						{/if}
					{/each}
					<!-- the paths seen from the ground -->
					<g opacity={pathOpacity}>
						{#each drawn[p.i] as d, k (k)}
							<path
								d={d.d}
								fill="none"
								stroke="var(--atm-wind)"
								stroke-width="2.4"
								stroke-linejoin="round"
								stroke-linecap="round"
							/>
						{/each}
						{#each drawn[p.i] as d, k (k)}
							<circle
								cx={d.hx}
								cy={d.hy}
								r="5"
								fill="var(--atm-wind)"
								stroke="var(--surface)"
								stroke-width="1.5"
							/>
						{/each}
					</g>
				</g>
				<circle cx={p.cx} cy={p.cy} r="3" fill="var(--stage-ink)" />

				{@render txt(p.cx, y0 + S + 28, `${r.turns} ${r.arrow}`.trim(), 16, {
					anchor: 'middle',
					weight: 700
				})}
				{@render txt(p.cx, y0 + S + 50, `f = 2Ω sin φ = ${r.fText}`, 12, {
					anchor: 'middle',
					muted: true,
					tabular: true
				})}
				{@render txt(p.cx, y0 + S + 68, `loop radius = speed ÷ f ≈ ${r.radius}`, 12, {
					anchor: 'middle',
					muted: true,
					tabular: true
				})}
			</g>
		{/each}

		<!-- mini globe: where the three patches are -->
		<g>
			<circle
				cx={G.cx}
				cy={G.cy}
				r={G.r}
				fill="var(--atm-ocean)"
				stroke="var(--stage-line)"
				stroke-width="1.2"
			/>
			{#each [60, 30, 0, -30, -45, -60] as lat (lat)}
				{@const marked = lat === 60 || lat === 0 || lat === -45}
				<line
					x1={G.cx - latHalf(lat)}
					x2={G.cx + latHalf(lat)}
					y1={latY(lat)}
					y2={latY(lat)}
					stroke="var(--stage-ink-muted)"
					stroke-width={marked ? 1.2 : 0.6}
					stroke-opacity={marked ? 0.9 : 0.35}
				/>
			{/each}
			<line
				x1={G.cx}
				x2={G.cx}
				y1={G.cy - G.r - 12}
				y2={G.cy + G.r + 8}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<!-- the spin: a dot riding an arc round the axis, west to east -->
			<g opacity={spin > 0 ? 1 : 0.15}>
				<ellipse
					cx={G.cx}
					cy={G.cy - G.r - 6}
					rx="20"
					ry="5"
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
				/>
				{#if spin > 0}
					<circle
						cx={G.cx + 20 * Math.sin(spinTurn * 2 * Math.PI)}
						cy={G.cy - G.r - 6 + 5 * Math.cos(spinTurn * 2 * Math.PI)}
						r="3"
						fill="var(--stage-ink)"
					/>
				{/if}
			</g>
			{#each PANELS as p (p.i)}
				<circle cx={G.cx} cy={latY(p.lat)} r="4" fill="var(--atm-wind)" />
				<line
					x1={G.cx + latHalf(p.lat)}
					x2={G.cx + G.r + 14}
					y1={latY(p.lat)}
					y2={latY(p.lat)}
					stroke="var(--stage-line)"
					stroke-width="1"
				/>
				{@render txt(G.cx + G.r + 18, latY(p.lat) + 4, p.title, 11, { muted: true })}
			{/each}
		</g>

		<!-- legend -->
		<g transform="translate(250 456)">
			<line
				x1="0"
				x2="30"
				y1="0"
				y2="0"
				stroke="var(--atm-wind)"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
			<circle cx="30" cy="0" r="5" fill="var(--atm-wind)" />
			{@render txt(46, 4, 'a parcel of air pushed off at 10 m/s, as seen from the ground', 12)}
			<line
				x1="0"
				x2="30"
				y1="26"
				y2="26"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.3"
				stroke-dasharray="5 5"
			/>
			<circle
				cx="30"
				cy="26"
				r="3.5"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.3"
			/>
			{@render txt(46, 30, 'where it would go if the Earth did not spin', 12)}
			{@render txt(
				0,
				68,
				reduced
					? 'Paths over 0.7 days (about one loop)'
					: `Time since launch: ${days.toFixed(2)} days`,
				15,
				{ weight: 600, tabular: true }
			)}
			{@render txt(0, 88, '1 day ≈ 10 s of animation · each patch is 600 km across', 11, {
				muted: true
			})}
			{#if spin === 0}
				{@render txt(0, 116, 'The planet is not spinning: the air goes straight.', 13, {
					weight: 600
				})}
			{/if}
		</g>
	{:else}
		<!-- ======================================================== scale -->
		{@render txt(24, 34, 'Rossby number  Ro = speed ÷ (f × size)', 16, { weight: 700 })}
		{@render txt(24, 54, 'f taken at 45° latitude · log scale: each step is ×10', 11, {
			muted: true
		})}

		<!-- the two regions -->
		<rect
			x={CH_L}
			y={ROW0 - 44}
			width={X1 - CH_L}
			height={AXIS_Y - ROW0 + 44}
			fill="var(--atm-cold)"
			fill-opacity="0.08"
		/>
		<rect
			x={X1}
			y={ROW0 - 44}
			width={CH_R - X1}
			height={AXIS_Y - ROW0 + 44}
			fill="var(--atm-warm)"
			fill-opacity="0.06"
		/>
		{@render txt((CH_L + X1) / 2, ROW0 - 26, "Earth's spin", 13, {
			anchor: 'middle',
			weight: 700
		})}
		{@render txt((CH_L + X1) / 2, ROW0 - 10, 'in control', 13, {
			anchor: 'middle',
			weight: 700
		})}
		{@render txt((X1 + CH_R) / 2, ROW0 - 18, "Earth's spin negligible", 13, {
			anchor: 'middle',
			weight: 700
		})}

		<!-- rows -->
		{#each rows as row (row.id)}
			{@const e = enter(row.i)}
			{@const x = X1 + (row.x - X1) * e}
			<line
				x1={CH_L}
				x2={CH_R}
				y1={row.y}
				y2={row.y}
				stroke="var(--stage-line)"
				stroke-opacity="0.6"
				stroke-dasharray="2 4"
			/>
			{@render icon(row.id, 44, row.y)}
			{@render txt(78, row.y - 3, row.label, 13, { weight: 600 })}
			{@render txt(78, row.y + 14, row.detail, 11, { muted: true })}
			<line
				x1={X1}
				x2={x}
				y1={row.y}
				y2={row.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				opacity={e}
			/>
			<circle
				cx={x}
				cy={row.y}
				r="7"
				fill={row.ro > 3 ? 'var(--atm-warm)' : 'var(--atm-cold)'}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@const beside = Math.abs(Math.log10(row.ro)) < 0.3}
			{@render txt(beside ? x + 13 : x, beside ? row.y + 4.5 : row.y - 13, row.text, 13, {
				anchor: beside ? 'start' : 'middle',
				weight: 700,
				opacity: e,
				tabular: true
			})}
		{/each}

		<!-- Ro = 1 -->
		<line
			x1={X1}
			x2={X1}
			y1={ROW0 - 44}
			y2={AXIS_Y}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>

		<!-- axis -->
		<line x1={CH_L} x2={CH_R} y1={AXIS_Y} y2={AXIS_Y} stroke="var(--stage-ink-muted)" />
		{#each TICKS as e (e)}
			{@const x = xRo(10 ** e)}
			<line x1={x} x2={x} y1={AXIS_Y} y2={AXIS_Y + 5} stroke="var(--stage-ink-muted)" />
			{@render txt(x, AXIS_Y + 19, e === 0 ? 'Ro = 1' : tickLabel(e), e === 0 ? 12 : 11, {
				anchor: 'middle',
				muted: e !== 0,
				weight: e === 0 ? 700 : 500
			})}
		{/each}

		<!-- note -->
		<g transform="translate(24 {AXIS_Y + 50})">
			{@render txt(
				0,
				0,
				'A sink drains in seconds; in a minute the Earth turns only ¼ of a degree.',
				13,
				{ weight: 600 }
			)}
			{@render txt(
				0,
				18,
				'The swirl in a plughole comes from the shape of the basin and how the water was already moving.',
				11,
				{ muted: true }
			)}
		</g>
	{/if}
</g>

{#snippet icon(id: string, x: number, y: number)}
	<g transform="translate({x} {y})">
		{#if id === 'sink'}
			<path
				d="M-20 -8 L20 -8 L15 10 Q0 16 -15 10 Z"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.4"
				stroke-linejoin="round"
			/>
			<ellipse
				cx="0"
				cy="-8"
				rx="20"
				ry="4.5"
				fill="var(--atm-ocean)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
			/>
			<g transform="translate(0 -8) scale(1 0.22) rotate({swirl})">
				<path
					d="M0 -14 A14 14 0 0 1 14 0 M0 14 A14 14 0 0 1 -14 0"
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="5"
				/>
			</g>
			<rect x="-2" y="13" width="4" height="7" fill="var(--stage-ink-muted)" />
		{:else if id === 'bath'}
			<path
				d="M-24 -6 L24 -6 L20 10 Q18 14 14 14 L-14 14 Q-18 14 -20 10 Z"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.4"
				stroke-linejoin="round"
			/>
			<rect x="-22" y="-5" width="44" height="5" fill="var(--atm-ocean)" />
			<line x1="-14" x2="-14" y1="14" y2="19" stroke="var(--stage-ink-muted)" stroke-width="2" />
			<line x1="14" x2="14" y1="14" y2="19" stroke="var(--stage-ink-muted)" stroke-width="2" />
			<path
				d="M18 -6 L18 -16 L12 -16"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
			/>
		{:else if id === 'tornado'}
			<path
				d="M-20 -16 Q0 -10 20 -16 Q12 -6 8 -2 Q4 4 4 8 Q2 14 -2 18 Q0 10 -4 4 Q-10 -4 -20 -16 Z"
				fill="var(--atm-cloud)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-linejoin="round"
			/>
			{#each [-10, -3, 4] as yy (yy)}
				<line
					x1={-15 + (yy + 16) * 0.55}
					x2={15 - (yy + 16) * 0.5}
					y1={yy}
					y2={yy}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
				/>
			{/each}
		{:else if id === 'hurricane'}
			<g transform="rotate({-swirl * 0.25})">
				{#each [0, 120, 240] as a (a)}
					<path
						d="M0 0 Q10 -4 12 -12 Q14 -18 21 -18"
						transform="rotate({a})"
						fill="none"
						stroke="var(--atm-cloud)"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<path
						d="M0 0 Q10 -4 12 -12 Q14 -18 21 -18"
						transform="rotate({a})"
						fill="none"
						stroke="var(--stage-ink-muted)"
						stroke-width="1.2"
						stroke-linecap="round"
					/>
				{/each}
			</g>
			<circle cx="0" cy="0" r="3.5" fill="var(--surface)" stroke="var(--stage-ink-muted)" />
		{:else}
			{#each [8, 14, 20] as rr (rr)}
				<ellipse
					cx="0"
					cy="0"
					rx={rr * 1.15}
					ry={rr * 0.85}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
				/>
			{/each}
			{@render txt(0, 5, 'L', 13, { anchor: 'middle', weight: 800, color: 'var(--atm-low)' })}
		{/if}
	</g>
{/snippet}

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
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
