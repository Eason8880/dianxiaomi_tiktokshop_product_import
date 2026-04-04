import { AICategoryCandidate } from '@/types';
import {
  callOpenRouterChat,
  isOpenRouterConfigured,
  parseOpenRouterJson,
} from '@/lib/openrouter';

interface PathTranslationResponse {
  items?: Array<{
    key?: string;
    translated_path?: string[];
  }>;
}

interface TextTranslationResponse {
  items?: Array<{
    key?: string;
    translated_text?: string;
  }>;
}

const TRANSLATION_TTL_MS = 24 * 60 * 60 * 1000;

const pathTranslationCache = new Map<string, { value: string[]; fetchedAt: number }>();
const textTranslationCache = new Map<string, { value: string; fetchedAt: number }>();

function getPathKey(path: string[]): string {
  return path.join(' > ');
}

function readPathCache(path: string[]): string[] | undefined {
  const cached = pathTranslationCache.get(getPathKey(path));
  if (!cached || Date.now() - cached.fetchedAt > TRANSLATION_TTL_MS) {
    return undefined;
  }
  return cached.value;
}

function writePathCache(path: string[], translatedPath: string[]) {
  pathTranslationCache.set(getPathKey(path), {
    value: translatedPath,
    fetchedAt: Date.now(),
  });
}

function readTextCache(text: string): string | undefined {
  const cached = textTranslationCache.get(text);
  if (!cached || Date.now() - cached.fetchedAt > TRANSLATION_TTL_MS) {
    return undefined;
  }
  return cached.value;
}

function writeTextCache(text: string, translatedText: string) {
  textTranslationCache.set(text, {
    value: translatedText,
    fetchedAt: Date.now(),
  });
}

function normalizePath(original: string[], translated: unknown): string[] {
  if (
    Array.isArray(translated) &&
    translated.length === original.length &&
    translated.every((segment) => typeof segment === 'string' && segment.trim())
  ) {
    return translated.map((segment) => String(segment).trim());
  }
  return original;
}

async function translateTextsToChinese(texts: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const pending: Array<{ key: string; rawText: string; normalizedText: string }> = [];

  for (const rawText of texts) {
    const normalized = rawText.trim();
    if (!normalized) {
      result.set(rawText, rawText);
      continue;
    }

    const cached = readTextCache(normalized);
    if (cached) {
      result.set(rawText, cached);
      continue;
    }

    pending.push({ key: `text_${pending.length}`, rawText, normalizedText: normalized });
  }

  if (!pending.length || !isOpenRouterConfigured()) {
    for (const item of pending) {
      result.set(item.rawText, item.normalizedText);
    }
    return result;
  }

  try {
    const { content } = await callOpenRouterChat({
      timeoutMs: 8_000,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a translation engine. Translate each input text into concise Simplified Chinese. Output valid JSON only. Do not include analysis. Every input key must appear exactly once in the output. Return exactly this shape: {"items":[{"key":"text_0","translated_text":"中文结果"}]}. Keep identifiers, numbers, and product-specific abbreviations when appropriate.',
        },
        {
          role: 'user',
          content: `Translate the following texts into Simplified Chinese. Keep each key unchanged and return every key exactly once.\nInput: ${JSON.stringify({
            items: pending.map((item) => ({
              key: item.key,
              text: item.normalizedText,
            })),
          })}`,
        },
      ],
    });

    const parsed = parseOpenRouterJson<TextTranslationResponse>(content);
    const responseMap = new Map(
      (parsed.items || [])
        .filter(
          (item): item is { key: string; translated_text: string } =>
            typeof item.key === 'string' && typeof item.translated_text === 'string'
        )
        .map((item) => [item.key, item.translated_text.trim()])
    );

    for (const item of pending) {
      const translated = responseMap.get(item.key) || item.normalizedText;
      writeTextCache(item.normalizedText, translated);
      result.set(item.rawText, translated);
    }
  } catch {
    for (const item of pending) {
      result.set(item.rawText, item.normalizedText);
    }
  }

  return result;
}

export async function translateCategoryPaths(paths: string[][]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const pending: Array<{ key: string; path: string[] }> = [];

  for (const path of paths) {
    const normalized = path.map((segment) => segment.trim()).filter(Boolean);
    const key = getPathKey(normalized);
    if (!normalized.length || result.has(key)) continue;

    const cached = readPathCache(normalized);
    if (cached) {
      result.set(key, cached);
      continue;
    }

    pending.push({ key: `path_${pending.length}`, path: normalized });
  }

  if (!pending.length || !isOpenRouterConfigured()) {
    for (const item of pending) {
      result.set(getPathKey(item.path), item.path);
    }
    return result;
  }

  try {
    const { content } = await callOpenRouterChat({
      timeoutMs: 8_000,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a translation engine. Translate each TikTok Shop category path from English to concise Simplified Chinese. Output valid JSON only. Do not include analysis. Every input key must appear exactly once in the output. Return exactly this shape: {"items":[{"key":"path_0","translated_path":["手机与电子产品","通用配件","USB与手机风扇"]}]}. Preserve the number of path segments, their order, and category meaning. Do not leave category labels in English.',
        },
        {
          role: 'user',
          content: `Translate the following category paths into Simplified Chinese. Keep each key unchanged and return every key exactly once.\nInput: ${JSON.stringify({
            items: pending.map((item) => ({
              key: item.key,
              path: item.path,
            })),
          })}`,
        },
      ],
    });

    const parsed = parseOpenRouterJson<PathTranslationResponse>(content);
    const responseMap = new Map(
      (parsed.items || [])
        .filter(
          (item): item is { key: string; translated_path: string[] } =>
            typeof item.key === 'string' && Array.isArray(item.translated_path)
        )
        .map((item) => [item.key, item.translated_path])
    );

    for (const item of pending) {
      const translatedPath = normalizePath(item.path, responseMap.get(item.key));
      writePathCache(item.path, translatedPath);
      result.set(getPathKey(item.path), translatedPath);
    }
  } catch {
    for (const item of pending) {
      result.set(getPathKey(item.path), item.path);
    }
  }

  return result;
}

export async function translateAICategoryCandidates(
  candidates: AICategoryCandidate[]
): Promise<AICategoryCandidate[]> {
  if (!candidates.length) return candidates;

  const translatedPaths = await translateCategoryPaths(candidates.map((candidate) => candidate.categoryPath));
  const translatedReasons = await translateTextsToChinese(candidates.map((candidate) => candidate.reason));

  return candidates.map((candidate) => {
    const translatedPath =
      translatedPaths.get(getPathKey(candidate.categoryPath)) || candidate.categoryPath;

    return {
      ...candidate,
      categoryPath: translatedPath,
      reason: translatedReasons.get(candidate.reason) || candidate.reason,
    };
  });
}

export async function translateAICategoryReasons(
  candidates: AICategoryCandidate[]
): Promise<AICategoryCandidate[]> {
  if (!candidates.length) return candidates;

  const translatedReasons = await translateTextsToChinese(candidates.map((candidate) => candidate.reason));

  return candidates.map((candidate) => ({
    ...candidate,
    reason: translatedReasons.get(candidate.reason) || candidate.reason,
  }));
}
