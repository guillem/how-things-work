<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TopicCard from '#lib/components/TopicCard.svelte';
	import { site } from '#lib/site.ts';
	import { catalog } from '#lib/catalog.ts';
	import { sections, topics } from '#lib/topics.ts';
	import { progress } from '#lib/progress.svelte.ts';
	import { onMount } from 'svelte';

	onMount(() => progress.load());

	const counts = $derived.by(() => {
		const c = { done: 0, started: 0, new: 0 };
		for (const t of topics) c[progress.status(t.slug)]++;
		return c;
	});

	function clearProgress() {
		if (confirm('Clear your progress on every explainer? This cannot be undone.')) progress.clear();
	}
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

	<section class="tally" aria-label="Your progress">
		<p class="counts" aria-live="polite">
			<span class="count done">Done: <b>{counts.done}</b></span>
			<span class="count started">Started: <b>{counts.started}</b></span>
			<span class="count new">New: <b>{counts.new}</b></span>
			<span class="count total">Total: <b>{topics.length}</b></span>
		</p>
		<button
			type="button"
			class="clear"
			onclick={clearProgress}
			disabled={counts.done + counts.started === 0}
		>
			Clear all progress
		</button>
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
	.tally {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
		margin-bottom: 40px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: 0.95rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.count b {
		color: var(--text);
		font-weight: 600;
	}
	.count::before {
		content: '';
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 7px;
		border-radius: 50%;
		background: var(--text-faint);
		vertical-align: 0.05em;
	}
	.count.done::before {
		background: var(--status-done);
	}
	.count.started::before {
		background: var(--status-started);
	}
	.count.new::before {
		background: var(--status-new);
	}
	.count.total::before {
		display: none;
	}
	.clear {
		margin-left: auto;
		padding: 6px 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
	}
	.clear:hover:not(:disabled) {
		border-color: var(--status-done);
		color: var(--status-done);
	}
	.clear:disabled {
		opacity: 0.5;
		cursor: default;
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
