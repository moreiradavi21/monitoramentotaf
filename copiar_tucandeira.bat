@echo off
echo === Copiando imagem Tucandeira para o projeto ===

set DEST_DIR=C:\Users\PC\Documents\GitHub\monitoramentotaf\public
set DOWNLOADS=%USERPROFILE%\Downloads

echo Procurando TUCANDEIRA em Downloads...

IF EXIST "%DOWNLOADS%\TUCANDEIRA.jpg" (
    copy "%DOWNLOADS%\TUCANDEIRA.jpg" "%DEST_DIR%\tucandeira.jpg"
    echo Copiado como tucandeira.jpg
    goto :done
)

IF EXIST "%DOWNLOADS%\TUCANDEIRA.jpeg" (
    copy "%DOWNLOADS%\TUCANDEIRA.jpeg" "%DEST_DIR%\tucandeira.jpg"
    echo Copiado como tucandeira.jpg
    goto :done
)

IF EXIST "%DOWNLOADS%\TUCANDEIRA.png" (
    copy "%DOWNLOADS%\TUCANDEIRA.png" "%DEST_DIR%\tucandeira.png"
    echo Copiado como tucandeira.png
    goto :done
)

REM Tenta sem extensao (o Windows as vezes salva sem extensao)
for %%e in (jpg jpeg png JPG JPEG PNG) do (
    IF EXIST "%DOWNLOADS%\TUCANDEIRA.%%e" (
        copy "%DOWNLOADS%\TUCANDEIRA.%%e" "%DEST_DIR%\tucandeira.jpg"
        echo Copiado: TUCANDEIRA.%%e
        goto :done
    )
)

echo Arquivo nao encontrado. Copiando qualquer imagem JPEG recente de Downloads...
for /f "delims=" %%i in ('dir /b /o-d /a-d "%DOWNLOADS%\TUCANDEIRA*" 2^>nul') do (
    copy "%DOWNLOADS%\%%i" "%DEST_DIR%\tucandeira.jpg"
    echo Copiado: %%i
    goto :done
)

echo ERRO: TUCANDEIRA nao encontrado em Downloads
echo Por favor copie manualmente a imagem para: %DEST_DIR%\tucandeira.jpg

:done
echo.
echo Pasta public:
dir "%DEST_DIR%\tucandeira*" 2>nul
pause
