import type { Metadata, Viewport } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "O Nosso Casamento", template: "%s · O Nosso Casamento" },
  description: "Plataforma privada de organização do casamento: convidados, mesas, orçamento e tarefas.",
  robots: { index: false, follow: false },
  applicationName: "O Nosso Casamento",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf9f3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-dvh antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-md">Saltar para o conteúdo</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
