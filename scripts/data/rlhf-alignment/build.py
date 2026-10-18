"""
Builds src/routes/rlhf-alignment/rlhf-data.ts from the answers sampled by sample.py (see there for
the model, the sampling rule and how to rebuild): for each prompt, every answer's text, its token
count and log-probability under the reference policy, the stand-in rater's score, and its reward
model features reduced to D numbers.

The stand-in rater. The page needs preferences whose truth it knows, so the "human" is a stated
rule, not a person. For each question it has a short list of words that a useful answer would
use (below; words of the question itself, like "sleep" for the sleep question, are not on it):

    +1 for each different listed word the answer uses, up to 3
    +1 if the answer finishes its sentence (it ends with '.' or '!')
    -1 if it ends with a question mark
    -1 if it talks about itself ("I", "me", "my") instead of the reader
    -1 if one word of four letters or more comes three times or more

A word counts as used if the answer has it, alone or with one of the endings -s, -es, -ed, -ing,
-er or -ers ("relax" covers "relaxing", "read" does not cover "ready").
Comparisons by the rater are then drawn by the page under the Bradley-Terry rule on these scores.

Features. The 768 numbers per answer from sample.py are centred over the prompt's answers and
projected on their first D = 48 principal components (of at most 63), each scaled to unit variance over the prompt's
answers (a linear reward model on 768 numbers would need hundreds of comparisons; real reward
models are fitted on tens of thousands).

Checks (the script stops if one fails): N answers per prompt, all texts non-empty, scores within
the rule's range, the principal components orthonormal and the projection's variances 1.
"""

import json
import re
import sys

import numpy as np

D = 48
WORDS = {
    'sleep': ['bed', 'relax', 'breath', 'tired', 'dark', 'caffeine', 'coffee', 'screen', 'phone',
              'night', 'resting', 'routine', 'quiet', 'calm', 'read', 'warm', 'bath', 'exercise',
              'alarm', 'nap', 'melatonin', 'meditate', 'meditation', 'light', 'music', 'pillow',
              'tea', 'book'],
    'hiking': ['water', 'food', 'snack', 'map', 'compass', 'jacket', 'rain', 'layer', 'boot',
               'shoe', 'sock', 'sunscreen', 'hat', 'first aid', 'kit', 'backpack', 'flashlight',
               'torch', 'phone', 'lunch', 'bottle', 'cloth', 'coat', 'trail', 'sandwich', 'fruit',
               'bag', 'gear', 'knife'],
    'plants': ['water', 'light', 'sun', 'sunlight', 'soil', 'pot', 'drain', 'fertilizer', 'leaf',
               'leaves',
               'window', 'humid', 'mist', 'prune', 'repot', 'root', 'shade', 'temperature',
               'moist', 'moisture', 'dry', 'feed', 'nutrient', 'compost'],
}
SHORT = {
    'sleep': 'How can I fall asleep faster?',
    'hiking': 'What should I pack for a day of hiking?',
    'plants': 'How do I keep my houseplants alive?',
}


def words_of(text):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower())


def score(pid, text):
    ws = words_of(text)
    forms = set(ws)
    joined = ' ' + ' '.join(ws) + ' '
    ends = ('', 's', 'es', 'ed', 'ing', 'er', 'ers')
    used = [w for w in WORDS[pid] if (' ' in w and ' ' + w + ' ' in joined) or any(w + e in forms for e in ends)]
    parts = {'topic': min(3, len(used))}
    end = text.rstrip()[-1:]
    parts['finished'] = 1 if end in ('.', '!') else 0
    parts['question'] = -1 if end == '?' else 0
    parts['self'] = -1 if any(w in ('i', 'me', 'my', "i'm", "i've", "i'd", "i'll") for w in ws) else 0
    counts = {}
    for w in ws:
        if len(w) >= 4:
            counts[w] = counts.get(w, 0) + 1
    parts['repeat'] = -1 if counts and max(counts.values()) >= 3 else 0
    return sum(parts.values()), used, [parts[k] for k in ('topic', 'finished', 'question', 'self', 'repeat')]


def main(src, out):
    data = json.load(open(src))
    prompts = []
    for p in data:
        pid = p['id']
        A = p['answers']
        assert len(A) == 64, (pid, len(A))
        X = np.array([a['feat'] for a in A])
        Xc = X - X.mean(0)
        U, S, Vt = np.linalg.svd(Xc, full_matrices=False)
        V = Vt[:D]
        assert np.allclose(V @ V.T, np.eye(D), atol=1e-8)
        Z = Xc @ V.T
        Z /= Z.std(0)
        assert np.allclose(Z.std(0), 1)
        explained = float((S[:D] ** 2).sum() / (S**2).sum())
        answers = []
        for a, z in zip(A, Z):
            assert a['text'].strip()
            s, used, parts = score(pid, a['text'])
            assert -3 <= s <= 4
            answers.append({
                'text': a['text'].strip(),
                'tokens': a['tokens'],
                'logp': round(a['logp'], 2),
                'score': s,
                'used': used,
                'parts': parts,
                'f': [round(float(v), 2) for v in z],
            })
        print(pid, 'variance kept', round(explained, 3), 'scores', sorted(x['score'] for x in answers))
        prompts.append({
            'id': pid,
            'question': SHORT[pid],
            'prompt': p['prompt'],
            'words': WORDS[pid],
            'explained': round(explained, 3),
            'answers': answers,
        })
    body = json.dumps(prompts, ensure_ascii=False, indent='\t')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(
            '/**\n'
            ' * Built by scripts/data/rlhf-alignment/build.py (see there and sample.py next to it): for three\n'
            ' * questions, 64 answers each sampled from GPT-2 small (top-k 40, temperature 1), with each\n'
            " * answer's log-probability under that sampling, the stand-in rater's score and the reward\n"
            " * model's features (GPT-2's mean final hidden state over the answer, on the prompt's first\n"
            f' * {D} principal components). GPT-2: OpenAI, MIT licence (openai-community/gpt2).\n'
            ' */\n'
            "import type { PromptData } from './data';\n\n"
            f'export const prompts: PromptData[] = {body};\n'
        )


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
