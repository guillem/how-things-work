<script lang="ts">
	/**
	 * Three classic illusions of lightness and colour (`params.illusion`), each with a reveal
	 * (`params.reveal`) showing that the patches really are the same pixels.
	 *
	 *   contrast — two identical greys on a dark-to-light gradient; reveal joins them with a bar
	 *              of the same grey.
	 *   shadow   — a chessboard with a cylinder's shadow (after Adelson's checker-shadow
	 *              illusion): a dark square A in the light and a light square B in the shadow send
	 *              the same light (the shadow is a black overlay of opacity 0.418, so the light
	 *              squares' 189 becomes 110, the dark squares' value). Reveal hides the rest.
	 *   colour   — one colour on a blue and on a yellow surround; reveal turns the surrounds grey.
	 *
	 * These pictures are images with fixed pixel colours, the same in both themes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, params }: StageProps = $props();

	const which = $derived(String(params.illusion ?? 'contrast'));
	const revealT = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const r = params.reveal === true ? 1 : 0;
		untrack(() => revealT.set(r));
	});
	const rv = $derived(revealT.current);

	// ------------------------------------------------------------------ contrast
	const SAME_GREY = '#808080';
	const G = { x: 120, y: 90, w: 720, h: 330 };

	// ------------------------------------------------------------------ shadow
	const LIGHT = '#bdbdbd'; // 189
	const DARK = '#6e6e6e'; // 110 = 189 × (1 − 0.418)
	const SHADE = 0.418;
	const B0 = { x: 210, y: 92, n: 6, size: 54 };
	const tiles = Array.from({ length: B0.n * B0.n }, (_, i) => {
		const r = Math.floor(i / B0.n);
		const c = i % B0.n;
		return { key: i, r, c, x: B0.x + c * B0.size, y: B0.y + r * B0.size, light: (r + c) % 2 === 0 };
	});
	const A_TILE = tiles.find((q) => q.r === 2 && q.c === 1)!;
	const B_TILE = tiles.find((q) => q.r === 4 && q.c === 4)!;
	// The shadow's core covers B fully; it fades out over 60 units.
	const SH = { cx: B_TILE.x + B0.size / 2 + 6, cy: B_TILE.y + B0.size / 2, r: 92 };
	const CYL = { x: SH.cx + 120, y: SH.cy - 20 };
	const boardRight = B0.x + B0.n * B0.size;
	const boardBottom = B0.y + B0.n * B0.size;
	const maskPath = `M16 16 H944 V584 H16 Z M${A_TILE.x} ${A_TILE.y} v${B0.size} h${B0.size} v${-B0.size} Z M${B_TILE.x} ${B_TILE.y} v${B0.size} h${B0.size} v${-B0.size} Z`;

	// ------------------------------------------------------------------ colour
	const PATCH = '#a08a9c';
	const SURROUNDS = [
		{ id: 'blue', x: 150, fill: '#2f5fd0' },
		{ id: 'yellow', x: 510, fill: '#f0c419' }
	];
	const NEUTRAL = '#9a9a9a';

	// A slow pulse on the reveal hint, so the frame visibly runs.
	const hint = $derived(0.55 + 0.35 * wave(t, 3));

	const caption = $derived(
		which === 'contrast'
			? rv > 0.5
				? 'Joined by a bar of the same grey, the two squares match.'
				: 'Which square is lighter?'
			: which === 'shadow'
				? rv > 0.5
					? 'A and B are the same grey: 110 out of 255 on your screen.'
					: 'Which is lighter, square A or square B?'
				: rv > 0.5
					? 'On a neutral grey, the two small squares match.'
					: 'Are the two small squares the same colour?'
	);
</script>

<g>
	{#if which === 'contrast'}
		<defs>
			<linearGradient id="illusion-gradient" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" stop-color="#1c1c1c" />
				<stop offset="1" stop-color="#ececec" />
			</linearGradient>
		</defs>
		<rect x={G.x} y={G.y} width={G.w} height={G.h} rx="12" fill="url(#illusion-gradient)" />
		<rect
			x={G.x + 150}
			y={G.y + G.h / 2 - 22}
			width={G.w - 300}
			height="44"
			fill={SAME_GREY}
			opacity={rv}
		/>
		<rect x={G.x + 100} y={G.y + G.h / 2 - 55} width="110" height="110" fill={SAME_GREY} />
		<rect x={G.x + G.w - 210} y={G.y + G.h / 2 - 55} width="110" height="110" fill={SAME_GREY} />
	{:else if which === 'shadow'}
		<defs>
			<radialGradient
				id="illusion-shadow"
				cx={SH.cx}
				cy={SH.cy}
				r={SH.r + 60}
				gradientUnits="userSpaceOnUse"
			>
				<stop offset="0" stop-color="#000" stop-opacity={SHADE} />
				<stop offset={SH.r / (SH.r + 60)} stop-color="#000" stop-opacity={SHADE} />
				<stop offset="1" stop-color="#000" stop-opacity="0" />
			</radialGradient>
			<clipPath id="illusion-board">
				<rect x={B0.x} y={B0.y} width={boardRight - B0.x} height={boardBottom - B0.y} />
			</clipPath>
			<linearGradient id="illusion-cyl" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" stop-color="#2b8a3e" />
				<stop offset="0.45" stop-color="#69db7c" />
				<stop offset="1" stop-color="#1e6b2e" />
			</linearGradient>
		</defs>
		{#each tiles as q (q.key)}
			<rect x={q.x} y={q.y} width={B0.size} height={B0.size} fill={q.light ? LIGHT : DARK} />
		{/each}
		<g clip-path="url(#illusion-board)">
			<circle cx={SH.cx} cy={SH.cy} r={SH.r + 60} fill="url(#illusion-shadow)" />
		</g>
		<rect
			x={B0.x}
			y={B0.y}
			width={boardRight - B0.x}
			height={boardBottom - B0.y}
			fill="none"
			stroke="#4a4a4a"
			stroke-width="3"
		/>
		<!-- the cylinder casting the shadow -->
		<rect x={CYL.x - 44} y={CYL.y - 120} width="88" height="160" fill="url(#illusion-cyl)" />
		<ellipse cx={CYL.x} cy={CYL.y - 120} rx="44" ry="14" fill="#8ce99a" />
		<ellipse cx={CYL.x} cy={CYL.y + 40} rx="44" ry="14" fill="#1e6b2e" />
		<!-- hide everything but A and B -->
		<path d={maskPath} fill="var(--stage-bg)" fill-rule="evenodd" opacity={rv * 0.94} />
		{#each [{ q: A_TILE, id: 'A' }, { q: B_TILE, id: 'B' }] as m (m.id)}
			<text
				x={m.q.x + B0.size / 2}
				y={m.q.y + B0.size / 2 + 9}
				text-anchor="middle"
				font-size="26"
				font-weight="700"
				style:fill={m.id === 'A' ? '#d8d8d8' : '#2a2a2a'}>{m.id}</text
			>
		{/each}
	{:else}
		{#each SURROUNDS as s (s.id)}
			<rect x={s.x} y={100} width="300" height="300" rx="12" fill={s.fill} />
			<rect x={s.x} y={100} width="300" height="300" rx="12" fill={NEUTRAL} opacity={rv} />
			<rect x={s.x + 120} y={220} width="60" height="60" fill={PATCH} />
		{/each}
	{/if}

	<Readout id="caption" label="Look" value={caption} order={0}>
		<Label x={480} y={482} text={caption} size={15} weight={700} />
	</Readout>
	{#if rv < 0.5}
		<Readout id="hint">
			<Label
				x={480}
				y={512}
				text="then turn on “Reveal the trick”"
				size={12}
				muted
				opacity={hint}
			/>
		</Readout>
	{/if}
</g>
