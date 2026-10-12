<script lang="ts">
	/**
	 * Nuclei drawn ball by ball (protons and neutrons), and what each kind of
	 * decay does to them.
	 *
	 * Views (`step.hints.view`):
	 *   intro — carbon-12 (stable) beside carbon-14, which now and then turns a
	 *           neutron into a proton and fires out an electron (→ nitrogen-14)
	 *   mode  — one decay: parent → daughter + particle, its place on a chart of
	 *           protons vs neutrons, and what stops the radiation. `hints.mode`
	 *           is alpha | beta | gamma, or `param` to follow the `mode` control.
	 *
	 * Every nucleon of every nucleus is drawn (241 for americium), as one path
	 * per colour so the node count stays small. The flat disc is a picture, not
	 * a scale model: real nuclei are balls whose radius grows as A^(1/3).
	 */
	import { Label, Photon, TAU, clamp, cycle, rng, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { C14, EXAMPLE, decay, nameOf, type Isotope, type Mode, type Nuclide } from '../model';
	import { element } from '../../atoms-periodic-table/atom';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'intro'));
	const mode = $derived.by((): Mode => {
		const m = String(step.hints?.mode ?? 'alpha');
		const v = m === 'param' ? String(params.mode ?? 'alpha') : m;
		return v === 'beta' || v === 'gamma' ? v : 'alpha';
	});

	// ---- drawing a nucleus -------------------------------------------------------

	const GOLDEN = Math.PI * (3 - Math.sqrt(5));
	const SPACING = 1.1;
	/** Ball centres of a packed disc of `a` balls of radius `r` (sunflower packing), centre first. */
	function packing(a: number, r: number) {
		return Array.from({ length: a }, (_, i) => {
			const rho = r * SPACING * Math.sqrt(i + 0.5);
			return { x: rho * Math.cos(i * GOLDEN), y: rho * Math.sin(i * GOLDEN) };
		});
	}
	/** Ball radius so that a nucleus of `a` nucleons fits in a disc of radius `outer`. */
	const ballRadius = (a: number, outer: number) =>
		Math.min(13, outer / (SPACING * Math.sqrt(a) + 1));
	/** Which balls are protons: a fixed shuffle, so the colours mix. */
	function protonSet(z: number, a: number, seed: number) {
		const order = Array.from({ length: a }, (_, i) => i);
		const random = rng(seed);
		for (let i = a - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		return new Set(order.slice(0, z));
	}
	const circle = (x: number, y: number, r: number) =>
		`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

	interface Drawn {
		protons: string;
		neutrons: string;
		r: number;
		radius: number;
		balls: { x: number; y: number }[];
	}
	/**
	 * One nucleus of `parent`'s size at (cx, cy), coloured like `parent`.
	 * `turned` is a neutron drawn as a proton (beta decay); `missing` balls are
	 * left out (alpha decay).
	 */
	function nucleus(
		parent: Nuclide,
		cx: number,
		cy: number,
		outer: number,
		seed: number,
		opts: { turned?: number; missing?: Set<number> } = {}
	): Drawn {
		const size = parent.a;
		const r = ballRadius(size, outer);
		const balls = packing(size, r).map((b) => ({ x: cx + b.x, y: cy + b.y }));
		const isProton = protonSet(parent.z, size, seed);
		let protons = '';
		let neutrons = '';
		// Outermost first, so the centre sits on top.
		for (let i = size - 1; i >= 0; i--) {
			if (opts.missing?.has(i)) continue;
			const d = circle(balls[i].x, balls[i].y, r);
			if (isProton.has(i) || i === opts.turned) protons += d;
			else neutrons += d;
		}
		return { protons, neutrons, r, radius: r * (SPACING * Math.sqrt(size) + 1), balls };
	}
	/** The outermost neutron of a nucleus drawn with `nucleus(n, …, seed)`. */
	function outerNeutron(n: Nuclide, seed: number) {
		const protons = protonSet(n.z, n.a, seed);
		for (let i = n.a - 1; i >= 0; i--) if (!protons.has(i)) return i;
		return 0;
	}

	// ---- intro: carbon-12 and carbon-14 -------------------------------------------

	const carbon = element(6);
	const C12: Nuclide = { z: 6, a: 12 };
	const intro12 = nucleus(C12, 250, 270, 64, 12);
	const intro14 = nucleus(C14, 700, 270, 64, 14);
	/** A neutron of carbon-14 near the edge, the one that turns into a proton. */
	const turnIndex = outerNeutron(C14, 14);
	const intro14b = nucleus(C14, 700, 270, 64, 14, { turned: turnIndex });

	/** Intro loop: 8 s; the decay happens at 3 s, the nitrogen holds, then fades back. */
	const INTRO = 8;
	const ip = $derived(reduced ? 0.2 : cycle(t, INTRO));
	const decayed = $derived(!reduced && ip > 3 / INTRO && ip < 7.4 / INTRO);
	const sinceDecay = $derived((ip * INTRO - 3) / 2.2);
	const electronAt = $derived.by(() => {
		const u = clamp(sinceDecay);
		const b = intro14.balls[turnIndex];
		const dx = b.x - 700;
		const dy = b.y - 270;
		const len = Math.hypot(dx, dy) || 1;
		return {
			x: b.x + (dx / len) * 150 * u,
			y: b.y + (dy / len) * 150 * u,
			o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.75, 1, u))
		};
	});
	const flash = $derived(decayed ? 1 - smoothstep(0, 0.35, sinceDecay) : 0);

	// ---- mode: one decay -------------------------------------------------------------

	const parent = $derived(EXAMPLE[mode]);
	const daughter = $derived(decay(parent, mode));
	const NAMES: Record<Mode, string> = {
		alpha: 'Alpha decay',
		beta: 'Beta decay',
		gamma: 'Gamma decay'
	};
	const PX = 140;
	const DX = 420;
	const NY = 230;
	const OUTER = 78;
	const parentDrawn = $derived(nucleus(parent, PX, NY, OUTER, parent.a));
	/** The four balls of the alpha particle: the outermost two protons and two neutrons. */
	const alphaBalls = $derived.by(() => {
		if (mode !== 'alpha') return new Set<number>();
		const protons = protonSet(parent.z, parent.a, parent.a);
		const out: number[] = [];
		let p = 0;
		let n = 0;
		for (let i = parent.a - 1; i >= 0 && out.length < 4; i--) {
			const isP = protons.has(i);
			if (isP ? p < 2 : n < 2) {
				out.push(i);
				if (isP) p++;
				else n++;
			}
		}
		return new Set(out);
	});
	const betaIndex = $derived(outerNeutron(parent, parent.a));
	const daughterDrawn = $derived(
		nucleus(parent, DX, NY, OUTER, parent.a, {
			missing: mode === 'alpha' ? alphaBalls : undefined,
			turned: mode === 'beta' ? betaIndex : undefined
		})
	);
	const emitted = $derived(
		mode === 'alpha'
			? { text: 'α particle', sub: '2 protons + 2 neutrons', color: 'var(--rad-alpha)' }
			: mode === 'beta'
				? { text: 'β particle', sub: 'an electron', color: 'var(--rad-beta)' }
				: { text: 'γ ray', sub: 'a photon: energy only', color: 'var(--rad-gamma)' }
	);
	/** The emitted particle flies out of the daughter, up and to the right, every 4 s. */
	const EMIT = 4;
	const ANGLE = -0.36;
	const eu = $derived(reduced ? 0.5 : cycle(t, EMIT, 0.35));
	const particle = $derived({
		x: DX + Math.cos(ANGLE) * (OUTER + 10 + 100 * eu),
		y: NY + Math.sin(ANGLE) * (OUTER + 10 + 100 * eu),
		o: reduced ? 1 : smoothstep(0, 0.08, eu) * (1 - smoothstep(0.85, 1, eu))
	});

	const unitWord = (iso: Isotope) => (iso.unit === 'y' ? 'years' : 'hours');
	const fmtNum = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 4 });
	const halfLifeText = $derived(
		`half-life ${fmtNum(parent.halfLife)} ± ${fmtNum(parent.uncertainty)} ${unitWord(parent)}`
	);
	const nameText = (n: Nuclide) => `${nameOf(n.z)}-${n.a}${n.meta ? 'm' : ''}`;
	const change = $derived(
		mode === 'alpha' ? 'Z − 2, A − 4' : mode === 'beta' ? 'Z + 1, A same' : 'Z, A same'
	);

	// Chart of nuclides: protons (Z) up, neutrons (N) across, 4 × 4 cells around the parent.
	const CX0 = 676;
	const CY0 = 104;
	const CELL = 54;
	const chart = $derived.by(() => {
		const n0 = parent.a - parent.z;
		const zs = [parent.z + 1, parent.z, parent.z - 1, parent.z - 2];
		const ns = [n0 - 2, n0 - 1, n0, n0 + 1];
		const cells = zs.flatMap((z, row) =>
			ns.map((n, col) => ({ z, n, x: CX0 + col * CELL, y: CY0 + row * CELL, key: `${z}-${n}` }))
		);
		const at = (z: number, n: number) => ({
			x: CX0 + (ns.indexOf(n) + 0.5) * CELL,
			y: CY0 + (zs.indexOf(z) + 0.5) * CELL
		});
		return { cells, from: at(parent.z, n0), to: at(daughter.z, daughter.a - daughter.z), zs, ns };
	});
	const isParent = (c: { z: number; n: number }) => c.z === parent.z && c.n === parent.a - parent.z;
	const isDaughter = (c: { z: number; n: number }) =>
		c.z === daughter.z && c.n === daughter.a - daughter.z;
	/** A cell the chart's arrow passes through (its label would be crossed). */
	const underArrow = (c: { z: number; n: number }) => {
		const n0 = parent.a - parent.z;
		const n1 = daughter.a - daughter.z;
		const between = (v: number, a: number, b: number) => v > Math.min(a, b) && v < Math.max(a, b);
		return between(c.z, parent.z, daughter.z) && between(c.n, n0, n1);
	};
	/** The arrow on the chart stops short of the daughter's label. */
	const chartArrow = $derived.by(() => {
		const { from, to } = chart;
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.hypot(dx, dy) || 1;
		return {
			x1: from.x + (dx / len) * 18,
			y1: from.y + (dy / len) * 18,
			x2: to.x - (dx / len) * 22,
			y2: to.y - (dy / len) * 22
		};
	});

	// Shielding: particles stream right from a source and stop at their barrier.
	const SY = 498;
	const SRC = 70;
	const BARRIERS = [
		{ id: 'paper', x: 330, w: 6, label: 'paper', fill: 'var(--rad-paper)' },
		{ id: 'alu', x: 560, w: 14, label: 'aluminium, a few mm', fill: 'var(--rad-alu)' },
		{ id: 'lead', x: 790, w: 40, label: 'lead, several cm', fill: 'var(--rad-lead)' }
	];
	const STREAM = 8;
	const streams = $derived(
		Array.from({ length: STREAM }, (_, k) => {
			const lane = SY - 33 + ((k * 3) % STREAM) * 9.5;
			// Gamma: the lead absorbs most; one in four gets through, weakened.
			const through = mode === 'gamma' && k % 4 === 1;
			const end =
				mode === 'alpha'
					? BARRIERS[0].x - 6
					: mode === 'beta'
						? BARRIERS[1].x - 4
						: through
							? 930
							: BARRIERS[2].x + 6 + ((k * 7) % 26);
			const speed = mode === 'alpha' ? 150 : 280; // drawing units per second
			const period = (end - SRC) / speed + 0.4;
			const u = reduced ? 0.25 + 0.7 * ((k + 0.5) / STREAM) : cycle(t, period, k / STREAM);
			const x = SRC + (end - SRC) * clamp(u * 1.15);
			const o = smoothstep(0, 0.05, u) * (1 - smoothstep(0.88, 1, u));
			return { k, x, y: lane, end, o: through && x > BARRIERS[2].x ? o * 0.6 : o };
		})
	);
	const stoppedBy = $derived(
		mode === 'alpha'
			? 'a sheet of paper is enough'
			: mode === 'beta'
				? 'passes paper; a few millimetres of aluminium'
				: 'passes paper and aluminium; lead absorbs most, not all'
	);
</script>

{#snippet drawn(d: Drawn)}
	<path d={d.neutrons} fill="var(--rad-neutron)" stroke="var(--stage-bg)" stroke-width="1" />
	<path d={d.protons} fill="var(--rad-proton)" stroke="var(--stage-bg)" stroke-width="1" />
{/snippet}

{#snippet key(x: number, y: number)}
	<circle cx={x + 6} cy={y - 4} r="6" fill="var(--rad-proton)" />
	<text x={x + 18} {y}>proton</text>
	<circle cx={x + 88} cy={y - 4} r="6" fill="var(--rad-neutron)" />
	<text x={x + 100} {y}>neutron</text>
{/snippet}

<g>
	{#if view === 'intro'}
		<!-- carbon-12 -->
		<text x={250} y={128} text-anchor="middle" style:font-size="18px" font-weight="600"
			>Carbon-12</text
		>
		<text x={250} y={152} text-anchor="middle" class="muted">6 protons · 6 neutrons</text>
		{@render drawn(intro12)}
		<Label x={250} y={384} text="stable: lasts for ever" />

		<!-- carbon-14, which decays now and then -->
		<text x={700} y={128} text-anchor="middle" style:font-size="18px" font-weight="600">
			{decayed ? 'Nitrogen-14' : 'Carbon-14'}
		</text>
		<text x={700} y={152} text-anchor="middle" class="muted">
			{decayed ? '7 protons · 7 neutrons' : '6 protons · 8 neutrons'}
		</text>
		{@render drawn(decayed ? intro14b : intro14)}
		{#if decayed}
			{@const b = intro14.balls[turnIndex]}
			<circle
				cx={b.x}
				cy={b.y}
				r={intro14.r + 4 + 10 * (1 - flash)}
				fill="none"
				stroke="var(--rad-flash)"
				stroke-width="2"
				opacity={Math.max(flash, 0.7)}
			/>
			{#if electronAt.o > 0.01}
				<g opacity={electronAt.o}>
					<circle cx={electronAt.x} cy={electronAt.y} r="6" fill="var(--rad-beta)" />
					<Label x={electronAt.x + 12} y={electronAt.y - 10} text="e⁻" anchor="start" />
				</g>
			{/if}
		{/if}
		<Label
			x={700}
			y={384}
			text={decayed
				? 'a neutron became a proton: now nitrogen'
				: 'radioactive: half-life 5,700 years'}
		/>

		<text x={480} y={456} text-anchor="middle" class="muted">
			Stable isotopes of {carbon.name.toLowerCase()} (mendeleev data): {carbon.stable
				.map((a) => `${carbon.name.toLowerCase()}-${a}`)
				.join(' and ')}
		</text>
		<text x={480} y={480} text-anchor="middle" class="muted">
			Carbon-14 → nitrogen-14 + an electron, at a moment nobody can predict
		</text>
		{@render key(400, 540)}
	{:else}
		<!-- title -->
		<text x={40} y={50} style:font-size="18px" font-weight="600">{NAMES[mode]}</text>
		<text x={40} y={74} class="muted">{halfLifeText} for {nameText(parent).toLowerCase()}</text>

		<!-- parent → daughter + particle -->
		{@render drawn(parentDrawn)}
		{#if mode === 'gamma'}
			<!-- the excited nucleus: a glow -->
			<circle
				cx={PX}
				cy={NY}
				r={parentDrawn.radius + 5}
				fill="none"
				stroke="var(--rad-gamma)"
				stroke-width="3"
				opacity="0.6"
			/>
		{/if}
		<line
			x1={PX + OUTER + 16}
			x2={DX - OUTER - 22}
			y1={NY}
			y2={NY}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
		<Label x={(PX + DX) / 2} y={NY - 14} text={change} color={emitted.color} weight={600} />
		{@render drawn(daughterDrawn)}
		{#if mode === 'beta'}
			{@const b = daughterDrawn.balls[betaIndex]}
			<circle
				cx={b.x}
				cy={b.y}
				r={daughterDrawn.r + 3}
				fill="none"
				stroke="var(--rad-flash)"
				stroke-width="2"
			/>
		{/if}
		<Label x={PX} y={NY + OUTER + 28} text={nameText(parent)} weight={600} />
		<Label x={PX} y={NY + OUTER + 46} text="Z {parent.z} · A {parent.a}" muted />
		<Label x={DX} y={NY + OUTER + 28} text={nameText(daughter)} weight={600} />
		<Label x={DX} y={NY + OUTER + 46} text="Z {daughter.z} · A {daughter.a}" muted />

		<!-- the emitted particle -->
		<g opacity={particle.o}>
			{#if mode === 'alpha'}
				<circle cx={particle.x - 5} cy={particle.y - 5} r="6" fill="var(--rad-proton)" />
				<circle cx={particle.x + 5} cy={particle.y - 5} r="6" fill="var(--rad-neutron)" />
				<circle cx={particle.x - 5} cy={particle.y + 5} r="6" fill="var(--rad-neutron)" />
				<circle cx={particle.x + 5} cy={particle.y + 5} r="6" fill="var(--rad-proton)" />
			{:else if mode === 'beta'}
				<circle cx={particle.x} cy={particle.y} r="6" fill="var(--rad-beta)" />
			{:else}
				<Photon
					x={particle.x - 34 * Math.cos(ANGLE)}
					y={particle.y - 34 * Math.sin(ANGLE)}
					angle={(ANGLE * 360) / TAU}
					length={40}
					color="var(--rad-gamma)"
				/>
			{/if}
		</g>
		<Label
			x={DX + 40}
			y={110}
			text={emitted.text}
			color={emitted.color}
			weight={600}
			anchor="start"
		/>
		<Label x={DX + 40} y={128} text={emitted.sub} muted anchor="start" />
		{#if mode === 'beta'}
			<Label x={DX + 40} y={146} text="(and an antineutrino)" muted anchor="start" />
		{/if}

		<!-- chart of nuclides around the parent -->
		<text x={CX0} y={CY0 - 14} class="muted">each square: one nucleus</text>
		{#each chart.cells as c (c.key)}
			{@const hot = isParent(c) || isDaughter(c)}
			<rect
				x={c.x + 2}
				y={c.y + 2}
				width={CELL - 4}
				height={CELL - 4}
				rx="6"
				fill={hot ? 'var(--surface)' : 'none'}
				stroke={hot ? emitted.color : 'var(--stage-line)'}
				stroke-width={hot ? 2 : 1}
				opacity={hot ? 1 : 0.6}
			/>
			<text
				x={c.x + CELL / 2}
				y={c.y + CELL / 2 + 4}
				text-anchor="middle"
				font-weight={hot ? 600 : 400}
				class={hot ? '' : 'muted'}
				style:font-size="12px"
				opacity={hot ? 1 : underArrow(c) ? 0 : 0.7}
				>{element(c.z).symbol}-{c.z + c.n}{isParent(c) && parent.meta ? 'm' : ''}</text
			>
		{/each}
		{#each chart.zs as z, row (z)}
			<text x={CX0 - 8} y={CY0 + (row + 0.5) * CELL + 4} text-anchor="end" class="muted">{z}</text>
		{/each}
		{#each chart.ns as n, col (n)}
			<text x={CX0 + (col + 0.5) * CELL} y={CY0 + 4 * CELL + 18} text-anchor="middle" class="muted"
				>{n}</text
			>
		{/each}
		<text
			x={CX0 - 40}
			y={CY0 + 2 * CELL}
			text-anchor="middle"
			class="muted"
			transform="rotate(-90 {CX0 - 40} {CY0 + 2 * CELL})">protons (Z)</text
		>
		<text x={CX0 + 2 * CELL} y={CY0 + 4 * CELL + 38} text-anchor="middle" class="muted"
			>neutrons (N)</text
		>
		{#if mode === 'gamma'}
			<!-- the same square: only energy leaves -->
			<path
				d="M{chart.from.x + 20} {chart.from.y - 12} C {chart.from.x + 52} {chart.from.y -
					50}, {chart.from.x - 52} {chart.from.y - 50}, {chart.from.x - 20} {chart.from.y - 14}"
				fill="none"
				stroke={emitted.color}
				stroke-width="2.5"
				marker-end="url(#arrowhead)"
			/>
		{:else}
			<line
				{...chartArrow}
				stroke={emitted.color}
				stroke-width="2.5"
				marker-end="url(#arrowhead)"
			/>
		{/if}

		<!-- what stops it -->
		<text x={40} y={SY - 62} style:font-size="15px" font-weight="600">What stops it</text>
		<text x={160} y={SY - 62} class="muted">{stoppedBy}</text>
		<circle cx={SRC - 16} cy={SY} r="12" fill="var(--rad-parent)" />
		<text x={SRC - 16} y={SY + 66} text-anchor="middle" class="muted">source</text>
		{#each BARRIERS as b (b.id)}
			<rect
				x={b.x}
				y={SY - 44}
				width={b.w}
				height="88"
				rx="2"
				fill={b.fill}
				stroke="var(--border)"
			/>
			<text x={b.x + b.w / 2} y={SY + 66} text-anchor="middle" class="muted">{b.label}</text>
		{/each}
		{#each streams as s (s.k)}
			<line
				x1={SRC}
				x2={s.end}
				y1={s.y}
				y2={s.y}
				stroke={emitted.color}
				stroke-width="1"
				opacity="0.22"
			/>
		{/each}
		{#each streams as s (s.k)}
			<g opacity={s.o}>
				{#if mode === 'alpha'}
					<circle cx={s.x} cy={s.y} r="4.5" fill="var(--rad-alpha)" />
				{:else if mode === 'beta'}
					<circle cx={s.x} cy={s.y} r="3.2" fill="var(--rad-beta)" />
				{:else}
					<Photon x={s.x - 22} y={s.y} length={22} amplitude={2.5} color="var(--rad-gamma)" />
				{/if}
			</g>
		{/each}
		{@render key(40, 106)}
	{/if}
</g>
