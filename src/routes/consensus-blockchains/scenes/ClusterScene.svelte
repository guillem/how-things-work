<script lang="ts">
	/**
	 * Five servers in a ring, their messages in flight, and their logs on the right.
	 *
	 * Modes (`step.hints.mode`):
	 * - `naive`: no consensus. Two clients write x = 1 and x = 2; each write reaches each
	 *   replica after its own delay (`NAIVE`), and each replica keeps the last one it heard.
	 * - `election`: Raft; the leader crashes at 11 s (`params.crashLeader`) and restarts at 18 s.
	 * - `replication`: `params.down` followers crash at 8 s and restart at 17 s.
	 * - `partition`: the network is cut at 8 s (leader + one follower | three servers) and
	 *   heals at 17 s (`params.heal`).
	 *
	 * The whole run is simulated up front by `raft()` and replayed by run time `s`, which loops
	 * and restarts when a control changes (as the internet explainer's network scene does).
	 * Reduced motion shows one informative moment of the run.
	 */
	import { clamp, Label, polar, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { NAIVE, naiveReplicas, raft, stateAt, type Msg, type NodeState } from '../consensus';

	let { step, t, params, reduced }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'election'));

	// ---- scenario --------------------------------------------------------------------------
	const seed = $derived(1 + Number(params.rerun ?? 0));
	const crashLeader = $derived(params.crashLeader !== false);
	const down = $derived(clamp(Math.round(Number(params.down ?? 2)), 0, 4));
	const heal = $derived(params.heal !== false);
	const HORIZON = 26;
	const run = $derived(
		mode === 'naive'
			? null
			: raft({
					seed,
					horizon: HORIZON,
					crashLeader: mode === 'election' && crashLeader ? { at: 11, restartAt: 18 } : undefined,
					crashFollowers:
						mode === 'replication' ? { count: down, at: 8, restartAt: 17 } : undefined,
					partition: mode === 'partition' ? { at: 8, healAt: heal ? 17 : undefined } : undefined
				})
	);
	const period = $derived(mode === 'naive' ? 7 : HORIZON + 2);
	const still = $derived(
		mode === 'naive' ? 4 : mode === 'election' ? (crashLeader ? 16.5 : 10) : 14.5
	);

	// ---- run time: restarts when the scenario changes ---------------------------------------
	let lastKey = '';
	let t0 = 0;
	const s = $derived.by(() => {
		const key = `${step.id}|${seed}|${crashLeader}|${down}|${heal}`;
		if (key !== lastKey) {
			t0 = lastKey === '' || lastKey.split('|')[0] !== step.id ? 0 : t;
			lastKey = key;
		}
		if (t < t0) t0 = 0;
		if (reduced) return still;
		return Math.min((t - t0) % period, period - 0.001);
	});
	const runFade = $derived(
		reduced ? 1 : smoothstep(0, 0.3, s) * (1 - smoothstep(period - 0.6, period - 0.05, s))
	);

	// ---- geometry ----------------------------------------------------------------------------
	const C = { x: 250, y: 318 };
	const RING = 160;
	const R = 33;
	const N = 5;
	const pos = Array.from({ length: N }, (_, i) =>
		polar(C.x, C.y, RING, -Math.PI / 2 + (i * 2 * Math.PI) / N)
	);
	const termColor = (term: number) => `var(--cb-term${((Math.max(1, term) - 1) % 6) + 1})`;

	function onLink(a: number, b: number, u: number, off = 6) {
		const A = pos[a];
		const B = pos[b];
		const dx = B.x - A.x;
		const dy = B.y - A.y;
		const len = Math.hypot(dx, dy);
		const ux = dx / len;
		const uy = dy / len;
		const from = { x: A.x + ux * (R + 6), y: A.y + uy * (R + 6) };
		const to = { x: B.x - ux * (R + 6), y: B.y - uy * (R + 6) };
		return {
			x: from.x + (to.x - from.x) * u - uy * off,
			y: from.y + (to.y - from.y) * u + ux * off
		};
	}

	// ---- Raft state at s ---------------------------------------------------------------------
	const states = $derived(run ? run.states.map((l) => stateAt(l, s)) : []);
	const leader = $derived.by(() => {
		let best = -1;
		states.forEach((st, i) => {
			if (st.role === 'leader' && (best < 0 || st.term > states[best].term)) best = i;
		});
		return best;
	});
	const cut = $derived(run?.cuts.find((c) => s >= c.at && s < c.healAt) ?? null);
	const committedCount = $derived(
		run ? [...run.committedAt.values()].filter((at) => at <= s).length : 0
	);
	const inFlight = $derived(
		run
			? run.msgs.filter((m) => m.sent <= s && s < (m.lost !== undefined ? m.lost + 0.5 : m.arrive))
			: []
	);
	const msgColor: Record<Msg['kind'], string> = {
		'vote?': 'var(--cb-vote)',
		vote: 'var(--cb-vote)',
		append: 'var(--cb-append)',
		ack: 'var(--cb-ack)'
	};
	const msgPoint = (m: Msg) => {
		const end = m.lost ?? m.arrive;
		const u = clamp((s - m.sent) / (m.arrive - m.sent));
		const p = onLink(m.from, m.to, Math.min(u, (end - m.sent) / (m.arrive - m.sent)));
		const fade = m.lost !== undefined && s > m.lost ? 1 - clamp((s - m.lost) / 0.5) : 1;
		return { ...p, fade, lost: m.lost !== undefined && s >= m.lost };
	};
	const recentCommands = $derived(
		run ? [...run.submitted].filter(([, at]) => s >= at && s < at + 1.2) : []
	);
	const roleLabel = (st: NodeState) =>
		st.role === 'down'
			? 'crashed'
			: st.role === 'candidate'
				? `candidate · ${st.votes} vote${st.votes === 1 ? '' : 's'}`
				: st.role;
	const status = $derived.by(() => {
		if (!run) return '';
		if (leader < 0) return 'No leader: waiting for an election';
		return `Leader S${leader + 1} · term ${states[leader].term}`;
	});
	/** How many servers can reach each other, and whether that is a majority. */
	const quorum = $derived.by(() => {
		if (!run) return '';
		if (cut) {
			const big = cut.sides.filter((v) => v === 1).length;
			return `Cut: ${big} servers on one side (a majority), ${N - big} on the other`;
		}
		const up = states.filter((st) => st.role !== 'down').length;
		return up >= 3
			? `${up} of 5 servers up: a majority, so entries can commit`
			: `${up} of 5 servers up: no majority, nothing can commit`;
	});
	const events = $derived.by(() => {
		if (!run) return [] as { at: number; label: string }[];
		const ev: { at: number; label: string }[] = [];
		const crashes = run.crashes;
		if (crashes.length) {
			ev.push({
				at: crashes[0].at,
				label:
					crashes.length === 1
						? `S${crashes[0].node + 1} crashes`
						: `${crashes.length} servers crash`
			});
			if (crashes[0].restartAt !== undefined)
				ev.push({ at: crashes[0].restartAt, label: 'restart' });
		}
		for (const c of run.cuts) {
			ev.push({ at: c.at, label: 'cut' });
			if (Number.isFinite(c.healAt)) ev.push({ at: c.healAt, label: 'heal' });
		}
		return ev;
	});

	// ---- naive mode ----------------------------------------------------------------------------
	const CLIENTS = { A: { x: 456, y: 136 }, B: { x: 62, y: 520 } };
	const replicas = naiveReplicas();
	const writeColor = (label: string) => (label === 'x = 1' ? 'var(--cb-term1)' : 'var(--cb-term4)');
	const naiveFlights = $derived(
		NAIVE.writes.flatMap((w) =>
			w.delay.map((d, i) => {
				const u = clamp((s - w.at) / d);
				const c = CLIENTS[w.client];
				const P = pos[i];
				const len = Math.hypot(P.x - c.x, P.y - c.y);
				const ux = (P.x - c.x) / len;
				const uy = (P.y - c.y) / len;
				const from = { x: c.x + ux * 30, y: c.y + uy * 30 };
				const to = { x: P.x - ux * (R + 10), y: P.y - uy * (R + 10) };
				return {
					key: `${w.label}-${i}`,
					label: w.label,
					x: from.x + (to.x - from.x) * u,
					y: from.y + (to.y - from.y) * u,
					on: s >= w.at && u < 1
				};
			})
		)
	);
	const naiveSeen = (i: number) => replicas[i].arrivals.filter((a) => a.at <= s);
	const naiveDone = $derived(
		s >= Math.max(...NAIVE.writes.flatMap((w) => w.delay.map((d) => w.at + d)))
	);

	// ---- log panel -------------------------------------------------------------------------------
	const LOG = { x: 556, y: 150, row: 66, box: 26, gap: 3 };
	const TL = { x: 40, x2: 470, y: 572 };
	const tlX = (time: number) => TL.x + ((TL.x2 - TL.x) * time) / HORIZON;
</script>

<g>
	<!-- ring links -->
	{#each pos as a, i (i)}
		{#each pos as b, j (j)}
			{#if j > i}
				{@const severed = cut !== null && cut.sides[i] !== cut.sides[j]}
				<line
					x1={a.x}
					y1={a.y}
					x2={b.x}
					y2={b.y}
					stroke={severed ? 'var(--cb-lost)' : 'var(--stage-line)'}
					stroke-opacity={severed ? 0.35 : 0.55}
					stroke-dasharray={severed ? '4 6' : undefined}
				/>
			{/if}
		{/each}
	{/each}

	{#if cut}
		{@const l = cut.sides.findIndex((v) => v === 0)}
		{@const both = cut.sides[(l + 4) % 5] === 0 ? (l + 4) % 5 : l}
		{@const mid = -Math.PI / 2 + ((both + 0.5) * 2 * Math.PI) / N}
		{@const o = polar(C.x, C.y, RING * 0.3, mid)}
		{@const p1 = polar(o.x, o.y, RING * 1.15, mid + Math.PI / 2)}
		{@const p2 = polar(o.x, o.y, RING * 1.15, mid - Math.PI / 2)}
		<line
			x1={p1.x}
			y1={p1.y}
			x2={p2.x}
			y2={p2.y}
			stroke="var(--cb-lost)"
			stroke-width="3"
			stroke-dasharray="10 6"
		/>
		<Readout id="cut" order={3} label="Network" value="cut in two" color="var(--cb-lost)">
			<Label
				x={p1.y > p2.y ? p1.x : p2.x}
				y={Math.max(p1.y, p2.y) + 16}
				text="network cut"
				size={12}
				weight={700}
				anchor="middle"
				color="var(--cb-lost)"
			/>
		</Readout>
	{/if}

	{#if mode === 'naive'}
		<!-- clients and the two writes in flight -->
		{#each Object.entries(CLIENTS) as [name, c] (name)}
			<rect
				x={c.x - 28}
				y={c.y - 18}
				width="56"
				height="36"
				rx="7"
				fill="var(--surface)"
				stroke={writeColor(name === 'A' ? 'x = 1' : 'x = 2')}
				stroke-width="2"
			/>
			<Label
				tabular
				x={c.x}
				y={c.y - 2}
				text="client {name}"
				size={11}
				anchor="middle"
				halo={false}
			/>
			<Label
				tabular
				x={c.x}
				y={c.y + 12}
				text={name === 'A' ? 'x = 1' : 'x = 2'}
				size={11}
				weight={700}
				anchor="middle"
				halo={false}
				color={writeColor(name === 'A' ? 'x = 1' : 'x = 2')}
			/>
		{/each}
		{#each naiveFlights as f (f.key)}
			{#if f.on}
				<g opacity={runFade}>
					<rect x={f.x - 20} y={f.y - 9} width="40" height="18" rx="9" fill={writeColor(f.label)} />
					<text
						x={f.x}
						y={f.y + 4}
						text-anchor="middle"
						font-size="11"
						style:font-weight="700"
						style:fill="white">{f.label}</text
					>
				</g>
			{/if}
		{/each}
	{:else}
		<!-- messages -->
		{#each inFlight as m, k (`${m.from}-${m.to}-${m.sent}-${k}`)}
			{@const p = msgPoint(m)}
			<g opacity={p.fade * runFade}>
				{#if p.lost}
					<path
						d="M{p.x - 5} {p.y - 5} L{p.x + 5} {p.y + 5} M{p.x - 5} {p.y + 5} L{p.x + 5} {p.y - 5}"
						stroke="var(--cb-lost)"
						stroke-width="2.5"
					/>
				{:else if m.kind === 'append'}
					<rect
						x={p.x - (m.entries ? 7 : 5)}
						y={p.y - (m.entries ? 7 : 5)}
						width={m.entries ? 14 : 10}
						height={m.entries ? 14 : 10}
						rx="2.5"
						fill={msgColor[m.kind]}
					/>
				{:else if m.kind === 'vote?'}
					<circle
						cx={p.x}
						cy={p.y}
						r="6"
						fill="var(--surface)"
						stroke={msgColor[m.kind]}
						stroke-width="2.5"
					/>
				{:else}
					<circle
						cx={p.x}
						cy={p.y}
						r="5"
						fill={m.ok === false ? 'var(--surface)' : msgColor[m.kind]}
						stroke={msgColor[m.kind]}
						stroke-width="2"
					/>
				{/if}
			</g>
		{/each}
	{/if}

	<!-- servers -->
	{#each pos as P, i (i)}
		{@const st = states[i]}
		{@const role = st?.role ?? 'follower'}
		{@const stroke =
			role === 'leader'
				? 'var(--cb-leader)'
				: role === 'candidate'
					? 'var(--cb-candidate)'
					: role === 'down'
						? 'var(--cb-down)'
						: 'var(--cb-follower)'}
		<g opacity={role === 'down' ? 0.75 : 1}>
			{#if st && (role === 'follower' || role === 'candidate') && st.timerAt > st.timerFrom}
				{@const left = clamp((st.timerAt - s) / (st.timerAt - st.timerFrom))}
				{@const a0 = -Math.PI / 2}
				{@const a1 = a0 + left * 2 * Math.PI * 0.999}
				{@const q0 = polar(P.x, P.y, R + 6, a0)}
				{@const q1 = polar(P.x, P.y, R + 6, a1)}
				<circle
					cx={P.x}
					cy={P.y}
					r={R + 6}
					fill="none"
					stroke="var(--stage-grid)"
					stroke-width="4"
				/>
				<path
					d="M{q0.x} {q0.y} A{R + 6} {R + 6} 0 {left > 0.5 ? 1 : 0} 1 {q1.x} {q1.y}"
					fill="none"
					{stroke}
					stroke-width="4"
					stroke-linecap="round"
				/>
			{/if}
			<circle
				cx={P.x}
				cy={P.y}
				r={R}
				fill={role === 'leader' ? 'var(--cb-leader)' : 'var(--surface)'}
				{stroke}
				stroke-width={role === 'candidate' ? 3.5 : 2.5}
				stroke-dasharray={role === 'down' ? '5 4' : undefined}
			/>
			<text
				x={P.x}
				y={P.y + (mode === 'naive' ? -4 : 1)}
				text-anchor="middle"
				font-size="15"
				style:font-weight="700"
				style:fill={role === 'leader' ? 'white' : undefined}>S{i + 1}</text
			>
			{#if mode === 'naive'}
				{@const seen = naiveSeen(i)}
				{#if seen.length}
					{@const last = seen[seen.length - 1].label}
					<text
						x={P.x}
						y={P.y + 14}
						text-anchor="middle"
						font-size="12"
						style:font-weight="700"
						style:fill={writeColor(last)}>{last}</text
					>
				{/if}
			{:else if st}
				<text
					x={P.x}
					y={P.y + 15}
					text-anchor="middle"
					class:muted={role !== 'leader'}
					font-size="10"
					style:fill={role === 'leader' ? 'white' : undefined}>term {st.term}</text
				>
				{@const below = P.y > C.y}
				<Readout id="role-{i}">
					<Label
						tabular
						x={P.x}
						y={below ? P.y + R + 24 : P.y - R - 14}
						text={roleLabel(st)}
						size={12}
						weight={role === 'leader' || role === 'candidate' ? 700 : 500}
						anchor="middle"
						color={role === 'down' ? undefined : stroke}
						muted={role === 'down'}
					/>
				</Readout>
			{/if}
		</g>
	{/each}

	{#if run}
		<!-- commands arriving at the leader -->
		{#each recentCommands as [cmd, at] (cmd)}
			{@const owner = states.findIndex(
				(st) => st.log.some((e) => e.cmd === cmd) && st.role === 'leader'
			)}
			{#if owner >= 0}
				{@const P = pos[owner]}
				{@const u = clamp((s - at) / 1.2)}
				<g opacity={(1 - smoothstep(0.7, 1, u)) * runFade}>
					<Label
						tabular
						x={P.x}
						y={(P.y > C.y ? P.y - R - 34 : P.y + R + 26) - u * 10}
						text="+ command {cmd}"
						size={12}
						weight={700}
						anchor="middle"
						color="var(--cb-leader)"
					/>
				</g>
			{/if}
		{/each}
	{/if}

	<!-- header -->
	<Readout
		id="title"
		order={1}
		label={mode === 'naive' ? 'Replicas' : 'Cluster'}
		value={mode === 'naive' ? (naiveDone ? 'they disagree' : 'writes in flight') : status}
	>
		<Label
			anchor="start"
			tabular
			x={24}
			y={40}
			text={mode === 'naive' ? 'Five replicas, no rule for the order' : status}
			size={16}
			weight={700}
		/>
	</Readout>
	{#if mode !== 'naive'}
		<Readout id="time" order={2} label="Time" value="{s.toFixed(1)} s · {committedCount} committed">
			<Label
				anchor="start"
				tabular
				x={24}
				y={62}
				text="t = {s.toFixed(1)} s (slowed down)"
				size={12}
				muted
			/>
		</Readout>
		{#if mode !== 'election' || states.some((st) => st.role === 'down')}
			<Readout id="quorum" order={3} label="Majority" value={quorum}>
				<Label
					anchor="start"
					tabular
					x={24}
					y={82}
					text={quorum}
					size={12}
					weight={600}
					color={quorum.includes('no majority') ? 'var(--cb-bad)' : undefined}
				/>
			</Readout>
		{/if}
	{/if}

	<!-- right panel -->
	{#if mode === 'naive'}
		<Label
			anchor="start"
			x={LOG.x}
			y={LOG.y - 38}
			text="What each replica applied, in order"
			size={13}
			weight={700}
		/>
		{#each replicas as r, i (i)}
			{@const y = LOG.y + i * LOG.row}
			{@const seen = naiveSeen(i)}
			<Label anchor="start" tabular x={LOG.x} y={y + 18} text="S{i + 1}" size={14} weight={700} />
			{#each seen as a, k (a.label)}
				<rect
					x={LOG.x + 40 + k * 86}
					{y}
					width="70"
					height="26"
					rx="6"
					fill={writeColor(a.label)}
				/>
				<text
					x={LOG.x + 75 + k * 86}
					y={y + 18}
					text-anchor="middle"
					font-size="12"
					style:font-weight="700"
					style:fill="white">{a.label}</text
				>
				{#if k === 1}
					<Label x={LOG.x + 117} y={y + 18} text="→" size={13} anchor="middle" muted halo={false} />
				{/if}
			{/each}
			{#if seen.length === 2}
				<Label
					anchor="start"
					tabular
					x={LOG.x + 216}
					y={y + 18}
					text="ends with {r.final}"
					size={12}
					weight={700}
					color={writeColor(r.final)}
				/>
			{/if}
		{/each}
		<g opacity={naiveDone ? 1 : 0}>
			<Readout
				id="verdict"
				order={3}
				label="Result"
				value="3 replicas say x = 2, 2 say x = 1"
				opacity={naiveDone ? 1 : 0}
			>
				<Label
					anchor="start"
					x={LOG.x}
					y={LOG.y + 5 * LOG.row + 14}
					text="Three say x = 2, two say x = 1: the copies disagree."
					size={13}
					weight={700}
					color="var(--cb-bad)"
				/>
			</Readout>
		</g>
	{:else if run}
		<Label anchor="start" x={LOG.x} y={LOG.y - 44} text="Logs" size={14} weight={700} />
		<Readout id="log-key">
			<Label
				anchor="start"
				x={LOG.x + 44}
				y={LOG.y - 44}
				text="number = command · colour = term · filled = committed"
				size={11}
				muted
			/>
		</Readout>
		{#each states as st, i (i)}
			{@const y = LOG.y + i * LOG.row - 22}
			<g opacity={st.role === 'down' ? 0.5 : 1}>
				<Label
					anchor="start"
					tabular
					x={LOG.x}
					y={y + 18}
					text="S{i + 1}"
					size={13}
					weight={700}
					color={st.role === 'leader' ? 'var(--cb-leader)' : undefined}
				/>
				{#each st.log as e, k (k)}
					{@const x = LOG.x + 32 + k * (LOG.box + LOG.gap)}
					{@const done = k < st.commit}
					<rect
						{x}
						{y}
						width={LOG.box}
						height={LOG.box}
						rx="4"
						fill={done ? termColor(e.term) : 'var(--surface)'}
						stroke={termColor(e.term)}
						stroke-width="2"
					/>
					<text
						x={x + LOG.box / 2}
						y={y + 18}
						text-anchor="middle"
						font-size="12"
						style:font-weight="700"
						style:fill={done ? 'white' : termColor(e.term)}>{e.cmd}</text
					>
				{/each}
			</g>
		{/each}
		<!-- key -->
		<g transform="translate({LOG.x}, {LOG.y + 5 * LOG.row - 8})">
			<Readout id="msg-key">
				<circle
					cx="6"
					cy="0"
					r="6"
					fill="var(--surface)"
					stroke="var(--cb-vote)"
					stroke-width="2.5"
				/>
				<Label anchor="start" x={18} y={4} text="vote request" size={11} muted />
				<circle cx="112" cy="0" r="5" fill="var(--cb-vote)" />
				<Label anchor="start" x={122} y={4} text="vote (hollow: refused)" size={11} muted />
				<rect x="0" y="16" width="12" height="12" rx="2.5" fill="var(--cb-append)" />
				<Label anchor="start" x={18} y={27} text="heartbeat with entries" size={11} muted />
				<circle cx="164" cy="22" r="5" fill="var(--cb-ack)" />
				<Label anchor="start" x={174} y={27} text="reply" size={11} muted />
				<path d="M222 17 l10 10 M222 27 l10 -10" stroke="var(--cb-lost)" stroke-width="2.5" />
				<Label anchor="start" x={240} y={27} text="lost" size={11} muted />
			</Readout>
		</g>
		<!-- timeline -->
		<line x1={TL.x} x2={TL.x2} y1={TL.y} y2={TL.y} stroke="var(--stage-line)" stroke-width="2" />
		{#each events as ev (ev.label + ev.at)}
			<line
				x1={tlX(ev.at)}
				x2={tlX(ev.at)}
				y1={TL.y - 7}
				y2={TL.y + 7}
				stroke="var(--cb-lost)"
				stroke-width="2"
			/>
			<Readout id="ev-{ev.label}">
				<Label
					tabular
					x={tlX(ev.at)}
					y={TL.y - 12}
					text="{ev.label} {ev.at} s"
					size={11}
					anchor="middle"
					muted
				/>
			</Readout>
		{/each}
		{#each run.leaders as l (l.term)}
			<circle cx={tlX(l.t)} cy={TL.y} r="4" fill={termColor(l.term)} opacity={l.t <= s ? 1 : 0.3} />
		{/each}
		<circle cx={tlX(Math.min(s, HORIZON))} cy={TL.y} r="6" fill="var(--stage-ink)" />
		<Readout id="tl-ends">
			<Label x={TL.x} y={TL.y + 18} text="0 s" size={11} anchor="middle" muted />
			<Label tabular x={TL.x2} y={TL.y + 18} text="{HORIZON} s" size={11} anchor="middle" muted />
			<Label
				x={(TL.x + TL.x2) / 2}
				y={TL.y + 18}
				text="dots: a leader elected"
				size={11}
				anchor="middle"
				muted
			/>
		</Readout>
	{/if}
</g>
