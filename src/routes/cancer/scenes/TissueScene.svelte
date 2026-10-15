<script lang="ts">
	/**
	 * A patch of tissue seen from above (`simulate` in ../model.ts): one dot per cell, coloured
	 * by the driver mutations it carries, and on the right what the patch is made of,
	 * generation by generation. The run is computed once per setting (../run.ts) and replayed
	 * as a pure function of t; reduced motion shows the run's last interesting generation.
	 *
	 * Views (step.hints.view): balance, passengers, driver, hits, repair, treat, combo, recap.
	 * Controls: params.again (new seed), rate, repair, treat, therapy.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		H,
		KINDS,
		DETECT,
		KIND_MASK,
		Kind,
		MUTATOR,
		PARTIAL,
		SITES,
		W,
		count,
		living,
		tumour
	} from '../model';
	import { generationAt, plan, run, setup } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const s = $derived(setup(step, params));
	const view = $derived(s.view);
	const r = $derived(run(s.scenario));
	const p = $derived(plan(view, r));
	const G = $derived(r.scenario.gens);

	// ---- time: restarts when the run is replaced by a control --------------------------
	const restartKey = $derived(
		`${view}|${String(params.again ?? 0)}|${String(params.rate ?? 1)}|${String(params.repair ?? true)}|${String(params.therapy ?? 'one')}`
	);
	let startedKey = '';
	let startedAt = 0;
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (restartKey !== startedKey || t < lastT) {
			startedAt = startedKey === '' || t < lastT ? 0 : t;
			startedKey = restartKey;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});
	const LEAD = 0.6;
	const gen = $derived(
		reduced ? p.still : Math.max(0, generationAt(p, r.found, Math.max(0, tRun - LEAD)))
	);

	// ---- the lattice --------------------------------------------------------------------
	const PITCH = 14;
	const LX = 28;
	const LY = 62;
	const R = 6.1;
	const LW = W * PITCH;
	const LH = H * PITCH;
	const cx = (i: number) => LX + (i % W) * PITCH + PITCH / 2;
	const cy = (i: number) => LY + Math.floor(i / W) * PITCH + PITCH / 2;
	const circle = (x: number, y: number, rr: number) =>
		`M${(x - rr).toFixed(1)} ${y.toFixed(1)}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`;

	/** Passenger shading bins (upper bounds). */
	const PASS_BINS = [10, 20, 40, Infinity];
	const PASS_OPACITY = [0.18, 0.42, 0.7, 1];

	const paths = $derived.by(() => {
		const base = gen * SITES;
		const kinds: string[][] = Array.from({ length: KINDS }, () => []);
		const ring: string[] = [];
		const partial: string[] = [];
		const dots: string[] = [];
		const pass: string[][] = PASS_BINS.map(() => []);
		const shadePassengers = view === 'passengers';
		for (let i = 0; i < SITES; i++) {
			const c = r.cells[base + i];
			const k = c & KIND_MASK;
			if (k === Kind.Empty) continue;
			const x = cx(i);
			const y = cy(i);
			const d = circle(x, y, R);
			if (shadePassengers) {
				const n = r.passengers[base + i];
				pass[PASS_BINS.findIndex((b) => n < b)].push(d);
				continue;
			}
			kinds[k === Kind.OneHit ? Kind.Normal : k].push(d);
			if (k === Kind.OneHit) ring.push(circle(x, y, R - 0.9));
			if (c & PARTIAL) partial.push(circle(x, y, R - 1.2));
			if (c & MUTATOR) dots.push(circle(x, y, 1.7));
		}
		return {
			kinds: kinds.map((a) => a.join('')),
			ring: ring.join(''),
			partial: partial.join(''),
			dots: dots.join(''),
			pass: pass.map((a) => a.join(''))
		};
	});

	const FILL: Record<number, string> = {
		[Kind.Normal]: 'var(--ca-normal)',
		[Kind.Kras]: 'var(--ca-kras)',
		[Kind.P53]: 'var(--ca-p53)',
		[Kind.Cancer]: 'var(--ca-cancer)',
		[Kind.Resistant]: 'var(--ca-resistant)'
	};
	const DRAWN = [Kind.Normal, Kind.Kras, Kind.P53, Kind.Cancer, Kind.Resistant];

	// ---- the chart ----------------------------------------------------------------------
	const CX0 = 640;
	const CX1 = 932;
	const CY0 = 250;
	const CY1 = 500;
	/** Treatment views zoom the chart on the tumour: from 100 generations before it is found. */
	const treatView = $derived(view === 'treat' || view === 'combo' || view === 'recap');
	const G0 = $derived(treatView && r.found !== null ? Math.max(0, r.found - 100) : 0);
	const sx = $derived(scale([G0, p.end], [CX0, CX1]));
	const STEP = $derived(Math.max(1, Math.ceil((p.end - G0) / 240)));
	const samples = $derived.by(() => {
		const out: number[] = [];
		for (let g = G0; g <= p.end; g += STEP) out.push(g);
		if (out[out.length - 1] !== p.end) out.push(p.end);
		return out;
	});

	/** Stacked areas: share of the patch held by each kind (bottom to top). */
	const STACK = [Kind.Normal, Kind.OneHit, Kind.Kras, Kind.P53, Kind.Cancer, Kind.Resistant];
	const STACK_FILL: Record<number, string> = {
		...FILL,
		[Kind.OneHit]: 'var(--ca-onehit)'
	};
	const syShare = scale([0, 1], [CY1, CY0]);
	const areas = $derived.by(() => {
		const lower = samples.map(() => 0);
		return STACK.map((k) => {
			const upper = samples.map((g, j) => lower[j] + count(r, g, k) / SITES);
			const top = samples.map((g, j) => `${sx(g).toFixed(1)},${syShare(upper[j]).toFixed(1)}`);
			const bottom = samples
				.map((g, j) => `${sx(g).toFixed(1)},${syShare(lower[j]).toFixed(1)}`)
				.reverse();
			upper.forEach((u, j) => (lower[j] = u));
			const any = samples.some((g) => count(r, g, k) > 0);
			return { k, d: any ? `M${top.join('L')}L${bottom.join('L')}Z` : '' };
		}).filter((a) => a.d);
	});

	const passMax = $derived(
		Math.max(10, Math.ceil((r.meanPassengers[Math.min(G, p.end)] * 1.15) / 10) * 10)
	);
	const syPass = $derived(scale([0, passMax], [CY1, CY0]));
	const passLine = $derived(
		'M' +
			samples.map((g) => `${sx(g).toFixed(1)},${syPass(r.meanPassengers[g]).toFixed(1)}`).join('L')
	);
	const syLiving = scale([0, SITES], [CY1, CY0]);
	const livingLine = $derived(
		'M' + samples.map((g) => `${sx(g).toFixed(1)},${syLiving(living(r, g)).toFixed(1)}`).join('L')
	);

	const chartKind = $derived(
		view === 'balance'
			? 'living'
			: view === 'passengers'
				? 'passengers'
				: treatView
					? 'tumour'
					: 'share'
	);

	/** Treatment views: the tumour's size, resistant cells at the bottom. */
	const tumourMax = $derived.by(() => {
		let m = DETECT;
		for (const g of samples) m = Math.max(m, tumour(r, g));
		return Math.ceil((m * 1.1) / 100) * 100;
	});
	const syTum = $derived(scale([0, tumourMax], [CY1, CY0]));
	const tumourAreas = $derived.by(() => {
		const res = samples.map((g) => count(r, g, Kind.Resistant));
		const all = samples.map((g) => tumour(r, g));
		const pts = (ys: number[]) =>
			samples.map((g, j) => `${sx(g).toFixed(1)},${syTum(ys[j]).toFixed(1)}`);
		const zero = samples.map(() => 0);
		const area = (hi: number[], lo: number[]) =>
			`M${pts(hi).join('L')}L${pts(lo).reverse().join('L')}Z`;
		return { res: area(res, zero), sens: area(all, res) };
	});

	// ---- events -------------------------------------------------------------------------
	const events = $derived.by(() => {
		const out: { g: number; text: string; key: string }[] = [];
		if (view === 'balance' || view === 'passengers' || view === 'driver') return out;
		if (r.found !== null && r.found <= p.end)
			out.push({
				g: r.found,
				text: r.treatedAt !== null ? 'found · treated' : 'tumour found',
				key: 'found'
			});
		if (r.relapse !== null && r.cleared === null && r.relapse <= p.end)
			out.push({ g: r.relapse, text: 'back', key: 'relapse' });
		if (r.cleared !== null && r.cleared <= p.end)
			out.push({ g: r.cleared, text: 'cleared', key: 'cleared' });
		return out;
	});

	// ---- readouts -----------------------------------------------------------------------
	const cancerNow = $derived(tumour(r, gen));
	const resistantNow = $derived(count(r, gen, Kind.Resistant));
	const treating = $derived(r.treatedAt !== null && gen >= r.treatedAt);
	const early = $derived(
		cancerNow > 0 ? 'a tumour is starting, too small to find' : 'no tumour yet'
	);
	const status = $derived.by(() => {
		if (view === 'treat' || view === 'combo' || view === 'recap') {
			if (r.found === null || gen < r.found) return early;
			if (r.treatedAt === null) return 'untreated';
			if (r.cleared !== null && gen >= r.cleared) return 'tumour cleared';
			if (r.relapse !== null && gen >= r.relapse) return 'back, resistant to the drug';
			return 'under treatment';
		}
		if (view === 'hits' || view === 'repair') {
			if (r.found === null || gen < r.found) return early;
			return `tumour found at generation ${r.found}`;
		}
		return '';
	});
	const fmt = (n: number) => n.toLocaleString('en-US');

	// ---- legend -------------------------------------------------------------------------
	type Key = {
		id: string;
		label: string;
		fill?: string;
		ring?: string;
		dot?: boolean;
		gap?: boolean;
	};
	const legend = $derived.by((): Key[] => {
		const normal: Key = { id: 'normal', label: 'normal cell', fill: 'var(--ca-normal)' };
		const gap: Key = { id: 'gap', label: 'gap: a cell just died', gap: true };
		const krasK: Key = { id: 'kras', label: 'KRAS on', fill: 'var(--ca-kras)' };
		const one: Key = {
			id: 'onehit',
			label: 'one TP53 copy hit',
			fill: 'var(--ca-normal)',
			ring: 'var(--ca-onehit)'
		};
		const p53: Key = { id: 'p53', label: 'both TP53 copies hit', fill: 'var(--ca-p53)' };
		const cancer: Key = { id: 'cancer', label: 'cancer: both', fill: 'var(--ca-cancer)' };
		const res: Key = {
			id: 'res',
			label: s.scenario.therapy === 'two' ? 'resists both drugs' : 'resists the drug',
			fill: 'var(--ca-resistant)'
		};
		const part: Key = {
			id: 'partial',
			label: 'resists one of the two',
			fill: 'var(--ca-cancer)',
			ring: 'var(--ca-partial)'
		};
		const mut: Key = {
			id: 'mut',
			label: 'repair gene broken',
			fill: 'var(--ca-normal)',
			dot: true
		};
		switch (view) {
			case 'balance':
				return [normal, gap];
			case 'passengers':
				return [];
			case 'driver':
				return [normal, krasK, gap];
			case 'hits':
				return [normal, one, krasK, p53, cancer];
			case 'repair':
				return [normal, one, krasK, p53, cancer, mut];
			case 'combo':
				return s.scenario.therapy === 'two'
					? [normal, one, krasK, p53, cancer, part, res]
					: [normal, one, krasK, p53, cancer, res];
			default:
				return [normal, one, krasK, p53, cancer, res];
		}
	});
	const LEG_X = [LX, LX + 180, LX + 360];
	const LEG_Y = LY + LH + 30;

	const heading = $derived(
		{
			balance: 'A patch of tissue in balance',
			passengers: 'Mutations each cell carries',
			driver: 'Mutations can switch KRAS on',
			hits: 'KRAS and TP53 can be hit',
			repair: params.repair === false ? 'KRAS and TP53 can be hit' : 'KRAS, TP53 and a repair gene',
			treat: params.treat === false ? 'Untreated' : 'One drug, from when the tumour is found',
			combo:
				params.treat === false
					? 'Untreated'
					: s.scenario.therapy === 'two'
						? 'Two drugs at once'
						: 'One drug',
			recap: 'The whole story: one drug once the tumour is found'
		}[view]
	);
	const chartTitle = $derived(
		chartKind === 'living'
			? 'cells in the patch'
			: chartKind === 'passengers'
				? 'mutations per cell, on average'
				: chartKind === 'tumour'
					? 'cancer cells in the patch'
					: 'what the patch is made of'
	);
</script>

<g class="tissue-scene">
	<defs>
		<clipPath id="tissue-chart-clip">
			<rect x={CX0 - 1} y={CY0 - 2} width={Math.max(0, sx(gen) - CX0 + 1)} height={CY1 - CY0 + 4} />
		</clipPath>
	</defs>

	<!-- ===================== left: the tissue ===================== -->
	<Readout id="heading">
		<text x={LX} y={42} font-size="15" font-weight="600">{heading}</text>
	</Readout>
	<rect
		x={LX - 6}
		y={LY - 6}
		width={LW + 12}
		height={LH + 12}
		rx="10"
		fill="var(--ca-tissue)"
		stroke="var(--border)"
	/>
	{#if view === 'passengers'}
		{#each paths.pass as d, b (b)}
			{#if d}
				<path {d} fill="var(--ca-pass)" fill-opacity={PASS_OPACITY[b]} />
			{/if}
		{/each}
	{:else}
		{#each DRAWN as k (k)}
			{#if paths.kinds[k]}
				<path d={paths.kinds[k]} fill={FILL[k]} />
			{/if}
		{/each}
		{#if paths.ring}
			<path d={paths.ring} fill="none" stroke="var(--ca-onehit)" stroke-width="1.8" />
		{/if}
		{#if paths.partial}
			<path d={paths.partial} fill="none" stroke="var(--ca-partial)" stroke-width="2.2" />
		{/if}
		{#if paths.dots}
			<path d={paths.dots} fill="var(--ca-mutator)" />
		{/if}
	{/if}
	{#if treating}
		<Readout id="drug" label="Drug given" value="since generation {r.treatedAt}">
			<Label
				x={LX + LW}
				y={42}
				text={s.scenario.therapy === 'two' ? 'drugs A + B given' : 'drug given'}
				anchor="end"
				color="var(--ca-drug)"
				pill
			/>
		</Readout>
	{/if}

	<!-- legend -->
	{#if view === 'passengers'}
		<Readout id="pass-key" label="Darker: more mutations">
			<g>
				{#each PASS_OPACITY as op, i (i)}
					<circle cx={LX + 8 + i * 22} cy={LEG_Y} r={R} fill="var(--ca-pass)" fill-opacity={op} />
				{/each}
				<text x={LX + 100} y={LEG_Y + 4} font-size="12"
					>0–9 · 10–19 · 20–39 · 40 or more mutations</text
				>
				<text x={LX} y={LEG_Y + 30} font-size="12" class="muted"
					>Passengers only: none of them changes how a cell behaves.</text
				>
			</g>
		</Readout>
	{:else}
		{#each legend as key, i (key.id)}
			{@const x = LEG_X[i % 3]}
			{@const y = LEG_Y + Math.floor(i / 3) * 26}
			<Readout id="key-{key.id}" order={20 + i} label={key.label} color={key.ring ?? key.fill}>
				<g>
					{#if key.gap}
						<circle
							cx={x + 8}
							cy={y}
							r={R}
							fill="none"
							stroke="var(--stage-line)"
							stroke-dasharray="2 2"
						/>
					{:else}
						<circle cx={x + 8} cy={y} r={R} fill={key.fill} />
						{#if key.ring}
							<circle
								cx={x + 8}
								cy={y}
								r={R - (key.id === 'partial' ? 1.2 : 0.9)}
								fill="none"
								stroke={key.ring}
								stroke-width={key.id === 'partial' ? 2.2 : 1.8}
							/>
						{/if}
						{#if key.dot}
							<circle cx={x + 8} cy={y} r="1.7" fill="var(--ca-mutator)" />
						{/if}
					{/if}
					<text x={x + 22} y={y + 4} font-size="12">{key.label}</text>
				</g>
			</Readout>
		{/each}
	{/if}

	<!-- ===================== right: numbers and chart ===================== -->
	<Readout id="gen" order={1} label="Generation" value={fmt(gen)}>
		<text x={600} y={74} font-size="12" class="muted">cell generation</text>
		<text x={600} y={98} font-size="22" font-weight="600">{fmt(gen)}</text>
	</Readout>
	{#if view === 'balance'}
		<Readout id="living" order={2} label="Cells" value={fmt(living(r, gen))}>
			<text x={760} y={74} font-size="12" class="muted">cells</text>
			<text x={760} y={98} font-size="22" font-weight="600">{fmt(living(r, gen))}</text>
		</Readout>
		<Readout id="divs" order={3} label="Divisions this generation" value={fmt(r.divisions[gen])}>
			<text x={600} y={136} font-size="13"
				>{fmt(r.divisions[gen])} divisions this generation, filling the gaps</text
			>
		</Readout>
	{:else if view === 'passengers'}
		<Readout
			id="pass"
			order={2}
			label="Mutations per cell (average)"
			value={r.meanPassengers[gen].toFixed(1)}
		>
			<text x={760} y={74} font-size="12" class="muted">mutations per cell</text>
			<text x={760} y={98} font-size="22" font-weight="600">{r.meanPassengers[gen].toFixed(1)}</text
			>
		</Readout>
	{:else if view === 'driver'}
		<Readout
			id="krasn"
			order={2}
			label="Cells with KRAS on"
			value={fmt(count(r, gen, Kind.Kras))}
			color="var(--ca-kras)"
		>
			<text x={760} y={74} font-size="12" class="muted">cells with KRAS on</text>
			<text x={760} y={98} font-size="22" font-weight="600">{fmt(count(r, gen, Kind.Kras))}</text>
		</Readout>
	{:else}
		<Readout
			id="tum"
			order={2}
			label="Cancer cells"
			value={fmt(cancerNow)}
			color="var(--ca-cancer)"
		>
			<text x={760} y={74} font-size="12" class="muted">cancer cells</text>
			<text x={760} y={98} font-size="22" font-weight="600">{fmt(cancerNow)}</text>
		</Readout>
		{#if view === 'treat' || view === 'combo' || view === 'recap'}
			<Readout
				id="res"
				order={3}
				label="Resistant"
				value={fmt(resistantNow)}
				color="var(--ca-resistant)"
			>
				<text x={860} y={74} font-size="12" class="muted">resistant</text>
				<text x={860} y={98} font-size="22" font-weight="600" style:fill="var(--ca-resistant)"
					>{fmt(resistantNow)}</text
				>
			</Readout>
		{/if}
		<Readout id="status" order={4} label="Now" value={status}>
			<text x={600} y={136} font-size="13">{status}</text>
		</Readout>
	{/if}

	<!-- chart -->
	<Readout id="chart-title">
		<text x={CX0} y={CY0 - 36} font-size="12" class="muted">{chartTitle}</text>
	</Readout>
	{#if chartKind === 'share'}
		<Axes
			{sx}
			sy={syShare}
			yTicks={[0, 0.5, 1]}
			yFormat={(v) => `${Math.round(v * 100)}%`}
			xLabel="cell generations"
		/>
		<g clip-path="url(#tissue-chart-clip)">
			{#each areas as a (a.k)}
				<path d={a.d} fill={STACK_FILL[a.k]} opacity="0.9" />
			{/each}
		</g>
	{:else if chartKind === 'tumour'}
		<Axes {sx} sy={syTum} xLabel="cell generations" />
		<g clip-path="url(#tissue-chart-clip)">
			<path d={tumourAreas.sens} fill="var(--ca-cancer)" opacity="0.9" />
			<path d={tumourAreas.res} fill="var(--ca-resistant)" opacity="0.9" />
		</g>
		<line
			x1={CX0}
			x2={CX1}
			y1={syTum(DETECT)}
			y2={syTum(DETECT)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Readout id="detect-key">
			<Label
				x={CX0 + 6}
				y={syTum(DETECT) - 6}
				text="size when found"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else if chartKind === 'passengers'}
		<Axes {sx} sy={syPass} xLabel="cell generations" />
		<path
			d={passLine}
			fill="none"
			stroke="var(--ca-pass)"
			stroke-width="2.6"
			clip-path="url(#tissue-chart-clip)"
		/>
	{:else}
		<Axes {sx} sy={syLiving} yTicks={[0, 500, 1000]} xLabel="cell generations" />
		<path
			d={livingLine}
			fill="none"
			stroke="var(--ca-normal-edge)"
			stroke-width="2.6"
			clip-path="url(#tissue-chart-clip)"
		/>
		<Readout id="flat">
			<Label
				x={(CX0 + CX1) / 2}
				y={syLiving(SITES) + 30}
				text="divisions replace losses: the size holds"
				size={12}
				muted
			/>
		</Readout>
	{/if}
	{#each events as e, i (e.key)}
		{#if gen >= e.g}
			<line
				x1={sx(e.g)}
				x2={sx(e.g)}
				y1={CY0 - 2}
				y2={CY1}
				stroke="var(--stage-ink)"
				stroke-dasharray="3 3"
				opacity="0.7"
			/>
			<Readout id="ev-{e.key}">
				<Label
					x={sx(e.g)}
					y={CY0 - 12 - (i % 2) * 14}
					text={e.text}
					size={11}
					anchor={sx(e.g) > CX1 - 60 ? 'end' : sx(e.g) < CX0 + 50 ? 'start' : 'middle'}
				/>
			</Readout>
		{/if}
	{/each}
	<line
		x1={sx(gen)}
		x2={sx(gen)}
		y1={CY0}
		y2={CY1}
		stroke="var(--stage-ink-muted)"
		opacity={gen < p.end && gen >= G0 ? 0.6 : 0}
	/>
</g>
