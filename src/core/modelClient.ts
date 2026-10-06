import type { ModelClient } from './extractor'

export interface HttpModelOptions {
  url: string
  apiKey: string
  model: string
  timeoutMs?: number
}

/**
 * An OpenAI-compatible chat client. Groq and Gemini both expose this shape, so
 * the provider is a configuration value rather than a code change.
 */
export class HttpModelClient implements ModelClient {
  constructor(private readonly options: HttpModelOptions) {}

  async complete(prompt: string): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000)

    try {
      const response = await fetch(this.options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // No key means the call goes through a proxy that holds the key, which
          // is the intended setup: a key compiled into the client is readable by
          // anyone who opens the page.
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          // The closed verb list makes this a classification task, so the
          // temperature stays low and the reply stays short.
          temperature: 0,
          max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`model call failed: ${response.status} ${response.statusText}`)
      }

      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      return body.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timer)
    }
  }
}
