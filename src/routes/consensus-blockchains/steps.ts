import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const nGenerals: Control = {
	type: 'range',
	id: 'n',
	label: 'Generals',
	min: 3,
	max: 7,
	step: 1,
	default: 3
};
const traitors: Control = {
	type: 'range',
	id: 'traitors',
	label: 'Traitors',
	min: 0,
	max: 2,
	step: 1,
	default: 1
};
const traitorRole: Control = {
	type: 'select',
	id: 'role',
	label: 'Who betrays',
	default: 'lieutenant',
	options: [
		{ value: 'lieutenant', label: 'Lieutenants' },
		{ value: 'commander', label: 'The commander' }
	],
	help: 'With two traitors and “the commander”, one lieutenant betrays as well.'
};

const rerun: Control = {
	type: 'action',
	id: 'rerun',
	label: 'Luck',
	action: 'Run again',
	help: 'Same failures, different random timeouts.'
};
const crashLeader: Control = {
	type: 'toggle',
	id: 'crashLeader',
	label: 'Crash the leader at 11 s',
	default: true
};
const down: Control = {
	type: 'range',
	id: 'down',
	label: 'Servers that crash at 8 s',
	min: 0,
	max: 4,
	step: 1,
	default: 2,
	help: 'Followers crash; they restart at 17 s.'
};
const heal: Control = {
	type: 'toggle',
	id: 'heal',
	label: 'Reconnect the network at 17 s',
	default: true
};

const repair: Control = {
	type: 'action',
	id: 'repair',
	label: 'Cover it up',
	action: 'Recompute the later blocks',
	help: 'Edit block 1 first, in the drawing.'
};
const bits: Control = {
	type: 'range',
	id: 'bits',
	label: 'Difficulty: zero bits at the start of the hash',
	min: 4,
	max: 16,
	step: 1,
	default: 12,
	help: 'Each extra bit doubles the average number of tries.'
};
const fresh: Control = {
	type: 'action',
	id: 'fresh',
	label: 'Block',
	action: 'New block contents',
	help: 'Different payments, a different lucky nonce.'
};
const remine: Control = {
	type: 'action',
	id: 'remine',
	label: 'Cover it up',
	action: 'Re-mine the later blocks',
	help: 'Edit block 1 first, in the drawing.'
};
const jump: Control = {
	type: 'range',
	id: 'jump',
	label: 'Hash rate from week 4 on',
	min: 0.25,
	max: 8,
	default: 2,
	values: () => [0.25, 0.5, 1, 2, 4, 8],
	format: (v) => `× ${v}`
};

const delay: Control = {
	type: 'range',
	id: 'delay',
	label: 'Time for a block to reach the other miners',
	min: 0,
	max: 300,
	step: 10,
	default: 60,
	unit: ' s'
};
const reforks: Control = {
	type: 'action',
	id: 'reforks',
	label: 'Luck',
	action: 'Mine again',
	help: 'Same delay, different luck.'
};
const share: Control = {
	type: 'range',
	id: 'q',
	label: 'Attacker’s share of the hash power',
	min: 5,
	max: 50,
	step: 5,
	default: 30,
	unit: ' %'
};
const confirmations: Control = {
	type: 'range',
	id: 'z',
	label: 'Blocks the shop waits for',
	min: 0,
	max: 12,
	step: 1,
	default: 6
};
const rerace: Control = {
	type: 'action',
	id: 'rerace',
	label: 'Luck',
	action: 'Race again',
	help: 'Same odds, a different race.'
};

export const spec: ExplainerSpec = {
	slug: 'consensus-blockchains',
	title: 'How machines agree: consensus and blockchains',
	summary:
		'Five servers elect a leader and keep one log through crashes and a cut network; then blocks are chained by hash, mined by brute force, and raced by an attacker — how independent machines, and then strangers, agree on one history.',
	chapters: [
		{ id: 'hard', title: 'Why agreeing is hard' },
		{ id: 'voting', title: 'Voting among known servers' },
		{ id: 'chain', title: 'A chain of blocks' },
		{ id: 'strangers', title: 'Agreeing with strangers' },
		{ id: 'summary', title: 'Two ways to agree' }
	],
	steps: [
		// ---------------------------------------------------------------- hard
		{
			id: 'copies',
			chapter: 'hard',
			title: 'One history, five copies',
			scene: 'cluster',
			hints: { mode: 'naive' },
			duration: 18,
			body: `
<p>A bank balance, a shopping basket, the list of who owns which web address: each is a <strong>history</strong> of changes, and it must not be lost when one computer breaks. So it is kept on several machines, called <dfn data-def="A copy of the same data on another machine, kept up to date so that the service survives if one machine fails.">replicas</dfn>, that talk over a network like the <a href="../internet/">internet</a>.</p>
<p>Watch two clients change the same value at almost the same moment: one writes x = 1, the other x = 2. Messages take different times to reach different machines, so each replica sees the two writes in its own order, and applies the last one it heard. The five copies end up <strong>disagreeing</strong>, and none of them is broken.</p>`,
			notes: `<p>Clocks don't solve it: every computer's clock is a little off, and a message can be delayed for any length of time. What the replicas need is a rule that makes all of them apply the <em>same</em> changes in the <em>same</em> order. Getting a group of machines to settle on one value (here: which write comes first) is called <em>consensus</em>.</p>`
		},
		{
			id: 'generals',
			chapter: 'hard',
			title: 'Crashes, and liars',
			scene: 'generals',
			duration: 30,
			controls: [nGenerals, traitors, traitorRole],
			body: `
<p>Machines can fail in two ways. A <dfn data-def="A failure where a machine simply stops: it sends nothing more, but never sends anything false.">crash</dfn> is the polite one. Worse is a machine that keeps talking but lies, through a bug or because someone took it over: a <dfn data-def="A failure where a machine may do anything at all, including sending different false messages to different machines. Named after the Byzantine generals problem.">Byzantine fault</dfn>, after a famous puzzle. Generals must all attack or all retreat. The commander sends an order; each lieutenant passes on what he heard, then follows the <strong>majority</strong> of what reached him (a tie means retreat).</p>
<p>With three generals and one traitor it can't work. Lieutenant 1 hears "attack" from the commander and "the commander told me retreat" from lieutenant 2. Either the commander or lieutenant 2 is lying, and he can't tell which. Add generals: it works once at least <strong>3 traitors + 1</strong> generals take part, so fewer than a third may lie.</p>`,
			notes: `<p>The algorithm drawn here is "Oral Messages" from Lamport, Shostak and Pease, "The Byzantine Generals Problem" (1982). With m traitors it runs m + 1 rounds of relaying, and they proved that no algorithm of any kind can do better than n ≥ 3m + 1 when messages can be forged. If messages are signed (see <a href="../cryptography/#sign">signatures</a>) so a lie about what someone else said can be caught, any number of traitors can be tolerated.</p>
<p>A deeper limit holds even without liars. Fischer, Lynch and Paterson proved in 1985 that if messages can be delayed for any length of time, no deterministic algorithm can guarantee to reach agreement whenever even one machine might crash: a slow machine can't be told apart from a dead one. Real systems work around it with timeouts. They never agree on something wrong, but in a bad stretch they may stall.</p>`
		},
		// ---------------------------------------------------------------- voting
		{
			id: 'election',
			chapter: 'voting',
			title: 'Elect a leader',
			scene: 'cluster',
			hints: { mode: 'election' },
			duration: 26,
			controls: [crashLeader, rerun],
			body: `
<p>Most data centres settle the order by choosing one <dfn data-def="The one server that, for one term, accepts all changes and tells the others in which order to apply them.">leader</dfn>. This is <dfn data-def="A consensus algorithm for a known group of servers, published by Diego Ongaro and John Ousterhout in 2014 and designed to be easy to understand.">Raft</dfn>, with five servers. Each follower runs an <dfn data-def="A countdown, restarted with a random length whenever the server hears from a leader. If it runs out, the server stands for election.">election timer</dfn> (the ring around it). When one runs out, that server becomes a <strong>candidate</strong>, starts a new <dfn data-def="A numbered period with at most one leader. Every message carries its sender's term, and a server that sees a higher term moves to it.">term</dfn> and asks the others for their vote. Each server votes at most once per term.</p>
<p>A candidate with <strong>3 of the 5 votes, a majority</strong>, becomes leader and sends regular heartbeats that keep the other timers from running out. Two majorities of five always share at least one server, and it votes only once, so a term can never have two leaders. Then the leader crashes: the heartbeats stop, a timer runs out, and the cluster elects a new leader in a higher term.</p>`,
			notes: `<p>Raft is from Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm" (2014). It suggests election timeouts of 150–300 ms; here time is slowed down about 20 times, and messages are relatively slower than in a real data centre. The timers are random so that one server usually runs out first and wins before anyone else stands; when two stand at once and split the vote, both time out again and retry. Press "Run again" for other timers. A server also refuses its vote to a candidate whose log is behind its own, so a new leader always has every committed entry.</p>
<p>Raft and its older cousin Paxos (Leslie Lamport, 1998) run inside much of the internet's infrastructure, for example etcd, the store that holds the state of Kubernetes clusters.</p>`
		},
		{
			id: 'replication',
			chapter: 'voting',
			title: 'Commit by majority',
			scene: 'cluster',
			hints: { mode: 'replication' },
			duration: 30,
			controls: [down, rerun],
			body: `
<p>Clients send their commands to the leader. It appends each to its <dfn data-def="The ordered list of commands a server has accepted. Every server applies the commands of the committed part of its log in order.">log</dfn> and sends it out with the next heartbeat. When a <strong>majority</strong> of servers, itself included, have stored it, the entry is <dfn data-def="Safe for good: stored on a majority of servers, so any future leader has it. Only committed commands are applied and reported as done.">committed</dfn> (filled in on the right) and the client is told it is done.</p>
<p>Crash two followers at 8 s: three of five is still a majority, and the log keeps growing. Crash three: the leader can still accept commands, but it can never collect a majority, so <strong>nothing more is committed</strong>. The cluster stalls instead of risking a wrong answer. When the crashed servers restart at 17 s, the leader fills in their logs and work resumes.</p>`,
			notes: `<p>With 2f + 1 servers, Raft survives f crashed servers: 5 survive 2, 7 survive 3. That is better than the 3f + 1 that liars need, because a crashed server never says anything false. Raft does not defend against liars at all: it assumes that every server runs the same honest code. Byzantine versions exist (PBFT, Castro and Liskov 1999) and need 3f + 1 servers.</p>
<p>Each heartbeat also carries the leader's previous entry and its term. A follower whose log doesn't match there refuses, and the leader steps back until it finds where they agree, then sends everything from that point on. That is how restarted servers catch up.</p>`
		},
		{
			id: 'partition',
			chapter: 'voting',
			title: 'Cut the network',
			scene: 'cluster',
			hints: { mode: 'partition' },
			duration: 30,
			controls: [heal, rerun],
			body: `
<p>Now nobody crashes, but at 8 s the network is cut in two: the leader and one follower on one side, three servers on the other. Both sides keep running. The three hear no heartbeats, elect a new leader in a higher term and carry on committing, because three is a majority.</p>
<p>The old leader doesn't know it has been cut off. It still takes commands from clients on its side, but only two servers store them, so they <strong>never commit</strong> (outlined boxes). When the network heals at 17 s, it sees the higher term, steps down, and its uncommitted entries are replaced by the majority's log. Nothing that was committed is lost: <strong>a majority keeps agreeing, a minority stalls</strong>.</p>`,
			notes: `<p>The clients on the old leader's side were never told their commands succeeded, so nothing they believed was undone; real clients retry after a timeout. This is the price in the "CAP" trade-off: during a cut, the minority side stays consistent by refusing to make progress, rather than staying available and drifting apart.</p>`
		},
		// ---------------------------------------------------------------- chain
		{
			id: 'hash-chain',
			chapter: 'chain',
			title: 'Blocks chained by their hashes',
			scene: 'chain',
			hints: { phase: 'link' },
			duration: 24,
			controls: [repair],
			body: `
<p>Voting needs a known list of who may vote. On an open network anybody can join, and anybody can pretend to be a thousand machines, so counting votes means nothing. Bitcoin, launched in 2009, found another way. Its history is a list of payments, grouped into <dfn data-def="A batch of records plus a header that holds, among other things, the hash of the block before it.">blocks</dfn>.</p>
<p>Each block stores the <a href="../cryptography/#hash">SHA-256 hash</a> of the block before it (applied twice, as Bitcoin does). Change a single letter in block 1 (type in it): its hash changes completely, block 2 no longer points to it, and <strong>every later block is cut off</strong>. Anyone holding the last hash can see that the history was edited. But nothing stops a forger from recomputing the later blocks: press the button, and the chain looks valid again in a moment.</p>`,
			notes: `<p>The hashes here are real: SHA-256 applied twice ("SHA-256d") to a short text standing in for Bitcoin's 80-byte block header, which holds the previous block's hash, a fingerprint of all the block's transactions (the root of a Merkle tree), a timestamp, the difficulty and a nonce. Real payments are also <a href="../cryptography/#sign">signed</a>, so nobody can spend coins that aren't theirs.</p>`
		},
		{
			id: 'mining',
			chapter: 'chain',
			title: 'Proof of work: a lottery for the next block',
			scene: 'chain',
			hints: { phase: 'mine' },
			duration: 26,
			controls: [bits, fresh],
			body: `
<p>So make recomputing expensive. A block counts only if its hash starts with a number of <strong>zero bits</strong>. The header has one free field, the <dfn data-def="Number used once: a field of the block header that the miner changes freely, just to change the hash.">nonce</dfn>, and the only way to find a good one is to try 0, 1, 2, … and hash each, exactly the <a href="../cryptography/#hash-oneway">hopeless-backwards search</a> of the cryptography page, done on purpose. This is <dfn data-def="Showing that you spent computing effort, by presenting an input whose hash meets a target that only lots of guessing can hit.">proof-of-work</dfn>, and searching is called <dfn data-def="Trying nonce after nonce until a block's hash meets the target. The miner who finds one adds the block and is paid with new coins and fees.">mining</dfn>.</p>
<p>Each extra zero bit halves the chance per try, so at d bits it takes about 2<sup>d</sup> tries on average; slide the difficulty and watch the count. Checking a found block takes one hash. Every miner is in this lottery at once, and the one with more computers wins more often: <strong>votes are counted in computing work, not in machines</strong>.</p>`,
			notes: `<p>Bitcoin compares the hash to a 256-bit <em>target</em> rather than counting zero bits, which allows any difficulty, not just powers of two. Its difficulty has been above 10¹⁴ since late 2024: a valid block then takes about 4 × 10²³ tries on average, a hash starting with about 79 zero bits. Miners use dedicated chips that do nothing but double SHA-256. A miner who finds a block is paid with newly created coins plus the fees of the payments in it; this page says nothing about cryptocurrencies as investments.</p>`
		},
		{
			id: 'rework',
			chapter: 'chain',
			title: 'Rewriting history means redoing the work',
			scene: 'chain',
			hints: { phase: 'rework' },
			duration: 26,
			controls: [remine],
			body: `
<p>Now every block of the chain carries a proof of work. Edit block 1 again: its hash no longer starts with enough zeros, and the blocks after it no longer link up. To cover it up, the forger has to <strong>mine block 1 again, and then every block after it</strong>; press the button and watch the tries add up.</p>
<p>Here that takes a moment. On the real network, the rest of the miners add a new block about every ten minutes with far more computing power than any forger, so the forger falls further behind with every block: the deeper a payment lies in the chain, the more work it would take to undo it. A blockchain is <strong>tamper-evident, and costly to rewrite</strong>, not impossible to rewrite.</p>`
		},
		{
			id: 'retarget',
			chapter: 'chain',
			title: 'Ten minutes a block',
			scene: 'chain',
			hints: { phase: 'retarget' },
			duration: 24,
			controls: [jump],
			body: `
<p>Who sets the difficulty? Nobody: every node computes it with the same rule. Bitcoin aims for <strong>one block every 10 minutes</strong>. Every <strong>2016 blocks</strong> (two weeks at that pace) each node looks at how long those blocks really took and scales the difficulty to match: half the time means twice the difficulty.</p>
<p>Change how much computing power joins in week 4. The blocks speed up or slow down for one period, then the retarget pulls them back to 10 minutes. The change is capped at a factor of 4 per period, so an eightfold jump takes two periods to absorb.</p>`,
			notes: `<p>The rule is in Bitcoin Core's <code>pow.cpp</code>: target spacing 600 s, target timespan 14 days, the measured timespan clamped to between a quarter and four times that. It measures from the first to the last block of the period, 2015 gaps rather than 2016, an off-by-one kept because changing it would split the network. The chart uses the average block time of each period; real periods vary by a few per cent by luck.</p>`
		},
		// ---------------------------------------------------------------- strangers
		{
			id: 'forks',
			chapter: 'strangers',
			title: 'Forks: the longest chain wins',
			scene: 'forks',
			hints: { phase: 'fork' },
			duration: 32,
			controls: [delay, reforks],
			body: `
<p>A new block takes time to spread to all miners. If another miner finds a block before news of the first arrives, the chain <dfn data-def="Splits into two branches that both start from the same block. Each miner works on the branch it heard of first.">forks</dfn>: two blocks claim the same place. Each miner keeps mining on the branch it heard of first.</p>
<p>The rule that settles it: <strong>follow the longest chain</strong> (strictly, the one with the most work). The next block lands on one branch, that branch is now longer, everyone switches to it, and the other block is <dfn data-def="A valid block that ended up off the winning chain. Its payments go back to waiting for the next block.">orphaned</dfn> (dimmed). Raise the delay and forks become frequent; at zero delay there are none. Agreement on the last few blocks is never certain, only increasingly likely as blocks pile up on top.</p>`,
			notes: `<p>The simulation has five miners with 30, 25, 20, 15 and 10 % of the computing power, one block every 10 minutes on average (found at random times, as in the real lottery), and the delay you set (± 25 %). Time runs about 100 times faster than real. For small delays d, about d ÷ 600 s of blocks end up orphaned. Decker and Wattenhofer measured Bitcoin in 2013: a median of 6.5 s for a block to reach a node, and 1.69 % of blocks orphaned. Faster relay networks have since cut both.</p>`
		},
		{
			id: 'double-spend',
			chapter: 'strangers',
			title: 'The double-spend race',
			scene: 'forks',
			hints: { phase: 'race' },
			duration: 32,
			controls: [share, confirmations, rerace],
			body: `
<p>Here is the attack proof-of-work must stop. A buyer pays a shop and, in secret, mines a <strong>different chain</strong> in which that payment is replaced by one to himself. The shop waits until the payment is buried under z blocks, then hands over the goods. If the attacker's secret chain ever catches up with the public one, he publishes it, everyone switches to it, and the payment vanishes: he has spent the same coins twice.</p>
<p>Each new block is the attacker's with a probability equal to his share of the computing power. With less than half, he falls behind on average, and his chance of ever catching up <strong>shrinks exponentially with z</strong> (the curve). With half or more he always wins eventually: this is the <strong>51 % attack</strong>.</p>`,
			notes: `<p>The curve is Satoshi Nakamoto's formula, "Bitcoin: A Peer-to-Peer Electronic Cash System" (2008), section 11; its tables are checked in this page's tests. For an attacker with 10 % of the power, 5 blocks bring the risk below 0.1 %; with 30 % it takes 24. Shops often wait for 6 blocks, about an hour: a convention, not a rule of the protocol. Nakamoto approximates the attacker's progress with a Poisson distribution, which slightly underestimates the risk; the exact value (Rosenfeld, 2014) is shown alongside, and the simulated races follow it.</p>`
		},
		// ---------------------------------------------------------------- summary
		{
			id: 'two-ways',
			chapter: 'summary',
			title: 'Two ways to agree',
			scene: 'summary',
			duration: 24,
			body: `
<p><strong>Getting independent machines to agree on one history is hard</strong>: messages are late, machines crash, and some may lie. Among a <strong>known set</strong> of servers, voting settles it: a majority commits each entry, and the answer is final at once. Raft survives up to half minus one crashed servers; Byzantine versions survive fewer than a third liars.</p>
<p>Among <strong>strangers</strong>, where anybody can join and anybody can pretend to be many, proof-of-work replaces votes by computing work and the longest chain wins. It needs no list of members, but agreement is only ever probable, grows with every block, and costs a great deal of electricity. Its security rests on no single group controlling half the computing power.</p>`,
			notes: `<p>Other blockchains replace work with stake: validators lock up coins and vote, and those who sign two conflicting blocks lose them. Ethereum switched from proof-of-work to proof-of-stake in September 2022. That brings back voting, now among whoever holds coins, with Byzantine fault tolerance's "fewer than a third" rule for finality.</p>`
		}
	]
};
