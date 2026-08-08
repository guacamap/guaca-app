import Link from 'next/link';
import TabBar from '../tab-bar';
import styles from '../tab-page.module.css';

export const metadata = { title: 'Locals — GUACA' };

/**
 * The Spotters. Ten are hand-picked for the pilot, one per zone, but none has
 * filed a place yet — so none is named here. Naming a seeded fixture as a real
 * person is the one thing this product cannot do.
 */
export default function LocalsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/" aria-label="GUACA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className={styles.mark} />
        </Link>
        <span className={styles.wordmark}>Locals</span>
      </header>

      <h1 className={styles.title}>One local per zone. None named yet.</h1>

      <p className={styles.body}>
        Every place on this map carries the name and face of the person who
        went and photographed it. Spotters are invited and hand-picked, never
        recruited by form, and they are paid for each verification.
      </p>

      <p className={styles.body}>
        They appear here the moment they file their first place. Until then
        this page stays empty rather than showing you someone who has not yet
        done the work.
      </p>

      <div className={styles.rule}>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>Puerto Cabello</span>
            <span className={`${styles.rowStatus} u-micro`}>
              10 zones · 0 filed
            </span>
          </li>
        </ul>
        <Link href="/map" className={styles.action}>
          See the map
        </Link>
      </div>

      <TabBar />
    </main>
  );
}
