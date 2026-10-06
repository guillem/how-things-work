<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TopicCard from '#lib/components/TopicCard.svelte';
	import { site } from '#lib/site.ts';
	import { planned, published } from '#lib/topics.ts';
</script>

<svelte:head>
	<title>{site.name}</title>
	<meta name="description" content={site.description} />
</svelte:head>

<SiteHeader />

<main class="page">
	<section class="hero">
		<h1>How things work</h1>
		<p class="lede">{site.tagline}</p>
		<p class="sub">
			Each explainer is a short, animated walk-through you can step through at your own pace — from
			the big picture down to the mechanism. Everything runs in your browser.
		</p>
	</section>

	<section class="topics" aria-labelledby="explainers">
		<h2 id="explainers" class="sr-only">Explainers</h2>
		<div class="grid">
			{#each published as topic (topic.slug)}
				<TopicCard {topic} />
			{/each}
		</div>
	</section>

	{#if planned.length}
		<section class="topics planned" aria-labelledby="coming-soon">
			<h2 id="coming-soon">Coming soon</h2>
			<div class="grid">
				{#each planned as topic (topic.slug)}
					<TopicCard {topic} />
				{/each}
			</div>
		</section>
	{/if}
</main>

<SiteFooter />

<style>
	.page {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: 0 clamp(16px, 3vw, 32px);
	}
	.hero {
		padding: clamp(40px, 8vw, 88px) 0 clamp(32px, 5vw, 56px);
		max-width: 720px;
	}
	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		letter-spacing: -0.03em;
		margin-bottom: 14px;
	}
	.lede {
		font-size: clamp(1.1rem, 2vw, 1.35rem);
		font-weight: 500;
		color: var(--text);
		margin-bottom: 12px;
		text-wrap: pretty;
	}
	.sub {
		font-size: 1.02rem;
		color: var(--text-muted);
		max-width: 60ch;
		text-wrap: pretty;
	}
	.topics + .topics {
		margin-top: 56px;
	}
	.topics h2 {
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 16px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}
	.planned .grid {
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	}
</style>
