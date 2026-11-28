import type { Metadata, Viewport } from 'next';
import { Gabarito } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SessionInactivityGuard } from '@/components/auth/SessionInactivityGuard';
import { PwaRegister } from '@/components/pwa/PwaRegister';

/** Brand typeface from One Source guidelines — Gabarito only. */
const gabarito = Gabarito({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'OneSource Farm',
  description: 'Farm operations, harvests, quality, workforce, and exports for OneSource Farm',
  applicationName: 'OneSource Farm',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OneSource',
  },
  icons: {
    icon: '/onesource-icon.png',
    apple: '/onesource-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2e5e4a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${gabarito.variable} font-sans antialiased`}>
        <AuthProvider>
          <SessionInactivityGuard />
          <PwaRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
