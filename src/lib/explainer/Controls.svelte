<script lang="ts">
	interface Props {
		index: number;
		total: number;
		playing: boolean;
		speed: number;
		autoAdvance: boolean;
		fullscreen: boolean;
		onprev: () => void;
		onnext: () => void;
		onrestart: () => void;
		ontoggle: () => void;
		onspeed: (speed: number) => void;
		onauto: () => void;
		onfullscreen: () => void;
		onhelp: () => void;
	}
	let {
		index,
		total,
		playing,
		speed,
		autoAdvance,
		fullscreen,
		onprev,
		onnext,
		onrestart,
		ontoggle,
		onspeed,
		onauto,
		onfullscreen,
		onhelp
	}: Props = $props();

	const speeds = [0.5, 1, 2];
</script>

<div class="controls" role="toolbar" aria-label="Playback">
	<div class="group">
		<button
			type="button"
			class="icon-btn"
			onclick={onrestart}
			title="Restart (R)"
			aria-label="Restart"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 12a8 8 0 1 0 2.5-5.8" />
				<path d="M4 4v5h5" />
			</svg>
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={onprev}
			disabled={index === 0}
			title="Previous step (←)"
			aria-label="Previous step"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M15 5l-7 7 7 7" />
			</svg>
		</button>
		<button
			type="button"
			class="icon-btn play"
			onclick={ontoggle}
			title={playing ? 'Pause (Space)' : 'Play (Space)'}
			aria-label={playing ? 'Pause animation' : 'Play animation'}
			aria-pressed={playing}
		>
			{#if playing}
				<svg viewBox="0 0 24 24" aria-hidden="true" class="fill">
					<rect x="6" y="5" width="4" height="14" rx="1" />
					<rect x="14" y="5" width="4" height="14" rx="1" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true" class="fill">
					<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
				</svg>
			{/if}
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={onnext}
			disabled={index === total - 1}
			title="Next step (→)"
			aria-label="Next step"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>

	<div class="counter" aria-live="polite">
		<span class="current">{index + 1}</span><span class="sep">/</span><span class="total"
			>{total}</span
		>
	</div>

	<div class="group right">
		<div class="speed" role="radiogroup" aria-label="Playback speed">
			{#each speeds as s (s)}
				<button
					type="button"
					role="radio"
					aria-checked={speed === s}
					class:active={speed === s}
					onclick={() => onspeed(s)}
				>
					{s}×
				</button>
			{/each}
		</div>
		<button
			type="button"
			class="icon-btn"
			class:on={autoAdvance}
			onclick={onauto}
			aria-pressed={autoAdvance}
			title="Auto-advance to the next step (A)"
			aria-label="Auto-advance steps"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 6l6 6-6 6" />
				<path d="M13 6l6 6-6 6" />
			</svg>
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={onhelp}
			title="Keyboard shortcuts (?)"
			aria-label="Keyboard shortcuts"
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="12" cy="12" r="9" />
				<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.2" />
				<circle cx="12" cy="17" r="0.6" class="dot" />
			</svg>
		</button>
		<button
			type="button"
			class="icon-btn"
			onclick={onfullscreen}
			title={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}
			aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
		>
			{#if fullscreen}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
				</svg>
			{/if}
		</button>
	</div>
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		border-top: 1px solid var(--border);
		background: var(--surface);
	}
	.group {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.right {
		margin-left: auto;
		gap: 6px;
	}
	.icon-btn {
		display: inline-grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}
	.icon-btn:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}
	.icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.icon-btn svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon-btn svg.fill {
		fill: currentColor;
		stroke: none;
	}
	.icon-btn svg .dot {
		fill: currentColor;
		stroke: none;
	}
	.play {
		width: 40px;
		height: 40px;
		background: var(--explainer-accent, var(--accent));
		color: #fff;
		border-radius: 999px;
		margin: 0 4px;
	}
	.play:hover:not(:disabled) {
		background: color-mix(in oklab, var(--explainer-accent, var(--accent)) 85%, black);
		color: #fff;
	}
	.icon-btn.on {
		color: var(--explainer-accent, var(--accent));
		background: color-mix(in oklab, var(--explainer-accent, var(--accent)) 12%, transparent);
	}
	.counter {
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
		color: var(--text-muted);
		min-width: 3.5em;
		text-align: center;
	}
	.counter .current {
		color: var(--text);
		font-weight: 600;
	}
	.counter .sep {
		margin: 0 3px;
		opacity: 0.6;
	}
	.speed {
		display: flex;
		padding: 2px;
		gap: 1px;
		border-radius: 7px;
		background: var(--surface-2);
	}
	.speed button {
		padding: 4px 8px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.speed button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
	@media (max-width: 480px) {
		.speed {
			display: none;
		}
	}
</style>
