'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/primitives';
import { formatDuration, parseDuration } from '@/lib/format';
import type { Database } from '@/lib/supabase/database.types';
import { TEAM_IDS } from '@/lib/types';
import { confirmRosterDetails } from './actions';

type RosterRow = Database['public']['Tables']['roster']['Row'];

const KM_OPTIONS = [0, 1, 2] as const;
const OTHER_UNIT = 'אחר';

export default function OnboardingForm({
  roster,
  isSingletonUnit,
  allUnits,
}: {
  roster: RosterRow;
  isSingletonUnit: boolean;
  allUnits: string[];
}) {
  const [name, setName] = useState(`${roster.first_name} ${roster.last_name}`.trim());
  const [gender, setGender] = useState<'ז' | 'נ' | ''>(roster.gender === 'ז' || roster.gender === 'נ' ? roster.gender : '');
  const [team, setTeam] = useState<number | ''>(roster.team ?? '');
  const [unitChoice, setUnitChoice] = useState(allUnits.includes(roster.unit) ? roster.unit : OTHER_UNIT);
  const [customUnit, setCustomUnit] = useState(allUnits.includes(roster.unit) ? '' : roster.unit);
  const [runTime, setRunTime] = useState(roster.final_run_seconds != null ? formatDuration(roster.final_run_seconds) : '');
  const [pushups, setPushups] = useState(roster.pushup_achievement != null ? String(roster.pushup_achievement) : '');
  const [score, setScore] = useState(roster.final_score != null ? String(roster.final_score) : '');
  const [kmLevels, setKmLevels] = useState<Set<number>>(new Set(roster.km_levels ?? []));

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleKm = (level: number) => {
    setKmLevels((current) => {
      const next = new Set(current);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const handleConfirm = async () => {
    const unit = unitChoice === OTHER_UNIT ? customUnit.trim() : unitChoice;
    if (unitChoice === OTHER_UNIT && !unit) {
      setError('הזינו את שם היחידה.');
      return;
    }

    const finalRunSeconds = parseDuration(runTime);
    if (runTime.trim() && finalRunSeconds == null) {
      setError('פורמט זמן ריצה לא תקין — למשל 13:50.');
      return;
    }

    setPending(true);
    setError(null);
    const result = await confirmRosterDetails({
      name,
      gender,
      team: team === '' ? null : (team as (typeof TEAM_IDS)[number]),
      unit,
      finalRunSeconds,
      pushupAchievement: pushups.trim() ? Number(pushups) : null,
      finalScore: score.trim() ? Number(score) : null,
      kmLevels: [...kmLevels],
    });
    setPending(false);
    if (result && !result.ok) setError(result.error);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">בואו נוודא שהפרטים שלכם נכונים</h1>
        <p className="mt-1 text-sm text-muted">
          אלה הפרטים שנמצאו עבורכם מבוחן הכושר. אפשר לתקן כל שדה שלא נכון.
        </p>
      </div>

      <Card className="card-pad space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="field-name" className="label">
            שם
          </label>
          <input id="field-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="field-gender" className="label">
              מין
            </label>
            <select
              id="field-gender"
              className="input"
              value={gender}
              onChange={(event) => setGender(event.target.value as 'ז' | 'נ')}
            >
              <option value="" disabled>
                בחרו
              </option>
              <option value="ז">זכר</option>
              <option value="נ">נקבה</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="field-team" className="label">
              מס&apos; צוות
            </label>
            <select
              id="field-team"
              className="input tnum"
              value={team}
              onChange={(event) => setTeam(Number(event.target.value))}
            >
              <option value="" disabled>
                בחרו
              </option>
              {TEAM_IDS.map((id) => (
                <option key={id} value={id}>
                  צוות {id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="field-unit" className="label">
            יחידה
          </label>
          <select
            id="field-unit"
            className="input"
            value={unitChoice}
            onChange={(event) => setUnitChoice(event.target.value)}
          >
            {allUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
            <option value={OTHER_UNIT}>{OTHER_UNIT}</option>
          </select>
          {unitChoice === OTHER_UNIT ? (
            <input
              className="input mt-1.5"
              placeholder="שם היחידה"
              value={customUnit}
              onChange={(event) => setCustomUnit(event.target.value)}
            />
          ) : null}
          {isSingletonUnit ? (
            <p className="text-xs text-muted">
              אתם היחידים מ״{roster.unit}״ בבוחן — אפשר להישאר, או להצטרף לקבוצת התחרות של יחידה אחרת.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="field-run" className="label">
              זמן ריצה
            </label>
            {roster.final_run_seconds != null ? (
              <p id="field-run" className="input tnum flex items-center bg-elevated text-muted">
                {runTime}
              </p>
            ) : (
              <>
                <input
                  id="field-run"
                  className="input tnum"
                  placeholder="13:50 (אופציונלי)"
                  value={runTime}
                  onChange={(event) => setRunTime(event.target.value)}
                />
                <p className="text-xs text-muted">אין תוצאה רשומה — אפשר להשלים, או להשאיר ריק.</p>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="field-pushups" className="label">
              הישג שכיבות סמיכה
            </label>
            {roster.pushup_achievement != null ? (
              <p id="field-pushups" className="input tnum flex items-center bg-elevated text-muted">
                {pushups}
              </p>
            ) : (
              <>
                <input
                  id="field-pushups"
                  type="number"
                  min={0}
                  placeholder="אופציונלי"
                  className="input tnum"
                  value={pushups}
                  onChange={(event) => setPushups(event.target.value)}
                />
                <p className="text-xs text-muted">אין תוצאה רשומה — אפשר להשלים, או להשאיר ריק.</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="field-score" className="label">
            ציון סופי
          </label>
          <input
            id="field-score"
            type="number"
            min={0}
            className="input tnum"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <p className="label">כמ</p>
          <div className="flex gap-4">
            {KM_OPTIONS.map((level) => (
              <label key={level} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" checked={kmLevels.has(level)} onChange={() => toggleKm(level)} />
                כמ {level}
              </label>
            ))}
          </div>
        </div>

        {roster.status_notes ? (
          <p className="rounded-xl bg-elevated px-3 py-2 text-xs text-muted">
            <span className="font-medium text-ink">סטטוס / נדרש להשלים:</span> {roster.status_notes}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary w-full justify-center"
          onClick={handleConfirm}
          disabled={pending}
        >
          {pending ? 'שומר…' : 'מאשר/ת שהפרטים נכונים'}
        </button>
      </Card>
    </div>
  );
}
