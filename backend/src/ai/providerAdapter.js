import { config } from '../config/index.js';

/**
 * 標準化構建 Chat Completions API 完整請求端點
 * 保留子路徑（如 /v1beta/openai/），去除結尾多餘斜線，避免雙斜線或根路徑覆蓋
 * @param {string} baseUrl
 * @returns {string} 完整的 /chat/completions URL
 */
export function resolveChatCompletionUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return 'https://api.openai.com/v1/chat/completions';
  }
  const sanitized = baseUrl.trim().replace(/\/+$/, '');
  if (sanitized.endsWith('/chat/completions')) {
    return sanitized;
  }
  return `${sanitized}/chat/completions`;
}

/**
 * OpenAI 相容之通用 AI 模型適配器 (支援 OpenAI, Gemini, DeepSeek, Ollama 等)
 */
export class AiProviderAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.ai.apiKey;
    this.baseUrl = (options.baseUrl || config.ai.baseUrl || '').trim();
    this.model = options.model || config.ai.model;
  }

  /**
   * 呼叫 Chat Completions API
   * @param {Object} params
   * @param {Array<{ role: string, content: string }>} params.messages
   * @param {number} [params.temperature=0.2]
   * @param {number} [params.maxTokens=1500]
   * @returns {Promise<{ content: string, usage: Object, model: string }>}
   */
  async generateChatCompletion({ messages, temperature = 0.2, maxTokens = 1500 }) {
    if (!this.apiKey) {
      throw new Error('MISSING_API_KEY: 未設定 OPENAI_API_KEY 環境變數');
    }

    const endpoint = resolveChatCompletionUrl(this.baseUrl);

    // 自動相容性處理：若使用 Google Gemini 官方 OpenAI 端點但模型仍為預設 gpt-*，自動優化為 gemini-1.5-flash 避免 404
    let targetModel = this.model;
    if (endpoint.includes('generativelanguage.googleapis.com') && targetModel.startsWith('gpt-')) {
      targetModel = 'gemini-1.5-flash';
    }

    const payload = {
      model: targetModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 秒逾時防護

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error?.message) {
            errMessage = errJson.error.message;
          }
        } catch {}
        throw new Error(`AI_PROVIDER_ERROR: ${errMessage}`);
      }

      const json = await response.json();
      const choice = json.choices && json.choices[0];
      if (!choice || !choice.message) {
        throw new Error('AI_INVALID_RESPONSE: AI 回應內容為空');
      }

      return {
        content: choice.message.content.trim(),
        usage: json.usage || {},
        model: json.model || this.model,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('AI_TIMEOUT: AI 模型伺服器回應逾時 (30s)');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const aiProvider = new AiProviderAdapter();
