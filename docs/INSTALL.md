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

而 headless 那一轮也要能拿到模型：供应商/默认模型写到 **home 层 patch**（`$DSH_HOME/cordis.patch.yml`），才会同时作用于 desktop 和 headless。

### 宿主依赖自检

安装或升级后，在插件目录运行：

```powershell
node scripts/verify-host.mjs
```

桌面版用 Electron 再跑一次（能读 `app.asar` 的是这条）：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& '<app>\DSH NEXT.exe' scripts\verify-host.mjs
```

看到 `schemastery 取到了` 和 `dsh-tools：从宿主树取到` 才算完整。

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

## 5. 配置 DSH 的 QQ 转发

在 DSH 设置页填：

```text
QQ 转发地址：http://127.0.0.1:6099/plugin/napcat-plugin-dsh-bili-forward/api/forward
QQ 转发 Token：和 NapCat 插件里的 token 一致
```

如果 NapCat WebUI 不是 6099，改成实际端口。

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
