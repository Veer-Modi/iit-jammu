import React from "react"
import type { Metadata, Viewport } from 'next';
import { Poppins, JetBrains_Mono } from 'next/font/google';

import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'TaskFlow - Team Task Management Platform',
  description:
    'A beautiful and elegant task management system for startup teams. Manage projects, tasks, and collaborate in real-time with stunning animations and intuitive UI.',
  keywords: [
    'task management',
    'team collaboration',
    'project management',
    'workspace',
  ],
  authors: [{ name: 'TaskFlow Team' }],
  creator: 'TaskFlow',
  publisher: 'TaskFlow',
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${poppins.variable} ${jetbrains.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
