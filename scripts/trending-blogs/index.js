import { VISA_POSTS } from './visas.js';
import { MONEY_POSTS } from './money.js';
import { STYLE_POSTS } from './styles.js';
import { PRACTICAL_POSTS } from './practical.js';
import { DESTINATION_POSTS_A } from './destinations-a.js';
import { DESTINATION_POSTS_B } from './destinations-b.js';

export const TRENDING_POSTS = [
  ...VISA_POSTS,
  ...MONEY_POSTS,
  ...STYLE_POSTS,
  ...PRACTICAL_POSTS,
  ...DESTINATION_POSTS_A,
  ...DESTINATION_POSTS_B,
];
