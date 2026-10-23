# 架构

```text
DSH 定时/手动触发
  → 启动 headless 会话
  → 读取 brief-prompt.txt
  → MCP 工具采集
      ├─ B站：搜索、视频信息、字幕、评论
      └─ GitHub：搜索、README、tree、file、releases、workflow
  → 模型筛选、去重、提取新模型
  → 写本地报告
      ├─ out/YYYY-MM-DD.md
      └─ out/YYYY-MM-DD.qq.md
  → 读取 QQ 版并分段
  → POST 到 NapCat 插件 brief_ready
  → NapCat 发送到多个 QQ 群/私聊
```

## DSH 侧

- `index.js`：插件宿主、设置页 API、定时、MCP 启动、QQ 投递
- `client.js`：DSH 设置页
- `lib/`：状态、MCP 客户端、登录、转写、复核
- `prompts/brief-prompt.txt`：日报提示词
- `vendor/bilibili-mcp/mcp_server.py`：B站 MCP 工具
- `vendor/bilibili-mcp/github_tools.py`：GitHub 只读工具

## NapCat 侧

- `napcat-plugin/index.mjs`：接收 `brief_ready`，按 `parts` 逐段发送
- 支持多群、多私聊、token 校验、去重

## 数据边界

- B站只读
- GitHub 只读
- workflow JSON 只做静态解析，不执行
- Token 只保存在本地
- 报告只写本地，不自动上传
