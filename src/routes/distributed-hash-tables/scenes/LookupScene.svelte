<script lang="ts">
	/**
	 * A Chord ring of `nodes` nodes (../model.ts `chord`, `lookup`) and lookups one after
	 * another: a random key from a random node (seeded by the `another` action). Hint `fingers`:
	 * false, the query walks along successors; true, it jumps to the closest preceding finger,
	 * and the current node's fingers are drawn as thin chords and listed in its finger table.
	 * The last node on the path answers with its successor, which holds the key. Reduced motion:
	 * the first lookup, finished.
	 */
	import { Label, clamp, rng, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BITS, SPACE, chord, lookup, turn, type Lookup } from '../model';
	import { arc, at, chordPath, dial, span, type Circle } from './ring';

	let { step, t, params, reduced }: StageProps = $props();

	const C: Circle = { cx: 300, cy: 320, r: 220 };
	const fingers = $derived(step.hints?.fingers === true);
	const n = $derived(clamp(Math.round(Number(params.nodes ?? 32)), 8, 64));
	const net = $derived(chord(n));
	const u = $derived(Array.from(net.ids, (id) => turn(id)));
	const seed = $derived(Number(params.another ?? 0));

	const HOP = $derived(fingers ? 0.9 : clamp(9 / n, 0.22, 0.6));
	const INTRO = 0.7;
	const ANSWER = 0.8;
	const HOLD = 1.8;

	interface Planned {
		start: number;
		key: number;
		res: Lookup;
		t0: number;
		t1: number;
	}
	/** The next 30 lookups and when each starts and ends. */
	const plan = $derived.by(() => {
		const r = rng(9001 + seed * 7919 + n);
		const out: Planned[] = [];
		let t0 = 0;
		for (let q = 0; q < 30; q++) {
			const start = Math.floor(r() * n);
			const key = Math.floor(r() * SPACE);
			const res = lookup(net, start, key, fingers);
			const t1 = t0 + INTRO + res.hops * HOP + ANSWER + HOLD;
			out.push({ start, key, res, t0, t1 });
			t0 = t1;
		}
		return out;
	});
	const cur = $derived(reduced ? plan[0] : (plan.find((p) => t < p.t1) ?? plan[plan.length - 1]));
	const lt = $derived(reduced ? 1e6 : t - cur.t0);
	/** Hops completed (fractional while a hop is under way). */
	const progress = $derived(clamp((lt - INTRO) / HOP, 0, cur.res.hops));
	const done = $derived(Math.floor(progress));
	const answered = $derived(smoothstep(0, ANSWER * 0.8, lt - INTRO - cur.res.hops * HOP));
	const here = $derived(cur.res.path[Math.min(done, cur.res.hops)]);
	const keyU = $derived(turn(cur.key));
	const kp = $derived(at(C, keyU, C.r + 20));
	const ki = $derived(at(C, keyU, C.r - 6));

	/** Distinct fingers of a node, farthest first: the label says how far ahead it reaches. */
	const TURNS = ['½', '¼', '⅛', '1/16', '1/32', '1/64', '1/128'];
	const fingerRows = $derived.by(() => {
		const rows: { j: number; node: number; reach: string }[] = [];
		const seen: number[] = [];
		for (let j = BITS - 1; j >= 0; j--) {
			const f = net.fingers[here * BITS + j];
			if (seen.includes(f)) continue;
			seen.push(f);
			const k = BITS - 1 - j;
			rows.push({
				j,
				node: f,
				reach: k < TURNS.length ? `+${TURNS[k]} turn` : `+1/${2 ** (k + 1)} turn`
			});
		}
		return rows;
	});
	const nextNode = $derived(done < cur.res.hops ? cur.res.path[done + 1] : -1);

	const pos = (i: number, r = C.r) => at(C, u[i], r);
	/** The path of one hop: an arc along the ring (successor) or a chord (finger). */
	const hopShape = (a: number, b: number) => {
		if (!fingers || (a + 1) % n === b) {
			return {
				d: arc(C, u[a], u[b], C.r),
				point: (s: number) => at(C, u[a] + span(u[a], u[b]) * s)
			};
		}
		return chordPath(C, pos(a), pos(b));
	};
	const hops = $derived(
		cur.res.path.slice(1).map((b, i) => ({ i, ...hopShape(cur.res.path[i], b) }))
	);
	const packet = $derived.by(() => {
		if (lt < INTRO || done >= cur.res.hops) return null;
		const h = hops[done];
		return h.point(smoothstep(0, 1, progress - done));
	});
	const holderPos = $derived(pos(cur.res.holder));
	const lastPos = $derived(pos(cur.res.path[cur.res.hops]));
	const avg = $derived(fingers ? 0.5 * Math.log2(n) : n / 2);
	const panel = 600;
</script>

<g>
	<Readout
		id="title"
		order={1}
		label={fingers ? 'Finger tables' : 'Successors only'}
		value="{n} nodes"
	>
		<Label
			x={24}
			y={34}
			text="{n} nodes · {fingers
				? 'each knows its fingers: ½, ¼, ⅛ … of a turn ahead'
				: 'each knows only its successor'}"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />

	<!-- the current node's fingers -->
	{#if fingers && answered < 1}
		{#each fingerRows as f (f.j)}
			{#if f.node !== here}
				<path
					d={chordPath(C, pos(here), pos(f.node)).d}
					fill="none"
					stroke="var(--dht-finger)"
					stroke-width={f.node === nextNode ? 2 : 1}
					opacity={(f.node === nextNode ? 0.8 : 0.35) * (1 - answered)}
				/>
			{/if}
		{/each}
	{/if}

	<!-- hops so far -->
	{#each hops as h (h.i)}
		{#if h.i < progress}
			<path
				d={h.d}
				fill="none"
				stroke="var(--dht-query)"
				stroke-width="2.6"
				stroke-linecap="round"
				opacity={h.i < done ? 0.85 : 0.5}
			/>
		{/if}
	{/each}
	{#if answered > 0}
		<line
			x1={lastPos.x}
			y1={lastPos.y}
			x2={lastPos.x + (holderPos.x - lastPos.x) * answered}
			y2={lastPos.y + (holderPos.y - lastPos.y) * answered}
			stroke="var(--dht-join)"
			stroke-width="2.4"
			stroke-dasharray="4 3"
		/>
	{/if}

	<!-- nodes -->
	{#each u as uu, i (i)}
		{@const p = at(C, uu)}
		{@const onPath = cur.res.path.slice(0, done + 1).includes(i)}
		<circle
			cx={p.x}
			cy={p.y}
			r={i === here ? 8 : onPath ? 6 : 4.5}
			fill={i === cur.res.holder && answered > 0.5
				? 'var(--dht-join)'
				: i === here
					? 'var(--dht-query)'
					: onPath
						? 'var(--dht-query)'
						: 'var(--dht-node)'}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={onPath || i === here || i === cur.res.holder ? 1 : 0.6}
		/>
	{/each}

	<!-- the key -->
	<line x1={kp.x} y1={kp.y} x2={ki.x} y2={ki.y} stroke="var(--dht-key)" stroke-width="2" />
	<rect
		x={kp.x - 6}
		y={kp.y - 6}
		width="12"
		height="12"
		fill="var(--dht-key)"
		transform="rotate(45 {kp.x} {kp.y})"
	/>
	<Readout id="keylabel">
		{@const kl = at(C, keyU, C.r + 40)}
		<Label
			x={kl.x}
			y={kl.y + 4}
			text="key {dial(keyU)}"
			size={12}
			weight={700}
			color="var(--dht-key)"
			anchor={kl.x > C.cx + 40 ? 'start' : kl.x < C.cx - 40 ? 'end' : 'middle'}
		/>
	</Readout>
	<Readout id="startlabel">
		{@const sl = at(C, u[cur.start], C.r - 26)}
		<Label
			x={sl.x}
			y={sl.y + 4}
			text="from {dial(u[cur.start])}"
			size={11}
			weight={600}
			color="var(--dht-query)"
		/>
	</Readout>
	{#if packet}
		<circle
			cx={packet.x}
			cy={packet.y}
			r="6"
			fill="var(--dht-query)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- panel -->
	<Readout
		id="lookup"
		order={2}
		label="Lookup"
		value="key {dial(keyU)} from node {dial(u[cur.start])}"
	>
		<Label
			x={panel}
			y={92}
			text="look up key {dial(keyU)}, starting at node {dial(u[cur.start])}"
			size={13}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout
		id="hops"
		order={3}
		label="Hops"
		value={answered > 0.5
			? `${cur.res.hops}: node ${dial(u[cur.res.holder])} holds it`
			: `${done} so far`}
		color="var(--dht-query)"
	>
		<Label
			x={panel}
			y={124}
			text={answered > 0.5
				? `${cur.res.hops} hop${cur.res.hops === 1 ? '' : 's'}: node ${dial(u[cur.res.path[cur.res.hops]])} answers, ${dial(u[cur.res.holder])} holds the key`
				: `hop ${Math.min(done + 1, Math.max(cur.res.hops, 1))} · query at node ${dial(u[here])}`}
			size={15}
			weight={700}
			anchor="start"
			color="var(--dht-query)"
			tabular
		/>
	</Readout>
	<Readout
		id="avg"
		order={4}
		label="On average"
		value={fingers ? `½ log₂ ${n} = ${avg.toFixed(1)} hops` : `N/2 = ${avg} hops`}
	>
		<Label
			x={panel}
			y={150}
			text={fingers
				? `on average ½ log₂ ${n} ≈ ${avg.toFixed(1)} hops`
				: `on average about N/2 = ${avg} hops`}
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	{#if fingers}
		<Readout id="table">
			<Label
				x={panel}
				y={200}
				text="finger table of node {dial(u[here])}"
				size={13}
				weight={600}
				anchor="start"
				color="var(--dht-finger)"
			/>
			{#each fingerRows.slice(0, 9) as f, r (f.j)}
				{@const y = 226 + r * 24}
				{@const used = f.node === nextNode}
				{#if used}
					<rect
						x={panel - 8}
						y={y - 15}
						width="300"
						height="22"
						rx="4"
						fill="var(--dht-query)"
						opacity="0.16"
					/>
				{/if}
				<Label
					x={panel}
					{y}
					text={r === fingerRows.length - 1 || f.node === (here + 1) % n ? 'successor' : f.reach}
					size={12}
					anchor="start"
					halo={false}
				/>
				<Label
					x={panel + 140}
					{y}
					text="→ node {dial(u[f.node])}"
					size={12}
					weight={used ? 700 : 500}
					anchor="start"
					halo={false}
					tabular
				/>
				{#if used}
					<Label
						x={panel + 286}
						{y}
						text="next"
						size={11}
						anchor="end"
						halo={false}
						color="var(--dht-query)"
					/>
				{/if}
			{/each}
			<Label
				x={panel}
				y={226 + Math.min(9, fingerRows.length) * 24 + 6}
				text="(the smaller fingers all point at the successor)"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else}
		<Readout id="walknote">
			<Label
				x={panel}
				y={210}
				text="each node passes the query to the next one clockwise"
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={panel}
				y={230}
				text="until the key lies between it and its successor"
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
