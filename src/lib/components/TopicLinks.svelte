<script lang="ts">
	/**
	 * "Read first / Related / Leads on to" links for an explainer, derived from
	 * the catalogue. Topics that are not built yet are named but not linked.
	 */
	import { resolve } from '$app/paths';
	import { dependents, entry } from '#lib/catalog.ts';
	import { topicBySlug } from '#lib/topics.ts';

	interface Props {
		slug: string;
	}
	let { slug }: Props = $props();

	const meta = $derived(entry(slug));
	const groups = $derived(
		[
			{ title: 'Read first', slugs: meta.prerequisites },
			{ title: 'Related', slugs: meta.related },
			{ title: 'Leads on to', slugs: dependents(slug) }
		].filter((g) => g.slugs.length > 0)
	);
</script>

{#if groups.length}
	<nav class="links" aria-label="Related topics">
		{#each groups as group (group.title)}
			<section>
				<h2>{group.title}</h2>
				<ul>
					{#each group.slugs as s (s)}
						{@const built = topicBySlug.get(s)}
						<li>
							{#if built}
								<a
									href={resolve(...([`/${s}/`] as Parameters<typeof resolve>))}
									style:--link-accent={built.accent}
								>
									{built.title}
								</a>
							{:else}
								<span class="later">{entry(s).title}</span>
								<span class="soon">coming later</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</nav>
{/if}

<style>
	.links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 24px;
		margin-top: 40px;
		padding-top: 28px;
		border-top: 1px solid var(--border);
	}
	h2 {
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 6px;
	}
	a {
		font-weight: 500;
		color: var(--link-accent, var(--accent));
	}
	.later {
		color: var(--text-muted);
	}
	.soon {
		margin-left: 6px;
		font-size: 0.8rem;
		color: var(--text-faint);
	}
</style>
