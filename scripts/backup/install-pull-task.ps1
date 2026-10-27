# Registers the Windows scheduled task that pulls the server's encrypted backups to this PC
# (scripts/backup/pull-backups.sh): daily at 12:00 and at sign-in; a missed day runs as soon as the PC is on.
# Run once in PowerShell as the PC's normal user. Run again to update it.
$bash = Join-Path ${env:ProgramFiles} 'Git\bin\bash.exe'
$script = (Join-Path $PSScriptRoot 'pull-backups.sh') -replace '\\', '/'
$action = New-ScheduledTaskAction -Execute $bash -Argument "-lc `"'$script'`""
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At 12:00),
  (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME)
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'frfro backup pull' -Action $action -Trigger $triggers -Settings $settings `
  -Description 'Copies the frfro server''s encrypted nightly backups to ~/frfro-backups (never deletes).' -Force | Out-Null
Write-Output "Scheduled task 'frfro backup pull' is set."
