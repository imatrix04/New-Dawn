import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LogEntry } from '../game/types';
import { formatLogEntry } from '../i18n/format';

export function LogPanel({ log }: { log: LogEntry[] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  return (
    <div className="log" ref={ref}>
      {log.slice(-40).map((e, i) => (
        <p key={i} className={e.cls}>{formatLogEntry(t, e)}</p>
      ))}
    </div>
  );
}
