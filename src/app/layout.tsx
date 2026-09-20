import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";
export const metadata: Metadata = {
  title: "Auth Lab | 認証のしくみを観察する",
  description:
    "実際のHTTP・Cookie・PostgreSQLでSession認証を学ぶローカル実験室",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
