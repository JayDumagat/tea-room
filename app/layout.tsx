import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tea Room Virtual Office",
  description:
    "A Vercel-ready virtual office built with Next.js and react-three-fiber.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
