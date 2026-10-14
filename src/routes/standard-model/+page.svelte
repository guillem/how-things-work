<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './StandardModelStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag sm-quark">Quarks</strong> */
	:global(.body .tag.sm-quark),
	:global(.body .tag.sm-lepton),
	:global(.body .tag.sm-boson),
	:global(.body .tag.sm-higgs) {
		padding-left: 1.05em;
		background: linear-gradient(var(--tag), var(--tag)) no-repeat 0.1em 55% / 0.62em 0.62em;
	}
	:global(.body .tag.sm-quark) {
		--tag: var(--sm-quark);
	}
	:global(.body .tag.sm-lepton) {
		--tag: var(--sm-lepton);
	}
	:global(.body .tag.sm-boson) {
		--tag: var(--sm-boson);
	}
	:global(.body .tag.sm-higgs) {
		--tag: var(--sm-higgs);
	}
</style>
