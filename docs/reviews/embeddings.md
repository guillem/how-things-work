<!-- batch msgbatch_01BV1p6aUAsiFtzFKbfs3u11, claude-opus-5-5, submitted 2026-10-14T08:43:27.540Z, ~$2.76 in tokens + 9 web searches -->
# Review: embeddings

## Verdict
The page is ready once the fixes below are made. The model is sound. The GloVe 6B 100-d vectors are used correctly, and every similarity, neighbour list and analogy is computed in the full 100-D space by cosine. Analogies use 3CosAdd on unit vectors, and the page says that it leaves the input words out, which avoids the entry's pitfall. The parallelogram view is exact, because the landing point lies in the plane through the three input words. Every catalogue requirement is met. The citations to GloVe, Firth, t-SNE, Bolukbasi and Caliskan are correct, and the numbers I could check against known GloVe-100d values (king·queen ≈ 0.75, cat·dog ≈ 0.88, queen ≈ 0.77 for king − man + woman) are right. Three things need fixing:
- **Most important:** the doctor/nurse step presents its result as plain evidence of bias. That result depends on the rule that leaves the input words out, which this page has just taught. The page should say so.
- **Wrong date:** the training news is called "2014 news". The Gigaword news it comes from runs from 1994 to 2010.
- **Missing safeguards:** several numbers quoted in the text are not checked by any test, and one readout is typed in by hand rather than computed.

## Factual errors
- **medium**, steps.ts:204. "the 2014 news and encyclopaedia text it learned from" is wrong about the news. The Wikipedia dump is from 2014, but Gigaword 5 is newswire collected between 1994 and 2010. **Fix:** "the encyclopaedia (2014) and newswire (1994–2010) text it learned from". Sources: https://catalog.ldc.upenn.edu/LDC2011T07, https://catalog.ldc.upenn.edu/LDC2018T20, https://nlp.stanford.edu/pubs/glove.pdf
- **medium**, steps.ts:204–205. "The arithmetic is right" presents doctor − man + woman = nurse as straightforward evidence of bias. Nissim, van Noord & van der Goot (2020) showed that this kind of result depends heavily on the rule that excludes the input words: with the inputs allowed, the answer is usually *doctor* itself. The page made exactly this point about *king* one step earlier. **Fix:** after "…gives **doctor**." add: "Part of this comes from the rule: with the input words allowed, the closest word to doctor − man + woman is doctor itself. Only once doctor is excluded does nurse come first. The association is real, but the analogy exaggerates it." Also add to the notes at line 205: "Nissim, van Noord & van der Goot (2020) showed that such analogies exaggerate bias because they forbid the answer to equal an input word." Source: https://aclanthology.org/2020.cl-2.7/
- **low**, steps.ts:106. "how often each one appears within a few words of each other one" is imprecise. The GloVe paper uses a window of 10 words on each side and gives nearer words more weight (1/d). **Fix:** "within ten words of each other one (nearer words counting more)". Source: https://nlp.stanford.edu/pubs/glove.pdf
- **low**, steps.ts:108. "short 'stop words'" is inaccurate: the NLTK stop list also contains long words such as *themselves* and *ourselves*. **Fix:** "common 'stop words' such as *the*, *of* and *she*".
- **low**, steps.ts:135. The k-means tooltip describes ordinary k-means, but glove-data.ts:22 says the clustering is spherical k-means, which groups by angle. **Fix:** "…assigning each point to the group centre it makes the smallest angle with…".

All other facts I checked are correct:
- the GloVe citation, its corpus (6B tokens, 400K words, uncased) and its PDDL licence;
- the description of the training objective, including the bias terms and the summing of the two vector sets;
- the Firth (1957) quotation;
- van der Maaten & Hinton (2008) for t-SNE;
- Mikolov et al. (2013) for the analogy recipe;
- the descriptions of Bolukbasi et al. (2016) and Caliskan et al. (2017);
- 3,292 × 100 = 329,200 multiplications;
- acos 0.75 = 41°.

## Model issues
- **medium**, e2e/embeddings-model.e2e.ts. Many numbers the text quotes are never tested, so a rebuild of the data could quietly make them wrong:
  - queen 0.77 and king 0.84 (steps.ts:189);
  - good/bad 0.77 and happy/sad 0.68 (line 123; the test only checks good/bad > 0.7);
  - the average cosine of about 0.3 between random words (line 122);
  - king→queen 0.44 and brother→sister 0.59 against man→woman (line 177);
  - sister ranking sixth (line 203);
  - the exact preset sentences scoring 0.89 and 0.41 (line 217; the test uses different sentences);
  - 8-bit storage changing similarities by less than 0.01 (line 108).

  **Fix:** add a `toBeCloseTo(…, 2)` assertion or a rank check for each one. The 8-bit claim can be tested against a few float vectors.
- **medium**, e2e test line 62 versus steps.ts:161. The text says that with PCA "fewer than 3 in 100" true neighbours stay close, but the test only guarantees fewer than 10 in 100. **Fix:** change the test to `expect(share('pca')).toBeLessThan(0.03)`, or loosen the text to "fewer than 1 in 10".
- **low**, embeddings.ts:243–256. `clusterNames` takes the overall top-*n* words, where *n* is the cluster's size, and then filters them down to the cluster's members. For a spread-out cluster this can return fewer than 3 names. **Fix:** score only the members, e.g. `members.map(w => ({w, s: dot(vector(w), s)})).sort(...)`.
- **low**, embeddings.ts:93. A row of all zeros would divide by zero and give NaN. No current word triggers this. **Fix:** `const n = length(row) || 1;`.

The algorithms themselves are correct:
- **3CosAdd analogies:** computed on unit vectors, with cosine to an unnormalised query.
- **Sentence comparison:** cosine of averaged vectors; using the average or the sum gives the same cosine.
- **Pair view:** the `pairAxes` view is linear, and its two axes are perpendicular (this is tested).
- **Analogy plane:** origin at *a*, axes along *c − a* and the part of *b − a* perpendicular to it. The landing point lies exactly in this plane.

## Narrative and scene mismatches
- **medium**, DirectionScene.svelte:418–422 and steps.ts:175. The panel shows "cos ≈ 0.0" for random word steps, but this value is typed into the scene rather than computed from the vectors. **Fix:** compute the mean cosine of, say, 200 random word-difference pairs drawn from a fixed seed (`rng` in math.ts), print that value, and test it.
- **medium**, steps.ts:174. "this step is nearly the same for many pairs" overstates the result: the notes at line 177 give only 0.44 for king→queen against man→woman. **Fix:** "this step points roughly the same way for many pairs".
- **low**, MapScene.svelte:8 and steps.ts:137. The scene's header comment says clumps are "named on the map (pills)", and the notes say "The clumps are labelled with the words closest to the centre". In fact the map labels landmark and frequent words, and the centre-nearest words appear only in the legend panel. **Fix:** in the notes, write "The colour legend names each k-means group by the words closest to its centre", and update the comment to match.
- **low**, VectorScene.svelte:71. The comment says "8 positions a second", but the code uses `t * 6`. **Fix:** change the comment to 6.
- **low**, SentenceScene.svelte:97. Once the chips run past the box width they are silently dropped, although those words still count in the average. **Fix:** draw a final "…" chip, or reduce the chip size.

The scenes match the text everywhere else, including:
- the presets;
- the exclude toggle and the "1. king" warning;
- the failure notes;
- the t-SNE/PCA tween with the "k of 10" readout;
- the order step showing 0° and 1.00.

## Catalogue requirements
Every requirement is met:
- **Interaction:** pan and zoom over 3,292 words, search with neighbours, typed analogies, and sentence comparison by angle.
- **Takeaway:** shown in the map, the parallel arrows and the summary.
- **Pitfall:** neighbours and analogies are computed in 100-D; the distortion step demonstrates the projection; input words are left out, the page says so, and a toggle reveals *king*.
- **Needs:** met with real GloVe data and a documented subset.

## Clarity
- **low**, steps.ts:175. "the step between two random pairs of words has a cosine of about 0.0 with another" is hard to parse. **Fix:** "For comparison, the steps between two random pairs of words have a cosine of about 0 with each other."
- **low**, steps.ts:41–46. The relationship options are labelled "woman", "capital", "past" and "bigger", which are cryptic out of context. **Fix:** use the titles as labels: "man → woman", "country → capital", "verb → past", "big → bigger".
- **low**, steps.ts:242. The summary bullet says "distance stands for similarity", but the rest of the page uses angle. **Fix:** "distance stands for similarity: for these length-1 vectors, a smaller angle is also a shorter distance."
- **low**, steps.ts:229. In the "not good / not bad" pair, the reader sees *not* crossed out as a stop word, a second reason the meaning is lost that the text doesn't mention. **Fix:** add "(and *not* itself is not even in our list)".

## Sources consulted
- GloVe project page (corpora, vocabulary, PDDL v1.0): https://nlp.stanford.edu/projects/glove/
- Pennington, Socher & Manning 2014, GloVe paper (window of 10, objective, W + W̃): https://nlp.stanford.edu/pubs/glove.pdf
- LDC, English Gigaword Fifth Edition: https://catalog.ldc.upenn.edu/LDC2011T07
- LDC, Concretely Annotated Gigaword (newswire 1994–2010): https://catalog.ldc.upenn.edu/LDC2018T20
- Nissim, van Noord & van der Goot 2020, "Fair Is Better than Sensational": https://aclanthology.org/2020.cl-2.7/
- Firth 1957 quotation: https://quoteinvestigator.com/2022/09/18/word-company/
