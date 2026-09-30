import type { Metadata, Viewport } from "next";
import { ServiceWorker, ThemeSync } from "@/components/boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locus",
  description: "A spatial memory for physical things.",
  applicationName: "Locus",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#111112" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Paint the chosen theme before the first frame. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('locus-ui')||'{}');var t=(s.state&&s.state.theme)||'auto';if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
