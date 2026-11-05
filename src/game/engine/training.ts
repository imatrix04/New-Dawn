// Formations et études : inscription, abandon, blâmes, progression.
import { MAX_BLAMES, PROMOTIONS, SKILL_MAX, TRAININGS } from '../../data/content';
import type { GameState, SkillId } from '../types';
import { jobById, trainingPrice } from './lookup';
import { promote } from './promotion';
import { addLog, clamp } from './shared';

export const trainingTuition = (state: GameState): number => state.training?.tuition ?? 0;

export function enrollTraining(state: GameState, id: string): GameState {
  if (!TRAININGS[id] || state.training || state.diplomas.includes(id)) return state;
  if (TRAININGS[id].requires?.some((r) => !state.diplomas.includes(r))) return state;
  if (!state.catalog[TRAININGS[id].quick ? 'quick' : 'training'].includes(id)) return state;
  const s = structuredClone(state);
  s.training = { id, monthsDone: 0, blames: 0, tuition: trainingPrice(state, id) };
  // L'inscription réserve d'office les heures d'étude de la formation dans le planning.
  s.schedule.study = TRAININGS[id].minStudyHours;
  addLog(s, 'log.enrolled', { trainingId: id }, 'good');
  return s;
}

export function dropTraining(state: GameState): GameState {
  if (!state.training) return state;
  const s = structuredClone(state);
  addLog(s, 'log.trainingDropped', { trainingId: state.training.id });
  s.training = null;
  s.schedule.study = 0;
  return s;
}

/** Risque de blâme du mois : 0 si le joueur fait ses heures, jusqu'à 1 s'il n'en fait aucune. */
export function blameChance(state: GameState): number {
  if (!state.training || state.training.sponsored) return 0;
  const min = TRAININGS[state.training.id].minStudyHours;
  return clamp(1 - state.schedule.study / min, 0, 1);
}

/**
 * Chaque mois, moins le joueur étudie par rapport aux heures de la formation, plus il risque un blâme.
 * Un mois blâmé ne compte pas ; au troisième blâme, le joueur est renvoyé et perd la formation.
 */
export function progressTraining(s: GameState) {
  const training = s.training;
  if (!training) return;
  const cfg = TRAININGS[training.id];
  // Une formation payée par l'employeur dépend du poste : sans lui, elle s'arrête.
  const promotion = training.sponsored ? PROMOTIONS[s.job ?? ''] : undefined;
  if (training.sponsored && promotion?.training !== training.id) {
    addLog(s, 'log.trainingLost', { trainingId: training.id }, 'bad');
    s.training = null;
    return;
  }
  if (Math.random() < blameChance(s)) {
    training.blames += 1;
    if (training.blames >= MAX_BLAMES) {
      addLog(s, 'log.trainingExpelled', { trainingId: training.id }, 'bad');
      s.training = null;
      s.schedule.study = 0;
    } else {
      addLog(s, 'log.trainingBlamed', { trainingId: training.id, count: training.blames, max: MAX_BLAMES }, 'bad');
    }
    return;
  }
  training.monthsDone += 1;
  if (training.monthsDone >= cfg.months) {
    s.diplomas.push(training.id);
    s.training = null;
    s.schedule.study = 0;
    for (const [id, v] of Object.entries(cfg.skills ?? {}) as [SkillId, number][]) s.skills[id] = clamp(s.skills[id] + v, 0, SKILL_MAX);
    addLog(s, cfg.quick ? 'log.certificate' : 'log.diploma', { trainingId: training.id }, 'good');
    const target = promotion && jobById(promotion.to);
    if (target) promote(s, target);
  }
}
