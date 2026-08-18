// طبق کدهای مورد استفاده در فرانت‌اند (src/lib/mock-data.ts → EXIT_REASON_LABELS)
export const EXIT_REASON_LABELS = {
  tp_hit: "حد سود",
  sl_hit: "حد ضرر",
  trailing: "تریلینگ استاپ",
  timeout: "پایان مدت",
  weekend: "بستن آخر هفته",
  daily_loss: "حد زیان روزانه",
  manual: "بستن دستی",
} as const;
