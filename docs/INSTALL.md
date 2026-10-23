# 安装

## 前提

- DSH（DeepSeek Harness）
- Node.js 24+
- Python 3.10+ 或 uv
- NapCat（仅 QQ 投递需要）
- 一个可登录的 B站账号
- 一个 GitHub 只读 token

## 1. 安装 DSH 插件

```bash
dsh plugin --profile web add github:Parirose/dsh-bili-github-brief
```

本地开发：

```bash
dsh plugin --profile web add link:<本项目绝对路径>
```

安装后必须重启 DSH。

## 2. 装 B站依赖并登录

重启 DSH 后：

```text
设置 → 刷B站
→ 装主依赖
→ 扫码登录
```

扫码确认时选「记住我 / 长期」。

## 3. 填 GitHub Token

推荐 Fine-grained token：

```text
Repository access: Public repositories
Account permissions: 0
```

公开仓库默认只读，不需要额外 Contents 权限。  
如果以后要读私有仓库，再选 `Only select repositories` 并给 `Contents: Read-only`。

## 4. 安装 NapCat 插件

把本仓库的：

```text
napcat-plugin/
```

复制到：

```text
<NapCat>/plugins/napcat-plugin-dsh-bili-forward/
```

编辑：

```text
<NapCat>/config/plugins/napcat-plugin-dsh-bili-forward/config.json
```

至少填 `groupIds`、`privateIds`、`token`、`forwardBriefs: true`。

改完重启 NapCat。通常不需要重启 QQ；如果实际环境要求重启 QQ，先询问用户。

## 5. 配置 DSH 的 QQ 转发

在 DSH 设置页填：

```text
QQ 转发地址：http://127.0.0.1:6099/plugin/napcat-plugin-dsh-bili-forward/api/forward
QQ 转发 Token：和 NapCat 插件里的 token 一致
```

如果 NapCat WebUI 不是 6099，改成实际端口。

## 6. 测试

先不要开定时：

```text
设置 → 刷B站 → 现在跑一轮
```

检查：

- `<DSH_HOME>/bili-duty/out/YYYY-MM-DD.md`
- `<DSH_HOME>/bili-duty/out/YYYY-MM-DD.qq.md`
- QQ 是否收到分段消息
- B站是否没有发评论/私信

确认后再打开每日定时。
