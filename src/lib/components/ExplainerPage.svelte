<script lang="ts">
	/**
	 * The page around an explainer: site header, title block (category and
	 * level from the catalogue), the explainer itself and the links to
	 * prerequisites, related topics and the topics that build on this one.
	 */
	import type { Snippet } from 'svelte';
	import SiteHeader from './SiteHeader.svelte';
	import SiteFooter from './SiteFooter.svelte';
	import TopicLinks from './TopicLinks.svelte';
	import { Explainer, type ExplainerSpec, type StageProps } from '#lib/explainer/index.ts';
	import { levelNames } from '#lib/catalog.ts';
	import { site } from '#lib/site.ts';
	import { topicBySlug } from '#lib/topics.ts';

	interface Props {
		spec: ExplainerSpec;
		stage: Snippet<[StageProps]>;
	}
	let { spec, stage }: Props = $props();

	const topic = $derived.by(() => {
		const t = topicBySlug.get(spec.slug);
		if (!t) throw new Error(`"${spec.slug}" is not registered in src/lib/topics.ts`);
		return t;
	});
</script>

<svelte:head>
	<title>{spec.title} — {site.name}</title>
	<meta name="description" content={spec.summary} />
</svelte:head>

<SiteHeader back />

<main class="page" style:--topic-accent={topic.accent}>
	<header class="title">
		<p class="eyebrow">
			<span>{topic.category.name}</span>
			<span class="level" title={levelNames[topic.entry.level]}>Level {topic.entry.level}</span>
		</p>
		<h1>{spec.title}</h1>
		<p class="summary">{spec.summary}</p>
	</header>

	<Explainer {spec} accent={topic.accent} {stage} />

	<TopicLinks slug={spec.slug} />
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
		display: flex;
		gap: 12px;
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--topic-accent);
		margin-bottom: 6px;
	}
	.level {
		color: var(--text-faint);
		letter-spacing: 0.02em;
		text-transform: none;
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
