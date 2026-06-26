@echo off
REM [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
REM
REM publish.bat — Bump version and publish kungeskill to npm (Windows)
REM
REM Usage:
REM   scripts\publish.bat          &REM patch bump (0.3.1 → 0.3.2)
REM   scripts\publish.bat minor    &REM minor bump (0.3.1 → 0.4.0)
REM   scripts\publish.bat major    &REM major bump (0.3.1 → 1.0.0)
REM   scripts\publish.bat 1.2.3    &REM explicit version

REM [AGC:START] tool=Cc author=fangkun
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
cd /d "%PROJECT_DIR%"

REM --- Pre-flight checks ---

REM 1. Verify registry
for /f "tokens=*" %%R in ('npm config get registry') do set "REGISTRY=%%R"
if not "!REGISTRY!"=="https://registry.npmjs.org/" (
    echo [!] Registry is set to: !REGISTRY!
    echo     Switching to official npm registry...
    npm config set registry https://registry.npmjs.org/
)

REM 2. Verify auth
for /f "tokens=*" %%W in ('npm whoami 2^>nul') do set "WHOAMI=%%W"
if "!WHOAMI!"=="" (
    echo [X] Not authenticated. Check .npmrc token.
    echo     See: https://www.npmjs.com/settings/^<username^>/tokens
    exit /b 1
)
echo [OK] Authenticated as: !WHOAMI!

REM 3. Current version
for /f "tokens=*" %%V in ('node -p "require('./package.json').version"') do set "CURRENT_VERSION=%%V"
echo     Current version: !CURRENT_VERSION!

REM --- Version bump ---

set "BUMP_TYPE=%~1"
if "!BUMP_TYPE!"=="" set "BUMP_TYPE=patch"

REM Check if bump type is valid
if "!BUMP_TYPE!"=="patch" goto :do_bump
if "!BUMP_TYPE!"=="minor" goto :do_bump
if "!BUMP_TYPE!"=="major" goto :do_bump

REM Check if it looks like a version number (starts with digit)
echo !BUMP_TYPE!| findstr /r "^[0-9]" >nul 2>&1
if !errorlevel! equ 0 goto :do_bump

echo [X] Invalid argument: !BUMP_TYPE!
echo     Usage: %~nx0 [patch^|minor^|major^|x.y.z]
exit /b 1

:do_bump
echo     Bumping: !BUMP_TYPE!
npm version "!BUMP_TYPE!" --no-git-tag-version --quiet >nul 2>&1

for /f "tokens=*" %%V in ('node -p "require('./package.json').version"') do set "NEW_VERSION=%%V"
echo     New version: !NEW_VERSION!

REM --- Dry run ---

echo.
echo --- Package contents ---
npm pack --dry-run 2>&1
echo.

REM --- Confirm ---

set /p "CONFIRM=Publish kungeskill@!NEW_VERSION!? [y/N] "
if /i not "!CONFIRM!"=="y" (
    echo Aborted. Rolling back version...
    npm version "!CURRENT_VERSION!" --no-git-tag-version --quiet >nul 2>&1
    exit /b 0
)

REM --- Publish ---

npm publish --access public

echo.
echo [OK] Published kungeskill@!NEW_VERSION!
echo     https://www.npmjs.com/package/kungeskill

endlocal
REM [AGC:END]
