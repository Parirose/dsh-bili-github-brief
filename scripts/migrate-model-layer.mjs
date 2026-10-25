/**
 * 把模型层（llm-pi-ai / agent-default-model）从 home patch 迁到各 profile 的 patch。
 * 原因：home 层压住 GUI 的模型设置 —— dsh-config-editor 会报
 *   Configuration for "llm-pi-ai" is overridden by a home patch or command-line overlay
 *
 * 只搬 config 块原文，不解析 YAML（不引额外依赖），全程留 .bak-<时间戳> 备份。
 * 幂等：重复运行不会重复追加；home patch 里其它配置会原样保留。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractModelBlocks, MODEL_LAYER_IDS } from '../lib/model-layer.mjs'

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const homePatch = path.join(HOME, 'cordis.patch.yml')
const desktopPatch = path.join(HOME, 'profiles', 'desktop', 'cordis.patch.yml')
const headlessPatch = path.join(HOME, 'profiles', 'headless', 'cordis.patch.yml')

const read = (p) => fs.readFileSync(p, 'utf8')
const exists = (p) => fs.existsSync(p)
const backup = (p) => {
  if (!exists(p)) return ''
  const b = `${p}.bak-${stamp}`
  fs.copyFileSync(p, b)
  return b
}
const mkdirFor = (p) => fs.mkdirSync(path.dirname(p), { recursive: true })

function splitTopLevel(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const prefix = []
  const blocks = []
  let cur = null
  for (const line of lines) {
    if (/^-\s/.test(line)) {
      if (cur) blocks.push(cur)
      cur = [line]
    } else if (cur) {
      cur.push(line)
    } else {
      prefix.push(line)
    }
  }
  if (cur) blocks.push(cur)
  return { prefix, blocks }
}

function blockId(lines) {
  const m = /^-\s*id:\s*['"]?([^'"\s#]+)['"]?/.exec(String(lines[0] || ''))
  return m ? m[1] : ''
}

function blockText(lines) {
  return lines.join('\n').replace(/\s+$/, '') + '\n'
}

const header = (why) => [
  '# 模型供应商 / 默认模型：只写在各 profile 自己的 patch 里。',
  '# ⚠️ 不要写回 home 层（~/.dsh/cordis.patch.yml）—— home 层优先级高于 profile 层，',
  '#    会让 DSH 设置页的「模型」改不动，保存时报：',
  '#    Configuration for "llm-pi-ai" is overridden by a home patch or command-line overlay',
  why,
].join('\n')

if (!exists(homePatch)) {
  console.log(`没有 home patch：${homePatch}`)
  console.log('无需迁移（模型层本来就不在 home 层）。')
  process.exit(0)
}

const src = read(homePatch)
const picked = extractModelBlocks(src)
if (!picked.length) {
  console.log(`home patch 里没有模型层：${homePatch}`)
  console.log('无需迁移（模型层本来就不在 home 层）。')
  process.exit(0)
}
const got = new Set(picked.map((b) => b.id))
for (const id of MODEL_LAYER_IDS) if (!got.has(id)) console.warn(`⚠️ home patch 里没找到 ${id}，只迁移找到的块。`)

const targets = [desktopPatch, headlessPatch]
const backups = [backup(homePatch)]
for (const f of targets) {
  mkdirFor(f)
  backups.push(backup(f))
  const before = exists(f) ? read(f) : ''
  const have = new Set(extractModelBlocks(before).map((b) => b.id))
  const missing = picked.filter((b) => !have.has(b.id))
  if (!missing.length) {
    console.log(`已包含模型层，跳过：${f}`)
    continue
  }
  let after = before.trim()
  if (/^\[\]\s*$/.test(after)) after = ''
  const intro = header('# 由 migrate-model-layer.mjs 从 home patch 迁入；之后可被 GUI 设置页直接改写。')
  after = (after ? after + '\n\n' : '') + intro + '\n\n' + missing.map((b) => b.text).join('\n')
  fs.writeFileSync(f, after, 'utf8')
  console.log(`已补入 ${missing.length} 个模型块：${f}`)
}

// home patch 只删模型块，其它 home 配置原样保留（不要整份清空）。
const { prefix, blocks } = splitTopLevel(src)
const kept = blocks.filter((b) => !MODEL_LAYER_IDS.includes(blockId(b)))
const cleanPrefix = prefix.join('\n').replace(/\s+$/, '')
let homeAfter
if (kept.length) {
  homeAfter = (cleanPrefix ? cleanPrefix + '\n' : '') + kept.map(blockText).join('\n')
} else {
  homeAfter = [
    '# Home-level patch：模型层故意不放在这里。',
    '# 以前把 llm-pi-ai / agent-default-model 放在这一层，会让 DSH 设置页改不动模型（被 home patch 覆盖）。',
    '# 模型层现在在 profiles/desktop/cordis.patch.yml 与 profiles/headless/cordis.patch.yml。',
    '[]',
    '',
  ].join('\n')
}
fs.writeFileSync(homePatch, homeAfter, 'utf8')
console.log(`已从 home patch 移除 ${picked.length} 个模型块：${homePatch}`)
console.log('备份：')
for (const b of backups) if (b) console.log('  ' + b)
