<script lang="ts">
	import type { Control, Params } from './types';

	interface Props {
		controls: Control[];
		params: Params;
	}
	let { controls, params }: Props = $props();

	function formatRange(control: Extract<Control, { type: 'range' }>, value: number) {
		if (control.format) return control.format(value);
		const decimals = control.step && control.step < 1 ? Math.ceil(-Math.log10(control.step)) : 0;
		return `${value.toFixed(decimals)}${control.unit ?? ''}`;
	}
</script>

<div class="controls">
	{#each controls as control (control.id)}
		{#if control.type === 'range'}
			{@const value = Number(params[control.id] ?? control.default)}
			<label class="control range">
				<span class="label">
					<span>{control.label}</span>
					<output>{formatRange(control, value)}</output>
				</span>
				<input
					type="range"
					data-control={control.id}
					min={control.min}
					max={control.max}
					step={control.step ?? 1}
					{value}
					oninput={(e) => (params[control.id] = Number(e.currentTarget.value))}
				/>
				{#if control.help}<span class="help">{control.help}</span>{/if}
			</label>
		{:else if control.type === 'toggle'}
			<label class="control toggle">
				<span class="label"><span>{control.label}</span></span>
				<span class="switch">
					<input
						type="checkbox"
						role="switch"
						data-control={control.id}
						checked={Boolean(params[control.id] ?? control.default)}
						onchange={(e) => (params[control.id] = e.currentTarget.checked)}
					/>
					<span class="track" aria-hidden="true"><span class="thumb"></span></span>
				</span>
				{#if control.help}<span class="help">{control.help}</span>{/if}
			</label>
		{:else if control.type === 'select'}
			<div class="control select">
				<span class="label" id="label-{control.id}"><span>{control.label}</span></span>
				<div class="segmented" role="radiogroup" aria-labelledby="label-{control.id}">
					{#each control.options as option (option.value)}
						{@const active = String(params[control.id] ?? control.default) === option.value}
						<button
							type="button"
							role="radio"
							data-control={control.id}
							data-value={option.value}
							aria-checked={active}
							class:active
							onclick={() => (params[control.id] = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
				{#if control.help}<span class="help">{control.help}</span>{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.controls {
		display: grid;
		gap: 14px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}
	.control {
		display: grid;
		gap: 6px;
	}
	.label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		font-size: 0.86rem;
		font-weight: 500;
		color: var(--text);
	}
	output {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		font-weight: 400;
	}
	.help {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	/* Range slider */
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 22px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}
	input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
		background: var(--border-strong);
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		margin-top: -7px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--explainer-accent, var(--accent));
		box-shadow: var(--shadow-sm);
		transition: transform 0.15s var(--ease-out);
	}
	input[type='range']:hover::-webkit-slider-thumb,
	input[type='range']:focus-visible::-webkit-slider-thumb {
		transform: scale(1.12);
	}
	input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: var(--border-strong);
	}
	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--explainer-accent, var(--accent));
	}
	input[type='range']:focus-visible {
		outline: none;
	}
	input[type='range']:focus-visible::-webkit-slider-thumb {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	/* Toggle switch */
	.toggle {
		grid-template-columns: 1fr auto;
		align-items: center;
	}
	.toggle .help {
		grid-column: 1 / -1;
	}
	.switch {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 24px;
	}
	.switch input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.track {
		position: absolute;
		inset: 0;
		border-radius: 12px;
		background: var(--border-strong);
		transition: background-color 0.2s;
	}
	.thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		transition: transform 0.2s var(--ease-out);
	}
	.switch input:checked + .track {
		background: var(--explainer-accent, var(--accent));
	}
	.switch input:checked + .track .thumb {
		transform: translateX(16px);
	}
	.switch input:focus-visible + .track {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	/* Segmented control */
	.segmented {
		display: flex;
		padding: 3px;
		gap: 2px;
		border-radius: 8px;
		background: var(--surface-3);
	}
	.segmented button {
		flex: 1;
		padding: 5px 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.84rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}
	.segmented button:hover {
		color: var(--text);
	}
	.segmented button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
