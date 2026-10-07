<script lang="ts">
	/**
	 * The Moon: phases, eclipses and the tilted orbit.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   phases   — top view from above the North Pole: sunlight from the left,
	 *              the Moon's sunward half always lit, Earth's shadow pointing
	 *              away from the Sun; a big inset of the Moon "as seen from
	 *              Earth" and a ring of the eight named phases
	 *   eclipses — the same top view with the orbit treated as flat: the Moon's
	 *              shadow on Earth at new Moon, the Moon in Earth's shadow
	 *              (coppery) at full Moon
	 *   tilted   — an oblique view of the Moon's orbit tilted to Earth's (tilt
	 *              exaggerated ×3), the line of nodes fixed in space and the
	 *              Sun's direction set by the date; a side-on view of the Moon
	 *              passing above or below the Earth–Sun line; a year strip
	 *              with the two eclipse seasons
	 *
	 * The Moon's age lives in `params.moon` (days since new Moon), shared with
	 * the slider; the handle writes to it (rounded to the slider's 0.5 day).
	 * With `params.run` on (phases and eclipses only) the Moon goes round by
	 * itself, one month in 16 s, from where it was; grabbing the handle, its
	 * keys or the slider turn run off and leave the Moon where it is.
	 *
	 * The top view is not to scale: its drawn sizes decide when the shadows
	 * touch (the "flat orbit" eclipses). The tilted step uses the real limits
	 * from sky.ts (eclipseAt, SOLAR_LIMIT, LUNAR_LIMIT, nodeWindow).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		LUNAR_LIMIT,
		MARCH_EQUINOX_DAY,
		MOON_INCLINATION,
		SOLAR_LIMIT,
		SYNODIC_MONTH,
		YEAR,
		eclipseAt,
		litFraction,
		moonLatitude,
		nodeWindow,
		phaseName,
		sunLongitude
	} from '../sky';
	import { dateText } from '../steps';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	const mod = (a: number, n: number) => ((a % n) + n) % n;
	const rad = (d: number) => (d * Math.PI) / 180;
	const deg = (r: number) => (r * 180) / Math.PI;
	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	const COPPER = '#b4532f'; // the eclipsed Moon (fixed: an object colour, not a background)

	const phase = $derived(String(step.hints?.phase ?? 'phases'));

	// ---- phase cross-fades ---------------------------------------------------
	const phases = ['phases', 'eclipses', 'tilted'] as const;
	// Start at the deep-linked phase rather than cross-fading into it on mount.
	const initial = untrack(() => phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(p === initial ? 1 : 0, { duration: 750, easing: cubicInOut })])
	) as Record<(typeof phases)[number], Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 750 });
		});
	});
	const w = $derived({
		phases: weights.phases.current,
		eclipses: weights.eclipses.current,
		tilted: weights.tilted.current
	});
	const wTop = $derived(w.phases + w.eclipses);
	// Text blocks that share a place swap rather than overlap.
	const swap = (v: number) => smoothstep(0.5, 1, v);

	// ---- the Moon's age (days since new Moon) ------------------------------------
	const RUN_RATE = SYNODIC_MONTH / 16; // days per second: one month in 16 s
	// The slider's range and step, from the step's `moon` control.
	const moonControl = $derived.by(() => {
		const c = (step.controls ?? []).find((c) => c.id === 'moon');
		return c && c.type === 'range' ? c : null;
	});
	const MAX_DAYS = $derived(moonControl?.max ?? 29.5);
	const MOON_STEP = $derived(moonControl?.step ?? 0.5);
	const snapDays = (v: number) =>
		Math.max(0, Math.min(MAX_DAYS, Math.round(v / MOON_STEP) * MOON_STEP));
	const hasRun = $derived((step.controls ?? []).some((c) => c.id === 'run'));
	const running = $derived(hasRun && Boolean(params.run) && !reduced);
	const moonParam = $derived(Number(params.moon ?? 4));

	let dragging = $state(false);
	let dragDays = $state(0);
	// A short glide when the slider or the keys move the Moon. The target is
	// unwrapped to the nearest turn, so 29.5 → 0 moves forwards a little rather
	// than all the way back round.
	const moonTween = new Tween(
		untrack(() => moonParam),
		{ duration: 500, easing: cubicInOut }
	);

	// Every change of the tween goes through `glide`, which counts them.
	let epoch = 0;
	function glide(from: number | null, to: number, duration: number) {
		if (from !== null) moonTween.set(from, { duration: 0 });
		moonTween.set(to, { duration: reduced ? 0 : duration });
		epoch++;
	}

	// Sanctioned exception (as in unit-circle/WaveScene): while running, the
	// Moon's age is `runFrom + rate × (t − runAt)`; a new run starts when the
	// step changes, when run is switched on, or when `t` goes back (a step
	// reset), from wherever the Moon was last shown. When the run stops, the
	// Moon is held where it was (`hold`) until the effects below glide the
	// tween on from there — unless something already glided it during the run
	// (the slider). Plain `let`s, never `$state`, are written here.
	let lastShown = untrack(() => moonParam);
	let lastRun = 0;
	let runFrom = 0;
	let runAt = 0;
	let runKey = '';
	let runEpoch = -1;
	let lastT = 0;
	let hold: { v: number; epoch: number } | null = null;
	const runKeyNow = $derived(`${step.id}:${running}`);
	const days = $derived.by(() => {
		let v: number;
		if (dragging) {
			runKey = '';
			hold = null;
			v = dragDays;
		} else if (running) {
			if (runKeyNow !== runKey || t < lastT) {
				runAt = t;
				runFrom = lastShown;
				runKey = runKeyNow;
				runEpoch = epoch;
			}
			lastT = t;
			v = runFrom + RUN_RATE * (t - runAt);
			lastRun = mod(v, SYNODIC_MONTH);
		} else {
			if (runKey !== '') {
				hold = epoch === runEpoch ? { v: lastRun, epoch } : null;
				runKey = '';
			}
			v = hold && hold.epoch === epoch ? hold.v : moonTween.current;
		}
		v = mod(v, SYNODIC_MONTH);
		lastShown = v;
		return v;
	});
	/** Where the Moon is (or is about to be) shown. */
	const shownNow = () => (hold && hold.epoch === epoch ? hold.v : lastShown);

	// When run goes off (the toggle, or a step without it), the Moon stays
	// where it was: its age is written into params.moon (to the slider's step).
	// Not when the handle, its keys or the slider stopped it: they set the
	// value themselves (`skipFreeze`).
	let prevRunning: boolean | null = null;
	let skipFreeze = false;
	$effect(() => {
		const on = running;
		untrack(() => {
			if (prevRunning === true && !on && !skipFreeze) {
				const from = epoch === runEpoch ? lastRun : shownNow();
				glide(from, from, 0);
				setParam('moon', snapDays(from));
			}
			skipFreeze = false;
			prevRunning = on;
		});
	});
	function stopRun() {
		if (params.run && hasRun) {
			skipFreeze = true;
			setParam('run', false);
		}
	}

	// params.moon changed (slider, keys, handle, freeze): glide there from where
	// the Moon is shown. Moving the slider while the Moon runs stops the run.
	let prevMoon: number | null = null;
	$effect(() => {
		const v = moonParam;
		untrack(() => {
			// The first run only records the value (the tween starts there).
			if (prevMoon === null) {
				prevMoon = v;
				return;
			}
			if (v !== prevMoon && running && !dragging) stopRun();
			prevMoon = v;
			if (dragging) return;
			const from = shownNow();
			glide(from, v + SYNODIC_MONTH * Math.round((from - v) / SYNODIC_MONTH), 500);
		});
	});

	// ---- the date (tilted step) ---------------------------------------------------
	const dayParam = $derived(Number(params.day ?? 171));
	const dayTween = new Tween(
		untrack(() => dayParam),
		{ duration: 500, easing: cubicInOut }
	);
	$effect(() => {
		const v = dayParam;
		untrack(() => {
			const cur = dayTween.current;
			dayTween.set(v + 365 * Math.round((cur - v) / 365), { duration: reduced ? 0 : 500 });
		});
	});
	const dayShown = $derived(mod(dayTween.current, 365));

	// ---- shared Moon quantities ------------------------------------------------------
	/** Elongation (phase angle): 0 new, 90 first quarter, 180 full, 270 last quarter. */
	const elong = $derived((360 * days) / SYNODIC_MONTH);
	const name = $derived(phaseName(elong));
	const lit = $derived(litFraction(elong));
	const pctText = $derived(`${Math.round(lit * 100)}% of the face lit`);
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

	// ---- interaction -------------------------------------------------------------------
	function setMoon(v: number) {
		setParam('moon', snapDays(v));
	}
	function onkey(k: number | 'start' | 'end') {
		const from = running ? snapDays(shownNow()) : moonParam;
		stopRun();
		if (k === 'start') return setMoon(0);
		if (k === 'end') return setMoon(MAX_DAYS);
		// ±0.5 day (±5 with Shift); past either end, round to the other end.
		const v = from + k * 0.5;
		setMoon(v > MAX_DAYS + 1e-9 ? 0 : v < -1e-9 ? MAX_DAYS : v);
	}
	function ondragstart() {
		dragDays = shownNow();
		dragging = true;
		stopRun();
	}
	function ondragend() {
		const v = moonParam;
		glide(dragDays, v + SYNODIC_MONTH * Math.round((dragDays - v) / SYNODIC_MONTH), 300);
		dragging = false;
	}
	function dragTo(elongation: number) {
		dragDays = (mod(elongation, 360) / 360) * SYNODIC_MONTH;
		setMoon(dragDays);
	}

	// Inviting pulse on the handle at the start of a step (not while running).
	const pulse = $derived(
		reduced || running ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5))
	);

	// ==================================================================== top view
	// Seen from above the North Pole: the Sun far off to the left, the Moon
	// going round anticlockwise. Not to scale.
	const EX = 410;
	const EY = 300;
	const ER = 26; // Earth
	const ORB = 175; // Moon's orbit
	const MR = 12; // Moon
	const GR = 240; // ring of "as seen from Earth" faces
	const GHOST_R = 14;
	const UMBRA_LEN = 225;
	const TAPER = 0.035; // Earth's shadow narrows a little with distance

	const moonTop = $derived({
		x: EX - ORB * Math.cos(rad(elong)),
		y: EY + ORB * Math.sin(rad(elong))
	});
	function onmoveTop(p: Point) {
		dragTo(deg(Math.atan2(p.y - EY, -(p.x - EX))));
	}

	/**
	 * The Moon's face as seen from the northern hemisphere: lit on the right
	 * while waxing, on the left while waning. The lit part is a semicircle on
	 * the lit side closed by the terminator, half an ellipse of semi-axis
	 * r·|cos E| (lit area (1 − cos E)/2 of the disc, as litFraction).
	 */
	function litPath(cx: number, cy: number, r: number, e: number) {
		const a = mod(e, 360);
		const k = Math.cos(rad(a));
		const rx = (r * Math.abs(k)).toFixed(2);
		const waxing = a <= 180;
		const crescent = k > 0;
		const top = `${cx} ${(cy - r).toFixed(2)}`;
		const bottom = `${cx} ${(cy + r).toFixed(2)}`;
		// limb: top → bottom round the lit side; terminator: bottom → top
		const limbSweep = waxing ? 1 : 0;
		const termSweep = waxing === crescent ? 0 : 1;
		return `M${top} A${r} ${r} 0 0 ${limbSweep} ${bottom} A${rx} ${r} 0 0 ${termSweep} ${top} Z`;
	}

	const ghosts = [0, 45, 90, 135, 180, 225, 270, 315].map((e) => ({
		e,
		x: EX - GR * Math.cos(rad(e)),
		y: EY + GR * Math.sin(rad(e))
	}));
	const nearestGhost = $derived(Math.round(mod(elong, 360) / 45) % 8);

	// Sunlight arrows on the left (marching slowly).
	const RAYS = [124, 176, 228, 392, 444, 496];
	const rayDash = $derived(reduced ? 0 : -mod(t * 16, 24));

	// Earth's umbra: from Earth's disc, away from the Sun.
	const umbraHalf = (x: number) => ER - TAPER * (x - EX);
	const umbraPoly = `${EX},${EY - ER} ${EX + UMBRA_LEN},${EY - umbraHalf(EX + UMBRA_LEN)} ${EX + UMBRA_LEN},${EY + umbraHalf(EX + UMBRA_LEN)} ${EX},${EY + ER}`;

	// Flat-orbit eclipses, from the drawn sizes.
	const offset = $derived(ORB * Math.sin(rad(elong))); // Moon off the Sun–Earth line
	const nearSide = $derived(Math.cos(rad(elong)) > 0);
	const solarW = $derived(nearSide ? 1 - smoothstep(ER * 0.8, ER + MR * 0.5, Math.abs(offset)) : 0);
	const lunarW = $derived(
		nearSide ? 0 : clamp01((umbraHalf(moonTop.x) + MR - Math.abs(offset)) / (2 * MR))
	);
	const redW = $derived(lunarW * w.eclipses);
	// The Moon's shadow cone, pointing away from the Sun; it just reaches Earth.
	const moonShadow = $derived.by(() => {
		const L = ORB - ER + 6;
		const { x, y } = moonTop;
		return `${x},${y - MR} ${x + L},${y} ${x},${y + MR}`;
	});
	const spot = $derived(
		Math.abs(offset) < ER - 2
			? { x: EX - Math.sqrt(ER * ER - offset * offset) + 3, y: EY + offset }
			: null
	);

	// The inset: the Moon as seen from Earth.
	const IX = 810;
	const IY = 152;
	const IR = 70;
	// In a solar eclipse the Sun shows behind the Moon, offset by how far the
	// Moon is from the line (waxing: the Moon is east of the Sun, so the Sun is
	// on its right as seen facing south).
	const sunDx = $derived((2 * IR * offset) / ER);
	const insetSun = $derived(
		w.eclipses * (nearSide ? 1 - smoothstep(2.1 * IR, 2.6 * IR, Math.abs(sunDx)) : 0)
	);
	const status = $derived(
		solarW > 0.5 ? 'solar' : lunarW > 0.5 ? 'lunar' : ('none' as 'solar' | 'lunar' | 'none')
	);
	const STATUS_TEXT = {
		solar: {
			title: 'Solar eclipse',
			lines: [
				'New Moon: the Moon is between the',
				'Sun and the Earth, and its shadow',
				'falls on part of the Earth.'
			]
		},
		lunar: {
			title: 'Lunar eclipse',
			lines: [
				'Full Moon: the Moon is inside the',
				"Earth's shadow and turns dark,",
				'often coppery red.'
			]
		},
		none: {
			title: 'No eclipse now',
			lines: [
				'Eclipses need the three in a line:',
				'new Moon for a solar eclipse,',
				'full Moon for a lunar one.'
			]
		}
	};
	const MARIA = [
		{ x: -0.28, y: -0.3, rx: 0.2, ry: 0.15 },
		{ x: 0.05, y: -0.42, rx: 0.16, ry: 0.11 },
		{ x: 0.24, y: -0.12, rx: 0.15, ry: 0.19 },
		{ x: -0.12, y: 0.08, rx: 0.24, ry: 0.15 },
		{ x: 0.2, y: 0.32, rx: 0.1, ry: 0.08 }
	];

	// ==================================================================== tilted
	// Ecliptic longitude of the ascending node, fixed. 333° is near its 2026
	// position, so the eclipse seasons fall in late February and late August,
	// as they do in 2026 (eclipses on 17 Feb, 3 Mar, 12 Aug and 28 Aug).
	const NODE = 333;
	const EXAG = 3;
	const INC = EXAG * MOON_INCLINATION; // drawn tilt
	const sinI = Math.sin(rad(INC));
	const cosI = Math.cos(rad(INC));
	/** Drawn heights are this many times the true ones (small angles). */
	const HEIGHT_SCALE = sinI / Math.sin(rad(MOON_INCLINATION));

	const sunLon = $derived(sunLongitude(dayShown));
	/** The Moon's argument of latitude: its longitude minus the node's. */
	const uNow = $derived(mod(sunLon + elong - NODE, 360));
	const uNew = $derived(mod(sunLon - NODE, 360)); // this month's new Moon
	const betaNow = $derived(moonLatitude(uNow));
	const betaNew = $derived(moonLatitude(uNew));
	const betaFull = $derived(moonLatitude(uNew + 180));
	const solarThisMonth = $derived(eclipseAt(0, uNew));
	const lunarThisMonth = $derived(eclipseAt(180, uNew + 180));
	const atNew = $derived(name === 'new Moon');
	const atFull = $derived(name === 'full Moon');
	const eclipseNow = $derived(atNew ? solarThisMonth : atFull ? lunarThisMonth : null);

	// Oblique view: x right, y away from the viewer, z up (north of the ecliptic).
	const C3 = { x: 282, y: 212 };
	const R3 = 190;
	const ELEV = rad(24);
	const PSI_ASC = 200; // screen direction of the ascending node (front left)
	const p3 = (x: number, y: number, z: number) => ({
		x: C3.x + R3 * x,
		y: C3.y - R3 * (y * Math.sin(ELEV) + z * Math.cos(ELEV))
	});
	const inPlane = (lon: number, k: number) => {
		const s = rad(lon - NODE + PSI_ASC);
		return p3(k * Math.cos(s), k * Math.sin(s), 0);
	};
	/** A point of the Moon's (drawn, exaggerated) orbit, `u` degrees past the ascending node. */
	function orbit3(u: number) {
		const n = rad(PSI_ASC);
		const cu = Math.cos(rad(u));
		const su = Math.sin(rad(u));
		return {
			x: cu * Math.cos(n) - su * cosI * Math.sin(n),
			y: cu * Math.sin(n) + su * cosI * Math.cos(n),
			z: su * sinI
		};
	}
	const orbitScreen = (u: number) => {
		const o = orbit3(u);
		return p3(o.x, o.y, o.z);
	};
	function orbitArc(u0: number, u1: number) {
		let d = '';
		for (let u = u0; u <= u1 + 1e-9; u += 5) {
			const p = orbitScreen(u);
			d += `${u === u0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d;
	}
	const ORBIT_ABOVE = orbitArc(0, 180);
	const ORBIT_BELOW = orbitArc(180, 360);
	const PLANE_K = 1.2;
	const planeRy = R3 * PLANE_K * Math.sin(ELEV);
	const ascNode = inPlane(NODE, 1);
	const descNode = inPlane(NODE + 180, 1);
	const nodeA = inPlane(NODE, 1.1);
	const nodeB = inPlane(NODE + 180, 1.1);
	// Node labels sit out along the line of nodes, clear of the Moon's orbit.
	const ascLabel = (() => {
		const p = inPlane(NODE, 1);
		return { x: Math.max(66, p.x + 6), y: p.y + 42 };
	})();
	const descLabel = (() => {
		const p = inPlane(NODE + 180, 1);
		return { x: Math.min(530, p.x - 12), y: p.y - 48 };
	})();

	const sun3 = $derived(inPlane(sunLon, 1.26));
	const antiSun3 = $derived(inPlane(sunLon + 180, 1.12));
	// The Sun's direction on screen, for the lit halves.
	const sunAngle = $derived(deg(Math.atan2(sun3.y - C3.y, sun3.x - C3.x)));
	const moon3 = $derived.by(() => {
		const o = orbit3(uNow);
		return { ...p3(o.x, o.y, o.z), foot: p3(o.x, o.y, 0), z: o.z, o };
	});
	function onmove3(p: Point) {
		let best = 0;
		let bestD = Infinity;
		for (let u = 0; u < 360; u += 1) {
			const s = orbitScreen(u);
			const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
			if (d < bestD) {
				bestD = d;
				best = u;
			}
		}
		dragTo(best + NODE - sunLon);
	}

	// Labels near the Sun glyph fade while it passes over them.
	const nearSun = (x: number, y: number) =>
		0.15 + 0.85 * smoothstep(34, 60, Math.hypot(sun3.x - x, sun3.y - y));

	// Side-on view, looking perpendicular to the Sun–Earth line.
	const SX0 = 588;
	const SX1 = 944;
	const SEX = 772; // Earth
	const SEY = 172;
	const RP = 125;
	const sunSide = { x: 614, y: SEY };
	const sideZone = (limit: number) => RP * HEIGHT_SCALE * Math.sin(rad(limit));
	const ZONE_SOLAR = sideZone(SOLAR_LIMIT);
	const ZONE_LUNAR = sideZone(LUNAR_LIMIT);
	const sunUnit = $derived.by(() => {
		const s = rad(sunLon - NODE + PSI_ASC);
		return { x: Math.cos(s), y: Math.sin(s) };
	});
	const side = (o: { x: number; y: number; z: number }) => ({
		x: SEX - RP * (o.x * sunUnit.x + o.y * sunUnit.y),
		y: SEY - RP * o.z
	});
	const sideOrbit = $derived.by(() => {
		let d = '';
		for (let u = 0; u <= 360; u += 6) {
			const p = side(orbit3(u));
			d += `${u === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d + 'Z';
	});
	const sideMoon = $derived(side(moon3.o));
	const sideNew = $derived(side(orbit3(uNew)));
	const sideFull = $derived(side(orbit3(uNew + 180)));

	const degText = (b: number) => `${Math.abs(b).toFixed(1)}°`;
	const where = (b: number) =>
		Math.abs(b) < 0.05 ? 'on the Earth–Sun line' : `${degText(b)} ${b > 0 ? 'above' : 'below'}`;
	const whereShort = (b: number) =>
		Math.abs(b) < 0.05 ? 'on the line' : `${degText(b)} ${b > 0 ? 'above' : 'below'}`;
	const SOLAR_TXT = SOLAR_LIMIT.toFixed(1);
	const LUNAR_TXT = LUNAR_LIMIT.toFixed(1);
	const readout = $derived.by(() => {
		if (atNew) {
			const b = betaNew;
			return {
				a: `New Moon ${where(b)}${Math.abs(b) < 0.05 ? '' : ' the Earth–Sun line'}`,
				b: solarThisMonth
					? `within ${SOLAR_TXT}°: solar eclipse`
					: `more than ${SOLAR_TXT}°: no eclipse`
			};
		}
		if (atFull) {
			const b = betaFull;
			return {
				a: `Full Moon ${where(b)}${Math.abs(b) < 0.05 ? '' : ' the Earth–Sun line'}`,
				b: lunarThisMonth
					? `within ${LUNAR_TXT}°: lunar eclipse`
					: `more than ${LUNAR_TXT}°: no eclipse`
			};
		}
		const b = betaNow;
		return {
			a: `${cap(name)}: ${Math.abs(b) < 0.05 ? 'in' : `${degText(b)} ${b > 0 ? 'above' : 'below'}`} Earth's orbital plane`,
			b: 'no eclipse: only a new or full Moon can make one'
		};
	});
	const monthNew = $derived(
		`New Moon on ${dateText(dayShown)}: ${whereShort(betaNew)} — ${solarThisMonth ? 'solar eclipse' : 'no eclipse'}`
	);
	const monthFull = $derived(
		`Full Moon on ${dateText(dayShown)}: ${whereShort(betaFull)} — ${lunarThisMonth ? 'lunar eclipse' : 'no eclipse'}`
	);

	// Year strip with the two eclipse seasons.
	const YX0 = 52;
	const YX1 = 908;
	const YT = 500; // track top
	const YH = 12;
	const yx = (d: number) => YX0 + ((YX1 - YX0) * d) / 365;
	const dayOfLon = (lon: number) => mod(MARCH_EQUINOX_DAY + (lon / 360) * YEAR, YEAR);
	const SOLAR_DAYS = (nodeWindow(SOLAR_LIMIT) / 360) * YEAR;
	const LUNAR_DAYS = (nodeWindow(LUNAR_LIMIT) / 360) * YEAR;
	/** Bands [from, to) in days, split where they cross the new year. */
	function band(centre: number, half: number) {
		const a = centre - half;
		const b = centre + half;
		if (a < 0)
			return [
				[0, b],
				[a + 365, 365]
			];
		if (b > 365)
			return [
				[a, 365],
				[0, b - 365]
			];
		return [[a, b]];
	}
	const SEASONS = [NODE, NODE + 180].map((lon, i) => {
		const centre = dayOfLon(lon);
		return {
			i,
			centre,
			solar: band(centre, SOLAR_DAYS),
			lunar: band(centre, LUNAR_DAYS),
			label: `${dateText(centre - SOLAR_DAYS)} – ${dateText(centre + SOLAR_DAYS)}`
		};
	});
	const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
	const MONTHS = 'JFMAMJJASOND'.split('');
	const inSeason = $derived(
		SEASONS.some((s) => {
			const d = Math.abs(mod(dayShown - s.centre + 182.5, 365) - 182.5);
			return d <= SOLAR_DAYS;
		})
	);

	// Shadows use --sky-night (translucent dark in both themes), so that on the
	// dark stage they are darker than their surroundings, not lighter.
	const shade = (k: number) => Math.min(1, dark ? k * 4.5 : k * 1.8);

	const pillW = (text: string, size: number) => text.length * size * 0.56 + 18;
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
		halo?: boolean;
		pill?: { fill: string; stroke?: string };
	} = {}
)}
	{#if opts.pill}
		{@const pw = pillW(text, size)}
		<rect
			x={opts.anchor === 'start' ? x - 9 : opts.anchor === 'end' ? x - pw + 9 : x - pw / 2}
			y={y - size * 0.78 - 5}
			width={pw}
			height={size + 10}
			rx={(size + 10) / 2}
			fill={opts.pill.fill}
			stroke={opts.pill.stroke ?? 'none'}
			opacity={opts.opacity ?? 1}
		/>
	{/if}
	<text
		{x}
		{y}
		class={opts.pill || opts.halo === false ? undefined : 'halo'}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet face(cx: number, cy: number, r: number, e: number, clip: string)}
	<circle
		{cx}
		{cy}
		{r}
		fill="var(--sky-moon-dark)"
		stroke="var(--sky-orbit)"
		stroke-width={r > 30 ? 1.2 : 0.8}
	/>
	<path d={litPath(cx, cy, r, e)} fill="var(--sky-moon)" />
	{#if r > 30}
		<clipPath id={clip}><path d={litPath(cx, cy, r, e)} /></clipPath>
		<g clip-path="url(#{clip})" opacity="0.32">
			{#each MARIA as m, i (i)}
				<ellipse
					cx={cx + m.x * r}
					cy={cy + m.y * r}
					rx={m.rx * r}
					ry={m.ry * r}
					fill="var(--sky-moon-dark)"
				/>
			{/each}
		</g>
	{/if}
{/snippet}

{#snippet halfLit(
	cx: number,
	cy: number,
	r: number,
	angle: number,
	litColor: string,
	darkColor: string
)}
	<!-- a disc lit on the half facing `angle` (screen degrees) -->
	<g transform="rotate({angle} {cx} {cy})">
		<circle {cx} {cy} {r} fill={darkColor} />
		<path d="M{cx} {cy - r} A{r} {r} 0 0 1 {cx} {cy + r} Z" fill={litColor} />
	</g>
{/snippet}

<g>
	<defs>
		<clipPath id="moon-insetclip"><rect x="691" y="60" width="238" height="178" /></clipPath>
		<clipPath id="moon-topclip"><rect x="0" y="0" width="680" height="600" /></clipPath>
		<linearGradient id="moon-sunwash" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="var(--sky-sun)" stop-opacity={dark ? 0.15 : 0.16} />
			<stop offset="1" stop-color="var(--sky-sun)" stop-opacity="0" />
		</linearGradient>
		<linearGradient
			id="moon-umbra"
			gradientUnits="userSpaceOnUse"
			x1={EX}
			x2={EX + UMBRA_LEN}
			y1="0"
			y2="0"
		>
			<stop offset="0" stop-color="var(--sky-night)" stop-opacity={shade(0.22)} />
			<stop offset="0.75" stop-color="var(--sky-night)" stop-opacity={shade(0.15)} />
			<stop offset="1" stop-color="var(--sky-night)" stop-opacity="0" />
		</linearGradient>
	</defs>

	<!-- ============================================================ top view -->
	{#if wTop > 0.01}
		<g opacity={wTop} pointer-events="none">
			<!-- sunlight from the left -->
			<rect x="0" y="0" width="700" height="600" fill="url(#moon-sunwash)" />
			<circle cx="56" cy={EY} r="30" fill="var(--sky-sun)" />
			{@render txt(56, EY + 52, 'Sun', 13, { anchor: 'middle', weight: 600 })}
			{@render txt(24, EY + 68, 'far off to the left', 11, { muted: true })}
			{#each RAYS as y (y)}
				<line
					x1="104"
					y1={y}
					x2="154"
					y2={y}
					stroke="var(--sky-sun)"
					stroke-width="2"
					stroke-dasharray="14 10"
					stroke-dashoffset={rayDash}
					stroke-linecap="round"
				/>
				<path d="M154 {y - 5} L163 {y} L154 {y + 5} Z" fill="var(--sky-sun)" />
			{/each}
			{@render txt(104, RAYS[0] - 14, 'sunlight', 11, { muted: true })}

			<!-- Earth's shadow, pointing away from the Sun -->
			<polygon points={umbraPoly} fill="url(#moon-umbra)" />

			<!-- the Sun–Earth line (eclipses) -->
			{#if w.eclipses > 0.01}
				<line
					x1="92"
					y1={EY}
					x2={EX + ORB + 34}
					y2={EY}
					stroke="var(--sky-sun)"
					stroke-width="1.2"
					stroke-dasharray="3 5"
					opacity={w.eclipses * 0.9}
				/>
			{/if}

			<!-- the Moon's orbit -->
			<circle cx={EX} cy={EY} r={ORB} fill="none" stroke="var(--sky-orbit)" stroke-width="1.2" />
			<!-- direction of travel -->
			{#each [52, 232] as a (a)}
				{@const x = EX - ORB * Math.cos(rad(a))}
				{@const y = EY + ORB * Math.sin(rad(a))}
				<path
					d="M-5 -5 L4 0 L-5 5"
					transform="translate({x} {y}) rotate({deg(
						Math.atan2(Math.cos(rad(a)), Math.sin(rad(a)))
					)})"
					fill="none"
					stroke="var(--sky-orbit)"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/each}

			<!-- ring of phases as seen from Earth -->
			{#if w.phases > 0.01}
				<g opacity={w.phases}>
					{#each ghosts as g, i (g.e)}
						<g opacity={i === nearestGhost ? 1 : 0.5}>
							{@render face(g.x, g.y, GHOST_R, g.e, '')}
						</g>
					{/each}
					{@render txt(EX, EY - GR - 24, 'how each looks from Earth', 11, {
						anchor: 'middle',
						muted: true
					})}
				</g>
			{/if}

			<!-- the Moon's shadow (eclipses) -->
			{#if w.eclipses > 0.01}
				<polygon
					points={moonShadow}
					fill="var(--sky-night)"
					clip-path="url(#moon-topclip)"
					opacity={w.eclipses *
						shade(0.12 + 0.12 * solarW) *
						(1 - 0.6 * smoothstep(EX + 40, EX + 160, moonTop.x))}
				/>
			{/if}

			<!-- Earth: day side towards the Sun -->
			{@render halfLit(EX, EY, ER, 180, 'var(--sky-ocean)', 'var(--sky-ocean)')}
			<path d="M{EX} {EY - ER} A{ER} {ER} 0 0 1 {EX} {EY + ER} Z" fill="var(--sky-night)" />
			<circle cx={EX} cy={EY} r={ER} fill="none" stroke="var(--sky-orbit)" stroke-width="1" />
			<circle cx={EX} cy={EY} r="2.5" fill="var(--stage-bg)" />
			{#if spot && w.eclipses > 0.01}
				<ellipse
					cx={spot.x}
					cy={spot.y}
					rx="4"
					ry="7"
					fill="var(--sky-night)"
					opacity={w.eclipses * solarW}
				/>
			{/if}
			{@render txt(EX, EY + ER + 18, 'Earth', 12, { anchor: 'middle', weight: 600 })}
			{@render txt(EX, EY + ER + 32, 'North Pole up', 11, { anchor: 'middle', muted: true })}

			<!-- Earth's shadow label -->
			{@render txt(EX + 106, EY + 4, "Earth's shadow", 12, {
				anchor: 'middle',
				opacity: 1 - 0.85 * smoothstep(60, 30, Math.hypot(moonTop.x - (EX + 106), moonTop.y - EY))
			})}

			<!-- syzygy labels (eclipses) -->
			{#if w.eclipses > 0.01}
				{@render txt(EX - ORB, EY - 30, 'new Moon', 12, {
					anchor: 'middle',
					opacity: w.eclipses
				})}
				{@render txt(EX + ORB, EY - 30, 'full Moon', 12, {
					anchor: 'middle',
					opacity: w.eclipses
				})}
			{/if}
		</g>

		<!-- the Moon (top view), sunward half lit -->
		<g opacity={wTop}>
			<Handle
				x={moonTop.x}
				y={moonTop.y}
				r={MR + 1}
				label="The Moon on its orbit"
				value={snapDays(days)}
				min={0}
				max={MAX_DAYS}
				valuetext="{days.toFixed(1)} days since new Moon, {name}"
				{onkey}
				{ondragstart}
				{ondragend}
				onmove={onmoveTop}
			/>
			<g pointer-events="none">
				{#if pulse > 0.01}
					<circle
						cx={moonTop.x}
						cy={moonTop.y}
						r={MR + 9 + 5 * pulse}
						fill="none"
						stroke="var(--explainer-accent, var(--accent))"
						stroke-width="1.5"
						opacity={0.6 * pulse}
					/>
				{/if}
				{@render halfLit(moonTop.x, moonTop.y, MR, 180, 'var(--sky-moon)', 'var(--sky-moon-dark)')}
				<circle cx={moonTop.x} cy={moonTop.y} r={MR} fill={COPPER} opacity={redW * 0.85} />
				<circle
					cx={moonTop.x}
					cy={moonTop.y}
					r={MR}
					fill="none"
					stroke="var(--sky-orbit)"
					stroke-width="1"
				/>
			</g>
		</g>

		<!-- titles -->
		<g opacity={wTop} pointer-events="none">
			{@render txt(24, 34, 'Seen from above the North Pole (not to scale)', 12, { muted: true })}
			<g opacity={swap(w.phases)}>
				{@render txt(24, 54, 'The half facing the Sun is always lit', 15, { weight: 600 })}
			</g>
			<g opacity={swap(w.eclipses)}>
				{@render txt(24, 54, "If the Moon's orbit were flat,", 15, { weight: 600 })}
				{@render txt(24, 73, 'this would happen every month', 15, { weight: 600 })}
			</g>
		</g>

		<!-- inset: the Moon as seen from Earth -->
		<g opacity={wTop} pointer-events="none">
			<rect
				x="690"
				y="24"
				width="240"
				height="330"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(IX, 50, 'As seen from Earth', 12, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			{#if insetSun > 0.01}
				<g clip-path="url(#moon-insetclip)">
					<!-- the corona, around a total eclipse -->
					<circle
						cx={IX + sunDx}
						cy={IY}
						r={IR * 1.22}
						fill="var(--sky-sun)"
						opacity={insetSun * (dark ? 0.6 : 0.4) * (1 - smoothstep(0, IR * 0.3, Math.abs(sunDx)))}
					/>
					<circle cx={IX + sunDx} cy={IY} r={IR} fill="var(--sky-sun)" opacity={insetSun} />
				</g>
			{/if}
			{@render face(IX, IY, IR, elong, 'moon-inset-clip')}
			{#if insetSun > 0.01}
				<!-- new Moon: we face the dark side, a silhouette against the Sun -->
				<circle cx={IX} cy={IY} r={IR} fill="var(--sky-moon-dark)" opacity={insetSun} />
			{/if}
			<circle cx={IX} cy={IY} r={IR} fill={COPPER} opacity={redW * 0.8} />
			{@render txt(IX, 254, cap(name), 17, { anchor: 'middle', weight: 600, halo: false })}
			{@render txt(IX, 276, redW > 0.5 ? "inside the Earth's shadow" : pctText, 13, {
				anchor: 'middle',
				halo: false
			})}
			{@render txt(IX, 296, `${days.toFixed(1)} days since new Moon`, 12, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			{@render txt(IX, 326, 'from the northern hemisphere: a', 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			{@render txt(IX, 341, 'waxing Moon is lit on the right', 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}

			<!-- below the inset: the pitfall (phases) or the eclipse status -->
			<g opacity={swap(w.phases)}>
				{@render txt(698, 392, 'Phases are not a shadow', 14, { weight: 600 })}
				{@render txt(698, 414, "Earth's shadow points away from", 12)}
				{@render txt(698, 431, 'the Sun. At the quarters it is', 12)}
				{@render txt(698, 448, 'nowhere near the Moon, and at full', 12)}
				{@render txt(698, 465, 'Moon the Moon usually passes just', 12)}
				{@render txt(698, 482, 'above or below it.', 12)}
			</g>
			<g opacity={swap(w.eclipses)}>
				{@render txt(698, 392, STATUS_TEXT[status].title, 15, {
					weight: 600,
					color: status === 'lunar' ? COPPER : status === 'solar' ? 'var(--stage-ink)' : undefined
				})}
				{#each STATUS_TEXT[status].lines as line, i (i)}
					{@render txt(698, 414 + 17 * i, line, 12)}
				{/each}
			</g>
		</g>
	{/if}

	<!-- ============================================================ tilted -->
	{#if w.tilted > 0.01}
		<g opacity={w.tilted} pointer-events="none">
			{@render txt(24, 34, "The Moon's orbit is tilted to the Earth's", 15, { weight: 600 })}
			{@render txt(
				24,
				52,
				`${MOON_INCLINATION.toFixed(1)}° in reality; tilt exaggerated ×3 here`,
				11,
				{
					muted: true
				}
			)}

			<!-- the part of the Moon's orbit below Earth's orbital plane, seen through it -->
			<path
				d={ORBIT_BELOW}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.4"
				stroke-dasharray="4 4"
			/>
			<!-- the plane of Earth's orbit (the ecliptic) -->
			<ellipse
				cx={C3.x}
				cy={C3.y}
				rx={R3 * PLANE_K}
				ry={planeRy}
				fill="var(--sky-orbit)"
				opacity={dark ? 0.22 : 0.2}
			/>
			<ellipse
				cx={C3.x}
				cy={C3.y}
				rx={R3 * PLANE_K}
				ry={planeRy}
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1"
			/>
			{@render txt(C3.x - R3 * PLANE_K * 0.98, C3.y + planeRy + 30, 'plane of Earth’s orbit', 11, {
				muted: true,
				opacity: nearSun(C3.x - R3 * PLANE_K * 0.62, C3.y + planeRy + 26)
			})}

			<!-- line of nodes, fixed in space -->
			<line
				x1={nodeA.x}
				y1={nodeA.y}
				x2={nodeB.x}
				y2={nodeB.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="6 4"
			/>
			<!-- Earth's shadow, away from the Sun -->
			<line
				x1={C3.x}
				y1={C3.y}
				x2={antiSun3.x}
				y2={antiSun3.y}
				stroke="var(--sky-night)"
				stroke-width="9"
				stroke-linecap="round"
				opacity={shade(0.14)}
			/>
			<!-- to the Sun -->
			<line
				x1={C3.x}
				y1={C3.y}
				x2={sun3.x}
				y2={sun3.y}
				stroke="var(--sky-sun)"
				stroke-width="1.5"
				stroke-dasharray="3 4"
			/>
			<circle cx={sun3.x} cy={sun3.y} r="15" fill="var(--sky-sun)" />
			{@render txt(sun3.x, sun3.y + 4, 'Sun', 10, {
				anchor: 'middle',
				weight: 600,
				color: '#5a4300',
				halo: false
			})}

			<!-- the part of the Moon's orbit above the plane -->
			<path
				d={ORBIT_ABOVE}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.8"
				opacity="0.7"
			/>
			<circle cx={ascNode.x} cy={ascNode.y} r="4" fill="var(--stage-ink-muted)" />
			<circle cx={descNode.x} cy={descNode.y} r="4" fill="var(--stage-ink-muted)" />
			{@render txt(ascLabel.x, ascLabel.y, 'node', 12, {
				anchor: 'middle',
				weight: 600,
				opacity: nearSun(ascLabel.x, ascLabel.y)
			})}
			{@render txt(ascLabel.x, ascLabel.y + 14, '(Moon going up)', 11, {
				anchor: 'middle',
				muted: true,
				opacity: nearSun(ascLabel.x, ascLabel.y + 14)
			})}
			{@render txt(descLabel.x, descLabel.y, 'node', 12, {
				anchor: 'middle',
				weight: 600,
				opacity: nearSun(descLabel.x, descLabel.y)
			})}
			{@render txt(descLabel.x, descLabel.y + 14, '(Moon going down)', 11, {
				anchor: 'middle',
				muted: true,
				opacity: nearSun(descLabel.x, descLabel.y + 14)
			})}

			<!-- Earth -->
			{@render halfLit(C3.x, C3.y, 13, sunAngle, 'var(--sky-ocean)', 'var(--sky-ocean)')}
			<path
				d="M{C3.x} {C3.y - 13} A13 13 0 0 1 {C3.x} {C3.y + 13} Z"
				fill="var(--sky-night)"
				transform="rotate({sunAngle + 180} {C3.x} {C3.y})"
			/>
			<circle cx={C3.x} cy={C3.y} r="13" fill="none" stroke="var(--sky-orbit)" stroke-width="1" />

			<!-- the Moon's height above or below the plane -->
			<line
				x1={moon3.x}
				y1={moon3.y}
				x2={moon3.foot.x}
				y2={moon3.foot.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="2 3"
			/>
			<circle cx={moon3.foot.x} cy={moon3.foot.y} r="2" fill="var(--stage-ink-muted)" />

			<!-- legend -->
			<line
				x1="34"
				y1="372"
				x2="62"
				y2="372"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="6 4"
			/>
			{@render txt(70, 376, 'line of nodes: keeps pointing the same way all year', 12)}
			<line
				x1="34"
				y1="394"
				x2="62"
				y2="394"
				stroke="var(--sky-sun)"
				stroke-width="1.5"
				stroke-dasharray="3 4"
			/>
			{@render txt(70, 398, `direction of the Sun on ${dateText(dayShown)}: turns once a year`, 12)}
			<line
				x1="34"
				y1="416"
				x2="62"
				y2="416"
				stroke="var(--sky-night)"
				stroke-width="7"
				stroke-linecap="round"
				opacity={shade(0.14)}
			/>
			{@render txt(70, 420, "Earth's shadow", 12)}
		</g>

		<!-- the Moon (oblique view), draggable along its orbit -->
		<g opacity={w.tilted}>
			<Handle
				x={moon3.x}
				y={moon3.y}
				r={9}
				label="The Moon on its tilted orbit"
				value={snapDays(days)}
				min={0}
				max={MAX_DAYS}
				valuetext="{days.toFixed(1)} days since new Moon, {name}"
				{onkey}
				{ondragstart}
				{ondragend}
				onmove={onmove3}
			/>
			<g pointer-events="none" opacity={moon3.z < 0 ? 0.7 : 1}>
				{#if pulse > 0.01}
					<circle
						cx={moon3.x}
						cy={moon3.y}
						r={17 + 5 * pulse}
						fill="none"
						stroke="var(--explainer-accent, var(--accent))"
						stroke-width="1.5"
						opacity={0.6 * pulse}
					/>
				{/if}
				{@render halfLit(moon3.x, moon3.y, 8, sunAngle, 'var(--sky-moon)', 'var(--sky-moon-dark)')}
				<circle
					cx={moon3.x}
					cy={moon3.y}
					r="8"
					fill="none"
					stroke="var(--sky-orbit)"
					stroke-width="1"
				/>
			</g>
		</g>

		<!-- side-on view and readouts -->
		<g opacity={w.tilted} pointer-events="none">
			<rect
				x={SX0}
				y="24"
				width={SX1 - SX0}
				height="410"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(SX0 + 16, 48, 'Seen side-on', 13, { weight: 600, halo: false })}
			{@render txt(SX0 + 16, 64, 'heights exaggerated ×3', 11, { muted: true, halo: false })}
			{#if eclipseNow}
				{@render txt(SX1 - 16, 52, eclipseNow === 'solar' ? 'SOLAR ECLIPSE' : 'LUNAR ECLIPSE', 12, {
					anchor: 'end',
					weight: 700,
					color: eclipseNow === 'solar' ? '#3d2e00' : '#ffffff',
					pill: { fill: eclipseNow === 'solar' ? 'var(--sky-sun)' : COPPER }
				})}
			{/if}

			<!-- the Earth–Sun line -->
			<line
				x1={sunSide.x}
				y1={SEY}
				x2={SX1 - 14}
				y2={SEY}
				stroke="var(--sky-sun)"
				stroke-width="1.2"
				stroke-dasharray="3 4"
			/>
			<!-- Earth's shadow -->
			<polygon
				points="{SEX},{SEY - 8} {SX1 - 14},{SEY - 5} {SX1 - 14},{SEY + 5} {SEX},{SEY + 8}"
				fill="var(--sky-night)"
				opacity={shade(0.14)}
			/>
			<!-- eclipse zones: the Moon's centre must pass within these -->
			<rect
				x={SEX - RP - 13}
				y={SEY - ZONE_SOLAR}
				width="26"
				height={2 * ZONE_SOLAR}
				rx="3"
				fill="var(--sky-sun)"
				opacity="0.35"
				stroke="var(--sky-sun)"
			/>
			<rect
				x={SEX + RP - 13}
				y={SEY - ZONE_LUNAR}
				width="26"
				height={2 * ZONE_LUNAR}
				rx="3"
				fill={COPPER}
				opacity="0.3"
				stroke={COPPER}
			/>
			<!-- the Moon's orbit, side-on -->
			<path d={sideOrbit} fill="none" stroke="var(--sky-orbit)" stroke-width="1.3" />
			<circle cx={sunSide.x} cy={SEY} r="13" fill="var(--sky-sun)" />
			<circle cx={SEX} cy={SEY} r="8" fill="var(--sky-ocean)" />
			<!-- where this month's new and full Moons pass -->
			<circle
				cx={sideNew.x}
				cy={sideNew.y}
				r="6.5"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="2 2"
			/>
			<circle
				cx={sideFull.x}
				cy={sideFull.y}
				r="6.5"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="2 2"
			/>
			<circle
				cx={sideMoon.x}
				cy={sideMoon.y}
				r="5"
				fill={eclipseNow === 'lunar' ? COPPER : 'var(--sky-moon)'}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
			{@render txt(sunSide.x, SEY + 52, 'Sun', 11, { anchor: 'middle', muted: true, halo: false })}
			{@render txt(SEX, SEY + 52, 'Earth', 11, { anchor: 'middle', muted: true, halo: false })}
			{@render txt(SEX - RP, SEY + 76, 'new Moon', 11, { anchor: 'middle', halo: false })}
			{@render txt(SEX - RP, SEY + 90, `zone ±${SOLAR_TXT}°`, 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			{@render txt(SEX + RP - 6, SEY + 76, 'full Moon', 11, { anchor: 'middle', halo: false })}
			{@render txt(SEX + RP - 6, SEY + 90, `zone ±${LUNAR_TXT}°`, 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}

			<!-- readouts -->
			<line x1={SX0 + 16} y1="292" x2={SX1 - 16} y2="292" stroke="var(--border)" />
			{@render txt(SX0 + 16, 318, readout.a, 13, { weight: 600, halo: false })}
			{@render txt(SX0 + 16, 338, readout.b, 13, {
				halo: false,
				weight: eclipseNow ? 600 : 500,
				color: eclipseNow === 'lunar' ? COPPER : undefined
			})}
			{@render txt(SX0 + 16, 374, monthNew, 11, { muted: !solarThisMonth, halo: false })}
			{@render txt(SX0 + 16, 392, monthFull, 11, { muted: !lunarThisMonth, halo: false })}
			{@render txt(
				SX0 + 16,
				418,
				inSeason
					? 'Eclipse season: the line of nodes points at the Sun'
					: 'Outside the eclipse seasons',
				11,
				{
					muted: !inSeason,
					weight: inSeason ? 600 : 500,
					halo: false
				}
			)}
		</g>

		<!-- year strip: the two eclipse seasons -->
		<g opacity={w.tilted} pointer-events="none">
			{@render txt(YX0, 470, 'Eclipse seasons', 13, { weight: 600 })}
			<rect
				x={YX1 - 300}
				y="461"
				width="14"
				height="10"
				rx="2"
				fill="var(--sky-sun)"
				opacity="0.55"
			/>
			{@render txt(YX1 - 280, 470, 'solar eclipses possible', 11, { muted: true })}
			<rect x={YX1 - 140} y="461" width="14" height="10" rx="2" fill={COPPER} opacity="0.6" />
			{@render txt(YX1 - 120, 470, 'lunar too', 11, { muted: true })}

			<rect
				x={YX0}
				y={YT}
				width={YX1 - YX0}
				height={YH}
				rx="3"
				fill="var(--sky-space)"
				stroke="var(--stage-line)"
			/>
			{#each SEASONS as s (s.i)}
				{#each s.solar as [a, b], k (k)}
					<rect
						x={yx(a)}
						y={YT}
						width={yx(b) - yx(a)}
						height={YH}
						fill="var(--sky-sun)"
						opacity="0.55"
					/>
				{/each}
				{#each s.lunar as [a, b], k (k)}
					<rect
						x={yx(a)}
						y={YT + 3}
						width={yx(b) - yx(a)}
						height={YH - 6}
						fill={COPPER}
						opacity="0.6"
					/>
				{/each}
				{@render txt(yx(s.centre), YT - 8, s.label, 11, {
					anchor: 'middle',
					opacity: 0.2 + 0.8 * smoothstep(50, 90, Math.abs(yx(dayShown) - yx(s.centre)))
				})}
			{/each}
			{#each MONTHS as m, i (i)}
				<line
					x1={yx(MONTH_START[i])}
					y1={YT + YH}
					x2={yx(MONTH_START[i])}
					y2={YT + YH + 5}
					stroke="var(--stage-line)"
				/>
				{@render txt(yx((MONTH_START[i] + MONTH_START[i + 1]) / 2), YT + YH + 18, m, 11, {
					anchor: 'middle',
					muted: true
				})}
			{/each}
			<!-- today -->
			<line
				x1={yx(dayShown)}
				y1={YT - 4}
				x2={yx(dayShown)}
				y2={YT + YH + 4}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<path
				d="M{yx(dayShown) - 6} {YT - 10} L{yx(dayShown) + 6} {YT - 10} L{yx(dayShown)} {YT - 3} Z"
				fill="var(--stage-ink)"
			/>
			{@render txt(
				Math.max(YX0 + 20, Math.min(YX1 - 20, yx(dayShown))),
				YT + YH + 40,
				dateText(dayShown),
				12,
				{ anchor: 'middle', weight: 600 }
			)}
		</g>
	{/if}
</g>
