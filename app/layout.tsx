import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';

import Header from '@/components/shared/Header';

import './globals.css';
import Footer from '@/components/shared/Footer';

const DMSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'NextLevel',
  description: 'NextLevel app'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${DMSans.variable} antialiased`}>
        <div className="min-h-screen bg-background">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
