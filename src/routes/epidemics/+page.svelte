<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './EpidemicsStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag s">Susceptible</strong> */
	:global(.body .tag) {
		padding-left: 1.05em;
		background: radial-gradient(circle at 0.4em 55%, var(--tag) 0.36em, transparent 0.4em);
	}
	:global(.body .tag.s) {
		--tag: var(--sir-s);
	}
	:global(.body .tag.i) {
		--tag: var(--sir-i);
	}
	:global(.body .tag.r) {
		--tag: var(--sir-r);
	}
</style>
