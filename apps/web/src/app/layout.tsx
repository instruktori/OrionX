import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
    <html lang="en">
      <body className={manrope.variable}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
