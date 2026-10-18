<script lang="ts">
	/**
	 * The one-dimensional chain. Top: the history of a live ring of 128 spins, one row per
	 * Metropolis sweep, the newest at the bottom (a space-time picture: domains are vertical
	 * bands, their walls wander, meet and vanish, and new ones appear). Bottom: the measured
	 * ⟨|m|⟩ against temperature for rings of 16 to 1,024 spins (the `size_chain` one bold), with
	 * the 64 × 64 square lattice for comparison; right, the readouts.
	 *
	 * The ring is settled at the temperature, then advanced RATE sweeps a second; it carries on
	 * when the temperature changes and starts again when t goes back. Reduced motion: a fresh ring
	 * per temperature with a full history.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Lattice, TC, chainXi } from '../ising';
	import { rowPath } from '../live';
	import { RING_SIZES, at, curve } from '../curves';
	import { numberFrom, sizeColour, stringFrom } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const N = 128;
	const ROWS = 84;
	const RATE = 30;
	const T = $derived(numberFrom(step, params, 't', 1));
	const size = $derived.by(() => {
		const v = Number(stringFrom(step, params, 'size', '1024'));
		return (RING_SIZES as readonly number[]).includes(v) ? v : 1024;
	});

	interface Ring {
		lat: Lattice;
		rows: Int8Array[];
		done: number;
	}
	const newRing = (temp: number): Ring => {
		const lat = new Lattice(N, 1, 21);
		for (let k = 0; k < 200; k++) {
			lat.wolffClusters(temp, 4);
			lat.metropolis(temp);
		}
		return { lat, rows: [lat.s.slice()], done: 0 };
	};
	const advance = (r: Ring, k: number, temp: number) => {
		let n = 0;
		while (r.done < k && n++ < 400) {
			r.lat.metropolis(temp);
			r.rows.push(r.lat.s.slice());
			if (r.rows.length > ROWS) r.rows.shift();
			r.done++;
		}
	};
	let ring: Ring | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRings = new Map<string, Ring>();

	const current = $derived.by((): { ring: Ring; k: number } => {
		const time = t;
		if (reduced) {
			const key = T.toFixed(2);
			let r = reducedRings.get(key);
			if (!r) {
				r = newRing(T);
				advance(r, ROWS, T);
				if (reducedRings.size > 8) reducedRings.clear();
				reducedRings.set(key, r);
			}
			return { ring: r, k: r.done };
		}
		if (!ring || runKey !== step.id || time < lastT - 1e-6) {
			ring = newRing(T);
			runKey = step.id;
			t0 = time;
		}
		lastT = time;
		advance(ring, Math.floor((time - t0) * RATE), T);
		return { ring, k: ring.done };
	});

	// ---- the history ---------------------------------------------------------------------------
	const HX = 40;
	const HW = 880;
	const HY = 70;
	const RH = 2.6;
	const CW = HW / N;
	const history = $derived.by(() => {
		void current.k;
		const rows = current.ring.rows;
		const top = HY + (ROWS - rows.length) * RH;
		let d = '';
		for (let j = 0; j < rows.length; j++) d += rowPath(rows[j], HX, top + j * RH, CW, RH + 0.3);
		return d;
	});
	const walls = $derived.by(() => {
		void current.k;
		return current.ring.lat.brokenBonds();
	});
	const mNow = $derived.by(() => {
		void current.k;
		return current.ring.lat.magnetisation();
	});
	const HB = HY + ROWS * RH;

	// ---- the plot ------------------------------------------------------------------------------
	const sx = scale([0.1, 3.6], [96, 560]);
	const sy = scale([0, 1], [548, 352]);
	const path = (dim: 1 | 2, s: number) => {
		const c = curve(dim, s);
		// the square lattice's runs start at kT = 1 J, where it is fully ordered (Onsager: 0.9993)
		let d = dim === 2 ? `M${sx(0.1).toFixed(1)} ${sy(1).toFixed(1)}` : '';
		for (let i = 0; i < c.T.length; i++) {
			if (c.T[i] < 0.1 || c.T[i] > 3.6) continue;
			d += `${d ? 'L' : 'M'}${sx(c.T[i]).toFixed(1)} ${sy(c.m[i]).toFixed(1)}`;
		}
		return d;
	};
	const sizeIndex = $derived((RING_SIZES as readonly number[]).indexOf(size));
	const mRing = $derived(at(curve(1, size), 'm', T));
	const mSquare = $derived(T >= 1 ? at(curve(2, 64), 'm', T) : 1);
	const xi = $derived(chainXi(T));
	const markX = $derived(sx(T));
	const fmtN = (n: number) => n.toLocaleString('en-US');
</script>

<g>
	<Readout id="title" order={1} label="A ring of 128 spins" value="kT = {T.toFixed(2)} J">
		<Label
			anchor="start"
			x={HX}
			y={34}
			text="a ring of 128 spins at kT = {T.toFixed(2)} J"
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={HX}
			y={52}
			text="one row per sweep, the newest at the bottom; the ends of each row are neighbours"
			size={12}
			muted
		/>
	</Readout>
	<rect
		x={HX}
		y={HY}
		width={HW}
		height={ROWS * RH}
		fill="var(--im-down)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={history} fill="var(--im-up)" />
	<Label
		x={HX + HW}
		y={HB + 20}
		text="time ↓ · sweep {fmtN(current.k)}"
		size={12}
		anchor="end"
		muted
		tabular
	/>
	<Readout id="walls" order={2} label="Walls now" value="{walls} · m = {mNow.toFixed(2)}">
		<Label
			anchor="start"
			x={HX}
			y={HB + 20}
			text="{walls} walls now · m = {mNow.toFixed(2)}"
			size={12}
			tabular
		/>
	</Readout>

	<!-- ⟨|m|⟩ against T -->
	<Label
		anchor="start"
		x={96}
		y={334}
		text="average |m| against temperature"
		size={13}
		weight={600}
	/>
	<Axes {sx} {sy} xLabel="kT / J" xTicks={[0.5, 1, 1.5, 2, 2.5, 3, 3.5]} yTicks={[0, 0.5, 1]} />
	<line
		x1={sx(TC)}
		x2={sx(TC)}
		y1={352}
		y2={548}
		stroke="var(--im-tc)"
		stroke-width="1.2"
		stroke-dasharray="4 3"
	/>
	<path d={path(2, 64)} fill="none" stroke="var(--im-2d)" stroke-width="2" stroke-dasharray="7 4" />
	{#each RING_SIZES as s, i (s)}
		<path
			d={path(1, s)}
			fill="none"
			stroke={sizeColour(i)}
			stroke-width={s === size ? 2.6 : 1.3}
			opacity={s === size ? 1 : 0.55}
		/>
	{/each}
	<line x1={markX} x2={markX} y1={352} y2={548} stroke="var(--stage-ink-muted)" stroke-width="1" />
	<circle
		cx={markX}
		cy={sy(mRing)}
		r="5.5"
		fill={sizeColour(sizeIndex)}
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<!-- readouts and legend -->
	<Readout
		id="ring"
		order={3}
		label="⟨|m|⟩, ring of {fmtN(size)}"
		value={mRing.toFixed(2)}
		color={sizeColour(sizeIndex)}
	>
		<Label
			anchor="start"
			x={604}
			y={366}
			text="ring of {fmtN(size)}: ⟨|m|⟩ = {mRing.toFixed(2)}"
			size={13}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout
		id="square"
		order={4}
		label="64 × 64 square lattice"
		value={T >= 1 ? mSquare.toFixed(2) : 'ordered'}
	>
		<Label
			anchor="start"
			x={604}
			y={390}
			text="64 × 64 square: {T >= 1 ? mSquare.toFixed(2) : 'ordered (≈ 1)'}"
			size={12}
			tabular
			color="var(--im-2d-text)"
		/>
	</Readout>
	<Readout
		id="xi"
		order={5}
		label="Correlation length (exact, infinite chain)"
		value="{xi < 100 ? xi.toFixed(1) : fmtN(Math.round(xi))} spins"
	>
		<Label
			anchor="start"
			x={604}
			y={414}
			text="correlation length ξ = {xi < 100 ? xi.toFixed(1) : fmtN(Math.round(xi))} spins"
			size={12}
			tabular
		/>
		<Label
			anchor="start"
			x={604}
			y={432}
			text="finite at every T > 0: no transition"
			size={11}
			muted
		/>
	</Readout>
	<Readout
		id="legend"
		order={9}
		label="Rings of 16, 64, 256 and 1,024 spins, the chosen one bold; dashed: the 64 × 64 square lattice"
	>
		{#each RING_SIZES as s, i (s)}
			<line
				x1={604 + i * 72}
				x2={622 + i * 72}
				y1={476}
				y2={476}
				stroke={sizeColour(i)}
				stroke-width={s === size ? 3 : 1.6}
			/>
			<Label
				anchor="start"
				x={627 + i * 72}
				y={480}
				text={fmtN(s)}
				size={12}
				weight={s === size ? 700 : 400}
				halo={false}
			/>
		{/each}
		<line
			x1={604}
			x2={628}
			y1={504}
			y2={504}
			stroke="var(--im-2d)"
			stroke-width="2"
			stroke-dasharray="7 4"
		/>
		<Label anchor="start" x={634} y={508} text="64 × 64 square lattice" size={12} halo={false} />
		<line
			x1={604}
			x2={628}
			y1={530}
			y2={530}
			stroke="var(--im-tc)"
			stroke-width="1.2"
			stroke-dasharray="4 3"
		/>
		<Label anchor="start" x={634} y={534} text="its T꜀ = 2.269" size={12} halo={false} />
	</Readout>
</g>
