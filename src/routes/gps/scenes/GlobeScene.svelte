<script lang="ts">
	/**
	 * The real constellation round the Earth, from the almanac (`model.constellation`).
	 *
	 * Phases (`step.hints.phase`):
	 *   orbits  — the six orbital rings and 32 satellites, time running at 10 minutes a second
	 *             from `params.hour`; lines to the satellites above the receiver's horizon
	 *   fix     — time frozen at `params.hour`; the receiver uses its `params.used` highest
	 *             satellites with its clock off by `params.clockErr` ms, and the least-squares
	 *             guesses (from the centre of the Earth) appear one per second
	 *   summary — like orbits, with the solved fix and its dilution of precision
	 *
	 * The camera turns with the Earth, so the receiver stays in view and the orbit rings turn
	 * slowly past (they are fixed in space). The Earth and the orbits are to scale.
	 */
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ALMANAC } from '../almanac';
	import {
		C,
		R_EARTH,
		constellation,
		dop,
		earthAngle,
		geodeticToEcef,
		norm,
		period,
		pseudoranges,
		satellite,
		solve,
		sub,
		visible,
		type Vec
	} from '../model';
	import { placeById } from '../places';
	import { clockTime } from '../steps';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'orbits'));
	const where = $derived(placeById(params.place));
	const hour = $derived(Number(params.hour ?? 0));
	const running = $derived(phase !== 'fix' && !reduced);
	/** Seconds after the almanac's epoch: 10 minutes of orbit per second of animation. */
	const tk = $derived(hour * 3600 + (running ? t * 600 : 0));

	// ---- camera ------------------------------------------------------------------------------
	const GX = 316;
	const GY = 300;
	const K = 268 / 26_560e3; // stage units per metre
	const rad = (d: number) => (d * Math.PI) / 180;
	/**
	 * Camera direction in the space-fixed frame, turning with the Earth: 40° west of the
	 * receiver and a little below it, so the receiver sits off the middle of the disc and its
	 * lines visibly leave the surface, not the centre.
	 */
	const cam = $derived.by(() => {
		const lam = rad(where.lon - 40) + earthAngle(tk);
		const phi = rad(Math.max(-40, Math.min(40, where.lat - 18)));
		const view = [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
		const right = [-Math.sin(lam), Math.cos(lam), 0];
		const up = [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)];
		return { view, right, up };
	});
	const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	interface P {
		x: number;
		y: number;
		z: number;
	}
	/** Space-fixed position (m) → stage point, with depth z (> 0 towards the viewer). */
	const project = (p: Vec): P => ({
		x: GX + K * dot(p, cam.right),
		y: GY - K * dot(p, cam.up),
		z: dot(p, cam.view)
	});
	/** Earth-fixed → space-fixed at time tk. */
	const toEci = (p: Vec): Vec => {
		const a = earthAngle(tk);
		return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
	};
	const RE = R_EARTH * K;
	/** Hidden behind the Earth's disc. */
	const hidden = (p: P) => p.z < 0 && Math.hypot(p.x - GX, p.y - GY) < RE;

	// ---- orbits: one satellite per plane traces its ring -------------------------------------------
	const planes = (() => {
		const deg = (s: (typeof ALMANAC)[number]) => ((((s.omega0 * 180) / Math.PI) % 360) + 360) % 360;
		const seen: number[] = [];
		const reps: (typeof ALMANAC)[number][] = [];
		for (const s of ALMANAC) {
			const d = deg(s);
			if (seen.some((x) => Math.abs(((d - x + 540) % 360) - 180) < 25)) continue;
			seen.push(d);
			reps.push(s);
		}
		return reps;
	})();
	const rings = $derived(
		planes.map((s) => {
			const T = period(s.sqrtA ** 2);
			return Array.from({ length: 73 }, (_, j) =>
				project(satellite(s, hour * 3600 + (j * T) / 72).eci)
			);
		})
	);
	const ringPath = (pts: P[], front: boolean) => {
		let d = '';
		let pen = false;
		for (const p of pts) {
			if (p.z > 0 !== front) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
			pen = true;
		}
		return d;
	};

	// ---- a graticule on the Earth: the equator and meridians every 30° (front side only) ---------
	const graticule = $derived.by(() => {
		const lines: Vec[][] = [];
		lines.push(Array.from({ length: 73 }, (_, j) => geodeticToEcef(0, j * 5)));
		for (const la of [-60, -30, 30, 60])
			lines.push(Array.from({ length: 73 }, (_, j) => geodeticToEcef(la, j * 5)));
		for (let lo = 0; lo < 360; lo += 30)
			lines.push(Array.from({ length: 37 }, (_, j) => geodeticToEcef(-90 + j * 5, lo)));
		return lines.map((l) =>
			ringPath(
				l.map((p) => project(toEci(p))),
				true
			)
		);
	});

	// ---- satellites and the receiver --------------------------------------------------------------
	const sats = $derived(constellation(tk));
	const inView = $derived(visible(sats, where.lat, where.lon));
	const inViewSet = $derived(new Set(inView.map((s) => s.prn)));
	const drawn = $derived(
		sats.map((s) => ({ prn: s.prn, p: project(s.eci), up: inViewSet.has(s.prn) }))
	);
	const rxEcef = $derived(geodeticToEcef(where.lat, where.lon));
	const rx = $derived(project(toEci(rxEcef)));

	// ---- the fix ------------------------------------------------------------------------------------
	const nUsed = $derived(
		phase === 'fix' ? Math.max(3, Math.min(inView.length, Number(params.used ?? 4))) : inView.length
	);
	const usedSats = $derived([...inView].sort((a, b) => b.elevation - a.elevation).slice(0, nUsed));
	const usedSet = $derived(new Set(usedSats.map((s) => s.prn)));
	const clock = $derived(phase === 'fix' ? Number(params.clockErr ?? 0) * 1e-3 * C : 0);
	const fix = $derived(
		solve(
			usedSats.map((s) => s.ecef),
			pseudoranges(
				usedSats.map((s) => s.ecef),
				rxEcef,
				clock
			)
		)
	);
	const D = $derived(dop(usedSats));
	/** Guesses shown so far (one a second, then a pause, again). */
	const shownIters = $derived.by(() => {
		if (!fix) return 0;
		const n = path.length;
		if (reduced || phase !== 'fix') return n;
		const T = n + 4;
		return Math.min(n, Math.floor(cycle(t, T) * T) + 1);
	});
	// The last steps change nothing that shows: stop the list at the first exact guess.
	const path = $derived.by(() => {
		if (!fix) return [];
		const k = fix.path.findIndex((g) => norm(sub(g.pos, rxEcef)) < 1e-4);
		return k < 0 ? fix.path : fix.path.slice(0, k + 1);
	});
	const guesses = $derived(
		fix
			? path.slice(0, shownIters).map((g) => ({
					p: project(toEci(g.pos)),
					off: norm(sub(g.pos, rxEcef)),
					clock: g.clock
				}))
			: []
	);
	const last = $derived(guesses[guesses.length - 1]);

	const offText = (m: number) =>
		m >= 1000
			? `${Math.round(m / 1000).toLocaleString('en-US')} km off`
			: m >= 0.01
				? `${m.toFixed(2)} m off`
				: m >= 1e-4
					? `${(m * 1000).toFixed(1)} mm off`
					: 'exact';
	const signedMs = (m: number) => {
		const v = (m / C) * 1e3;
		return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)} ms`;
	};

	const PX = 640;
	const PW = 304;
	const PY = 16;
	const PH = 568;
</script>

<g>
	<!-- rings and satellites behind the Earth -->
	{#each rings as r, i (i)}
		<path
			d={ringPath(r, false)}
			fill="none"
			stroke="var(--gps-orbit)"
			stroke-width="1"
			opacity="0.6"
		/>
	{/each}
	{#each drawn as s (s.prn)}
		{#if s.p.z <= 0 && !hidden(s.p)}
			<circle cx={s.p.x} cy={s.p.y} r="3.5" fill="var(--gps-sat)" opacity="0.45" />
		{/if}
	{/each}

	<!-- the Earth, to scale -->
	<circle cx={GX} cy={GY} r={RE} fill="var(--gps-ocean)" stroke="var(--gps-ocean-edge)" />
	{#each graticule as d, i (i)}
		<path
			{d}
			fill="none"
			stroke="var(--gps-ocean-edge)"
			stroke-width={i === 0 ? 1 : 0.6}
			opacity="0.55"
		/>
	{/each}
	<circle
		cx={rx.x}
		cy={rx.y}
		r="5"
		fill="var(--gps-rx)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<!-- lines to the satellites in view (or in use) -->
	{#each inView as s (s.prn)}
		{@const p = project(s.eci)}
		{@const use = usedSet.has(s.prn)}
		<path
			d="M{rx.x} {rx.y}L{p.x} {p.y}"
			stroke={use ? 'var(--gps-rx)' : 'var(--stage-ink-muted)'}
			stroke-width={use ? 1.6 : 1}
			stroke-dasharray={use ? '' : '3 4'}
			opacity={use ? 0.85 : 0.5}
		/>
	{/each}

	<!-- rings and satellites in front -->
	{#each rings as r, i (i)}
		<path d={ringPath(r, true)} fill="none" stroke="var(--gps-orbit)" stroke-width="1.3" />
	{/each}
	{#each drawn as s (s.prn)}
		{#if s.p.z > 0}
			<circle
				cx={s.p.x}
				cy={s.p.y}
				r={s.up ? 5.5 : 4}
				fill={usedSet.has(s.prn) ? 'var(--gps-rx)' : 'var(--gps-sat)'}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
				opacity={s.up ? 1 : 0.7}
			/>
		{/if}
	{/each}
	{#each inView as s (s.prn)}
		{#if usedSet.has(s.prn)}
			{@const p = project(s.eci)}
			{#if p.z <= 0 && !hidden(p)}
				<circle cx={p.x} cy={p.y} r="5.5" fill="var(--gps-rx)" stroke="var(--stage-bg)" />
			{/if}
		{/if}
	{/each}

	{#if phase === 'summary' && fix}
		<circle cx={rx.x} cy={rx.y} r="10" fill="none" stroke="var(--gps-fix)" stroke-width="2.5" />
	{/if}

	<!-- the guesses of the least-squares fix -->
	{#if phase === 'fix'}
		{#each guesses as g, i (i)}
			{#if i > 0}
				{@const a = guesses[i - 1].p}
				<path
					d="M{a.x} {a.y}L{g.p.x} {g.p.y}"
					stroke="var(--gps-fix)"
					stroke-width="1.5"
					stroke-dasharray="3 3"
				/>
			{/if}
			<circle
				cx={g.p.x}
				cy={g.p.y}
				r="3.5"
				fill="var(--gps-fix)"
				opacity={i === guesses.length - 1 ? 1 : 0.5}
			/>
		{/each}
		{#if last}
			<circle
				cx={last.p.x}
				cy={last.p.y}
				r="9"
				fill="none"
				stroke="var(--gps-fix)"
				stroke-width="2"
			/>
		{/if}
	{/if}

	<Readout id="rx-label">
		<Label x={rx.x} y={rx.y - 12} text={where.name.split(',')[0]} size={12} color="var(--gps-rx)" />
	</Readout>
	<Readout id="scale-note">
		<Label x={GX} y={584} text="Earth and orbits to scale · satellites not" size={11} muted />
	</Readout>

	<!-- panel -->
	<Readout id="panel">
		<rect
			x={PX}
			y={PY}
			width={PW}
			height={PH}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout id="time" order={0} label="Time (GPS)" value={clockTime(tk / 3600)}>
		<text x={PX + 18} y={52} class="muted" style:font-size="12px">Time (GPS)</text>
		<text x={PX + 18} y={74} style:font-size="15px" font-weight="600">{clockTime(tk / 3600)}</text>
	</Readout>
	<Readout
		id="inview"
		order={1}
		label="Satellites in view"
		value="{inView.length} of {sats.length}"
	>
		<text x={PX + 18} y={110} class="muted" style:font-size="12px"
			>Satellites above 10° from {where.name.split(',')[0]}</text
		>
		<text x={PX + 18} y={134} style:font-size="16px" font-weight="600"
			>{inView.length} of {sats.length}</text
		>
	</Readout>

	{#if phase === 'orbits'}
		<Readout id="orbit" order={2} label="Orbits" value="20 200 km up, 55°, every 11 h 58 min">
			<text x={PX + 18} y={172} class="muted" style:font-size="12px">Orbits</text>
			<text x={PX + 18} y={194} style:font-size="13px">6 planes, tilted 55°</text>
			<text x={PX + 18} y={214} style:font-size="13px">20 200 km up</text>
			<text x={PX + 18} y={234} style:font-size="13px">once round every 11 h 58 min</text>
		</Readout>
		<Readout id="speedup">
			<text x={PX + 18} y={PY + PH - 46} class="muted" style:font-size="12px"
				>1 second here = 10 minutes.</text
			>
			<text x={PX + 18} y={PY + PH - 28} class="muted" style:font-size="12px"
				>Source: US Coast Guard GPS almanac.</text
			>
		</Readout>
	{:else if phase === 'fix'}
		<Readout
			id="unknowns"
			order={2}
			label="Unknowns"
			value="x, y, z, clock — {usedSats.length} {usedSats.length === 1 ? 'range' : 'ranges'}"
		>
			<text x={PX + 18} y={172} class="muted" style:font-size="12px"
				>Unknowns: x, y, z and clock</text
			>
			<text x={PX + 18} y={194} style:font-size="13px" font-weight="600"
				>{usedSats.length} satellites used: {fix ? 'enough' : 'not enough'}</text
			>
		</Readout>
		{#if fix}
			<Readout
				id="iters"
				order={3}
				label="Least-squares guess"
				value={last ? offText(last.off) : ''}
			>
				<text x={PX + 18} y={232} class="muted" style:font-size="12px"
					>Each guess, and how far off it is</text
				>
				{#each guesses as g, i (i)}
					<text x={PX + 18} y={256 + i * 20} style:font-size="13px"
						>{i === 0 ? 'start: Earth’s centre' : `guess ${i}`}</text
					>
					<text
						x={PX + PW - 18}
						y={256 + i * 20}
						text-anchor="end"
						style:font-size="13px"
						font-weight={i === guesses.length - 1 ? 600 : 400}>{offText(g.off)}</text
					>
				{/each}
			</Readout>
			{#if shownIters === path.length}
				<Readout id="found" order={4} label="Clock error found" value={signedMs(fix.clock)}>
					<text x={PX + 18} y={PY + PH - 46} class="muted" style:font-size="12px"
						>Clock error found</text
					>
					<text x={PX + 18} y={PY + PH - 24} style:font-size="15px" font-weight="600"
						>{signedMs(fix.clock)}</text
					>
				</Readout>
			{/if}
		{:else}
			<Readout id="nofix" order={3} label="Fix" value="none: 4 unknowns, 3 ranges">
				<text x={PX + 18} y={240} style:font-size="13px">No fix: three spheres and an</text>
				<text x={PX + 18} y={260} style:font-size="13px">unknown clock leave a whole</text>
				<text x={PX + 18} y={280} style:font-size="13px">curve of possible places.</text>
			</Readout>
		{/if}
	{:else}
		<Readout id="gdop" order={2} label="GDOP" value={D ? D.gdop.toFixed(1) : '—'}>
			<text x={PX + 18} y={172} class="muted" style:font-size="12px">Geometry (GDOP)</text>
			<text x={PX + 18} y={196} style:font-size="16px" font-weight="600"
				>{D ? D.gdop.toFixed(1) : '—'}</text
			>
		</Readout>
		<Readout id="solved" order={3} label="Fix" value="position and clock solved">
			<text x={PX + 18} y={234} class="muted" style:font-size="12px">Four unknowns solved</text>
			<text x={PX + 18} y={256} style:font-size="13px">position: x, y, z</text>
			<text x={PX + 18} y={276} style:font-size="13px">time: the receiver’s clock</text>
		</Readout>
	{/if}
</g>
