<script lang="ts">
	/**
	 * A water-moderated reactor core and the k it gives (the four-factor model
	 * in model.ts).
	 *
	 * Views (`step.hints.view`):
	 *   slow — one neutron slowing down in water, collision by collision (a
	 *          seeded Monte Carlo from model.ts), beside its energy on a log
	 *          scale; the `moderator` toggle takes the water away and the
	 *          neutron stays fast
	 *   fuel — the core with the `enrichment` control, k and its factors
	 *   full — enrichment, water and rods; k, a gauge with the steady band and
	 *          the neutrons over the next 50 generations (kᵍ)
	 *   void — the `water` control only (steam bubbles below 100%)
	 *
	 * A control not offered on the step keeps its design value (4%, 100%, 50%),
	 * so each step starts from the critical core its text describes. Neutrons
	 * in the core picture are a few dozen particles whose fates (fission,
	 * capture in U-238, absorption in water or rods, escape) are drawn in the
	 * proportions the model gives, each on its own cycle: a pure function of t.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DESIGN,
		NATURAL,
		THERMAL_EV,
		U235,
		factors,
		regime,
		slowDown
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'full'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const enrichment = $derived(
		offered.has('enrichment') ? Number(params.enrichment) : DESIGN.enrichment
	);
	const water = $derived(offered.has('water') ? Number(params.water) / 100 : DESIGN.water);
	const rods = $derived(offered.has('rods') ? Number(params.rods) / 100 : DESIGN.rods);
	const moderated = $derived(offered.has('moderator') ? Boolean(params.moderator) : true);

	const f = $derived(factors({ enrichment, water, rods }));
	const k = $derived(f.k);
	const state = $derived(regime(k));
	const stateColour = $derived(
		state === 'subcritical'
			? 'var(--nf-sub)'
			: state === 'critical'
				? 'var(--nf-crit)'
				: 'var(--nf-super)'
	);

	// Eased copies for the drawing (rods slide, water fades).
	const rodsT = Tween.of(() => rods, { duration: 600, easing: cubicInOut });
	const waterT = Tween.of(() => (view === 'slow' ? (moderated ? 1 : 0) : water), {
		duration: 600,
		easing: cubicInOut
	});
	const rodsDraw = $derived(reduced ? rods : rodsT.current);
	const waterDraw = $derived(
		reduced ? (view === 'slow' ? (moderated ? 1 : 0) : water) : waterT.current
	);

	// ---- the core picture --------------------------------------------------------
	const CX0 = 40;
	const CX1 = 470;
	const CY0 = 136;
	const CY1 = 540;
	const FUEL = 8; // fuel rods across
	const pitch = (CX1 - CX0) / FUEL;
	const fuelX = (i: number) => CX0 + pitch * (i + 0.5);
	const ROD_SLOTS = [1, 3, 5, 7]; // control rods sit between fuel rods i-1 and i
	const rodX = (j: number) => CX0 + pitch * ROD_SLOTS[j];
	const FUEL_W = 18;
	const ROD_W = 12;
	const rodDepth = $derived((CY1 - CY0 - 20) * rodsDraw);

	// Steam bubbles when the water is below the design amount (void view).
	const bubbles = $derived.by(() => {
		const n = Math.round(clamp(1 - waterDraw) * 70);
		return Array.from({ length: n }, (_, i) => {
			const x = CX0 + 10 + hash(i, 3) * (CX1 - CX0 - 20);
			const rise = reduced ? hash(i, 5) : (hash(i, 5) + t * (0.08 + 0.06 * hash(i, 6))) % 1;
			return { id: i, x, y: CY1 - 8 - rise * (CY1 - CY0 - 16), r: 3 + 4 * hash(i, 7) };
		});
	});
	const waterOpacity = $derived(
		clamp(waterDraw / 1.2, 0, 1) * 0.85 + 0.15 * clamp(waterDraw - 1, 0, 1)
	);

	// Fates of the neutrons in the picture, in the model's proportions.
	const fates = $derived.by(() => {
		const leak = 1 - f.nonLeakage;
		const resonance = (1 - leak) * (1 - f.p);
		const thermal = (1 - leak) * f.p;
		const inFuel = thermal * f.f;
		// of what the fuel absorbs, the share that splits U-235 is η / ν
		const fission = inFuel * (f.eta / U235.nu);
		const fuelCapture = inFuel - fission;
		const notFuel = thermal * (1 - f.f);
		// split what the fuel does not absorb between water and rods by their shares
		const m = factors({ enrichment, water, rods: 0 });
		const waterShare = clamp((1 / m.f - 1) / Math.max(1e-9, 1 / f.f - 1));
		return [
			{ fate: 'fission', p: fission },
			{ fate: 'u238', p: resonance + fuelCapture },
			{ fate: 'water', p: notFuel * waterShare },
			{ fate: 'rod', p: notFuel * (1 - waterShare) },
			{ fate: 'escape', p: leak }
		] as const;
	});

	const N_PARTICLES = 26;
	const PERIOD = 3.2;
	interface Particle {
		id: number;
		x: number;
		y: number;
		fast: boolean;
		o: number;
		end: string;
		ex: number;
		ey: number;
		done: number;
	}
	const particles = $derived.by((): Particle[] => {
		if (view === 'slow') return [];
		const out: Particle[] = [];
		for (let i = 0; i < N_PARTICLES; i++) {
			const phase = reduced ? hash(i, 11) * 0.8 : (t / PERIOD + hash(i, 11)) % 1;
			const cycle = reduced ? 0 : Math.floor(t / PERIOD + hash(i, 11));
			const seed = i * 101 + cycle * 7;
			// fate
			const u = hash(seed, 13);
			let acc = 0;
			let end = 'escape';
			for (const fz of fates) {
				acc += fz.p;
				if (u < acc) {
					end = fz.fate;
					break;
				}
			}
			const startRod = Math.floor(hash(seed, 17) * FUEL);
			const sx = fuelX(startRod);
			const sy = CY0 + 40 + hash(seed, 19) * (CY1 - CY0 - 80);
			let ex: number;
			let ey: number;
			if (end === 'fission' || end === 'u238') {
				const r = Math.floor(hash(seed, 23) * FUEL);
				ex = fuelX(r === startRod ? (r + 1) % FUEL : r);
				ey = CY0 + 30 + hash(seed, 29) * (CY1 - CY0 - 60);
			} else if (end === 'rod') {
				const j = Math.floor(hash(seed, 31) * ROD_SLOTS.length);
				ex = rodX(j);
				ey = CY0 + 6 + hash(seed, 37) * Math.max(10, rodDepth - 6);
			} else if (end === 'water') {
				ex = CX0 + pitch * (Math.floor(hash(seed, 41) * FUEL) + 0.5) + pitch * 0.5;
				ey = CY0 + 30 + hash(seed, 43) * (CY1 - CY0 - 60);
			} else {
				const side = hash(seed, 47) < 0.5;
				ex = side ? CX0 - 6 : CX1 + 6;
				ey = CY0 + hash(seed, 53) * (CY1 - CY0);
			}
			// zigzag: a midpoint knocked sideways
			const mx = (sx + ex) / 2 + (hash(seed, 59) - 0.5) * 80;
			const my = (sy + ey) / 2 + (hash(seed, 61) - 0.5) * 80;
			const travel = 0.75;
			const v = clamp(phase / travel);
			const x = v < 0.5 ? sx + (mx - sx) * (v * 2) : mx + (ex - mx) * (v * 2 - 1);
			const y = v < 0.5 ? sy + (my - sy) * (v * 2) : my + (ey - my) * (v * 2 - 1);
			const o =
				smoothstep(0, 0.06, phase) *
				(1 - smoothstep(0.88, 1, phase)) *
				(end === 'escape' ? 1 - smoothstep(0.6, 0.75, phase) : 1);
			// slow once it has crossed the water a little (if there is any)
			const fast = waterDraw < 0.15 || v < 0.35;
			out.push({
				id: i,
				x,
				y,
				fast,
				o,
				end,
				ex,
				ey,
				done: smoothstep(travel, travel + 0.05, phase) * (1 - smoothstep(0.88, 1, phase))
			});
		}
		return out;
	});

	// ---- the gauge and the 50-generation look-ahead ------------------------------
	const GX0 = 540;
	const GX1 = 916;
	const gk = scale([0.8, 1.2], [GX0, GX1]);
	const kShown = $derived(clamp(k, 0.8, 1.2));
	const PX0 = 560;
	const PX1 = 916;
	const PY0 = 300;
	const PY1 = 470;
	const sx = scale([0, 50], [PX0, PX1]);
	const sy = scale([0, 3], [PY1, PY0]);
	const ahead = $derived.by(() => {
		const pts: { g: number; n: number }[] = [];
		for (let g = 0; g <= 50; g += 0.5) {
			const n = k ** g;
			if (n > 3) {
				const g0 = Math.log(3) / Math.log(k);
				pts.push({ g: g0, n: 3 });
				break;
			}
			pts.push({ g, n });
		}
		return pts;
	});
	const reveal = $derived(reduced ? 50 : clamp((t - 0.6) * 12, 0, 50));
	const aheadShown = $derived(ahead.filter((p) => p.g <= reveal));
	const aheadPath = $derived(
		linePath(
			aheadShown,
			(p) => p.g,
			(p) => p.n,
			sx,
			sy
		)
	);
	const after50 = $derived(k ** 50);
	const fmtX = (v: number) =>
		v >= 100 ? `×${Math.round(v).toLocaleString('en-US')}` : `×${Number(v.toPrecision(2))}`;

	// ---- the slowing-down neutron (slow view) ------------------------------------
	const SLOW = (() => {
		for (let s = 1; s < 500; s++) {
			const r = slowDown(s);
			if (r.energies.length - 1 === 20 && r.hits.filter((h) => h === 'O').length === 2) return r;
		}
		return slowDown(1);
	})();
	const BX0 = 40;
	const BX1 = 470;
	const BY0 = 130;
	const BY1 = 520;
	/** Collision points: a random walk inside the box, steps shrinking a little as it slows. */
	const walk = (() => {
		const pts = [{ x: BX0 + 30, y: (BY0 + BY1) / 2 }];
		let a = -0.3;
		for (let i = 0; i < SLOW.energies.length - 1 + 4; i++) {
			const last = pts[pts.length - 1];
			a += (hash(i, 71) - 0.5) * 2.6;
			const len = 46 + 30 * hash(i, 73);
			let x = last.x + Math.cos(a) * len;
			let y = last.y + Math.sin(a) * len;
			if (x < BX0 + 16 || x > BX1 - 16) {
				a = Math.PI - a;
				x = clamp(x, BX0 + 16, BX1 - 16);
			}
			if (y < BY0 + 16 || y > BY1 - 16) {
				a = -a;
				y = clamp(y, BY0 + 16, BY1 - 16);
			}
			pts.push({ x, y });
		}
		return pts;
	})();
	const nColl = SLOW.energies.length - 1;
	// Time spent on each segment: faster neutron, quicker segment (on a log scale of speed).
	const segT = walk.slice(1).map((_, i) => {
		const e = SLOW.energies[Math.min(i, nColl)];
		return 0.18 + 0.5 * (1 - Math.log10(e / THERMAL_EV) / Math.log10(2e6 / THERMAL_EV));
	});
	const SLOW_LEAD = 0.6;
	const slowTime = $derived(reduced ? 1e3 : t - SLOW_LEAD);
	const slowState = $derived.by(() => {
		if (!moderated) {
			// straight through: no collisions, still fast
			const u = reduced ? 0.55 : (t * 0.35) % 1;
			return {
				seg: -1,
				x: BX0 + 30 + u * (BX1 - BX0 - 40),
				y: (BY0 + BY1) / 2 + Math.sin(u * 7) * 6,
				e: 2e6,
				hits: 0,
				o: smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u))
			};
		}
		let acc = 0;
		for (let i = 0; i < segT.length; i++) {
			if (slowTime < acc + segT[i]) {
				const u = clamp((slowTime - acc) / segT[i]);
				const a = walk[i];
				const b = walk[i + 1];
				return {
					seg: i,
					x: a.x + (b.x - a.x) * u,
					y: a.y + (b.y - a.y) * u,
					e: SLOW.energies[Math.min(i, nColl)],
					hits: Math.min(i, nColl),
					o: 1
				};
			}
			acc += segT[i];
		}
		const end = walk[walk.length - 1];
		return { seg: segT.length, x: end.x, y: end.y, e: SLOW.energies[nColl], hits: nColl, o: 1 };
	});
	const trail = $derived.by(() => {
		if (slowState.seg < 0) return '';
		const pts = walk.slice(0, slowState.seg + 1).concat([{ x: slowState.x, y: slowState.y }]);
		return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
	});
	const EX0 = 600;
	const EX1 = 916;
	const EY0 = 150;
	const EY1 = 440;
	const ex = scale([0, 22], [EX0, EX1]);
	const ey = scale([Math.log10(0.01), Math.log10(1e7)], [EY1, EY0]);
	const ePath = $derived.by(() => {
		if (!moderated) return `M${ex(0)} ${ey(Math.log10(2e6))}H${ex(22)}`;
		let d = `M${ex(0).toFixed(1)} ${ey(Math.log10(SLOW.energies[0])).toFixed(1)}`;
		for (let i = 1; i <= slowState.hits; i++) {
			d += `H${ex(i).toFixed(1)}V${ey(Math.log10(SLOW.energies[i])).toFixed(1)}`;
		}
		return d + `H${ex(Math.min(22, slowState.hits + 0.6)).toFixed(1)}`;
	});
	const fmtE = (e: number) =>
		e >= 1e6
			? `${(e / 1e6).toFixed(1)} MeV`
			: e >= 1e3
				? `${(e / 1e3).toFixed(1)} keV`
				: e >= 1
					? `${e.toFixed(1)} eV`
					: `${e.toFixed(3)} eV`;
	const enrichLabel = (v: number) =>
		Math.abs(v - NATURAL) < 0.05 ? `${v.toFixed(1)}% (natural)` : `${v.toFixed(1)}%`;
	const fade = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fade}>
	{#if view === 'slow'}
		<!-- water box with hydrogen and oxygen -->
		<rect
			x={BX0}
			y={BY0}
			width={BX1 - BX0}
			height={BY1 - BY0}
			rx="14"
			fill="var(--nf-water)"
			opacity={0.25 + 0.75 * waterDraw}
			stroke="var(--nf-water-edge)"
		/>
		<Readout id="box-title">
			<text x={BX0} y={104} style:font-size="16px" font-weight="600"
				>{moderated ? 'A fission neutron in water' : 'No water: nothing to slow it'}</text
			>
		</Readout>
		{#if moderated}
			<path
				d={trail}
				fill="none"
				stroke="var(--nf-slow)"
				stroke-width="1.4"
				opacity="0.6"
				stroke-linejoin="round"
			/>
			{#each walk.slice(1, Math.min(slowState.seg + 1, nColl + 1)) as c, i (i)}
				<circle
					cx={c.x}
					cy={c.y}
					r={SLOW.hits[i] === 'O' ? 7 : 4}
					fill={SLOW.hits[i] === 'O' ? 'var(--nf-proton)' : 'var(--stage-ink)'}
					opacity="0.55"
				/>
			{/each}
		{/if}
		<circle
			cx={slowState.x}
			cy={slowState.y}
			r="6"
			fill={slowState.e > 1 ? 'var(--nf-fast)' : 'var(--nf-slow)'}
			opacity={slowState.o}
		/>
		<Readout
			id="hits"
			order={1}
			label="Collisions"
			value={moderated ? String(slowState.hits) : 'none'}
		>
			<text x={BX0 + 16} y={BY1 - 16} style:font-variant-numeric="tabular-nums" font-weight="600"
				>{moderated
					? `${slowState.hits} collision${slowState.hits === 1 ? '' : 's'}`
					: 'no collisions'}</text
			>
		</Readout>
		<Readout id="hit-key">
			<g style:font-size="12px">
				<circle cx={BX0 + 6} cy={566} r="4" fill="var(--stage-ink)" opacity="0.55" />
				<text x={BX0 + 16} y={570}>bounce off hydrogen</text>
				<circle cx={BX0 + 162} cy={566} r="7" fill="var(--nf-proton)" opacity="0.55" />
				<text x={BX0 + 174} y={570}>off oxygen</text>
			</g>
		</Readout>

		<!-- energy on a log scale -->
		<Readout id="e-title">
			<text x={EX0} y={104} style:font-size="15px" font-weight="600">The neutron's energy</text>
			<text x={EX0} y={122} class="muted">after each collision (log scale)</text>
		</Readout>
		<Axes
			sx={ex}
			sy={ey}
			xLabel="collisions"
			xTicks={[0, 5, 10, 15, 20]}
			yTicks={[-2, 0, 2, 4, 6]}
			yFormat={(v) =>
				v >= 6
					? '1 MeV'
					: v >= 3
						? `${10 ** (v - 3)} keV`
						: v >= 0
							? `${10 ** v} eV`
							: `${10 ** v} eV`}
		/>
		<line
			x1={EX0}
			x2={EX1}
			y1={ey(Math.log10(THERMAL_EV))}
			y2={ey(Math.log10(THERMAL_EV))}
			stroke="var(--nf-slow)"
			stroke-dasharray="4 4"
		/>
		<Label
			x={EX0 + 40}
			y={ey(Math.log10(THERMAL_EV)) - 10}
			text="slow (thermal): 0.025 eV"
			anchor="start"
			color="var(--nf-slow)"
		/>
		<path d={ePath} fill="none" stroke="var(--nf-fast)" stroke-width="2.2" />
		<Readout
			id="energy"
			order={2}
			label="Energy now"
			value={fmtE(slowState.e)}
			color={slowState.e > 1 ? 'var(--nf-fast)' : 'var(--nf-slow)'}
		>
			<text
				x={EX0}
				y={486}
				style:font-size="18px"
				font-weight="700"
				style:fill={slowState.e > 1 ? 'var(--nf-fast)' : 'var(--nf-slow)'}>{fmtE(slowState.e)}</text
			>
		</Readout>
		<Readout
			id="chance"
			order={3}
			label="Chance to split U-235"
			value={slowState.e < 1 ? "hundreds of times a fast neutron's" : 'low: it is still fast'}
		>
			<text x={EX0} y={512}
				>{slowState.e < 1
					? 'slow: hundreds of times more likely to split uranium-235'
					: 'fast: it rarely splits uranium-235'}</text
			>
		</Readout>
	{:else}
		<!-- the core -->
		<Readout id="core-title">
			<text x={CX0} y={78} style:font-size="16px" font-weight="600">A reactor core</text>
			<text x={CX0} y={96} class="muted"
				>fuel {enrichLabel(enrichment)} · water {Math.round(water * 100)}% · rods {(
					rods * 100
				).toFixed(1)}% in</text
			>
		</Readout>
		<rect
			x={CX0}
			y={CY0}
			width={CX1 - CX0}
			height={CY1 - CY0}
			rx="10"
			fill="var(--nf-water)"
			opacity={waterOpacity}
		/>
		<rect
			x={CX0}
			y={CY0}
			width={CX1 - CX0}
			height={CY1 - CY0}
			rx="10"
			fill="none"
			stroke="var(--nf-water-edge)"
		/>
		{#each bubbles as b (b.id)}
			<circle
				cx={b.x}
				cy={b.y}
				r={b.r}
				fill="var(--stage-bg)"
				stroke="var(--nf-water-edge)"
				stroke-width="1"
				opacity="0.8"
			/>
		{/each}
		{#each Array.from({ length: FUEL }, (_, i) => i) as i (i)}
			<rect
				x={fuelX(i) - FUEL_W / 2}
				y={CY0 + 14}
				width={FUEL_W}
				height={CY1 - CY0 - 28}
				rx="6"
				fill="var(--nf-fuel)"
				stroke="var(--nf-fuel-edge)"
			/>
		{/each}
		{#each ROD_SLOTS as _, j (j)}
			<rect
				x={rodX(j) - ROD_W / 2}
				y={CY0 - 24}
				width={ROD_W}
				height={24 + rodDepth}
				rx="3"
				fill="var(--nf-rod)"
			/>
		{/each}
		<!-- neutrons -->
		{#each particles as p (p.id)}
			{#if p.o > 0.02}
				<circle
					cx={p.x}
					cy={p.y}
					r="3.4"
					fill={p.fast ? 'var(--nf-fast)' : 'var(--nf-slow)'}
					opacity={p.o}
				/>
			{/if}
			{#if p.done > 0.02 && p.end === 'fission'}
				<circle
					cx={p.ex}
					cy={p.ey}
					r="9"
					fill="var(--nf-flash)"
					fill-opacity="0.35"
					stroke="var(--nf-flash)"
					stroke-width="3"
					opacity={p.done}
				/>
			{/if}
		{/each}
		<Readout id="core-key">
			<g style:font-size="12px">
				<rect
					x={CX0}
					y={556}
					width="10"
					height="16"
					rx="3"
					fill="var(--nf-fuel)"
					stroke="var(--nf-fuel-edge)"
				/>
				<text x={CX0 + 16} y={569}>fuel rod</text>
				<rect x={CX0 + 82} y={556} width="8" height="16" rx="2" fill="var(--nf-rod)" />
				<text x={CX0 + 96} y={569}>control rod</text>
				<circle cx={CX0 + 184} cy={564} r="3.4" fill="var(--nf-fast)" />
				<text x={CX0 + 192} y={569}>fast</text>
				<circle cx={CX0 + 228} cy={564} r="3.4" fill="var(--nf-slow)" />
				<text x={CX0 + 236} y={569}>slow neutron</text>
				<circle
					cx={CX0 + 330}
					cy={564}
					r="6"
					fill="none"
					stroke="var(--nf-flash)"
					stroke-width="2"
				/>
				<text x={CX0 + 342} y={569}>fission</text>
			</g>
		</Readout>

		<!-- k -->
		<Readout id="k" order={1} label="k" value="{k.toFixed(3)} · {state}" color={stateColour}>
			<text x={GX0} y={96} class="muted">new fissions per fission</text>
			<text
				x={GX0}
				y={136}
				style:font-size="34px"
				font-weight="700"
				style:fill={stateColour}
				style:font-variant-numeric="tabular-nums">k = {k.toFixed(3)}</text
			>
			<text
				x={GX1}
				y={136}
				text-anchor="end"
				style:font-size="16px"
				font-weight="600"
				style:fill={stateColour}>{state}</text
			>
		</Readout>
		<!-- gauge -->
		<Readout id="gauge">
			<g>
				<line
					x1={GX0}
					x2={GX1}
					y1={176}
					y2={176}
					stroke="var(--stage-line)"
					stroke-width="6"
					stroke-linecap="round"
				/>
				<rect
					x={gk(0.995)}
					y={168}
					width={gk(1.005) - gk(0.995)}
					height="16"
					rx="3"
					fill="var(--nf-crit)"
					opacity="0.8"
				/>
				{#each [0.8, 0.9, 1, 1.1, 1.2] as v (v)}
					<text x={gk(v)} y={204} text-anchor="middle" class="muted" style:font-size="11px"
						>{v.toFixed(1)}</text
					>
				{/each}
				<path d="M{gk(kShown)} 164 l-7 -12 h14 z" fill={stateColour} />
				<text
					x={gk(0.85)}
					y={224}
					text-anchor="middle"
					style:font-size="11px"
					style:fill="var(--nf-sub)">dies away</text
				>
				<text
					x={gk(1.15)}
					y={224}
					text-anchor="middle"
					style:font-size="11px"
					style:fill="var(--nf-super)">grows</text
				>
			</g>
		</Readout>
		<!-- factors -->
		<Readout
			id="factors"
			order={2}
			label="Four factors"
			value="η {f.eta.toFixed(2)} × ε {f.epsilon.toFixed(2)} × p {f.p.toFixed(2)} × f {f.f.toFixed(
				2
			)} × {f.nonLeakage.toFixed(2)}"
			note="born per absorption in fuel · fast fission · escape U-238 capture · absorbed in fuel · don't leak"
		></Readout>
		{#if view === 'fuel'}
			<g style:font-variant-numeric="tabular-nums">
				{#each [{ s: 'η', v: f.eta, d: 'neutrons freed per neutron the fuel absorbs' }, { s: 'ε', v: f.epsilon, d: 'extra from fast fission of uranium-238' }, { s: 'p', v: f.p, d: 'share not captured by U-238 while slowing' }, { s: 'f', v: f.f, d: 'share of slow ones absorbed in the fuel' }, { s: 'L', v: f.nonLeakage, d: 'share that does not leak out' }] as row, i (row.s)}
					{@const y = 250 + i * 46}
					<text x={GX0} {y} style:font-size="15px" font-weight="600">{row.s}</text>
					<text x={GX0 + 30} {y} style:font-size="15px" font-weight="600">{row.v.toFixed(3)}</text>
					<text x={GX0 + 30} y={y + 18} class="muted" style:font-size="11px">{row.d}</text>
					<rect
						x={GX0 + 110}
						y={y - 12}
						width={(Math.min(1.5, row.v) / 2) * (GX1 - GX0 - 110)}
						height="12"
						rx="3"
						fill="var(--nf-curve)"
						opacity="0.7"
					/>
				{/each}
				<text x={GX0} y={250 + 5 * 46 + 4} class="muted">k = η × ε × p × f × L</text>
			</g>
		{:else}
			<!-- the next 50 generations -->
			<Readout id="ahead-title">
				<text x={PX0 - 20} y={262} style:font-size="15px" font-weight="600"
					>Neutrons over the next 50 generations</text
				>
				<text x={PX0 - 20} y={280} class="muted"
					>about 5 thousandths of a second · relative to now</text
				>
			</Readout>
			<Axes
				{sx}
				{sy}
				xLabel="generations"
				xTicks={[0, 10, 20, 30, 40, 50]}
				yTicks={[0, 1, 2, 3]}
				yFormat={(v) => `×${v}`}
			/>
			<line
				x1={PX0}
				x2={PX1}
				y1={sy(1)}
				y2={sy(1)}
				stroke="var(--nf-crit)"
				stroke-dasharray="3 4"
				opacity="0.7"
			/>
			<path d={aheadPath} fill="none" stroke={stateColour} stroke-width="2.6" />
			<Readout id="after50" order={3} label="After 50 generations" value={fmtX(after50)}>
				<text x={PX0 - 20} y={526} style:font-variant-numeric="tabular-nums"
					>after 50 generations: <tspan font-weight="700" style:fill={stateColour}
						>{fmtX(after50)}</tspan
					>{after50 > 3 ? ' (off the chart)' : ''}</text
				>
			</Readout>
		{/if}
	{/if}
</g>
