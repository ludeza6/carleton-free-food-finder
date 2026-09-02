import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),

  title: {
    default: "CF3 — Carleton Free Food Finder",
    template: "%s | CF3",
  },

  description:
    "A real-time free food finder for Carleton University students, powered by official event feeds and community reports.",

  applicationName: "CF3",

  keywords: [
    "Carleton University",
    "free food",
    "student events",
    "campus food",
    "Ottawa",
    "CF3",
  ],

  authors: [
    {
      name: "Lucas De la Cruz Zanabria",
    },
  ],

  openGraph: {
    title: "CF3 — Carleton Free Food Finder",
    description:
      "Find free food on campus from official Carleton events and real-time community reports.",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "CF3 — Carleton Free Food Finder",
    description:
      "Find free food on campus from official Carleton events and real-time community reports.",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
