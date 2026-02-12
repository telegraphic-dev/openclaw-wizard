/**
 * @file Root layout for the OpenClaw Setup Wizard.
 *
 * This is the top-level layout component that wraps every page in the app.
 * It sets global metadata (page title, description) and imports the global
 * Tailwind CSS stylesheet.
 */

import type { Metadata } from 'next';
import './globals.css';

/** 
 * SEO and social sharing metadata.
 * Open Graph tags for Facebook/LinkedIn, Twitter Card for Twitter/X.
 */
export const metadata: Metadata = {
  title: 'OpenClaw Setup Wizard',
  description: 'Get your own AI agent running in 5 minutes. No coding required.',
  
  // Open Graph (Facebook, LinkedIn, etc.)
  openGraph: {
    title: 'OpenClaw Setup Wizard',
    description: 'Get your own AI agent running in 5 minutes. No coding required.',
    url: 'https://hetzner-wizard.telegraphic.app',
    siteName: 'OpenClaw',
    images: [
      {
        url: 'https://assets.orany.cz/images/openclaw-wizard-og.jpg',
        width: 1200,
        height: 630,
        alt: 'OpenClaw Setup Wizard - Get your AI agent running in 5 minutes',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'OpenClaw Setup Wizard',
    description: 'Get your own AI agent running in 5 minutes. No coding required.',
    images: ['https://assets.orany.cz/images/openclaw-wizard-og.jpg'],
  },
  
  // Additional metadata
  metadataBase: new URL('https://hetzner-wizard.telegraphic.app'),
  keywords: ['AI agent', 'OpenClaw', 'Hetzner', 'self-hosted', 'Telegram bot', 'Claude'],
};

/**
 * RootLayout — the outermost server component that renders the `<html>` shell.
 *
 * @param props.children - The page content rendered inside the body.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
