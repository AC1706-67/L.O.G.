/**
 * Compliance Module
 * Exports all compliance-related functionality
 */

// Disclosure Controls
export {
  verifyDisclosure,
  generateReDisclosureNotice,
  recordDisclosure,
  checkExpiredConsents,
  getDisclosureHistory,
} from './disclosureControls';

// SUD Access Control
export {
  verifySUDAccess,
  isSUDDataType,
  checkSUDAccess,
  getSUDAccessAudit,
  SUD_DATA_TYPES,
} from './sudAccessControl';

// Breach Reporting
export {
  reportBreachIncident,
  generateBreachReport,
  getBreachIncidents,
  markReportSent,
} from './breachReporting';

// Types
export * from './types';
