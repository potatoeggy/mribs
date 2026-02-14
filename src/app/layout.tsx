import type { Metadata } from "next";
import "./globals.css";

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
      <body className="font-hand antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
