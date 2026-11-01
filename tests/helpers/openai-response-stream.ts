// Fictitious Responses SSE events, consumed by the installed real OpenAI adapter.
export function openAIResponseStream(text: string): Response {
  const item = { id: 'msg_fictional', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }
  const response = { id: 'resp_fictional', object: 'response', model: 'gpt-6-luna', created_at: 1, status: 'completed', output: [item], incomplete_details: null, error: null, usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } }
  const events = [
    { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
    { type: 'response.content_part.added', item_id: item.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
    { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: text },
    { type: 'response.output_text.done', item_id: item.id, output_index: 0, content_index: 0, text },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ]
  return new Response(events.map((event, sequence_number) => `data: ${JSON.stringify({ ...event, sequence_number })}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })
}
