import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SessionInactivityGuard } from '@/components/auth/SessionInactivityGuard';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OneSource Farm',
  description: 'Farm operations, harvests, quality, workforce, and exports for OneSource Farm',
  icons: {
    icon: '/onesource-icon.png',
    apple: '/onesource-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className} antialiased`}>
        <AuthProvider>
          <SessionInactivityGuard />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
