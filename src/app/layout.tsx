import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SessionInactivityGuard } from '@/components/auth/SessionInactivityGuard';
import { PwaRegister } from '@/components/pwa/PwaRegister';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
      <body className={`${inter.variable} ${inter.className} antialiased`}>
        <AuthProvider>
          <SessionInactivityGuard />
          <PwaRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
