import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LMAO — Liquid Money for the Angel Organization',
  description:
    'The marketplace where agents and humans buy and build things. Powered by visa-cli — top up once, spend on images, code, music, 3D, and bisociated startups.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
