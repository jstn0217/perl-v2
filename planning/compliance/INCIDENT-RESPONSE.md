# PERL Security Incident and Personal Data Breach Runbook

**Owner:** [PERL security lead]  
**Data Protection Officer:** [name, mobile, email]  
**24/7 incident channel:** [phone / paging address]  
**School escalation directory:** [controlled location]  
**Last exercise:** [date and evidence]  
**Status:** Operational template requiring named contacts, approval, and exercise before launch

This runbook covers suspected or confirmed confidentiality, integrity, and availability incidents affecting PERL, including school personal data. It does not replace legal advice or the affected School's incident plan.

Authoritative references:

- [NPC breach-reporting guidance and DBNMS process](https://privacy.gov.ph/pips-and-pics/breach-reporting/)
- [NPC Circular No. 16-03, Personal Data Breach Management](https://privacy.gov.ph/wp-content/uploads/2016/12/sgd-npc-circular-16-03-personal-data-breach-management.pdf)
- [Implementing Rules and Regulations of RA 10173](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/)
- [NPC Advisory No. 2026-02, DBNMS submission clarifications](https://privacy.gov.ph/wp-content/uploads/2026/05/Advisory-Clarification-on-the-Submission-of-Personal-Data-Breach-Notification-through-DBNMS_11-May-2026.pdf)

## 1. Roles and Decision Rights

| Role | Responsibility | Named person / backup |
|---|---|---|
| Incident commander | Own timeline, containment, decisions, and handoffs | [complete] |
| Technical lead | Investigate systems, preserve evidence, contain, eradicate, recover | [complete] |
| PERL DPO/privacy lead | Assess personal-data impact, advise PICs, maintain incident record | [complete] |
| Communications lead | Prepare approved internal, school, and data-subject communications | [complete] |
| Legal counsel | Advise notification, law enforcement, privilege, and contract duties | [complete] |
| School PIC/DPO | Decide and submit PIC notifications; direct data-subject response | [directory] |
| Processor/vendor contact | Supply evidence and containment for affected service | [directory] |

School remains PIC for school attendance data and owns regulatory/data-subject notification unless law directly assigns Processor a duty. PERL, as PIP, must escalate immediately under executed DPA and provide facts needed for School's decision. Never assume another party reported.

## 2. Report and Declare

Anyone discovering suspicious activity must contact the 24/7 channel immediately. Examples:

- unauthorized account, database, export, backup, or audit-log access;
- lost or exposed device/admin credential;
- cross-school disclosure or authorization bypass;
- malware, ransomware, data alteration, or destructive command;
- unexpected export, erasure, restore, or mass attendance change;
- lost backup or device containing PERL data;
- vendor incident, outage, or disclosure involving PERL; or
- credible vulnerability with evidence of exploitation.

Incident commander records discovery time, reporter, affected school/system, initial facts, and when PERL first had knowledge or reasonable belief of a breach. Preserve original timestamps. This starts legal and contractual clock analysis.

## 3. First Response

### First 15 minutes

1. Open restricted incident record and assign incident commander.
2. Record facts without speculation; classify source reliability.
3. Protect people first. Do not destroy evidence or alert suspected malicious insiders.
4. Revoke exposed sessions, device keys, or accounts when safe.
5. Isolate affected service, host, route, or tenant as narrowly as possible.
6. Preserve logs, database snapshots, access records, alerts, and relevant communications with integrity hashes where practical.

### First hour

1. Identify affected environments, schools, users, data categories, time range, and access path.
2. Determine whether personal data was accessed, altered, lost, destroyed, encrypted, or unavailable.
3. Contact PERL DPO/legal and affected School PIC/DPO using out-of-band verified contacts.
4. Preserve tenant isolation: never send one school's evidence or records to another school.
5. Freeze routine deletion for relevant evidence under documented incident hold.
6. Start decision log: who decided what, when, evidence used, and next review time.

### First 24 hours

1. Contain root access path; rotate affected credentials and secrets.
2. Establish reliable affected-record and data-subject estimates.
3. Assess likely harm, especially because attendance and education-related data concern minors.
4. Determine mandatory-notification criteria with each School PIC/DPO and counsel.
5. Draft notification using available information; incomplete investigation must not silently consume deadline.
6. Define recovery verification and heightened monitoring.

## 4. Severity

| Severity | Example | Response |
|---|---|---|
| SEV-1 Critical | Confirmed cross-school disclosure, privileged compromise, destructive attack, or likely serious harm | Page all roles now; continuous command; school notice immediately |
| SEV-2 High | Confirmed single-school personal-data breach or active credential abuse with limited scope | Page security/DPO; school notice within contractual target; frequent updates |
| SEV-3 Medium | Contained security incident without confirmed personal-data breach | Investigate same day; document notification assessment |
| SEV-4 Low | Unsuccessful event or control warning with no impact | Normal queue; retain evidence and trend |

Severity can rise or fall as evidence changes. Regulatory assessment is separate: a low-volume incident may still require notification because of data nature and harm.

## 5. Notification Assessment

NPC guidance requires the PIC to notify NPC and affected data subjects within 72 hours upon knowledge or reasonable belief that a notifiable personal data breach occurred. Mandatory notification depends on legal criteria, including sensitive personal information or identity-fraud-enabling data acquired by an unauthorized person and likely real risk of serious harm. Use counsel and DPO; do not decide from severity label alone.

For every incident, document:

- whether personal data was involved and which categories;
- confidentiality, integrity, and availability effects;
- whether acquisition by an unauthorized person is reasonably believed;
- number and vulnerability of affected data subjects;
- likely harm and mitigating safeguards;
- notification decision, evidence, decision maker, and timestamp; and
- any reason/request for postponement, exemption, extension, or alternative notification.

Current NPC guidance says valid breach notifications and Annual Security Incident Reports are submitted through [DBNMS](https://dbnms.privacy.gov.ph/). Use School/PERL-controlled generic addresses, not a vendor-owned mailbox. Follow current NPC forms and instructions at incident time.

### Notification contents

Prepare, at minimum:

- nature and chronology of breach;
- estimated affected data subjects and records;
- personal/sensitive data involved;
- likely consequences;
- containment, recovery, harm mitigation, and recurrence-prevention measures;
- notification or planned notification of affected people;
- DPO/contact details; and
- for data subjects, practical risk-reduction steps and assistance contact.

Submit available information within required period when full facts are unavailable, then supplement through same DBNMS incident record. Current NPC guidance states full report is due within five days unless extension is granted. Counsel/DPO must verify current requirement during incident.

## 6. Communication Rules

- Use verified contacts and restricted channels; mark incident material confidential.
- State known facts, unknowns, actions, and next update time.
- Never include raw passwords, device keys, session tokens, or unrelated tenant data.
- Never minimize, conceal, speculate, assign blame, or promise legal outcomes.
- Coordinate public statements with affected PIC, DPO, counsel, and law enforcement where applicable.
- Notify data subjects individually unless NPC approves another method where required.

## 7. Recovery

1. Remove persistence and vulnerable path before reconnecting.
2. Rotate impacted user, device, DB, JWT, infrastructure, and vendor credentials.
3. Restore only from validated, encrypted backup; preserve compromised state separately.
4. Verify school counts, tenant boundaries, credentials, attendance integrity, audit trail, and critical routes.
5. Run mock/MySQL tests, dependency audit, and targeted exploit regression where relevant.
6. Obtain incident commander and system owner approval before full restoration.
7. Maintain heightened monitoring for documented period.

## 8. Closure and Follow-Up

Closure requires:

- root cause and affected scope supported by evidence;
- containment, eradication, recovery, and monitoring complete;
- School, NPC, data-subject, insurer, vendor, and contractual duties completed or tracked;
- evidence retention/hold and secure disposal dates assigned;
- audit records and timeline complete;
- corrective controls have owners and deadlines; and
- executive, DPO, and affected School review completed.

Hold post-incident review within five business days after stabilization. Track actions to closure. Update DPIA, DPA, notices, architecture, tests, and training where findings change risk.

Maintain all security-incident records and prepare required annual summary/report through current NPC process. Retention period: **[DPO/legal to approve]**.

## 9. Exercise Checklist

Before real student data, run tabletop covering compromised school admin plus leaked device key:

- [ ] 24/7 contact reaches primary and backup.
- [ ] Team starts and preserves legal clock.
- [ ] One school/device is isolated without affecting another.
- [ ] Session and device credentials are revoked and rotated.
- [ ] Audit records and DB evidence are retrieved.
- [ ] School PIC/DPO receives sufficient report within DPA target.
- [ ] Team completes notification decision and draft under 72-hour scenario.
- [ ] DBNMS access and organization-controlled account are verified.
- [ ] School-scoped encrypted backup is restored and validated.
- [ ] Gaps receive owners and deadlines.

Exercise date, participants, evidence, findings, and approval: **[complete before launch]**
