/**
 * Published figures for one real CPU and one real GPU, both from 2022–23, for
 * the "real chips" and roofline steps. Every number below is copied from the
 * vendor's own document; derived figures are computed in `gpu.ts` and checked
 * against these in `e2e/gpu-model.e2e.ts`.
 *
 * GPU: NVIDIA GeForce RTX 4090 (AD102).
 *   NVIDIA, "NVIDIA Ada GPU Architecture" whitepaper, V2.02.
 *   https://images.nvidia.com/aem-dam/Solutions/Data-Center/l4/nvidia-ada-gpu-architecture-whitepaper-v2.1.pdf
 *   Appendix A, Table 2 (GeForce RTX 4090 column): 128 SMs, 128 CUDA cores per
 *   SM, 16,384 CUDA cores, GPU boost clock 2,520 MHz, peak FP32 TFLOPS
 *   (non-Tensor) 82.6, peak FP16 Tensor TFLOPS with FP32 accumulate 165.2 (the
 *   330.4 printed beside it is "with sparsity"), memory interface 384-bit,
 *   21 Gbps, memory bandwidth 1,008 GB/s, 76.3 billion transistors. Footnote 1:
 *   "Peak rates are based on GPU Boost Clock." "AD10x SM" section: each SM is
 *   four partitions, each with one warp scheduler and 32 FP32-capable CUDA
 *   cores (16 FP32 + 16 FP32/INT32). AD102 note: FP64 runs at 1/64 of the FP32
 *   rate.
 *
 * Warps: NVIDIA, "CUDA Programming Guide", section 1.2.2.2 "Warps and SIMT":
 *   "Within a thread block, threads are organized into groups of 32 threads
 *   called warps." "When different threads in a warp follow different code
 *   paths, this is sometimes called warp divergence", and "utilization of the
 *   GPU is maximized when threads within a warp follow the same control flow
 *   path."
 *   https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html
 *
 * CPU: Intel Core i9-14900K (Raptor Lake Refresh, launched Q4 2023).
 *   Intel product specifications page:
 *   https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html
 *   24 cores (8 performance + 16 efficient), 32 threads, max turbo 6 GHz,
 *   P-core base 3.2 GHz, max memory bandwidth 89.6 GB/s (2 channels of
 *   DDR5-5600), instruction set extensions up to AVX2.
 *   Intel, "APP Metrics for Intel Microprocessors – Intel Core Processor"
 *   (export-compliance table, linked from support article 000005755):
 *   https://cdrdv2-public.intel.com/841556/APP-for-Intel-Core-Processors.pdf
 *   i9-14900K: 1,228.8 GFLOPS, APP 0.36864. APP is defined on 64-bit
 *   floating-point operations; the figure equals 24 cores × 3.2 GHz × 16
 *   double-precision operations per tick (an AVX2 multiply-add on 4 doubles
 *   is 8 operations, and a core can start two per tick).
 */

export const RTX_4090 = {
	name: 'NVIDIA GeForce RTX 4090',
	year: 2022,
	sms: 128,
	schedulersPerSm: 4,
	lanesPerScheduler: 32,
	cudaCores: 16384,
	boostGHz: 2.52,
	fp32TFLOPS: 82.6,
	fp16TensorTFLOPS: 165.2,
	fp64Fraction: 1 / 64,
	bandwidthGBs: 1008,
	transistorsBillion: 76.3
} as const;

export const I9_14900K = {
	name: 'Intel Core i9-14900K',
	year: 2023,
	cores: 24,
	performanceCores: 8,
	efficientCores: 16,
	threads: 32,
	maxTurboGHz: 6,
	baseGHz: 3.2,
	/** Intel's export-compliance figure: 64-bit floating-point operations per second. */
	fp64GFLOPS: 1228.8,
	bandwidthGBs: 89.6
} as const;

/** Threads per warp on NVIDIA GPUs (CUDA C++ Programming Guide). */
export const WARP = 32;
