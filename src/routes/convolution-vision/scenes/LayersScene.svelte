<script lang="ts">
	/**
	 * Inside the trained network, on the chosen digit.
	 *
	 * mode 'l1'    the 8 learned 5 × 5 filters of the first layer and their feature maps (before
	 *              the ReLU, one colour scale for all 8); the selected one large with its weights.
	 * mode 'pool'  one first-layer map through the ReLU and the 2 × 2 max pooling; a 2 × 2 block
	 *              and the pooled pixel it becomes, moving over the digit (pure function of t);
	 *              then all 8 pooled maps.
	 * mode 'l2'    the 16 second-layer maps (after the ReLU); for the selected filter, its map,
	 *              the window of the digit seen by its strongest unit, its 200 weights (one 5 × 5
	 *              slice per first-layer map), and the six test-digit patches that excite it most.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C1, C2, K, P1, SIDE, decodeBytes, forward } from '../cnn';
	import { PARTS } from '../mnist-cnn';
	import Txt from './Txt.svelte';
	import { WT, fmt, greyUrl, inputOf, maxAbs, signedUrl } from './shared';

	let { step, t, params, reduced, dark, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'l1'));
	const input = $derived(inputOf(params));
	const act = $derived(forward(WT, input.img));
	const inUrl = $derived(greyUrl(input.img, SIDE, SIDE, dark));
	const pick = (v: unknown, n: number) => {
		const i = Math.round(Number(v)) - 1;
		return Number.isFinite(i) ? Math.max(0, Math.min(n - 1, i)) : 0;
	};
	const s1 = $derived(pick(params.f1, C1));
	const s2 = $derived(pick(params.f2, C2));

	const M1 = SIDE * SIDE;
	const M2 = P1 * P1;
	// ---- first layer ------------------------------------------------------------------------
	const kScale = $derived(maxAbs(WT.c1w));
	const kernels = $derived(
		Array.from({ length: C1 }, (_, c) => signedUrl(WT.c1w, K, K, kScale, dark, c * K * K))
	);
	const scale1 = $derived(maxAbs(act.conv1) || 1);
	const maps1 = $derived(
		mode === 'l1'
			? Array.from({ length: C1 }, (_, c) => signedUrl(act.conv1, SIDE, SIDE, scale1, dark, c * M1))
			: []
	);
	const sel = $derived(Array.from(WT.c1w.slice(s1 * K * K, (s1 + 1) * K * K)));

	// ---- pooling ----------------------------------------------------------------------------
	const r1Scale = $derived(maxAbs(act.relu1) || 1);
	const poolUrls = $derived.by(() => {
		if (mode !== 'pool') return null;
		const o = s1 * M1;
		return {
			conv: signedUrl(act.conv1, SIDE, SIDE, scale1, dark, o),
			relu: signedUrl(act.relu1, SIDE, SIDE, r1Scale, dark, o),
			pool: signedUrl(act.pool1, P1, P1, r1Scale, dark, s1 * M2),
			all: Array.from({ length: C1 }, (_, c) =>
				signedUrl(act.pool1, P1, P1, maxAbs(act.pool1) || 1, dark, c * M2)
			)
		};
	});
	/** 2 × 2 blocks where this map has something, to visit one after the other. */
	const blocks = $derived.by(() => {
		const list: { bx: number; by: number }[] = [];
		for (let by = 0; by < P1; by++)
			for (let bx = 0; bx < P1; bx++)
				if (act.pool1[s1 * M2 + by * P1 + bx] > 0.25 * r1Scale) list.push({ bx, by });
		const picked = list.filter((_, i) => i % 4 === 0);
		return picked.length ? picked : [{ bx: 7, by: 7 }];
	});
	const block = $derived(blocks[Math.floor((reduced ? 0 : t) / 2) % blocks.length]);
	const blockVals = $derived.by(() => {
		const o = s1 * M1;
		const { bx, by } = block;
		const i = o + 2 * by * SIDE + 2 * bx;
		return [act.relu1[i], act.relu1[i + 1], act.relu1[i + SIDE], act.relu1[i + SIDE + 1]];
	});

	// ---- second layer -----------------------------------------------------------------------
	const scale2 = $derived(maxAbs(act.relu2) || 1);
	const maps2 = $derived(
		mode === 'l2'
			? Array.from({ length: C2 }, (_, c) => signedUrl(act.relu2, P1, P1, scale2, dark, c * M2))
			: []
	);
	const slices = $derived.by(() => {
		if (mode !== 'l2') return [];
		const o = s2 * C1 * K * K;
		const sc = maxAbs(WT.c2w, o, o + C1 * K * K) || 1;
		return Array.from({ length: C1 }, (_, ci) =>
			signedUrl(WT.c2w, K, K, sc, dark, o + ci * K * K)
		);
	});
	/** The strongest unit of the selected filter on this digit, and the window it sees. */
	const best = $derived.by(() => {
		let b = 0;
		for (let p = 1; p < M2; p++) if (act.relu2[s2 * M2 + p] > act.relu2[s2 * M2 + b]) b = p;
		const v = act.relu2[s2 * M2 + b];
		return { y: Math.floor(b / P1), x: b % P1, v };
	});
	const RF = 14;
	const parts = $derived(
		mode === 'l2'
			? PARTS[s2].map((p) => ({
					key: p.index,
					index: p.index,
					value: p.value,
					url: greyUrl(
						Array.from(decodeBytes(p.pixels), (v) => v / 255),
						RF,
						RF,
						dark
					)
				}))
			: []
	);

	const caption = $derived(
		input.empty
			? 'nothing drawn yet'
			: input.label === null
				? 'your drawing'
				: `a handwritten ${input.label} (MNIST test set)`
	);
	// first-layer grid geometry
	const G1 = { x: 300, y: 92, w: 157, h: 172 };
	const cell1 = (c: number) => ({ x: G1.x + (c % 4) * G1.w, y: G1.y + Math.floor(c / 4) * G1.h });
</script>

<g>
	{#if mode === 'l1'}
		<Readout id="ly-in" order={1} label="Input" value={caption}>
			<Txt x={40} y={74} text="input" size={14} weight={600} />
			<Txt x={40} y={292} text={caption} size={11} muted />
		</Readout>
		<rect x={39} y={83} width={198} height={198} fill="none" stroke="var(--border)" />
		<image href={inUrl} x={40} y={84} width={196} height={196} class="cv-px" />

		<Readout id="ly-sel" order={2} label="Filter {s1 + 1}" value="5 × 5 weights + a bias of {fmt(WT.c1b[s1])}">
			<Txt x={40} y={336} text="filter {s1 + 1}: its 25 weights" size={13} weight={600} />
			<Txt x={40} y={548} text="+ bias {fmt(WT.c1b[s1])}" size={12} muted />
		</Readout>
		{#each sel as v, i (i)}
			<rect
				x={40 + (i % K) * 40}
				y={348 + Math.floor(i / K) * 36}
				width={40}
				height={36}
				fill={v >= 0 ? 'var(--cv-pos)' : 'var(--cv-neg)'}
				fill-opacity={0.1 + (0.75 * Math.abs(v)) / kScale}
				stroke="var(--stage-line)"
			/>
			<text
				x={60 + (i % K) * 40}
				y={371 + Math.floor(i / K) * 36}
				text-anchor="middle"
				style:font-size="11px"
				style:fill="var(--stage-ink)"
				style:pointer-events="none">{fmt(v, 1)}</text
			>
		{/each}

		<Txt x={G1.x} y={74} text="layer 1: 8 learnt filters and their feature maps" size={14} weight={600} />
		{#each kernels as url, c (c)}
			{@const p = cell1(c)}
			<g
				class="cv-pick"
				role="button"
				tabindex="0"
				aria-label="Show filter {c + 1}"
				aria-pressed={c === s1}
				onclick={() => setParam('f1', c + 1)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setParam('f1', c + 1);
					}
				}}
			>
				<rect
					x={p.x - 6}
					y={p.y - 6}
					width={G1.w - 4}
					height={114}
					rx="8"
					fill={c === s1 ? 'var(--surface)' : 'transparent'}
					stroke={c === s1 ? 'var(--cv-window)' : 'none'}
					stroke-width="2"
				/>
				<Txt x={p.x} y={p.y + 12} text="{c + 1}" size={13} weight={700} />
				<image href={url} x={p.x} y={p.y + 22} width={35} height={35} class="cv-px" />
				<rect x={p.x} y={p.y + 22} width={35} height={35} fill="none" stroke="var(--border)" />
				<image href={maps1[c]} x={p.x + 40} y={p.y} width={102} height={102} class="cv-px" />
				<rect
					x={p.x + 40}
					y={p.y}
					width={102}
					height={102}
					fill="none"
					stroke="var(--border)"
				/>
			</g>
		{/each}
		<Readout id="ly-key" order={3} label="Colours" value="blue: positive · orange: negative">
			<rect x={G1.x} y={448} width="12" height="12" fill="var(--cv-pos)" />
			<Txt x={G1.x + 18} y={458} text="positive weight or response" size={12} />
			<rect x={G1.x + 230} y={448} width="12" height="12" fill="var(--cv-neg)" />
			<Txt x={G1.x + 248} y={458} text="negative" size={12} />
			<Txt
				x={G1.x}
				y={484}
				text="small square: the filter's 5 × 5 weights · large: its map on the digit"
				size={12}
				muted
			/>
			<Txt x={G1.x} y={504} text="click a filter to see its weights" size={12} muted />
		</Readout>
	{:else if mode === 'pool' && poolUrls}
		{@const X = [40, 268, 496, 724]}
		{@const S = 196}
		{@const Y = 96}
		{#each ['input', `filter ${s1 + 1}`, 'ReLU: negatives → 0', 'max pool: 14 × 14'] as title, i (i)}
			<Txt x={X[i]} y={Y - 16} text={title} size={13} weight={600} />
			<rect x={X[i] - 1} y={Y - 1} width={S + 2} height={S + 2} fill="none" stroke="var(--border)" />
			{#if i < 3}
				<path
					d="M {X[i] + S + 6} {Y + S / 2} L {X[i + 1] - 8} {Y + S / 2}"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
			{/if}
		{/each}
		<image href={inUrl} x={X[0]} y={Y} width={S} height={S} class="cv-px" />
		<image href={poolUrls.conv} x={X[1]} y={Y} width={S} height={S} class="cv-px" />
		<image href={poolUrls.relu} x={X[2]} y={Y} width={S} height={S} class="cv-px" />
		<image href={poolUrls.pool} x={X[3]} y={Y} width={S} height={S} class="cv-px" />
		<!-- the block and the pooled pixel it becomes -->
		<rect
			x={X[2] + block.bx * 14}
			y={Y + block.by * 14}
			width="14"
			height="14"
			fill="none"
			stroke="var(--cv-window)"
			stroke-width="2.5"
		/>
		<rect
			x={X[3] + block.bx * 14}
			y={Y + block.by * 14}
			width="14"
			height="14"
			fill="none"
			stroke="var(--cv-window)"
			stroke-width="2.5"
		/>
		<Readout
			id="pl-block"
			order={2}
			label="One 2 × 2 block"
			value="{blockVals.map((v) => fmt(v)).join(', ')} → max {fmt(Math.max(...blockVals))}"
		>
			<Txt
				x={X[2]}
				y={Y + S + 26}
				text="block: {blockVals.map((v) => fmt(v)).join('  ')}"
				size={12}
			/>
			<Txt
				x={X[3]}
				y={Y + S + 26}
				text="keeps the largest: {fmt(Math.max(...blockVals))}"
				size={12}
				weight={600}
			/>
			<Txt x={X[1]} y={Y + S + 26} text="28 × 28" size={12} muted />
		</Readout>

		<Readout id="pl-all" order={3} label="After layer 1" value="8 maps of 14 × 14">
			<Txt
				x={40}
				y={380}
				text="after the first layer: 8 maps of 14 × 14, one per filter (pooled, after the ReLU)"
				size={13}
				weight={600}
			/>
		</Readout>
		{#each poolUrls.all as url, c (c)}
			<g
				class="cv-pick"
				role="button"
				tabindex="0"
				aria-label="Show filter {c + 1}"
				aria-pressed={c === s1}
				onclick={() => setParam('f1', c + 1)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setParam('f1', c + 1);
					}
				}}
			>
				<image href={url} x={40 + c * 110} y={404} width={98} height={98} class="cv-px" />
				<rect
					x={40 + c * 110 - 1}
					y={403}
					width={100}
					height={100}
					fill="none"
					stroke={c === s1 ? 'var(--cv-window)' : 'var(--border)'}
					stroke-width={c === s1 ? 2.5 : 1}
				/>
				<image href={kernels[c]} x={40 + c * 110} y={512} width={30} height={30} class="cv-px" />
				<Txt x={78 + c * 110} y={532} text="filter {c + 1}" size={11} muted />
			</g>
		{/each}
	{:else if mode === 'l2'}
		<Txt x={40} y={56} text="layer 2: 16 filters, each looking at all 8 first-layer maps" size={14} weight={600} />
		{#each maps2 as url, c (c)}
			{@const x = 40 + c * 55}
			<g
				class="cv-pick"
				role="button"
				tabindex="0"
				aria-label="Show second-layer filter {c + 1}"
				aria-pressed={c === s2}
				onclick={() => setParam('f2', c + 1)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setParam('f2', c + 1);
					}
				}}
			>
				<Txt x={x + 24} y={80} text="{c + 1}" size={12} weight={c === s2 ? 700 : 500} anchor="middle" />
				<image href={url} {x} y={88} width={49} height={49} class="cv-px" />
				<rect
					x={x - 1}
					y={87}
					width={51}
					height={51}
					fill="none"
					stroke={c === s2 ? 'var(--cv-window)' : 'var(--border)'}
					stroke-width={c === s2 ? 2.5 : 1}
				/>
			</g>
		{/each}

		<!-- the selected filter on this digit -->
		<Readout id="l2-in" order={1} label="Filter {s2 + 1} on this digit" value="strongest response {fmt(best.v)}">
			<Txt x={40} y={182} text="input" size={12} weight={600} />
			<Txt x={232} y={182} text="filter {s2 + 1}'s map" size={12} weight={600} />
		</Readout>
		<image href={inUrl} x={40} y={192} width={168} height={168} class="cv-px" />
		<rect x={39} y={191} width={170} height={170} fill="none" stroke="var(--border)" />
		{#if best.v > 0}
			{@const rx = Math.max(0, 2 * best.x - 6)}
			{@const ry = Math.max(0, 2 * best.y - 6)}
			<rect
				x={40 + rx * 6}
				y={192 + ry * 6}
				width={(Math.min(SIDE, 2 * best.x + 8) - rx) * 6}
				height={(Math.min(SIDE, 2 * best.y + 8) - ry) * 6}
				fill="var(--cv-window)"
				fill-opacity="0.12"
				stroke="var(--cv-window)"
				stroke-width="2"
			/>
		{/if}
		<image href={maps2[s2]} x={232} y={192} width={168} height={168} class="cv-px" />
		<rect x={231} y={191} width={170} height={170} fill="none" stroke="var(--border)" />
		{#if best.v > 0}
			<rect
				x={232 + best.x * 12}
				y={192 + best.y * 12}
				width="12"
				height="12"
				fill="none"
				stroke="var(--cv-window)"
				stroke-width="2.5"
			/>
		{/if}
		<Readout id="l2-rf">
			<Txt
				x={40}
				y={380}
				text={best.v > 0
					? "box: the 14 × 14 window its strongest unit sees"
					: 'this filter finds nothing in this digit'}
				size={11}
				muted
			/>
		</Readout>

		<!-- its 200 weights -->
		<Readout id="l2-w" order={2} label="Its weights" value="5 × 5 × 8 = 200, one slice per first-layer map">
			<Txt x={440} y={182} text="its 200 weights: a 5 × 5 slice for each first-layer map" size={12} weight={600} />
			<Txt x={440} y={340} text="↑ applied to the map of the first-layer filter below it" size={11} muted />
		</Readout>
		{#each slices as url, ci (ci)}
			<image href={url} x={440 + ci * 59} y={196} width={50} height={50} class="cv-px" />
			<rect x={439 + ci * 59} y={195} width={52} height={52} fill="none" stroke="var(--border)" />
			<image href={kernels[ci]} x={452 + ci * 59} y={270} width={25} height={25} class="cv-px" />
			<Txt x={464 + ci * 59} y={316} text="{ci + 1}" size={11} anchor="middle" muted />
		{/each}

		<!-- what excites it most -->
		<Readout
			id="l2-parts"
			order={3}
			label="Excites it most"
			value="six patches from the 10 000 test digits"
		>
			<Txt
				x={40}
				y={420}
				text="the six patches of the 10 000 test digits that excite filter {s2 + 1} most"
				size={13}
				weight={600}
			/>
		</Readout>
		{#each parts as p, i (p.key)}
			<image href={p.url} x={40 + i * 128} y={432} width={112} height={112} class="cv-px" />
			<rect x={39 + i * 128} y={431} width={114} height={114} fill="none" stroke="var(--border)" />
			<Readout id="l2-p{i}">
				<Txt x={40 + i * 128} y={562} text="test #{p.index} · {fmt(p.value, 1)}" size={11} muted />
			</Readout>
		{/each}
	{/if}
</g>

<style>
	.cv-px {
		image-rendering: pixelated;
	}
	.cv-pick {
		cursor: pointer;
		outline: none;
	}
	.cv-pick:focus-visible rect {
		stroke: var(--cv-window);
		stroke-width: 2.5;
	}
</style>
