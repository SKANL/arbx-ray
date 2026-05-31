import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArbX-Ray Execution Lab",
  description: "Public-API Bitcoin arbitrage simulation lab with realistic execution constraints.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
