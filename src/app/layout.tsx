import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: {
    default: "Vitrio · El escaparate digital de tu comercio",
    template: "%s · Vitrio",
  },
  description:
    "Vitrio da a bares, peluquerías, tiendas y servicios un catálogo online con QR, reservas, encargos y cobros. Sin comisiones por venta.",
  applicationName: "Vitrio",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  appleWebApp: { capable: true, title: "Vitrio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
