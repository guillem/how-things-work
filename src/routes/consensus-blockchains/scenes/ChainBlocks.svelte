<script lang="ts">
	/**
	 * Four blocks, each storing the hash of the one before (double SHA-256, `consensus.ts`).
	 * Block 1's data is an HTML input in a `foreignObject` (kept in `params.tamper`, so the edit
	 * survives moving between the two steps that show it).
	 *
	 * Without `work`, every nonce is 0 and "Recompute the later blocks" (`params.repair`) fixes
	 * the links at once. With `work`, every block must have CHAIN_BITS zero bits, and "Re-mine
	 * the later blocks" (`params.remine`) re-mines blocks 1–3 one after the other, the counter
	 * running over a few seconds of `t`. A fix applies to the text it was made for: editing
	 * again breaks the chain again.
	 */
	import { clamp, easeInOut } from '#lib/draw/index.ts';
	import { Readout, type Params, type ParamValue } from '#lib/explainer/index.ts';
	import { buildChain, remine, validate, zeroBits, blockDigest, type Block } from '../consensus';
	import { CHAIN_BITS, CHAIN_DATA, fmt, str } from './shared';
	import Txt from './Txt.svelte';

	interface Props {
		t: number;
		params: Params;
		setParam: (id: string, value: ParamValue) => void;
		reduced: boolean;
		work: boolean;
	}
	let { t, params, setParam, reduced, work }: Props = $props();

	const bits = $derived(work ? CHAIN_BITS : 0);
	const tamper = $derived(str(params.tamper, CHAIN_DATA[1]).slice(0, 24));
	const base = $derived(buildChain(CHAIN_DATA, bits).blocks);
	const tampered = $derived(base.map((b, i) => (i === 1 ? { ...b, data: tamper } : b)));
	const edited = $derived(tamper !== CHAIN_DATA[1]);

	// ---- the cover-up: which text it was made for, and when ------------------------------------
	const presses = $derived(Number((work ? params.remine : params.repair) ?? 0));
	let lastPresses = -1;
	let pressT = 0;
	let fixedFor: string | null = null;
	const fix = $derived.by(() => {
		if (lastPresses < 0) lastPresses = presses;
		else if (presses !== lastPresses) {
			lastPresses = presses;
			pressT = t;
			fixedFor = tamper;
		}
		if (t < pressT) pressT = 0;
		return fixedFor === tamper && edited ? { at: pressT, text: tamper } : null;
	});
	const redone = $derived(fix ? remine(tampered, 1, bits) : null);
	const totalTries = $derived(redone ? redone.tries.reduce((a, b) => a + b, 0) : 0);
	const DUR = 4;
	const u = $derived(fix ? (reduced ? 1 : clamp((t - fix.at - 0.3) / DUR)) : 0);
	const triesShown = $derived(work ? Math.round(totalTries * easeInOut(u)) : totalTries);

	/** The chain as drawn: re-mined blocks replace the tampered ones as they are found. */
	const shown = $derived.by((): { blocks: Block[]; mining: number; nonceNow: number } => {
		if (!redone) return { blocks: tampered, mining: -1, nonceNow: 0 };
		if (!work) return { blocks: redone.blocks, mining: -1, nonceNow: 0 };
		const blocks = tampered.slice();
		let left = triesShown;
		for (let i = 1; i < blocks.length; i++) {
			const need = redone.tries[i - 1];
			if (left >= need) {
				blocks[i] = redone.blocks[i];
				left -= need;
			} else return { blocks, mining: i, nonceNow: left };
		}
		return { blocks, mining: -1, nonceNow: 0 };
	});
	const checks = $derived(validate(shown.blocks, bits));
	const allValid = $derived(checks.every((c) => c.valid));

	const status = $derived.by(() => {
		if (!edited) return 'All 4 blocks valid: each stores the hash of the one before';
		if (!fix) {
			const bad = checks.flatMap((c, i) => (c.valid ? [] : [String(i)]));
			const names = bad.length > 1 ? `${bad.slice(0, -1).join(', ')} and ${bad.at(-1)}` : bad[0];
			return `Block 1 edited: block${bad.length > 1 ? 's' : ''} ${names} no longer valid`;
		}
		if (!work) return 'Recomputed 3 hashes: the chain looks valid again';
		if (shown.mining > 0) return `Re-mining block ${shown.mining}: ${fmt(triesShown)} tries so far`;
		return `Re-mined 3 blocks: ${fmt(totalTries)} tries`;
	});

	// ---- layout ------------------------------------------------------------------------------------
	const CARD = { x: 22, y: 128, w: 212, gap: 24 };
	const H = $derived(work ? 304 : 256);
	const cx = (i: number) => CARD.x + i * (CARD.w + CARD.gap);
	const rows = $derived(
		work
			? { prev: 70, data: 120, nonce: 180, hash: 222, status: 276 }
			: { prev: 70, data: 120, nonce: 0, hash: 180, status: 230 }
	);
	const zeroHex = $derived(Math.floor(bits / 4));
	const hexLine = (h: string) => h.slice(0, 16) + '…';
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Chain"
		value={work ? 'blocks with proof-of-work (12 zero bits)' : 'blocks linked by hash'}
	>
		<Txt
			x={24}
			y={40}
			text={work
				? 'Every block has a proof of work: its hash starts with 12 zero bits (000 in hex)'
				: 'Four blocks, each holding the hash of the one before'}
			size={16}
			weight={700}
		/>
	</Readout>
	<Readout
		id="status"
		order={2}
		label="Status"
		value={status}
		color={allValid ? 'var(--cb-ok)' : 'var(--cb-bad)'}
	>
		<Txt
			x={24}
			y={66}
			text={status}
			size={13}
			weight={600}
			color={allValid ? 'var(--cb-ok)' : 'var(--cb-bad)'}
		/>
	</Readout>

	{#each shown.blocks as b, i (i)}
		{@const c = checks[i]}
		{@const x = cx(i)}
		{@const y = CARD.y}
		{@const mining = shown.mining === i}
		<!-- link arrow from the previous block's hash to this block's prev -->
		{#if i > 0}
			<path
				d="M{x - CARD.gap - 6} {y + rows.hash - 4} C{x - 4} {y + rows.hash - 4}, {x - CARD.gap} {y +
					rows.prev -
					4}, {x + 2} {y + rows.prev - 4}"
				fill="none"
				stroke={c.linkOk ? 'var(--cb-ok)' : 'var(--cb-bad)'}
				stroke-width="2"
				stroke-dasharray={c.linkOk ? undefined : '5 4'}
				marker-end="url(#arrowhead)"
			/>
		{/if}
		<rect
			{x}
			{y}
			width={CARD.w}
			height={H}
			rx="12"
			fill="var(--cb-card)"
			stroke={mining ? 'var(--cb-work)' : c.valid ? 'var(--cb-ok)' : 'var(--cb-bad)'}
			stroke-width="2"
		/>
		<Txt
			x={x + 14}
			y={y + 28}
			text={i === 0 ? 'Block 0 (genesis)' : `Block ${i}`}
			size={15}
			weight={700}
		/>
		<Readout id="prev-{i}">
			<Txt x={x + 14} y={y + rows.prev - 18} text="hash of the block before" size={11} muted />
		</Readout>
		<Txt
			x={x + 14}
			y={y + rows.prev}
			text={hexLine(b.prev)}
			size={13}
			mono
			color={i > 0 && !c.linkOk ? 'var(--cb-bad)' : undefined}
		/>
		<Txt x={x + 14} y={y + rows.data - 18} text="data" size={11} muted />
		{#if i === 1}
			<foreignObject x={x + 10} y={y + rows.data - 10} width={CARD.w - 20} height="36">
				<input
					class="cb-text"
					class:edited
					type="text"
					value={tamper}
					maxlength="24"
					spellcheck="false"
					autocomplete="off"
					aria-label="Data of block 1"
					oninput={(e) => setParam('tamper', e.currentTarget.value)}
				/>
			</foreignObject>
		{:else}
			<Txt x={x + 14} y={y + rows.data + 14} text={b.data} size={14} mono />
		{/if}
		{#if work}
			<Txt x={x + 14} y={y + rows.nonce - 18} text="nonce" size={11} muted />
			<Txt
				x={x + 14}
				y={y + rows.nonce}
				text={mining ? `${fmt(shown.nonceNow)} …` : fmt(b.nonce)}
				size={14}
				mono
				color={mining ? 'var(--cb-work)' : undefined}
			/>
		{/if}
		<Txt x={x + 14} y={y + rows.hash - 18} text="this block’s hash" size={11} muted />
		{@const h = c.hash}
		{#if work}
			<text x={x + 14} y={y + rows.hash} style:font-size="13px" style:font-family="var(--font-mono)"
				><tspan style:fill={c.workOk ? 'var(--cb-ok)' : 'var(--cb-bad)'} style:font-weight="700"
					>{h.slice(0, zeroHex)}</tspan
				><tspan>{h.slice(zeroHex, 16)}…</tspan></text
			>
			<Readout id="zeros-{i}">
				<Txt
					x={x + 14}
					y={y + rows.hash + 18}
					text="{zeroBits(blockDigest(b))} zero bits{c.workOk ? '' : ': not enough'}"
					size={11}
					muted={c.workOk}
					color={c.workOk ? undefined : 'var(--cb-bad)'}
				/>
			</Readout>
		{:else}
			<Txt x={x + 14} y={y + rows.hash} text={hexLine(h)} size={13} mono />
		{/if}
		<rect
			x={x + 14}
			y={y + rows.status - 16}
			width={CARD.w - 28}
			height="24"
			rx="12"
			fill={mining ? 'var(--cb-work)' : c.valid ? 'var(--cb-ok)' : 'var(--cb-bad)'}
		/>
		<text
			x={x + CARD.w / 2}
			y={y + rows.status + 1}
			text-anchor="middle"
			style:font-size="12px"
			style:font-weight="700"
			style:fill="white"
			>{mining
				? 'mining…'
				: c.valid
					? 'valid'
					: !c.linkOk
						? 'broken link'
						: !c.workOk
							? 'not enough zeros'
							: 'after a broken block'}</text
		>
	{/each}

	{#if !edited}
		<Readout id="hint">
			<Txt
				x={cx(1) + CARD.w / 2}
				y={CARD.y + H + 30}
				text="↑ type in block 1 to change a payment"
				size={13}
				weight={600}
				anchor="middle"
				color="var(--cb-work)"
			/>
		</Readout>
	{/if}

	<Readout
		id="note"
		order={3}
		label="Cost"
		value={work
			? `${fmt(totalTries || 3 * 2 ** CHAIN_BITS)} tries to rewrite 3 blocks`
			: '3 hashes to rewrite 3 blocks'}
	>
		<Txt
			x={24}
			y={work ? 488 : 440}
			text={work
				? `Rewriting block 1 means re-mining it and every block after it: about ${fmt(2 ** CHAIN_BITS)} tries each here.`
				: 'Change one letter of block 1 and its hash changes completely, so block 2’s link breaks.'}
			size={13}
		/>
		<Txt
			x={24}
			y={work ? 510 : 462}
			text={work
				? 'Meanwhile the honest miners keep adding blocks on top, so a forger has to outpace them all.'
				: 'But with no work required, a forger can recompute the later blocks in no time.'}
			size={13}
			muted
		/>
	</Readout>
</g>

<style>
	.cb-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 8px;
		border: 1.5px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 14px var(--font-mono);
		user-select: text;
		-webkit-user-select: text;
	}
	.cb-text.edited {
		border-color: var(--cb-bad);
	}
	@media (max-width: 640px) {
		.cb-text {
			font-size: 26px;
			padding: 0 4px;
		}
	}
	.cb-text:focus {
		outline: none;
		border-color: var(--cb-work);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--cb-work) 30%, transparent);
	}
</style>
