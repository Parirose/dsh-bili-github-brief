# 兼容占位

本项目默认使用 `prompts/brief-prompt.txt` 生成 B站 + GitHub AIGC 日报。

这个 `duty.md` 只用于兼容旧的 `dsh-bili-scroll` 读取路径，不包含评论、私信或其他 B站写操作。

如果 `briefMode` 被关闭，旧模式不应被用于公开发送。请保持 `dmMode: off`，并只在本地读取。
