<script lang="ts">
	/**
	 * The Earth going round the Sun with its tilted axis.
	 *
	 * Phases (`step.hints.phase`), blended with one tween `k` (0 → 1):
	 *   orbit    — k = 0: the orbit seen from slightly above (a perspective
	 *              ellipse), a large globe whose axis keeps pointing the same
	 *              way in space, ghost Earths at the solstices and equinoxes,
	 *              and a panel with the season, the Sun's overhead latitude and
	 *              the day length at the poles
	 *   distance — k = 1: the same orbit seen from straight above, its shape to
	 *              scale (a circle with the Sun 1.7% of the radius off centre),
	 *              perihelion and aphelion, and a chart that sets the tiny
	 *              change in sunlight from distance against the seasonal swing
	 *              at 40° N and 40° S
	 *
	 * One 3D model drives everything. World frame: X to the right (ecliptic
	 * longitude 90°, where the Sun is at the June solstice), Y up (ecliptic
	 * north), Z away from the viewer. The camera is raised by `elev` above the
	 * orbit plane and projects orthographically. The Earth's axis is the fixed
	 * vector (sin ε, cos ε, 0): it leans towards +X all year.
	 *
	 * The date lives in `params.day` (shared with the slider); the Earth is a
	 * Handle that writes to it. Nothing moves on its own except a gentle
	 * "drag me" pulse at the start of the step (a function of t).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { dateText } from '../steps';
	import {
		dailySunshine,
		dayLength,
		declination,
		ECCENTRICITY,
		MARCH_EQUINOX_DAY,
		PERIHELION_DAY,
		sunDistance,
		sunLongitude,
		TILT,
		YEAR
	} from '../sky';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type V3 = [number, number, number];
	const RAD = Math.PI / 180;
	const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
	const AU_MKM = 149.6; // million km

	// ---- phase blend ----------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'orbit'));
	// Start in the step's own view: the stage remounts this scene when it is entered
	// from another scene (the two steps are not adjacent), and a fresh mount should
	// not replay the change of view. Between the two phases the tween morphs.
	const blend = new Tween(
		untrack(() => (phase === 'distance' ? 1 : 0)),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const target = phase === 'distance' ? 1 : 0;
		const instant = reduced;
		untrack(() => blend.set(target, { duration: instant ? 0 : 800 }));
	});
	const k = $derived(blend.current);
	const orbitW = $derived(smoothstep(0.5, 1, 1 - k)); // panel text swaps halfway
	const distW = $derived(smoothstep(0.5, 1, k));

	// ---- camera and layout -------------------------------------------------------
	const SY = 296;
	const SX = $derived(lerp(318, 296, k));
	const elev = $derived(lerp(30, 90, k) * RAD);
	const sinE = $derived(Math.sin(elev));
	const cosE = $derived(Math.cos(elev));
	const orbitR = $derived(lerp(246, 186, k));
	const sunR = $derived(lerp(30, 9, k));
	const globeR = $derived(lerp(44, 9, k));
	const ghostR = 15;

	/** Screen offset (y down) and depth towards the viewer of a world vector. */
	const proj = (v: V3) => ({
		x: v[0],
		y: -(v[1] * cosE + v[2] * sinE),
		d: v[1] * sinE - v[2] * cosE
	});

	// Earth's direction from the Sun, in the orbit plane, for a day of the year.
	// Ecliptic longitude of the Earth = Sun's longitude + 180°; with +X at 90°
	// the angle from +X towards +Z is L + 90°.
	const earthAngle = (day: number) => (sunLongitude(day) + 90) * RAD;
	const wrap180 = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
	/**
	 * The (fractional) day of the year on which the Sun's longitude is `L`: the
	 * inverse of `sunLongitude`, which is not uniform (Kepler's second law), so a
	 * few Newton steps from the uniform guess.
	 */
	function dayAtLongitude(L: number) {
		let d = MARCH_EQUINOX_DAY + (L / 360) * YEAR;
		for (let i = 0; i < 4; i++) d += (wrap180(L - sunLongitude(d)) / 360) * YEAR;
		return ((d % YEAR) + YEAR) % YEAR;
	}
	/** Distance from the Sun in orbit radii: 1 in the orbit view, eccentric (to scale) in the distance view. */
	const radial = (day: number) => 1 + k * (sunDistance(day) - 1);
	function orbitPoint(day: number) {
		const a = earthAngle(day);
		const r = orbitR * radial(day);
		const p = proj([r * Math.cos(a), 0, r * Math.sin(a)]);
		return { x: SX + p.x, y: SY + p.y, a };
	}

	// ---- date --------------------------------------------------------------------
	const day = $derived(Number(params.day ?? 171));
	const L = $derived(sunLongitude(day));
	const dec = $derived(declination(L));
	const E = $derived(orbitPoint(day));
	const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
	const EVENTS = ['March equinox', 'June solstice', 'September equinox', 'December solstice'];
	// Seasons are named from the Sun's longitude at noon on the date; within 1° of a
	// quarter point (about a day either side) the date is named after the event, and
	// the season it starts.
	const Lnoon = $derived(sunLongitude(day + 0.5));
	const quarter = $derived(Math.round(Lnoon / 90) % 4);
	const event = $derived(Math.abs(wrap180(Lnoon - quarter * 90)) < 1 ? EVENTS[quarter] : null);
	const seasonIndex = $derived(event ? quarter : Math.floor(Lnoon / 90) % 4);
	const north = $derived(SEASONS[seasonIndex]);
	const south = $derived(SEASONS[(seasonIndex + 2) % 4]);
	const seasonLine = $derived(event ?? `Northern ${north} · southern ${south}`);

	// ---- the globe ---------------------------------------------------------------
	const AXIS: V3 = [Math.sin(TILT * RAD), Math.cos(TILT * RAD), 0];
	const B1: V3 = [Math.cos(TILT * RAD), -Math.sin(TILT * RAD), 0];
	const B2: V3 = [0, 0, 1];
	const ARCTIC = 90 - TILT;

	const latPoint = (lat: number, psi: number): V3 => {
		const s = Math.sin(lat * RAD);
		const c = Math.cos(lat * RAD);
		return [0, 1, 2].map(
			(i) => s * AXIS[i] + c * (Math.cos(psi) * B1[i] + Math.sin(psi) * B2[i])
		) as V3;
	};
	const f1 = (n: number) => n.toFixed(1);

	/** Visible part of a circle of latitude, as a path (hidden parts left out). */
	function latPath(cx: number, cy: number, r: number, lat: number, n = 48) {
		let d = '';
		let pen = false;
		for (let i = 0; i <= n; i++) {
			const p = proj(latPoint(lat, (i / n) * 2 * Math.PI));
			if (p.d < 0) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${f1(cx + r * p.x)} ${f1(cy + r * p.y)}`;
			pen = true;
		}
		return d;
	}
	/** The Arctic cap as a filled ellipse (it is always almost entirely on the visible side). */
	function capPath(cx: number, cy: number, r: number, n = 36) {
		let d = '';
		for (let i = 0; i < n; i++) {
			const p = proj(latPoint(ARCTIC, (i / n) * 2 * Math.PI));
			d += `${i ? 'L' : 'M'}${f1(cx + r * p.x)} ${f1(cy + r * p.y)}`;
		}
		return d + 'Z';
	}
	/**
	 * The night half: the limb semicircle away from the Sun, closed by the
	 * projected terminator (a half-ellipse, like a Moon phase).
	 */
	function nightPath(cx: number, cy: number, r: number, s: V3, n = 24) {
		const sp = proj(s);
		const len = Math.hypot(sp.x, sp.y) || 1;
		const u = { x: sp.x / len, y: sp.y / len };
		const p = { x: -u.y, y: u.x };
		const minor = Math.abs(sp.d);
		const sigma = sp.d > 0 ? 1 : -1;
		let d = '';
		for (let i = 0; i <= n; i++) {
			const th = (i / n) * Math.PI;
			const x = cx + r * (Math.cos(th) * p.x - Math.sin(th) * u.x);
			const y = cy + r * (Math.cos(th) * p.y - Math.sin(th) * u.y);
			d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`;
		}
		for (let i = n; i >= 0; i--) {
			const th = (i / n) * Math.PI;
			const x = cx + r * (Math.cos(th) * p.x - sigma * minor * Math.sin(th) * u.x);
			const y = cy + r * (Math.cos(th) * p.y - sigma * minor * Math.sin(th) * u.y);
			d += `L${f1(x)} ${f1(y)}`;
		}
		return d + 'Z';
	}
	function globe(cx: number, cy: number, r: number, a: number, detail: boolean) {
		const s: V3 = [-Math.cos(a), 0, -Math.sin(a)]; // towards the Sun
		const pa = proj(AXIS);
		const ps = proj(s);
		const ext = 1.4;
		return {
			cx,
			cy,
			r,
			night: nightPath(cx, cy, r, s),
			cap: capPath(cx, cy, r),
			lines: detail
				? [
						{ id: 'eq', d: latPath(cx, cy, r, 0), main: true },
						{ id: 'arc', d: latPath(cx, cy, r, ARCTIC), main: false },
						{ id: 'ant', d: latPath(cx, cy, r, -ARCTIC), main: false }
					]
				: [{ id: 'eq', d: latPath(cx, cy, r, 0, 32), main: true }],
			axis: {
				x1: cx - ext * r * pa.x,
				y1: cy - ext * r * pa.y,
				x2: cx + ext * r * pa.x,
				y2: cy + ext * r * pa.y
			},
			pole: { x: cx + r * pa.x, y: cy + r * pa.y },
			sub: { x: cx + r * ps.x, y: cy + r * ps.y, visible: ps.d > 0.05 }
		};
	}
	const G = $derived(globe(E.x, E.y, globeR, E.a, true));

	// ---- orbit, months, seasonal markers ---------------------------------------------
	const orbitPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i < 120; i++) {
			const p = orbitPoint((i / 120) * YEAR);
			d += `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`;
		}
		return d + 'Z';
	});
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
	const near = (x: number, y: number, r0: number, r1: number) =>
		smoothstep(r0, r1, Math.hypot(E.x - x, E.y - y));
	const months = $derived(
		MONTHS.map((name, i) => {
			const tick = orbitPoint(MONTH_START[i]);
			const a = earthAngle(MONTH_START[i] + 15);
			// inside the ellipse in the orbit view, outside the circle in the distance view
			const r = orbitR * lerp(0.8, 1.11, k);
			const p = proj([r * Math.cos(a), 0, r * Math.sin(a)]);
			// Pushed clear of the big Earth when it sits on the label.
			let x = SX + p.x;
			let y = SY + p.y + 4;
			const dx = x - E.x;
			const dy = y - 4 - E.y;
			const dl = Math.hypot(dx, dy) || 1;
			const clear = globeR + 16;
			if (dl < clear) {
				x = E.x + (dx / dl) * clear;
				y = E.y + (dy / dl) * clear + 4;
			}
			const ta = earthAngle(MONTH_START[i]);
			const tp = proj([Math.cos(ta), 0, Math.sin(ta)]);
			const tl = Math.hypot(tp.x, tp.y) || 1;
			return {
				name,
				x,
				y,
				tick: {
					x1: tick.x - (5 * tp.x) / tl,
					y1: tick.y - (5 * tp.y) / tl,
					x2: tick.x + (5 * tp.x) / tl,
					y2: tick.y + (5 * tp.y) / tl
				},
				opacity: 1
			};
		})
	);

	// The four seasonal positions (where the Sun's longitude is 0°, 90°, 180°, 270°).
	const SEASON_MARKS = [
		{ id: 'mar', L: 0, name: 'March equinox', dx: 0, dy: -1 },
		{ id: 'jun', L: 90, name: 'June solstice', dx: 0, dy: 1 },
		{ id: 'sep', L: 180, name: 'September equinox', dx: 0, dy: 1 },
		{ id: 'dec', L: 270, name: 'December solstice', dx: 0, dy: 1 }
	];
	const ghosts = $derived(
		SEASON_MARKS.map((m) => {
			const p = orbitPoint(dayAtLongitude(m.L));
			const g = globe(p.x, p.y, ghostR, p.a, false);
			const ly = m.id === 'mar' ? p.y - 70 : m.id === 'sep' ? p.y + 68 : p.y + 72;
			return {
				...m,
				g,
				label: { x: p.x, y: ly },
				opacity: near(p.x, p.y, globeR + ghostR - 6, globeR + ghostR + 20),
				// placed clear of the big globe, so they never need to fade
				labelOpacity: 1
			};
		})
	);

	// ---- distance phase ------------------------------------------------------------
	const APHELION_DAY = PERIHELION_DAY + YEAR / 2;
	const peri = $derived(orbitPoint(PERIHELION_DAY));
	const aph = $derived(orbitPoint(APHELION_DAY));
	// The orbit's centre: ECCENTRICITY × radius from the Sun, towards aphelion.
	const centre = $derived.by(() => {
		const a = earthAngle(APHELION_DAY);
		const p = proj([ECCENTRICITY * orbitR * Math.cos(a), 0, ECCENTRICITY * orbitR * Math.sin(a)]);
		return { x: SX + p.x, y: SY + p.y };
	});
	const dist = $derived(sunDistance(day));
	const sunlight = $derived(1 / (dist * dist));
	const pct = (v: number, digits = 0) =>
		`${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(digits)}%`;
	const daysFrom = (a: number, b: number) => {
		const x = Math.abs(a - b) % YEAR;
		return Math.min(x, YEAR - x);
	};
	const FULL_MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const monthIndex = $derived.by(() => {
		let m = 11;
		while (MONTH_START[m] > day) m--;
		return m;
	});
	const closeness = $derived(
		daysFrom(day, PERIHELION_DAY) <= 5
			? 'closest to the Sun'
			: daysFrom(day, PERIHELION_DAY) <= 30
				? 'nearly at its closest to the Sun'
				: daysFrom(day, APHELION_DAY) <= 5
					? 'furthest from the Sun'
					: daysFrom(day, APHELION_DAY) <= 30
						? 'nearly at its furthest from the Sun'
						: day > PERIHELION_DAY && day < APHELION_DAY
							? 'moving away from the Sun'
							: 'getting closer to the Sun'
	);

	// Year chart: daily sunshine relative to each curve's yearly average.
	const CH = { x0: 600, x1: 880, y0: 318, y1: 470, lo: 0.2, hi: 1.8 };
	const cx = (d: number) => CH.x0 + (d / 365) * (CH.x1 - CH.x0);
	const cy = (v: number) => CH.y1 - ((v - CH.lo) / (CH.hi - CH.lo)) * (CH.y1 - CH.y0);
	const raw = (d: number) => {
		const de = declination(sunLongitude(d));
		const f = 1 / sunDistance(d) ** 2;
		return { n: dailySunshine(40, de, f), s: dailySunshine(-40, de, f), f };
	};
	const MEAN = (() => {
		const m = { n: 0, s: 0, f: 0 };
		for (let d = 0; d < 365; d++) {
			const r = raw(d);
			m.n += r.n / 365;
			m.s += r.s / 365;
			m.f += r.f / 365;
		}
		return m;
	})();
	const rel = (d: number) => {
		const r = raw(d);
		return { n: r.n / MEAN.n, s: r.s / MEAN.s, f: r.f / MEAN.f };
	};
	const CURVES = (() => {
		const pts = { n: '', s: '', f: '' };
		for (let d = 0; d <= 365; d += 5) {
			const r = rel(d);
			for (const key of ['n', 's', 'f'] as const)
				pts[key] += `${d ? 'L' : 'M'}${f1(cx(d))} ${f1(cy(r[key]))}`;
		}
		return pts;
	})();
	const SERIES = [
		{ id: 'n', name: '40° N', where: 'Madrid, New York', color: 'var(--explainer-accent)' },
		{ id: 's', name: '40° S', where: 'Tasmania, New Zealand', color: 'var(--sky-ocean)' },
		{ id: 'f', name: 'Distance alone', where: '1 / distance²', color: 'var(--stage-ink)' }
	] as const;
	const now = $derived(rel(day));
	// Closest vs furthest, as in the narrative: 2e in distance, ((1+e)/(1−e))² in sunlight.
	const spread = `Closest vs furthest: ${(2 * ECCENTRICITY * 100).toFixed(0)}% nearer, about ${(((1 + ECCENTRICITY) / (1 - ECCENTRICITY)) ** 2 * 100 - 100).toFixed(0)}% more sunlight`;

	// ---- orbit-phase panel -------------------------------------------------------------
	const leanLine = $derived(
		Math.abs(dec) < 0.5
			? 'Neither half leans towards the Sun'
			: `The ${dec > 0 ? 'northern' : 'southern'} half leans ${Math.abs(dec) < 12 ? 'slightly ' : Math.abs(dec) > 23.3 ? 'most ' : ''}towards the Sun`
	);
	const overhead = $derived(
		Math.abs(dec) < 0.05
			? 'the equator'
			: `${Math.abs(dec).toFixed(1)}° ${dec > 0 ? 'N' : 'S'}${Math.abs(dec) > 23.3 ? (dec > 0 ? ' (Tropic of Cancer)' : ' (Tropic of Capricorn)') : ''}`
	);
	const ROWS = [
		{ id: 'np', name: 'North Pole', lat: 90 },
		{ id: 'eq', name: 'Equator', lat: 0 },
		{ id: 'sp', name: 'South Pole', lat: -90 }
	];
	const rows = $derived(
		ROWS.map((r) => {
			// At an equinox the Sun circles the poles on the horizon: no meaningful day length.
			const horizon = r.lat !== 0 && Math.abs(dec) < 0.5;
			// drawn as a faint bar across the whole day
			const h = horizon ? 24 : dayLength(r.lat, dec);
			const value = horizon
				? 'Sun on the horizon'
				: h >= 23.95
					? '24 h · midnight Sun'
					: h <= 0.05
						? '0 h · polar night'
						: `${Math.round(h)} h`;
			return { ...r, h, horizon, value };
		})
	);

	// ---- interaction ---------------------------------------------------------------
	const wrapDay = (d: number) => ((Math.round(d) % 365) + 365) % 365;
	function onmove(p: Point) {
		const X = p.x - SX;
		const Z = -(p.y - SY) / Math.max(sinE, 0.2);
		const phi = Math.atan2(Z, X) / RAD;
		const Lp = (((phi - 90) % 360) + 360) % 360;
		setParam('day', wrapDay(dayAtLongitude(Lp)));
	}
	function onkey(step: number | 'start' | 'end') {
		if (step === 'start') return setParam('day', 0);
		if (step === 'end') return setParam('day', 364);
		setParam('day', wrapDay(day + step));
	}

	// Inviting pulse on the Earth at the start of a step.
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	// Panel positions.
	const PX = 646;
	const QX = 568;
	const pillW = (text: string, size: number) => text.length * size * 0.5 + 14;
</script>

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
		/** Degrees, about (x, y); the text is then centred vertically on y. */
		rotate?: number;
		/** A rounded card behind the text instead of a halo. */
		pill?: boolean;
	} = {}
)}
	{#if opts.pill}
		{@const pw = pillW(text, size)}
		<rect
			x={opts.anchor === 'start' ? x - 7 : opts.anchor === 'end' ? x - pw + 7 : x - pw / 2}
			y={y - size * 0.75 - 5}
			width={pw}
			height={size + 10}
			rx={(size + 10) / 2}
			fill="var(--surface)"
			stroke="var(--border)"
			opacity={opts.opacity ?? 1}
		/>
	{/if}
	<text
		{x}
		{y}
		class={opts.pill ? undefined : 'halo'}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		dominant-baseline={opts.rotate === undefined ? undefined : 'central'}
		transform={opts.rotate === undefined ? undefined : `rotate(${opts.rotate} ${x} ${y})`}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:pointer-events="none">{text}</text
	>
{/snippet}

{#snippet earth(g: ReturnType<typeof globe>)}
	<circle cx={g.cx} cy={g.cy} r={g.r} fill="var(--sky-ocean)" />
	<path d={g.cap} fill="var(--sky-moon)" opacity="0.85" />
	{#each g.lines as l (l.id)}
		<path
			d={l.d}
			fill="none"
			stroke="var(--sky-moon)"
			stroke-width={l.main ? 1.2 : 1}
			stroke-dasharray={l.main ? undefined : '3 3'}
			opacity={l.main ? 0.7 : 0.85}
		/>
	{/each}
	<path d={g.night} fill="var(--sky-night)" />
	<circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke="var(--stage-ink)" stroke-opacity="0.35" />
{/snippet}

<g>
	<defs>
		<radialGradient id="seasons-sun-glow">
			<stop offset="0" stop-color="var(--sky-sun)" stop-opacity="0.55" />
			<stop offset="1" stop-color="var(--sky-sun)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- ================= the orbit ================= -->
	<path d={orbitPath} fill="none" stroke="var(--sky-orbit)" stroke-width="1.5" />
	{#each months as m (m.name)}
		<line {...m.tick} stroke="var(--sky-orbit)" stroke-width="1.2" />
		{@render txt(m.x, m.y, m.name, 11, { anchor: 'middle', muted: true, opacity: m.opacity })}
	{/each}

	<!-- the Sun -->
	<circle cx={SX} cy={SY} r={sunR * 2.4} fill="url(#seasons-sun-glow)" />
	<circle cx={SX} cy={SY} r={sunR} fill="var(--sky-sun)" />

	<!-- ghost Earths at the solstices and equinoxes (orbit view) -->
	{#if k < 0.99}
		<g opacity={1 - k}>
			{#each ghosts as gh (gh.id)}
				<g opacity={0.6 * gh.opacity}>
					{@render earth(gh.g)}
					<line
						{...gh.g.axis}
						stroke="var(--stage-ink)"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</g>
				{@render txt(gh.label.x, gh.label.y, gh.name, 12, {
					anchor: 'middle',
					muted: true,
					opacity: gh.labelOpacity
				})}
			{/each}
		</g>
	{/if}

	<!-- perihelion, aphelion and the orbit's centre (distance view) -->
	{#if k > 0.01}
		<g opacity={k}>
			{#each [{ id: 'peri', p: peri, km: AU_MKM * (1 - ECCENTRICITY), name: 'closest · early January' }, { id: 'aph', p: aph, km: AU_MKM * (1 + ECCENTRICITY), name: 'furthest · early July' }] as m (m.id)}
				{@const ang = (Math.atan2(m.p.y - SY, m.p.x - SX) * 180) / Math.PI}
				{@const up = Math.abs(ang) > 90 ? ang + 180 : ang}
				<line
					x1={SX}
					y1={SY}
					x2={m.p.x}
					y2={m.p.y}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="4 4"
				/>
				<circle cx={m.p.x} cy={m.p.y} r="3.5" fill="var(--stage-ink-muted)" />
				{@render txt(
					lerp(SX, m.p.x, 0.62) + 12 * Math.sin(up * RAD),
					lerp(SY, m.p.y, 0.62) - 12 * Math.cos(up * RAD),
					`${m.km.toFixed(1)} million km`,
					13,
					{ anchor: 'middle', weight: 600, rotate: up }
				)}
				{@render txt(
					lerp(SX, m.p.x, 0.62) - 12 * Math.sin(up * RAD),
					lerp(SY, m.p.y, 0.62) + 12 * Math.cos(up * RAD),
					m.name,
					11,
					{ anchor: 'middle', muted: true, rotate: up }
				)}
			{/each}
			<!-- dark on the fixed Sun colour in both themes -->
			<path
				d="M{centre.x - 5} {centre.y}h10M{centre.x} {centre.y - 5}v10"
				stroke="var(--sky-night-solid)"
				stroke-width="1.4"
			/>
			{@render txt(SX, SY - 62, '+ centre of the orbit:', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(SX, SY - 48, 'the Sun is only 1.7% of the radius off it', 11, {
				anchor: 'middle',
				muted: true
			})}
		</g>
	{/if}

	<!-- ================= the Earth ================= -->
	{#if pulse > 0.01}
		<circle
			cx={E.x}
			cy={E.y}
			r={globeR + 10 + 10 * pulse}
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="2"
			opacity={0.5 * pulse}
		/>
	{/if}
	<Handle
		x={E.x}
		y={E.y}
		r={globeR}
		label="The Earth on its orbit"
		value={day}
		min={0}
		max={364}
		valuetext="{dateText(day)}{event ? `, ${event}` : ''}: northern {north}, southern {south}"
		{onmove}
		{onkey}
	/>
	<g style:pointer-events="none">
		{@render earth(G)}
		{#if G.sub.visible}
			<circle
				cx={G.sub.x}
				cy={G.sub.y}
				r={lerp(4, 1.5, k)}
				fill="var(--sky-sun)"
				stroke="var(--stage-ink)"
				stroke-width="0.8"
			/>
		{/if}
		{#if k < 0.99}
			<g opacity={1 - k}>
				<line {...G.axis} stroke="var(--stage-ink)" stroke-width="2.2" stroke-linecap="round" />
				{@render txt(G.axis.x2 + 4, G.axis.y2 - 4, 'N', 12, { weight: 600 })}
			</g>
		{/if}
	</g>

	<!-- footnote under the drawing -->
	{#if orbitW > 0.01}
		{@render txt(
			24,
			578,
			'Perspective view, from slightly above the orbit. Sun and Earth hugely enlarged; not to scale.',
			11,
			{ muted: true, opacity: orbitW }
		)}
	{/if}
	{#if distW > 0.01}
		{@render txt(
			24,
			578,
			'Seen from straight above. The orbit’s shape is to scale; the Sun and the Earth are enlarged.',
			11,
			{ muted: true, opacity: distW }
		)}
	{/if}

	<!-- ================= panel: orbit ================= -->
	{#if orbitW > 0.01}
		<g opacity={orbitW}>
			{@render txt(PX, 92, dateText(day), 28, { weight: 600 })}
			{@render txt(PX, 126, seasonLine, 16, { weight: 600 })}
			{#if event}
				{@render txt(PX, 148, `Northern ${north} and southern ${south} begin`, 13)}
				{@render txt(PX, 166, leanLine, 13, { muted: true })}
			{:else}
				{@render txt(PX, 148, leanLine, 13, { muted: true })}
			{/if}

			{@render txt(PX, 192, 'Sun overhead at noon', 12, { muted: true })}
			<circle
				cx={PX + 5}
				cy={210}
				r="4"
				fill="var(--sky-sun)"
				stroke="var(--stage-ink)"
				stroke-width="0.8"
			/>
			{@render txt(PX + 16, 215, overhead, 15, { weight: 600 })}

			{@render txt(PX, 258, 'Daylight in one day', 12, { muted: true })}
			{#each rows as r, i (r.id)}
				{@const y = 284 + i * 44}
				{@const w = 290}
				{@render txt(PX, y, r.name, 13, { weight: 600 })}
				{@render txt(PX + w, y, r.value, 13, { anchor: 'end' })}
				<rect
					x={PX}
					y={y + 8}
					width={w}
					height="9"
					rx="4.5"
					fill="var(--stage-line)"
					opacity="0.7"
				/>
				{#if r.h > 0.05}
					<rect
						x={PX + (w * (1 - r.h / 24)) / 2}
						y={y + 8}
						width={(w * r.h) / 24}
						height="9"
						rx="4.5"
						fill="var(--sky-sun)"
						opacity={r.horizon ? 0.45 : 1}
					/>
				{/if}
			{/each}
			{@render txt(PX, 404, 'midnight', 10, { muted: true })}
			{@render txt(PX + 145, 404, 'noon', 10, { muted: true, anchor: 'middle' })}
			{@render txt(PX + 290, 404, 'midnight', 10, { muted: true, anchor: 'end' })}

			{@render txt(PX, 456, 'The axis points the same way all year,', 13)}
			{@render txt(PX, 474, 'towards the North Star, wherever the', 13)}
			{@render txt(PX, 492, 'Earth is on its orbit.', 13)}
		</g>
	{/if}

	<!-- ================= panel: distance ================= -->
	{#if distW > 0.01}
		<g opacity={distW}>
			{@render txt(QX, 92, dateText(day), 28, { weight: 600 })}
			{@render txt(QX, 124, `${(AU_MKM * dist).toFixed(1)} million km from the Sun`, 16, {
				weight: 600
			})}
			{@render txt(
				QX,
				146,
				`Sunlight from distance: ${pct(sunlight - 1, 1)} vs average distance`,
				13,
				{ muted: true }
			)}
			{@render txt(QX, 186, `${FULL_MONTHS[monthIndex]}: ${closeness} —`, 14, { weight: 600 })}
			{@render txt(
				QX,
				206,
				event
					? `and the ${event}: northern ${north} begins`
					: `and ${north} in the north, ${south} in the south`,
				14,
				{
					weight: 600
				}
			)}

			{@render txt(QX, 232, spread, 12, { muted: true })}
			{@render txt(QX, 262, 'Daily sunshine, compared with its yearly average', 12, {
				muted: true
			})}
			<!-- chart grid -->
			{#each [0.5, 1, 1.5] as v (v)}
				<line
					x1={CH.x0}
					x2={CH.x1}
					y1={cy(v)}
					y2={cy(v)}
					stroke={v === 1 ? 'var(--stage-line)' : 'var(--stage-grid)'}
					stroke-width={v === 1 ? 1.2 : 1}
				/>
				{@render txt(CH.x0 - 6, cy(v) + 4, v === 1 ? 'average' : `×${v}`, 10, {
					anchor: 'end',
					muted: true
				})}
			{/each}
			{#each MONTHS as m, i (m)}
				{@render txt(cx(MONTH_START[i] + 15), CH.y1 + 16, m[0], 10, {
					anchor: 'middle',
					muted: true
				})}
			{/each}
			<line
				x1={cx(day)}
				x2={cx(day)}
				y1={CH.y0 - 6}
				y2={CH.y1 + 2}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 3"
			/>
			{#each SERIES as s (s.id)}
				<path
					d={CURVES[s.id]}
					fill="none"
					stroke={s.color}
					stroke-width={s.id === 'f' ? 3 : 2.2}
					stroke-linejoin="round"
				/>
				<circle
					cx={cx(day)}
					cy={cy(now[s.id])}
					r="4.5"
					fill={s.color}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/each}
			<!-- legend with today's values -->
			{#each SERIES as s, i (s.id)}
				{@const y = 512 + i * 20}
				<line
					x1={QX}
					x2={QX + 18}
					y1={y - 4}
					y2={y - 4}
					stroke={s.color}
					stroke-width="3"
					stroke-linecap="round"
				/>
				{@render txt(QX + 26, y, s.name, 12, { weight: 600 })}
				{@render txt(QX + 120, y, s.where, 11, { muted: true })}
				{@render txt(QX + 340, y, pct(now[s.id] - 1, s.id === 'f' ? 1 : 0), 12, {
					anchor: 'end',
					weight: 600
				})}
			{/each}
		</g>
	{/if}
</g>
