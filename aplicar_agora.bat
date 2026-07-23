@echo off
chcp 65001 >nul
echo.
echo Aplicando admin_delete_user no Supabase...

powershell -ExecutionPolicy Bypass -Command "$sql = 'CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ''''admin'''') THEN RAISE EXCEPTION ''''Somente administradores podem excluir contas.''''; END IF; DELETE FROM auth.users WHERE id = _user_id; END; $$; REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;'; $body = ConvertTo-Json @{ query = $sql }; $headers = @{ Authorization = 'Bearer sbp_451e2e697618cdda74bcf7ef5129e0d73ed4cb62'; 'Content-Type' = 'application/json' }; try { $r = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/jmbhcggbeaooilqxcxjf/database/query' -Method POST -Headers $headers -Body $body; Write-Host ''; Write-Host 'SUCESSO! Funcao admin_delete_user criada.' -ForegroundColor Green; Write-Host $r } catch { Write-Host ''; Write-Host 'ERRO:' -ForegroundColor Red; Write-Host $_.Exception.Message; if ($_.Exception.Response) { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); Write-Host $reader.ReadToEnd() } }"

echo.
pause
