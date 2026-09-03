import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Produtividade Fabril | Colagem",
  description: "Placar em tempo real de produtividade da area de Colagem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
