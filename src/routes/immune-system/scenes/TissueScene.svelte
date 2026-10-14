<script lang="ts">
	/**
	 * The airway lining during an infection, driven by the model day by day.
	 *
	 * A row of 24 lining cells under mucus and cilia; air above, the tissue and
	 * a blood vessel below. Resistant and lost cells are drawn in proportion to
	 * the model (each drawn cell is 1/24 of the lining); infected cells, virus
	 * particles and immune cells on a logarithmic scale (one more drawn = ten
	 * times as many), because they span a millionfold. The infection spreads
	 * from a focus in the middle.
	 *
	 * Views (step.hints.view):
	 *   invasion — days 0–1.6, slowly: virus lands, infects, multiplies;
	 *   innate   — days 0.5–4: interferon, resistant cells, NK cells, a macrophage;
	 *   battle   — days 0–12 with everything, the lymph node inset, and the
	 *              "Release the virus" action, which replays from day 0.
	 * Under reduced motion each view shows one telling day.
	 */
	import { Label, clamp, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CAO, antibody, at, clearedDay, effectors } from '../model';
	import { count, retime, run } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'battle'));
	// ---- time: day as a pure function of t, replayed by the two actions --------------
	// "Release the virus" replays the first infection; "Infect again" plays a
	// second infection six months later (REINFECT), met by memory cells.
	const REINFECT = 180;
	const release = $derived(Number(params.release ?? 0));
	const again = $derived(Number(params.again ?? 0));
	let startedAt = 0;
	let started = { release: -1, again: -1 };
	let second = false;
	let lastT = 0;
	const timing = $derived.by(() => {
		if (release !== started.release || again !== started.again || t < lastT) {
			const first = started.release === -1;
			if (again !== started.again && !first) second = true;
			if (release !== started.release && !first) second = false;
			startedAt = first || t < lastT ? 0 : t;
			started = { release, again };
		}
		lastT = t;
		return { tRun: Math.max(0, t - startedAt), second };
	});
	const tRun = $derived(timing.tRun);
	const isSecond = $derived(view === 'battle' && timing.second);
	const series = $derived(
		isSecond
			? retime(run({ days: REINFECT + 20, reinfectAt: REINFECT }), REINFECT, 20)
			: run({ days: 30 })
	);
	const firstGone = $derived(clearedDay(run({ days: 30 })));
	const LEAD = 0.8;
	const plan = $derived(
		view === 'invasion'
			? { from: 0, to: 1.6, pace: 0.11, still: 1.2 }
			: view === 'innate'
				? { from: 0.5, to: 4, pace: 0.2, still: 3 }
				: { from: 0, to: 12, pace: 0.8, still: 6.5 }
	);
	const day = $derived(
		reduced ? plan.still : Math.min(plan.to, plan.from + Math.max(0, tRun - LEAD) * plan.pace)
	);
	const s = $derived(at(series, day));

	// ---- what is shown ---------------------------------------------------------------
	const showInnate = $derived(view === 'invasion' ? 0 : 1);
	const showAdaptive = $derived(view === 'battle' ? 1 : 0);

	// ---- the lining ------------------------------------------------------------------
	const N = 24;
	const CW = 36;
	const CX0 = 48;
	const CY0 = 300;
	const CY1 = 418;
	const FOCUS = 11.5;
	/** Cells in order of distance from the focus, with a little jitter. */
	const order = Array.from({ length: N }, (_, i) => i).sort(
		(a, b) => Math.abs(a - FOCUS) + hash(a, 3) * 1.6 - (Math.abs(b - FOCUS) + hash(b, 3) * 1.6)
	);
	const rank = new Map(order.map((c, k) => [c, k]));

	/** Drawn numbers (fractional: the last cell of a kind fades in). */
	const lostN = $derived(N * Math.max(0, 1 - (s.T + s.R + s.I) / CAO.T0));
	const infN = $derived(s.I >= 1 ? Math.log10(s.I) : 0);
	const resN = $derived((N * s.R) / CAO.T0);

	type CellState = { k: number; x: number; inf: number; res: number; lost: number };
	const cells = $derived.by<CellState[]>(() => {
		const out: CellState[] = [];
		for (let i = 0; i < N; i++) {
			const k = rank.get(i) ?? 0;
			// first the lost cells, then infected, then resistant, outwards from the focus
			const lost = clamp(lostN - k);
			const inf = clamp(lostN + infN - k) - lost;
			const res = (clamp(lostN + infN + resN - k) - lost - inf) * showInnate;
			out.push({ k: i, x: CX0 + i * CW, inf, res, lost });
		}
		return out;
	});

	// ---- particles -------------------------------------------------------------------
	const lg = (v: number) => (v >= 1 ? Math.log10(v) : 0);
	/** Share of virus removal done by antibodies at this moment. */
	const caught = $derived.by(() => {
		const ab = CAO.kS * s.AS + CAO.kL * s.AL;
		return ab / (ab + CAO.dV + CAO.beta * s.T);
	});
	const virions = $derived.by(() => {
		const n = Math.min(30, Math.round(3 * lg(s.V)));
		const out: { k: number; x: number; y: number; ab: boolean; o: number }[] = [];
		for (let k = 0; k < n; k++) {
			const spread = 60 + 26 * lg(s.V);
			const bx = 480 + (hash(k, 1) - 0.5) * 2 * Math.min(420, spread);
			const by = 150 + hash(k, 2) * 130;
			const ph = cycle(t, 6 + hash(k, 4) * 4, hash(k, 5));
			out.push({
				k,
				x: bx + 10 * Math.sin(ph * 6.283),
				y: by + 8 * Math.cos(ph * 6.283),
				ab: hash(k, 6) < caught * showAdaptive,
				o: 1
			});
		}
		return out;
	});
	const freeAntibodies = $derived.by(() => {
		const n = showAdaptive ? Math.min(12, Math.round(2.5 * lg(antibody(s)))) : 0;
		return Array.from({ length: n }, (_, k) => {
			const ph = cycle(t, 9 + hash(k, 8) * 5, hash(k, 9));
			return {
				k,
				x: 240 + hash(k, 7) * 340 + 14 * Math.sin(ph * 6.283),
				y: 90 + hash(k, 10) * 160 + 10 * Math.cos(ph * 6.283),
				r: hash(k, 11) * 360
			};
		});
	});
	/** Interferon puffs from infected cells, while the alarm is on. */
	const puffs = $derived.by(() => {
		if (!showInnate || s.F < 0.05) return [];
		const inf = cells.filter((c) => c.inf > 0.5);
		const out: { k: string; x: number; y: number; o: number }[] = [];
		const per = Math.min(4, Math.ceil(s.F));
		for (const c of inf) {
			for (let j = 0; j < per; j++) {
				const u = cycle(t, 2.4, hash(c.k * 7 + j, 12));
				const side = j % 2 === 0 ? -1 : 1;
				out.push({
					k: `${c.k}-${j}`,
					x: c.x + CW / 2 + side * u * CW * 2.2,
					y: CY0 + 40 + j * 14 - 18 * Math.sin(u * 3.14),
					o: smoothstep(0, 0.15, u) * (1 - smoothstep(0.7, 1, u)) * clamp(s.F / 2)
				});
			}
		}
		return out.slice(0, 40);
	});
	/** NK cells (innate), killer T cells (adaptive): in the tissue, closing in on infected cells. */
	const targets = $derived(cells.filter((c) => c.inf > 0.3).map((c) => c.x + CW / 2));
	const hunters = $derived.by(() => {
		const out: { k: string; kind: 'nk' | 't'; x: number; y: number }[] = [];
		const nk = showInnate ? Math.min(6, Math.round(2 * s.F)) : 0;
		const tc = showAdaptive ? Math.min(14, Math.round(2.2 * lg(effectors(s)))) : 0;
		const place = (k: number, kind: 'nk' | 't', salt: number) => {
			const tx = targets.length ? targets[k % targets.length] : 120 + hash(k, salt) * 480;
			const ph = cycle(t, 5 + hash(k, salt + 1) * 3, hash(k, salt + 2));
			const home = 120 + hash(k, salt + 3) * 480;
			const near = targets.length ? 0.75 : 0;
			const x = home + (tx - home) * near + 12 * Math.sin(ph * 6.283);
			const y =
				(targets.length ? 436 + hash(k, salt + 4) * 44 : 470 + hash(k, salt + 4) * 60) +
				6 * Math.cos(ph * 6.283);
			out.push({ k: `${kind}${k}`, kind, x, y });
		};
		for (let k = 0; k < nk; k++) place(k, 'nk', 20);
		for (let k = 0; k < tc; k++) place(k, 't', 40);
		return out;
	});
	const macrophage = $derived(showInnate * smoothstep(0.3, 1, s.F));

	// ---- cilia ---------------------------------------------------------------------------
	const cilia = $derived.by(() => {
		let d = '';
		for (let i = 0; i < N; i++) {
			const a = Math.sin((cycle(t, 0.9) + i * 0.08) * 6.283) * 6;
			for (let j = 0; j < 4; j++) {
				const x = CX0 + i * CW + 6 + j * 8;
				d += `M${x} ${CY0} q ${(a / 2).toFixed(1)} -8 ${a.toFixed(1)} -14`;
			}
		}
		return d;
	});
	/** Spikes of a virion (8) or a T cell (6) as one path around (0, 0). */
	const spikes = (n: number, r0: number, r1: number) =>
		Array.from({ length: n }, (_, j) => {
			const a = (j / n) * 6.283;
			return `M${(r0 * Math.cos(a)).toFixed(1)} ${(r0 * Math.sin(a)).toFixed(1)}L${(r1 * Math.cos(a)).toFixed(1)} ${(r1 * Math.sin(a)).toFixed(1)}`;
		}).join('');
	const VIRION_SPIKES = spikes(8, 7, 10);
	const TCELL_SPIKES = spikes(6, 10, 14);

	// ---- the lymph node inset (battle) ------------------------------------------------------
	/** Cells that fit the virus at the start of this infection: naive, or memory the second time. */
	const poolT = $derived(isSecond ? series[0].Cm : CAO.Cn0);
	const poolB = $derived(isSecond ? series[0].Bm : CAO.Bn0);
	const recruitedT = $derived(poolT - (isSecond ? s.Cm : s.Cn));
	const recruitedB = $derived(poolB - (isSecond ? s.Bm : s.Bn));
	const nodeDots = $derived.by(() =>
		Array.from({ length: 40 }, (_, k) => ({
			k,
			x: 680 + (hash(k, 30) - 0.5) * 110,
			y: 108 + (hash(k, 31) - 0.5) * 54,
			on: k < 20 ? k < (recruitedT / poolT) * 20 : k - 20 < (recruitedB / poolB) * 20,
			kind: k < 20 ? 't' : 'b'
		}))
	);

	const fmtDay = (d: number) => d.toFixed(1);
	const gone = $derived(clearedDay(series));
	const goneShow = $derived(
		view === 'battle' && gone !== null ? (reduced ? 0 : smoothstep(gone, gone + 0.4, day)) : 0
	);
	const keys = $derived.by(() => {
		const x = 928;
		const y = view === 'battle' ? 470 : 52;
		const out = [
			{
				id: 'inf',
				label: 'infected cell',
				color: 'var(--im-infected-edge)',
				fill: 'var(--im-infected)',
				x,
				y
			}
		];
		if (view !== 'invasion')
			out.push({
				id: 'res',
				label: 'resistant (interferon)',
				color: 'var(--im-resistant-edge)',
				fill: 'var(--im-resistant)',
				x,
				y
			});
		if (view !== 'invasion')
			out.push({ id: 'lost', label: 'lost', color: 'var(--stage-ink-muted)', fill: 'none', x, y });
		return out;
	});
	const callouts = $derived(view !== 'battle');
</script>

<g>
	<!-- air, mucus, lining, tissue -->
	<rect x={24} y={252} width={912} height={40} rx="6" fill="var(--im-mucus)" opacity="0.8" />
	<path
		d={cilia}
		fill="none"
		stroke="var(--im-cell-edge)"
		stroke-width="1.2"
		stroke-linecap="round"
	/>
	{#each cells as c (c.k)}
		<g>
			<rect
				x={c.x + 1}
				y={CY0}
				width={CW - 2}
				height={CY1 - CY0}
				rx="6"
				fill="var(--im-cell)"
				stroke="var(--im-cell-edge)"
				stroke-width="1.2"
				opacity={1 - c.lost}
			/>
			{#if c.res > 0.02}
				<rect
					x={c.x + 1}
					y={CY0}
					width={CW - 2}
					height={CY1 - CY0}
					rx="6"
					fill="var(--im-resistant)"
					stroke="var(--im-resistant-edge)"
					stroke-width="1.4"
					opacity={c.res}
				/>
			{/if}
			{#if c.inf > 0.02}
				<rect
					x={c.x + 1}
					y={CY0}
					width={CW - 2}
					height={CY1 - CY0}
					rx="6"
					fill="var(--im-infected)"
					stroke="var(--im-infected-edge)"
					stroke-width="1.6"
					opacity={c.inf}
				/>
				{#each [0, 1, 2] as j (j)}
					<circle
						cx={c.x + 10 + j * 8}
						cy={CY0 + 26 + (j % 2) * 10}
						r="3"
						fill="var(--im-virus)"
						opacity={c.inf}
					/>
				{/each}
			{/if}
			{#if c.lost > 0.02}
				<rect
					x={c.x + 3}
					y={CY0 + 2}
					width={CW - 6}
					height={CY1 - CY0 - 4}
					rx="6"
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="3 3"
					opacity={c.lost}
				/>
			{/if}
			<ellipse
				cx={c.x + CW / 2}
				cy={CY0 + 82}
				rx="8"
				ry="10"
				fill="var(--im-cell-edge)"
				opacity={0.55 * (1 - c.lost)}
			/>
		</g>
	{/each}

	<!-- blood vessel -->
	<path
		d="M24 556 H936 M24 584 H936"
		stroke="var(--im-infected-edge)"
		stroke-width="1.2"
		opacity="0.5"
	/>

	<!-- interferon puffs -->
	{#each puffs as p (p.k)}
		<circle cx={p.x} cy={p.y} r="2.6" fill="var(--im-interferon)" opacity={p.o} />
	{/each}

	<!-- macrophage, in the mucus over the focus -->
	{#if macrophage > 0.02}
		{@const mx = 300 + 14 * Math.sin(cycle(t, 7) * 6.283)}
		<g opacity={macrophage}>
			<path
				d="M{mx -
					30} 236 q -6 -22 16 -28 q 18 -14 34 2 q 22 2 16 24 q 6 18 -16 22 q -20 10 -34 -2 q -22 -2 -16 -18 Z"
				fill="var(--im-node)"
				stroke="var(--im-node-edge)"
				stroke-width="1.4"
			/>
			<circle cx={mx - 2} cy={232} r="6" fill="var(--im-node-edge)" opacity="0.6" />
		</g>
	{/if}

	<!-- immune cells in the tissue -->
	{#each hunters as h (h.k)}
		{#if h.kind === 'nk'}
			<circle cx={h.x} cy={h.y} r="11" fill="var(--im-nk)" opacity="0.85" />
			<circle cx={h.x - 3} cy={h.y - 2} r="2" fill="var(--stage-bg)" />
			<circle cx={h.x + 4} cy={h.y + 3} r="2" fill="var(--stage-bg)" />
		{:else}
			<circle cx={h.x} cy={h.y} r="10" fill="var(--im-tcell)" />
			<path
				d={TCELL_SPIKES}
				transform="translate({h.x} {h.y})"
				stroke="var(--im-tcell)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/if}
	{/each}

	<!-- virus and antibodies in the air and mucus -->
	{#each freeAntibodies as a (a.k)}
		<g transform="translate({a.x} {a.y}) rotate({a.r})">
			<path
				d="M0 6 V0 L-5 -6 M0 0 L5 -6"
				fill="none"
				stroke="var(--im-antibody)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</g>
	{/each}
	{#each virions as v (v.k)}
		<g transform="translate({v.x} {v.y})" opacity={v.o}>
			<path d={VIRION_SPIKES} stroke="var(--im-virus)" stroke-width="1.5" />
			<circle r="7" fill="var(--im-virus)" />
			{#if v.ab}
				<path
					d="M10 -2 l6 0 l4 -4 M16 -2 l4 4"
					fill="none"
					stroke="var(--im-antibody)"
					stroke-width="2"
					stroke-linecap="round"
				/>
				<path
					d="M-10 3 l-6 0 l-4 -4 M-16 3 l-4 4"
					fill="none"
					stroke="var(--im-antibody)"
					stroke-width="2"
					stroke-linecap="round"
				/>
			{/if}
		</g>
	{/each}

	<!-- labels -->
	{#if callouts}
		<Readout id="lbl-mucus"
			><Label x={40} y={276} text="mucus" size={12} anchor="start" muted /></Readout
		>
		<Readout id="lbl-lining">
			<Label x={40} y={440} text="cells lining the airway" size={12} anchor="start" muted />
		</Readout>
		<Readout id="lbl-vessel"
			><Label x={40} y={548} text="blood vessel" size={12} anchor="start" muted /></Readout
		>
	{/if}
	{#if view === 'innate'}
		<Readout id="lbl-nk" label="NK cells (teal)" color="var(--im-nk)" opacity={s.F > 0.2 ? 1 : 0}>
			<Label
				x={800}
				y={530}
				text="natural killer cells"
				size={12}
				color="var(--im-nk)"
				opacity={smoothstep(0.2, 0.8, s.F)}
			/>
		</Readout>
		<Readout
			id="lbl-ifn"
			label="Orange dots: interferon"
			color="var(--im-interferon)"
			opacity={s.F > 0.05 ? 1 : 0}
		>
			<Label
				x={480}
				y={290}
				text="interferon alarm"
				size={12}
				weight={600}
				color="var(--im-interferon)"
				opacity={smoothstep(0.05, 0.5, s.F)}
			/>
		</Readout>
		<Readout id="lbl-mac" label="Macrophage (in the mucus)" opacity={macrophage}>
			<Label x={232} y={222} text="macrophage" anchor="end" size={12} opacity={macrophage} />
		</Readout>
	{/if}

	<!-- the end of the infection -->
	{#if goneShow > 0.01 && gone !== null}
		<Readout
			id="gone"
			order={8}
			label="Virus gone on day {Math.round(gone)}"
			value={isSecond
				? `first time: day ${Math.round(firstGone ?? 0)}`
				: 'killer T cells now die off; antibodies stay'}
			opacity={goneShow}
		>
			<g opacity={goneShow}>
				<Label
					x={480}
					y={200}
					text={isSecond
						? `Day ${Math.round(gone)} of the second infection: the virus is gone`
						: `Day ${Math.round(gone)}: the virus is gone`}
					size={16}
					weight={600}
					pill
				/>
				<Label
					x={480}
					y={228}
					text={isSecond
						? `the first time it took ${Math.round(firstGone ?? 0)} days`
						: 'killer T cells now die off; antibodies stay'}
					size={12}
					muted
				/>
			</g>
		</Readout>
	{/if}

	<!-- colour key for the lining -->
	{#each keys as k, i (k.id)}
		<Readout id="key-{k.id}" label={k.label} color={k.color}>
			<rect
				x={k.x - 12}
				y={k.y + i * 20 - 10}
				width="10"
				height="12"
				rx="2"
				fill={k.fill}
				stroke={k.color}
			/>
			<text x={k.x - 18} y={k.y + i * 20} font-size="12" text-anchor="end">{k.label}</text>
		</Readout>
	{/each}

	<!-- counters -->
	<Readout
		id="day"
		order={1}
		label={isSecond ? 'Day of the second infection' : 'Day'}
		value={fmtDay(day)}
	>
		<text x={32} y={52} font-size="16" font-weight="600"
			>Day {fmtDay(day)}{isSecond ? ' of the second infection' : ''}</text
		>
	</Readout>
	<Readout
		id="virus"
		order={2}
		label="Free virus"
		value="{count(s.V)} doses/mL"
		color="var(--im-virus)"
	>
		<text x={32} y={76} font-size="13"
			>virus <tspan font-weight="600">{count(s.V)}</tspan><tspan class="muted" font-size="11" dx="4"
				>doses/mL</tspan
			></text
		>
	</Readout>
	<Readout
		id="infected"
		order={3}
		label="Infected cells"
		value={count(s.I)}
		color="var(--im-infected-edge)"
	>
		<text x={32} y={96} font-size="13"
			>infected cells <tspan font-weight="600">{count(s.I)}</tspan></text
		>
	</Readout>
	{#if view !== 'invasion'}
		<Readout
			id="resistant"
			order={4}
			label="Resistant cells"
			value="{Math.round((100 * s.R) / CAO.T0)}% of the lining"
			color="var(--im-resistant-edge)"
		>
			<text x={32} y={116} font-size="13"
				>resistant <tspan font-weight="600">{Math.round((100 * s.R) / CAO.T0)}%</tspan><tspan
					class="muted"
					font-size="11"
					dx="4">of the lining</tspan
				></text
			>
		</Readout>
	{/if}
	{#if view === 'battle'}
		<Readout
			id="tcells"
			order={5}
			label="Killer T cells"
			value={count(effectors(s))}
			color="var(--im-tcell)"
		>
			<text x={32} y={136} font-size="13"
				>killer T cells <tspan font-weight="600">{count(effectors(s))}</tspan></text
			>
		</Readout>
		<Readout
			id="abs"
			order={6}
			label="Antibodies"
			value="{count(antibody(s))} pg/mL"
			color="var(--im-antibody)"
		>
			<text x={32} y={156} font-size="13"
				>antibodies <tspan font-weight="600">{count(antibody(s))}</tspan><tspan
					class="muted"
					font-size="11"
					dx="4">pg/mL</tspan
				></text
			>
		</Readout>

		<!-- the lymph node, out of sight of the tissue -->
		<g>
			<path
				d="M610 108 C 610 70, 660 62, 690 70 C 720 60, 756 76, 752 108 C 756 140, 720 158, 688 148 C 656 158, 610 146, 610 108 Z"
				fill="var(--im-node)"
				stroke="var(--im-node-edge)"
				stroke-width="1.4"
			/>
			{#each nodeDots as d (d.k)}
				<circle
					cx={d.x}
					cy={d.y}
					r={d.on ? 4 : 2.5}
					fill={d.on
						? d.kind === 't'
							? 'var(--im-tcell)'
							: 'var(--im-bcell)'
						: 'var(--stage-ink-muted)'}
					opacity={d.on ? 1 : 0.45}
				/>
			{/each}
			<Readout
				id="node"
				order={7}
				label="Lymph node: matching {isSecond ? 'memory ' : ''}cells switched on"
				value="T {count(recruitedT)} of {count(poolT)} · B {count(recruitedB)} of {count(poolB)}"
			>
				<text x={682} y={52} font-size="12" font-weight="600" text-anchor="middle">lymph node</text>
				<text x={928} y={96} font-size="11" text-anchor="end" style:fill="var(--im-tcell)"
					>{isSecond ? 'memory ' : ''}T cells switched on</text
				>
				<text
					x={928}
					y={110}
					font-size="12"
					font-weight="600"
					text-anchor="end"
					style:fill="var(--im-tcell)">{count(recruitedT)} of {count(poolT)}</text
				>
				<text x={928} y={134} font-size="11" text-anchor="end" style:fill="var(--im-bcell)"
					>{isSecond ? 'memory ' : ''}B cells switched on</text
				>
				<text
					x={928}
					y={148}
					font-size="12"
					font-weight="600"
					text-anchor="end"
					style:fill="var(--im-bcell)">{count(recruitedB)} of {count(poolB)}</text
				>
			</Readout>
		</g>
		<Readout id="scale-note">
			<text x={928} y={524} font-size="11" class="muted" text-anchor="end"
				>infected cells, virus, T cells, antibodies:</text
			>
			<text x={928} y={538} font-size="11" class="muted" text-anchor="end"
				>log scale, a few more for each tenfold</text
			>
		</Readout>
	{/if}
</g>
