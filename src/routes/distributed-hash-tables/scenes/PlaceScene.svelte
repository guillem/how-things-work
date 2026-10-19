<script lang="ts">
	/**
	 * Keys and servers placed by a rule (../model.ts `assign`): 60 keys at their hashes on the
	 * ring, coloured by the server that holds them. `ring`: servers are points on the ring too and
	 * own the arc before them; `modulo`: hash mod N, servers listed beside the ring. With the
	 * `add` toggle (hint `adding`) a server joins: the keys that change server flip colour and
	 * get a halo, and the panel counts them. A probe walks from one key to its server, a new key
	 * every 2.4 s (reduced motion: one probe, arrived).
	 */
	import { Label, clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import {
		assign,
		buildRing,
		hash32,
		keyNames,
		moved,
		serverName,
		serverNames,
		turn
	} from '../model';
	import { arc, at, serverColor, span, type Circle } from './ring';

	let { step, t, params, reduced }: StageProps = $props();

	const K = 60;
	const KEYS = keyNames(K);
	const keyU = KEYS.map((k) => turn(hash32(k)));
	const C: Circle = { cx: 300, cy: 318, r: 220 };

	const rule = $derived(
		(step.hints?.rule === '@rule' ? params.rule : step.hints?.rule) === 'modulo' ? 'modulo' : 'ring'
	);
	const adding = $derived(step.hints?.adding === true);
	const n = $derived(clamp(Math.round(Number(params.servers ?? 5)), 3, 8));
	const on = $derived(adding && params.add === true);

	const before = $derived(assign(KEYS, serverNames(n), rule));
	const after = $derived(assign(KEYS, serverNames(n + 1), rule));
	const movedCount = $derived(moved(before, after));

	const grow = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = on ? 1 : 0;
		untrack(() => grow.set(v, { duration: reduced ? 0 : 800 }));
	});
	const a = $derived(grow.current);
	const owner = $derived(a > 0.5 ? after : before);
	const count = $derived(on ? n + 1 : n);

	/** Server points (ring rule) for the layout with and without the new server. */
	const pts = $derived(
		buildRing(serverNames(n + 1)).map((p) => ({ ...p, u: turn(p.id), isNew: p.server === n }))
	);
	/** Arcs owned by each server: from the previous point (present in this layout) to its own. */
	const arcsOf = (withNew: boolean) => {
		const list = pts.filter((p) => withNew || !p.isNew);
		return list.map((p, i) => ({
			key: `${p.server}-${withNew ? 1 : 0}`,
			server: p.server,
			d: arc(C, list[(i - 1 + list.length) % list.length].u, p.u, C.r)
		}));
	};
	const arcsOld = $derived(arcsOf(false));
	const arcsNew = $derived(arcsOf(true));

	const holdings = $derived(
		Array.from({ length: count }, (_, s) => ({
			s,
			held: owner.filter((o) => o === s).length
		}))
	);

	// the probe: a key every 2.4 s, walking clockwise to its server (ring) or flagged (modulo)
	const PERIOD = 2.4;
	const probeIndex = $derived(((reduced ? 0 : Math.floor(t / PERIOD)) * 23 + 7) % K);
	const probeU = $derived(reduced ? 1 : smoothstep(0.1, 0.7, cycle(t, PERIOD)));
	const probeServer = $derived(owner[probeIndex]);
	const probeTarget = $derived(pts.find((p) => p.server === probeServer)?.u ?? 0);
	const probePos = $derived(
		at(C, keyU[probeIndex] + span(keyU[probeIndex], probeTarget) * probeU, C.r)
	);
	const probeFade = $derived(reduced ? 1 : 1 - smoothstep(0.85, 1, cycle(t, PERIOD)));

	const keyR = (i: number) => C.r - 16 - (i % 3) * 9;
	const kp = $derived(at(C, keyU[probeIndex], keyR(probeIndex)));
	const maxHeld = $derived(Math.max(20, ...holdings.map((h) => h.held)));
	const barW = (held: number) => Math.max(2, (held / maxHeld) * 260);
	const pct = (x: number) => Math.round((100 * x) / K);
	const panelX = 600;
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Rule"
		value={rule === 'ring' ? `consistent hashing, ${count} servers` : `hash mod ${count}`}
	>
		<Label
			x={24}
			y={34}
			text={rule === 'ring'
				? `consistent hashing · ${count} servers on the ring`
				: `hash mod ${count} · key → server number hash mod ${count}`}
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="sub">
		<Label
			x={24}
			y={56}
			text="60 keys at their hashes, 0 to 2³² − 1 round the circle, coloured by the server that holds them"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- the ring -->
	<circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
	<Label x={C.cx} y={C.cy - C.r - 12} text="0" size={11} muted />
	{#if rule === 'ring'}
		{#each arcsOld as s (s.key)}
			<path
				d={s.d}
				fill="none"
				stroke={serverColor(s.server)}
				stroke-width="7"
				opacity={0.75 * (1 - a)}
			/>
		{/each}
		{#if a > 0}
			{#each arcsNew as s (s.key)}
				<path
					d={s.d}
					fill="none"
					stroke={serverColor(s.server)}
					stroke-width="7"
					opacity={0.75 * a}
				/>
			{/each}
		{/if}
	{/if}

	<!-- keys -->
	{#each KEYS as k, i (k)}
		{@const p = at(C, keyU[i], keyR(i))}
		{@const changed = adding && before[i] !== after[i]}
		{#if changed && a > 0}
			<circle
				cx={p.x}
				cy={p.y}
				r="8"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.4"
				opacity={0.8 * a}
			/>
		{/if}
		<circle
			cx={p.x}
			cy={p.y}
			r="4.6"
			fill={serverColor(changed ? owner[i] : before[i])}
			stroke="var(--stage-bg)"
			stroke-width="1"
		/>
	{/each}

	<!-- servers on the ring -->
	{#if rule === 'ring'}
		{#each pts as p (p.server)}
			{@const o = p.isNew ? a : 1}
			{#if o > 0.01}
				{@const q = at(C, p.u)}
				{@const l = at(C, p.u, C.r + 24)}
				<g opacity={o}>
					<circle
						cx={q.x}
						cy={q.y}
						r={p.isNew ? 6 + 4 * a : 10}
						fill={serverColor(p.server)}
						stroke="var(--stage-bg)"
						stroke-width="2"
					/>
					<Label
						x={l.x}
						y={l.y + 4}
						text={serverName(p.server)}
						size={13}
						weight={700}
						color={serverColor(p.server)}
					/>
				</g>
			{/if}
		{/each}
	{/if}

	<!-- the probe -->
	<g opacity={probeFade}>
		<circle cx={kp.x} cy={kp.y} r="9" fill="none" stroke="var(--stage-ink)" stroke-width="2" />
		{#if rule === 'ring' && probeU > 0.01}
			<path
				d={arc(
					C,
					keyU[probeIndex],
					keyU[probeIndex] + span(keyU[probeIndex], probeTarget) * probeU
				)}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<circle cx={probePos.x} cy={probePos.y} r="5" fill="var(--stage-ink)" />
		{/if}
	</g>

	<!-- panel -->
	<Readout
		id="probe"
		order={3}
		label="Probe"
		value="{KEYS[probeIndex]} → server {serverName(probeServer)}"
	>
		<Label
			x={panelX}
			y={110}
			text={rule === 'ring'
				? `${KEYS[probeIndex]}: first server clockwise is ${serverName(probeServer)}`
				: `${KEYS[probeIndex]}: hash mod ${count} = ${probeServer} → server ${serverName(probeServer)}`}
			size={13}
			weight={600}
			anchor="start"
			color="var(--stage-ink)"
		/>
	</Readout>
	<Readout id="held">
		<Label x={panelX} y={150} text="keys held by each server" size={12} anchor="start" muted />
		{#each holdings as h (h.s)}
			{@const y = 172 + h.s * 30}
			{@const isNew = h.s === n}
			<g opacity={isNew ? a : 1}>
				<Label
					x={panelX + 10}
					y={y + 5}
					text={serverName(h.s)}
					size={13}
					weight={700}
					color={serverColor(h.s)}
				/>
				<rect
					x={panelX + 26}
					y={y - 8}
					width={barW(h.held)}
					height="16"
					rx="3"
					fill={serverColor(h.s)}
					opacity="0.8"
				/>
				<Label
					x={panelX + 32 + barW(h.held)}
					y={y + 5}
					text={`${h.held}`}
					size={12}
					anchor="start"
					tabular
				/>
			</g>
		{/each}
	</Readout>
	{#if rule === 'modulo'}
		<Readout id="modnote">
			<Label
				x={panelX}
				y={480}
				text="the servers have no place on the ring: a key's"
				size={11}
				anchor="start"
				muted
			/>
			<Label
				x={panelX}
				y={496}
				text="position says nothing about who holds it"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
	{#if adding}
		<Readout
			id="moved"
			order={2}
			label={on ? `Server ${serverName(n)} added` : 'Add a server'}
			value={on ? `${movedCount} of ${K} keys moved (${pct(movedCount)} %)` : `${n} servers`}
			color="var(--stage-ink)"
		>
			{#if on}
				<g opacity={a}>
					<Label
						x={panelX}
						y={536}
						text="{serverName(n)} joins: {movedCount} of {K} keys move ({pct(movedCount)} %)"
						size={15}
						weight={700}
						anchor="start"
						tabular
					/>
					<Label
						x={panelX}
						y={558}
						text={rule === 'ring'
							? `all of them to ${serverName(n)}; its fair share is 60 / ${n + 1} ≈ ${Math.round(60 / (n + 1))}`
							: `about ${n} in ${n + 1} move, most between old servers`}
						size={12}
						anchor="start"
						muted
					/>
				</g>
			{:else}
				<Label
					x={panelX}
					y={536}
					text="turn on “Add one more server” to add {serverName(n)}"
					size={12}
					anchor="start"
					muted
				/>
			{/if}
		</Readout>
	{/if}
</g>
