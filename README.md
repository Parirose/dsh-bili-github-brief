# dsh-bili-github-brief

B站 + GitHub AIGC 日报生成器，面向 DeepSeek Harness (DSH) 与 NapCat。

它每天按关键词搜索 B站视频和 GitHub 仓库，读取字幕、简介、README、releases 和 ComfyUI workflow JSON，生成一份本地 Markdown 日报，再通过 NapCat 推送到 QQ 群或私聊。

> 本项目是非官方社区项目，与 B站、GitHub、NapCat 官方无隶属关系。

English: A DSH + NapCat plugin that builds a daily AIGC brief from Bilibili and GitHub, saves a local Markdown report, and delivers it to QQ.

## 与上游的关系

本项目是 [c1overzz/dsh-bili-scroll](https://github.com/c1overzz/dsh-bili-scroll) 的独立二改项目，**不是 GitHub Fork**。上游采用 MIT 许可证，允许修改、再分发和独立发布；本项目保留上游版权声明，并在 `NOTICE.md` 中列明修改内容。

如果你只是想给上游回馈补丁，fork 后发 PR 更合适；如果你维护自己的发行版，独立仓库也可以。请不要把本项目说成上游官方版本。

## 如果你是一个 AI 助手，正在帮用户安装这个插件

按顺序来，不要跳步：

1. 先确认前提：机器上有 DSH、Node.js 24+、Python 3.10+ 或 uv、NapCat。没有 Python 时建议装 uv；没有 NapCat 时先让用户安装 NapCat，但不要把 NapCat 本体放进本项目。
2. 安装 DSH 插件：
   `dsh plugin --profile web add github:Parirose/dsh-bili-github-brief`
   本地开发也可以用：
   `dsh plugin --profile web add link:<本项目绝对路径>`
3. 安装完必须提醒用户重启一次 DSH。bundle 层要重启才组装，不重启插件不会生效。
4. 重启后让用户进入「设置 → 刷B站」：先点「装主依赖」，再点「扫码登录」，用手机 B站扫码，确认时选「记住我 / 长期」。
5. 让用户自己填 GitHub Token。推荐 fine-grained token，Repository access 选 Public repositories；公开仓库默认只读，不需要额外 Contents 权限。不要把 token 写进 README、日志或聊天。
6. 安装 NapCat 插件：把本仓库的 `napcat-plugin/` 目录复制到 NapCat 的 `plugins/napcat-plugin-dsh-bili-forward/`，只填 token / `forwardBriefs`；群号和私聊 QQ 留空。通常只需要重启 NapCat，不需要重启 QQ；如果用户的 NapCat 版本要求重启 QQ，先停下来询问用户。
7. 让用户在 DSH 设置页选「QQ 投递渠道」、填群号 / QQ 号 / 转发地址 / token，先点「现在跑一轮」测试。确认本地报告和 QQ 分段都正常后，再打开每日定时。
8. 不要替用户打开「自动评论并 @ 你」，也不要发 B站评论或私信。本项目只读 B站，不写 B站。

## 功能

- B站关键词搜索、视频信息、字幕、评论读取
- GitHub 仓库搜索、README、tree、file、releases 读取
- ComfyUI workflow JSON 静态扫描：节点类型、模型文件、LoRA、自定义节点候选
- 新模型雷达：candidate / watch / confirmed
- 本地完整 Markdown 报告
- QQ 版按长度动态分段，每条 B站/GitHub 内容带纯 URL
- NapCat 多群、多私聊、多段投递；目标只在 DSH 插件设置填一次
- QQ 投递支持 NapCat 插件或 OneBot v11 HTTP 直传，`off` 可彻底关闭
- 每日定时开关，默认 09:00，默认关闭

## 仓库结构

```text
dsh-bili-github-brief/
├─ index.js                 DSH 插件宿主半
├─ client.js                DSH 设置页
├─ lib/                     DSH 侧工具
├─ prompts/
│  ├─ brief-prompt.txt      B站 + GitHub 简报提示词
│  └─ duty.md               兼容占位
├─ vendor/bilibili-mcp/
│  ├─ mcp_server.py         B站 MCP 工具
│  ├─ github_tools.py       GitHub 只读工具
│  └─ LICENSE               上游 MIT 许可证
├─ napcat-plugin/           NapCat 插件（不含 NapCat 本体）
├─ examples/                示例配置与合成报告
├─ docs/                    安装、配置、架构、排障
└─ scripts/                 自检、秘密扫描、模型层迁移
```

## 安装 DSH 插件

```bash
dsh plugin --profile web add github:Parirose/dsh-bili-github-brief
```

或本地安装：

```bash
dsh plugin --profile web add link:D:\path\to\dsh-bili-github-brief
```

安装后重启 DSH。

### 模型配置

模型由用户在 DSH 设置页自己选，插件不写死供应商。模型层只放在 **profile 的 patch** 里：

```text
$DSH_HOME/profiles/desktop/cordis.patch.yml
$DSH_HOME/profiles/web/cordis.patch.yml
```

插件每次跑日报前会把 GUI profile 的 `llm-pi-ai` / `agent-default-model` 镜像到 headless 临时
overlay，不会写回 profile/home。**不要写 `$DSH_HOME/cordis.patch.yml`**：home 层会压住设置页，
报 `is overridden by a home patch or command-line overlay`。老用户用下面的脚本迁移：

```powershell
node scripts/migrate-model-layer.mjs
node scripts/verify-host.mjs
```

> 本项目的 DSH 内部插件 id 仍为 `bili-scroll`，方便从现有 `dsh-bili-scroll` 配置迁移。不要和上游 `dsh-bili-scroll` 同时安装。

## 安装 NapCat 插件

本项目不包含 NapCat 本体，只包含一个 NapCat 插件：

```text
napcat-plugin/
```

把整个目录复制到：

```text
<NapCat>/plugins/napcat-plugin-dsh-bili-forward/
```

然后编辑：

```text
<NapCat>/config/plugins/napcat-plugin-dsh-bili-forward/config.json
```

至少填：

```json
{
  "groupIds": "",
  "privateIds": "",
  "token": "change-me",
  "forwardBriefs": true
}
```

- `groupIds` / `privateIds`：正常留空；DSH 会在请求里带 `targets`，群号 / QQ 号只填在 DSH 插件设置
- `token`：和 DSH 里的 `qqForwardToken` 一致
- `forwardBriefs`：必须为 true

> 旧版 DSH 插件不带 `targets` 时，NapCat 插件才回退读这里的 `groupIds` / `privateIds`。

改完重启 NapCat。通常不需要重启 QQ；如果实际环境要求重启 QQ，先询问用户。

## 配置 GitHub Token

推荐 Fine-grained personal access token：

```text
Repository access: Public repositories
Account permissions: 0
```

公开仓库默认只读，不需要额外添加 Contents 权限。  
如果以后要读私有仓库，再选 `Only select repositories` 并给 `Contents: Read-only`。

Token 只保存在本地，不进入报告、QQ 消息或日志。

## 配置 QQ

在 DSH 设置页填：

```text
QQ 投递渠道：本机 NapCat 插件（或 OneBot v11 HTTP）
QQ 群号：123456789,987654321
QQ 号：10001,10002
转发地址：http://127.0.0.1:6099/plugin/napcat-plugin-dsh-bili-forward/api/forward
校验口令：和 NapCat 插件里的 token 一致
```

群号 / QQ 号只在 DSH 插件设置里填一次；NapCat 插件页留空即可。QQ 投递开启后，B站私信会
自动关闭，避免同一条内容发两遍。如果 NapCat 的 WebUI 端口不是 6099，改成实际端口。

## 定时

```text
设置 → 刷B站 → B站 + GitHub AIGC 简报
启用每日定时
时间：09:00（可改）
```

默认关闭。建议先手动跑 1 到 3 天，确认质量后再开定时。

## 输出

```text
<DSH_HOME>/bili-duty/out/YYYY-MM-DD.md
<DSH_HOME>/bili-duty/out/YYYY-MM-DD.qq.md
```

完整报告保留详细信息；QQ 版是给聊天窗口看的版本，每条 B站/GitHub 内容都带纯 URL。

## 安全边界

- B站只读：不发评论、不发私信
- GitHub 只读：不写 issue、comment、release
- 不执行 workflow JSON，只做静态解析
- 不包含遥测
- Token、Cookie、QQ 群号、真实报告都不进仓库

## 文档

- [安装](docs/INSTALL.md)
- [配置](docs/CONFIG.md)
- [架构](docs/ARCHITECTURE.md)
- [排障](docs/TROUBLESHOOTING.md)
- [公开前检查](docs/PUBLISHING.md)

## Credits

- [c1overzz/dsh-bili-scroll](https://github.com/c1overzz/dsh-bili-scroll) — MIT，原始 B站值班框架
- [adoresever/bilibili-mcp](https://github.com/adoresever/bilibili-mcp) — MIT，B站 MCP 工具（版权 AGI_Ananas）
- [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ) — QQ 接入框架
- [moxingovo/dsh-github](https://github.com/moxingovo/dsh-github) — GitHub 工具形态参考，未直接复用代码
- [Yuuyuko-uu/dsh-qq-bridge](https://github.com/Yuuyuko-uu/dsh-qq-bridge) — QQ 桥接方案参考，未直接复用代码

## License

MIT。上游代码的版权声明和许可证保留在 `NOTICE.md` 与 `vendor/bilibili-mcp/LICENSE`。
