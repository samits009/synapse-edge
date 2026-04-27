import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SynapseEdge // Mission Control",
  description: "Offline-first semantic orchestration engine for crisis response — Vector routing dashboard",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          toastOptions={{
            className: "font-space",
            style: {
              background: "#0c0c0c",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#e5e5e5",
              borderRadius: "0px",
            },
          }}
        />
      </body>
    </html>
  );
}
