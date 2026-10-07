<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TopicCard from '#lib/components/TopicCard.svelte';
	import { site } from '#lib/site.ts';
	import { catalog } from '#lib/catalog.ts';
	import { sections, topics } from '#lib/topics.ts';
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

	{#each sections as { category, topics: built } (category.id)}
		<section class="topics" aria-labelledby="category-{category.id}">
			<h2 id="category-{category.id}">{category.name}</h2>
			<div class="grid">
				{#each built as topic (topic.slug)}
					<TopicCard {topic} />
				{/each}
			</div>
		</section>
	{/each}

	<p class="progress">
		{topics.length} of the {catalog.entries.length} planned topics are written so far. More are on the
		way.
	</p>
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
		margin-top: 48px;
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
	.progress {
		margin-top: 48px;
		color: var(--text-faint);
		font-size: 0.92rem;
	}
</style>
