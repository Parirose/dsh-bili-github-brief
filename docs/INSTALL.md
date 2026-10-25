# 安装

## 前提

- DSH（DeepSeek Harness）
- Node.js 24+
- Python 3.10+ 或 uv
- NapCat（仅 QQ 投递需要）
- 一个可登录的 B站账号
- 一个 GitHub 只读 token

## 1. 安装 DSH 插件

```bash
dsh plugin --profile web add github:Parirose/dsh-bili-github-brief
```

本地开发：

```bash
dsh plugin --profile web add link:<本项目绝对路径>
```

安装后必须重启 DSH。

### 桌面版（Electron 打包的 DSH NEXT）

桌面版没有 `web` profile，且 `desktop` profile 被 CLI 锁死，两条 `dsh plugin` 命令都会失败：

```text
dsh: error: profile "desktop" is managed exclusively by the Electron application
```

桌面版只能走应用自带的 headless adapter，参数顺序是 `<profile> <pnpm 参数...>`（不带 `--profile`）：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& 'C:\DSH NEXT\DSH NEXT.exe' 'C:\DSH NEXT\resources\app.asar\lib\plugin-cli.js' `
  desktop add "link:D:\path\to\dsh-bili-github-brief"
```

它做的是同一件事：pnpm add 进 `$DSH_HOME/profiles/desktop/`，并把包名追加进 `package.json` 的 `dsh.profile.bundles`。装完照样要重启应用。

macOS/Linux 换成 `<App>/Contents/Resources/app.asar/lib/plugin-cli.js`、`.../resources/app.asar/lib/plugin-cli.js`。

### 先建 headless profile

插件跑一轮用的是 `--profile headless`，桌面版默认没有这个 profile，不先建，第一次「现在跑一轮」会以找不到 profile 结束。跑一次 list 即初始化：

```powershell
& '<app>/DSH NEXT.exe' '<app>/resources/app.asar/lib/plugin-cli.js' headless list
```

而 headless 那一轮也要能拿到模型。模型层要写在 **profile 自己的 patch** 里：

- `$DSH_HOME/profiles/desktop/cordis.patch.yml` —— 桌面版设置页「模型」写的就是这里；
- `$DSH_HOME/profiles/headless/cordis.patch.yml` —— 日报那一轮用它。

插件（v0.1.4 起）每次跑前会把 GUI profile 那一份里的 `llm-pi-ai` / `agent-default-model`
抄进 headless 的临时 overlay，所以**平时只需要管 GUI 那一份**。找不到 `desktop` 时会自动扫描
`profiles/web` 等其它 profile；也可以用 `guiProfile` / `modelLayerFile` 显式指定。

> ⚠️ **不要写进 home 层 patch（`$DSH_HOME/cordis.patch.yml`）**。
> home 层优先级高于 profile 层，写了之后 DSH 设置页的模型设置**永久无法保存**，报：
> `Configuration for "llm-pi-ai" is overridden by a home patch or command-line overlay`

已经写在 home 层的老用户，运行一次自动迁移（会留 `.bak-<时间戳>` 备份）：

```powershell
node scripts/migrate-model-layer.mjs
```

### 宿主依赖自检

安装或升级后，在插件目录运行：

```powershell
node scripts/verify-host.mjs
node scripts/smoke-apply.mjs
```

`smoke-apply` 用假 ctx 真跑一遍 `apply()`（冷启动 / 老配置 / 显式 off / Settings 已就绪）。
Windows 上如果看到一行「临时目录没清干净，忽略：ENOTEMPTY / EPERM」，那是清理告警（杀软 / 索引抢文件），
**属正常**：只要结果是「全部通过」就行。
`node --check` 只查语法，查不出 `Cannot access 'x' before initialization` 这类初始化顺序错误 ——
v0.1.4 就是这么崩的，所以这条必须跑。

桌面版用 Electron 再跑一次（能读 `app.asar` 的是这条）：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& '<app>\DSH NEXT.exe' scripts\verify-host.mjs
```

看到 `schemastery 取到了` 和 `dsh-tools：从宿主树取到` 才算完整。

## 1.5 两种宿主（web / 桌面），以及同一台机上同时用

| | web / 终端版 | 桌面版（DSH NEXT） |
|---|---|---|
| 装插件 | `dsh plugin --profile web add github:Parirose/dsh-bili-github-brief` | 同上（应用自带 `plugin-cli.js`） |
| 初始化 headless 档 | `dsh headless list` | `"<app>/DSH NEXT.exe" "<app>/resources/app.asar/lib/plugin-cli.js" headless list` |
| `dshBin` | 留空（走 PATH） | **建议显式填** `<app>/resources/app.asar/node_modules/@deepseek-ai/dsh/lib/bin.js` |
| QQ 投递 | OneBot（`qqBackend: onebot`） | NapCat 插件或 OneBot |

非 Windows 用户：NapCat 基本只有 Windows 版 ⇒ **投递请用 `qqBackend: onebot`**（自己跑一个
OneBot v11 HTTP 实现）。

同一台机器上同时用桌面版和 web 版：两个宿主默认都用 `$DSH_HOME/bili-duty/`，
共用会互相覆盖报告、串味配额、各推一份 QQ。给其中一边（建议 web）在 `config.json` 里加：

```json
{ "stateDir": "bili-duty-web" }
```

- 只认**单层目录名**（不能带 `\` / `/`），改完重启 DSH；
- 留空 / 不写 = 旧路径 `bili-duty`，老用户零迁移；
- 两边心跳互相可见：5 分钟内另一个宿主还在跑，本轮会跳过；
- **QQ 目标只在一端填**，否则两边都会发。

## 2. 装 B站依赖并登录

重启 DSH 后：

```text
设置 → 刷B站
→ 装主依赖
→ 扫码登录
```

扫码确认时选「记住我 / 长期」。

## 3. 填 GitHub Token

推荐 Fine-grained token：

```text
Repository access: Public repositories
Account permissions: 0
```

公开仓库默认只读，不需要额外 Contents 权限。  
如果以后要读私有仓库，再选 `Only select repositories` 并给 `Contents: Read-only`。

## 4. 安装 NapCat 插件

把本仓库的：

```text
napcat-plugin/
```

复制到：

```text
<NapCat>/plugins/napcat-plugin-dsh-bili-forward/
```

编辑：

```text
<NapCat>/config/plugins/napcat-plugin-dsh-bili-forward/config.json
```

至少填 `groupIds`、`privateIds`、`token`、`forwardBriefs: true`。

改完重启 NapCat。通常不需要重启 QQ；如果实际环境要求重启 QQ，先询问用户。

### NapCat 4.18.4x 的插件白名单

NapCat 4.18.41 把官方插件白名单硬编码在 `napcat.mjs` 里，第三方插件会被静默拒载。日志通常出现在：

```text
<NapCat>/logs
%ProgramData%\NapCatQQ Desktop\logs\bots\bots\<qq>.log
```

典型日志：

```text
[PluginLoader] Rejected napcat-plugin-dsh-bili-forward
(napcat-plugin-dsh-bili-forward): not in official plugin whitelist
[PluginManager] Scanned 0 plugins
[PluginManager] Loaded 0 plugins
```

对应源码类似：

```js
const mge = new Set([
  "napcat-plugin-builtin",
  "napcat-plugin-cleaner",
  "napcat-plugin-ssqq",
  "napcat-plugin-qce"
])
```

#### 路线 A：打白名单补丁

在 `<NapCat>/napcat.mjs` 里把：

```js
"napcat-plugin-qce"
```

改成：

```js
"napcat-plugin-qce",
"napcat-plugin-dsh-bili-forward"
```

- 必须用「无 BOM 的 UTF-8」写回
- NapCatQQ Desktop 更新组件会覆盖 `napcat.mjs`，更新后要重新打一次

#### 路线 B：不用 NapCat 插件

改用 OneBot v11 直传后端，配置：

```json
{
  "qqBackend": "onebot",
  "qqForwardUrl": "http://127.0.0.1:3000",
  "qqGroupIds": "123456789",
  "qqPrivateIds": "10001",
  "qqForwardToken": "optional"
}
```

详见 `docs/CONFIG.md` 的 OneBot 小节。

> NapCatQQ Desktop 的界面不会显示这条 white list warn，只能看上面的 bot 日志文件。

## 5. 配置 DSH 的 QQ 转发

在 DSH 设置页填：

```text
QQ 转发地址：http://127.0.0.1:6099/plugin/napcat-plugin-dsh-bili-forward/api/forward
QQ 转发 Token：和 NapCat 插件里的 token 一致
```

如果 NapCat WebUI 不是 6099，改成实际端口。

如果使用 OneBot v11 直传，`qqForwardUrl` 填 OneBot HTTP base，并把 `qqBackend` 设为 `onebot`；见 `docs/CONFIG.md`。

## 6. 测试

先不要开定时：

```text
设置 → 刷B站 → 现在跑一轮
```

检查：

- `<DSH_HOME>/bili-duty/out/YYYY-MM-DD.md`
- `<DSH_HOME>/bili-duty/out/YYYY-MM-DD.qq.md`
- QQ 是否收到分段消息
- B站是否没有发评论/私信

确认后再打开每日定时。
