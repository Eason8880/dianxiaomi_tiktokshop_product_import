import { fetchWithTimeout } from '@/lib/fetch-timeout';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChatOptions {
  messages: OpenRouterMessage[];
  model?: string;
  temperature?: number;
  responseFormat?: { type: 'json_object' } | null;
}

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-120b';

function getOpenRouterApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim();
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

export function resolveOpenRouterModel(override?: string): string {
  return override || process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;
}

export async function callOpenRouterChat({
  messages,
  model,
  temperature = 0.1,
  responseFormat = { type: 'json_object' },
}: OpenRouterChatOptions): Promise<{ content: string; model: string }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('未配置 OPENROUTER_API_KEY');
  }

  const response = await fetchWithTimeout(
    `${process.env.OPENROUTER_BASE_URL || OPENROUTER_DEFAULT_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolveOpenRouterModel(model),
        temperature,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        messages,
      }),
      timeoutMs: 30_000,
      timeoutMessage: 'OpenRouter 请求超时，请稍后重试',
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'OpenRouter 调用失败');
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 未返回可解析内容');
  }

  return {
    content,
    model: String(data.model || resolveOpenRouterModel(model)),
  };
}

export function parseOpenRouterJson<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1)) as T;
    }
    throw new Error('AI 返回结果不是有效 JSON');
  }
}
