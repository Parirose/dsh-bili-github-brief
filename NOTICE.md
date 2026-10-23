# NOTICE

本项目是一个独立项目，修改自以下上游项目。

> 本项目是 **独立二改项目**，不是 GitHub Fork。MIT 许可证允许修改、再分发和独立发布；本项目保留上游版权声明，并在下面列明修改内容。

## 上游与版权

### c1overzz/dsh-bili-scroll

- 仓库：https://github.com/c1overzz/dsh-bili-scroll
- 许可证：MIT
- 原始版权：Copyright (c) 2026 c1overzz
- 上游版本：2d71abd25bee19a6bdc0c586b7d6e11c5ee4499c（2026-10-22）
- 使用方式：本项目基于其 B站值班框架、DSH 插件结构、MCP 启动方式与报告流程进行了修改。

主要修改：

- 增加 GitHub 搜索、README、tree、file、releases、workflow 工具
- 增加 B站 + GitHub 合并简报模式
- 关闭 B站私信发送
- 增加 NapCat brief_ready 投递
- 增加每日定时与设置页字段
- 增加 QQ 版纯 URL 输出与动态分段
- 更新检查与一键升级指向本项目，不再指向上游

### adoresever/bilibili-mcp

- 仓库：https://github.com/adoresever/bilibili-mcp
- 许可证：MIT
- 原始版权：Copyright (c) 2026 AGI_Ananas（见 `vendor/bilibili-mcp/LICENSE`）
- 使用方式：`vendor/bilibili-mcp/` 中的 B站 MCP 工具来自该上游，并做了本地修改。
- 原始许可证保留在 `vendor/bilibili-mcp/LICENSE`。

## 依赖与兼容

- NapCatQQ：QQ 接入框架，https://github.com/NapNeko/NapCatQQ
- DSH：DeepSeek Harness，https://github.com/deepseek-ai/deepseek-harness

## 参考但未直接复用代码

- moxingovo/dsh-github：GitHub 工具形态参考
- Yuuyuko-uu/dsh-qq-bridge：QQ 桥接方案参考

如果后续实际复制了上述项目的代码，请在此处改为「基于 / 修改自」，并保留对应许可证。

## 非官方声明

本项目是非官方社区项目，与 B站、GitHub、NapCat 官方无隶属关系。
