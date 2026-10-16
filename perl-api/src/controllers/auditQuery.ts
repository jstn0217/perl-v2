import type { Request, Response } from 'express';
import {
  auditActions,
  type AuditFilters,
  type AuditRecord
} from '../types/Audit.js';
import type { UserRole } from '../types/User.js';
import {
  readSelectedCsvColumns,
  sendCsvColumnDownload,
  type CsvColumn
} from '../utils/csv.js';
import { DomainError } from '../utils/errors.js';

const userRoles: UserRole[] = [
  'ADMIN',
  'STAFF',
  'STUDENT',
  'GUARDIAN',
  'SYSTEM_ADMIN',
  'SUPPORT'
];
const targetTypes: AuditRecord['targetType'][] = ['SCHOOL', 'USER', 'DEVICE', 'ROLE', 'SUBMISSION'];
const auditExportColumns: CsvColumn<AuditRecord>[] = [
  { key: 'occurredAt', label: 'Occurred at', value: (record) => record.occurredAt },
  { key: 'schoolId', label: 'School ID', value: (record) => record.schoolId },
  { key: 'action', label: 'Action', value: (record) => record.action },
  { key: 'actorUserId', label: 'Actor user ID', value: (record) => record.actorUserId },
  { key: 'actorRole', label: 'Actor role', value: (record) => record.actorRole },
  {
    key: 'supportInitiated',
    label: 'Support initiated',
    value: (record) => (record.supportInitiated ? 'Yes' : 'No')
  },
  { key: 'targetType', label: 'Target type', value: (record) => record.targetType },
  { key: 'targetId', label: 'Target ID', value: (record) => record.targetId ?? '' },
  {
    key: 'changeSummary',
    label: 'Change summary',
    value: (record) => record.changeSummary
  }
];

export const readAuditFilters = (query: Request['query']): AuditFilters => {
  const readText = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  const action = readText(query.action);
  const actorRole = readText(query.actorRole);
  const targetType = readText(query.targetType);
  const support = readText(query.supportInitiated);
  const from = readText(query.from);
  const to = readText(query.to);

  if (action && !auditActions.includes(action as (typeof auditActions)[number])) {
    throw new DomainError('Invalid audit action filter.');
  }
  if (actorRole && !userRoles.includes(actorRole as UserRole)) {
    throw new DomainError('Invalid audit actor filter.');
  }
  if (targetType && !targetTypes.includes(targetType as AuditRecord['targetType'])) {
    throw new DomainError('Invalid audit target filter.');
  }
  if (support && !['true', 'false'].includes(support)) {
    throw new DomainError('Invalid support-origin filter.');
  }
  if (from && Number.isNaN(Date.parse(from))) throw new DomainError('Invalid audit start date.');
  if (to && Number.isNaN(Date.parse(to))) throw new DomainError('Invalid audit end date.');
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new DomainError('Audit start date must be before the end date.');
  }

  return {
    search: readText(query.search),
    action: action as AuditFilters['action'],
    actorRole: actorRole as AuditFilters['actorRole'],
    targetType: targetType as AuditFilters['targetType'],
    supportInitiated: support === undefined ? undefined : support === 'true',
    from,
    to
  };
};

export const sendAuditCsv = (
  res: Response,
  filename: string,
  records: AuditRecord[],
  selectedColumns?: unknown
) =>
  sendCsvColumnDownload(
    res,
    filename,
    readSelectedCsvColumns(selectedColumns, auditExportColumns),
    records
  );
