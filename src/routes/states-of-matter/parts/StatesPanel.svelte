<script lang="ts">
	/** Three cards, solid, liquid and gas, with the current state's card highlighted. */
	import { Label } from '#lib/draw/index.ts';
	import type { Phase } from '../phase';

	interface Props {
		phase: Phase;
	}
	let { phase }: Props = $props();

	const cards = [
		{
			id: 'solid',
			title: 'solid',
			lines: ['keeps its shape and its volume', 'molecules vibrate in their places'],
			dots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => ({
				x: (k % 4) * 15 + (Math.floor(k / 4) % 2) * 7.5,
				y: Math.floor(k / 4) * 13
			}))
		},
		{
			id: 'liquid',
			title: 'liquid',
			lines: ['flows, but keeps its volume', 'molecules touch but slide past each other'],
			dots: [
				[2, 2],
				[17, 0],
				[31, 5],
				[46, 2],
				[9, 14],
				[24, 15],
				[39, 17],
				[52, 14],
				[0, 27],
				[15, 28],
				[31, 29],
				[46, 27]
			].map(([x, y]) => ({ x, y }))
		},
		{
			id: 'gas',
			title: 'gas',
			lines: ['fills its whole container', 'molecules fly freely, far apart'],
			dots: [
				[0, 0],
				[38, 4],
				[16, 22],
				[54, 26],
				[4, 38],
				[30, 44]
			].map(([x, y]) => ({ x, y }))
		}
	] as const;

	const X = 430;
	const W = 490;
	const H = 128;
	const GAP = 22;
	const Y = 74;
</script>

<g>
	{#each cards as c, i (c.id)}
		{@const on = phase === c.id || (phase === 'supercritical' && c.id === 'gas')}
		{@const y = Y + i * (H + GAP)}
		<g opacity={on ? 1 : 0.45}>
			<rect
				x={X}
				{y}
				width={W}
				height={H}
				rx="10"
				fill="var(--surface)"
				stroke={on ? 'var(--som-dot)' : 'var(--border)'}
				stroke-width={on ? 2.5 : 1.2}
			/>
			{#each c.dots as d, k (k)}
				<circle
					cx={X + 30 + d.x}
					cy={y + 40 + d.y}
					r="6"
					fill="var(--som-co2)"
					stroke="var(--som-co2-edge)"
					stroke-width="1"
				/>
			{/each}
			<Label x={X + 120} y={y + 40} text={c.title} size={17} weight={700} anchor="start" />
			<Label x={X + 120} y={y + 68} text={c.lines[0]} size={13} anchor="start" />
			<Label x={X + 120} y={y + 90} text={c.lines[1]} size={13} anchor="start" muted />
		</g>
	{/each}
</g>
