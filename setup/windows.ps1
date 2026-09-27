# Windows half of the install. Run in PowerShell opened as administrator:
#
#   irm https://raw.githubusercontent.com/haophuongwedding/student-management-template/master/setup/windows.ps1 | iex
#
# Installs WSL with Ubuntu 24.04 and Cursor, keeps the laptop awake on mains power even with the lid shut, then opens
# Ubuntu with the Linux half (setup/setup.sh) on the clipboard. Safe to run again, e.g. after the restart WSL asks for.
# Docker Desktop is not installed on purpose: setup.sh puts Docker Engine inside Ubuntu, which needs no window,
# licence prompt or tray icon.

$ErrorActionPreference = 'Stop'
$Template = if ($env:LOPHOC_TEMPLATE) { $env:LOPHOC_TEMPLATE } else { 'haophuongwedding/student-management-template' }
$Distro = 'Ubuntu-24.04'
$LinuxLine = "bash <(curl -fsSL https://raw.githubusercontent.com/$Template/master/setup/setup.sh)"
$env:WSL_UTF8 = '1' # wsl.exe prints UTF-16 otherwise, and -match finds nothing

function Say($text) { Write-Host $text }
function Step($text) { Write-Host ''; Write-Host "== $text ==" -ForegroundColor Green }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Host 'Cần mở PowerShell bằng quyền quản trị: bấm Start, gõ PowerShell, chuột phải → Run as administrator, rồi dán lại dòng lệnh.' -ForegroundColor Red
  return
}

Step '1/3 · Giữ máy luôn thức khi cắm sạc'
# On mains power: never sleep or hibernate, and closing the lid does nothing. The screen may still turn off.
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change monitor-timeout-ac 15 | Out-Null
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
powercfg /setactive SCHEME_CURRENT | Out-Null
Say 'Xong: khi cắm sạc, máy không ngủ, gập máy lại vẫn chạy.'

Step '2/3 · Cài Cursor (để xem mã khi cần)'
if (Get-Command winget -ErrorAction SilentlyContinue) {
  winget install --id Anysphere.Cursor -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
  Say 'Xong.'
} else {
  Say 'Máy chưa có winget, bỏ qua Cursor (không bắt buộc). Có thể tải ở https://cursor.com'
}

Step '3/3 · Cài Ubuntu (WSL)'
$installed = (wsl.exe -l -q 2>$null) -join "`n"
if ($installed -notmatch [regex]::Escape($Distro)) {
  wsl.exe --install -d $Distro --no-launch
  $installed = (wsl.exe -l -q 2>$null) -join "`n"
  if ($installed -notmatch [regex]::Escape($Distro)) {
    Write-Host ''
    Write-Host 'Cần khởi động lại máy tính một lần. Khởi động lại xong, mở lại PowerShell (Run as administrator) và dán lại đúng dòng lệnh lúc nãy.' -ForegroundColor Yellow
    return
  }
}

Set-Clipboard -Value $LinuxLine
Write-Host ''
Write-Host 'Cửa sổ Ubuntu sắp mở ngay dưới đây.' -ForegroundColor Green
Say '  1) Lần đầu, Ubuntu hỏi tên (username): gõ chữ thường không dấu, ví dụ  cohanh'
Say '     rồi hỏi mật khẩu 2 lần (gõ không hiện chữ). GHI LẠI mật khẩu này.'
Say '  2) Khi thấy dòng kết thúc bằng  $  : bấm chuột phải để dán dòng lệnh (máy đã chép sẵn), rồi Enter.'
Say "     Dòng lệnh đó là:  $LinuxLine"
Write-Host ''
Read-Host 'Bấm Enter để mở Ubuntu'
wsl.exe -d $Distro --cd '~'
