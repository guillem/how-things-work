import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import {
	CHIPS,
	FAST_IPC,
	IMAGE,
	MATRIX_N,
	PIXEL_COST,
	WARP,
	cpuLanesPerCore,
	efficiency,
	elementCost,
	matrixJob,
	measuredSpeedup,
	pixelJob,
	ridge,
	runFast,
	runLanes
} from './gpu';
import { I9_14900K, RTX_4090 } from './specs';

const n = (v: number, digits = 0) =>
	v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// Numbers quoted in the text, from the model itself.
const px = pixelJob();
const pxFast = runFast(px);
const px1024 = runLanes(px, 1024);
const px16k = runLanes(px, 16384);
const mx = matrixJob();
const mxFast = runFast(mx);
const mx16k = runLanes(mx, 16384);
const mixedCost = Math.max(...px.warpCost);
const [cpu, gpu] = CHIPS;

/**
 * Number of slow lanes, as a power of two (32 to 16,384). Each step has its own
 * id, so that the number suggested on one step doesn't carry into the next.
 */
const lanes = (id: string, dflt: number): Control => ({
	type: 'range',
	id,
	label: 'Slow lanes',
	min: 5,
	max: 14,
	step: 1,
	default: dflt,
	format: (v) => `${n(2 ** v)} (${n(2 ** v / WARP)} warp${v === 5 ? '' : 's'})`,
	help: 'Doubles at each notch. Lanes come in warps of 32.'
});

const warpPick: Control = {
	type: 'select',
	id: 'warp',
	label: 'Which warp',
	default: 'edge',
	options: [
		{ value: 'sky', label: '32 pixels of sky' },
		{ value: 'ball', label: '32 pixels of the ball' },
		{ value: 'edge', label: '32 pixels across the edge' }
	]
};

const workload: Control = {
	type: 'select',
	id: 'workload',
	label: 'Job',
	default: 'add',
	options: [
		{ value: 'add', label: 'Add two long lists of numbers' },
		{ value: 'shade', label: 'Shade the pixels' },
		{ value: 'matmul', label: 'Multiply matrices in tiles' }
	]
};

const tile: Control = {
	type: 'range',
	id: 'tile',
	label: 'Tile width',
	min: 0,
	max: 9,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? '1 (no tiles)' : `${n(2 ** v)} × ${n(2 ** v)}`),
	help: 'Each number fetched from memory is used this many times before it is dropped.'
};

const serial: Control = {
	type: 'range',
	id: 'serial',
	label: 'Share that must run in sequence',
	min: 0,
	max: 50,
	step: 1,
	default: 5,
	unit: '%'
};

const workers: Control = {
	type: 'range',
	id: 'workers',
	label: 'Workers',
	min: 0,
	max: 14,
	step: 1,
	default: 10,
	format: (v) => n(2 ** v),
	help: 'Doubles at each notch.'
};

const hybrid: Control = {
	type: 'toggle',
	id: 'hybrid',
	label: 'The fast core does the sequential part',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'gpu',
	title: 'GPUs and parallel computing',
	summary:
		'Race one fast processor core against thousands of slow lanes that move in lockstep, on every pixel of an image and on a matrix multiplication. See what a branch costs a warp, why memory sets the pace, and why the part of a job that must run in order caps the speed-up.',
	chapters: [
		{ id: 'race', title: 'One fast worker, many slow ones' },
		{ id: 'warps', title: 'Lockstep' },
		{ id: 'matrices', title: 'Matrices' },
		{ id: 'chips', title: 'Real chips and memory' },
		{ id: 'limits', title: 'What won’t split' }
	],
	steps: [
		// ------------------------------------------------------------------ race
		{
			id: 'pixels',
			chapter: 'race',
			title: 'The same small program for every pixel',
			scene: 'race',
			hints: { mode: 'solo' },
			duration: 26,
			body: `
<p>To draw a frame of a game or a 3D scene, a computer has to work out the colour of every <dfn data-def="Picture element: one dot of an image, with its own colour.">pixel</dfn>, millions of times a second. The program that does it for one pixel is called a <dfn data-def="A small program that computes the colour of one pixel (or the position of one corner of a shape). It runs once for every pixel.">shader</dfn>.</p>
<p>Here the picture is ${IMAGE.w} × ${IMAGE.h} = ${n(px.tasks)} pixels of a lit ball against the sky. The shader on the right, the same for every pixel, takes the pixel’s position and checks whether it falls on the ball. If it does, it works out how much light that point of the ball catches and adds a shiny highlight (${PIXEL_COST.sphere} instructions); if not, it paints the sky (${PIXEL_COST.sky}).</p>
<p>The key thing: each pixel’s colour depends <strong>only on its own position</strong>. No pixel waits for another, so they could all be done in any order, or all at once.</p>
<p>A single fast core, like one of the <a href="../cpu/#speed">CPU’s</a>, has to do them one after another. It shades the image row by row, and needs ${n(pxFast.cycles)} ticks of its clock.</p>`,
			notes: `<p>This fast core is a toy, with one stated rule: it finishes ${FAST_IPC} instructions per tick. Real CPU cores do something like it: they look ahead in the program and carry out several independent instructions on the same tick, though how many depends a lot on the code.</p>`
		},
		{
			id: 'race',
			chapter: 'race',
			title: 'A race: one fast worker against a thousand slow ones',
			scene: 'race',
			hints: { mode: 'race' },
			duration: 24,
			controls: [lanes('lanes', 10)],
			body: `
<p>Now the same job goes to a <dfn data-def="Graphics processing unit: a chip with thousands of simple arithmetic lanes, built to run the same small program on many pieces of data at once.">GPU</dfn>-like machine: ${n(1024)} slow <dfn data-def="A simple arithmetic unit that works on one piece of data. A GPU lane does what one core would do for one pixel, but has no control unit of its own.">lanes</dfn>. Each lane finishes just one instruction per tick, a quarter of the fast core’s pace, and the two machines run on the same clock.</p>
<p>But a thousand of them work at the same time, each on its own pixel. The fast core has barely started its first rows when the lanes finish: ${n(px1024.cycles)} ticks against ${n(pxFast.cycles)}, about ${n(pxFast.cycles / px1024.cycles)} times faster.</p>
<p>Change the number of lanes. With 32 (one <em>warp</em>, see the next chapter) they are already 7 times faster than the fast core: many slow workers beat one fast one as soon as there is enough work to share.</p>`,
			notes: `<p>The race counts ticks, not seconds: this page’s machines are toys with stated rules, not models of real chips. Real GPUs run their clocks at less than half the rate of a fast CPU (2.5 GHz against 6 GHz for the chips later on this page), and real CPU cores also have a few lanes of their own. The real-chip comparison comes in the chapter on memory.</p>`
		},
		{
			id: 'scale',
			chapter: 'race',
			title: 'More lanes, until the work runs out',
			scene: 'race',
			hints: { mode: 'race' },
			duration: 24,
			controls: [lanes('lanesMany', 14)],
			body: `
<p>With ${n(16384)} lanes, as many as a big graphics card has, the image takes ${n(px16k.cycles)} ticks: about ${n(pxFast.cycles / px16k.cycles)} times faster than the fast core.</p>
<p>But look at the share of lanes kept busy. The ${n(px.tasks)} pixels make only ${n(px.warpCost.length)} groups of 32, for 512 warps: two rounds and a half-full third, so many lanes sit idle at the end. ${n(100 * efficiency(px16k))}% of the lanes’ ticks do work, against ${n(100 * efficiency(px1024))}% with ${n(1024)} lanes.</p>
<p>Thousands of lanes only pay off with a job of many thousands of pieces. A real screen has 2 million pixels or more, redrawn 60 times a second, which is why graphics was the first job GPUs were built for.</p>`
		},
		// ------------------------------------------------------------------ warps
		{
			id: 'warp',
			chapter: 'warps',
			title: 'Thirty-two lanes, one instruction',
			scene: 'warp',
			hints: { mode: 'lockstep' },
			duration: 24,
			body: `
<p>How can a chip hold thousands of lanes? By leaving out most of a processor. A CPU core has its own <a href="../cpu/#decode">control unit</a> that fetches and decodes every instruction, and a lot of circuitry to guess what comes next and keep busy.</p>
<p>A GPU shares one control unit between 32 lanes, a <dfn data-def="A group of 32 lanes that share one instruction stream: on every tick, they all carry out the same instruction, each on its own data. NVIDIA's name; AMD's is a wavefront.">warp</dfn>. The control unit fetches one instruction and all 32 lanes carry it out on the same tick, each on its own pixel: the same <em>dx = x − cx</em>, with 32 different x. This is called <dfn data-def="Single instruction, multiple threads: many lanes run the same instruction at the same time, each with its own data.">SIMT</dfn>, single instruction, multiple threads.</p>
<p>Here, 32 pixels of the ball go through the shader in lockstep: ${PIXEL_COST.sphere} ticks for all 32 of them.</p>`,
			notes: `<p>NVIDIA’s CUDA Programming Guide: “Within a thread block, threads are organized into groups of 32 threads called warps.” Each SM (streaming multiprocessor) of the RTX 4090 has four warp schedulers, each feeding 32 lanes (NVIDIA Ada architecture whitepaper). While one warp waits for data from memory, the scheduler switches to another one that is ready, so an SM keeps dozens of warps on the go at once.</p>`
		},
		{
			id: 'divergence',
			chapter: 'warps',
			title: 'A branch splits the warp',
			scene: 'warp',
			hints: { mode: 'divergence' },
			duration: 30,
			controls: [warpPick],
			body: `
<p>The shader has an <em>if</em>: ball or sky. What happens when some of a warp’s pixels are on the ball and the others are in the sky?</p>
<p>The lanes can’t go different ways, because they share one instruction stream. So the warp runs <strong>both</strong> sides, one after the other, with the lanes that don’t belong to a side switched off. This is <dfn data-def="When the lanes of a warp disagree on a branch, so the warp runs every side that any lane takes, one after the other, with the other lanes idle.">divergence</dfn>.</p>
<p>A warp across the edge needs ${mixedCost} ticks, more than the ${PIXEL_COST.sphere} of a warp on the ball and the ${PIXEL_COST.sky} of one in the sky, and many of its lanes sit idle for part of it. The map shows that it only happens along the edge of the ball, where a warp’s 32 pixels disagree. The fast core never pays this: each pixel takes only its own branch.</p>`,
			notes: `<p>NVIDIA’s guide: “When different threads in a warp follow different code paths, this is sometimes called warp divergence”, and the GPU is best used “when threads within a warp follow the same control flow path”. Programmers avoid long branches in shaders for exactly this reason; a job full of unpredictable branches (searching a tree, say) suits a CPU better.</p>`
		},
		// ------------------------------------------------------------------ matrices
		{
			id: 'matmul',
			chapter: 'matrices',
			title: 'Multiplying matrices: the perfect job',
			scene: 'race',
			hints: { mode: 'matrix' },
			duration: 26,
			controls: [lanes('lanesMatrix', 14)],
			body: `
<p>The second job: multiply two ${MATRIX_N} × ${MATRIX_N} <a href="../linear-transformations/#compose">matrices</a>, A·B = C. Each of the ${n(mx.tasks)} numbers of C is a row of A times a column of B: ${MATRIX_N} multiplications, added up (${n(elementCost(MATRIX_N))} instructions with the loads and the store).</p>
<p>It is the ideal job for lanes. Every element can be worked out independently, all of them run exactly the same instructions, and there is no branch at all, so no lane ever idles. With ${n(16384)} lanes, all ${n(mx.tasks)} elements are worked out at once, in the time of one: ${n(mx16k.cycles)} ticks, against ${n(mxFast.cycles)} for the fast core. That is exactly ${n(16384 / FAST_IPC)} times faster: lanes ÷ ${FAST_IPC}.</p>
<p>This is why GPUs now run artificial intelligence. A <a href="../neural-networks/">neural network</a>’s layers, and the attention of a <a href="../transformers/#matrix">transformer</a>, are matrix multiplications, millions of times over.</p>`,
			notes: `<p>Multiplying two n × n matrices takes n³ multiply-adds, so doubling n makes eight times the work, while the number of independent elements, n², only grows four times. Large networks keep thousands of lanes busy without trouble.</p>`
		},
		// ------------------------------------------------------------------ real chips
		{
			id: 'chips',
			chapter: 'chips',
			title: 'A real CPU and a real GPU',
			scene: 'roofline',
			hints: { mode: 'chips' },
			duration: 26,
			body: `
<p>Two real chips from 2022–23. The Intel Core i9-14900K desktop processor has ${I9_14900K.cores} cores (${I9_14900K.performanceCores} big and ${I9_14900K.efficientCores} small), up to ${I9_14900K.maxTurboGHz} GHz. The NVIDIA GeForce RTX 4090 graphics card has ${RTX_4090.sms} <dfn data-def="Streaming multiprocessor: the GPU's building block, with its own warp schedulers, lanes and fast local memory. Roughly the GPU's counterpart of a core.">SMs</dfn>, each with 4 warp schedulers of 32 lanes: ${n(RTX_4090.cudaCores)} lanes at ${RTX_4090.boostGHz} GHz.</p>
<p>NVIDIA calls those lanes “CUDA cores”, but they are not cores in the CPU’s sense: they don’t fetch their own instructions. The fair count is ${I9_14900K.cores} CPU cores against ${RTX_4090.sms} SMs. And the CPU’s cores have lanes of their own: Intel’s published figure works out to ${n(cpuLanesPerCore)} 32-bit multiply-adds per core per tick, on average.</p>
<p>At full speed the GPU does about <strong>${n(gpu.peak / 1000, 1)} trillion</strong> arithmetic operations a second, the CPU about ${n(cpu.peak / 1000, 1)} trillion: ${n(gpu.peak / cpu.peak)} times more. The GPU spends its transistors on lanes; the CPU spends them on making a few threads fast.</p>`,
			notes: `<p>Figures from NVIDIA’s Ada GPU architecture whitepaper (V2.02, Appendix A: 128 SMs, 16,384 CUDA cores, 2,520 MHz boost clock, 82.6 TFLOPS FP32, 1,008 GB/s) and Intel’s specification page for the i9-14900K (24 cores, 6 GHz, 89.6 GB/s). The GPU’s peak is every lane doing one multiply-add (2 operations) per tick: 16,384 × 2 × 2.52 GHz = 82.6 trillion. Intel publishes 1,228.8 billion 64-bit operations a second for this CPU in its export-compliance table (24 cores × 3.2 GHz × 16); an AVX2 register holds eight 32-bit numbers instead of four 64-bit ones, so twice that for 32-bit numbers is our estimate. In 64-bit numbers the tables turn: the RTX 4090 does them at 1/64 of its 32-bit rate, about 1.3 trillion a second, no faster than the CPU.</p>`
		},
		{
			id: 'memory',
			chapter: 'chips',
			title: 'Feeding the lanes: memory sets the pace',
			scene: 'roofline',
			hints: { mode: 'roof' },
			duration: 28,
			controls: [workload],
			body: `
<p>Arithmetic is only half the story: the numbers have to come from memory. The RTX 4090 moves ${n(RTX_4090.bandwidthGBs)} GB a second between its memory and its lanes, the CPU ${n(I9_14900K.bandwidthGBs)} GB/s. That is ${n(gpu.bandwidth / cpu.bandwidth)} times more, but far less than the ${n(gpu.peak / cpu.peak)} times more arithmetic.</p>
<p>This chart, a <dfn data-def="A chart of the best speed a chip can reach against how many operations a job does per byte it moves: a sloping line where memory limits it, a flat roof where arithmetic does.">roofline</dfn>, shows the consequence. Across: how many operations a job does per byte it reads or writes. Up: the most it can get done each second. A job that does little arithmetic per byte runs along the sloping line, waiting for memory; only past the bend does it reach the flat roof of full arithmetic speed.</p>
<p>Adding two long lists of numbers does one addition per 12 bytes: on the GPU it gets about 84 billion operations a second, a thousandth of its peak. Our pixel shader does about 4 per byte and still waits for memory. Try the jobs.</p>`,
			notes: `<p>The roofline model is from S. Williams, A. Waterman and D. Patterson, “Roofline: an insightful visual performance model for multicore architectures”, <em>Communications of the ACM</em> 52(4), 2009. The bend sits at peak ÷ bandwidth: about ${n(ridge(gpu))} operations per byte for the RTX 4090 and ${n(ridge(cpu))} for the i9-14900K. Real chips keep recent data in caches, which a measured roofline adds as extra, steeper lines.</p>`
		},
		{
			id: 'tiles',
			chapter: 'chips',
			title: 'Reuse every number: tiles',
			scene: 'roofline',
			hints: { mode: 'roof', job: 'matmul' },
			duration: 28,
			controls: [tile],
			body: `
<p>A matrix multiplication done naively fetches two numbers from memory for each multiply-add, and lands on the sloping line. But every number of A is needed by a whole row of C, and every number of B by a whole column.</p>
<p>So GPU programs work in <dfn data-def="A small square block of a matrix, loaded once into the SM's fast local memory and reused for many multiply-adds.">tiles</dfn>: an SM loads a block of A and a block of B into its fast local memory once, and uses each number many times. A tile b wide does b/4 operations per byte. Widen the tile and watch the job climb the slope until it hits the roof.</p>
<p>Matrix multiplication is one of the few jobs that can be made to do a lot of arithmetic per byte, which is why it runs so close to a GPU’s peak, and why AI is built from it.</p>`,
			notes: `<p>A tile of b × b reuses each number b times: a block of b rows of A and b columns of B (2·b·n numbers, 4 bytes each) feeds 2·b²·n operations, so b/4 operations per byte. Real libraries reach very wide effective tiles by also keeping numbers in each lane’s registers and in the shared L2 cache, rather than with one huge tile. The RTX 4090 also has <dfn data-def="Units inside each SM that multiply small blocks of matrices in one go, much faster than the ordinary lanes.">tensor cores</dfn> built only for this: 165.2 trillion operations a second on 16-bit numbers, that is 82.6 trillion multiply-adds (NVIDIA’s figure without its “sparsity” doubling), twice its ordinary peak.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'amdahl',
			chapter: 'limits',
			title: 'The part that must wait its turn',
			scene: 'amdahl',
			hints: { mode: 'curve' },
			duration: 28,
			controls: [serial, workers],
			body: `
<p>Most real jobs have a part that can’t be split: reading the input, setting up, combining the results, a step that needs the one before. That part runs on one worker however many you have.</p>
<p>Give the matrix job a part like that and run it on more and more workers. The dots are the measured speed-ups, the ticks for one worker divided by the ticks for many. With 5% in sequence, ${n(1024)} workers are only ${n(measuredSpeedup(0.05, 1024).speedup, 1)} times faster than one, and ${n(16384)} only ${n(measuredSpeedup(0.05, 16384).speedup, 1)} times.</p>
<p>The measurements follow a simple formula, <dfn data-def="The speed-up on N workers of a job whose share s must run in sequence: 1 / (s + (1 − s) / N). It can never exceed 1 / s.">Amdahl’s law</dfn>: speed-up = 1 / (s + (1 − s) / N), for a share s in sequence and N workers.</p>`,
			notes: `<p>Gene Amdahl, “Validity of the single processor approach to achieving large scale computing capabilities”, AFIPS Spring Joint Computer Conference, 1967. The law assumes the job stays the same size. If more workers are given a bigger job instead (a larger image in the same time), the parallel part grows and the speed-up keeps rising: that is Gustafson’s law (1988), and it is how GPUs are mostly used.</p>`
		},
		{
			id: 'ceiling',
			chapter: 'limits',
			title: 'A ceiling, and when the fast core wins',
			scene: 'amdahl',
			hints: { mode: 'contest' },
			duration: 30,
			controls: [serial, workers, hybrid],
			body: `
<p>Make the serial share bigger and watch the curve flatten against its ceiling, <strong>1 ÷ s</strong>. Even with infinitely many workers, the parallel part shrinks to nothing but the serial part is still there: with 5% in sequence, no number of workers ever goes beyond 20 times faster.</p>
<p>The bars race the fast core against the slow lanes on this job. Push the serial share past about a quarter and the fast core wins: the lanes do the serial part one instruction per tick, and the fast core is ${FAST_IPC} times quicker at it.</p>
<p>That is why a computer has both. Switch on <em>The fast core does the sequential part</em>: the CPU runs what can’t be split and hands the rest to the GPU, and the pair beats either alone.</p>`
		},
		{
			id: 'takeaway',
			chapter: 'limits',
			title: 'Few fast cores, or thousands of simple ones',
			scene: 'roofline',
			hints: { mode: 'chips', takeaway: true },
			duration: 26,
			body: `
<p>A CPU spends its chip on a few fast, flexible cores: each runs its own program, follows its branches cheaply and gets through work that must happen in order quickly.</p>
<p>A GPU spends it on thousands of simple lanes that share their control units and move in lockstep, in warps of 32. Each is slow, but together they do ${n(gpu.peak / cpu.peak)} times more arithmetic.</p>
<p><strong>A GPU wins whenever a job splits into many identical, independent pieces:</strong> many, to keep thousands of lanes busy; identical, so that a warp’s lanes don’t diverge; independent, so that nothing waits in sequence. Pixels of an image and elements of a matrix product are exactly that.</p>`
		}
	]
};
