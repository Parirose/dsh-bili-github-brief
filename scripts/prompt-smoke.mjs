#!/usr/bin/env node
/**
 * scripts/prompt-smoke.mjs —— 提示词渲染的断言（A–D 真模板前的骨架、E 真模板、F 领域配额）
 * ============================================================================
 * 为什么必须有它（2026-10-25）：
 *   0.1.8 之前，`ownerDoc`（使用者工作区的 AGENTS.md）只在**非日报分支**被拼进提示词，
 *   日报分支直接 return ⇒ 默认配置（briefMode=true）的用户人设一直没生效。
 *   这种 bug **静态审计查不出来**：ownerDoc 不是配置键，它"有消费点"，只是消费在另一条分支。
 *   唯一能防住它的是：把模板真的渲染一遍，断言人设关键词在里面。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBriefPrompt } from '../lib/prompt.mjs'
import { migrateLegacyDomains, normalizeDomains } from '../lib/domains.mjs'

const SENTINEL = 'ATRI_SENTINEL_9f3'
let failed = 0
const ok = (m) => console.log('  OK   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }

const base = {
  date: '2026-10-25',
  keywords: ['ComfyUI'],
  perDay: 5,
  already: 0,
  left: 5,
  githubOn: true,
  discoverOn: true,
  workflowOn: true,
  reportPath: 'C:/home/bili-duty/out/2026-10-25.md',
  qqPath: 'C:/home/bili-duty/out/2026-10-25.qq.md',
}

const TPL = `你是情报员。

本轮以这份说明为准，不需要读旧章程。

{{OWNER_DOC}}

输出上限：B站 {{PER_DAY}} 条；今天已挑 {{ALREADY}} 条，最多再挑 {{LEFT}} 条。
关键词：{{KEYWORDS}}；GitHub {{GITHUB_STATUS}} / {{DISCOVER_STATUS}} / {{WORKFLOW_STATUS}}
报告：{{REPORT_PATH}}
QQ：{{QQ_PATH}}
`

// A. 正常模板 + 有 ownerBlock ⇒ 含 sentinel，且没有残留占位符
{
  const out = renderBriefPrompt({ ...base, template: TPL, ownerBlock: '===== 设定 =====\n' + SENTINEL + '\n===== 结束 =====' })
  const noPlaceholder = !/\{\{\w+\}\}/.test(out)
  if (out.includes(SENTINEL)) ok('A: 人设 sentinel 在提示词里')
  else bad('A: 人设 sentinel 不见了（这就是 0.1.8 那个 bug）')
  if (noPlaceholder) ok('A: 没有残留 {{占位符}}')
  else bad('A: 还有没替换的占位符：' + (out.match(/\{\{\w+\}\}/g) || []).join(','))
  if (out.includes('B站 5 条') && out.includes('最多再挑 5 条')) ok('A: PER_DAY / LEFT 替换正确')
  else bad('A: 数字占位符替换不对')
}

// B. ownerBlock 为空（调用方没给）⇒ 不该有 sentinel，但仍不能崩
{
  const out = renderBriefPrompt({ ...base, template: TPL, ownerBlock: '' })
  if (!out.includes(SENTINEL)) ok('B: 没有 ownerBlock 时不会凭空出现 sentinel')
  else bad('B: 空 ownerBlock 却出现了 sentinel')
  if (typeof out === 'string' && out.length > 50) ok('B: 空 ownerBlock 也能渲染出内容')
  else bad('B: 空 ownerBlock 渲染结果异常')
}

// C. 旧模板（没有 {{OWNER_DOC}} 占位）⇒ 人设必须追加到末尾
{
  const oldTpl = TPL.replace('{{OWNER_DOC}}', '').replace(/\n{3,}/g, '\n\n')
  const owner = '===== 设定 =====\n' + SENTINEL + '\n===== 结束 ====='
  const out = renderBriefPrompt({ ...base, template: oldTpl, ownerBlock: owner })
  const tail = out.trimEnd()
  if (tail.endsWith(owner.trimEnd())) ok('C: 旧模板下人设被追加到末尾')
  else bad('C: 旧模板下人设丢了（末尾不是 ownerBlock）')
}

// D. 空模板 ⇒ 兜底文案 + 人设（且必须先判空再追加）
{
  const owner = '===== 设定 =====\n' + SENTINEL + '\n===== 结束 ====='
  const out = renderBriefPrompt({ ...base, template: '', ownerBlock: owner })
  if (out.includes(SENTINEL)) ok('D: 空模板兜底里有人设')
  else bad('D: 空模板兜底里人设丢了（多半是先追加、后判空的顺序问题）')
  if (out.includes('B站 + GitHub AIGC 情报员') && out.includes('这些规则优先')) ok('D: 空模板走了兜底文案')
  else bad('D: 空模板没走兜底文案')
}

// E. 真模板（prompts/brief-prompt.txt）的四条断言
//    —— 上一轮实测：人设读到了、配额也执行了，但输出全是机构口吻
//    ⇒ 光“人设在提示词里”不够，还要抠两件事：身份得在前、语气得有硬落点。
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const realTpl = readFileSync(join(root, 'prompts', 'brief-prompt.txt'), 'utf8')
  const out = renderBriefPrompt({
    ...base,
    template: realTpl,
    ownerBlock: '===== 设定 =====\n' + SENTINEL + '\n===== 结束 =====',
  })

  // E1：不允许回退到“身份声明在最前面”的旧模板
  if (!out.includes('你是我的 B站 + GitHub AIGC 情报员。')) ok('E1: 没有“你是我的…情报员”这句身份声明')
  else bad('E1: 旧身份声明又回来了（会压住 AGENTS.md 里的人设）')

  // E2：人设块必须在“进入身份”那句之前（用 indexOf 比先后，“包含”证明不了顺序）
  const iOwner = out.indexOf(SENTINEL)
  const iEnter = out.indexOf('先按上面那份设定进入身份')
  if (iOwner >= 0 && iEnter >= 0 && iOwner < iEnter) ok('E2: 人设块在“进入身份”那句之前')
  else bad(`E2: 顺序不对（owner@${iOwner}, enter@${iEnter}）—— 身份声明会压住人设`)

  // E3 / E4：语气的硬落点（报告与 QQ 版）
  if (out.includes('必须用设定里那个身份的口吻写')) ok('E3: 「今日结论」有语气硬落点')
  else bad('E3: 「今日结论」没有语气要求（改 2 没落地）')
  if (out.includes('QQ 版第一段用设定里那个身份')) ok('E4: QQ 版有开场口吻要求')
  else bad('E4: QQ 版没有开场口吻要求（改 2 没落地）')
}

// F. 领域配额（0.2.0）：把 0.1.11 的「保底组」换成开放集合
//    起因同保底组：perDay=5 + 14 个关键词时，某一类内容会被高频类目挤光。
//    保底组只能救一类；领域是开放集合，加一个领域不用改代码。
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const realTpl = readFileSync(join(root, 'prompts', 'brief-prompt.txt'), 'utf8')
  const two = [
    { name: 'AIGC', keywords: ['ComfyUI', 'LoRA'] },
    { name: 'dsh 插件', keywords: ['dsh 插件', 'DSH Harness'] },
  ]
  const render = (extra) => renderBriefPrompt({ ...base, template: realTpl, ownerBlock: '', ...extra })

  // F1 无有效领域 ⇒ 一句中性说明，不能留半截配额规则
  const f1 = render({ domains: [] })
  if (f1.includes('没有分领域')) ok('F1a: 无领域给了中性说明')
  else bad('F1a: 无领域没给中性说明')
  if (!f1.includes('领域配额')) ok('F1b: 无领域不会渲染配额规则')
  else bad('F1b: 无领域却渲染了配额规则')

  // F2 额度已满（left = 0）⇒ 不许再说「至少挑 1 条」（那会和硬上限打架）
  const f2 = render({ domains: two, perDay: 5, already: 5, left: 0 })
  if (f2.includes('名额已经用完了') && !f2.includes('至少挑')) ok('F2: 额度为 0 时不再硬要 1 条')
  else bad('F2: 额度为 0 时还在要求「至少挑 1 条」')

  // F3 0 < left < N ⇒ 前 left 个领域各 1 条，其余写缺口
  const f3 = render({ domains: two, perDay: 5, already: 4, left: 1 })
  if (f3.includes('只剩 1 个 B站 名额') && f3.includes('前 1 个领域各挑 1 条')) ok('F3a: 额度不足时按顺序保前 1 个领域')
  else bad('F3a: 额度不足的分支文案不对')
  if (f3.includes('额度不足未挑')) ok('F3b: 提醒把没挑到的领域写进数据缺口')
  else bad('F3b: 没提醒写数据缺口')
  if (f3.includes('AIGC') && f3.includes('ComfyUI') && f3.includes('dsh 插件') && f3.includes('DSH Harness')) ok('F3c: 领域名与关键词原文都在提示词里')
  else bad('F3c: 领域名 / 关键词丢了')

  // F4 left >= N ⇒ 完整规则
  const f4 = render({ domains: two, perDay: 5, already: 0, left: 5 })
  if (f4.includes('共 2 个有效领域') && f4.includes('每个领域本轮至少挑 1 条')) ok('F4a: 完整规则渲染出来了')
  else bad('F4a: 完整规则没渲染出来')
  if (f4.includes('1. 「AIGC」：ComfyUI、LoRA') && f4.includes('2. 「dsh 插件」：dsh 插件、DSH Harness')) ok('F4b: 领域清单逐条列出（名 + 词）')
  else bad('F4b: 领域清单不对')
  if (f4.includes('归属唯一') && f4.includes('名额回流')) ok('F4c: 归属唯一 + 空缺回流都写了')
  else bad('F4c: 缺「归属唯一」或「名额回流」')
  if (f4.includes('- 分组：<领域名>') && !f4.includes('分组：保底 / AIGC')) ok('F4d: 报告模板改成了「- 分组：<领域名>」')
  else bad('F4d: 报告模板的分组行没改干净')
  if (f4.includes('[<领域名>] ')) ok('F4e: QQ 版按领域加前缀')
  else bad('F4e: QQ 版没写领域前缀')

  // F5 老模板里的 {{GUARANTEE_BLOCK}} 与新 {{DOMAIN_BLOCK}} 填出来必须一字不差
  const o5 = renderBriefPrompt({
    ...base, ownerBlock: '', domains: two,
    template: '<<D>>{{DOMAIN_BLOCK}}<<G>>{{GUARANTEE_BLOCK}}<<END>>',
  }).trim()
  const d1 = o5.slice(o5.indexOf('<<D>>') + 5, o5.indexOf('<<G>>'))
  const d2 = o5.slice(o5.indexOf('<<G>>') + 5, o5.indexOf('<<END>>'))
  if (d1 && d1 === d2) ok('F5: DOMAIN_BLOCK 与 GUARANTEE_BLOCK 内容相同（老模板不会漏规则）')
  else bad('F5: 两个占位符填出来的内容不一致')

  // F6 迁移 + clamp（纯函数，见 lib/domains.mjs）
  const mig = migrateLegacyDomains({ keywords: ['ComfyUI'], guaranteeKeywords: ['dsh 插件'] })
  if (mig.migrated && mig.domains.length === 2 && mig.domains[0].name === '默认' && mig.domains[1].name === '保底') ok('F6a: 旧 keywords/guaranteeKeywords 迁移成「默认」「保底」两个领域')
  else bad('F6a: 迁移结果不对：' + JSON.stringify(mig))

  const notes = []
  const six = Array.from({ length: 6 }, (_, i) => ({ name: 'D' + i, keywords: ['k' + i] }))
  const clamped = normalizeDomains(six, 5, notes)
  if (clamped.length === 5 && notes.length === 1 && notes[0].includes('只保留前 5 个')) ok('F6b: 6 个领域 + perDay 5 ⇒ 截成 5 个并留一条 note')
  else bad('F6b: clamp 不对：' + clamped.length + ' / ' + JSON.stringify(notes))

  const mixed = normalizeDomains([{ name: 'a', keywords: [] }, { name: 'b', keywords: ['x'] }], 1, [])
  if (mixed.length === 2) ok('F6c: 关键词为空的领域不占名额（不会被当成 2 个领域截掉）')
  else bad('F6c: 空领域被算进了配额')

  const dup = normalizeDomains([{ name: 'a', keywords: [' x ', 'x', '', 42] }], 0, [])
  if (dup.length === 1 && dup[0].keywords.length === 1 && dup[0].keywords[0] === 'x') ok('F6d: 关键词 trim / 去重 / 去非字符串')
  else bad('F6d: 关键词清洗不对：' + JSON.stringify(dup))
}

console.log('')
if (failed) {
  console.log('结果：失败 ' + failed + ' 项')
  process.exitCode = 1
} else {
  console.log('结果：全部通过（提示词里人设一定在）')
}