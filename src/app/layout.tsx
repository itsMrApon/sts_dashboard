import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/providers/theme-provider"
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
 
const manrope = Manrope ({
  subsets: ['latin'], 
  variable:'--font-manrope'
})

export const metadata: Metadata = {
  title: "STS - Clerk Next.js App",
  description: "A Next.js app with Clerk authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${manrope.variable} ${manrope.variable} antialiased`}
          suppressHydrationWarning
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-center" richColors closeButton />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
