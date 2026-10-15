<script lang="ts">
	/**
	 * Brute force on the travelling salesman: made-up cities (seeded), every
	 * distinct tour tried in turn (`bruteForce`, which records them), the tour
	 * being tried drawn faint, the shortest so far in green, and the greedy
	 * nearest-neighbour tour dashed. The replay position comes from
	 * `createPlayback` (tours per second), with a scrubber.
	 */
	import { untrack } from 'svelte';
	import { clamp, Handle, Label, type Point, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '#lib/explainer/playback.ts';
	import { bruteForce, cities, nearestNeighbour, tourCount, tourLength } from '../turing';

	let { t, params, setParam, reduced }: StageProps = $props();

	const n = $derived(clamp(Math.round(Number(params.cities ?? 6)), 4, 9));
	const seed = $derived(15 + 7919 * Number(params.reshuffle ?? 0));
	const pace = $derived(Number(params.tourPace ?? 12));
	const cs = $derived(cities(n, seed));
	const search = $derived(bruteForce(cs));
	const greedy = $derived(nearestNeighbour(cs));
	const greedyLength = $derived(tourLength(cs, greedy));
	const total = $derived(search.tried.length);
	const runKey = $derived(`tsp|${n}|${seed}`);

	// ---- playback (as in the tape scene) ---------------------------------------------------------
	const playing = $derived(params.tspPlay !== false);
	const position = createPlayback(0.6);
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	let lastK = 0;
	const k = $derived.by(() => {
		const v = reduced
			? playing
				? total
				: clamp(manual, 0, total)
			: position(t, { key: runKey, playing, pace, manual, total });
		if (playing) lastK = v;
		return v;
	});
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.floor(lastK));
			wasPlaying = now;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', runKey);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		lastK = clamp(Math.round(v), 0, total);
		if (playing) setParam('tspPlay', false);
		setPosition(v);
	}
	const tried = $derived(Math.min(total, Math.floor(k)));
	const current = $derived(tried < total ? search.tried[tried] : null);
	const bestNow = $derived.by(() => {
		let r = -1;
		for (let i = 0; i < search.records.length; i++) if (search.records[i].at < tried) r = i;
		return r < 0 ? null : search.records[r];
	});
	const bestTour = $derived(bestNow ? search.tried[bestNow.at] : null);
	const done = $derived(tried >= total);

	// ---- geometry -------------------------------------------------------------------------------
	const MX = 24;
	const MY = 112;
	const MW = 540;
	const MH = 404;
	// The same scale on both axes, fitted to the map (lengths keep their proportions).
	const fit = $derived.by(() => {
		const xs = cs.map((c) => c.x);
		const ys = cs.map((c) => c.y);
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const k = Math.min((MW - 60) / Math.max(1e-6, x1 - x0), (MH - 60) / Math.max(1e-6, y1 - y0));
		return { k, ox: MX + MW / 2 - (k * (x0 + x1)) / 2, oy: MY + MH / 2 - (k * (y0 + y1)) / 2 };
	});
	const px = (c: { x: number; y: number }) => ({
		x: fit.ox + c.x * fit.k,
		y: fit.oy + c.y * fit.k
	});
	const pathOf = (tour: number[]) =>
		tour
			.map((c, i) => `${i ? 'L' : 'M'}${px(cs[c]).x.toFixed(1)} ${px(cs[c]).y.toFixed(1)}`)
			.join('') + 'Z';
	const fmt = (d: number) => d.toFixed(3);
	const pct = $derived(bestNow ? (greedyLength / search.bestLength - 1) * 100 : 0);

	// ---- timeline ---------------------------------------------------------------------------------
	const TL0 = 600;
	const TL1 = 920;
	const TLY = 500;
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? tried / total : 0));
	function onmove(p: Point) {
		scrubTo(((p.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(s: number | 'start' | 'end') {
		if (s === 'start' || s === 'end') return scrubTo(s === 'start' ? 0 : total);
		scrubTo((playing ? Math.round(lastK) : Math.round(manual)) + s);
	}

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fadeIn}>
	<Readout
		id="tsp-title"
		order={1}
		label="Brute force"
		value={done
			? `All ${total.toLocaleString('en')} tours tried: the green one is the shortest`
			: `Trying tour ${(tried + 1).toLocaleString('en')} of ${total.toLocaleString('en')}`}
		color={done ? 'var(--tm-best)' : undefined}
	>
		<Label
			anchor="start"
			tabular
			x={24}
			y={42}
			text="{n} made-up cities: try every round trip"
			size={18}
			weight={600}
		/>
		<Label
			anchor="start"
			tabular
			x={24}
			y={68}
			text={done
				? `All ${total.toLocaleString('en')} tours tried: the green one is the shortest`
				: `Trying tour ${(tried + 1).toLocaleString('en')} of ${total.toLocaleString('en')}`}
			size={14}
			color={done ? 'var(--tm-best)' : undefined}
		/>
	</Readout>

	<!-- the map -->
	<rect
		x={MX - 8}
		y={MY - 24}
		width={MW + 16}
		height={MH + 48}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if current && !done}
		<path d={pathOf(current)} fill="none" stroke="var(--tm-try)" stroke-width="1.5" opacity="0.7" />
	{/if}
	<path
		d={pathOf(greedy)}
		fill="none"
		stroke="var(--tm-greedy)"
		stroke-width="2"
		stroke-dasharray="6 5"
		opacity="0.9"
	/>
	{#if bestTour}
		<path
			d={pathOf(bestTour)}
			fill="none"
			stroke="var(--tm-best)"
			stroke-width="3.5"
			stroke-linejoin="round"
			opacity="0.85"
		/>
	{/if}
	{#each cs as c, i (i)}
		{@const p = px(c)}
		<circle
			cx={p.x}
			cy={p.y}
			r={i === 0 ? 11 : 9}
			fill="var(--tm-city)"
			stroke="var(--surface)"
			stroke-width="2"
		/>
		<Label
			tabular
			x={p.x}
			y={p.y + 4}
			text={i === 0 ? '⌂' : String(i)}
			size={11}
			anchor="middle"
			weight={700}
			color="var(--stage-bg)"
			halo={false}
		/>
	{/each}

	<!-- the numbers -->
	<Readout
		id="tours"
		order={2}
		label="Distinct tours, (n − 1)!/2"
		value={tourCount(n).toLocaleString('en')}
	>
		<Label
			anchor="start"
			tabular
			x={600}
			y={120}
			text="Distinct tours: ({n} − 1)!/2"
			size={13}
			muted
		/>
		<Label
			anchor="start"
			tabular
			x={600}
			y={146}
			text={tourCount(n).toLocaleString('en')}
			size={22}
			weight={700}
		/>
	</Readout>
	<Readout id="tried" order={3} label="Tried" value={tried.toLocaleString('en')}>
		<Label anchor="start" x={780} y={120} text="Tried so far" size={13} muted />
		<Label
			anchor="start"
			tabular
			x={780}
			y={146}
			text={tried.toLocaleString('en')}
			size={22}
			weight={700}
		/>
	</Readout>
	<Readout
		id="best"
		order={4}
		label="Shortest so far"
		value={bestNow ? fmt(bestNow.length) : '—'}
		color="var(--tm-best)"
	>
		<line x1={600} x2={630} y1={196} y2={196} stroke="var(--tm-best)" stroke-width="3.5" />
		<Label
			anchor="start"
			tabular
			x={640}
			y={200}
			text="shortest so far: {bestNow ? fmt(bestNow.length) : '—'}"
			size={14}
			weight={600}
			color="var(--tm-best)"
		/>
	</Readout>
	<Readout
		id="greedy"
		order={5}
		label="Greedy (nearest city next)"
		value={fmt(greedyLength)}
		color="var(--tm-greedy)"
	>
		<line
			x1={600}
			x2={630}
			y1={226}
			y2={226}
			stroke="var(--tm-greedy)"
			stroke-width="2"
			stroke-dasharray="6 5"
		/>
		<Label
			anchor="start"
			tabular
			x={640}
			y={230}
			text="greedy guess: {fmt(greedyLength)}"
			size={14}
			weight={600}
			color="var(--tm-greedy)"
		/>
	</Readout>
	{#if current && !done}
		<Readout id="trying">
			<line x1={600} x2={630} y1={256} y2={256} stroke="var(--tm-try)" stroke-width="1.5" />
			<Label
				anchor="start"
				tabular
				x={640}
				y={260}
				text="tour being tried: {fmt(tourLength(cs, current))}"
				size={13}
				muted
			/>
		</Readout>
	{/if}
	<Readout
		id="verdict"
		order={6}
		label="Greedy vs best"
		value={done
			? pct < 0.05
				? 'the greedy tour is the shortest one'
				: `the greedy tour is ${pct.toFixed(1)}% longer`
			: 'not known until every tour is tried'}
	>
		<Label
			anchor="start"
			tabular
			x={600}
			y={310}
			text={done
				? pct < 0.05
					? 'Here the greedy tour happens to be the shortest.'
					: `The greedy tour is ${pct.toFixed(1)}% longer than the best.`
				: 'Only after trying them all is the best one known.'}
			size={13}
			weight={600}
		/>
	</Readout>
	<Readout id="units">
		<Label
			anchor="start"
			x={600}
			y={340}
			text="Lengths in arbitrary units. ⌂: the start."
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={600}
			y={380}
			text="One more city multiplies the tours by n:"
			size={13}
		/>
		<Label
			anchor="start"
			tabular
			x={600}
			y={402}
			text="{n} cities: {tourCount(n).toLocaleString('en')} · {n + 1} cities: {tourCount(
				n + 1
			).toLocaleString('en')}"
			size={13}
			weight={600}
		/>
	</Readout>

	<!-- timeline -->
	<line
		x1={TL0}
		x2={TL1}
		y1={TLY}
		y2={TLY}
		stroke="var(--stage-grid)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<line
		x1={TL0}
		x2={tlx}
		y1={TLY}
		y2={TLY}
		stroke="var(--explainer-accent)"
		stroke-width="6"
		stroke-linecap="round"
		opacity="0.6"
	/>
	<Readout id="tsp-tl">
		<Label
			tabular
			x={(TL0 + TL1) / 2}
			y={TLY + 28}
			text={playing ? 'drag, or focus and use ← → / End' : 'paused: drag or use ← →'}
			size={12}
			anchor="middle"
			muted
		/>
	</Readout>
	<Handle
		x={tlx}
		y={TLY}
		r={8}
		label="Tours tried"
		value={tried}
		min={0}
		max={total}
		valuetext="{tried} of {total} tours tried"
		{onmove}
		{onkey}
	/>
</g>
