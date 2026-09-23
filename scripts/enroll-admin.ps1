$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
Write-Host 'Madina Street ERP - one-time existing administrator password enrollment'
Write-Host 'The password stays local. Do not paste it into chat. Use 12+ characters (maximum 72 UTF-8 bytes).'
$adminSecure = Read-Host 'New administrator password' -AsSecureString
$adminConfirm = Read-Host 'Confirm password' -AsSecureString
$adminPointer = [IntPtr]::Zero
$confirmPointer = [IntPtr]::Zero
try {
    $adminPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure)
    $confirmPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminConfirm)
    $adminPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPointer)
    $confirmPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmPointer)
    if ($adminPlain -cne $confirmPlain) { throw 'Passwords do not match. No enrollment was attempted.' }
    if ($adminPlain.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($adminPlain) -gt 72) { throw 'Password must contain at least 12 characters and at most 72 UTF-8 bytes.' }
    $adminStart = New-Object System.Diagnostics.ProcessStartInfo
    $adminStart.FileName = (Get-Command node.exe).Source
    $adminStart.Arguments = '--import tsx scripts/enroll-admin.ts --password-stdin'
    $adminStart.WorkingDirectory = (Get-Location).Path
    $adminStart.UseShellExecute = $false
    $adminStart.RedirectStandardInput = $true
    $adminProcess = [Diagnostics.Process]::Start($adminStart)
    # Anonymous local pipe, never a command-line argument, file or environment variable.
    $adminProcess.StandardInput.WriteLine((ConvertTo-Json -Compress @{ password = $adminPlain }))
    $adminProcess.StandardInput.Close()
    $adminPlain = $null
    $confirmPlain = $null
    $adminProcess.WaitForExit()
    if ($adminProcess.ExitCode -ne 0) { throw 'Enrollment/verification did not complete. See the safe status above. Do not retry a completed enrollment.' }
} finally {
    $adminPlain = $null
    $confirmPlain = $null
    if ($adminPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPointer) }
    if ($confirmPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmPointer) }
    $adminSecure.Dispose()
    $adminConfirm.Dispose()
}
