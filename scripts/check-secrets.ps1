$root = if ($args.Count -gt 0) { $args[0] } else { (Get-Location).Path }
$patterns = @(
  'github_pat_[A-Za-z0-9_]{30,}',
  'ghp_[A-Za-z0-9]{30,}',
  'dshbili_[A-Fa-f0-9]{16}',
  'SESSDATA=[A-Za-z0-9%]{10,}',
  'bili_jct=[A-Fa-f0-9]{10,}'
)
$files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\.git\\|node_modules|\\.venv|__pycache__|\\out\\' -and
  $_.Name -ne 'check-secrets.ps1' -and
  $_.Extension -in '.js','.mjs','.py','.json','.yml','.yaml','.ps1'
}
$hits = $files | Select-String -Pattern $patterns -AllMatches -ErrorAction SilentlyContinue
if ($hits) {
  $hits | Format-Table -AutoSize | Out-String -Width 240 | Write-Output
  Write-Error 'Suspicious secret or personal data found.'
  exit 1
}
Write-Output 'OK: no obvious secrets or personal data found.'
