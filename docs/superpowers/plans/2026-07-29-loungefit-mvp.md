# LoungeFit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build and deploy a responsive LoungeFit group-class booking MVP whose reservation, pass, and waitlist state remains consistent under concurrent requests.

**Architecture:** Implement one modular Next.js App Router application with server-only domain modules and Server Actions/Route Handlers backed by Neon PostgreSQL. Keep core state changes in PostgreSQL transactions, serialize capacity changes by locking the class occurrence row, and reject overlapping confirmed bookings with a PostgreSQL exclusion constraint. Must-have work is completed and verified with Cron disabled before any PWA, Web Push, reporting, CSV export, or advanced retry work begins.

**Tech Stack:** Next.js App Router, TypeScript, React, Drizzle ORM, postgres.js, PostgreSQL 16/Neon, Zod, Luxon, bcryptjs, Vitest, Testing Library, Playwright, ESLint, Vercel.

## Global Constraints

- The approved source of truth is docs/superpowers/specs/2026-07-29-loungefit-design.md.
- Use one modular monolith. Do not add a separate backend, microservices, Redis, a message broker, or native mobile applications.
- Store timestamps in UTC and make all booking boundaries from database time rendered in Asia/Seoul.
- Complete and verify Tasks 1-25 before starting Tasks 26-30.
- The Must-have scope is group-class booking, immediate pass debit, eligible cancellation restore, waitlist processing, and best-effort in-app notifications.
- The single active product is one shared Pilates/Yoga group-class pass usable at every branch. Revenue data belongs to the selling branch; usage data belongs to the class branch.
- Booking is open from 14 days before class until strictly before one hour before class. Member cancellation is allowed through exactly two hours before class.
- A normal confirmed reservation counts as usage whether the member attends or is a no-show. Do not create attendance or no-show controls.
- Core correctness must work with Vercel Cron completely disabled. Cancellation advances the queue in the same request; acceptance rechecks database time; related requests lazily expire offers.
- Attempt in-app notification storage only after the core transaction commits. Notification failure is logged and never rolls back booking, pass, or waitlist state. Do not implement a transactional Outbox.
- Do not implement member self-sign-up, online payment, personal training, unlimited passes, Kakao Alimtalk, SMS, member CSV import, general audit history, or admin notification resend.
- Keep secrets out of source, browser bundles, test snapshots, and command-line arguments. Commit only example environment files.
- Every feature task follows RED → GREEN → REFACTOR, runs its targeted verification, and ends with the proposed commit.

## Planned File Map

- package.json, package-lock.json: pinned scripts and dependencies.
- src/app: App Router pages, layouts, Server Actions, and Route Handlers.
- src/components: focused client and server UI components.
- src/server/db: database client, migrations interface, and schema modules.
- src/server/auth: password, token, invitation, reset, and session behavior.
- src/server/authorization: role and branch ownership guards.
- src/server/scheduling: recurring templates, occurrences, exceptions, and schedule queries.
- src/server/passes: pass issuance, selection, ledger, and member views.
- src/server/bookings: reservation rules, transaction orchestration, and cancellation.
- src/server/waitlist: enrollment, promotion, offers, acceptance, and lazy cleanup.
- src/server/notifications: best-effort in-app notifications and member inbox.
- src/server/reporting: post-Must-have report queries and CSV formatting.
- drizzle: ordered SQL migrations plus Drizzle metadata.
- tests/unit: deterministic pure and UI tests without PostgreSQL.
- tests/integration: real PostgreSQL constraints, transactions, and concurrency tests.
- tests/e2e: Playwright member and administrator journeys.
- .github/workflows/ci.yml: type, lint, unit, PostgreSQL integration, and Playwright gates.

## Fixed Database and Concurrency Decisions

1. Use PostgreSQL READ COMMITTED transactions and SELECT ... FOR UPDATE on class_occurrences before counting confirmed reservations or active offers. Every reservation, cancellation-driven promotion, offer acceptance, class cancellation, and capacity change acquires this lock first.
2. Capacity consumption is confirmed reservations plus OFFERED waitlist rows. Holding an offer therefore reserves one seat.
3. A partial unique index allows only one CONFIRMED reservation for a member and occurrence. A unique request_id makes booking retries idempotent.
4. reservations stores starts_at and ends_at snapshots. A BEFORE INSERT OR UPDATE trigger overwrites those columns from class_occurrences so callers cannot forge the interval.
5. Enable btree_gist and add a GiST exclusion constraint on member_id and tstzrange(starts_at, ends_at, '[)') for CONFIRMED rows. Overlaps fail with PostgreSQL code 23P01; back-to-back classes are allowed.
6. Pass rows are locked in expires_at, issued_at, id order. A conditional remaining_credits > 0 update plus the same-transaction pass_ledger insert prevents double debit.
7. Queue order is joined_at, id. Partial unique indexes prevent duplicate active waitlist entries, and state-conditional updates make promotion and lazy cleanup idempotent.
8. Core domain commits before in-app notification insertion. Notification dedupe_key prevents duplicate successful inserts, but failed inserts have no eventual-delivery guarantee.

---

## Must-have Tasks

### Task 1: Bootstrap the App and Verification Toolchain

**Files:**
- Create: package.json
- Create: package-lock.json
- Create: tsconfig.json
- Create: next-env.d.ts
- Create: next.config.ts
- Create: eslint.config.mjs
- Create: vitest.config.ts
- Create: vitest.setup.ts
- Create: playwright.config.ts
- Create: .gitignore
- Create: src/app/layout.tsx
- Create: src/app/page.tsx
- Create: src/app/globals.css
- Create: tests/unit/app/home-page.test.tsx

**Interfaces:**
- Consumes: none.
- Produces: npm scripts dev, build, start, typecheck, lint, test:unit, and test:e2e; the src alias @/*; a renderable App Router root.

- [ ] **Step 1: Install and pin the project toolchain**

Run:

    npm init -y
    npm install --save-exact next react react-dom drizzle-orm postgres zod luxon bcryptjs
    npm install --save-dev --save-exact typescript @types/node @types/react @types/react-dom @types/luxon eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsx drizzle-kit dotenv-cli

Expected: package.json and package-lock.json are created, and npm reports zero installation errors. Configure these exact scripts and configure Vitest for jsdom unit tests plus a separate Node integration project:

    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test:unit": "vitest run tests/unit",
    "test:e2e": "playwright test"

- [ ] **Step 2: Write the failing home-page test**

Create tests/unit/app/home-page.test.tsx:

    import { render, screen } from '@testing-library/react';
    import HomePage from '@/app/page';

    it('identifies the LoungeFit booking service', () => {
      render(<HomePage />);
      expect(screen.getByRole('heading', { name: '라운지핏' })).toBeVisible();
    });

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/unit/app/home-page.test.tsx

Expected: FAIL because src/app/page.tsx does not yet export the required LoungeFit heading.

- [ ] **Step 4: Implement the minimum App Router shell**

Create src/app/page.tsx with a server component whose main element contains an h1 named 라운지핏. Create layout.tsx with Korean metadata and globals.css with mobile-first color, spacing, focus, and 44px minimum touch-target variables. Do not add feature navigation yet.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/app/home-page.test.tsx

Expected: PASS, 1 test.

- [ ] **Step 6: REFACTOR configuration names and imports**

Keep test setup in vitest.setup.ts, use @/* for src imports, and keep package scripts as direct wrappers without duplicated flags.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run test:unit

Expected: all three commands exit 0; unit output reports 1 passing test.

- [ ] **Step 8: Commit**

    git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts .gitignore src/app tests/unit/app
    git commit -m "chore: bootstrap LoungeFit application"

### Task 2: Add PostgreSQL Harness and Identity Schema

**Files:**
- Create: compose.yaml
- Create: .env.test.example
- Create: drizzle.config.ts
- Create: src/server/env.ts
- Create: src/server/db/client.ts
- Create: src/server/db/schema/enums.ts
- Create: src/server/db/schema/identity.ts
- Create: src/server/db/schema/index.ts
- Create: drizzle/0000_identity.sql
- Create: drizzle/meta/_journal.json
- Create: drizzle/meta/0000_snapshot.json
- Create: tests/integration/helpers/database.ts
- Create: tests/integration/db/identity-schema.test.ts
- Modify: package.json

**Interfaces:**
- Consumes: Task 1 npm and TypeScript configuration.
- Produces: getDb(), closeDb(), resetDatabase(), Branch, User, Invitation, and Session tables; DATABASE_URL and DATABASE_URL_TEST validation; db:generate, db:migrate:test, and test:db scripts.

- [ ] **Step 1: Start an isolated PostgreSQL 16 test database**

Define a compose service named postgres-test on port 55432 with database loungefit_test, healthcheck pg_isready, and a named test-only volume.

Run:

    docker compose up -d postgres-test
    docker compose ps

Expected: postgres-test is healthy. Copy .env.test.example to untracked .env.test with DATABASE_URL_TEST pointing at localhost:55432.

- [ ] **Step 2: Write the failing identity-schema test**

Create a Node-environment integration test that migrates the database, inserts a branch and user, and asserts a second user with the same normalized phone fails:

    await expect(
      db.insert(users).values(secondUserWithSamePhone)
    ).rejects.toMatchObject({ code: '23505' });

Also assert invitation token_hash and session token_hash reject duplicates.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/db/identity-schema.test.ts

Expected: FAIL with relation branches or users does not exist.

- [ ] **Step 4: Implement the identity migration and typed schema**

Create enums user_role = HEAD_ADMIN, BRANCH_ADMIN, INSTRUCTOR, MEMBER; user_status = INVITED, ACTIVE, DISABLED; invitation_purpose = INVITE, PASSWORD_RESET.

Create:

- branches: UUID primary key, name, address, is_active, created_at, updated_at.
- users: UUID primary key, role, phone, password_hash nullable until activation, status, default_branch_id nullable foreign key, last_login_at, created_at, updated_at.
- invitations: UUID primary key, user_id, purpose, token_hash, expires_at, used_at, invalidated_at, created_by, created_at.
- sessions: UUID primary key, user_id, token_hash, expires_at, created_at.

Add exact indexes:

    CREATE UNIQUE INDEX users_phone_uq ON users (phone);
    CREATE UNIQUE INDEX invitations_token_hash_uq ON invitations (token_hash);
    CREATE INDEX invitations_user_purpose_created_idx ON invitations (user_id, purpose, created_at DESC);
    CREATE UNIQUE INDEX sessions_token_hash_uq ON sessions (token_hash);
    CREATE INDEX sessions_user_expires_idx ON sessions (user_id, expires_at);

Make deletion restrictive for business users and cascading only for sessions and invitations belonging to a deleted test user. Generate the migration with:

    npm run db:generate -- --name identity
    npm run db:migrate:test

Expected: drizzle/0000_identity.sql and matching metadata are generated and applied once.

Configure package.json scripts exactly:

    "db:generate": "drizzle-kit generate",
    "db:migrate:test": "dotenv -e .env.test -- drizzle-kit migrate",
    "test:db": "dotenv -e .env.test -- vitest run tests/integration"

drizzle.config.ts must use DATABASE_URL_MIGRATIONS when present, otherwise DATABASE_URL_TEST, and must never print the selected URL.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/db/identity-schema.test.ts

Expected: PASS; duplicate phone, invitation token, and session token assertions report PostgreSQL code 23505.

- [ ] **Step 6: REFACTOR test cleanup**

Centralize connection creation and reverse-dependency TRUNCATE logic in tests/integration/helpers/database.ts. Do not share an open transaction between concurrency tests.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/db/identity-schema.test.ts

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

    git add compose.yaml .env.test.example drizzle.config.ts package.json src/server/env.ts src/server/db drizzle/0000_identity.sql drizzle/meta tests/integration/helpers tests/integration/db/identity-schema.test.ts
    git commit -m "feat: add identity database schema"

### Task 3: Add Scheduling and Pass Schema

**Files:**
- Create: src/server/db/schema/scheduling.ts
- Create: src/server/db/schema/passes.ts
- Create: drizzle/0001_scheduling_passes.sql
- Create: drizzle/meta/0001_snapshot.json
- Create: tests/integration/db/scheduling-pass-schema.test.ts
- Modify: src/server/db/schema/index.ts
- Modify: drizzle/meta/_journal.json

**Interfaces:**
- Consumes: branches and users from Task 2.
- Produces: ClassTemplate, ClassOccurrence, PassProduct, and Pass tables with typed Drizzle exports.

- [ ] **Step 1: Write the failing schema test**

Test that class occurrence template/date pairs are unique, capacity and duration must be positive, pass remaining credits cannot be negative or exceed total credits, and two active pass products cannot coexist.

    await expect(
      db.insert(passProducts).values(secondActiveProduct)
    ).rejects.toMatchObject({ code: '23505' });

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/db/scheduling-pass-schema.test.ts

Expected: FAIL because class_templates, class_occurrences, pass_products, and passes do not exist.

- [ ] **Step 3: Implement the typed schema and migration**

Create:

- class_templates: branch_id, name, weekday constrained 1-7, local_start_time, duration_minutes, default_instructor_id, default_capacity, is_active.
- class_occurrences: template_id, class_date, starts_at, ends_at, branch_id, instructor_id, capacity, status NORMAL or CANCELLED, is_date_override.
- pass_products: name, default_credits, default_valid_days, default_price, is_active.
- passes: member_id, product_id, selling_branch_id, paid_amount, total_credits, remaining_credits, starts_on, expires_on, issued_by, issued_at.

Add exact constraints and indexes:

    UNIQUE (template_id, class_date)
    CHECK (duration_minutes > 0)
    CHECK (default_capacity > 0)
    CHECK (capacity > 0)
    CHECK (ends_at > starts_at)
    CHECK (total_credits > 0)
    CHECK (remaining_credits BETWEEN 0 AND total_credits)
    CREATE UNIQUE INDEX pass_products_one_active_uq ON pass_products ((true)) WHERE is_active;
    CREATE INDEX class_occurrences_branch_starts_idx ON class_occurrences (branch_id, starts_at);
    CREATE INDEX class_occurrences_instructor_starts_idx ON class_occurrences (instructor_id, starts_at);
    CREATE INDEX passes_member_expiry_idx ON passes (member_id, expires_on, issued_at);

Run:

    npm run db:generate -- --name scheduling_passes
    npm run db:migrate:test

Expected: drizzle/0001_scheduling_passes.sql applies after 0000_identity.sql.

- [ ] **Step 4: Run GREEN**

Run:

    npm exec vitest run tests/integration/db/scheduling-pass-schema.test.ts

Expected: PASS for all check and uniqueness cases.

- [ ] **Step 5: REFACTOR schema exports**

Keep tables in responsibility-specific files and export them only through src/server/db/schema/index.ts.

- [ ] **Step 6: Verify the task**

Run:

    npm run typecheck
    npm exec vitest run tests/integration/db

Expected: identity and scheduling/pass schema suites pass.

- [ ] **Step 7: Commit**

    git add src/server/db/schema drizzle/0001_scheduling_passes.sql drizzle/meta tests/integration/db/scheduling-pass-schema.test.ts
    git commit -m "feat: add scheduling and pass schema"

### Task 4: Add Booking, Ledger, Waitlist, and Notification Constraints

**Files:**
- Create: src/server/db/schema/bookings.ts
- Create: src/server/db/schema/notifications.ts
- Create: drizzle/0002_booking_constraints.sql
- Create: drizzle/meta/0002_snapshot.json
- Create: tests/integration/db/booking-constraints.test.ts
- Modify: src/server/db/schema/index.ts
- Modify: drizzle/meta/_journal.json

**Interfaces:**
- Consumes: occurrences and passes from Task 3.
- Produces: Reservation, PassLedger, WaitlistEntry, and Notification tables; database-enforced no-overlap and idempotency guarantees.

- [ ] **Step 1: Write failing constraint tests**

Insert two overlapping confirmed reservations for one member and assert the second fails with 23P01. Insert back-to-back intervals and assert both succeed. Also test duplicate request_id, duplicate active member/occurrence reservation, duplicate active waitlist entry, ledger dedupe_key, and notification dedupe_key.

    await expect(insertOverlappingReservation())
      .rejects.toMatchObject({ code: '23P01' });

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/db/booking-constraints.test.ts

Expected: FAIL because reservation and waitlist relations and the exclusion constraint do not exist.

- [ ] **Step 3: Implement the tables and ordinary indexes**

Create reservation_status = CONFIRMED, MEMBER_CANCELLED, CLASS_CANCELLED; waitlist_status = WAITING, OFFERED, CONFIRMED, DECLINED, EXPIRED, CANCELLED, SKIPPED; ledger_type = ISSUE, RESERVATION_DEBIT, MEMBER_CANCEL_RESTORE, CLASS_CANCEL_RESTORE.

Create:

- reservations: member_id, occurrence_id, pass_id, status, request_id, starts_at, ends_at, booked_at, cancelled_at.
- pass_ledger: pass_id, reservation_id nullable, type, delta, dedupe_key, created_at.
- waitlist_entries: member_id, occurrence_id, status, joined_at, offer_expires_at, resolved_at, resolution_reason.
- notifications: member_id, type, title, body, target_path, expires_at, read_at, dedupe_key, created_at.

Add:

    CREATE UNIQUE INDEX reservations_request_id_uq ON reservations (request_id);
    CREATE UNIQUE INDEX reservations_active_member_occurrence_uq
      ON reservations (member_id, occurrence_id) WHERE status = 'CONFIRMED';
    CREATE INDEX reservations_occurrence_status_idx ON reservations (occurrence_id, status);
    CREATE UNIQUE INDEX pass_ledger_dedupe_key_uq ON pass_ledger (dedupe_key);
    CREATE INDEX pass_ledger_pass_created_idx ON pass_ledger (pass_id, created_at);
    CREATE UNIQUE INDEX waitlist_active_member_occurrence_uq
      ON waitlist_entries (member_id, occurrence_id)
      WHERE status IN ('WAITING', 'OFFERED');
    CREATE INDEX waitlist_queue_idx ON waitlist_entries (occurrence_id, status, joined_at, id);
    CREATE UNIQUE INDEX notifications_dedupe_key_uq ON notifications (dedupe_key);
    CREATE INDEX notifications_member_created_idx ON notifications (member_id, created_at DESC);

- [ ] **Step 4: Generate the base migration**

Run:

    npm run db:generate -- --name booking_constraints

Expected: drizzle/0002_booking_constraints.sql and drizzle/meta/0002_snapshot.json are created from the typed tables and ordinary indexes.

- [ ] **Step 5: Implement database-enforced time-overlap prevention**

Append exact PostgreSQL objects to drizzle/0002_booking_constraints.sql:

    CREATE EXTENSION IF NOT EXISTS btree_gist;

    CREATE FUNCTION sync_reservation_interval() RETURNS trigger
    LANGUAGE plpgsql AS $function$
    BEGIN
      SELECT starts_at, ends_at
        INTO NEW.starts_at, NEW.ends_at
        FROM class_occurrences
       WHERE id = NEW.occurrence_id;
      IF NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN
        RAISE EXCEPTION 'class occurrence not found';
      END IF;
      RETURN NEW;
    END;
    $function$;

    CREATE TRIGGER reservations_sync_interval
      BEFORE INSERT OR UPDATE OF occurrence_id ON reservations
      FOR EACH ROW EXECUTE FUNCTION sync_reservation_interval();

    ALTER TABLE reservations ADD CONSTRAINT reservations_member_time_no_overlap
      EXCLUDE USING gist (
        member_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      ) WHERE (status = 'CONFIRMED');

The '[)' range is mandatory so a class ending at 10:00 does not overlap one starting at 10:00.

- [ ] **Step 6: Run migrations and GREEN**

Run:

    npm run db:migrate:test
    npm exec vitest run tests/integration/db/booking-constraints.test.ts

Expected: migration applies; overlap fails with 23P01; back-to-back and all idempotency cases pass.

- [ ] **Step 7: REFACTOR PostgreSQL error helpers**

Create typed helpers in tests/integration/helpers/database.ts for extracting codes 23505, 23514, and 23P01 without string-matching full database messages.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm exec vitest run tests/integration/db

Expected: all schema and constraint suites pass.

- [ ] **Step 9: Commit**

    git add src/server/db/schema drizzle/0002_booking_constraints.sql drizzle/meta tests/integration
    git commit -m "feat: enforce booking database constraints"

### Task 5: Implement Deterministic Time and Pass-Selection Rules

**Files:**
- Create: src/server/shared/result.ts
- Create: src/server/time/clock.ts
- Create: src/server/time/seoul.ts
- Create: src/server/bookings/booking-window.ts
- Create: src/server/waitlist/waitlist-window.ts
- Create: src/server/passes/select-pass.ts
- Create: tests/unit/bookings/booking-window.test.ts
- Create: tests/unit/waitlist/waitlist-window.test.ts
- Create: tests/unit/passes/select-pass.test.ts

**Interfaces:**
- Consumes: UTC timestamps and pass rows defined in Tasks 3-4.
- Produces: Clock.now(), evaluateBookingWindow(now, startsAt), evaluateWaitlistWindow(now, startsAt), calculateOfferExpiry(now, startsAt), and selectPass(candidates, classStartsAt).

- [ ] **Step 1: Write failing boundary tests**

Cover exactly 14 days, one hour, two hours, four hours, 30 minutes, and one hour-before-class boundaries. For pass selection, exclude zero-credit and class-date-expired passes, sort by earliest expiresOn, then oldest issuedAt, then id.

    expect(evaluateBookingWindow(openBoundary, classStart)).toEqual({
      canBook: true,
      canCancel: true,
    });

    expect(selectPass(candidates, classStart)?.id).toBe('earliest-expiry');

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/bookings tests/unit/waitlist tests/unit/passes

Expected: FAIL because the rule modules do not exist.

- [ ] **Step 3: Implement minimum pure functions**

Use injected Date objects and Luxon only for Asia/Seoul conversion. Return OFFER_AUTO before four hours, OFFER_ACCEPT from four hours through strictly before one hour, and CLOSED at one hour. calculateOfferExpiry returns the earlier of now plus 30 minutes and class start minus one hour.

- [ ] **Step 4: Run GREEN**

Run:

    npm exec vitest run tests/unit/bookings tests/unit/waitlist tests/unit/passes

Expected: all boundary and ordering tests pass without timers or sleeping.

- [ ] **Step 5: REFACTOR repeated date comparisons**

Keep a single Clock interface and comparison helpers; do not read Date.now() inside domain rules.

- [ ] **Step 6: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run test:unit

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

    git add src/server/shared src/server/time src/server/bookings/booking-window.ts src/server/waitlist/waitlist-window.ts src/server/passes/select-pass.ts tests/unit/bookings tests/unit/waitlist tests/unit/passes
    git commit -m "feat: add booking and pass domain rules"

### Task 6: Implement Password Login and Opaque Sessions

**Files:**
- Create: src/server/auth/password.ts
- Create: src/server/auth/token.ts
- Create: src/server/auth/session.ts
- Create: src/server/auth/login.ts
- Create: src/app/(auth)/login/page.tsx
- Create: src/app/(auth)/login/actions.ts
- Create: src/app/(auth)/logout/actions.ts
- Create: tests/unit/auth/password.test.ts
- Create: tests/integration/auth/session-login.test.ts
- Modify: src/app/page.tsx
- Modify: src/server/env.ts

**Interfaces:**
- Consumes: users and sessions from Task 2, Clock from Task 5.
- Produces: hashPassword(plain), verifyPassword(plain, hash), hashToken(token), hashSessionToken(token, sessionSecret), login(phone, password), createSession(userId), getCurrentSession(), requireSession(), and logout().

- [ ] **Step 1: Write failing password and session tests**

The unit test asserts bcrypt hashes differ from plaintext and verify correctly. The integration test activates a user, logs in with a normalized phone, stores only an HMAC-SHA-256 session token hash keyed by SESSION_SECRET, rejects a wrong password, and rejects expired sessions.

    const result = await login('010-1234-5678', 'correct-password');
    expect(result.ok).toBe(true);
    expect(await sessionRow()).not.toHaveProperty('tokenHash', result.value.token);

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/auth/password.test.ts tests/integration/auth/session-login.test.ts

Expected: FAIL because password, token, and session functions do not exist.

- [ ] **Step 3: Implement minimum authentication behavior**

Normalize Korean mobile numbers to digits, hash passwords with bcryptjs cost 12, create 32-byte random opaque tokens, persist invitation/reset tokens with SHA-256 and session tokens with HMAC-SHA-256 using SESSION_SECRET, and expire sessions after seven days. Set cookie lf_session as HttpOnly, SameSite=Lax, Path=/, and Secure outside local development. login returns INVALID_CREDENTIALS for all phone/password mismatches without revealing account existence.

Use this public result shape:

    type LoginResult =
      | { ok: true; value: { userId: string; token: string; expiresAt: Date } }
      | { ok: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' };

- [ ] **Step 4: Add the login and logout Server Actions**

Validate form data with Zod, call login(), set or clear the cookie only after the service succeeds, and redirect authenticated users by role. The page must contain phone and password labels and an error summary with aria-live.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/auth/password.test.ts tests/integration/auth/session-login.test.ts

Expected: all password, normalization, login, expiry, and storage assertions pass.

- [ ] **Step 6: REFACTOR cookie access behind one adapter**

Keep Next.js cookies() calls out of password and repository modules so tests use an in-memory CookieStore interface.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/auth tests/integration/auth

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

    git add -- src/server/auth "src/app/(auth)" src/app/page.tsx src/server/env.ts tests/unit/auth tests/integration/auth
    git commit -m "feat: add secure member sessions"

### Task 7: Implement Admin Invitations and Password Reset

**Files:**
- Create: src/server/auth/invitations.ts
- Create: src/server/members/member-service.ts
- Create: src/app/(admin)/admin/members/page.tsx
- Create: src/app/(admin)/admin/members/actions.ts
- Create: src/app/(admin)/admin/members/member-form.tsx
- Create: src/app/(auth)/invite/[token]/page.tsx
- Create: src/app/(auth)/invite/[token]/actions.ts
- Create: src/app/(auth)/reset/[token]/page.tsx
- Create: src/app/(auth)/reset/[token]/actions.ts
- Create: tests/integration/auth/invitations.test.ts
- Create: tests/unit/auth/invitation-forms.test.tsx

**Interfaces:**
- Consumes: password/token utilities and identity schema from Tasks 2 and 6.
- Produces: createMemberAndInvitation(input), createPasswordReset(userId), consumeInvitation(token, password), and copyable URLs /invite/{token} and /reset/{token}.

- [ ] **Step 1: Write failing invitation lifecycle tests**

Assert invite tokens expire after seven days and are single-use. Assert reset tokens expire after 30 minutes. Creating another unused token for the same user and purpose must set invalidated_at on the older token in the same transaction.

    const second = await createPasswordReset(memberId);
    expect(await firstTokenRow()).toMatchObject({ invalidatedAt: expect.any(Date) });
    await expect(consumeInvitation(first.rawToken, 'new-password'))
      .resolves.toMatchObject({ ok: false, error: 'TOKEN_INVALID' });

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/auth/invitations.test.ts tests/unit/auth/invitation-forms.test.tsx

Expected: FAIL because invitation services and pages do not exist.

- [ ] **Step 3: Implement minimum invitation transactions**

createMemberAndInvitation validates a unique phone, creates an INVITED MEMBER, invalidates prior INVITE tokens, stores only the new token hash, and returns the raw token once. consumeInvitation locks the invitation row, checks purpose, invalidated_at, used_at, and database-time expiry, stores the password hash, activates the user, and marks used_at atomically. Reset consumption changes the password, marks the token used, and deletes all user sessions in the same transaction.

- [ ] **Step 4: Implement administrator and token pages**

The admin form accepts phone and default branch and displays a copy button for the generated link. It must state that the administrator sends the link through an existing channel; it must not call Kakao, SMS, or email APIs. Invite and reset pages accept a new password twice and never expose the stored token hash.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/auth/invitations.test.ts tests/unit/auth/invitation-forms.test.tsx

Expected: lifecycle, expiry, invalidation, activation, reset, and rendering tests pass.

- [ ] **Step 6: REFACTOR shared token consumption**

Share row-locking and expiry validation while keeping INVITE activation and PASSWORD_RESET session revocation as separate explicit branches.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/auth tests/integration/auth

Expected: all authentication tests pass.

- [ ] **Step 8: Commit**

    git add -- src/server/auth/invitations.ts src/server/members "src/app/(admin)/admin/members" "src/app/(auth)/invite" "src/app/(auth)/reset" tests/integration/auth tests/unit/auth
    git commit -m "feat: add managed member invitations"

### Task 8: Enforce Role and Branch Authorization

**Files:**
- Create: src/server/authorization/permissions.ts
- Create: src/server/authorization/guards.ts
- Create: src/app/(member)/layout.tsx
- Create: src/app/(admin)/admin/layout.tsx
- Create: src/app/(instructor)/instructor/layout.tsx
- Create: src/app/forbidden/page.tsx
- Create: tests/unit/authorization/permissions.test.ts
- Create: tests/integration/authorization/guards.test.ts
- Modify: src/app/(admin)/admin/members/actions.ts

**Interfaces:**
- Consumes: requireSession() from Task 6 and user role/defaultBranchId from Task 2.
- Produces: can(permission, actor, resource), requireRole(roles), requireBranchAccess(branchId), requireOwnMember(memberId), and requireAssignedOccurrence(occurrenceId).

- [ ] **Step 1: Write the failing permission matrix**

Define table-driven tests for HEAD_ADMIN, BRANCH_ADMIN, INSTRUCTOR, and MEMBER. Include denial of instructor pass changes and attendance changes, denial of cross-branch branch-admin access, and member access only to personal data.

    expect(can('PASS_ISSUE', instructor, branchResource)).toBe(false);
    expect(can('MEMBER_READ', branchAdmin, otherBranchMember)).toBe(false);
    expect(can('OCCURRENCE_ROSTER_READ', instructor, assignedOccurrence)).toBe(true);

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/authorization tests/integration/authorization

Expected: FAIL because permission and guard modules do not exist.

- [ ] **Step 3: Implement the minimum explicit permission map**

Do not infer access from hidden navigation. Each guard loads the resource server-side and returns a typed FORBIDDEN result or redirects to /forbidden in layouts. HEAD_ADMIN can access every branch; BRANCH_ADMIN is restricted to default_branch_id; INSTRUCTOR can read only occurrences whose instructor_id matches; MEMBER can read and change only their own member records.

- [ ] **Step 4: Apply guards to existing administrator actions**

Member creation, invitation generation, and reset generation must call requireRole and requireBranchAccess before reading or writing scoped data.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/authorization tests/integration/authorization

Expected: all role, branch, ownership, and assigned-class cases pass.

- [ ] **Step 6: REFACTOR resource loading**

Return minimal authorization projections instead of full member or occurrence records; keep authorization queries free of UI formatting.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/authorization tests/integration/authorization

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

    git add -- src/server/authorization "src/app/(member)/layout.tsx" "src/app/(admin)/admin/layout.tsx" "src/app/(instructor)" src/app/forbidden "src/app/(admin)/admin/members/actions.ts" tests/unit/authorization tests/integration/authorization
    git commit -m "feat: enforce role and branch access"

### Task 9: Add Branch and Staff Administration

**Files:**
- Create: src/server/branches/branch-service.ts
- Create: src/server/staff/staff-service.ts
- Create: src/app/(admin)/admin/branches/page.tsx
- Create: src/app/(admin)/admin/branches/actions.ts
- Create: src/app/(admin)/admin/staff/page.tsx
- Create: src/app/(admin)/admin/staff/actions.ts
- Create: src/components/admin/branch-form.tsx
- Create: src/components/admin/staff-form.tsx
- Create: tests/integration/admin/branches-staff.test.ts
- Create: tests/unit/admin/branches-staff-forms.test.tsx

**Interfaces:**
- Consumes: identity schema and authorization guards from Tasks 2 and 8.
- Produces: createBranch(), updateBranch(), createStaff(), updateStaffAssignment(), listVisibleBranches(), and listVisibleStaff().

- [ ] **Step 1: Write failing service and form tests**

Assert only HEAD_ADMIN can create branches or assign HEAD_ADMIN roles. Assert a BRANCH_ADMIN can create an INSTRUCTOR assigned to their branch but cannot target another branch. Validate unique phone and required branch for BRANCH_ADMIN and INSTRUCTOR.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/admin/branches-staff.test.ts tests/unit/admin/branches-staff-forms.test.tsx

Expected: FAIL because branch and staff services do not exist.

- [ ] **Step 3: Implement minimum branch and staff services**

Use Zod input schemas and authorization before each transaction. Staff accounts start INVITED and reuse createMemberAndInvitation with the requested staff role. Do not add deletion; set is_active or user status to DISABLED to preserve foreign keys.

- [ ] **Step 4: Implement administrator pages**

Create accessible tables and forms showing only the actor's allowed branches. Display generated staff invitation links exactly once after successful creation.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/admin/branches-staff.test.ts tests/unit/admin/branches-staff-forms.test.tsx

Expected: role and branch-scoping tests pass.

- [ ] **Step 6: REFACTOR form result handling**

Use one serializable ActionResult type for validation, forbidden, conflict, and success states.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/admin tests/unit/admin

Expected: all current administrator tests pass.

- [ ] **Step 8: Commit**

    git add -- src/server/branches src/server/staff "src/app/(admin)/admin/branches" "src/app/(admin)/admin/staff" src/components/admin tests/integration/admin tests/unit/admin
    git commit -m "feat: add branch and staff administration"

### Task 10: Manage Weekly Class Templates

**Files:**
- Create: src/server/scheduling/template-service.ts
- Create: src/app/(admin)/admin/schedule/templates/page.tsx
- Create: src/app/(admin)/admin/schedule/templates/actions.ts
- Create: src/components/admin/class-template-form.tsx
- Create: tests/integration/scheduling/class-templates.test.ts
- Create: tests/unit/scheduling/class-template-form.test.tsx

**Interfaces:**
- Consumes: scheduling schema, branch/instructor records, and branch guards.
- Produces: createClassTemplate(), updateClassTemplate(), deactivateClassTemplate(), and listClassTemplatesForActor().

- [ ] **Step 1: Write failing template tests**

Assert weekday is 1-7, duration and capacity are positive, the instructor is active, and branch administrators cannot manage templates outside their branch. Verify updating a template does not mutate already-created occurrences.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/scheduling/class-templates.test.ts tests/unit/scheduling/class-template-form.test.tsx

Expected: FAIL because template service and form do not exist.

- [ ] **Step 3: Implement the minimum template service**

Persist branch, name, weekday, local start time, duration, default instructor, and default capacity. Use Asia/Seoul local values only at the template boundary; occurrences will hold UTC timestamps. Deactivation stops future materialization and never deletes history.

- [ ] **Step 4: Implement the administrator template page**

Provide create, edit, and deactivate controls with server-side authorization and validation. Do not add rooms, class categories, recurring-rule libraries, or automatic substitute matching.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/scheduling/class-templates.test.ts tests/unit/scheduling/class-template-form.test.tsx

Expected: validation, authorization, immutability, and UI tests pass.

- [ ] **Step 6: REFACTOR local-time conversion input**

Centralize HH:mm validation and weekday labels without moving occurrence generation into the form layer.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling tests/unit/scheduling

Expected: all current scheduling tests pass.

- [ ] **Step 8: Commit**

    git add -- src/server/scheduling/template-service.ts "src/app/(admin)/admin/schedule/templates" src/components/admin/class-template-form.tsx tests/integration/scheduling tests/unit/scheduling
    git commit -m "feat: manage weekly class templates"

### Task 11: Materialize 14-Day Occurrences and Date Exceptions

**Files:**
- Create: src/server/scheduling/occurrence-materializer.ts
- Create: src/server/scheduling/occurrence-service.ts
- Create: src/app/(admin)/admin/schedule/occurrences/page.tsx
- Create: src/app/(admin)/admin/schedule/occurrences/actions.ts
- Create: src/components/admin/occurrence-exception-form.tsx
- Create: tests/unit/scheduling/occurrence-materializer.test.ts
- Create: tests/integration/scheduling/occurrences.test.ts

**Interfaces:**
- Consumes: templates from Task 10, Seoul time utilities from Task 5, booking and waitlist tables from Task 4.
- Produces: materializeOccurrences(branchId, fromDate, throughDate), updateOccurrenceException(), and listOccurrences(). No Cron is used.

- [ ] **Step 1: Write failing materialization tests**

Given a Tuesday 09:00 Seoul template, assert the next 14-day range creates only matching Tuesdays with UTC starts/ends. Repeating the call must return the same rows. Assert a saved instructor/capacity exception survives another materialization call.

    const first = await materializeOccurrences(branchId, '2026-07-29', '2026-08-11');
    const second = await materializeOccurrences(branchId, '2026-07-29', '2026-08-11');
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/scheduling/occurrence-materializer.test.ts tests/integration/scheduling/occurrences.test.ts

Expected: FAIL because occurrence materialization does not exist.

- [ ] **Step 3: Implement minimum idempotent materialization**

Build local date/time with Luxon in Asia/Seoul, convert to UTC, and INSERT ... ON CONFLICT (template_id, class_date) DO NOTHING. Read the persisted rows after insertion. Never overwrite existing occurrence fields during materialization.

- [ ] **Step 4: Implement exception validation and page**

Allow an authorized administrator to change instructor or capacity on one occurrence and set is_date_override. Before reducing capacity, lock the occurrence and reject a value below confirmed reservation count plus OFFERED waitlist count. Do not implement cancellation in this task; Task 20 owns the restore-and-close workflow.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/scheduling/occurrence-materializer.test.ts tests/integration/scheduling/occurrences.test.ts

Expected: timezone, idempotency, exception persistence, authorization, and capacity-floor tests pass.

- [ ] **Step 6: REFACTOR date-range iteration**

Keep one inclusive date iterator with an explicit maximum range of 14 days for member queries; administrator queries pass a bounded range separately.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/scheduling tests/integration/scheduling

Expected: all scheduling tests pass.

- [ ] **Step 8: Commit**

    git add -- src/server/scheduling "src/app/(admin)/admin/schedule/occurrences" src/components/admin/occurrence-exception-form.tsx tests/unit/scheduling tests/integration/scheduling
    git commit -m "feat: materialize class occurrences"

### Task 12: Issue the Shared Group-Class Pass

**Files:**
- Create: src/server/passes/pass-service.ts
- Create: src/server/passes/pass-queries.ts
- Create: src/app/(admin)/admin/passes/issue/page.tsx
- Create: src/app/(admin)/admin/passes/issue/actions.ts
- Create: src/components/admin/pass-issue-form.tsx
- Create: src/app/(member)/passes/page.tsx
- Create: tests/integration/passes/pass-issuance.test.ts
- Create: tests/unit/passes/pass-issue-form.test.tsx

**Interfaces:**
- Consumes: pass tables, ledger table, branch/member authorization, selectPass() ordering.
- Produces: issuePass(input), listMemberPasses(memberId), and ensureSingleActiveProduct().

- [ ] **Step 1: Write failing issuance tests**

Assert issuance stores member, selling branch, actual paid amount, total credits, remaining credits, start and expiry dates, and issuing administrator. Assert pass plus ISSUE ledger commit together and roll back together. Assert branch administrators cannot issue for another branch.

    expect(await ledgerFor(pass.id)).toMatchObject({
      type: 'ISSUE',
      delta: 10,
      dedupeKey: 'pass:' + pass.id + ':issue',
    });

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/passes/pass-issuance.test.ts tests/unit/passes/pass-issue-form.test.tsx

Expected: FAIL because pass issuance and UI modules do not exist.

- [ ] **Step 3: Implement the minimum issuance transaction**

Load the one active pass product, validate actual credits, amount, startsOn, and expiresOn, insert the pass with remaining_credits equal to total_credits, and insert the ISSUE ledger in one transaction. The selling branch is recorded but does not restrict later usage.

- [ ] **Step 4: Implement administrator issuance and member pass pages**

The administrator page displays product defaults but permits actual amount, credit count, and validity changes. The member page lists only the current member's passes with selling branch, validity, and remaining/total credits. It does not accept payment.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/passes/pass-issuance.test.ts tests/unit/passes/pass-issue-form.test.tsx

Expected: transaction, branch, default, and rendering tests pass.

- [ ] **Step 6: REFACTOR pass projections**

Return separate admin and member view types so password, phone, and internal ledger dedupe keys never reach member components.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/passes tests/integration/passes

Expected: all pass tests pass.

- [ ] **Step 8: Commit**

    git add -- src/server/passes "src/app/(admin)/admin/passes" "src/app/(member)/passes" src/components/admin/pass-issue-form.tsx tests/unit/passes tests/integration/passes
    git commit -m "feat: issue shared group class passes"

### Task 13: Show the Member 14-Day Schedule

**Files:**
- Create: src/server/scheduling/member-schedule-query.ts
- Create: src/app/(member)/schedule/page.tsx
- Create: src/components/member/branch-filter.tsx
- Create: src/components/member/class-card.tsx
- Create: tests/integration/scheduling/member-schedule.test.ts
- Create: tests/unit/member/class-card.test.tsx
- Modify: src/app/(member)/layout.tsx
- Modify: src/app/page.tsx

**Interfaces:**
- Consumes: materializeOccurrences(), booking-window rules, current member session.
- Produces: getMemberSchedule({ memberId, branchId, now }) returning 14 days of occurrence cards with capacity summary and booking-window state.

- [ ] **Step 1: Write failing schedule-query and card tests**

Assert the range begins on the Seoul calendar date containing now and ends 13 dates later, includes all three active branches, excludes cancelled occurrences from bookable results, and labels open, full, closed, and cancelled states.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member/class-card.test.tsx

Expected: FAIL because the member schedule query and components do not exist.

- [ ] **Step 3: Implement the minimum schedule query**

Materialize the requested branch range without Cron, count CONFIRMED reservations and OFFERED holds, and return remaining capacity without member private data. Apply booking windows using the injected now and expose absolute UTC timestamps plus preformatted Seoul labels.

- [ ] **Step 4: Implement the responsive member page**

Render a branch filter, date sections, 44px controls, empty state, and class cards. Link cards to /schedule/{occurrenceId}; the detail route is added with booking actions in Task 15.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member/class-card.test.tsx

Expected: range, branch, capacity, state, and responsive component tests pass.

- [ ] **Step 6: REFACTOR card view models**

Keep database rows out of React props; expose one serializable MemberClassCard model.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

    git add -- src/server/scheduling/member-schedule-query.ts "src/app/(member)/schedule" src/components/member "src/app/(member)/layout.tsx" src/app/page.tsx tests/integration/scheduling/member-schedule.test.ts tests/unit/member
    git commit -m "feat: show member class schedule"

### Task 14: Reserve a Class Transactionally Under Concurrency

**Files:**
- Create: src/server/bookings/booking-errors.ts
- Create: src/server/bookings/reservation-repository.ts
- Create: src/server/bookings/reserve-class.ts
- Create: tests/integration/bookings/reserve-class.test.ts
- Create: tests/integration/bookings/reserve-class-concurrency.test.ts
- Modify: tests/integration/helpers/database.ts

**Interfaces:**
- Consumes: booking/pass rules, reservations, passes, ledgers, waitlist entries, and PostgreSQL constraints.
- Produces: reserveClass({ memberId, occurrenceId, requestId, now }): Promise<Result<ReservationView, BookingError>> where BookingError is CLOSED, CANCELLED_CLASS, FULL, WAITLIST_HAS_PRIORITY, DUPLICATE, TIME_OVERLAP, or NO_VALID_PASS.

- [ ] **Step 1: Write failing transaction tests**

Cover successful debit/ledger/reservation atomicity, no valid pass, closed window, cancelled occurrence, active waitlist priority, idempotent request replay, and a forced insert failure rolling back the pass debit. Assert ISSUE plus debit/restore ledger deltas equal the stored remaining credits after every successful transition.

    const result = await reserveClass(input);
    expect(result.ok).toBe(true);
    expect(await remainingCredits(passId)).toBe(9);
    expect(await debitLedgerCount(result.value.id)).toBe(1);

- [ ] **Step 2: Write failing concurrency tests**

Use separate database connections and Promise.all to make two members compete for the last seat; exactly one succeeds. Make one member reserve two overlapping occurrences concurrently; exactly one succeeds and the rejected result is TIME_OVERLAP. Make two requests debit the same one-credit pass; remaining credits never becomes negative.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/bookings/reserve-class.test.ts tests/integration/bookings/reserve-class-concurrency.test.ts

Expected: FAIL because reserveClass does not exist.

- [ ] **Step 4: Implement the minimum locked transaction**

Inside one transaction:

    SELECT id FROM class_occurrences WHERE id = $1 FOR UPDATE;

Then use database current time, validate the occurrence and booking window, return the existing reservation for request_id, reject any WAITING or OFFERED queue, count CONFIRMED reservations plus OFFERED holds, select and lock the first eligible pass ordered by expires_on, issued_at, id, conditionally decrement remaining_credits, insert reservation, and insert a delta -1 ledger with dedupe key reservation:{reservationId}:debit.

Do not catch errors until the transaction has rolled back. Map PostgreSQL 23P01 to TIME_OVERLAP and relevant 23505 request-id races to the already-persisted idempotent result.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/bookings/reserve-class.test.ts tests/integration/bookings/reserve-class-concurrency.test.ts

Expected: all transaction tests pass; concurrency summaries show one winner, no capacity overflow, no overlap, and no negative credit.

- [ ] **Step 6: REFACTOR lock order and result mapping**

Keep lock order occurrence then pass in every booking-related service. Centralize PostgreSQL error-code mapping without weakening database constraints.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings

Expected: all booking integration tests pass repeatedly.

- [ ] **Step 8: Commit**

    git add src/server/bookings tests/integration/bookings tests/integration/helpers/database.ts
    git commit -m "feat: reserve classes transactionally"

### Task 15: Add Member Booking Actions and Reservation Views

**Files:**
- Create: src/app/(member)/schedule/[occurrenceId]/page.tsx
- Create: src/app/(member)/schedule/[occurrenceId]/actions.ts
- Create: src/components/member/booking-button.tsx
- Create: src/app/(member)/reservations/page.tsx
- Create: src/server/bookings/reservation-queries.ts
- Create: tests/unit/member/booking-button.test.tsx
- Create: tests/integration/bookings/booking-action.test.ts
- Modify: src/components/member/class-card.tsx

**Interfaces:**
- Consumes: reserveClass(), current member session, member schedule query.
- Produces: bookOccurrenceAction(formData), class detail page, and listMemberReservations(memberId).

- [ ] **Step 1: Write failing action and component tests**

Assert the action ignores any submitted memberId, generates or accepts a UUID requestId scoped to the form, maps each BookingError to Korean copy, and never retries with a second debit. Assert a booking inside two hours displays the explicit no-cancellation warning before confirmation.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/member/booking-button.test.tsx tests/integration/bookings/booking-action.test.ts

Expected: FAIL because booking action and component do not exist.

- [ ] **Step 3: Implement the minimum booking action**

Derive memberId from requireSession(), validate occurrenceId/requestId with Zod, call reserveClass once, revalidate /schedule and /reservations on success, and return a serializable ActionResult. The detail page reloads server state after every action result.

- [ ] **Step 4: Implement reservation list and booking UI**

Show class, branch, Seoul start time, used pass, status, and later cancellation availability. Do not expose another member's reservation through URL manipulation.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/member/booking-button.test.tsx tests/integration/bookings/booking-action.test.ts

Expected: identity, error-copy, warning, idempotency, and rendering tests pass.

- [ ] **Step 6: REFACTOR action-result presentation**

Use one member ActionMessage component with aria-live rather than duplicating error markup.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/member tests/integration/bookings

Expected: all current member booking tests pass.

- [ ] **Step 8: Commit**

    git add -- "src/app/(member)/schedule/[occurrenceId]" "src/app/(member)/reservations" src/components/member src/server/bookings/reservation-queries.ts tests/unit/member tests/integration/bookings/booking-action.test.ts
    git commit -m "feat: add member class booking flow"

### Task 16: Enroll and Withdraw from a Full-Class Waitlist

**Files:**
- Create: src/server/waitlist/waitlist-errors.ts
- Create: src/server/waitlist/waitlist-service.ts
- Create: src/server/waitlist/waitlist-queries.ts
- Create: src/app/(member)/schedule/[occurrenceId]/waitlist-actions.ts
- Create: src/components/member/waitlist-button.tsx
- Create: tests/integration/waitlist/enrollment.test.ts
- Create: tests/unit/member/waitlist-button.test.tsx
- Modify: src/app/(member)/schedule/[occurrenceId]/page.tsx

**Interfaces:**
- Consumes: occurrence lock convention, current member, pass eligibility, booking windows.
- Produces: joinWaitlist({ memberId, occurrenceId, now }), cancelWaitlist({ memberId, occurrenceId }), getMemberWaitlistState(), joinWaitlistAction(), and cancelWaitlistAction().

- [ ] **Step 1: Write failing waitlist eligibility tests**

Assert joining is allowed only when the class is full, booking is still open, the member has at least one credit valid through class start, and the member has neither a confirmed booking nor an active queue entry. Assert joining does not decrement or reserve a credit.

    const before = await remainingCredits(passId);
    const result = await joinWaitlist(input);
    expect(result.ok).toBe(true);
    expect(await remainingCredits(passId)).toBe(before);

- [ ] **Step 2: Write failing order and cancellation tests**

Insert entries at the same timestamp and assert order falls back to UUID id. Assert member cancellation changes only their active WAITING entry to CANCELLED and cannot cancel another member's entry.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/waitlist/enrollment.test.ts tests/unit/member/waitlist-button.test.tsx

Expected: FAIL because waitlist service, actions, and component do not exist.

- [ ] **Step 4: Implement minimum enrollment transaction**

Lock the occurrence, re-count confirmed plus offered capacity, verify FULL, verify no active reservation/waitlist, query but do not lock or decrement an eligible pass, and insert WAITING with database joined_at. Map partial-unique races to ALREADY_WAITING.

- [ ] **Step 5: Implement waitlist controls**

The class detail page shows Join waitlist only for full eligible classes and Cancel waitlist only for the current member's WAITING entry. It displays the position as a read-time count of WAITING rows ordered before the entry.

- [ ] **Step 6: Run GREEN**

Run:

    npm exec vitest run tests/integration/waitlist/enrollment.test.ts tests/unit/member/waitlist-button.test.tsx

Expected: eligibility, no-debit, stable order, ownership, and UI tests pass.

- [ ] **Step 7: REFACTOR active-state predicates**

Define the WAITING/OFFERED active predicate once in schema query helpers and reuse it in booking, enrollment, and list queries.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/waitlist tests/unit/member/waitlist-button.test.tsx

Expected: all waitlist enrollment tests pass.

- [ ] **Step 9: Commit**

    git add -- src/server/waitlist "src/app/(member)/schedule/[occurrenceId]" src/components/member/waitlist-button.tsx tests/integration/waitlist tests/unit/member/waitlist-button.test.tsx
    git commit -m "feat: add full class waitlist enrollment"

### Task 17: Advance Waiters into Automatic Reservations or Offers

**Files:**
- Create: src/server/bookings/confirm-on-locked-occurrence.ts
- Create: src/server/waitlist/advance-waitlist.ts
- Create: tests/integration/waitlist/advance-waitlist.test.ts
- Create: tests/integration/waitlist/advance-waitlist-concurrency.test.ts
- Modify: src/server/bookings/reserve-class.ts
- Modify: src/server/bookings/reservation-repository.ts

**Interfaces:**
- Consumes: locked occurrence transaction, pass debit rules, overlap constraint, queue ordering.
- Produces: confirmOnLockedOccurrence(tx, input), and advanceWaitlist({ occurrenceId, now }): Promise<AdvanceOutcome[]> where outcomes are AUTO_CONFIRMED, OFFERED, SKIPPED, or CLOSED.

- [ ] **Step 1: Write failing automatic-confirmation tests**

Before four hours, assert the first eligible WAITING member becomes CONFIRMED, receives a reservation and one debit, and later members keep order. Assert a member whose pass became invalid or whose schedule now overlaps becomes SKIPPED with an explicit resolution_reason, then the next eligible member is processed.

- [ ] **Step 2: Write failing offer tests**

From four hours through strictly before one hour, assert the first eligible member becomes OFFERED, no pass is debited, and offer_expires_at equals the earlier of 30 minutes from database now and one hour before class. Assert OFFERED counts against capacity.

- [ ] **Step 3: Write failing concurrency tests**

Call advanceWaitlist concurrently for one vacancy using separate connections. Assert one reservation or offer is created, no member is promoted twice, and capacity is not exceeded.

- [ ] **Step 4: Run RED**

Run:

    npm exec vitest run tests/integration/waitlist/advance-waitlist.test.ts tests/integration/waitlist/advance-waitlist-concurrency.test.ts

Expected: FAIL because advanceWaitlist does not exist.

- [ ] **Step 5: Extract the locked confirmation primitive**

confirmOnLockedOccurrence assumes the caller already holds the occurrence lock. It rechecks member overlap, selects and locks a valid pass, decrements one credit, creates a reservation with an idempotent source request id, creates the debit ledger, and marks a supplied waitlist entry CONFIRMED in the same transaction. reserveClass reuses this primitive after its public eligibility checks.

- [ ] **Step 6: Implement queue advancement**

Lock the occurrence first, compute vacant seats, select WAITING rows by joined_at and id FOR UPDATE, and process until no vacancy or no eligible waiter remains. Before four hours call confirmOnLockedOccurrence. Wrap each automatic confirmation in a SAVEPOINT; if a concurrent insert produces 23P01 or the member becomes ineligible, roll back only that attempt, mark the entry SKIPPED, and continue with the next waiter. In the offer window update one row to OFFERED and persist offer_expires_at. At or after one hour mark remaining active entries EXPIRED.

- [ ] **Step 7: Run GREEN**

Run:

    npm exec vitest run tests/integration/waitlist/advance-waitlist.test.ts tests/integration/waitlist/advance-waitlist-concurrency.test.ts

Expected: automatic, offer, skip, close, capacity, and concurrent idempotency cases pass.

- [ ] **Step 8: REFACTOR transition guards**

Keep every status change as UPDATE ... WHERE status = expected RETURNING and treat zero returned rows as an already-processed no-op.

- [ ] **Step 9: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings tests/integration/waitlist

Expected: reservation and waitlist suites pass together.

- [ ] **Step 10: Commit**

    git add src/server/bookings src/server/waitlist/advance-waitlist.ts tests/integration/waitlist
    git commit -m "feat: advance class waitlists"

### Task 18: Accept Offers and Lazily Expire Them Without Cron

**Files:**
- Create: src/server/waitlist/accept-offer.ts
- Create: src/server/waitlist/lazy-cleanup.ts
- Create: src/app/(member)/waitlist/[entryId]/page.tsx
- Create: src/app/(member)/waitlist/[entryId]/actions.ts
- Create: src/components/member/offer-countdown.tsx
- Create: tests/integration/waitlist/accept-offer.test.ts
- Create: tests/integration/waitlist/lazy-cleanup.test.ts
- Create: tests/unit/member/offer-countdown.test.tsx
- Modify: src/server/scheduling/member-schedule-query.ts
- Modify: src/server/bookings/reservation-queries.ts
- Modify: src/app/(member)/schedule/[occurrenceId]/page.tsx

**Interfaces:**
- Consumes: confirmOnLockedOccurrence(), advanceWaitlist(), database time, current member ownership.
- Produces: acceptOffer({ memberId, entryId }), declineOffer(), cleanupExpiredOffers(occurrenceId), and a server-authoritative offer page.

- [ ] **Step 1: Write the failing acceptance tests**

Assert acceptance locks the occurrence and entry, uses SELECT clock_timestamp() from PostgreSQL, rejects another member, rejects offer_expires_at equal to or before database now, rejects at one hour before class, and atomically debits/creates a reservation for a valid offer.

    const result = await acceptOffer({ memberId, entryId });
    expect(result).toMatchObject({ ok: false, error: 'OFFER_EXPIRED' });
    expect(await reservationCount(memberId, occurrenceId)).toBe(0);

- [ ] **Step 2: Write the failing lazy-cleanup tests**

With Cron disabled, create an expired offer and call cleanupExpiredOffers from a related request. Assert it marks EXPIRED, frees the held seat, advances the next waiter exactly once, and remains idempotent when called concurrently.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/waitlist/accept-offer.test.ts tests/integration/waitlist/lazy-cleanup.test.ts tests/unit/member/offer-countdown.test.tsx

Expected: FAIL because acceptance, cleanup, and offer page do not exist.

- [ ] **Step 4: Implement minimum acceptance and decline**

Acquire locks in order occurrence then waitlist entry. Use database time for expiry and class cutoff, never the browser countdown. On valid acceptance call confirmOnLockedOccurrence inside a SAVEPOINT. If pass eligibility or time overlap fails, roll back that confirmation attempt, mark the entry SKIPPED with its reason, release the held seat, and advance the next waiter. On decline or expired acceptance, conditionally release the offer and invoke queue advancement in the same request after the state transition.

- [ ] **Step 5: Implement lazy cleanup entry points**

Call cleanupExpiredOffers before returning the member schedule, class detail, reservation list, offer page, and waitlist-related actions. Cleanup selects only occurrences involved in the current request; it never scans the full database.

- [ ] **Step 6: Implement the countdown as display only**

The client component receives an absolute expiresAt and displays remaining time. Its button always submits to the server; zero displayed time disables the button but is not the authorization check.

- [ ] **Step 7: Run GREEN**

Run:

    npm exec vitest run tests/integration/waitlist/accept-offer.test.ts tests/integration/waitlist/lazy-cleanup.test.ts tests/unit/member/offer-countdown.test.tsx

Expected: acceptance, ownership, true expiry, lazy advancement, idempotency, and display tests pass with no Cron.

- [ ] **Step 8: REFACTOR cleanup callers**

Expose one cleanupExpiredOffers(occurrenceId) function and keep route/query wrappers responsible only for choosing relevant occurrence ids.

- [ ] **Step 9: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/waitlist tests/unit/member/offer-countdown.test.tsx

Expected: all waitlist tests pass with no timer waits.

- [ ] **Step 10: Commit**

    git add -- src/server/waitlist "src/app/(member)/waitlist" src/components/member/offer-countdown.tsx src/server/scheduling/member-schedule-query.ts src/server/bookings/reservation-queries.ts "src/app/(member)/schedule/[occurrenceId]/page.tsx" tests/integration/waitlist tests/unit/member/offer-countdown.test.tsx
    git commit -m "feat: accept and lazily expire waitlist offers"

### Task 19: Cancel Reservations, Restore Credits, and Advance the Queue Immediately

**Files:**
- Create: src/server/bookings/cancel-reservation.ts
- Create: src/app/(member)/reservations/actions.ts
- Create: src/components/member/cancel-reservation-button.tsx
- Create: tests/integration/bookings/cancel-reservation.test.ts
- Create: tests/integration/bookings/cancel-queue-advance.test.ts
- Create: tests/unit/member/cancel-reservation-button.test.tsx
- Modify: src/app/(member)/reservations/page.tsx

**Interfaces:**
- Consumes: booking window, reservation/pass ledger, advanceWaitlist(), current member.
- Produces: cancelReservation({ memberId, reservationId }): Promise<CancelResult> and cancelReservationAction().

- [ ] **Step 1: Write failing cancellation and restore tests**

Assert cancellation at exactly two hours is allowed, one millisecond later is rejected, only CONFIRMED owned reservations can change, restore is written once with dedupe key reservation:{id}:restore, and reservation status plus pass increment plus ledger commit or roll back together.

- [ ] **Step 2: Write the failing immediate-advance test**

With Cron disabled, cancel a reservation with a waiting queue. Assert the cancellation transaction commits, then the same service request calls advanceWaitlist and returns its outcome. Force queue advancement to fail and assert cancellation/restore remain committed while a structured error is logged.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/bookings/cancel-reservation.test.ts tests/integration/bookings/cancel-queue-advance.test.ts tests/unit/member/cancel-reservation-button.test.tsx

Expected: FAIL because cancellation service and controls do not exist.

- [ ] **Step 4: Implement the cancellation transaction**

Lock the occurrence, then lock the reservation and pass. Compare database now to starts_at minus two hours. Conditionally update CONFIRMED to MEMBER_CANCELLED, increment the original pass once, and insert MEMBER_CANCEL_RESTORE in one transaction.

- [ ] **Step 5: Invoke queue advancement after commit**

After the transaction returns success, immediately call advanceWaitlist(occurrenceId) in the same server request. Catch and log only the advancement failure with request, occurrence, and error type; never reopen the committed cancellation.

- [ ] **Step 6: Implement member controls and GREEN**

Show cancellation only for owned confirmed reservations through the deadline and explain that later cancellation is unavailable.

Run:

    npm exec vitest run tests/integration/bookings/cancel-reservation.test.ts tests/integration/bookings/cancel-queue-advance.test.ts tests/unit/member/cancel-reservation-button.test.tsx

Expected: deadline, idempotent restore, immediate advancement, failure isolation, and UI tests pass.

- [ ] **Step 7: REFACTOR post-commit work**

Represent advancement as a typed postCommit result so a warning can be logged without changing the successful cancellation result.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings tests/integration/waitlist tests/unit/member

Expected: all booking, queue, and member control tests pass with Cron disabled.

- [ ] **Step 9: Commit**

    git add -- src/server/bookings/cancel-reservation.ts "src/app/(member)/reservations" src/components/member/cancel-reservation-button.tsx tests/integration/bookings tests/unit/member
    git commit -m "feat: cancel bookings and advance waiters"

### Task 20: Cancel Classes and Show Authorized Rosters

**Files:**
- Create: src/server/scheduling/cancel-occurrence.ts
- Create: src/server/scheduling/roster-query.ts
- Create: src/app/(admin)/admin/classes/[occurrenceId]/page.tsx
- Create: src/app/(admin)/admin/classes/[occurrenceId]/actions.ts
- Create: src/app/(instructor)/instructor/classes/[occurrenceId]/page.tsx
- Create: src/components/admin/class-roster.tsx
- Create: tests/integration/scheduling/cancel-occurrence.test.ts
- Create: tests/integration/scheduling/roster-authorization.test.ts
- Create: tests/unit/admin/class-roster.test.tsx
- Modify: src/app/(admin)/admin/schedule/occurrences/actions.ts

**Interfaces:**
- Consumes: occurrence/reservation/pass/waitlist tables and authorization guards.
- Produces: cancelOccurrence(), updateOccurrenceCapacity(), updateOccurrenceInstructor(), and getAuthorizedRoster().

- [ ] **Step 1: Write failing class-cancellation tests**

Assert one locked transaction sets occurrence CANCELLED, changes every CONFIRMED reservation to CLASS_CANCELLED, restores each original pass once, adds CLASS_CANCEL_RESTORE ledgers, and closes WAITING/OFFERED entries. Running it again is an idempotent no-op.

- [ ] **Step 2: Write failing roster and exception tests**

Assert head admin sees any roster, branch admin only their branch, instructor only assigned classes, and member never sees a roster. Assert capacity cannot fall below confirmed plus OFFERED holds. Assert instructor changes are manual date exceptions only.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/scheduling/cancel-occurrence.test.ts tests/integration/scheduling/roster-authorization.test.ts tests/unit/admin/class-roster.test.tsx

Expected: FAIL because cancellation and roster services do not exist.

- [ ] **Step 4: Implement the minimum class-cancellation transaction**

Lock occurrence first, then affected reservations and passes in stable id order. Use conditional status transitions and reservation:{id}:restore dedupe keys. Close waitlists and offers without debiting any pass. Commit all restores or none.

- [ ] **Step 5: Implement roster and date-exception pages**

Show confirmed reservations and queue order but no attendance/no-show fields or controls. Reuse the capacity floor from Task 11 and require explicit administrator selection for instructor changes.

- [ ] **Step 6: Run GREEN**

Run:

    npm exec vitest run tests/integration/scheduling/cancel-occurrence.test.ts tests/integration/scheduling/roster-authorization.test.ts tests/unit/admin/class-roster.test.tsx

Expected: restore, queue close, idempotency, authorization, capacity, and no-attendance UI tests pass.

- [ ] **Step 7: REFACTOR bulk restore helpers**

Keep bulk restore inside the class-cancellation transaction and reuse only ledger-key construction, not the member cancellation orchestration.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling tests/unit/admin

Expected: all occurrence and roster tests pass.

- [ ] **Step 9: Commit**

    git add -- src/server/scheduling "src/app/(admin)/admin/classes" "src/app/(instructor)/instructor/classes" src/components/admin/class-roster.tsx "src/app/(admin)/admin/schedule/occurrences/actions.ts" tests/integration/scheduling tests/unit/admin
    git commit -m "feat: cancel classes and expose rosters"

### Task 21: Build the Best-Effort In-App Notification Module and Inbox

**Files:**
- Create: src/server/logging/logger.ts
- Create: src/server/notifications/notification-types.ts
- Create: src/server/notifications/notification-service.ts
- Create: src/server/notifications/notification-queries.ts
- Create: src/app/(member)/notifications/page.tsx
- Create: src/app/(member)/notifications/actions.ts
- Create: src/components/member/notification-list.tsx
- Create: tests/integration/notifications/notification-service.test.ts
- Create: tests/unit/member/notification-list.test.tsx
- Modify: src/app/(member)/layout.tsx

**Interfaces:**
- Consumes: notifications table and current-member ownership.
- Produces: NotificationInput, tryCreateNotification(input), listNotifications(memberId), markNotificationRead(memberId, notificationId), and a structured Logger.error(event, fields).

- [ ] **Step 1: Write failing storage, dedupe, and ownership tests**

Assert a successful insert appears newest-first, the same dedupe_key produces one row, a member can mark only their own notification read, target_path is a same-origin relative path, and expires_at remains available for offer display.

- [ ] **Step 2: Write the failing error-isolation test**

Inject a repository that throws and assert tryCreateNotification returns a failure result rather than throwing. Verify Logger receives only type, businessId, memberId, errorType, and failedAt; it must not receive body, phone, password, or token data.

    expect(await tryCreateNotification(input, failingRepository))
      .toEqual({ ok: false, error: 'NOTIFICATION_STORE_FAILED' });
    expect(logger.error).toHaveBeenCalledWith(
      'notification.store_failed',
      expect.not.objectContaining({ body: expect.anything(), phone: expect.anything() })
    );

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/notifications/notification-service.test.ts tests/unit/member/notification-list.test.tsx

Expected: FAIL because notification service and inbox do not exist.

- [ ] **Step 4: Implement minimum best-effort storage**

Validate notification type, title, body, relative target path, optional expiry, and deterministic dedupe key. Catch storage errors only inside tryCreateNotification, emit the minimized structured log, and return failure. Do not retry, create an Outbox row, or expose an administrator resend API.

- [ ] **Step 5: Implement member inbox and read action**

List only the signed-in member's notifications. Render unread state, created time in Seoul, optional absolute expiry, and target link. Mark-read uses a member_id predicate and returns success even if the row was already read.

- [ ] **Step 6: Run GREEN**

Run:

    npm exec vitest run tests/integration/notifications/notification-service.test.ts tests/unit/member/notification-list.test.tsx

Expected: persistence, dedupe, ownership, failure isolation, privacy, and UI tests pass.

- [ ] **Step 7: REFACTOR notification projections**

Keep database error objects inside the logger adapter and return only a serializable MemberNotification model to React.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/notifications tests/unit/member/notification-list.test.tsx

Expected: all notification tests pass.

- [ ] **Step 9: Commit**

    git add -- src/server/logging src/server/notifications "src/app/(member)/notifications" src/components/member/notification-list.tsx "src/app/(member)/layout.tsx" tests/integration/notifications tests/unit/member/notification-list.test.tsx
    git commit -m "feat: add best effort in app notifications"

### Task 22: Emit Business Notifications After Core Commits

**Files:**
- Create: src/server/notifications/business-notifications.ts
- Create: tests/integration/notifications/business-events.test.ts
- Create: tests/integration/notifications/failure-isolation.test.ts
- Modify: src/server/passes/pass-service.ts
- Modify: src/server/bookings/reserve-class.ts
- Modify: src/server/bookings/cancel-reservation.ts
- Modify: src/server/waitlist/waitlist-service.ts
- Modify: src/server/waitlist/advance-waitlist.ts
- Modify: src/server/waitlist/accept-offer.ts
- Modify: src/server/waitlist/lazy-cleanup.ts
- Modify: src/server/scheduling/cancel-occurrence.ts
- Modify: src/server/scheduling/occurrence-service.ts

**Interfaces:**
- Consumes: committed service results and tryCreateNotification().
- Produces: notifyBusinessEvents(events), deterministic notification dedupe keys, and event types PASS_ISSUED, RESERVATION_CONFIRMED, RESERVATION_CANCELLED, WAITLIST_JOINED, WAITLIST_CANCELLED, WAITLIST_AUTO_CONFIRMED, WAITLIST_OFFERED, WAITLIST_EXPIRED, WAITLIST_SKIPPED, CLASS_CHANGED, and CLASS_CANCELLED.

- [ ] **Step 1: Write failing event-coverage tests**

For each event type, run the real service and assert the core transaction is visible before the notification insert is attempted. Verify offer notifications include absolute expires_at and /waitlist/{entryId}; booking events link to /reservations. A date-specific instructor or capacity change notifies every confirmed member with CLASS_CHANGED after the occurrence update commits.

- [ ] **Step 2: Write failing notification-failure tests**

Force notification insertion to fail for pass issuance, direct reservation, member cancellation, automatic promotion, offer creation, offer expiry, and class cancellation. Assert every core result remains committed and a structured log is emitted.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/notifications/business-events.test.ts tests/integration/notifications/failure-isolation.test.ts

Expected: FAIL because business services do not emit notification attempts.

- [ ] **Step 4: Implement minimum post-commit event mapping**

Each service collects plain events inside its transaction result but calls notifyBusinessEvents only after the transaction promise resolves. For cancellation, run immediate queue advancement first, then notify the cancellation and returned advancement outcomes. Notification failures are accumulated for logs and never change the service's success result.

Use deterministic keys:

    pass:{passId}:issued
    reservation:{reservationId}:confirmed
    reservation:{reservationId}:cancelled
    waitlist:{entryId}:joined
    waitlist:{entryId}:cancelled
    waitlist:{entryId}:auto-confirmed
    waitlist:{entryId}:offered
    waitlist:{entryId}:expired
    waitlist:{entryId}:skipped
    occurrence:{occurrenceId}:changed:{updatedAt}:{memberId}
    occurrence:{occurrenceId}:cancelled:{memberId}

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/notifications/business-events.test.ts tests/integration/notifications/failure-isolation.test.ts

Expected: every event appears once on success; all forced failures preserve booking/pass/waitlist state and create sanitized logs.

- [ ] **Step 6: REFACTOR event factories**

Keep Korean title/body construction in business-notifications.ts and keep domain services responsible only for event facts and target identifiers.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/passes tests/integration/bookings tests/integration/waitlist tests/integration/scheduling tests/integration/notifications

Expected: all PostgreSQL integration suites pass with notification failure injection enabled.

- [ ] **Step 8: Commit**

    git add src/server/notifications/business-notifications.ts src/server/passes/pass-service.ts src/server/bookings src/server/waitlist src/server/scheduling/cancel-occurrence.ts src/server/scheduling/occurrence-service.ts tests/integration/notifications
    git commit -m "feat: emit post commit business notifications"

### Task 23: Add Must-Have Browser Journeys and CI Gates

**Files:**
- Create: scripts/test/reset-e2e-db.ts
- Create: scripts/test/seed-e2e.ts
- Create: tests/e2e/auth.spec.ts
- Create: tests/e2e/member-booking.spec.ts
- Create: tests/e2e/waitlist.spec.ts
- Create: tests/e2e/admin-class-cancellation.spec.ts
- Create: tests/e2e/authorization.spec.ts
- Create: .github/workflows/ci.yml
- Modify: package.json
- Modify: playwright.config.ts

**Interfaces:**
- Consumes: all Must-have services and pages from Tasks 1-22.
- Produces: deterministic E2E fixtures, npm run verify:must-have, and a GitHub Actions gate with Cron absent.

- [ ] **Step 1: Write the failing Playwright journeys**

Cover:

1. Admin-created member invitation → password setup → login.
2. Member schedule → booking → pass decrement → allowed cancellation → pass restore.
3. Full class → waitlist → cancellation in same request → automatic confirmation before four hours.
4. Full class → offer → in-app notification link → acceptance.
5. Expired offer rejected and lazily advanced with Cron disabled.
6. Administrator class cancellation → all restores → queue close.
7. Instructor and branch-admin forbidden access cases.

- [ ] **Step 2: Run RED**

Run:

    npm exec playwright install chromium
    npm exec playwright test tests/e2e

Expected: FAIL because deterministic fixtures, stable locators, and the CI web-server setup are not complete.

- [ ] **Step 3: Implement deterministic E2E reset and seed**

Reset only the test database, apply all Must-have migrations, and seed three branches, one active group pass product, head administrator, branch administrator, instructor, members, passes, templates, occurrences, one full class, and ordered waiters. Use fixed UUIDs and derive boundary occurrences from one database clock_timestamp() captured by the seed; never point scripts at a URL whose database name is not loungefit_test.

- [ ] **Step 4: Make the minimum UI adjustments required by tests**

Add stable accessible names and data-testid only when no semantic role can identify a dynamic row. Do not alter domain behavior to bypass tests.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec playwright test tests/e2e --project=chromium

Expected: all Must-have browser journeys pass with no Cron configuration.

- [ ] **Step 6: Add the CI workflow**

Use Node LTS, npm ci, a PostgreSQL 16 service, migration/reset/seed steps, Playwright Chromium installation, then run in order:

    npm run typecheck
    npm run lint
    npm run test:unit
    npm run test:db
    npm run test:e2e

Upload Playwright traces only on failure. Do not define a scheduled GitHub workflow.

- [ ] **Step 7: REFACTOR package verification scripts**

Set npm run verify:must-have to execute the same five gates locally and in CI. Keep each underlying command callable separately.

    "verify:must-have": "npm run typecheck && npm run lint && npm run test:unit && npm run test:db && npm run test:e2e"

- [ ] **Step 8: Verify the task**

Run:

    npm run verify:must-have

Expected: TypeScript, lint, unit, PostgreSQL integration, and Playwright all exit 0; Playwright reports zero failed tests.

- [ ] **Step 9: Commit**

    git add scripts/test tests/e2e .github/workflows/ci.yml package.json playwright.config.ts
    git commit -m "test: verify LoungeFit must have journeys"

### Task 24: Deploy Must-Have to Neon and Vercel Hobby

**Files:**
- Create: .env.example
- Create: src/app/api/health/route.ts
- Create: src/server/db/migration-env.ts
- Create: scripts/seed-production.ts
- Create: tests/unit/deployment/hobby-config.test.ts
- Create: tests/integration/deployment/health.test.ts
- Create: tests/e2e/deployment-smoke.spec.ts
- Create: vercel.json
- Modify: src/server/env.ts
- Modify: package.json

**Interfaces:**
- Consumes: verified Must-have application and migrations.
- Produces: validated runtime/deploy environment, idempotent initial data seed, /api/health, and a Hobby-safe deployment with no crons entry.

- [ ] **Step 1: Write failing environment and Hobby tests**

Assert runtime startup rejects missing DATABASE_URL, SESSION_SECRET, or APP_URL. Assert the migration command separately rejects missing DATABASE_URL_MIGRATIONS. Parse vercel.json and assert it has no crons property. Assert /api/health returns 200 with status ok after SELECT 1 and 503 without leaking a connection string when the database is unavailable.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/deployment/hobby-config.test.ts tests/integration/deployment/health.test.ts

Expected: FAIL because deployment validation, health route, and vercel.json do not exist.

- [ ] **Step 3: Implement minimum deployment configuration**

Create vercel.json containing only:

    {
      "framework": "nextjs"
    }

Use DATABASE_URL for Neon pooled runtime connections. A migration-only environment parser uses DATABASE_URL_MIGRATIONS for the direct connection and is never imported by application runtime modules. Validate SESSION_SECRET as at least 32 random bytes encoded for environment storage and APP_URL as HTTPS outside local development. Health output contains status only.

Add this deployment-only script:

    "db:migrate:deploy": "drizzle-kit migrate --config drizzle.config.ts"

- [ ] **Step 4: Implement idempotent initial production seed**

scripts/seed-production.ts creates exactly three configured branches, one active pass product, and one HEAD_ADMIN from SEED_HEAD_ADMIN_PHONE and SEED_HEAD_ADMIN_PASSWORD. It hashes the password, never prints secrets, refuses non-HTTPS APP_URL in production, and exits after the seed so the two SEED variables can be removed.

- [ ] **Step 5: Run GREEN locally**

Run:

    npm exec vitest run tests/unit/deployment/hobby-config.test.ts tests/integration/deployment/health.test.ts
    npm run build

Expected: deployment tests pass and Next.js production build exits 0.

- [ ] **Step 6: Provision Neon safely**

In Neon, create separate loungefit-preview and loungefit-production branches/databases. Copy the pooled URL into Vercel DATABASE_URL and keep the direct URL as DATABASE_URL_MIGRATIONS only in a trusted local shell or protected migration CI environment. Apply production migrations from that trusted environment:

    npm run db:migrate:deploy

Expected: migrations 0000 through 0002 apply once; a second invocation reports no pending migrations. Run the seed once, verify the administrator login, then delete SEED_HEAD_ADMIN_PHONE and SEED_HEAD_ADMIN_PASSWORD from the shell and Vercel if they were added there.

- [ ] **Step 7: Configure Vercel Hobby without exposing secrets**

Run:

    npx vercel link
    npx vercel env add DATABASE_URL
    npx vercel env add SESSION_SECRET
    npx vercel env add APP_URL
    npx vercel --prod

Expected: prompts accept values without placing them in Git or command history, deployment succeeds on Hobby, and no Cron job is shown.

- [ ] **Step 8: Run deployed smoke verification**

Set PLAYWRIGHT_BASE_URL in the shell to the deployed HTTPS URL, then run:

    npm exec playwright test tests/e2e/deployment-smoke.spec.ts

Expected: health, login page, authenticated schedule, and one test-account booking/cancellation pass. Core operation must still pass with Cron disabled.

- [ ] **Step 9: REFACTOR environment ownership**

Keep migration and one-time seed credentials out of runtime modules; only the server environment parser may read secret variables.

- [ ] **Step 10: Verify the task**

Run:

    npm run verify:must-have
    npm run build
    git grep -n -E "DATABASE_URL=.*postgres" -- . ":(exclude)package-lock.json"

Expected: verification and build pass; git grep exits 1 with no matches, meaning no committed connection string. Vercel Hobby deployment shows no scheduled Cron.

- [ ] **Step 11: Commit**

    git add .env.example src/app/api/health src/server/env.ts src/server/db/migration-env.ts scripts/seed-production.ts tests/unit/deployment tests/integration/deployment tests/e2e/deployment-smoke.spec.ts vercel.json package.json
    git commit -m "chore: prepare Hobby and Neon deployment"

### Task 25: Write README, Operations Checks, and GitHub Submission Notes

**Files:**
- Create: README.md
- Create: docs/operations/manual-verification.md
- Create: docs/operations/data-migration-constraint.md
- Create: .github/pull_request_template.md
- Create: tests/unit/docs/readme.test.ts

**Interfaces:**
- Consumes: verified Must-have commands, environment variables, deployment URL, and approved exclusions.
- Produces: reproducible local/deploy documentation and a GitHub submission checklist.

- [ ] **Step 1: Write the failing documentation contract test**

Read README.md and assert headings exist for overview, architecture, setup, environment variables, database migrations, tests, Vercel Hobby deployment, demo accounts without passwords, scope, exclusions, and data migration constraint. Assert README does not claim CSV member import, Kakao/SMS, attendance, online payment, or required Cron.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/docs/readme.test.ts

Expected: FAIL because README.md and operations documents do not exist.

- [ ] **Step 3: Write the minimum reproducible README**

Document npm ci, copying example env files, Docker test database, migration commands, seed commands, dev/build/verify commands, route/role overview, concurrency decisions, Hobby no-Cron behavior, and the actual deployed HTTPS URL obtained in Task 24. State that Web Push, PWA, reports, report CSV, and advanced retry are post-Must-have Tasks 26-30.

- [ ] **Step 4: Write operations verification and migration constraints**

manual-verification.md reproduces the 13 approved Must-have manual checks, including last-seat concurrency and Cron-disabled expiry, then defines first-month measurement for zero over-capacity/duplicate bookings, zero pass-ledger mismatches, and at least 80% member self-booking. data-migration-constraint.md states that CSV import is absent and real onboarding of about 1,200 members requires a separately authorized cleanse, validation, load, total reconciliation, and sample audit stage before production use.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/docs/readme.test.ts

Expected: all documentation contract checks pass.

- [ ] **Step 6: REFACTOR duplicated commands**

Make README point to package scripts and operations documents; do not copy secrets or maintain two conflicting deployment procedures.

- [ ] **Step 7: Verify GitHub submission readiness**

Run:

    npm run verify:must-have
    npm run build
    git status --short
    git log --oneline --decorate -10
    git remote -v

Expected: verification and build pass; status contains only this Task's intended documentation changes before commit; recent commits are task-scoped; the intended GitHub remote is visible. After commit, git status is empty. Use git push --dry-run only after the repository owner confirms the target remote.

- [ ] **Step 8: Commit**

    git add README.md docs/operations .github/pull_request_template.md tests/unit/docs/readme.test.ts
    git commit -m "docs: document LoungeFit setup and submission"

## Post-Must-Have Tasks

Tasks 26-30 may begin only after Task 25 is committed and npm run verify:must-have plus the Hobby deployment smoke test both pass. Each post-Must-have feature remains removable without changing reservation, pass, waitlist, or in-app notification correctness.

### Task 26: Add PWA Manifest, Service Worker Shell, and iPhone Install Guidance

**Files:**
- Create: src/app/manifest.ts
- Create: public/sw.js
- Create: public/icons/icon-192.png
- Create: public/icons/icon-512.png
- Create: src/components/pwa/service-worker-registration.tsx
- Create: src/components/pwa/install-guide.tsx
- Create: src/app/(member)/settings/page.tsx
- Create: tests/unit/pwa/manifest.test.ts
- Create: tests/unit/pwa/install-guide.test.tsx
- Create: tests/e2e/pwa-install-guidance.spec.ts
- Modify: src/app/layout.tsx
- Modify: README.md

**Interfaces:**
- Consumes: verified responsive web app.
- Produces: standards-based manifest, service-worker registration, standalone display, and iPhone guidance. It does not add push subscriptions.

- [ ] **Step 1: Write failing manifest and guidance tests**

Assert manifest name, short_name, start_url, standalone display, theme/background colors, and 192/512 icons. Assert iPhone Safari outside standalone mode sees instructions to add to Home Screen, while installed mode and non-iPhone clients do not see incorrect prompts.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/unit/pwa
    npm exec playwright test tests/e2e/pwa-install-guidance.spec.ts

Expected: FAIL because manifest, service worker, and install guidance do not exist.

- [ ] **Step 3: Implement the minimum PWA shell**

Return the manifest from src/app/manifest.ts with public/icons/icon-192.png and public/icons/icon-512.png, register /sw.js after hydration, and implement install/activate handlers that claim clients. Do not cache authenticated HTML, reservation actions, or API responses; the initial service worker exists only as the controlled base for Task 27.

- [ ] **Step 4: Implement iPhone install guidance**

Use feature detection and display-mode media query. Explain that Web Push on supported iPhone versions requires adding the site to the Home Screen and later granting notification permission through a member gesture. Add PWA installation and cache-scope instructions to README.md.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/pwa
    npm exec playwright test tests/e2e/pwa-install-guidance.spec.ts

Expected: manifest, registration, platform detection, and guidance tests pass.

- [ ] **Step 6: REFACTOR browser detection**

Keep user-agent checks inside one small client helper and prefer capability/display-mode checks for behavior.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run verify:must-have

Expected: PWA checks pass and all Must-have gates remain green.

- [ ] **Step 8: Commit**

    git add -- src/app/manifest.ts public/sw.js public/icons src/components/pwa "src/app/(member)/settings" src/app/layout.tsx tests/unit/pwa tests/e2e/pwa-install-guidance.spec.ts README.md
    git commit -m "feat: add LoungeFit PWA shell"

### Task 27: Add Web Push Subscription and Immediate Delivery

**Files:**
- Create: src/server/db/schema/push.ts
- Create: drizzle/0003_web_push.sql
- Create: drizzle/meta/0003_snapshot.json
- Create: src/server/push/push-types.ts
- Create: src/server/push/subscription-service.ts
- Create: src/server/push/delivery-service.ts
- Create: src/server/push/web-push-client.ts
- Create: src/app/(member)/settings/push-actions.ts
- Create: src/components/pwa/push-permission-control.tsx
- Create: tests/integration/push/subscriptions.test.ts
- Create: tests/integration/push/immediate-delivery.test.ts
- Create: tests/unit/push/payload.test.ts
- Create: tests/unit/pwa/push-permission-control.test.tsx
- Modify: src/server/db/schema/index.ts
- Modify: drizzle/meta/_journal.json
- Modify: src/server/notifications/notification-service.ts
- Modify: src/server/notifications/business-notifications.ts
- Modify: public/sw.js
- Modify: src/server/env.ts
- Modify: .env.example
- Modify: package.json
- Modify: README.md

**Interfaces:**
- Consumes: PWA service worker and successfully persisted in-app Notification.
- Produces: registerSubscription(), deactivateSubscription(), sendImmediatePush(notificationId), PushClient, and PUSH_MODE=mock or live.

- [ ] **Step 1: Write failing subscription and delivery-schema tests**

Assert endpoint is unique, re-registration updates keys and reactivates the row, a member can deactivate only their device, and one PushDelivery exists per Notification + PushSubscription. Define basic delivery states PENDING, SENDING, SENT, FAILED, and INVALID_SUBSCRIPTION.

- [ ] **Step 2: Write failing immediate-delivery and payload tests**

Assert push is attempted only after in-app notification insertion succeeds and only for RESERVATION_CONFIRMED, RESERVATION_CANCELLED, WAITLIST_AUTO_CONFIRMED, WAITLIST_OFFERED, CLASS_CHANGED, and CLASS_CANCELLED. PASS_ISSUED, WAITLIST_JOINED, WAITLIST_CANCELLED, WAITLIST_EXPIRED, and WAITLIST_SKIPPED remain inbox-only. Payload contains notificationId, short message, relative targetPath, and optional expiresAt, but no member name, phone, payment amount, pass details, or full notification body. Assert mock mode makes no network call.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa/push-permission-control.test.tsx

Expected: FAIL because push schema and services do not exist.

- [ ] **Step 4: Implement migration and subscription controls**

Create push_subscriptions with member_id, endpoint, p256dh, auth, is_active, created_at, updated_at, deactivated_at and unique endpoint. Create push_deliveries with notification_id, subscription_id, status, attempt_count default 0, created_at, updated_at and unique(notification_id, subscription_id). Add push_subscriptions_member_active_idx on (member_id, is_active) and push_deliveries_status_created_idx on (status, created_at). Store keys only server-side.

Install web-push and @types/web-push with an exact lockfile update. Add PUSH_MODE, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY to validated environment examples; expose only NEXT_PUBLIC_VAPID_PUBLIC_KEY to the browser. Document VAPID generation and mock/live selection in README.md without recording generated keys. Request Notification permission only after the member presses an Allow notifications button. If denied, unsupported, or unsubscribed, keep in-app notifications fully usable.

- [ ] **Step 5: Implement immediate delivery and Service Worker handlers**

After tryCreateNotification returns a persisted notification, create delivery rows and attempt sends in the same server request. Transition PENDING → SENDING → SENT or FAILED with conditional updates. A 404/410 push-service response sets INVALID_SUBSCRIPTION and deactivates the subscription.

In public/sw.js, use notificationId as tag. notificationclick focuses an existing same-origin client or opens targetPath. Never authorize offer acceptance in the Service Worker.

- [ ] **Step 6: Run GREEN**

Run:

    npm run db:migrate:test
    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa/push-permission-control.test.tsx

Expected: schema, ownership, payload privacy, internal-first order, mock no-network, failure isolation, and duplicate-delivery tests pass.

- [ ] **Step 7: REFACTOR PushClient adapters**

Expose MockPushClient and WebPushClient behind the same send(subscription, payload) interface. Select by validated PUSH_MODE; tests default to mock.

- [ ] **Step 8: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa

Expected: push tests pass and Must-have behavior is unchanged when permission is denied or no subscription exists.

- [ ] **Step 9: Commit**

    git add -- src/server/db/schema/push.ts drizzle/0003_web_push.sql drizzle/meta src/server/push "src/app/(member)/settings" src/components/pwa/push-permission-control.tsx src/server/notifications public/sw.js src/server/env.ts .env.example package.json package-lock.json tests/integration/push tests/unit/push tests/unit/pwa README.md
    git commit -m "feat: add immediate web push delivery"

### Task 28: Add Read-Only Operational Reports

**Files:**
- Create: src/server/reporting/report-types.ts
- Create: src/server/reporting/report-queries.ts
- Create: src/app/(admin)/admin/reports/page.tsx
- Create: src/components/admin/report-filters.tsx
- Create: src/components/admin/report-tables.tsx
- Create: tests/integration/reporting/report-queries.test.ts
- Create: tests/unit/admin/report-tables.test.tsx
- Modify: src/app/(admin)/admin/layout.tsx
- Modify: README.md

**Interfaces:**
- Consumes: pass, ledger, occurrence, reservation, branch, and authorization data.
- Produces: getRevenueReport(), getUsageReport(), getOccupancyReport(), and getRemainingPassReport() for an inclusive Seoul date range and authorized branch set.

- [ ] **Step 1: Write failing report-definition tests**

Assert:

- Revenue uses passes.paid_amount grouped by selling_branch_id and issued_at.
- Usage counts CONFIRMED reservations of normal classes after start, grouped by occurrence.branch_id.
- No-show/attendance data is not consulted.
- Occupancy is confirmed reservations divided by occurrence capacity.
- Remaining-pass report uses pass.remaining_credits.
- Head admin sees all branches; branch admin sees only their branch.

- [ ] **Step 2: Run RED**

Run:

    npm exec vitest run tests/integration/reporting/report-queries.test.ts tests/unit/admin/report-tables.test.tsx

Expected: FAIL because reporting queries and UI do not exist.

- [ ] **Step 3: Implement minimum read-only aggregate queries**

Convert filter dates from Asia/Seoul day boundaries to UTC before querying. Use parameterized SQL, never mutate business tables, and return typed decimal/number projections with explicit zero rows for active branches without activity.

- [ ] **Step 4: Implement report filters and tables**

Provide date-from, date-through, and allowed-branch filters. Render separate revenue, usage, occupancy, and remaining-pass tables so selling and usage branches cannot be mistaken for one metric. Document the report definitions and role scope in README.md.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/integration/reporting/report-queries.test.ts tests/unit/admin/report-tables.test.tsx

Expected: attribution, boundary, authorization, zero-state, and rendering tests pass.

- [ ] **Step 6: REFACTOR common filter validation**

Use one ReportFilter schema and one authorizedBranchIds helper without combining the distinct metric queries into an unreadable query.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/reporting tests/unit/admin/report-tables.test.tsx

Expected: reports pass and Must-have tests remain green.

- [ ] **Step 8: Commit**

    git add -- src/server/reporting "src/app/(admin)/admin/reports" src/components/admin/report-filters.tsx src/components/admin/report-tables.tsx "src/app/(admin)/admin/layout.tsx" tests/integration/reporting tests/unit/admin/report-tables.test.tsx README.md
    git commit -m "feat: add operational reports"

### Task 29: Export Report Results as CSV

**Files:**
- Create: src/server/reporting/csv.ts
- Create: src/app/api/admin/reports/export/route.ts
- Create: tests/unit/reporting/csv.test.ts
- Create: tests/integration/reporting/csv-route.test.ts
- Modify: src/app/(admin)/admin/reports/page.tsx
- Modify: README.md

**Interfaces:**
- Consumes: authorized read-only report queries from Task 28.
- Produces: formatReportCsv(rows), GET /api/admin/reports/export?report=&from=&through=&branchId=, and a report download link. No import endpoint is produced.

- [ ] **Step 1: Write failing CSV-format tests**

Assert UTF-8 BOM, fixed Korean headers, CRLF records, RFC 4180 quote escaping, formula-injection neutralization for values beginning =, +, -, or @, and stable column order.

- [ ] **Step 2: Write failing route authorization tests**

Assert member and instructor receive 403, branch admin cannot export another branch, invalid report/date returns 400, and Content-Disposition uses a safe fixed prefix plus date range. Assert POST and multipart requests return 405 and no /import route exists.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/unit/reporting/csv.test.ts tests/integration/reporting/csv-route.test.ts

Expected: FAIL because CSV formatter and export route do not exist.

- [ ] **Step 4: Implement minimum formatter and GET route**

Use the same ReportFilter and query functions as the screen. Stream or return text/csv; charset=utf-8 with a BOM. Keep the route read-only and do not accept uploaded files. Update README.md to distinguish report CSV download from the excluded 1,200-member data import.

- [ ] **Step 5: Run GREEN**

Run:

    npm exec vitest run tests/unit/reporting/csv.test.ts tests/integration/reporting/csv-route.test.ts

Expected: encoding, escaping, injection, authorization, filter, and method tests pass.

- [ ] **Step 6: REFACTOR column definitions**

Represent each report's headers and accessors in a typed constant shared only by CSV formatting; do not make UI table order depend on CSV internals.

- [ ] **Step 7: Verify the task**

Run:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/unit/reporting tests/integration/reporting
    rg -n "import|upload|multipart" src/app/api/admin/reports

Expected: all tests pass; rg finds only explicit method rejection text and no member-data import implementation.

- [ ] **Step 8: Commit**

    git add -- src/server/reporting/csv.ts src/app/api/admin/reports/export "src/app/(admin)/admin/reports/page.tsx" tests/unit/reporting tests/integration/reporting README.md
    git commit -m "feat: export operational reports as csv"

### Task 30: Add Optional Advanced Push Retry and Low-Frequency Maintenance

**Files:**
- Create: drizzle/0004_push_retry.sql
- Create: drizzle/meta/0004_snapshot.json
- Create: src/server/push/retry-service.ts
- Create: src/server/push/subscription-cleanup.ts
- Create: src/server/maintenance/maintenance-service.ts
- Create: src/app/api/cron/maintenance/route.ts
- Create: tests/integration/push/retry-service.test.ts
- Create: tests/integration/maintenance/maintenance-route.test.ts
- Create: tests/unit/deployment/cron-frequency.test.ts
- Modify: src/server/db/schema/push.ts
- Modify: drizzle/meta/_journal.json
- Modify: src/server/push/delivery-service.ts
- Modify: src/server/env.ts
- Modify: .env.example
- Modify: vercel.json
- Modify: tests/unit/deployment/hobby-config.test.ts
- Modify: README.md

**Interfaces:**
- Consumes: FAILED PushDelivery rows, inactive subscriptions, lazy offer cleanup.
- Produces: schedulePushRetry(), retryDuePushes(), removeExpiredSubscriptions(), runMaintenance(), and protected GET /api/cron/maintenance.

- [ ] **Step 1: Write failing retry-state tests**

Add RETRY_PENDING and FINAL_FAILED states plus next_attempt_at and last_error_type. Assert only network/5xx failures schedule at nominal offsets of 1, 5, and 15 minutes, each delivery is attempted at most three additional times, 404/410 never retries, and duplicate workers cannot claim one delivery.

- [ ] **Step 2: Write failing maintenance and frequency tests**

Assert Authorization: Bearer CRON_SECRET is required, maintenance conditionally claims due rows, deactivates invalid subscriptions, deletes subscriptions only after 30 inactive days, and may clean expired offers. Parse vercel.json and reject any schedule more frequent than daily on Hobby.

- [ ] **Step 3: Run RED**

Run:

    npm exec vitest run tests/integration/push/retry-service.test.ts tests/integration/maintenance/maintenance-route.test.ts tests/unit/deployment/cron-frequency.test.ts

Expected: FAIL because retry columns, worker, protected route, and optional schedule do not exist.

- [ ] **Step 4: Implement retry migration and worker**

Add next_attempt_at and last_error_type to push_deliveries, add RETRY_PENDING and FINAL_FAILED states, create push_deliveries_retry_due_idx on (next_attempt_at, id) WHERE status = 'RETRY_PENDING', and create push_subscriptions_inactive_cleanup_idx on (deactivated_at, id) WHERE is_active = false.

Claim work with one concrete CTE so concurrent workers cannot send the same delivery:

    WITH due AS (
      SELECT id
        FROM push_deliveries
       WHERE status = 'RETRY_PENDING'
         AND next_attempt_at <= clock_timestamp()
       ORDER BY next_attempt_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT 50
    )
    UPDATE push_deliveries AS delivery
       SET status = 'SENDING', updated_at = clock_timestamp()
      FROM due
     WHERE delivery.id = due.id
    RETURNING delivery.*;

Record sanitized error categories only. A delayed Hobby invocation processes every overdue row but never promises the nominal minute.

- [ ] **Step 5: Implement optional daily maintenance route**

Protect the route with constant-time CRON_SECRET comparison. Configure a daily UTC schedule only:

    {
      "framework": "nextjs",
      "crons": [
        {
          "path": "/api/cron/maintenance",
          "schedule": "0 3 * * *"
        }
      ]
    }

The application must still pass every Must-have test if this route is never called. README must state that one-minute cleanup/retry requires Vercel Pro and that Hobby execution time is not guaranteed.

Add CRON_SECRET through the Vercel prompt without putting its value in the command or repository:

    npx vercel env add CRON_SECRET

- [ ] **Step 6: Run GREEN**

Run:

    npm run db:migrate:test
    npm exec vitest run tests/integration/push/retry-service.test.ts tests/integration/maintenance/maintenance-route.test.ts tests/unit/deployment

Expected: retry limits, claim concurrency, invalid-subscription handling, 30-day cleanup, authorization, and daily-frequency tests pass.

- [ ] **Step 7: REFACTOR maintenance batches**

Cap each invocation by a fixed batch size and execution budget, return counts only, and keep waitlist cleanup, push retry, and subscription cleanup as separate callable functions.

- [ ] **Step 8: Verify the task and core independence**

Run:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/push tests/integration/maintenance tests/unit/deployment

Expected: all tests pass. Repeat npm run verify:must-have with CRON_SECRET and Vercel Cron disabled; the result remains green.

- [ ] **Step 9: Commit**

    git add drizzle/0004_push_retry.sql drizzle/meta src/server/db/schema/push.ts src/server/push src/server/maintenance src/app/api/cron/maintenance src/server/env.ts .env.example vercel.json tests/integration/push tests/integration/maintenance tests/unit/deployment README.md
    git commit -m "feat: add optional push retry maintenance"

## Final Verification Sequence

Run these commands after Task 25 for the Must-have submission and again after any post-Must-have Task:

    npm ci
    docker compose up -d postgres-test
    npm run db:migrate:test
    npm run typecheck
    npm run lint
    npm run test:unit
    npm run test:db
    npm run test:e2e
    npm run build
    git diff --check
    git status --short

Expected: every command exits 0, all test suites report zero failures, the production build succeeds, git diff has no whitespace errors, and the working tree is empty after the Task commit.

## Plan Self-Review Record

1. **Design consistency:** Every approved Must-have behavior maps to Tasks 1-25; notification failure remains non-transactional, no attendance flow exists, and selling/usage branch attribution stays distinct.
2. **Priority order:** Tasks 26-30 are explicitly gated by Task 25 plus Must-have CI and deployment smoke success.
3. **Test-first order:** Every production change is preceded by a named failing unit, PostgreSQL integration, component, configuration, documentation, or Playwright test and an explicit expected RED reason.
4. **Task size:** Each Task owns one independently reviewable capability and ends with targeted verification plus a task-scoped commit.
5. **Paths and commands:** Every Task lists exact files, public interfaces, RED/GREEN/REFACTOR actions, execution commands, expected outcomes, and a proposed commit message.
6. **Free deployment:** Must-have has no Cron entry and is verified with Cron disabled. Optional Task 30 uses at most daily Hobby maintenance and documents that one-minute schedules require Vercel Pro.
7. **Scope control:** PWA, Web Push, reporting, CSV output, and advanced retry are isolated post-Must-have Tasks. CSV member import, Kakao/SMS, Outbox, general audit history, online payment, personal training, attendance, and microservices are absent.

No worktree creation, dependency installation, migration execution, deployment, or implementation is part of writing this plan.
