/**
 * @file Root layout for the OpenClaw Setup Wizard.
 *
 * This is the top-level layout component that wraps every page in the app.
 * It sets global metadata (page title, description) and imports the global
 * Tailwind CSS stylesheet.
 */

import type { Metadata } from 'next';
import './globals.css';

/** SEO metadata applied to all pages unless overridden by a nested layout. */
export const metadata: Metadata = {
  title: 'OpenClaw Setup Wizard',
  description: 'Set up your own AI agent in minutes',
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
