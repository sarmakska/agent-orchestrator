export interface LlmMessage {
  role: string
  content: string
}

export interface LlmResult {
  content: string
  tokens: number
}

/**
 * Call the SarmaLink OpenAI-compatible chat endpoint.
 *
 * Returns the assistant content together with the total token count so the
 * caller can charge it against the run's token budget. When no API key is
 * configured the adapter runs in offline mode and returns a deterministic
 * echo. This keeps the executor and its tests runnable with no external
 * dependency, while production deployments set SARMALINK_API_KEY.
 */
export async function callSarmalink(
  messages: LlmMessage[],
  opts: { signal?: AbortSignal; model?: string } = {},
): Promise<LlmResult> {
  const baseUrl = process.env.SARMALINK_BASE_URL || 'https://api.sarmalink.ai/v1'
  const apiKey = process.env.SARMALINK_API_KEY || ''

  if (!apiKey) {
    const prompt = messages.map((m) => m.content).join('\n')
    return { content: `offline:${prompt.slice(0, 200)}`, tokens: estimateTokens(prompt) }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: opts.model || 'smart', messages }),
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`SarmaLink ${res.status}`)
  const json = (await res.json()) as {
    choices: { message: { content: string } }[]
    usage?: { total_tokens?: number }
  }
  const content = json.choices[0].message.content
  const tokens = json.usage?.total_tokens ?? estimateTokens(content)
  return { content, tokens }
}

/** Rough 4-chars-per-token heuristic, used only when the provider omits usage. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}
