<#
  Tao shortcut vitube ngoai Desktop va trong Start Menu.

  Chay bang cach: chuot phai vao file nay -> Run with PowerShell
  Hoac: powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
#>

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat     = Join-Path $root 'start-vitube.bat'
$batLan  = Join-Path $root 'start-vitube-lan.bat'
$icon    = Join-Path $root 'assets\vitube.ico'

if (-not (Test-Path $bat)) {
  Write-Host "Khong thay start-vitube.bat trong $root" -ForegroundColor Red
  Read-Host "Bam Enter de dong"
  exit 1
}

$shell   = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$start   = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'

function New-VitubeShortcut {
  param($Path, $Target, $Description)

  $sc = $shell.CreateShortcut($Path)
  $sc.TargetPath       = $Target
  $sc.WorkingDirectory = $root
  $sc.Description      = $Description
  $sc.WindowStyle      = 7          # 7 = thu nho xuong thanh tac vu
  if (Test-Path $icon) { $sc.IconLocation = $icon }
  $sc.Save()

  Write-Host "  [OK] $Path" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Dang tao shortcut..." -ForegroundColor Cyan
Write-Host ""

New-VitubeShortcut `
  -Path (Join-Path $desktop 'vitube.lnk') `
  -Target $bat `
  -Description 'Xem video khong quang cao'

New-VitubeShortcut `
  -Path (Join-Path $start 'vitube.lnk') `
  -Target $bat `
  -Description 'Xem video khong quang cao'

if (Test-Path $batLan) {
  New-VitubeShortcut `
    -Path (Join-Path $desktop 'vitube (cho TV box).lnk') `
    -Target $batLan `
    -Description 'Chay server cho ca thiet bi khac trong nha'
}

Write-Host ""
Write-Host "  Xong. Bam dup vao shortcut tren Desktop de chay." -ForegroundColor Cyan
Write-Host "  Lan dau se mat vai phut de cai thu vien va build." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Bam Enter de dong"
