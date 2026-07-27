import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dream Admin",
  description: "Admin dashboard for Dream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: '#ffffff',
          color: '#1f2937',
        }}
        className={playfair.variable}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
