<script lang="ts">
	/**
	 * An orbital as a 3D cloud of points sampled from |ψ|² (hydrogen), slowly
	 * turning (a pure function of t) and turnable by dragging or with the arrow
	 * keys. Orthographic projection with z up (2p is 2p_z, 3d is 3d_z²), so a
	 * sphere projects to a circle of the same radius: the 1s "90%" circle is
	 * exact. The ~1500 points are drawn as four paths (sign of ψ × near/far
	 * half), not as 1500 nodes. Colours are the sign of ψ, never charge.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { startDrag, clamp, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { EXTENT, cloud, radius90For1s, type OrbitalId } from '../atom';

	let { t, params, reduced }: StageProps = $props();

	const IDS: OrbitalId[] = ['1s', '2s', '2p', '3p', '3d'];
	const orbital = $derived(
		(IDS.includes(params.orbital as OrbitalId) ? params.orbital : '1s') as OrbitalId
	);
	// A plain (non-reactive) cache: each cloud is sampled once.
	const cache: Partial<Record<OrbitalId, ReturnType<typeof cloud>>> = {};
	const points = $derived.by(() => {
		let pts = cache[orbital];
		if (!pts) {
			pts = cloud(orbital, 1500, 7);
			cache[orbital] = pts;
		}
		return pts;
	});

	const CX = 350;
	const CY = 300;
	const RADIUS = 250; // stage units for the sampled extent
	const scale = $derived(RADIUS / EXTENT[orbital]); // px per Bohr radius

	// ---- rotation ------------------------------------------------------------------
	let yawOff = $state(0);
	let pitch = $state(0.32);
	const yaw = $derived(yawOff + (reduced ? 0.6 : 0.6 + 0.18 * t));

	const view = $derived.by(() => {
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);
		const cp = Math.cos(pitch);
		const sp = Math.sin(pitch);
		// Model → screen: yaw about z (vertical), then tilt about the screen x axis.
		const project = (x: number, y: number, z: number) => {
			const X = x * cy - y * sy;
			const D = x * sy + y * cy;
			const up = z * cp + D * sp;
			const depth = D * cp - z * sp;
			return { x: CX + X * scale, y: CY - up * scale, depth };
		};
		return project;
	});

	const paths = $derived.by(() => {
		const out = { posFar: '', posNear: '', negFar: '', negNear: '' };
		for (const p of points) {
			const s = view(p.x, p.y, p.z);
			const near = s.depth < 0;
			const k = near ? 2.6 : 2;
			const sq = `M${(s.x - k / 2).toFixed(1)} ${(s.y - k / 2).toFixed(1)}h${k}v${k}h-${k}z`;
			if (p.sign > 0) {
				if (near) out.posNear += sq;
				else out.posFar += sq;
			} else if (near) out.negNear += sq;
			else out.negFar += sq;
		}
		return out;
	});

	const axisLen = $derived(EXTENT[orbital] * 0.92);
	const axes = $derived(
		(['x', 'y', 'z'] as const).map((name) => {
			const v = name === 'x' ? [1, 0, 0] : name === 'y' ? [0, 1, 0] : [0, 0, 1];
			const a = view(-v[0] * axisLen, -v[1] * axisLen, -v[2] * axisLen);
			const b = view(v[0] * axisLen, v[1] * axisLen, v[2] * axisLen);
			const tip = view(v[0] * axisLen * 1.07, v[1] * axisLen * 1.07, v[2] * axisLen * 1.07);
			return { name, a, b, tip };
		})
	);

	// Scale bar: a round number of Bohr radii about 60–130 px long.
	const bar = $derived.by(() => {
		const a0 = [1, 2, 5, 10].find((n) => n * scale >= 55) ?? 10;
		return { a0, px: a0 * scale, nm: (a0 * 0.0529).toFixed(a0 === 1 ? 2 : 2) };
	});
	const r90 = radius90For1s();

	const INFO: Record<OrbitalId, { title: string; lines: string[] }> = {
		'1s': { title: '1s orbital', lines: ['A fuzzy sphere, densest', 'at the nucleus.'] },
		'2s': {
			title: '2s orbital',
			lines: ['A sphere inside a sphere,', 'with an empty shell between.']
		},
		'2p': {
			title: '2p orbital',
			lines: ['Two lobes on either side', 'of the nucleus (this one along z).']
		},
		'3p': {
			title: '3p orbital',
			lines: ['Two lobes along z, each with', 'a smaller lobe inside.']
		},
		'3d': {
			title: '3d orbital',
			lines: ['Two lobes and a ring (3d z²). The', 'other four 3d orbitals have four lobes.']
		}
	};
	const info = $derived(INFO[orbital]);

	// ---- interaction ---------------------------------------------------------------
	let last: Point | null = null;
	function onpointerdown(e: PointerEvent) {
		startDrag(
			e,
			(p) => {
				if (last) {
					yawOff += (p.x - last.x) * 0.012;
					pitch = clamp(pitch + (p.y - last.y) * 0.012, -1.4, 1.4);
				}
				last = p;
			},
			() => (last = null)
		);
	}
	function onkeydown(e: KeyboardEvent) {
		const k = e.shiftKey ? 0.5 : 0.15;
		if (e.key === 'ArrowLeft') yawOff -= k;
		else if (e.key === 'ArrowRight') yawOff += k;
		else if (e.key === 'ArrowUp') pitch = clamp(pitch - k, -1.4, 1.4);
		else if (e.key === 'ArrowDown') pitch = clamp(pitch + k, -1.4, 1.4);
		else return;
		e.preventDefault();
	}
	const deg = $derived(Math.round((((yaw * 180) / Math.PI) % 360) + 360) % 360);

	const PX = 640; // right panel
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- far half: axes behind, then the far points -->
	<path d={paths.posFar} fill="var(--atom-s)" opacity="0.45" />
	<path d={paths.negFar} fill="var(--atom-f)" opacity="0.45" />
	{#each axes as ax (ax.name)}
		<line
			x1={ax.a.x}
			y1={ax.a.y}
			x2={ax.b.x}
			y2={ax.b.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="3 4"
			opacity="0.8"
		/>
	{/each}
	<circle cx={CX} cy={CY} r="3" fill="var(--stage-ink)" />
	<path d={paths.posNear} fill="var(--atom-s)" opacity="0.85" />
	<path d={paths.negNear} fill="var(--atom-f)" opacity="0.85" />
	{#each axes as ax (ax.name)}
		{@render txt(ax.tip.x, ax.tip.y + 4, ax.name, 13, { anchor: 'middle', weight: 700 })}
	{/each}

	{#if orbital === '1s'}
		<circle
			cx={CX}
			cy={CY}
			r={r90 * scale}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		{@render txt(
			CX + r90 * scale * 0.72 + 8,
			CY - r90 * scale * 0.72 - 8,
			'90% of the time inside here',
			12,
			{
				weight: 600
			}
		)}
	{/if}

	<!-- drag / keyboard target over the cloud -->
	<rect
		class="turn"
		x={CX - 290}
		y={CY - 280}
		width="580"
		height="560"
		rx="16"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Turn the orbital: drag, or use the arrow keys"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={deg}
		aria-valuetext="turned {deg} degrees"
		{onpointerdown}
		{onkeydown}
	/>

	<!-- right panel -->
	{@render txt(PX, 52, info.title, 20, { weight: 700 })}
	{#each info.lines as line, i (i)}
		{@render txt(PX, 78 + i * 19, line, 13)}
	{/each}
	{@render txt(PX, 132, 'Dense dots: the electron is likely there.', 12, { muted: true })}
	{@render txt(PX, 150, 'Drag to turn it (or focus it and use arrows).', 12, { muted: true })}

	<!-- legend -->
	{#if orbital === '1s'}
		<rect x={PX} y="178" width="12" height="12" rx="2" fill="var(--atom-s)" />
		{@render txt(PX + 20, 189, 'ψ has one sign everywhere', 13)}
	{:else}
		<rect x={PX} y="178" width="12" height="12" rx="2" fill="var(--atom-s)" />
		{@render txt(PX + 20, 189, 'ψ positive', 13)}
		<rect x={PX + 120} y="178" width="12" height="12" rx="2" fill="var(--atom-f)" />
		{@render txt(PX + 140, 189, 'ψ negative', 13)}
	{/if}
	{@render txt(PX, 210, 'Colours: sign of the wave function, not charge.', 12, { muted: true })}

	<!-- scale bar -->
	<g transform="translate({PX} 252)">
		<path
			d="M0 -5V5M0 0H{bar.px}M{bar.px} -5V5"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		{@render txt(bar.px + 10, 5, `${bar.a0} a₀ ≈ ${bar.nm} nm`, 13, { weight: 600 })}
		{@render txt(0, 26, 'a₀ = Bohr radius ≈ 0.05 nm', 11, { muted: true })}
	</g>

	<!-- the pitfall: not a planet on an orbit -->
	<g transform="translate({PX} 330)">
		<rect
			width="300"
			height="104"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1"
		/>
		<ellipse
			cx="58"
			cy="52"
			rx="40"
			ry="16"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
		/>
		<circle cx="58" cy="52" r="5" fill="var(--atom-proton)" />
		<circle cx="94" cy="45" r="4" fill="var(--atom-electron)" />
		<path
			d="M22 22 L94 82 M94 22 L22 82"
			stroke="var(--atom-proton)"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.85"
		/>
		{@render txt(116, 44, 'Not like this:', 13, { weight: 700 })}
		{@render txt(116, 63, 'electrons follow no path', 12)}
		{@render txt(116, 80, 'or orbit at all.', 12)}
	</g>

	{@render txt(PX, 470, 'Exact shapes for hydrogen; other atoms', 11, { muted: true })}
	{@render txt(PX, 486, 'have orbitals of similar shapes.', 11, { muted: true })}
	{@render txt(CX, 590, 'nucleus at the centre (far too small to see)', 11, {
		anchor: 'middle',
		muted: true
	})}
</g>

<style>
	.turn {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.turn:active {
		cursor: grabbing;
	}
	.turn:focus-visible {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
