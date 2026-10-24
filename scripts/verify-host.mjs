#!/usr/bin/env node
/**
 * scripts/verify-host.mjs —— 装完/改完跑一次的宿主自检（无依赖、无副作用）
 * 用法：
 *   Electron（桌面版，能读 app.asar）：
 *     $env:ELECTRON_RUN_AS_NODE='1'; & '<app>/DSH NEXT.exe' scripts\verify-host.mjs
 *   纯 node：  node scripts/verify-host.mjs
 * 退出码：0 全过 · 1 有硬失败
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isElectron = Boolean(process.versions.electron)
const fails = []
const warns = []
const ok = (m) => console.log(`  \u2713 ${m}`)
const bad = (m) => { fails.push(m); console.log(`  \u2717 ${m}`) }
const warn = (m) => { warns.push(m); console.log(`  ! ${m}`) }

console.log(`plugin root : ${root}`)
console.log(`runner      : ${isElectron ? `electron ${process.versions.electron}` : `node ${process.version}`}`)
console.log('')

console.log('[1/4] bundle 挂载声明')
let pkgName = ''
try {
  pkgName = String(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name || '')
  ok(`package.json name = ${pkgName}`)
} catch (e) { bad(`读不到 package.json：${e?.message ?? e}`) }

let patchText = ''
try { patchText = readFileSync(join(root, 'cordis.patch.yml'), 'utf8') }
catch (e) { bad(`读不到 cordis.patch.yml：${e?.message ?? e}`) }

const declaredNames = []
const declaredIds = []
for (const line of patchText.split(/\r?\n/)) {
  const nm = /^\s+name:\s*['"]?([^'"\s#]+)['"]?\s*(?:#.*)?$/.exec(line)
  if (nm) declaredNames.push(nm[1])
  const id = /^\s*-\s*id:\s*['"]?([^'"\s#]+)['"]?\s*(?:#.*)?$/.exec(line)
  if (id) declaredIds.push(id[1])
}
if (!declaredNames.length) warn('cordis.patch.yml 里没有找到 name: 条目')
for (const name of declaredNames) {
  if (name === pkgName) ok(`name: ${name} 与包名一致`)
  else bad(`name: ${name} != 包名 ${pkgName} —— 加载时会 ERR_MODULE_NOT_FOUND，整条插件不激活`)
}

console.log('[2/4] client 注册 id')
try {
  const src = readFileSync(join(root, 'client.js'), 'utf8')
  const m = /window\.__ModuleLoader__\.load\(\{\s*id:\s*['"]([^'"]+)['"]/.exec(src)
  const clientId = m ? m[1] : ''
  if (clientId) {
    if (clientId === pkgName) ok(`client.js id: ${clientId} 与包名一致`)
    else bad(`client.js id: ${clientId} != 包名 ${pkgName} —— 桌面版会 duplicate factory registration，可能触发 profile 回滚`)
  } else warn('client.js 里没找到 window.__ModuleLoader__.load({ id: ... })')
} catch (e) { bad(`读不到 client.js：${e?.message ?? e}`) }

console.log('[3/4] 命名空间（id <-> export const name）')
let modName = ''
try {
  const src = readFileSync(join(root, 'index.js'), 'utf8')
  const m = /export\s+const\s+name\s*=\s*['"]([^'"]+)['"]/.exec(src)
  modName = m ? m[1] : ''
  if (modName) ok(`index.js export const name = ${modName}`)
  else warn('index.js 里没找到 `export const name = ...`')
} catch (e) { bad(`读不到 index.js：${e?.message ?? e}`) }
for (const id of declaredIds) {
  if (!modName) break
  if (id === modName) ok(`id: ${id} 与导出的 name 一致（settings 能按命名空间绑定）`)
  else bad(`id: ${id} != export const name ${modName} —— 设置页会缺`)
}

console.log('[4/4] 宿主依赖')
try {
  const { candidateRoots, loadHostDeps } = await import(pathToFileURL(join(root, 'lib', 'hostdeps.mjs')).href)
  const roots = candidateRoots()
  console.log(`  candidateRoots（${roots.length} 个，按优先级）：`)
  for (const r of roots) console.log(`    - ${r}`)
  const deps = await loadHostDeps()
  for (const note of deps.notes) console.log(`  · ${note}`)
  if (deps.z) ok('schemastery 取到了（Config 可用，设置页正常）')
  else if (isElectron) bad('schemastery 取不到 —— 没有 Config，设置页会降级')
  else warn('schemastery 取不到：纯 node 读不到 app.asar，属预期；请用 Electron 再跑一次确认')
  if (typeof deps.defineTool === 'function') {
    const fromHost = deps.notes.some((n) => /dsh-tools：从宿主树取到/.test(n))
    if (fromHost) ok('dsh-tools 从宿主树取到（用的是宿主的 defineTool）')
    else warn('dsh-tools 未从宿主树取到，已退到本地等价实现')
  }
} catch (e) { bad(`hostdeps 自检异常：${e?.message ?? e}`) }

console.log('')
if (fails.length) {
  console.log(`结果：失败 ${fails.length} 项${warns.length ? `，警告 ${warns.length} 项` : ''}`)
  for (const f of fails) console.log(`  x ${f}`)
  process.exitCode = 1
} else {
  console.log(`结果：全部通过${warns.length ? `（${warns.length} 条警告，见上）` : ''}`)
}
