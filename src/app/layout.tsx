import type { Metadata } from "next";
import "./globals.css";
import FloatingDoodles from "@/components/FloatingDoodles";

export const metadata: Metadata = {
  title: "Scribble Fighters",
  description: "Draw your champion, bring it to life, and fight!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-hand antialiased min-h-screen relative">
        <FloatingDoodles />
        {children}
      </body>
    </html>
  );
}
