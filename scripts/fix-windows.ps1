# Qaio Windows Fix Script
# Fixes: app not opening, zombie engine processes, admin requirement

$QaioPath = "C:\Program Files\Qaio"
$QaioExe = "$QaioPath\qaio-app.exe"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = "$Desktop\Qaio.lnk"

Write-Host "Fixing Qaio on Windows..." -ForegroundColor Cyan

# 1. Kill zombie engine processes
$engines = Get-Process -Name "qaio-engine" -ErrorAction SilentlyContinue
if ($engines) {
    Write-Host "Killing $($engines.Count) zombie qaio-engine process(es)..." -ForegroundColor Yellow
    $engines | Stop-Process -Force -ErrorAction SilentlyContinue
}

# 2. Fix folder permissions so Qaio doesn't need admin to run
Write-Host "Fixing folder permissions..." -ForegroundColor Yellow
$user = "$env:USERDOMAIN\$env:USERNAME"
icacls $QaioPath /grant "${user}:(OI)(CI)F" /T | Out-Null

# 3. Create desktop shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $QaioExe
$Shortcut.Save()

Write-Host "Done. Open Qaio from your desktop." -ForegroundColor Green
