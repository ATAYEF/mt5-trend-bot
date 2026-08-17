import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrendPilot Web — مدیریت ربات معامله‌گر MT5",
  description:
    "داشبورد مدیریتی برای ربات‌های معاملاتی الگوریتمی MetaTrader 5 با پشتیبانی از استراتژی‌های روند، اسکلپ و خودکار.",
  keywords: [
    "TrendPilot",
    "MT5",
    "MetaTrader",
    "ربات معامله‌گر",
    "معاملات الگوریتمی",
    "بکتست",
  ],
  authors: [{ name: "TrendPilot Team" }],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <SonnerToaster position="top-center" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
