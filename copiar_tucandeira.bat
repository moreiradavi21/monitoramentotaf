@echo off
echo === Copiando imagem Tucandeira PNG para o projeto ===

set DEST=C:\Users\PC\Documents\GitHub\monitoramentotaf\public\tucandeira.png
set UPLOADS=C:\Users\PC\AppData\Roaming\Claude\local-agent-mode-sessions\2d2c0f64-2438-48d7-b15d-9e0959a8d7b1\046d1ebe-a230-4192-9d23-470575fdf64a\local_0fa3bf8c-d9e1-4925-866a-5f008cb20464\uploads

echo Procurando PNG mais recente em uploads do Claude...

for /f "delims=" %%i in ('dir /b /o-d /a-d "%UPLOADS%\*.png" 2^>nul') do (
    echo Encontrado: %%i
    copy "%UPLOADS%\%%i" "%DEST%"
    echo Copiado como tucandeira.png
    goto :done
)

echo PNG nao encontrado em uploads. Tentando Downloads...
set DL=%USERPROFILE%\Downloads

for /f "delims=" %%i in ('dir /b /o-d /a-d "%DL%\*.png" 2^>nul') do (
    echo Encontrado em Downloads: %%i
    copy "%DL%\%%i" "%DEST%"
    echo Copiado como tucandeira.png
    goto :done
)

echo Nenhum PNG encontrado automaticamente.
echo Por favor copie manualmente o PNG da Tucandeira para:
echo %DEST%
goto :end

:done
echo.
echo Arquivo copiado:
dir "%DEST%"

:end
pause
