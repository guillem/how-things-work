<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './RadioactivityStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag rad-parent">intact</strong> */
	:global(.body .tag.rad-parent),
	:global(.body .tag.rad-daughter) {
		padding-left: 1.05em;
		background: linear-gradient(var(--tag), var(--tag)) no-repeat 0.1em 55% / 0.62em 0.62em;
	}
	:global(.body .tag.rad-parent) {
		--tag: var(--rad-parent);
	}
	:global(.body .tag.rad-daughter) {
		--tag: var(--rad-daughter);
	}
</style>
