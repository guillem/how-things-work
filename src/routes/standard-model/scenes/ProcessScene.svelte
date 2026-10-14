<script lang="ts">
	/**
	 * A process drawn as a Feynman diagram: time runs left to right, each line is a particle,
	 * and lines meet at two vertices (x = V1, V2) that split the process into three moments.
	 * A vertical "now" line sweeps through (or, with the `stage` control, rests in one moment);
	 * the particles present at that moment ride on it. The ledger below adds up, for every
	 * moment, the charge, baryon number and lepton numbers (colours, for the gluon process) of
	 * the particles present, from the model's `ledger()`; the current moment is highlighted.
	 *
	 * The process is `step.hints.process`, or the `process` control when the hint is "param".
	 * The diagram's lines are drawn here; which particles exist in each moment comes from the
	 * model (`PROCESSES`), and each line below names the moments it spans.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, smoothstep } from '#lib/draw/index.ts';
	import {
		PROCESSES,
		colourCount,
		decayParticle,
		ledger,
		massText,
		neutronQ,
		particle,
		thirds,
		type Colour
	} from '../particles';
	import { chargeColour, coil, forceColour, FORCE_NAME, wavy } from './shared';
	import T from './T.svelte';
	import Card from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const pid = $derived(
		step.hints?.process === 'param'
			? String(params.process ?? 'beta')
			: String(step.hints?.process ?? 'beta')
	);
	const proc = $derived(PROCESSES[pid] ?? PROCESSES.beta);
	const stageParam = $derived(String(params.stage ?? 'play'));

	// ---- geometry --------------------------------------------------------------------
	const X0 = 70;
	const X1 = 890;
	const V1 = 370;
	const V2 = 590;
	const BOUNDS = [X0, V1, V2, X1];

	type Kind = 'fermion' | 'photon' | 'w' | 'gluon';
	interface Seg {
		id: string;
		label: string;
		a: [number, number];
		b: [number, number];
		kind: Kind;
		/** First and last moment (0–2) in which it exists. */
		from: number;
		to: number;
		/** Colour charge (quarks, gluon: "r~g"). */
		colour?: string;
		/** Where its label goes, relative to its midpoint. */
		dy?: number;
		dx?: number;
	}
	const S = (
		id: string,
		label: string,
		a: [number, number],
		b: [number, number],
		kind: Kind,
		from: number,
		to: number,
		extra: Partial<Seg> = {}
	): Seg => ({ id, label, a, b, kind, from, to, ...extra });

	const DIAGRAMS: Record<string, Seg[]> = {
		beta: [
			S('u1', 'u', [X0, 110], [X1, 110], 'fermion', 0, 2),
			S('d1', 'd', [X0, 160], [X1, 160], 'fermion', 0, 2),
			S('d2', 'd', [X0, 210], [V1, 210], 'fermion', 0, 0),
			S('u2', 'u', [V1, 210], [X1, 210], 'fermion', 1, 2),
			S('w', 'W⁻', [V1, 210], [V2, 320], 'w', 1, 1, { dy: -14, dx: 58 }),
			S('e', 'e⁻', [V2, 320], [X1, 280], 'fermion', 2, 2, { dy: -12 }),
			S('nu', 'ν̄e', [V2, 320], [X1, 375], 'fermion', 2, 2, { dy: 22 })
		],
		muon: [
			S('mu', 'μ⁻', [X0, 150], [V1, 150], 'fermion', 0, 0, { dy: -12 }),
			S('numu', 'νμ', [V1, 150], [X1, 110], 'fermion', 1, 2, { dy: -12 }),
			S('w', 'W⁻', [V1, 150], [V2, 290], 'w', 1, 1, { dy: -14, dx: 58 }),
			S('e', 'e⁻', [V2, 290], [X1, 250], 'fermion', 2, 2, { dy: -12 }),
			S('nu', 'ν̄e', [V2, 290], [X1, 365], 'fermion', 2, 2, { dy: 22 })
		],
		pion: [
			S('u', 'u', [X0, 140], [V1, 215], 'fermion', 0, 0, { dy: -12 }),
			S('dbar', 'd̄', [X0, 290], [V1, 215], 'fermion', 0, 0, { dy: 24 }),
			S('w', 'W⁺', [V1, 215], [V2, 215], 'w', 1, 1, { dy: -18 }),
			S('mu', 'μ⁺', [V2, 215], [X1, 140], 'fermion', 2, 2, { dy: -12 }),
			S('numu', 'νμ', [V2, 215], [X1, 300], 'fermion', 2, 2, { dy: 24 })
		],
		ee: [
			S('e1a', 'e⁻', [X0, 140], [V1, 140], 'fermion', 0, 0, { dy: -12 }),
			S('e1b', 'e⁻', [V1, 140], [X1, 104], 'fermion', 1, 2, { dy: -12 }),
			S('e2a', 'e⁻', [X0, 320], [V2, 320], 'fermion', 0, 1, { dy: 24 }),
			S('e2b', 'e⁻', [V2, 320], [X1, 375], 'fermion', 2, 2, { dy: 24 }),
			S('g', 'γ', [V1, 140], [V2, 320], 'photon', 1, 1, { dy: -10, dx: 30 })
		],
		gluon: [
			S('ua', 'u', [X0, 130], [V1, 130], 'fermion', 0, 0, { colour: 'r', dy: -14 }),
			S('ub', 'u', [V1, 130], [X1, 130], 'fermion', 1, 2, { colour: 'g', dy: -14 }),
			S('da', 'd', [X0, 320], [V2, 320], 'fermion', 0, 1, { colour: 'g', dy: 26 }),
			S('db', 'd', [V2, 320], [X1, 320], 'fermion', 2, 2, { colour: 'r', dy: 26 }),
			S('g', 'red–antigreen gluon', [V1, 130], [V2, 320], 'gluon', 1, 1, {
				colour: 'r~g',
				dy: -10,
				dx: 92
			})
		]
	};
	const segs = $derived(DIAGRAMS[proc.id] ?? DIAGRAMS.beta);

	// ---- the "now" line -----------------------------------------------------------------
	const PERIOD = 10;
	const fixed = $derived(stageParam === 'play' ? null : Number(stageParam));
	const nowX = $derived.by(() => {
		if (fixed === null) {
			// Reduced motion: rest in the middle moment, where the exchange happens.
			if (reduced) return (V1 + V2) / 2;
			return X0 + (X1 - X0) * cycle(t, PERIOD);
		}
		const lo = BOUNDS[fixed];
		const hi = BOUNDS[fixed + 1];
		const mid = (lo + hi) / 2;
		const swing = reduced ? 0 : 0.32 * (hi - lo) * Math.sin(t * 1.3);
		return mid + swing;
	});
	const moment = $derived(nowX < V1 ? 0 : nowX < V2 ? 1 : 2);

	/** Point of a segment at the now line, if it spans it. */
	function at(s: Seg, x: number): [number, number] | null {
		const [ax, ay] = s.a;
		const [bx, by] = s.b;
		if (x < Math.min(ax, bx) || x > Math.max(ax, bx)) return null;
		const u = bx === ax ? 0 : (x - ax) / (bx - ax);
		return [x, ay + (by - ay) * u];
	}
	const riders = $derived(
		segs.flatMap((s) => {
			const p = at(s, nowX);
			return p ? [{ s, x: p[0], y: p[1] }] : [];
		})
	);

	const strokeOf = (s: Seg) =>
		s.kind === 'w'
			? 'var(--sm-weak)'
			: s.kind === 'photon'
				? 'var(--sm-em)'
				: s.kind === 'gluon'
					? 'var(--sm-strong)'
					: s.colour
						? chargeColour(s.colour as Colour)
						: 'var(--stage-ink)';
	function pathOf(s: Seg): string {
		const [ax, ay] = s.a;
		const [bx, by] = s.b;
		const len = Math.hypot(bx - ax, by - ay);
		if (s.kind === 'photon' || s.kind === 'w') return wavy(ax, ay, bx, by, len / 26, 6);
		if (s.kind === 'gluon') return coil(ax, ay, bx, by, len / 16, 7);
		return `M${ax} ${ay}L${bx} ${by}`;
	}
	const segOpacity = (s: Seg) => (s.from <= moment ? 1 : 0.28);
	const mid = (s: Seg): [number, number] => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];

	// ---- ledger -------------------------------------------------------------------------
	const sums = $derived(proc.stages.map((st) => ledger(st)));
	const colours = $derived(proc.stages.map((st) => colourCount(st)));
	const strong = $derived(proc.id === 'gluon');
	const colourText = (c: Record<Colour, number>) =>
		(['r', 'g', 'b'] as Colour[])
			.filter((k) => c[k] !== 0)
			.map((k) => `${c[k]} ${{ r: 'red', g: 'green', b: 'blue' }[k]}`)
			.join(' + ') || 'none';
	const present = (i: number) => proc.stages[i].lines.map((l) => l.label).join(' ');
	const LX = 36;
	const COL = (i: number) => 214 + i * 240;
	const ROWS = $derived(
		strong
			? [
					{ id: 'charge', label: 'Charge', cells: sums.map((s) => thirds(s.charge3)) },
					{ id: 'baryon', label: 'Baryon number', cells: sums.map((s) => thirds(s.baryon3)) },
					{ id: 'colour', label: 'Colour', cells: colours.map(colourText) }
				]
			: [
					{ id: 'charge', label: 'Charge', cells: sums.map((s) => thirds(s.charge3)) },
					{ id: 'baryon', label: 'Baryon number', cells: sums.map((s) => thirds(s.baryon3)) },
					{ id: 'le', label: 'Electron number', cells: sums.map((s) => String(s.Le)) },
					{ id: 'lmu', label: 'Muon number', cells: sums.map((s) => String(s.Lmu)) }
				]
	);

	// ---- caption: a virtual W, or a virtual photon ----------------------------------------
	const wMass = particle('W').mass?.v ?? 0;
	const available = $derived(
		proc.id === 'beta'
			? neutronQ()
			: proc.id === 'muon'
				? decayParticle('mu-').mass - decayParticle('e-').mass
				: proc.id === 'pion'
					? decayParticle('pi+').mass - decayParticle('mu+').mass
					: 0
	);
	const caption = $derived(
		proc.force === 'weak'
			? `A real ${proc.carrier} weighs ${massText(wMass)}; this decay has ${available < 1 ? `${available.toFixed(2)} MeV` : massText(available)} to spend: the ${proc.carrier} is virtual`
			: proc.force === 'em'
				? 'The photon passes momentum from one electron to the other: they are pushed apart'
				: 'The gluon carries colour from one quark to the other; the total never changes'
	);
	const capOpacity = $derived(
		reduced ? 1 : smoothstep(V1 - 30, V1 + 20, nowX) * (1 - smoothstep(V2 + 10, V2 + 60, nowX))
	);
	const capAlways = $derived(fixed === 1 || (fixed === null && reduced));
</script>

<g>
	<!-- title -->
	<Readout
		id="proc-title"
		order={1}
		label={proc.title}
		value="{FORCE_NAME[proc.force]} force, carrier {proc.carrier}"
		color={forceColour(proc.force)}
	>
		<T x={24} y={36} text={proc.title} size={16} weight={700} />
		<T
			x={24}
			y={56}
			text="{FORCE_NAME[proc.force]} force · carrier {proc.carrier}"
			size={13}
			color={forceColour(proc.force)}
			weight={600}
		/>
	</Readout>

	<!-- moment bands -->
	{#each [0, 1, 2] as k (k)}
		<rect
			x={BOUNDS[k]}
			y={74}
			width={BOUNDS[k + 1] - BOUNDS[k]}
			height={318}
			fill={k === moment ? 'var(--explainer-accent)' : 'none'}
			opacity="0.07"
		/>
	{/each}
	{#each [V1, V2] as v (v)}
		<line x1={v} x2={v} y1={78} y2={388} stroke="var(--stage-grid)" stroke-dasharray="3 5" />
	{/each}

	<!-- particle lines -->
	{#each segs as s (s.id)}
		<path
			d={pathOf(s)}
			fill="none"
			stroke={strokeOf(s)}
			stroke-width={s.kind === 'fermion' ? 3 : 2.5}
			stroke-linecap="round"
			opacity={segOpacity(s)}
		/>
	{/each}
	{#each segs as s (s.id)}
		{@const [mx, my] = mid(s)}
		<Readout id="lab-{s.id}">
			<T
				x={s.kind === 'fermion' && s.a[1] === s.b[1] && s.to === 2 && s.from === 0
					? X0 - 10
					: mx + (s.dx ?? 0)}
				y={s.kind === 'fermion' && s.a[1] === s.b[1] && s.to === 2 && s.from === 0
					? my + 5
					: my + (s.dy ?? -12)}
				text={s.kind === 'w' ? `${s.label} (virtual)` : s.label}
				anchor={s.kind === 'fermion' && s.a[1] === s.b[1] && s.to === 2 && s.from === 0
					? 'end'
					: 'middle'}
				size={s.kind === 'fermion' ? 15 : 14}
				weight={700}
				color={s.kind === 'fermion' && !s.colour ? undefined : strokeOf(s)}
				opacity={segOpacity(s) < 1 ? 0.45 : 1}
			/>
		</Readout>
	{/each}
	{#each [V1, V2] as v (v)}
		{#if segs.some((s) => s.a[0] === v)}
			{@const s0 = segs.find((s) => s.a[0] === v)}
			{#if s0}
				<circle
					cx={v}
					cy={s0.a[1]}
					r="6"
					fill="var(--stage-ink)"
					opacity={moment >= (v === V1 ? 1 : 2) ? 1 : 0.35}
				/>
			{/if}
		{/if}
	{/each}

	{#if proc.id === 'beta'}
		<Readout id="nucleons">
			<T x={X0 - 10} y={240} text="neutron" size={12} anchor="end" muted />
			<path d="M{X0 - 4} 98 v124" stroke="var(--stage-ink-muted)" stroke-width="1.5" fill="none" />
			<path d="M{X1 + 6} 98 v124" stroke="var(--stage-ink-muted)" stroke-width="1.5" fill="none" />
			<T x={X1 + 12} y={164} text="proton" size={12} muted />
		</Readout>
	{/if}

	<!-- now line and riders -->
	<line x1={nowX} x2={nowX} y1={74} y2={392} stroke="var(--explainer-accent)" stroke-width="2" />
	<T
		x={nowX}
		y={406}
		text="now"
		anchor="middle"
		size={12}
		weight={700}
		color="var(--explainer-accent)"
	/>
	{#each riders as r (r.s.id)}
		<circle
			cx={r.x}
			cy={r.y}
			r="7"
			fill={strokeOf(r.s)}
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}

	<!-- caption -->
	<Readout
		id="caption"
		order={2}
		label="Exchange"
		value={caption}
		opacity={capAlways ? 1 : capOpacity}
	>
		<T
			x={480}
			y={92}
			text={caption}
			anchor="middle"
			size={12.5}
			muted
			opacity={capAlways ? 1 : capOpacity}
		/>
	</Readout>
	<Readout id="time-axis">
		<T x={X1} y={406} text="time →" anchor="end" size={12} muted />
	</Readout>

	<!-- ledger -->
	<Readout id="card-1"><Card x={20} y={418} w={920} h={166} /></Readout>
	{#each [0, 1, 2] as k (k)}
		<Readout id="hl-{k}">
			<rect
				x={COL(k) - 10}
				y={424}
				width={232}
				height={154}
				rx="8"
				fill="var(--explainer-accent)"
				opacity={k === moment ? 0.1 : 0}
			/></Readout
		>
		<Readout id="col-{k}">
			<T
				x={COL(k)}
				y={444}
				text="{k + 1} · {proc.stages[k].label}"
				size={12.5}
				weight={k === moment ? 700 : 500}
			/>
			<T x={COL(k)} y={462} text={present(k)} size={12} muted />
		</Readout>
	{/each}
	{#each ROWS as row, r (row.id)}
		<Readout
			id="row-{row.id}"
			order={3 + r}
			label={row.label}
			value={row.cells[moment]}
			note={r === 0
				? `the same at all three moments: ${row.cells.every((c) => c === row.cells[0]) ? 'yes' : 'no'}`
				: undefined}
		>
			<T x={LX} y={488 + r * 24} text={row.label} size={12.5} muted />
			{#each row.cells as c, k (k)}
				<T x={COL(k)} y={488 + r * 24} text={c} size={13.5} weight={k === moment ? 700 : 500} />
			{/each}
		</Readout>
	{/each}
</g>
