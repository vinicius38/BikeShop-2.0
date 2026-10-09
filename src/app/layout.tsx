import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bike Shop",
  description: "Sistema de gerenciamento para oficina de bicicletas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
