@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Fazendo commit do fix de categoria_taf...
git add -A
git commit -m "fix: fallback localStorage para categoria_taf quando schema cache do PostgREST estiver desatualizado"
echo.
echo Fazendo push...
git push
echo.
echo Concluido!
pause
