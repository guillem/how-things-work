<script lang="ts">
	/**
	 * The chain chapter. Phases (`step.hints.phase`):
	 * - `link`: four blocks linked by hash, no proof-of-work; edit block 1, then recompute.
	 * - `mine`: one block, nonce after nonce until the hash has `params.bits` zero bits.
	 * - `rework`: the same chain with proof-of-work; edit block 1, then re-mine the rest.
	 * - `retarget`: Bitcoin's difficulty retarget over successive 2016-block periods.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import ChainBlocks from './ChainBlocks.svelte';
	import MineView from './MineView.svelte';
	import RetargetView from './RetargetView.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'link'));
</script>

{#if phase === 'mine'}
	<MineView {t} {params} {reduced} />
{:else if phase === 'retarget'}
	<RetargetView {t} {params} {reduced} />
{:else}
	<ChainBlocks {t} {params} {setParam} {reduced} work={phase === 'rework'} />
{/if}
