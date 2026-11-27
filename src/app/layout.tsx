import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SessionInactivityGuard } from '@/components/auth/SessionInactivityGuard';
import { PwaRegister } from '@/components/pwa/PwaRegister';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
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
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <AuthProvider>
          <SessionInactivityGuard />
          <PwaRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
