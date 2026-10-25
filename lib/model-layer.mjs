/**
 * 模型层 patch 的小工具。
 * 只按“顶格 - ”切块，不解析 YAML：用户的写法再奇怪也不会被我们改坏。
 */
export const MODEL_LAYER_IDS = ['llm-pi-ai', 'agent-default-model']

function blockId(firstLine) {
  const m = /^-\s*id:\s*['"]?([^'"\s#]+)['"]?/.exec(String(firstLine || ''))
  return m ? m[1] : ''
}

/** 从一份 cordis.patch.yml 原文里取出模型层块（保持原文，只去掉块尾空白）。 */
export function extractModelBlocks(text, ids = MODEL_LAYER_IDS) {
  const want = new Set(ids)
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const raw = []
  let cur = null
  for (const line of lines) {
    if (/^-\s/.test(line)) {
      if (cur) raw.push(cur)
      cur = [line]
    } else if (cur) {
      cur.push(line)
    }
  }
  if (cur) raw.push(cur)
  const out = []
  const seen = new Set()
  for (const block of raw) {
    const id = blockId(block[0])
    if (!want.has(id) || seen.has(id)) continue
    seen.add(id)
    const body = block.join('\n').replace(/\s+$/, '')
    if (body) out.push({ id, text: body + '\n' })
  }
  return out
}
