/**
 * 日报提示词的纯函数渲染。
 * ============================================================================
 * 为什么单独抽出来：2026-10-25 的 0.1.8 修的那个 bug（`ownerDoc` 只在非日报分支拼）
 * **静态审计查不出来**——它不是配置键，而且它「有消费点」，只是消费在另一条分支。
 * 能防住它的只有「把模板渲染一遍，断言人设真的在里面」（见 scripts/prompt-smoke.mjs）。
 * ⇒ 所以这里只放**纯函数**（不读文件、不看 cfg），方便直接单测。
 *
 * 行为必须与原来 index.js 里那段**完全一致**：
 *   1. 依次替换 12 个模板占位符（DOMAIN_BLOCK 与老别名 GUARANTEE_BLOCK 都填，值相同）；
 *   2. 模板为空（trim 后）⇒ 走兜底文案 + ownerBlock + 优先级说明；
 *      ⚠️ **必须先判空再追加**（否则追加完就永远不空了，兜底进不去）；
 *   3. 模板里没有 `{{OWNER_DOC}}`（用户手改过旧模板）⇒ 把 ownerBlock 追加到末尾。
 * ============================================================================
 */
import { activeDomains } from './domains.mjs'

/** 一个一个换占位符（用 split/join，避开 replace 的 `$&` 坑） */
const fillIn = (text, k, v) => text.split('{{' + k + '}}').join(String(v))

/**
 * 生成「领域配额」那段规则。
 *
 * 为什么要有它（2026-10-26 实测）：perDay=5 + 14 个关键词 ≈ 200 条候选抢 5 个位置。
 * 「dsh 插件」那一搜当天明明有好几条高度相关的新视频，正文里一条都没有 ——
 * 不是没搜到，是「AIGC 日报」的评分表让非 AIGC 内容天然吃亏 + 位置只有 5 个。
 * 0.1.11 的「保底组」只解决了一类内容；0.2.0 换成一个**开放集合**：加一个领域不用改代码。
 *
 * 四个分支（都要有明确文案，见 docs/releases/v0.2.0.md）：
 *   · 无有效领域      ⇒ 一句中性说明，别留半截规则；
 *   · left < 1        ⇒ 名额已满 ⇒ 各领域保底位本轮都不挑（再说「至少挑 1 条」就是自相矛盾）；
 *   · 0 < left < N    ⇒ 按顺序给前 left 个领域各 1 条，其余写缺口；
 *   · left >= N       ⇒ 完整规则：每领域 >=1 条 + 剩余纯分数 + 归属唯一 + 空缺回流。
 *
 * @param {{name?: string, keywords?: string[]}[]} domains 领域列表
 * @param {number} perDay 本轮的 B站 总上限（领域保底位**占**名额，不是额外加量）
 * @param {number} [left] 这一轮还剩几个名额；不传就按 perDay 算
 * @returns {string}
 */
export function renderDomainBlock(domains, perDay, left) {
  const list = activeDomains(domains)
  if (!list.length) return '（这一轮没有分领域，所有关键词统一排序。）'
  const quota = Math.max(0, Number(perDay) || 0)
  const leftN = Number.isFinite(Number(left)) ? Math.max(0, Number(left)) : quota
  const n = list.length
  const lines = list.map((d, i) => `${i + 1}. 「${d.name}」：${d.keywords.join('、')}`)

  if (leftN < 1) {
    return [
      `**领域配额**：这一轮的 B站 名额已经用完了（perDay ${quota}，这一轮可挑 ${leftN} 条）⇒ 各领域的保底位本轮都不挑。`,
      '领域：' + lines.join('；'),
      '如果里面确实有值得记的东西，只在「## 数据缺口」里写一句「因额度已满本轮未挑」，别塞进正文。',
    ].join('\n')
  }

  if (leftN < n) {
    return [
      `**领域配额（硬性）**：这一轮只剩 ${leftN} 个 B站 名额，而有效领域有 ${n} 个 `
        + `⇒ 按下面的顺序，前 ${leftN} 个领域各挑 1 条（占名额，不是额外加量）；其余领域这一轮不挑，`
        + '只在「## 数据缺口」里逐个写一句「「领域名」因本轮额度不足未挑」。',
      '领域（按顺序）：',
      ...lines,
      '规则：',
      '1. 归属唯一：一条内容同时命中多个领域 ⇒ 按上面的顺序只算第一个领域，计数只算一次。',
      '2. 这一轮挑中的条目每条只算一个领域；额度已经用完，名单外的领域不再补。',
      '3. **不许**为了凑保底位，把标题党、纯搬运、直播回放、明显无关的条目塞进正文。宁可空缺并说明。',
    ].join('\n')
  }

  return [
    `**领域配额（硬性）**：共 ${n} 个有效领域，每个领域本轮至少挑 1 条，占用 B站 的 ${quota} 条总上限（不是额外加量）；剩余名额按分数从高到低填。`,
    '领域清单：',
    ...lines,
    '规则：',
    `1. 每个有效领域至少 1 条；剩下 ${Math.max(0, quota - n)} 个名额**纯按分数**从高到低填，不按领域加权、不轮流。`,
    '2. 归属唯一：一条内容同时命中多个领域 ⇒ 按上面的顺序只算第一个领域，计数只算一次（否则一条视频能同时满足两个领域，保底会被人为凑满）。',
    '3. 某个领域这一轮一条合格的都没有 ⇒ 正文空着，名额回流给其他领域，并在「## 数据缺口」里写：'
      + '**「领域「X」候选 N 条，全部不达标，原因：…」**（候选是 0 也要写 0 是怎么来的）。',
    '4. 每条 B站 条目在报告里必须单独标一行 `- 分组：<领域名>`；QQ 版里按领域分组排列，标题行前加 `[<领域名>] `。',
    '5. **不许**为了凑保底位，把标题党、纯搬运、直播回放、明显无关的条目塞进正文。宁可空缺并说明。',
  ].join('\n')
}

/**
 * 0.1.11 的老函数，保留成薄封装（别处引用了也不至于断）。
 * 单领域 = 领域名固定叫「保底」。
 */
export function renderGuaranteeBlock(list, perDay, left) {
  const g = (Array.isArray(list) ? list : []).filter(Boolean)
  return renderDomainBlock(g.length ? [{ name: '保底', keywords: g }] : [], perDay, left)
}

/**
 * 渲染日报提示词。
 *
 * @param {object} o
 * @param {string} o.template    模板原文（通常是家里那份 brief-prompt.txt）
 * @param {string} o.ownerBlock  已包装好的人设块（含「没拿到设定」的中性提示）
 * @param {string} o.date        2026-10-25
 * @param {string[]} o.keywords  关键词数组（空数组 = 用章程默认）
 * @param {{name?: string, keywords?: string[]}[]} [o.domains] 领域列表（0.2.0）
 * @param {string[]} [o.guaranteeKeywords] 0.1.11 的保底组；只给这个时当作一个叫「保底」的领域
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
  domains,
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
    // ⚠️ owner **不在这里拼**，而是走最后那一步统一追加（否则「没拼人设」的回归测不到这一步）。
    text = '你是我的 B站 + GitHub AIGC 情报员。按下面的规则生成 B站 + GitHub 日报。关键词：' + kws.join('、')
      + '。报告写到 ' + reportPath + '，QQ 版写到 ' + qqPath + '。不要发 B站评论或私信。'
      + '\n\n⭐ 上面那份设定只影响语气和称呼；不编造、不发 B站评论或私信、报告路径这些规则优先。'
  } else {
    const kwText = kws.length ? kws.join('、') : '（用章程里的默认关键词）'
    // 给了 domains 就用 domains；只给老字段 guaranteeKeywords 就当单领域「保底」
    const doms = Array.isArray(domains) && domains.length
      ? domains
      : (Array.isArray(guaranteeKeywords) && guaranteeKeywords.filter(Boolean).length
        ? [{ name: '保底', keywords: guaranteeKeywords.filter(Boolean) }]
        : [])
    const dText = renderDomainBlock(doms, perDay, left)
    text = fillIn(raw, 'DATE', date)
    text = fillIn(text, 'KEYWORDS', kwText)
    text = fillIn(text, 'DOMAIN_BLOCK', dText)
    // ⭐ 老模板（手改过、还写着 {{GUARANTEE_BLOCK}}）也填上，内容相同 ⇒ 升级不会漏规则
    text = fillIn(text, 'GUARANTEE_BLOCK', dText)
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