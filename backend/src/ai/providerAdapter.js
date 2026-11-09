import { config } from '../config/index.js';

/**
 * OpenAI 相容之通用 AI 模型適配器 (支援 OpenAI, Gemini, DeepSeek, Ollama 等)
 */
export class AiProviderAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.ai.apiKey;
    this.baseUrl = (options.baseUrl || config.ai.baseUrl).replace(/\/+$/, '');
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

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.model,
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
