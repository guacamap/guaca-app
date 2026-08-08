import Link from 'next/link';
import TabBar from '../tab-bar';
import styles from '../tab-page.module.css';

export const metadata = { title: 'Plan — GUACA' };

/**
 * The planner routes a day from verified places only. With nothing verified
 * yet, the honest state is that it cannot plan anything — and saying so is
 * the product working, not a placeholder.
 */
export default function PlanPage() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/" aria-label="GUACA home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className={styles.mark} />
        </Link>
        <span className={styles.wordmark}>Plan</span>
      </header>

      <h1 className={styles.title}>Nothing to plan a day from yet.</h1>

      <p className={styles.body}>
        A GUACA day is routed from places a named local physically stood in.
        None have been filed, so there is nothing to route. This page will not
        invent a day out of somewhere nobody has been.
      </p>

      <div className={styles.rule}>
        <p className={styles.body}>
          Ask about somewhere on the map. Every question nobody can answer is
          recorded as a coverage gap, and gaps become paid missions for the
          local who covers that zone. The first planned day starts there.
        </p>
        <Link href="/map" className={styles.action}>
          Ask on the map
        </Link>
      </div>

      <TabBar />
    </main>
  );
}
