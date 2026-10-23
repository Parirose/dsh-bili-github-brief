# dsh-bili-github-brief

B站 + GitHub AIGC 日报生成器，DSH 插件 + NapCat QQ 投递。

## 两个插件

- 根目录：DSH 插件
- `napcat-plugin/`：NapCat 插件，不含 NapCat 本体

## 核心能力

- B站搜索 / 视频信息 / 字幕 / 评论
- GitHub 搜索 / README / releases / workflow
- ComfyUI workflow JSON 静态解析
- 新模型雷达
- 本地 Markdown 报告
- QQ 动态分段，每条带纯 URL

## 边界

- B站只读，不发评论/私信
- GitHub 只读
- Token 不进入报告和 QQ
- 工作流不执行

## 文档

见 `README.md`、`docs/INSTALL.md`、`docs/CONFIG.md`。
