//+------------------------------------------------------------------+
//|                                          TrendPilotBridge.mq5     |
//|  پل سبک TrendPilot سمت MT5 — طبق بخش ۵ سند                      |
//|                                                                    |
//|  اصل طراحی: این Expert Advisor هیچ محاسبه یا تصمیمی نمی‌گیرد.     |
//|  فقط: ۱) آخرین N کندل را به سرور می‌فرستد                         |
//|        ۲) دستور معامله را از پاسخ JSON سرور می‌خواند               |
//|        ۳) همان لحظه با OrderSend اجرا می‌کند                       |
//|  تمام هوش سیستم (اندیکاتور/سیگنال/ریسک/بکتست/AI) روی سرور         |
//| TypeScript است، نه اینجا.                                        |
//|                                                                    |
//|  قبل از اجرا: در ترمینال MT5 مسیر زیر را طی کنید و آدرس سرور را   |
//|  اضافه کنید:                                                     |
//|  Tools > Options > Expert Advisors > Allow WebRequest for         |
//|  listed URL, و آدرس ServerBaseUrl را در آنجا وارد کنید.           |
//+------------------------------------------------------------------+
#property copyright "TrendPilot"
#property version   "1.00"
#property strict

//--- ورودی‌های قابل تنظیم از پنل EA در MT5
input string  ServerBaseUrl   = "http://127.0.0.1:8787"; // آدرس پایه‌ی سرور TrendPilot
input string  ProfileName     = "Default";                // نام پروفایل (باید با پروفایل ساخته‌شده در وب UI یکی باشد)
input int     CandlesToSend   = 150;                       // تعداد کندل اخیر که هر بار فرستاده می‌شود
input int     PollIntervalSec = 5;                          // فاصله‌ی هر بار ارسال کندل (ثانیه)
input int     RequestTimeoutMs= 5000;                        // تایم‌اوت درخواست HTTP (میلی‌ثانیه)
input double  DefaultVolume   = 0.01;                        // حجم پیش‌فرض اگر سرور حجم نفرستاد (احتیاطی)
input int     MagicNumberOverride = 0;                       // اگر صفر باشد، از Magic خودِ نماد/سفارش سرور استفاده می‌شود

datetime g_lastSentBarTime = 0;

//+------------------------------------------------------------------+
//| OnInit                                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(PollIntervalSec);
   PrintFormat("TrendPilotBridge راه‌اندازی شد — سرور: %s — پروفایل: %s", ServerBaseUrl, ProfileName);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| OnDeinit                                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| OnTimer — هر PollIntervalSec ثانیه یک‌بار اجرا می‌شود              |
//+------------------------------------------------------------------+
void OnTimer()
{
   string symbol = Symbol();
   int    tfMinutes = PeriodSeconds(PERIOD_CURRENT) / 60;

   string payload = BuildCandlesJson(symbol, tfMinutes, CandlesToSend);
   if(payload == "")
      return;

   string response = "";
   if(!SendAnalyzeRequest(payload, response))
      return;

   ExecuteDecision(response, symbol);
}

//+------------------------------------------------------------------+
//| ساخت بدنه‌ی JSON درخواست analyze — فقط داده، بدون هیچ منطقی        |
//+------------------------------------------------------------------+
string BuildCandlesJson(string symbol, int tfMinutes, int count)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, PERIOD_CURRENT, 0, count, rates);
   if(copied <= 1)
   {
      Print("خطا: کندل کافی برای ارسال وجود ندارد");
      return "";
   }

   // از ارسال تکراری همان کندل بسته‌نشده جلوگیری کن (اختیاری، صرفاً بهینه‌سازی ترافیک)
   if(rates[0].time == g_lastSentBarTime)
      return "";
   g_lastSentBarTime = rates[0].time;

   string candlesJson = "[";
   // از قدیم به جدید بفرست تا سرور با ترتیب زمانی صعودی کار کند
   for(int i = copied - 1; i >= 0; i--)
   {
      candlesJson += StringFormat(
         "{\"time\":%I64d,\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f,\"volume\":%d}",
         (long)rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, (int)rates[i].tick_volume
      );
      if(i != 0) candlesJson += ",";
   }
   candlesJson += "]";

   string body = StringFormat(
      "{\"profile_name\":\"%s\",\"symbol\":\"%s\",\"timeframeMinutes\":%d,\"candles\":%s}",
      ProfileName, symbol, tfMinutes, candlesJson
   );
   return body;
}

//+------------------------------------------------------------------+
//| ارسال درخواست POST به /api/v1/analyze                             |
//+------------------------------------------------------------------+
bool SendAnalyzeRequest(string &jsonBody, string &responseOut)
{
   string url = ServerBaseUrl + "/api/v1/analyze";
   string headers = "Content-Type: application/json\r\n";

   char postData[];
   StringToCharArray(jsonBody, postData, 0, StringLen(jsonBody));

   char result[];
   string resultHeaders;

   ResetLastError();
   int status = WebRequest("POST", url, headers, RequestTimeoutMs, postData, result, resultHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      if(err == 4060)
         Print("خطا: آدرس سرور در Tools > Options > Expert Advisors > Allow WebRequest مجاز نشده — ", url);
      else
         PrintFormat("خطا در ارتباط با سرور (کد %d)", err);
      return false;
   }
   if(status != 200)
   {
      PrintFormat("سرور کد وضعیت %d برگرداند: %s", status, CharArrayToString(result));
      return false;
   }

   responseOut = CharArrayToString(result);
   return true;
}

//+------------------------------------------------------------------+
//| خواندن دستور از JSON پاسخ سرور و اجرای بی‌درنگ آن — بدون هیچ       |
//| تصمیم‌گیری اضافه‌ای در این سمت.                                    |
//+------------------------------------------------------------------+
void ExecuteDecision(string &jsonResponse, string symbol)
{
   string order = JsonGetString(jsonResponse, "order");
   if(order == "" || order == "hold")
      return;

   double sl = JsonGetDouble(jsonResponse, "sl");
   double tp = JsonGetDouble(jsonResponse, "tp");
   double volume = JsonGetDouble(jsonResponse, "volume");
   if(volume <= 0)
      volume = DefaultVolume;

   MqlTradeRequest request;
   MqlTradeResult  result;
   ZeroMemory(request);
   ZeroMemory(result);

   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);

   if(order == "buy")
   {
      request.action    = TRADE_ACTION_DEAL;
      request.symbol    = symbol;
      request.volume    = volume;
      request.type      = ORDER_TYPE_BUY;
      request.price     = ask;
      request.sl        = sl;
      request.tp        = tp;
      request.deviation = 20;
      request.magic     = MagicNumberOverride;
      request.comment   = "TrendPilot";
   }
   else if(order == "sell")
   {
      request.action    = TRADE_ACTION_DEAL;
      request.symbol    = symbol;
      request.volume    = volume;
      request.type      = ORDER_TYPE_SELL;
      request.price     = bid;
      request.sl        = sl;
      request.tp        = tp;
      request.deviation = 20;
      request.magic     = MagicNumberOverride;
      request.comment   = "TrendPilot";
   }
   else if(order == "close")
   {
      CloseAllPositionsForSymbol(symbol);
      return;
   }
   else
   {
      return; // دستور ناشناخته — بدون اقدام
   }

   if(!OrderSend(request, result))
      PrintFormat("خطا در اجرای سفارش %s روی %s — کد %d", order, symbol, GetLastError());
   else
      PrintFormat("سفارش %s روی %s اجرا شد — تیکت %I64u", order, symbol, result.order);
}

//+------------------------------------------------------------------+
//| بستن همه‌ی پوزیشن‌های باز همین نماد (وقتی سرور دستور close بدهد)   |
//+------------------------------------------------------------------+
void CloseAllPositionsForSymbol(string symbol)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;

      MqlTradeRequest request;
      MqlTradeResult  result;
      ZeroMemory(request);
      ZeroMemory(result);

      long type = PositionGetInteger(POSITION_TYPE);
      request.action   = TRADE_ACTION_DEAL;
      request.position = ticket;
      request.symbol   = symbol;
      request.volume   = PositionGetDouble(POSITION_VOLUME);
      request.type     = (type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      request.price    = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
      request.deviation= 20;

      if(!OrderSend(request, result))
         PrintFormat("خطا در بستن پوزیشن %I64u — کد %d", ticket, GetLastError());
   }
}

//+------------------------------------------------------------------+
//| استخراج مقدار رشته‌ای بسیار ساده از JSON تخت (بدون کتابخانه‌ی خارجی)|
//| توجه: فقط برای پاسخ‌های تخت و از‌پیش‌شناخته‌شده‌ی endpoint analyze   |
//| کافی است؛ برای JSON تودرتو مناسب نیست.                            |
//+------------------------------------------------------------------+
string JsonGetString(string &json, string key)
{
   string pattern = "\"" + key + "\":\"";
   int pos = StringFind(json, pattern);
   if(pos < 0) return "";
   int start = pos + StringLen(pattern);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

double JsonGetDouble(string &json, string key)
{
   string pattern = "\"" + key + "\":";
   int pos = StringFind(json, pattern);
   if(pos < 0) return 0.0;
   int start = pos + StringLen(pattern);
   int end = start;
   int len = StringLen(json);
   while(end < len)
   {
      ushort ch = StringGetCharacter(json, end);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-')
         end++;
      else
         break;
   }
   string numStr = StringSubstr(json, start, end - start);
   return StringToDouble(numStr);
}
//+------------------------------------------------------------------+
