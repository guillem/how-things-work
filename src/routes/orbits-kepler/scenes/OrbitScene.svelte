<script lang="ts">
	/**
	 * A planet launched round a star, computed step by step from Newton's law of
	 * gravity (`integrate` in orbits.ts) and replayed as a function of time.
	 *
	 * Phases (`step.hints.phase`):
	 *   launch — `params.speed` × circular speed, tilted by `params.direction`: a
	 *            circle, an ellipse or an escape, with the predicted orbit dashed
	 *   first  — the ellipse for `params.ellipseSpeed`: both foci, the major axis,
	 *            perihelion/aphelion and the two focal distances with their sum
	 *   second — the same orbit cut into 8 equal-time wedges, each labelled with
	 *            its (equal) area; the speed readout changes round the orbit
	 *   two    — an Earth-like planet at 1 AU and a second planet of
	 *            `params.neighbour` Jupiters at 1.6 AU, 30 years replayed fast
	 *
	 * Every launch is integrated once (a `$derived` keyed on the controls and the
	 * "Launch again" count) and replayed from the moment it was launched (see
	 * `since`, the sanctioned restart memo). Text sizes and colours are set with
	 * `style:` because the stage's CSS overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		AU_PER_YEAR_KMS,
		EARTH_MASS,
		GM,
		JUPITER_MASS,
		circularSpeed,
		elements,
		integrate,
		sweptArea,
		type Elements,
		type Track
	} from '../orbits';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- layout -------------------------------------------------------------------
	const PX0 = 16; // the space panel
	const PY0 = 16;
	const PX1 = 640;
	const PY1 = 584;
	const SX0 = 340; // the Sun on `launch` (fixed during a step)
	const PXC = (PX0 + PX1) / 2;
	const SY = 300;
	const CX = 660; // readout card
	const CW = 284;
	const KMS = (v: number) => v * AU_PER_YEAR_KMS;
	const V1 = circularSpeed(1); // 2π AU/yr = 29.8 km/s

	const phase = $derived(String(step.hints?.phase ?? 'launch'));
	const pressed = $derived(Number(params.launch ?? 0));
	const speed = $derived(
		phase === 'launch' ? Number(params.speed ?? 1) : Number(params.ellipseSpeed ?? 0.75)
	);
	const dirDeg = $derived(phase === 'launch' ? Number(params.direction ?? 0) : 0);
	const neighbour = $derived(Number(params.neighbour ?? 10));

	// ---- the single-planet launch (launch / first / second) ------------------------
	const N_WEDGES = 8;
	const PER_WEDGE = 150; // samples per wedge: the slice boundaries fall on samples
	const CAP = 10; // years: longer orbits are only replayed this far
	const ESCAPE_YEARS = 4;

	interface Launch {
		el: Elements;
		track: Track;
		/** Samples in the replay and the years it lasts before it loops. */
		n: number;
		loop: number;
		/** Seconds of animation per year of orbit. */
		secPerYear: number;
		bound: boolean;
		/** Bound but too long to replay a whole orbit. */
		long: boolean;
		crashed: boolean;
	}

	const launch = $derived.by((): Launch => {
		const th = (dirDeg * Math.PI) / 180;
		const r = { x: 1, y: 0 };
		const v = { x: speed * V1 * Math.sin(th), y: speed * V1 * Math.cos(th) };
		const el = elements(r, v);
		const bound = el.energy < 0 && el.kind !== 'parabola';
		const long = bound && el.period > CAP;
		let years: number;
		let sample: number;
		if (bound && !long) {
			years = el.period;
			sample = el.period / (N_WEDGES * PER_WEDGE);
		} else {
			years = bound ? CAP : ESCAPE_YEARS;
			sample = years / 1500;
		}
		const track = integrate([{ r, v, m: 0 }], years, sample, 8);
		const n = track.x[0].length;
		const secPerYear = bound && !long ? (el.period <= 1.5 ? 6 : Math.max(1.5, 12 / el.period)) : 6;
		return {
			el,
			track,
			n,
			loop: years,
			secPerYear: long ? 1.5 : secPerYear,
			bound,
			long,
			crashed: track.crashed[0]
		};
	});

	// Scale: a fixed 130 px/AU on `launch` (an orbit out to ~2 AU fits); on `first`
	// and `second` (bound orbits) the Sun moves on the step change so that the
	// ellipse is centred in the panel and fitted, leaving room for the apsis labels.
	const view = $derived.by(() => {
		if (phase === 'two') return { S: 150, SX: SX0 };
		const { el, bound } = launch;
		if (phase === 'launch' || !bound) return { S: 130, SX: SX0 };
		const cx = -el.a * el.e * Math.cos(el.periAngle);
		const b = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e));
		const S = Math.max(20, Math.min(300, (PX1 - PX0 - 240) / (2 * el.a), 440 / (2 * b)));
		return { S, SX: PXC - cx * S };
	});
	const S = $derived(view.S);
	const SX = $derived(view.SX);
	const sx = (x: number) => SX + x * S;
	const sy = (y: number) => SY - y * S;
	const inPanel = (X: number, Y: number) =>
		X > PX0 + 4 && X < PX1 - 4 && Y > PY0 + 4 && Y < PY1 - 4;

	/** Screen points of the track, their cumulative length (for the trail) and the exit. */
	const screen = $derived.by(() => {
		const { track, n } = launch;
		const X = new Float64Array(n);
		const Y = new Float64Array(n);
		const cum = new Float64Array(n);
		let d = '';
		let exit = -1;
		for (let i = 0; i < n; i++) {
			X[i] = sx(track.x[0][i]);
			Y[i] = sy(track.y[0][i]);
			if (i > 0) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
			if (exit < 0 && !inPanel(X[i], Y[i])) exit = i;
			d += `${i ? 'L' : 'M'}${X[i].toFixed(1)} ${Y[i].toFixed(1)}`;
		}
		return { X, Y, cum, d, exit };
	});

	// ---- time ---------------------------------------------------------------------
	// Seconds since this launch: the replay restarts when the controls change or
	// "Launch again" is pressed. A frame-to-frame memo inside a $derived (the
	// guide's sanctioned exception, as in newtons-laws TrackScene); it ignores the
	// clock going backwards (a step change resets t).
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${speed}|${dirDeg}|${neighbour}|${pressed}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});

	// The overlay fades in on every step change (the orbit itself redraws at once).
	const fade = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		void phase;
		untrack(() => {
			if (reduced) return;
			fade.set(0, { duration: 0 });
			fade.set(1);
		});
	});

	/** Fractional sample index of the planet, and whether the first lap is done. */
	const pos = $derived.by(() => {
		const { track, n, loop, secPerYear, bound, long, el } = launch;
		const dt = track.dt;
		const exit = screen.exit;
		if (reduced) {
			if (phase === 'second' && bound && !long) {
				// Parked at perihelion with all the wedges shown.
				return { i: speed < 1 ? n / 2 : 0, full: true };
			}
			if (bound && !long) return { i: (n - 1) * 0.3, full: true };
			// An escape or a very long orbit: on its way out, still on screen.
			const k = exit > 0 ? Math.max(1, exit - Math.round(0.25 / dt)) : (n - 1) * 0.3;
			return { i: k, full: false };
		}
		const years = since / secPerYear;
		if (bound && !long) {
			const lap = Math.floor(years / el.period);
			const u = years - lap * el.period;
			return { i: Math.min(n - 1, u / dt), full: lap >= 1 };
		}
		// Escapes and long orbits: run until shortly after leaving the frame
		// (or to the end of the replay), hold, and start again.
		const endYears = exit > 0 ? Math.min(loop, exit * dt + 0.5) : loop;
		const span = endYears + 2 / secPerYear;
		const u = years % span;
		return { i: Math.min(u, endYears) / dt, full: false };
	});

	const at = (arr: Float64Array, i: number) => {
		const k = Math.min(arr.length - 2, Math.floor(i));
		const f = i - k;
		return arr[k] * (1 - f) + arr[k + 1] * f;
	};
	const planet = $derived({
		X: at(screen.X, pos.i),
		Y: at(screen.Y, pos.i),
		x: at(launch.track.x[0], pos.i),
		y: at(launch.track.y[0], pos.i)
	});
	const trailLen = $derived(
		pos.full ? screen.cum[screen.cum.length - 1] + 10 : at(screen.cum, pos.i)
	);
	const rNow = $derived(Math.hypot(planet.x, planet.y));
	const vNow = $derived(Math.sqrt(Math.max(0, GM * (2 / rNow - 1 / launch.el.a))));
	const offFrame = $derived(!inPanel(planet.X, planet.Y));
	// A crash: the track stops at the Sun's surface; the planet vanishes there.
	const crashAt = $derived.by(() => {
		if (!launch.crashed) return Infinity;
		const { track, n } = launch;
		for (let i = 0; i < n; i++) if (Math.hypot(track.x[0][i], track.y[0][i]) < 0.01) return i;
		return n - 1;
	});
	const crashedNow = $derived(pos.i >= crashAt);

	// ---- the predicted orbit (from the elements, not the integration) --------------
	const conic = $derived.by(() => {
		const { el, bound } = launch;
		const w = el.periAngle;
		if (bound) {
			const cx = -el.a * el.e * Math.cos(w);
			const cy = -el.a * el.e * Math.sin(w);
			const b = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e));
			return {
				ellipse: { cx: sx(cx), cy: sy(cy), rx: el.a * S, ry: b * S, rot: (-w * 180) / Math.PI },
				d: ''
			};
		}
		// The open branch: r = p / (1 + e cos(θ − ω)), out to 12 AU.
		const p = (el.h * el.h) / GM;
		const lim = Math.acos(Math.max(-1, -1 / el.e)) - 1e-3;
		let d = '';
		for (let k = 0; k <= 160; k++) {
			const f = -lim + (2 * lim * k) / 160;
			const r = p / (1 + el.e * Math.cos(f));
			if (r > 12 || r < 0) continue;
			d += `${d ? 'L' : 'M'}${sx(r * Math.cos(f + w)).toFixed(1)} ${sy(r * Math.sin(f + w)).toFixed(1)}`;
		}
		return { ellipse: null, d };
	});

	// Perihelion / aphelion points and the empty focus.
	const apsides = $derived.by(() => {
		const { el, bound } = launch;
		const w = el.periAngle;
		const peri = { x: el.perihelion * Math.cos(w), y: el.perihelion * Math.sin(w) };
		const aph = bound ? { x: -el.aphelion * Math.cos(w), y: -el.aphelion * Math.sin(w) } : null;
		const f2 = bound
			? { x: -2 * el.a * el.e * Math.cos(w), y: -2 * el.a * el.e * Math.sin(w) }
			: null;
		return { peri, aph, f2 };
	});

	// ---- second law: equal-time wedges ----------------------------------------------
	const wedges = $derived.by(() => {
		const { track, bound, long } = launch;
		if (!bound || long) return [];
		const out: { k: number; d: string; area: number; lx: number; ly: number }[] = [];
		const { X, Y } = screen;
		const placed: { x: number; y: number }[] = [];
		for (let k = 0; k < N_WEDGES; k++) {
			const s0 = k * PER_WEDGE;
			const s1 = s0 + PER_WEDGE;
			let d = `M${SX} ${SY}`;
			for (let s = s0; s <= s1; s += 5) d += `L${X[s].toFixed(1)} ${Y[s].toFixed(1)}`;
			d += 'Z';
			// Label just outside the orbit, at the middle of the wedge's arc; pushed
			// further out when it would crowd the previous one.
			const m = s0 + PER_WEDGE / 2;
			const ux = X[m] - SX;
			const uy = Y[m] - SY;
			const len = Math.hypot(ux, uy) || 1;
			let off = 22;
			let lx = X[m] + (ux / len) * off;
			let ly = Y[m] + (uy / len) * off;
			while (placed.some((p) => Math.abs(p.x - lx) < 70 && Math.abs(p.y - ly) < 18) && off < 120) {
				off += 18;
				lx = X[m] + (ux / len) * off;
				ly = Y[m] + (uy / len) * off;
			}
			placed.push({ x: lx, y: ly });
			out.push({ k, d, area: sweptArea(track, 0, s0, s1), lx, ly });
		}
		return out;
	});
	const currentWedge = $derived(
		pos.full ? N_WEDGES : Math.min(N_WEDGES - 1, Math.floor(pos.i / PER_WEDGE))
	);
	const partialWedge = $derived.by(() => {
		if (pos.full || !wedges.length) return '';
		const s0 = currentWedge * PER_WEDGE;
		const { X, Y } = screen;
		let d = `M${SX} ${SY}`;
		for (let s = s0; s <= pos.i; s += 5) d += `L${X[s].toFixed(1)} ${Y[s].toFixed(1)}`;
		d += `L${planet.X.toFixed(1)} ${planet.Y.toFixed(1)}Z`;
		return d;
	});
	const speedRange = $derived({
		max: Math.sqrt(GM * (2 / launch.el.perihelion - 1 / launch.el.a)),
		min: launch.bound ? Math.sqrt(GM * (2 / launch.el.aphelion - 1 / launch.el.a)) : 0
	});

	// ---- two planets ----------------------------------------------------------------
	const TWO_YEARS = 30;
	const TWO_SAMPLE = 0.005;
	const TWO_SEC_PER_YEAR = 1.5;
	const TRAIL_YEARS = 4;
	const two = $derived.by(() => {
		if (phase !== 'two') return null;
		const R2 = 1.6;
		const track = integrate(
			[
				{ r: { x: 1, y: 0 }, v: { x: 0, y: V1 }, m: EARTH_MASS },
				{ r: { x: -R2, y: 0 }, v: { x: 0, y: -circularSpeed(R2) }, m: neighbour * JUPITER_MASS }
			],
			TWO_YEARS,
			TWO_SAMPLE,
			8
		);
		const n = track.x[0].length;
		const lo = new Float64Array(n);
		const hi = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			const r = Math.hypot(track.x[0][i], track.y[0][i]);
			lo[i] = i ? Math.min(lo[i - 1], r) : r;
			hi[i] = i ? Math.max(hi[i - 1], r) : r;
		}
		return { track, n, lo, hi };
	});
	const twoI = $derived.by(() => {
		if (!two) return 0;
		if (reduced) return two.n - 1;
		const span = TWO_YEARS + 3 / TWO_SEC_PER_YEAR; // hold 3 s at the end
		const years = (since / TWO_SEC_PER_YEAR) % span;
		return Math.min(two.n - 1, years / TWO_SAMPLE);
	});
	const twoView = $derived.by(() => {
		if (!two) return null;
		const { track } = two;
		const i = twoI;
		const k = Math.floor(i);
		const back = Math.round(TRAIL_YEARS / TWO_SAMPLE);
		let d = '';
		for (let s = Math.max(0, k - back); s <= k; s += 2)
			d += `${d ? 'L' : 'M'}${sx(track.x[0][s]).toFixed(1)} ${sy(track.y[0][s]).toFixed(1)}`;
		const p1 = { X: sx(at(track.x[0], i)), Y: sy(at(track.y[0], i)) };
		d += `L${p1.X.toFixed(1)} ${p1.Y.toFixed(1)}`;
		const p2 = { X: sx(at(track.x[1], i)), Y: sy(at(track.y[1], i)) };
		return { d, p1, p2, years: i * TWO_SAMPLE, lo: two.lo[k], hi: two.hi[k] };
	});

	// ---- text helpers ---------------------------------------------------------------
	const f2 = (v: number) => v.toFixed(2);
	const kindText = $derived.by(() => {
		const k = launch.el.kind;
		if (k === 'circle') return 'circle';
		if (k === 'ellipse') return 'ellipse';
		if (k === 'parabola') return 'escape (parabola)';
		if (k === 'hyperbola') return 'escape (hyperbola)';
		return 'straight into the Sun';
	});
	const status = $derived.by(() => {
		if (launch.crashed && crashedNow) return 'Crashed into the Sun!';
		if (!launch.bound && offFrame) return 'escaping… it never comes back';
		if (!launch.bound) return 'escaping…';
		if (launch.long && offFrame)
			return `off the frame — back after ${launch.el.period.toFixed(0)} years`;
		if (offFrame) return 'off the frame for a while — it comes back';
		return '';
	});
	const paceText = $derived(
		`1 year ≈ ${launch.secPerYear % 1 === 0 ? launch.secPerYear.toFixed(0) : launch.secPerYear.toFixed(1)} s here`
	);
	// The launch arrow: length ∝ speed.
	const arrow = $derived.by(() => {
		const th = (dirDeg * Math.PI) / 180;
		const L = 22 + 50 * speed;
		const X0 = sx(1);
		const Y0 = sy(0);
		return { X0, Y0, X1: X0 + L * Math.sin(th), Y1: Y0 - L * Math.cos(th) };
	});
	const escapeLabel = $derived.by(() => {
		// Where the planet left the frame, kept inside the panel.
		const e = screen.exit;
		if (e < 0) return null;
		const X = Math.min(PX1 - 90, Math.max(PX0 + 90, screen.X[e]));
		const Y = Math.min(PY1 - 18, Math.max(PY0 + 26, screen.Y[e]));
		return { X, Y };
	});

	// Two focal distances for the first law.
	const foci = $derived.by(() => {
		const f = apsides.f2;
		if (!f) return null;
		const d1 = rNow;
		const d2 = Math.hypot(planet.x - f.x, planet.y - f.y);
		return { d1, d2, F2X: sx(f.x), F2Y: sy(f.y) };
	});
	const isCircle = $derived(launch.el.kind === 'circle');
	const showOrbit = $derived(phase !== 'two');
	const cardH = $derived(phase === 'two' ? 196 : phase === 'second' ? 250 : 236);
	const statusY = $derived(
		PY0 +
			cardH +
			(phase === 'first' && launch.bound ? 140 : phase === 'second' && wedges.length ? 154 : 36)
	);
	const bx = CX + 16;
	const bw = CW - 32;
	const by = $derived(PY0 + cardH + 58);
	const u = $derived(
		speedRange.max > speedRange.min
			? (vNow - speedRange.min) / (speedRange.max - speedRange.min)
			: 1
	);
	// First-law labels: apsides outwards along the axis (kept inside the panel),
	// the two focal lengths beside their own lines, away from the other line.
	type Anchor = 'start' | 'middle' | 'end';
	const labels = $derived.by(() => {
		if (phase !== 'first' || !foci || !apsides.aph) return null;
		const apsis: { x: number; y: number; text: string; anchor: Anchor }[] = [];
		// Outwards along the major axis, beside the apsis point, on two lines.
		const put = (p: { x: number; y: number }, name: string, value: number) => {
			const X = sx(p.x);
			const Y = sy(p.y);
			if (X < PX0 || X > PX1) return;
			const out = X < SX || (X === SX && p.x < 0) ? -1 : 1;
			const anchor: Anchor = out < 0 ? 'end' : 'start';
			const x = X + out * 12;
			apsis.push({ x, y: Y - 3, text: name, anchor });
			apsis.push({ x, y: Y + 12, text: `${f2(value)} AU`, anchor });
		};
		put(apsides.peri, 'perihelion', launch.el.perihelion);
		put(apsides.aph, 'aphelion', launch.el.aphelion);
		const side = (ax: number, ay: number, bx: number, by: number, ox: number, oy: number) => {
			// Midpoint of a→b pushed 14 px perpendicular, away from the point o.
			const mx = (ax + bx) / 2;
			const my = (ay + by) / 2;
			const L = Math.hypot(bx - ax, by - ay) || 1;
			let nx = -(by - ay) / L;
			let ny = (bx - ax) / L;
			if (nx * (ox - mx) + ny * (oy - my) > 0) {
				nx = -nx;
				ny = -ny;
			}
			const anchor: Anchor = Math.abs(nx) < 0.3 ? 'middle' : nx > 0 ? 'start' : 'end';
			return { x: mx + nx * 14, y: my + ny * 14 + 4 + (ny > 0.3 ? 6 : 0), anchor };
		};
		const l1 = side(planet.X, planet.Y, SX, SY, foci.F2X, foci.F2Y);
		const l2 = side(planet.X, planet.Y, foci.F2X, foci.F2Y, SX, SY);
		return {
			apsis,
			lengths: [
				{ ...l1, text: `${f2(foci.d1)} AU`, color: 'var(--orb-star)' },
				{ ...l2, text: `${f2(foci.d2)} AU`, color: 'var(--orb-planet)' }
			]
		};
	});
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

{#snippet row(y: number, label: string, value: string, color?: string, weight = 600)}
	{@render txt(CX + 16, y, label, 12.5, { muted: true })}
	{@render txt(CX + CW - 16, y, value, 14, { anchor: 'end', weight, color, tabular: true })}
{/snippet}

<g>
	<defs>
		<radialGradient id="orbit-sun-glow">
			<stop offset="0" style:stop-color="var(--orb-star)" stop-opacity="0.75" />
			<stop offset="0.35" style:stop-color="var(--orb-star)" stop-opacity="0.3" />
			<stop offset="1" style:stop-color="var(--orb-star)" stop-opacity="0" />
		</radialGradient>
		<clipPath id="orbit-clip">
			<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="14" />
		</clipPath>
	</defs>

	<!-- space panel -->
	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>

	<g clip-path="url(#orbit-clip)">
		{#if showOrbit}
			<!-- equal-time wedges (second law) -->
			{#if phase === 'second' && wedges.length}
				<g opacity={fade.current}>
					{#each wedges as w (w.k)}
						{#if w.k < currentWedge}
							<path
								d={w.d}
								fill="var(--orb-area)"
								fill-opacity={w.k % 2 ? 0.22 : 0.42}
								stroke="var(--orb-area)"
								stroke-width="1"
								stroke-linejoin="round"
							/>
						{/if}
					{/each}
					{#if partialWedge}
						<path
							d={partialWedge}
							fill="var(--orb-area)"
							fill-opacity={currentWedge % 2 ? 0.22 : 0.42}
							stroke="var(--orb-area)"
							stroke-width="1"
							stroke-linejoin="round"
						/>
					{/if}
				</g>
			{/if}

			<!-- the predicted orbit, from the elements -->
			{#if conic.ellipse}
				<ellipse
					cx={conic.ellipse.cx}
					cy={conic.ellipse.cy}
					rx={conic.ellipse.rx}
					ry={conic.ellipse.ry}
					transform="rotate({conic.ellipse.rot} {conic.ellipse.cx} {conic.ellipse.cy})"
					fill="none"
					stroke="var(--orb-path)"
					stroke-width="1.2"
					stroke-dasharray="5 6"
					opacity="0.6"
				/>
			{:else if conic.d}
				<path
					d={conic.d}
					fill="none"
					stroke="var(--orb-path)"
					stroke-width="1.2"
					stroke-dasharray="5 6"
					opacity="0.6"
				/>
			{/if}

			<!-- first law: major axis, foci, focal distances -->
			{#if phase === 'first' && launch.bound && apsides.aph && foci}
				<g opacity={fade.current}>
					<line
						x1={sx(apsides.peri.x)}
						y1={sy(apsides.peri.y)}
						x2={sx(apsides.aph.x)}
						y2={sy(apsides.aph.y)}
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
						opacity="0.7"
					/>
					<line
						x1={planet.X}
						y1={planet.Y}
						x2={SX}
						y2={SY}
						stroke="var(--orb-star)"
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
					<line
						x1={planet.X}
						y1={planet.Y}
						x2={foci.F2X}
						y2={foci.F2Y}
						stroke="var(--orb-planet)"
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
					{#if !isCircle}
						<circle
							cx={foci.F2X}
							cy={foci.F2Y}
							r="6"
							fill="var(--orb-space)"
							stroke="var(--stage-ink)"
							stroke-width="1.5"
						/>
					{/if}
				</g>
			{/if}

			<!-- the trail of the path so far -->
			<path
				d={screen.d}
				fill="none"
				stroke="var(--orb-planet)"
				stroke-width="2.5"
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke-dasharray="{trailLen.toFixed(1)} 100000"
				opacity="0.85"
			/>
		{:else if twoView}
			<!-- two planets: the undisturbed orbits for reference -->
			<circle
				cx={SX}
				cy={SY}
				r={S}
				fill="none"
				stroke="var(--orb-path)"
				stroke-width="1.2"
				stroke-dasharray="5 6"
				opacity="0.7"
			/>
			{#if neighbour > 0}
				<circle
					cx={SX}
					cy={SY}
					r={1.6 * S}
					fill="none"
					stroke="var(--orb-second)"
					stroke-width="1"
					stroke-dasharray="3 6"
					opacity="0.55"
				/>
			{/if}
			<path
				d={twoView.d}
				fill="none"
				stroke="var(--orb-planet)"
				stroke-width="1.6"
				stroke-linejoin="round"
				opacity="0.8"
			/>
		{/if}

		<!-- the Sun -->
		<circle cx={SX} cy={SY} r="30" fill="url(#orbit-sun-glow)" />
		<circle cx={SX} cy={SY} r="7" fill="var(--orb-star)" />

		{#if showOrbit}
			<!-- launch point and arrow -->
			<!-- (hidden behind the wedges' labels on `second`) -->
			{#if !(phase === 'second' && wedges.length)}
				<g opacity={phase === 'launch' ? 1 : 0.55}>
					<line
						x1={arrow.X0}
						y1={arrow.Y0}
						x2={arrow.X1}
						y2={arrow.Y1}
						stroke="var(--stage-ink)"
						stroke-width="2"
						marker-end="url(#arrowhead)"
					/>
					<circle cx={arrow.X0} cy={arrow.Y0} r="3" fill="var(--stage-ink)" />
				</g>
			{/if}

			<!-- the planet -->
			{#if !(launch.crashed && crashedNow)}
				<circle
					cx={planet.X}
					cy={planet.Y}
					r="7"
					fill="var(--orb-planet)"
					stroke="var(--orb-space)"
					stroke-width="1.5"
				/>
			{/if}
		{:else if twoView}
			<circle
				cx={twoView.p1.X}
				cy={twoView.p1.Y}
				r="6"
				fill="var(--orb-planet)"
				stroke="var(--orb-space)"
				stroke-width="1.5"
			/>
			{#if neighbour > 0}
				<circle
					cx={twoView.p2.X}
					cy={twoView.p2.Y}
					r={4 + 2.2 * Math.sqrt(neighbour)}
					fill="var(--orb-second)"
					stroke="var(--orb-space)"
					stroke-width="1.5"
				/>
			{/if}
		{/if}
	</g>

	<!-- labels on the drawing (outside the clip so halos stay whole) -->
	{#if showOrbit}
		{#if phase === 'launch'}
			{@render txt(arrow.X1 + 10, arrow.Y1 + 4, `${KMS(speed * V1).toFixed(1)} km/s`, 12.5, {
				weight: 600
			})}
		{/if}
		{@render txt(SX, SY + 26, phase === 'first' ? 'Sun (a focus)' : 'Sun', 12, {
			anchor: 'middle',
			muted: true
		})}

		{#if phase === 'first' && launch.bound && apsides.aph && foci && labels}
			<g opacity={fade.current}>
				{#each labels.apsis as l, i (i)}
					{@render txt(l.x, l.y, l.text, 12, { anchor: l.anchor })}
				{/each}
				{#if isCircle}
					{@render txt(SX, SY - 22, 'both foci at the centre', 12, { anchor: 'middle' })}
				{:else}
					{@render txt(foci.F2X, foci.F2Y + 24, 'other focus', 12, {
						anchor: 'middle',
						muted: true
					})}
				{/if}
				<!-- the two lengths, beside their lines, on the side away from the other -->
				{#each labels.lengths as l (l.color)}
					{@render txt(l.x, l.y, l.text, 12.5, {
						color: l.color,
						weight: 700,
						anchor: l.anchor,
						tabular: true
					})}
				{/each}
			</g>
		{/if}

		{#if phase === 'second' && wedges.length}
			<g opacity={fade.current}>
				{#each wedges as w (w.k)}
					{#if w.k < currentWedge}
						{@render txt(w.lx, w.ly + 4, `${w.area.toFixed(3)} AU²`, 11.5, {
							anchor: 'middle',
							weight: 600,
							tabular: true
						})}
					{/if}
				{/each}
			</g>
		{/if}

		{#if launch.crashed && crashedNow}
			{@render txt(SX, SY - 40, 'Crashed into the Sun', 14, { anchor: 'middle', weight: 700 })}
		{:else if !launch.bound && offFrame && escapeLabel}
			{@render txt(escapeLabel.X, escapeLabel.Y, 'escaping…', 14, {
				anchor: 'middle',
				weight: 700,
				color: 'var(--orb-planet)'
			})}
		{/if}
	{:else if twoView}
		{@render txt(SX, SY + 26, 'Sun', 12, { anchor: 'middle', muted: true })}
		{#if neighbour > 0}
			{@render txt(
				twoView.p2.X,
				twoView.p2.Y - 12 - 2.2 * Math.sqrt(neighbour),
				`${neighbour} × Jupiter`,
				12,
				{ anchor: 'middle', color: 'var(--orb-second)', weight: 600 }
			)}
		{/if}
	{/if}

	<!-- readout card -->
	<g>
		<rect
			x={CX}
			y={PY0}
			width={CW}
			height={cardH}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#if phase === 'two' && twoView}
			{@render txt(CX + 16, PY0 + 28, 'Inner planet (like the Earth)', 15, { weight: 700 })}
			{@render txt(CX + 16, PY0 + cardH + 36, 'Dashed: the undisturbed orbits', 12, {
				muted: true
			})}
			{@render row(PY0 + 60, 'Years so far', `${twoView.years.toFixed(1)} of ${TWO_YEARS}`)}
			{@render row(PY0 + 88, 'Closest to the Sun so far', `${f2(twoView.lo)} AU`)}
			{@render row(PY0 + 116, 'Farthest so far', `${f2(twoView.hi)} AU`)}
			{@render row(
				PY0 + 144,
				'Second planet',
				neighbour > 0 ? `${neighbour} × Jupiter, 1.6 AU` : 'none',
				'var(--orb-second)'
			)}
			{@render txt(CX + 16, PY0 + 176, `Replayed fast: 1 year ≈ ${TWO_SEC_PER_YEAR} s here`, 12, {
				muted: true
			})}
		{:else}
			{@render txt(
				CX + 16,
				PY0 + 28,
				phase === 'first' ? 'First law' : phase === 'second' ? 'Second law' : 'Your launch',
				15,
				{ weight: 700 }
			)}
			{@render row(PY0 + 58, 'Launch speed', `${KMS(speed * V1).toFixed(1)} km/s`)}
			{@render row(PY0 + 84, 'Speed now', `${KMS(vNow).toFixed(1)} km/s`, 'var(--orb-planet)')}
			{@render row(PY0 + 110, 'Path', kindText, undefined, 700)}
			{@render row(
				PY0 + 136,
				'Period',
				launch.bound ? `${launch.el.period.toFixed(launch.el.period < 10 ? 2 : 0)} years` : '—'
			)}
			{@render row(PY0 + 162, 'Perihelion', `${f2(launch.el.perihelion)} AU`)}
			{@render row(
				PY0 + 188,
				'Aphelion',
				launch.bound ? `${f2(launch.el.aphelion)} AU` : '— (never comes back)'
			)}
			{#if phase === 'second' && wedges.length}
				{@render txt(
					CX + 16,
					PY0 + 216,
					`Each wedge: ⅛ of the orbit, ${(launch.el.period / N_WEDGES).toFixed(3)} years`,
					12,
					{ muted: true }
				)}
			{/if}
			{@render txt(
				CX + 16,
				PY0 + cardH - 14,
				launch.long ? `${paceText} (sped up)` : paceText,
				12,
				{ muted: true }
			)}
		{/if}
	</g>

	<!-- below the card: the step's key fact -->
	{#if phase === 'first' && launch.bound && foci}
		<g opacity={fade.current}>
			<rect
				x={CX}
				y={PY0 + cardH + 16}
				width={CW}
				height="96"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(CX + 16, PY0 + cardH + 42, 'Distances to the two foci', 12.5, { muted: true })}
			<text
				x={CX + 16}
				y={PY0 + cardH + 72}
				class="halo"
				font-weight="700"
				style:font-size="18px"
				style:font-variant-numeric="tabular-nums"
				><tspan style:fill="var(--orb-star)">{f2(foci.d1)}</tspan> +
				<tspan style:fill="var(--orb-planet)">{f2(foci.d2)}</tspan>
				= {f2(foci.d1 + foci.d2)} AU</text
			>
			{@render txt(CX + 16, PY0 + cardH + 96, 'always the same: the long axis, 2a', 12, {
				muted: true
			})}
		</g>
	{:else if phase === 'second' && wedges.length}
		<g opacity={fade.current}>
			<rect
				x={CX}
				y={PY0 + cardH + 16}
				width={CW}
				height="110"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(CX + 16, PY0 + cardH + 42, 'Speed round the orbit', 12.5, { muted: true })}
			<rect x={bx} y={by} width={bw} height="8" rx="4" fill="var(--stage-line)" opacity="0.35" />
			<rect
				x={bx}
				y={by}
				width={Math.max(8, bw * Math.min(1, Math.max(0, u)))}
				height="8"
				rx="4"
				fill="var(--orb-planet)"
			/>
			{@render txt(bx, by + 30, `slowest ${KMS(speedRange.min).toFixed(1)}`, 12, { muted: true })}
			{@render txt(bx + bw, by + 30, `fastest ${KMS(speedRange.max).toFixed(1)} km/s`, 12, {
				anchor: 'end',
				muted: true
			})}
			{@render txt(bx, by + 50, 'at aphelion', 11, { muted: true })}
			{@render txt(bx + bw, by + 50, 'at perihelion', 11, { anchor: 'end', muted: true })}
		</g>
	{/if}

	<!-- status line under the cards -->
	{#if showOrbit && (status || (phase !== 'launch' && !launch.bound))}
		{@render txt(
			CX + CW / 2,
			statusY,
			phase !== 'launch' && !launch.bound
				? phase === 'first'
					? 'This speed escapes: no ellipse to show.'
					: 'This speed escapes: no orbit to divide.'
				: status,
			13.5,
			{ anchor: 'middle', weight: 600 }
		)}
		{#if phase !== 'launch' && !launch.bound}
			{@render txt(CX + CW / 2, statusY + 22, 'Choose under 42.1 km/s (√2 × 29.8)', 12, {
				anchor: 'middle',
				muted: true
			})}
		{/if}
	{/if}
	{#if phase === 'two' && twoView && twoView.hi > 2.2}
		{@render txt(CX + CW / 2, PY0 + cardH + 64, 'Flung out of the frame!', 13.5, {
			anchor: 'middle',
			weight: 600
		})}
	{/if}
</g>
