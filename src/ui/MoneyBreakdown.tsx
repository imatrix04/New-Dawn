import { useTranslation } from 'react-i18next';
import { monthlyExpenseLines, monthlyIncomeLines, type MoneyLine } from '../game/engine';
import type { GameState } from '../game/types';
import { formatNumber } from '../i18n/format';

/** Libellé d'une ligne de revenu ou de dépense (poste, boulot, logement, véhicule…). */
function useLineLabel(game: GameState): (l: MoneyLine) => string {
  const { t } = useTranslation();
  const vehicleName = (id?: string) => t(`vehicles.${game.vehicles.find((v) => v.id === id)?.modelId ?? 'city'}`);
  return (l) => {
    switch (l.kind) {
      case 'job': return t(`jobs.${l.id}`, { context: game.gender });
      case 'gig': return t(`gigs.${l.id}.name`);
      case 'housing': return t(`housing.${l.id}`);
      case 'loan': return t('estate.lines.loan');
      case 'charges': return t('estate.lines.charges');
      case 'rentals': return t('estate.lines.rentals');
      case 'propLoan': return t('estate.lines.propLoan');
      case 'propCharges': return t('estate.lines.propCharges');
      case 'fuel': return t('market.lines.fuel', { vehicle: vehicleName(l.id) });
      case 'insurance': return t('market.lines.insurance', { vehicle: vehicleName(l.id) });
      case 'training': return t(`trainings.${l.id}.name`);
      case 'food': return t('schedule.lines.food');
      case 'leisure': return t('schedule.lines.leisure');
    }
  };
}

/** Détail du mois au survol de l'argent : revenus, dépenses, puis le solde de l'ensemble. */
export function MoneyBreakdown({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const label = useLineLabel(game);
  const lng = i18n.language;
  const incomeLines = monthlyIncomeLines(game);
  const expenseLines = monthlyExpenseLines(game);
  const income = incomeLines.reduce((sum, l) => sum + l.amount, 0);
  const expenses = expenseLines.reduce((sum, l) => sum + l.amount, 0);
  const balance = income - expenses;
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
  const money = (n: number) => `${sign(n)}${formatNumber(Math.abs(n), lng)} €`;

  return (
    <div className="money-pop" role="tooltip">
      <section>
        <h5>{t('schedule.income')} <b className="good">{money(income)}</b></h5>
        {incomeLines.length === 0 && <p className="muted">{t('schedule.noIncome')}</p>}
        {incomeLines.map((l) => (
          <div className="money-pop-row" key={`${l.kind}-${l.id ?? ''}`}><span>{label(l)}</span><b className="good">{money(l.amount)}</b></div>
        ))}
      </section>
      <section>
        <h5>{t('schedule.expenses')} <b className="bad">{money(-expenses)}</b></h5>
        {expenseLines.map((l) => (
          <div className="money-pop-row" key={`${l.kind}-${l.id ?? ''}`}><span>{label(l)}</span><b className="bad">{money(-l.amount)}</b></div>
        ))}
      </section>
      <footer>
        <span>{t('schedule.balance')}</span>
        <b className={balance < 0 ? 'bad' : 'good'}>{money(balance)}</b>
      </footer>
    </div>
  );
}
