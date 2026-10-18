<script lang="ts">
	/**
	 * Two columns of water joined by a membrane that passes water but not sugar (../model.ts
	 * `Tank`: van 't Hoff's osmotic pressure against the weight of the extra height and a
	 * piston). Sugar molecules bounce about in each column, flashing where they hit the membrane;
	 * water crosses the pores as a stream whose dots advance with the volume moved, so they stop
	 * when the flow stops and run back when it reverses.
	 *
	 * Focus (`step.hints.focus`): 'levels' (controls sugarL, sugarR: the two concentrations and
	 * the height difference) or 'push' (controls sugarL, press: a piston on the left and bars
	 * comparing the sugar's push, the extra height's and the piston's).
	 *
	 * The tank restarts with equal levels when the sugar changes; the piston acts from the moment
	 * it moves (the tank and the clock reading at its start live in a frame-to-frame memo inside
	 * a `$derived`, the guide's sanctioned exception). Reduced motion: the settled state.
	 */
	import { Flow, Label, clamp, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TANK, Tank, vantHoff } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'levels'));
	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const cL0 = $derived(Number(params.sugarL ?? 1));
	const cR0 = $derived(offers('sugarR') ? Number(params.sugarR ?? 0) : 0);
	const press = $derived(offers('press') ? Number(params.press ?? 0) * 1000 : 0);
	const pushing = $derived(focus === 'push');

	const STILL = 60;

	// ---- geometry ------------------------------------------------------------------------------
	const BOT = 540;
	const PXM = 600; // pixels per metre of water
	const LX = 70;
	const MX = 300; // membrane
	const RX = 530;
	const MW = 6;
	const TOP = BOT - TANK.top * PXM;
	const hy = (h: number) => BOT - h * PXM;

	// ---- the tank (memo: see the header comment) ---------------------------------------------
	const key = $derived(`${cL0}|${cR0}${reduced ? `|${press}` : ''}`);
	let memo: { key: string; start: number; last: number; tank: Tank | null } = {
		key: '',
		start: 0,
		last: 0,
		tank: null
	};
	const s = $derived.by(() => {
		if (memo.key !== key || t < memo.last || !memo.tank) {
			const fresh = memo.key === '' || t < memo.last;
			memo = { key, start: fresh ? 0 : t, last: t, tank: new Tank(cL0, cR0, press) };
		}
		memo.last = t;
		memo.tank!.setPress(press);
		return memo.tank!.at(reduced ? STILL : t - memo.start);
	});

	const yL = $derived(hy(s.hL));
	const yR = $derived(hy(s.hR));
	const kPa = (pa: number) => `${(pa / 1000).toFixed(1)} kPa`;
	const cm = (m: number) => `${(m * 100).toFixed(0)} cm`;

	// ---- sugar molecules: straight lines between bounces --------------------------------------
	const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
	const PAD = 9;
	type Mol = { x: number; y: number; hit: boolean };
	const molecules = (
		n: number,
		x0: number,
		x1: number,
		yTop: number,
		side: 'L' | 'R',
		salt: number
	) => {
		const out: Mol[] = [];
		for (let i = 0; i < n; i++) {
			const vx = 0.12 + 0.18 * hash(i, salt);
			const vy = 0.1 + 0.16 * hash(i, salt + 1);
			const u = tri(vx * t + hash(i, salt + 2));
			const v = tri(vy * t + hash(i, salt + 3));
			const xs = x0 + PAD + u * (x1 - x0 - 2 * PAD);
			const ys = yTop + PAD + v * (BOT - yTop - 2 * PAD);
			// the membrane is at u = 1 for the left column and u = 0 for the right one
			const hit = side === 'L' ? u > 0.97 : u < 0.03;
			out.push({ x: xs, y: ys, hit });
		}
		return out;
	};
	const nL = $derived(Math.round(cL0 * 14));
	const nR = $derived(Math.round(cR0 * 14));
	const sugarL = $derived(molecules(nL, LX, MX - MW / 2, yL, 'L', 11));
	const sugarR = $derived(molecules(nR, MX + MW / 2, RX, yR, 'R', 37));

	// ---- water through the pores -------------------------------------------------------------
	/** Three pores near the bottom, always under water (the lowest level the controls reach is
	 * about 10 cm). */
	const pores = [0.015, 0.035, 0.055].map(hy);
	const GAP = 5;
	const membrane = [TOP + 4, ...pores.flatMap((y) => [y - GAP, y + GAP]), BOT].reduce(
		(d, y, i) => d + (i % 2 ? `L${MX} ${y}` : `M${MX} ${y}`),
		''
	);
	const ARROW_Y = hy(0.085);
	/** Volume moved so far, as a phase: dots advance with it (moving left as the left fills). */
	const phase = $derived((s.hL - TANK.h0) * 60);
	const streams = $derived(
		pores.flatMap((y, p) =>
			[0, 1, 2].map((j) => {
				const u = (((-phase + j / 3 + p * 0.17) % 1) + 1) % 1;
				return { key: `${p}-${j}`, x: MX + 22 - u * 44, y, o: Math.sin(Math.PI * u) };
			})
		)
	);
	const flowing = $derived(Math.abs(s.flow) > 2e-4);
	const flowDir = $derived(s.flow > 0 ? 'left' : 'right');

	// ---- the push bars (focus 'push') ----------------------------------------------------------
	const BAR0 = 640;
	const BARW = 270;
	const barMax = $derived(Math.max(5000, s.osmotic, s.hydro + s.press));
	const bx = (pa: number) => (clamp(pa, 0, barMax) / barMax) * BARW;
	const netNote = $derived(
		!flowing
			? 'balanced: no flow'
			: s.flow > 0
				? 'water flows into the left'
				: s.osmotic > 0 && pushing
					? 'water is squeezed out of the sugar water'
					: 'water flows into the right'
	);
	const levels = $derived(
		Math.abs(s.hL - s.hR) < 0.005
			? 'both levels are the same'
			: `${s.hL > s.hR ? 'left' : 'right'} level is ${cm(Math.abs(s.hL - s.hR))} higher`
	);
	const higher = $derived(s.hL >= s.hR ? 'left' : 'right');
</script>

<g>
	<!-- tank -->
	<rect x={LX} y={TOP} width={RX - LX} height={BOT - TOP} fill="var(--stage-bg)" />
	<rect x={LX} y={yL} width={MX - LX} height={BOT - yL} fill="var(--do-water)" />
	<rect x={MX} y={yR} width={RX - MX} height={BOT - yR} fill="var(--do-water)" />
	<line x1={LX} x2={MX} y1={yL} y2={yL} stroke="var(--do-flow)" stroke-width="2" />
	<line x1={MX} x2={RX} y1={yR} y2={yR} stroke="var(--do-flow)" stroke-width="2" />
	<!-- the starting level -->
	<line
		x1={LX}
		x2={RX}
		y1={hy(TANK.h0)}
		y2={hy(TANK.h0)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 5"
		stroke-width="1"
		opacity="0.7"
	/>
	<Readout id="start-level">
		<Label x={LX - 8} y={hy(TANK.h0) + 4} text="start" size={11} anchor="end" muted />
	</Readout>

	<!-- sugar -->
	{#each sugarL as m, i (i)}
		<circle cx={m.x} cy={m.y} r="5" fill="var(--do-sugar)" />
		{#if m.hit}
			<path
				d="M{MX - MW / 2 - 2} {m.y - 7} q 5 7 0 14"
				fill="none"
				stroke="var(--do-sugar)"
				stroke-width="2"
			/>
		{/if}
	{/each}
	{#each sugarR as m, i (i)}
		<circle cx={m.x} cy={m.y} r="5" fill="var(--do-sugar)" />
		{#if m.hit}
			<path
				d="M{MX + MW / 2 + 2} {m.y - 7} q -5 7 0 14"
				fill="none"
				stroke="var(--do-sugar)"
				stroke-width="2"
			/>
		{/if}
	{/each}

	<!-- membrane with pores, and water streaming through them -->
	<path d={membrane} stroke="var(--do-membrane)" stroke-width={MW} />
	{#each streams as w (w.key)}
		<circle cx={w.x} cy={w.y} r="3.4" fill="var(--do-flow)" opacity={0.25 + 0.75 * w.o} />
	{/each}
	{#if flowing}
		<Flow
			d={flowDir === 'left'
				? `M${MX + 46} ${ARROW_Y} L${MX - 40} ${ARROW_Y}`
				: `M${MX - 46} ${ARROW_Y} L${MX + 40} ${ARROW_Y}`}
			color="var(--do-flow)"
			width={2.5}
			arrow
		/>
	{/if}

	<!-- piston -->
	{#if pushing}
		<g opacity={press > 0 ? 1 : 0.45}>
			<rect x={LX + 4} y={yL - 14} width={MX - LX - 10} height="12" rx="3" fill="var(--do-press)" />
			<rect x={(LX + MX) / 2 - 5} y={yL - 70} width="10" height="56" fill="var(--do-press)" />
		</g>
		<Readout id="piston">
			<Label
				x={(LX + MX) / 2 + 12}
				y={yL - 50}
				text="piston: {kPa(press)}"
				size={12}
				weight={600}
				anchor="start"
				color="var(--do-press-text)"
			/>
		</Readout>
	{/if}

	<rect
		x={LX}
		y={TOP}
		width={RX - LX}
		height={BOT - TOP}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Readout id="membrane-key">
		<Label
			x={MX}
			y={TOP - 10}
			text="membrane: water passes, sugar does not"
			size={12}
			color="var(--do-membrane-text)"
			weight={600}
		/>
	</Readout>
	<Readout id="col-l" order={1} label="Left" value="{s.cL.toFixed(2)} mmol/L sugar">
		<Label
			x={(LX + MX) / 2}
			y={BOT + 22}
			text="left: {s.cL.toFixed(2)} mmol/L sugar"
			size={12}
			tabular
		/>
	</Readout>
	<Readout id="col-r" order={2} label="Right" value="{s.cR.toFixed(2)} mmol/L sugar">
		<Label
			x={(MX + RX) / 2}
			y={BOT + 22}
			text={s.cR > 0 ? `right: ${s.cR.toFixed(2)} mmol/L sugar` : 'right: pure water'}
			size={12}
			tabular
		/>
	</Readout>

	<!-- right-hand panel -->
	<Readout id="diff" order={3} label="Levels" value={levels} color="var(--do-flow)">
		<Label x={BAR0} y={70} text={levels} size={15} weight={600} anchor="start" tabular />
	</Readout>
	<Readout id="flow" order={5} label="Water" value={netNote}>
		<Label
			x={BAR0}
			y={96}
			text={netNote}
			size={13}
			anchor="start"
			color={flowing ? 'var(--do-flow-text)' : undefined}
			weight={600}
		/>
	</Readout>

	{#if !pushing}
		<Readout id="push-l" order={6}>
			<Label
				x={BAR0}
				y={150}
				text="sugar left pushes with {kPa(vantHoff(s.cL))}"
				size={12}
				anchor="start"
				tabular
			/>
			<Label
				x={BAR0}
				y={172}
				text="sugar right pushes with {kPa(vantHoff(s.cR))}"
				size={12}
				anchor="start"
				tabular
			/>
			<Label
				x={BAR0}
				y={194}
				text="the {higher} side's extra height pushes back with {kPa(Math.abs(s.hydro))}"
				size={12}
				anchor="start"
				tabular
			/>
			<Label
				x={BAR0}
				y={226}
				text="flow stops when the pushes balance"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
		<Readout id="dots-key">
			<Label x={BAR0} y={280} text="orange: sugar molecules" size={12} anchor="start" />
			<Label
				x={BAR0}
				y={300}
				text="blue: water crossing the pores"
				size={12}
				anchor="start"
				color="var(--do-flow-text)"
			/>
		</Readout>
	{:else}
		{@const rows = [
			{
				id: 'osm',
				label: 'trapped sugar pushes water in',
				v: s.osmotic,
				color: 'var(--do-sugar)'
			},
			{
				id: 'hyd',
				label:
					s.hydro >= 0
						? "left's extra height pushes water out"
						: "right's extra height pushes water in",
				v: Math.abs(s.hydro),
				color: 'var(--do-flow)'
			},
			{ id: 'pst', label: 'piston pushes water out', v: s.press, color: 'var(--do-press)' }
		]}
		{#each rows as r, i (r.id)}
			<Readout id="bar-{r.id}" order={6 + i} label={r.label} value={kPa(r.v)}>
				<Label x={BAR0} y={146 + i * 54} text={r.label} size={12} anchor="start" />
				<Label
					x={BAR0 + BARW}
					y={146 + i * 54}
					text={kPa(r.v)}
					size={12}
					anchor="end"
					weight={600}
					tabular
				/>
			</Readout>
			<rect x={BAR0} y={154 + i * 54} width={BARW} height="14" rx="3" fill="var(--stage-grid)" />
			<rect x={BAR0} y={154 + i * 54} width={bx(r.v)} height="14" rx="3" fill={r.color} />
		{/each}
		<Readout id="push-note">
			<Label
				x={BAR0}
				y={330}
				text="pushes into the left against pushes out of it:"
				size={11}
				anchor="start"
				muted
			/>
			<Label
				x={BAR0}
				y={348}
				text="whichever is bigger wins, and water flows that way"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
