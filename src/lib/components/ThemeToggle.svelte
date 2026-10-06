<script lang="ts">
	import { theme } from '#lib/theme.svelte.ts';
</script>

<!--
	Both icons are always rendered; CSS picks the visible one from the
	`data-theme` attribute so the server-rendered HTML matches the client.
-->
<button
	type="button"
	class="theme-toggle"
	onclick={() => theme.toggle()}
	aria-label="Toggle dark mode"
	title="Toggle light / dark theme"
>
	<svg class="icon sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
		<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8" />
		<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
			<line x1="12" y1="2.5" x2="12" y2="5" />
			<line x1="12" y1="19" x2="12" y2="21.5" />
			<line x1="2.5" y1="12" x2="5" y2="12" />
			<line x1="19" y1="12" x2="21.5" y2="12" />
			<line x1="5.3" y1="5.3" x2="7" y2="7" />
			<line x1="17" y1="17" x2="18.7" y2="18.7" />
			<line x1="5.3" y1="18.7" x2="7" y2="17" />
			<line x1="17" y1="7" x2="18.7" y2="5.3" />
		</g>
	</svg>
	<svg class="icon moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
		<path
			d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linejoin="round"
		/>
	</svg>
</button>

<style>
	.theme-toggle {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background-color 0.15s;
	}
	.theme-toggle:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.icon {
		grid-area: 1 / 1;
		transition:
			opacity 0.2s var(--ease-out),
			transform 0.3s var(--ease-out);
	}
	.sun {
		opacity: 0;
		transform: rotate(-40deg) scale(0.7);
	}
	.moon {
		opacity: 1;
		transform: none;
	}
	:global(:root[data-theme='dark']) .sun {
		opacity: 1;
		transform: none;
	}
	:global(:root[data-theme='dark']) .moon {
		opacity: 0;
		transform: rotate(40deg) scale(0.7);
	}
</style>
