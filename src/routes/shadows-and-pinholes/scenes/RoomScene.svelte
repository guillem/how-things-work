<script lang="ts">
	/**
	 * A room seen from the side: a lamp on a stand, a toy on a shelf and a wall, all on one scale.
	 * Straight lines of light run from the lamp to the wall, stopping at the toy; the wall is lit by
	 * the share of each lamp it can see, so the shadow (and its soft edge) comes from the model.
	 * The lamp, the toy and the wall can be dragged sideways.
	 */
	import { Label, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { enlargement, lit, softEdge, type Lamp, type Toy } from '../model';

	let { step, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'straight'));
	const toyX = $derived(Number(params.toy ?? 2.2));
	const lampX = $derived(Number(params.lamp ?? 1.2));
	const wallX = $derived(Number(params.wall ?? 4.2));
	const size = $derived(phase === 'soft' ? Number(params.size ?? 0.25) : 0);
	const on = $derived(phase !== 'nothrown' || params.on !== false);
	const lamp: Lamp = $derived({ x: lampX, y: 1.05, size });
	const second: Lamp = $derived({ x: lampX, y: 1.25, size: 0 });
	const lamps = $derived(
		!on ? [] : phase === 'two' && params.second !== false ? [lamp, second] : [lamp]
	);
	const toy: Toy = $derived({ x: toyX, bottom: 0.8, top: 1.3 });

	// ---- one scale for both directions: 168 px per metre ---------------------------------------
	const U = 168;
	const X0 = 60;
	const FLOOR = 540;
	const PX = (x: number) => X0 + x * U;
	const PY = (y: number) => FLOOR - y * U;
	const ROOM_H = 2.6;

	// ---- light on the wall --------------------------------------------------------------------
	const N = 130;
	const strips = $derived(
		Array.from({ length: N }, (_, i) => {
			const y0 = (ROOM_H * i) / N;
			const y1 = (ROOM_H * (i + 1)) / N;
			const y = (y0 + y1) / 2;
			const light = lamps.length
				? lamps.reduce((a, l) => a + lit(l, toy, wallX, y), 0) / lamps.length
				: 0;
			return { y0, y1, light };
		})
	);
	// Straight lines from each lamp's centre to points of the wall; those that meet the toy stop there.
	const rays = $derived(
		lamps.flatMap((l, li) =>
			Array.from({ length: 27 }, (_, i) => {
				const yw = (ROOM_H * (i + 0.5)) / 27;
				const yAtToy = l.y + ((yw - l.y) * (toy.x - l.x)) / (wallX - l.x);
				const blocked = yAtToy >= toy.bottom && yAtToy <= toy.top;
				return { li, x1: l.x, y1: l.y, x2: blocked ? toy.x : wallX, y2: blocked ? yAtToy : yw };
			})
		)
	);
	const times = $derived(enlargement(lamp, toy, wallX));
	const edge = $derived(softEdge(lamp, toy, wallX));

	// ---- dragging -----------------------------------------------------------------------------
	const LIMITS: Record<string, [number, number]> = {
		lamp: [0.2, 1.9],
		toy: [1.6, 3.6],
		wall: [2.6, 5]
	};
	function setX(id: string, x: number) {
		const [lo, hi] = LIMITS[id];
		let v = Math.min(hi, Math.max(lo, x));
		// Keep the order lamp < toy < wall.
		if (id === 'lamp') v = Math.min(v, toyX - 0.3);
		if (id === 'toy') v = Math.min(Math.max(v, lampX + 0.3), wallX - 0.2);
		if (id === 'wall') v = Math.max(v, toyX + 0.2);
		setParam(id, Math.round(v * 20) / 20);
	}
	const current = (id: string) => (id === 'lamp' ? lampX : id === 'toy' ? toyX : wallX);
	function drag(e: PointerEvent, id: string) {
		startDrag(e, (p) => setX(id, (p.x - X0) / U));
	}
	function key(e: KeyboardEvent, id: string) {
		const d =
			e.key === 'ArrowRight' || e.key === 'ArrowUp'
				? 0.05
				: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
					? -0.05
					: 0;
		if (!d) return;
		e.preventDefault();
		setX(id, current(id) + d);
	}
	const mix = (light: number) =>
		`color-mix(in srgb, var(--sh-wall) ${Math.round(light * 100)}%, var(--sh-dark))`;
</script>

<g class="sh-room">
	<!-- floor -->
	<line
		x1={X0 - 20}
		y1={FLOOR}
		x2={PX(5.2)}
		y2={FLOOR}
		stroke="var(--text-muted)"
		stroke-width="3"
	/>

	<!-- rays -->
	{#each rays as r, i (i)}
		<line
			x1={PX(r.x1)}
			y1={PY(r.y1)}
			x2={PX(r.x2)}
			y2={PY(r.y2)}
			stroke="var(--sh-ray)"
			stroke-width="1.6"
		/>
	{/each}

	<!-- the wall, lit by the share of the lamps each bit can see -->
	{#each strips as s, i (i)}
		<rect
			x={PX(wallX)}
			y={PY(s.y1)}
			width="22"
			height={PY(s.y0) - PY(s.y1) + 0.6}
			fill={mix(s.light)}
		/>
	{/each}
	<rect
		class="sh-drag"
		x={PX(wallX) - 6}
		y={PY(ROOM_H)}
		width="34"
		height={ROOM_H * U}
		fill="transparent"
		stroke="var(--text-muted)"
		role="slider"
		tabindex="0"
		aria-label="Wall position"
		aria-valuenow={wallX}
		aria-valuemin={2.6}
		aria-valuemax={5}
		onpointerdown={(e) => drag(e, 'wall')}
		onkeydown={(e) => key(e, 'wall')}
	/>

	<!-- the shelf and the toy -->
	<line
		x1={PX(toyX) - 40}
		y1={PY(0.8)}
		x2={PX(toyX) + 40}
		y2={PY(0.8)}
		stroke="var(--text-muted)"
		stroke-width="4"
	/>
	<line
		x1={PX(toyX)}
		y1={PY(0.8)}
		x2={PX(toyX)}
		y2={FLOOR}
		stroke="var(--text-muted)"
		stroke-width="3"
	/>
	<g
		class="sh-drag"
		role="slider"
		tabindex="0"
		aria-label="Toy position"
		aria-valuenow={toyX}
		aria-valuemin={1.6}
		aria-valuemax={3.6}
		onpointerdown={(e) => drag(e, 'toy')}
		onkeydown={(e) => key(e, 'toy')}
	>
		<rect x={PX(toyX) - 18} y={PY(1.3)} width="36" height={0.5 * U} fill="transparent" />
		<rect x={PX(toyX) - 6} y={PY(1.15)} width="12" height={0.35 * U} rx="4" fill="var(--sh-toy)" />
		<circle cx={PX(toyX)} cy={PY(1.22)} r={0.08 * U} fill="var(--sh-toy)" />
	</g>

	<!-- the lamp(s) -->
	<line
		x1={PX(lampX)}
		y1={FLOOR}
		x2={PX(lampX)}
		y2={PY(lamp.y)}
		stroke="var(--text-muted)"
		stroke-width="4"
	/>
	<g
		class="sh-drag"
		role="slider"
		tabindex="0"
		aria-label="Lamp position"
		aria-valuenow={lampX}
		aria-valuemin={0.2}
		aria-valuemax={1.9}
		onpointerdown={(e) => drag(e, 'lamp')}
		onkeydown={(e) => key(e, 'lamp')}
	>
		<rect x={PX(lampX) - 24} y={PY(lamp.y) - 40} width="48" height="80" fill="transparent" />
		{#if size > 0}
			<rect
				x={PX(lampX) - 7}
				y={PY(lamp.y + size / 2)}
				width="14"
				height={size * U}
				rx="6"
				fill={on ? 'var(--sh-light)' : 'var(--text-muted)'}
			/>
		{:else}
			<circle
				cx={PX(lampX)}
				cy={PY(lamp.y)}
				r="9"
				fill={on ? 'var(--sh-light)' : 'var(--text-muted)'}
			/>
		{/if}
	</g>
	{#if phase === 'two' && params.second !== false}
		<line
			x1={PX(lampX)}
			y1={PY(lamp.y)}
			x2={PX(lampX)}
			y2={PY(second.y)}
			stroke="var(--text-muted)"
			stroke-width="3"
		/>
		<circle cx={PX(lampX)} cy={PY(second.y)} r="9" fill="var(--sh-light)" />
	{/if}

	<!-- readouts -->
	{#if !on}
		<Readout id="sh-off" order={1} label="Lamp" value="off: no light, so no shadow either">
			<Label
				x={480}
				y={60}
				text="Lamp off: no light anywhere, so no shadow either"
				anchor="middle"
				size={18}
				weight={700}
			/>
		</Readout>
	{:else if phase === 'soft'}
		<Readout
			id="sh-soft"
			order={1}
			label="Soft edge"
			value={size === 0 ? 'sharp' : `about ${Math.round(edge * 100)} cm wide`}
		>
			<Label
				x={480}
				y={60}
				text={size === 0
					? 'tiny bulb: a sharp edge'
					: `soft edge about ${Math.round(edge * 100)} cm wide`}
				anchor="middle"
				size={18}
				weight={700}
				tabular
			/>
		</Readout>
	{:else if phase === 'two'}
		<Readout
			id="sh-two"
			order={1}
			label="Shadows"
			value={lamps.length === 2 ? 'two shadows, darkest where they overlap' : 'one shadow'}
		>
			<Label
				x={480}
				y={60}
				text={lamps.length === 2
					? 'two lamps: two shadows, darkest where they overlap'
					: 'one lamp: one shadow'}
				anchor="middle"
				size={18}
				weight={700}
			/>
		</Readout>
	{:else}
		<Readout
			id="sh-size"
			order={1}
			label="Shadow"
			value="{times.toFixed(1)} times as tall as the toy"
		>
			<Label
				x={480}
				y={60}
				text="the shadow is {times.toFixed(1)} times as tall as the toy"
				anchor="middle"
				size={18}
				weight={700}
				tabular
			/>
		</Readout>
	{/if}
	<Readout
		id="sh-distances"
		order={2}
		label="Distances"
		value="lamp to toy {(toyX - lampX).toFixed(1)} m, toy to wall {(wallX - toyX).toFixed(1)} m"
	>
		<Label
			x={480}
			y={86}
			text="lamp to toy {(toyX - lampX).toFixed(1)} m · toy to wall {(wallX - toyX).toFixed(1)} m"
			anchor="middle"
			size={13}
			muted
			tabular
		/>
	</Readout>
</g>

<style>
	.sh-drag {
		cursor: ew-resize;
		outline: none;
	}
	.sh-drag:focus-visible {
		outline: 2px solid var(--focus);
	}
</style>
