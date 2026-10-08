<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './ComplexStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <span class="tag re">a</span> */
	:global(.body .tag) {
		padding-left: 1.05em;
		background: radial-gradient(circle at 0.4em 55%, var(--tag) 0.36em, transparent 0.4em);
	}
	:global(.body .tag.re) {
		--tag: var(--cx-re);
	}
	:global(.body .tag.im) {
		--tag: var(--cx-im);
	}
	:global(.body .tag.z) {
		--tag: var(--cx-z);
	}
	:global(.body .tag.w) {
		--tag: var(--cx-w);
	}
	:global(.body .tag.zw) {
		--tag: var(--cx-prod);
	}
</style>
