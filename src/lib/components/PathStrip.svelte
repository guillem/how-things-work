<script lang="ts">
	import { resolve } from '$app/paths';
	import { entry } from '#lib/catalog.ts';
	import { pathsFor, place, neighbours, stops } from '#lib/paths.ts';
	import { topicBySlug } from '#lib/topics.ts';

	let { slug }: { slug: string } = $props();
</script>

{#each pathsFor(slug) as path (path.id)}
	{@const position = place(path, slug)!}
	{@const adjacent = neighbours(path, slug)}
	<nav class="links" aria-label="Path">
		<a href={`${resolve('/')}?path=${encodeURIComponent(path.id)}`}>{path.title}</a>
		<span>{position.chapter.title}</span>
		<span>Stop {position.index} of {stops(path).length}</span>
		{#each [{ label: 'Previous', slug: adjacent.previous }, { label: 'Next', slug: adjacent.next }] as neighbour (neighbour.label)}
			{#if neighbour.slug}
				{@const built = topicBySlug.get(neighbour.slug)}
				{#if built}
					<a
						href={resolve(...([`/${neighbour.slug}/`] as Parameters<typeof resolve>))}
						aria-label={`${neighbour.label}: ${built.title}`}>{neighbour.label}: {built.title}</a
					>
				{:else}
					<span>{neighbour.label}: {entry(neighbour.slug).title} — coming later</span>
				{/if}
			{/if}
		{/each}
	</nav>
{/each}

<style>
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		margin-bottom: 24px;
		color: var(--text-muted);
	}
	a {
		color: var(--topic-accent);
	}
</style>
