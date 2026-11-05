// Création d'une partie et migration des anciennes sauvegardes.
import { AREAS, DEFAULT_SCHEDULE, JOBS, SKILL_MAX, START, START_LISTINGS, START_SKILLS, START_STATS, TRAININGS, USED_MARKET } from '../../data/content';
import type { Area, GameState, Profile, SkillId, Vehicle } from '../types';
import { drawCatalog } from './catalog';
import { drawListings, housingTypeById, starterHome } from './housing';
import { jobById } from './lookup';
import { makeOffer, starterOffers } from './offers';
import { emptySavings, migrateSavings } from './savings';
import { addLog, newId, NO_PROBATION } from './shared';
import { drawUsedListings, newDriver, starterVehicle } from './vehicle';

export function createGame(profile: Profile): GameState {
  const start = START[profile.path];
  const hired = profile.job ? makeOffer(jobById(profile.job)!) : null;
  const state: GameState = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender,
    experience: {},
    // Le véhicule de départ suppose d'avoir le permis.
    diplomas: start.car ? ['permisB'] : [],
    training: null,
    applications: [],
    jobDecision: null,
    promotion: null,
    promotionSeen: false,
    promotionRequested: null,
    jobBlames: 0,
    jobStart: NO_PROBATION,
    firedMonth: null,
    offers: starterOffers().filter((o) => o.jobId !== profile.job),
    gig: null,
    catalog: { gigs: [], quick: [], training: [], factors: {} },
    skills: { ...START_SKILLS },
    skillMax: SKILL_MAX,
    history: {},
    month: 0,
    money: start.money,
    job: profile.job,
    jobSalary: hired?.salary ?? null,
    jobCompany: hired?.companyId ?? null,
    home: starterHome(start.housing),
    listings: drawListings(START_LISTINGS),
    housingTarget: null,
    housingLeave: 'sell',
    properties: [],
    vehicles: start.car ? [starterVehicle(start.car, 0)] : [],
    driver: newDriver(),
    vehicleListings: drawUsedListings(0, USED_MARKET.start),
    schedule: { ...DEFAULT_SCHEDULE, work: jobById(profile.job)?.hours ?? 0 },
    savings: emptySavings(),
    lastEvent: null,
    pendingEvent: null,
    over: null,
    stats: { ...START_STATS },
    log: [],
  };
  state.catalog = drawCatalog(state);
  addLog(state, profile.path === 'comfort' ? 'log.startComfort' : 'log.startTight', {}, 'month');
  return state;
}

/** Complète une sauvegarde d'une version antérieure avec les champs ajoutés depuis. */
export function migrateGame(raw: GameState): GameState {
  const g = raw;
  g.gender ??= 'male';
  g.experience ??= {};
  g.diplomas ??= [];
  g.training ??= null;
  // Avant les candidatures multiples, une seule offre pouvait être visée (jobTarget).
  const legacyTarget = g as unknown as { jobTarget?: string | null };
  g.applications ??= legacyTarget.jobTarget === 'waiter' ? [{ jobId: 'fastFood', monthsLeft: 1 }] : legacyTarget.jobTarget ? [{ jobId: legacyTarget.jobTarget, monthsLeft: 1 }] : [];
  delete legacyTarget.jobTarget;
  g.jobDecision ??= null;
  // Les anciennes formations de manager en restauration (fl1, titre pro, BP) sont remplacées par le seul BTS MHR.
  const renamedTrainings = ['fl1', 'tpMum', 'bpService'];
  g.diplomas = [...new Set(g.diplomas.map((d) => (renamedTrainings.includes(d) ? 'btsMhr' : d)))];
  if (g.training && renamedTrainings.includes(g.training.id)) g.training.id = 'btsMhr';
  g.promotion ??= null;
  g.promotionSeen ??= false;
  g.promotionRequested ??= null;
  g.jobBlames ??= 0;
  g.jobStart ??= NO_PROBATION;
  g.firedMonth ??= null;
  g.gig ??= null;
  g.offers ??= starterOffers();
  g.offers = g.offers.map((o) => (o.companyId ? o : { ...makeOffer(jobById(o.jobId) ?? JOBS[0]), jobId: o.jobId, monthsLeft: o.monthsLeft }));
  g.history ??= {};
  g.catalog ??= drawCatalog(g);
  g.catalog.factors ??= {};
  if (g.training) {
    g.training.tuition ??= TRAININGS[g.training.id].tuition;
    g.training.blames ??= 0;
  } else {
    g.schedule.study = 0; // le curseur d'études n'existe que pendant une formation
  }
  g.jobCompany ??= null;
  g.jobSalary ??= null;
  // Avant la carte Logement, le logement n'était qu'un identifiant (studio ou colocation) à loyer fixe.
  const legacyHome = g as unknown as { housing?: string };
  g.home ??= starterHome(legacyHome.housing ?? 'studio');
  delete legacyHome.housing;
  g.listings ??= drawListings(START_LISTINGS);
  g.housingTarget ??= null;
  g.housingLeave ??= 'sell';
  g.properties ??= [];
  // Avant la carte Marché, la voiture n'était qu'un identifiant (petite voiture) à coût fixe : elle devient une citadine d'occasion.
  const legacyCar = g as unknown as { car?: string | null };
  // Puis le véhicule unique est devenu un parc limité par les places de parking du logement.
  const legacyVehicle = g as unknown as { vehicle?: Vehicle | null };
  g.vehicles ??= legacyVehicle.vehicle ? [legacyVehicle.vehicle] : legacyCar.car ? [starterVehicle('city', g.month)] : [];
  delete legacyCar.car;
  delete legacyVehicle.vehicle;
  for (const v of g.vehicles) v.id ??= newId();
  if (g.vehicles.length && !g.diplomas.includes('permisB')) g.diplomas.push('permisB');
  g.driver ??= newDriver();
  g.driver.vehicleId ??= null;
  g.vehicleListings ??= drawUsedListings(g.month, USED_MARKET.start);
  // Avant le trajet aléatoire, chaque quartier avait un trajet fixe : on prend le milieu de la fourchette actuelle.
  const midCommute = (a: Area) => Math.round((AREAS[a].commute[0] + AREAS[a].commute[1]) / 2);
  g.home.commute ??= midCommute(g.home.area);
  for (const x of [...g.listings, ...g.properties]) x.commute ??= midCommute(x.area);
  // L'ancienne « villa » est devenue la grosse maison (identifiant `bigHouse`).
  const renameVilla = (x: { typeId: string }) => { if (x.typeId === 'villa') x.typeId = 'bigHouse'; };
  renameVilla(g.home);
  g.listings.forEach(renameVilla);
  g.properties.forEach(renameVilla);
  for (const e of g.log) if (e.params?.homeId === 'villa') e.params.homeId = 'bigHouse';
  g.listings = g.listings.filter((l) => !housingTypeById(l.typeId).notIn?.includes(l.area));
  if (g.housingTarget && !g.listings.some((l) => l.id === g.housingTarget)) g.housingTarget = null;
  g.schedule.housing ??= 0;
  // Avant les compétences, un seul « savoir » existait : il devient l'intelligence. L'énergie a disparu.
  const legacy = g.stats as unknown as Record<string, number | undefined>;
  if (!g.skills) {
    g.skills = { ...START_SKILLS, intelligence: legacy.knowledge === undefined ? START_SKILLS.intelligence : legacy.knowledge * (SKILL_MAX / 100) };
    g.skillMax = SKILL_MAX;
  }
  delete legacy.knowledge;
  delete legacy.energy;
  // Les compétences allaient de 0 à 100 ; elles vont maintenant de 0 à 1000.
  if (g.skillMax !== SKILL_MAX) {
    for (const id of Object.keys(g.skills) as SkillId[]) g.skills[id] *= SKILL_MAX / (g.skillMax ?? 100);
    g.skillMax = SKILL_MAX;
  }
  if (g.job === 'waiter') g.job = 'fastFood'; // l'ancien « serveur » devient serveur en restauration rapide
  g.applications = g.applications.filter((a) => g.offers.some((o) => o.jobId === a.jobId));
  g.schedule.work ??= jobById(g.job)?.hours ?? 0;
  g.skills.mechanics ??= START_SKILLS.mechanics;
  g.savings = migrateSavings(g.savings);
  return g;
}
