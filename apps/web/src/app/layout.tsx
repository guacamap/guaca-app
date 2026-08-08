import { Bodoni_Moda, Archivo } from 'next/font/google';
import './globals.css';

const display = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const text = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text',
  display: 'swap',
});

const CONTRACT = `<!--
THESIS: A map worth trusting because a named local physically stood there; refuses the turquoise hero, white search capsule and destination-card grid this category always ships.
OWN-WORLD: Bone #F7F6F2 ground, ink #0B0B0B, stone hairlines, one merlot #6B1F2B spent only on what the map does not know. Bodoni Moda monumental display over Archivo labels; full-bleed documentary photography as the only texture; square corners; underline as the active state.
STORY: These places were witnessed, not generated. Ask one question, watch it answered or honestly refused and paid for, then open the map.
FIRST VIEWPORT: Coast photograph full-bleed across the right, bleeding off top and right. Left: WITNESSED at monumental scale, "not inferred." beneath it, then one hairline ask field with a square ink button.
FORM: Digital flagship of a fashion house — user-pinned challenger over assigned index 6; seed key 88812ea8.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export const metadata = {
  title: 'GUACA — the Caribbean, witnessed',
  description:
    'A map of the Caribbean built only from places a named local physically stood in. Coverage begins in Puerto Cabello.',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport = {
  themeColor: '#f7f6f2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        {/* A JSX comment never reaches the HTML, so the direction contract is
            emitted as a real comment node that survives the production build. */}
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        {children}
      </body>
    </html>
  );
}
