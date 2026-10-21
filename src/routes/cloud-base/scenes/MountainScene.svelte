<script lang="ts">
	/**
	 * A 2,000 m mountain seen from the side, with the wind blowing from the left. The reader blows a
	 * bubble of air over it (drag, or the slider): the model (`overMountain`) gives its temperature,
	 * humidity and the water it has lost as rain at every point. On the windy side the bubble turns
	 * white where its vapour starts to condense, and the slope above has a cloud and rain; on the far
	 * side it sinks, warming. The far-side step carries it down from the top by itself and compares
	 * where it set off with where it arrived.
	 */
	import { Flow, Label, cycle, hash, smoothstep, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MOUNTAIN, groundHeight, overMountain } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'mountain'));
	const far = $derived(phase === 'far');

	// ---- the scale -----------------------------------------------------------------------------------
	const GROUND = 528;
	const S = 0.15;
	const X0 = 60;
	const W = 840;
	const X = (u: number) => X0 + u * W;
	const Yg = (u: number) => GROUND - groundHeight(u) * S;
	/** Unit normal to the ground at u, pointing up into the air. */
	function normal(u: number) {
		const du = 0.002;
		const dx = W * 2 * du;
		const dy = Yg(u + du) - Yg(u - du);
		const n = Math.hypot(dx, dy);
		return { x: dy / n, y: -dx / n };
	}
	const fmt = (v: number) => v.toLocaleString('en-GB');

	const trip = overMountain();
	const start = trip.at(0);

	// ---- where the bubble is -----------------------------------------------------------------------
	const along = $derived(Math.max(0, Math.min(100, Number(params.along ?? 0))) / 100);
	/** On the far-side step it sinks from the top to the far plain by itself. */
	const u = $derived(far ? (reduced ? 1 : 0.5 + 0.5 * smoothstep(0.4, 4.5, t)) : along);
	const b = $derived(trip.at(u));
	const R0 = 28;
	const R = $derived(R0 * Math.cbrt(b.swell));
	const n = $derived(normal(u));
	const BX = $derived(X(u) + n.x * (R + 6));
	const BY = $derived(Yg(u) + n.y * (R + 6));
	const inCloud = $derived(
		u <= 0.5 && b.rh > 0.995 && trip.cloudFrom !== null && u >= trip.cloudFrom
	);
	const white = $derived(inCloud ? 1 : 0);
	const temp = $derived(Math.round(b.t));
	const lost = $derived(Math.round((100 * b.rained) / start.vapour));

	function setAlong(v: number) {
		setParam('along', Math.round(Math.max(0, Math.min(1, v)) * 100));
	}
	function drag(e: PointerEvent) {
		startDrag(e, (p) => setAlong((p.x - X0) / W));
	}
	function key(e: KeyboardEvent) {
		const big = e.shiftKey ? 0.1 : 0.01;
		const d: Record<string, number> = {
			ArrowUp: big,
			ArrowRight: big,
			ArrowDown: -big,
			ArrowLeft: -big,
			PageUp: 0.1,
			PageDown: -0.1
		};
		if (e.key === 'Home') setAlong(0);
		else if (e.key === 'End') setAlong(1);
		else if (d[e.key] !== undefined) setAlong(along + d[e.key]);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// ---- the mountain ------------------------------------------------------------------------------
	const groundPath = (() => {
		const pts = [];
		for (let i = 0; i <= 200; i++) pts.push(`${X(i / 200).toFixed(1)} ${Yg(i / 200).toFixed(1)}`);
		return `M0 600 L0 ${GROUND} L${pts.join(' L')} L960 ${GROUND} L960 600 Z`;
	})();

	// ---- the cloud on the windy slope, and its rain --------------------------------------------------
	/** How far the cloud reaches out from the slope, px, at `f` from its bottom (0) to the top (1). */
	const thickness = (f: number) =>
		(26 + 60 * Math.sin(Math.min(1, f * 1.15) * Math.PI * 0.62)) *
		(1 - 0.6 * smoothstep(0.8, 1, f));
	const cloud = (() => {
		if (trip.cloudFrom === null) return null;
		const from = trip.cloudFrom;
		const to = 0.53;
		const N = 40;
		const inner = [];
		const outer = [];
		for (let i = 0; i <= N; i++) {
			const uu = from + ((to - from) * i) / N;
			const nn = normal(uu);
			const off = thickness(i / N);
			inner.push(`${(X(uu) - nn.x * 6).toFixed(1)} ${(Yg(uu) - nn.y * 6).toFixed(1)}`);
			outer.push({ x: X(uu) + nn.x * off, y: Yg(uu) + nn.y * off });
		}
		const body = `M${inner.join(' L')} L${outer
			.reverse()
			.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' L')} Z`;
		const puffs = [];
		for (let i = 0; i < 11; i++) {
			const f = (i + 0.5) / 11;
			const uu = from + (to - from) * f;
			const nn = normal(uu);
			const off = thickness(f) - 12;
			puffs.push({
				i,
				x: X(uu) + nn.x * off,
				y: Yg(uu) + nn.y * off,
				r: 18 + hash(i, 4) * 12 + 10 * Math.min(1, f * 2)
			});
		}
		return { body, puffs };
	})();
	/** Rain falls from the upper part of the cloud, where its droplets have had time to grow. */
	const rainFrom = $derived(trip.cloudFrom === null ? 1 : trip.cloudFrom + 0.05);
	const rainStreaks = Array.from({ length: 26 }, (_, i) => ({
		i,
		f: hash(i, 51),
		o: hash(i, 52),
		d: hash(i, 53)
	}));
	const rain = $derived.by(() => {
		if (trip.cloudFrom === null) return [];
		return rainStreaks.map((s) => {
			const uu = rainFrom + (0.47 - rainFrom) * s.f;
			const nn = normal(uu);
			const off = 18 + s.d * (thickness((uu - trip.cloudFrom!) / (0.53 - trip.cloudFrom!)) - 30);
			const x = X(uu) + nn.x * off;
			const top = Yg(uu) + nn.y * off;
			const ground = Yg((x - X0) / W);
			const fall = Math.max(10, ground - top - 12);
			const p = cycle(t, 0.7, s.o);
			return {
				i: s.i,
				x,
				y: top + p * fall,
				o: smoothstep(0, 0.12, p) * (1 - smoothstep(0.85, 1, p))
			};
		});
	});

	// ---- readouts ------------------------------------------------------------------------------------
	const headline = $derived.by(() => {
		if (u < 0.12)
			return u === 0 ? 'on the plain, with the wind behind it' : 'blown towards the mountain';
		if (u <= 0.5) {
			if (!inCloud) return 'pushed up the slope: it swells and cools';
			return u > rainFrom
				? 'inside the cloud: its water falls as rain'
				: 'it turns white: a cloud forms';
		}
		if (u < 0.88) return 'going down: squeezed, it warms up';
		return 'on the far plain: warmer and drier';
	});
	const height = $derived(Math.round(groundHeight(u) / 10) * 10);
	const sub = $derived(
		`${height === 0 ? 'on the plain' : `${fmt(height)} m up`} · ${temp} °C · humidity ${Math.round(b.rh * 100)} %`
	);
	const water = $derived(
		lost === 0 ? 'it still has all its water' : `it has lost ${lost} % of its water as rain`
	);
	const end = trip.end;
</script>

<g class="cld-mountain">
	<defs>
		<linearGradient id="cloud-base-msky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--cld-sky-top)" />
			<stop offset="1" stop-color="var(--cld-sky-low)" />
		</linearGradient>
	</defs>
	<rect x="0" y="0" width="960" height="600" fill="url(#cloud-base-msky)" />

	<!-- the mountain and the plains -->
	<path d={groundPath} fill="var(--cld-rock)" stroke="var(--cld-rock-edge)" stroke-width="2" />
	<rect x="0" y={GROUND} width="960" height={600 - GROUND} fill="var(--cld-ground)" />
	<line x1="0" y1={GROUND} x2="960" y2={GROUND} stroke="var(--cld-ground-edge)" stroke-width="2" />
	<Readout id="cld-peak">
		<Label
			x={X(0.5)}
			y={Yg(0.5) + 48}
			text="{fmt(MOUNTAIN.height)} m"
			anchor="middle"
			size={14}
			muted
		/>
	</Readout>

	<!-- the wind -->
	{#each [330, 380] as y, i (y)}
		<Flow
			d="M{30 + i * 20} {y} L{150 + i * 20} {y}"
			color="var(--stage-ink-muted)"
			width={3}
			arrow
			dash={14}
			t={reduced ? 0 : t}
			speed={30}
		/>
	{/each}
	<Readout id="cld-wind">
		<Label x={40} y={314} text="wind" anchor="start" size={15} weight={600} />
	</Readout>

	<!-- the cloud on the windy slope, and its rain -->
	{#if cloud}
		<path d={cloud.body} fill="var(--cld-cloud)" opacity="0.94" />
		{#each cloud.puffs as p (p.i)}
			<circle cx={p.x} cy={p.y} r={p.r} fill="var(--cld-cloud)" opacity="0.94" />
		{/each}
	{/if}
	{#each rain as r (r.i)}
		<line
			x1={r.x}
			y1={r.y}
			x2={r.x - 2}
			y2={r.y + 12}
			stroke="var(--cld-rain)"
			stroke-width="2.5"
			stroke-linecap="round"
			opacity={r.o}
		/>
	{/each}
	{#if trip.cloudFrom !== null}
		<Readout id="cld-rainside">
			<Label
				x={X(trip.cloudFrom) - 70}
				y={Yg(trip.cloudFrom) + 4}
				text="rain on this side"
				anchor="end"
				size={15}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- the warm dry wind down the far side -->
	{#if far}
		<Flow
			d="M{X(0.56) + 30} {Yg(0.56) - 20} L{X(0.74) + 30} {Yg(0.74) - 20}"
			color="var(--cld-hot)"
			width={3}
			arrow
			dash={14}
			t={reduced ? 0 : t}
			speed={30}
		/>
		<Readout id="cld-foehn">
			<Label
				x={X(0.66) + 52}
				y={Yg(0.66) - 30}
				text="warm, dry wind"
				anchor="start"
				size={15}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- the bubble -->
	<circle
		cx={BX}
		cy={BY}
		r={R}
		fill="var(--cld-warm)"
		fill-opacity={0.3 * (1 - white)}
		stroke="var(--cld-warm)"
		stroke-width="2.5"
		stroke-opacity={1 - white}
	/>
	{#if inCloud}
		<circle
			cx={BX}
			cy={BY}
			r={R}
			fill="var(--cld-cloud)"
			stroke="var(--cld-cloud-edge)"
			stroke-width="2"
		/>
	{/if}
	<Readout id="cld-mtemp">
		<Label x={BX} y={BY - R - 12} text="{temp} °C" anchor="middle" size={20} weight={700} tabular />
	</Readout>
	{#if !far}
		<circle
			class="cld-drag"
			cx={BX}
			cy={BY}
			r={R + 8}
			fill="transparent"
			stroke="var(--focus)"
			stroke-width="1.5"
			stroke-dasharray="5 5"
			role="slider"
			tabindex="0"
			aria-label="Bubble of air"
			aria-valuenow={Math.round(along * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuetext={sub}
			onpointerdown={drag}
			onkeydown={key}
		/>
	{/if}

	<!-- start and end, compared -->
	{#if far}
		{#each [{ k: 'start', x: 30, s: start, title: 'set off' }, { k: 'end', x: 740, s: end, title: 'arrived' }] as c (c.k)}
			<g opacity={c.k === 'start' ? 1 : reduced ? 1 : smoothstep(3.6, 4.6, t)}>
				<rect
					x={c.x}
					y="190"
					width="190"
					height="80"
					rx="10"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				<Readout
					id="cld-card-{c.k}"
					order={c.k === 'start' ? 6 : 7}
					label={c.title === 'set off' ? 'Set off' : 'Arrived'}
					value="{Math.round(c.s.t)} °C, humidity {Math.round(c.s.rh * 100)} %"
				>
					<Label
						x={c.x + 16}
						y={218}
						text={c.title}
						anchor="start"
						size={15}
						weight={700}
						halo={false}
					/>
					<Label
						x={c.x + 16}
						y={248}
						text="{Math.round(c.s.t)} °C · humidity {Math.round(c.s.rh * 100)} %"
						anchor="start"
						size={15}
						halo={false}
						tabular
					/>
				</Readout>
			</g>
		{/each}
	{/if}

	<!-- readouts -->
	<Readout id="cld-mhead" order={1} label="Now" value={headline}>
		<Label x={480} y={42} text={headline} anchor="middle" size={19} weight={700} />
	</Readout>
	<Readout id="cld-msub" order={3} label="Where" value={sub}>
		<Label x={480} y={68} text={sub} anchor="middle" size={15} muted tabular />
	</Readout>
	<Readout id="cld-water" order={4} label="Water" value={water}>
		<Label x={480} y={92} text={water} anchor="middle" size={15} muted />
	</Readout>
</g>

<style>
	.cld-drag {
		cursor: ew-resize;
		touch-action: none;
		outline: none;
	}
	.cld-drag:focus-visible {
		stroke-width: 3;
	}
</style>
