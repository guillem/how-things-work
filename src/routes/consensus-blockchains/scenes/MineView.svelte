<script lang="ts">
	/**
	 * Mining one block: nonces 0, 1, 2, … are hashed (double SHA-256) until one gives a hash
	 * with `params.bits` zero bits at the start. The search runs once per setting (debounced,
	 * as it can take a fraction of a second at 16 bits); the counter then replays it over
	 * SEARCH seconds of `t`, with the last few tries listed, and holds on the find. Loops.
	 */
	import { untrack } from 'svelte';
	import { clamp, cycle, easeInOut, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type Params } from '#lib/explainer/index.ts';
	import { blockDigest, mine, zeroBits } from '../consensus';
	import { MINE_DATA, bitString, fmt } from './shared';

	interface Props {
		t: number;
		params: Params;
		reduced: boolean;
	}
	let { t, params, reduced }: Props = $props();

	const bits = $derived(clamp(Math.round(Number(params.bits ?? 12)), 4, 16));
	const data = $derived(MINE_DATA[Number(params.fresh ?? 0) % MINE_DATA.length]);
	// A fixed previous hash: the chain so far ends in a block whose hash starts with zeros.
	const PREV = '0000' + '7c3b9e1f4a2d8c6b'.repeat(4).slice(0, 60);
	const proto = $derived({ height: 1, prev: PREV, data });

	// Debounced search: the first runs at once so the opening frame is complete.
	let key = $state(untrack(() => `${bits}|${data}`));
	$effect(() => {
		const k = `${bits}|${data}`;
		if (k === untrack(() => key)) return;
		const id = setTimeout(() => (key = k), 200);
		return () => clearTimeout(id);
	});
	const found = $derived.by(() => {
		const [b, d] = key.split('|');
		return mine({ height: 1, prev: PREV, data: d }, Number(b));
	});
	const searched = $derived(key === `${bits}|${data}`);
	const tries = $derived(found?.tries ?? 1);

	const SEARCH = 5;
	const PERIOD = SEARCH + 4;
	const su = $derived(reduced ? 1e6 : cycle(t, PERIOD) * PERIOD);
	const u = $derived(clamp((su - 0.4) / SEARCH));
	const done = $derived(Math.max(1, Math.round(tries * easeInOut(u))));
	const hit = $derived(u >= 1 && searched);
	const fade = $derived(reduced ? 1 : 1 - smoothstep(PERIOD - 0.5, PERIOD - 0.05, su));

	const SHOW = 9;
	const recent = $derived(
		Array.from({ length: Math.min(SHOW, done) }, (_, j) => {
			const nonce = done - 1 - j;
			const d = blockDigest({ ...proto, nonce });
			const z = zeroBits(d);
			return { nonce, d, z, ok: z >= bits };
		})
	);
	const current = $derived(recent[0]);
	const BIN = 20;

	const B = { x: 24, y: 118, w: 380, h: 330 };
	const L = { x: 440, y: 150, row: 30 };
</script>

<g opacity={fade}>
	<Readout id="title" order={1} label="Mining" value="hash must start with {bits} zero bits">
		<Label
			anchor="start"
			tabular
			x={24}
			y={40}
			text="Mining: find a nonce whose hash starts with {bits} zero bits"
			size={16}
			weight={700}
		/>
	</Readout>
	<Readout
		id="count"
		order={2}
		label="Tries"
		value="{fmt(done)}{hit ? ' — found' : ''} (about {fmt(2 ** bits)} expected)"
		color={hit ? 'var(--cb-ok)' : 'var(--cb-work)'}
	>
		<Label
			anchor="start"
			tabular
			x={24}
			y={66}
			text="Tries: {fmt(done)}{hit ? ' — found!' : ''}   ·   on average about 2^{bits} = {fmt(
				2 ** bits
			)}"
			size={13}
			weight={600}
			color={hit ? 'var(--cb-ok)' : 'var(--cb-work)'}
		/>
	</Readout>

	<!-- the block being mined -->
	<rect
		x={B.x}
		y={B.y}
		width={B.w}
		height={B.h}
		rx="12"
		fill="var(--cb-card)"
		stroke={hit ? 'var(--cb-ok)' : 'var(--cb-work)'}
		stroke-width="2"
	/>
	<Label anchor="start" x={B.x + 16} y={B.y + 30} text="Block 1" size={15} weight={700} />
	<Label anchor="start" x={B.x + 16} y={B.y + 58} text="hash of the block before" size={11} muted />
	<Label
		anchor="start"
		tabular
		x={B.x + 16}
		y={B.y + 78}
		text={PREV.slice(0, 32) + '…'}
		size={13}
		mono
	/>
	<Label anchor="start" x={B.x + 16} y={B.y + 108} text="data" size={11} muted />
	<Label anchor="start" tabular x={B.x + 16} y={B.y + 128} text={data} size={14} mono />
	<Label
		anchor="start"
		x={B.x + 16}
		y={B.y + 158}
		text="nonce (the only field the miner changes)"
		size={11}
		muted
	/>
	<Label
		anchor="start"
		tabular
		x={B.x + 16}
		y={B.y + 184}
		text={fmt(current?.nonce ?? 0)}
		size={22}
		weight={700}
		mono
		color={hit ? 'var(--cb-ok)' : 'var(--cb-work)'}
	/>
	<Label
		anchor="start"
		tabular
		x={B.x + 16}
		y={B.y + 216}
		text="double SHA-256 of all of the above, first {BIN} bits"
		size={11}
		muted
	/>
	{#if current}
		{@const bs = bitString(current.d, BIN)}
		{@const zs = Math.min(current.z, BIN)}
		{@const cut = zs + Math.floor(zs / 4) - (zs > 0 && zs % 4 === 0 ? 1 : 0)}
		<text x={B.x + 16} y={B.y + 244} font-size="17" style:font-family="var(--font-mono)"
			><tspan style:fill={current.ok ? 'var(--cb-ok)' : 'var(--cb-bad)'} style:font-weight="700"
				>{bs.slice(0, cut)}</tspan
			><tspan>{bs.slice(cut)}</tspan></text
		>
		<Label
			anchor="start"
			tabular
			x={B.x + 16}
			y={B.y + 272}
			text="{current.z} zero bit{current.z === 1 ? '' : 's'}: {current.ok
				? 'enough!'
				: `${bits} needed`}"
			size={13}
			weight={600}
			color={current.ok ? 'var(--cb-ok)' : undefined}
			muted={!current.ok}
		/>
		{#if hit && found}
			<Readout id="hash">
				<Label
					anchor="start"
					tabular
					x={B.x + 16}
					y={B.y + 304}
					text="hash {found.hash.slice(0, 34)}…"
					size={11}
					mono
					muted
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the last tries -->
	<Readout id="list-title">
		<Label
			anchor="start"
			tabular
			x={L.x}
			y={L.y - 26}
			text="Latest tries: nonce → first {BIN} bits of the hash"
			size={13}
			weight={700}
		/>
	</Readout>
	{#each recent as r, k (r.nonce)}
		{@const bs = bitString(r.d, BIN)}
		<g opacity={k === 0 ? 1 : 0.75 - k * 0.06}>
			<Readout id="row-{k}">
				<Label
					tabular
					x={L.x + 70}
					y={L.y + k * L.row}
					text={fmt(r.nonce)}
					size={13}
					mono
					anchor="end"
				/>
				<Label
					anchor="start"
					tabular
					x={L.x + 84}
					y={L.y + k * L.row}
					text={bs}
					size={13}
					mono
					color={r.ok ? 'var(--cb-ok)' : undefined}
				/>
				<Label
					anchor="start"
					tabular
					x={L.x + 300}
					y={L.y + k * L.row}
					text="{r.z} zero{r.z === 1 ? '' : 's'}"
					size={12}
					muted={!r.ok}
					color={r.ok ? 'var(--cb-ok)' : undefined}
					weight={r.ok ? 700 : 500}
				/>
			</Readout>
		</g>
	{/each}
	<Readout id="checking" order={3} label="Checking" value="one hash, by anyone">
		<Label
			anchor="start"
			tabular
			x={L.x}
			y={L.y + SHOW * L.row + 14}
			text="Finding it took {fmt(tries)} tries. Checking it takes one."
			size={13}
			weight={600}
			opacity={hit ? 1 : 0}
		/>
		<Label
			anchor="start"
			tabular
			x={L.x}
			y={L.y + SHOW * L.row + 36}
			text="Each zero bit halves the chance per try: 1 in 2^{bits}."
			size={12}
			muted
		/>
	</Readout>
</g>
