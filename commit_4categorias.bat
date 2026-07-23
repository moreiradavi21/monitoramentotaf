@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Fazendo commit das 4 categorias TAF...
git add -A
git commit -m "feat: suporte a 4 categorias TAF (Belico Masc/Fem e Saude Masc/Fem)"
echo.
echo Fazendo push...
git push
echo.
echo Concluido!
pause
