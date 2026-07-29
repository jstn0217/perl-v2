# Data Processing Agreement

This Data Processing Agreement (the **Agreement**) is entered into on **[effective date]** by and between:

**[Full legal name of school]**, with address at **[address]**, represented by **[name/title]** (the **School** or **PIC**); and

**[Full legal name of PERL operator]**, with address at **[address]**, represented by **[name/title]** (the **Processor** or **PIP**).

The School and Processor are each a **Party** and together the **Parties**.

This template must be completed and reviewed by Philippine counsel and both Data Protection Officers before signature. It is structured for outsourced processing under Republic Act No. 10173 and Rules 43 to 45 of its Implementing Rules and Regulations, not controller-to-controller data sharing.

## 1. Purpose and Relationship

1.1 The School determines the purposes and means of processing school attendance data and acts as Personal Information Controller.

1.2 The Processor provides the PERL multi-tenant RFID attendance service and processes personal data only for the School, on documented instructions, as Personal Information Processor.

1.3 The service agreement dated **[date]** is the **Principal Agreement**. This Agreement forms part of it. If personal-data terms conflict, this Agreement controls.

1.4 Each Party shall comply with Republic Act No. 10173, its Implementing Rules and Regulations, applicable National Privacy Commission issuances, and other applicable law.

## 2. Processing Details

The processing subject matter is operation, hosting, support, security, export, erasure, backup, and recovery of PERL for the School.

| Item | Agreed detail |
|---|---|
| Duration | From **[start]** until deletion or return under Section 13 |
| Purposes | User authentication; RFID attendance matching and recording; attendance display/reporting; school administration; rights requests; backup/recovery |
| Operations | Collection, recording, organization, storage, retrieval, consultation, update, transmission to authorized School users, export, restriction, backup, restoration, erasure, and destruction |
| Data subjects | Students, guardians, School staff, School administrators, and other authorized card holders identified by School |
| Personal data | Name, email, role, active status, school ID, RFID card UID, grade, section, optional image URL, attendance time/direction/verdict/reason/message, device association, authentication/session metadata |
| Sensitive personal information | Education-related data and attendance records; any other category must be approved through change control and updated privacy assessment |
| Frequency/volume | **[estimated users, scans/day, and access frequency]** |
| Hosting locations | **[country/region/data center]** |
| Approved transfer locations | **[none or list]** |
| School retention instruction | **[exact schedule by record category]** |

The School shall not instruct the Processor to collect biometrics, health data, government identifiers, precise geolocation, or other new categories without written amendment, lawful-basis review, and updated privacy impact assessment.

## 3. School Instructions and Duties

3.1 Processor shall process personal data only on documented School instructions, including instructions concerning transfer outside the Philippines, unless Philippine law requires otherwise. Where legally allowed, Processor shall inform School before required processing.

3.2 School instructions consist of this Agreement, Principal Agreement, approved service configuration, authenticated actions by authorized School administrators, and later written instructions accepted by Processor.

3.3 Processor shall promptly inform School if an instruction appears to violate applicable data-protection law and may suspend that instruction while Parties resolve it.

3.4 School is responsible for:

- lawful, fair, transparent, necessary, and proportionate collection and use;
- identifying and documenting lawful basis;
- clear notices and any valid consent or guardian process required for minors;
- accuracy of uploaded user and RFID assignments;
- approving authorized users and promptly removing access;
- handling legal exceptions, holds, disclosures, and rights decisions;
- selecting and documenting retention periods; and
- not placing prohibited or unnecessary data in free-text fields.

## 4. Confidentiality and Personnel

4.1 Processor shall limit access to personnel who need it to provide, secure, support, or legally administer the service.

4.2 Authorized personnel shall be bound by confidentiality obligations that continue after role or employment ends.

4.3 Processor shall provide role-appropriate privacy and security training and maintain access-review and offboarding procedures.

## 5. Security Measures

Processor shall maintain reasonable and appropriate organizational, physical, and technical measures proportionate to risks, including at minimum:

- school-scoped authorization and tenant-isolation tests;
- least-privilege production and database access;
- bcrypt password hashing and hashed device credentials;
- HttpOnly, Secure, finite-lifetime session cookies over HTTPS;
- explicit CORS allow-list and rate limiting;
- encryption in transit and encryption of database volumes and backups at rest;
- managed secrets and encryption-key rotation;
- vulnerability and dependency management;
- security logging and auditable sensitive admin operations;
- backup rotation, integrity checks, school-scoped restore drills, and secure disposal;
- incident detection, containment, recovery, evidence preservation, and notification procedures; and
- periodic access, control, and privacy-impact review.

Current detailed measures and exceptions are listed in **Schedule 2**. Processor shall not materially reduce overall protection during the term.

## 6. Data Subject Rights

6.1 Taking account of processing nature, Processor shall assist School through appropriate technical and organizational measures with requests for information, access, correction, objection, portability, restriction, blocking, and erasure.

6.2 If Processor receives a request relating to School data, it shall notify School without undue delay and shall not decide the request unless authorized or legally required.

6.3 School remains responsible for identity verification, lawful decision, response content, and deadline. Processor may require a written instruction before irreversible action.

6.4 PERL provides school-scoped user export and erasure functions. School shall ensure approved retention or legal-hold requirements are applied before use.

## 7. Security Incidents and Personal Data Breaches

7.1 Processor shall notify School without undue delay, and no later than **[12/24] hours** after confirming a security incident that affects School personal data.

7.2 Notification shall include available information on:

- incident nature, timing, systems, records, and data-subject categories;
- likely consequences and risk of harm;
- containment, investigation, remediation, and recovery actions;
- Processor incident contact; and
- information reasonably needed for School's NPC and data-subject notification decision.

7.3 Processor shall preserve relevant evidence, provide updates, cooperate with School, and document incident lessons. School controls external notification unless law directly requires Processor to notify.

7.4 Neither Party shall make misleading statements or delay legally required action to protect reputation.

## 8. Subprocessors

8.1 Approved subprocessors are listed in **Schedule 3**. Processor shall not appoint a new subprocessor with access to School personal data without **[specific prior written authorization / at least 30 days' prior notice and opportunity to object]**.

8.2 Processor shall impose written obligations at least as protective as this Agreement and remains accountable for subprocessor performance.

8.3 If School reasonably objects and Parties cannot resolve the risk, School may terminate affected service without penalty under **[termination terms]**.

## 9. Transfers and Data Location

9.1 Processor shall not transfer or permit remote access to School personal data outside approved locations without documented School instruction, transparency to data subjects where required, and safeguards compliant with Philippine law.

9.2 Processor shall disclose hosting and support locations and changes before transfer. Cross-border processing does not reduce School's accountability or data-subject protection.

## 10. Audit and Compliance Information

10.1 Processor shall make available information reasonably necessary to demonstrate compliance, including relevant policies, privacy-impact assessment summary, subprocessor list, security-control summary, incident records, access-review evidence, and restore-test evidence.

10.2 School or its independent auditor may audit relevant controls once annually and after a material incident, on **[15] business days'** notice, subject to confidentiality, safety, tenant isolation, and reasonable scope. Urgent incident or regulator requests need no ordinary notice.

10.3 Processor shall address material findings under a mutually documented remediation plan. Audits shall not expose another customer's data or security secrets unrelated to assurance.

10.4 Processor shall cooperate with lawful NPC inquiries and immediately inform School of an instruction it believes violates applicable law.

## 11. Privacy by Design and Change Control

11.1 Processor shall maintain privacy by design and default, data minimization, school isolation, secure development, and periodic privacy-impact review.

11.2 Before materially changing purpose, data category, automated decision, hosting location, transfer, subprocessor, retention mechanism, or security architecture, Processor shall assess impact and provide School enough information to update notices, instructions, contracts, and assessments.

11.3 Processor shall not sell School personal data, use it for advertising, build unrelated profiles, or train general-purpose machine-learning models with it.

## 12. Accuracy, Retention, and Disposal

12.1 Processor shall provide functions allowing authorized School users to correct records and shall preserve correction history only where instructed and lawful.

12.2 Processor shall retain personal data only for the School-approved schedule in Schedule 1, except documented legal holds. No record shall be retained indefinitely for undefined future use.

12.3 Deleted live data may remain in protected rotating backups only until scheduled expiry of **[period]**. It shall not be restored into active service except for disaster recovery, after which deletion instructions shall be reapplied.

12.4 Exports and temporary support files shall be securely deleted after **[period/event]**.

## 13. Return and Deletion at End of Service

13.1 At School's choice, Processor shall securely return a portable school export and delete School personal data after contract end, unless law requires retention.

13.2 School must request export within **[30] days** after termination. Processor shall delete active data within **[30] days** and backup copies through normal rotation within **[90] days**, unless Schedule 1 states stricter periods.

13.3 Processor shall provide deletion confirmation on request. Any legally retained data shall be isolated, access-restricted, and used only for that legal purpose.

## 14. Liability and Indemnity

Each Party is responsible for its own acts, omissions, instructions, and legal duties. Liability, indemnity, exclusions, and caps are governed by **[Principal Agreement section]**, except to the extent applicable law prohibits limitation. Nothing limits data-subject rights or NPC authority.

## 15. Term and Termination

This Agreement begins on the effective date and continues while Processor handles School personal data. Obligations concerning confidentiality, incident cooperation, audit evidence, return, deletion, and liability survive as needed to protect retained data and enforce rights.

Material breach not cured within **[15] days** after notice permits suspension or termination, except an urgent security or unlawful-processing risk may require immediate suspension.

## 16. Notices and Contacts

| Contact | School | Processor |
|---|---|---|
| Contract notices | [name/email/address] | [name/email/address] |
| Data Protection Officer | [name/email/phone] | [name/email/phone] |
| Security incident 24/7 | [email/phone] | [email/phone] |
| Data-subject requests | [email/portal] | [email/portal] |

## 17. General Terms

17.1 Changes must be written and signed, except operational contact and approved-subprocessor updates allowed under this Agreement.

17.2 Invalid terms shall be severed without invalidating remaining terms.

17.3 This Agreement is governed by Philippine law. Venue and dispute process are **[complete]**.

17.4 No failure to enforce a term waives it.

## Schedule 1: School Instructions and Retention

Complete before signing:

| Record/category | Purpose and lawful basis determined by School | Retention | Disposal | Legal hold owner |
|---|---|---|---|---|
| User profiles | [complete] | [complete] | [complete] | [complete] |
| RFID card UID | [complete] | [complete] | [complete] | [complete] |
| Attendance logs | [complete] | [complete] | [complete] | [complete] |
| Device records | [complete] | [complete] | [complete] | [complete] |
| Security/audit logs | [complete] | [complete] | [complete] | [complete] |
| Exports/support files | [complete] | [complete] | [complete] | [complete] |
| Backups | [complete] | [complete] | [complete] | [complete] |

Additional written instructions: **[complete]**

## Schedule 2: Technical and Organizational Measures

Attach final production architecture and complete before signing:

- Hosting provider, region, and environment separation: **[complete]**
- Encryption in transit and at rest: **[complete]**
- Backup encryption, rotation, and restore evidence: **[complete]**
- Identity, access, MFA, and privileged-access controls: **[complete]**
- Logging, monitoring, and alerting: **[complete]**
- Secure-development and vulnerability process: **[complete]**
- Incident response and notification process: **[complete]**
- Business continuity and disaster recovery: **[complete]**
- Personnel confidentiality and training: **[complete]**
- Data return, erasure, media disposal, and backup expiry: **[complete]**
- Latest DPIA approval and residual-risk acceptance: **[complete]**

## Schedule 3: Approved Subprocessors

| Legal entity | Service | Data/categories | Location and access | Transfer safeguard | Notice date |
|---|---|---|---|---|---|
| [none/list] |  |  |  |  |  |

## Signatures

For **[School legal name]**

Name: ______________________________  
Title: _______________________________  
Signature: ___________________________  
Date: ________________________________

For **[PERL operator legal name]**

Name: ______________________________  
Title: _______________________________  
Signature: ___________________________  
Date: ________________________________
