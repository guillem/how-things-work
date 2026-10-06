<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { Explainer, type StageProps } from '#lib/explainer/index.ts';
	import { site } from '#lib/site.ts';
	import { spec } from './steps';
	import Stage from './PhotosynthesisStage.svelte';

	const accent = '#2f9e5d';
</script>

<svelte:head>
	<title>{spec.title} — {site.name}</title>
	<meta name="description" content={spec.summary} />
</svelte:head>

<SiteHeader back />

<main class="page">
	<header class="title">
		<p class="eyebrow">Biology</p>
		<h1>{spec.title}</h1>
		<p class="summary">{spec.summary}</p>
	</header>

	<Explainer {spec} {accent}>
		{#snippet stage(props: StageProps)}
			<Stage {...props} />
		{/snippet}
	</Explainer>
</main>

<SiteFooter />

<style>
	.page {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: 0 clamp(16px, 3vw, 32px);
	}
	.title {
		padding: clamp(24px, 4vw, 44px) 0 clamp(20px, 3vw, 32px);
		max-width: 760px;
	}
	.eyebrow {
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #2f9e5d;
		margin-bottom: 6px;
	}
	.title h1 {
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		letter-spacing: -0.025em;
		margin-bottom: 10px;
	}
	.summary {
		color: var(--text-muted);
		font-size: 1.05rem;
		text-wrap: pretty;
	}
</style>
