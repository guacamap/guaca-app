import type { ActivityInterestTagType as ActivityInterestTag } from '@guaca/shared'
import { useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'
import { PLAN_INTERESTS } from '../lib/recordingUi'

export function PlanInterests({
  selected,
  onChange,
}: {
  selected: readonly ActivityInterestTag[]
  onChange: (next: ActivityInterestTag[]) => void
}) {
  const { lang } = useLanguage()
  const t = appCopy[lang].tourist
  const label = (tag: ActivityInterestTag) =>
    tag === 'relax' ? t.interestRelax : tag === 'adventure' ? t.interestAdventure : tag === 'culture' ? t.interestCulture : t.interestFood

  return (
    <section className="plan-interests" aria-label={t.interestTitle}>
      <h2>{t.interestTitle}</h2>
      <p>{t.interestHint}</p>
      <div className="plan-interest-chips">
        {PLAN_INTERESTS.map((tag) => {
          const on = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((item) => item !== tag) : [...selected, tag])}
            >
              {label(tag)}
            </button>
          )
        })}
      </div>
    </section>
  )
}
