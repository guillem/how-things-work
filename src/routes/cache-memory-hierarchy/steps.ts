import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { L2_SIZES, LAB, MATMUL, PATTERNS, bytes } from './model';

const sizeValues = () => LAB.sizes;
const waysLabel = (v: number) =>
	v === 0 ? 'fully associative' : v === 1 ? 'direct-mapped (1 way)' : `${v} ways`;
/** The ways control works on indexes into LAB.ways, so "fully associative" sits at the right end. */
const WAYS = LAB.ways;

const line: Control = {
	type: 'range',
	id: 'line',
	label: 'Line length',
	min: LAB.lines[0],
	max: LAB.lines[LAB.lines.length - 1],
	step: 1,
	default: 64,
	values: () => LAB.lines,
	format: (v) => `${v} bytes (${v / 8} numbers)`
};

const size: Control = {
	type: 'range',
	id: 'size',
	label: 'Cache size',
	min: LAB.sizes[0],
	max: LAB.sizes[LAB.sizes.length - 1],
	step: 1,
	default: 512,
	values: sizeValues,
	format: (v) => bytes(v)
};

const ways: Control = {
	type: 'range',
	id: 'ways',
	label: 'Associativity',
	min: 0,
	max: WAYS.length - 1,
	step: 1,
	default: 0,
	format: (i) => waysLabel(WAYS[i])
};

const order: Control = {
	type: 'select',
	id: 'order',
	label: 'Order',
	default: 'col',
	options: [
		{ value: 'row', label: 'Row by row' },
		{ value: 'col', label: 'Column by column' }
	]
};

const csize: Control = { ...size, id: 'csize', label: 'Cache size' };
const cways: Control = { ...ways, id: 'cways', default: 0 };

const policy: Control = {
	type: 'select',
	id: 'policy',
	label: 'Replacement',
	default: 'lru',
	options: [
		{ value: 'lru', label: 'LRU' },
		{ value: 'fifo', label: 'FIFO' },
		{ value: 'random', label: 'Random' }
	],
	help: 'Which line of a full set to throw out: the least recently used, the oldest, or any.'
};

const rways: Control = { ...ways, id: 'rways', default: WAYS.length - 1 };

const alloc: Control = {
	type: 'select',
	id: 'alloc',
	label: 'Nodes',
	default: 'scattered',
	options: [
		{ value: 'list', label: 'In order' },
		{ value: 'scattered', label: 'Scattered' }
	]
};

const block: Control = {
	type: 'range',
	id: 'block',
	label: 'Tile size',
	min: MATMUL.blocks[0],
	max: MATMUL.blocks[MATMUL.blocks.length - 1],
	step: 1,
	default: 12,
	values: () => MATMUL.blocks,
	format: (v) => `${v} × ${v} numbers (${bytes(v * v * 8)})`
};

const withL2: Control = {
	type: 'toggle',
	id: 'withL2',
	label: 'L2 cache (256 KB)',
	default: true
};

const l2: Control = { type: 'toggle', id: 'l2', label: 'Add an L2 cache', default: false };
const l2size: Control = {
	type: 'range',
	id: 'l2size',
	label: 'L2 size',
	min: L2_SIZES[0],
	max: L2_SIZES[L2_SIZES.length - 1],
	step: 1,
	default: 256 * 1024,
	values: () => L2_SIZES,
	format: (v) => bytes(v),
	disabled: (p) => p.l2 !== true
};

const pattern: Control = {
	type: 'select',
	id: 'pattern',
	label: 'Program',
	default: 'matmul',
	options: PATTERNS
};

/**
 * Scenes: `ladder` (the latency of each level, loads racing to each), `lab` (a small cache and
 * the memory it serves, one access at a time; hints name the program and, for each cache
 * setting, a fixed value or `@param` for a control: `size`, `line`, `ways` (an index into
 * WAYS), `policy`; `focus` 'address' shows how an address splits), `matmul` (the matrix product
 * plain and tiled), `bills` (four programs on the measured chip) and `knee` (latency against
 * working-set size, with an optional L2).
 */
export const spec: ExplainerSpec = {
	slug: 'cache-memory-hierarchy',
	title: 'Caches and the memory hierarchy',
	summary:
		'Run programs through a cache one load at a time and watch lines arrive, hit and get thrown out. Sum a matrix by rows and by columns, make a direct-mapped cache thrash, loop one line too far, chase a scattered list, tile a matrix product, and see where the latency curve breaks when you add an L2.',
	chapters: [
		{ id: 'far', title: 'Memory is far away' },
		{ id: 'inside', title: 'Inside a cache' },
		{ id: 'programs', title: 'Programs and their bills' },
		{ id: 'levels', title: 'Levels' }
	],
	steps: [
		// ------------------------------------------------------------------ far
		{
			id: 'wait',
			chapter: 'far',
			title: 'One cycle, or two hundred and fifty',
			scene: 'ladder',
			duration: 26,
			body: `
<p>On the <a href="../cpu/">CPU page</a> memory answers in the same tick it is asked. A real processor is not so lucky. An Intel Core i7-6700 runs at 4 GHz, a cycle every quarter of a nanosecond, and a load from its main memory (<dfn data-def="Dynamic RAM: the main memory of a computer, gigabytes of capacitors on separate chips, each bit refreshed many times a second.">DRAM</dfn>) takes about 250 cycles to come back.</p>
<p>So between the processor and DRAM sit <dfn data-def="A small, fast memory that keeps copies of recently used parts of main memory, so most loads don't have to go all the way.">caches</dfn>: small memories of fast <dfn data-def="Static RAM: memory built from six-transistor flip-flops on the processor chip itself; fast, but large and power-hungry per bit.">SRAM</dfn> on the processor's own chip. The closer one is to the core, the smaller and faster: L1 holds 32 KB and answers in 4 cycles, L2 256 KB in 12, L3 8 MB in 42.</p>
<p>The race shows one load sent to each level at once. By the time the DRAM one is back, the L1 has served sixty in a row. A processor that had to wait 250 cycles on every load would do almost nothing but wait.</p>`,
			notes: `<p>All the figures on this page are one chip's: the Core i7-6700 (Skylake, 2015) as measured by 7-cpu.com with chains of dependent loads. L1 4 cycles (5 when the address takes a calculation), L2 12, L3 42, and DRAM 42 cycles + 51 ns, which at 4 GHz is about 250 cycles. Other chips differ in the details (L2s of 1–2 MB are common now, and an L3 can take 50–70 cycles), not in the shape: every step down is several times slower and several times bigger.</p>`
		},
		{
			id: 'lines',
			chapter: 'far',
			title: 'Memory moves in lines',
			scene: 'lab',
			hints: { pattern: 'row', size: 512, line: '@line', ways: 0, policy: 'lru' },
			duration: 30,
			controls: [line],
			body: `
<p>Here is a cache cut down to 512 bytes so every part fits on the screen, and a 16 × 16 matrix of 8-byte numbers (2 KB) that a program sums one number at a time, row by row.</p>
<p>The cache never fetches one number. It fetches a whole <dfn data-def="Cache line (or block): the fixed-size, aligned chunk of memory a cache stores and moves as a unit; 64 bytes on nearly every current processor.">line</dfn>, 64 consecutive bytes, aligned to a multiple of 64. The first number of each line is a <strong>miss</strong> (red): the processor waits while the line comes from memory. The next seven are already there: <strong>hits</strong> (green). One load in eight misses.</p>
<p>This is <dfn data-def="Spatial locality: a program that used one address will probably soon use the addresses next to it.">spatial locality</dfn>, and the line is how the cache bets on it. The bet costs nothing extra: a miss takes as long to bring 64 bytes as it would to bring 1, because the slow part is finding the row in DRAM, not moving the bytes. Shorten the line to 16 bytes and the same sum misses on every second load.</p>`,
			notes: `<p>Each memory cell here is one 8-byte number; the grey ticks are the line boundaries, and a tinted cell is one whose line is in the cache right now. Average memory access time (AMAT, below the cache) counts every access at the latency of the level that answered: 4 cycles for a hit, 250 for a miss that goes to DRAM, as on the measured chip. The cache is shrunk 64 times from a real L1 so that the matrix (2 KB) is bigger than it, as real data is bigger than a real L1. Real processors also <em>prefetch</em>: they notice a run of misses to consecutive lines and fetch the next ones ahead. This simulator doesn't, so that each miss shows; prefetching hides much of the cost of an orderly walk like this one, and none of the cost of the scattered ones later.</p>`
		},
		// ------------------------------------------------------------------ inside
		{
			id: 'address',
			chapter: 'inside',
			title: 'Where a line may go: sets, tags and ways',
			scene: 'lab',
			hints: {
				pattern: 'row',
				size: 512,
				line: 64,
				ways: '@ways',
				policy: 'lru',
				focus: 'address'
			},
			duration: 30,
			controls: [ways],
			body: `
<p>To answer in 4 cycles a cache can't search all its lines. It splits each address into three fields. The low bits are the <strong>offset</strong> of the byte inside its line (6 bits for 64 bytes). The next bits pick a <dfn data-def="A group of cache slots; a given line can only be stored in the set its address selects.">set</dfn>, the only place that line may live. The rest, the <dfn data-def="The high bits of an address, stored with a line so the cache can tell which of the many lines sharing a set it holds.">tag</dfn>, is stored with the line to say which of the many lines that share the set it is.</p>
<p>Each set holds a few lines, its <dfn data-def="The slots of one set. An n-way cache can keep n lines that share a set at once.">ways</dfn>. With one way the cache is <strong>direct-mapped</strong>: every line has exactly one slot, and checking it is a single comparison. With every slot in one set it is <strong>fully associative</strong>: a line may go anywhere, but every tag must be compared at once. Real L1s sit in between: the measured chip's has 64 sets of 8 ways.</p>
<p>Slide the associativity and watch the same 8 lines rearrange into 8, 4, 2 or 1 sets: the sum doesn't care, every line is used up before it is thrown out.</p>`,
			notes: `<p>With 512 bytes in 64-byte lines there are 8 slots: 8 sets of 1 way, 4 of 2, 2 of 4, or 1 of 8. The set index is the line number modulo the number of sets, so with 8 sets it is bits 6–8 of the address; the tag is the bits above. Real L1 caches compare the tags of all ways of a set in parallel, in the same cycle as they read the data, which is why they rarely go beyond 8 or 12 ways.</p>`
		},
		{
			id: 'columns',
			chapter: 'inside',
			title: 'Row by row or column by column',
			scene: 'lab',
			hints: { pattern: '@order', size: '@size', line: 64, ways: '@ways', policy: 'lru' },
			duration: 34,
			controls: [order, size, ways],
			body: `
<p>Now sum the same matrix column by column. It's the same 256 additions with the same result. But a matrix is stored row after row, so going down a column jumps 128 bytes at each step, two lines further on. Every load is in a different line, and it brings in seven neighbours this walk won't use until the next column.</p>
<p>By then they are gone. The column touches 16 lines and the cache holds 8, so each line is thrown out before the walk comes back to it: every one of the 256 loads misses, eight times the misses of the row walk, and the average access costs 250 cycles instead of 35.</p>
<p>Double the cache to 1 KB: if it is fully associative, the column's 16 lines now fit, the next seven columns hit, and the walk is as cheap as the row walk. Make that 1 KB cache direct-mapped and it misses on every load again. The column's lines all have even numbers, so they use only half the sets.</p>`,
			notes: `<p>This is why C and Python's NumPy (row-major) want the last index in the inner loop, and Fortran and MATLAB (column-major) the first. Compilers can sometimes swap the loops for you (loop interchange), but only when they can prove the result is the same. At full size the gap is as wide: summing a 1024 × 1024 matrix (8 MB) on the measured chip's caches costs 35 cycles a load by rows and 250 by columns (the "bills" step later).</p>`
		},
		{
			id: 'conflict',
			chapter: 'inside',
			title: 'A bigger cache that still thrashes',
			scene: 'lab',
			hints: { pattern: 'dot', size: '@csize', line: 64, ways: '@cways', policy: 'lru' },
			duration: 30,
			controls: [csize, cways],
			body: `
<p>A program computes a · b, adding up a[i] × b[i] over two arrays of 32 numbers. The arrays happen to sit exactly one cache size apart, as large arrays often do when their sizes are powers of two. In a direct-mapped cache a[i] and b[i] then fall in the same set: loading b[i] throws out the line holding a[i] and the seven numbers after it, and loading a[i + 1] throws out b's.</p>
<p>Every load misses, though the cache is nearly empty. Make the cache bigger: b still starts one cache size after a, and it still misses every time. A bigger cache is not always better. Give it two ways instead, and both lines fit in the same set: one load in eight misses, as for a single array.</p>
<p>These are <strong>conflict misses</strong>. Misses come in three kinds (the three Cs): <strong>compulsory</strong>, the first touch of a line, which no cache avoids; <strong>capacity</strong>, when the data doesn't fit; and <strong>conflict</strong>, when it would fit, but too many lines want the same set. The bar below the cache sorts them.</p>`,
			notes: `<p>A miss is counted as a capacity miss when a fully associative LRU cache of the same size would also have missed, and as a conflict miss when it would have hit (Mark Hill's classification; Hill and Smith, IEEE Transactions on Computers, 1989). At full size the same trap catches a 1 MB direct-mapped cache: the model tests run it from 4 KB to 1 MB and every load misses. It's one reason real caches have several ways, and why programmers pad arrays so their sizes are not exact powers of two.</p>`
		},
		{
			id: 'replacement',
			chapter: 'inside',
			title: 'One line too many',
			scene: 'lab',
			hints: { pattern: 'loop', size: 512, line: 64, ways: '@rways', policy: '@policy' },
			duration: 30,
			controls: [policy, rways],
			body: `
<p>When a set is full, something has to go. The usual rule is to throw out the <dfn data-def="Least recently used: evict the line whose last use is furthest in the past.">least recently used</dfn> line, a bet on <dfn data-def="Temporal locality: a program that used an address will probably use it again soon.">temporal locality</dfn>: what was used lately will be used again.</p>
<p>Here a program loops four times over a table one line bigger than the cache, reading one number per line. The loop needs 9 lines and the cache has 8. Under LRU every load misses, on every lap: the line it needs next is always the one it used longest ago, which is exactly the one LRU just threw out. FIFO, first in first out, does the same.</p>
<p>Switch to <strong>random</strong> replacement and most loads hit after the first lap: throwing out any line but the right one leaves the rest in place. Or make the cache direct-mapped: the 9th line shares a set with the 1st, and only those two keep missing. On this loop the "worst" cache beats the "best". These misses are capacity misses: the table doesn't fit, and no arrangement of 8 slots holds 9 lines.</p>`,
			notes: `<p>The ideal policy throws out the line that will be needed furthest in the future (Bélády, 1966). It needs to know the future, so real caches approximate LRU with a few bits per set (pseudo-LRU), and some recent ones add a little randomness or insert new lines as "likely to go next" to resist exactly this kind of loop. With a fully associative cache the three replacement rules differ; with one way there is nothing to choose.</p>`
		},
		// ------------------------------------------------------------------ programs
		{
			id: 'list',
			chapter: 'programs',
			title: 'Chasing pointers',
			scene: 'lab',
			hints: { pattern: '@alloc', size: 512, line: 64, ways: 1, policy: 'lru' },
			duration: 30,
			controls: [alloc],
			body: `
<p>A linked list keeps each value in a <em>node</em> with the address of the next node: here 128 nodes of 16 bytes, four to a line. Walk it from the head and add the values.</p>
<p>If the nodes were allocated one after another they sit in order: the walk reads four nodes from each line, one load in four misses. But a list that has grown and shrunk for a while has its nodes scattered. Then the next node is usually in a line the walk hasn't touched lately: three loads in four miss here, and more than 99 % in a list too big for the cache.</p>
<p>It's worse than the count suggests. A real processor can have several misses in flight at once, as long as it knows the addresses: an array walk can ask for the next lines while it waits. A list can't. The address of the next node is <em>inside</em> the node it is waiting for, so every miss waits its full 250 cycles alone.</p>`,
			notes: `<p>At full size, 262,144 nodes (4 MB) on the measured chip's L1 and L2: in order, one load in four misses, 66 cycles per node on average; scattered, more than 99 % miss, about 240 cycles per node. That's why pointer chasing is the standard way to <em>measure</em> memory latency (the next chapter), and why programs that need speed store their data in arrays, even for structures that are lists or trees in the mind.</p>`
		},
		{
			id: 'tiles',
			chapter: 'programs',
			title: 'Multiplying matrices in tiles',
			scene: 'matmul',
			duration: 34,
			controls: [block],
			body: `
<p>C = A × B for two 120 × 120 matrices is 1.7 million multiply-adds, C[i][j] += A[i][k] × B[k][j]. Done in the textbook order, each C[i][j] walks a row of A (by rows, fine) and a <em>column</em> of B, 120 lines tall. A column of B is 7.5 KB: it doesn't fit in this 4 KB cache, so B misses on every load, and the product spends 287 cycles per multiply-add waiting for memory.</p>
<p><dfn data-def="Blocking (tiling): reordering a loop so it works on a small sub-block of the data at a time, reusing it while it is in the cache before moving on.">Tiling</dfn> cuts B into small square tiles and finishes all the work that needs one tile before loading the next: every row of A passes over the tile while it stays in the cache. Same multiplications, same result, in a different order.</p>
<p>With tiles of 12 × 12 numbers (1.1 KB) the misses fall about 40 times and the cost to about 15 cycles a multiply-add. Too small a tile and the lines of A it meets are half used; too big and the tile no longer fits.</p>`,
			notes: `<p>The cache here is a 4 KB L1 (8 ways, 64-byte lines), an eighth of the real one, so that the 3.5 million loads can be simulated in your browser; misses go to DRAM at 250 cycles. The same happens on the real 32 KB L1 with matrices about three times wider. The matrices are 120 wide rather than 128 on purpose: with a power-of-two width every row of a tile falls in the same few sets and tiling suffers conflict misses (Lam, Rothberg and Wolf, "The cache performance and optimizations of blocked algorithms", ASPLOS 1991). Fast libraries (BLAS) tile for every level, L1, L2 and L3, and the same idea feeds a GPU's lanes from its fast shared memory (<a href="../gpu/#tiles">the GPU page</a>).</p>`
		},
		{
			id: 'bills',
			chapter: 'programs',
			title: 'Same sums, different bills',
			scene: 'bills',
			duration: 28,
			controls: [withL2],
			body: `
<p>Back to full size, on the measured chip's 32 KB L1 and 256 KB L2. Each bar is one program, split by where its loads were answered, and labelled with the <dfn data-def="Average memory access time: the mean number of cycles a load takes, counting each at the latency of the level that answered it. For one level, hit time + miss rate × miss penalty.">average memory access time</dfn>.</p>
<p>Summing a 1024 × 1024 matrix row by row: 1 load in 8 misses, 35 cycles a load on average. Column by column: the same million additions, every load from DRAM, 250 cycles, seven times the bill. A list of 262,144 nodes: 66 cycles a node in order, 240 scattered.</p>
<p>The L2 doesn't rescue any of them: an 8 MB matrix and a 4 MB list don't fit in 256 KB either, so the misses go through it to DRAM. Turn it off and almost nothing changes. Only the order in which a program touches memory changes the bill.</p>`,
			notes: `<p>AMAT = hit time + miss rate × miss penalty, applied level by level: with L1 at 4 cycles and DRAM at 250, a miss rate of 1/8 gives 4 + (250 − 4)/8 ≈ 35 cycles. This counts every load as if it waited alone. Real cores overlap independent misses (an out-of-order core can have about ten L1 misses in flight) and prefetch orderly walks, so the row sum runs nearer to its arithmetic speed, and the column sum and the scattered list pay more of their bill. The order of the bars stays the same.</p>`
		},
		// ------------------------------------------------------------------ levels
		{
			id: 'knee',
			chapter: 'levels',
			title: 'Where the curve breaks',
			scene: 'knee',
			duration: 32,
			controls: [l2, l2size],
			body: `
<p>To measure a memory hierarchy, chase pointers through a working set of a given size, in random order, over and over, and time the loads. Each load must wait for the one before, so nothing hides the latency.</p>
<p>Up to 32 KB the whole set fits in L1 and every load takes 4 cycles. One step past, and every load misses: with LRU, a loop that doesn't fit misses every time, as two steps ago. The curve has a <strong>knee</strong> at the size of the cache, and climbs straight to DRAM.</p>
<p>Add an L2. Between 32 KB and its size, loads now come from L2 at 12 cycles, and the knee to DRAM moves out to the L2's size. Make the L2 bigger and the knee moves further. Summing in order (dashed) breaks at the same places, but only one load in eight pays.</p>`,
			notes: `<p>This is lmbench's <code>lat_mem_rd</code> (McVoy and Staelin, 1996), and how 7-cpu.com measured the figures on this page. Measured curves bend rather than break: real caches use pseudo-LRU and hash their sets, the page tables (TLB) add their own steps, and the L3, left out here, adds a step at 8 MB. The measured chip's curve rises from 4 to 12 cycles past 32 KB, to about 42 past 256 KB and to about 250 past 8 MB.</p>`
		},
		{
			id: 'lab',
			chapter: 'levels',
			title: 'Your turn: build a cache',
			scene: 'lab',
			hints: {
				pattern: '@pattern',
				size: '@size',
				line: '@line',
				ways: '@ways',
				policy: '@policy'
			},
			duration: 40,
			controls: [pattern, size, line, ways, policy],
			body: `
<p>Every program of the page, on a cache you build: size, line length, associativity and replacement rule. Things to try:</p>
<ul>
<li>Multiply the 8 × 8 matrices plainly and in 4 × 4 tiles, on a fully associative 512-byte cache, then make it direct-mapped.</li>
<li>Find a cache on which the column sum is as cheap as the row sum.</li>
<li>Make the loop one line too many hit, without changing the cache's size.</li>
</ul>
<p>The takeaway of the whole page is in the plot: the same arithmetic, with the bill set by the order in which memory is touched and by how well that order suits the cache.</p>`,
			notes: `<p>On this small a cache the tiled product isn't always better: with few ways, A, B and C collide in the same sets. The full-size results of the earlier steps are computed with the same simulator, and the model tests check its counts against what a cache must do: one miss per line, conflict misses at any size, LRU missing every load of a loop one line too big.</p>`
		}
	]
};
