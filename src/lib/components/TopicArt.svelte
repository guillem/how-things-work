<script lang="ts">
	/**
	 * Small decorative illustration for a topic card. Each topic gets a
	 * hand-drawn vignette; a topic without one falls back to a generic glyph.
	 */
	interface Props {
		slug: string;
		accent: string;
	}
	let { slug, accent }: Props = $props();
</script>

<svg viewBox="0 0 200 120" class="art" style:--accent={accent} aria-hidden="true">
	<defs>
		<linearGradient id="art-fade-{slug}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color={accent} stop-opacity="0.18" />
			<stop offset="1" stop-color={accent} stop-opacity="0.02" />
		</linearGradient>
	</defs>
	<rect width="200" height="120" fill="url(#art-fade-{slug})" />

	{#if slug === 'photosynthesis'}
		<!-- sun -->
		<g class="sun">
			<circle cx="158" cy="30" r="12" fill="#f6c343" />
			{#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
				<line
					x1="158"
					y1="30"
					x2={158 + 19 * Math.cos((a * Math.PI) / 180)}
					y2={30 + 19 * Math.sin((a * Math.PI) / 180)}
					stroke="#f6c343"
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray="4 20"
					stroke-dashoffset="-15"
				/>
			{/each}
		</g>
		<!-- rays -->
		<g stroke="#f6c343" stroke-width="1.5" stroke-linecap="round" opacity="0.8">
			<line x1="142" y1="44" x2="118" y2="70" />
			<line x1="150" y1="50" x2="130" y2="74" />
		</g>
		<!-- leaf -->
		<g transform="translate(40 52)">
			<path d="M0 46 C 10 10, 70 -4, 120 2 C 112 46, 60 70, 0 46 Z" fill={accent} opacity="0.92" />
			<path
				d="M2 45 C 36 36, 72 22, 112 6"
				fill="none"
				stroke="#fff"
				stroke-opacity="0.6"
				stroke-width="1.6"
			/>
			<g stroke="#fff" stroke-opacity="0.4" stroke-width="1.2" fill="none">
				<path d="M30 37 c 6 -10, 10 -16, 14 -24" />
				<path d="M54 29 c 4 -10, 6 -16, 8 -22" />
				<path d="M78 20 c 1 -8, 1 -12, 0 -16" />
			</g>
		</g>
		<!-- molecules -->
		<g font-family="var(--font-sans)" font-size="9" font-weight="600">
			<g transform="translate(20 28)">
				<circle r="8" fill="#5b5b5b" />
				<circle cx="-11" cy="0" r="5.5" fill="#e5484d" />
				<circle cx="11" cy="0" r="5.5" fill="#e5484d" />
			</g>
			<g transform="translate(176 92)">
				<circle cx="-7" cy="0" r="6.5" fill="#e5484d" />
				<circle cx="7" cy="0" r="6.5" fill="#e5484d" />
			</g>
		</g>
	{:else}
		<circle cx="100" cy="60" r="30" fill="none" stroke={accent} stroke-width="2" />
		<circle cx="100" cy="60" r="5" fill={accent} />
	{/if}
</svg>

<style>
	.art {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
