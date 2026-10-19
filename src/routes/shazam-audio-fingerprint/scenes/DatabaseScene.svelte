<script lang="ts">
	/**
	 * The library being indexed: the twelve tunes' constellations, swept from left to right as
	 * their fingerprints are filed, each with its count; then the size of the index and one
	 * fingerprint that occurs in more than one tune, with its entries.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BINS, CLIPS, CLIP_S, DB_SIZE, FRAME_S, database, unpack, BIN_HZ } from '../model';
	import { dots, fmt, thousands } from './shared';

	let { t, reduced }: StageProps = $props();

	const db = database();
	const X0 = 214;
	const X1 = 760;
	const ROW0 = 66;
	const ROW = 35;
	const H = 26;
	const xOf = (f: number) => X0 + ((f * FRAME_S + 0.032) / CLIP_S) * (X1 - X0);

	/** The sweep: seconds of every tune indexed so far (all of it after 7 s, or reduced). */
	const done = $derived(reduced ? CLIP_S : Math.min(CLIP_S, Math.max(0, (t - 0.6) * 2)));
	const sweepX = $derived(X0 + (done / CLIP_S) * (X1 - X0));

	const rows = $derived(
		db.clips.map((c, i) => {
			const y = ROW0 + i * ROW;
			const yOf = (b: number) => y + H - (b / BINS) * H;
			const upto = done / FRAME_S;
			const shownPeaks = c.peaks.filter((p) => p.t <= upto);
			return {
				i,
				y,
				d: dots(shownPeaks.map((p) => ({ x: xOf(p.t), y: yOf(p.f) }))),
				count: c.hashes.filter((h) => h.t <= upto).length
			};
		})
	);
	const total = db.clips.reduce((s, c) => s + c.hashes.length, 0);
	const distinct = db.index.size;
	const lonely = [...db.index.values()].filter(
		(l) => new Set(l.map((e) => Math.floor(e / 65536))).size === 1
	).length;
	/** A fingerprint found in the most different tunes: the index's busiest entry. */
	const shared = (() => {
		let best: { hash: number; list: number[] } | null = null;
		let bestTunes = 0;
		for (const [hash, list] of db.index) {
			const n = new Set(list.map((e) => Math.floor(e / 65536))).size;
			if (n > bestTunes || (n === bestTunes && best && list.length < best.list.length)) {
				best = { hash, list };
				bestTunes = n;
			}
		}
		return best!;
	})();
	const sharedF = unpack(shared.hash);
	const entries = shared.list
		.slice(0, 4)
		.map((e) => ({ clip: Math.floor(e / 65536), time: (e % 65536) * FRAME_S }));
	const finished = $derived(done >= CLIP_S);
</script>

<g>
	<Label
		x={X0}
		y={40}
		text="Indexing the library: every tune's fingerprints, filed by number"
		anchor="start"
		size={15}
		weight={700}
		halo={false}
	/>
	{#each rows as r (r.i)}
		<Readout id="name-{r.i}">
			<Label
				x={X0 - 14}
				y={r.y + H / 2 + 4}
				text={CLIPS[r.i].name}
				anchor="end"
				size={12}
				halo={false}
			/>
		</Readout>
		<rect
			x={X0}
			y={r.y}
			width={X1 - X0}
			height={H}
			rx="4"
			fill="var(--sz-strip)"
			stroke="var(--stage-grid)"
		/>
		<path d={r.d} stroke="var(--sz-peak)" stroke-width="2.6" stroke-linecap="round" />
		<Readout id="count-{r.i}">
			<Label
				x={X1 + 14}
				y={r.y + H / 2 + 4}
				text="{thousands(r.count)} fingerprints"
				anchor="start"
				size={12}
				tabular
				muted={r.count === 0}
				halo={false}
			/>
		</Readout>
	{/each}
	{#if !finished}
		<line
			x1={sweepX}
			x2={sweepX}
			y1={ROW0 - 6}
			y2={ROW0 + DB_SIZE * ROW - 4}
			stroke="var(--sz-anchor)"
			stroke-width="2"
		/>
	{/if}
	<Readout id="time-axis">
		<Label
			x={X0}
			y={ROW0 + DB_SIZE * ROW + 10}
			text="0 s"
			anchor="start"
			size={11}
			muted
			halo={false}
		/>
		<Label
			x={X1}
			y={ROW0 + DB_SIZE * ROW + 10}
			text="{CLIP_S} s"
			anchor="end"
			size={11}
			muted
			halo={false}
		/>
	</Readout>

	<!-- the index -->
	<g opacity={finished ? 1 : 0.35}>
		<Readout
			id="index"
			order={1}
			label="The index"
			value="{thousands(total)} fingerprints"
			note="{thousands(distinct)} different numbers; {fmt(
				(100 * lonely) / distinct,
				0
			)}% of them in one tune only"
		>
			<rect
				x={X0}
				y={510}
				width={X1 - X0 + 186}
				height={76}
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<text x={X0 + 16} y={533} font-size="13" font-weight="700">
				{thousands(total)} fingerprints filed under {thousands(distinct)} different numbers; {fmt(
					(100 * lonely) / distinct,
					0
				)}% of the numbers occur in one tune only.
			</text>
			<text x={X0 + 16} y={555} font-size="12" class="muted">
				The busiest number, {thousands(shared.hash)} ({thousands(sharedF.f1 * BIN_HZ)} Hz, then {thousands(
					sharedF.f2 * BIN_HZ
				)} Hz {thousands(sharedF.dt * FRAME_S * 1000)} ms later), is found {shared.list.length} times:
			</text>
			<text x={X0 + 16} y={575} font-size="12" class="muted">
				{entries.map((e) => `${CLIPS[e.clip].name} at ${fmt(e.time, 2)} s`).join(' · ')}{shared.list
					.length > entries.length
					? ' · …'
					: ''}
			</text>
		</Readout>
	</g>
</g>
