#!/usr/bin/env node
/**
 * scripts/prompt-smoke.mjs —— 提示词渲染的断言（A–D 真模板前的骨架、E 真模板、F 保底组）
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

// F. 保底关键词组（2026-10-26）：perDay=5 + 14 个关键词时，某一类内容会被高频类目挤光
//    ⇒ 模板里只放一个 {{GUARANTEE_BLOCK}} 占位，规则文本由 lib/prompt.mjs 生成，才能被这里断言住。
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const realTpl = readFileSync(join(root, 'prompts', 'brief-prompt.txt'), 'utf8')

  // F1 有保底组：规则文本必须出现，且组内词都要进提示词
  const f1 = renderBriefPrompt({
    ...base,
    template: realTpl,
    ownerBlock: '===== 设定 =====\n' + SENTINEL + '\n===== 结束 =====',
    guaranteeKeywords: ['dsh 插件', 'DeepSeek'],
    perDay: 6,
    left: 6,
  })
  if (f1.includes('保底配额')) ok('F1a: 渲染出了保底配额规则')
  else bad('F1a: 没有保底配额规则（{{GUARANTEE_BLOCK}} 没接上？）')
  if (f1.includes('dsh 插件') && f1.includes('DeepSeek')) ok('F1b: 保底词组进了提示词')
  else bad('F1b: 保底词组没进提示词')
  if (!f1.includes('{{GUARANTEE_BLOCK}}')) ok('F1c: 占位符被替换了')
  else bad('F1c: {{GUARANTEE_BLOCK}} 原样漏进了提示词')
  if (f1.includes('至少挑 1 条') && f1.includes('最多挑 2 条')) ok('F1d: 保底条数是 1–2 条')
  else bad('F1d: 保底条数写得不对（应该是至少 1、最多 2）')
  if (f1.includes('- 分组：保底 / AIGC')) ok('F1e: 报告模板里保底条目有单独的分组行')
  else bad('F1e: 报告模板里没有「- 分组：保底 / AIGC」这一行')

  // F2 空保底组：给一句中性说明，不能留半截规则
  const f2 = renderBriefPrompt({
    ...base, template: realTpl, ownerBlock: '', guaranteeKeywords: [],
  })
  if (f2.includes('没有设保底关键词组')) ok('F2a: 空保底组给了中性说明')
  else bad('F2a: 空保底组没给中性说明')
  if (!f2.includes('保底配额')) ok('F2b: 空保底组不会渲染配额规则')
  else bad('F2b: 空保底组却渲染了配额规则')

  // F3 额度已用完（left = 0）：不许再要求「至少挑 1 条」—— 那会和硬上限直接打架
  const f3 = renderBriefPrompt({
    ...base, template: realTpl, ownerBlock: '', guaranteeKeywords: ['dsh 插件'],
    perDay: 5, already: 5, left: 0,
  })
  if (f3.includes('名额已经用完了') && !f3.includes('至少挑')) ok('F3: 额度为 0 时保底组不硬要 1 条')
  else bad('F3: 额度为 0 时还在要求「至少挑 1 条」')
}

console.log('')
if (failed) {
  console.log('结果：失败 ' + failed + ' 项')
  process.exitCode = 1
} else {
  console.log('结果：全部通过（提示词里人设一定在）')
}