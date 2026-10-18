<script lang="ts">
	/**
	 * The three moves of the ZGB model on a 12 × 12 surface, one arrival at a time (left), beside
	 * a card for each move (right), the card of the latest move lit.
	 *
	 * The surface is a `Surface` run for `PRE` trials at the step's y before the step starts (so
	 * it is already partly covered), then advanced one trial every 1 / EV_RATE seconds of `t`.
	 * Within each trial's interval the arriving molecule falls onto its site(s) (phase 0–0.35),
	 * the surface switches to its new state, and any CO₂ made rises and fades (0.35–1); a molecule
	 * that finds its site taken bounces back up. Changing y carries on from the current surface.
	 * Reduced motion: the surface after the first trial past t = 2.5 s that made CO₂, drawn
	 * complete, with that trial's sites ringed.
	 */
	import { Label, Molecule, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CO, EMPTY, O, Surface, type Event } from '../zgb';
	import { numberFrom } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const y = $derived(numberFrom(step, params, 'y', 0.5));

	const N = 12;
	const PRE = 150;
	const EV_RATE = 3;
	const LAND = 0.35;

	class SmallRun {
		readonly s = new Surface(N, N, 2024);
		readonly prev = new Uint8Array(N * N);
		count = 0;
		madeCO2 = 0;
		bounced = 0;
		last: Event = { kind: 'co', site: 0, site2: 0, stuck: false, reacted: [] };
		constructor(yy: number) {
			for (let i = 0; i < PRE; i++) this.s.trial(yy, 0);
			this.s.co2 = 0;
		}
		next(yy: number) {
			this.prev.set(this.s.s);
			this.s.trial(yy, 0, true);
			const e = this.s.last;
			this.last = { ...e, reacted: e.reacted.map((p) => [p[0], p[1]] as [number, number]) };
			this.count++;
			if (!e.stuck) this.bounced++;
		}
		advance(n: number, yy: number) {
			let i = 0;
			while (this.count < n && i++ < 200) this.next(yy);
		}
	}

	let run: SmallRun | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	let reducedRun: SmallRun | null = null;
	let reducedY = -1;

	const current = $derived.by((): { run: SmallRun; n: number; phase: number } => {
		const time = t;
		if (reduced) {
			if (!reducedRun || reducedY !== y) {
				reducedRun = new SmallRun(y);
				reducedRun.advance(Math.floor(2.5 * EV_RATE), y);
				for (let i = 0; i < 200 && reducedRun.last.reacted.length === 0; i++) reducedRun.next(y);
				reducedY = y;
			}
			return { run: reducedRun, n: reducedRun.count, phase: 1 };
		}
		if (!run || runKey !== step.id || time < lastT - 1e-6) {
			run = new SmallRun(y);
			runKey = step.id;
			t0 = time;
		}
		lastT = time;
		const u = (time - t0) * EV_RATE;
		run.advance(Math.floor(u) + 1, y);
		return { run, n: run.count, phase: u - Math.floor(u) };
	});

	// ---- geometry ------------------------------------------------------------------------------
	const GX = 40;
	const GY = 100;
	const CELL = 34;
	const GS = N * CELL;
	const cx = (i: number) => GX + (i % N) * CELL + CELL / 2;
	const cy = (i: number) => GY + Math.floor(i / N) * CELL + CELL / 2;
	const gridPath = (() => {
		let d = '';
		for (let i = 1; i < N; i++) {
			d += `M${GX + i * CELL} ${GY}v${GS}`;
			d += `M${GX} ${GY + i * CELL}h${GS}`;
		}
		return d;
	})();

	const ev = $derived(current.run.last);
	const landed = $derived(current.phase >= LAND);
	/** The state drawn: the one before the arrival until it lands, the new one after. */
	const sites = $derived.by(() => {
		void current.n;
		const src = landed ? current.run.s.s : current.run.prev;
		const out: { i: number; v: number }[] = [];
		for (let i = 0; i < N * N; i++) if (src[i] !== EMPTY) out.push({ i, v: src[i] });
		return out;
	});

	// the arriving molecule: falls in 0–LAND, a bounced one goes back up and fades in LAND–0.75
	const fall = $derived(smoothstep(0, LAND, current.phase));
	const target = $derived(
		ev.kind === 'o2'
			? { x: (cx(ev.site) + cx(ev.site2)) / 2, y: (cy(ev.site) + cy(ev.site2)) / 2 }
			: { x: cx(ev.site), y: cy(ev.site) }
	);
	const incoming = $derived.by(() => {
		if (reduced || ev.kind === 'desorb') return null;
		const p = current.phase;
		const top = GY - 40;
		if (p < LAND) return { y: top + (target.y - top) * fall, opacity: smoothstep(0, 0.08, p) };
		if (!ev.stuck && p < 0.75) {
			const u = smoothstep(LAND, 0.75, p);
			return { y: target.y - 50 * u, opacity: 1 - u };
		}
		return null;
	});
	/** O₂ wraps across the edge when its two sites are on opposite sides: draw it at the first. */
	const wraps = $derived(
		ev.kind === 'o2' &&
			(Math.abs(cx(ev.site) - cx(ev.site2)) > CELL || Math.abs(cy(ev.site) - cy(ev.site2)) > CELL)
	);
	const o2Angle = $derived(
		ev.kind === 'o2' && !wraps ? (cy(ev.site) === cy(ev.site2) ? 0 : 90) : 0
	);
	const fallX = $derived(wraps ? cx(ev.site) : target.x);
	const fallY = $derived(wraps ? cy(ev.site) : target.y);
	const incomingY = $derived(incoming ? (wraps ? incoming.y - target.y + fallY : incoming.y) : 0);

	// CO₂ leaving: rises and fades in LAND–1
	const rise = $derived(reduced ? 0.3 : smoothstep(LAND, 1, current.phase));
	const co2Opacity = $derived(reduced ? 1 : landed ? 1 - smoothstep(0.75, 1, current.phase) : 0);

	// ---- the cards -----------------------------------------------------------------------------
	const PX = 520;
	const PW = 404;
	const moveLit = $derived({
		co: ev.kind === 'co' && ev.stuck,
		o2: ev.kind === 'o2' && ev.stuck,
		react: ev.reacted.length > 0
	});
	const caption = $derived.by(() => {
		const e = ev;
		if (e.kind === 'co')
			return e.stuck
				? e.reacted.length
					? 'CO landed next to an O: they reacted into CO₂, which left'
					: 'CO landed on an empty site'
				: 'CO hit a full site and bounced off';
		if (e.kind === 'o2')
			return e.stuck
				? e.reacted.length
					? `O₂ split onto two empty sites; ${e.reacted.length === 1 ? 'one O' : 'both O'} met a CO and left as CO₂`
					: 'O₂ split onto two empty neighbouring sites'
				: 'O₂ needed two empty neighbours, did not find them, and bounced';
		return '';
	});
	const cards = [
		{ id: 'co', y: 84, title: 'CO lands on one empty site' },
		{ id: 'o2', y: 194, title: 'O₂ splits onto two empty neighbours' },
		{ id: 'react', y: 304, title: 'CO next to O → CO₂, which leaves' }
	] as const;
	const CARD_H = 96;
</script>

{#snippet coBead(x: number, yy: number, opacity = 1)}
	<g {opacity}>
		<circle cx={x - 3} cy={yy} r="9" fill="var(--sc-co)" />
		<circle cx={x + 6} cy={yy} r="6.5" fill="var(--sc-o)" />
	</g>
{/snippet}
{#snippet oBead(x: number, yy: number, opacity = 1)}
	<circle cx={x} cy={yy} r="8" fill="var(--sc-o)" {opacity} />
{/snippet}
{#snippet cellBox(x: number, yy: number, w = 30)}
	<rect
		x={x - w / 2}
		y={yy - w / 2}
		width={w}
		height={w}
		rx="3"
		fill="var(--sc-empty)"
		stroke="var(--stage-line)"
	/>
{/snippet}

<g>
	<!-- ---------------------------------------------------------------- the surface -->
	<Readout id="surface" order={1} label="12 × 12 sites" value="CO fraction y = {y.toFixed(3)}">
		<Label
			anchor="start"
			x={GX}
			y={40}
			text="12 × 12 sites · CO fraction y = {y.toFixed(3)}"
			size={15}
			weight={600}
		/>
	</Readout>
	<rect
		x={GX}
		y={GY}
		width={GS}
		height={GS}
		fill="var(--sc-empty)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={gridPath} stroke="var(--stage-line)" stroke-width="0.6" opacity="0.6" fill="none" />
	{#each sites as c (c.i)}
		{#if c.v === CO}
			{@render coBead(cx(c.i), cy(c.i))}
		{:else if c.v === O}
			{@render oBead(cx(c.i), cy(c.i))}
		{/if}
	{/each}

	<!-- the latest arrival's site(s) -->
	{#each ev.kind === 'o2' ? [ev.site, ev.site2] : [ev.site] as i (i)}
		<rect
			x={cx(i) - CELL / 2 + 1.5}
			y={cy(i) - CELL / 2 + 1.5}
			width={CELL - 3}
			height={CELL - 3}
			rx="4"
			fill="none"
			stroke={ev.stuck ? 'var(--sc-rate)' : 'var(--stage-ink-muted)'}
			stroke-width="2.5"
			stroke-dasharray={ev.stuck ? undefined : '4 3'}
		/>
	{/each}
	<!-- sites freed by a reaction -->
	{#if landed || reduced}
		{#each ev.reacted as p (p[0] * 1000 + p[1])}
			{#each p as i (i)}
				<rect
					x={cx(i) - CELL / 2 + 1.5}
					y={cy(i) - CELL / 2 + 1.5}
					width={CELL - 3}
					height={CELL - 3}
					rx="4"
					fill="none"
					stroke="var(--sc-rate)"
					stroke-width="2"
					stroke-dasharray="3 3"
				/>
			{/each}
			<Molecule
				kind="CO2"
				x={(cx(p[0]) + cx(p[1])) / 2}
				y={(cy(p[0]) + cy(p[1])) / 2 - 8 - 60 * rise}
				scale={0.7}
				opacity={co2Opacity}
			/>
		{/each}
	{/if}
	<!-- the arriving molecule -->
	{#if incoming}
		{#if ev.kind === 'co'}
			{@render coBead(fallX, incomingY, incoming.opacity)}
		{:else}
			<Molecule
				kind="O2"
				x={fallX}
				y={incomingY}
				scale={0.75}
				rotate={o2Angle}
				opacity={incoming.opacity}
			/>
		{/if}
	{/if}

	<Readout id="last" order={2} label="Latest arrival" value={caption}>
		<Label anchor="start" x={GX} y={GY + GS + 30} text={caption} size={13} />
	</Readout>
	<Readout
		id="count"
		order={3}
		label="Arrivals · CO₂ made · bounced"
		value="{current.n} · {current.run.s.co2} · {current.run.bounced}"
	>
		<Label
			anchor="start"
			x={GX}
			y={GY + GS + 52}
			text="{current.n} arrivals · {current.run.s.co2} CO₂ made · {current.run
				.bounced} bounced off a full site"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- the moves -->
	<Label anchor="start" x={PX} y={40} text="The moves" size={15} weight={600} />
	{#each cards as card (card.id)}
		{@const lit = moveLit[card.id]}
		<g opacity={lit ? 1 : 0.5}>
			<rect
				x={PX}
				y={card.y}
				width={PW}
				height={CARD_H}
				rx="10"
				fill="var(--surface)"
				stroke={lit ? 'var(--sc-rate)' : 'var(--border)'}
				stroke-width={lit ? 2.5 : 1}
			/>
			<Label anchor="start" x={PX + 16} y={card.y + 24} text={card.title} size={13} weight={600} />
			{#if card.id === 'co'}
				{@render coBead(PX + 111, card.y + 46)}
				{@render cellBox(PX + 111, card.y + 72)}
				<text x={PX + 182} y={card.y + 77} font-size="18" text-anchor="middle">→</text>
				{@render cellBox(PX + 241, card.y + 72)}
				{@render coBead(PX + 241, card.y + 72)}
				<Label
					anchor="start"
					x={PX + 290}
					y={card.y + 77}
					text="a full site: bounces"
					size={11}
					muted
				/>
			{:else if card.id === 'o2'}
				<Molecule kind="O2" x={PX + 110} y={card.y + 50} scale={0.6} />
				{@render cellBox(PX + 96, card.y + 72)}
				{@render cellBox(PX + 126, card.y + 72)}
				<text x={PX + 182} y={card.y + 77} font-size="18" text-anchor="middle">→</text>
				{@render cellBox(PX + 226, card.y + 72)}
				{@render cellBox(PX + 256, card.y + 72)}
				{@render oBead(PX + 226, card.y + 72)}
				{@render oBead(PX + 256, card.y + 72)}
				<Label anchor="start" x={PX + 290} y={card.y + 77} text="needs a pair" size={11} muted />
			{:else}
				{@render cellBox(PX + 96, card.y + 66)}
				{@render cellBox(PX + 126, card.y + 66)}
				{@render coBead(PX + 96, card.y + 66)}
				{@render oBead(PX + 126, card.y + 66)}
				<text x={PX + 182} y={card.y + 71} font-size="18" text-anchor="middle">→</text>
				{@render cellBox(PX + 226, card.y + 66)}
				{@render cellBox(PX + 256, card.y + 66)}
				<Molecule kind="CO2" x={PX + 241} y={card.y + 40} scale={0.55} />
				<Label anchor="start" x={PX + 290} y={card.y + 71} text="frees two sites" size={11} muted />
			{/if}
		</g>
	{/each}
	<Readout id="note" label="">
		<Label
			anchor="start"
			x={PX}
			y={GY + GS + 30}
			text="One arrival every third of a second; a fraction y of them is CO."
			size={12}
			muted
		/>
	</Readout>
</g>
