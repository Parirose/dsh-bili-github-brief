/**
 * 日报提示词的纯函数渲染。
 * ============================================================================
 * 为什么单独抽出来：2026-10-25 的 0.1.8 修的那个 bug（`ownerDoc` 只在非日报分支拼）
 * **静态审计查不出来**——它不是配置键，而且它“有消费点”，只是消费在另一条分支。
 * 能防住它的只有「把模板渲染一遍，断言人设真的在里面」（见 scripts/prompt-smoke.mjs）。
 * ⇒ 所以这里只放**纯函数**（不读文件、不看 cfg），方便直接单测。
 *
 * 行为必须与原来 index.js 里那段**完全一致**：
 *   1. 依次替换 11 个占位符；
 *   2. 模板为空（trim 后）⇒ 走兜底文案 + ownerBlock + 优先级说明；
 *      ⚠️ **必须先判空再追加**（否则追加完就永远不空了，兜底进不去）；
 *   3. 模板里没有 `{{OWNER_DOC}}`（用户手改过旧模板）⇒ 把 ownerBlock 追加到末尾。
 * ============================================================================
 */

/** 一个一个换占位符（用 split/join，避开 replace 的 `$&` 坑） */
const fillIn = (text, k, v) => text.split('{{' + k + '}}').join(String(v))

/**
 * 渲染日报提示词。
 *
 * @param {object} o
 * @param {string} o.template    模板原文（通常是家里那份 brief-prompt.txt）
 * @param {string} o.ownerBlock  已包装好的人设块（含“没拿到设定”的中性提示）
 * @param {string} o.date        2026-10-25
 * @param {string[]} o.keywords  关键词数组（空数组 = 用章程默认）
 * @param {number} o.perDay
 * @param {number} o.already
 * @param {number} o.left
 * @param {boolean} o.githubOn
 * @param {boolean} o.discoverOn
 * @param {boolean} o.workflowOn
 * @param {string} o.reportPath
 * @param {string} o.qqPath
 * @returns {string}
 */
export function renderBriefPrompt({
  template,
  ownerBlock,
  date,
  keywords,
  perDay,
  already,
  left,
  githubOn,
  discoverOn,
  workflowOn,
  reportPath,
  qqPath,
}) {
  const kws = Array.isArray(keywords) ? keywords.filter(Boolean) : []
  const owner = String(ownerBlock ?? '')

  const raw = String(template ?? '')
  let text

  if (!raw.trim()) {
    // 模板为空 ⇒ 兜底文案 + 优先级说明；
    // ⚠️ owner **不在这里拼**，而是走最后那一步统一追加（否则“没拼人设”的回归测不到这一步）。
    text = '你是我的 B站 + GitHub AIGC 情报员。按下面的规则生成 B站 + GitHub 日报。关键词：' + kws.join('、')
      + '。报告写到 ' + reportPath + '，QQ 版写到 ' + qqPath + '。不要发 B站评论或私信。'
      + '\n\n⭐ 上面那份设定只影响语气和称呼；不编造、不发 B站评论或私信、报告路径这些规则优先。'
  } else {
    const kwText = kws.length ? kws.join('、') : '（用章程里的默认关键词）'
    text = fillIn(raw, 'DATE', date)
    text = fillIn(text, 'KEYWORDS', kwText)
    text = fillIn(text, 'PER_DAY', perDay)
    text = fillIn(text, 'ALREADY', already)
    text = fillIn(text, 'LEFT', left)
    text = fillIn(text, 'GITHUB_STATUS', githubOn ? '开启' : '关闭')
    text = fillIn(text, 'DISCOVER_STATUS', discoverOn ? '开启' : '关闭')
    text = fillIn(text, 'WORKFLOW_STATUS', workflowOn ? '开启' : '关闭')
    text = fillIn(text, 'REPORT_PATH', reportPath)
    text = fillIn(text, 'QQ_PATH', qqPath)
    text = fillIn(text, 'OWNER_DOC', owner)
    // 模板自带占位 ⇒ owner 已经在里面了，不用再追加
    if (raw.includes('{{OWNER_DOC}}')) return text
  }

  // ⚠️ 最后一步：没有 {{OWNER_DOC}} 占位（旧模板 / 空模板）时，
  //    **人设必须从这里追加进去** —— 删了它，scripts/prompt-smoke.mjs 的 C/D 会立刻变红。
  text = text.replace(/\s*$/, '') + '\n\n' + owner + '\n'
  return text
}
