# Security

请不要在 issue、PR、聊天或截图中提交以下内容：

- GitHub Token
- B站 SESSDATA / bili_jct
- QQ 转发 token
- 真实 QQ 群号 / QQ 号
- 真实 B站 UID
- 包含个人路径的日志

如果发现密钥泄露：

1. 立刻撤销对应 token
2. 重新生成
3. 检查 Git 历史
4. 如果已经 push，按平台流程清理历史并通知使用者

本项目默认只读 B站和 GitHub，不执行 workflow JSON，不包含遥测。
