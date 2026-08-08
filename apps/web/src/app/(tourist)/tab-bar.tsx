'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './tab-bar.module.css';

/**
 * The traveller's app shell. Four destinations, one of which is always the
 * map, because a guest opens this standing somewhere and wanting to know
 * what is nearby.
 *
 * Icons are authored here rather than pulled from a library so they share one
 * stroke weight and the world's square-cornered, hairline vocabulary. No
 * glyphs, no emoji.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      <path d="M12 21s7-6.4 7-11.2A7 7 0 0 0 5 9.8C5 14.6 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      {/* A routed day: three stops joined in order. */}
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="7" cy="18" r="2" />
      <path d="M7 6.6c5 .6 9.6 2.4 10.4 4.4M17.6 13.4c-1.4 2-5.6 3.6-8.8 4.2" />
    </svg>
  );
}

function IconLocals() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.6 14.8c1.8.7 3 2.4 3.4 4.7" />
    </svg>
  );
}

function IconYou() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...STROKE}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.7-3.6 3.4-5.6 7-5.6s6.3 2 7 5.6" />
    </svg>
  );
}

const TABS = [
  { href: '/map', label: 'Map', Icon: IconMap },
  { href: '/plan', label: 'Plan', Icon: IconPlan },
  { href: '/locals', label: 'Locals', Icon: IconLocals },
  { href: '/you', label: 'You', Icon: IconYou },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Sections">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon />
            <span className="u-micro">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
