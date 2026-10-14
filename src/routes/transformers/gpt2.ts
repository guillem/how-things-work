/** GPT-2 small's attention on the page's sentences, ready to use (see `attention.ts`). */
import { data } from './gpt2-data';
import { Gpt2 } from './attention';

export const gpt2 = new Gpt2(data);
