"""
Builds src/routes/transformers/gpt2-data.ts: real attention weights of GPT-2 small for a
few fixed sentences, computed by running the model's forward pass here, once, with numpy.

Model: GPT-2 small (124M parameters; Radford, Wu, Child, Luan, Amodei & Sutskever, "Language
Models are Unsupervised Multitask Learners", OpenAI 2019). Weights, vocabulary and BPE merges from
Hugging Face, openai-community/gpt2 at revision 607a30d783dfa663caf39e06633721c8d4cfcd7e
(licence: MIT). model.safetensors is 548105171 bytes, SHA-256
248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707.

No dependency is added to the site. To rebuild, in a throwaway directory outside the repository:

    REV=607a30d783dfa663caf39e06633721c8d4cfcd7e
    mkdir dl && for f in model.safetensors vocab.json merges.txt; do
      curl -sL -o dl/$f https://huggingface.co/openai-community/gpt2/resolve/$REV/$f; done
    python3 -m venv venv && venv/bin/pip install numpy safetensors regex
    venv/bin/python3 -I <repo>/scripts/data/transformers/build.py dl <repo>/src/routes/transformers/gpt2-data.ts

The forward pass below is GPT-2's own (pre-LayerNorm blocks, causal self-attention with 12 heads of
64 dimensions, GELU (tanh form) MLP of width 3072, learned position embeddings, final LayerNorm,
tied output embedding), in float64. The tokenizer is GPT-2's byte-level BPE, re-implemented
from vocab.json and merges.txt with GPT-2's split pattern. Every sentence is prefixed with the
<|endoftext|> token, as GPT-2 saw at the start of documents in training.

Checks run on every build (the script stops if one fails), against results published for GPT-2
small: head 4.11 (layer 4, head 11, counting from 0) attends to the previous token; on a
repeated random sequence heads 5.1, 5.5 and 6.9 are induction heads (Olsson et al. 2022,
"In-context learning and induction heads"); in the indirect-object sentence heads 9.9 and 9.6
attend from the final " to" to " Mary" and the model's top next token is " Mary" (Wang et al.
2022, "Interpretability in the wild").

Output: a TypeScript module exporting `data` (type GptData from attention.ts), fields:
  source     model, revision, licence, sha256
  config     layers, heads, dHead, dModel, vocab, context, params (counted from the weights)
  sentences  [{ id, text, tokens, ids, att, next }]
             tokens: decoded token strings (the first is "<|endoftext|>");
             att: base64 of uint8 round(255 · weight), for layer 0..11, head 0..11, query i,
               key j = 0..i (the causal lower triangle, row by row);
             next: GPT-2's five most likely next tokens after the whole sentence, [token, p].
  featured   one head on one sentence, unrounded enough to redo the attention by hand:
             { sentence, layer, head, q, k, v, out } with q, k, v, out: n × 64, 4 decimals
             (out = softmax(q kᵀ / 8 + causal mask) v, the head's output before W_O).
  positions  { n: 64, cos: base64 of little-endian int16 round(10000 · cos) of the learned position embeddings
             (wpe) of positions 0..63, n × n, row by row, norms: |wpe[p]| for p < n (2 dec.) }
"""

import base64
import json
import sys
import warnings

import numpy as np
import regex as re
from safetensors.numpy import load_file

# numpy on macOS (Accelerate) can print spurious "overflow in matmul" warnings; every output is
# checked for finiteness below, so they are silenced here.
warnings.filterwarnings('ignore', category=RuntimeWarning)

SENTENCES = [
    ('animal', "The animal didn't cross the street because it was too tired."),
    ('mary', 'When Mary and John went to the store, John gave a drink to'),
    ('fox', 'The quick brown fox jumps over the dog. The quick brown fox jumps'),
    ('keys', 'The keys to the old cabinet are on the table.'),
    ('dog', 'The dog bit the man, and then the man bit the dog.'),
    ('capital', 'Paris is the capital of France, and Rome is the capital of'),
    ('count', '1, 2, 3, 4, 5, 6,'),
    ('tom', 'Sarah lent Tom her bike because he'),
]
FEATURED = ('animal', 4, 3)
BOS = 50256
POSITIONS = 64


def main(src, out):
    W = load_file(src + '/model.safetensors')
    enc = json.load(open(src + '/vocab.json', encoding='utf-8'))
    dec = {v: k for k, v in enc.items()}
    lines = open(src + '/merges.txt', encoding='utf-8').read().split('\n')[1:]
    ranks = {tuple(l.split()): i for i, l in enumerate(lines) if l}

    # ---- byte-level BPE (GPT-2's encoder.py)
    bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    b2u = dict(zip(bs, map(chr, cs)))
    u2b = {v: k for k, v in b2u.items()}
    pat = re.compile(r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""")

    def bpe(word):
        word = list(word)
        while len(word) > 1:
            r, i = min((ranks.get((word[i], word[i + 1]), float('inf')), i) for i in range(len(word) - 1))
            if r == float('inf'):
                break
            a, b = word[i], word[i + 1]
            merged, j = [], 0
            while j < len(word):
                if j < len(word) - 1 and word[j] == a and word[j + 1] == b:
                    merged.append(a + b)
                    j += 2
                else:
                    merged.append(word[j])
                    j += 1
            word = merged
        return word

    def encode(text):
        ids = []
        for piece in pat.findall(text):
            ids += [enc[p] for p in bpe(''.join(b2u[b] for b in piece.encode('utf-8')))]
        return ids

    def token(i):
        return bytes(u2b[c] for c in dec[i]).decode('utf-8')

    # ---- GPT-2 forward pass
    def ln(x, g, b):
        m = x.mean(-1, keepdims=True)
        v = ((x - m) ** 2).mean(-1, keepdims=True)
        return (x - m) / np.sqrt(v + 1e-5) * g + b

    def gelu(x):
        return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

    def f(name):
        return W[name].astype(np.float64)

    def forward(ids):
        n = len(ids)
        x = f('wte.weight')[ids] + f('wpe.weight')[:n]
        mask = np.triu(np.full((n, n), -np.inf), 1)
        atts, qkvs = [], []
        for l in range(12):
            p = f'h.{l}.'
            h = ln(x, f(p + 'ln_1.weight'), f(p + 'ln_1.bias'))
            qkv = h @ f(p + 'attn.c_attn.weight') + f(p + 'attn.c_attn.bias')
            q, k, v = (m.reshape(n, 12, 64).transpose(1, 0, 2) for m in np.split(qkv, 3, axis=-1))
            s = q @ k.transpose(0, 2, 1) / np.sqrt(64) + mask
            a = np.exp(s - s.max(-1, keepdims=True))
            a /= a.sum(-1, keepdims=True)
            y = a @ v
            x = x + y.transpose(1, 0, 2).reshape(n, 768) @ f(p + 'attn.c_proj.weight') + f(p + 'attn.c_proj.bias')
            h = ln(x, f(p + 'ln_2.weight'), f(p + 'ln_2.bias'))
            x = x + gelu(h @ f(p + 'mlp.c_fc.weight') + f(p + 'mlp.c_fc.bias')) @ f(p + 'mlp.c_proj.weight') + f(p + 'mlp.c_proj.bias')
            atts.append(a)
            qkvs.append((q, k, v, y))
        logits = ln(x, f('ln_f.weight'), f('ln_f.bias')) @ f('wte.weight').T
        out = np.array(atts)
        assert np.isfinite(out).all() and np.isfinite(logits).all()
        return out, qkvs, logits

    def probs(logits):
        p = np.exp(logits - logits.max())
        return p / p.sum()

    # ---- checks against published results
    rng = np.random.default_rng(0)
    r = [int(t) for t in rng.integers(1000, 20000, 20)]
    a, _, _ = forward([BOS] + r + r)
    m = len(r) * 2 + 1
    prev = a[4, 11][np.arange(1, m), np.arange(0, m - 1)].mean()
    assert prev > 0.95, prev
    for l, h in [(5, 1), (5, 5), (6, 9)]:
        ind = a[l, h][np.arange(22, m), np.arange(22, m) - 19].mean()
        assert ind > 0.4, (l, h, ind)
    ids = [BOS] + encode(dict(SENTENCES)['mary'])
    a, _, logits = forward(ids)
    mary = ids.index(encode(' Mary')[0])
    for l, h in [(9, 9), (9, 6)]:
        assert a[l, h][-1].argmax() == mary, (l, h)
    assert probs(logits[-1]).argmax() == encode(' Mary')[0]

    # ---- the sentences
    sentences = []
    featured = None
    for sid, text in SENTENCES:
        ids = [BOS] + encode(text)
        assert len(ids) <= 16, (sid, len(ids))
        a, qkvs, logits = forward(ids)
        n = len(ids)
        tri = [a[l, h, i, : i + 1] for l in range(12) for h in range(12) for i in range(n)]
        q8 = np.rint(np.concatenate(tri) * 255).astype(np.uint8)
        p = probs(logits[-1])
        top = np.argsort(-p)[:5]
        sentences.append(
            {
                'id': sid,
                'text': text,
                'tokens': [token(i) for i in ids],
                'ids': ids,
                'att': base64.b64encode(q8.tobytes()).decode('ascii'),
                'next': [[token(int(i)), round(float(p[i]), 4)] for i in top],
            }
        )
        if sid == FEATURED[0]:
            _, l, h = FEATURED
            q, k, v, y = qkvs[l]
            rnd = lambda m: [[round(float(x), 4) for x in row] for row in m]
            featured = {'sentence': sid, 'layer': l, 'head': h, 'q': rnd(q[h]), 'k': rnd(k[h]), 'v': rnd(v[h]), 'out': rnd(y[h])}

    wpe = f('wpe.weight')[:POSITIONS]
    norms = np.linalg.norm(wpe, axis=1)
    u = wpe / norms[:, None]
    cos = np.rint(np.clip(u @ u.T, -1, 1) * 10000).astype('<i2')

    params = sum(int(np.prod(t.shape)) for name, t in W.items() if not re.fullmatch(r'h\.\d+\.attn\.(masked_)?bias', name))
    assert params == 124439808, params
    data = {
        'source': {
            'model': 'GPT-2 small (OpenAI, 2019)',
            'repository': 'https://huggingface.co/openai-community/gpt2',
            'revision': '607a30d783dfa663caf39e06633721c8d4cfcd7e',
            'licence': 'MIT',
            'sha256': '248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707',
            'script': 'scripts/data/transformers/build.py',
        },
        'config': {'layers': 12, 'heads': 12, 'dHead': 64, 'dModel': 768, 'vocab': len(enc), 'context': 1024, 'params': params},
        'sentences': sentences,
        'featured': featured,
        'positions': {
            'n': POSITIONS,
            'cos': base64.b64encode(cos.tobytes()).decode('ascii'),
            'norms': [round(float(x), 2) for x in norms],
        },
    }
    header = (
        '/**\n * GPT-2 small attention weights for the attention explainer. GENERATED by\n'
        ' * scripts/data/transformers/build.py (see its header for the format) — do not edit by hand.\n'
        ' *\n * Model: GPT-2 small, OpenAI 2019, https://huggingface.co/openai-community/gpt2 at revision\n'
        ' * 607a30d783dfa663caf39e06633721c8d4cfcd7e. Licence: MIT.\n */\n'
        "import type { GptData } from './attention';\n\n"
        '// prettier-ignore\n'
        'export const data: GptData = '
    )
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(header)
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')
    print('wrote', out, 'params', params)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
