import type { Metadata } from "next";
import localFont from "next/font/local";
import { Noto_Sans_Georgian } from "next/font/google";
import { cookies } from "next/headers";
import { I18nProvider } from "@/lib/i18n-provider";
import { isLocale, translate } from "@/lib/i18n";
import "./globals.css";
import { SessionProvider } from "@/lib/session";

const manrope = localFont({
  src: "./fonts/Manrope.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "200 800",
});
const notoGeorgian = Noto_Sans_Georgian({ subsets: ["georgian"], weight: ["400","500","600","700"], display: "swap", variable: "--font-georgian" });
export async function generateMetadata(): Promise<Metadata> {
  const choice = (await cookies()).get("orionx-locale")?.value;
  const locale = isLocale(choice) ? choice : "en";
  return {
    title: locale === "ka" ? "OrionX | AI უნარების ციფრული პასპორტი" : "OrionX | AI Skills Digital Passport",
    description: locale === "ka"
      ? "ციფრული დოკუმენტები, რომელთა ნამდვილობის გადამოწმება შესაძლებელია."
      : "Digital credentials, verifiable by design.",
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const choice = cookieStore.get("orionx-locale")?.value;
  const locale = isLocale(choice) ? choice : "en";
  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('orionx-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${notoGeorgian.variable}`}>
        <a className="skip-link" href="#main-content">
          {translate(locale, "common.skip")}
        </a>
        <I18nProvider initialLocale={locale}><SessionProvider>{children}</SessionProvider></I18nProvider>
      </body>
    </html>
  );
}
