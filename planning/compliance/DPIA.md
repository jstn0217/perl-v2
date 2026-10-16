# PERL Privacy Impact Assessment

**System:** PERL multi-tenant RFID attendance platform  
**Assessment version:** 0.1  
**Assessment date:** 2026-07-22  
**Owner:** [PERL legal entity / system owner]  
**Data Protection Officer:** [name and contact details]  
**Status:** Pre-launch assessment requiring DPO, school, security, and legal approval

This assessment covers PERL application processing. Each subscribing school must confirm its own purposes, lawful basis, notices, retention rules, users, devices, hosting arrangement, and downstream disclosures before production use. This document is an operational template and technical assessment, not legal advice.

## 1. Legal and Method Basis

This assessment follows:

- [Republic Act No. 10173, Data Privacy Act of 2012](https://privacy.gov.ph/data-privacy-act/)
- [Implementing Rules and Regulations of RA 10173](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/)
- [NPC Advisory No. 2017-03, Guidelines on Privacy Impact Assessments](https://privacy.gov.ph/wp-content/uploads/2022/01/NPC_AdvisoryNo.2017-03.pdf)
- [NPC Circular No. 2023-06, Security of Personal Data in Government and the Private Sector](https://privacy.gov.ph/wp-content/uploads/2024/03/NPC-Circular-Repeal-16-01-Signed.pdf)

NPC Advisory No. 2017-03 calls for a systematic data-flow description, inventory, necessity and proportionality review, security-control assessment, data-subject-rights mechanisms, risk evaluation, remediation owners, and periodic review. This assessment uses that structure.

## 2. Scope and Roles

### In scope

- School profile and tenant resolution
- School user administration
- Authentication and session management
- RFID device registration and authentication
- Student attendance scans, verdicts, logs, and live monitor events
- School and individual data export and erasure
- School backup and restore
- MySQL persistence, mock development storage, and application logs

### Out of scope

- School source records and paper processes before entry into PERL
- RFID card manufacture and physical card custody
- School network, endpoint, and physical-security controls
- Billing, email, SMS, analytics, object storage, and other integrations not yet implemented
- Legacy-system migration until an importer and its data flow exist

### Expected legal roles

- **School as Personal Information Controller (PIC):** determines attendance purpose, affected people, collection rules, lawful basis, retention, authorized staff, and disclosure.
- **PERL operator as Personal Information Processor (PIP):** hosts and processes school data only on documented school instructions under the DPA template.
- **Separate PERL controller activity:** operator account, contracting, billing, security, or legal-compliance data, if later collected for the operator's own purposes, requires a separate notice and assessment.

Final roles must be confirmed in each deployment. A party's actual decisions and processing determine its role, not this label alone.

## 3. Processing Purpose and Necessity

Declared purposes:

- Authenticate school administrators, staff, students, and guardians.
- Register school-controlled RFID readers.
- Match a presented card identifier to an active student in the same school.
- Decide and record campus entry/exit attendance under configured attendance rules.
- Show authorized school personnel current and historical attendance.
- Let authorized school administrators maintain their school profile and users.
- Support access, portability, erasure, backup, and recovery operations.

Necessity and proportionality findings:

- School identity and tenant keys are necessary to isolate records.
- User names and school role are necessary for identity and authorization.
- Education-related fields (`gradeLevel`, `section`) and attendance history are sensitive personal information and must be limited to fields schools can justify.
- Card UID is necessary for current RFID matching but should be a replaceable identifier, not a general-purpose student number.
- Student image URL is optional and should remain disabled unless the school documents why visual confirmation is necessary.
- Denied-scan messages do not disclose a student's identity when a card belongs to another school.
- PERL does not currently require date of birth, home address, health data, government IDs, biometrics, precise geolocation, or continuous tracking. These fields must not be added without a new assessment.

Each school must document its lawful basis for every purpose. Consent must not be used as a default when another lawful basis applies, and consent involving minors requires school-specific legal review and a clear guardian/student process.

## 4. Data Inventory

| Data subject | Data elements | Classification | Source |
|---|---|---|---|
| Students | name, email, role, RFID card UID, grade, section, optional image URL, active status | Personal and education-related sensitive personal information | School admin; RFID scan |
| Staff/admins | name, email, role, password hash, active status | Personal information; authentication secret derivative | School admin; user |
| Guardians | name, email, role, active status | Personal information | School admin |
| All attendance subjects | scan time, direction, verdict, denial reason, message, student ID, device ID, school ID | Personal information; attendance/education context may be sensitive | RFID device and service rules |
| School contacts | school name, slug, logo URL, colors, contact email | Organizational data; contact email may identify a person | School admin |
| Devices | name, location, key hash, key suffix, active status | Security and operational data | School admin |
| Session users | user ID, school ID, role, token issue/expiry metadata | Personal and security data | Authentication service |

Credential handling:

- Passwords are stored as bcrypt hashes, never plaintext.
- Device keys are shown once and stored as SHA-256 hashes plus last four characters.
- JWT sessions use HttpOnly cookies and are validated on protected requests.
- Portable exports omit password and device-key hashes. Full recovery backups contain hashes and therefore require stronger storage and access controls.

## 5. Data Flow and Repositories

1. School admin creates or updates a school-scoped user.
2. API validates input, hashes any password, and writes to mock memory or MySQL through repository interfaces.
3. Admin registers a device; API returns raw key once and stores only its hash.
4. Device sends card UID in request body with `X-Device-Key`; browser simulation uses authenticated school session.
5. API resolves device and user, enforces same-school scope, applies attendance rules, and stores verdict.
6. In-process event bus sends current scan result to authenticated same-school monitor connections.
7. Authorized admin may export school or user data, erase one user, purge school operational data, create a school backup, or restore that same school's backup.

Current repositories:

- Development mock data: application-process memory; disappears on restart.
- Production-like data: shared MySQL tables with `school_id` on users, devices, and attendance logs.
- Browser: HttpOnly session cookie; no JWT in `localStorage`.
- Exports/backups: returned over authenticated HTTP response; storage after download is controlled by recipient and must be encrypted and access-restricted.
- Application logging: server startup and fatal startup errors only in current code. Production platform/logging destination remains to be selected and assessed.

No external transfers, subprocessors, production hosting region, CDN, backup provider, email/SMS provider, or monitoring provider are approved by this assessment. Complete vendor and transfer details before launch.

## 6. Retention and Disposal

Required pre-launch decisions:

| Record | Proposed default | Final owner approval |
|---|---|---|
| Active user profile | Enrollment/employment relationship plus verified operational need | [school/DPO] |
| Attendance logs | [school policy, legal basis, and exact duration] | [school/DPO] |
| Inactive user profile | [short closure period, then erase or anonymize] | [school/DPO] |
| Security/audit logs | [duration based on incident and legal needs] | [operator DPO/security] |
| Export files | Delete immediately after secure delivery or approved case closure | [school/operator] |
| Backups | [rotation, expiry, and deletion schedule] | [operator] |

PERL currently offers explicit export and erasure endpoints but has no scheduled retention engine. Production launch requires a documented schedule, automated expiry where practical, backup expiry, and a hold procedure for legal claims. Deletion from live data must propagate to expiring backups under the approved backup policy.

## 7. Data Subject Rights

Current technical mechanisms:

- Individual portable export: `GET /api/admin/schools/:schoolId/users/:userId/export`
- Individual erasure: `DELETE /api/admin/schools/:schoolId/users/:userId/data`
- School export: `GET /api/admin/schools/:schoolId/export`
- School operational-data purge: `DELETE /api/admin/schools/:schoolId/data`
- Profile correction: admin user-update routes

School process still required:

- Publish clear privacy notice before collection.
- Accept requests through an accessible DPO channel.
- Verify requester/guardian identity without collecting excessive proof.
- Record request, legal review, decision, deadline, action, and response.
- Apply legal exceptions and retention holds before erasure.
- Notify recipients when correction or erasure must propagate.
- Provide appeal/complaint routes and NPC contact information.

Only authorized school admins invoke current endpoints. This is deliberate: technical deletion must follow identity verification and school/DPO approval, not unauthenticated self-service requests.

Portable school exports include school audit records. Individual exports include audit records where the person acted or was the target. Recovery backups deliberately exclude audit records so restore cannot replace or erase security evidence; audit retention and lawful erasure exceptions require DPO policy.

## 8. Existing Controls

Organizational controls represented in repo:

- Ports-and-adapters boundary keeps tenant scope in service/repository contracts.
- Changelog and phased acceptance requirements document security decisions.
- DPA template assigns controller/processor duties.

Technical controls implemented and tested:

- bcrypt password hashing
- HttpOnly JWT cookie, configurable `Secure`, SameSite=Lax, finite expiry
- explicit CORS origin allow-list
- role and school checks on authenticated admin routes
- device key in header, stored only as hash
- one-time device-key rotation and immediate revocation
- login and scan rate limits resistant to client-supplied `X-Forwarded-For`
- cross-school tests over every authenticated route family in mock and MySQL modes
- bounded attendance pagination
- credential hashes excluded from portability exports
- append-only, school-scoped audit records for sensitive admin, export, erasure, backup, and restore operations
- school-scoped backup validation and restore tests
- dependency audit for HIGH/CRITICAL findings (`npm run audit:check`), run manually before each deploy while CI is disabled

## 9. Risk Assessment

Scale: likelihood and impact are Low, Medium, or High. Residual rating assumes listed treatment is complete.

| ID | Risk and affected rights | Initial | Existing control | Required treatment | Owner / due | Residual |
|---|---|---|---|---|---|---|
| R1 | Cross-school ID guessing exposes or changes another school's records | High/High | Route role/school checks; repository scope; parity tests | Keep route inventory test mandatory; security review each new route | Engineering / continuous | Low/High |
| R2 | Stolen password or session exposes minors' attendance | Medium/High | bcrypt; HttpOnly cookie; expiry; rate limit; production startup rejects insecure cookies, HTTP origins, and weak/default JWT secret | Deploy HTTPS; decide MFA and session revocation | Security / pre-launch | Low/High |
| R3 | Lost device key permits false scans | Medium/High | random key; hash storage; per-school binding; rate limit; one-time rotation; immediate revocation; audit events | Establish school revocation response procedure | School + engineering / pre-launch | Low/Medium |
| R4 | Cross-school denied scan reveals student identity | Medium/High | Generic denial; no foreign-school student object or name; regression test | Preserve generic response in future scan changes | Engineering / continuous | Low/Medium |
| R5 | Excess retention creates unnecessary history and exposure | High/High | Manual erasure endpoints | Approve schedule; automate expiry; document legal holds and backup propagation | DPO + engineering / pre-launch | Low/High |
| R6 | Downloaded backup/export leaks credentials or student history | Medium/High | Admin authorization; portability exports omit hashes | HTTPS; encrypted backup storage; short-lived delivery; access/audit policy; never email plaintext | Ops + school / pre-launch | Low/High |
| R7 | Restore failure leaves partial or unavailable school data | Medium/High | Scope validation; automatic rollback to pre-restore snapshot; parity failure test | Add encrypted scheduled backup and production restore drill | Engineering + ops / pre-launch | Low/Medium |
| R8 | Malformed backup injects invalid or colliding records | Medium/High | Full schema, scope, hash, enum, timestamp, duplicate, reference, and record-count validation; rollback | Add audit event and production restore drill | Engineering / pre-launch | Low/Medium |
| R9 | Privileged admin misuses export, erase, restore, or user management | Medium/High | ADMIN role; tenant scope; destructive confirmation; append-only school audit trail | Establish least-privilege and approval policy for bulk operations; protect audit retention | School + ops / pre-launch | Low/High |
| R10 | Database or backup compromise exposes sensitive records | Medium/High | Credential hashing; tenant scoping; production startup requires verified DB TLS and non-default DB secret | Encrypted volumes/backups, key management, least-privilege DB account, tested recovery | Ops / pre-launch | Low/High |
| R11 | Inaccurate RFID assignment affects attendance record | Medium/Medium | UID uniqueness; admin edit; cooldown rules | Card replacement workflow, correction process, change audit | School + engineering / pre-launch | Low/Medium |
| R12 | Unapproved vendor or cross-border transfer changes risk | Medium/High | No production vendors approved | Vendor review, subprocessor schedule, location and transfer safeguards, notice update | DPO + legal / before vendor use | Low/High |
| R13 | Breach response is late or incomplete | Medium/High | Repo runbook covers command, evidence, containment, PIC/PIP escalation, DBNMS, notification assessment, recovery, and follow-up | Name contacts, approve runbook, verify DBNMS access, and exercise | DPO + security / pre-launch | Low/High |
| R14 | Child/guardian notice or lawful basis is invalid | Medium/High | No deployment-specific process | School legal review, child-friendly notice, guardian process where required, request channel | School DPO/legal / pre-launch | Low/High |

Impact often remains High because compromised attendance and education-related records concern minors. Controls mainly reduce likelihood.

## 10. Required Launch Actions

Launch with real student data is not approved until all items have evidence and accountable sign-off:

- [ ] Name legal entities, PIC/PIP roles, DPOs, contacts, and Philippine addresses.
- [ ] Record each purpose and lawful basis; publish adult and child-appropriate notices.
- [ ] Approve exact retention, legal-hold, live deletion, and backup-expiry rules.
- [ ] Select production hosting; document location, vendors, subprocessors, and transfers.
- [ ] Deploy behind HTTPS and provide production secrets/DB TLS required by startup guard; add encryption at rest, encrypted backups, and managed key rotation.
- [ ] Complete vulnerability review, access review, backup restore drill, and incident exercise.
- [ ] Approve incident response and personal-data-breach notification runbook.
- [ ] Determine NPC registration and other education-sector requirements with counsel/DPO.
- [ ] Execute DPA and any required subprocessor terms before transfer.
- [ ] Obtain stakeholder input from school admins, staff, guardians, and age-appropriate student representatives.

## 11. Review and Approval

Review annually and whenever purposes, categories, rules, integrations, hosting, transfers, vendors, security controls, law, or incident history materially change.

| Role | Name | Decision | Signature | Date |
|---|---|---|---|---|
| PERL system owner | [name] | [approve/reject] |  |  |
| PERL DPO | [name] | [approve/reject] |  |  |
| PERL security lead | [name] | [approve/reject] |  |  |
| School PIC representative | [name] | [approve/reject] |  |  |
| School DPO | [name] | [approve/reject] |  |  |

Approval conditions and accepted residual risks: [complete before signing]
