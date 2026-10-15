<script lang="ts">
	/**
	 * One fission, nucleon by nucleon: a slow neutron drifts into uranium-235,
	 * the uranium-236 it makes wobbles, stretches into a dumbbell and splits
	 * into two fragments and two or three free neutrons, with a flash for the
	 * energy released. The split follows the `split` control (AME2020 masses);
	 * "Fire a neutron" (or a new split) replays it from the start.
	 *
	 * Every nucleon is drawn (236 of them), as one path per colour. Each ball
	 * keeps its colour throughout: the balls that end in each fragment are
	 * chosen first, and the right number of them are protons. The flat discs are
	 * a picture, not a scale model (real nuclei are balls whose radius grows as
	 * A^(1/3), which the disc sizes follow).
	 *
	 * Replays start from zero at the current `t` (the same documented exception
	 * as the radioactivity grid's "Run again"). Under reduced motion the frame
	 * is the finished split, with the neutron's path and the old nucleus dashed.
	 */
	import { Label, TAU, clamp, lerp, rng, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { nuclides } from '../ame2020';
	import { promptQ, splitById } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const split = $derived(splitById(String(params.split ?? 'bakr')));
	const runKey = $derived(`${String(params.fire ?? 0)}|${split.id}`);

	let startedAt = 0;
	let startedFor = '';
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (runKey !== startedFor || t < lastT) {
			startedAt = startedFor === '' || t < lastT ? 0 : t;
			startedFor = runKey;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});
	/** Seconds into the story; reduced motion shows the finished split. */
	const s = $derived(reduced ? 20 : tRun);

	// Phases, in seconds.
	const T_HIT = 1.6;
	const T_WOBBLE = 1.8;
	const T_NECK = 3.4;
	const T_SPLIT = 4.2;

	const NAMES: Record<string, string> = {
		Kr: 'krypton',
		Ba: 'barium',
		Xe: 'xenon',
		Sr: 'strontium',
		Cs: 'caesium',
		Rb: 'rubidium'
	};

	const CX = 470;
	const CY = 300;
	const R_U = 92;
	const radius = (a: number) => R_U * Math.cbrt(a / 236);

	const deg = Math.PI / 180;
	/** Directions of the freed neutrons, for 2 and for 3 (up and down, clear of the fragments). */
	const FREE_ANGLES = [
		[-90 * deg, 90 * deg],
		[-60 * deg, -120 * deg, 90 * deg]
	];

	const GOLDEN = Math.PI * (3 - Math.sqrt(5));
	function packing(n: number, outer: number) {
		const r = outer / Math.sqrt(n);
		return Array.from({ length: n }, (_, i) => {
			const rho = r * Math.sqrt(i + 0.5);
			return { x: rho * Math.cos(i * GOLDEN), y: rho * Math.sin(i * GOLDEN) };
		});
	}
	const BALL = (R_U / Math.sqrt(236)) * 0.62;

	interface Ball {
		x0: number;
		y0: number;
		/** Offset within its fragment (or 0 for a free neutron). */
		dx: number;
		dy: number;
		group: 'light' | 'heavy' | 'free';
		/** Free neutrons: their direction of flight. */
		angle: number;
		proton: boolean;
	}

	const layout = $derived.by(() => {
		const L = nuclides[split.light];
		const H = nuclides[split.heavy];
		const blob = packing(236, R_U - BALL);
		// Sort the balls left to right: the heavy fragment goes left, the light right,
		// the free neutrons come from the middle (the neck).
		const order = blob.map((_, i) => i).sort((a, b) => blob[a].x - blob[b].x);
		const nFree = split.neutrons;
		const heavyIdx = order.slice(0, H.A);
		const freeIdx = order.slice(H.A, H.A + nFree);
		const lightIdx = order.slice(H.A + nFree);
		const random = rng(7 + nFree * 31 + L.A);
		const pick = (idx: number[], z: number) => {
			const shuffled = idx.slice();
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
			return new Set(shuffled.slice(0, z));
		};
		const protons = new Set([...pick(heavyIdx, H.Z), ...pick(lightIdx, L.Z)]);
		const rH = radius(H.A);
		const rL = radius(L.A);
		const target = (idx: number[], r: number) => {
			const p = packing(idx.length, r - BALL);
			// Match by angle around the centre so balls do not cross much.
			const byAngle = (pts: { x: number; y: number }[], ids: number[]) =>
				ids.slice().sort((a, b) => Math.atan2(pts[a].y, pts[a].x) - Math.atan2(pts[b].y, pts[b].x));
			const src = byAngle(
				blob,
				idx.map((i) => i)
			);
			const dst = byAngle(
				p,
				p.map((_, i) => i)
			);
			const out: Record<number, { x: number; y: number }> = {};
			src.forEach((b, k) => (out[b] = p[dst[k]]));
			return out;
		};
		const tH = target(heavyIdx, rH);
		const tL = target(lightIdx, rL);
		const balls: Ball[] = blob.map((b, i) => {
			const group = i in tH ? 'heavy' : i in tL ? 'light' : 'free';
			const off = tH[i] ?? tL[i] ?? { x: 0, y: 0 };
			const fi = freeIdx.indexOf(i);
			return {
				x0: b.x,
				y0: b.y,
				dx: off.x,
				dy: off.y,
				group,
				angle: group === 'free' ? FREE_ANGLES[nFree === 2 ? 0 : 1][fi] : 0,
				proton: protons.has(i)
			};
		});
		// The incoming neutron is the ball nearest the left edge of the neck; it is drawn
		// arriving from outside until it is absorbed.
		const incoming = freeIdx[0];
		return { balls, rH, rL, L, H, incoming };
	});

	// Fragment centres after the split: they fly apart and stop within the fuel.
	const apart = $derived(smoothstep(T_NECK, T_SPLIT, s));
	const fly = $derived(s > T_SPLIT ? 1 - Math.exp(-(s - T_SPLIT) / 0.45) : 0);
	const heavyC = $derived({
		x: CX - lerp(layout.rH * 0.9, 270, fly) - apart * 8,
		y: CY + fly * 10
	});
	const lightC = $derived({
		x: CX + lerp(layout.rL * 0.9, 250, fly) + apart * 8,
		y: CY - fly * 10
	});

	// Wobble of the compound nucleus: a growing oscillation, then a stretch.
	const wob = $derived.by(() => {
		if (s < T_WOBBLE) return { sx: 1, sy: 1 };
		if (s > T_NECK) return { sx: 1.12, sy: 1 - 0.12 * 0.6 };
		const u = (s - T_WOBBLE) / (T_NECK - T_WOBBLE);
		// three whole swings, so the stretch carries on smoothly into the neck
		const a = 0.1 * u * Math.sin(TAU * u * 3) + 0.12 * u * u;
		return { sx: 1 + a, sy: 1 - a * 0.6 };
	});

	const circle = (x: number, y: number, r: number) =>
		`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

	const FREE_SPEED = 260; // px per second, the free neutrons
	/** They leave the picture's centre and are shown parked at this distance, arrowed. */
	const FREE_STOP = 130;
	const paths = $derived.by(() => {
		let p = '';
		let n = '';
		let free = '';
		for (let i = 0; i < layout.balls.length; i++) {
			const b = layout.balls[i];
			if (i === layout.incoming && s < T_HIT) continue;
			let x: number;
			let y: number;
			if (b.group === 'free') {
				const bx = CX + b.x0 * wob.sx;
				const by = CY + b.y0 * wob.sy;
				if (s <= T_SPLIT) {
					x = bx;
					y = by;
				} else {
					const d = Math.min(FREE_STOP, (s - T_SPLIT) * FREE_SPEED);
					x = CX + Math.cos(b.angle) * d;
					y = CY + Math.sin(b.angle) * d;
					free += circle(x, y, BALL * 1.4);
					continue;
				}
			} else {
				const c = b.group === 'heavy' ? heavyC : lightC;
				const blobX = CX + b.x0 * wob.sx;
				const blobY = CY + b.y0 * wob.sy;
				x = lerp(blobX, c.x + b.dx, apart);
				y = lerp(blobY, c.y + b.dy, apart);
			}
			if (b.proton) p += circle(x, y, BALL);
			else n += circle(x, y, BALL);
		}
		return { p, n, free };
	});

	// The incoming neutron.
	const START = { x: 110, y: 130 };
	const HIT = { x: CX - R_U * 0.7, y: CY - R_U * 0.7 };
	const inU = $derived(clamp(s / T_HIT));
	const inPos = $derived({ x: lerp(START.x, HIT.x, inU), y: lerp(START.y, HIT.y, inU) });

	// Energy flash at the split.
	const flash = $derived(s > T_SPLIT ? clamp((s - T_SPLIT) / 1.2) : 0);
	const flashOn = $derived(!reduced && flash > 0 && flash < 1);

	const name = (key: { element: string; A: number }) =>
		`${NAMES[key.element] ?? key.element}-${key.A}`;
	const q = $derived(promptQ(split));

	const stage = $derived(
		s < T_HIT
			? 'A slow neutron drifts towards uranium-235'
			: s < T_WOBBLE
				? 'Absorbed: uranium-236'
				: s < T_NECK
					? 'Uranium-236 wobbles with the energy it gained'
					: s < T_SPLIT
						? 'It stretches into a dumbbell…'
						: '… and splits'
	);
	const after = $derived(s > T_SPLIT + 0.3);
	const labelsIn = $derived(reduced ? 1 : smoothstep(T_SPLIT + 0.3, T_SPLIT + 1.1, s));
</script>

<g>
	<!-- equation along the top -->
	<Readout
		id="equation"
		order={1}
		label="The split"
		value="U-235 + n → {layout.H.element}-{layout.H.A} + {layout.L.element}-{layout.L
			.A} + {split.neutrons} n"
	>
		<text x={480} y={56} text-anchor="middle" style:font-size="18px" font-weight="600">
			uranium-235 + n → {name(layout.H)} + {name(layout.L)} + {split.neutrons} n
		</text>
	</Readout>
	<Readout id="stage" order={2} label="Now" value={after ? 'Split' : stage}>
		<text x={480} y={84} text-anchor="middle" class="muted">{after ? ' ' : stage}</text>
	</Readout>

	{#if reduced}
		<!-- where it was, and the neutron's path -->
		<circle
			cx={CX}
			cy={CY}
			r={R_U}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 5"
			opacity="0.6"
		/>
		<line
			x1={START.x}
			y1={START.y}
			x2={HIT.x}
			y2={HIT.y}
			stroke="var(--nf-slow)"
			stroke-width="1.5"
			stroke-dasharray="3 5"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="was">
			<Label x={CX} y={CY + 4} text="uranium-235 + slow neutron" muted />
		</Readout>
	{/if}

	{#if flashOn}
		<circle
			cx={CX}
			cy={CY}
			r={30 + flash * 330}
			fill="none"
			stroke="var(--nf-flash)"
			stroke-width={6 * (1 - flash)}
			opacity={1 - flash}
		/>
		<circle
			cx={CX}
			cy={CY}
			r={40 * (1 - flash)}
			fill="var(--nf-flash)"
			opacity={0.6 * (1 - flash)}
		/>
	{/if}

	<!-- the nucleons -->
	<path d={paths.n} fill="var(--nf-neutron)" />
	<path d={paths.p} fill="var(--nf-proton)" />
	<path d={paths.free} fill="var(--nf-fast)" />
	{#if s > T_SPLIT + 0.6}
		{#each FREE_ANGLES[split.neutrons === 2 ? 0 : 1] as a, i (i)}
			<line
				x1={CX + Math.cos(a) * (FREE_STOP + 10)}
				y1={CY + Math.sin(a) * (FREE_STOP + 10)}
				x2={CX + Math.cos(a) * (FREE_STOP + 34)}
				y2={CY + Math.sin(a) * (FREE_STOP + 34)}
				stroke="var(--nf-fast)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
				opacity={labelsIn}
			/>
		{/each}
		<Readout id="free" order={5} label="Freed" value="{split.neutrons} fast neutrons">
			<Label
				x={CX + 26}
				y={CY + FREE_STOP + 4}
				text="{split.neutrons} fast neutrons, free to split more nuclei"
				anchor="start"
				color="var(--nf-fast)"
				opacity={labelsIn}
			/>
		</Readout>
	{/if}

	{#if s < T_HIT && !reduced}
		<circle cx={inPos.x} cy={inPos.y} r={BALL * 1.15} fill="var(--nf-slow)" />
		<Label x={inPos.x} y={inPos.y - 16} text="slow neutron" color="var(--nf-slow)" />
	{/if}
	{#if s < T_NECK && !reduced}
		<Readout id="u-label">
			<Label
				x={CX}
				y={CY + R_U + 26}
				text={s < T_HIT ? 'uranium-235 · 92 protons, 143 neutrons' : 'uranium-236'}
			/>
		</Readout>
	{/if}

	{#if labelsIn > 0}
		<g opacity={labelsIn}>
			<Readout
				id="heavy"
				order={3}
				label="Heavy fragment"
				value="{name(layout.H)} · {layout.H.Z} p, {layout.H.A - layout.H.Z} n"
			>
				<Label x={heavyC.x} y={heavyC.y + layout.rH + 24} text={name(layout.H)} />
				<Label
					x={heavyC.x}
					y={heavyC.y + layout.rH + 42}
					text="{layout.H.Z} protons, {layout.H.A - layout.H.Z} neutrons"
					muted
				/>
			</Readout>
			<Readout
				id="light"
				order={4}
				label="Light fragment"
				value="{name(layout.L)} · {layout.L.Z} p, {layout.L.A - layout.L.Z} n"
			>
				<Label x={lightC.x} y={lightC.y + layout.rL + 24} text={name(layout.L)} />
				<Label
					x={lightC.x}
					y={lightC.y + layout.rL + 42}
					text="{layout.L.Z} protons, {layout.L.A - layout.L.Z} neutrons"
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- energy card -->
	<g opacity={labelsIn}>
		<Readout
			id="energy"
			order={6}
			label="Released at once"
			value="{q.toFixed(1)} MeV"
			note="the fragments' speed, {split.neutrons} fast neutrons, gamma rays"
			opacity={labelsIn}
		>
			<rect
				x={300}
				y={492}
				width={360}
				height={82}
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<text x={480} y={518} text-anchor="middle" class="muted">released at once</text>
			<text
				x={480}
				y={546}
				text-anchor="middle"
				style:font-size="22px"
				font-weight="700"
				style:fill="var(--nf-energy)">{q.toFixed(1)} MeV</text
			>
			<text x={480} y={562} text-anchor="middle" class="muted" style:font-size="11px"
				>the fragments' speed, {split.neutrons} fast neutrons, gamma rays</text
			>
		</Readout>
	</g>

	<!-- key -->
	<Readout id="key-p" label="proton" color="var(--nf-proton)" />
	<Readout id="key-n" label="neutron" color="var(--nf-neutron)" />
	<Readout id="key-f" label="fast neutron" color="var(--nf-fast)" />
	<Readout id="key-svg">
		<g style:font-size="12px">
			<circle cx={40} cy={560} r="5" fill="var(--nf-proton)" />
			<text x={50} y={564}>proton</text>
			<circle cx={110} cy={560} r="5" fill="var(--nf-neutron)" />
			<text x={120} y={564}>neutron</text>
			<circle cx={186} cy={560} r="5" fill="var(--nf-fast)" />
			<text x={196} y={564}>freed neutron</text>
		</g>
	</Readout>
</g>
