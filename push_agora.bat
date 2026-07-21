@echo off
cd /d "C:\Users\PC\Documents\GitHub\monitoramentotaf"

echo === Status atual ===
git status

echo.
echo === Adicionando todos os arquivos ===
git add -A

echo.
echo === Commit ===
git commit -m "feat: wizard 2 etapas Registrar TAF, Sec Cmd Su, PMT, logo Tucandeira, sync importacao"

echo.
echo === Push ===
git push origin main

echo.
echo === Concluido! ===
pause
