$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "CoreBank CBS.lnk")
$Shortcut = $WshShell.CreateShortcut($DesktopPath)
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c ""c:\Users\Shahinsha\Desktop\bankmanagement-main\start.bat"""
$Shortcut.WorkingDirectory = "c:\Users\Shahinsha\Desktop\bankmanagement-main"
$Shortcut.Description = "Launch CoreBank Enterprise Core Banking System"
$Shortcut.IconLocation = "shell32.dll,220"
$Shortcut.Save()
Write-Host "Desktop shortcut created successfully at: $DesktopPath" -ForegroundColor Green
