import type { Metadata } from "next";
import "./globals.css";
import { AccessibilityBoot } from "@/components/AccessibilityBoot";

export const metadata: Metadata = {
  title: "SenseAI",
  description:
    "Accessible desktop meeting workspace with profile-specific communication support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AccessibilityBoot />
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
