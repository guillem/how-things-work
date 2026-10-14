<script lang="ts">
	/**
	 * The scene as numbers. Left: the map seen from above, with the draggable camera. Right: every
	 * triangle edge projected through the real pipeline (`projectPoint`: model, view, projection
	 * matrices and the perspective divide), as the camera sees it. Below, per phase:
	 *  - mesh: the triangle counts, and the three corners of one triangle of the cube;
	 *  - model: the cube's model matrix times one of its corners (`cubeTurn` turns it);
	 *  - view: the view matrix times that corner, in world coordinates;
	 *  - project: the projection matrix times the corner in camera coordinates, then ÷ w and the
	 *    pixel it lands on (`fov` widens or narrows the view).
	 * Nothing moves with t except a pulse on the highlighted corner.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		buildScene,
		makeCamera,
		projectPoint,
		transformPoint,
		transform4,
		cubeModel,
		ID,
		type Vec3
	} from '../render';
	import { cameraOf, cubeTurnOf, fmt, IMG_H, IMG_W, lightOf, MAP } from './shared';
	import MapView from './MapView.svelte';
	import Matrix from './Matrix.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'mesh'));
	const cam = $derived(cameraOf(params));
	const light = $derived(lightOf(params));
	const turn = $derived(cubeTurnOf(params));
	const scene = $derived(buildScene(turn));
	const camera = $derived(makeCamera(cam, IMG_W, IMG_H));

	const R = { x: 352, y: 16, w: 592, h: 370 };
	const K = R.w / IMG_W;

	const wireColor: Record<number, string> = {
		[ID.floor]: 'var(--g3-wire)',
		[ID.cube]: 'var(--g3-cube)',
		[ID.mirror]: 'var(--g3-mirror)',
		[ID.glass]: 'var(--g3-refract)'
	};

	/** Each object's edges as one path, in stage coordinates. */
	const wires = $derived(
		scene.map((o) => {
			const pts = o.mesh.positions.map((p) => {
				const q = projectPoint(camera, transformPoint(o.model, p)).pixel;
				return `${(R.x + q[0] * K).toFixed(1)} ${(R.y + q[1] * K).toFixed(1)}`;
			});
			const seen: Record<string, true> = {};
			let edges = 0;
			let d = '';
			const tr = o.mesh.tris;
			for (let k = 0; k < tr.length; k += 3) {
				for (const [a, b] of [
					[tr[k], tr[k + 1]],
					[tr[k + 1], tr[k + 2]],
					[tr[k + 2], tr[k]]
				]) {
					const key = a < b ? `${a},${b}` : `${b},${a}`;
					if (seen[key]) continue;
					seen[key] = true;
					edges++;
					d += `M${pts[a]}L${pts[b]}`;
				}
			}
			return { id: o.id, d, edges };
		})
	);

	// ---- the corner followed through the pipeline ----------------------------------------
	/** Top-front-right corner of the unit cube, in the cube's own coordinates. */
	const LOCAL: Vec3 = [0.5, 0.5, 0.5];
	const M = $derived(cubeModel(turn));
	const world = $derived(transformPoint(M, LOCAL));
	const viewP = $derived(transformPoint(camera.view, world));
	const clip = $derived(transform4(camera.proj, viewP, 1));
	const proj = $derived(projectPoint(camera, world));
	const cornerS = $derived({ x: R.x + proj.pixel[0] * K, y: R.y + proj.pixel[1] * K });

	/** One triangle of the cube (the first of its top face). */
	const TRI = 4;
	const triCorners = $derived.by(() => {
		const cube = scene[1];
		return [0, 1, 2].map((k) => {
			const v = cube.mesh.tris[3 * TRI + k];
			const w = transformPoint(cube.model, cube.mesh.positions[v]);
			const q = projectPoint(camera, w).pixel;
			return { w, s: { x: R.x + q[0] * K, y: R.y + q[1] * K } };
		});
	});

	const rows4 = (m: number[]) => [0, 1, 2, 3].map((r) => m.slice(4 * r, 4 * r + 4));
	const col = (v: number[]) => v.map((x) => [x]);
	const vec = (v: Vec3) => `(${v.map((x) => fmt(x)).join(', ')})`.replaceAll('-', '−');

	const pulse = $derived(reduced ? 1 : 0.6 + 0.4 * Math.cos(t * 3));
	const focusCube = $derived(phase !== 'mesh');

	const BY = 430; // top of the matrices
</script>

{#snippet times(x: number, y: number, s: string)}
	<T {x} {y} text={s} size={18} anchor="middle" weight={600} />
{/snippet}

<g>
	<MapView
		box={MAP}
		{cam}
		{light}
		cubeTurn={turn}
		{setParam}
		showLight={false}
		focus={focusCube ? 'cube' : null}
	/>

	<!-- what the camera sees -->
	<rect
		x={R.x}
		y={R.y}
		width={R.w}
		height={R.h}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<defs>
		<clipPath id="g3world-clip"><rect x={R.x} y={R.y} width={R.w} height={R.h} rx="10" /></clipPath>
	</defs>
	<g clip-path="url(#g3world-clip)">
		{#each wires as w (w.id)}
			<path
				d={w.d}
				fill="none"
				stroke={wireColor[w.id]}
				stroke-width={w.id === ID.cube && focusCube ? 1.6 : 0.9}
				stroke-opacity={focusCube && w.id !== ID.cube ? 0.3 : 0.75}
				stroke-linecap="round"
			/>
		{/each}
		{#if phase === 'mesh'}
			<polygon
				points={triCorners.map((c) => `${c.s.x},${c.s.y}`).join(' ')}
				fill="var(--g3-inside)"
				fill-opacity="0.45"
				stroke="var(--g3-inside)"
				stroke-width="2"
			/>
			{#each triCorners as c, i (i)}
				<circle cx={c.s.x} cy={c.s.y} r="4" fill="var(--g3-inside)" />
			{/each}
		{:else}
			<circle
				cx={cornerS.x}
				cy={cornerS.y}
				r={6 + 4 * (1 - pulse)}
				fill="none"
				stroke="var(--g3-inside)"
				stroke-width="2"
				opacity={pulse}
			/>
			<circle cx={cornerS.x} cy={cornerS.y} r="4" fill="var(--g3-inside)" />
		{/if}
	</g>
	<Readout id="view-title">
		<T
			x={R.x + 14}
			y={R.y + 24}
			text="What the camera sees: every edge"
			size={12.5}
			weight={650}
			muted
		/>
	</Readout>

	<!-- below -->
	{#if phase === 'mesh'}
		<Readout id="count" order={1} label="Triangles" value="654: floor 2, cube 12, two balls of 320">
			<T x={32} y={BY - 2} text="654 triangles" size={16} weight={700} />
			<T
				x={32}
				y={BY + 24}
				text="floor 2 · cube 12 · mirror ball 320 · glass ball 320"
				size={13}
				muted
			/>
			<T
				x={32}
				y={BY + 48}
				text="{scene.reduce((s, o) => s + o.mesh.positions.length, 0)} vertices, {wires.reduce(
					(s, w) => s + w.edges,
					0
				)} edges"
				size={13}
				muted
			/>
		</Readout>
		<Readout
			id="tri"
			order={2}
			label="One triangle of the cube"
			value={triCorners.map((c) => vec(c.w)).join(' ')}
			color="var(--g3-inside)"
		>
			<T
				x={R.x}
				y={BY - 2}
				text="One triangle (shaded): three corners, three numbers each"
				size={13}
				weight={650}
				color="var(--g3-inside)"
			/>
			{#each triCorners as c, i (i)}
				<T x={R.x} y={BY + 26 + 24 * i} text="corner {i + 1}:  x, y, z = {vec(c.w)}" size={13} />
			{/each}
		</Readout>
	{:else}
		<Readout id="eq-minor">
			{#if phase === 'model'}
				<Matrix x={24} y={BY} rows={rows4(M)} caption="model matrix (cube)" />
				{@render times(256, BY + 54, '×')}
				<Matrix x={272} y={BY} rows={col([...LOCAL, 1])} colW={46} caption="corner" />
				{@render times(342, BY + 54, '=')}
				<Matrix
					x={358}
					y={BY}
					rows={col([...world, 1])}
					colW={52}
					caption="in the scene"
					color="var(--g3-inside)"
				/>
			{:else if phase === 'view'}
				<Matrix x={24} y={BY} rows={rows4(camera.view)} caption="view matrix (camera)" />
				{@render times(256, BY + 54, '×')}
				<Matrix x={272} y={BY} rows={col([...world, 1])} colW={52} caption="in the scene" />
				{@render times(348, BY + 54, '=')}
				<Matrix
					x={364}
					y={BY}
					rows={col([...viewP, 1])}
					colW={52}
					caption="from the camera"
					color="var(--g3-inside)"
					mark={2}
				/>
			{:else}
				<Matrix x={24} y={BY} rows={rows4(camera.proj)} caption="projection matrix" />
				{@render times(256, BY + 54, '×')}
				<Matrix x={272} y={BY} rows={col([...viewP, 1])} colW={52} caption="from the camera" />
				{@render times(348, BY + 54, '=')}
				<Matrix
					x={364}
					y={BY}
					rows={col(clip)}
					colW={52}
					caption="clip space"
					color="var(--g3-inside)"
					mark={3}
				/>
			{/if}
		</Readout>
		{#if phase === 'model'}
			<Readout id="m1" order={1} label="Corner of the cube" value={vec(LOCAL)} />
			<Readout id="m2" order={2} label="In the scene" value={vec(world)} color="var(--g3-inside)">
				<T x={480} y={BY + 10} text="Last column: the move (−1.4, 0.6, 0.5)" size={13} />
				<T
					x={480}
					y={BY + 34}
					text="Top-left 3 × 3: turn {Math.round((turn * 180) / Math.PI)}° and scale × 1.2"
					size={13}
				/>
				<T x={480} y={BY + 58} text="Bottom row 0 0 0 1 keeps w = 1" size={13} muted />
			</Readout>
		{:else if phase === 'view'}
			<Readout id="v1" order={1} label="Corner in the scene" value={vec(world)} />
			<Readout
				id="v2"
				order={2}
				label="Seen from the camera"
				value={vec(viewP)}
				color="var(--g3-inside)"
			>
				<T x={490} y={BY + 10} text="Rows: the camera's right, up and backward" size={13} />
				<T
					x={490}
					y={BY + 34}
					text="The corner is {fmt(-viewP[2])} in front of the camera"
					size={13}
					weight={650}
					color="var(--g3-inside)"
				/>
				<T
					x={490}
					y={BY + 58}
					text="(−z), {fmt(viewP[0])} to the right, {fmt(viewP[1])} up"
					size={13}
					muted
				/>
			</Readout>
		{:else}
			<Readout
				id="p1"
				order={1}
				label="Clip space (x, y, z, w)"
				value={clip
					.map((v) => fmt(v))
					.join(', ')
					.replaceAll('-', '−')}
			/>
			<Readout
				id="p2"
				order={2}
				label="÷ w"
				value={vec(proj.ndc)}
				note="w = {fmt(clip[3])}, the distance in front"
			>
				<T x={490} y={BY + 10} text="w = {fmt(clip[3])}: the distance in front" size={13} />
				<T
					x={490}
					y={BY + 34}
					text="÷ w → {vec(proj.ndc)}"
					size={13}
					weight={650}
					color="var(--g3-inside)"
				/>
			</Readout>
			<Readout
				id="p3"
				order={3}
				label="Pixel"
				value="{fmt(proj.pixel[0], 1)} across, {fmt(proj.pixel[1], 1)} down"
			>
				<T
					x={490}
					y={BY + 58}
					text="pixel {fmt(proj.pixel[0], 1)} across, {fmt(proj.pixel[1], 1)} down of 192 × 120"
					size={13}
					muted
				/>
			</Readout>
		{/if}
	{/if}
</g>
