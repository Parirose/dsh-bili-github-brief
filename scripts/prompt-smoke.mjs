#!/usr/bin/env node
/**
 * scripts/prompt-smoke.mjs —— 提示词渲染的四条断言
 * ============================================================================
 * 为什么必须有它（2026-10-25）：
 *   0.1.8 之前，`ownerDoc`（使用者工作区的 AGENTS.md）只在**非日报分支**被拼进提示词，
 *   日报分支直接 return ⇒ 默认配置（briefMode=true）的用户人设一直没生效。
 *   这种 bug **静态审计查不出来**：ownerDoc 不是配置键，它"有消费点"，只是消费在另一条分支。
 *   唯一能防住它的是：把模板真的渲染一遍，断言人设关键词在里面。
 * ============================================================================
 */
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

console.log('')
if (failed) {
  console.log('结果：失败 ' + failed + ' 项')
  process.exitCode = 1
} else {
  console.log('结果：全部通过（提示词里人设一定在）')
}