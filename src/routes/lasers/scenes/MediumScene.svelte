<script lang="ts">
	/**
	 * The gain medium alone, without mirrors. Top: a rod of atoms (filled: in the upper laser
	 * level), pumped from below, with a weak beam sent through it from the left; the beam leaves
	 * stronger or weaker by the single-pass gain. Bottom left: the medium's level scheme with
	 * population bars and the transitions. Bottom right: the steady inversion (N₂ − N₁)/N against
	 * the pump strength W·τ for the two-, three- and four-level schemes, the current one bold.
	 */
	import { Axes, Label, Photon, clamp, cycle, hash, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		K,
		N_ATOMS,
		PUMP_PHOTON_J,
		T_RT,
		TAU,
		mediumOnly,
		steadyState,
		thresholdPump,
		type Medium
	} from '../laser';
	import { curvePath, pow10, sci } from './shared';

	let { step, t, params }: StageProps = $props();

	const medium = $derived(String(step.hints?.medium ?? 'four') as Medium);
	const phase = $derived(String(step.hints?.phase ?? ''));
	const logW = $derived(Number(params.rate ?? -1));
	const W = $derived(10 ** logW / TAU);
	const st = $derived(mediumOnly(medium, W));
	const f2 = $derived(st.n2 / N_ATOMS);
	const f1 = $derived(st.n1 / N_ATOMS);
	/** Gain of one pass through the rod (half a round trip). */
	const passGain = $derived(Math.exp((K * st.dn * T_RT) / 2));
	const names: Record<Medium, string> = {
		two: 'Two-level medium',
		three: 'Three-level medium (like ruby)',
		four: 'Four-level medium (Nd:YAG)'
	};

	/** Absorbed pump at threshold in the page's cavity (R = 95%), found once per medium. */
	const thresholds = (() => {
		const lasing = (m: Medium, w: number) => steadyState({ medium: m, R: 0.95 }, w).q > 1e6;
		const find = (m: Medium) => {
			let lo = 1e-6 / TAU;
			let hi = 1e4 / TAU;
			if (!lasing(m, hi)) return null;
			for (let i = 0; i < 60; i++) {
				const mid = Math.sqrt(lo * hi);
				if (lasing(m, mid)) hi = mid;
				else lo = mid;
			}
			const s = mediumOnly(m, hi);
			return hi * (N_ATOMS - s.n2) * PUMP_PHOTON_J; // W times the atoms left in the ground state
		};
		return { two: null, three: find('three'), four: thresholdPump(0.95) } as Record<
			Medium,
			number | null
		>;
	})();
	const thText = $derived.by(() => {
		const p = thresholds[medium];
		if (p === null) return 'never, at any pump';
		return `${p >= 100 ? Math.round(p / 100) * 100 : p.toFixed(2)} W of pump`.replace(
			/^(\d)(\d{3}) /,
			'$1,$2 '
		);
	});

	// ---------------------------------------------------------------- the rod
	const ROD = { x0: 270, x1: 690, y0: 66, y1: 154 };
	const COLS = 18;
	const ROWS = [80, 96, 124, 140];
	const atoms = Array.from({ length: COLS * ROWS.length }, (_, i) => ({
		i,
		x: ROD.x0 + 22 + (i % COLS) * ((ROD.x1 - ROD.x0 - 44) / (COLS - 1)),
		y: ROWS[Math.floor(i / COLS)],
		rank: hash(i, 3)
	}));
	const excitedCount = $derived(Math.round(f2 * atoms.length));
	const excited = $derived.by(() => {
		const sorted = [...atoms].sort((a, b) => a.rank - b.rank);
		return new Set(sorted.slice(0, excitedCount).map((a) => a.i));
	});

	/** The probe beam: in at the left, out at the right by the pass gain (drawn capped at ×4). */
	const BEAM_Y = 110;
	const drawn = $derived(clamp(passGain, 0, 4));
	const lanes = $derived(drawn > 2.5 ? 3 : drawn > 1.4 ? 2 : 1);
	const beam = $derived(
		[0, 1, 2, 3].map((k) => {
			const u = cycle(t, 4.5, k / 4);
			const x = 40 + u * 900;
			const inside = clamp((x - ROD.x0) / (ROD.x1 - ROD.x0));
			const strength = x < ROD.x0 ? 1 : 1 + (drawn - 1) * inside;
			const fade = clamp(u / 0.05) * clamp((1 - u) / 0.05);
			return { k, x, strength, fade, out: x > ROD.x1 };
		})
	);
	const gainText = $derived(
		passGain > 1e4 || passGain < 1e-3 ? `×${sci(passGain, 2)}` : `×${passGain.toPrecision(3)}`
	);

	// ---------------------------------------------------------------- levels
	const LV = { x0: 150, x1: 330 };
	const levels = $derived.by(() => {
		const up = { y: 340, label: 'upper laser level 2', frac: f2, color: 'var(--ls-upper)' };
		if (medium === 'two')
			return [up, { y: 540, label: 'lower level 1', frac: f1, color: 'var(--ls-lower)' }];
		const band = { y: 280, label: 'pump band', frac: 0, color: 'var(--ls-pump)' };
		if (medium === 'three')
			return [
				band,
				up,
				{ y: 540, label: 'ground = lower level 1', frac: f1, color: 'var(--ls-lower)' }
			];
		return [
			band,
			up,
			{ y: 470, label: 'lower laser level 1', frac: 0, color: 'var(--ls-lower)' },
			{ y: 540, label: 'ground', frac: 1 - f2, color: 'var(--stage-ink-muted)' }
		];
	});
	const pumpOpacity = $derived(0.25 + 0.75 * clamp((logW + 4) / 7));

	// ---------------------------------------------------------------- chart
	const sx = scale([-4, 3], [560, 910]);
	const sy = scale([-1, 1], [520, 290]);
	const media: Medium[] = ['four', 'three', 'two'];
	const color: Record<Medium, string> = {
		four: 'var(--ls-four)',
		three: 'var(--ls-three)',
		two: 'var(--ls-two)'
	};
	const curves = media.map((m) => ({
		m,
		d: curvePath(140, -4, 3, (lw) => mediumOnly(m, 10 ** lw / TAU).dn / N_ATOMS, sx, sy)
	}));
	const legend: Record<Medium, string> = { four: '4-level', three: '3-level', two: '2-level' };
	const dnFrac = $derived(st.dn / N_ATOMS);
</script>

<g>
	<!-- the medium's name -->
	<Readout id="medium" order={1} label="Medium" value={names[medium]}>
		<Label x={24} y={34} text={names[medium]} size={16} weight={600} anchor="start" />
	</Readout>

	<!-- the rod -->
	<rect
		x={ROD.x0}
		y={ROD.y0}
		width={ROD.x1 - ROD.x0}
		height={ROD.y1 - ROD.y0}
		rx="16"
		fill="var(--ls-rod)"
		stroke="var(--ls-rod-edge)"
		stroke-width="1.5"
	/>
	{#each atoms as a (a.i)}
		{#if excited.has(a.i)}
			<circle cx={a.x} cy={a.y} r="5.5" fill="var(--ls-upper)" />
		{:else if medium !== 'four'}
			<circle
				cx={a.x}
				cy={a.y}
				r="4.5"
				fill="var(--ls-rod)"
				stroke="var(--ls-lower)"
				stroke-width="1.5"
			/>
		{:else}
			<circle
				cx={a.x}
				cy={a.y}
				r="4.5"
				fill="var(--ls-rod)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				opacity="0.7"
			/>
		{/if}
	{/each}

	<!-- the probe beam -->
	{#each beam as p (p.k)}
		{#each Array.from({ length: p.out ? lanes : 1 }, (_, j) => j) as j (j)}
			<Photon
				x={p.x}
				y={BEAM_Y + (p.out ? (j - (lanes - 1) / 2) * 14 : 0)}
				length={34}
				amplitude={p.out ? 3 + clamp(p.strength - 1, 0, 1) * 2 : 4}
				color="var(--ls-beam)"
				opacity={p.fade * clamp(p.out ? Math.min(1, p.strength) : p.strength, 0, 1)}
				phase={t * 2}
			/>
		{/each}
	{/each}
	<Readout id="beam">
		<Label x={40} y={BEAM_Y - 22} text="weak beam in" size={12} muted anchor="start" />
	</Readout>
	<Readout id="gain" order={3} label="Beam out / beam in, one pass" value={gainText}>
		<Label x={940} y={BEAM_Y - 34} text="out: {gainText}" size={13} weight={600} anchor="end" />
	</Readout>

	<!-- the pump, from below -->
	<rect
		x={ROD.x0 + 30}
		y="184"
		width={ROD.x1 - ROD.x0 - 60}
		height="10"
		rx="3"
		fill="var(--ls-pump)"
		opacity={pumpOpacity}
	/>
	{#each [0, 1, 2, 3, 4, 5, 6] as k (k)}
		<line
			x1={ROD.x0 + 60 + k * 50}
			x2={ROD.x0 + 60 + k * 50}
			y1="180"
			y2="160"
			stroke="var(--ls-pump)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
			opacity={pumpOpacity}
		/>
	{/each}
	<Readout id="pump" order={2} label="Pump strength" value="W·τ = {sci(10 ** logW, 2)}">
		<Label x={ROD.x0 + 20} y={194} text="pump W·τ = {sci(10 ** logW, 2)}" size={13} anchor="end" />
	</Readout>
	<Readout id="threshold" order={5} label="Threshold in the page’s cavity" value={thText}>
		<Label x={940} y={194} text="laser threshold: {thText}" size={12} muted anchor="end" />
	</Readout>

	<!-- level scheme -->
	{#each levels as lv (lv.label)}
		<line
			x1={LV.x0}
			x2={LV.x1}
			y1={lv.y}
			y2={lv.y}
			stroke="var(--stage-ink)"
			stroke-width={lv.label === 'pump band' ? 10 : 2}
			stroke-linecap="round"
			opacity={lv.label === 'pump band' ? 0.25 : 1}
		/>
		<Label x={LV.x0 - 10} y={lv.y + 4} text={lv.label} size={12} anchor="end" />
		{#if lv.label !== 'pump band' && lv.label !== 'lower laser level 1'}
			<rect
				x={LV.x0}
				y={lv.y - 13}
				width={Math.max(1.5, lv.frac * (LV.x1 - LV.x0))}
				height="9"
				rx="2"
				fill={lv.color}
				opacity="0.85"
			/>
		{/if}
		{#if lv.label !== 'pump band'}
			<Label
				x={LV.x1 + 10}
				y={lv.y + 4}
				text={lv.label === 'lower laser level 1' ? '≈ 0' : sci(lv.frac, 3)}
				size={12}
				anchor="start"
				tabular
				color={lv.color}
			/>
		{/if}
	{/each}

	{#if medium === 'two'}
		{@const top = 340}
		{@const bot = 540}
		{@const labels =
			phase === 'stimulated'
				? ['absorption', 'spontaneous', 'stimulated']
				: ['pump W', 'spontaneous', 'pump stimulates']}
		<line
			x1="180"
			x2="180"
			y1={bot - 6}
			y2={top + 8}
			stroke="var(--ls-pump)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1="240"
			x2="240"
			y1={top + 6}
			y2={bot - 8}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1="300"
			x2="300"
			y1={top + 6}
			y2={bot - 8}
			stroke="var(--ls-beam)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<Label x={168} y={392} text={labels[0]} size={12} color="var(--ls-pump)" rotate={-90} />
		<Label x={228} y={392} text="{labels[1]}, τ" size={12} muted rotate={-90} />
		<Label x={288} y={392} text={labels[2]} size={12} color="var(--ls-beam)" rotate={-90} />
		<Label
			x={240}
			y={584}
			text={phase === 'stimulated'
				? 'absorption and stimulated emission: the same coefficient'
				: 'the pump drives both ways: at most N₂ = N₁'}
			size={12}
			weight={600}
		/>
	{:else}
		{@const top = 340}
		{@const lower = medium === 'four' ? 470 : 540}
		<!-- pump: ground → band -->
		<line
			x1="170"
			x2="170"
			y1={534}
			y2={288}
			stroke="var(--ls-pump)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<Label x={158} y={430} text="pump" size={12} color="var(--ls-pump)" rotate={-90} />
		<!-- band → upper: fast, no light -->
		<line
			x1="210"
			x2="236"
			y1={288}
			y2={top - 18}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
			marker-end="url(#arrowhead)"
		/>
		<Label x={252} y={306} text="fast" size={11} muted anchor="start" />
		<!-- laser transition -->
		<line
			x1="270"
			x2="270"
			y1={top + 6}
			y2={lower - 8}
			stroke="var(--ls-beam)"
			stroke-width="3"
			marker-end="url(#arrowhead)"
		/>
		<Label
			x={290}
			y={(top + lower) / 2 + 4}
			text="laser"
			size={12}
			weight={600}
			color="var(--ls-beam)"
			anchor="start"
		/>
		{#if medium === 'four'}
			<line
				x1="300"
				x2="300"
				y1={476}
				y2={532}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="3 3"
				marker-end="url(#arrowhead)"
			/>
			<Label x={312} y={508} text="fast" size={11} muted anchor="start" />
		{/if}
		<Label
			x={240}
			y={584}
			text={medium === 'four'
				? 'level 1 stays empty: every atom in 2 is inverted'
				: 'inverted only once N₂ > N/2'}
			size={12}
			weight={600}
		/>
	{/if}

	<!-- inversion against pump for the three schemes -->
	<Axes
		{sx}
		{sy}
		xLabel="pump W·τ"
		yLabel="(N₂ − N₁)/N"
		xTicks={[-4, -3, -2, -1, 0, 1, 2, 3]}
		yTicks={[-1, -0.5, 0, 0.5, 1]}
		xFormat={(v: number) => pow10(v)}
		yFormat={(v: number) => (v === 0 ? '0' : v.toString().replace('-', '−'))}
	/>
	<rect x={560} y={sy(1)} width={350} height={sy(0) - sy(1)} fill="var(--ls-four)" opacity="0.06" />
	<line x1="560" x2="910" y1={sy(0)} y2={sy(0)} stroke="var(--stage-ink)" stroke-width="1.2" />
	<Readout id="inv-zone">
		<Label x={570} y={sy(0) - 10} text="gain ↑" size={11} muted anchor="start" />
		<Label x={570} y={sy(0) + 20} text="absorption ↓" size={11} muted anchor="start" />
	</Readout>
	{#each curves as c (c.m)}
		<path
			d={c.d}
			fill="none"
			stroke={color[c.m]}
			stroke-width={c.m === medium ? 3 : 1.6}
			opacity={c.m === medium ? 1 : 0.45}
			stroke-dasharray={c.m === medium ? undefined : '5 4'}
		/>
	{/each}
	<circle
		cx={sx(logW)}
		cy={sy(dnFrac)}
		r="6"
		fill={color[medium]}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	{#each media as m, i (m)}
		<line
			x1={600 + i * 110}
			x2={624 + i * 110}
			y1="262"
			y2="262"
			stroke={color[m]}
			stroke-width={m === medium ? 3 : 1.6}
			stroke-dasharray={m === medium ? undefined : '5 4'}
		/>
		<Label
			x={630 + i * 110}
			y={266}
			text={legend[m]}
			size={12}
			weight={m === medium ? 600 : 400}
			anchor="start"
		/>
	{/each}
	<Readout
		id="pops"
		order={4}
		label="Upper / lower level"
		value="{sci(f2, 3)} / {medium === 'four' ? '≈ 0' : sci(f1, 3)} of the atoms"
	/>
</g>
