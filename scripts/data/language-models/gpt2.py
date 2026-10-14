"""
GPT-2 small in plain numpy: its byte-level BPE tokenizer and its forward pass, for the data
scripts of the language-models explainer (see build.py next to this file).

Both are copied from scripts/data/transformers/build.py (which reimplements OpenAI's encoder.py
and model.py), reorganised as module-level functions and run in float32 for speed (the
probabilities agree with the float64 run of that script to within 1e-5).
"""

import json
import warnings

import numpy as np
import regex as re
from safetensors.numpy import load_file

BOS = 50256
REVISION = '607a30d783dfa663caf39e06633721c8d4cfcd7e'
SHA256 = '248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707'
# numpy on macOS (Accelerate) can print spurious "overflow in matmul" warnings; every output is
# checked for finiteness, so they are silenced here.
warnings.filterwarnings('ignore', category=RuntimeWarning)
PATTERN = r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""


def bytes_to_unicode():
    """GPT-2's map from the 256 byte values to printable unicode characters, in vocab order."""
    bs = list(range(ord('!'), ord('~') + 1)) + list(range(ord('¡'), ord('¬') + 1)) + list(range(ord('®'), ord('ÿ') + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return bs, [chr(c) for c in cs]


class Tokenizer:
    def __init__(self, src):
        self.enc = json.load(open(src + '/vocab.json', encoding='utf-8'))
        self.dec = {v: k for k, v in self.enc.items()}
        lines = open(src + '/merges.txt', encoding='utf-8').read().split('\n')[1:]
        self.merges = [tuple(l.split()) for l in lines if l]
        self.ranks = {m: i for i, m in enumerate(self.merges)}
        bs, cs = bytes_to_unicode()
        self.b2u = dict(zip(bs, cs))
        self.u2b = {v: k for k, v in self.b2u.items()}
        self.byte_order = bs
        self.pat = re.compile(PATTERN)

    def bpe(self, word):
        word = list(word)
        while len(word) > 1:
            r, i = min((self.ranks.get((word[i], word[i + 1]), float('inf')), i) for i in range(len(word) - 1))
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

    def encode(self, text):
        ids = []
        for piece in self.pat.findall(text):
            ids += [self.enc[p] for p in self.bpe(''.join(self.b2u[b] for b in piece.encode('utf-8')))]
        return ids

    def token_bytes(self, i):
        return bytes(self.u2b[c] for c in self.dec[i])

    def token(self, i):
        return self.token_bytes(i).decode('utf-8', errors='replace')

    def decode(self, ids):
        return b''.join(self.token_bytes(i) for i in ids).decode('utf-8', errors='replace')


class Model:
    def __init__(self, src):
        W = load_file(src + '/model.safetensors')
        self.raw = W
        self.W = {k: v.astype(np.float32) for k, v in W.items()}
        self.wteT = np.ascontiguousarray(self.W['wte.weight'].T)

    def logits(self, ids):
        """Next-token logits (float64) after the whole sequence `ids`."""
        W = self.W
        n = len(ids)
        assert n <= 1024
        x = W['wte.weight'][ids] + W['wpe.weight'][:n]
        mask = np.triu(np.full((n, n), -np.inf, dtype=np.float32), 1)

        def ln(x, g, b):
            m = x.mean(-1, keepdims=True)
            v = ((x - m) ** 2).mean(-1, keepdims=True)
            return (x - m) / np.sqrt(v + 1e-5) * g + b

        def gelu(x):
            return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

        for l in range(12):
            p = f'h.{l}.'
            h = ln(x, W[p + 'ln_1.weight'], W[p + 'ln_1.bias'])
            qkv = h @ W[p + 'attn.c_attn.weight'] + W[p + 'attn.c_attn.bias']
            q, k, v = (m.reshape(n, 12, 64).transpose(1, 0, 2) for m in np.split(qkv, 3, axis=-1))
            s = q @ k.transpose(0, 2, 1) / np.float32(8) + mask
            a = np.exp(s - s.max(-1, keepdims=True))
            a /= a.sum(-1, keepdims=True)
            y = a @ v
            x = x + y.transpose(1, 0, 2).reshape(n, 768) @ W[p + 'attn.c_proj.weight'] + W[p + 'attn.c_proj.bias']
            h = ln(x, W[p + 'ln_2.weight'], W[p + 'ln_2.bias'])
            x = x + gelu(h @ W[p + 'mlp.c_fc.weight'] + W[p + 'mlp.c_fc.bias']) @ W[p + 'mlp.c_proj.weight'] + W[p + 'mlp.c_proj.bias']
        last = ln(x[-1:], W['ln_f.weight'], W['ln_f.bias'])
        out = (last @ self.wteT)[0].astype(np.float64)
        assert np.isfinite(out).all()
        return out


def probs(logits, T=1.0):
    z = logits / T
    p = np.exp(z - z.max())
    return p / p.sum()
