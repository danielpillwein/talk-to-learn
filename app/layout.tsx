import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Providers } from "./providers";
import { ThemeSwitchClient } from "@/components/theme-switch";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Talk to Learn",
  description: "Practice answering questions with voice",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Stats */}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="45361192-66d0-46ad-ba1e-c55cfdaa9d81"
          strategy="afterInteractive"
        />

        <Script
          id="mathjax-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['\\\\(', '\\\\)']],
                  displayMath: [['\\\\[', '\\\\]']],
                  processEscapes: true
                },
                options: {
                  skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
                }
              };
            `,
          }}
        />

        <Script
          id="mathjax-script"
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="beforeInteractive"
        />
      </head>

      <body className={inter.variable}>
        <Providers>
          <div className="fixed right-4 top-4 z-50">
            <ThemeSwitchClient />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
