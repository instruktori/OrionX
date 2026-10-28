import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/lib/session";

const manrope = localFont({
  src: "./fonts/Manrope.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "200 800",
});
export const metadata: Metadata = {
  title: "OrionX | AI Skills Digital Passport",
  description: "Digital credentials, verifiable by design.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('orionx-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={manrope.variable}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
