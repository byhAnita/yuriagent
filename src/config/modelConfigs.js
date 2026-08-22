/**
 * Model router configuration. CLAUDE.md section 3.
 *
 * All four are OpenAI-compatible, so one client shape serves every provider.
 * The API key lives in localStorage on the player's device and is never logged,
 * never committed, and never sent anywhere but the chosen endpoint.
 */

export const MODELS = {
  'deepseek-v4-flash': {
    label: 'DeepSeek V4 Flash',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyHint: 'sk-',
    /** Providers with automatic prefix caching above this many tokens. */
    cacheThreshold: 1024,
    default: true,
  },
  'gemini-3.5-flash-lite': {
    label: 'Gemini 3.5 Flash-Lite',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash-lite',
    keyHint: 'AI',
    cacheThreshold: 2048,
  },
  'gpt-5.6-luna': {
    label: 'GPT-5.6 Luna',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-luna',
    keyHint: 'sk-',
    cacheThreshold: 1024,
  },
  'qwen-3.8-max': {
    label: 'Qwen 3.8 Max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-max',
    keyHint: 'sk-',
    cacheThreshold: 256,
  },
};

export const DEFAULT_MODEL = 'deepseek-v4-flash';

/** Per-call shapes. Scene turns are short by design (CLAUDE.md section 1). */
export const CALL_PRESETS = {
  turn: { temperature: 0.9, maxTokens: 320, stream: true },
  thought: { temperature: 0.8, maxTokens: 80, stream: false },
  summarize: { temperature: 0.2, maxTokens: 400, stream: false },
  /** Three short lines. Never streamed - it is swapped in whole or not at all. */
  chips: { temperature: 0.85, maxTokens: 120, stream: false },
};

export function getModel(id) {
  return MODELS[id] ?? MODELS[DEFAULT_MODEL];
}
