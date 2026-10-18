/**
 * Published figures for two real GPUs and two real 7-billion-weight models. Every number below is
 * copied from the source named beside it; what is derived from them is computed in `serving.ts`.
 *
 * GPU: NVIDIA H100 SXM (Hopper, 2022).
 *   NVIDIA, H100 Tensor Core GPU product page, "Product Specifications" table, H100 SXM column:
 *   https://www.nvidia.com/en-us/data-center/h100/
 *   BF16 Tensor Core 1,979 teraFLOPS*, GPU memory 80 GB, GPU memory bandwidth 3.35 TB/s;
 *   footnote "* With sparsity". Structured (2:4) sparsity doubles the tensor-core rate, so the
 *   dense rate an ordinary matrix multiply can reach is half: 989.5 TFLOP/s.
 *
 * GPU: NVIDIA GeForce RTX 4090 (Ada, 2022), as on the gpu page (`../gpu/specs.ts`):
 *   NVIDIA, "NVIDIA Ada GPU Architecture" whitepaper, V2.1, Appendix A, Table 2:
 *   https://images.nvidia.com/aem-dam/Solutions/Data-Center/l4/nvidia-ada-gpu-architecture-whitepaper-v2.1.pdf
 *   peak FP16 / BF16 Tensor TFLOPS with FP32 accumulate 165.2 (330.4 with sparsity), memory
 *   bandwidth 1,008 GB/s, frame buffer 24 GB GDDR6X.
 *
 * Model: Llama 2 7B (Meta, 2023): every layer has as many key/value heads as query heads.
 *   H. Touvron et al., "Llama 2: Open Foundation and Fine-Tuned Chat Models", arXiv:2307.09288
 *   (grouped-query attention only in the 34B and 70B models). Shape from the model's
 *   config.json (Meta's repository is gated; the public copy NousResearch/Llama-2-7b-hf,
 *   revision 8efe6c9b93655b934e27bd9981e3ec13e55aee9d, is the same file):
 *   hidden_size 4096, intermediate_size 11008, num_attention_heads 32, num_key_value_heads 32,
 *   num_hidden_layers 32, vocab_size 32000, max_position_embeddings 4096, untied embeddings,
 *   torch_dtype float16. Weights: 6,738,415,616 (Hugging Face's safetensors count).
 *
 * Model: Mistral 7B v0.1 (Mistral AI, 2023, Apache 2.0): grouped-query attention, 8 key/value
 *   heads shared by 32 query heads. A. Q. Jiang et al., "Mistral 7B", arXiv:2310.06825.
 *   config.json of mistralai/Mistral-7B-v0.1, revision 27d67f1b5f57dc0953326b2601d68371d40ea8da:
 *   hidden_size 4096, intermediate_size 14336, num_attention_heads 32, num_key_value_heads 8,
 *   num_hidden_layers 32, vocab_size 32000, sliding_window 4096, untied embeddings,
 *   torch_dtype bfloat16. Weights: 7,241,732,096 (safetensors count).
 */

export interface Gpu {
	id: 'h100' | 'rtx4090';
	name: string;
	/** Dense 16-bit tensor-core rate, FLOP/s. */
	peak: number;
	/** Memory bandwidth, bytes/s. */
	bandwidth: number;
	/** Memory, bytes. */
	memory: number;
}

export const H100: Gpu = {
	id: 'h100',
	name: 'NVIDIA H100 SXM',
	peak: (1979 / 2) * 1e12,
	bandwidth: 3.35e12,
	memory: 80e9
};

export const RTX_4090: Gpu = {
	id: 'rtx4090',
	name: 'NVIDIA RTX 4090',
	peak: 165.2e12,
	bandwidth: 1008e9,
	memory: 24e9
};

export const GPUS = [H100, RTX_4090];

export interface ModelShape {
	id: 'llama2-7b' | 'mistral-7b';
	name: string;
	layers: number;
	dModel: number;
	heads: number;
	kvHeads: number;
	/** Width of the MLP's hidden layer (gated: three matrices of d × ffn). */
	ffn: number;
	vocab: number;
	/** Published number of weights. */
	params: number;
	/** Longest context used on this page (Llama 2's 4,096; Mistral's sliding window). */
	maxContext: number;
}

export const LLAMA2_7B: ModelShape = {
	id: 'llama2-7b',
	name: 'Llama 2 7B',
	layers: 32,
	dModel: 4096,
	heads: 32,
	kvHeads: 32,
	ffn: 11008,
	vocab: 32000,
	params: 6_738_415_616,
	maxContext: 4096
};

export const MISTRAL_7B: ModelShape = {
	id: 'mistral-7b',
	name: 'Mistral 7B',
	layers: 32,
	dModel: 4096,
	heads: 32,
	kvHeads: 8,
	ffn: 14336,
	vocab: 32000,
	params: 7_241_732_096,
	maxContext: 4096
};

export const MODELS = [LLAMA2_7B, MISTRAL_7B];

/** Bytes per number for weights, keys and values in 16-bit (BF16 or FP16) serving. */
export const BYTES_16 = 2;
