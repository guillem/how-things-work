<script lang="ts">
	/**
	 * A 16 × 16 lattice (left) and a panel (right). Phases (`step.hints.phase`):
	 *   - `bonds`: the arrangement the `arrangement` control picks (random, two domains, all up),
	 *     its broken bonds marked, the energy counted bond by bond, and a close-up of one spin and
	 *     its four neighbours (a different spin every few seconds);
	 *   - `metropolis`: the Metropolis algorithm one attempt per second, on a lattice settled at
	 *     the temperature `T_metro`: the picked spin, ΔE, the acceptance probability, the random
	 *     number and the outcome, with the whole rule as a table.
	 *
	 * The metropolis run is a `Lattice` advanced attempt by attempt as t passes; it carries on
	 * when the temperature changes and starts again when t goes back. Reduced motion: a fresh run
	 * per temperature, shown at t = 2.5 s (the third attempt, with its outcome).
	 */
	import { Label, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Lattice } from '../ising';
	import { upPath } from '../live';
	import { num, numberFrom, signed } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const N = 16;
	const LX = 40;
	const LY = 96;
	const C = 26;
	const LS = N * C;
	const PX = 500;
	const PX1 = 920;

	const phase = $derived(String(step.hints?.phase ?? 'bonds'));
	const arrangement = $derived(String(params.arrangement ?? 'random'));
	const T = $derived(numberFrom(step, params, 't', 2));

	// ---- the bonds phase: a fixed arrangement ---------------------------------------------
	const fixed = $derived.by(() => {
		const lat = new Lattice(N, N, 3);
		if (arrangement !== 'random') {
			for (let y = 0; y < N; y++)
				for (let x = 0; x < N; x++)
					lat.s[y * N + x] = arrangement === 'aligned' || (x >= 4 && x < 12) ? 1 : -1;
		}
		return lat;
	});

	// ---- the metropolis phase: one attempt per PERIOD seconds ------------------------------
	const PERIOD = 1;
	interface Attempt {
		i: number;
		dE: number;
		p: number;
		u: number;
		flipped: boolean;
		/** The spin before the attempt, and the sum of its neighbours. */
		s: number;
		sum: number;
		/** The temperature the attempt was made at. */
		temp: number;
	}
	let mrun: { lat: Lattice; log: Attempt[] } | null = null;
	let lastT = 0;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, { lat: Lattice; log: Attempt[] }>();
	const newRun = (temp: number) => {
		const lat = new Lattice(N, N, 5);
		for (let k = 0; k < 200; k++) {
			lat.wolffClusters(temp, 4);
			lat.metropolis(temp);
		}
		return { lat, log: [] as Attempt[] };
	};
	const advanceTo = (r: { lat: Lattice; log: Attempt[] }, a: number, temp: number) => {
		while (r.log.length <= a) {
			const res = r.lat.attempt(temp);
			// the spin before the attempt (flipped back if it was flipped); neighbours are unchanged
			const s = res.flipped ? -r.lat.s[res.i] : r.lat.s[res.i];
			r.log.push({ ...res, s, sum: neighbourSum(r.lat.s, res.i), temp });
		}
	};
	const neighbourSum = (s: Int8Array, i: number) => {
		const x = i % N;
		const y = Math.floor(i / N);
		return (
			s[y * N + ((x + 1) % N)] +
			s[y * N + ((x + N - 1) % N)] +
			s[((y + 1) % N) * N + x] +
			s[((y + N - 1) % N) * N + x]
		);
	};
	const metro = $derived.by(() => {
		if (phase !== 'metropolis') return null;
		const time = t;
		const temp = T;
		const a = Math.floor(time / PERIOD);
		let r: { lat: Lattice; log: Attempt[] };
		if (reduced) {
			const key = temp.toFixed(2);
			r = reducedRuns.get(key) ?? newRun(temp);
			reducedRuns.set(key, r);
		} else {
			if (!mrun || time < lastT - 1e-6) mrun = newRun(temp);
			lastT = time;
			r = mrun;
		}
		advanceTo(r, a, temp);
		const u = time / PERIOD - a;
		return { lat: r.lat, log: r.log, a, u };
	});

	const lat = $derived(metro ? metro.lat : fixed);
	/** The attempt on show and whether its outcome is shown yet (after half a period). */
	const shown = $derived(metro ? metro.log[metro.a] : null);
	const decided = $derived(metro ? metro.u >= 0.45 : false);

	// the lattice is mutated in place by the run: recompute every frame (16 × 16 is cheap)
	const ups = $derived.by(() => {
		void t;
		return upPath(lat, LX, LY, C);
	});
	/** Before the outcome is shown, the picked cell is drawn over in its old colour. */
	const pendingColour = $derived(
		shown && !decided && shown.flipped ? (shown.s > 0 ? 'var(--im-up)' : 'var(--im-down)') : null
	);

	// ---- counts ------------------------------------------------------------------------------
	const counts = $derived.by(() => {
		void t;
		const l = lat;
		let up = 0;
		for (let i = 0; i < l.n; i++) if (l.s[i] > 0) up++;
		const broken = l.brokenBonds();
		return { up, down: l.n - up, broken, E: -(2 * l.n - 2 * broken) };
	});

	/** Broken bonds as short bars across the cell edges (wrapped bonds at both outer edges). */
	const brokenPath = $derived.by(() => {
		if (phase !== 'bonds') return '';
		const s = lat.s;
		let d = '';
		const inset = 5;
		for (let y = 0; y < N; y++) {
			for (let x = 0; x < N; x++) {
				const i = y * N + x;
				const r = y * N + ((x + 1) % N);
				const b = ((y + 1) % N) * N + x;
				if (s[i] !== s[r]) {
					const bx = LX + (x + 1) * C;
					d += `M${bx} ${LY + y * C + inset}V${LY + (y + 1) * C - inset}`;
					if (x === N - 1) d += `M${LX} ${LY + y * C + inset}V${LY + (y + 1) * C - inset}`;
				}
				if (s[i] !== s[b]) {
					const by = LY + (y + 1) * C;
					d += `M${LX + x * C + inset} ${by}H${LX + (x + 1) * C - inset}`;
					if (y === N - 1) d += `M${LX + x * C + inset} ${LY}H${LX + (x + 1) * C - inset}`;
				}
			}
		}
		return d;
	});

	// ---- the spin in close-up ------------------------------------------------------------------
	/** In the bonds phase, a different spin every 3 s; in the metropolis phase, the picked one. */
	const focus = $derived(
		shown ? shown.i : Math.floor(hash(Math.floor((reduced ? 2.5 : t) / 3), 7) * N * N) % (N * N)
	);
	const fx = $derived(focus % N);
	const fy = $derived(Math.floor(focus / N));
	/** Spin values for the close-up: before the attempt while it is pending. */
	const spinAt = (i: number) => {
		if (shown && i === shown.i) return decided && shown.flipped ? -shown.s : shown.s;
		return lat.s[i];
	};
	const neighbours = $derived([
		{ dx: 1, dy: 0, i: fy * N + ((fx + 1) % N) },
		{ dx: -1, dy: 0, i: fy * N + ((fx + N - 1) % N) },
		{ dx: 0, dy: 1, i: ((fy + 1) % N) * N + fx },
		{ dx: 0, dy: -1, i: ((fy + N - 1) % N) * N + fx }
	]);
	const centre = $derived.by(() => {
		void t;
		return shown ? shown.s : lat.s[focus];
	});
	const nbSum = $derived.by(() => {
		void t;
		return shown ? shown.sum : neighbours.reduce((a, n) => a + lat.s[n.i], 0);
	});
	const ZX = 590;
	const TX = 716;
	const ZY = 210;
	const ZC = 46;

	// ---- the rule table ----------------------------------------------------------------------
	const DES = [-8, -4, 0, 4, 8];
	const pOf = (dE: number) => (dE <= 0 ? 1 : Math.exp(-dE / T));
	const tally = $derived.by(() => {
		if (!metro) return { tries: 0, flips: 0 };
		const k = decided ? metro.a + 1 : metro.a;
		let flips = 0;
		for (let j = 0; j < k; j++) if (metro.log[j].flipped) flips++;
		return { tries: k, flips };
	});
	const arrangementsText = $derived(
		arrangement === 'aligned'
			? 'only 2 arrangements (all up, all down) have this energy'
			: arrangement === 'domains'
				? 'two straight walls: a few hundred arrangements'
				: 'like nearly all of the 2²⁵⁶ ≈ 10⁷⁷ arrangements'
	);
</script>

<g>
	<!-- ---------------------------------------------------------------- the lattice -->
	<Readout
		id="title"
		order={1}
		label="16 × 16 spins"
		value={phase === 'metropolis'
			? `kT = ${T.toFixed(2)} J`
			: `${counts.up} up, ${counts.down} down`}
	>
		<Label
			anchor="start"
			x={LX}
			y={LY - 30}
			text={phase === 'metropolis'
				? `16 × 16 spins at kT = ${T.toFixed(2)} J`
				: `16 × 16 spins: ${counts.up} up, ${counts.down} down`}
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={LX}
			y={LY - 12}
			text={phase === 'metropolis'
				? `attempt ${(tally.tries + (decided ? 0 : 1)).toLocaleString('en-US')} · ${tally.flips} flipped so far`
				: `m = ${signed((counts.up - counts.down) / 256)} · broken bonds marked`}
			size={12}
			muted
		/>
	</Readout>
	<rect
		x={LX}
		y={LY}
		width={LS}
		height={LS}
		fill="var(--im-down)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={ups} fill="var(--im-up)" />
	{#if shown && pendingColour}
		<rect x={LX + fx * C} y={LY + fy * C} width={C} height={C} fill={pendingColour} />
	{/if}
	<!-- thin cell grid -->
	<path
		d={Array.from(
			{ length: N - 1 },
			(_, k) => `M${LX + (k + 1) * C} ${LY}v${LS}M${LX} ${LY + (k + 1) * C}h${LS}`
		).join('')}
		stroke="var(--stage-bg)"
		stroke-width="1"
		opacity="0.5"
	/>
	{#if phase === 'bonds'}
		<path d={brokenPath} stroke="var(--im-wall)" stroke-width="3" stroke-linecap="round" />
	{/if}
	<!-- the spin in focus and its neighbours -->
	{#each neighbours as n (n.dx * 3 + n.dy)}
		<rect
			x={LX + (n.i % N) * C + 1.5}
			y={LY + Math.floor(n.i / N) * C + 1.5}
			width={C - 3}
			height={C - 3}
			rx="3"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="3 2"
		/>
	{/each}
	<rect
		x={LX + fx * C - 1}
		y={LY + fy * C - 1}
		width={C + 2}
		height={C + 2}
		rx="4"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="3"
	/>

	<!-- ---------------------------------------------------------------- close-up -->
	<Label
		anchor="start"
		x={PX}
		y={LY - 30}
		text={phase === 'metropolis' ? 'the picked spin' : 'one spin and its four neighbours'}
		size={13}
		weight={600}
	/>
	{#each neighbours as n (n.dx * 3 + n.dy)}
		{@const sx = ZX + n.dx * (ZC + 34)}
		{@const sy = ZY + n.dy * (ZC + 34)}
		{@const agree = spinAt(n.i) === centre}
		<line
			x1={ZX + n.dx * (ZC / 2)}
			y1={ZY + n.dy * (ZC / 2)}
			x2={sx - n.dx * (ZC / 2)}
			y2={sy - n.dy * (ZC / 2)}
			stroke={agree ? 'var(--stage-ink-muted)' : 'var(--im-wall)'}
			stroke-width={agree ? 2 : 4}
		/>
		<rect
			x={sx - ZC / 2}
			y={sy - ZC / 2}
			width={ZC}
			height={ZC}
			rx="6"
			fill={spinAt(n.i) > 0 ? 'var(--im-up)' : 'var(--im-down)'}
		/>
		<Label
			x={sx}
			y={sy + 5}
			text={spinAt(n.i) > 0 ? '+1' : '−1'}
			anchor="middle"
			size={14}
			weight={600}
			halo={false}
			color="var(--im-on)"
		/>
	{/each}
	<rect
		x={ZX - ZC / 2}
		y={ZY - ZC / 2}
		width={ZC}
		height={ZC}
		rx="6"
		fill={centre > 0 ? 'var(--im-up)' : 'var(--im-down)'}
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>
	<Label
		x={ZX}
		y={ZY + 5}
		text={centre > 0 ? '+1' : '−1'}
		anchor="middle"
		size={14}
		weight={700}
		halo={false}
		color="var(--im-on)"
	/>

	{#if phase === 'bonds'}
		{@const agreeing = nbSum * centre}
		<Readout
			id="local"
			order={2}
			label="This spin’s bonds"
			value="{(4 + agreeing) / 2} agree, {(4 - agreeing) / 2} broken"
		>
			<Label
				anchor="start"
				x={TX}
				y={ZY - 40}
				text="{(4 + agreeing) / 2} bonds agree: −J each"
				size={12}
			/>
			<Label
				anchor="start"
				x={TX}
				y={ZY - 20}
				text="{(4 - agreeing) / 2} broken: +J each"
				size={12}
				color="var(--im-wall-text)"
			/>
			<Label anchor="start" x={TX} y={ZY + 6} text="flipping it would cost, with" size={12} muted />
			<Label
				anchor="start"
				x={TX}
				y={ZY + 44}
				text="Σ = sum of the four neighbours"
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={TX}
				y={ZY + 24}
				text="ΔE = 2J × s × Σ = {signed(2 * centre * nbSum, 0)} J"
				size={12}
			/>
		</Readout>
		<!-- the whole lattice's energy -->
		<Readout
			id="energy"
			order={3}
			label="Energy"
			value="E = −J × ({512 - counts.broken} − {counts.broken}) = {num(counts.E, 0)} J"
		>
			<Label
				anchor="start"
				x={PX}
				y={360}
				text="the whole lattice: 512 bonds"
				size={13}
				weight={600}
			/>
			<Label
				anchor="start"
				x={PX}
				y={382}
				text="{512 - counts.broken} agree, {counts.broken} broken"
				size={12}
			/>
			<Label
				anchor="start"
				x={PX}
				y={402}
				text="E = −J × ({512 - counts.broken} − {counts.broken}) = {num(counts.E, 0)} J"
				size={13}
				tabular
				weight={600}
			/>
		</Readout>
		<!-- energy scale from all aligned to the checkerboard -->
		{@const sx0 = PX}
		{@const sx1 = PX1 - 10}
		{@const xE = sx0 + ((counts.E + 512) / 1024) * (sx1 - sx0)}
		<line x1={sx0} x2={sx1} y1={442} y2={442} stroke="var(--stage-line)" stroke-width="2" />
		{#each [-512, 0, 512] as v (v)}
			<line
				x1={sx0 + ((v + 512) / 1024) * (sx1 - sx0)}
				x2={sx0 + ((v + 512) / 1024) * (sx1 - sx0)}
				y1={437}
				y2={447}
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
		{/each}
		<Label anchor="start" x={sx0} y={466} text="−512 J: all aligned" size={11} muted />
		<Label x={sx1} y={466} text="+512 J: checkerboard" size={11} muted anchor="end" />
		<circle
			cx={xE}
			cy={442}
			r="7"
			fill="var(--im-up)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Readout id="count" order={4} label="Arrangements" value={arrangementsText}>
			<Label anchor="start" x={PX} y={506} text={arrangementsText} size={12} italic />
		</Readout>
	{/if}

	{#if phase === 'metropolis' && shown}
		{@const dE = shown.dE}
		<Readout id="dE" order={2} label="Cost of the flip" value="ΔE = {signed(dE, 0)} J">
			<Label
				anchor="start"
				x={TX}
				y={ZY - 40}
				text="neighbours sum to {signed(shown.sum, 0)}"
				size={12}
			/>
			<Label
				anchor="start"
				x={TX}
				y={ZY - 18}
				text="ΔE = 2J × ({signed(shown.s, 0)}) × ({signed(shown.sum, 0)}) = {signed(dE, 0)} J"
				size={13}
				weight={600}
				tabular
			/>
			<Label
				anchor="start"
				x={TX}
				y={ZY + 6}
				text={dE <= 0
					? 'ΔE ≤ 0: always flip'
					: `p = e^(−${dE}/${shown.temp.toFixed(2)}) = ${shown.p.toFixed(3)}`}
				size={12}
				tabular
			/>
		</Readout>
		<Readout
			id="outcome"
			order={3}
			label="Outcome"
			value={decided
				? dE <= 0
					? 'flipped'
					: `u = ${shown.u.toFixed(3)}: ${shown.flipped ? 'flipped' : 'kept'}`
				: '…'}
		>
			<Label
				anchor="start"
				x={TX}
				y={ZY + 30}
				text={decided
					? dE <= 0
						? 'flipped'
						: `u = ${shown.u.toFixed(3)} ${shown.flipped ? '<' : '≥'} p: ${shown.flipped ? 'flipped' : 'kept'}`
					: 'drawing…'}
				size={13}
				weight={600}
				tabular
				color={decided
					? shown.flipped
						? 'var(--im-flip)'
						: 'var(--stage-ink-muted)'
					: 'var(--stage-ink-muted)'}
			/>
		</Readout>

		<!-- the whole rule -->
		<Readout
			id="table"
			order={4}
			label="The rule at this temperature"
			value={DES.map((d) => `ΔE ${signed(d, 0)}: ${pOf(d) >= 1 ? '1' : pOf(d).toFixed(3)}`).join(
				' · '
			)}
		>
			<Label
				anchor="start"
				x={PX}
				y={360}
				text="the whole rule at kT = {T.toFixed(2)} J"
				size={13}
				weight={600}
			/>
			<Label anchor="start" x={PX} y={392} text="ΔE (J)" size={12} muted />
			<Label anchor="start" x={PX} y={420} text="p(flip)" size={12} muted />
			{#each DES as d, j (d)}
				{@const cx = PX + 110 + j * 62}
				{#if d === dE}
					<rect
						x={cx - 29}
						y={374}
						width="58"
						height="56"
						rx="6"
						fill="var(--im-flip)"
						opacity="0.16"
						stroke="var(--im-flip)"
						stroke-width="1.5"
					/>
				{/if}
				<Label x={cx} y={392} text={signed(d, 0)} size={13} anchor="middle" tabular halo={false} />
				<Label
					x={cx}
					y={420}
					text={pOf(d) >= 1 ? '1' : pOf(d).toFixed(3)}
					size={13}
					anchor="middle"
					tabular
					halo={false}
					weight={d === dE ? 700 : 400}
				/>
			{/each}
			<Label
				anchor="start"
				x={PX}
				y={466}
				text="flipped {tally.flips} of {tally.tries} attempts so far"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<Readout id="key" order={5} label="up (+1) orange, down (−1) blue">
		<rect x={LX} y={LY + LS + 18} width="14" height="14" rx="3" fill="var(--im-up)" />
		<Label anchor="start" x={LX + 20} y={LY + LS + 29} text="up, s = +1" size={12} halo={false} />
		<rect x={LX + 112} y={LY + LS + 18} width="14" height="14" rx="3" fill="var(--im-down)" />
		<Label
			anchor="start"
			x={LX + 132}
			y={LY + LS + 29}
			text="down, s = −1"
			size={12}
			halo={false}
		/>
		{#if phase === 'bonds'}
			<line
				x1={LX + 250}
				x2={LX + 268}
				y1={LY + LS + 25}
				y2={LY + LS + 25}
				stroke="var(--im-wall)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Label
				anchor="start"
				x={LX + 274}
				y={LY + LS + 29}
				text="broken bond"
				size={12}
				halo={false}
			/>
		{/if}
	</Readout>
</g>
