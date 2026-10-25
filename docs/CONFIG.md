# 配置

## DSH 配置字段

| 字段 | 默认 | 说明（作用 / 什么时候别动）|
|---|---|---|
| `perDay` | 5 | 每天最多挑几条（B站与 GitHub 各自硬上限）。别动：想要更多内容就调大，但超过 10 条日报会很长、QQ 会分更多段。 |
| `peakValley` | false | 峰谷时段自动刷总开关。**只对非日报模式生效**（日报模式看 `scheduleEnabled` / `scheduleTime`）。 |
| `noon` | true | 峰谷子开关：中午窗口（12:00–14:00）。仅 `peakValley` 为 true 且非日报模式时生效。 |
| `night` | true | 峰谷子开关：晚间 / 夜间窗口（18:00 之后到 09:00）。同上。 |
| `autoComment` | false | 自动在 B站 视频下发公开评论并 @ `mentionName`。**会对外发东西**，默认开关时请确认你确实想让它用你的号说话。 |
| `mentionName` | 空 | 要 @ 的 B站 昵称。**留空 = 不发评论**（`commentOn` 的必要条件）。 |
| `commentPerRound` | 1 | 每轮最多发几条评论（0–20，0 = 不发）。范围由 `clampPatch` 在读写两头钳。 |
| `replyToComments` | false | 回复“直接回复在你那条评论下面的人”（楼中楼）。**会对外发东西**。 |
| `replyPerRound` | 1 | 每轮最多回几条（1–10）。仅 `replyToComments` 开着时生效。 |
| `keywords` | 空 | 固定关键词，一行一个；留空用章程里默认那几组。 |
| `dmMode` | off | B站私信：`off` / `only` / `both`。`qqBackend` 不是 `off` 时**本项被忽略**。 |
| `dmUid` | 0 | 私信收件人的 B站 UID（数字）。`dmMode` 不是 off 且它 > 0 才真发。 |
| `qqBackend` | off | QQ 投递后端：`off` / `napcat-plugin` / `onebot`。老配置只有 `qqForwardUrl` 且没写过本项时自动按 `napcat-plugin`。 |
| `qqForwardUrl` | 空 | NapCat 插件转发地址，或 OneBot HTTP base。`qqBackend=off` 时不用填。 |
| `qqForwardToken` | 空 | NapCat 插件 token，或 OneBot Bearer token。和 NapCat 侧不一致会 401。 |
| `qqGroupIds` | 空 | QQ 群号，英文逗号分隔；NapCat 插件与 OneBot 共用。 |
| `qqPrivateIds` | 空 | 私聊 QQ 号，英文逗号分隔；NapCat 插件与 OneBot 共用。 |
| `briefMode` | true | 合并简报（日报）模式。开着时调度看「每日定时」，关了才看峰谷窗口。别动：它决定这一轮是「日报」还是「刷B站」。 |
| `githubEnabled` | true | 日报模式下是否采集 GitHub。关了就只有 B站那半。 |
| `githubToken` | 空 | GitHub 只读 token，仅保存在本地，不进报告 / 日志。 |
| `githubDiscover` | true | 从标题 / 简介 / 字幕 / README 里提取新模型候选。 |
| `workflowScan` | true | 对 Top 10 仓库最多各扫 3 个 ComfyUI workflow JSON（静态解析，不执行代码）。 |
| `scheduleEnabled` | false | **日报模式**的每日定时开关。非日报模式下本项不生效。 |
| `scheduleTime` | 09:00 | 每天几点跑（HH:MM）。仅日报模式 + `scheduleEnabled` 时生效。 |
| `transcribe` | false | 没字幕的视频是否在本机转写（要另装转写依赖）。 |
| `asrModel` | small | Whisper 模型大小（tiny / base / small / medium）。越大越准也越慢。 |
| `pythonPath` | python | 跑 MCP 子进程用的 Python。**别手改**：点「装主依赖」后插件会自动指到 venv 里那个。 |
| `dshBin` | 空 | `dsh` 的 bin.js 路径。**一般不用填**：插件会自动探测（含 app.asar）；只有自动探测失败时手填。 |
| `headlessProfile` | headless | 跑一轮时用哪个 profile。别动：填一个不存在的档，那一轮会直接报错不跑。 |
| `overlayMcp` | true | 给那一轮叠一份插件自己的 patch（把 B站 / GitHub MCP 挂上）。**关了 = 那一轮 0 个工具、报告必空**，只在排障时才关。 |
| `overlayModel` | true | 把 GUI profile 的模型层镜像给 headless 那一轮。别动：关了就只能用 headless 默认模型。 |
| `guiProfile` | desktop | GUI 用哪个 profile（找不到时会自动扫 `profiles/web` 等）。一般不用改。 |
| `modelLayerFile` | 空 | 可选：直接指定一份含 `llm-pi-ai` / `agent-default-model` 的 patch 文件。正常不用填。 |
| `stateDir` | 空 | 多宿主共存时填一个独立目录名（例 `bili-duty-web`）；留空 = 旧的 `bili-duty`。**只认单层目录名**，改完要重启 DSH。 |
| `workspace` | 空 | 工作区路径；会读这里的 `AGENTS.md` 当作人设（日报模式也生效，仅影响语气 / 称呼）。 |
| `reportLevel` | full | 报告详细程度：`full` / `brief` / `off`。 |

> 数量对应：schema 里 35 个键，上表 35 行。新增键时请同步补行（`node scripts/audit-config.mjs` 会把“没文档化”也报出来）。

## 会对外发东西的开关

**这一节里的开关会让这台机器对外产生动作（评论 / 私信 / 群消息），不是只影响本地报告。**
默认全部是关的，打开前请确认你确实想让它出去。

| 开关 | 默认 | 会发生什么 |
|---|---|---|
| `autoComment` + `mentionName` | false / 空 | 两个同时成立时，`mcpWhitelist()` 会把 `bili_reply` 塞进那一轮的 MCP 工具列表 ⇒ 模型**真的会在 B站 视频下发公开评论并 @ 人**。且每轮最多 `commentPerRound` 条。 |
| `replyToComments` + `replyPerRound` / `commentPerRound` | false / 1 / 1 | 同上的白名单逻辑也会把 `bili_reply` 塞进去，并且它会**回楼中楼**（只回直接回复在你那条评论下面的人）。 |
| `dmMode` / `dmUid` | off / 0 | 给谁发 B站 **私信**。⚠️ `qqBackend` 不是 `off` 时本项被忽略（下一行）。 |
| `qqBackend` / `qqGroupIds` / `qqPrivateIds` | off / 空 / 空 | 投递到 QQ（群 / 私聊）。QQ 接手后 `dmMode` 被强制当成 `off`，并且 `bili_send_message` **不再注册**到那一轮的工具列表 ⇒ 避免同一条内容两边发。 |

补充：上面这些开关都是“开了才发”；没开时插件只读 B站 / GitHub、写本地报告。

## 调度：两套窗口互斥

- **日报模式**（`briefMode: true`，默认）⇒ 只看 `scheduleEnabled` / `scheduleTime`；
  `peakValley` / `noon` / `night` **不生效**（面板上会置灰）。
- **非日报模式**（`briefMode: false`）⇒ 只看 `peakValley` + `noon` / `night`；
  `scheduleEnabled` / `scheduleTime` **不生效**（面板上会置灰，`nextRunAt` 为空）。

实现在 `index.js` 的 `tick()`：`briefMode !== false` 时直接走定时分支并 `return`；
否则才进峰谷分支。改面板文案时请同步看它，别只改 UI。

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
