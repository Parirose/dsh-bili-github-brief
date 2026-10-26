# 排障

## DSH 设置页没有出现

- 确认安装到了正确的 profile
- 确认重启过 DSH
- 查看 DSH 日志是否有插件加载错误

## 工具回 ok: true、配置其实没生效

症状：`bili_config`（或面板）显示保存成功，但 `config.json` 里只有一部分键，新键完全不在。

原因：**代码已经拉到磁盘，但 DSH 进程里跑的还是旧版 schema**（进程启动时间早于 git pull / 升级）。
旧版 `DEFAULTS` 不认识新键，落盘时被丢掉；旧版 schema 还会让宿主把整批 patch 拒收，例如：

```text
Config field "guaranteeKeywords" is not volatile
```

v0.1.12 起不再假装成功：

- 返回值里 `ok: false` + `warn` 会写清原因，`ignored: ["guaranteeKeywords"]` 会点名是哪个键被丢；
- `duty.log` 里也有一行「这些设置键这一版不认识，已经丢掉了：…」；
- 不认识的键**不再发给宿主**，所以同一批里认识的键（`perDay` 之类）照样能同步成功。

修法：重启 DSH（让它加载新代码），再存一次。

顺带说明返回值的三个字段：

- `ok`：只有「没完全生效」时才是 false（以前恒 true，就是这个坑）；
- `host.state`：`synced`（宿主也写进去了）/ `rejected`（本地写了、宿主拒收）/ `skipped`（只有 token 这类不需要同步的键）/ `not-written`（这次只读，没写）；
- `ignored`：这一版 schema 不认识的键。

## GitHub 403 / 限流

- 确认 GitHub Token 有效
- 确认 token 至少有公开仓库只读权限
- 匿名限额很低，正式使用建议配 token
- 不要把 token 发到聊天或提交到仓库

## B站没有字幕

- 该视频可能没有 AI 字幕
- 开启「本地转写」并安装转写依赖
- 转写失败时报告会写「因无字幕跳过 N 条」
- 如果错误是 `tls_untrusted_ca` / `CERTIFICATE_VERIFY_FAILED`：这是 `aisubtitle.hdslb.com`
  的中间 CA 不在 Python 的 `certifi` 里，不是反爬。重装主依赖（v0.1.4 的 requirements 已带
  `pip-system-certs`），或手动补：

```powershell
<家>\.venv\Scripts\pip install pip-system-certs
```

装完重启 DSH，让 MCP 子进程重新启动。

## 设置页报 "is overridden by a home patch or command-line overlay"

完整报错类似：

```text
Configuration for "llm-pi-ai" is overridden by a home patch or command-line overlay
```

原因：`$DSH_HOME/cordis.patch.yml` 里写了 `llm-pi-ai` / `agent-default-model`。home 层优先级高于
profile 层，所以设置页写进 profile 的值永远会被 home 层压住，DSH 就拒绝保存。

修法：

1. 把 home patch 里的这两块删掉，模型配置只放在 `profiles/<GUI profile>/cordis.patch.yml`。
2. 老用户可以直接跑自动迁移（会留 `.bak-<时间戳>` 备份，home 里其它配置会保留）：

```powershell
node scripts/migrate-model-layer.mjs
```

3. 再跑 `node scripts/verify-host.mjs`，确认「home patch 没有模型层」。

插件从 v0.1.4 起只把 profile 里的模型层镜像给 headless 临时 overlay，不会写回任何 profile/home。

## QQ 没收到

- 确认 DSH 设置页的「QQ 投递渠道」不是「不发 QQ」
- 确认 `qqGroupIds` / `qqPrivateIds` 填在 **DSH 插件设置**里；NapCat 插件页的
  `groupIds` / `privateIds` 可以留空（旧版没带 `targets` 时才需要在那也填）
- 确认 NapCat 插件已加载，访问 `/plugin/napcat-plugin-dsh-bili-forward/api/health`
- 确认 DSH 和 NapCat 的 token 一致
- 确认 NapCat WebUI 端口和 DSH 里的 `qqForwardUrl` 一致
- 改完 NapCat 配置后重启 NapCat
- 通常不需要重启 QQ；如果实际环境要求，先询问用户

## QQ 消息重复

- 插件有 10 分钟去重
- DSH 侧有 `briefHash`，同一内容不会重复发送
- 如果手动重跑且内容变化，会再发一次

## 模板占位符没有替换

- 确认 DSH 已重启并加载最新 `index.js`
- 确认 `prompts/brief-prompt.txt` 存在
- 如果仍然出现 `{{DATE}}` 等占位符，查看 `duty.log` 并重启 DSH

## QQ.exe 启动即崩 / Low 完整性标签

现象：QQ.exe 启动即崩，事件日志里出现：

```text
出错模块：QQNT.dll
异常代码：0x80000003
偏移：0x26b6e3a
```

这是 NapCat 上游 issue #2116 记录的同一个偏移。

原因：由 DSH 管辖的 shell 解包/复制出来的文件可能带 `Mandatory Label\Low`。一旦落到 QQ / NapCat 目录，注入后会崩。

检查：

```powershell
icacls "<QQ 或 NapCat 目录>"
```

可能看到：

```text
QQ.exe => Mandatory Label\Low Mandatory Level:(I)(NW)
```

修法：

```powershell
icacls "<目录>" /setintegritylevel (OI)(CI)Medium /T
```

给用户的话：不要在 DSH 工作区里解包 QQ / NapCat 再搬过去。

## NapCatQQ Desktop 安装 QQ 时报 os error 5

现象：

```text
放置 QQ 到 ...\components\QQ\versions\<ver> 失败: 拒绝访问 (os error 5)
```

原因：NapCatQQ Desktop 在 7z 解包结束后立刻 rename 整个约 1.2 GB 的暂存目录，此时实时扫描器（例如腾讯云镜 YDService）还持有文件句柄。Windows 下目录里有打开的文件时，rename 会返回 `ACCESS_DENIED`。

实测：解包完成后等约 1 秒，再执行同一个 rename 就会成功。

给用户的话：这是 NapCatQQ Desktop 的竞态，不是本插件的问题。也可以手工把 QQ 解到最终目录，再写：

```text
components\QQ\current.txt = <版本号>
```

## 装依赖卡在「正在下载 uv」

现象：

```text
install.log: 正在下载 uv —— GitHub 直连
```

之后 `bili_setup` 一直返回 `busy:true`，但没有任何安装进程，`venv` 也没创建。

原因：

- v0.1.3 起 uv 下载有超时；v0.1.4 起超时为 180 秒，超时会换源
- `installing` 是进程内内存标志，旧版本下载卡死后不会自己复位

处理：

1. 先强制复位安装状态：

```json
{"force": true}
```

调用 `bili_setup` 时传这个参数。

2. 如果还是下载失败，手工装 venv：

```powershell
uv venv <家>\.venv --python 3.12
uv pip install --python <家>\.venv\Scripts\python.exe `
  -r <仓库>\vendor\bilibili-mcp\requirements.txt `
  --index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

其中 `<家>` 是：

```text
<DSH_HOME>\bili-duty
```

3. 插件判定「venv 就绪」的条件：

```text
<家>\.venv\Scripts\python.exe 存在
site-packages 里有 bilibili_api / mcp / qrcode
Windows 还要有 pip_system_certs（字幕 TLS 根证书修复）
```

4. 装完后把 `pythonPath` 指到：

```text
<家>\.venv\Scripts\python.exe
```

新版会优先复用宿主自带的 uv，再试 `%LOCALAPPDATA%\uv`、`%USERPROFILE%\.cargo\bin` 和 PATH，最后才下载。
