import { useEffect, useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { fetchAdminUsers, fetchAttendanceLogs } from '../lib/api';
import { useTenantContext } from '../providers/TenantContext';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import type { SchoolUserRole } from '../types/admin';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ADMITTED_COLOR = '#166534';
const DENIED_COLOR = '#9a3412';
const ROLE_LABELS: Record<SchoolUserRole, string> = {
  STUDENT: 'Students',
  STAFF: 'Staff',
  GUARDIAN: 'Guardians',
  ADMIN: 'Admins'
};
const ROLE_ORDER: SchoolUserRole[] = ['STUDENT', 'STAFF', 'GUARDIAN', 'ADMIN'];
const DAY_COUNT = 7;
const MAX_ATTENDANCE_PAGES = 6;
const ATTENDANCE_PAGE_SIZE = 50;

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const int = Number.parseInt(value, 16);

  if (Number.isNaN(int) || value.length !== 6) {
    return [15, 76, 129];
  }

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

const mixColors = (hexA: string, hexB: string, weight: number) => {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 * weight + r2 * (1 - weight));
  const g = Math.round(g1 * weight + g2 * (1 - weight));
  const b = Math.round(b1 * weight + b2 * (1 - weight));

  return `rgb(${r}, ${g}, ${b})`;
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const buildLastNDays = (count: number) => {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (count - 1 - index));
    return day;
  });
};

interface AttendanceSummary {
  dayLabels: string[];
  dailyCounts: number[];
  admittedTotal: number;
  deniedTotal: number;
}

const emptyAttendanceSummary: AttendanceSummary = {
  dayLabels: [],
  dailyCounts: [],
  admittedTotal: 0,
  deniedTotal: 0
};

const summarizeAttendance = (
  records: Array<{ scannedAt: string; verdict: 'ADMITTED' | 'DENIED' }>,
  days: Date[]
): AttendanceSummary => {
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);
  const counts = new Map(days.map((day) => [dayKey(day), 0]));
  let admittedTotal = 0;
  let deniedTotal = 0;

  records.forEach((record) => {
    const key = dayKey(startOfDay(new Date(record.scannedAt)));
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (record.verdict === 'ADMITTED') {
      admittedTotal += 1;
    } else {
      deniedTotal += 1;
    }
  });

  const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

  return {
    dayLabels: days.map((day) => dayFormatter.format(day)),
    dailyCounts: days.map((day) => counts.get(dayKey(day)) ?? 0),
    admittedTotal,
    deniedTotal
  };
};

export const DashboardInsights = () => {
  const { activeSchool } = useTenantContext();
  const { school } = useSchoolTheme();
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [roleCounts, setRoleCounts] = useState<Partial<Record<SchoolUserRole, number>> | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const days = buildLastNDays(DAY_COUNT);
    const from = days[0].toISOString();
    const to = new Date().toISOString();

    const loadAttendance = async () => {
      try {
        const records: Array<{ scannedAt: string; verdict: 'ADMITTED' | 'DENIED' }> = [];
        let page = 1;
        let total = Infinity;

        while (records.length < total && page <= MAX_ATTENDANCE_PAGES) {
          const payload = await fetchAttendanceLogs({
            schoolSlug: activeSchool.slug,
            page,
            pageSize: ATTENDANCE_PAGE_SIZE,
            filters: { search: '', verdict: '', direction: '', from, to }
          });
          total = payload.total;
          records.push(
            ...payload.records.map((item) => ({
              scannedAt: item.log.scannedAt,
              verdict: item.log.verdict
            }))
          );
          page += 1;
        }

        if (!cancelled) {
          setAttendance(summarizeAttendance(records, days));
        }
      } catch {
        if (!cancelled) {
          setAttendanceError(true);
        }
      }
    };

    void loadAttendance();

    return () => {
      cancelled = true;
    };
  }, [activeSchool.slug]);

  useEffect(() => {
    let cancelled = false;

    fetchAdminUsers(activeSchool.id, { page: 1, pageSize: 1, all: true })
      .then((payload) => {
        if (cancelled) return;
        const counts: Partial<Record<SchoolUserRole, number>> = {};
        payload.users.forEach((entry) => {
          counts[entry.role] = (counts[entry.role] ?? 0) + 1;
        });
        setRoleCounts(counts);
      })
      .catch(() => {
        if (!cancelled) {
          setRosterError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id]);

  const primary = school.theme.primaryColor;
  const accent = school.theme.accentColor;

  const volumeData = useMemo(() => {
    const summary = attendance ?? emptyAttendanceSummary;
    return {
      labels: summary.dayLabels,
      datasets: [
        {
          label: 'Scans',
          data: summary.dailyCounts,
          backgroundColor: primary,
          borderRadius: 4,
          maxBarThickness: 36
        }
      ]
    };
  }, [attendance, primary]);

  const verdictData = useMemo(() => {
    const summary = attendance ?? emptyAttendanceSummary;
    return {
      labels: ['Admitted', 'Denied'],
      datasets: [
        {
          data: [summary.admittedTotal, summary.deniedTotal],
          backgroundColor: [ADMITTED_COLOR, DENIED_COLOR],
          borderWidth: 0
        }
      ]
    };
  }, [attendance]);

  const roleData = useMemo(() => {
    const counts = roleCounts ?? {};
    const presentRoles = ROLE_ORDER.filter((role) => (counts[role] ?? 0) > 0);
    const palette: Record<SchoolUserRole, string> = {
      STUDENT: primary,
      STAFF: accent,
      GUARDIAN: mixColors(primary, accent, 0.5),
      ADMIN: '#334861'
    };

    return {
      labels: presentRoles.map((role) => ROLE_LABELS[role]),
      datasets: [
        {
          data: presentRoles.map((role) => counts[role] ?? 0),
          backgroundColor: presentRoles.map((role) => palette[role]),
          borderWidth: 0
        }
      ]
    };
  }, [roleCounts, primary, accent]);

  const hasAttendanceData = (attendance?.admittedTotal ?? 0) + (attendance?.deniedTotal ?? 0) > 0;
  const hasRosterData = Object.values(roleCounts ?? {}).some((count) => (count ?? 0) > 0);
  const legendFont = { family: 'inherit', size: 12 };

  return (
    <section className="insights-section" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="panel-label">Insights</p>
          <h3 id="insights-heading">School activity at a glance</h3>
          <p className="section-copy">
            Scans and roster composition for {school.name}, drawn from the last {DAY_COUNT} days of
            attendance and your current roster.
          </p>
        </div>
      </div>

      <div className="insights-grid">
        <div className="insight-panel">
          <h4>Scans, last {DAY_COUNT} days</h4>
          {attendanceError ? (
            <p className="insight-empty">Unable to load attendance activity right now.</p>
          ) : !attendance ? (
            <p className="insight-empty">Loading scan activity…</p>
          ) : !hasAttendanceData ? (
            <p className="insight-empty">No scans recorded in the last {DAY_COUNT} days yet.</p>
          ) : (
            <div
              className="insight-chart"
              role="img"
              aria-label={`Bar chart of scans per day for the last ${DAY_COUNT} days. ${attendance.dayLabels
                .map((label, index) => `${label}: ${attendance.dailyCounts[index]}`)
                .join(', ')}.`}
            >
              <Bar
                aria-hidden="true"
                data={volumeData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: prefersReducedMotion() ? false : undefined,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="insight-panel">
          <h4>Admitted vs. denied</h4>
          {attendanceError ? (
            <p className="insight-empty">Unable to load attendance activity right now.</p>
          ) : !attendance ? (
            <p className="insight-empty">Loading scan activity…</p>
          ) : !hasAttendanceData ? (
            <p className="insight-empty">No scans recorded in the last {DAY_COUNT} days yet.</p>
          ) : (
            <div
              className="insight-chart insight-chart--donut"
              role="img"
              aria-label={`Donut chart of admitted versus denied scans in the last ${DAY_COUNT} days. Admitted: ${attendance.admittedTotal}, denied: ${attendance.deniedTotal}.`}
            >
              <Doughnut
                aria-hidden="true"
                data={verdictData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: prefersReducedMotion() ? false : undefined,
                  cutout: '68%',
                  plugins: { legend: { position: 'bottom', labels: { font: legendFont, boxWidth: 12 } } }
                }}
              />
            </div>
          )}
        </div>

        <div className="insight-panel">
          <h4>People by role</h4>
          {rosterError ? (
            <p className="insight-empty">Unable to load your roster right now.</p>
          ) : !roleCounts ? (
            <p className="insight-empty">Loading roster…</p>
          ) : !hasRosterData ? (
            <p className="insight-empty">No people on record yet.</p>
          ) : (
            <div
              className="insight-chart insight-chart--donut"
              role="img"
              aria-label={`Donut chart of people by role. ${roleData.labels
                .map((label, index) => `${label}: ${roleData.datasets[0].data[index]}`)
                .join(', ')}.`}
            >
              <Doughnut
                aria-hidden="true"
                data={roleData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: prefersReducedMotion() ? false : undefined,
                  cutout: '68%',
                  plugins: { legend: { position: 'bottom', labels: { font: legendFont, boxWidth: 12 } } }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
