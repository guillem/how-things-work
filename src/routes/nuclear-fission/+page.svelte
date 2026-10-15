<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './FissionStage.svelte';
</script>

<ExplainerPage {spec}>
	{#snippet stage(props: StageProps)}
		<Stage {...props} />
	{/snippet}
</ExplainerPage>

<style>
	/* Colour keys used in the narrative: <strong class="tag nf-fission">…</strong> */
	:global(.body .tag.nf-fission),
	:global(.body .tag.nf-captured),
	:global(.body .tag.nf-escaped) {
		padding-left: 1.05em;
		background: radial-gradient(circle, var(--tag) 60%, transparent 62%) no-repeat 0.05em 55% /
			0.7em 0.7em;
	}
	:global(.body .tag.nf-fission) {
		--tag: var(--fi-flash);
	}
	:global(.body .tag.nf-captured) {
		--tag: var(--fi-captured);
	}
	:global(.body .tag.nf-escaped) {
		--tag: var(--fi-escaped);
	}
</style>
