import { generateCategoryTitleVariants } from '@/lib/category-title-variants';
import { callOpenRouterChat, parseOpenRouterJson } from '@/lib/openrouter';
import { TikTokLeafCategory } from '@/lib/tiktok-category-tree';
import { AICategoryCandidate } from '@/types';

interface OpenRouterMatch {
  category_id?: string;
  reason?: string;
  score?: number;
}

interface OpenRouterResponse {
  matches?: OpenRouterMatch[];
}

const TITLE_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'clip',
  'for',
  'from',
  'gifts',
  'gift',
  'in',
  'of',
  'on',
  'portable',
  'power',
  'supply',
  'temperature',
  'the',
  'tool',
  'usb',
  'with',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !TITLE_STOPWORDS.has(token));
}

function shortlistLeafCategories(title: string, leaves: TikTokLeafCategory[], limit = 50): TikTokLeafCategory[] {
  const titleVariants = generateCategoryTitleVariants(title);
  const tokenSet = new Set(titleVariants.flatMap(tokenize));

  const scored = leaves.map((leaf) => {
    const pathText = leaf.categoryPath.join(' > ').toLowerCase();
    const leafName = leaf.categoryName.toLowerCase();

    let score = 0;
    for (const token of tokenSet) {
      if (leafName.includes(token)) score += 4;
      else if (pathText.includes(token)) score += 1;
    }

    return { leaf, score };
  });

  const strongMatches = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.leaf);

  if (strongMatches.length >= Math.min(limit, 20)) {
    return strongMatches;
  }

  const fallback = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.leaf);

  return fallback;
}

function buildPrompt(title: string, candidates: TikTokLeafCategory[]): string {
  const candidateLines = candidates
    .map((candidate) => `- ${candidate.categoryId}: ${candidate.categoryPath.join(' > ')}`)
    .join('\n');

  return [
    'Task: choose the 3 best matching TikTok Shop PH leaf categories for the product title.',
    'Rules:',
    '1. You must only choose category IDs from the candidate list.',
    '2. Prefer the most specific leaf category.',
    '3. Return valid JSON only.',
    '4. If uncertain, still pick the closest 3 candidates from the list.',
    '',
    `Product title: ${title}`,
    '',
    'Candidate categories:',
    candidateLines,
    '',
    'Return JSON in this shape:',
    '{"matches":[{"category_id":"123","reason":"short explanation","score":0.92}]}',
  ].join('\n');
}

function sanitizeMatches(
  raw: OpenRouterResponse,
  leafMap: Map<string, TikTokLeafCategory>
): AICategoryCandidate[] {
  const seen = new Set<string>();
  const candidates: AICategoryCandidate[] = [];

  for (const match of raw.matches || []) {
    const categoryId = String(match.category_id || '');
    const leaf = leafMap.get(categoryId);
    if (!leaf || seen.has(categoryId)) continue;
    seen.add(categoryId);

    candidates.push({
      categoryId,
      categoryPath: leaf.categoryPath,
      reason: String(match.reason || 'AI 推荐的候选类目'),
      score:
        typeof match.score === 'number' &&
        Number.isFinite(match.score) &&
        match.score >= 0 &&
        match.score <= 1
          ? match.score
          : undefined,
    });
  }

  return candidates.slice(0, 3);
}

export async function analyzeCategoryWithOpenRouter(
  title: string,
  leafCategories: TikTokLeafCategory[]
): Promise<{ candidates: AICategoryCandidate[]; analyzedTitle: string; model: string }> {
  const shortlisted = shortlistLeafCategories(title, leafCategories);
  const leafMap = new Map(shortlisted.map((leaf) => [leaf.categoryId, leaf]));

  const { content, model } = await callOpenRouterChat({
    timeoutMs: 45_000,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a product category classifier. Choose only from the provided candidate TikTok Shop PH leaf categories and return strict JSON.',
      },
      {
        role: 'user',
        content: buildPrompt(title, shortlisted),
      },
    ],
  });

  const parsed = parseOpenRouterJson<OpenRouterResponse>(content);
  const candidates = sanitizeMatches(parsed, leafMap);
  if (candidates.length === 0) {
    throw new Error('AI 未返回有效候选类目');
  }

  return {
    candidates,
    analyzedTitle: title,
    model,
  };
}
