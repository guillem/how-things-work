<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Path } from '$app/types';
	import type { Topic } from '#lib/topics.ts';
	import TopicArt from './TopicArt.svelte';

	interface Props {
		topic: Topic;
	}
	let { topic }: Props = $props();
	const planned = $derived(topic.status === 'planned');
	const href = $derived(resolve(`${topic.slug}/` as Path));
</script>

{#if planned}
	<article
		class="card planned"
		style:--card-accent={topic.accent}
		aria-label="{topic.title} (coming soon)"
	>
		<div class="art"><TopicArt slug={topic.slug} accent={topic.accent} /></div>
		<div class="text">
			<p class="meta">
				<span class="category">{topic.category}</span><span class="soon">Coming soon</span>
			</p>
			<h3>{topic.title}</h3>
			<p class="summary">{topic.summary}</p>
		</div>
	</article>
{:else}
	<a class="card" {href} style:--card-accent={topic.accent}>
		<div class="art"><TopicArt slug={topic.slug} accent={topic.accent} /></div>
		<div class="text">
			<p class="meta">
				<span class="category">{topic.category}</span>
				<span class="length">{topic.steps} steps · {topic.minutes} min</span>
			</p>
			<h3>{topic.title}</h3>
			<p class="summary">{topic.summary}</p>
			<p class="cta">Start <span aria-hidden="true">→</span></p>
		</div>
	</a>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		color: var(--text);
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 0.25s var(--ease-out),
			box-shadow 0.25s var(--ease-out),
			border-color 0.25s;
	}
	a.card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-md);
		border-color: color-mix(in oklab, var(--card-accent) 45%, var(--border));
		text-decoration: none;
	}
	a.card:focus-visible {
		outline-offset: 3px;
	}
	.art {
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 18px 20px 20px;
		flex: 1;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--card-accent);
	}
	.length,
	.soon {
		color: var(--text-faint);
		letter-spacing: 0.02em;
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}
	h3 {
		font-size: 1.2rem;
	}
	.summary {
		color: var(--text-muted);
		font-size: 0.95rem;
		line-height: 1.55;
	}
	.cta {
		margin-top: auto;
		padding-top: 8px;
		font-weight: 500;
		font-size: 0.92rem;
		color: var(--card-accent);
	}
	.planned {
		opacity: 0.75;
	}
	.planned .art {
		filter: saturate(0.4);
	}
</style>
