import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { JOBS, SKILL_MAX, SKILLS, TRAININGS } from '../data/content';
import { experienceGoal, experienceMonths, skillGainSources, skillGains, type SkillGainSource } from '../game/engine';
import type { GameState } from '../game/types';
import { formatAge, formatSigned } from '../i18n/format';
import { Money } from './Money';
import { useAnimatedNumber } from './useAnimatedNumber';

type Tab = 'skills' | 'experience';

function SkillRow({ id, icon, color, value, gain, sources, gender, index }: {
  id: string; icon: string; color: string; value: number; gain: number; sources: SkillGainSource[]; gender: GameState['gender']; index: number;
}) {
  const { t, i18n } = useTranslation();
  const shown = useAnimatedNumber(value);
  const sourceLabel = (s: SkillGainSource) => {
    if (s.kind === 'job') return t('profile.sources.job', { name: t(`jobs.${s.id}`, { context: gender }) });
    if (s.kind === 'training') return t('profile.sources.training', { name: t(`trainings.${s.id}.name`) });
    if (s.kind === 'gig') return t('profile.sources.gig', { name: t(`gigs.${s.id}.name`) });
    return t(`profile.sources.${s.kind}`);
  };
  return (
    <div className="skill-row" style={{ '--c': color, animationDelay: `${index * 50}ms` } as CSSProperties}>
      <div className="skill-head">
        <span className="skill-name">{icon} {t(`skills.${id}.name`)}</span>
        <span className="skill-right">
          {gain > 0 && (
            <span className="badge good has-tip" tabIndex={0}>
              {formatSigned(gain, i18n.language)}/{t('profile.perMonth')}
              <span className="money-tip good" role="tooltip">
                {sources.map((s, i) => (
                  <span className="money-tip-row" key={`${s.kind}-${s.id ?? ''}`} style={{ animationDelay: `${60 + i * 55}ms` }}>
                    <span>{sourceLabel(s)}</span><b>{formatSigned(s.amount, i18n.language)}</b>
                  </span>
                ))}
              </span>
            </span>
          )}
          <span className="skill-val">{Math.round(shown)}</span>
        </span>
      </div>
      <div className="meter"><div style={{ width: `${(shown / SKILL_MAX) * 100}%` }} /></div>
      <span className="job-meta">{t(`skills.${id}.how`)}</span>
    </div>
  );
}

/** Contenu de la carte « Profil » : identité, puis deux onglets — compétences et expérience. */
export function ProfileCard({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('skills');
  const gains = skillGains(game);
  const sources = skillGainSources(game);
  const jobName = (id: string) => t(`jobs.${id}`, { context: game.gender });

  // Domaines où le joueur a travaillé, dans l'ordre des postes du jeu.
  const fields = [...new Set(JOBS.map((j) => j.field))].filter(
    (f) => experienceMonths(game, f) > 0 || JOBS.some((j) => j.field === f && (game.history[j.id] ?? 0) > 0),
  );
  const training = game.training;

  return (
    <div className="profile">
      <div className="pcard">
        <div className={`avatar ${game.gender}`}>{game.gender === 'male' ? '♂' : '♀'}</div>
        <div className="pcard-id">
          <strong className="pcard-name">{game.firstName} {game.lastName}</strong>
          <span className="muted">{formatAge(t, game.month)}</span>
        </div>
        <div className="pcard-money">
          <small className="muted">{t('profile.money')}</small>
          <Money value={game.money} />
        </div>
      </div>

      <div className="seg" data-mode={tab === 'skills' ? 'in' : 'out'} style={{ '--c': 'var(--accent)' } as CSSProperties}>
        <span className="seg-thumb" />
        <button className={tab === 'skills' ? 'on' : ''} onClick={() => setTab('skills')}>{t('profile.tabs.skills')}</button>
        <button className={tab === 'experience' ? 'on' : ''} onClick={() => setTab('experience')}>{t('profile.tabs.experience')}</button>
      </div>

      {tab === 'skills' && (
        <div className="skill-list" key="skills">
          {SKILLS.map((s, i) => (
            <SkillRow key={s.id} id={s.id} icon={s.icon} color={s.color} value={game.skills[s.id]} gain={gains[s.id]} sources={sources[s.id]} gender={game.gender} index={i} />
          ))}
        </div>
      )}

      {tab === 'experience' && (
        <div className="xp-tab" key="experience">
          <section className="csec">
            <h3>{t('profile.diplomas')}</h3>
            {game.diplomas.length > 0 ? (
              <div className="job-list">
                {game.diplomas.map((id) => (
                  <div className="train done" key={id}>
                    <strong>🎓 {t(`trainings.${id}.name`)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">{t('profile.noDiplomas')}</p>
            )}
          </section>

          <section className="csec">
            <h3>{t('profile.training')}</h3>
            {training ? (
              <div className="train">
                <div className="xp-head">
                  <strong>{t(`trainings.${training.id}.name`)}</strong>
                  <span className="muted">{t('career.monthsOf', { done: training.monthsDone, total: TRAININGS[training.id].months })}</span>
                </div>
                <div className="meter"><div style={{ width: `${(training.monthsDone / TRAININGS[training.id].months) * 100}%` }} /></div>
              </div>
            ) : (
              <p className="muted small">{t('profile.noTraining')}</p>
            )}
          </section>

          <section className="csec">
            <h3>{t('profile.work')}</h3>
            {fields.length > 0 ? (
              <div className="xp-list">
                {fields.map((f) => {
                  const months = experienceMonths(game, f);
                  const goal = experienceGoal(f);
                  return (
                    <div className="xp-row" key={f}>
                      <div className="xp-head">
                        <strong>{t(`fields.${f}`)}</strong>
                        <span className="muted">
                          {goal > 0
                            ? t('career.monthsOf', { done: Math.min(months, goal), total: goal })
                            : t('profile.months', { count: months })}
                        </span>
                      </div>
                      {goal > 0 && <div className="meter"><div style={{ width: `${Math.min(100, (months / goal) * 100)}%` }} /></div>}
                      {JOBS.filter((j) => j.field === f && (game.history[j.id] ?? 0) > 0).map((j) => (
                        <div className="xp-job" key={j.id}>
                          <span>{jobName(j.id)}</span>
                          <span className="muted">{t('profile.months', { count: game.history[j.id] })}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted small">{t('profile.noWork')}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
