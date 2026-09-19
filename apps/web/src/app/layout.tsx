import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'RadioLive - Listen Together',
  description: 'Open-source internet radio platform. One live stream. Everyone hears the same thing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-0 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
