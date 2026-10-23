# 公开前检查

当前建议先保持 Private，清理后再决定是否 Public。

## 必须确认

- [ ] 没有 `bili_credential.json`
- [ ] 没有真实 `config.json`
- [ ] 没有 `headless-overlay.yml` 里的 token
- [ ] 没有 `duty.log`
- [ ] 没有 `out/`
- [ ] 没有真实 QQ 群号/QQ 号
- [ ] 没有 `.venv`、`.hf-cache`、`__pycache__`
- [ ] 没有 `*.bak-*`
- [ ] Git 历史里没有 token
- [ ] GitHub Secret scanning / Push protection 已开启

## 检查命令

```powershell
git grep -n -E "github_pat_|ghp_|SESSDATA|bili_jct|dshbili_"
```

如果命中，先处理，不要直接 push。

## 许可证

- 根目录 `LICENSE` 保留
- `vendor/bilibili-mcp/LICENSE` 保留
- `NOTICE.md` 写明上游与修改内容
- README Credits 写明参考项目

## 公开后

- 开启 Secret scanning
- 开启 Push protection
- 不要接受包含 token 的 PR
- 不要上传真实报告

