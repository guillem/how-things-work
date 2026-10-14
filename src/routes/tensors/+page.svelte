<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './TensorsStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag keep">rows</strong> */
	:global(.body .tag) {
		padding-left: 1.05em;
		background: radial-gradient(circle at 0.4em 55%, var(--tag) 0.36em, transparent 0.4em);
	}
	:global(.body .tag.keep) {
		--tag: var(--tn-keep);
	}
	:global(.body .tag.combine) {
		--tag: var(--tn-combine);
	}
	/* A small matrix in the text: <span class="mat" style="--cols:2"><span>a</span>…</span> */
	:global(.body .mat) {
		display: inline-grid;
		grid-template-columns: repeat(var(--cols, 2), auto);
		column-gap: 0.6em;
		vertical-align: middle;
		margin: 0.15em 0.2em;
		padding: 0.05em 0.35em;
		border-inline: 1.5px solid currentColor;
		border-radius: 0.35em;
		font-size: 0.9em;
		line-height: 1.25;
		text-align: center;
	}
</style>
