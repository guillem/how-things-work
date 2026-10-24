<script lang="ts">
	/**
	 * A house seen from above, with the router in the corner of the living room, its signal painted
	 * on the floor, and the laptop that the reader walks through the rooms. A panel on the right
	 * shows the laptop's speed and the ladder of ways of sending, with the one in use lit.
	 *
	 * Everything comes from `../model`: the signal map is the model's signal strength on a grid
	 * (shaded in 6 dB steps above the band's slowest way of sending, transparent where there is no
	 * link), recomputed only when the walls, the band or the obstacle change, and painted onto a
	 * small canvas shown as an image. The radio rings and the data dots are pure functions of `t`;
	 * the dots come faster when the link is faster and stop when there is no link.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HOUSE,
		INNER_WALLS,
		LINE_SPEEDS,
		NEIGHBOUR,
		OBSTACLE_AT,
		OBSTACLE_LENGTH,
		ROUTER,
		WALK,
		downloadMbit,
		ladder,
		link,
		nearestSpot,
		signalMap,
		type Band,
		type Neighbour,
		type Obstacle,
		type Point,
		type Setup
	} from '../model';

	let { step, t, params, reduced, dark, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'radio'));
	const walls = $derived(step.hints?.walls !== false);
	const band = $derived<Band>(
		phase === 'reach' || (phase === 'band' && params.fast === true) ? '5' : '2.4'
	);
	const obstacle = $derived<Obstacle>(
		phase === 'things' ? ((params.obstacle as Obstacle | undefined) ?? 'none') : 'none'
	);
	const neighbour = $derived<Neighbour>(
		phase === 'neighbour' ? ((params.neighbour as Neighbour | undefined) ?? 'off') : 'off'
	);
	const spot = $derived(
		step.hints?.spot !== undefined ? Number(step.hints.spot) : Number(params.spot ?? 0)
	);
	const walking = $derived(step.hints?.spot === undefined);
	const lineMbit = $derived(LINE_SPEEDS[Number(params.line ?? 1)] ?? 30);

	const setup = $derived<Setup>({ band, walls, obstacle, neighbour });
	const now = $derived(link(spot, setup));
	const rungs = $derived(ladder(band));
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

	// ---- layout -------------------------------------------------------------------------------
	const S = 30;
	const X0 = 24;
	const Y0 = 118;
	const W = HOUSE.width * S;
	const H = HOUSE.height * S;
	const px = (p: Point) => ({ x: X0 + p.x * S, y: Y0 + p.y * S });
	const r0 = px(ROUTER);
	const nb = px(NEIGHBOUR);
	const lap = $derived(px(now.at));
	const walkPath = WALK.map((p, i) => `${i ? 'L' : 'M'}${X0 + p.x * S},${Y0 + p.y * S}`).join(' ');

	// ---- the signal map -----------------------------------------------------------------------
	const COLS = 160;
	/** Shades of the map: 5.5 dB apart, from the slowest way of sending up to next to the router. */
	const LEVELS = 10;
	const LEVEL_DB = 5.5;
	const shade = (level: number) => 0.05 + 0.075 * level;
	const ROWS = 96;
	const mapUrl = $derived.by(() => {
		if (typeof document === 'undefined') return '';
		const map = signalMap(setup, COLS, ROWS);
		const bottom = rungs[0].minDbm;
		const canvas = document.createElement('canvas');
		canvas.width = COLS;
		canvas.height = ROWS;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';
		// The signal colour is a theme token; `dark` is read so the map repaints on a theme switch.
		void dark;
		const colour =
			getComputedStyle(document.documentElement).getPropertyValue('--ww-signal').trim() ||
			'#1c7ed6';
		ctx.fillStyle = colour;
		for (let j = 0; j < ROWS; j++) {
			for (let i = 0; i < COLS; i++) {
				const dbm = map[j * COLS + i];
				if (dbm < bottom) continue;
				const level = Math.min(LEVELS, Math.floor((dbm - bottom) / LEVEL_DB) + 1);
				ctx.globalAlpha = shade(level);
				ctx.fillRect(i, j, 1, 1);
			}
		}
		return canvas.toDataURL();
	});

	// ---- fades between steps ------------------------------------------------------------------
	const innerOpacity = new Tween(
		untrack(() => (walls ? 1 : 0)),
		{
			duration: 800,
			easing: cubicInOut
		}
	);
	const nbOpacity = new Tween(
		untrack(() => (phase === 'neighbour' ? 1 : 0)),
		{
			duration: 700,
			easing: cubicInOut
		}
	);
	$effect(() => {
		const w = walls ? 1 : 0;
		const n = phase === 'neighbour' ? 1 : 0;
		untrack(() => {
			innerOpacity.set(w, { duration: reduced ? 0 : 800 });
			nbOpacity.set(n, { duration: reduced ? 0 : 700 });
		});
	});

	// ---- the obstacle -------------------------------------------------------------------------
	const ob = $derived.by(() => {
		if (obstacle === 'none') return null;
		const c = px(OBSTACLE_AT);
		const angle = (Math.atan2(OBSTACLE_AT.y - ROUTER.y, OBSTACLE_AT.x - ROUTER.x) * 180) / Math.PI;
		const len = OBSTACLE_LENGTH[obstacle] * S;
		const depth = obstacle === 'tank' ? 12 : obstacle === 'fridge' ? 20 : 6;
		return { c, angle, len, depth };
	});
	const obName: Record<Obstacle, string> = {
		none: '',
		glass: 'glass door',
		brick: 'brick wall',
		concrete: 'concrete wall',
		tank: 'fish tank',
		fridge: 'fridge'
	};

	// ---- motion -------------------------------------------------------------------------------
	const RINGS = [0, 1, 2];
	const rings = $derived(
		RINGS.map((k) => {
			const u = cycle(t, 3, k / RINGS.length);
			return { k, r: 20 + u * 260, o: 0.5 * smoothstep(0, 0.1, u) * (1 - smoothstep(0.5, 1, u)) };
		})
	);
	/** Our turn on the air: always, unless the two networks take turns (then half of each 2 s). */
	const turns = $derived(now.turns.share < 1);
	const ourTurn = $derived(!turns || cycle(t, 2) < 0.5);
	const DOTS = [0, 1, 2, 3];
	/** Faster link, faster dots: one trip in 0.8 s at the band's top speed, slower below. */
	const period = $derived(now.mbit > 0 ? 0.8 * Math.sqrt(780 / now.mbit) : 1);
	const dots = $derived(
		DOTS.map((k) => {
			const u = cycle(t, period, k / DOTS.length);
			const fade = smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
			return {
				k,
				x: r0.x + (lap.x - r0.x) * u,
				y: r0.y + (lap.y - r0.y) * u,
				o: now.mbit > 0 && ourTurn ? fade : 0
			};
		})
	);
	const nbDots = $derived(
		DOTS.map((k) => {
			const u = cycle(t, 1.2, k / DOTS.length);
			const fade = smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u));
			const busy = neighbour !== 'off' && (!turns || !ourTurn);
			return { k, x: nb.x + 8 + u * 30, y: nb.y + 40 - u * 10, o: busy ? fade : 0 };
		})
	);

	// ---- drag ---------------------------------------------------------------------------------
	function drag(p: { x: number; y: number }) {
		setParam('spot', Math.round(nearestSpot({ x: (p.x - X0) / S, y: (p.y - Y0) / S })));
	}
	function key(k: number | 'start' | 'end') {
		const v = k === 'start' ? 0 : k === 'end' ? 100 : Math.min(100, Math.max(0, spot + k));
		setParam('spot', v);
	}

	// ---- readouts -----------------------------------------------------------------------------
	/** The big number: the laptop's speed, or on the internet step what a download gets. */
	const shown = $derived(phase === 'internet' ? Math.min(now.yours, lineMbit) : now.yours);
	const speedText = $derived(shown > 0 ? `${fmt(shown)} Mbit/s` : 'no link');
	const wallCount = $derived(now.crossed.length);
	const wallText = $derived(wallCount === 0 ? 'none' : String(wallCount));
	const rungText = $derived(
		now.rung ? `step ${now.rung.mcs + 1} of ${rungs.length}` : 'below the bottom step'
	);
	const rooms = [
		{ id: 'living', x: 4, y: 0.7, name: 'living room' },
		{ id: 'kitchen', x: 11, y: 0.7, name: 'kitchen' },
		{ id: 'study', x: 17, y: 0.7, name: 'study' },
		{ id: 'play', x: 4, y: 11.5, name: 'playroom' },
		{ id: 'bed', x: 11, y: 11.5, name: 'bedroom' },
		{ id: 'back', x: 16, y: 11.5, name: 'back bedroom' }
	];
	const caption = $derived(
		{
			radio: 'a house before its inside walls are built',
			walls: 'brick walls with open doorways',
			ladder: 'brick walls with open doorways',
			things: obstacle === 'none' ? 'the laptop is on the bed' : `a ${obName[obstacle]} in the way`,
			band: band === '5' ? 'the 5 GHz band' : 'the 2.4 GHz band',
			reach: 'the 5 GHz band',
			neighbour:
				neighbour === 'off'
					? 'next door’s router is off'
					: neighbour === 'same'
						? 'next door is on the same channel'
						: 'next door is on a different channel',
			internet: 'the router passes everything on to the line',
			next: 'brick walls with open doorways'
		}[phase] ?? ''
	);
	const turnText = $derived(
		neighbour === 'off'
			? 'the air is all ours'
			: turns
				? 'taking turns: half the time each'
				: 'a different channel: no waiting'
	);

	// ---- the ladder ---------------------------------------------------------------------------
	const LX = 724;
	const LY = 478;
	const RUNG = 24;
	const ladderRows = $derived(
		rungs.map((r, i) => {
			const h = RUNG;
			return {
				i,
				y: LY - (i + 1) * h,
				h: h - 4,
				w: 30 + (130 * Math.sqrt(r.mbit)) / Math.sqrt(780),
				lit: now.rung !== null && r.mbit <= now.rung.mbit,
				current: now.rung?.mcs === r.mcs,
				mbit: r.mbit
			};
		})
	);
	const showLadder = $derived(phase !== 'internet');
	const download = $derived(downloadMbit(now.yours, lineMbit));
</script>

<g class="house-scene">
	<defs>
		<clipPath id="wifi-house-clip">
			<rect x={X0} y={Y0} width={W} height={H} />
		</clipPath>
	</defs>

	<!-- caption -->
	<Readout id="caption" order={0} label="Seen from above" value={caption}>
		<Label anchor="start" x={X0} y={44} text="seen from above: {caption}" size={15} weight={600} />
	</Readout>
	<Readout id="key">
		<g transform="translate({X0}, 494)">
			<text x="0" y="22" font-size="12" fill="var(--stage-ink-muted)">signal: strong</text>
			{#each [10, 8, 6, 4, 2] as lv, i (lv)}
				<rect
					x={92 + i * 26}
					y="10"
					width="24"
					height="16"
					rx="3"
					fill="var(--ww-signal)"
					fill-opacity={shade(lv)}
				/>
			{/each}
			<text x="228" y="22" font-size="12" fill="var(--stage-ink-muted)">faint</text>
			<rect
				x="270"
				y="10"
				width="24"
				height="16"
				rx="3"
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="3 3"
			/>
			<text x="300" y="22" font-size="12" fill="var(--stage-ink-muted)">no link</text>
		</g>
	</Readout>

	<!-- floor and signal -->
	<rect x={X0} y={Y0} width={W} height={H} fill="var(--ww-floor)" />
	{#if mapUrl}
		<image
			href={mapUrl}
			x={X0}
			y={Y0}
			width={W}
			height={H}
			preserveAspectRatio="none"
			data-band={band}
		/>
	{/if}

	<!-- radio rings -->
	<g clip-path="url(#wifi-house-clip)" pointer-events="none">
		{#each rings as ring (ring.k)}
			<circle
				cx={r0.x}
				cy={r0.y}
				r={ring.r}
				fill="none"
				stroke="var(--ww-signal-edge)"
				stroke-width="1.5"
				opacity={reduced ? 0 : ring.o}
			/>
		{/each}
	</g>

	<!-- walls -->
	<g opacity={innerOpacity.current}>
		{#each INNER_WALLS as w, i (i)}
			<line
				x1={X0 + w.a.x * S}
				y1={Y0 + w.a.y * S}
				x2={X0 + w.b.x * S}
				y2={Y0 + w.b.y * S}
				stroke="var(--ww-brick)"
				stroke-width="6"
				stroke-linecap="square"
			/>
		{/each}
	</g>
	<rect
		x={X0}
		y={Y0}
		width={W}
		height={H}
		fill="none"
		stroke="var(--ww-brick)"
		stroke-width="9"
		rx="2"
	/>

	<!-- room names -->
	<g>
		{#each rooms as room (room.id)}
			<Readout id="room-{room.id}">
				<Label
					x={X0 + room.x * S}
					y={Y0 + room.y * S + 4}
					text={room.name}
					size={12}
					anchor="middle"
					muted
				/>
			</Readout>
		{/each}
	</g>

	<!-- the obstacle -->
	{#if ob}
		<g transform="translate({ob.c.x}, {ob.c.y}) rotate({ob.angle})">
			{#if obstacle === 'tank'}
				<rect
					x={-ob.depth / 2}
					y={-ob.len / 2}
					width={ob.depth}
					height={ob.len}
					rx="2"
					fill="var(--ww-water)"
					stroke="var(--ww-water-edge)"
					stroke-width="1.5"
				/>
				<path d="M-3,-6 q4,-4 7,0 q-3,4 -7,0 l-3,-3 v6 z" fill="var(--ww-fish)" />
			{:else if obstacle === 'fridge'}
				<rect
					x={-ob.depth / 2}
					y={-ob.len / 2}
					width={ob.depth}
					height={ob.len}
					rx="2"
					fill="var(--ww-metal)"
					stroke="var(--ww-metal-edge)"
					stroke-width="1.5"
				/>
			{:else}
				<rect
					x={-ob.depth / 2}
					y={-ob.len / 2}
					width={ob.depth}
					height={ob.len}
					fill={obstacle === 'glass'
						? 'var(--ww-glass)'
						: obstacle === 'brick'
							? 'var(--ww-brick)'
							: 'var(--ww-concrete)'}
					stroke={obstacle === 'glass' ? 'var(--ww-glass-edge)' : 'none'}
				/>
			{/if}
		</g>
		<Readout id="obstacle" order={3} label="In the way" value="a {obName[obstacle]}">
			<Label x={ob.c.x + 20} y={ob.c.y - 28} text={obName[obstacle]} anchor="start" pill />
		</Readout>
	{/if}

	<!-- next door -->
	{#if nbOpacity.current > 0.01}
		<g opacity={nbOpacity.current}>
			<rect
				x={X0 + W + 6}
				y={Y0}
				width="60"
				height={H}
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="5 4"
			/>
			<Readout id="nextdoor">
				<Label x={X0 + W + 36} y={Y0 - 10} text="next door" size={12} anchor="middle" muted />
			</Readout>
			<g opacity={neighbour === 'off' ? 0.35 : 1}>
				<rect x={nb.x - 12} y={nb.y - 8} width="24" height="16" rx="4" fill="var(--ww-neighbour)" />
				<line
					x1={nb.x - 6}
					y1={nb.y - 8}
					x2={nb.x - 9}
					y2={nb.y - 18}
					stroke="var(--ww-neighbour)"
					stroke-width="2"
				/>
				<line
					x1={nb.x + 6}
					y1={nb.y - 8}
					x2={nb.x + 9}
					y2={nb.y - 18}
					stroke="var(--ww-neighbour)"
					stroke-width="2"
				/>
			</g>
			{#each nbDots as d (d.k)}
				<circle cx={d.x} cy={d.y} r="4" fill="var(--ww-neighbour)" opacity={d.o} />
			{/each}
		</g>
	{/if}

	<!-- the walk -->
	{#if walking}
		<path
			d={walkPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="2 6"
			stroke-linecap="round"
			opacity="0.7"
		/>
	{/if}

	<!-- data on its way to the laptop -->
	{#each dots as d (d.k)}
		<circle cx={d.x} cy={d.y} r="4.5" fill="var(--ww-data)" opacity={d.o} />
	{/each}

	<!-- the router -->
	<g transform="translate({r0.x}, {r0.y})">
		<line x1="-7" y1="-9" x2="-11" y2="-22" stroke="var(--ww-router)" stroke-width="2.5" />
		<line x1="7" y1="-9" x2="11" y2="-22" stroke="var(--ww-router)" stroke-width="2.5" />
		<rect x="-16" y="-10" width="32" height="20" rx="5" fill="var(--ww-router)" />
		<circle cx="-7" cy="0" r="2.2" fill="var(--ww-light)" />
		<circle cx="0" cy="0" r="2.2" fill="var(--ww-light)" />
		<circle cx="7" cy="0" r="2.2" fill="var(--ww-light)" />
	</g>
	<Readout id="router-label">
		<Label anchor="start" x={r0.x + 22} y={r0.y - 14} text="router" weight={600} />
	</Readout>

	{#if phase === 'things'}
		<!-- the bed the laptop is on -->
		<rect x={lap.x - 34} y={lap.y - 24} width="68" height="48" rx="5" fill="var(--ww-bed)" />
		<rect x={lap.x + 20} y={lap.y - 20} width="10" height="40" rx="3" fill="var(--ww-pillow)" />
	{/if}

	<!-- the laptop -->
	<g transform="translate({lap.x}, {lap.y})" pointer-events="none">
		<rect x="-15" y="-12" width="30" height="19" rx="2" fill="var(--ww-laptop)" />
		<rect x="-12" y="-9.5" width="24" height="14" rx="1" fill="var(--ww-screen)" />
		<path d="M-19,7 h38 l-3,5 h-32 z" fill="var(--ww-laptop)" />
	</g>
	{#if walking}
		<Handle
			x={lap.x}
			y={lap.y + 22}
			r={7}
			label="Laptop"
			value={spot}
			min={0}
			max={100}
			valuetext="{Math.round(spot)}% of the way, {speedText}"
			onmove={drag}
			onkey={key}
		/>
	{/if}

	<!-- the panel: speed and the ladder -->
	<Readout id="speed" order={1} label="Laptop’s speed" value={speedText}>
		<Label
			anchor="start"
			x={LX}
			y={136}
			text={phase === 'internet' ? 'what the laptop gets' : 'laptop’s speed'}
			size={13}
			muted
		/>
		<Label
			anchor="start"
			x={LX}
			y={170}
			text={speedText}
			size={30}
			weight={700}
			tabular
			color={shown > 0 ? 'var(--stage-ink)' : 'var(--ww-nolink)'}
		/>
	</Readout>
	<Readout id="walls" order={2} label="Walls and things in the way" value={wallText}>
		<Label
			anchor="start"
			x={LX}
			y={194}
			text="walls and things in the way: {wallText}"
			size={12}
			muted
		/>
	</Readout>
	{#if showLadder}
		<Readout id="ladder-title" order={3} label="Way of sending" value={rungText}>
			<Label
				anchor="start"
				x={LX}
				y={LY - ladderRows.length * RUNG - 10}
				text="ways of sending, {band} GHz"
				size={12}
				muted
			/>
		</Readout>
		{#each ladderRows as row (row.i)}
			<rect
				x={LX}
				y={row.y}
				width={row.w}
				height={row.h}
				rx="3"
				fill={row.lit ? 'var(--ww-signal)' : 'none'}
				fill-opacity={row.current ? 0.9 : row.lit ? 0.35 : 0}
				stroke={row.current ? 'var(--ww-signal-edge)' : 'var(--stage-line)'}
				stroke-width={row.current ? 2 : 1}
			/>
			<Readout id="rung-{row.i}">
				<text
					x={LX + row.w + 8}
					y={row.y + row.h / 2 + 4}
					font-size="12"
					fill={row.current ? 'var(--stage-ink)' : 'var(--stage-ink-muted)'}
					font-weight={row.current ? 700 : 400}>{fmt(row.mbit)}</text
				>
			</Readout>
		{/each}
		<Readout id="ladder-foot">
			<Label
				anchor="start"
				x={LX}
				y={LY + 16}
				text="fastest at the top, sturdiest at the bottom"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<!-- Wi-Fi and the line out of the house -->
		<Readout id="wifi-link" order={3} label="Wi-Fi link" value="{fmt(now.yours)} Mbit/s">
			<Label anchor="start" x={LX} y={262} text="Wi-Fi link: {fmt(now.yours)} Mbit/s" size={14} />
		</Readout>
		<Readout id="line" order={4} label="Line into the house" value="{lineMbit} Mbit/s">
			<Label
				anchor="start"
				x={LX}
				y={292}
				text="line into the house: {lineMbit} Mbit/s"
				size={14}
			/>
		</Readout>
		<Readout id="download" order={5} label="A download gets" value="{fmt(download)} Mbit/s">
			<Label
				anchor="start"
				x={LX}
				y={336}
				text="a download gets: {fmt(download)} Mbit/s"
				size={16}
				weight={700}
			/>
			<Label
				anchor="start"
				x={LX}
				y={358}
				text={download < now.yours ? 'the line is the slower part' : 'the Wi-Fi is the slower part'}
				size={12}
				muted
			/>
		</Readout>
	{/if}
	{#if phase === 'neighbour'}
		<Readout id="turns" order={4} label="Sharing the air" value={turnText}>
			<Label anchor="start" x={LX} y={214} text={turnText} size={12} weight={600} />
		</Readout>
		{#if turns}
			<Readout
				id="on-air"
				order={5}
				label="On the air now"
				value={ourTurn ? 'our router' : 'next door’s router'}
				color={ourTurn ? 'var(--ww-data)' : 'var(--ww-neighbour)'}
			>
				<Label
					anchor="start"
					x={LX}
					y={530}
					text={ourTurn ? 'on the air: ours' : 'on the air: next door’s'}
					size={12}
					weight={600}
					color={ourTurn ? 'var(--ww-data)' : 'var(--ww-neighbour)'}
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the line out of the house -->
	{#if phase === 'internet'}
		<g>
			<line
				x1={r0.x}
				y1={r0.y - 10}
				x2={r0.x}
				y2={70}
				stroke="var(--ww-line)"
				stroke-width={2 + Math.log10(lineMbit) * 2}
				stroke-linecap="round"
			/>
			<Readout id="to-street">
				<Label
					anchor="start"
					x={r0.x + 14}
					y={84}
					text="line to the street and the internet"
					size={12}
					muted
				/>
			</Readout>
		</g>
	{/if}
</g>
