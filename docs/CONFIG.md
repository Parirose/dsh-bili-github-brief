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
| `dmMode` | off | 必须保持 off，本项目不发 B站私信 |
| `qqBackend` | napcat-plugin | QQ 投递后端：`napcat-plugin` / `onebot` |
| `qqForwardUrl` | 空 | NapCat 插件转发地址，或 OneBot HTTP base |
| `qqForwardToken` | 空 | NapCat 插件 token，或 OneBot Bearer token |
| `qqGroupIds` | 空 | OneBot 群号，英文逗号分隔 |
| `qqPrivateIds` | 空 | OneBot 私聊 QQ，英文逗号分隔 |
| `keywords` | 空 | 固定关键词，一行一个 |
| `perDay` | 10 | 每日最多挑几条 |
| `transcribe` | false | 无字幕时是否本地转写 |
| `asrModel` | small | Whisper 模型大小 |
| `reportLevel` | full | 报告详细程度 |

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

NapCat 插件配置：

```json
{
  "enabled": true,
  "groupIds": "123456789,987654321",
  "privateIds": "10001,10002",
  "forwardBriefs": true,
  "token": "change-me"
}
```

- `groupIds`：多个群，英文逗号分隔
- `privateIds`：多个 QQ，英文逗号分隔
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
- 默认值 `qqBackend: "napcat-plugin"`，老配置不需要改

## 定时

```text
设置 → 刷B站 → B站 + GitHub AIGC 简报
启用每日定时
时间：09:00
```

默认关闭。建议先手动跑 1 到 3 天。
