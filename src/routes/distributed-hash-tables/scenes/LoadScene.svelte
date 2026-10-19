<script lang="ts">
	/**
	 * Each of 8 servers' share of the ring with v points per server (`vnodes`; ../model.ts
	 * `shares`): the ring coloured by owner (one path per server, so 128 points each stay cheap),
	 * and a bar per server against the fair 12.5 %. Keys rain onto the ring over the first
	 * seconds and are counted per server (reduced motion: all of them).
	 */
	import { Label, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import {
		buildRing,
		hash32,
		imbalance,
		keyNames,
		serverName,
		serverNames,
		shares,
		successorIndex,
		turn
	} from '../model';
	import { arc, at, serverColor, type Circle } from './ring';

	let { t, params, reduced }: StageProps = $props();

	const N = 8;
	const NAMES = serverNames(N);
	const KEYS = keyNames(240, 'item');
	const KEY_IDS = KEYS.map((k) => hash32(k));
	const C: Circle = { cx: 262, cy: 322, r: 196 };

	const v = $derived(clamp(Math.round(Number(params.vnodes ?? 1)), 1, 128));
	const ring = $derived(buildRing(NAMES, v));
	const share = $derived(shares(NAMES, v));
	const paths = $derived.by(() => {
		const d = NAMES.map(() => '');
		ring.forEach((p, i) => {
			const prev = ring[(i - 1 + ring.length) % ring.length];
			d[p.server] += arc(C, turn(prev.id), turn(p.id)) + ' ';
		});
		return d;
	});
	const ticks = $derived.by(() => {
		if (v > 32) return '';
		return ring
			.map((p) => {
				const a = at(C, turn(p.id), C.r - 14);
				const b = at(C, turn(p.id), C.r + 14);
				return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
			})
			.join(' ');
	});
	const owner = $derived.by(() => {
		const ids = ring.map((p) => p.id);
		return KEY_IDS.map((k) => ring[successorIndex(ids, k)].server);
	});
	const shown = $derived(reduced ? KEYS.length : clamp(Math.floor((t - 0.3) * 60), 0, KEYS.length));
	const counts = $derived(NAMES.map((_, s) => owner.slice(0, shown).filter((o) => o === s).length));

	const bars = new Tween<number[]>(
		NAMES.map(() => 1 / N),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const s = share;
		untrack(() => bars.set(s, { duration: reduced ? 0 : 700 }));
	});

	const BX = 540;
	const BW = 44;
	const BG = 6;
	const BY = 500;
	const MAXS = 0.4;
	const bh = (s: number) => (Math.min(s, MAXS) / MAXS) * 340;
	const big = $derived(imbalance(share));
	const small = $derived(Math.min(...share) * N);
	const keyPos = (i: number) => at(C, turn(KEY_IDS[i]), C.r - 28 - (i % 4) * 7);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Points"
		value={v === 1 ? '1 per server' : `${v} virtual nodes per server`}
	>
		<Label
			x={24}
			y={34}
			text="8 servers, {v === 1
				? 'one point each'
				: `${v} virtual nodes each`} · each server's share of the ring"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke="var(--stage-line)" stroke-width="1" />
	{#each paths as d, s (s)}
		<path {d} fill="none" stroke={serverColor(s)} stroke-width="18" opacity="0.85" />
	{/each}
	{#if ticks}
		<path d={ticks} stroke="var(--stage-bg)" stroke-width="1.6" fill="none" />
	{/if}
	{#each KEYS.slice(0, shown) as k, i (k)}
		{@const p = keyPos(i)}
		<circle cx={p.x} cy={p.y} r="2.6" fill={serverColor(owner[i])} />
	{/each}
	<Readout id="keys">
		<Label x={C.cx} y={C.cy + 4} text="{shown} keys" size={13} weight={600} tabular />
	</Readout>

	<!-- bars -->
	<line x1={BX - 10} x2={BX + N * (BW + BG)} y1={BY} y2={BY} stroke="var(--stage-line)" />
	<line
		x1={BX - 10}
		x2={BX + N * (BW + BG)}
		y1={BY - bh(1 / N)}
		y2={BY - bh(1 / N)}
		stroke="var(--stage-ink)"
		stroke-dasharray="5 4"
		opacity="0.7"
	/>
	<Label
		x={BX + N * (BW + BG) - 4}
		y={BY - bh(1 / N) - 8}
		text="fair share 12.5 %"
		size={11}
		anchor="end"
		muted
	/>
	{#each NAMES as name, s (name)}
		{@const x = BX + s * (BW + BG)}
		{@const h = bh(bars.current[s] ?? 0)}
		<rect {x} y={BY - h} width={BW} height={h} rx="3" fill={serverColor(s)} opacity="0.85" />
		<Label
			x={x + BW / 2}
			y={BY + 18}
			text={serverName(s)}
			size={13}
			weight={700}
			color={serverColor(s)}
		/>
		<Label
			x={x + BW / 2}
			y={BY - h - 8}
			text="{Math.round((bars.current[s] ?? 0) * 100)} %"
			size={11}
			tabular
		/>
		<Readout id="count-{s}">
			<Label x={x + BW / 2} y={BY + 36} text={String(counts[s])} size={11} muted tabular />
		</Readout>
	{/each}
	<Readout id="count-head">
		<Label x={BX - 14} y={BY + 36} text="keys" size={11} anchor="end" muted />
	</Readout>
	<Readout
		id="spread"
		order={2}
		label="Busiest / quietest"
		value="{big.toFixed(1)}× / {small.toFixed(2)}× the fair share"
	>
		<Label
			x={BX - 10}
			y={110}
			text="busiest server {big.toFixed(1)}× its fair share, quietest {small.toFixed(2)}×"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
</g>
