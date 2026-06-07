@echo off
REM Start the ERP backend in dev mode on Windows.
cd /d "%~dp0..\backend"
if not exist node_modules (
  echo === Installing dependencies ===
  call npm install || exit /b 1
)
if not exist data\erp.db (
  echo === Initializing database ===
  call npm run init-db || exit /b 1
  echo === Seeding demo data ===
  call npm run seed || exit /b 1
)
echo === Starting server ===
call npm run dev
