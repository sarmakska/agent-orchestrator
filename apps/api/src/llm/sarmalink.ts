const BASE_URL = process.env.SARMALINK_BASE_URL || 'https://api.sarmalink.ai/v1'
const API_KEY = process.env.SARMALINK_API_KEY || ''

export async function callSarmalink(messages: { role: string; content: string }[]) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: 'smart', messages }),
  })
  if (!res.ok) throw new Error(`SarmaLink ${res.status}`)
  const json = await res.json() as { choices: { message: { content: string } }[] }
  return json.choices[0].message.content
}
