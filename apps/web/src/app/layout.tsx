export const metadata = {
  title: 'GUACA — Puerto Cabello',
  description: 'Local knowledge, witnessed not inferred.',
};

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
