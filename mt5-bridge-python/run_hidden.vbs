' ============================================================
' اجرای پل TrendPilot در پس‌زمینه، بدون نمایش پنجره‌ی کنسول.
' این فایل توسط Task Scheduler صدا زده می‌شود (نه مستقیم توسط کاربر).
' لاگ‌ها در فایل bridge.log (کنار bridge.py) نوشته می‌شوند.
' ============================================================
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = strPath

' pythonw.exe = اجرای پایتون بدون پنجره‌ی کنسول
' لاگ‌ها به‌صورت خودکار در bridge.log نوشته می‌شوند (توسط خودِ bridge.py)
objShell.Run "pythonw.exe bridge.py", 0, False
