<script lang="ts">
	/**
	 * The energy landscape of the chosen chain: every one of its 110,188 shapes, counted by
	 * energy, as centred bars on a ten-fold (log) scale. Highest energy (0) at the top, so the
	 * bars make a funnel narrowing to the one best fold at the bottom. Beside each bar, a shape
	 * with that energy (picked at random from the enumeration); the reader's own fold from the
	 * "fold" step is marked on its row.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { clashes, contacts, energy, fromTurns } from '../hp';
	import { chainById, landscapeOf } from '../folding';
	import Beads from './Beads.svelte';
	import Label from './Text.svelte';
	import { anglesOf, middleOf, pointsOf, straight } from './lattice';

	let { t, params, reduced }: StageProps = $props();

	const chain = $derived(chainById(String(params.chain ?? 'a')));
	const land = $derived(landscapeOf(chain.seq));

	const CX = 330;
	const TOP = 92;
	const ROW = 66;
	const W0 = 26;
	const K = 92; // px per decade
	const width = (c: number) => (c > 0 ? W0 + K * Math.log10(c) : 0);
	const DECADES = [1, 10, 100, 1000, 10000, 100000];

	const rows = $derived(
		land.byEnergy.map((e, k) => {
			const turns = land.examples.get(e.energy) ?? '';
			const y = TOP + k * ROW;
			return {
				...e,
				y,
				w: width(e.shapes),
				grow: reduced ? 1 : smoothstep(0.2 + 0.25 * k, 0.9 + 0.25 * k, t),
				pts: pointsOf(anglesOf(turns), 8.5, 850, y, middleOf(turns)),
				contacts: contacts(chain.seq, fromTurns(turns))
			};
		})
	);

	// the reader's fold
	const mine = $derived.by(() => {
		const v = params[`fold-${chain.id}`];
		const turns =
			typeof v === 'string' && v.length === chain.seq.length - 2 ? v : straight(chain.seq.length);
		const fold = fromTurns(turns);
		const ok = clashes(fold).length === 0;
		return { turns, ok, energy: ok ? energy(chain.seq, fold) : null };
	});
	const myRow = $derived(rows.find((r) => r.energy === mine.energy));
	const fmt = (e: number) => (e === 0 ? '0' : `−${-e}`);
	const shapes = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'shape' : 'shapes'}`;
</script>

<g style:font-variant-numeric="tabular-nums">
	<Readout
		id="title"
		order={1}
		label={chain.label}
		value="{land.shapes.toLocaleString('en-US')} shapes, by energy"
	>
		<Label
			x={32}
			y={44}
			text="All {land.shapes.toLocaleString('en-US')} shapes of {chain.label}, by energy"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="axis">
		<Label x={36} y={TOP - 30} text="energy" size={12} anchor="start" muted />
		<Label x={850} y={TOP - 30} text="a shape at that energy" size={12} muted />
	</Readout>

	<!-- decade guides: the bars' widths grow ten-fold at each pair of lines -->
	{#each DECADES as c (c)}
		{@const w = width(c)}
		<line
			x1={CX - w / 2}
			x2={CX - w / 2}
			y1={TOP - 24}
			y2={TOP + 6.6 * ROW}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<line
			x1={CX + w / 2}
			x2={CX + w / 2}
			y1={TOP - 24}
			y2={TOP + 6.6 * ROW}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="dec-{c}">
			{#if c === 1 || c === 100 || c === 10000}
				<Label
					x={CX + w / 2}
					y={TOP + 6.6 * ROW + 18}
					text={c.toLocaleString('en-US')}
					size={11}
					muted
				/>
			{/if}
		</Readout>
	{/each}
	<Readout id="scale">
		<Label
			x={CX}
			y={TOP + 6.6 * ROW + 38}
			text="number of shapes (each line ten times the last)"
			size={12}
			muted
		/>
	</Readout>

	{#each rows as r (r.energy)}
		{@const here = myRow?.energy === r.energy}
		<Label x={60} y={r.y + 6} text={fmt(r.energy)} size={15} weight={600} anchor="end" />
		<rect
			x={CX - (r.w * r.grow) / 2}
			y={r.y - 20}
			width={r.w * r.grow}
			height="40"
			rx="6"
			fill="var(--pf-bar)"
			opacity={0.4 + 0.6 * (r.energy / land.best)}
			stroke={here ? 'var(--pf-you)' : 'none'}
			stroke-width="3"
		/>
		<Readout
			id="count-{r.energy}"
			order={10 - r.energy}
			label="Energy {fmt(r.energy)}"
			value={shapes(r.shapes)}
		>
			<Label
				x={CX + r.w / 2 + 10}
				y={r.y + (here ? -2 : 5)}
				text={shapes(r.shapes)}
				size={13}
				anchor="start"
				opacity={r.grow}
			/>
		</Readout>
		<Beads
			seq={chain.seq}
			pts={r.pts}
			r={3.6}
			contacts={r.contacts}
			letters={false}
			opacity={r.grow}
		/>
	{/each}

	{#if myRow}
		<Readout
			id="you"
			order={2}
			label="Your fold"
			value="energy {fmt(myRow.energy)}, among {shapes(myRow.shapes)}"
			color="var(--pf-you)"
		>
			<Label
				x={CX + myRow.w / 2 + 10}
				y={myRow.y + 22}
				text="← your fold"
				size={12}
				weight={600}
				anchor="start"
				color="var(--pf-you)"
			/>
		</Readout>
	{:else}
		<Readout id="you" order={2} label="Your fold" value="not a valid shape yet">
			<Label
				x={32}
				y={566}
				text="Your fold from the last step overlaps itself: it isn’t counted."
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
