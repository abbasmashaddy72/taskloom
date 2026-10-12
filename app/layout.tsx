import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taskloom — A calmer way to get things done',
  description: 'A beautiful, private, local-first project and task workspace with Markdown and MongoDB.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('taskloom-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
