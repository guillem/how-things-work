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

	// Unit circle: one period of a sine wave, 0°…360° over x 96…186; its 45° point
	// (x 107.3) is level with the circle's point.
	const sineArt = Array.from({ length: 61 }, (_, i) => {
		const x = 96 + (i / 60) * 90;
		const y = 62 - 30 * Math.sin((i / 60) * 2 * Math.PI);
		return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(' ');

	// Sorting: ten bars, the last four already in place, two being compared.
	const sortArt = [5, 2, 6, 1, 4, 3, 7, 8, 9, 10].map((v, i) => ({
		i,
		h: 10 + v * 7.5,
		c: i >= 6 ? 'var(--sort-done)' : i === 2 || i === 3 ? 'var(--sort-compare)' : accent
	}));

	// Epidemics: a jittered grid of people; infection spreads from the left,
	// recovered behind the front, susceptible ahead of it.
	const crowd = Array.from({ length: 48 }, (_, k) => {
		const col = k % 8;
		const row = Math.floor(k / 8);
		const jitter = (n: number) => Math.sin(k * 12.9898 + n * 78.233) * 3;
		const x = 14 + col * 11 + jitter(1);
		const front = 40 + Math.sin(row * 1.7) * 8;
		const s = x < front - 14 ? 'r' : x < front + 6 ? 'i' : 's';
		return { k, x, y: 22 + row * 15 + jitter(2), s };
	});
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
	{:else if slug === 'epidemics'}
		<!-- a crowd with an outbreak spreading from the left, and its curve -->
		{#each crowd as p (p.k)}
			<circle cx={p.x} cy={p.y} r="3.4" fill="var(--sir-{p.s})" />
		{/each}
		<path
			d="M108 104 C 128 104, 134 40, 148 40 S 168 102, 192 104"
			fill="none"
			stroke="var(--sir-i)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path
			d="M108 30 C 132 30, 140 92, 156 98 S 180 100, 192 100"
			fill="none"
			stroke="var(--sir-s)"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity="0.8"
		/>
	{:else if slug === 'unit-circle'}
		<!-- a unit circle with its point, linked to the sine wave it traces -->
		<g transform="translate(48 62)">
			<line x1="-36" x2="36" y1="0" y2="0" stroke="currentColor" opacity="0.25" />
			<line x1="0" x2="0" y1="-36" y2="36" stroke="currentColor" opacity="0.25" />
			<circle r="30" fill="none" stroke={accent} stroke-width="2" />
			<line x1="0" y1="0" x2="21.2" y2="-21.2" stroke={accent} stroke-width="2" />
			<line x1="0" y1="0" x2="21.2" y2="0" stroke="var(--trig-cos)" stroke-width="3" />
			<line x1="21.2" y1="0" x2="21.2" y2="-21.2" stroke="var(--trig-sin)" stroke-width="3" />
			<circle cx="21.2" cy="-21.2" r="4" fill={accent} />
		</g>
		<line
			x1="69"
			y1="40.8"
			x2="107.3"
			y2="40.8"
			stroke={accent}
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
		<path
			d={sineArt}
			fill="none"
			stroke="var(--trig-sin)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<circle cx="107.3" cy="40.8" r="3.5" fill="var(--trig-sin)" />
	{:else if slug === 'sorting'}
		<!-- bars half sorted: sorted (green) on the right, two being compared -->
		{#each sortArt as b (b.i)}
			<rect
				x={30 + b.i * 15}
				y={104 - b.h}
				width="11"
				height={b.h}
				rx="2.5"
				fill={b.c}
				opacity={b.c === accent ? 0.35 : 1}
			/>
		{/each}
		<line x1="24" x2="176" y1="104.5" y2="104.5" stroke="currentColor" opacity="0.25" />
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
