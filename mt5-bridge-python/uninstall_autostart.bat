@echo off
REM حذف تسک خودکار پل TrendPilot از Task Scheduler ویندوز
setlocal
set TASK_NAME=TrendPilotBridge

schtasks /Delete /TN "%TASK_NAME%" /F

if %ERRORLEVEL% EQU 0 (
  echo تسک "%TASK_NAME%" حذف شد. اجرای خودکار متوقف شد.
) else (
  echo تسکی با این نام یافت نشد ^(یا خطا در حذف^).
)

pause
