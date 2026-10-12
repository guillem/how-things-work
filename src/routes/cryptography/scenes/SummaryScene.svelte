<script lang="ts">
	/**
	 * The one-way streets of the page, one row each: mixing paint, a power on the prime clock,
	 * SHA-256, and multiplying two primes. Each row has an easy forward arrow, where a dot runs
	 * across in a second, and a hard backward arrow, where a dot crawls and gives up. The
	 * takeaway is written underneath.
	 *
	 * Values come from the model (`mixHex`, `diffieHellman`, `sha256Hex`, `RSA`). Reduced
	 * motion shows the arrows without dots.
	 */
	import { cycle, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { RSA, diffieHellman, mixHex, sha256Hex } from '../crypto';
	import Txt from './Txt.svelte';

	let { t, reduced }: StageProps = $props();

	const dh = diffieHellman(29, 64);
	const ROWS = [
		{
			id: 'paint',
			title: 'Mixing paint',
			use: 'the picture of a key exchange',
			from: 'yellow + red',
			to: 'orange',
			swatch: mixHex({ yellow: 1, red: 1 }),
			back: 'unmixing'
		},
		{
			id: 'power',
			title: 'Powers on a prime clock',
			use: 'key exchange (Diffie–Hellman)',
			from: 'a = 29',
			to: `2²⁹ mod 101 = ${dh.A}`,
			back: 'discrete logarithm'
		},
		{
			id: 'hash',
			title: 'Hashing',
			use: 'fingerprints, passwords',
			from: '“Meet me at noon”',
			to: `${sha256Hex('Meet me at noon').slice(0, 12)}…`,
			back: 'finding a text for a digest'
		},
		{
			id: 'primes',
			title: 'Multiplying primes',
			use: 'signatures (RSA)',
			from: `${RSA.p} × ${RSA.q}`,
			to: String(RSA.n),
			back: 'factoring'
		}
	];
	const RY = (i: number) => 112 + i * 100;
	const IN = 330;
	const OUT = 760;
	const A0 = 418;
	const A1 = 650;

	const fwd = $derived(reduced ? -1 : cycle(t, 1.6));
	/** The backward dot crawls a fifth of the way in 8 s, then fades out. */
	const bk = $derived(reduced ? -1 : cycle(t, 8));
	const bkOn = $derived(bk < 0 ? 0 : 1 - smoothstep(0.75, 1, bk));
</script>

<g>
	<Txt x={40} y={46} text="One-way streets" size={18} weight={700} />
	<Txt
		x={A0 + (A1 - A0) / 2}
		y={40}
		text="quick →"
		size={13}
		weight={700}
		anchor="middle"
		color="var(--cr-ok)"
	/>
	<Txt
		x={A0 + (A1 - A0) / 2}
		y={60}
		text="← practically impossible"
		size={13}
		weight={700}
		anchor="middle"
		color="var(--cr-bad)"
	/>

	{#each ROWS as r, i (r.id)}
		{@const y = RY(i)}
		<Txt x={40} y={y - 6} text={r.title} size={15} weight={700} />
		<Txt x={40} y={y + 14} text={r.use} size={12} muted />

		<rect
			x={IN - 80}
			y={y - 24}
			width="160"
			height="40"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Txt
			x={IN}
			y={y + 1}
			text={r.from}
			size={14}
			weight={600}
			anchor="middle"
			halo={false}
			mono={r.id === 'hash'}
		/>
		<rect
			x={OUT - 110}
			y={y - 24}
			width="220"
			height="40"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#if r.swatch}
			<circle cx={OUT - 40} cy={y - 4} r="13" fill={r.swatch} stroke="var(--stage-line)" />
			<Txt x={OUT - 20} y={y + 1} text={r.to} size={14} weight={600} halo={false} />
		{:else}
			<Txt
				x={OUT}
				y={y + 1}
				text={r.to}
				size={14}
				weight={600}
				anchor="middle"
				halo={false}
				mono={r.id === 'hash'}
			/>
		{/if}

		<!-- easy forwards -->
		<line
			x1={A0}
			x2={A1 - 6}
			y1={y - 12}
			y2={y - 12}
			stroke="var(--cr-ok)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		{#if fwd >= 0}
			<circle
				cx={A0 + (A1 - A0 - 10) * fwd}
				cy={y - 12}
				r="5"
				fill="var(--cr-ok)"
				opacity={1 - smoothstep(0.85, 1, fwd)}
			/>
		{/if}
		<!-- hard backwards -->
		<line
			x1={A1}
			x2={A0 + 6}
			y1={y + 6}
			y2={y + 6}
			stroke="var(--cr-bad)"
			stroke-width="2"
			stroke-dasharray="5 5"
			marker-end="url(#arrowhead)"
		/>
		{#if bk >= 0}
			<circle
				cx={A1 - (A1 - A0) * 0.2 * smoothstep(0, 0.75, bk)}
				cy={y + 6}
				r="4.5"
				fill="var(--cr-bad)"
				opacity={bkOn}
			/>
		{/if}
		<Txt
			x={A0 + (A1 - A0) / 2}
			y={y + 28}
			text={r.back}
			size={12}
			anchor="middle"
			color="var(--cr-bad)"
			weight={600}
		/>
	{/each}

	<rect
		x="40"
		y="500"
		width="880"
		height="80"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Txt
		x={480}
		y={532}
		text="Easy to do, practically impossible to undo: that asymmetry lets strangers"
		size={15}
		weight={700}
		anchor="middle"
		halo={false}
	/>
	<Txt
		x={480}
		y={558}
		text="share secrets and prove who they are over an open network."
		size={15}
		weight={700}
		anchor="middle"
		halo={false}
	/>
</g>
