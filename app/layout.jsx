import "./globals.css";

export const metadata = {
  title: "The Scribe",
  description: "A canon-aware writing studio for your books",
};

const themeScript = `try{var t=localStorage.getItem('scribe_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="paper" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
