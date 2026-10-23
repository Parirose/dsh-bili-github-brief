# 公开前检查

当前建议先保持 Private，清理后再决定是否 Public。

## 必须确认

- [ ] 没有 `bili_credential.json`
- [ ] 没有真实 `config.json`
- [ ] 没有 `headless-overlay.yml` 里的 token
- [ ] 没有 `duty.log`
- [ ] 没有 `out/`
- [ ] 没有真实 QQ 群号 / QQ 号 / B站 UID
- [ ] 没有 `.venv`、`.hf-cache`、`__pycache__`
- [ ] 没有 `*.bak-*`
- [ ] 没有本机绝对路径、真实邮箱、手机号等个人信息
- [ ] Git 历史里没有 token
- [ ] Git 提交作者 / 提交者邮箱不是真实私人邮箱
- [ ] GitHub Secret scanning / Push protection 已开启

## 检查命令

```powershell
git status --short --ignored
git grep -n -E "github_pat_|ghp_|SESSDATA|bili_jct|dshbili_"
git log --all --format='%H %an <%ae> | %cn <%ce>'
```

检查所有历史提交里的敏感字符串：

```powershell
git rev-list --all | ForEach-Object {
  git grep -n -I -E "github_pat_|ghp_|SESSDATA|bili_jct|dshbili_|C:\\\\Users\\\\|@qq\.com" $_
}
```

检查本地未挂到分支的旧对象：

```powershell
git fsck --full --unreachable --no-reflogs
```

如果命中，先处理，不要直接 push。

## 如果旧提交里有私人邮箱或 token

仅修改当前文件不够，必须重写历史并 force push。重写后旧提交会变成不可达对象；本地还要执行：

```powershell
git reflog expire --expire=now --all
git gc --prune=now
```

如果要做到「GitHub 上也彻底没有旧对象」，最稳妥的方式是：公开前删除这个私有仓库，重新创建一个空私有仓库，再 push 当前干净历史。旧仓库没有 star / fork 时成本很低。

提交邮箱建议使用 GitHub noreply：

```text
<GitHub数字ID>+<GitHub用户名>@users.noreply.github.com
```

## 许可证与上游

- 根目录 `LICENSE` 保留
- `vendor/bilibili-mcp/LICENSE` 保留
- `NOTICE.md` 写明上游、版权、上游版本与修改内容
- README Credits 写明参考项目
- 独立二改不是 GitHub Fork 也可以；MIT 不要求 fork，但必须保留版权与许可声明

## 公开后

- 开启 Secret scanning
- 开启 Push protection
- 不要接受包含 token 的 PR
- 不要上传真实报告
