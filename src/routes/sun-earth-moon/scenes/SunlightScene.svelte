<script lang="ts">
	/**
	 * How much sunlight a place gets: the length of the day, the height of the
	 * Sun, and what the tilt of the axis does to both. One scene, three phases
	 * (`step.hints.phase`), cross-faded with tweens:
	 * - `day`: a globe on the chosen date (Sun on the left), the chosen latitude
	 *   circle split into its daylight and night parts, the 24 hours of that
	 *   place, and day length through the year (equator and polar circle faint);
	 * - `angle`: the noon Sun over flat ground: a beam of fixed width spread over
	 *   a patch 1/sin(altitude) long, the energy per m², and the daily total
	 *   through the year;
	 * - `tilt`: daily sunshine through the year for the chosen tilt against the
	 *   real one, and the two solstices of a tilted Earth. The date drifts by
	 *   itself (one year in 20 s) because this step has no date control.
	 *
	 * All the astronomy comes from `sky.ts`. The globe is drawn in a frame that
	 * turns with the Earth–Sun line (X towards the Sun, Z the upright of the
	 * orbit) and keeps the axis in the X–Z plane, leaning towards the Sun by the
	 * declination: day and night on the globe depend on nothing else. (The axis's
	 * fixed direction in space is the `seasons` scene's subject.)
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, scale, smoothstep, type Scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { dateText } from '../steps';
	import {
		TILT,
		dailySunshine,
		dayLength,
		declination,
		noonAltitude,
		spreading,
		sunLongitude
	} from '../sky';

	let { step, t, params, reduced }: StageProps = $props();

	const SUN = 'var(--sky-sun)';
	const OCEAN = 'var(--sky-ocean)';
	const SHADE = 'var(--sky-night)';
	const ACC = 'var(--explainer-accent, var(--accent))';
	/** Night on the latitude circle and the 24-hour bar (a fixed colour, like the palette's). */
	const DARK = 'var(--sky-night-solid)';

	const rad = (d: number) => (d * Math.PI) / 180;
	const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
	const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
	const ARCTIC = 90 - TILT;

	// ---- controls --------------------------------------------------------------------
	type Phase = 'day' | 'angle' | 'tilt';
	const phases: Phase[] = ['day', 'angle', 'tilt'];
	const phase = $derived.by((): Phase => {
		const p = String(step.hints?.phase ?? 'day') as Phase;
		return phases.includes(p) ? p : 'day';
	});
	const latTarget = $derived(clamp(Number(params.latitude ?? 40) || 0, -90, 90));
	const dayTarget = $derived(clamp(Number(params.day ?? 171) || 0, 0, 364));
	const tiltTarget = $derived(clamp(Number(params.tilt ?? 23.5) || 0, 0, 45));

	const tween = (v: number) => new Tween(v, { duration: 600, easing: cubicInOut });
	const latTw = tween(untrack(() => latTarget));
	const dayTw = tween(untrack(() => dayTarget));
	const tiltTw = tween(untrack(() => tiltTarget));
	$effect(() => {
		const v = latTarget;
		untrack(() => latTw.set(v, { duration: reduced ? 0 : 600 }));
	});
	$effect(() => {
		const v = dayTarget;
		untrack(() => dayTw.set(v, { duration: reduced ? 0 : 600 }));
	});
	$effect(() => {
		const v = tiltTarget;
		untrack(() => tiltTw.set(v, { duration: reduced ? 0 : 600 }));
	});
	const lat = $derived(latTw.current);
	const day = $derived(dayTw.current);
	const tilt = $derived(tiltTw.current);

	// ---- phase cross-fades -----------------------------------------------------------
	const initial = untrack(() => phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(p === initial ? 1 : 0, { duration: 800, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 800 });
		});
	});
	// The layouts differ, so the old phase is gone halfway through and the new one
	// appears in the second half: they never overlap.
	const show = $derived({
		day: smoothstep(0.5, 1, weights.day.current),
		angle: smoothstep(0.5, 1, weights.angle.current),
		tilt: smoothstep(0.5, 1, weights.tilt.current)
	});

	// ---- text helpers ----------------------------------------------------------------
	const latName = (v: number) => {
		const r = Math.round(v);
		return r === 0 ? 'the equator' : `${Math.abs(r)}° ${r > 0 ? 'N' : 'S'}`;
	};
	const latShort = (v: number) => {
		const r = Math.round(v);
		return r === 0 ? 'equator' : `${Math.abs(r)}° ${r > 0 ? 'N' : 'S'}`;
	};
	const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
	/** Hours as "14 h 50 min" (rounded to the minute). */
	const hm = (h: number) => {
		const m = Math.round(h * 60);
		const H = Math.floor(m / 60);
		const M = m % 60;
		return M === 0 ? `${H} h` : `${H} h ${M} min`;
	};
	/** Solar clock time "4:35". */
	const clock = (h: number) => {
		const m = Math.round((((h % 24) + 24) % 24) * 60);
		return `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`;
	};
	const x2 = (v: number) => (v <= 0 ? '0' : v < 0.01 ? 'under 0.01' : v.toFixed(2));

	/** Spreads label positions (sorted by wanted y) at least `gap` apart inside [lo, hi]. */
	function dodge<T extends { y: number }>(items: T[], gap: number, lo: number, hi: number): T[] {
		const out = items.map((d) => ({ ...d })).sort((a, b) => a.y - b.y);
		for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
		if (out.length && out[out.length - 1].y > hi) {
			out[out.length - 1].y = hi;
			for (let i = out.length - 2; i >= 0; i--) out[i].y = Math.min(out[i].y, out[i + 1].y - gap);
		}
		if (out.length && out[0].y < lo) {
			out[0].y = lo;
			for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
		}
		return out;
	}

	/** A quantity through the year (one point every 2 days) as an SVG path. */
	function yearPath(f: (d: number) => number, sx: Scale, sy: Scale) {
		let s = '';
		for (let d = 0; d <= 365; d += 2.5)
			s += `${d ? 'L' : 'M'}${sx(d).toFixed(1)} ${sy(f(d)).toFixed(1)}`;
		return s;
	}
	const decOn = (d: number, e = TILT) => declination(sunLongitude(d), e);

	// =================================================================== 3-D globe
	type V3 = [number, number, number];
	const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const cross = (a: V3, b: V3): V3 => [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	];
	// Viewer a little round towards the Sun, and above the orbit's plane for a
	// northern latitude (below it for a southern one), so the chosen latitude
	// circle is seen open rather than edge-on.
	const CAM_A = rad(28);
	const camElevTarget = $derived(latTarget < -0.5 ? -32 : 32);
	const camElev = new Tween(
		untrack(() => camElevTarget),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const v = camElevTarget;
		untrack(() => camElev.set(v, { duration: reduced ? 0 : 800 }));
	});
	const cam = $derived.by(() => {
		const e = rad(camElev.current);
		const view: V3 = [Math.sin(CAM_A) * Math.cos(e), Math.cos(CAM_A) * Math.cos(e), Math.sin(e)];
		const right: V3 = [-Math.cos(CAM_A), Math.sin(CAM_A), 0];
		return { view, right, up: cross(view, right) };
	});
	const GX = 282;
	const GY = 278;
	const GR = 128;
	interface P {
		x: number;
		y: number;
		z: number;
	}
	const proj = (p: V3): P => ({
		x: GX + GR * dot(p, cam.right),
		y: GY - GR * dot(p, cam.up),
		z: dot(p, cam.view)
	});
	const pt = (p: P) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

	/** Seconds per turn of the Earth in the drawing. */
	const DAY_S = 8;
	// Hour angle of the marked place (0 = local noon); 15:00 in the reduced-motion frame.
	const spin = $derived(45 + (360 * (t - 2.5)) / DAY_S);

	const dDay = $derived(decOn(day));
	const lenDay = $derived(dayLength(lat, dDay));
	const globe = $derived.by(() => {
		const d = rad(dDay);
		const N: V3 = [Math.sin(d), 0, Math.cos(d)];
		const c = Math.sqrt(1 - N[0] * N[0]); // cos(declination)
		const E1: V3 = [(1 - N[0] * N[0]) / c, (-N[0] * N[1]) / c, (-N[0] * N[2]) / c];
		const E2 = cross(N, E1);
		const at = (phi: number, h: number): V3 => {
			const cp = Math.cos(rad(phi));
			const sp = Math.sin(rad(phi));
			const ch = Math.cos(rad(h));
			const sh = Math.sin(rad(h));
			return [
				cp * (ch * E1[0] + sh * E2[0]) + sp * N[0],
				cp * (ch * E1[1] + sh * E2[1]) + sp * N[1],
				cp * (ch * E1[2] + sh * E2[2]) + sp * N[2]
			];
		};
		return { N, at };
	});

	/** Night side: front half of the terminator, then the limb through the night side. */
	const nightPath = $derived.by(() => {
		const V = cam.view;
		const f0 = Math.atan2(V[2], V[1]);
		const pts: P[] = [];
		for (let i = 0; i <= 36; i++) {
			const th = f0 - Math.PI / 2 + (Math.PI * i) / 36;
			pts.push(proj([0, Math.cos(th), Math.sin(th)]));
		}
		const a1 = Math.atan2(pts[36].y - GY, pts[36].x - GX);
		const a0 = Math.atan2(pts[0].y - GY, pts[0].x - GX);
		const night = proj([-1, 0, 0]);
		const an = Math.atan2(night.y - GY, night.x - GX);
		const mod = (v: number) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
		const ccw = mod(a0 - a1);
		const sweep = mod(an - a1) < ccw ? ccw : ccw - 2 * Math.PI;
		let s = `M${pts.map(pt).join('L')}`;
		for (let i = 1; i <= 36; i++) {
			const a = a1 + (sweep * i) / 36;
			s += `L${(GX + GR * Math.cos(a)).toFixed(1)} ${(GY + GR * Math.sin(a)).toFixed(1)}`;
		}
		return s + 'Z';
	});
	const sunPoint = $derived(proj([1, 0, 0]));

	/** Front segments of a polyline on the sphere (back ones are hidden by the globe). */
	function frontPath(ps: P[]) {
		let s = '';
		for (let i = 1; i < ps.length; i++)
			if (ps[i - 1].z > 0 && ps[i].z > 0) s += `M${pt(ps[i - 1])}L${pt(ps[i])}`;
		return s;
	}
	const meridians = $derived.by(() => {
		const out: { k: number; d: string }[] = [];
		for (let k = 0; k < 12; k++) {
			const ps: P[] = [];
			for (let phi = -90; phi <= 90; phi += 7.5) ps.push(proj(globe.at(phi, spin + k * 30)));
			out.push({ k, d: frontPath(ps) });
		}
		return out;
	});
	const equator = $derived.by(() => {
		const ps: P[] = [];
		for (let h = -180; h <= 180; h += 6) ps.push(proj(globe.at(0, h)));
		return frontPath(ps);
	});
	/** The chosen latitude circle, cut into daylight / night and front / back. */
	const circle = $derived.by(() => {
		const half = lenDay * 7.5; // degrees of hour angle either side of noon in daylight
		const out = { frontDay: '', frontNight: '', backDay: '', backNight: '' };
		const n = 120;
		let prev = proj(globe.at(lat, -180));
		for (let i = 1; i <= n; i++) {
			const h = -180 + (360 * i) / n;
			const p = proj(globe.at(lat, h));
			const mid = h - 180 / n;
			const lit = Math.abs(mid) < half;
			const front = prev.z + p.z > 0;
			const seg = `M${pt(prev)}L${pt(p)}`;
			if (front && lit) out.frontDay += seg;
			else if (front) out.frontNight += seg;
			else if (lit) out.backDay += seg;
			else out.backNight += seg;
			prev = p;
		}
		return out;
	});
	const place = $derived(proj(globe.at(lat, spin)));
	const placeLit = $derived(Math.abs(((((spin + 180) % 360) + 360) % 360) - 180) < lenDay * 7.5);
	const axis = $derived.by(() => {
		const N = globe.N;
		const s = (k: number) => proj([N[0] * k, N[1] * k, N[2] * k]);
		return {
			n0: s(1),
			n1: s(1.32),
			s0: s(-1),
			s1: s(-1.32),
			nl: s(1.46),
			sl: s(-1.46),
			nFront: dot(N, cam.view) > 0
		};
	});

	// ---- 24-hour bar -------------------------------------------------------------------
	const BX0 = 100;
	const BX1 = 460;
	const BY = 500;
	const bx = scale([0, 24], [BX0, BX1]);
	const localTime = $derived((((12 + spin / 15) % 24) + 24) % 24);

	// ---- day-length chart --------------------------------------------------------------
	const DX0 = 584;
	const DX1 = 856;
	const DY0 = 128;
	const DY1 = 436;
	const dsx = scale([0, 365], [DX0, DX1]);
	const dsy = scale([0, 24], [DY1, DY0]);
	const polarLat = $derived(lat < -0.5 ? -ARCTIC : ARCTIC);
	const dayCurves = $derived.by(() => {
		const L = lat;
		return {
			main: yearPath((d) => dayLength(L, decOn(d)), dsx, dsy),
			equator: yearPath(() => 12, dsx, dsy),
			polar: yearPath((d) => dayLength(polarLat, decOn(d)), dsx, dsy)
		};
	});
	const dayLabels = $derived.by(() => {
		const end = 364.5;
		const items = [
			{ key: 'main', y: dsy(dayLength(lat, decOn(end))) + 4, text: latShort(lat), main: true }
		];
		if (Math.round(lat) !== 0)
			items.push({ key: 'eq', y: dsy(12) + 4, text: 'equator', main: false });
		if (Math.abs(Math.abs(Math.round(lat)) - ARCTIC) > 0.7)
			items.push({
				key: 'polar',
				y: dsy(dayLength(polarLat, decOn(end))) + 4,
				text: `${ARCTIC.toFixed(1)}° ${polarLat > 0 ? 'N' : 'S'}`,
				main: false
			});
		return dodge(items, 15, DY0 + 4, DY1 + 4);
	});

	const dayTitle = $derived.by(() => {
		const where = cap(latName(lat));
		const when = dateText(day);
		if (lenDay >= 24) return `${where} on ${when}: the Sun does not set — 24 h of daylight`;
		if (lenDay <= 0) return `${where} on ${when}: the Sun does not rise — 24 h of night`;
		return `${where} on ${when}: ${hm(lenDay)} of daylight`;
	});
	const daySub = $derived.by(() => {
		if (Math.abs(dDay) < 1)
			return 'Equinox: neither half leans towards the Sun, so day and night are about 12 h each almost everywhere';
		const north = dDay > 0;
		const lean = `The ${north ? 'northern' : 'southern'} half leans towards the Sun`;
		const L = Math.round(lat);
		if (L === 0) return `${lean}; at the equator the day stays 12 h long all year`;
		const summer = L > 0 === north;
		return `${lean}: ${summer ? 'summer' : 'winter'} at ${latName(lat)}, ${summer ? 'winter' : 'summer'} in the ${L > 0 ? 'south' : 'north'}`;
	});

	// =================================================================== angle
	const GROUND = 430;
	const PX = 280; // centre of the lit patch
	const SUN_D = 236; // distance of the drawn Sun from the patch
	const BEAM = 64; // beam width (stands for 1 m)
	const alt = $derived(noonAltitude(lat, dDay));
	const perM2 = $derived(spreading(alt));
	const sunUp = $derived(smoothstep(0, 0.2, alt));
	const beam = $derived.by(() => {
		const A = rad(Math.max(alt, 0.4));
		const u = { x: -Math.cos(A), y: -Math.sin(A) }; // towards the Sun
		const hw = BEAM / 2 / Math.sin(A);
		const L = SUN_D - 20;
		const p1 = { x: PX - hw, y: GROUND };
		const p2 = { x: PX + hw, y: GROUND };
		const poly = [
			p1,
			p2,
			{ x: p2.x + u.x * L, y: p2.y + u.y * L },
			{ x: p1.x + u.x * L, y: p1.y + u.y * L }
		];
		const n = { x: Math.sin(A), y: -Math.cos(A) }; // across the beam, up-right
		const rays = [-0.32, 0, 0.32].map((f, i) => {
			const o = { x: PX + f * 2 * hw, y: GROUND };
			return { i, x1: o.x, y1: o.y, x2: o.x + u.x * L, y2: o.y + u.y * L };
		});
		// The "1 m" bracket across the beam, 60 % of the way up.
		const m = { x: PX + u.x * L * 0.62, y: GROUND + u.y * L * 0.62 };
		const b1 = { x: m.x - (n.x * BEAM) / 2, y: m.y - (n.y * BEAM) / 2 };
		const b2 = { x: m.x + (n.x * BEAM) / 2, y: m.y + (n.y * BEAM) / 2 };
		return {
			poly: poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
			rays,
			hw,
			b1,
			b2,
			bl: { x: b2.x + n.x * 14, y: b2.y + n.y * 14 },
			sun: { x: PX + u.x * SUN_D, y: GROUND + u.y * SUN_D }
		};
	});
	/** Where the Sun is drawn: on the beam line, or below the horizon when it does not rise. */
	const sunPos = $derived.by(() => {
		const A = rad(alt);
		return { x: PX - Math.cos(A) * SUN_D, y: GROUND - Math.sin(A) * SUN_D };
	});
	const arcPath = $derived.by(() => {
		const A = rad(Math.max(alt, 0));
		const r = 54;
		const large = 0;
		return `M${PX - r} ${GROUND}A${r} ${r} 0 ${large} 1 ${(PX - r * Math.cos(A)).toFixed(1)} ${(GROUND - r * Math.sin(A)).toFixed(1)}`;
	});
	const arcLabel = $derived.by(() => {
		const A = rad(Math.max(alt, 0) / 2);
		const r = 74;
		return { x: PX - r * Math.cos(A), y: GROUND - r * Math.sin(A) + 4 };
	});
	/** The Sun is on the equator's side of the zenith unless the place is under the tropics' Sun. */
	const sunSouth = $derived(Math.abs(lat - dDay) < 0.5 ? lat >= 0 : lat > dDay);
	const patchText = $derived.by(() => {
		const k = 1 / Math.max(perM2, 1e-6);
		const v = k < 10 ? k.toFixed(2) : k < 100 ? k.toFixed(1) : String(Math.round(k));
		return `lit patch: ${v} m`;
	});
	const altText = (a: number) => (a > 0 && a < 0.5 ? '< 1°' : `${Math.round(a)}°`);

	// Energy-per-m² bar.
	const EX = 520;
	const EW = 36;
	const EY0 = 158;
	const EY1 = GROUND;
	const ey = scale([0, 1], [EY1, EY0]);

	// Daily-total chart.
	const AX0 = 650;
	const AX1 = 880;
	const AY0 = 158;
	const AY1 = GROUND;
	const asx = scale([0, 365], [AX0, AX1]);
	const asy = scale([0, 1.3], [AY1, AY0]);
	const sunPath = $derived.by(() => {
		const L = lat;
		return yearPath((d) => dailySunshine(L, decOn(d)), asx, asy);
	});
	const today = $derived(dailySunshine(lat, dDay));
	const yearRange = (L: number, e: number) => {
		let lo = Infinity;
		let hi = 0;
		let dark = 0;
		for (let d = 0; d < 365; d++) {
			const dec = decOn(d, e);
			const q = dailySunshine(L, dec);
			lo = Math.min(lo, q);
			hi = Math.max(hi, q);
			if (dayLength(L, dec) <= 0) dark++;
		}
		return { lo, hi, dark };
	};
	const angleRange = $derived(yearRange(Math.round(latTarget), TILT));
	const ratioText = (r: { lo: number; hi: number; dark: number }) => {
		if (r.dark > 0) return `${r.dark} days with no sunshine at all`;
		const k = r.hi / r.lo;
		if (k >= 20) return 'sunniest day ÷ darkest: over 20×';
		return `sunniest day ÷ darkest: ${k.toFixed(1)}×`;
	};

	/** Only at a pole on the equinox itself: the Sun's centre runs along the horizon. */
	const grazing = $derived(Math.abs(alt) < 0.05);
	const angleTitle = $derived.by(() => {
		if (grazing)
			return `${cap(latName(lat))} on ${dateText(day)}: the Sun skims along the horizon all day`;
		if (alt <= 0)
			return `${cap(latName(lat))} on ${dateText(day)}: the Sun stays below the horizon all day`;
		const pct = Math.round(perM2 * 100);
		return `Noon Sun ${altText(alt)} high: each m² gets ${pct}% of the overhead value`;
	});
	const angleSub = $derived.by(() => {
		const where = `${cap(latName(lat))} on ${dateText(day)}`;
		if (grazing) return `${where}: the sunlight arrives flat, so the ground gets almost none`;
		if (alt <= 0) return `${where}: polar night, no sunlight reaches the ground`;
		return `${where} · ${hm(lenDay)} of daylight · the lower the Sun, the wider the patch the same beam covers`;
	});

	// =================================================================== tilt
	/** One year in 20 s; the reduced-motion frame (t = 2.5 s) is the June solstice. */
	const YEAR_S = 20;
	const drift = $derived((((171 + ((t - 2.5) * 365) / YEAR_S) % 365) + 365) % 365);
	const TX0 = 440;
	const TX1 = 846;
	const TY0 = 128;
	const TY1 = 420;
	const tsx = scale([0, 365], [TX0, TX1]);
	const yMaxFor = (L: number, e: number) =>
		Math.max(1.5, Math.ceil(Math.max(yearRange(L, e).hi, yearRange(L, TILT).hi) * 2) / 2);
	const yMaxTarget = $derived(yMaxFor(Math.round(latTarget), tiltTarget));
	const yMaxTw = new Tween(
		untrack(() => yMaxTarget),
		{ duration: 600, easing: cubicInOut }
	);
	$effect(() => {
		const v = yMaxTarget;
		untrack(() => yMaxTw.set(v, { duration: reduced ? 0 : 600 }));
	});
	const tsy = $derived(scale([0, yMaxTw.current], [TY1, TY0]));
	const tYTicks = $derived.by(() => {
		const out: number[] = [];
		for (let v = 0; v <= yMaxTarget + 1e-9; v += 0.5) out.push(v);
		return out;
	});
	const tiltCurves = $derived.by(() => {
		const L = lat;
		const e = tilt;
		return {
			main: yearPath((d) => dailySunshine(L, decOn(d, e)), tsx, tsy),
			real: yearPath((d) => dailySunshine(L, decOn(d)), tsx, tsy)
		};
	});
	const dTilt = $derived(decOn(drift, tilt));
	const tiltToday = $derived(dailySunshine(lat, dTilt));
	const tiltRange = $derived(yearRange(Math.round(latTarget), tiltTarget));
	const realRange = $derived(yearRange(Math.round(latTarget), TILT));
	const noTilt = $derived(tilt < 0.25);
	const nearReal = $derived(Math.abs(tiltTarget - TILT) < 0.3);
	const tiltName = (e: number) => (e < 0.25 ? 'no tilt' : `${Number(e.toFixed(1))}° tilt`);
	const tiltTitle = $derived(
		noTilt
			? `Daily sunshine at ${latName(lat)} with no tilt`
			: `Daily sunshine at ${latName(lat)} with the axis tilted ${Number(tilt.toFixed(1))}°`
	);
	const tiltSub = $derived.by(() => {
		if (noTilt)
			return 'No seasons: every day like an equinox, with 12 hours of daylight everywhere';
		const s = cap(ratioText(tiltRange));
		if (nearReal) return `${s} (the real Earth)`;
		const r = realRange;
		const short =
			r.dark > 0
				? `${r.dark} days`
				: r.hi / r.lo >= 20
					? 'over 20×'
					: `${(r.hi / r.lo).toFixed(1)}×`;
		// Same kind of figure on both sides: just the real one in brackets.
		if (tiltRange.dark > 0 === r.dark > 0) return `${s} (real tilt: ${short})`;
		return `${s} · real tilt: ${ratioText(r)}`;
	});
	const tiltLabels = $derived.by(() => {
		const end = 364.5;
		const items = [
			{
				key: 'main',
				y: tsy(dailySunshine(lat, decOn(end, tilt))) + 4,
				text: tiltName(tilt),
				main: true
			}
		];
		if (!nearReal)
			items.push({
				key: 'real',
				y: tsy(dailySunshine(lat, decOn(end))) + 4,
				text: 'real 23.4°',
				main: false
			});
		return dodge(items, 15, TY0 + 4, TY1 + 4);
	});

	// Solstice sketch: June (left of the Sun) and December (right), axis fixed in space.
	const SX = 210;
	const SY = 300;
	const ER = 50;
	const solstices = $derived.by(() => {
		const e = rad(tilt);
		const nx = Math.sin(e);
		const ny = -Math.cos(e);
		const phi = rad(lat);
		return [
			{ key: 'jun', cx: SX - 118, sunRight: true, name: 'June solstice', dec: tilt },
			{ key: 'dec', cx: SX + 118, sunRight: false, name: 'December solstice', dec: -tilt }
		].map((g) => {
			const c = { x: g.cx + Math.sin(phi) * ER * nx, y: SY + Math.sin(phi) * ER * ny };
			const hx = Math.cos(phi) * ER * Math.cos(e);
			const hy = Math.cos(phi) * ER * Math.sin(e);
			const a = { x: c.x - hx, y: c.y - hy };
			const b = { x: c.x + hx, y: c.y + hy };
			// Split the edge-on latitude circle where it crosses the terminator (x = cx).
			const s = hx > 1e-6 ? clamp((g.cx - c.x) / hx, -1, 1) : c.x >= g.cx ? -1 : 1;
			const m = { x: c.x + s * hx, y: c.y + s * hy };
			const lit = g.sunRight ? { p: m, q: b } : { p: a, q: m };
			const dark = g.sunRight ? { p: a, q: m } : { p: m, q: b };
			const night = g.sunRight
				? `M${g.cx} ${SY - ER}A${ER} ${ER} 0 0 0 ${g.cx} ${SY + ER}Z`
				: `M${g.cx} ${SY - ER}A${ER} ${ER} 0 0 1 ${g.cx} ${SY + ER}Z`;
			const len = dayLength(lat, g.dec);
			return {
				...g,
				lit,
				dark,
				night,
				n0: { x: g.cx + nx * ER * 1.36, y: SY + ny * ER * 1.36 },
				n1: { x: g.cx - nx * ER * 1.36, y: SY - ny * ER * 1.36 },
				nl: { x: g.cx + nx * ER * 1.6, y: SY + ny * ER * 1.6 },
				len
			};
		});
	});
	const tiltArc = $derived.by(() => {
		const e = rad(tilt);
		const r = ER * 1.2;
		const cx = SX + 118;
		return {
			d: `M${cx} ${SY - r}A${r} ${r} 0 0 1 ${(cx + r * Math.sin(e)).toFixed(1)} ${(SY - r * Math.cos(e)).toFixed(1)}`,
			lx: cx - 6,
			ly: SY - r - 4
		};
	});
	const lenText = (h: number) =>
		h >= 24 ? 'Sun never sets' : h <= 0 ? 'Sun never rises' : `${hm(h)} of daylight`;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; halo?: boolean } = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo ?? true}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet header(title: string, sub: string)}
	{@render txt(48, 40, title, 16, { weight: 600 })}
	{@render txt(48, 62, sub, 13, { muted: true })}
{/snippet}

{#snippet months(x0: number, x1: number, y: number, sx: Scale)}
	{#each MONTHS as m, i (i)}
		{@render txt(sx(MONTH_START[i] + 15), y, m, 11, { anchor: 'middle', muted: true })}
	{/each}
	<line x1={x0} x2={x1} y1={y - 16} y2={y - 16} stroke="var(--stage-line)" stroke-width="1" />
{/snippet}

{#snippet sunGlyph(x: number, y: number, r: number)}
	<circle cx={x} cy={y} r={r * 1.5} fill={SUN} opacity="0.18" />
	<circle cx={x} cy={y} {r} fill={SUN} />
{/snippet}

<g>
	<!-- ======================================================= day length -->
	{#if show.day > 0.001}
		<g opacity={show.day}>
			{@render header(dayTitle, daySub)}

			<!-- Sun and sunlight -->
			{@render sunGlyph(56, GY, 22)}
			{#each [-80, -40, 0, 40, 80] as dy (dy)}
				<line
					x1="92"
					x2={GX - Math.sqrt(GR * GR - dy * dy) * 0.92 - 10}
					y1={GY + dy}
					y2={GY + dy}
					stroke={SUN}
					stroke-width="2"
					stroke-dasharray="8 7"
					stroke-dashoffset={-t * 18}
					opacity="0.8"
				/>
			{/each}
			{@render txt(56, GY + 46, 'sunlight', 12, { anchor: 'middle', muted: true })}

			<!-- axis behind the globe -->
			<line
				x1={axis.s1.x}
				y1={axis.s1.y}
				x2={axis.n1.x}
				y2={axis.n1.y}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			<circle cx={GX} cy={GY} r={GR} fill={OCEAN} />
			<circle
				cx={sunPoint.x}
				cy={sunPoint.y}
				r={GR * 0.75}
				fill="url(#sunlight-sheen)"
				clip-path="url(#sunlight-disc)"
			/>
			{#each meridians as m (m.k)}
				<path d={m.d} fill="none" stroke="var(--stage-bg)" stroke-width="1" opacity="0.35" />
			{/each}
			<path d={equator} fill="none" stroke="var(--stage-bg)" stroke-width="1" opacity="0.6" />
			<path d={nightPath} fill={SHADE} />
			<circle cx={GX} cy={GY} r={GR} fill="none" stroke="var(--stage-line)" stroke-width="1" />
			<!-- hidden half of the latitude circle -->
			<path
				d={circle.backDay}
				fill="none"
				stroke={SUN}
				stroke-width="1.5"
				stroke-dasharray="3 4"
				opacity="0.7"
			/>
			<path
				d={circle.backNight}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
				stroke-dasharray="3 4"
				opacity="0.55"
			/>
			<!-- visible half -->
			<path
				d={circle.frontDay + circle.frontNight}
				fill="none"
				stroke="var(--sky-moon)"
				stroke-width="7.5"
				stroke-linecap="round"
			/>
			<path
				d={circle.frontNight}
				fill="none"
				stroke={DARK}
				stroke-width="4"
				stroke-linecap="round"
			/>
			<path d={circle.frontDay} fill="none" stroke={SUN} stroke-width="4" stroke-linecap="round" />
			<!-- poles -->
			{#if axis.nFront}
				<line
					x1={axis.n0.x}
					y1={axis.n0.y}
					x2={axis.n1.x}
					y2={axis.n1.y}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<circle cx={axis.n0.x} cy={axis.n0.y} r="2.5" fill="var(--stage-ink)" />
			{:else}
				<line
					x1={axis.s0.x}
					y1={axis.s0.y}
					x2={axis.s1.x}
					y2={axis.s1.y}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<circle cx={axis.s0.x} cy={axis.s0.y} r="2.5" fill="var(--stage-ink)" />
			{/if}
			{@render txt(axis.nl.x, axis.nl.y + 4, 'N', 13, { anchor: 'middle', weight: 600 })}
			{@render txt(axis.sl.x, axis.sl.y + 4, 'S', 13, { anchor: 'middle', weight: 600 })}
			<!-- the place, carried round by the Earth's turn -->
			<circle
				cx={place.x}
				cy={place.y}
				r="6"
				fill={placeLit ? SUN : DARK}
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={place.z > 0 ? 1 : 0.35}
			/>
			{@render txt(GX - GR - 6, GY + GR * 0.78, 'day side', 12, { anchor: 'end', muted: true })}
			{@render txt(GX + GR + 6, GY + GR * 0.78, 'night side', 12, { muted: true })}

			<!-- 24 hours at that latitude -->
			{@render txt(BX0, BY - 10, `One day at ${latName(lat)} (local solar time)`, 12, {
				muted: true
			})}
			<rect x={BX0} y={BY} width={BX1 - BX0} height="16" rx="3" fill={DARK} />
			{#if lenDay > 0}
				<rect
					x={bx(12 - lenDay / 2)}
					y={BY}
					width={bx(12 + lenDay / 2) - bx(12 - lenDay / 2)}
					height="16"
					rx="3"
					fill={SUN}
				/>
			{/if}
			<rect
				x={BX0}
				y={BY}
				width={BX1 - BX0}
				height="16"
				rx="3"
				fill="none"
				stroke="var(--stage-line)"
			/>
			{#each [0, 6, 12, 18, 24] as h (h)}
				<line x1={bx(h)} x2={bx(h)} y1={BY + 16} y2={BY + 21} stroke="var(--stage-line)" />
				{@render txt(bx(h), BY + 34, `${h}:00`, 11, { anchor: 'middle', muted: true })}
			{/each}
			<line
				x1={bx(localTime)}
				x2={bx(localTime)}
				y1={BY - 4}
				y2={BY + 20}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<circle
				cx={bx(localTime)}
				cy={BY - 5}
				r="4"
				fill={placeLit ? SUN : DARK}
				stroke="var(--stage-ink)"
				stroke-width="1"
			/>
			{@render txt(
				(BX0 + BX1) / 2,
				BY + 58,
				Math.abs(lat) > 89.5 && Math.abs(dDay) < 0.05
					? 'At the pole on the equinox the Sun skims along the horizon all day'
					: lenDay >= 24
						? 'Daylight all 24 hours: the Sun circles the sky without setting'
						: lenDay <= 0
							? 'Night all 24 hours: the Sun stays below the horizon'
							: `Sunrise ${clock(12 - lenDay / 2)} · sunset ${clock(12 + lenDay / 2)}: ${hm(lenDay)} of the 24 hours in daylight`,
				12,
				{ anchor: 'middle' }
			)}

			<!-- day length through the year -->
			{@render txt(DX0 - 36, DY0 - 30, 'Hours of daylight through the year', 13, { weight: 600 })}
			{#each [0, 6, 12, 18, 24] as v (v)}
				<line x1={DX0} x2={DX1} y1={dsy(v)} y2={dsy(v)} stroke="var(--stage-grid)" />
				{@render txt(DX0 - 8, dsy(v) + 4, `${v} h`, 11, { anchor: 'end', muted: true })}
			{/each}
			<line x1={DX0} x2={DX0} y1={DY0} y2={DY1} stroke="var(--stage-line)" />
			{@render months(DX0, DX1, DY1 + 16, dsx)}
			{#if Math.round(lat) !== 0}
				<path
					d={dayCurves.equator}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="5 4"
					opacity="0.8"
				/>
			{/if}
			<path
				d={dayCurves.polar}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				opacity="0.6"
			/>
			<path d={dayCurves.main} fill="none" stroke={ACC} stroke-width="3" stroke-linejoin="round" />
			{#each dayLabels as l (l.key)}
				{@render txt(DX1 + 8, l.y, l.text, l.main ? 13 : 11, {
					weight: l.main ? 600 : 500,
					muted: !l.main,
					color: l.main ? ACC : undefined
				})}
			{/each}
			<line
				x1={dsx(day)}
				x2={dsx(day)}
				y1={DY0}
				y2={DY1}
				stroke="var(--stage-ink)"
				stroke-width="1"
				stroke-dasharray="3 3"
				opacity="0.6"
			/>
			<circle
				cx={dsx(day)}
				cy={dsy(lenDay)}
				r="6"
				fill={ACC}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(clamp(dsx(day), DX0 + 18, DX1 - 18), DY0 - 8, dateText(day), 12, {
				anchor: 'middle',
				weight: 600
			})}
		</g>
	{/if}

	<!-- ======================================================= Sun height -->
	{#if show.angle > 0.001}
		<g opacity={show.angle}>
			{@render header(angleTitle, angleSub)}

			<!-- sky side: Sun and beam (clipped above the ground) -->
			<g clip-path="url(#sunlight-sky)">
				<g opacity={sunUp}>
					<polygon points={beam.poly} fill={SUN} opacity="0.22" />
					{#each beam.rays as r (r.i)}
						<line
							x1={r.x2}
							y1={r.y2}
							x2={r.x1}
							y2={r.y1}
							stroke={SUN}
							stroke-width="2"
							stroke-dasharray="10 12"
							stroke-dashoffset={-t * 30}
						/>
					{/each}
				</g>
				{@render sunGlyph(sunPos.x, sunPos.y, 20)}
			</g>
			<!-- ground -->
			<rect
				x="40"
				y={GROUND}
				width="440"
				height="30"
				rx="2"
				fill="var(--sky-land)"
				opacity="0.85"
			/>
			<line x1="40" x2="480" y1={GROUND} y2={GROUND} stroke="var(--stage-ink)" stroke-width="1.5" />
			<g opacity={sunUp}>
				<g clip-path="url(#sunlight-ground)">
					<rect
						x={PX - beam.hw}
						y={GROUND - 3}
						width={beam.hw * 2}
						height="6"
						rx="2"
						fill={SUN}
						stroke="var(--stage-ink)"
						stroke-width="0.75"
					/>
				</g>
				<!-- bracket across the beam: its width never changes -->
				<line
					x1={beam.b1.x}
					y1={beam.b1.y}
					x2={beam.b2.x}
					y2={beam.b2.y}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				{@render txt(beam.bl.x, beam.bl.y + 4, 'beam 1 m wide', 12)}
				<path d={arcPath} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" />
				{@render txt(arcLabel.x, arcLabel.y, altText(alt), 13, {
					anchor: 'middle',
					weight: 600
				})}
				{@render txt(
					PX,
					GROUND + 52,
					`${patchText}${beam.hw > 200 ? ' (wider than the picture)' : ''}`,
					12,
					{ anchor: 'middle' }
				)}
			</g>
			{@render txt(44, GROUND + 52, sunSouth ? '← south' : '← north', 12, { muted: true })}
			{#if Math.abs(Math.round(lat)) < 90}
				{@render txt(476, GROUND + 52, sunSouth ? 'north →' : 'south →', 12, {
					anchor: 'end',
					muted: true
				})}
			{/if}
			{#if alt <= 0}
				{@render txt(
					PX,
					GROUND - 120,
					grazing ? 'The Sun skims along the horizon' : 'The Sun stays below the horizon all day',
					14,
					{
						anchor: 'middle',
						weight: 600
					}
				)}
				{@render txt(
					PX,
					GROUND - 100,
					grazing ? 'its light arrives flat: almost none per m²' : 'no sunlight reaches the ground',
					12,
					{
						anchor: 'middle',
						muted: true
					}
				)}
			{/if}

			<!-- energy per square metre at noon -->
			{@render txt(EX + EW / 2, EY0 - 34, 'Each m²', 13, { anchor: 'middle', weight: 600 })}
			{@render txt(EX + EW / 2, EY0 - 18, 'at noon', 11, { anchor: 'middle', muted: true })}
			<rect
				x={EX}
				y={EY0}
				width={EW}
				height={EY1 - EY0}
				rx="3"
				fill="var(--stage-grid)"
				stroke="var(--stage-line)"
			/>
			<rect x={EX} y={ey(perM2)} width={EW} height={EY1 - ey(perM2)} rx="3" fill={SUN} />
			{@render txt(
				EX + EW + 6,
				Math.min(ey(perM2) + 5, EY1 - 2),
				`${Math.round(perM2 * 100)}%`,
				13,
				{
					weight: 600
				}
			)}
			{@render txt(EX - 6, EY0 + 4, '100%', 11, { anchor: 'end', muted: true })}
			{@render txt(EX + EW / 2, EY1 + 18, 'Sun overhead', 11, { anchor: 'middle', muted: true })}
			{@render txt(EX + EW / 2, EY1 + 32, '= 100%', 11, { anchor: 'middle', muted: true })}

			<!-- daily total through the year -->
			{@render txt(AX0 - 30, AY0 - 34, `Sunshine each day at ${latName(lat)}`, 13, {
				weight: 600
			})}
			{@render txt(AX0 - 30, AY0 - 18, 'whole day; the equator at an equinox = 1', 11, {
				muted: true
			})}
			{#each [0, 0.5, 1] as v (v)}
				<line x1={AX0} x2={AX1} y1={asy(v)} y2={asy(v)} stroke="var(--stage-grid)" />
				{@render txt(AX0 - 8, asy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{/each}
			<line x1={AX0} x2={AX0} y1={AY0} y2={AY1} stroke="var(--stage-line)" />
			{@render months(AX0, AX1, AY1 + 16, asx)}
			<path d={sunPath} fill="none" stroke={ACC} stroke-width="3" stroke-linejoin="round" />
			<line
				x1={asx(day)}
				x2={asx(day)}
				y1={AY0}
				y2={AY1}
				stroke="var(--stage-ink)"
				stroke-dasharray="3 3"
				opacity="0.6"
			/>
			<circle
				cx={asx(day)}
				cy={asy(today)}
				r="6"
				fill={ACC}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(
				AX0 - 30,
				AY1 + 52,
				`${dateText(day)}: ${x2(today)} × the equator at an equinox`,
				12
			)}
			{@render txt(AX0 - 30, AY1 + 70, `Over the year: ${ratioText(angleRange)}`, 12, {
				muted: true
			})}
		</g>
	{/if}

	<!-- ======================================================= tilt -->
	{#if show.tilt > 0.001}
		<g opacity={show.tilt}>
			{@render header(tiltTitle, tiltSub)}

			<!-- the two solstices, axis fixed in space -->
			{@render txt(SX, 132, 'The axis keeps its direction all year', 12, {
				anchor: 'middle',
				muted: true
			})}
			<ellipse
				cx={SX}
				cy={SY}
				rx="118"
				ry="26"
				fill="none"
				stroke="var(--sky-orbit)"
				stroke-width="1.2"
				stroke-dasharray="4 4"
			/>
			{@render sunGlyph(SX, SY, 22)}
			{@render txt(SX, SY + 50, 'Sun', 12, { anchor: 'middle', muted: true })}
			{#each solstices as g (g.key)}
				<line
					x1={g.cx}
					x2={g.cx}
					y1={SY - ER * 1.36}
					y2={SY + ER * 1.36}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="3 3"
				/>
				<circle cx={g.cx} cy={SY} r={ER} fill={OCEAN} />
				<path d={g.night} fill={SHADE} />
				<circle cx={g.cx} cy={SY} r={ER} fill="none" stroke="var(--stage-line)" />
				<line
					x1={g.dark.p.x}
					y1={g.dark.p.y}
					x2={g.dark.q.x}
					y2={g.dark.q.y}
					stroke={DARK}
					stroke-width="4"
					stroke-linecap="round"
				/>
				<line
					x1={g.lit.p.x}
					y1={g.lit.p.y}
					x2={g.lit.q.x}
					y2={g.lit.q.y}
					stroke={SUN}
					stroke-width="4"
					stroke-linecap="round"
				/>
				<line
					x1={g.n1.x}
					y1={g.n1.y}
					x2={g.n0.x}
					y2={g.n0.y}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				{@render txt(g.nl.x, g.nl.y + 4, 'N', 12, { anchor: 'middle', weight: 600 })}
				{@render txt(g.cx, SY + ER + 40, g.name, 11, { anchor: 'middle', muted: true })}
				{@render txt(g.cx, SY + ER + 56, lenText(g.len), 12, { anchor: 'middle', weight: 600 })}
			{/each}
			{#if !noTilt}
				<path d={tiltArc.d} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" />
				{@render txt(tiltArc.lx, tiltArc.ly, `${Number(tilt.toFixed(1))}°`, 12, {
					anchor: 'end',
					weight: 600
				})}
			{/if}
			{@render txt(SX, SY + ER + 84, `day length at ${latName(lat)}`, 11, {
				anchor: 'middle',
				muted: true
			})}

			<!-- daily sunshine through the year -->
			{@render txt(TX0 - 36, TY0 - 30, 'Daily sunshine (the equator at an equinox = 1)', 13, {
				weight: 600
			})}
			{#each tYTicks as v (v)}
				<line x1={TX0} x2={TX1} y1={tsy(v)} y2={tsy(v)} stroke="var(--stage-grid)" />
				{@render txt(TX0 - 8, tsy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{/each}
			<line x1={TX0} x2={TX0} y1={TY0} y2={TY1} stroke="var(--stage-line)" />
			{@render months(TX0, TX1, TY1 + 16, tsx)}
			{#if !nearReal}
				<path
					d={tiltCurves.real}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="5 4"
				/>
			{/if}
			<path d={tiltCurves.main} fill="none" stroke={ACC} stroke-width="3" stroke-linejoin="round" />
			{#each tiltLabels as l (l.key)}
				{@render txt(TX1 + 8, l.y, l.text, l.main ? 13 : 11, {
					weight: l.main ? 600 : 500,
					muted: !l.main,
					color: l.main ? ACC : undefined
				})}
			{/each}
			<line
				x1={tsx(drift)}
				x2={tsx(drift)}
				y1={TY0}
				y2={TY1}
				stroke="var(--stage-ink)"
				stroke-dasharray="3 3"
				opacity="0.6"
			/>
			<circle
				cx={tsx(drift)}
				cy={tsy(tiltToday)}
				r="6"
				fill={ACC}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{@render txt(clamp(tsx(drift), TX0 + 18, TX1 - 18), TY0 - 8, dateText(drift), 12, {
				anchor: 'middle',
				weight: 600
			})}
			{@render txt(
				TX0 - 36,
				TY1 + 54,
				`${dateText(drift)}: ${x2(tiltToday)} × the equator at an equinox · ${lenText(dayLength(lat, dTilt))}`,
				12
			)}
		</g>
	{/if}

	<defs>
		<radialGradient id="sunlight-sheen">
			<stop offset="0" stop-color="#ffffff" stop-opacity="0.35" />
			<stop offset="1" stop-color="#ffffff" stop-opacity="0" />
		</radialGradient>
		<clipPath id="sunlight-disc"><circle cx={GX} cy={GY} r={GR} /></clipPath>
		<clipPath id="sunlight-sky"><rect x="16" y="80" width="480" height={GROUND - 80} /></clipPath>
		<clipPath id="sunlight-ground"><rect x="40" y={GROUND - 10} width="440" height="20" /></clipPath
		>
	</defs>
</g>
