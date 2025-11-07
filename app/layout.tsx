import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app-providers";
import { getCachedUserPref } from "@/app/actions/user-pref";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "G-Finance",
  description: "Dasbor ringkas untuk finansial harian.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/logo-g.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pref = await getCachedUserPref();
  const htmlLang = pref.locale.startsWith("en") ? "en" : "id";
  const animationsAttr = pref.uiAnimationsEnabled ? "enabled" : "reduced";

  return (
    <html lang={htmlLang} suppressHydrationWarning data-locale={pref.locale}>
      <body
        className={cn("min-h-screen bg-background text-foreground antialiased", inter.className)}
        data-animations={animationsAttr}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={pref.theme}
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders initialPref={pref}>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
