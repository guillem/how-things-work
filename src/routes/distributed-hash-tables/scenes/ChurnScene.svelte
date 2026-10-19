<script lang="ts">
	/**
	 * Twelve rounds of churn on a ring of 24 nodes with 48 keys (../model.ts `churn`), one
	 * round every 2.6 s: a `fail` fraction of the nodes fails at once (red), each survivor
	 * reconnects to its first live successor if one is in its successor list (green link) or is
	 * cut off (orange, the ring broken after it), keys whose every copy failed are lost (red),
	 * the dead leave and fresh nodes join (green). Hint `focus`: 'ring' uses the `successors`
	 * control and one copy per key (keys not drawn); 'keys' uses `copies` and successor lists
	 * of 4. `rerun` reseeds. Reduced motion: the last round, mid-way, with every total.
	 */
	import { Label, clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { churn, hash32, keyNames, turn } from '../model';
	import { arc, at, type Circle } from './ring';

	let { step, t, params, reduced }: StageProps = $props();

	const NODES = 24;
	const KEYS = 48;
	const ROUNDS = 12;
	const P = 2.6;
	const T0 = 0.5;
	const C: Circle = { cx: 300, cy: 322, r: 214 };
	const KEY_U = keyNames(KEYS).map((k) => turn(hash32(k)));

	const focus = $derived(step.hints?.focus === 'keys' ? 'keys' : 'ring');
	const fail = $derived(clamp(Number(params.fail ?? 0.25), 0.1, 0.5));
	const successors = $derived(
		focus === 'ring' ? clamp(Math.round(Number(params.successors ?? 1)), 1, 4) : 4
	);
	const copies = $derived(
		focus === 'keys' ? clamp(Math.round(Number(params.copies ?? 1)), 1, 4) : 1
	);
	const seed = $derived(11 + Number(params.rerun ?? 0) * 101);
	const rounds = $derived(
		churn({ nodes: NODES, keys: KEYS, fail, successors, copies, rounds: ROUNDS, seed })
	);

	const clock = $derived(reduced ? (ROUNDS - 1 + 0.45) * P : Math.max(0, t - T0));
	const k = $derived(clamp(Math.floor(clock / P), 0, ROUNDS - 1));
	const ph = $derived(clamp(clock / P - k, 0, 1));
	const R = $derived(rounds[k]);

	const fx = $derived(smoothstep(0.12, 0.28, ph)); // failures show
	const cx = $derived(smoothstep(0.3, 0.42, ph)); // cuts, losses, new links
	const gone = $derived(smoothstep(0.66, 0.8, ph)); // the dead leave
	const jn = $derived(smoothstep(0.8, 0.95, ph)); // new nodes join

	const dead = $derived(new Set(R.failed));
	const cutSet = $derived(new Set(R.cut));
	const lostNow = $derived(new Set(R.lost));
	const lostBefore = $derived(new Set(rounds.slice(0, k).flatMap((r) => r.lost)));

	/** Ring links: from each node to the next, and each survivor's new link past the dead. */
	const links = $derived.by(() => {
		const b = R.before;
		const n = b.length;
		return b.map((id, i) => {
			const next = b[(i + 1) % n];
			let s = 1;
			while (s < n && dead.has(b[(i + s) % n])) s++;
			return {
				id,
				old: arc(C, turn(id), turn(next)),
				healed:
					dead.has(next) && !dead.has(id) && !cutSet.has(id)
						? arc(C, turn(id), turn(b[(i + s) % n]))
						: '',
				toDead: dead.has(next) || dead.has(id)
			};
		});
	});

	const lostTotal = $derived(reduced || ph > 0.3 ? R.lostTotal : R.lostTotal - R.lost.length);
	const cutRounds = $derived(
		rounds.slice(0, k + (ph > 0.3 ? 1 : 0)).filter((r) => r.cut.length > 0).length
	);
	const keyR = (i: number) => C.r - 26 - (i % 3) * 8;
	const panel = 600;
	const pct = (v: number) => Math.round(v * 100);
	const perRound = $derived(rounds.map((r) => (focus === 'keys' ? r.lost.length : r.cut.length)));
	const barMax = $derived(Math.max(4, ...perRound));
</script>

<g>
	<Readout id="title" order={1} label="Churn" value="{NODES} nodes, {pct(fail)} % fail each round">
		<Label
			x={24}
			y={34}
			text="{NODES} nodes · {pct(fail)} % fail at once each round · {focus === 'ring'
				? `successor lists of ${successors}`
				: `${copies} ${copies === 1 ? 'copy' : 'copies'} of each key`}"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- ring links -->
	{#each links as l (l.id)}
		<path
			d={l.old}
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
			stroke-dasharray={l.toDead && fx > 0.5 ? '3 5' : 'none'}
			opacity={l.toDead ? 1 - 0.6 * gone : 1}
		/>
		{#if l.healed && cx > 0}
			<path
				d={l.healed}
				fill="none"
				stroke="var(--dht-join)"
				stroke-width="3"
				opacity={cx * (1 - jn * 0.6)}
			/>
		{/if}
	{/each}

	<!-- keys -->
	{#if focus === 'keys'}
		{#each KEY_U as u, i (i)}
			{@const p = at(C, u, keyR(i))}
			{#if lostBefore.has(i)}
				<circle cx={p.x} cy={p.y} r="3.4" fill="none" stroke="var(--dht-fail)" opacity="0.45" />
			{:else if lostNow.has(i) && cx > 0}
				<circle
					cx={p.x}
					cy={p.y}
					r={4 + 3 * cx * (1 - jn)}
					fill="var(--dht-fail)"
					opacity={1 - 0.5 * jn}
				/>
			{:else}
				<circle cx={p.x} cy={p.y} r="4" fill="var(--dht-key)" />
			{/if}
		{/each}
	{/if}

	<!-- nodes -->
	{#each R.before as id (id)}
		{@const p = at(C, turn(id))}
		{@const isDead = dead.has(id)}
		{@const isCut = cutSet.has(id)}
		<g opacity={isDead ? 1 - gone : 1}>
			<circle
				cx={p.x}
				cy={p.y}
				r="8"
				fill={isDead && fx > 0.5
					? 'var(--dht-fail)'
					: isCut && cx > 0.5
						? 'var(--dht-cut)'
						: 'var(--dht-node)'}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{#if isDead && fx > 0}
				<path
					d="M{p.x - 4} {p.y - 4} L{p.x + 4} {p.y + 4} M{p.x + 4} {p.y - 4} L{p.x - 4} {p.y + 4}"
					stroke="var(--stage-bg)"
					stroke-width="2"
					opacity={fx}
				/>
			{/if}
			{#if isCut && cx > 0}
				{@const o = at(C, turn(id), C.r + 22)}
				<circle
					cx={p.x}
					cy={p.y}
					r={12}
					fill="none"
					stroke="var(--dht-cut)"
					stroke-width="2"
					opacity={cx}
				/>
				<Readout id="cut-{id}">
					<Label
						x={o.x}
						y={o.y + 4}
						text="cut off"
						size={11}
						weight={600}
						color="var(--dht-cut-text)"
						opacity={cx}
					/>
				</Readout>
			{/if}
		</g>
	{/each}
	{#each R.joined as id (id)}
		{#if jn > 0}
			{@const p = at(C, turn(id))}
			<circle
				cx={p.x}
				cy={p.y}
				r={4 + 4 * jn}
				fill="var(--dht-join)"
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={jn}
			/>
		{/if}
	{/each}

	<!-- panel -->
	<Readout id="round" order={2} label="Round" value="{k + 1} of {ROUNDS}">
		<Label
			x={panel}
			y={100}
			text="round {k + 1} of {ROUNDS}"
			size={15}
			weight={700}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="legend">
		<circle cx={panel + 6} cy={128} r="6" fill="var(--dht-fail)" />
		<Label x={panel + 20} y={132} text="{R.failed.length} fail at once" size={12} anchor="start" />
		<circle cx={panel + 156} cy={128} r="6" fill="var(--dht-join)" />
		<Label
			x={panel + 170}
			y={132}
			text="{R.joined.length} join after repair"
			size={12}
			anchor="start"
		/>
		{#if focus === 'ring'}
			<line
				x1={panel}
				x2={panel + 14}
				y1={156}
				y2={156}
				stroke="var(--dht-join)"
				stroke-width="3"
			/>
			<Label
				x={panel + 20}
				y={160}
				text="survivor reaches its next live node"
				size={12}
				anchor="start"
			/>
			<circle cx={panel + 6} cy={184} r="6" fill="var(--dht-cut)" />
			<Label
				x={panel + 20}
				y={188}
				text="cut off: its whole successor list failed"
				size={12}
				anchor="start"
			/>
		{:else}
			<circle cx={panel + 6} cy={156} r="4" fill="var(--dht-key)" />
			<Label
				x={panel + 20}
				y={160}
				text="key, kept on {copies} successive node{copies === 1 ? '' : 's'}"
				size={12}
				anchor="start"
			/>
			<circle cx={panel + 6} cy={184} r="4" fill="var(--dht-fail)" />
			<Label x={panel + 20} y={188} text="key lost: every copy failed" size={12} anchor="start" />
		{/if}
	</Readout>

	{#if focus === 'ring'}
		<Readout
			id="cuts"
			order={3}
			label="Ring cut"
			value="{ph > 0.3 ? R.cut.length : 0} nodes now, in {cutRounds} of {k +
				(ph > 0.3 ? 1 : 0)} rounds"
			color="var(--dht-cut-text)"
		>
			<Label
				x={panel}
				y={240}
				text="this round: {ph > 0.3 ? R.cut.length : 0} node{R.cut.length === 1 ? '' : 's'} cut off"
				size={14}
				weight={700}
				anchor="start"
				color="var(--dht-cut-text)"
				tabular
			/>
			<Label
				x={panel}
				y={262}
				text="the ring broke in {cutRounds} of {k + (ph > 0.3 ? 1 : 0)} rounds so far"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="lost"
			order={3}
			label="Keys lost"
			value="{lostTotal} of {KEYS}"
			color="var(--dht-fail-text)"
		>
			<Label
				x={panel}
				y={240}
				text="keys lost: {lostTotal} of {KEYS} ({pct(lostTotal / KEYS)} %)"
				size={14}
				weight={700}
				anchor="start"
				color="var(--dht-fail-text)"
				tabular
			/>
			<Label
				x={panel}
				y={262}
				text={copies === 1
					? `a key is lost when its node fails: about ${pct(fail)} % a round`
					: `lost only if all ${copies} copies fail: ${fail.toFixed(2)}${['', '', '²', '³', '⁴'][copies]} ≈ ${(100 * fail ** copies).toFixed(1)} % a round`}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	<!-- per-round bars -->
	<Readout id="bars">
		<Label
			x={panel}
			y={330}
			text={focus === 'keys' ? 'keys lost in each round' : 'nodes cut off in each round'}
			size={11}
			anchor="start"
			muted
		/>
		<line x1={panel} x2={panel + ROUNDS * 26} y1={470} y2={470} stroke="var(--stage-line)" />
		{#each perRound as v, i (i)}
			{@const shownBar = reduced || i < k || (i === k && ph > 0.3)}
			{#if shownBar}
				{@const h = (v / barMax) * 110}
				<rect
					x={panel + i * 26 + 3}
					y={470 - h}
					width="20"
					height={Math.max(h, 1)}
					rx="2"
					fill={focus === 'keys' ? 'var(--dht-fail)' : 'var(--dht-cut)'}
					opacity={i === k ? 1 : 0.6}
				/>
				<Label x={panel + i * 26 + 13} y={470 - h - 6} text={String(v)} size={10} muted tabular />
			{/if}
			<Label x={panel + i * 26 + 13} y={486} text={String(i + 1)} size={10} muted />
		{/each}
	</Readout>
</g>
