<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './DarkMatterStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <span class="dm-key dm-halo">dark halo</span> */
	:global(.body .dm-key) {
		padding-left: 1.05em;
		background: linear-gradient(var(--tag), var(--tag)) no-repeat 0.1em 55% / 0.62em 0.62em;
	}
	:global(.body .dm-key.dm-gas) {
		--tag: var(--dm-gas);
	}
	:global(.body .dm-key.dm-stars) {
		--tag: var(--dm-stars);
	}
	:global(.body .dm-key.dm-visible) {
		--tag: var(--dm-visible);
	}
	:global(.body .dm-key.dm-halo) {
		--tag: var(--dm-halo);
	}
	:global(.body .dm-key.dm-model) {
		--tag: var(--dm-model);
	}
	:global(.body .dm-key.dm-xgas) {
		--tag: var(--dm-xgas);
	}
	:global(.body .dm-key.dm-galaxies) {
		--tag: var(--dm-galaxies);
	}
</style>
