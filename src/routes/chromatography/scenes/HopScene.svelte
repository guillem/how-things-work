<script lang="ts">
	/**
	 * A close-up of the packing, slowed down 1000 times: two rows of particles 5 µm across,
	 * lined with the stationary coating, and the liquid flowing between them. A few molecules of
	 * the marker and of compounds 1 and 2, injected together at the left, are carried along
	 * while they move and sit on the coating while they are stuck (../model.ts `hopTimes`:
	 * exponential stays, mean stuck time 3.1 s here, mean moving time 3.1 s / k′). Dashed lines
	 * show where each compound would be at its average pace, u·t/(1 + k′). Underneath, the
	 * moving/stuck bars of one molecule of each compound, and the share of time moving measured
	 * over many molecules.
	 *
	 * The race lasts PERIOD seconds and starts again. Reduced motion: the frame at 18 s.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { hopTimes, movingTime, rates, DEFAULT } from '../model';
	import { K1, K2 } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const k2 = $derived(step.controls?.some((c) => c.id === 'k2') ? Number(params.k2 ?? K2) : K2);

	// ---- scale -----------------------------------------------------------------------------
	/** Real mean stay on the coating, s (5 µm particles), and the slow-down. */
	const STUCK_REAL = 1 / rates(DEFAULT, { k: 1 }).kd;
	const SLOW = 1000;
	const STUCK = STUCK_REAL * SLOW;
	/** px per µm: a 5 µm particle is 150 px across. */
	const PX_UM = 30;
	/** Flow speed on screen: 1 mm/s = 1 µm/ms, slowed 1000 times = 1 µm/s. */
	const V = (DEFAULT.u * 1000 * PX_UM) / SLOW;
	const PERIOD = 24;
	const X0 = 60;

	const time = $derived(reduced ? 18 : t % PERIOD);

	// ---- geometry ----------------------------------------------------------------------------
	const R = 75;
	/** The window onto the packing. */
	const WX0 = 16;
	const WX1 = 944;
	const WY0 = 48;
	const WY1 = 470;
	const GAP0 = 196;
	const GAP1 = 324;
	const topBeads = Array.from({ length: 7 }, (_, i) => ({ i, x: 20 + i * 152, y: GAP0 - R }));
	const botBeads = Array.from({ length: 7 }, (_, i) => ({ i, x: 96 + i * 152, y: GAP1 + R }));
	const surfaceY = (x: number, top: boolean) => {
		const row = top ? topBeads : botBeads;
		let best = row[0];
		for (const b of row) if (Math.abs(b.x - x) < Math.abs(best.x - x)) best = b;
		const dx = Math.min(Math.abs(x - best.x), R - 1);
		const h = Math.sqrt(R * R - dx * dx);
		return top ? best.y + h + 8 : best.y - h - 8;
	};

	// ---- the molecules ---------------------------------------------------------------------
	const KINDS = [
		{ id: 'marker', n: 3, color: 'var(--ch-marker)' },
		{ id: 'c1', n: 6, color: 'var(--ch-c1)' },
		{ id: 'c2', n: 6, color: 'var(--ch-c2)' }
	] as const;
	const kOf = (id: string) => (id === 'marker' ? 0 : id === 'c1' ? K1 : k2);
	const molecules = $derived(
		KINDS.flatMap((kind, ki) =>
			Array.from({ length: kind.n }, (_, j) => {
				const seed = 101 + ki * 1000 + j * 7;
				return {
					key: `${kind.id}-${j}`,
					color: kind.color,
					switches: hopTimes(kOf(kind.id), STUCK, PERIOD + 1, seed),
					lane: GAP0 + 22 + ((j * 37 + ki * 19) % 84),
					seed
				};
			})
		)
	);
	const EASE = 0.35;
	const drawn = $derived(
		molecules.map((m) => {
			const moved = movingTime(m.switches, time);
			const x = X0 + V * moved;
			// Which stay is it in, and since when?
			let idx = 0;
			while (idx < m.switches.length && m.switches[idx] <= time) idx++;
			const stuck = idx % 2 === 1;
			const since = time - (idx > 0 ? m.switches[idx - 1] : 0);
			const top = ((m.seed + idx) * 2654435761) % 7 < 3.5;
			const wall = surfaceY(x, stuck ? top : ((m.seed + idx - 1) * 2654435761) % 7 < 3.5);
			const wiggle = 5 * Math.sin(time * 2.1 + m.seed);
			const free = m.lane + wiggle;
			const u = Math.min(1, since / EASE);
			const y = idx === 0 ? free : stuck ? free + (wall - free) * u : wall + (free - wall) * u;
			return { key: m.key, color: m.color, x, y, stuck };
		})
	);

	// ---- average paces and the share of time moving -----------------------------------------
	const fronts = $derived(
		KINDS.map((kind) => ({
			id: kind.id,
			color: kind.color,
			x: X0 + (V * time) / (1 + kOf(kind.id))
		}))
	);
	const N_TALLY = 200;
	/** Many more molecules, not drawn, for the share of time moving (depends on k′, not t). */
	const crowd = $derived(
		(['c1', 'c2'] as const).map((id, i) => {
			const k = kOf(id);
			return {
				k,
				runs: Array.from({ length: N_TALLY }, (_, s) =>
					hopTimes(k, STUCK, PERIOD + 1, 5000 + i * 1000 + s)
				)
			};
		})
	);
	const tally = $derived(
		crowd.map(({ k, runs }) => {
			let moving = 0;
			for (const r of runs) moving += movingTime(r, time);
			return { k, share: time > 0 ? moving / (N_TALLY * time) : 1 };
		})
	);
	/** The bars: the first molecule of compounds 1 and 2. */
	const BX0 = 250;
	const BX1 = 900;
	const bx = (s: number) => BX0 + ((BX1 - BX0) * s) / PERIOD;
	const bars = $derived(
		(['c1', 'c2'] as const).map((id, row) => {
			const m = molecules.find((mm) => mm.key === `${id}-0`);
			const segs: { a: number; b: number }[] = [];
			if (m) {
				let moving = true;
				let last = 0;
				for (const sw of [...m.switches, Infinity]) {
					const end = Math.min(sw, time);
					if (moving && end > last) segs.push({ a: last, b: end });
					if (sw >= time) break;
					last = sw;
					moving = !moving;
				}
			}
			return { id, row, segs };
		})
	);
	const pct = (v: number) => `${Math.round(v * 100)} %`;
	const COLOR = { c1: 'var(--ch-c1)', c2: 'var(--ch-c2)' };
	const NAME = { c1: 'compound 1', c2: 'compound 2' };
</script>

<g>
	<Readout id="title" order={1} label="Close-up" value="slowed down 1000 times">
		<Label
			x={24}
			y={34}
			text="close-up of the packing, slowed down 1000 times · t = {time.toFixed(1)} ms"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- the liquid and the particles, seen through a window -->
	<clipPath id="chrom-hop-window">
		<rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} rx="10" />
	</clipPath>
	<g clip-path="url(#chrom-hop-window)">
		<rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} fill="var(--ch-liquid)" />
		{#each topBeads as b (b.i)}
			<circle
				cx={b.x}
				cy={b.y}
				r={R}
				fill="var(--ch-bead)"
				stroke="var(--ch-coat)"
				stroke-width="7"
			/>
		{/each}
		{#each botBeads as b (b.i)}
			<circle
				cx={b.x}
				cy={b.y}
				r={R}
				fill="var(--ch-bead)"
				stroke="var(--ch-coat)"
				stroke-width="7"
			/>
		{/each}
	</g>
	<rect
		x={WX0}
		y={WY0}
		width={WX1 - WX0}
		height={WY1 - WY0}
		rx="10"
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Readout id="coat" label="Coating (stationary phase)" color="var(--ch-coat)">
		<Label x={172} y={80} text="particle" size={12} muted />
		<Label x={172} y={98} text="lined with a coating" size={12} muted />
	</Readout>
	<!-- flow arrow -->
	<line
		x1={790}
		x2={900}
		y1={GAP0 + 8}
		y2={GAP0 + 8}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
		opacity="0.7"
	/>
	<Readout id="flow">
		<Label x={845} y={GAP0 - 2} text="liquid flows" size={11} muted />
	</Readout>
	<!-- 5 µm scale bar -->
	<path d="M{WX1 - 150} 24 v8 h150 v-8" fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
	<Readout id="scalebar">
		<Label x={WX1 - 160} y={33} text="5 µm" size={12} muted anchor="end" />
	</Readout>

	<!-- average paces -->
	{#each fronts as f (f.id)}
		<line
			x1={f.x}
			x2={f.x}
			y1={GAP0 + 6}
			y2={GAP1 - 6}
			stroke={f.color}
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
	{/each}

	{#each drawn as m (m.key)}
		<circle
			cx={m.x}
			cy={m.y}
			r="8"
			fill={m.color}
			stroke={m.stuck ? 'var(--stage-ink)' : 'var(--stage-bg)'}
			stroke-width={m.stuck ? 2 : 1.2}
		/>
	{/each}

	<!-- key -->
	<Readout id="key-pace">
		<Label
			x={24}
			y={WY1 + 22}
			text="dashed: where each compound would be at its average pace, u·t/(1 + k′)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- moving / stuck bars -->
	{#each bars as b (b.id)}
		{@const y = 538 + b.row * 30}
		<Readout
			id="share-{b.id}"
			order={2 + b.row}
			label="{NAME[b.id]} (k′ = {tally[b.row].k.toFixed(1)}), time moving"
			value="{pct(tally[b.row].share)} (long run {pct(1 / (1 + tally[b.row].k))})"
			color={COLOR[b.id]}
		>
			<Label
				x={24}
				y={y + 5}
				text="{b.id === 'c1' ? '1' : '2'}: moving {pct(tally[b.row].share)} (long run {pct(
					1 / (1 + tally[b.row].k)
				)})"
				size={12}
				anchor="start"
				color={COLOR[b.id]}
				weight={600}
				tabular
			/>
		</Readout>
		<rect
			x={BX0}
			y={y - 8}
			width={BX1 - BX0}
			height="16"
			rx="3"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		{#each b.segs as s (s.a)}
			<rect
				x={bx(s.a)}
				y={y - 8}
				width={Math.max(0.5, bx(s.b) - bx(s.a))}
				height="16"
				fill={COLOR[b.id]}
			/>
		{/each}
	{/each}
	<Readout id="bars-key">
		<Label
			x={BX1}
			y={WY1 + 44}
			text="one molecule of each: filled while moving, empty while stuck"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>
</g>
