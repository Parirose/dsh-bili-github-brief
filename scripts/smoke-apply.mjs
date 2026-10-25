#!/usr/bin/env node
/**
 * scripts/smoke-apply.mjs —— 冒烟测试：用一个假 ctx 真的把 apply() 跑一遍
 * ============================================================================
 * 为什么要有它（2026-10-25，v0.1.4 的事故）：
 *   loadCfg() 里 applyLegacyQQBackend 引用了后面才声明的 touched（const，TDZ）。
 *   冷启动时 Settings 服务还没就绪 ⇒ row 为 null ⇒ 先走那条 return ⇒
 *   ReferenceError: Cannot access 'touched' before initialization ⇒ 整条插件不激活
 *   ⇒ 设置面板「读不到插件配置」。node --check 只查语法，发现不了这种运行时错误。
 * ⇒ 这里用一个假 ctx 把 apply() 真跑一遍（冷启动 + Settings 已就绪两条路），
 *   一旦再出现 TDZ / 初始化顺序错误，立刻红。
 *
 * 无依赖、无副作用：DSH_HOME 指向临时目录，跑完删掉，不碰真实配置。
 * 用法：node scripts/smoke-apply.mjs    退出码 0 = 过
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginUrl = pathToFileURL(join(root, 'index.js')).href

let failed = 0
const ok = (m) => console.log('  OK   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }

function fakeCtx({ row = null, tools = [], routes = [], logs = [] } = {}) {
  const base = {
    logger: {
      info: (m) => logs.push(String(m)),
      warn: (m) => logs.push(String(m)),
      error: (m) => logs.push(String(m)),
      debug: () => {},
    },
    // 冷启动时 Settings 服务还没就绪：describe / update 都不存在
    settings: row ? { describe: () => [row], update: async () => {} } : { describe: undefined, update: undefined },
    tools: { register: (t) => { tools.push(t); return t } },
    webServer: { register: (r) => { routes.push(r); return r } },
    effect: (fn) => { try { return fn() } catch { return undefined } },
  }
  // 宿主里 ctx 上还有很多别的东西；拿不到的一律当空，不能因此崩
  return new Proxy(base, { get: (t, p) => (p in t ? t[p] : undefined) })
}

async function status(routes) {
  const r = routes[0]
  if (!r) throw new Error('没有挂上 /api/bili-duty 路由')
  let body = ''
  const res = { writeHead() {}, end(x) { body = String(x) } }
  await r.handler({ method: 'GET', url: '/api/bili-duty/status' }, res)
  return JSON.parse(body)
}

async function runOnce(name, { config = null, row = null } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-smoke-' + name + '-'))
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    if (config) {
      fs.mkdirSync(join(home, 'bili-duty'), { recursive: true })
      fs.writeFileSync(join(home, 'bili-duty', 'config.json'), JSON.stringify(config), 'utf8')
    }
    const tools = [], routes = [], logs = []
    const mod = await import(pluginUrl + '?smoke=' + encodeURIComponent(name))
    mod.apply(fakeCtx({ row, tools, routes, logs }), {})
    return { tools, routes, logs, st: await status(routes) }
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    // ⚠️ Windows 上 apply() 刚往这个目录里铺过文件（mcp_server.py / brief-prompt.txt 等），
    //    rmSync 会和写入句柄 / 索引 / 杀软扫描抢文件 ⇒ ENOTEMPTY/EBUSY。
    //    清理失败**不能**算测试失败（否则 Windows 用户每次自检都看到一个假 FAIL）。
    //    maxRetries / retryDelay 是 fs.rmSync 自带的 Windows 重试参数，不用自己写循环。
    try {
      fs.rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 })
    } catch (e) {
      console.warn('  （临时目录没清干净，忽略：' + (e?.code || e?.message) + '，路径 ' + home + '）')
    }
  }
}

/** 把异常变成一行能看懂的话（带 code 方便排查） */
const why = (e) => (e && e.code ? e.code + '：' : '') + (e && e.message ? e.message : String(e))

console.log('plugin root : ' + root)
console.log('')

console.log('[1/4] 冷启动（Settings 服务未就绪，row = null）')
try {
  const { tools, routes, st } = await runOnce('cold')
  if (routes.length === 1) ok('/api/bili-duty 路由挂上了')
  else bad('路由没挂上（' + routes.length + ' 条）—— 插件没激活')
  if (st && st.ok === true) ok('/status 能返回配置')
  else bad('/status 没返回 ok=true')
  if (tools.length > 0) ok('注册了 ' + tools.length + ' 个工具')
  else bad('一个工具都没注册 —— 插件没激活')
} catch (e) {
  bad('apply() 真崩了（' + why(e) + '）')
  console.log(String(e && e.stack ? e.stack : '').split('\n').slice(1, 4).join('\n'))
}

console.log('[2/4] 老配置兼容（只有 qqForwardUrl）')
try {
  const { st } = await runOnce('legacy', { config: { qqForwardUrl: 'http://127.0.0.1:6099/plugin/x/api/forward' } })
  if (st && st.config && st.config.qqBackend === 'napcat-plugin') ok('自动按 napcat-plugin 处理')
  else bad('qqBackend = ' + (st && st.config ? st.config.qqBackend : '?') + '（应为 napcat-plugin）')
} catch (e) { bad('apply() 真崩了（' + why(e) + '）') }

console.log('[3/4] 用户显式选 off 不被改回')
try {
  const { st } = await runOnce('off', { config: { qqForwardUrl: 'http://127.0.0.1:6099/plugin/x/api/forward', qqBackend: 'off' } })
  if (st && st.config && st.config.qqBackend === 'off') ok('保持 off')
  else bad('qqBackend = ' + (st && st.config ? st.config.qqBackend : '?') + '（应为 off）')
} catch (e) { bad('apply() 真崩了（' + why(e) + '）') }

console.log('[4/4] Settings 服务已就绪（有 row）')
try {
  const row = { ns: 'bili-scroll', revision: 1, value: { perDay: 5, mentionName: '', replyToComments: false, overlayMcp: true }, user: {} }
  const { routes, st } = await runOnce('row', { row })
  if (routes.length === 1 && st && st.ok === true) ok('有 row 时也正常')
  else bad('有 row 时路由/状态异常')
} catch (e) { bad('apply() 真崩了（' + why(e) + '）') }

console.log('')
if (failed) {
  console.log('结果：失败 ' + failed + ' 项')
  process.exitCode = 1
} else {
  console.log('结果：全部通过（apply() 冷启动不崩）')
}
