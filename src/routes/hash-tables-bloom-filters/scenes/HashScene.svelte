<script lang="ts">
	/**
	 * A word, its 32-bit MurmurHash3, and its bucket, the hash mod m. Every 2.6 s the next of 20
	 * words is hashed (its bits fill in from the left), the remainder is worked out, and the word
	 * drops into its bucket; earlier words stay where they fell, so collisions pile up. A second
	 * bit row shows the hash of the same word with its last letter changed: about half the bits
	 * differ. Reduced motion shows the tenth word placed.
	 */
	import { Label, clamp, easeInOut, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { INSERTABLE, murmur3 } from '../model';
	import { C, group, hex, int } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const m = $derived(int(params, 'm', 12, 5, 20));
	const WORDS = INSERTABLE.filter((w) => w.length >= 3 && w.length <= 7).slice(0, 20);
	const PERIOD = 2.6;
	const time = $derived(reduced ? PERIOD * 9 + PERIOD * 0.99 : t);
	const i = $derived(Math.floor(time / PERIOD) % WORDS.length);
	const u = $derived((time % PERIOD) / PERIOD);

	const word = $derived(WORDS[i]);
	const h = $derived(murmur3(word));
	const bucket = $derived(h % m);
	/** The same word with its last letter moved on by one (z wraps to a). */
	const twin = $derived(
		word.slice(0, -1) + String.fromCharCode(((word.charCodeAt(word.length - 1) - 97 + 1) % 26) + 97)
	);
	const h2 = $derived(murmur3(twin));
	const bitsOf = (x: number) => Array.from({ length: 32 }, (_, b) => (x >>> (31 - b)) & 1);
	const bits = $derived(bitsOf(h));
	const bits2 = $derived(bitsOf(h2));
	const differ = $derived(bits.filter((b, j) => b !== bits2[j]).length);

	const bitsShown = $derived(Math.floor(clamp(u / 0.3) * 32 + (u >= 0.3 ? 1 : 0)));
	const modIn = $derived(smoothstep(0.3, 0.4, u));
	const drop = $derived(easeInOut(clamp((u - 0.55) / 0.3)));

	// buckets
	const BX0 = 40;
	const BX1 = 920;
	const colW = $derived((BX1 - BX0) / m);
	const colX = (b: number) => BX0 + (b + 0.5) * colW;
	const BY = 372;
	const ROW = 17;
	/** Words placed so far, by bucket (the current one only once it has landed). */
	const placed = $derived.by(() => {
		const cols: string[][] = Array.from({ length: m }, () => []);
		for (let j = 0; j < i; j++) cols[murmur3(WORDS[j]) % m].push(WORDS[j]);
		return cols;
	});
	const depth = $derived(placed[bucket].length);
	const landX = $derived(colX(bucket));
	const landY = $derived(BY + 30 + depth * ROW);
	const flyX = $derived(150 + (landX - 150) * drop);
	const flyY = $derived(118 + (landY - 118) * drop);
	const collides = $derived(depth > 0);
	const fontFor = (w: string) => Math.min(12, (colW - 6) / (0.6 * w.length));

	const BIT_X = 80;
	const BIT_W = 25;
</script>

<g>
	<Label
		x={40}
		y={44}
		anchor="start"
		text="hash the word, then take the remainder mod m"
		size={15}
		weight={700}
	/>

	<!-- the word -->
	<Readout id="hs-word" order={1} label="Word" value="‘{word}’">
		<Label x={40} y={92} anchor="start" text="word" size={11} muted />
	</Readout>
	<Label x={40} y={124} anchor="start" text={word} size={26} weight={700} mono color={C.key} />
	<path
		d="M260 116 H330"
		stroke="var(--stage-line)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
		fill="none"
	/>
	<rect
		x="340"
		y="94"
		width="150"
		height="40"
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label x={415} y={119} text="MurmurHash3" size={13} weight={600} halo={false} />
	<path
		d="M500 116 H560"
		stroke="var(--stage-line)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
		fill="none"
	/>
	<Readout id="hs-hash" order={2} label="Hash h" value="{hex(h)} = {group(h)}">
		<Label
			x={572}
			y={110}
			anchor="start"
			text="h = {hex(h)}"
			size={15}
			weight={700}
			mono
			opacity={bitsShown >= 32 ? 1 : 0.25}
		/>
		<Label
			x={572}
			y={130}
			anchor="start"
			text="= {group(h)}"
			size={12}
			muted
			tabular
			opacity={bitsShown >= 32 ? 1 : 0.25}
		/>
	</Readout>

	<!-- the 32 bits -->
	<Readout id="hs-bits">
		<Label x={40} y={184} anchor="start" text="32 bits" size={11} muted />
	</Readout>
	{#each bits as b, j (j)}
		{@const on = j < bitsShown}
		<rect
			x={BIT_X + j * BIT_W}
			y={166}
			width={BIT_W - 3}
			height={26}
			rx="3"
			fill={on && b ? C.key : C.slot}
			stroke={C.slotEdge}
			stroke-width="0.8"
			opacity={on ? 1 : 0.5}
		/>
		{#if on}
			<text
				x={BIT_X + j * BIT_W + (BIT_W - 3) / 2}
				y={184}
				text-anchor="middle"
				font-size="12"
				font-family="ui-monospace, monospace"
				fill={b ? 'white' : 'var(--stage-ink-muted)'}>{b}</text
			>
		{/if}
	{/each}
	<!-- the twin: last letter changed -->
	<Readout
		id="hs-twin"
		order={4}
		label="One letter changed"
		value="‘{twin}’: {differ} of 32 bits differ"
	>
		<Label
			x={40}
			y={222}
			anchor="start"
			text="‘{twin}’, its last letter changed: {differ} of the 32 bits flip (orange)"
			size={12}
			muted
			opacity={bitsShown >= 32 ? 1 : 0.3}
		/>
	</Readout>
	{#each bits2 as b, j (j)}
		<rect
			x={BIT_X + j * BIT_W}
			y={232}
			width={BIT_W - 3}
			height={12}
			rx="2"
			fill={b !== bits[j] ? C.moved : C.slot}
			stroke={C.slotEdge}
			stroke-width="0.6"
			opacity={bitsShown >= 32 ? 1 : 0.3}
		/>
	{/each}

	<!-- mod m -->
	<g opacity={modIn}>
		<Readout
			id="hs-mod"
			order={3}
			label="Bucket"
			value="{group(h)} mod {m} = {bucket}"
			color={C.key}
		>
			<Label
				x={40}
				y={290}
				anchor="start"
				text="{group(h)} mod {m} = {bucket}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="hs-why">
			<Label
				x={40}
				y={312}
				anchor="start"
				text={collides
					? `bucket ${bucket} already holds ${depth === 1 ? `‘${placed[bucket][0]}’` : `${depth} words`}: a collision`
					: `bucket ${bucket} is empty`}
				size={12}
				color={collides ? C.missText : undefined}
				muted={!collides}
				weight={collides ? 600 : 500}
			/>
		</Readout>
	</g>

	<!-- buckets -->
	{#each placed as col, b (b)}
		<rect
			x={BX0 + b * colW + 2}
			y={BY}
			width={colW - 4}
			height={212}
			rx="6"
			fill={C.slot}
			stroke={b === bucket && modIn > 0.5 ? C.key : C.slotEdge}
			stroke-width={b === bucket && modIn > 0.5 ? 2 : 1}
		/>
		<text x={colX(b)} y={BY + 16} text-anchor="middle" font-size="11" fill="var(--stage-ink-muted)"
			>{b}</text
		>
		{#each col as w, r (w)}
			<text
				x={colX(b)}
				y={BY + 34 + r * ROW}
				text-anchor="middle"
				font-size={fontFor(w)}
				font-family="ui-monospace, monospace"
				fill="var(--stage-ink)">{w}</text
			>
		{/each}
	{/each}
	{#if drop > 0.02}
		<text
			x={flyX}
			y={flyY + 4}
			text-anchor="middle"
			font-size={drop >= 1 ? fontFor(word) : 26 + (fontFor(word) - 26) * drop}
			font-weight="700"
			font-family="ui-monospace, monospace"
			fill={C.key}>{word}</text
		>
	{/if}
</g>
