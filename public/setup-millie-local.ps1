# Millie Local AI setup for Windows
# Installs Ollama if needed, downloads the default model, and configures browser access.
# Review this script before running. It changes only your current-user environment variables.
$ErrorActionPreference = "Stop"
$Model = "llama3.2"
$MillieOrigin = "https://millieai.vercel.app"

Write-Host ""
Write-Host "=== Millie Local AI Setup ===" -ForegroundColor Cyan
Write-Host "This setup will:"
Write-Host "  1. Install Ollama using Windows Package Manager if it is missing."
Write-Host "  2. Download the '$Model' model (several GB; size depends on model version)."
Write-Host "  3. Allow Millie's website to connect to Ollama on this computer."
Write-Host "  4. Start Ollama and check that the model is installed."
Write-Host ""
$confirm = Read-Host "Continue? Type YES to proceed"
if ($confirm -cne "YES") { Write-Host "Cancelled."; exit 0 }

$winget = Get-Command winget -ErrorAction SilentlyContinue
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  if (-not $winget) {
    throw "Windows Package Manager (winget) was not found. Install/update 'App Installer' from Microsoft Store, then run this script again."
  }
  Write-Host "Installing Ollama..." -ForegroundColor Yellow
  winget install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Ollama installation did not finish successfully. Install it from https://ollama.com/download and rerun this script." -ForegroundColor Red
    exit 1
  }
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $ollamaPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (Test-Path $ollamaPath) { $env:Path += ";" + (Split-Path $ollamaPath) }
  $ollama = Get-Command ollama -ErrorAction SilentlyContinue
  if (-not $ollama -and (Test-Path $ollamaPath)) { $ollama = $ollamaPath }
  if (-not $ollama) { throw "Ollama was installed but this terminal cannot find it. Close this window, open a new PowerShell window, and run the setup script again." }
}

# Permit only Millie's deployed origin and common local development origins.
$origins = @($MillieOrigin, "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173") -join ","
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", $origins, "User")
$env:OLLAMA_ORIGINS = $origins
Write-Host "Configured OLLAMA_ORIGINS for Millie and local development." -ForegroundColor Green

# Restart the current user's Ollama process so it picks up the new environment.
Get-Process -Name "ollama*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCommand) {
  Start-Process -FilePath $ollamaCommand.Source -ArgumentList "serve" -WindowStyle Hidden
} elseif ($ollama -is [string]) {
  Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
} else {
  throw "Could not locate ollama.exe to start the local server."
}

Write-Host "Waiting for Ollama to start..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 2
    $ready = $true
    break
  } catch {}
}
if (-not $ready) {
  throw "Ollama did not respond at localhost:11434. Open the Ollama app from the Start menu, then rerun this script."
}

Write-Host "Downloading model '$Model' (this may take a while)..." -ForegroundColor Yellow
& (Get-Command ollama -ErrorAction SilentlyContinue).Source pull $Model
if ($LASTEXITCODE -ne 0) { throw "Model download failed. Check your internet connection and rerun: ollama pull $Model" }

$installed = Invoke-RestMethod -Uri "http://localhost:11434/api/tags"
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Ollama is running and the model '$Model' should be ready."
Write-Host "Open Millie, go to Settings > AI provider, select Local AI, and click Test local connection."
Write-Host "If your browser still blocks the connection, fully quit Ollama from the system tray and reopen it."
Write-Host ""
Read-Host "Press Enter to close"
