import { getRequestConfig } from "next-intl/server";



export const locales = ["fr", "en"] as const;
export const defaultLocale = "fr" as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  // Use defaultLocale as fallback to prevent './undefined.json' errors
  // during Next.js internal requests or 404 pages.
  const validLocale = locales.includes(locale as unknown as Locale) ? locale : defaultLocale;

  return {
    locale: validLocale as string,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});
