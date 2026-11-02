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

export function openAIToolResponseStream(name: string, input: Record<string, unknown>): Response {
  const reasoning = { id: 'rs_fictional', type: 'reasoning', summary: [], encrypted_content: 'synthetic-opaque-reasoning' }
  const call = { id: 'fc_fictional', type: 'function_call', call_id: 'call_fictional', name, arguments: JSON.stringify(input), status: 'completed' }
  const response = { id: 'resp_tool_fictional', object: 'response', model: 'gpt-6-luna', created_at: 1, status: 'completed', output: [reasoning, call], incomplete_details: null, error: null, usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 2 } } }
  const events = [
    { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
    { type: 'response.output_item.added', output_index: 0, item: { ...reasoning, encrypted_content: null } },
    { type: 'response.output_item.done', output_index: 0, item: reasoning },
    { type: 'response.output_item.added', output_index: 1, item: { ...call, arguments: '', status: 'in_progress' } },
    { type: 'response.function_call_arguments.delta', item_id: call.id, output_index: 1, delta: call.arguments },
    { type: 'response.function_call_arguments.done', item_id: call.id, output_index: 1, arguments: call.arguments },
    { type: 'response.output_item.done', output_index: 1, item: call },
    { type: 'response.completed', response },
  ]
  return new Response(events.map((event, sequence_number) => `data: ${JSON.stringify({ ...event, sequence_number })}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } })
}
