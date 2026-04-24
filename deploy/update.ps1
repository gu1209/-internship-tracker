# ============================================
# 更新脚本 - 从 Git 拉取最新代码后重新部署
# ============================================

$projectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== 更新实习投递管理工具 ===" -ForegroundColor Green

Set-Location $projectDir

Write-Host "构建前端..." -ForegroundColor Yellow
npm run build

Write-Host "重启服务..." -ForegroundColor Yellow
Set-Location "$projectDir\server"
pm2 restart internship-tracker

Write-Host "更新完成!" -ForegroundColor Green
