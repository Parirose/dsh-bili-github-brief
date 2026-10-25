# 配置

## DSH 配置字段

| 字段 | 默认 | 说明 |
|---|---|---|
| `briefMode` | true | 开启 B站 + GitHub 合并简报 |
| `githubEnabled` | true | 开启 GitHub 采集 |
| `githubToken` | 空 | GitHub 只读 token，仅保存在本地 |
| `githubDiscover` | true | 自动发现新模型候选 |
| `workflowScan` | true | 扫描 ComfyUI workflow JSON |
| `scheduleEnabled` | false | 每日定时开关 |
| `scheduleTime` | 09:00 | 每日运行时间 |
| `dmMode` | off | B站私信：off / only / both；`qqBackend` 不是 off 时本项被忽略 |
| `qqBackend` | off | QQ 投递后端：`off` / `napcat-plugin` / `onebot`；老配置有 `qqForwardUrl` 且没写过本项时自动按 `napcat-plugin` |
| `qqForwardUrl` | 空 | NapCat 插件转发地址，或 OneBot HTTP base |
| `qqForwardToken` | 空 | NapCat 插件 token，或 OneBot Bearer token |
| `qqGroupIds` | 空 | QQ 群号，英文逗号分隔；NapCat 插件与 OneBot 共用 |
| `qqPrivateIds` | 空 | 私聊 QQ 号，英文逗号分隔；NapCat 插件与 OneBot 共用 |
| `overlayModel` | true | 把 GUI profile 的模型层镜像给 headless 那一轮 |
| `guiProfile` | desktop | GUI 使用哪个 profile；找不到时自动扫描 web 等其它 profile |
| `modelLayerFile` | 空 | 可选：直接指定含模型层的 patch 文件 |
| `keywords` | 空 | 固定关键词，一行一个 |
| `perDay` | 5 | 每日最多挑几条（B站与 GitHub 各自硬上限） |
| `transcribe` | false | 无字幕时是否本地转写 |
| `asrModel` | small | Whisper 模型大小 |
| `reportLevel` | full | 报告详细程度 |
| `workspace` | 空 | 工作区路径；会读这里的 `AGENTS.md` 当作人设（日报模式也生效，仅影响语气 / 称呼）|

## GitHub Token

推荐 Fine-grained token：

```text
Repository access: Public repositories
Account permissions: 0
```

公开仓库默认只读。  
如果以后要读私有仓库：

```text
Repository access: Only select repositories
Repository permissions:
  Contents: Read-only
  Metadata: Read-only
```

## QQ 配置

推荐只在 **DSH 设置页 → 刷B站 → QQ 投递渠道** 填一次：

```text
投递渠道：本机 NapCat 插件
QQ 群号：123456789,987654321
QQ 号：10001,10002
转发地址：http://127.0.0.1:6099/plugin/napcat-plugin-dsh-bili-forward/api/forward
校验口令：和 NapCat 插件里的 token 一致
```

DSH 会把 `targets` 一起发给 NapCat 插件；NapCat 插件页的 `groupIds` / `privateIds`
可以留空。只有旧版本没带 `targets` 的请求才会回退读 NapCat 自己的配置。

NapCat 插件配置文件（一般只需要 `enabled` / `forwardBriefs` / `token`）：

```json
{
  "enabled": true,
  "groupIds": "",
  "privateIds": "",
  "forwardBriefs": true,
  "token": "change-me"
}
```

- `groupIds` / `privateIds`：兼容旧请求的兜底；正常留空
- `token`：必须和 DSH 里的 `qqForwardToken` 一致
- `forwardBriefs`：必须为 true

### OneBot v11 直传（不经过 NapCat 插件）

如果 NapCat 4.18.4x 的白名单不让第三方插件加载，可以直接走 OneBot v11 HTTP。

```json
{
  "qqBackend": "onebot",
  "qqForwardUrl": "http://127.0.0.1:3000",
  "qqGroupIds": "123456789",
  "qqPrivateIds": "10001",
  "qqForwardToken": "optional"
}
```

- `qqForwardUrl` 填 OneBot HTTP 服务的 base，不要带 `/send_group_msg`
- DSH 会自动请求 `<base>/send_group_msg` 和 `<base>/send_private_msg`
- `qqGroupIds` / `qqPrivateIds` 用英文逗号分隔
- `qqForwardToken` 非空时作为 `Authorization: Bearer <token>` 发送
- 新默认是 `qqBackend: "off"`；老配置只填了 `qqForwardUrl` 时会自动兼容成 `napcat-plugin`

## 定时

```text
设置 → 刷B站 → B站 + GitHub AIGC 简报
启用每日定时
时间：09:00
```

默认关闭。建议先手动跑 1 到 3 天。
