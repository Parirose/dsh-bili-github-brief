/**
 * 日报提示词的纯函数渲染。
 * ============================================================================
 * 为什么单独抽出来：2026-10-25 的 0.1.8 修的那个 bug（`ownerDoc` 只在非日报分支拼）
 * **静态审计查不出来**——它不是配置键，而且它“有消费点”，只是消费在另一条分支。
 * 能防住它的只有「把模板渲染一遍，断言人设真的在里面」（见 scripts/prompt-smoke.mjs）。
 * ⇒ 所以这里只放**纯函数**（不读文件、不看 cfg），方便直接单测。
 *
 * 行为必须与原来 index.js 里那段**完全一致**：
 *   1. 依次替换 12 个占位符；
 *   2. 模板为空（trim 后）⇒ 走兜底文案 + ownerBlock + 优先级说明；
 *      ⚠️ **必须先判空再追加**（否则追加完就永远不空了，兜底进不去）；
 *   3. 模板里没有 `{{OWNER_DOC}}`（用户手改过旧模板）⇒ 把 ownerBlock 追加到末尾。
 * ============================================================================
 */

/** 一个一个换占位符（用 split/join，避开 replace 的 `$&` 坑） */
const fillIn = (text, k, v) => text.split('{{' + k + '}}').join(String(v))

/**
 * 生成「保底关键词组」那段规则。
 * 空数组 ⇒ 给一句中性说明，别留半截规则在模板里
 * —— 这也正是它做成占位符、而不是在模板里写死一段的原因。
 *
 * 为什么要有它（2026-10-26 实测）：perDay=5 + 14 个关键词 ≈ 200 条候选抢 5 个位置。
 * 「dsh 插件」那一搜当天明明有好几条高度相关的新视频，正文里一条都没有 ——
 * 不是没搜到，是「AIGC 日报」的评分表让非 AIGC 内容天然吃亏 + 位置只有 5 个。
 * 保底组就是给这一类内容留 1-2 个**名额**（不是额外加量）。
 *
 * @param {string[]} list   保底关键词
 * @param {number}   perDay 本轮的 B站 总上限（用来提示「保底条目占名额」）
 * @param {number}   [left] 这一轮还剩几个名额；不传就按 perDay 算。
 *                          ⚠️ 传了就必须处理 left < 1：那时候再说「至少挑 1 条」会和硬上限直接打架，
 *                          模型只会挑一个服从 ⇒ 不如一开始就说清楚。
 * @returns {string}
 */
export function renderGuaranteeBlock(list, perDay, left) {
  const g = (Array.isArray(list) ? list : []).filter(Boolean)
  if (!g.length) return '（这一轮没有设保底关键词组，所有关键词统一排序。）'
  const quota = Math.max(0, Number(perDay) || 0)
  const leftN = Number.isFinite(Number(left)) ? Math.max(0, Number(left)) : quota
  if (leftN < 1) {
    return [
      `**保底配额**：这一轮的 B站 名额已经用完了（perDay ${quota}，这一轮可挑 ${leftN} 条）⇒ 保底组这一轮不挑。`,
      `保底组：${g.join('、')}`,
      `如果里面确实有值得记的东西，只在「## 数据缺口」里写一句「保底组因额度已满本轮未挑」，别塞进正文。`,
    ].join('\n')
  }
  const lo = 1
  const hi = Math.max(1, Math.min(2, leftN))
  return [
    `**保底配额（硬性）**：下面这组词里，本轮至少挑 ${lo} 条、最多挑 ${hi} 条进 B站 正文。`,
    `保底组：${g.join('、')}`,
    `规则：`,
    `1. 保底条目**占用** B站 的 ${quota} 条总上限，不是额外加量；剩余名额按分数从高到低填。`,
    `2. 保底条目在报告里必须单独标一行 \`- 分组：保底\`，其余条目标 \`- 分组：AIGC\`；QQ 版里保底条目的标题行前加 \`[保底] \`。`,
    `3. 保底组本轮确实一条合格的都没有 ⇒ 在「## 数据缺口」里写：**「保底组候选 N 条，全部不达标，原因：…」**，并写明 N 是怎么来的。`,
    `4. **不许**为了让保底组有内容，把标题党、纯搬运、直播回放、明显无关的条目塞进正文。宁可空缺并说明。`,
  ].join('\n')
}

/**
 * 渲染日报提示词。
 *
 * @param {object} o
 * @param {string} o.template    模板原文（通常是家里那份 brief-prompt.txt）
 * @param {string} o.ownerBlock  已包装好的人设块（含“没拿到设定”的中性提示）
 * @param {string} o.date        2026-10-25
 * @param {string[]} o.keywords  关键词数组（空数组 = 用章程默认）
 * @param {string[]} o.guaranteeKeywords 保底关键词（空 = 不启用；这一组每轮至少进 1 条、最多 2 条）
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
  guaranteeKeywords,
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
    const gText = renderGuaranteeBlock(guaranteeKeywords, perDay, left)
    text = fillIn(raw, 'DATE', date)
    text = fillIn(text, 'KEYWORDS', kwText)
    text = fillIn(text, 'GUARANTEE_BLOCK', gText)
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
