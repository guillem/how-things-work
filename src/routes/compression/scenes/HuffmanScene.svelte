<script lang="ts">
	/**
	 * Huffman coding of the reader's message (`step.hints.phase`):
	 *   build — the tree grows as a function of t: one merge of the two lightest nodes at a time,
	 *           the latest one called out. Nodes still waiting to be merged are ringed.
	 *   codes — the finished tree with 0/1 on every branch and each symbol's code word under
	 *           it; the path to one symbol at a time is lit.
	 *   size  — the coded message, decoded one symbol at a time, and bars comparing UTF-8, the
	 *           fixed-length code, Huffman and the entropy floor n·H.
	 * The tree is drawn as a dendrogram: leaves on one row in the tree's own left-to-right order,
	 * each merge at a height of one more than its taller child, so branches never cross.
	 */
	import { clamp, easeOut } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		encode,
		fixedBits,
		heights,
		huffmanFor,
		leafOrder,
		messageEntropy,
		symbolStats,
		symbolsOf,
		utf8Bits
	} from '../compression';
	import MessageInput from './MessageInput.svelte';
	import { fmt, messageOf, show } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'build'));
	const tv = $derived(reduced ? 1e6 : t);

	const msg = $derived(messageOf(params));
	const syms = $derived(symbolsOf(msg));
	const n = $derived(syms.length);
	const h = $derived(huffmanFor(msg));
	const k = $derived(h.codes.size);
	const merges = $derived(h.merges.length);
	const H = $derived(messageEntropy(msg));
	const stats = $derived(symbolStats(msg));
	const bitsOf = $derived(new Map(stats.map((s) => [s.symbol, s.bits])));

	// ---- layout -----------------------------------------------------------------------------
	const X0 = 40;
	const W = 880;
	const LEAF = 392;
	const ht = $derived(heights(h));
	const rootH = $derived(h.root >= 0 ? ht[h.root] : 0);
	const dy = $derived(Math.min(56, (LEAF - 168) / Math.max(1, rootH)));
	const order = $derived(leafOrder(h));
	const pos = $derived.by(() => {
		const p = h.nodes.map(() => ({ x: 0, y: LEAF }));
		const sp = W / Math.max(1, order.length);
		order.forEach((id, i) => (p[id] = { x: X0 + (i + 0.5) * sp, y: LEAF }));
		for (const node of h.nodes)
			if (node.children) {
				const [a, b] = node.children;
				p[node.id] = { x: (p[a].x + p[b].x) / 2, y: LEAF - ht[node.id] * dy };
			}
		return p;
	});
	const spacing = $derived(W / Math.max(1, k));
	const leafW = $derived(Math.min(32, spacing - 4));

	// ---- build: merge j appears at T0 + j·dt --------------------------------------------------
	const T0 = 1;
	const dt = $derived(clamp(11 / Math.max(1, merges), 0.45, 1.3));
	const appear = (j: number) => (phase === 'build' ? easeOut(clamp((tv - T0 - j * dt) / 0.45)) : 1);
	/** Merges done so far (the latest may still be fading in). */
	const done = $derived(
		phase === 'build' ? Math.min(merges, Math.max(0, Math.floor((tv - T0) / dt) + 1)) : merges
	);
	const latest = $derived(phase === 'build' && done > 0 ? done - 1 : -1);
	const parentOf = $derived.by(() => {
		const p = h.nodes.map(() => -1);
		for (const node of h.nodes) if (node.children) for (const c of node.children) p[c] = node.id;
		return p;
	});
	/** Still in the pool after `done` merges: the node exists and its parent does not yet. */
	const waiting = (id: number) => {
		if (id >= k + done) return false;
		const parent = parentOf[id];
		return parent < 0 || parent >= k + done;
	};

	// ---- codes: one path lit at a time ------------------------------------------------------
	const lit = $derived(
		phase === 'codes' && order.length > 0
			? order[reduced ? 0 : Math.floor(tv / 1.8) % order.length]
			: -1
	);
	const litPath = $derived.by(() => {
		const s: number[] = [];
		for (let id = lit; id >= 0; id = parentOf[id]) s.push(id);
		return s;
	});
	const litSym = $derived(lit >= 0 ? (h.nodes[lit].symbol ?? '') : '');

	// ---- size -------------------------------------------------------------------------------
	const coded = $derived(encode(msg, h));
	const avg = $derived(n ? coded.length / n : 0);
	const CH = 9.6; // width of one mono digit at 16 px
	const groups = $derived.by(() => {
		let x = X0;
		let row = 0;
		return syms.map((s, i) => {
			const code = h.codes.get(s) ?? '';
			const w = code.length * CH + 8;
			if (x + w > X0 + W) {
				x = X0;
				row++;
			}
			const g = { i, s, code, x, w, y: 180 + row * 52 };
			x += w + 2;
			return g;
		});
	});
	const cursor = $derived(reduced ? n : Math.floor(tv / 0.55) % (n + 5));
	const bars = $derived.by(() => {
		const utf8 = utf8Bits(msg);
		return [
			{ label: 'UTF-8 text', bits: utf8, color: 'var(--stage-ink-muted)' },
			{
				label: `Fixed ${fixedBits(k)}-bit code`,
				bits: n * fixedBits(k),
				color: 'var(--cmp-count)'
			},
			{
				label: 'Huffman code',
				bits: coded.length,
				color: 'var(--explainer-accent, var(--accent))'
			},
			{ label: 'Entropy floor n × H', bits: n * H, color: 'var(--cmp-h)' }
		];
	});
	const barsY = $derived(Math.max(300, (groups.at(-1)?.y ?? 180) + 70));
	const maxBar = $derived(Math.max(1, ...bars.map((b) => b.bits)));
	const grow = $derived(easeOut(clamp((tv - 0.3) / 1.2)));

	/** The build callout, as a phone readout row. */
	const mergeRow = $derived.by(() => {
		if (latest < 0)
			return {
				label: 'Symbols',
				value: merges === 0 ? '1: nothing to merge' : String(k),
				note: 'each weighted by its count'
			};
		const [a, b] = h.merges[latest];
		return {
			label: `Merge ${latest + 1} of ${merges}`,
			value: `${h.nodes[a].weight} + ${h.nodes[b].weight} = ${h.nodes[k + latest].weight}`,
			note: 'the two rarest nodes'
		};
	});
</script>

<g>
	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="your-message">
		<Txt x={40} y={14} text="Your message" size={12} weight={700} />
	</Readout>
	<MessageInput x={40} y={22} w={600} value={msg} {setParam} presets />

	{#if n === 0}
		<Txt x={480} y={260} text="Type something in the box" size={15} anchor="middle" muted />
	{:else if phase !== 'size'}
		<!-- branches -->
		{#each h.nodes as node (node.id)}
			{#if node.children}
				{@const a = appear(node.id - k)}
				{@const p = pos[node.id]}
				{#each node.children as c, bit (c)}
					{@const q = pos[c]}
					{@const on = litPath.includes(c)}
					<path
						d="M{p.x} {p.y} H{q.x} V{q.y - (c < k ? 16 : 11)}"
						fill="none"
						stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--stage-line)'}
						stroke-width={on ? 3 : 1.5}
						opacity={a}
					/>
					{#if phase === 'codes' && (spacing >= 30 || on)}
						<Txt
							x={(p.x + q.x) / 2}
							y={p.y - 6}
							text={String(bit)}
							size={on ? 14 : 12}
							weight={700}
							anchor="middle"
							color={bit ? 'var(--cmp-one)' : 'var(--cmp-zero)'}
						/>
					{/if}
				{/each}
			{/if}
		{/each}

		<!-- internal nodes -->
		{#each h.nodes as node (node.id)}
			{#if node.children}
				{@const j = node.id - k}
				{@const p = pos[node.id]}
				{@const fill = litPath.includes(node.id) || j === latest}
				<g opacity={appear(j)}>
					{#if phase === 'build' && waiting(node.id)}
						<circle
							cx={p.x}
							cy={p.y}
							r="15"
							fill="none"
							stroke="var(--cmp-pick)"
							stroke-width="2"
						/>
					{/if}
					<circle
						cx={p.x}
						cy={p.y}
						r="11"
						fill={fill ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
						stroke="var(--explainer-accent, var(--accent))"
						stroke-width="1.5"
					/>
					<text
						x={p.x}
						y={p.y + 4}
						text-anchor="middle"
						style:font-size="11px"
						style:font-weight="700"
						style:fill={fill ? 'white' : undefined}>{node.weight}</text
					>
				</g>
			{/if}
		{/each}

		<!-- leaves -->
		{#each order as id (id)}
			{@const node = h.nodes[id]}
			{@const p = pos[id]}
			{@const on = id === lit}
			<g>
				{#if phase === 'build' && waiting(id)}
					<rect
						x={p.x - leafW / 2 - 3}
						y={p.y - 19}
						width={leafW + 6}
						height="38"
						rx="8"
						fill="none"
						stroke="var(--cmp-pick)"
						stroke-width="2"
					/>
				{/if}
				<rect
					x={p.x - leafW / 2}
					y={p.y - 16}
					width={leafW}
					height="32"
					rx="6"
					fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
					stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
				/>
				<text
					x={p.x}
					y={p.y + 5}
					text-anchor="middle"
					style:font-size="{leafW >= 24 ? 16 : 12}px"
					style:font-weight="600"
					style:font-family="var(--font-mono)"
					style:fill={on ? 'white' : undefined}>{show(node.symbol ?? '')}</text
				>
				<text x={p.x} y={p.y + 32} text-anchor="middle" class="muted" style:font-size="11px"
					>{node.weight}</text
				>
				{#if phase === 'codes'}
					{@const code = h.codes.get(node.symbol ?? '') ?? ''}
					{#each [...code] as d, di (di)}
						<text
							x={p.x}
							y={p.y + 54 + di * 14}
							text-anchor="middle"
							style:font-size="13px"
							style:font-weight={on ? '700' : '500'}
							style:font-family="var(--font-mono)"
							style:fill={d === '1' ? 'var(--cmp-one)' : 'var(--cmp-zero)'}>{d}</text
						>
					{/each}
				{/if}
			</g>
		{/each}

		{#if phase === 'build'}
			<Readout id="merge" order={1} {...mergeRow}>
				{#if latest >= 0}
					{@const [a, b] = h.merges[latest]}
					<Txt
						x={920}
						y={146}
						text="Merge {latest + 1} of {merges}: the two rarest, {h.nodes[a].weight} + {h.nodes[b]
							.weight} = {h.nodes[k + latest].weight}"
						size={13}
						weight={700}
						anchor="end"
					/>
				{:else}
					<Txt
						x={920}
						y={146}
						text={merges === 0
							? 'Only one symbol: nothing to merge'
							: `${k} symbols, each weighted by its count`}
						size={13}
						weight={700}
						anchor="end"
					/>
				{/if}
			</Readout>
			<Readout id="waiting">
				<Txt x={40} y={146} text="◯ waiting to be merged" size={12} color="var(--cmp-pick)" />
				{#snippet narrow()}
					<Txt x={40} y={146} text="◯ waiting" size={26} color="var(--cmp-pick)" />
				{/snippet}
			</Readout>
			<Readout
				id="rule"
				order={2}
				label={done >= merges ? 'Done' : 'Repeat'}
				value={done >= merges
					? `${merges} merge${merges === 1 ? '' : 's'}, one tree`
					: 'join the two rarest nodes'}
				note={done >= merges ? undefined : 'and put the sum back'}
			>
				<Txt
					x={40}
					y={566}
					text={done >= merges
						? `Done: ${merges} merge${merges === 1 ? '' : 's'} join ${k} symbol${k === 1 ? '' : 's'} into one tree`
						: 'Repeat: take the two rarest nodes, join them, put the sum back'}
					size={15}
					weight={600}
				/>
			</Readout>
		{:else if litSym}
			{@const code = h.codes.get(litSym) ?? ''}
			<Readout
				id="code"
				order={1}
				label="“{show(litSym)}”"
				value={code}
				note="{code.length} bit{code.length === 1 ? '' : 's'}; surprise {fmt(
					bitsOf.get(litSym) ?? 0
				)} bits"
				color="var(--explainer-accent, var(--accent))"
			>
				<Txt
					x={920}
					y={146}
					text="“{show(litSym)}” = {code}: {code.length} bit{code.length === 1
						? ''
						: 's'} (surprise {fmt(bitsOf.get(litSym) ?? 0)} bits)"
					size={13}
					weight={700}
					anchor="end"
				/>
			</Readout>
			<Readout id="left-right">
				<Txt x={40} y={146} text="0 = left, 1 = right" size={12} muted />
				{#snippet narrow()}
					<Txt x={40} y={146} text="0 left · 1 right" size={26} muted />
				{/snippet}
			</Readout>
		{/if}
	{:else}
		<Readout id="coded-title">
			<Txt
				x={40}
				y={146}
				text="The message in Huffman code: {coded.length} bits, decoded one symbol at a time"
				size={13}
				weight={700}
			/>
		</Readout>
		{#each groups as g (g.i)}
			{@const on = g.i === cursor}
			<g>
				{#if on}
					<rect
						x={g.x - 1}
						y={g.y - 18}
						width={g.w + 2}
						height="46"
						rx="5"
						fill="var(--explainer-accent, var(--accent))"
						fill-opacity="0.14"
						stroke="var(--explainer-accent, var(--accent))"
					/>
				{/if}
				<text
					x={g.x + g.w / 2}
					y={g.y}
					text-anchor="middle"
					style:font-size="16px"
					style:font-family="var(--font-mono)"
					style:font-weight="600"
					style:fill={g.i % 2 ? 'var(--cmp-one)' : 'var(--cmp-zero)'}>{g.code}</text
				>
				<text
					x={g.x + g.w / 2}
					y={g.y + 21}
					text-anchor="middle"
					opacity={g.i <= cursor ? 1 : 0}
					style:font-size="14px"
					style:font-family="var(--font-mono)">{show(g.s)}</text
				>
			</g>
		{/each}

		{#each bars as b, i (b.label)}
			{@const y = barsY + i * 44}
			{@const w = (b.bits / maxBar) * 520 * grow}
			<g>
				<Readout
					id="bar-{i}"
					order={1 + i}
					label={b.label}
					value="{fmt(b.bits, 1)} bits"
					note={i === 2 && k > 1 ? `${fmt(avg)} bits per symbol, between H and H + 1` : undefined}
					color={b.color}
				>
					<Txt x={40} y={y + 15} text={b.label} size={13} weight={600} />
				</Readout>
				<rect
					x={220}
					{y}
					width={w}
					height="22"
					rx="4"
					fill={b.color}
					fill-opacity={i === 3 ? 0.25 : 0.85}
					stroke={b.color}
					stroke-dasharray={i === 3 ? '5 3' : undefined}
				/>
				<Readout id="bar-value-{i}">
					<Txt
						x={228 + w}
						y={y + 16}
						text="{fmt(b.bits, 1)} bits"
						size={13}
						weight={700}
						color={b.color}
					/>
					{#snippet narrow()}
						<Txt
							x={228 + w}
							y={y + 21}
							text={fmt(b.bits, 1)}
							size={28}
							weight={700}
							color={b.color}
						/>
					{/snippet}
				</Readout>
			</g>
		{/each}
		<Readout id="avg">
			<Txt
				x={40}
				y={566}
				text={k === 1
					? 'Only one symbol: H = 0, but a code still needs 1 bit per symbol'
					: `Huffman: ${fmt(avg)} bits per symbol, between H = ${fmt(H)} and H + 1 = ${fmt(H + 1)}`}
				size={14}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
