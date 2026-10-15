<script lang="ts">
	/**
	 * The strangers chapter. Phases (`step.hints.phase`):
	 * - `fork`: five miners, propagation delay `params.delay`; the block tree with orphans.
	 * - `race`: the double-spend race and Nakamoto's attacker-success probability.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import ForkView from './ForkView.svelte';
	import RaceView from './RaceView.svelte';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'fork'));
</script>

{#if phase === 'race'}
	<RaceView {t} {params} {reduced} />
{:else}
	<ForkView {t} {params} {reduced} />
{/if}
