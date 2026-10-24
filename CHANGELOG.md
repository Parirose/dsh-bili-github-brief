# Changelog

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
