<script lang="ts">
	/** The readouts of the current scene as HTML, under the stage on narrow screens. */
	import type { ReadoutEntry, Readouts } from './readouts.svelte';

	let { readouts }: { readouts: Readouts } = $props();

	/** Short readouts share the width two by two; longer ones take a full line of their own. */
	const wide = (r: ReadoutEntry) => (r.value?.length ?? 0) + (r.note?.length ?? 0) > 24;
</script>

<div class="readouts" role="group" aria-label="Readouts">
	{#if readouts.keys.length}
		<ul class="keys">
			{#each readouts.keys as k (k.id)}
				<li style:opacity={Math.max(0.5, k.opacity)}>
					{#if k.marker !== undefined}<span class="badge">{k.marker}</span>{/if}
					{#if k.color}<span class="dot" style:background={k.color}></span>{/if}
					{k.label}
				</li>
			{/each}
		</ul>
	{/if}
	{#if readouts.rows.length}
		<dl class="rows">
			{#each readouts.rows as r (r.id)}
				<div class="row" style:opacity={r.opacity} class:wide={wide(r)}>
					<dt>
						{#if r.color}<span class="dot" style:background={r.color}></span>{/if}
						{r.label}
					</dt>
					<dd>
						<span class="value" style:color={r.color}>{r.value}</span>
						{#if r.note}<span class="note">{r.note}</span>{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{/if}
</div>

<style>
	/* Compact: the panel adds to the pinned stage card, which shares the screen with the text. */
	.readouts {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		border-top: 1px solid var(--border);
		background: var(--surface);
		font-variant-numeric: tabular-nums;
		line-height: 1.25;
	}
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.keys li {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.badge {
		display: inline-grid;
		place-items: center;
		width: 1.35em;
		height: 1.35em;
		border-radius: 50%;
		background: var(--text);
		color: var(--surface);
		font-size: 0.75rem;
		font-weight: 700;
	}
	/* Two columns on a phone; a row's value and note share a line when they fit. */
	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 6px 12px;
		margin: 0;
	}
	.row {
		min-width: 0;
	}
	/* Label, value and note run on as one line, wrapping only when they must. */
	.row.wide {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 6px;
	}
	.row.wide dd {
		display: contents;
	}
	dt {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.dot {
		flex: 0 0 auto;
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
	}
	dd {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 6px;
	}
	.value {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
	}
	.note {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>
