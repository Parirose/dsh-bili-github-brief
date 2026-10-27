/**
 * 领域（domain）的纯函数：清洗 / 归一化 / 旧配置迁移 / 体检。
 * ============================================================================
 * 为什么单独一个文件：这三件事（保存时钳制、读配置时迁移、CI 体检）都要用，
 * 而且都必须能被 scripts/prompt-smoke.mjs 直接单测 —— 埋在 index.js 的 apply() 里就只能靠真机验证。
 *
 * 规则（2026-10-26 定的，见 docs/CONFIG.md）：
 *   · 领域名留空 ⇒ 兜底成「领域 N」（N 按位置，从 1 起）；
 *   · keywords 为空的领域视为**无效**：不参与配额，也不算进「领域数 ≤ perDay」；
 *   · 有效领域数超过 perDay ⇒ 只保留前 perDay 个（其余丢掉），并记一条 note；
 *   · 单个领域关键词上限 30（防面板塞爆提示词）。
 * ============================================================================
 */

/** 单个领域最多几个关键词 */
export const DOMAIN_MAX_KEYWORDS = 30

/** 关键词数组：只留非空字符串，trim + 去重（顺序保留） */
export function cleanKeywords(list) {
  const out = []
  if (!Array.isArray(list)) return out
  for (const raw of list) {
    if (typeof raw !== 'string') continue
    const s = raw.trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/** 领域显示名：留空就兜底成「领域 N」（N 从 1 起，按位置） */
export function domainName(domain, index) {
  const s = typeof domain?.name === 'string' ? domain.name.trim() : ''
  return s || `领域 ${Number(index) + 1}`
}

/** 有效领域（有名字兜底、有关键词）—— 配额只按它们算 */
export function activeDomains(domains) {
  return (Array.isArray(domains) ? domains : [])
    .map((d, i) => ({ name: domainName(d, i), keywords: cleanKeywords(d?.keywords) }))
    .filter((d) => d.keywords.length > 0)
}

/**
 * 保存 / 读回时的钳制。
 * @param {unknown} raw     原始 domains（可能不是数组、元素可能不是对象）
 * @param {number}  [perDay] 有效领域数上限；不传或 <= 0 就不截断
 * @param {string[]} [notes] 收集「做了什么」的说明（由调用方写进日志 / warn）
 * @returns {{ name: string, keywords: string[] }[]}
 */
export function normalizeDomains(raw, perDay, notes = []) {
  const src = Array.isArray(raw) ? raw : []
  const out = []
  for (let i = 0; i < src.length; i += 1) {
    const item = src[i]
    const name = typeof item?.name === 'string' ? item.name.trim() : ''
    let keywords = cleanKeywords(item?.keywords)
    if (keywords.length > DOMAIN_MAX_KEYWORDS) {
      notes.push(`领域「${name || `领域 ${i + 1}`}」有 ${keywords.length} 个关键词 > ${DOMAIN_MAX_KEYWORDS}，只保留前 ${DOMAIN_MAX_KEYWORDS} 个`)
      keywords = keywords.slice(0, DOMAIN_MAX_KEYWORDS)
    }
    out.push({ name, keywords })
  }
  const cap = Math.max(0, Number(perDay) || 0)
  const validCount = out.filter((d) => d.keywords.length > 0).length
  if (cap > 0 && validCount > cap) {
    const kept = []
    const dropped = []
    let used = 0
    for (let i = 0; i < out.length; i += 1) {
      const d = out[i]
      if (!d.keywords.length) { kept.push(d); continue }
      if (used >= cap) { dropped.push(domainName(d, i)); continue }
      used += 1
      kept.push(d)
    }
    notes.push(`有效领域 ${validCount} 个 > perDay ${cap}，只保留前 ${cap} 个`
      + (dropped.length ? `（丢掉了：${dropped.join('、')}）` : ''))
    return kept
  }
  return out
}

/**
 * 旧配置迁移（**只读**）：domains 为空、又有旧的关键词字段 ⇒ 拼成领域。
 *   keywords        ⇒ [{ name: '默认', keywords }]
 *   guaranteeKeywords ⇒ 再追加 [{ name: '保底', keywords }]
 * ⚠️ 不写回配置文件；用户下次在面板保存时才落盘成 domains，同时把旧字段置空。
 * @returns {{ domains: {name: string, keywords: string[]}[], migrated: boolean }}
 */
export function migrateLegacyDomains(cfg) {
  const cur = Array.isArray(cfg?.domains) ? cfg.domains : []
  if (cur.length) return { domains: cur, migrated: false }
  const kws = cleanKeywords(cfg?.keywords)
  const gkw = cleanKeywords(cfg?.guaranteeKeywords)
  if (!kws.length && !gkw.length) return { domains: [], migrated: false }
  const domains = []
  if (kws.length) domains.push({ name: '默认', keywords: kws })
  if (gkw.length) domains.push({ name: '保底', keywords: gkw })
  return { domains, migrated: true }
}

/**
 * 配置体检（给 scripts/audit-config.mjs 用）：返回人话的 ⚠️ 列表，空数组 = 没问题。
 */
export function lintDomains(domains, perDay) {
  const warns = []
  const list = Array.isArray(domains) ? domains : []
  const cap = Math.max(0, Number(perDay) || 0)
  const valid = list.filter((d) => cleanKeywords(d?.keywords).length > 0)
  if (cap > 0 && valid.length > cap) {
    warns.push(`领域 ${valid.length} 个 > perDay ${cap} ⇒ 保存时只保留前 ${cap} 个，其余会被截断`)
  }
  for (let i = 0; i < list.length; i += 1) {
    const named = typeof list[i]?.name === 'string' && list[i].name.trim()
    if (!named) warns.push(`第 ${i + 1} 个领域没填名字 ⇒ 会兜底成「${domainName(list[i], i)}」`)
  }
  const seen = new Map()
  for (let i = 0; i < list.length; i += 1) {
    for (const k of cleanKeywords(list[i]?.keywords)) {
      const prev = seen.get(k)
      if (prev && prev.index !== i) {
        warns.push(`关键词「${k}」在领域「${prev.name}」/「${domainName(list[i], i)}」重复；归属永远算第一个，后者里这个词等于没用`)
      } else if (!prev) {
        seen.set(k, { index: i, name: domainName(list[i], i) })
      }
    }
  }
  return warns
}