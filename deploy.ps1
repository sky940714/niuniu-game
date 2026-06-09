$SERVER = "root@207.148.98.43"

Write-Host "`n[1/5] Building player frontend..." -ForegroundColor Cyan
npm run build
if (-not $?) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n[2/5] Building admin panel..." -ForegroundColor Cyan
Set-Location admin
npm run build
if (-not $?) { Write-Host "Admin build failed!" -ForegroundColor Red; Set-Location ..; exit 1 }
Set-Location ..

Write-Host "`n[3/5] Uploading player frontend..." -ForegroundColor Cyan
scp -r dist/. "${SERVER}:/var/www/game/"

Write-Host "`n[4/5] Uploading admin panel..." -ForegroundColor Cyan
scp -r admin/dist/. "${SERVER}:/var/www/admin/"

Write-Host "`n[5/5] Setting permissions..." -ForegroundColor Cyan
ssh $SERVER "chmod -R 755 /var/www/game && chmod -R 755 /var/www/admin"

Write-Host "`nDeploy complete!" -ForegroundColor Green
