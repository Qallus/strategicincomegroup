import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "Strategic Income Group | Comprehensive Financial Planning",
    template: "%s | Strategic Income Group",
  },
  description: "Financial planning, investment management, estate and insurance planning for every phase of life. Offices in Chandler and Peoria, Arizona.",
  applicationName: "Strategic Income Group",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SIG",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#070c1d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem('theme');
                var preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                var theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : preferredTheme;
                document.documentElement.dataset.theme = theme;
                document.documentElement.classList.toggle('dark', theme === 'dark');
              } catch {}
            `,
          }}
        />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
