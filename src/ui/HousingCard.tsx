import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HOUSING_KINDS, LETTING, LISTINGS_MAX, MOVING_COST, OWNING, SELLING } from '../data/content';
import {
  buyQuote, comfortOf, housingEffects, housingTypeById, lettingChance, marketRent, moveCredit, propertyProceeds, rentBreakdown,
  parkingOf, parkingOverflow, rentChance, rentQuote, saleNet, scheduleEffects, sellingChance,
} from '../game/engine';
import type { RentBonus } from '../game/engine';
import type { GameState, HousingKind, HousingListing, LeaveAction, Property, StatKey } from '../game/types';
import { formatMoney, formatPercent, formatSigned } from '../i18n/format';
import { useStore } from '../store';
import { ChanceBar, DetailHead, Facts, PercentPick, Seg, Split, Tile } from './cardKit';
import type { Rarity } from './cardKit';

type Tab = 'rent' | 'buy' | 'own';
const TABS: Tab[] = ['rent', 'buy', 'own'];
type Filter = 'all' | HousingKind;
const FILTERS: Filter[] = ['all', ...HOUSING_KINDS];

/** Effets mensuels du confort sur la santé et le bonheur : vert quand ils aident, rouge quand ils pèsent. */
function Comfort({ fx }: { fx: Record<StatKey, number> }) {
  const { t, i18n } = useTranslation();
  const entries = (['health', 'happiness'] as const).filter((k) => fx[k]);
  return (
    <>
      {entries.map((k) => (
        <span className={`req ${fx[k] > 0 ? 'ok' : 'no'}`} key={k}>
          {t(`schedule.effect.${k}`, { delta: formatSigned(fx[k], i18n.language) })}
        </span>
      ))}
    </>
  );
}

/** Contenu de la carte « Logement » : logement actuel, puis annonces à louer ou à acheter. */
export function HousingCard({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const [tab, setTab] = useState<Tab>('rent');
  const [filter, setFilter] = useState<Filter>('all');
  const [selection, setSelection] = useState<Record<Tab, string | null>>({ rent: null, buy: null, own: null });
  const { home } = game;
  const type = housingTypeById(home.typeId);

  const select = (id: string) => setSelection((s) => ({ ...s, [tab]: s[tab] === id ? null : id }));

  return (
    <div className="career">
      <section className="cur-job">
        <small>{t('estate.current')}</small>
        <strong>{t(`housing.${home.typeId}`)}</strong>
        <span className="muted small">📍 {t(`estate.area.${home.area}`)} • {t('estate.m2', { n: type.surface })}</span>
        {home.tenure === 'rent' ? (
          <span className="muted small">{t('estate.tenant', { amount: formatMoney(home.rent, lng) })}</span>
        ) : (
          <>
            <span className="muted small">{t('estate.owner', { value: formatMoney(home.value, lng) })}</span>
            <span className="muted small">{t('estate.ownerCharges', { amount: formatMoney(home.charges, lng) })}</span>
            <span className="muted small">
              {home.loan
                ? t('estate.loanLine', {
                  monthly: formatMoney(home.loan.monthly, lng), balance: formatMoney(home.loan.balance, lng), months: home.loan.monthsLeft,
                })
                : t('estate.noLoan')}
            </span>
          </>
        )}
        <div className="reqs">
          <Comfort fx={housingEffects(game)} />
          {home.commute > 0 && (
            <span className="req no">{t('estate.extraCommute', { hours: home.commute })}</span>
          )}
          <span className="req">{t('estate.parkingUsed', { used: game.vehicles.length, count: parkingOf(home.typeId, home.area) })}</span>
        </div>
      </section>

      <nav className="career-nav" style={{ '--tabs': TABS.length } as CSSProperties} aria-label={t('windows.housing')}>
        {TABS.map((id) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`estate.tabs.${id}`)}{id === 'own' && game.properties.length > 0 ? ` (${game.properties.length})` : ''}
          </button>
        ))}
      </nav>

      <div className="career-pane" key={tab}>
        {tab === 'own'
          ? <Properties game={game} selected={selection.own} onSelect={select} />
          : <Market game={game} tab={tab} filter={filter} onFilter={setFilter} selected={selection[tab]} onSelect={select} />}
      </div>
    </div>
  );
}

interface MarketProps {
  game: GameState;
  tab: Tab;
  filter: Filter;
  onFilter: (f: Filter) => void;
  selected: string | null;
  onSelect: (id: string) => void;
}

/** Annonces d'un onglet : filtre par type de bien, liste de tuiles à gauche et détail à droite. */
function Market({ game, tab, filter, onFilter, selected, onSelect }: MarketProps) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const rent = tab === 'rent';
  const perMonth = scheduleEffects(game.schedule).searchListings;
  const ofTab = game.listings.filter((l) => (l.tenure === 'rent') === rent);
  const shown = ofTab.filter((l) => filter === 'all' || housingTypeById(l.typeId).kind === filter);
  const picked = shown.find((l) => l.id === selected);

  return (
    <section>
      <p className="muted small">{t(rent ? 'estate.rentHint' : 'estate.buyHint')}</p>
      <div className="offers-meta">
        <span>{t('estate.listingsCount', { count: game.listings.length, max: LISTINGS_MAX })}</span>
        <span className={perMonth > 0 ? 'good' : 'muted'}>{t('estate.searchRate', { count: perMonth })}</span>
      </div>
      <div className="kind-filter" role="group">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => onFilter(f)}>
            {t(`estate.kind.${f}`)}
          </button>
        ))}
      </div>
      {game.listings.length === 0 && <p className="muted small">{t('estate.noListings')}</p>}
      {game.listings.length > 0 && shown.length === 0 && <p className="muted small">{t('estate.noMatch')}</p>}
      <Split
        title={t(`estate.select.${tab}`)}
        detail={picked ? (rent ? <RentDetail key={picked.id} game={game} l={picked} /> : <BuyDetail key={picked.id} game={game} l={picked} />) : null}
        list={
          <div className="card-grid">
            {shown.map((l, i) => {
              const type = housingTypeById(l.typeId);
              const isTarget = l.id === game.housingTarget;
              const affordable = !rent || rentQuote(game, l).affordable;
              return (
                <Tile
                  key={l.id}
                  rarity={type.grade}
                  index={i}
                  selected={selected === l.id}
                  state={isTarget ? 'target' : affordable ? undefined : 'locked'}
                  onSelect={() => onSelect(l.id)}
                >
                  <span className="ctile-company">📍 {t(`estate.area.${l.area}`)}</span>
                  <span className="ctile-name">{t(`housing.${l.typeId}`)}</span>
                  <span className="ctile-meta">
                    {rent ? t('career.perMonth', { amount: formatMoney(l.price, lng) }) : formatMoney(l.price, lng)} • {t('estate.m2', { n: type.surface })}
                  </span>
                  <span className={`ctile-meta${l.monthsLeft <= 1 ? ' warn' : ''}`}>{t('career.expiresIn', { count: l.monthsLeft })}</span>
                  {rent && (affordable
                    ? <ChanceBar chance={rentChance(game, l)} label={t('estate.chance')} />
                    : <span className="ctile-meta">🔒 {t('career.status.locked')}</span>)}
                  {isTarget && <span className="status-badge current">{t('estate.applied')}</span>}
                </Tile>
              );
            })}
          </div>
        }
      />
    </section>
  );
}

/** Si le joueur est propriétaire de son logement : que devient-il quand il déménage ? (vente directe, location ou vide). */
function LeavePick({ game, value, onChange }: { game: GameState; value: LeaveAction; onChange: (v: LeaveAction) => void }) {
  const { t, i18n } = useTranslation();
  if (game.home.tenure !== 'own') return null;
  const note = value === 'sell' ? t('estate.leave.sellNote', { net: formatMoney(saleNet(game), i18n.language) }) : t(`estate.leave.${value}Note`);
  return (
    <div className="chance-box">
      <Seg
        label={t('estate.leave.label')}
        value={value}
        options={(['sell', 'rent', 'vacant'] as const).map((v) => ({ value: v, label: t(`estate.leave.${v}`) }))}
        onChange={onChange}
      />
      <span className="job-meta">{note}</span>
    </div>
  );
}

/** Places de parking d'un bien, et avertissement si les véhicules du joueur n'y tiendraient pas tous. */
function Parking({ game, typeId, area }: { game: GameState; typeId: string; area: HousingListing['area'] }) {
  const { t } = useTranslation();
  const overflow = parkingOverflow(game, typeId, area);
  return (
    <>
      <span className="req">{t('estate.parking', { count: parkingOf(typeId, area) })}</span>
      {overflow > 0 && <span className="req no">{t('estate.parkingOverflow', { count: overflow })}</span>}
    </>
  );
}

/** Ce que l'annonce change au quotidien : confort, trajet et parking. */
function Perks({ game, l }: { game: GameState; l: HousingListing }) {
  const { t } = useTranslation();
  const commute = l.commute;
  return (
    <div className="reqs">
      <Comfort fx={comfortOf(l.typeId, l.area)} />
      {commute > 0 && <span className="req no">{t('estate.extraCommute', { hours: commute })}</span>}
      <Parking game={game} typeId={l.typeId} area={l.area} />
    </div>
  );
}

const bonusLabel = (t: (k: string, o?: Record<string, unknown>) => string, b: RentBonus, lng: string): string => {
  if (b.type === 'income') return t('estate.chanceDetail.income', { ratio: new Intl.NumberFormat(lng, { maximumFractionDigits: 1 }).format(b.ratio) });
  return t(`estate.chanceDetail.${b.type}`);
};

function RentDetail({ game, l }: { game: GameState; l: HousingListing }) {
  const { t, i18n } = useTranslation();
  const { setHousingTarget } = useStore();
  const lng = i18n.language;
  const type = housingTypeById(l.typeId);
  const isTarget = l.id === game.housingTarget;
  const [leave, setLeave] = useState<LeaveAction>(game.housingLeave);
  const chosen = isTarget ? game.housingLeave : leave;
  const q = rentQuote(game, l, chosen);
  const b = rentBreakdown(game, l);
  const pct = (n: number) => `${Math.round(n * 100)} %`;
  const commute = l.commute;
  const rows: [string, ReactNode][] = [
    [t('estate.fact.rent'), t('career.perMonth', { amount: formatMoney(l.price, lng) })],
    [t('estate.fact.surface'), t('estate.m2', { n: type.surface })],
    [t('estate.fact.commute'), commute > 0 ? t('schedule.perWeek', { hours: commute }) : t('estate.fact.none')],
    [t('estate.fact.deposit'), formatMoney(q.deposit, lng)],
    [t('estate.fact.fees'), formatMoney(q.fees, lng)],
    [t('estate.fact.moving'), formatMoney(q.moving, lng)],
    [t('estate.fact.upfront'), formatMoney(q.upfront, lng)],
  ];
  if (q.credit !== 0) rows.push([t('estate.fact.credit'), formatMoney(q.credit, lng)]);
  rows.push([t('career.fact.expires'), t('career.expiresIn', { count: l.monthsLeft })]);

  return (
    <div className="detail" data-rarity={type.grade}>
      <DetailHead rarity={type.grade as Rarity} title={t(`housing.${l.typeId}`)} source={`📍 ${t(`estate.area.${l.area}`)}`} />
      <Facts rows={rows} />
      <Perks game={game} l={l} />

      <div className="chance-box">
        <h4>{t('estate.chanceDetail.title')}</h4>
        <ul className="chance-list">
          <li><span>{t('estate.chanceDetail.base', { grade: type.grade })}</span><b>{pct(b.base)}</b></li>
          {b.bonuses.map((x) => (
            <li className={x.value > 0 ? 'plus' : 'minus'} key={x.type}>
              <span>{bonusLabel(t, x, lng)}</span>
              <b>{x.value > 0 ? '+' : '−'}{pct(Math.abs(x.value))}</b>
            </li>
          ))}
          <li className="total"><span>{t('estate.chance')}</span><b>{pct(b.total)}</b></li>
        </ul>
        <ChanceBar chance={b.total} label={t('estate.chance')} big />
      </div>

      {!isTarget && <LeavePick game={game} value={leave} onChange={setLeave} />}
      {isTarget ? (
        <>
          <span className="job-meta target-note">{t('estate.applyNote')}</span>
          <button className="big-btn secondary" onClick={() => setHousingTarget(null)}>{t('estate.cancel')}</button>
        </>
      ) : q.affordable ? (
        <button className="big-btn" onClick={() => setHousingTarget(l.id, chosen)}>{t('estate.apply')}</button>
      ) : (
        <span className="job-meta warn">{t('estate.tooPoor', { amount: formatMoney(q.upfront - game.money - q.credit, lng) })}</span>
      )}
    </div>
  );
}

function BuyDetail({ game, l }: { game: GameState; l: HousingListing }) {
  const { t, i18n } = useTranslation();
  const { buyHome } = useStore();
  const lng = i18n.language;
  const [down, setDown] = useState(0.2);
  const [years, setYears] = useState(20);
  const [live, setLive] = useState<'live' | 'invest'>('live');
  const [leave, setLeave] = useState<LeaveAction>('sell');
  const type = housingTypeById(l.typeId);
  const moves = live === 'live';
  const q = buyQuote(game, l, down, years, moves, leave);
  const commute = l.commute;
  const cash = down === 1;

  const rows: [string, ReactNode][] = [
    [t('estate.fact.price'), formatMoney(l.price, lng)],
    [t('estate.fact.surface'), t('estate.m2', { n: type.surface })],
    [t('estate.fact.commute'), commute > 0 ? t('schedule.perWeek', { hours: commute }) : t('estate.fact.none')],
    [t('estate.fact.notary'), formatMoney(q.notary, lng)],
    [t('estate.fact.charges'), t('career.perMonth', { amount: formatMoney(q.charges, lng) })],
    [t('career.fact.expires'), t('career.expiresIn', { count: l.monthsLeft })],
  ];
  const finance: [string, ReactNode][] = [[t('estate.fact.down'), formatMoney(q.down, lng)]];
  if (!cash) {
    finance.push(
      [t('estate.fact.loan'), formatMoney(q.loan, lng)],
      [t('estate.fact.rate'), formatPercent(q.rate, lng)],
      [t('estate.fact.monthly'), t('career.perMonth', { amount: formatMoney(q.monthly, lng) })],
      [
        t('estate.fact.debt'),
        <span className={q.reason === 'debt' || q.reason === 'job' ? 'bad' : ''} key="debt">
          {Number.isFinite(q.debtRatio) ? `${formatPercent(q.debtRatio, lng)} / ${formatPercent(OWNING.debtCap, lng)}` : '—'}
        </span>,
      ],
      [t('estate.fact.interest'), formatMoney(q.interest, lng)],
    );
  }
  finance.push([t('estate.fact.signing'), formatMoney(q.upfront, lng)]);
  if (q.credit !== 0) finance.push([t('estate.fact.credit'), formatMoney(q.credit, lng)]);

  return (
    <div className="detail" data-rarity={type.grade}>
      <DetailHead rarity={type.grade as Rarity} title={t(`housing.${l.typeId}`)} source={`📍 ${t(`estate.area.${l.area}`)}`} />
      <Facts rows={rows} />
      <Perks game={game} l={l} />

      <div className="chance-box">
        <Seg
          label={t('estate.live.label')}
          value={live}
          options={(['live', 'invest'] as const).map((v) => ({ value: v, label: t(`estate.live.${v}`) }))}
          onChange={setLive}
        />
        {!moves && <span className="job-meta">{t('estate.investNote')}</span>}
        <Seg
          label={t('estate.buy.down')}
          value={down}
          options={OWNING.downChoices.map((v) => ({ value: v, label: v === 1 ? t('estate.buy.cash') : `${Math.round(v * 100)} %` }))}
          onChange={setDown}
        />
        {!cash && (
          <Seg
            label={t('estate.buy.term')}
            value={years}
            options={OWNING.terms.map((v) => ({ value: v, label: t('estate.buy.years', { count: v }) }))}
            onChange={setYears}
          />
        )}
        <Facts rows={finance} />
      </div>

      {moves && <LeavePick game={game} value={leave} onChange={setLeave} />}
      {q.reason && (
        <span className="job-meta warn">
          {t(`estate.buy.reason.${q.reason}`, { amount: formatMoney(q.upfront - game.money - q.credit, lng) })}
        </span>
      )}
      <button className="big-btn" disabled={q.reason !== null} onClick={() => buyHome(l.id, down, years, moves, leave)}>
        {t('estate.buy.confirm')}
      </button>
    </div>
  );
}

/** « Mes biens » : les biens possédés où l'on n'habite pas, avec leur statut et les actions possibles. */
function Properties({ game, selected, onSelect }: { game: GameState; selected: string | null; onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const picked = game.properties.find((p) => p.id === selected);
  return (
    <section>
      <p className="muted small">{t('estate.own.hint')}</p>
      {game.properties.length === 0 && <p className="muted small">{t('estate.own.empty')}</p>}
      <Split
        title={t('estate.own.select')}
        detail={picked ? <PropertyDetail key={picked.id} game={game} p={picked} /> : null}
        list={
          <div className="card-grid">
            {game.properties.map((p, i) => {
              const type = housingTypeById(p.typeId);
              return (
                <Tile key={p.id} rarity={type.grade} index={i} selected={selected === p.id} onSelect={() => onSelect(p.id)}>
                  <span className="ctile-company">📍 {t(`estate.area.${p.area}`)}</span>
                  <span className="ctile-name">{t(`housing.${p.typeId}`)}</span>
                  <span className="ctile-meta">{formatMoney(p.value, lng)} • {t('estate.m2', { n: type.surface })}</span>
                  {p.status === 'selling' && <span className="ctile-meta">{formatMoney(p.ask, lng)}</span>}
                  {(p.status === 'letting' || p.status === 'rented') && (
                    <span className="ctile-meta">{t('career.perMonth', { amount: formatMoney(p.rent, lng) })}</span>
                  )}
                  <span className={`status-badge${p.status === 'rented' ? ' current' : ''}`}>{t(`estate.own.status.${p.status}`)}</span>
                </Tile>
              );
            })}
          </div>
        }
      />
    </section>
  );
}

function PropertyDetail({ game, p }: { game: GameState; p: Property }) {
  const { t, i18n } = useTranslation();
  const { letProperty, sellProperty, withdrawProperty, moveToProperty } = useStore();
  const lng = i18n.language;
  const type = housingTypeById(p.typeId);
  const market = marketRent(p.typeId, p.area);
  const [rentFactor, setRentFactor] = useState(p.status === 'letting' ? Math.round((p.rent / market) * 100) / 100 : 1);
  const [priceFactor, setPriceFactor] = useState(1);
  const [leave, setLeave] = useState<LeaveAction>('sell');

  const wantedRent = Math.round((market * rentFactor) / 5) * 5;
  const wantedAsk = Math.round((p.value * priceFactor) / 500) * 500;
  const letChance = lettingChance({ ...p, rent: wantedRent });
  const sellChance = sellingChance({ ...p, ask: wantedAsk });
  const free = p.status !== 'rented';
  const moveCost = MOVING_COST - moveCredit(game, leave);
  const canMove = game.money - moveCost >= 0;
  const commute = p.commute;

  const rows: [string, ReactNode][] = [
    [t('estate.own.fact.status'), t(`estate.own.status.${p.status}`)],
    [t('estate.own.fact.value'), formatMoney(p.value, lng)],
    [t('estate.own.fact.loanLeft'), p.loan ? formatMoney(p.loan.balance, lng) : t('estate.noLoan')],
    [t('estate.fact.charges'), t('career.perMonth', { amount: formatMoney(p.charges + (p.loan?.monthly ?? 0), lng) })],
    [t('estate.own.fact.marketRent'), t('career.perMonth', { amount: formatMoney(market, lng) })],
  ];
  if (p.status === 'rented') rows.push([t('estate.own.fact.income'), t('career.perMonth', { amount: formatMoney(p.rent, lng) })]);
  if (p.status === 'letting') rows.push([t('estate.own.fact.rent'), t('career.perMonth', { amount: formatMoney(p.rent, lng) })]);
  if (p.status === 'selling') {
    rows.push(
      [t('estate.own.fact.ask'), formatMoney(p.ask, lng)],
      [t('estate.own.fact.net'), formatMoney(propertyProceeds(p), lng)],
    );
  }

  return (
    <div className="detail" data-rarity={type.grade}>
      <DetailHead rarity={type.grade as Rarity} title={t(`housing.${p.typeId}`)} source={`📍 ${t(`estate.area.${p.area}`)}`} />
      <Facts rows={rows} />
      <div className="reqs">
        <Comfort fx={comfortOf(p.typeId, p.area)} />
        {commute > 0 && <span className="req no">{t('estate.extraCommute', { hours: commute })}</span>}
        <Parking game={game} typeId={p.typeId} area={p.area} />
      </div>

      {p.status === 'rented' && <span className="job-meta">{t('estate.own.rentedNote')}</span>}
      {p.status === 'selling' && <span className="job-meta">{t('estate.own.sellingNote')}</span>}

      {free && (
        <div className="chance-box">
          <PercentPick label={t('estate.own.rentLabel')} value={rentFactor} min={LETTING.rentRange[0]} max={LETTING.rentRange[1]} onChange={setRentFactor} />
          <Facts rows={[[t('estate.own.fact.rent'), t('career.perMonth', { amount: formatMoney(wantedRent, lng) })]]} />
          <span className="job-meta">{t('estate.own.letChance')}</span>
          <ChanceBar chance={letChance} label={t('estate.own.letChance')} big />
          <button className="big-btn" onClick={() => letProperty(p.id, rentFactor)}>
            {t(p.status === 'letting' ? 'estate.own.updateRent' : 'estate.own.let')}
          </button>
        </div>
      )}

      <div className="chance-box">
        <PercentPick label={t('estate.own.priceLabel')} value={priceFactor} min={SELLING.priceRange[0]} max={SELLING.priceRange[1]} onChange={setPriceFactor} />
        <Facts rows={[
          [t('estate.own.fact.ask'), formatMoney(wantedAsk, lng)],
          [t('estate.own.fact.net'), formatMoney(propertyProceeds(p, wantedAsk), lng)],
        ]} />
        <span className="job-meta">{t('estate.own.sellChance')}</span>
        <ChanceBar chance={sellChance} label={t('estate.own.sellChance')} big />
        <button className="big-btn" onClick={() => sellProperty(p.id, priceFactor)}>
          {t(p.status === 'selling' ? 'estate.own.updateAsk' : 'estate.own.sell')}
        </button>
      </div>

      {(p.status === 'letting' || p.status === 'selling') && (
        <button className="big-btn secondary" onClick={() => withdrawProperty(p.id)}>{t('estate.own.withdraw')}</button>
      )}

      {free && (
        <div className="chance-box">
          <LeavePick game={game} value={leave} onChange={setLeave} />
          <span className="job-meta">{t('estate.own.moveInCost', { amount: formatMoney(Math.max(0, moveCost), lng) })}</span>
          <button className="big-btn" disabled={!canMove} onClick={() => moveToProperty(p.id, leave)}>{t('estate.own.moveIn')}</button>
        </div>
      )}
    </div>
  );
}
