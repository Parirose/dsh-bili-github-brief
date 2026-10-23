# napcat-plugin-dsh-bili-forward

NapCat 插件：接收 DSH 插件发出的 `brief_ready` 事件，把 B站 + GitHub AIGC 日报转发到多个 QQ 群和多个 QQ 私聊。

本目录只是 NapCat 插件，不包含 NapCat 本体。

## 功能

- `brief_ready`：发送日报，支持 `parts` 多段
- `comment_sent`：可选，转发 B站评论
- `dm_sent`：可选，转发 B站私信
- 多群：`groupIds` 英文逗号分隔
- 多私聊：`privateIds` 英文逗号分隔
- token 校验
- 10 分钟去重
- 空 `brief_ready` 不会误发

## 安装

把本目录复制到：

```text
<NapCat>/plugins/napcat-plugin-dsh-bili-forward/
```

然后在：

```text
<NapCat>/config/plugins/napcat-plugin-dsh-bili-forward/config.json
```

填入真实配置。

示例见仓库根目录的 `examples/napcat-config.example.json`。

## 配置

```json
{
  "enabled": true,
  "groupIds": "123456789,987654321",
  "privateIds": "10001,10002",
  "forwardComments": true,
  "forwardDms": true,
  "forwardBriefs": true,
  "includeLink": true,
  "prefix": "【B站】",
  "template": "{prefix} {kind}\n{text}\n{url}",
  "token": "change-me",
  "atSign": ""
}
```

- `groupIds`：多个群用英文逗号分隔
- `privateIds`：多个 QQ 用英文逗号分隔
- `token`：必须和 DSH 里的 `qqForwardToken` 一致
- `forwardBriefs`：必须为 true，才会转发日报
- `atSign`：只对评论/私信生效，日报不会 @ 人

## 重启

改完配置后重启 NapCat。

通常不需要重启 QQ；如果实际环境要求重启 QQ，先询问用户。

## 路由

```text
GET  /plugin/napcat-plugin-dsh-bili-forward/api/health
POST /plugin/napcat-plugin-dsh-bili-forward/api/forward
POST /plugin/napcat-plugin-dsh-bili-forward/api/test
```

`POST /api/forward` 需要请求头：

```text
x-dsh-bili-token: <token>
```

## `brief_ready` 示例

```json
{
  "event": "brief_ready",
  "date": "2026-10-22",
  "title": "B站 + GitHub AIGC 日报",
  "text": "完整 QQ 版正文",
  "parts": [
    "第 1 段",
    "第 2 段",
    "第 3 段"
  ]
}
```

`parts` 会逐段发送；如果 `parts` 为空，则退回 `text`；两者都为空会返回 400，不会发空消息。
