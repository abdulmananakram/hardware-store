export type Language = "en" | "ur";

export const dictionary = {
  newSaleBill: { en: "New Sale Bill", ur: "نیا سیل بل" },
  todaySales: { en: "Today's Sales", ur: "آج کی فروخت" },
  reports: { en: "Reports", ur: "رپورٹس" },
  inventory: { en: "Inventory", ur: "اسٹاک" },
  purchase: { en: "Purchase", ur: "خریداری" },
  customers: { en: "Customers", ur: "گاہک" },
  suppliers: { en: "Suppliers", ur: "سپلائرز" },
  notifications: { en: "Alerts", ur: "اطلاعات" },
  english: { en: "English", ur: "انگریزی" },
  urdu: { en: "Urdu", ur: "اردو" },
  print: { en: "Print", ur: "پرنٹ" },
  sharePdf: { en: "Share / PDF", ur: "شیئر / پی ڈی ایف" },
  from: { en: "From", ur: "سے" },
  to: { en: "To", ur: "تک" },
} as const;

export type TranslationKey = keyof typeof dictionary;

export const t = (key: TranslationKey, language: Language): string => dictionary[key][language];

export const requiredTranslationKeys: TranslationKey[] = Object.keys(dictionary) as TranslationKey[];
