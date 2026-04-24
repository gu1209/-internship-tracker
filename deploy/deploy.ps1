# ============================================
# 实习投递管理工具 - Windows Server 部署脚本
# 在 PowerShell 管理员模式下运行此脚本
# ============================================

$ErrorActionPreference = "Stop"
Write-Host "=== 开始部署实习投递管理工具 ===" -ForegroundColor Green

# 1. 检查 Node.js
Write-Host "`n[1/4] 检查 Node.js..." -ForegroundColor Yellow
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if ($nodeInstalled) {
    $nodeVersion = node -v
    Write-Host "  Node.js 已安装: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  Node.js 未安装，请下载并安装:" -ForegroundColor Red
    Write-Host "  https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -ForegroundColor Cyan
    Write-Host "  安装完成后重新运行此脚本。" -ForegroundColor Yellow
    exit 1
}

# 2. 安装 PM2 (进程守护)
Write-Host "`n[2/4] 安装 PM2..." -ForegroundColor Yellow
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed) {
    npm install -g pm2
    Write-Host "  PM2 安装完成" -ForegroundColor Green
} else {
    Write-Host "  PM2 已安装" -ForegroundColor Green
}

# 3. 安装依赖并构建
Write-Host "`n[3/4] 安装依赖并构建..." -ForegroundColor Yellow

# 获取脚本所在目录（项目根目录）
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

Set-Location $projectDir

Write-Host "  安装根目录依赖..." -ForegroundColor Gray
npm install
Write-Host "  安装服务端依赖..." -ForegroundColor Gray
cd server; npm install; cd ..
Write-Host "  安装客户端依赖..." -ForegroundColor Gray
cd client; npm install; cd ..
Write-Host "  构建前端..." -ForegroundColor Gray
npm run build

Write-Host "  构建完成" -ForegroundColor Green

# 4. 配置防火墙
Write-Host "`n[4/4] 配置防火墙..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Internship Tracker" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    New-NetFirewallRule -DisplayName "Internship Tracker" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any
    Write-Host "  防火墙规则已添加 (端口 3001)" -ForegroundColor Green
} else {
    Write-Host "  防火墙规则已存在" -ForegroundColor Green
}

# 5. 启动服务
Write-Host "`n[5/5] 启动服务..." -ForegroundColor Yellow
Set-Location "$projectDir\server"

# 先停止旧进程
pm2 delete internship-tracker -s 2>$null

# 启动
pm2 start src\index.js --name internship-tracker --node-args="--max-old-space-size=256"
pm2 save
pm2 startup -q

Write-Host "`n=== 部署完成! ===" -ForegroundColor Green
Write-Host "访问地址: http://121.41.118.22:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "常用命令:" -ForegroundColor Yellow
Write-Host "  pm2 status           查看服务状态"
Write-Host "  pm2 logs             查看日志"
Write-Host "  pm2 restart internship-tracker  重启服务"
Write-Host "  pm2 stop internship-tracker     停止服务"
Write-Host ""
