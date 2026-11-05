import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LogEntry } from '../game/types';
import { formatLogEntry } from '../i18n/format';

/** Les entrées `month` ouvrent un nouveau groupe ; celles qui précèdent le premier en-tête forment un groupe sans titre. */
function groupByMonth(log: LogEntry[]): { head?: LogEntry; items: LogEntry[] }[] {
  const groups: { head?: LogEntry; items: LogEntry[] }[] = [];
  for (const e of log) {
    if (e.cls === 'month') groups.push({ head: e, items: [] });
    else if (groups.length) groups[groups.length - 1].items.push(e);
    else groups.push({ items: [e] });
  }
  return groups;
}

export function LogPanel({ log }: { log: LogEntry[] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  const groups = groupByMonth(log.slice(-40));

  return (
    <div className="log" ref={ref}>
      {groups.map((g, gi) => (
        <section className={`log-group${gi === groups.length - 1 ? ' current' : ''}`} key={gi}>
          {g.head && <h4 className="log-month">{formatLogEntry(t, g.head)}</h4>}
          {g.items.map((e, i) => (
            <p key={i} className={`log-entry ${e.cls}`}>{formatLogEntry(t, e)}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
