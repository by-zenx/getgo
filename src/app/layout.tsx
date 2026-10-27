import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { SvgSprite } from "@/components/icons/svg-sprite";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Corbel — sales dashboard for an online and in-store shop",
  description:
    "Corbel is an animated sales dashboard for a shop that sells online and in store: live revenue, a sales score, monthly analytics, visits by hour and device, products, orders, customers, an inbox, email campaigns, automations, integrations, project boards, help, feedback and settings — light and dark.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#efefed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-palette="mono" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function (d) {
                d.classList.add('js');
                var rec = /[?&]record\\b/.test(location.search);
                if (rec) d.classList.add('is-record');
                try {
                  var t = rec ? 'light' : JSON.parse(localStorage.getItem('corbel:theme') || '"light"');
                  d.dataset.theme = t === 'dark' ? 'dark' : 'light';
                  var p = rec ? 'mono' : JSON.parse(localStorage.getItem('corbel:palette') || '"mono"');
                  d.dataset.palette = /^(mono|pastel|ocean|sage)$/.test(p) ? p : 'mono';
                } catch (e) {}
                if (!rec) setTimeout(function () { d.classList.add('failsafe'); }, 4000);
              })(document.documentElement);
            `,
          }}
        />
      </head>
      <body>
        <SvgSprite />
        <a className="skip" href="#main">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
