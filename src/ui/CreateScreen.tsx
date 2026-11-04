import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HOUSING_TYPES, JOBS, START, STARTER_JOBS } from '../data/content';
import { randomProfile } from '../game/profile';
import type { Gender, Profile, StartPath } from '../game/types';
import { formatNumber } from '../i18n/format';
import { useStore } from '../store';

type Step = 'identity' | 'path' | 'job' | 'recap';

const PATHS: StartPath[] = ['comfort', 'tight'];
const GENDERS: { id: Gender; symbol: string }[] = [
  { id: 'male', symbol: '♂' },
  { id: 'female', symbol: '♀' },
];
const PERK_COUNT = 4;

export function CreateScreen() {
  const { t, i18n } = useTranslation();
  const { start, go } = useStore();

  const [step, setStep] = useState<Step>('identity');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [path, setPath] = useState<StartPath | null>(null);
  const [job, setJob] = useState<string | null>(null);

  const identityOk = lastName.trim() !== '' && firstName.trim() !== '' && gender !== null;
  /** Nom d'un poste accordé au genre choisi (Serveur / Serveuse). */
  const jobName = (id: string) => t(`jobs.${id}`, { context: gender ?? undefined });

  /** Remplit tout le personnage au hasard puis affiche le récapitulatif. */
  const randomize = () => {
    const p = randomProfile();
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setGender(p.gender);
    setPath(p.path);
    setJob(p.job);
    setStep('recap');
  };

  const choosePath = (p: StartPath) => {
    setPath(p);
    setJob(null);
    setStep(p === 'comfort' ? 'job' : 'recap');
  };

  const back = () => {
    if (step === 'identity') go('menu');
    else if (step === 'path') setStep('identity');
    else if (step === 'job') setStep('path');
    else setStep(path === 'comfort' ? 'job' : 'path');
  };

  const begin = () => {
    if (!path || !gender) return;
    const profile: Profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      path,
      job: path === 'comfort' ? job : null,
    };
    start(profile);
  };

  const perks = (p: StartPath) => {
    const s = START[p];
    return Array.from({ length: PERK_COUNT }, (_, i) =>
      t(`paths.${p}.perks.${i}`, {
        money: s.money,
        housing: t(`housing.${s.housing}`),
        rent: HOUSING_TYPES[s.housing].rent,
      }),
    );
  };

  return (
    <section className="screen">
      <h1>NewDawn</h1>

      {step === 'identity' && (
        <>
          <h2>{t('create.identityTitle')}</h2>
          <div className="fields">
            <label>
              {t('create.firstName')}
              <input type="text" maxLength={20} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label>
              {t('create.lastName')}
              <input type="text" maxLength={20} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <div className="gender-pick" role="radiogroup" aria-label={t('create.gender')}>
            {GENDERS.map((g) => (
              <button
                key={g.id}
                role="radio"
                aria-checked={gender === g.id}
                className={`gender-btn ${g.id}${gender === g.id ? ' selected' : ''}`}
                onClick={() => setGender(g.id)}
              >
                <span className="gender-symbol">{g.symbol}</span>
                {t(`genders.${g.id}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'path' && (
        <>
          <h2>{t('create.pathTitle')}</h2>
          <div className="cards">
            {PATHS.map((p) => (
              <div key={p} className={`card wide${path === p ? ' selected' : ''}`} onClick={() => choosePath(p)}>
                <strong>{t(`paths.${p}.name`)}</strong>
                <small>{t(`paths.${p}.desc`)}</small>
                <ul>
                  {perks(p).map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'job' && (
        <>
          <h2>{t('create.jobTitle')}</h2>
          <div className="cards">
            {STARTER_JOBS.map((id) => {
              const j = JOBS.find((x) => x.id === id)!;
              return (
                <div
                  key={id}
                  className={`card${job === id ? ' selected' : ''}`}
                  onClick={() => { setJob(id); setStep('recap'); }}
                >
                  {jobName(id)}
                  <small>{t('create.jobInfo', { salary: j.salary, hours: j.hours, commute: j.commute })}</small>
                </div>
              );
            })}
          </div>
        </>
      )}

      {step === 'recap' && path && (
        <>
          <h2>{t('create.recapTitle')}</h2>
          <div className="panel recap">
            <p><strong>{firstName} {lastName}</strong>{gender && <> • {t(`genders.${gender}`)}</>}</p>
            <p>{t(`paths.${path}.name`)}</p>
            <p>{t('create.money')} : {formatNumber(START[path].money, i18n.language)} €</p>
            <p>{t('create.housing')} : {t(`housing.${START[path].housing}`)}</p>
            <p>{t('create.car')} : {START[path].car ? t(`cars.${START[path].car}`) : t('create.none')}</p>
            <p>{t('create.job')} : {job ? jobName(job) : t('create.none')}</p>
          </div>
        </>
      )}

      <div className="row">
        <button className="secondary" onClick={back}>{t('create.back')}</button>
        {step === 'identity' && (
          <button disabled={!identityOk} onClick={() => setStep('path')}>{t('create.next')}</button>
        )}
        {step === 'recap' && <button onClick={begin}>{t('create.start')}</button>}
        <button className="secondary" onClick={randomize}>{t('create.random')}</button>
      </div>
    </section>
  );
}
