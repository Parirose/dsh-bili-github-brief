param(
  [string]$Root = (Get-Location).Path
)

# Quick scan for obvious credentials. This is not a full personal-data audit.
# See docs/PUBLISHING.md for the full pre-public checklist.
$patterns = @(
  'github_pat_[A-Za-z0-9_]{30,}',
  'ghp_[A-Za-z0-9]{30,}',
  'gho_[A-Za-z0-9]{30,}',
  'ghu_[A-Za-z0-9]{30,}',
  'ghs_[A-Za-z0-9]{30,}',
  'sk-[A-Za-z0-9]{20,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----',
  'SESSDATA=[A-Za-z0-9%]{10,}',
  'bili_jct=[A-Fa-f0-9]{10,}',
  'dshbili_[A-Fa-f0-9]{16}'
)

$extensions = @('.js','.mjs','.cjs','.ts','.py','.json','.yml','.yaml','.ps1','.md','.txt','.example','.env','.sh','.bat','.cmd')
$files = Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\.git\\|node_modules|\\.venv|__pycache__|\\out\\' -and
  $_.Name -ne 'check-secrets.ps1' -and
  $extensions -contains $_.Extension.ToLowerInvariant()
}

$hits = $files | Select-String -Encoding UTF8 -Pattern $patterns -AllMatches -ErrorAction SilentlyContinue
if ($hits) {
  $hits | Format-Table -AutoSize | Out-String -Width 240 | Write-Output
  Write-Error 'Suspicious token/cookie/private-key pattern found.'
  exit 1
}
Write-Output 'OK: no obvious token/cookie/private-key patterns found.'
Write-Output 'Note: this is not a full personal-data audit; see docs/PUBLISHING.md.'
