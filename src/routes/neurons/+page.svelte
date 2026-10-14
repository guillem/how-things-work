<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './NeuronsStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag na">sodium channels</strong> */
	:global(.body .tag) {
		padding-left: 1.05em;
		background: radial-gradient(circle at 0.4em 55%, var(--tag) 0.36em, transparent 0.4em);
	}
	:global(.body .tag.na) {
		--tag: var(--nr-na);
	}
	:global(.body .tag.k) {
		--tag: var(--nr-k);
	}
	:global(.body .tag.exc) {
		--tag: var(--nr-exc);
	}
	:global(.body .tag.inh) {
		--tag: var(--nr-inh);
	}
</style>
