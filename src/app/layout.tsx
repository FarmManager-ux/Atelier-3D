import type { Metadata, Viewport } from "next";
import "./globals.css";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = {
  title: { default: messages.brand, template: `%s · ${messages.brand}` },
  description: "Área de cliente do Atelier 3D: orçamentos, projetos e encomendas de impressão 3D.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
