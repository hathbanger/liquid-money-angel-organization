import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Open Collider',
  description: 'Bisociation engine — collide distant ideas',
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
