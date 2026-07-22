@echo off
chcp 65001 >nul
echo.
echo ============================================================
echo   APLICAR MIGRACAO: admin_delete_user no Supabase
echo ============================================================
echo.
echo Para obter seu Access Token pessoal do Supabase:
echo  1. Acesse: https://supabase.com/dashboard/account/tokens
echo  2. Clique em "Generate new token"
echo  3. Copie o token gerado
echo.
set /p TOKEN="Cole seu Supabase Access Token aqui e pressione Enter: "

if "%TOKEN%"=="" (
  echo ERRO: Token nao informado.
  pause
  exit /b 1
)

echo.
echo Aplicando migracao...

powershell -ExecutionPolicy Bypass -Command ^
  "$sql = 'CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ BEGIN IF NOT private.has_role(auth.uid(), ''admin'') THEN RAISE EXCEPTION ''Somente administradores podem excluir contas.''; END IF; DELETE FROM auth.users WHERE id = _user_id; END; $$; REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;'; ^
  "$body = ConvertTo-Json @{ query = $sql }; " ^
  "$headers = @{ Authorization = 'Bearer %TOKEN%'; 'Content-Type' = 'application/json' }; " ^
  "try { " ^
    "$r = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/jmbhcggbeaooilqxcxjf/database/query' -Method POST -Headers $headers -Body $body; " ^
    "Write-Host ''; " ^
    "Write-Host 'SUCESSO! Funcao admin_delete_user criada no Supabase.' -ForegroundColor Green; " ^
    "Write-Host 'O botao Excluir do painel de aprovacoes agora deleta permanentemente.'; " ^
  "} catch { " ^
    "Write-Host ''; " ^
    "Write-Host 'ERRO ao aplicar migracao:' -ForegroundColor Red; " ^
    "Write-Host $_.Exception.Message; " ^
  "}"

echo.
pause
