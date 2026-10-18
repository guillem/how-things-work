<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './ExpLogStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag mul">multiplier</strong> */
	:global(.body .tag) {
		padding-left: 1.05em;
		background: radial-gradient(circle at 0.4em 55%, var(--tag) 0.36em, transparent 0.4em);
	}
	:global(.body .tag.add) {
		--tag: var(--xl-add);
	}
	:global(.body .tag.mul) {
		--tag: var(--xl-mul);
	}
	:global(.body .tag.slow) {
		--tag: var(--xl-slow);
	}
	:global(.body .tag.a) {
		--tag: var(--xl-a);
	}
	:global(.body .tag.b) {
		--tag: var(--xl-b);
	}
</style>
