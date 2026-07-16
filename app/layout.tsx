import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shortlist — job review workspace",
  description: "Review matched jobs and prepared cover letters in one private workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
