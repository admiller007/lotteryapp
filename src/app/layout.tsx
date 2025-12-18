import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { Toaster } from '@/components/ui/toaster';
import AppHeader from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'ACCO-LOTTERY',
  description: 'ACCO-LOTTERY – A Chinese auction application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AppProvider>
          <AppHeader />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}
