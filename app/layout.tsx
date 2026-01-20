import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Talk to Learn",
    description: "Practice answering questions with voice",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="de">
            <head>
                <!--Stats-->
                <script defer src="https://cloud.umami.is/script.js" data-website-id="45361192-66d0-46ad-ba1e-c55cfdaa9d81"></script>
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
            <body className={inter.className}>{children}</body>
        </html>
    );
}
