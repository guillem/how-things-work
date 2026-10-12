<script lang="ts">
	/**
	 * Light rays and probes round a black hole, traced with the model's geodesic
	 * tracer (`ray`, `flashRay`, `probe` in blackhole.ts) and replayed as a
	 * function of t. Space panel on the left, readouts on the right.
	 *
	 * Phases (`step.hints.phase`):
	 *   weak   — one ray passing at `params.bendB` r_s; the straight line it would
	 *            have followed, its outgoing direction and the angle, compared with
	 *            4GM/(c²b). The scale shrinks as the ray passes farther out.
	 *   light  — a ray aimed at `params.aim` r_s (a new one on every change or
	 *            "Fire"), the last few kept faded; the capture band (±2.6 r_s),
	 *            the photon sphere and the horizon.
	 *   sphere — one ray at `params.aimFine` r_s, near the critical 2.598 r_s:
	 *            the loops round the photon sphere, counted.
	 *   flash  — a lamp held at `params.lampR` r_s flashing 36 rays in every
	 *            direction; escaping and captured rays, and the escape cone.
	 *   probe  — a probe launched sideways at `params.probeR` r_s at
	 *            `params.probeK` × Newton's circular speed: its real path
	 *            (solid) and Newton's (dashed).
	 *   isco   — a probe on a circular orbit at `params.iscoR` r_s, 0.3% slow:
	 *            it stays outside 3 r_s and plunges inside it.
	 *
	 * Light moves at a constant pace on screen. Probes move at the pace of their
	 * own clocks (proper time). Replays restart when the controls change (the
	 * sanctioned restart memo, as in orbits-kepler's OrbitScene).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		B_CRIT,
		circularL,
		escapeCone,
		flashRay,
		newtonU,
		periapses,
		probe,
		ray,
		sidewaysL,
		type Fate,
		type Trace
	} from '../blackhole';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- layout -------------------------------------------------------------------
	const PX0 = 16;
	const PY0 = 16;
	const PX1 = 640;
	const PY1 = 584;
	const CX = 660; // readout card
	const CW = 284;
	const LIGHT_SPEED = 260; // px per second of animation
	const DEG = 180 / Math.PI;

	const phase = $derived(String(step.hints?.phase ?? 'light'));
	const num = (id: string, d: number) => Number(params[id] ?? d);
	const bendB = $derived(num('bendB', 8));
	const aim = $derived(num('aim', 3.5));
	// The critical aim (√27 GM/c² = B_CRIT/2 r_s), off by 10^−digits, inside or outside.
	const aimFine = $derived(
		B_CRIT / 2 + (params.aimInside ? -1 : 1) * Math.pow(10, -num('aimDigits', 4))
	);
	const aimDigits = $derived(num('aimDigits', 4));
	const lampR = $derived(num('lampR', 1.4));
	const probeR = $derived(num('probeR', 12));
	const probeK = $derived(num('probeK', 0.9));
	const iscoR = $derived(num('iscoR', 3.5));
	const fired = $derived(num('fire', 0));
	const launched = $derived(num('launch', 0));

	// ---- probes (computed first: their scale depends on the orbit) --------------------------
	const probeRun = $derived.by(() => {
		if (phase !== 'probe' && phase !== 'isco') return null;
		const r0 = phase === 'probe' ? 2 * probeR : 2 * iscoR;
		// The probe step launches at probeK × Newton's circular speed √(GM/r0), measured
		// on the spot; the same speed gives Newton's L = r0 v and the real L = r0 γ v.
		const v = probeK * Math.sqrt(1 / r0);
		const L = phase === 'probe' ? sidewaysL(r0, v) : circularL(r0) * 0.997;
		const LN = phase === 'probe' ? r0 * v : L;
		const pr = probe(r0, L, {
			maxSweep: phase === 'probe' ? 8 * Math.PI : 12 * Math.PI,
			dphi: 0.003
		});
		// Newton's path for the same launch: u = 1/L² + (1/r0 − 1/L²) cos φ.
		const newton: { x: number; y: number }[] = [];
		const p = 1 / (LN * LN);
		const ecc = Math.abs(1 / r0 - p) / p;
		for (let k = 0; k <= 360; k++) {
			const phi = (k / 360) * 2 * Math.PI;
			const u = newtonU(r0, LN, phi);
			if (u <= 1e-4) continue;
			newton.push({ x: Math.cos(phi) / u, y: Math.sin(phi) / u });
		}
		const nPeri = 1 / (p * (1 + ecc));
		const nApo = ecc < 1 ? 1 / (p * (1 - ecc)) : Infinity;
		let rmax = 0;
		let rmin = Infinity;
		for (let i = 0; i < pr.n; i++) {
			const r = 1 / pr.u[i];
			if (r > rmax) rmax = r;
			if (r < rmin) rmin = r;
		}
		// Turning of the closest point per orbit (bound orbits that complete one).
		const peris = periapses(pr);
		const startIsPeri = 1 / (L * L) + 3 / (r0 * r0) - 1 / r0 < 0;
		const all = startIsPeri ? [0, ...peris] : peris;
		const turn = all.length >= 2 ? all[1] - all[0] - 2 * Math.PI : NaN;
		return { r0, L, pr, newton, nPeri, nApo, ecc, rmax, rmin, turn };
	});
	const probeScale = $derived.by(() => {
		if (!probeRun) return 10;
		const { r0, nApo, rmax } = probeRun;
		const cap = 2.2 * r0;
		const reach = Math.max(r0, Math.min(nApo, cap), Math.min(rmax, cap));
		return Math.min(30, 262 / reach);
	});

	// ---- view: the hole's position and the scale (px per GM/c²) ----------------------------
	const view = $derived.by(() => {
		switch (phase) {
			case 'weak':
				return { cx: 300, cy: 380, S: Math.min(12, Math.max(1.6, 95 / bendB)) };
			case 'light':
				return { cx: 390, cy: 300, S: 18 };
			case 'sphere':
				return { cx: 380, cy: 300, S: 24 };
			case 'flash':
				return { cx: 328, cy: 350, S: Math.min(42, 125 / lampR) };
			case 'isco':
				return { cx: 328, cy: 300, S: 21 };
			default:
				return { cx: 328, cy: 300, S: probeScale };
		}
	});
	const cx = $derived(view.cx);
	const cy = $derived(view.cy);
	const S = $derived(view.S);

	// ---- polylines on screen ------------------------------------------------------------
	interface Line {
		X: number[];
		Y: number[];
		cum: number[];
		d: string;
		len: number;
	}
	const inBox = (X: number, Y: number, m = 0) =>
		X > PX0 - m && X < PX1 + m && Y > PY0 - m && Y < PY1 + m;

	/**
	 * Screen polyline of a traced path. `pos(r, φ)` gives model coordinates;
	 * points before the path enters the panel (rays from infinity) and after it
	 * leaves are dropped; points closer than 1.2 px are merged.
	 */
	function toLine(tr: Trace, pos: (r: number, phi: number) => { x: number; y: number }): Line {
		const X: number[] = [];
		const Y: number[] = [];
		const cum: number[] = [];
		let d = '';
		const push = (sx: number, sy: number, force: boolean) => {
			const n = X.length;
			if (n && !force && Math.hypot(sx - X[n - 1], sy - Y[n - 1]) < 1.2) return;
			cum.push(n ? cum[n - 1] + Math.hypot(sx - X[n - 1], sy - Y[n - 1]) : 0);
			X.push(sx);
			Y.push(sy);
			d += `${n ? 'L' : 'M'}${sx.toFixed(1)} ${sy.toFixed(1)}`;
		};
		let entered = false;
		for (let i = 0; i < tr.n; i++) {
			const u = tr.u[i];
			if (u <= 0) continue;
			const p = pos(1 / u, tr.phi[i]);
			const sx = cx + p.x * S;
			const sy = cy - p.y * S;
			const inside = inBox(sx, sy, 6);
			if (!entered) {
				if (!inside) continue;
				entered = true;
			} else if (!inside) {
				push(sx, sy, true); // leaving the panel: keep this point and stop
				break;
			}
			push(sx, sy, i === tr.n - 1);
		}
		return { X, Y, cum, d, len: cum.length ? cum[cum.length - 1] : 0 };
	}
	/** The point at arc length s along a line (clamped to its ends). */
	function pointAt(L: Line, s: number) {
		const n = L.X.length;
		if (n === 0) return { X: cx, Y: cy };
		if (s <= 0) return { X: L.X[0], Y: L.Y[0] };
		if (s >= L.len) return { X: L.X[n - 1], Y: L.Y[n - 1] };
		let lo = 0;
		let hi = n - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (L.cum[mid] <= s) lo = mid;
			else hi = mid;
		}
		const f = (s - L.cum[lo]) / (L.cum[hi] - L.cum[lo] || 1);
		return { X: L.X[lo] + (L.X[hi] - L.X[lo]) * f, Y: L.Y[lo] + (L.Y[hi] - L.Y[lo]) * f };
	}
	/** Light from the left at height b (model units): (−r cos φ, r sin φ). */
	const rayPos = (r: number, phi: number) => ({ x: -r * Math.cos(phi), y: r * Math.sin(phi) });

	interface Shot {
		b: number;
		tr: Trace;
		line: Line;
		fate: Fate;
		rmin: number;
	}
	function shoot(bRs: number): Shot {
		const b = 2 * bRs;
		const tr = ray(b, { maxSweep: 24 * Math.PI, dphi: 0.002 });
		let umax = 0;
		for (let i = 0; i < tr.n; i++) umax = Math.max(umax, tr.u[i]);
		return { b, tr, line: toLine(tr, rayPos), fate: tr.fate, rmin: 1 / umax };
	}

	// ---- time since the current shot ------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${bendB}|${aim}|${aimFine}|${lampR}|${probeR}|${probeK}|${iscoR}|${fired}|${launched}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return Math.max(0, t - memo.start);
	});

	const fade = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		void phase;
		untrack(() => {
			if (reduced) return;
			fade.set(0, { duration: 0 });
			fade.set(1);
		});
	});

	// ---- weak / light / sphere: the current ray ---------------------------------------------
	const current = $derived.by(() => {
		if (phase === 'weak') return shoot(bendB);
		if (phase === 'light') return shoot(aim);
		if (phase === 'sphere') return shoot(aimFine);
		return null;
	});
	/** Arc length travelled by the pulse; the replay holds 2 s at the end and repeats. */
	const travelled = $derived.by(() => {
		if (!current) return 0;
		const L = current.line.len;
		if (reduced) return L;
		const span = L / LIGHT_SPEED + 2;
		return Math.min(L, (since % span) * LIGHT_SPEED);
	});
	const pulse = $derived(current ? pointAt(current.line, travelled) : null);
	const arrived = $derived(current ? travelled >= current.line.len - 0.5 : false);

	// Rays kept on the `light` step: each press of "Fire" keeps the current aim,
	// drawn faded once the aim moves on (dragging the slider keeps nothing).
	// Depends only on params, never on t.
	let history = $state<{ key: number; b: number }[]>([]);
	let lastFired = 0;
	let counter = 0;
	$effect(() => {
		const f = fired;
		const b = aim;
		if (phase !== 'light') return;
		untrack(() => {
			if (f === lastFired) return;
			lastFired = f;
			if (history.some((h) => h.b === b)) return;
			history = [...history, { key: counter++, b }].slice(-6);
		});
	});
	const ghosts = $derived(
		phase === 'light'
			? history.filter((h) => h.b !== aim).map((h) => ({ key: h.key, s: shoot(h.b) }))
			: []
	);

	const loops = $derived(current ? Math.max(0, (current.tr.sweep - Math.PI) / (2 * Math.PI)) : 0);
	const bendAngle = $derived(
		current && current.fate === 'escaped' ? current.tr.sweep - Math.PI : NaN
	);

	/** weak: where the outgoing straight line meets the incoming one, and the exit point. */
	const weakGeo = $derived.by(() => {
		if (phase !== 'weak' || !current) return null;
		const Y0 = cy - current.b * S;
		const L = current.line;
		const n = L.X.length;
		if (n < 2 || !Number.isFinite(bendAngle)) return null;
		const ex = L.X[n - 1];
		const ey = L.Y[n - 1];
		// Outgoing direction on screen: right and down by the bending angle.
		const k = (ey - Y0) / Math.sin(bendAngle);
		const vx = ex - k * Math.cos(bendAngle);
		return { Y0, vx, ex, ey };
	});

	// ---- flash -------------------------------------------------------------------------------
	const N_FLASH = 36;
	const flash = $derived.by(() => {
		if (phase !== 'flash') return null;
		const r0 = 2 * lampR;
		const half = N_FLASH / 2;
		const rays: { k: number; line: Line; fate: Fate }[] = [];
		for (let k = 0; k < N_FLASH; k++) {
			const side = k < half ? 1 : -1;
			const psi = (((k % half) + 0.5) / half) * Math.PI;
			const tr = flashRay(r0, psi, { maxSweep: 6 * Math.PI, rMax: 400 });
			// Lamp straight above the hole; rightward rays go clockwise (θ falls).
			const line = toLine(tr, (r, phi) => {
				const th = Math.PI / 2 - side * phi;
				return { x: r * Math.cos(th), y: r * Math.sin(th) };
			});
			rays.push({ k, line, fate: tr.fate });
		}
		return { r0, rays, cone: escapeCone(r0) };
	});
	const FLASH_PERIOD = 4.5;
	const flashS = $derived(reduced ? 4000 : (since % FLASH_PERIOD) * LIGHT_SPEED * 0.8);
	const lamp = $derived(flash ? { X: cx, Y: cy - flash.r0 * S } : null);
	/** Share of all directions (the whole sky round the lamp, not just this plane) that escape. */
	const skyShare = $derived(flash ? (1 - Math.cos(flash.cone)) / 2 : 0);
	const coneWedge = $derived.by(() => {
		if (!flash || !lamp) return '';
		const R = 64;
		const a = flash.cone;
		if (a <= 0.002) return '';
		// Around straight up (−y on screen), ±a.
		const p = (ang: number) =>
			`${(lamp.X + R * Math.sin(ang)).toFixed(1)} ${(lamp.Y - R * Math.cos(ang)).toFixed(1)}`;
		const large = a > Math.PI / 2 ? 1 : 0;
		return `M${lamp.X} ${lamp.Y} L${p(-a)} A${R} ${R} 0 ${large} 1 ${p(a)} Z`;
	});

	// ---- probe replay ----------------------------------------------------------------------
	const probeLine = $derived(
		probeRun
			? toLine(probeRun.pr, (r, phi) => ({ x: r * Math.cos(phi), y: r * Math.sin(phi) }))
			: null
	);
	const newtonD = $derived.by(() => {
		if (!probeRun) return '';
		let d = '';
		let pen = false;
		for (const q of probeRun.newton) {
			const X = cx + q.x * S;
			const Y = cy - q.y * S;
			if (!inBox(X, Y, 40)) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`;
			pen = true;
		}
		return d;
	});
	/** Sample index of the probe now: one Newton orbit of the launch radius ≈ 5 s. */
	/** Last sample worth replaying: where the path leaves the panel, or its end. */
	const probeLast = $derived.by(() => {
		if (!probeRun) return 0;
		const { pr } = probeRun;
		for (let i = 0; i < pr.n; i++) {
			const r = 1 / pr.u[i];
			if (!inBox(cx + r * Math.cos(pr.phi[i]) * S, cy - r * Math.sin(pr.phi[i]) * S, 10)) return i;
		}
		return pr.n - 1;
	});
	const probeIndex = $derived.by(() => {
		if (!probeRun) return 0;
		const { pr, r0 } = probeRun;
		const last = probeLast;
		if (reduced) return last;
		const k = (phase === 'isco' ? 4 : 5) / (2 * Math.PI * Math.pow(r0, 1.5));
		const total = pr.tau[last] * k;
		const s = Math.min(total, since % (total + 2.5)) / k;
		if (s >= pr.tau[last]) return last;
		let lo = 0;
		let hi = last;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (pr.tau[mid] <= s) lo = mid;
			else hi = mid;
		}
		return lo;
	});
	const probeNow = $derived.by(() => {
		if (!probeRun) return null;
		const { pr } = probeRun;
		const i = probeIndex;
		const r = 1 / pr.u[i];
		const phi = pr.phi[i];
		const X = cx + r * Math.cos(phi) * S;
		const Y = cy - r * Math.sin(phi) * S;
		return { X, Y, r, phi, end: i >= pr.n - 1 };
	});
	/** Arc length on screen up to each sample of the probe's path (for the trail). */
	const probeCum = $derived.by(() => {
		if (!probeRun) return new Float64Array(0);
		const { pr } = probeRun;
		const cum = new Float64Array(pr.n);
		for (let i = 1; i < pr.n; i++) {
			const r0 = 1 / pr.u[i - 1];
			const r1 = 1 / pr.u[i];
			const dx = r1 * Math.cos(pr.phi[i]) - r0 * Math.cos(pr.phi[i - 1]);
			const dy = r1 * Math.sin(pr.phi[i]) - r0 * Math.sin(pr.phi[i - 1]);
			cum[i] = cum[i - 1] + Math.hypot(dx, dy) * S;
		}
		return cum;
	});
	const probeTrail = $derived(probeCum[probeIndex] ?? 0);

	// ---- text ---------------------------------------------------------------------------------
	const fateText = (s: Shot) => {
		if (s.fate === 'captured') return 'falls into the hole';
		if (s.fate === 'orbiting') return 'still circling…';
		const a = (s.tr.sweep - Math.PI) * DEG;
		return `flies on, bent ${a < 10 ? a.toFixed(1) : a.toFixed(0)}°`;
	};
	const probeFate = $derived.by(() => {
		if (!probeRun) return '';
		const f = probeRun.pr.fate;
		if (f === 'captured') return 'falls into the hole';
		if (f === 'escaped') return 'flies off for good';
		return 'stays in orbit';
	});
	const newtonFate = $derived.by(() => {
		if (!probeRun) return '';
		if (probeRun.ecc >= 1) return 'escapes';
		if (probeRun.ecc < 0.002) return 'a circle';
		return 'a closed ellipse';
	});
	const showSphere = $derived(phase !== 'weak');
	const rayColor = (f: Fate) => (f === 'captured' ? 'var(--bh-captured)' : 'var(--bh-light)');
</script>

{#snippet row(y: number, label: string, value: string, color?: string)}
	<T x={CX + 16} {y} text={label} size={12.5} muted />
	<T x={CX + CW - 16} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
{/snippet}

<g>
	<defs>
		<clipPath id="rays-clip">
			<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="14" />
		</clipPath>
		<radialGradient id="rays-pulse">
			<stop offset="0" style:stop-color="var(--bh-light)" stop-opacity="1" />
			<stop offset="1" style:stop-color="var(--bh-light)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--bh-space)"
		stroke="var(--border)"
	/>

	<g clip-path="url(#rays-clip)">
		<!-- capture band: aim inside it and the light falls in -->
		{#if phase === 'light'}
			<rect
				x={PX0}
				y={cy - B_CRIT * S}
				width={cx - PX0}
				height={2 * B_CRIT * S}
				fill="var(--bh-captured)"
				opacity="0.07"
			/>
			{#each [-1, 1] as sgn (sgn)}
				<line
					x1={PX0}
					x2={cx}
					y1={cy + sgn * B_CRIT * S}
					y2={cy + sgn * B_CRIT * S}
					stroke="var(--bh-captured)"
					stroke-dasharray="5 5"
					opacity="0.6"
				/>
			{/each}
		{/if}

		<!-- the straight path the light would follow without the mass (weak) -->
		{#if weakGeo}
			<line
				x1={PX0}
				x2={PX1}
				y1={weakGeo.Y0}
				y2={weakGeo.Y0}
				stroke="var(--bh-newton)"
				stroke-dasharray="5 6"
				opacity="0.6"
			/>
		{/if}

		<!-- last stable orbit and photon sphere -->
		{#if phase === 'isco' || phase === 'probe'}
			<circle
				{cx}
				{cy}
				r={6 * S}
				fill="none"
				stroke="var(--bh-isco)"
				stroke-width="1.3"
				stroke-dasharray="6 5"
				opacity={phase === 'isco' ? 0.9 : 0.55}
			/>
		{/if}
		{#if showSphere}
			<circle
				{cx}
				{cy}
				r={3 * S}
				fill="none"
				stroke="var(--bh-sphere)"
				stroke-width="1.3"
				stroke-dasharray="3 4"
				opacity={phase === 'sphere' || phase === 'flash' ? 0.95 : 0.6}
			/>
		{/if}

		<!-- flash: the escape cone, then every ray up to the wavefront -->
		{#if flash && lamp}
			{#if coneWedge}
				<path d={coneWedge} fill="var(--bh-light)" opacity="0.2" />
			{/if}
			{#each flash.rays as r (r.k)}
				<path
					d={r.line.d}
					fill="none"
					stroke={rayColor(r.fate)}
					stroke-width="1.6"
					stroke-dasharray="{Math.min(flashS, r.line.len + 1).toFixed(1)} 100000"
					opacity="0.85"
				/>
				{#if flashS < r.line.len}
					{@const p = pointAt(r.line, flashS)}
					<circle cx={p.X} cy={p.Y} r="2.6" fill={rayColor(r.fate)} />
				{/if}
			{/each}
		{/if}

		<!-- earlier shots (light) -->
		{#each ghosts as g (g.key)}
			<path
				d={g.s.line.d}
				fill="none"
				stroke={rayColor(g.s.fate)}
				stroke-width="1.5"
				opacity="0.35"
			/>
		{/each}

		<!-- the current ray -->
		{#if current && pulse}
			<path
				d={current.line.d}
				fill="none"
				stroke={rayColor(current.fate)}
				stroke-width="2.6"
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke-dasharray="{travelled.toFixed(1)} 100000"
			/>
			{#if !arrived}
				<circle cx={pulse.X} cy={pulse.Y} r="12" fill="url(#rays-pulse)" opacity="0.8" />
				<circle cx={pulse.X} cy={pulse.Y} r="4" fill="var(--bh-light)" />
			{/if}
		{/if}

		<!-- weak: the outgoing straight line, back to where it meets the straight path -->
		{#if weakGeo && arrived}
			<line
				x1={weakGeo.vx}
				y1={weakGeo.Y0}
				x2={weakGeo.ex}
				y2={weakGeo.ey}
				stroke="var(--bh-light)"
				stroke-width="1.2"
				stroke-dasharray="2 4"
			/>
		{/if}

		<!-- probes: Newton's path dashed, the real one solid -->
		{#if probeRun && probeLine && probeNow}
			<path
				d={phase === 'probe' ? newtonD : ''}
				fill="none"
				stroke="var(--bh-newton)"
				stroke-width="1.4"
				stroke-dasharray="6 6"
				opacity="0.75"
			/>
			<path
				d={probeLine.d}
				fill="none"
				stroke="var(--bh-probe)"
				stroke-width="2.2"
				stroke-linejoin="round"
				stroke-dasharray="{probeTrail.toFixed(1)} 100000"
			/>
			<line
				x1={cx + probeRun.r0 * S}
				y1={cy}
				x2={cx + probeRun.r0 * S}
				y2={cy - 34}
				stroke="var(--stage-ink)"
				stroke-width="1.6"
				marker-end="url(#arrowhead)"
				opacity="0.6"
			/>
			{#if !(probeNow.end && probeRun.pr.fate === 'captured')}
				<circle
					cx={probeNow.X}
					cy={probeNow.Y}
					r="6"
					fill="var(--bh-probe)"
					stroke="var(--bh-space)"
					stroke-width="1.5"
				/>
			{/if}
		{/if}

		<!-- the hole -->
		<circle
			{cx}
			{cy}
			r={2 * S}
			fill="var(--bh-hole)"
			stroke="var(--bh-horizon)"
			stroke-width="1.2"
		/>

		{#if lamp}
			<circle
				cx={lamp.X}
				cy={lamp.Y}
				r="6"
				fill="var(--bh-light)"
				stroke="var(--bh-space)"
				stroke-width="1.5"
			/>
		{/if}
	</g>

	<!-- ---- labels on the drawing ---- -->
	<g opacity={fade.current}>
		{#if 2 * S > 30}
			<!-- on the dark hole itself: no halo -->
			<text
				x={cx}
				y={cy + 4}
				text-anchor="middle"
				style:font-size="12px"
				style:fill="var(--bh-on-hole)"
				style:pointer-events="none">horizon</text
			>
		{:else}
			<T
				x={cx}
				y={cy + 2 * S + 18}
				text={phase === 'weak' ? 'a compact mass' : 'black hole'}
				size={12}
				anchor="middle"
				muted
			/>
		{/if}
		{#if phase === 'light' || phase === 'sphere'}
			<T
				x={cx}
				y={cy + 3 * S + 16}
				text="photon sphere 1.5 rₛ"
				size={11.5}
				color="var(--bh-sphere)"
				weight={600}
				anchor="middle"
			/>
		{/if}
		{#if phase === 'light'}
			<T
				x={PX0 + 12}
				y={cy - B_CRIT * S - 8}
				text="aim inside this band: captured"
				size={11.5}
				color="var(--bh-captured)"
				weight={600}
			/>
			<T
				x={PX0 + 12}
				y={cy + B_CRIT * S + 18}
				text="2.6 rₛ either side"
				size={11.5}
				color="var(--bh-captured)"
			/>
		{/if}
		{#if weakGeo}
			<T x={PX0 + 12} y={weakGeo.Y0 - 8} text="the straight path" size={11.5} muted />
			{#if arrived}
				<T
					x={Math.min(PX1 - 12, weakGeo.ex - 6)}
					y={Math.min(PY1 - 10, weakGeo.ey + 24)}
					text="bent {(bendAngle * DEG).toFixed(1)}°"
					size={13}
					weight={700}
					anchor="end"
					color="var(--bh-light)"
				/>
			{/if}
		{/if}
		{#if flash && lamp}
			<T x={lamp.X + 12} y={lamp.Y + 16} text="lamp" size={12} weight={600} />
			{#if flash.cone > 0.002}
				<T
					x={lamp.X}
					y={Math.max(PY0 + 16, lamp.Y - 72)}
					text="escape cone"
					size={11.5}
					anchor="middle"
					color="var(--bh-light)"
					weight={600}
				/>
			{/if}
		{/if}
	</g>

	<!-- ---- readout cards ---- -->
	{#if phase === 'weak' && current}
		<Card x={CX} y={PY0} w={CW} h={196} />
		<T x={CX + 16} y={PY0 + 28} text="Light passing a mass" size={15} weight={700} />
		{@render row(PY0 + 60, 'Passes at', `${bendB.toFixed(1)} rₛ`)}
		{@render row(PY0 + 88, 'Bend (traced)', `${(bendAngle * DEG).toFixed(2)}°`, 'var(--bh-light)')}
		{@render row(PY0 + 116, 'Einstein’s 4GM/(c²b)', `${((2 / bendB) * DEG).toFixed(2)}°`)}
		{@render row(PY0 + 144, 'Light as a bullet', `${((1 / bendB) * DEG).toFixed(2)}°`)}
		<T x={CX + 16} y={PY0 + 176} text="Close in, the real bend grows faster." size={12} muted />
		<Card x={CX} y={PY0 + 212} w={CW} h={112} />
		<T x={CX + 16} y={PY0 + 240} text="The Sun, 1919" size={14} weight={700} />
		<T x={CX + 16} y={PY0 + 262} text="Grazing its edge (236 000 rₛ):" size={12.5} />
		<T
			x={CX + 16}
			y={PY0 + 284}
			text="predicted 1.75″, measured 1.98″ ± 0.12″"
			size={12.5}
			weight={600}
		/>
		<T x={CX + 16} y={PY0 + 306} text="as a bullet: 0.88″" size={12.5} muted />
	{:else if (phase === 'light' || phase === 'sphere') && current}
		<Card x={CX} y={PY0} w={CW} h={phase === 'sphere' ? 196 : 170} />
		<T
			x={CX + 16}
			y={PY0 + 28}
			text={phase === 'sphere' ? 'Near the knife edge' : 'Your light ray'}
			size={15}
			weight={700}
		/>
		{@render row(
			PY0 + 60,
			'Aim',
			`${(current.b / 2).toFixed(phase === 'sphere' ? Math.min(11, aimDigits + 1) : 2)} rₛ`
		)}
		{@render row(
			PY0 + 88,
			'Closest to the centre',
			current.fate === 'captured' ? 'crosses the horizon' : `${(current.rmin / 2).toFixed(2)} rₛ`
		)}
		{#if phase === 'sphere'}
			{@render row(PY0 + 116, 'Times round the hole', loops.toFixed(1))}
			{@render row(
				PY0 + 144,
				'Then',
				current.fate === 'captured'
					? 'falls in'
					: current.fate === 'escaped'
						? 'escapes'
						: 'still circling',
				rayColor(current.fate)
			)}
			<T x={CX + 16} y={PY0 + 176} text="Critical aim: 2.598 076 211… rₛ" size={12} muted />
		{:else}
			{@render row(PY0 + 116, 'Fate', fateText(current), rayColor(current.fate))}
			<T x={CX + 16} y={PY0 + 150} text="Captured if aimed inside 2.6 rₛ" size={12} muted />
		{/if}
		<Card x={CX} y={PY1 - 124} w={CW} h={124} />
		<T x={CX + 16} y={PY1 - 98} text="Distances in rₛ = 2GM/c²," size={12.5} weight={600} />
		<T x={CX + 16} y={PY1 - 78} text="the radius of the horizon:" size={12.5} weight={600} />
		<T x={CX + 16} y={PY1 - 56} text="3 km for the Sun’s mass" size={12.5} muted />
		<T x={CX + 16} y={PY1 - 36} text="9 mm for the Earth’s" size={12.5} muted />
		<T x={CX + 16} y={PY1 - 16} text="12 million km for Sgr A*" size={12.5} muted />
	{:else if flash}
		<Card x={CX} y={PY0} w={CW} h={170} />
		<T x={CX + 16} y={PY0 + 28} text="A lamp held still" size={15} weight={700} />
		{@render row(PY0 + 60, 'Height', `${lampR.toFixed(2)} rₛ`)}
		{@render row(
			PY0 + 88,
			'Light that escapes',
			`${(skyShare * 100).toFixed(0)}%`,
			'var(--bh-light)'
		)}
		{@render row(
			PY0 + 116,
			'Light that falls in',
			`${(100 - Number((skyShare * 100).toFixed(0))).toFixed(0)}%`,
			'var(--bh-captured)'
		)}
		<T x={CX + 16} y={PY0 + 150} text="Half the sky at 1.5 rₛ; none at 1 rₛ" size={12} muted />
		<Card x={CX} y={PY1 - 116} w={CW} h={116} />
		<T x={CX + 16} y={PY1 - 90} text="Inside the horizon" size={13.5} weight={700} />
		<T x={CX + 16} y={PY1 - 68} text="every direction, even light’s," size={12.5} />
		<T x={CX + 16} y={PY1 - 48} text="leads further in. There is no" size={12.5} />
		<T x={CX + 16} y={PY1 - 28} text="way out to aim for." size={12.5} />
	{:else if probeRun}
		<Card x={CX} y={PY0} w={CW} h={phase === 'isco' ? 170 : 226} />
		<T
			x={CX + 16}
			y={PY0 + 28}
			text={phase === 'isco' ? 'A circular orbit, nudged' : 'Your probe'}
			size={15}
			weight={700}
		/>
		{#if phase === 'probe'}
			{@render row(PY0 + 60, 'Launched at', `${probeR.toFixed(1)} rₛ`)}
			{@render row(
				PY0 + 88,
				'Real path',
				probeFate,
				probeRun.pr.fate === 'captured' ? 'var(--bh-captured)' : 'var(--bh-probe)'
			)}
			{@render row(PY0 + 116, 'Newton’s path', newtonFate)}
			{@render row(
				PY0 + 144,
				'Closest (real)',
				probeRun.pr.fate === 'captured' ? 'the horizon' : `${(probeRun.rmin / 2).toFixed(2)} rₛ`
			)}
			{@render row(PY0 + 172, 'Closest (Newton)', `${(probeRun.nPeri / 2).toFixed(2)} rₛ`)}
			{@render row(
				PY0 + 200,
				'Closest point turns',
				Number.isFinite(probeRun.turn) ? `${(probeRun.turn * DEG).toFixed(0)}° per orbit` : '—'
			)}
		{:else}
			{@render row(PY0 + 60, 'Radius', `${iscoR.toFixed(2)} rₛ`)}
			{@render row(PY0 + 88, 'Speed', '0.3% below a circle')}
			{@render row(
				PY0 + 116,
				'Result',
				probeFate,
				probeRun.pr.fate === 'captured' ? 'var(--bh-captured)' : 'var(--bh-isco)'
			)}
			<T
				x={CX + 16}
				y={PY0 + 150}
				text={iscoR < 3
					? 'Inside 3 rₛ: no nudge is small enough'
					: probeRun.pr.fate === 'captured'
						? 'Just outside 3 rₛ: needs a gentler nudge'
						: 'Outside 3 rₛ: stable'}
				size={12}
				muted
			/>
		{/if}
		<Card x={CX} y={PY1 - 140} w={CW} h={140} />
		{#snippet key(y: number, color: string, dash: string, text: string, muted = false)}
			<line
				x1={CX + 16}
				x2={CX + 44}
				y1={y - 4}
				y2={y - 4}
				stroke={color}
				stroke-width={dash ? 1.6 : 2.4}
				stroke-dasharray={dash}
			/>
			<T x={CX + 54} {y} {text} size={12.5} {muted} />
		{/snippet}
		{@render key(PY1 - 112, 'var(--bh-probe)', '', 'the real path')}
		{#if phase === 'probe'}
			{@render key(PY1 - 90, 'var(--bh-newton)', '6 6', 'Newton’s prediction')}
		{/if}
		{@render key(
			phase === 'probe' ? PY1 - 68 : PY1 - 90,
			'var(--bh-isco)',
			'6 5',
			'last stable orbit, 3 rₛ'
		)}
		{@render key(
			phase === 'probe' ? PY1 - 46 : PY1 - 68,
			'var(--bh-sphere)',
			'3 4',
			'photon sphere, 1.5 rₛ'
		)}
		<T x={CX + 16} y={PY1 - 18} text="Paced by the probe’s own clock" size={12} muted />
	{/if}
</g>
