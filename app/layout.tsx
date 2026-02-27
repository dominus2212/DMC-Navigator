export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
