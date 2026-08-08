import Link from 'next/link';
import TabBar from '../tab-bar';
import styles from '../tab-page.module.css';

export const metadata = { title: 'You — GUACA' };

/**
 * Travellers pay nothing and install nothing, so there is no account to
 * manage. This page says what is and is not kept, which on a product built
 * on trust is worth more than a settings list.
 */
export default function YouPage() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/" aria-label="GUACA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className={styles.mark} />
        </Link>
        <span className={styles.wordmark}>You</span>
      </header>

      <h1 className={styles.title}>No account. Nothing to sign up for.</h1>

      <p className={styles.body}>
        GUACA is free for travellers and there is nothing to install. If you
        scanned a code at the place you are staying, your questions are tied to
        that stay and nothing else.
      </p>

      <div className={styles.rule}>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>Location</span>
            <span className="u-micro">
              Used to centre the map. Never stored.
            </span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>Questions</span>
            <span className="u-micro">
              Recorded as coverage gaps, without you attached.
            </span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>Language</span>
            <span className="u-micro">English · Español</span>
          </li>
        </ul>
        <Link href="/map" className={styles.action}>
          Back to the map
        </Link>
      </div>

      <TabBar />
    </main>
  );
}
