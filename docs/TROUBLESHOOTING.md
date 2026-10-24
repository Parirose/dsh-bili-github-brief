# 排障

## DSH 设置页没有出现

- 确认安装到了正确的 profile
- 确认重启过 DSH
- 查看 DSH 日志是否有插件加载错误

## GitHub 403 / 限流

- 确认 GitHub Token 有效
- 确认 token 至少有公开仓库只读权限
- 匿名限额很低，正式使用建议配 token
- 不要把 token 发到聊天或提交到仓库

## B站没有字幕

- 该视频可能没有 AI 字幕
- 开启「本地转写」并安装转写依赖
- 转写失败时报告会写「因无字幕跳过 N 条」

## QQ 没收到

- 确认 NapCat 插件已加载
- 访问 `/plugin/napcat-plugin-dsh-bili-forward/api/health`
- 确认 `groupIds` / `privateIds` 已填
- 确认 DSH 和 NapCat 的 token 一致
- 确认 NapCat WebUI 端口和 DSH 里的 `qqForwardUrl` 一致
- 改完 NapCat 配置后重启 NapCat
- 通常不需要重启 QQ；如果实际环境要求，先询问用户

## QQ 消息重复

- 插件有 10 分钟去重
- DSH 侧有 `briefHash`，同一内容不会重复发送
- 如果手动重跑且内容变化，会再发一次

## 模板占位符没有替换

- 确认 DSH 已重启并加载最新 `index.js`
- 确认 `prompts/brief-prompt.txt` 存在
- 如果仍然出现 `{{DATE}}` 等占位符，查看 `duty.log` 并重启 DSH

## QQ.exe 启动即崩 / Low 完整性标签

现象：QQ.exe 启动即崩，事件日志里出现：

```text
出错模块：QQNT.dll
异常代码：0x80000003
偏移：0x26b6e3a
```

这是 NapCat 上游 issue #2116 记录的同一个偏移。

原因：由 DSH 管辖的 shell 解包/复制出来的文件可能带 `Mandatory Label\Low`。一旦落到 QQ / NapCat 目录，注入后会崩。

检查：

```powershell
icacls "<QQ 或 NapCat 目录>"
```

可能看到：

```text
QQ.exe => Mandatory Label\Low Mandatory Level:(I)(NW)
```

修法：

```powershell
icacls "<目录>" /setintegritylevel (OI)(CI)Medium /T
```

给用户的话：不要在 DSH 工作区里解包 QQ / NapCat 再搬过去。

## NapCatQQ Desktop 安装 QQ 时报 os error 5

现象：

```text
放置 QQ 到 ...\components\QQ\versions\<ver> 失败: 拒绝访问 (os error 5)
```

原因：NapCatQQ Desktop 在 7z 解包结束后立刻 rename 整个约 1.2 GB 的暂存目录，此时实时扫描器（例如腾讯云镜 YDService）还持有文件句柄。Windows 下目录里有打开的文件时，rename 会返回 `ACCESS_DENIED`。

实测：解包完成后等约 1 秒，再执行同一个 rename 就会成功。

给用户的话：这是 NapCatQQ Desktop 的竞态，不是本插件的问题。也可以手工把 QQ 解到最终目录，再写：

```text
components\QQ\current.txt = <版本号>
```
