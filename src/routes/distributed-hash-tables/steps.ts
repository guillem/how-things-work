import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { SIZES } from './model';

const servers: Control = {
	type: 'range',
	id: 'servers',
	label: 'Servers',
	min: 3,
	max: 8,
	step: 1,
	default: 6
};

const add: Control = {
	type: 'toggle',
	id: 'add',
	label: 'Add one more server',
	default: false
};

const rule: Control = {
	type: 'select',
	id: 'rule',
	label: 'Rule',
	default: 'ring',
	options: [
		{ value: 'ring', label: 'Consistent hashing' },
		{ value: 'modulo', label: 'hash mod N' }
	]
};

const VNODES = [1, 2, 4, 8, 16, 32, 64, 128];
const vnodes: Control = {
	type: 'range',
	id: 'vnodes',
	label: 'Points per server',
	min: 1,
	max: 128,
	step: 1,
	default: 1,
	values: () => VNODES,
	format: (v) => (v === 1 ? '1 (no virtual nodes)' : `${v} virtual nodes`)
};

const NODES = [8, 16, 32, 64];
const nodes: Control = {
	type: 'range',
	id: 'nodes',
	label: 'Nodes',
	min: 8,
	max: 64,
	step: 1,
	default: 32,
	values: () => NODES
};

const another: Control = {
	type: 'action',
	id: 'another',
	label: 'Lookup',
	action: 'Look up another key'
};

const size: Control = {
	type: 'range',
	id: 'size',
	label: 'Network size',
	min: SIZES[0],
	max: SIZES[SIZES.length - 1],
	step: 1,
	default: 4096,
	values: () => SIZES,
	format: (v) => `${v.toLocaleString('en-US')} nodes`
};

const fail: Control = {
	type: 'range',
	id: 'fail',
	label: 'Nodes failing each round',
	min: 0.1,
	max: 0.5,
	step: 0.05,
	default: 0.25,
	format: (v) => `${Math.round(v * 100)} %`
};

const successors: Control = {
	type: 'range',
	id: 'successors',
	label: 'Successor list',
	min: 1,
	max: 4,
	step: 1,
	default: 1,
	format: (v) => (v === 1 ? '1 node ahead' : `${v} nodes ahead`)
};

const copies: Control = {
	type: 'range',
	id: 'copies',
	label: 'Copies of each key',
	min: 1,
	max: 4,
	step: 1,
	default: 1,
	format: (v) => (v === 1 ? '1 (no replicas)' : `${v}`)
};

const rerun: Control = { type: 'action', id: 'rerun', label: 'Churn', action: 'Run again' };

/**
 * Scenes: `place` (servers and keys; hints `rule` 'modulo' | 'ring' | '@rule' and `adding`
 * true when the step offers the add toggle), `load` (each server's share with virtual nodes),
 * `lookup` (a Chord ring; hint `fingers`), `scale` (hops against network size) and `churn`
 * (rounds of failures and repair; hint `focus` 'ring' | 'keys').
 */
export const spec: ExplainerSpec = {
	slug: 'distributed-hash-tables',
	title: 'Distributed hash tables & consistent hashing',
	summary:
		'Hash servers and keys onto one ring and add a server: only its own share of the keys moves, where hash mod N moves almost all. Even the load with virtual nodes, look keys up with Chord finger tables in about ½ log₂ N hops among thousands of nodes, and churn the ring to see successor lists heal it and replicas keep the data.',
	chapters: [
		{ id: 'spread', title: 'Spreading the keys' },
		{ id: 'find', title: 'Finding a key with no directory' },
		{ id: 'churn', title: 'Machines come and go' }
	],
	steps: [
		// ------------------------------------------------------------------ spread
		{
			id: 'modulo',
			chapter: 'spread',
			title: 'Hash the key, divide by N',
			scene: 'place',
			hints: { rule: 'modulo', adding: true },
			duration: 26,
			controls: [servers, add],
			body: `
<p>A web cache, a shopping-basket store or a file-sharing network holds far more keys than one machine can. They are spread over N servers, and every client must be able to work out on its own which server holds a key, with no central directory to ask.</p>
<p>The <a href="../hash-tables-bloom-filters/">hash table</a>'s trick does it: hash the key to a big number and take it modulo N. Every key lands on one of the N servers, the servers get about equal shares, and anyone with the same hash function finds the same server. The 60 keys on the circle are coloured by the server that holds them.</p>
<p>Now add one server. The rule is now hash mod N + 1, and a key stays put only if its hash leaves the same remainder under both: about one key in N + 1. Going from 6 servers to 7, about six keys in seven move to another server, each one copied over the network, all at once, just as the system is busy enough to need the new machine.</p>`,
			notes: `<p>The fraction that stays is exactly the share of hashes h with h mod N = h mod (N + 1), which for evenly spread hashes is 1/(N + 1). Doubling N is kinder (half the keys move, each to a new server), which is why some systems only ever double. The ring that follows removes the problem for any N.</p>`
		},
		{
			id: 'ring',
			chapter: 'spread',
			title: 'Servers and keys on one circle',
			scene: 'place',
			hints: { rule: 'ring', adding: false },
			duration: 26,
			controls: [servers],
			body: `
<p><dfn data-def="Placing servers and keys with the same hash on a circle of identifiers and giving each key to the first server clockwise; proposed by Karger and colleagues at MIT in 1997 for web caching.">Consistent hashing</dfn> (Karger et al., 1997) hashes the servers too. Think of the hash's values, 0 to 2³² − 1, bent into a circle. Each server's name hashes to a point on it, each key's name to another, and a key belongs to the first server clockwise from it, its <dfn data-def="The first server (or node) at or after a given point, going clockwise around the identifier circle.">successor</dfn>.</p>
<p>Each server now owns an arc: the stretch of circle between the server before it and itself, coloured here in the server's colour. Every key in the arc is that server's. Anyone who knows the servers' names can draw the same circle and find any key's owner, still without asking anyone.</p>
<p>Change the number of servers and look at the arcs: nothing in the rule asks them to be equal, and they aren't.</p>`,
			notes: `<p>The ring used here is the 32-bit space of a seeded MurmurHash3. Real systems use a cryptographic hash over more bits (SHA-1's 160 in Chord and BitTorrent, MD5's 128 in Amazon's Dynamo), so that nobody can choose names that pile up on one server; for spreading honest names any good hash does. Karger's paper was about web caches, and the company it led to, Akamai, used it to decide which cache server holds which page.</p>`
		},
		{
			id: 'join',
			chapter: 'spread',
			title: 'A new server takes only its own share',
			scene: 'place',
			hints: { rule: '@rule', adding: true },
			duration: 30,
			controls: [rule, servers, add],
			body: `
<p>Add a server to the ring. Its point lands inside one server's arc and cuts it in two: the keys between the previous point and the new one change hands, to the new server. No other key moves, because no other key's successor changed. Remove a server and its keys pass to the next server clockwise, and again nothing else moves.</p>
<p>On average a new server takes 1/(N + 1) of the keys, its fair share, out of K keys about K/(N + 1): the least any rule can move, since the new server has to end up with something. Switch the rule to hash mod N and add the same server: almost every key changes colour.</p>
<p>Try a few server counts. The ring often moves fewer keys than the fair share, and sometimes more: the new server takes whatever its arc happens to hold.</p>`,
			notes: `<p>Karger and colleagues called these properties <em>smoothness</em> (adding or removing a server moves only the expected share, K/N keys) and <em>monotonicity</em> (keys move only to the new server, never between old ones). The model tests check both: over 40 rings of 10 servers, a join moves on average 1/11 of 10,000 keys, all of them to the new server, while hash mod N moves 10 in 11.</p>`
		},
		{
			id: 'vnodes',
			chapter: 'spread',
			title: 'Fair shares need virtual nodes',
			scene: 'load',
			duration: 30,
			controls: [vnodes],
			body: `
<p>Consistent hashing is not fair by default. With one point per server the arcs are the gaps between N random points on a circle, and those vary a lot: here 8 servers should hold 12.5 % of the ring each, and the biggest holds several times what the smallest does. For N servers the largest arc averages about ln N + 0.58 times the fair share, so the busiest server in a thousand carries about 7.5 times the average.</p>
<p>The fix is <dfn data-def="Several points on the ring for one physical server, each hashed from the server's name and a number; the server holds the keys of all its points' arcs.">virtual nodes</dfn>: hash each server onto the ring many times ("B#0", "B#1", …) and give it all its arcs. A share is then the sum of many small random arcs, and sums even out: the spread of the shares falls as 1/√v for v points per server. Slide to 128 points each and every server holds close to 12.5 %.</p>
<p>Virtual nodes also spread a failure: when a server dies its many small arcs go to many different successors instead of doubling the load on one neighbour. And a more powerful machine can simply get more points.</p>`,
			notes: `<p>The ln N comes from the largest of N random gaps on a circle, whose expected size is H<sub>N</sub>/N, with H<sub>N</sub> = 1 + ½ + ⅓ + … + 1/N ≈ ln N + 0.58 (the model tests check it over 40 rings of 1,000 servers). Karger et al. and Stoica et al. both use about log N virtual nodes per server to keep every share within a constant factor of the mean. Amazon's Dynamo and Apache Cassandra used many tokens per node for the same reason; Cassandra's default was 256 for years.</p>`
		},
		// ------------------------------------------------------------------ find
		{
			id: 'walk',
			chapter: 'find',
			title: 'Ask your successor',
			scene: 'lookup',
			hints: { fingers: false },
			duration: 30,
			controls: [nodes, another],
			body: `
<p>So far every client knew every server. A <dfn data-def="Distributed hash table: a key-value lookup service spread over many nodes, where each node knows only a few others and any node can find the node responsible for any key.">distributed hash table</dfn> (DHT) drops that: in a peer-to-peer network of thousands or millions of machines that join and leave all the time, nobody can keep the full list. Each <dfn data-def="One machine taking part in the DHT, with its own identifier on the ring.">node</dfn> knows only a few others, and a lookup is passed from node to node across the <a href="../internet/">internet</a>.</p>
<p>The least a node can know is its successor on the ring. That is already enough: a query for a key goes from successor to successor until it reaches the node the key follows, and that node answers with its successor, which holds the key. Each forward is a <strong>hop</strong>, a message over the network.</p>
<p>It always works, and it is hopeless at scale: a query crosses on average half the ring, N/2 hops. With a million nodes and tens of milliseconds a hop, a lookup would take hours.</p>`,
			notes: `<p>The labels are each node's position on the ring as a number from 0 to 999 (the top bits of its 32-bit identifier); the key's position is shown the same way. The lookup goes clockwise only, because the ring is only ever searched in one direction: a key belongs to its successor.</p>`
		},
		{
			id: 'fingers',
			chapter: 'find',
			title: 'Fingers half way, a quarter, an eighth',
			scene: 'lookup',
			hints: { fingers: true },
			duration: 30,
			controls: [nodes, another],
			body: `
<p><dfn data-def="A distributed hash table published in 2001 by Ion Stoica, Robert Morris, David Karger, Frans Kaashoek and Hari Balakrishnan at MIT: a ring of identifiers, successor lists and finger tables.">Chord</dfn> (Stoica et al., 2001) gives each node a <dfn data-def="A Chord node's routing table: its i-th entry is the first node at or after the node's own identifier plus 2^i, so the entries reach a half, a quarter, an eighth... of the way round the ring.">finger table</dfn>: the first node at least half a turn ahead, at least a quarter, an eighth, and so on down to its successor. That is 32 entries on a 32-bit ring, most of them the same few nodes, so a node knows only about log₂ N others.</p>
<p>A query now jumps to the farthest finger that does not overshoot the key. Each jump at least halves the distance left to the key, so after log₂ N jumps nothing is left. On average it takes about half that, <strong>½ log₂ N hops</strong>: each finger halves the gap, and half the time the next smaller finger would already overshoot. The thin chords are the fingers of the node holding the query.</p>
<p>With 64 nodes the walk round the ring took about 32 hops, and the fingers take about three.</p>`,
			notes: `<p>Why half of log₂ N: write the distance to the key in binary, in units of the gap between nodes. Each hop clears the highest 1 bit; a random distance has 1s in about half of its log₂ N bits. The query stops at the node just before the key, which answers with its successor's address; counting that reply as a hop adds one. Kademlia, the DHT in BitTorrent and IPFS, does the same with a different distance: the XOR of two identifiers, which lets a node learn routes from every query passing through.</p>`
		},
		{
			id: 'scale',
			chapter: 'find',
			title: 'A dozen hops among thousands',
			scene: 'scale',
			duration: 28,
			controls: [size],
			body: `
<p>Here are 2,000 lookups from random nodes to random keys, on Chord rings of 8 up to 16,384 nodes. The mean hop count grows by half a hop each time the network doubles, right along ½ log₂ N, and the band shows the range 98 % of lookups fall in.</p>
<p>At 16,384 nodes a lookup takes about 7 hops on average and 99 in 100 take 11 or fewer, where walking along successors would take 8,192. A million nodes would need about 10. Each node keeps only about log₂ N other nodes in its table and still finds any key in the network in about a dozen messages, with no directory anywhere.</p>`,
			notes: `<p>The same experiment in the Chord paper (Stoica et al., SIGCOMM 2001, section 6.3, up to 2¹⁴ nodes) found the same: a mean path length that grows logarithmically with the number of nodes, at about ½ log₂ N. Hops are not all equal: two nodes next to each other on the ring can be on different continents, so real DHTs prefer fingers that are close on the network too (proximity routing) and a lookup's time is usually dominated by its slowest hop.</p>`
		},
		// ------------------------------------------------------------------ churn
		{
			id: 'heal',
			chapter: 'churn',
			title: 'Healing the ring',
			scene: 'churn',
			hints: { focus: 'ring' },
			duration: 30,
			controls: [successors, fail, rerun],
			body: `
<p>In a real DHT machines crash, and users close their laptops. Each round here, a share of the 24 nodes fails at once (red), before anyone notices. Then the survivors repair: each finds its new successor, fixes its fingers, and new nodes join (green) until the ring is back to 24.</p>
<p>The repair (Chord's <dfn data-def="Chord's periodic repair: each node asks its successor for its predecessor and successor list, so the ring's pointers follow nodes that join and leave.">stabilisation</dfn>) only works if every survivor still knows a live node ahead of it. With one successor each, a node whose successor failed is cut off (orange): the ring has a gap there, and lookups that need to cross it fail. So each node keeps a <strong>successor list</strong>, its next few nodes. The node is cut off only when all of them fail at once: with r successors and a fraction f failing, that's a chance of about fʳ.</p>
<p>Lengthen the list to 4 and, with a quarter of the nodes failing each round, the ring usually comes through all twelve rounds whole. Make half of them fail at once and 4 is no longer enough: the list has to grow with the network, to about 2 log₂ N.</p>`,
			notes: `<p>Stoica et al. prove that with successor lists of length O(log N), lookups still find the right successor with high probability even if every node fails with probability ½ at the same moment. The model tests check it at full size: 1,000 nodes, half of them failing at once, cut about 250 survivors off with one successor each, and none with 20 (2 log₂ N). Real churn is gentler but never stops: measured peer-to-peer nodes stay for minutes to hours, which is why stabilisation runs every few seconds.</p>`
		},
		{
			id: 'replicas',
			chapter: 'churn',
			title: 'Finding is not keeping',
			scene: 'churn',
			hints: { focus: 'keys' },
			duration: 30,
			controls: [copies, fail, rerun],
			body: `
<p>A healed ring still finds where a key should be. Whether the key is still there is another matter: when the node holding it fails, the key is gone, and its new successor has nothing to hand over. With one copy, every round loses about the failing fraction of what is left: the red ticks are keys lost for good.</p>
<p>A DHT finds where a key lives; it does not make the data durable. <dfn data-def="Keeping copies of the same data on several machines, so that it survives the failure of some of them.">Replication</dfn> does: store each key on its successor and the next few nodes after it, the nodes already in the successor list, and re-copy it after each round to restore the count. A key is lost only if all c copies fail in the same round, a chance of about fᶜ.</p>
<p>Raise the copies to 3: with a quarter of the nodes failing each round, only a few of the 48 keys are lost in twelve rounds, and with 4 usually none. That's how DHash, Dynamo and Cassandra keep data: three copies is a common default.</p>`,
			notes: `<p>Copies on consecutive nodes have a weakness: the nodes are random machines, but they fail together if they share a rack or a power supply, so production systems pick the replicas' nodes in different racks or data centres. They must also agree on which copy is current when writes race; that is the business of <a href="../consensus-blockchains/">consensus</a>, which a DHT does not attempt. The model tests: over 10 rounds of 10 % failures among 1,000 nodes, one copy loses about two thirds of 10,000 keys and three copies about 1 %.</p>`
		}
	]
};
