#!/usr/bin/env node
/**
 * scripts/audit-config.mjs —— 防“新增配置键忘了接线”的得体检
 * ============================================================================
 * 检查四项：
 *   a) schema 里每个键在 index.js 里至少有 1 处消费点（cfg.KEY / cfg['KEY'] / cfg[k] 动态）；
 *   b) 模板里每个 {{X}} 都有 fill，且每个 fill 都有对应占位符；
 *   c) client.js 里每个 API 调用，在 index.js 里都有对应路由；
 *   d) 每个 schema 键都带 .extra('volatile')（否则 DSH 原生设置页看不到它）。
 *
 * ⚠️ 它**防不了** 0.1.8 那种 bug（某个分支不读已有的变量）——
 *    那种只能靠 scripts/prompt-smoke.mjs 那种“真渲染一遍”的断言。别拿它当替代品。
 *
 * 用法：node scripts/audit-config.mjs            → 只打印 ⚠️，退出码 0
 *       node scripts/audit-config.mjs --strict   → 有 ⚠️ 就退出码 1
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const strict = process.argv.includes('--strict')

const indexSrc = read('index.js')
const clientSrc = read('client.js')
const promptSrc = read('lib/prompt.mjs')
const tplSrc = read('prompts/brief-prompt.txt')

const warns = []
const warn = (m) => warns.push(m)

/* ── a) + d) schema 键：消费点 + volatile ── */
const cfgAt = indexSrc.indexOf('export const Config =')
if (cfgAt < 0) {
  warn('index.js 里找不到 `export const Config` - 无法审计')
}
const cfgBlock = cfgAt < 0 ? '' : indexSrc.slice(cfgAt, indexSrc.indexOf('\n})', cfgAt))
const schemaLines = [...cfgBlock.matchAll(/^  ([a-zA-Z_$][\w$]*):\s*z\..*$/gm)].map((m) => ({ key: m[1], line: m[0] }))
const schemaKeys = schemaLines.map((x) => x.key)

/* 消费点①：cfg.KEY / cfg['KEY'] */
const consumed = new Set()
for (const m of indexSrc.matchAll(/cfg\.([a-zA-Z_$][\w$]*)/g)) consumed.add(m[1])
for (const m of indexSrc.matchAll(/cfg\[\s*['"]([a-zA-Z_$][\w$]*)['"]\s*\]/g)) consumed.add(m[1])

/* 消费点②：动态取值 `for (const k of ['a','b']) { ... cfg[k] ... }`
 * —— 这种写法审计时踩过两次，必须内置，否则 noon/night 会被误报成死键 */
for (const m of indexSrc.matchAll(/for\s*\(\s*const\s+([a-zA-Z_$][\w$]*)\s+of\s+\[([^\]]*)\]\s*\)/g)) {
  const varName = m[1]
  const names = [...m[2].matchAll(/['"]([a-zA-Z_$][\w$]*)['"]/g)].map((x) => x[1])
  const body = indexSrc.slice(m.index, m.index + 800)
  if (new RegExp('cfg\\[\\s*' + varName + '\\s*\\]').test(body)) for (const n of names) consumed.add(n)
}

/* 消费点③：计算属性写回 `patch({ [k]: v })`（这是写，不算消费，但它说明 k 是真实键）
 * —— 不计入 consumed；下面只是为了让注释与实现对得上。 */

for (const { key, line } of schemaLines) {
  if (!/\.extra\(\s*['"]volatile['"]/.test(line)) warn(`schema 键 \`${key}\` 没带 .extra('volatile') ⇒ DSH 原生设置页看不到它`)
  if (!consumed.has(key)) warn(`schema 键 \`${key}\` 在 index.js 里找不到消费点（cfg.${key} / cfg['${key}'] / 动态 cfg[k]）`)
}

/* ── b) 提示词占位符 ↔ fill ── */
const tplKeys = new Set([...tplSrc.matchAll(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g)].map((m) => m[1]))
const fills = new Set()
for (const src of [indexSrc, promptSrc]) {
  for (const m of src.matchAll(/fill(?:In)?\(\s*[^,]+,\s*'([A-Z_][A-Z0-9_]*)'/g)) fills.add(m[1])
}
for (const k of tplKeys) if (!fills.has(k)) warn(`模板里有 {{${k}}}，但没有对应的 fill('${k}') ⇒ 会原样漏到提示词里`)
for (const k of fills) if (!tplKeys.has(k)) warn(`有 fill('${k}')，但模板里没有 {{${k}}} ⇒ 死代码`)

/* ── c) client 调用 → index 路由 ── */
const apiBase = (/const\s+API\s*=\s*'([^']+)'/.exec(clientSrc) || [])[1] || ''
const clientPaths = new Set()
for (const m of clientSrc.matchAll(/j(?:get|post)\(\s*'([^']+)'/g)) clientPaths.add((apiBase + m[1]).replace(/\/+$/, ''))
for (const m of clientSrc.matchAll(/['"](\/api\/[\w\-/]+)['"]/g)) {
  if (m[1] !== apiBase) clientPaths.add(m[1])   // API 常量本身不是一个路由
}
const routes = new Set([...indexSrc.matchAll(/path\s*===\s*'([^']+)'/g)].map((m) => m[1]))
for (const p of clientPaths) if (!routes.has(p)) warn(`client.js 调用了 ${p}，但 index.js 里没有对应路由`)

/* ── 汇总 ── */
console.log(`schema 键   : ${schemaKeys.length}`)
console.log(`消费点覆盖 : ${schemaKeys.filter((k) => consumed.has(k)).length}/${schemaKeys.length}`)
console.log(`模板占位符 : ${tplKeys.size}，fill：${fills.size}`)
console.log(`client 路径  : ${clientPaths.size}，index 路由：${routes.size}`)
console.log('')
if (!warns.length) {
  console.log('结果：0 条 ⚠️')
} else {
  for (const w of warns) console.log('⚠️ ' + w)
  console.log('')
  console.log(`结果：${warns.length} 条 ⚠️${strict ? '（--strict：退出码 1）' : '（非 strict：退出码 0）'}`)
  if (strict) process.exitCode = 1
}
