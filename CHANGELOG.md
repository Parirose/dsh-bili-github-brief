# Changelog

## 0.1.5

### Fixed
- 修 0.1.4 冷启动 TDZ：`loadCfg()` 里 `applyLegacyQQBackend` 引用了后面才声明的 `touched`，
  Settings 服务未就绪（`row === null`）时会先走那条 return ⇒
  `ReferenceError: Cannot access 'touched' before initialization` ⇒ 日志 `1 entry did not activate`
  ⇒ 插件所有 HTTP 路由不存在 ⇒ 设置面板「读不到插件配置」
- `ov` / `touched` 整体上移到 `settingsDesc()` 之后、`applyLegacyQQBackend` 之前

### Added
- `scripts/smoke-apply.mjs`：用假 ctx 真跑一遍 `apply()`（冷启动 / 老配置兼容 / 显式 off / Settings 已就绪），
  专门防这类「声明顺序 / TDZ」回归——`node --check` 只查语法，查不出这种错

## 0.1.4

### Breaking
- `llm-pi-ai` / `agent-default-model` 不再由插件写入或写回；模型层只放在 profile patch。插件会把 GUI profile 的模型层镜像给 headless 临时 overlay（P0）
- `qqBackend` 新增 `off` 并成为新默认；QQ 群号 / QQ 号改在 DSH 插件设置里填一次，NapCat 插件通过请求里的 `targets` 接收（P1）
- `perDay` 在 brief 模式里成为真正的硬上限，提示词会收到 `PER_DAY` / `ALREADY` / `LEFT`（P1）

### Fixed
- 新增 `overlayModel` / `guiProfile` / `modelLayerFile`；自动扫描 `profiles/web` 等 GUI profile，不再假设只有 `desktop`
- 新增 `scripts/migrate-model-layer.mjs`：从 home patch 迁移模型层到 desktop/headless profile，保留 home 里其它配置并留备份
- `scripts/verify-host.mjs` 增加 home patch 模型层体检
- QQ 投递开启后强制关闭 B站私信，`bili_send_message` 不再出现在那一轮的工具白名单里
- `splitBriefParts()` 超过 8 段时明确写日志，不再静默丢尾
- `bili_video_info` 用 `get_tags()` 补标签，不再恒为空
- Windows 依赖增加 `pip-system-certs`；字幕 TLS 失败返回 `tls_untrusted_ca` 和修复提示
- uv 下载超时改为 180 秒，并区分「超时换源」和普通失败

## 0.1.3

### Fixed
- `ensureOverlay()` 不再写死 `wb-proxy` / `WB_PROXY_API_KEY` / `127.0.0.1:8788`，headless 直接继承用户 profile / home 层的模型配置
- `findDshCli()` 先直接探测 `<resources>/app.asar/node_modules/@deepseek-ai/dsh/lib/bin.js`，不再被 asar 的 `Dirent.isDirectory() === false` 卡住
- `ensureUv()` 下载增加 `AbortSignal.timeout(120000)`；失败/超时写入原因和手工兜底命令
- `bili_setup` 增加 `force: true`，用于复位卡住的 `installing`
- 优先复用宿主自带 uv（`@dataiku/uv-*`），再探测 `%LOCALAPPDATA%\uv`、`%USERPROFILE%\.cargo\bin`、PATH

### Added
- `docs/TROUBLESHOOTING.md`：补手工建 venv、依赖判定条件和 `bili_setup force` 用法

## 0.1.2

### Fixed
- `client.js` 注册 id 改成真实包名 `dsh-bili-github-brief`，避免桌面版 duplicate factory registration 和 profile 回滚
- `docs/INSTALL.md` / `napcat-plugin/README.md`：补 NapCat 4.18.4x 的官方插件白名单与绕行路线
- `docs/TROUBLESHOOTING.md`：补 DSH Low 完整性标签、NapCatQQ Desktop 安装 QQ 的 os error 5

### Added
- OneBot v11 直传后端：`qqBackend: "onebot"`，复用现有分段、去重和 token 逻辑

## 0.1.1

### Fixed
- 桌面版（DSH NEXT / Electron）装完不激活：`cordis.patch.yml` 的 `name` 与包名不一致
- 桌面版取不到宿主 `schemastery` / `dsh-tools`：宿主包在 `app.asar` 内，`candidateRoots()` 现在会从 `process.resourcesPath` / `process.execPath` 推导 asar 路径
- 更新检查与一键升级指向本项目自身，而不是上游仓库

### Added
- `scripts/verify-host.mjs`：装后自检（包名一致性 / 命名空间绑定 / 宿主依赖可达）
- `docs/INSTALL.md`：桌面版安装路径、headless profile 前置条件

## 0.1.0

- 初始独立版本
- B站 + GitHub AIGC 合并简报
- GitHub 搜索、README、tree、file、releases、workflow 工具
- ComfyUI workflow JSON 静态解析
- 新模型雷达
- 本地 Markdown 报告
- QQ 动态分段，每条带纯 URL
- NapCat brief_ready 多群/多私聊投递
- 关闭 B站私信，保持 B站只读
