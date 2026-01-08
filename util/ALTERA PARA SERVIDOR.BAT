@echo off
:: Verifica se está rodando como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilégios de Administrador...
    powershell -Command "Start-Process cmd -ArgumentList '/c "%~f0"' -Verb RunAs"
    exit
)

:: Nome da tarefa para continuar após reinício
set "TAREFA=ContinuarConfig"

:: Criar script que continuará após o reboot
set "CONTINUAR_BAT=%TEMP%\continuar.bat"

:: Caminho do arquivo INI e executável IP.EXE
set "ARQUIVO_INI=C:\Program Files (x86)\CompuFour\Clipp\Exe\clipp.ini"
set "IP_EXE=C:\Program Files (x86)\CompuFour\Clipp\Exe\ip.exe"

:: Criar arquivo BAT que será executado após o reinício
(
    echo @echo off
    echo echo [INFO] Excluindo clipp.ini...
    echo del /F /Q "%ARQUIVO_INI%"
    echo echo [INFO] Executando ip.exe...
    echo start "" "%IP_EXE%"
    echo echo [OK] Configuração concluída!
    echo pause
    echo exit
) > "%CONTINUAR_BAT%"

:: Criar uma tarefa agendada para rodar após reinício
schtasks /create /tn "%TAREFA%" /tr "%CONTINUAR_BAT%" /sc ONSTART /ru SYSTEM /f

echo [INFO] Alterando nome do computador para "SERVIDOR"...

:: Obter nome atual do computador
for /f "tokens=2 delims==" %%A in ('wmic computersystem get name /value ^| findstr /i "Name"') do set "NOME_ATUAL=%%A"

:: Verificar se o nome já é "SERVIDOR"
if /I "%NOME_ATUAL%"=="SERVIDOR" (
    echo [INFO] O nome do computador ja e "SERVIDOR". Nenhuma alteracao necessaria.
) else (
    wmic computersystem where name="%NOME_ATUAL%" rename "SERVIDOR"
    echo [OK] Nome do computador alterado! Um reinicio sera necessario.
)

:: Aguardar 30 segundos antes de perguntar se deseja reiniciar
echo [INFO] Aguarde 30 segundos...
timeout /t 30 /nobreak

:PERGUNTA
set /p RESPOSTA="Deseja reiniciar agora? (S/N): "
if /I "%RESPOSTA%"=="S" (
    echo Reiniciando o computador...
    shutdown /r /t 0
) else if /I "%RESPOSTA%"=="N" (
    echo O computador nao sera reiniciado agora. Reinicie manualmente quando desejar.
) else (
    echo Opcao invalida. Por favor, digite S para sim ou N para nao.
    goto PERGUNTA
)
