<script lang="ts">
	/**
	 * Steps "scan", "self" and "escape": Cas9 carrying a crRNA searches DNA.
	 *
	 * Top: the whole stretch of DNA (made-up letters), PAMs (NGG) in yellow, and
	 * Cas9 moving along it. Middle: a close-up of where Cas9 has stopped: the
	 * two DNA strands and the crRNA, letter by letter, read from the PAM
	 * outward; green ticks pair, a red cross is a mismatch. Bottom: a log of
	 * each stop. The stops and verdicts come from `scan` in the model.
	 *
	 * scan: the phage stretch: two decoys, then the target, cut.
	 * self: the bacterium's own array holding the same spacer; with the PAM
	 *       check on there is no PAM to stop at; off, Cas9 reads its own spacer
	 *       and cuts the chromosome.
	 * escape: the phage with one letter changed (none / far / seed / PAM).
	 * Plays once (about 13 s), then holds; reduced motion shows the end.
	 */
	import { Label, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CUT_FROM_PAM,
		LEADER,
		PHAGE_STRETCH,
		PROTO_AT,
		REPEAT,
		SPACER,
		arrayDna,
		complement,
		hasPam,
		mutate,
		scan,
		toRna,
		type Check,
		type Mutation
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 999 : t);
	const view = $derived(String(step.hints?.view ?? 'scan'));

	const L = SPACER.length;
	const OWN = arrayDna({ spacers: [{ seq: SPACER, source: 'phage' }] });
	const OWN_AT = LEADER.length + REPEAT.length;

	const requirePam = $derived(view !== 'self' || params.pam !== false);
	const mut = $derived<Mutation>(
		view === 'escape' ? ((params.mutation as Mutation) ?? 'seed') : 'none'
	);
	const mutated = $derived(mutate(PHAGE_STRETCH, mut));
	const dna = $derived(view === 'self' ? OWN : mutated.dna);
	const mutAt = $derived(view === 'escape' ? mutated.at : null);
	/** Where the matching letters are, for the close-up when Cas9 never stops there. */
	const targetAt = $derived(view === 'self' ? OWN_AT : PROTO_AT);

	const checks = $derived(scan(dna, SPACER, { requirePam }));
	/** Stops worth showing: every PAM; without the PAM check, only where it cuts (it brushes past the rest). */
	const stops: Check[] = $derived(requirePam ? checks : checks.filter((c) => c.verdict === 'cut'));

	// ---- overview geometry
	const N = $derived(dna.length);
	const PX = $derived(Math.min(11.6, 880 / N));
	const OX = $derived(480 - (N * PX) / 2);
	const OY = 128;
	const lx = (i: number) => OX + (i + 0.5) * PX;

	// ---- schedule
	const TRAVEL = 1.0;
	const GRIP = 0.4;
	const LETTER = 0.2;
	const VERDICT = 1.2;
	interface Seg {
		check: Check;
		t0: number;
		tRead: number;
		tVerdict: number;
		t1: number;
		fromX: number;
		x: number;
		travel: number;
	}
	const schedule = $derived.by(() => {
		const segs: Seg[] = [];
		let tt = 0.6;
		let x = OX - 40;
		for (const c of stops) {
			const cx = lx(c.start + L / 2);
			const travel = requirePam ? TRAVEL : 4;
			const tRead = tt + travel + GRIP;
			const tVerdict = tRead + c.read * LETTER;
			const t1 = tVerdict + VERDICT;
			segs.push({ check: c, t0: tt, tRead, tVerdict, t1, fromX: x, x: cx, travel });
			tt = t1;
			x = cx;
			if (c.verdict === 'cut') break;
		}
		return { segs, end: tt, lastX: x };
	});
	const cutSeg = $derived(schedule.segs.find((s) => s.check.verdict === 'cut') ?? null);
	/** Current segment, or null while travelling off the end. */
	const atTarget = $derived(schedule.segs.findLast((s) => s.check.start === targetAt) ?? null);
	const cur = $derived(schedule.segs.find((s) => time < s.t1) ?? cutSeg ?? atTarget);
	const done = $derived(time >= schedule.end);
	const casX = $derived.by(() => {
		if (cur && time < cur.t1 && schedule.segs.some((s) => time < s.t1)) {
			const u = smoothstep(cur.t0, cur.t0 + cur.travel, time);
			return lerp(cur.fromX, cur.x, u);
		}
		if (cutSeg) return cutSeg.x;
		// no cut: slide off to the end of the DNA
		const u = smoothstep(schedule.end, schedule.end + (requirePam ? 2 : 4), time);
		return lerp(schedule.lastX, OX + N * PX - (L * PX) / 2, u);
	});
	const lettersRead = $derived(
		cur ? Math.max(0, Math.min(cur.check.read, Math.floor((time - cur.tRead) / LETTER) + 1)) : 0
	);
	const cutU = $derived(cutSeg ? smoothstep(cutSeg.tVerdict, cutSeg.tVerdict + 0.8, time) : 0);
	const outcomeShown = $derived(
		done && (cutSeg !== null || time > schedule.end + (requirePam ? 2 : 4))
	);

	// ---- close-up window: the current stop, or the target if Cas9 never stops there
	const focusStart = $derived(cur ? cur.check.start : targetAt);
	const focusIsStop = $derived(cur !== null && time >= cur.t0 + cur.travel);
	const CW = 33;
	const CX = 480 - ((L + 3) * CW) / 2;
	const ROW_TOP = 300;
	const ROW_BOT = 336;
	const ROW_RNA = 394;
	const RNA = toRna(SPACER);
	const windowLetters = $derived(
		Array.from({ length: L + 3 }, (_, k) => {
			const i = focusStart + k;
			return { k, i, top: dna[i] ?? '', bot: complement(dna[i] ?? '') };
		})
	);
	/** Position counted from the PAM (1 = next to it) of window letter k (< L). */
	const fromPam = (k: number) => L - k;
	const pamHere = $derived(hasPam(dna, focusStart + L));
	const markOf = (k: number) => {
		if (!cur || !focusIsStop || k >= L) return null;
		const pos = fromPam(k);
		if (pos > lettersRead) return null;
		return cur.check.mismatches.includes(pos) ? 'x' : 'ok';
	};
	const cutGap = $derived(cutU * 10);
	/** x of window letter k, with the strands pulled apart after the cut. */
	const wx = (k: number) => CX + (k + 0.5) * CW + (k >= L - CUT_FROM_PAM ? cutGap : 0);

	// ---- texts
	const stopText = (s: Seg, n: number) => {
		const c = s.check;
		const head = requirePam ? `PAM ${n}: ` : '';
		if (c.verdict === 'cut')
			return c.mismatches.length
				? `${head}one mismatch far from the PAM (letter ${c.mismatches[0]}), tolerated → cut`
				: `${head}all ${L} letters pair → cut both strands`;
		if (c.mismatches[0] === 1) return `${head}letter 1 next to the PAM does not pair → let go`;
		return `${head}letters 1–${c.mismatches[0] - 1} pair, letter ${c.mismatches[0]} does not → let go`;
	};
	const log = $derived(
		schedule.segs
			.map((s, i) => ({ s, i, text: stopText(s, i + 1) }))
			.filter((e) => time >= e.s.tVerdict)
	);
	const outcome = $derived.by(() => {
		if (view === 'self')
			return cutSeg
				? { text: 'its own chromosome cut: the cell dies', good: false }
				: { text: 'no PAM next to the spacer: Cas9 never opens it', good: true };
		if (cutSeg) return { text: 'phage DNA cut: the cell survives', good: true };
		return { text: 'the phage escapes: the cell dies', good: false };
	});
	const title = $derived(
		view === 'self'
			? 'The bacterium’s own array: leader, repeat, the same spacer, repeat'
			: view === 'escape'
				? mut === 'none'
					? 'Phage DNA, unchanged'
					: 'Phage DNA with one letter changed (red ring)'
				: 'Phage DNA inside the cell; Cas9 with its crRNA searching'
	);
	/** Colour of each overview letter's strand block. */
	const blockColor = (i: number) => {
		if (view !== 'self') return 'var(--cr-phage-dna)';
		if (i < LEADER.length) return 'var(--cr-leader)';
		if (i >= OWN_AT && i < OWN_AT + L) return 'var(--cr-s3)';
		return 'var(--cr-repeat)';
	};
	const pamList = $derived(
		Array.from({ length: N }, (_, i) => i).filter((i) => i >= L && hasPam(dna, i))
	);
	const noPamNote = $derived(
		!pamHere && !focusIsStop && outcomeShown
			? view === 'self'
				? 'the next letters are the repeat: no PAM (needs NGG)'
				: 'the PAM is gone: Cas9 never reads these letters'
			: ''
	);
</script>

<g>
	<!-- overview -->
	<Readout id="title" order={0} label="On the stage" value={title}>
		<Label x={OX} y={70} text={title} size={14} weight={600} anchor="start" />
		<Label x={OX} y={166} text="all letters made up for teaching" size={11} anchor="start" muted />
	</Readout>
	{#each Array.from({ length: N }, (_, i) => i) as i (i)}
		<rect
			x={OX + i * PX + 0.5}
			y={OY - 8}
			width={PX - 1}
			height={7}
			rx={1.5}
			fill={blockColor(i)}
			opacity="0.75"
		/>
		<rect
			x={OX + i * PX + 0.5}
			y={OY + 1}
			width={PX - 1}
			height={7}
			rx={1.5}
			fill={blockColor(i)}
			opacity="0.45"
		/>
	{/each}
	{#each pamList as p (p)}
		<rect
			x={OX + p * PX}
			y={OY - 11}
			width={PX * 3}
			height={22}
			rx={3}
			fill="none"
			stroke="var(--cr-pam)"
			stroke-width="2.5"
		/>
	{/each}
	{#if mutAt !== null}
		<circle
			cx={lx(mutAt)}
			cy={OY}
			r={PX * 0.9}
			fill="none"
			stroke="var(--cr-mismatch)"
			stroke-width="2"
		/>
	{/if}
	{#if cutSeg && cutU > 0}
		{@const cx = OX + (cutSeg.check.pam - CUT_FROM_PAM) * PX}
		<line
			x1={cx}
			x2={cx}
			y1={OY - 16}
			y2={OY + 16}
			stroke="var(--cr-cut)"
			stroke-width="3"
			opacity={cutU}
			stroke-linecap="round"
		/>
	{/if}
	<!-- Cas9 on the overview -->
	<g transform="translate({casX} {OY})" opacity={outcomeShown && !cutSeg ? 0.4 : 1}>
		<ellipse
			cx={0}
			cy={0}
			rx={L * PX * 0.55}
			ry={20}
			fill="var(--cr-cas9)"
			opacity="0.35"
			stroke="var(--cr-cas9-edge)"
			stroke-width="1.5"
		/>
		<text
			x={0}
			y={-26}
			text-anchor="middle"
			style:font-size="12px"
			style:fill="var(--cr-cas9-edge)"
			font-weight="600">Cas9 + crRNA</text
		>
	</g>
	<Readout id="key">
		<Label
			x={OX + N * PX}
			y={166}
			text="yellow frames: PAMs (any letter, then GG)"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>

	<!-- close-up -->
	<g>
		<rect
			x={CX - 18}
			y={232}
			width={(L + 3) * CW + 36}
			height={196}
			rx={12}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout id="closeup">
			<Label
				x={CX}
				y={256}
				text={focusIsStop ? 'close-up: where Cas9 has stopped' : 'close-up: the matching letters'}
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={CX + (L + 3) * CW}
				y={256}
				text="read from the PAM outward ←"
				size={12}
				anchor="end"
				muted
			/>
		</Readout>
		<!-- PAM frame -->
		<rect
			x={wx(L) - CW / 2 + 1}
			y={ROW_TOP - 20}
			width={CW * 3 - 2}
			height={64}
			rx={6}
			fill="none"
			stroke={pamHere ? 'var(--cr-pam)' : 'var(--stage-ink-muted)'}
			stroke-width="2.5"
			stroke-dasharray={pamHere ? undefined : '5 4'}
		/>
		<text
			x={wx(L + 1)}
			y={ROW_BOT + 40}
			text-anchor="middle"
			style:font-size="12px"
			style:fill={pamHere ? 'var(--stage-ink)' : 'var(--stage-ink-muted)'}
			font-weight="600">{pamHere ? 'PAM' : 'no PAM'}</text
		>
		{#each windowLetters as w (w.k)}
			{@const isMut = mutAt !== null && w.i === mutAt}
			<text
				x={wx(w.k)}
				y={ROW_TOP + 6}
				text-anchor="middle"
				style:font-size="17px"
				font-weight="600"
				style:fill={isMut ? 'var(--cr-mismatch)' : 'var(--stage-ink)'}
				font-family="ui-monospace, monospace">{w.top}</text
			>
			<text
				x={wx(w.k)}
				y={ROW_BOT + 6}
				text-anchor="middle"
				style:font-size="17px"
				style:fill={isMut ? 'var(--cr-mismatch)' : 'var(--stage-ink-muted)'}
				font-family="ui-monospace, monospace">{w.bot}</text
			>
			{#if isMut}
				<circle
					cx={wx(w.k)}
					cy={ROW_TOP}
					r={13}
					fill="none"
					stroke="var(--cr-mismatch)"
					stroke-width="1.8"
				/>
			{/if}
			{#if w.k < L}
				{@const m = markOf(w.k)}
				{#if m === 'ok'}
					<line
						x1={wx(w.k)}
						x2={wx(w.k)}
						y1={ROW_BOT + 12}
						y2={ROW_RNA - 18}
						stroke="var(--cr-match)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{:else if m === 'x'}
					<path
						d="M{wx(w.k) - 7} {ROW_BOT + 16} l14 16 m0 -16 l-14 16"
						stroke="var(--cr-mismatch)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{/if}
				<rect
					x={wx(w.k) - CW / 2 + 2}
					y={ROW_RNA - 16}
					width={CW - 4}
					height={26}
					rx={4}
					fill="var(--cr-rna)"
					opacity={focusIsStop || !requirePam || outcomeShown ? 0.9 : 0.35}
				/>
				<text
					x={wx(w.k)}
					y={ROW_RNA + 3}
					text-anchor="middle"
					style:font-size="15px"
					font-weight="600"
					style:fill="var(--cr-on-colour)"
					font-family="ui-monospace, monospace">{RNA[w.k]}</text
				>
			{/if}
		{/each}
		{#if cutSeg && cutU > 0}
			{@const cx = (wx(L - CUT_FROM_PAM - 1) + wx(L - CUT_FROM_PAM)) / 2}
			<line
				x1={cx}
				x2={cx}
				y1={ROW_TOP - 18}
				y2={ROW_BOT + 12}
				stroke="var(--cr-cut)"
				stroke-width="3"
				stroke-linecap="round"
				opacity={cutU}
			/>
		{/if}
		<Readout id="rows">
			<Label x={CX - 8} y={ROW_TOP + 6} text="DNA" size={11} anchor="end" muted />
			<Label x={CX - 8} y={ROW_RNA + 3} text="crRNA" size={11} anchor="end" color="var(--cr-rna)" />
		</Readout>
		{#if noPamNote}
			<Label
				x={CX + (L + 3) * CW}
				y={450}
				text={noPamNote}
				size={12}
				weight={600}
				anchor="end"
				color="var(--cr-mismatch)"
			/>
		{/if}
	</g>

	<!-- log and outcome -->
	{#each log as e (e.i)}
		<Readout
			id="log{e.i}"
			order={2 + e.i}
			label={requirePam ? `Stop ${e.i + 1}` : 'Stop'}
			value={e.text}
		>
			<Label
				x={CX - 18}
				y={478 + e.i * 22}
				text={e.text}
				size={13}
				anchor="start"
				color={e.s.check.verdict === 'cut' ? 'var(--cr-match)' : undefined}
				muted={e.s.check.verdict !== 'cut'}
			/>
		</Readout>
	{/each}
	{#if view === 'self' && requirePam && log.length === 0}
		<Readout
			id="nostop"
			order={2}
			label="Stops"
			value="none: there is no PAM in the array"
			opacity={outcomeShown ? 1 : 0}
		>
			<Label
				x={CX - 18}
				y={478}
				text="no stops: this made-up array has no PAM at all"
				size={13}
				anchor="start"
				muted
				opacity={outcomeShown ? 1 : 0}
			/>
		</Readout>
	{/if}
	<Readout
		id="outcome"
		order={9}
		label="Outcome"
		value={outcome.text}
		color={outcome.good ? 'var(--cr-match)' : 'var(--cr-mismatch)'}
		opacity={outcomeShown ? 1 : 0}
	>
		<Label
			x={480}
			y={566}
			text={outcome.text}
			size={16}
			weight={700}
			color={outcome.good ? 'var(--cr-match)' : 'var(--cr-mismatch)'}
			opacity={outcomeShown ? 1 : 0}
		/>
	</Readout>
</g>
