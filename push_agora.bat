@echo off
cd /d "C:\Users\PC\Documents\GitHub\monitoramentotaf"

:: Tenta encontrar o git em locais comuns
set GIT=
if exist "C:\Program Files\Git\cmd\git.exe" set GIT="C:\Program Files\Git\cmd\git.exe"
if exist "C:\Program Files (x86)\Git\cmd\git.exe" set GIT="C:\Program Files (x86)\Git\cmd\git.exe"
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set GIT="%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

:: GitHub Desktop embeds git
for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%D\resources\app\git\cmd\git.exe" set GIT="%%D\resources\app\git\cmd\git.exe"
)

if "%GIT%"=="" (
  echo ERRO: git.exe nao encontrado. Instale o Git for Windows.
  pause
  exit /b 1
)

echo Usando: %GIT%
echo.

echo === Adicionando todos os arquivos ===
%GIT% add -A

echo.
echo === Status ===
%GIT% status --short

echo.
echo === Commit ===
%GIT% commit -m "feat: admin pode excluir contas, auto-aprovacao companhia, cientes, magic link"

echo.
echo === Push ===
%GIT% push origin main

echo.
echo === Concluido! ===
pause
