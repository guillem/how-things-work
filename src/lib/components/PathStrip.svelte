<script lang="ts">
	/**
	 * Where this explainer sits on each reading path it belongs to: the path (back to its
	 * reading list), the chapter and stop, a row of dots for the stops, and the neighbours.
	 */
	import { resolve } from '$app/paths';
	import { entry } from '#lib/catalog.ts';
	import { pathsFor, place, neighbours, stops } from '#lib/paths.ts';
	import { topicBySlug } from '#lib/topics.ts';

	let { slug }: { slug: string } = $props();
</script>

{#each pathsFor(slug) as path (path.id)}
	{@const position = place(path, slug)!}
	{@const adjacent = neighbours(path, slug)}
	{@const all = stops(path)}
	<nav class="strip" aria-label="Path">
		<p class="where">
			<span class="kicker">Path</span>
			<a class="path" href={`${resolve('/')}?path=${encodeURIComponent(path.id)}`}>{path.title}</a>
			<!-- Each separator travels with the part after it, so a wrapped line never ends on one. -->
			<span><span class="sep" aria-hidden="true">·</span> {position.chapter.title}</span>
			<span class="stop"
				><span class="sep" aria-hidden="true">·</span> Stop {position.index} of {all.length}</span
			>
		</p>
		<ol class="dots" aria-hidden="true">
			{#each path.chapters as chapter (chapter.title)}
				<li>
					{#each chapter.slugs as stop (stop)}
						<span
							class="dot"
							class:past={all.indexOf(stop) < position.index - 1}
							class:here={stop === slug}
						></span>
					{/each}
				</li>
			{/each}
		</ol>
		{#if adjacent.previous || adjacent.next}
			<div class="neighbours">
				{#each [{ label: 'Previous', slug: adjacent.previous }, { label: 'Next', slug: adjacent.next }] as neighbour (neighbour.label)}
					{#if neighbour.slug}
						{@const built = topicBySlug.get(neighbour.slug)}
						{#if built}
							<a
								class="neighbour {neighbour.label.toLowerCase()}"
								href={resolve(...([`/${neighbour.slug}/`] as Parameters<typeof resolve>))}
								aria-label={`${neighbour.label}: ${built.title}`}
							>
								<span class="label">
									{#if neighbour.label === 'Previous'}<span aria-hidden="true">←</span>{/if}
									{neighbour.label}
									{#if neighbour.label === 'Next'}<span aria-hidden="true">→</span>{/if}
								</span>
								<span class="title">{built.title}</span>
							</a>
						{:else}
							<span class="neighbour {neighbour.label.toLowerCase()} later">
								<span class="label">{neighbour.label} · coming later</span>
								<span class="title">{entry(neighbour.slug).title}</span>
							</span>
						{/if}
					{/if}
				{/each}
			</div>
		{/if}
	</nav>
{/each}

<style>
	.strip {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 760px;
		margin-bottom: clamp(20px, 3vw, 32px);
		padding: 12px 16px 14px;
		border: 1px solid var(--border);
		border-left: 3px solid var(--topic-accent);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 0.92rem;
		color: var(--text-muted);
	}
	.where {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 6px;
	}
	.kicker {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.path {
		font-weight: 600;
		color: var(--topic-accent);
	}
	.sep {
		color: var(--text-faint);
	}
	.stop {
		font-variant-numeric: tabular-nums;
	}
	/* One dot per stop, chapters set apart by a wider gap. */
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.dots li {
		display: flex;
		gap: 4px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--border-strong);
	}
	.dot.past {
		background: color-mix(in oklab, var(--topic-accent) 45%, var(--surface));
	}
	.dot.here {
		background: var(--topic-accent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--topic-accent) 25%, transparent);
	}
	.neighbours {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
	}
	.neighbour {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1 1 220px;
		min-width: 0;
		max-width: max-content;
		color: var(--text);
		text-decoration: none;
	}
	/* Next keeps to the right, also when it is the only neighbour. */
	.next {
		align-items: flex-end;
		margin-left: auto;
		text-align: right;
	}
	.label {
		display: inline-flex;
		gap: 5px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.title {
		font-weight: 500;
		color: var(--topic-accent);
		text-wrap: pretty;
	}
	a.neighbour:hover .title {
		text-decoration: underline;
	}
	.later .title {
		color: var(--text-muted);
	}
	@media (max-width: 560px) {
		.neighbour {
			flex-basis: 100%;
			max-width: none;
		}
	}
</style>
