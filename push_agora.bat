@echo off
cd /d "C:\Users\PC\Documents\GitHub\monitoramentotaf"

echo === Verificando estado do git ===
git status

echo.
echo === Adicionando taf.ts (resolver conflito de merge) ===
git add src/lib/taf.ts

echo.
echo === Verificando se ha merge pendente ===
IF EXIST ".git\MERGE_HEAD" (
    echo Completando merge pendente...
    git commit --no-edit
) ELSE (
    echo Nao ha merge pendente.
)

echo.
echo === Adicionando todos os arquivos modificados ===
git add -A

echo.
echo === Commit das novas funcionalidades ===
git commit -m "feat: paginas por pelotao, importar planilha inline, Pel Aprove"

echo.
echo === Push para GitHub ===
git push origin main

echo.
echo === Concluido! ===
pause
