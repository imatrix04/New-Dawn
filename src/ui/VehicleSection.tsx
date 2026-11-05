import { useState, type CSSProperties, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DRIVING_STYLE_IDS, DRIVING_STYLES, FUELS, LICENSE, OFFENCES, REPAIRS, USED_MARKET, VEHICLE_IDS, VEHICLE_MODELS, WEAR } from '../data/content';
import {
  availableRepairs, banMonthsLeft, baseCommute, commuteAt, driveBlock, drivingVehicle, estimatedKm, fuelCost, fuelSpec, hasLicense, inspectionPrice,
  inspectionStatus, insuranceFor, insuranceOf, isImmobilised, isScrap, monthlyKm, parkingSpots, repairQuote, saleReady, salePrice, vehicleAgeMonths,
  vehicleById, vehicleModel, vehicleQuote, vehicleValue, weekBreakdown,
} from '../game/engine';
import type { VehicleQuote, VehicleSource } from '../game/engine';
import type { FuelType, GameState, RepairKind, Vehicle } from '../game/types';
import { formatMoney, formatNumber, formatPercent } from '../i18n/format';
import { useStore } from '../store';
import { DetailHead, Facts, Seg, Split, Tile } from './cardKit';
import type { Rarity } from './cardKit';

type Tab = 'mine' | 'new' | 'used';
const TABS: Tab[] = ['mine', 'new', 'used'];

/** Âge affiché d'un véhicule : en mois la première année, ensuite en années. */
function vehicleAge(t: TFunction, ageMonths: number): string {
  return ageMonths < 12 ? t('age.months', { count: Math.max(0, ageMonths) }) : t('age.years', { count: Math.floor(ageMonths / 12) });
}

/** Probabilité sur un an d'un événement qui a la chance `p` chaque mois. */
const perYear = (p: number): number => 1 - Math.pow(1 - p, 12);

/** Barre d'état du véhicule : l'état actuel, avec un repère à l'état maximal atteignable (l'usure permanente). */
function Condition({ condition, ceiling }: { condition: number; ceiling: number }) {
  const { t } = useTranslation();
  const hue = Math.round(Math.max(0, Math.min(100, condition)) * 1.2);
  return (
    <div className="vcond" title={t('market.vehicle.conditionHint')}>
      <div className="vmeter">
        <div className="meter"><div style={{ width: `${condition}%`, background: `hsl(${hue} 65% 52%)` }} /></div>
        <i style={{ left: `${ceiling}%` }} aria-hidden />
      </div>
      <span className="muted small">{t('market.vehicle.condition', { now: Math.round(condition), max: Math.round(ceiling) })}</span>
    </div>
  );
}

/** Contenu de la rubrique « Véhicules » : le parc du joueur (limité par ses places de parking), puis le neuf et l'occasion. */
export function VehicleSection({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const { setDrivingVehicle } = useStore();
  const [tab, setTab] = useState<Tab>('mine');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<Exclude<Tab, 'mine'>, string | null>>({ new: null, used: null });
  // Le véhicule affiché : celui choisi dans la liste, sinon celui des trajets, sinon le premier.
  const v = vehicleById(game, pickedId) ?? drivingVehicle(game) ?? game.vehicles[0] ?? null;
  const driving = drivingVehicle(game);
  const block = driveBlock(game);
  const base = baseCommute(game);
  const spots = parkingSpots(game);
  const select = (id: string) => {
    if (tab === 'mine') return;
    setSelection((s) => ({ ...s, [tab]: s[tab] === id ? null : id }));
  };

  return (
    <div className="career">
      <section className="cur-job">
        <small>{t('market.vehicle.current')}</small>
        <span className={`req ${game.vehicles.length >= spots ? 'no' : 'ok'}`}>
          {t('market.parking.count', { used: game.vehicles.length, total: spots })}
        </span>
        {game.vehicles.length > 1 && (
          <div className="pick" role="group" aria-label={t('market.parking.pick')}>
            {game.vehicles.map((x) => (
              <button key={x.id} className={x.id === v?.id ? 'on' : ''} aria-pressed={x.id === v?.id} onClick={() => setPickedId(x.id)}>
                {vehicleModel(x.modelId).icon} {t(`vehicles.${x.modelId}`)}{x.id === driving?.id ? ' •' : ''}
              </button>
            ))}
          </div>
        )}
        {v ? (
          <>
            <strong>{vehicleModel(v.modelId).icon} {t(`vehicles.${v.modelId}`)}</strong>
            <span className="muted small">
              {FUELS[v.fuel].icon} {t(`market.fuel.${v.fuel}`)} • {formatNumber(v.km, lng)} km • {vehicleAge(t, vehicleAgeMonths(game, v))}
            </span>
            <Condition condition={v.condition} ceiling={v.ceiling} />
            <div className="reqs">
              {v.id === driving?.id && base > 0 && (
                <span className="req ok">{t('market.vehicle.commuteSaved', { from: base, to: commuteAt(base, game.driver.style) })}</span>
              )}
              {v.id === driving?.id && <span className="req ok">{t('market.vehicle.inService')}</span>}
              {v.id !== driving?.id && !isImmobilised(v) && <span className="req">{t('market.vehicle.parked')}</span>}
              {block !== 'none' && <span className="req no">{t(`market.block.${block}`, { count: banMonthsLeft(game) })}</span>}
              {v.issue && <span className="req no">{t(`market.issue.${v.issue}`)}</span>}
              {v.repair && <span className="req">{t('market.vehicle.repairing', { kind: t(`market.repair.kind.${v.repair.kind}`), count: v.repair.monthsLeft })}</span>}
              {isScrap(v) && <span className="req no">{t('market.vehicle.scrap')}</span>}
            </div>
            {v.id !== driving?.id && !isImmobilised(v) && block === 'none' && (
              <button className="mini-btn" onClick={() => setDrivingVehicle(v.id)}>{t('market.vehicle.use')}</button>
            )}
          </>
        ) : (
          <>
            <strong>{t('market.vehicle.none')}</strong>
            <span className="muted small">{t('market.vehicle.noneHint')}</span>
          </>
        )}
      </section>

      <nav className="career-nav" style={{ '--tabs': TABS.length } as CSSProperties} aria-label={t('market.sections.vehicles')}>
        {TABS.map((id) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`market.tabs.${id}`)}
          </button>
        ))}
      </nav>

      <div className="career-pane" key={tab}>
        {tab === 'mine' ? <Mine game={game} v={v} /> : <Catalog game={game} kind={tab} selected={selection[tab]} onSelect={select} />}
      </div>
    </div>
  );
}

// ---------- Mes véhicules ----------

function Mine({ game, v }: { game: GameState; v: Vehicle | null }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;

  return (
    <section className="vmine">
      <DriverBox game={game} />
      {v ? <Owned key={v.id} game={game} v={v} /> : <p className="muted small">{t('market.mine.empty')}</p>}
      {!v && !hasLicense(game) && <p className="job-meta warn">{t('market.reason.license')}</p>}
      <p className="muted small">{t('market.parking.hint', { spots: parkingSpots(game) })}</p>
      <p className="muted small">{t('market.mine.hint', { price: formatMoney(FUELS.petrol.price, lng, 2), diesel: formatMoney(FUELS.diesel.price, lng, 2) })}</p>
    </section>
  );
}

/** Permis à points, bonus-malus et suspension éventuelle. */
function DriverBox({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const d = game.driver;
  const licensed = hasLicense(game);
  const ban = banMonthsLeft(game);
  const rows: [string, ReactNode][] = [
    [t('market.driver.license'), licensed ? t('market.driver.points', { points: d.points, max: LICENSE.points }) : t('market.driver.noLicense')],
    [t('market.driver.crm'), new Intl.NumberFormat(lng, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(d.crm)],
  ];
  if (ban > 0) rows.push([t('market.driver.ban'), t('market.driver.banMonths', { count: ban })]);
  return (
    <div className="chance-box">
      <h4>{t('market.driver.title')}</h4>
      <Facts rows={rows} />
      {d.points < LICENSE.points && d.lastOffense !== null && (
        <span className="job-meta">{t('market.driver.recovery', { count: Math.max(0, d.lastOffense + LICENSE.recoveryMonths - game.month) })}</span>
      )}
    </div>
  );
}

function Owned({ game, v }: { game: GameState; v: Vehicle }) {
  const { t, i18n } = useTranslation();
  const { setDrivingStyle, takeInspection, sellVehicle } = useStore();
  const lng = i18n.language;
  const money = (n: number) => formatMoney(n, lng);
  const spec = fuelSpec(v.modelId, v.fuel);
  const status = inspectionStatus(game, v);
  const nextService = v.lastServiceKm + WEAR.serviceEveryKm - v.km;
  const sale = salePrice(game, v);
  const ready = saleReady(game, v);
  const inspectionCost = inspectionPrice(game, v);
  const base = baseCommute(game);
  const repairs = availableRepairs(v);
  // Seul le véhicule des trajets roule : les autres, garés, ne consomment ni ne s'usent (mais restent assurés).
  const isDriving = drivingVehicle(game)?.id === v.id;

  const rows: [string, ReactNode][] = [
    [t('market.fact.value'), money(vehicleValue(game, v))],
    [t('market.fact.consumption'), t('market.fact.l100', { n: new Intl.NumberFormat(lng, { maximumFractionDigits: 1 }).format(spec.l100) })],
    [t('market.fact.kmMonth'), isDriving ? `${formatNumber(monthlyKm(game), lng)} km` : '—'],
    [t('market.fact.fuelMonth'), isDriving ? t('career.perMonth', { amount: money(fuelCost(game)) }) : '—'],
    [t('market.fact.insurance'), t('career.perMonth', { amount: money(insuranceOf(game, v)) })],
    [t('market.fact.service'), nextService > 0 ? t('market.fact.serviceIn', { km: formatNumber(nextService, lng) }) : <span className="bad" key="svc">{t('market.fact.serviceLate')}</span>],
    [t('market.fact.inspection'), <span className={status === 'overdue' ? 'bad' : ''} key="ct">{t(`market.inspection.${status}`)}</span>],
  ];

  return (
    <>
      <Facts rows={rows} />

      <div className="chance-box">
        <h4>{t('market.style.title')}</h4>
        <Seg
          label={t('market.style.label')}
          value={game.driver.style}
          options={DRIVING_STYLE_IDS.map((id) => ({ value: id, label: `${DRIVING_STYLES[id].icon} ${t(`market.style.${id}.name`)}` }))}
          onChange={setDrivingStyle}
        />
        <span className="job-meta">{t(`market.style.${game.driver.style}.desc`)}</span>
        <table className="vstyles">
          <thead>
            <tr>
              <th>{t('market.style.label')}</th>
              <th>{t('market.style.commute')}</th>
              <th>{t('market.style.fuel')}</th>
              <th>{t('market.style.wear')}</th>
              <th>{t('market.style.accident')}</th>
              <th>{t('market.style.fines')}</th>
            </tr>
          </thead>
          <tbody>
            {DRIVING_STYLE_IDS.map((id) => {
              const s = DRIVING_STYLES[id];
              const fines = id === 'fast' || id === 'reckless';
              return (
                <tr key={id} className={game.driver.style === id ? 'on' : ''}>
                  <td>{s.icon} {t(`market.style.${id}.name`)}</td>
                  <td>{base > 0 ? t('schedule.perWeek', { hours: commuteAt(base, id) }) : '—'}</td>
                  <td>×{s.fuel}</td>
                  <td>×{s.wear}</td>
                  <td>{formatPercent(perYear(s.accident), lng)}</td>
                  <td>{fines ? formatPercent(perYear(s.offence), lng) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="job-meta">{t('market.style.note', { max: formatMoney(Math.max(...OFFENCES.reckless.map((o) => o.fine)), lng) })}</span>
      </div>

      <div className="chance-box">
        <h4>{t('market.repair.title')}</h4>
        {v.repair ? (
          <RepairProgress v={v} />
        ) : isScrap(v) ? (
          <span className="job-meta warn">{t('market.repair.scrap')}</span>
        ) : (
          repairs.map((kind) => <RepairOption key={kind} game={game} v={v} kind={kind} />)
        )}
      </div>

      <div className="chance-box">
        <h4>{t('market.inspection.title')}</h4>
        <span className="job-meta">{t('market.inspection.hint')}</span>
        <Facts rows={[
          [t('market.fact.inspection'), t(`market.inspection.${status}`)],
          [t('market.inspection.last'), v.inspection ? t('market.inspection.lastLine', { count: game.month - v.inspection.month, result: t(`market.inspection.${v.inspection.passed ? 'passed' : 'failed'}`) }) : t('market.inspection.never')],
        ]} />
        <button className="big-btn" disabled={!!v.repair || isScrap(v) || game.money < inspectionCost} onClick={() => takeInspection(v.id)}>
          {t('market.inspection.take', { amount: money(inspectionCost) })}
        </button>
      </div>

      <div className="chance-box">
        <h4>{t('market.sell.title')}</h4>
        <Facts rows={[[t('market.sell.price'), money(sale)]]} />
        {!isScrap(v) && !ready && <span className="job-meta warn">{t('market.sell.noInspection')}</span>}
        {isScrap(v) && <span className="job-meta">{t('market.sell.scrapNote')}</span>}
        <button className="big-btn secondary" onClick={() => sellVehicle(v.id)}>{t(isScrap(v) ? 'market.sell.scrap' : 'market.sell.confirm', { amount: money(sale) })}</button>
      </div>
    </>
  );
}

function RepairProgress({ v }: { v: Vehicle }) {
  const { t } = useTranslation();
  const job = v.repair!;
  return (
    <>
      <span className="job-meta">
        {t(job.diy ? 'market.repair.progressDiy' : 'market.repair.progressGarage', { kind: t(`market.repair.kind.${job.kind}`), count: job.monthsLeft })}
      </span>
      {job.kind !== 'service' && <span className="job-meta warn">{t('market.repair.immobilised')}</span>}
    </>
  );
}

/** Une intervention possible : entretien ou réparation de la panne en cours, au garage ou soi-même. */
function RepairOption({ game, v, kind }: { game: GameState; v: Vehicle; kind: RepairKind }) {
  const { t, i18n } = useTranslation();
  const { startRepair } = useStore();
  const lng = i18n.language;
  const money = (n: number) => formatMoney(n, lng);
  const garage = repairQuote(game, v, kind, false);
  const diy = repairQuote(game, v, kind, true);
  const free = weekBreakdown(game).free;

  return (
    <div className="repair">
      <strong>{t(`market.repair.kind.${kind}`)}</strong>
      <span className="job-meta">{t(`market.repair.desc.${kind}`)}</span>
      <span className="job-meta">{t('market.repair.effect', { restore: REPAIRS[kind].restore, loss: REPAIRS[kind].ceilingLoss, after: Math.round(garage.ceilingAfter) })}</span>

      <div className="repair-opts">
        <div>
          <button className="big-btn" disabled={garage.blocked !== null} onClick={() => startRepair(v.id, kind, false)}>
            {t('market.repair.garage', { amount: money(garage.cost) })}
          </button>
          <span className="job-meta">{garage.months === 0 ? t('market.repair.instant') : t('market.repair.garageTime', { count: garage.months })}</span>
          {garage.blocked && <span className="job-meta warn">{t(`market.repair.blocked.${garage.blocked}`, { amount: money(garage.cost - game.money) })}</span>}
        </div>
        <div>
          <button className="big-btn secondary" disabled={diy.blocked !== null} onClick={() => startRepair(v.id, kind, true)}>
            {t('market.repair.diy', { amount: money(diy.cost) })}
          </button>
          <span className="job-meta">{t('market.repair.diyTime', { count: diy.months, hours: diy.hours })}</span>
          {diy.blocked ? (
            <span className="job-meta warn">
              {t(`market.repair.blocked.${diy.blocked}`, { amount: money(diy.cost - game.money), need: diy.minSkill, have: Math.floor(game.skills.mechanics) })}
            </span>
          ) : free < diy.hours ? (
            <span className="job-meta warn">{t('market.repair.freeHours', { hours: diy.hours })}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Neuf et occasion ----------

interface CatalogProps {
  game: GameState;
  kind: 'new' | 'used';
  selected: string | null;
  onSelect: (id: string) => void;
}

interface Entry {
  key: string;
  source: VehicleSource;
  modelId: string;
  fuel: FuelType;
}

function entriesOf(game: GameState, kind: 'new' | 'used'): Entry[] {
  if (kind === 'used') {
    return game.vehicleListings.map((l) => ({ key: l.id, source: { type: 'used', id: l.id }, modelId: l.modelId, fuel: l.fuel }));
  }
  return VEHICLE_IDS.flatMap((modelId) => (Object.keys(VEHICLE_MODELS[modelId].fuels) as FuelType[]).map((fuel) => ({
    key: `${modelId}:${fuel}`, source: { type: 'new', modelId, fuel } as VehicleSource, modelId, fuel,
  })));
}

function Catalog({ game, kind, selected, onSelect }: CatalogProps) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;
  const entries = entriesOf(game, kind);
  const picked = entries.find((e) => e.key === selected);

  return (
    <section>
      <p className="muted small">{t(kind === 'new' ? 'market.newHint' : 'market.usedHint')}</p>
      {kind === 'used' && (
        <div className="offers-meta">
          <span>{t('market.usedCount', { count: game.vehicleListings.length, max: USED_MARKET.max })}</span>
        </div>
      )}
      {entries.length === 0 && <p className="muted small">{t('market.noUsed')}</p>}
      <Split
        title={t(`market.select.${kind}`)}
        detail={picked ? <BuyDetail key={picked.key} game={game} entry={picked} /> : null}
        list={
          <div className="card-grid">
            {entries.map((e, i) => {
              const model = vehicleModel(e.modelId);
              const quote = vehicleQuote(game, e.source);
              if (!quote) return null;
              const listing = kind === 'used' ? game.vehicleListings.find((l) => l.id === e.key) : undefined;
              return (
                <Tile
                  key={e.key}
                  rarity={model.grade}
                  index={i}
                  selected={selected === e.key}
                  state={quote.reason ? 'locked' : undefined}
                  onSelect={() => onSelect(e.key)}
                >
                  <span className="ctile-company">{FUELS[e.fuel].icon} {t(`market.fuel.${e.fuel}`)}</span>
                  <span className="ctile-name">{model.icon} {t(`vehicles.${e.modelId}`)}</span>
                  <span className="ctile-meta">{formatMoney(quote.total, lng)} {t('market.allIn')}</span>
                  {listing ? (
                    <>
                      <span className="ctile-meta">{formatNumber(listing.km, lng)} km • {vehicleAge(t, game.month - listing.registeredMonth)}</span>
                      <span className={`ctile-meta${listing.monthsLeft <= 1 ? ' warn' : ''}`}>{t('career.expiresIn', { count: listing.monthsLeft })}</span>
                    </>
                  ) : (
                    <span className="ctile-meta">{t('market.fact.hpShort', { hp: model.hp })} • {quote.co2} g/km</span>
                  )}
                  {quote.reason && <span className="ctile-meta">🔒 {t('career.status.locked')}</span>}
                </Tile>
              );
            })}
          </div>
        }
      />
    </section>
  );
}

function BuyDetail({ game, entry }: { game: GameState; entry: Entry }) {
  const { t, i18n } = useTranslation();
  const { buyVehicle } = useStore();
  const lng = i18n.language;
  const money = (n: number) => formatMoney(n, lng);
  const quote = vehicleQuote(game, entry.source) as VehicleQuote;
  const model = vehicleModel(entry.modelId);
  const spec = fuelSpec(entry.modelId, entry.fuel);
  const source = entry.source;
  const listing = source.type === 'used' ? game.vehicleListings.find((l) => l.id === source.id) : undefined;
  const ageMonths = listing ? game.month - listing.registeredMonth : 0;
  const years = Math.floor(ageMonths / 12);

  // Budget mensuel pour l'usage actuel du joueur, en conduite normale.
  const km = estimatedKm(game);
  const fuel = Math.round((km / 100) * spec.l100 * FUELS[entry.fuel].price);
  const insurance = insuranceFor(game, entry.modelId, years);
  const base = baseCommute(game);

  const rows: [string, ReactNode][] = [[t('market.fact.price'), money(quote.price)]];
  if (!quote.used) rows.push([t('market.fact.fees'), money(quote.fees)]);
  rows.push([t(years >= 10 ? 'market.fact.registrationOld' : 'market.fact.registration', { hp: model.hp }), money(quote.registration)]);
  if (!quote.used) {
    rows.push([t('market.fact.malusCo2', { co2: quote.co2 }), quote.malusCo2 > 0 ? money(quote.malusCo2) : t('market.fact.none')]);
    if (quote.malusWeight > 0) rows.push([t('market.fact.malusWeight', { kg: model.weight }), money(quote.malusWeight)]);
  }
  rows.push([t('market.fact.total'), <b key="total">{money(quote.total)}</b>]);

  const specs: [string, ReactNode][] = [];
  if (listing) {
    specs.push(
      [t('market.fact.km'), `${formatNumber(listing.km, lng)} km`],
      [t('market.fact.age'), vehicleAge(t, ageMonths)],
    );
  }
  specs.push(
    [t('market.fact.power'), t('market.fact.hp', { hp: model.hp })],
    [t('market.fact.weight'), `${formatNumber(model.weight, lng)} kg`],
    [t('market.fact.co2'), `${spec.co2} g/km`],
    [t('market.fact.consumption'), t('market.fact.l100', { n: new Intl.NumberFormat(lng, { maximumFractionDigits: 1 }).format(spec.l100) })],
    [t('market.fact.insurance'), t('career.perMonth', { amount: money(insurance) })],
    [t('market.fact.fuelMonth'), t('career.perMonth', { amount: money(fuel) })],
  );
  if (base > 0) specs.push([t('market.fact.commute'), t('market.fact.commuteLine', { from: base, to: commuteAt(base, 'normal') })]);
  if (listing) specs.push([t('career.fact.expires'), t('career.expiresIn', { count: listing.monthsLeft })]);

  return (
    <div className="detail" data-rarity={model.grade}>
      <DetailHead
        rarity={model.grade as Rarity}
        title={`${model.icon} ${t(`vehicles.${entry.modelId}`)}`}
        source={`${FUELS[entry.fuel].icon} ${t(`market.fuel.${entry.fuel}`)}`}
        subtitle={t(quote.used ? 'market.usedBy' : 'market.newBy')}
      />
      {listing && <Condition condition={listing.condition} ceiling={listing.ceiling} />}
      <Facts rows={rows} />
      <div className="chance-box">
        <h4>{t('market.fact.specs')}</h4>
        <Facts rows={specs} />
      </div>
      {quote.reason && (
        <span className="job-meta warn">
          {t(`market.reason.${quote.reason}`, { amount: money(quote.total - game.money), spots: parkingSpots(game) })}
        </span>
      )}
      <button className="big-btn" disabled={quote.reason !== null} onClick={() => buyVehicle(entry.source)}>
        {t('market.buy')}
      </button>
    </div>
  );
}
