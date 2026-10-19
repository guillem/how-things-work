<script lang="ts">
	/**
	 * A Bloom filter of 32 bits and k hash functions (the slider). Four words are added, one every
	 * 2.2 s: k lines run from the word to its bits, which turn on. Then six queries, one every
	 * 2.6 s, in the order: a word never added (some bit is 0: "definitely absent"), an added word
	 * ("maybe present", and it was), and a never-added word whose bits are all set anyway (a false
	 * positive), twice over. Then the filter empties and it starts again. Reduced motion shows the
	 * false positive, complete.
	 */
	import { Label, clamp, easeInOut, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { INSERTABLE, QUERIES, bitsOf } from '../model';
	import { C, int, memo } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const M = 32;
	const k = $derived(int(params, 'bloomK', 3, 1, 5));
	const SHORT = INSERTABLE.filter((w) => w.length >= 4 && w.length <= 7);
	const ADDED = SHORT.slice(20, 24);
	const QSHORT = QUERIES.filter((w) => w.length >= 4 && w.length <= 7);

	interface Plan {
		bits: number[][]; // bits of each added word
		queries: { word: string; kind: 'absent' | 'present' | 'fp' }[];
	}
	const planOf = memo((key: string): Plan => {
		const kk = Number(key);
		const bits = ADDED.map((w) => bitsOf(w, M, kk));
		const set = new Set(bits.flat());
		const isSet = (w: string) => bitsOf(w, M, kk).every((b) => set.has(b));
		const absent = QSHORT.filter((w) => !isSet(w));
		const fps = QSHORT.filter((w) => isSet(w));
		const queries: Plan['queries'] = [];
		for (let r = 0; r < 2; r++) {
			queries.push({ word: absent[r], kind: 'absent' });
			queries.push({ word: ADDED[r * 2 + 1], kind: 'present' });
			if (fps[r]) queries.push({ word: fps[r], kind: 'fp' });
			else queries.push({ word: absent[r + 2], kind: 'absent' });
		}
		return { bits, queries };
	}, 6);
	const plan = $derived(planOf(String(k)));

	const ADD = 2.2;
	const ASK = 2.6;
	const CYCLE = ADD * 4 + ASK * 6;
	const time = $derived(reduced ? ADD * 4 + ASK * 2 + ASK * 0.9 : t % CYCLE);
	const adding = $derived(time < ADD * 4);
	const idx = $derived(adding ? Math.floor(time / ADD) : Math.floor((time - ADD * 4) / ASK));
	const u = $derived(adding ? (time - idx * ADD) / ADD : (time - ADD * 4 - idx * ASK) / ASK);
	/** Words whose bits are on so far (the current one once its lines arrive). */
	const addedSoFar = $derived(adding ? idx + (u > 0.55 ? 1 : 0) : 4);
	const on = $derived(new Set(plan.bits.slice(0, addedSoFar).flat()));
	const current = $derived(
		adding ? { word: ADDED[idx], kind: 'add' as const } : (plan.queries[idx] ?? plan.queries[0])
	);
	const curBits = $derived(adding ? plan.bits[idx] : bitsOf(current.word, M, k));
	const reach = $derived(easeInOut(clamp((u - 0.12) / 0.4)));
	const verdictIn = $derived(smoothstep(0.55, 0.65, u));
	const firstZero = $derived(curBits.find((b) => !on.has(b)));

	// ---- geometry ------------------------------------------------------------------------
	const X0 = 40;
	const PITCH = 880 / M;
	const BW = PITCH - 4;
	const BY = 300;
	const BH = 34;
	const bx = (b: number) => X0 + b * PITCH + BW / 2;
	const WX = 480;
	const WY = 150;
	const HUES = ['#7048e8', '#1c7ed6', '#0c8599', '#e8590c', '#c2255c'];

	const verdict = $derived.by(() => {
		if (current.kind === 'add') return { text: `added: its ${k} bits set to 1`, color: C.key };
		if (current.kind === 'absent')
			return {
				text: `bit ${firstZero} is 0: definitely never added`,
				color: C.absentText
			};
		if (current.kind === 'present')
			return { text: `all ${k} bits are 1: maybe present (it was added)`, color: C.hitText };
		return {
			text: `all ${k} bits are 1: maybe present, but it was never added: a false positive`,
			color: C.fpText
		};
	});
	const ones = $derived(on.size);
</script>

<g>
	<Readout
		id="bl-title"
		order={1}
		label="Filter"
		value="32 bits, k = {k}, {addedSoFar} words added"
	>
		<Label
			x={40}
			y={44}
			anchor="start"
			text="a Bloom filter: 32 bits, k = {k} hash functions"
			size={15}
			weight={700}
		/>
	</Readout>
	<Readout id="bl-mode">
		<Label
			x={40}
			y={66}
			anchor="start"
			text={adding ? 'adding words: set their bits' : 'asking about words: look at their bits'}
			size={12}
			muted
		/>
	</Readout>

	<!-- the word -->
	<rect
		x={WX - 90}
		y={WY - 26}
		width="180"
		height="40"
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label
		x={WX}
		y={WY + 2}
		text="‘{current.word}’"
		size={18}
		weight={700}
		mono
		halo={false}
		color={current.kind === 'add' ? C.key : 'var(--stage-ink)'}
	/>
	<Label
		x={WX}
		y={WY - 38}
		text={current.kind === 'add' ? 'add' : 'is it in the set?'}
		size={12}
		muted
	/>

	<!-- k lines from the word to its bits -->
	{#each curBits as b, i (i)}
		{@const x2 = bx(b)}
		{@const x1 = WX - 60 + (120 * (i + 0.5)) / k}
		<path
			d="M{x1} {WY + 16} L{x1 + (x2 - x1) * reach} {WY + 16 + (BY - 6 - WY - 16) * reach}"
			stroke={HUES[i]}
			stroke-width="1.8"
			fill="none"
			opacity="0.9"
		/>
	{/each}

	<!-- the bits -->
	{#each { length: M }, b (b)}
		{@const lit = on.has(b)}
		<rect
			x={X0 + b * PITCH}
			y={BY}
			width={BW}
			height={BH}
			rx="4"
			fill={lit ? C.bit : C.slot}
			stroke={C.slotEdge}
			stroke-width="0.8"
		/>
		<text
			x={bx(b)}
			y={BY + 22}
			text-anchor="middle"
			font-size="13"
			font-family="ui-monospace, monospace"
			fill={lit ? 'white' : 'var(--stage-ink-muted)'}>{lit ? 1 : 0}</text
		>
		{#if b % 4 === 0}
			<text
				x={bx(b)}
				y={BY + BH + 16}
				text-anchor="middle"
				font-size="10"
				fill="var(--stage-ink-muted)">{b}</text
			>
		{/if}
	{/each}
	{#if reach > 0.98}
		{#each curBits as b, i (i)}
			<rect
				x={X0 + b * PITCH - 3}
				y={BY - 3}
				width={BW + 6}
				height={BH + 6}
				rx="6"
				fill="none"
				stroke={current.kind !== 'add' && !on.has(b) ? C.absent : HUES[i]}
				stroke-width={current.kind !== 'add' && !on.has(b) ? 3.5 : 2.2}
			/>
		{/each}
	{/if}

	<!-- verdict -->
	<g opacity={verdictIn}>
		<Readout
			id="bl-verdict"
			order={2}
			label="‘{current.word}’"
			value={verdict.text}
			color={verdict.color}
		>
			<Label x={480} y={BY + 78} text={verdict.text} size={15} weight={700} color={verdict.color} />
		</Readout>
	</g>

	<!-- what is in it -->
	<Readout
		id="bl-added"
		order={3}
		label="Added"
		value={ADDED.slice(0, addedSoFar).join(', ') || 'nothing yet'}
	>
		<Label x={40} y={430} anchor="start" text="added so far:" size={12} muted />
		{#each ADDED as w, i (w)}
			<Label
				x={130 + i * 96}
				y={430}
				anchor="start"
				text="‘{w}’"
				size={13}
				mono
				weight={600}
				opacity={i < addedSoFar ? 1 : 0.25}
			/>
		{/each}
	</Readout>
	<Readout id="bl-ones" order={4} label="Bits set" value="{ones} of 32">
		<Label x={40} y={458} anchor="start" text="bits set: {ones} of 32" size={12} muted tabular />
	</Readout>
	<Readout id="bl-rule">
		<Label
			x={40}
			y={506}
			anchor="start"
			text="a 0 among its bits proves a word was never added; all 1s only say “maybe”"
			size={12}
			weight={600}
		/>
	</Readout>
</g>
