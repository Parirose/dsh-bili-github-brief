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
| `qqForwardUrl` | 空 | NapCat 插件转发地址 |
| `qqForwardToken` | 空 | 和 NapCat 插件 token 一致 |
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

## 定时

```text
设置 → 刷B站 → B站 + GitHub AIGC 简报
启用每日定时
时间：09:00
```

默认关闭。建议先手动跑 1 到 3 天。
