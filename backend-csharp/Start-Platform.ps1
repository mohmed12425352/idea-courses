# ==============================================================================
# منصة المحاضرات - بشمهندس ميدو شلبي (C# .NET 9 Backend & Cloudflare Tunnel Launcher)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$publishDir = Join-Path $scriptDir "publish"
$toolsDir = Join-Path $scriptDir "tools"
$cloudflaredPath = Join-Path $toolsDir "cloudflared.exe"

if (-not (Test-Path $cloudflaredPath)) {
    $cloudflaredPath = Join-Path $publishDir "tools\cloudflared.exe"
}

$exePath = Join-Path $publishDir "EdunovaPlatform.Api.exe"
$workingDir = $publishDir
if (-not (Test-Path $exePath)) {
    $exePath = "dotnet"
    $workingDir = $scriptDir
}

Clear-Host
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "      منصة المحاضرات التفاعلية - تشغيل سيرفر C# (.NET 9) للمدرب        " -ForegroundColor Yellow
Write-Host "           المدرب: بشمهندس ميدو شلبي (Eng. Medo Shalaby)             " -ForegroundColor White
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Free Port 4500 if occupied
$activePorts = Get-NetTCPConnection -LocalPort 4500 -ErrorAction SilentlyContinue
if ($activePorts) {
    Write-Host "[!] جاري تحرير المنفذ 4500 من أي عملية سابقة..." -ForegroundColor Yellow
    foreach ($p in $activePorts) {
        Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

# 2. Start C# Backend Process
Write-Host "[1/3] جاري تشغيل سيرفر C# ASP.NET Core Native..." -ForegroundColor Green
$serverPsi = New-Object System.Diagnostics.ProcessStartInfo
if ($exePath -eq "dotnet") {
    $serverPsi.FileName = "dotnet"
    $serverPsi.Arguments = "run --no-build"
} else {
    $serverPsi.FileName = $exePath
}
$serverPsi.WorkingDirectory = $workingDir
$serverPsi.UseShellExecute = $false
$serverPsi.RedirectStandardOutput = $false
$serverPsi.RedirectStandardError = $false
$serverPsi.CreateNoWindow = $false

$serverProcess = [System.Diagnostics.Process]::Start($serverPsi)

# 3. Wait for Health Check
Write-Host "[2/3] جاري التحقق من اتصال السيرفر بقاعدة بيانات Neon السحابية..." -ForegroundColor Green
$healthy = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:4500/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($resp.ok) {
            $healthy = $true
            break
        }
    } catch {}
}

if (-not $healthy) {
    Write-Host "[X] تعذر الاتصال بالسيرفر على المنفذ 4500. يرجى التحقق من اتصال الإنترنت." -ForegroundColor Red
} else {
    Write-Host "  -> تم الاتصال بنجاح بـ Neon PostgreSQL والسيرفر جاهز محلياً!" -ForegroundColor Green
}

# 4. Start Cloudflare Tunnel (if available)
$publicUrl = "https://apps-backend-production-d2608a9b.up.railway.app"
$tunnelProcess = $null
$tunnelLog = Join-Path $scriptDir "tunnel.log"

if (Test-Path $cloudflaredPath) {
    Write-Host "[3/3] جاري إنشاء رابط سحابي عام ومحمي للطلاب عبر Cloudflare..." -ForegroundColor Green
    if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue }

    $cfPsi = New-Object System.Diagnostics.ProcessStartInfo
    $cfPsi.FileName = $cloudflaredPath
    $cfPsi.Arguments = "tunnel --url http://localhost:4500 --no-autoupdate"
    $cfPsi.UseShellExecute = $false
    $cfPsi.RedirectStandardOutput = $true
    $cfPsi.RedirectStandardError = $true
    $cfPsi.CreateNoWindow = $true

    $tunnelProcess = [System.Diagnostics.Process]::Start($cfPsi)

    # Read output asynchronously to get URL
    $foundUrl = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 600
        $errLine = $tunnelProcess.StandardError.ReadLine()
        while ($errLine -ne $null) {
            Add-Content -Path $tunnelLog -Value $errLine
            if ($errLine -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
                $publicUrl = $matches[0]
                $foundUrl = $true
                break
            }
            if ($tunnelProcess.StandardError.EndOfStream) { break }
            $errLine = $tunnelProcess.StandardError.ReadLine()
        }
        if ($foundUrl) { break }
    }

    if ($foundUrl) {
        Write-Host "  -> تم إنشاء النفق السحابي بنجاح!" -ForegroundColor Green
        Set-Content -Path (Join-Path $scriptDir "active-tunnel-url.txt") -Value $publicUrl -Encoding UTF8
    } else {
        Write-Host "  -> تنبيه: جاري استخدام الرابط السحابي الاحتياطي." -ForegroundColor Yellow
    }
}

# 5. Output Summary Box
Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "                   🚀 السيرفر يعمل الآن بنجاح تام!                    " -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host " 💻 رابط الإدارة ولوحة التحكم (على جهازك):" -ForegroundColor White
Write-Host "    http://localhost:4500/login" -ForegroundColor Yellow
Write-Host ""
Write-Host " 🌍 رابط المنصة السحابي للطلاب (من أي مكان في العالم):" -ForegroundColor White
Write-Host "    $publicUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host " 👤 حساب المدير المسؤول:" -ForegroundColor White
Write-Host "    البريد: admin@edunova.eg" -ForegroundColor Gray
Write-Host "    كلمة المرور: Admin@123456" -ForegroundColor Gray
Write-Host ""
Write-Host " 💡 ملاحظة هامة:" -ForegroundColor Green
Write-Host "  - قاعدة البيانات: سحابية مركزية (Neon PostgreSQL) - متزامنة دائماً." -ForegroundColor Gray
Write-Host "  - الفيديوهات: بث مباشر من YouTube / CDN دون استهلاك نت جهازك." -ForegroundColor Gray
Write-Host "  - لإيقاف السيرفر: اضغط Ctrl+C أو أغلق هذه النافذة." -ForegroundColor Gray
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# 6. Auto Open Browser
try {
    Start-Process "http://localhost:4500/login"
} catch {}

# 7. Keep running until exit
try {
    if ($serverProcess -ne $null) {
        $serverProcess.WaitForExit()
    }
} finally {
    Write-Host "`nجاري إغلاق السيرفر والنفق..." -ForegroundColor Yellow
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "تم الإغلاق بنجاح." -ForegroundColor Green
}
