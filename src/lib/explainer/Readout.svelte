<script lang="ts">
	/**
	 * A readout or caption a scene shows (see `readouts.svelte.ts`).
	 *
	 * On wide screens it renders its children unchanged, so the drawing is
	 * exactly what it was. On narrow screens (viewport ≤ 640 px) the children
	 * disappear from the SVG and the readout is listed in the HTML panel under
	 * the stage, in real 12–15 px text. The scene
	 * can leave something shorter in its place (`narrow`), or a numbered badge
	 * (`marker`) that the panel's key chip refers to.
	 *
	 *   <Readout id="lumen" order={2} label="Thylakoid lumen" value="pH ≈ {lumenPH}" note={lumenNote}>
	 *     <Label x={24} y={562} text="thylakoid lumen · pH ≈ {lumenPH}" … />
	 *   </Readout>
	 *
	 *   <Readout id="psii" order={10} label="Photosystem II" marker={1} at={[150, 230]} opacity={o.psii}>
	 *     <Label x={124} y={196} text="Photosystem II" … />
	 *   </Readout>
	 *
	 * Without `label` the readout is only hidden on narrow screens (a minor label
	 * that would be unreadable there).
	 */
	import { onDestroy, type Snippet } from 'svelte';
	import { useReadouts } from './readouts.svelte';

	interface Props {
		/** Unique within the explainer while the scene is shown. */
		id: string;
		order?: number;
		label?: string;
		value?: string;
		note?: string;
		color?: string;
		/** Badge number drawn in the SVG at `at` on narrow screens. */
		marker?: number;
		at?: readonly [number, number];
		opacity?: number;
		/** The SVG content on wide screens (today's drawing). */
		children?: Snippet;
		/** Optional shorter SVG content for narrow screens. */
		narrow?: Snippet;
	}
	let {
		id,
		order = 0,
		label,
		value,
		note,
		color,
		marker,
		at,
		opacity = 1,
		children,
		narrow
	}: Props = $props();

	const registry = useReadouts();
	const out = $derived(registry?.out ?? false);

	// Re-registers whenever a shown value changes (a readout may change every
	// frame); removal happens only on destroy or when the screen widens, so rows
	// keep their place instead of flickering.
	// Removal only of this instance's own entry: during a scene cross-fade the
	// outgoing scene is destroyed after the incoming one registered the same id.
	const owner = {};
	const release = () => {
		if (registry?.entries.get(id)?.owner === owner) registry.entries.delete(id);
	};
	$effect(() => {
		if (!out || !registry || label === undefined) return release();
		registry.entries.set(id, { id, order, label, value, note, color, marker, opacity, owner });
	});
	onDestroy(release);

	/** Badge radius in scene units: ~9 px on a 390 px screen. */
	const R = 22;
</script>

{#if !out}
	{@render children?.()}
{:else}
	{@render narrow?.()}
	{#if marker !== undefined && at}
		<!-- dimmed, if at all, by the scene's own groups around it -->
		<g style:pointer-events="none">
			<circle
				cx={at[0]}
				cy={at[1]}
				r={R}
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="3"
			/>
			<text
				x={at[0]}
				y={at[1] + 10}
				text-anchor="middle"
				font-size="28"
				style:font-weight="700"
				style:fill="var(--stage-bg)">{marker}</text
			>
		</g>
	{/if}
{/if}
