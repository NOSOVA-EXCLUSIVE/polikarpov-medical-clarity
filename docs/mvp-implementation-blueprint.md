# MVP Implementation Blueprint

## Stack confirmation

### Next.js + TypeScript
- `Next.js App Router` gives one coherent surface for the public site, admin, portal, and API routes.
- `TypeScript` is important here because the product has many stateful workflows: application status, offer lifecycle, token purpose, message policies, file classes, and medical upload rules.
- This keeps public pages, admin workflows, portal messaging, and server handlers in one codebase with shared validation and domain types.

### PostgreSQL
- The product is relational by nature: patients, applications, red flags, uploads, external links, offers, slots, payments, requirements, messages, and tokens.
- PostgreSQL handles transactional consistency well for slot holds, payment reconciliation, token expiry, and audit events.
- It is also the right fit for JSON snapshots such as `rulesSnapshotJson` and `metadataJson`.

### Prisma
- `Prisma` is the best fit for this MVP because the schema is relationship-heavy and needs to stay readable for fast team iteration.
- The domain has a lot of enums and explicit relations; Prisma keeps those easy to inspect and evolve.
- For the few things Prisma does not express well, such as advanced `CHECK` constraints and partial indexes, we add SQL migrations on top.
- `Drizzle` would be a valid alternative for a more SQL-first team, but this MVP benefits more from Prisma's migration ergonomics and schema clarity.

### S3-compatible storage
- Medical files, videos, and archives should not flow through the app server more than needed.
- Direct-to-storage uploads with presigned URLs reduce server load and keep file handling predictable.
- S3-compatible storage also keeps the app portable across AWS, Cloudflare R2, Scaleway, MinIO, or regional providers.

### Stripe
- `Stripe` is the cleanest fit for token-based checkout, fixed package pricing, and future support for recurring-ready flows.
- Even if `v1` only bills fixed offers, the schema already supports `ONE_TIME`, `PACKAGE`, and `RECURRING_READY`.
- Stripe webhooks are reliable for moving cases from `BOOKING_SENT` to `PAID`.

### Postmark
- `Postmark` is the recommended email provider for this MVP.
- This product sends low-volume but high-importance transactional messages: booking links, portal access, materials requests, payment confirmations, and case updates.
- Deliverability and predictable transactional behavior matter more here than marketing tooling.

### Inngest
- `Inngest` is the recommended job runner / scheduler.
- It handles retries, schedules, and observable background work better than ad-hoc cron scripts.
- We need scheduled jobs for upload cleanup, token expiry, slot release, thread transitions to `READ_ONLY`, and notification fanout.

## Enum model

### Product and case enums
- `ProductCode`: `SECOND_OPINION`, `MEDICAL_ROUTE`, `RECOVERY_4_WEEKS`, `PERSONAL_SUPPORT`
- `ApplicationStatus`: `NEW`, `UNDER_REVIEW`, `NEEDS_UPLOAD`, `NEEDS_IMAGING_ACCESS`, `REJECTED`, `BOOKING_SENT`, `PAID`, `ACTIVE`, `COMPLETED`, `ARCHIVED`
- `PreferredContact`: `EMAIL`, `PHONE`, `WHATSAPP`, `TELEGRAM`
- `ImagingSourceType`: `UPLOADED`, `EXTERNAL_LINK_ONLY`, `MIXED`

### Roles and permissions
- `UserRole`: `DOCTOR`, `ADMIN`
- `MessageAuthorRole`: `PATIENT`, `DOCTOR`, `ADMIN`, `SYSTEM`

### Files and requirements
- `UploadCategory`: `DOCUMENT`, `IMAGE`, `VIDEO`
- `UploadStatus`: `PENDING`, `ATTACHED`, `DELETED`
- `ExternalLinkKind`: `IMAGING`, `VIDEO`, `CLOUD`
- `RequirementType`: `UPLOAD`, `IMAGING_ACCESS`
- `RequirementStatus`: `OPEN`, `RESOLVED`

### Booking and billing
- `ChargeModel`: `ONE_TIME`, `PACKAGE`, `RECURRING_READY`
- `OfferStatus`: `OPEN`, `HELD`, `PAID`, `EXPIRED`, `CANCELLED`
- `SlotStatus`: `AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`
- `AppointmentStatus`: `SCHEDULED`, `COMPLETED`, `CANCELLED`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

### Messaging and token lifecycle
- `MessageMode`: `CLARIFICATION_WINDOW`, `SUPPORT_PACKAGE`
- `ThreadStatus`: `INACTIVE`, `ACTIVE`, `READ_ONLY`, `CLOSED`
- `ReadOnlyReason`: `WINDOW_EXPIRED`, `MESSAGE_LIMIT_REACHED`, `PACKAGE_ENDED`, `MANUAL_LOCK`, `CASE_STATUS_CHANGE`
- `CloseReason`: `CASE_COMPLETED`, `CASE_ARCHIVED`, `MANUAL_CLOSE`, `REJECTED`
- `TokenPurpose`: `BOOKING`, `PORTAL_ACCESS`, `MATERIALS`

### Audit
- `AuditActorType`: `SYSTEM`, `USER`, `PATIENT`
- `AuditEntityType`: `APPLICATION`, `REQUIREMENT`, `OFFER`, `SLOT`, `PAYMENT`, `THREAD`, `MESSAGE`, `TOKEN`, `UPLOAD`, `EXTERNAL_LINK`, `SETTING`

## Core rules captured in schema

### Contact rules
- `patients` and questionnaire require: `full_name`, `email`, `phone`, `preferred_contact`, `country`, `city`, `timezone`
- `email` is mandatory for system notifications and token delivery
- `phone` is mandatory as backup contact
- `preferred_contact` is an operational preference, not the replacement for system email delivery

### Product/public rules
- All 4 products are public
- Products `1` and `3` are actively sold
- Products `2` and `4` are public and routed into the same questionnaire flow for individual fit assessment
- `/doctor` is part of the public `P0` trust contour

### Message center rules
- Product 1: `72 hours`, up to `3` patient messages
- Product 2: `7 days`, up to `5` patient messages
- Product 3: active for package duration, by support policy
- Product 4: active for package duration, by support policy
- Product 1 and 2 threads are only follow-up clarification windows
- They are not for a new case, not for a second full review, and not for new large MRI/video/zip submissions without doctor decision
- When the window ends, thread becomes `READ_ONLY`
- `readOnlyReason` and `closeReason` are explicitly stored

### Files / imaging / Radiant workflow
- Questionnaire and application detail support:
  - document uploads
  - image uploads
  - video uploads
  - external imaging links
  - archive password / access instructions
  - review note for doctor
- Video rules:
  - `mp4` and `mov` only
  - max `3` videos
  - max `120` seconds per video
  - max `250 MB` per video
  - max `600 MB` total
  - anything larger goes to external link flow
- `archive_password` and `access_instructions` are encrypted at rest
- They are only visible in application detail for doctor/admin and never included in email, export, or broad logs
- `v1` does not render DICOM in browser
- The system collects file/link/password/instructions and gives doctor:
  - `download archive`
  - `open external link`
  - `copy password`
- Review happens locally in `Radiant`

### Token and timing rules
- Held slot TTL: `20 minutes`
- Offer expiration TTL: `72 hours` by default, configurable
- `booking`, `portal`, and `materials` tokens are single-purpose, hashed, expiring, revocable
- Portal access token TTL: `24 hours`
- Materials token TTL: `7 days` or until requirement resolution

### Operational hardening rules
- Abandoned uploads:
  - upload starts as `PENDING`
  - if not attached within `24 hours`, mark `DELETED` and remove storage object
  - cleanup job runs every `6 hours`
- Minimal audit trail records:
  - application submitted
  - status changed
  - requirement requested / resolved
  - offer created / revoked
  - slot held / released
  - payment paid / failed
  - thread opened / read-only / closed
  - message sent
  - sensitive revealed / copied
- Audit never stores passwords or raw access instructions

## Project structure

```text
src/
  app/
    (public)/
      page.tsx
      doctor/page.tsx
      services/page.tsx
      services/second-opinion/page.tsx
      services/medical-route/page.tsx
      services/recovery-4-weeks/page.tsx
      services/personal-support/page.tsx
      how-it-works/page.tsx
      questionnaire/page.tsx
      not-suitable/page.tsx
      booking/[token]/page.tsx
      payment/success/page.tsx
      legal/offer/page.tsx
      legal/privacy/page.tsx
      legal/consent/page.tsx
    portal/
      access/[token]/page.tsx
      messages/page.tsx
      materials/[token]/page.tsx
    admin/
      login/page.tsx
      dashboard/page.tsx
      applications/page.tsx
      applications/[id]/page.tsx
      booking-links/page.tsx
      calendar/page.tsx
      payments/page.tsx
      settings/page.tsx
    api/
      questionnaire/route.ts
      uploads/presign/route.ts
      uploads/complete/route.ts
      booking/[token]/route.ts
      booking/[token]/hold-slot/route.ts
      booking/[token]/checkout/route.ts
      webhooks/stripe/route.ts
      portal/access/consume/route.ts
      portal/thread/route.ts
      portal/thread/messages/route.ts
      portal/materials/[token]/presign/route.ts
      portal/materials/[token]/complete/route.ts
      portal/materials/[token]/links/route.ts
      admin/dashboard/route.ts
      admin/applications/route.ts
      admin/applications/[id]/route.ts
      admin/applications/[id]/request-upload/route.ts
      admin/applications/[id]/request-imaging-access/route.ts
      admin/applications/[id]/reject/route.ts
      admin/applications/[id]/create-offer/route.ts
      admin/applications/[id]/activate/route.ts
      admin/applications/[id]/complete/route.ts
      admin/messages/threads/[id]/reply/route.ts
      admin/messages/threads/[id]/close/route.ts
      admin/calendar/slots/route.ts
      admin/calendar/slots/[id]/route.ts
      admin/payments/route.ts
      admin/settings/route.ts
  components/
    public/
    forms/
    admin/
    portal/
    ui/
  features/
    applications/
      schema.ts
      service.ts
      repository.ts
      policies.ts
      mappers.ts
    uploads/
      schema.ts
      service.ts
      storage.ts
      policies.ts
    offers/
      service.ts
      pricing.ts
      tokens.ts
    booking/
      service.ts
      slots.ts
      policies.ts
    payments/
      service.ts
      stripe.ts
      webhooks.ts
    messages/
      service.ts
      policies.ts
      thread-state.ts
    requirements/
      service.ts
    tokens/
      service.ts
      hashing.ts
    audit/
      service.ts
    settings/
      service.ts
  lib/
    db/
    auth/
    email/
    jobs/
    validators/
    security/
    utils/
  emails/
    booking-link.tsx
    portal-access.tsx
    materials-request.tsx
    payment-success.tsx
    thread-notification.tsx
  jobs/
    cleanup-abandoned-uploads.ts
    expire-offers.ts
    release-held-slots.ts
    expire-access-tokens.ts
    transition-threads-read-only.ts
  types/
    api.ts
    domain.ts
    ui.ts
prisma/
  schema.prisma
  migrations/
public/
docs/
```

## Separation of concerns

### Frontend
- `src/app` contains routes and page composition
- `src/components` contains presentation-only UI

### Domain/backend
- `src/features` owns business logic by domain
- Each feature keeps validation, service logic, policies, and repository layer together

### Infra
- `src/lib/db` for Prisma client and transaction helpers
- `src/lib/auth` for staff authentication and portal session bootstrapping
- `src/lib/email` for Postmark adapters and template sending
- `src/lib/jobs` for Inngest registration and job utilities
- `src/lib/security` for token hashing, field encryption, and permission helpers

### Uploads
- Files do not live in the app filesystem
- Upload logic lives in `src/features/uploads`
- Storage adapters live in `src/features/uploads/storage.ts`

## Constraints to enforce in app code and SQL migrations
- Video count / duration / size rules
- Slot hold TTL release
- Offer expiry release
- Thread transition to read-only after window expiration or limit reached
- Sensitive field exclusion from serializers, exports, emails, and logs
- Single active token semantics by purpose when newer token supersedes older one

## Route map

### UI routes
- `/`
- `/doctor`
- `/services`
- `/services/second-opinion`
- `/services/medical-route`
- `/services/recovery-4-weeks`
- `/services/personal-support`
- `/how-it-works`
- `/questionnaire`
- `/not-suitable`
- `/booking/:token`
- `/payment/success`
- `/portal/access/:token`
- `/portal/messages`
- `/portal/materials/:token`
- `/legal/offer`
- `/legal/privacy`
- `/legal/consent`
- `/admin/login`
- `/admin/dashboard`
- `/admin/applications`
- `/admin/applications/:id`
- `/admin/booking-links`
- `/admin/calendar`
- `/admin/payments`
- `/admin/settings`

### API routes by domain

#### Public intake
- `POST /api/questionnaire`
- `POST /api/uploads/presign`
- `POST /api/uploads/complete`

#### Booking and payment
- `GET /api/booking/:token`
- `POST /api/booking/:token/hold-slot`
- `POST /api/booking/:token/checkout`
- `POST /api/webhooks/stripe`

#### Patient portal
- `POST /api/portal/access/consume`
- `GET /api/portal/thread`
- `POST /api/portal/thread/messages`
- `POST /api/portal/materials/:token/presign`
- `POST /api/portal/materials/:token/complete`
- `POST /api/portal/materials/:token/links`

#### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/applications`
- `GET /api/admin/applications/:id`
- `POST /api/admin/applications/:id/request-upload`
- `POST /api/admin/applications/:id/request-imaging-access`
- `POST /api/admin/applications/:id/reject`
- `POST /api/admin/applications/:id/create-offer`
- `POST /api/admin/applications/:id/activate`
- `POST /api/admin/applications/:id/complete`
- `POST /api/admin/messages/threads/:id/reply`
- `POST /api/admin/messages/threads/:id/close`
- `GET /api/admin/calendar/slots`
- `POST /api/admin/calendar/slots`
- `PATCH /api/admin/calendar/slots/:id`
- `DELETE /api/admin/calendar/slots/:id`
- `GET /api/admin/payments`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

## API contract checklist

### `POST /api/questionnaire`
- Request:
  - patient contact block
  - intended product or null
  - clinical summary
  - red flags
  - uploads and external links metadata
  - legal acceptance versions
- Response:
  - `applicationId`
  - `status`
  - `nextStep`
- Validation:
  - `email`, `phone`, `preferred_contact`, `country`, `city`, `timezone` required
  - `chiefComplaint` required
  - red flag structure required
  - upload categories must match allowed mime/extension rules
- Errors:
  - `400 validation_error`
  - `409 duplicate_upload_reference`
  - `413 payload_too_large`

### `POST /api/uploads/presign`
- Request:
  - `applicationId` or draft reference
  - category
  - filename
  - mime type
  - file size
  - duration if video
- Response:
  - `uploadUrl`
  - `storageKey`
  - `headers`
- Validation:
  - category-specific mime rules
  - video limits
- Errors:
  - `400 validation_error`
  - `413 file_policy_violation`

### `POST /api/uploads/complete`
- Request:
  - `applicationId`
  - `storageKey`
  - category
  - file metadata
  - optional encrypted access data payload input
- Response:
  - persisted upload summary
- Validation:
  - storage key must exist and belong to pending upload
- Errors:
  - `404 upload_not_found`
  - `409 upload_already_attached`

### `GET /api/booking/:token`
- Response:
  - offer summary
  - allowed slot list
  - expiry data
- Errors:
  - `404 token_not_found`
  - `410 token_expired`
  - `403 token_revoked`

### `POST /api/booking/:token/hold-slot`
- Request:
  - `slotId`
- Response:
  - hold confirmation
  - `holdExpiresAt`
- Validation:
  - slot must be `AVAILABLE`
  - offer token must still be valid
- Errors:
  - `409 slot_unavailable`
  - `410 offer_expired`

### `POST /api/booking/:token/checkout`
- Request:
  - `slotId`
  - billing confirmation payload
- Response:
  - Stripe checkout/session payload
- Validation:
  - slot must still be held by this offer
- Errors:
  - `409 hold_missing_or_expired`
  - `410 offer_expired`

### `POST /api/portal/access/consume`
- Request:
  - token
- Response:
  - portal session established
  - case summary
  - thread policy
- Errors:
  - `404 token_not_found`
  - `410 token_expired`
  - `403 token_revoked`

### `GET /api/portal/thread`
- Response:
  - thread meta
  - policy
  - remaining message count if capped
  - chronological messages
- Errors:
  - `403 portal_session_required`
  - `404 thread_not_found`

### `POST /api/portal/thread/messages`
- Request:
  - message body
- Response:
  - persisted message
  - updated thread counts/status
- Validation:
  - text only in `v1`
  - thread must be `ACTIVE`
  - product 1/2 message limit enforcement
- Errors:
  - `403 thread_read_only`
  - `409 message_limit_reached`
  - `422 empty_message`

### `POST /api/portal/materials/:token/presign`
- Request:
  - category
  - filename
  - mime type
  - size
  - duration if video
- Response:
  - presigned upload data
- Validation:
  - requirement token must be valid and open
  - same upload policy as questionnaire
- Errors:
  - `403 invalid_requirement_token`
  - `410 requirement_closed`

### `POST /api/portal/materials/:token/links`
- Request:
  - external links array
  - access instructions
  - review note delta if allowed
- Response:
  - saved material link summary
- Validation:
  - valid URLs
  - requirement token open
- Errors:
  - `422 invalid_url`
  - `410 requirement_closed`

### Admin contract rules
- `GET /api/admin/*` returns normalized list/detail payloads without sensitive access fields unless endpoint is application detail
- `GET /api/admin/applications/:id` includes masked sensitive fields plus permission-gated `canReveal`, `canCopy`
- mutation routes return:
  - updated entity summary
  - new case status if changed
  - audit event id when relevant
- common admin errors:
  - `401 unauthorized`
  - `403 forbidden`
  - `404 not_found`
  - `409 invalid_state_transition`

## Implementation start order by sprint

### Sprint 1: foundation and public shell
- initialize Next.js with App Router and TypeScript
- set up Prisma, PostgreSQL connection, and baseline migrations
- seed `ProductConfig` and baseline `AppSetting`
- configure staff auth skeleton
- build public layout, navigation, homepage, doctor page, services index, 4 product pages, legal pages
- add design tokens and component primitives for premium private-practice UI

### Sprint 2: intake and medical materials
- implement questionnaire form and validation
- implement application creation flow
- implement red flags capture
- implement presigned uploads for document/image/video
- implement external imaging links and access fields
- implement upload state lifecycle: `PENDING`, `ATTACHED`, `DELETED`
- implement imaging source auto-classification
- implement legal acceptance persistence
- add abandoned upload cleanup job

### Sprint 3: admin review and requirements
- build admin dashboard counters
- build applications list and filters
- build application detail with:
  - uploads
  - external links
  - masked sensitive access
  - Reveal / Copy actions
  - doctor notes
- implement `needs_upload` and `needs_imaging_access` flows
- implement materials request tokens and `/portal/materials/:token`
- implement minimal audit trail including sensitive access reveal/copy

### Sprint 4: offers, slots, and payments
- build booking link creation flow
- build booking links admin screen
- build calendar slot management
- implement hold-slot logic with `20 minute` TTL
- implement booking page resolution by token
- implement Stripe checkout and webhook handling
- implement offer expiry with `72 hour` default TTL
- create appointments on successful booking/payment
- build payment success screen and system notifications

### Sprint 5: message center and lifecycle
- implement case-scoped portal access tokens
- build `/portal/messages`
- build staff reply flow in application detail
- implement per-product thread policies:
  - product 1 clarification window
  - product 2 clarification window
  - product 3 support package
  - product 4 support package
- enforce text-only portal messages in `v1`
- enforce read-only transitions and capture `readOnlyReason` / `closeReason`
- add thread expiry jobs and message notifications

### Sprint 6: hardening and pilot readiness
- verify permissions across public, portal, and admin surfaces
- verify sensitive-field serialization guards
- verify token hashing, expiry, revocation, and single-purpose use
- verify slot release and expired offer cleanup
- verify audit coverage for critical actions
- mobile QA across public pages, questionnaire, booking, and portal
- UAT with test cases for all 4 products
- launch checklist and pilot-ready freeze
