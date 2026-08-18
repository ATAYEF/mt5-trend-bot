@echo off
REM ============================================================
REM نصب خودکار پل TrendPilot به‌عنوان یک تسک ویندوزی که:
REM   - با روشن شدن سیستم / لاگین کاربر خودکار اجرا می‌شود
REM   - اگر کرش کند، ویندوز خودش دوباره اجرایش می‌کند
REM   - بدون نمایش پنجره‌ی کنسول (در پس‌زمینه)
REM
REM این فایل را با «Run as administrator» اجرا کنید (راست‌کلیک روی
REM فایل → Run as administrator).
REM ============================================================
setlocal
set TASK_NAME=TrendPilotBridge
set SCRIPT_DIR=%~dp0

echo در حال ثبت تسک ویندوزی "%TASK_NAME%" ...

schtasks /Create /TN "%TASK_NAME%" ^
  /TR "wscript.exe \"%SCRIPT_DIR%run_hidden.vbs\"" ^
  /SC ONLOGON ^
  /RL HIGHEST ^
  /F

if %ERRORLEVEL% EQU 0 (
  echo.
  echo نصب موفق بود. از این به بعد، با هر بار لاگین ویندوز، پل TrendPilot
  echo خودکار در پس‌زمینه اجرا می‌شود.
  echo.
  echo برای اجرای فوری همین الان ^(بدون نیاز به لاگین مجدد^):
  echo   schtasks /Run /TN "%TASK_NAME%"
  echo.
  echo لاگ‌ها را می‌توانید در فایل bridge.log ^(کنار همین فایل^) ببینید.
) else (
  echo خطا در ثبت تسک — مطمئن شوید این فایل را با دسترسی Administrator اجرا کرده‌اید.
)

pause
