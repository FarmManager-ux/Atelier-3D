import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { common } from "@/shared/i18n/pt-PT";

export const metadata: Metadata = {
  title: { default: common.product, template: `%s · ${common.brand}` },
  description: "Plataforma de gestão do Atelier 3D: impressão 3D FDM, orçamentos, encomendas e produção.",
  // Em construção: sem indexação até ao lançamento da Fase 1.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
