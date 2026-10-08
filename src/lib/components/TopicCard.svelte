<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Topic } from '#lib/topics.ts';
	import { levelNames } from '#lib/catalog.ts';
	import { progress } from '#lib/progress.svelte.ts';
	import TopicArt from './TopicArt.svelte';

	interface Props {
		topic: Topic;
	}
	let { topic }: Props = $props();
	const status = $derived(progress.status(topic.slug));
	// A started explainer opens on the step the reader left it at.
	const hash = $derived(status === 'started' ? `#${progress.topics[topic.slug].step}` : '');
	const href = $derived(resolve(...([`${topic.slug}/`] as Parameters<typeof resolve>)) + hash);
</script>

<a class="card" {href} style:--card-accent={topic.accent} data-status={status}>
	<div class="art"><TopicArt slug={topic.slug} accent={topic.accent} /></div>
	<div class="text">
		<p class="meta">
			<span class="level" title={levelNames[topic.entry.level]}>Level {topic.entry.level}</span>
			<span class="length">{topic.steps} steps · {topic.minutes} min</span>
		</p>
		<h3>{topic.title}</h3>
		<p class="summary">{topic.summary}</p>
		<p class="cta">
			{#if status === 'done'}
				<span class="tag done">Done <span aria-hidden="true">✓</span></span>
				<span class="again">Read again <span aria-hidden="true">→</span></span>
			{:else if status === 'started'}
				<span class="tag started">Continue <span aria-hidden="true">→</span></span>
			{:else}
				<span class="tag new">Start <span aria-hidden="true">→</span></span>
			{/if}
		</p>
	</div>
</a>

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
	.card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-md);
		border-color: color-mix(in oklab, var(--card-accent) 45%, var(--border));
		text-decoration: none;
	}
	.card:focus-visible {
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
	.length {
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
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: auto;
		padding-top: 8px;
		font-weight: 500;
		font-size: 0.92rem;
	}
	.tag {
		padding: 3px 12px;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.85rem;
	}
	.tag.done {
		background: var(--status-done);
		color: var(--status-done-ink);
	}
	.tag.started {
		background: var(--status-started);
		color: var(--status-started-ink);
	}
	.tag.new {
		background: var(--status-new);
		color: var(--status-new-ink);
	}
	.again {
		color: var(--text-muted);
	}
</style>
