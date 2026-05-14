@echo off
for /f "tokens=*" %%i in ('curl.exe -s -X POST http://localhost:8181/realms/master/protocol/openid-connect/token -d "grant_type=password&client_id=admin-cli&username=admin&password=admin"') do set RESPONSE=%%i

:: Extract token using simple parsing - just get the clients list
curl.exe -s http://localhost:8181/admin/realms/master/clients -H "Authorization: Bearer %ACCESS_TOKEN%"
