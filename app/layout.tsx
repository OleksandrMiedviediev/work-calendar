import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Work Calendar",
  description: "Import work schedules from PDF into Apple Calendar"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}