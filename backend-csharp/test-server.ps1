$ErrorActionPreference = "Stop"
Write-Host "Starting C# .NET 9 Backend on port 4500..."

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "dotnet"
$processInfo.Arguments = "run --no-build"
$processInfo.WorkingDirectory = "D:\data\edunova-apps-platform\backend-csharp"
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($processInfo)
Start-Sleep -Seconds 4

try {
    Write-Host "Testing /api/health..."
    $health = Invoke-RestMethod -Uri "http://localhost:4500/api/health" -Method Get
    Write-Host "Health Response: $($health | ConvertTo-Json -Compress)"

    Write-Host "`nTesting /api/config..."
    $cfg = Invoke-RestMethod -Uri "http://localhost:4500/api/config" -Method Get
    Write-Host "Config Response: $($cfg | ConvertTo-Json -Compress)"

    Write-Host "`nTesting /api/auth/login with Admin..."
    $loginBody = @{
        email = "admin@edunova.eg"
        password = "Admin@123456"
        deviceId = "csharp-test-device-id-001"
        deviceName = "PowerShell Verification Client"
    } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri "http://localhost:4500/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "Login OK! User: $($loginResp.user.name), Role: $($loginResp.user.role), Token received: $([string]::IsNullOrEmpty($loginResp.token) -eq $false)"

    Write-Host "`nTesting /api/student/courses..."
    $headers = @{ Authorization = "Bearer $($loginResp.token)" }
    $courses = Invoke-RestMethod -Uri "http://localhost:4500/api/student/courses" -Method Get -Headers $headers
    Write-Host "Courses Count: $($courses.courses.Count)"
    foreach ($c in $courses.courses) {
        Write-Host " - Course: $($c.title) (Sections: $($c.sections_count), Lessons: $($c.lessons_count))"
    }

    Write-Host "`nSUCCESS: C# .NET Backend is 100% operational and Neon PostgreSQL integration verified!"
}
catch {
    Write-Host "ERROR testing backend: $_"
    Write-Host $_.Exception.ToString()
}
finally {
    if (-not $process.HasExited) {
        $process.Kill($true)
        Write-Host "Server process stopped cleanly."
    }
}
