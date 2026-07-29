# 라운지핏 MVP 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬로 superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans를 사용해 이 계획을 Task별로 실행한다. 진행 상태는 체크박스(- [ ])로 기록한다.

**목표:** 동시 요청에서도 reservation, pass, waitlist 상태가 일치하는 반응형 라운지핏 그룹수업 예약 MVP를 구축하고 배포한다.

**아키텍처:** Server 전용 domain module과 Server Actions/Route Handlers를 사용하는 하나의 모듈형 Next.js App Router 애플리케이션을 Neon PostgreSQL에 연결한다. 핵심 상태 변경은 PostgreSQL transaction에 두고 class occurrence row lock으로 capacity 경쟁을 직렬화하며, PostgreSQL exclusion constraint로 겹치는 CONFIRMED reservation을 거부한다. PWA, Web Push, reporting, CSV export, advanced retry는 별도 docs/superpowers/plans/2026-07-29-loungefit-post-mvp.md에서 다룬다.

**기술 스택:** Next.js App Router, TypeScript, React, Drizzle ORM, postgres.js, PostgreSQL 16/Neon, Zod, Luxon, bcryptjs, Vitest, Testing Library, Playwright, ESLint, Vercel.

## 구현 실행 전 필수 준비

1. main에서 설계 명세와 두 계획 문서의 커밋을 확인한다.

   실행:

       git switch main
       git status --short
       git log --oneline -- docs/superpowers/specs/2026-07-29-loungefit-design.md docs/superpowers/plans/2026-07-29-loungefit-mvp.md docs/superpowers/plans/2026-07-29-loungefit-post-mvp.md

   예상 결과: working tree가 비어 있고, 설계 명세와 구현 계획 커밋이 main history에 존재한다.

2. .worktrees/가 Git에서 제외되는지 확인한다.

   실행:

       rg -n "^\.worktrees/$" .gitignore
       git check-ignore -q .worktrees

   예상 결과: 두 명령이 .worktrees/ ignore rule을 확인한다. 현재 문서 전용 저장소처럼 .gitignore가 아직 없거나 rule이 빠져 있으면 구현 시작 전에 main에서 .worktrees/ 한 줄만 추가하고 다음 준비 커밋을 만든다.

       git add .gitignore
       git commit -m "chore: ignore local worktrees"

3. feature/loungefit-mvp branch와 worktree를 생성한다.

   실행:

       git worktree add .worktrees/loungefit-mvp -b feature/loungefit-mvp main
       git worktree list
       Set-Location .worktrees/loungefit-mvp

   예상 결과: .worktrees/loungefit-mvp가 feature/loungefit-mvp를 가리키고 현재 위치가 해당 worktree다.

4. worktree에서 의존성과 기준 검증을 준비한다.

   실행:

       Test-Path package-lock.json
       git diff --check
       git status --short

   예상 결과: 현재 저장소에는 아직 package-lock.json이 없으므로 첫 명령은 False이고, Git 검사는 깨끗하게 통과한다. 따라서 의존성 설치는 Task 1 Step 1에서 이 worktree 안에서 처음 실행한다. 이후 session부터 package-lock.json이 있으면 Task 시작 전에 다음 기준 명령을 실행한다.

       npm ci
       npm run typecheck
       npm run lint
       npm run test:unit

5. 실제 구현, 테스트 수정, dependency 설치, Task commit은 모두 .worktrees/loungefit-mvp에서만 수행한다. main에서는 구현 파일을 직접 수정하지 않는다.

## 실행 규칙

- 한 번에 하나의 Task만 구현한다.
- 각 Task의 실패 테스트를 먼저 실행해 RED가 예상 이유로 실패하는지 확인한다.
- 최소 구현 후 GREEN을 확인하고, REFACTOR 후 대상 테스트와 회귀 검증을 다시 실행한다.
- Task 완료 후 변경 파일, 실행한 명령, 테스트 수와 결과, commit hash를 사용자에게 보고한다.
- 사용자가 해당 Task를 승인하기 전에는 다음 Task를 시작하지 않는다.
- Task 도중 다른 Task 범위가 필요해지면 현재 Task를 멈추고 사용자 승인을 요청한다.
- main merge와 push는 Task 25 제출 절차에서만 수행한다.

## 일정 부족 시 제출 최소 기준과 중단 기준

- 최우선 순서는 reservation·pass·waitlist 정합성, 자동화 테스트, Vercel Hobby/Neon 배포, README 순이다.
- Task 8–11의 권한·운영 데이터 기반은 핵심 흐름의 보안과 fixture에 필요한 최소 범위로 구현하고, 별도 UI 확장은 추가하지 않는다.
- Task 14–19의 동시 reservation, pass debit/restore, waitlist 승급·offer·lazy cleanup이 검증되기 전에는 branch admin·instructor 전용 UI 범위를 넓히지 않는다.
- Task 20의 class cancellation과 pass restore는 핵심 완료 조건이며, branch admin·instructor 전용 roster UI는 그 핵심 transaction이 GREEN인 뒤에만 진행한다.
- Task 23의 typecheck, lint, unit, PostgreSQL integration, Playwright가 모두 PASS하지 않거나 Task 24 배포 스모크 테스트가 실패하면 기능 추가를 중단하고 해당 실패를 해결한다.
- Task 25의 README와 제출 보안 검사가 끝나기 전에는 제출 완료로 판단하지 않는다.
- Post-MVP Task 26–30은 일정과 관계없이 이 문서의 제출 최소 기준에 포함하지 않는다.

## 전역 제약

- 승인된 기준 문서는 docs/superpowers/specs/2026-07-29-loungefit-design.md다.
- 하나의 modular monolith를 사용한다. 별도 backend, microservices, Redis, message broker, native mobile application을 추가하지 않는다.
- Timestamp는 UTC로 저장하고, 모든 booking boundary는 database time으로 계산해 Asia/Seoul로 표시한다.
- Must-have 범위는 group-class booking, 즉시 pass debit, 허용된 cancellation restore, waitlist 처리, best-effort in-app notification이다.
- Active product는 모든 branch에서 사용하는 하나의 Pilates/Yoga group-class pass다. Revenue data는 selling branch, usage data는 class branch에 귀속한다.
- Booking은 class 14일 전부터 class 1시간 전 미만까지 가능하고, member cancellation은 class 2시간 전과 같은 시각까지 가능하다.
- 정상 CONFIRMED reservation은 실제 출석 또는 no-show와 관계없이 usage로 계산한다. Attendance/no-show control을 만들지 않는다.
- 핵심 정합성은 Vercel Cron을 완전히 비활성화해도 동작해야 한다. Cancellation은 같은 request에서 queue를 진행하고, acceptance는 database time을 다시 검증하며, 관련 request는 만료된 offer를 lazy cleanup한다.
- In-app notification 저장은 core transaction commit 후에 시도한다. 실패를 log에 남기되 booking, pass, waitlist를 rollback하지 않는다. Transactional Outbox를 구현하지 않는다.
- Member self-sign-up, online payment, personal training, unlimited pass, Kakao Alimtalk, SMS, member CSV import, general audit history, admin notification resend를 구현하지 않는다.
- Secret은 source, browser bundle, test snapshot, command-line argument에 기록하지 않는다. Example environment file만 commit한다.
- 모든 기능 Task는 RED → GREEN → REFACTOR와 대상 검증을 거쳐 제안된 commit으로 끝난다.

## 계획된 파일 구조

- package.json, package-lock.json: 고정된 script와 dependency.
- src/app: App Router page, layout, Server Actions, Route Handlers를 둔다.
- src/components: 책임이 분리된 client/server UI component.
- src/server/db: database client, migration interface, schema module을 둔다.
- src/server/auth: password, token, invitation, reset, session 동작.
- src/server/authorization: role과 branch ownership guard.
- src/server/scheduling: 반복 template, occurrence, exception, schedule query.
- src/server/passes: pass issue, selection, ledger, member view를 둔다.
- src/server/bookings: reservation rule, transaction orchestration, cancellation을 둔다.
- src/server/waitlist: enrollment, promotion, offer, acceptance, lazy cleanup을 둔다.
- src/server/notifications: best-effort in-app notification과 member inbox.
- drizzle: 순서가 고정된 SQL migration과 Drizzle metadata.
- tests/unit: PostgreSQL이 필요 없는 deterministic pure/UI test.
- tests/integration: 실제 PostgreSQL constraint, transaction, concurrency test.
- tests/e2e: Playwright member/admin journey를 둔다.
- .github/workflows/ci.yml: type, lint, unit, PostgreSQL integration, Playwright gate를 둔다.

## 확정된 Database와 동시성 결정

1. CONFIRMED reservation 또는 active offer를 count하기 전에 PostgreSQL READ COMMITTED transaction에서 class_occurrences에 SELECT ... FOR UPDATE를 적용한다. Reservation, cancellation-driven promotion, offer acceptance, class cancellation, capacity change는 모두 이 lock을 먼저 얻는다.
2. Capacity 사용량은 CONFIRMED reservation 수와 OFFERED waitlist row 수의 합이다. Offer hold는 seat 하나를 예약한다.
3. Partial unique index로 member와 occurrence별 CONFIRMED reservation을 하나만 허용한다. Unique request_id로 booking retry를 idempotent하게 처리한다.
4. reservations는 starts_at, ends_at snapshot을 저장한다. BEFORE INSERT OR UPDATE trigger가 class_occurrences 값으로 두 column을 덮어써 caller가 interval을 조작하지 못하게 한다.
5. btree_gist를 활성화하고 CONFIRMED row에 member_id와 tstzrange(starts_at, ends_at, '[)') GiST exclusion constraint를 추가한다. Overlap은 PostgreSQL code 23P01로 실패하고 back-to-back class는 허용한다.
6. Pass row는 expires_at, issued_at, id 순서로 lock한다. remaining_credits > 0 conditional update와 같은 transaction의 pass_ledger insert로 double debit을 방지한다.
7. Queue order는 joined_at, id다. Partial unique index로 중복 active waitlist를 막고, 현재 state를 조건으로 한 update로 promotion과 lazy cleanup을 idempotent하게 처리한다.
8. Core domain commit 후 in-app notification을 insert한다. Notification dedupe_key로 성공한 중복 insert를 막지만 실패한 insert의 eventual delivery는 보장하지 않는다.

---

## Must-have Task 목록

### Task 1: 애플리케이션과 검증 도구 초기화

**파일:**

- 생성: package.json
- 생성: package-lock.json
- 생성: tsconfig.json
- 생성: next-env.d.ts
- 생성: next.config.ts
- 생성: eslint.config.mjs
- 생성: vitest.config.ts
- 생성: vitest.setup.ts
- 생성: playwright.config.ts
- 수정: .gitignore
- 생성: src/app/layout.tsx
- 생성: src/app/page.tsx
- 생성: src/app/globals.css
- 생성: tests/unit/app/home-page.test.tsx

**인터페이스:**

- 입력: 없음.
- 출력: npm scripts dev, build, start, typecheck, lint, test:unit, test:e2e, src alias @/*, rendering 가능한 App Router root.

- [ ] **Step 1: 프로젝트 toolchain 설치와 version 고정**

실행:

    npm init -y
    npm install --save-exact next react react-dom drizzle-orm postgres zod luxon bcryptjs
    npm install --save-dev --save-exact typescript @types/node @types/react @types/react-dom @types/luxon eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsx drizzle-kit dotenv-cli

예상 결과: package.json과 package-lock.json이 생성되고 npm installation error가 0건이다. 다음 script를 정확히 설정하고 Vitest는 jsdom unit test와 별도 Node integration project로 구성한다.

    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test:unit": "vitest run tests/unit",
    "test:e2e": "playwright test"

- [ ] **Step 2: 실패하는 home page 테스트 작성**

tests/unit/app/home-page.test.tsx를 생성한다.

    import { render, screen } from '@testing-library/react';
    import HomePage from '@/app/page';

    it('identifies the LoungeFit booking service', () => {
      render(<HomePage />);
      expect(screen.getByRole('heading', { name: '라운지핏' })).toBeVisible();
    });

- [ ] **Step 3: RED 확인**

실행:

    npm exec vitest run tests/unit/app/home-page.test.tsx

예상 결과: src/app/page.tsx가 필요한 라운지핏 heading을 아직 export하지 않으므로 FAIL.

- [ ] **Step 4: 테스트 통과에 필요한 최소 App Router shell 구현**

src/app/page.tsx에 main element와 이름이 라운지핏인 h1을 포함하는 server component를 만든다. layout.tsx에는 한국어 metadata를 설정하고 globals.css에는 mobile-first color, spacing, focus, 최소 44px touch-target variable을 둔다. Feature navigation은 아직 추가하지 않는다.

- [ ] **Step 5: GREEN 확인**

실행:

    npm exec vitest run tests/unit/app/home-page.test.tsx

예상 결과: 1개 테스트 PASS.

- [ ] **Step 6: Configuration name과 import REFACTOR**

Test setup은 vitest.setup.ts에 유지하고 src import에는 @/*를 사용하며 package script는 중복 flag가 없는 direct wrapper로 정리한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run test:unit

예상 결과: 세 명령 모두 exit 0이고 unit output은 passing test 1개를 보고한다.

- [ ] **Step 8: 커밋**

  git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts .gitignore src/app tests/unit/app
  git commit -m "chore: bootstrap LoungeFit application"

### Task 2: PostgreSQL 테스트 환경과 신원 Schema 추가

**파일:**

- 생성: compose.yaml
- 생성: .env.test.example
- 생성: drizzle.config.ts
- 생성: src/server/env.ts
- 생성: src/server/db/client.ts
- 생성: src/server/db/schema/enums.ts
- 생성: src/server/db/schema/identity.ts
- 생성: src/server/db/schema/index.ts
- 생성: drizzle/0000_identity.sql
- 생성: drizzle/meta/_journal.json
- 생성: drizzle/meta/0000_snapshot.json
- 생성: tests/integration/helpers/database.ts
- 생성: tests/integration/db/identity-schema.test.ts
- 수정: package.json

**인터페이스:**

- 입력: Task 1의 npm 및 TypeScript 설정.
- 출력: getDb(), closeDb(), resetDatabase(), Branch, User, Invitation, Session table, DATABASE_URL 및 DATABASE_URL_TEST 검증, db:generate, db:migrate:test, test:db script.

- [ ] **Step 1: 격리된 PostgreSQL 16 테스트 데이터베이스 시작**

port 55432, database loungefit_test, healthcheck pg_isready, 이름이 지정된 테스트 전용 volume을 사용하는 postgres-test compose service를 정의한다.

실행:

    docker compose up -d postgres-test
    docker compose ps

예상 결과: postgres-test가 healthy 상태다. .env.test.example을 추적되지 않는 .env.test로 복사하고 DATABASE_URL_TEST가 localhost:55432를 가리키게 한다.

- [ ] **Step 2: 실패하는 identity-schema 테스트 작성**

데이터베이스를 migration하고 branch와 user를 삽입한 뒤, 정규화된 전화번호가 같은 두 번째 user 삽입이 실패하는지 검증하는 Node 환경 통합 테스트를 작성한다.

    await expect(
      db.insert(users).values(secondUserWithSamePhone)
    ).rejects.toMatchObject({ code: '23505' });

invitation token_hash와 session token_hash도 중복을 거부하는지 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/db/identity-schema.test.ts

예상 결과: relation branches 또는 users does not exist 오류로 FAIL한다.

- [ ] **Step 4: identity migration과 typed schema 최소 구현**

enum user_role = HEAD_ADMIN, BRANCH_ADMIN, INSTRUCTOR, MEMBER, user_status = INVITED, ACTIVE, DISABLED, invitation_purpose = INVITE, PASSWORD_RESET을 생성한다.

다음을 생성한다.

- branches: UUID primary key, name, address, is_active, created_at, updated_at field를 둔다.
- users: UUID primary key, role, phone, 활성화 전까지 nullable인 password_hash, status, nullable foreign key인 default_branch_id, last_login_at, created_at, updated_at.
- invitations: UUID primary key, user_id, purpose, token_hash, expires_at, used_at, invalidated_at, created_by, created_at field를 둔다.
- sessions: UUID primary key, user_id, token_hash, expires_at, created_at field를 둔다.

다음 index를 정확히 추가한다.

    CREATE UNIQUE INDEX users_phone_uq ON users (phone);
    CREATE UNIQUE INDEX invitations_token_hash_uq ON invitations (token_hash);
    CREATE INDEX invitations_user_purpose_created_idx ON invitations (user_id, purpose, created_at DESC);
    CREATE UNIQUE INDEX sessions_token_hash_uq ON sessions (token_hash);
    CREATE INDEX sessions_user_expires_idx ON sessions (user_id, expires_at);

business user 삭제는 제한하고, 삭제된 테스트 user에 속한 sessions와 invitations에만 cascade를 적용한다. 다음 명령으로 migration을 생성한다.

    npm run db:generate -- --name identity
    npm run db:migrate:test

예상 결과: drizzle/0000_identity.sql과 일치하는 metadata가 생성되고 한 번 적용된다.

package.json script를 다음과 같이 정확히 설정한다.

    "db:generate": "drizzle-kit generate",
    "db:migrate:test": "dotenv -e .env.test -- drizzle-kit migrate",
    "test:db": "dotenv -e .env.test -- vitest run tests/integration"

drizzle.config.ts는 DATABASE_URL_MIGRATIONS가 있으면 이를 사용하고, 없으면 DATABASE_URL_TEST를 사용해야 하며 선택한 URL을 절대 출력하지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/db/identity-schema.test.ts

예상 결과: PASS하고, 중복 phone, invitation token, session token 검증에서 PostgreSQL code 23505를 확인한다.

- [ ] **Step 6: 테스트 정리 REFACTOR**

connection 생성과 역의존성 순서의 TRUNCATE 로직을 tests/integration/helpers/database.ts에 모은다. 동시성 테스트끼리 열린 transaction을 공유하지 않는다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/db/identity-schema.test.ts

예상 결과: 모든 명령이 exit 0으로 종료된다.

- [ ] **Step 8: 커밋**

  git add compose.yaml .env.test.example drizzle.config.ts package.json src/server/env.ts src/server/db drizzle/0000_identity.sql drizzle/meta tests/integration/helpers tests/integration/db/identity-schema.test.ts
  git commit -m "feat: add identity database schema"

### Task 3: 수업 일정과 이용권 Schema 추가

**파일:**

- 생성: src/server/db/schema/scheduling.ts
- 생성: src/server/db/schema/passes.ts
- 생성: drizzle/0001_scheduling_passes.sql
- 생성: drizzle/meta/0001_snapshot.json
- 생성: tests/integration/db/scheduling-pass-schema.test.ts
- 수정: src/server/db/schema/index.ts
- 수정: drizzle/meta/_journal.json

**인터페이스:**

- 입력: Task 2의 branches와 users.
- 출력: typed Drizzle export를 제공하는 ClassTemplate, ClassOccurrence, PassProduct, Pass table.

- [ ] **Step 1: 실패하는 schema 테스트 작성**

class occurrence의 template/date 쌍이 고유한지, capacity와 duration이 양수인지, pass remaining credits가 음수이거나 total credits를 초과할 수 없는지, 활성 pass product 두 개가 공존할 수 없는지 테스트한다.

    await expect(
      db.insert(passProducts).values(secondActiveProduct)
    ).rejects.toMatchObject({ code: '23505' });

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/db/scheduling-pass-schema.test.ts

예상 결과: class_templates, class_occurrences, pass_products, passes가 없으므로 FAIL한다.

- [ ] **Step 3: typed schema와 migration 최소 구현**

다음을 생성한다.

- class_templates: branch_id, name, 1~7로 제한된 weekday, local_start_time, duration_minutes, default_instructor_id, default_capacity, is_active field를 둔다.
- class_occurrences: template_id, class_date, starts_at, ends_at, branch_id, instructor_id, capacity, status NORMAL 또는 CANCELLED, is_date_override field를 둔다.
- pass_products: name, default_credits, default_valid_days, default_price, is_active field를 둔다.
- passes: member_id, product_id, selling_branch_id, paid_amount, total_credits, remaining_credits, starts_on, expires_on, issued_by, issued_at field를 둔다.

다음 constraint와 index를 정확히 추가한다.

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

실행:

    npm run db:generate -- --name scheduling_passes
    npm run db:migrate:test

예상 결과: drizzle/0001_scheduling_passes.sql이 0000_identity.sql 다음에 적용된다.

- [ ] **Step 4: GREEN 실행**

실행:

    npm exec vitest run tests/integration/db/scheduling-pass-schema.test.ts

예상 결과: 모든 check와 uniqueness 사례가 PASS한다.

- [ ] **Step 5: schema export 정리 REFACTOR**

table을 책임별 파일에 두고 src/server/db/schema/index.ts를 통해서만 export한다.

- [ ] **Step 6: Task 검증**

실행:

    npm run typecheck
    npm exec vitest run tests/integration/db

예상 결과: identity와 scheduling/pass schema suite가 PASS한다.

- [ ] **Step 7: 커밋**

  git add src/server/db/schema drizzle/0001_scheduling_passes.sql drizzle/meta tests/integration/db/scheduling-pass-schema.test.ts
  git commit -m "feat: add scheduling and pass schema"

### Task 4: 예약, 원장, 대기, 알림 Constraint 추가

**파일:**

- 생성: src/server/db/schema/bookings.ts
- 생성: src/server/db/schema/notifications.ts
- 생성: drizzle/0002_booking_constraints.sql
- 생성: drizzle/meta/0002_snapshot.json
- 생성: tests/integration/db/booking-constraints.test.ts
- 수정: src/server/db/schema/index.ts
- 수정: drizzle/meta/_journal.json

**인터페이스:**

- 입력: Task 3의 occurrences와 passes.
- 출력: Reservation, PassLedger, WaitlistEntry, Notification table과 데이터베이스가 강제하는 시간 비중복 및 idempotency 보장.

- [ ] **Step 1: 실패하는 constraint 테스트 작성**

한 member에게 시간이 겹치는 confirmed reservation 두 개를 삽입하고 두 번째가 23P01로 실패하는지 검증한다. 서로 맞닿지만 겹치지 않는 interval을 삽입해 둘 다 성공하는지도 검증한다. 중복 request_id, 활성 member/occurrence reservation, 활성 waitlist entry, ledger dedupe_key, notification dedupe_key도 테스트한다.

    await expect(insertOverlappingReservation())
      .rejects.toMatchObject({ code: '23P01' });

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/db/booking-constraints.test.ts

예상 결과: reservation 및 waitlist relation과 exclusion constraint가 없으므로 FAIL한다.

- [ ] **Step 3: table과 일반 index 최소 구현**

reservation_status = CONFIRMED, MEMBER_CANCELLED, CLASS_CANCELLED, waitlist_status = WAITING, OFFERED, CONFIRMED, DECLINED, EXPIRED, CANCELLED, SKIPPED, ledger_type = ISSUE, RESERVATION_DEBIT, MEMBER_CANCEL_RESTORE, CLASS_CANCEL_RESTORE를 생성한다.

다음을 생성한다.

- reservations: member_id, occurrence_id, pass_id, status, request_id, starts_at, ends_at, booked_at, cancelled_at field를 둔다.
- pass_ledger: pass_id, nullable reservation_id, type, delta, dedupe_key, created_at field를 둔다.
- waitlist_entries: member_id, occurrence_id, status, joined_at, offer_expires_at, resolved_at, resolution_reason field를 둔다.
- notifications: member_id, type, title, body, target_path, expires_at, read_at, dedupe_key, created_at field를 둔다.

다음을 추가한다.

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

- [ ] **Step 4: 기본 migration 생성**

실행:

    npm run db:generate -- --name booking_constraints

예상 결과: typed table과 일반 index를 바탕으로 drizzle/0002_booking_constraints.sql과 drizzle/meta/0002_snapshot.json이 생성된다.

- [ ] **Step 5: 데이터베이스 강제 시간 중복 방지 구현**

다음 PostgreSQL object를 drizzle/0002_booking_constraints.sql에 정확히 추가한다.

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

'[)' range는 10:00에 끝나는 수업과 10:00에 시작하는 수업이 겹치지 않게 하므로 반드시 사용한다.

- [ ] **Step 6: migration과 GREEN 실행**

실행:

    npm run db:migrate:test
    npm exec vitest run tests/integration/db/booking-constraints.test.ts

예상 결과: migration이 적용되고, 시간 중복은 23P01로 실패하며, 맞닿은 시간과 모든 idempotency 사례는 PASS한다.

- [ ] **Step 7: PostgreSQL error helper 정리 REFACTOR**

전체 데이터베이스 메시지를 문자열 비교하지 않고 code 23505, 23514, 23P01을 추출하는 typed helper를 tests/integration/helpers/database.ts에 작성한다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm exec vitest run tests/integration/db

예상 결과: 모든 schema와 constraint suite가 PASS한다.

- [ ] **Step 9: 커밋**

  git add src/server/db/schema drizzle/0002_booking_constraints.sql drizzle/meta tests/integration
  git commit -m "feat: enforce booking database constraints"

### Task 5: 결정론적 시간 및 이용권 선택 규칙 구현

**파일:**

- 생성: src/server/shared/result.ts
- 생성: src/server/time/clock.ts
- 생성: src/server/time/seoul.ts
- 생성: src/server/bookings/booking-window.ts
- 생성: src/server/waitlist/waitlist-window.ts
- 생성: src/server/passes/select-pass.ts
- 생성: tests/unit/bookings/booking-window.test.ts
- 생성: tests/unit/waitlist/waitlist-window.test.ts
- 생성: tests/unit/passes/select-pass.test.ts

**인터페이스:**

- 입력: Task 3~4에서 정의한 UTC timestamp와 pass row.
- 출력: Clock.now(), evaluateBookingWindow(now, startsAt), evaluateWaitlistWindow(now, startsAt), calculateOfferExpiry(now, startsAt), selectPass(candidates, classStartsAt).

- [ ] **Step 1: 실패하는 경계값 테스트 작성**

정확히 14일, 1시간, 2시간, 4시간, 30분, 수업 1시간 전 경계를 모두 다룬다. 이용권 선택 시 잔여 횟수가 0이거나 수업 날짜에 만료된 pass를 제외하고 expiresOn이 빠른 순서, issuedAt이 오래된 순서, id 순서로 정렬한다.

    expect(evaluateBookingWindow(openBoundary, classStart)).toEqual({
      canBook: true,
      canCancel: true,
    });

    expect(selectPass(candidates, classStart)?.id).toBe('earliest-expiry');

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/bookings tests/unit/waitlist tests/unit/passes

예상 결과: 규칙 module이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 pure function 구현**

주입된 Date object를 사용하고 Asia/Seoul 변환에만 Luxon을 사용한다. 4시간 전보다 이르면 OFFER_AUTO, 4시간 전부터 1시간 전 직전까지는 OFFER_ACCEPT, 1시간 전부터는 CLOSED를 반환한다. calculateOfferExpiry는 현재 시각에서 30분 뒤와 수업 시작 1시간 전 중 빠른 시각을 반환한다.

- [ ] **Step 4: GREEN 실행**

실행:

    npm exec vitest run tests/unit/bookings tests/unit/waitlist tests/unit/passes

예상 결과: timer나 sleep 없이 모든 경계값 및 정렬 테스트가 PASS한다.

- [ ] **Step 5: 반복되는 날짜 비교 REFACTOR**

하나의 Clock interface와 비교 helper만 유지하고 domain rule 내부에서 Date.now()를 읽지 않는다.

- [ ] **Step 6: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run test:unit

예상 결과: 모든 명령이 exit 0으로 종료된다.

- [ ] **Step 7: 커밋**

  git add src/server/shared src/server/time src/server/bookings/booking-window.ts src/server/waitlist/waitlist-window.ts src/server/passes/select-pass.ts tests/unit/bookings tests/unit/waitlist tests/unit/passes
  git commit -m "feat: add booking and pass domain rules"

### Task 6: 비밀번호 로그인과 불투명 Session 구현

**파일:**

- 생성: src/server/auth/password.ts
- 생성: src/server/auth/token.ts
- 생성: src/server/auth/session.ts
- 생성: src/server/auth/login.ts
- 생성: src/app/(auth)/login/page.tsx
- 생성: src/app/(auth)/login/actions.ts
- 생성: src/app/(auth)/logout/actions.ts
- 생성: tests/unit/auth/password.test.ts
- 생성: tests/integration/auth/session-login.test.ts
- 수정: src/app/page.tsx
- 수정: src/server/env.ts

**인터페이스:**

- 입력: Task 2의 users와 sessions, Task 5의 Clock.
- 출력: hashPassword(plain), verifyPassword(plain, hash), hashToken(token), hashSessionToken(token, sessionSecret), login(phone, password), createSession(userId), getCurrentSession(), requireSession(), logout().

- [ ] **Step 1: 실패하는 비밀번호 및 session 테스트 작성**

unit test는 bcrypt hash가 plaintext와 다르고 올바르게 검증되는지 확인한다. integration test는 user를 활성화하고 정규화된 phone으로 로그인하며, SESSION_SECRET을 key로 사용하는 HMAC-SHA-256 session token hash만 저장하는지, 잘못된 비밀번호와 만료된 session을 거부하는지 확인한다.

    const result = await login('010-1234-5678', 'correct-password');
    expect(result.ok).toBe(true);
    expect(await sessionRow()).not.toHaveProperty('tokenHash', result.value.token);

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/auth/password.test.ts tests/integration/auth/session-login.test.ts

예상 결과: password, token, session function이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 authentication 동작 구현**

한국 휴대전화 번호를 숫자만 남도록 정규화하고, bcryptjs cost 12로 비밀번호를 hash하며, 32-byte 무작위 opaque token을 생성한다. invitation/reset token은 SHA-256으로, session token은 SESSION_SECRET을 사용하는 HMAC-SHA-256으로 저장하며 session은 7일 뒤 만료한다. cookie lf_session은 HttpOnly, SameSite=Lax, Path=/로 설정하고 local development 밖에서는 Secure를 설정한다. login은 계정 존재 여부를 노출하지 않고 모든 phone/password 불일치에 INVALID_CREDENTIALS를 반환한다.

다음 public result shape을 사용한다.

    type LoginResult =
      | { ok: true; value: { userId: string; token: string; expiresAt: Date } }
      | { ok: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' };

- [ ] **Step 4: login 및 logout Server Action 추가**

form data를 Zod로 검증하고 login()을 호출하며 service가 성공한 뒤에만 cookie를 설정하거나 지운다. 인증된 user는 role에 따라 redirect한다. page에는 phone 및 password label과 aria-live가 있는 오류 요약을 포함한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/unit/auth/password.test.ts tests/integration/auth/session-login.test.ts

예상 결과: 모든 password, normalization, login, expiry, storage 검증이 PASS한다.

- [ ] **Step 6: cookie 접근을 하나의 adapter 뒤로 REFACTOR**

Next.js cookies() 호출을 password 및 repository module 밖에 두어 테스트가 in-memory CookieStore interface를 사용하게 한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/auth tests/integration/auth

예상 결과: 모든 명령이 exit 0으로 종료된다.

- [ ] **Step 8: 커밋**

  git add -- src/server/auth "src/app/(auth)" src/app/page.tsx src/server/env.ts tests/unit/auth tests/integration/auth
  git commit -m "feat: add secure member sessions"

### Task 7: 관리자 초대와 비밀번호 재설정 구현

**파일:**

- 생성: src/server/auth/invitations.ts
- 생성: src/server/members/member-service.ts
- 생성: src/app/(admin)/admin/members/page.tsx
- 생성: src/app/(admin)/admin/members/actions.ts
- 생성: src/app/(admin)/admin/members/member-form.tsx
- 생성: src/app/(auth)/invite/[token]/page.tsx
- 생성: src/app/(auth)/invite/[token]/actions.ts
- 생성: src/app/(auth)/reset/[token]/page.tsx
- 생성: src/app/(auth)/reset/[token]/actions.ts
- 생성: tests/integration/auth/invitations.test.ts
- 생성: tests/unit/auth/invitation-forms.test.tsx

**인터페이스:**

- 입력: Task 2와 6의 password/token utility 및 identity schema.
- 출력: createMemberAndInvitation(input), createPasswordReset(userId), consumeInvitation(token, password), 복사 가능한 URL /invite/{token}, /reset/{token}.

- [ ] **Step 1: 실패하는 invitation lifecycle 테스트 작성**

invite token이 7일 뒤 만료되고 한 번만 사용되는지 검증한다. reset token이 30분 뒤 만료되는지도 검증한다. 같은 user와 purpose에 사용되지 않은 token을 다시 생성하면 동일 transaction에서 기존 token의 invalidated_at을 설정해야 한다.

    const second = await createPasswordReset(memberId);
    expect(await firstTokenRow()).toMatchObject({ invalidatedAt: expect.any(Date) });
    await expect(consumeInvitation(first.rawToken, 'new-password'))
      .resolves.toMatchObject({ ok: false, error: 'TOKEN_INVALID' });

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/auth/invitations.test.ts tests/unit/auth/invitation-forms.test.tsx

예상 결과: invitation service와 page가 없으므로 FAIL한다.

- [ ] **Step 3: 최소 invitation transaction 구현**

createMemberAndInvitation은 phone 고유성을 검증하고 INVITED MEMBER를 생성하며, 기존 INVITE token을 무효화하고 새 token hash만 저장한 뒤 raw token을 한 번 반환한다. consumeInvitation은 invitation row를 lock하고 purpose, invalidated_at, used_at, database time 기준 만료를 확인한 뒤 password hash 저장, user 활성화, used_at 표시를 원자적으로 처리한다. Reset token 사용은 비밀번호 변경, token 사용 표시, 모든 user session 삭제를 같은 transaction에서 처리한다.

- [ ] **Step 4: 관리자 및 token page 구현**

admin form은 phone과 default branch를 입력받고 생성된 link의 복사 button을 표시한다. 관리자가 기존 channel로 link를 보낸다고 명시하고 Kakao, SMS, email API를 호출하지 않는다. Invite 및 reset page는 새 비밀번호를 두 번 입력받고 저장된 token hash를 절대 노출하지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/auth/invitations.test.ts tests/unit/auth/invitation-forms.test.tsx

예상 결과: lifecycle, expiry, invalidation, activation, reset, rendering 테스트가 PASS한다.

- [ ] **Step 6: 공유 token 사용 로직 REFACTOR**

row locking과 expiry 검증은 공유하되 INVITE activation과 PASSWORD_RESET session revocation은 명시적으로 분리된 branch로 유지한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/auth tests/integration/auth

예상 결과: 모든 authentication 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- src/server/auth/invitations.ts src/server/members "src/app/(admin)/admin/members" "src/app/(auth)/invite" "src/app/(auth)/reset" tests/integration/auth tests/unit/auth
  git commit -m "feat: add managed member invitations"

### Task 8: 역할 및 지점 Authorization 강제

**파일:**

- 생성: src/server/authorization/permissions.ts
- 생성: src/server/authorization/guards.ts
- 생성: src/app/(member)/layout.tsx
- 생성: src/app/(admin)/admin/layout.tsx
- 생성: src/app/(instructor)/instructor/layout.tsx
- 생성: src/app/forbidden/page.tsx
- 생성: tests/unit/authorization/permissions.test.ts
- 생성: tests/integration/authorization/guards.test.ts
- 수정: src/app/(admin)/admin/members/actions.ts

**인터페이스:**

- 입력: Task 6의 requireSession()과 Task 2의 user role/defaultBranchId.
- 출력: can(permission, actor, resource), requireRole(roles), requireBranchAccess(branchId), requireOwnMember(memberId), requireAssignedOccurrence(occurrenceId).

- [ ] **Step 1: 실패하는 permission matrix 작성**

HEAD_ADMIN, BRANCH_ADMIN, INSTRUCTOR, MEMBER에 대한 table-driven test를 정의한다. instructor의 pass 변경 및 attendance 변경 거부, branch-admin의 다른 branch 접근 거부, member의 본인 데이터만 접근 허용하는 사례를 포함한다.

    expect(can('PASS_ISSUE', instructor, branchResource)).toBe(false);
    expect(can('MEMBER_READ', branchAdmin, otherBranchMember)).toBe(false);
    expect(can('OCCURRENCE_ROSTER_READ', instructor, assignedOccurrence)).toBe(true);

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/authorization tests/integration/authorization

예상 결과: permission 및 guard module이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 명시적 permission map 구현**

숨겨진 navigation으로 접근 권한을 추론하지 않는다. 각 guard는 server-side에서 resource를 불러와 typed FORBIDDEN result를 반환하거나 layout에서 /forbidden으로 redirect한다. HEAD_ADMIN은 모든 branch에 접근할 수 있고, BRANCH_ADMIN은 default_branch_id로 제한되며, INSTRUCTOR는 instructor_id가 일치하는 occurrence만 읽을 수 있고, MEMBER는 본인 member record만 읽고 변경할 수 있다.

- [ ] **Step 4: 기존 관리자 action에 guard 적용**

Member 생성, invitation 생성, reset 생성은 범위가 지정된 데이터를 읽거나 쓰기 전에 requireRole과 requireBranchAccess를 호출해야 한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/unit/authorization tests/integration/authorization

예상 결과: 모든 role, branch, ownership, assigned-class 사례가 PASS한다.

- [ ] **Step 6: resource loading 정리 REFACTOR**

전체 member 또는 occurrence record 대신 최소 authorization projection을 반환하고 authorization query에서 UI formatting을 제외한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/authorization tests/integration/authorization

예상 결과: 모든 명령이 exit 0으로 종료된다.

- [ ] **Step 8: 커밋**

  git add -- src/server/authorization "src/app/(member)/layout.tsx" "src/app/(admin)/admin/layout.tsx" "src/app/(instructor)" src/app/forbidden "src/app/(admin)/admin/members/actions.ts" tests/unit/authorization tests/integration/authorization
  git commit -m "feat: enforce role and branch access"

### Task 9: 지점 및 직원 관리 추가

**파일:**

- 생성: src/server/branches/branch-service.ts
- 생성: src/server/staff/staff-service.ts
- 생성: src/app/(admin)/admin/branches/page.tsx
- 생성: src/app/(admin)/admin/branches/actions.ts
- 생성: src/app/(admin)/admin/staff/page.tsx
- 생성: src/app/(admin)/admin/staff/actions.ts
- 생성: src/components/admin/branch-form.tsx
- 생성: src/components/admin/staff-form.tsx
- 생성: tests/integration/admin/branches-staff.test.ts
- 생성: tests/unit/admin/branches-staff-forms.test.tsx

**인터페이스:**

- 입력: Task 2와 8의 identity schema 및 authorization guard.
- 출력: createBranch(), updateBranch(), createStaff(), updateStaffAssignment(), listVisibleBranches(), listVisibleStaff().

- [ ] **Step 1: 실패하는 service 및 form 테스트 작성**

HEAD_ADMIN만 branch를 생성하거나 HEAD_ADMIN role을 할당할 수 있는지 검증한다. BRANCH_ADMIN은 본인 branch에 할당할 INSTRUCTOR를 생성할 수 있지만 다른 branch를 대상으로 할 수 없는지 검증한다. phone 고유성과 BRANCH_ADMIN 및 INSTRUCTOR의 필수 branch를 검증한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/admin/branches-staff.test.ts tests/unit/admin/branches-staff-forms.test.tsx

예상 결과: branch 및 staff service가 없으므로 FAIL한다.

- [ ] **Step 3: 최소 branch 및 staff service 구현**

각 transaction 전에 Zod input schema와 authorization을 적용한다. Staff account는 INVITED 상태로 시작하며 요청된 staff role로 createMemberAndInvitation을 재사용한다. 삭제 기능은 추가하지 않고 foreign key를 보존하도록 is_active 또는 user status를 DISABLED로 설정한다.

- [ ] **Step 4: 관리자 page 구현**

actor에게 허용된 branch만 보여주는 접근 가능한 table과 form을 작성한다. staff 생성 성공 후 생성된 invitation link를 정확히 한 번 표시한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/admin/branches-staff.test.ts tests/unit/admin/branches-staff-forms.test.tsx

예상 결과: role 및 branch scope 테스트가 PASS한다.

- [ ] **Step 6: form result 처리 REFACTOR**

validation, forbidden, conflict, success state에 하나의 serializable ActionResult type을 사용한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/admin tests/unit/admin

예상 결과: 현재의 모든 관리자 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- src/server/branches src/server/staff "src/app/(admin)/admin/branches" "src/app/(admin)/admin/staff" src/components/admin tests/integration/admin tests/unit/admin
  git commit -m "feat: add branch and staff administration"

### Task 10: 주간 반복 수업 템플릿 관리

**파일:**

- 생성: src/server/scheduling/template-service.ts
- 생성: src/app/(admin)/admin/schedule/templates/page.tsx
- 생성: src/app/(admin)/admin/schedule/templates/actions.ts
- 생성: src/components/admin/class-template-form.tsx
- 생성: tests/integration/scheduling/class-templates.test.ts
- 생성: tests/unit/scheduling/class-template-form.test.tsx

**인터페이스:**

- 입력: scheduling schema, branch/instructor record, branch guard.
- 출력: createClassTemplate(), updateClassTemplate(), deactivateClassTemplate(), listClassTemplatesForActor().

- [ ] **Step 1: 실패하는 template 테스트 작성**

weekday가 1~7인지, duration과 capacity가 양수인지, instructor가 활성 상태인지, branch administrator가 본인 branch 밖의 template을 관리할 수 없는지 검증한다. template 수정이 이미 생성된 occurrence를 변경하지 않는지도 검증한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/scheduling/class-templates.test.ts tests/unit/scheduling/class-template-form.test.tsx

예상 결과: template service와 form이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 template service 구현**

branch, name, weekday, local start time, duration, default instructor, default capacity를 저장한다. Asia/Seoul local value는 template 경계에서만 사용하고 occurrence에는 UTC timestamp를 저장한다. 비활성화하면 향후 materialization만 중단하고 이력을 삭제하지 않는다.

- [ ] **Step 4: 관리자 template page 구현**

server-side authorization 및 validation이 적용된 생성, 수정, 비활성화 control을 제공한다. room, class category, 반복 규칙 library, 자동 대강 matching은 추가하지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/scheduling/class-templates.test.ts tests/unit/scheduling/class-template-form.test.tsx

예상 결과: validation, authorization, immutability, UI 테스트가 PASS한다.

- [ ] **Step 6: local-time 변환 입력 REFACTOR**

occurrence 생성을 form layer로 옮기지 않고 HH:mm validation과 weekday label을 한곳에 모은다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling tests/unit/scheduling

예상 결과: 현재의 모든 scheduling 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- src/server/scheduling/template-service.ts "src/app/(admin)/admin/schedule/templates" src/components/admin/class-template-form.tsx tests/integration/scheduling tests/unit/scheduling
  git commit -m "feat: manage weekly class templates"

### Task 11: 14일 수업 회차 생성과 날짜별 예외 관리

**파일:**

- 생성: src/server/scheduling/occurrence-materializer.ts
- 생성: src/server/scheduling/occurrence-service.ts
- 생성: src/app/(admin)/admin/schedule/occurrences/page.tsx
- 생성: src/app/(admin)/admin/schedule/occurrences/actions.ts
- 생성: src/components/admin/occurrence-exception-form.tsx
- 생성: tests/unit/scheduling/occurrence-materializer.test.ts
- 생성: tests/integration/scheduling/occurrences.test.ts

**인터페이스:**

- 입력: Task 10의 templates, Task 5의 Seoul time utility, Task 4의 booking 및 waitlist table.
- 출력: materializeOccurrences(branchId, fromDate, throughDate), updateOccurrenceException(), listOccurrences(). Cron은 사용하지 않는다.

- [ ] **Step 1: 실패하는 materialization 테스트 작성**

화요일 09:00 Seoul template이 주어졌을 때 다음 14일 범위에 해당하는 화요일만 UTC starts/ends로 생성되는지 검증한다. 호출을 반복하면 같은 row를 반환해야 한다. 저장한 instructor/capacity 예외가 materialization 재호출 뒤에도 유지되는지도 검증한다.

    const first = await materializeOccurrences(branchId, '2026-07-29', '2026-08-11');
    const second = await materializeOccurrences(branchId, '2026-07-29', '2026-08-11');
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/scheduling/occurrence-materializer.test.ts tests/integration/scheduling/occurrences.test.ts

예상 결과: occurrence materialization이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 idempotent materialization 구현**

Luxon으로 Asia/Seoul local date/time을 만들고 UTC로 변환한 뒤 INSERT ... ON CONFLICT (template_id, class_date) DO NOTHING을 실행한다. 삽입 후 저장된 row를 읽는다. materialization 중 기존 occurrence field를 절대 덮어쓰지 않는다.

- [ ] **Step 4: 예외 validation 및 page 구현**

권한이 있는 administrator가 하나의 occurrence에서 instructor 또는 capacity를 변경하고 is_date_override를 설정할 수 있게 한다. capacity를 줄이기 전에 occurrence를 lock하고 confirmed reservation 수와 OFFERED waitlist 수의 합보다 작은 값은 거부한다. 이 Task에서는 cancellation을 구현하지 않으며 복원 및 종료 workflow는 Task 20이 담당한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/unit/scheduling/occurrence-materializer.test.ts tests/integration/scheduling/occurrences.test.ts

예상 결과: timezone, idempotency, 예외 유지, authorization, capacity 하한 테스트가 PASS한다.

- [ ] **Step 6: date-range 반복 REFACTOR**

member query에는 명시적 최대 범위가 14일인 하나의 inclusive date iterator를 유지하고, administrator query는 별도로 제한된 범위를 전달한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/scheduling tests/integration/scheduling

예상 결과: 모든 scheduling 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- src/server/scheduling "src/app/(admin)/admin/schedule/occurrences" src/components/admin/occurrence-exception-form.tsx tests/unit/scheduling tests/integration/scheduling
  git commit -m "feat: materialize class occurrences"

### Task 12: 전 지점 공용 그룹수업권 발급

**파일:**

- 생성: src/server/passes/pass-service.ts
- 생성: src/server/passes/pass-queries.ts
- 생성: src/app/(admin)/admin/passes/issue/page.tsx
- 생성: src/app/(admin)/admin/passes/issue/actions.ts
- 생성: src/components/admin/pass-issue-form.tsx
- 생성: src/app/(member)/passes/page.tsx
- 생성: tests/integration/passes/pass-issuance.test.ts
- 생성: tests/unit/passes/pass-issue-form.test.tsx

**인터페이스:**

- 입력: pass table, ledger table, branch/member authorization, selectPass() ordering.
- 출력: issuePass(input), listMemberPasses(memberId), ensureSingleActiveProduct().

- [ ] **Step 1: 실패하는 발급 테스트 작성**

발급 시 member, selling branch, actual paid amount, total credits, remaining credits, 시작일, 만료일, 발급 administrator를 저장하는지 검증한다. pass와 ISSUE ledger가 함께 commit되고 함께 rollback되는지도 검증한다. branch administrator가 다른 branch 명의로 발급할 수 없는지도 검증한다.

    expect(await ledgerFor(pass.id)).toMatchObject({
      type: 'ISSUE',
      delta: 10,
      dedupeKey: 'pass:' + pass.id + ':issue',
    });

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/passes/pass-issuance.test.ts tests/unit/passes/pass-issue-form.test.tsx

예상 결과: pass 발급 및 UI module이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 발급 transaction 구현**

하나의 활성 pass product를 불러오고 actual credits, amount, startsOn, expiresOn을 검증한다. remaining_credits가 total_credits와 같은 pass를 삽입하고 ISSUE ledger도 같은 transaction에서 삽입한다. selling branch는 기록하지만 이후 사용 지점을 제한하지 않는다.

- [ ] **Step 4: 관리자 발급 및 member pass page 구현**

administrator page는 product default를 표시하되 actual amount, credit count, validity 변경을 허용한다. member page는 현재 member 본인의 pass만 selling branch, validity, remaining/total credits와 함께 표시한다. 결제는 받지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/passes/pass-issuance.test.ts tests/unit/passes/pass-issue-form.test.tsx

예상 결과: transaction, branch, default, rendering 테스트가 PASS한다.

- [ ] **Step 6: pass projection 정리 REFACTOR**

admin view type과 member view type을 분리해 password, phone, 내부 ledger dedupe key가 member component에 절대 전달되지 않게 한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/passes tests/integration/passes

예상 결과: 모든 pass 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- src/server/passes "src/app/(admin)/admin/passes" "src/app/(member)/passes" src/components/admin/pass-issue-form.tsx tests/unit/passes tests/integration/passes
  git commit -m "feat: issue shared group class passes"

### Task 13: 회원용 14일 시간표 표시

**파일:**

- 생성: src/server/scheduling/member-schedule-query.ts
- 생성: src/app/(member)/schedule/page.tsx
- 생성: src/components/member/branch-filter.tsx
- 생성: src/components/member/class-card.tsx
- 생성: tests/integration/scheduling/member-schedule.test.ts
- 생성: tests/unit/member/class-card.test.tsx
- 수정: src/app/(member)/layout.tsx
- 수정: src/app/page.tsx

**인터페이스:**

- 입력: materializeOccurrences(), booking-window rule, 현재 member session.
- 출력: capacity summary와 booking-window state가 포함된 14일 occurrence card를 반환하는 getMemberSchedule({ memberId, branchId, now }).

- [ ] **Step 1: 실패하는 schedule-query 및 card 테스트 작성**

범위가 now가 속한 Seoul calendar date부터 시작해 13일 뒤에 끝나는지, 활성 branch 세 곳을 모두 포함하는지, cancelled occurrence가 예약 가능 결과에서 제외되는지, open, full, closed, cancelled state label이 표시되는지 검증한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member/class-card.test.tsx

예상 결과: member schedule query와 component가 없으므로 FAIL한다.

- [ ] **Step 3: 최소 schedule query 구현**

Cron 없이 요청된 branch 범위를 materialize하고 CONFIRMED reservation 및 OFFERED hold 수를 세며 member private data 없이 remaining capacity를 반환한다. 주입된 now로 booking window를 적용하고 absolute UTC timestamp와 미리 formatting된 Seoul label을 제공한다.

- [ ] **Step 4: 반응형 member page 구현**

branch filter, 날짜 section, 44px control, empty state, class card를 rendering한다. card는 /schedule/{occurrenceId}로 연결하고 detail route와 booking action은 Task 15에서 추가한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member/class-card.test.tsx

예상 결과: range, branch, capacity, state, 반응형 component 테스트가 PASS한다.

- [ ] **Step 6: card view model 정리 REFACTOR**

database row를 React props에서 제외하고 하나의 serializable MemberClassCard model을 제공한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling/member-schedule.test.ts tests/unit/member

예상 결과: 모든 명령이 exit 0으로 종료된다.

- [ ] **Step 8: 커밋**

  git add -- src/server/scheduling/member-schedule-query.ts "src/app/(member)/schedule" src/components/member "src/app/(member)/layout.tsx" src/app/page.tsx tests/integration/scheduling/member-schedule.test.ts tests/unit/member
  git commit -m "feat: show member class schedule"

### Task 14: 동시성 상황에서 수업 예약을 Transaction으로 처리

**파일:**

- 생성: src/server/bookings/booking-errors.ts
- 생성: src/server/bookings/reservation-repository.ts
- 생성: src/server/bookings/reserve-class.ts
- 생성: tests/integration/bookings/reserve-class.test.ts
- 생성: tests/integration/bookings/reserve-class-concurrency.test.ts
- 수정: tests/integration/helpers/database.ts

**인터페이스:**

- 입력: booking/pass rule, reservations, passes, ledgers, waitlist entries, PostgreSQL constraint.
- 출력: reserveClass({ memberId, occurrenceId, requestId, now }): Promise<Result<ReservationView, BookingError>>. BookingError는 CLOSED, CANCELLED_CLASS, FULL, WAITLIST_HAS_PRIORITY, DUPLICATE, TIME_OVERLAP, NO_VALID_PASS다.

- [ ] **Step 1: 실패하는 transaction 테스트 작성**

성공한 debit/ledger/reservation의 atomicity, 유효한 pass 없음, 닫힌 예약 window, cancelled occurrence, 활성 waitlist 우선권, idempotent request 재실행, 강제 insert 실패 시 pass debit rollback을 다룬다. 모든 성공한 전환 뒤 ISSUE와 debit/restore ledger delta의 합이 저장된 remaining credits와 일치하는지 검증한다.

    const result = await reserveClass(input);
    expect(result.ok).toBe(true);
    expect(await remainingCredits(passId)).toBe(9);
    expect(await debitLedgerCount(result.value.id)).toBe(1);

- [ ] **Step 2: 실패하는 동시성 테스트 작성**

별도 database connection과 Promise.all을 사용해 두 member가 마지막 한 자리를 경쟁하게 하고 정확히 하나만 성공하는지 검증한다. 한 member가 시간이 겹치는 occurrence 두 개를 동시에 예약하게 하고 정확히 하나만 성공하며 거부된 결과가 TIME_OVERLAP인지 검증한다. 두 request가 같은 1회 남은 pass를 debit하게 해 remaining credits가 절대 음수가 되지 않는지도 확인한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/bookings/reserve-class.test.ts tests/integration/bookings/reserve-class-concurrency.test.ts

예상 결과: reserveClass가 없으므로 FAIL한다.

- [ ] **Step 4: lock을 사용하는 최소 transaction 구현**

하나의 transaction 안에서 다음을 실행한다.

    SELECT id FROM class_occurrences WHERE id = $1 FOR UPDATE;

그다음 database current time을 사용해 occurrence와 booking window를 검증한다. request_id에 해당하는 기존 reservation이 있으면 이를 반환하고, WAITING 또는 OFFERED queue가 있으면 거부한다. CONFIRMED reservation과 OFFERED hold 수를 세고 expires_on, issued_at, id 순서의 첫 번째 적격 pass를 선택해 lock한다. remaining_credits를 조건부로 감소시키고 reservation과 delta -1 ledger를 dedupe key reservation:{reservationId}:debit로 삽입한다.

transaction이 rollback될 때까지 error를 catch하지 않는다. PostgreSQL 23P01은 TIME_OVERLAP으로, 관련 23505 request-id race는 이미 저장된 idempotent result로 mapping한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/bookings/reserve-class.test.ts tests/integration/bookings/reserve-class-concurrency.test.ts

예상 결과: 모든 transaction 테스트가 PASS하고, 동시성 결과에서 승자는 하나이며 capacity 초과, 시간 중복, 음수 credit이 없다.

- [ ] **Step 6: lock 순서와 result mapping REFACTOR**

모든 booking 관련 service에서 occurrence 다음 pass 순서로 lock한다. database constraint를 약화하지 않고 PostgreSQL error-code mapping을 한곳에 모은다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings

예상 결과: 모든 booking integration 테스트가 반복 실행에서도 PASS한다.

- [ ] **Step 8: 커밋**

  git add src/server/bookings tests/integration/bookings tests/integration/helpers/database.ts
  git commit -m "feat: reserve classes transactionally"

### Task 15: 회원 예약 Action과 예약 화면 추가

**파일:**

- 생성: src/app/(member)/schedule/[occurrenceId]/page.tsx
- 생성: src/app/(member)/schedule/[occurrenceId]/actions.ts
- 생성: src/components/member/booking-button.tsx
- 생성: src/app/(member)/reservations/page.tsx
- 생성: src/server/bookings/reservation-queries.ts
- 생성: tests/unit/member/booking-button.test.tsx
- 생성: tests/integration/bookings/booking-action.test.ts
- 수정: src/components/member/class-card.tsx

**인터페이스:**

- 입력: reserveClass(), 현재 member session, member schedule query.
- 출력: bookOccurrenceAction(formData), class detail page, listMemberReservations(memberId).

- [ ] **Step 1: 실패하는 action 및 component 테스트 작성**

action이 제출된 memberId를 모두 무시하고 form 범위 UUID requestId를 생성하거나 입력받으며, 각 BookingError를 한국어 문구로 mapping하고 두 번째 debit으로 재시도하지 않는지 검증한다. 2시간 이내 예약은 확정 전에 취소 불가 경고를 명확히 표시하는지도 검증한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/member/booking-button.test.tsx tests/integration/bookings/booking-action.test.ts

예상 결과: booking action과 component가 없으므로 FAIL한다.

- [ ] **Step 3: 최소 booking action 구현**

requireSession()에서 memberId를 가져오고 occurrenceId/requestId를 Zod로 검증하며 reserveClass를 한 번 호출한다. 성공 시 /schedule과 /reservations를 revalidate하고 serializable ActionResult를 반환한다. detail page는 모든 action result 이후 server state를 다시 불러온다.

- [ ] **Step 4: reservation 목록 및 booking UI 구현**

class, branch, Seoul start time, 사용된 pass, status, 이후 cancellation 가능 여부를 표시한다. URL 조작으로 다른 member의 reservation을 노출하지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/unit/member/booking-button.test.tsx tests/integration/bookings/booking-action.test.ts

예상 결과: identity, 오류 문구, 경고, idempotency, rendering 테스트가 PASS한다.

- [ ] **Step 6: action-result 표시 REFACTOR**

오류 markup을 중복하지 않고 aria-live가 있는 하나의 member ActionMessage component를 사용한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/unit/member tests/integration/bookings

예상 결과: 현재의 모든 member booking 테스트가 PASS한다.

- [ ] **Step 8: 커밋**

  git add -- "src/app/(member)/schedule/[occurrenceId]" "src/app/(member)/reservations" src/components/member src/server/bookings/reservation-queries.ts tests/unit/member tests/integration/bookings/booking-action.test.ts
  git commit -m "feat: add member class booking flow"

### Task 16: 만석 수업 대기 신청 및 철회

**파일:**

- 생성: src/server/waitlist/waitlist-errors.ts
- 생성: src/server/waitlist/waitlist-service.ts
- 생성: src/server/waitlist/waitlist-queries.ts
- 생성: src/app/(member)/schedule/[occurrenceId]/waitlist-actions.ts
- 생성: src/components/member/waitlist-button.tsx
- 생성: tests/integration/waitlist/enrollment.test.ts
- 생성: tests/unit/member/waitlist-button.test.tsx
- 수정: src/app/(member)/schedule/[occurrenceId]/page.tsx

**인터페이스:**

- 입력: occurrence lock 규칙, 현재 member, pass 적격성, booking window.
- 출력: joinWaitlist({ memberId, occurrenceId, now }), cancelWaitlist({ memberId, occurrenceId }), getMemberWaitlistState(), joinWaitlistAction(), cancelWaitlistAction().

- [ ] **Step 1: 실패하는 waitlist 적격성 테스트 작성**

수업이 만석이고 booking이 아직 열려 있으며 member에게 수업 시작 시점까지 유효한 credit이 하나 이상 있고 confirmed booking이나 활성 queue entry가 없을 때만 대기 신청을 허용하는지 검증한다. 대기 신청이 credit을 차감하거나 선점하지 않는지도 검증한다.

    const before = await remainingCredits(passId);
    const result = await joinWaitlist(input);
    expect(result.ok).toBe(true);
    expect(await remainingCredits(passId)).toBe(before);

- [ ] **Step 2: 실패하는 순서 및 취소 테스트 작성**

같은 timestamp로 entry를 삽입하고 UUID id가 최종 정렬 기준인지 검증한다. member cancellation이 본인의 활성 WAITING entry만 CANCELLED로 변경하며 다른 member의 entry를 취소할 수 없는지도 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/waitlist/enrollment.test.ts tests/unit/member/waitlist-button.test.tsx

예상 결과: waitlist service, action, component가 없으므로 FAIL한다.

- [ ] **Step 4: 최소 대기 신청 transaction 구현**

occurrence를 lock하고 confirmed 및 offered capacity를 다시 세어 FULL인지 확인한다. 활성 reservation/waitlist가 없는지 확인하고 적격 pass를 조회하되 lock하거나 차감하지 않는다. database joined_at과 함께 WAITING을 삽입하고 partial-unique race를 ALREADY_WAITING으로 mapping한다.

- [ ] **Step 5: waitlist control 구현**

class detail page는 대기 신청 자격이 있는 만석 수업에만 Join waitlist를, 현재 member의 WAITING entry에만 Cancel waitlist를 표시한다. 순번은 해당 entry보다 앞서 정렬되는 WAITING row 수를 조회 시점에 세어 표시한다.

- [ ] **Step 6: GREEN 실행**

실행:

    npm exec vitest run tests/integration/waitlist/enrollment.test.ts tests/unit/member/waitlist-button.test.tsx

예상 결과: eligibility, no-debit, 안정적 순서, ownership, UI 테스트가 PASS한다.

- [ ] **Step 7: 활성 state predicate REFACTOR**

WAITING/OFFERED 활성 predicate를 schema query helper에 한 번 정의하고 booking, enrollment, list query에서 재사용한다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/waitlist tests/unit/member/waitlist-button.test.tsx

예상 결과: 모든 waitlist enrollment 테스트가 PASS한다.

- [ ] **Step 9: 커밋**

  git add -- src/server/waitlist "src/app/(member)/schedule/[occurrenceId]" src/components/member/waitlist-button.tsx tests/integration/waitlist tests/unit/member/waitlist-button.test.tsx
  git commit -m "feat: add full class waitlist enrollment"

### Task 17: 대기자를 자동 예약 또는 수락 제안으로 전환

**파일:**

- 생성: src/server/bookings/confirm-on-locked-occurrence.ts
- 생성: src/server/waitlist/advance-waitlist.ts
- 생성: tests/integration/waitlist/advance-waitlist.test.ts
- 생성: tests/integration/waitlist/advance-waitlist-concurrency.test.ts
- 수정: src/server/bookings/reserve-class.ts
- 수정: src/server/bookings/reservation-repository.ts

**인터페이스:**

- 입력: lock된 occurrence transaction, pass debit rule, overlap constraint, queue ordering.
- 출력: confirmOnLockedOccurrence(tx, input), advanceWaitlist({ occurrenceId, now }): Promise<AdvanceOutcome[]>. outcome은 AUTO_CONFIRMED, OFFERED, SKIPPED, CLOSED다.

- [ ] **Step 1: 실패하는 자동 확정 테스트 작성**

4시간 전보다 이른 시점에는 첫 번째 적격 WAITING member가 CONFIRMED가 되고 reservation과 한 번의 debit을 받으며 이후 member의 순서가 유지되는지 검증한다. pass가 무효가 되었거나 일정이 겹치게 된 member는 명시적 resolution_reason과 함께 SKIPPED가 되고 다음 적격 member가 처리되는지도 검증한다.

- [ ] **Step 2: 실패하는 수락 제안 테스트 작성**

4시간 전부터 1시간 전 직전까지 첫 번째 적격 member가 OFFERED가 되고 pass가 차감되지 않으며 offer_expires_at이 database now에서 30분 뒤와 수업 1시간 전 중 빠른 시각과 같은지 검증한다. OFFERED가 capacity를 점유하는지도 검증한다.

- [ ] **Step 3: 실패하는 동시성 테스트 작성**

별도 connection으로 하나의 빈자리에 advanceWaitlist를 동시에 호출한다. reservation 또는 offer가 하나만 생성되고 어떤 member도 두 번 승격되지 않으며 capacity를 초과하지 않는지 검증한다.

- [ ] **Step 4: RED 실행**

실행:

    npm exec vitest run tests/integration/waitlist/advance-waitlist.test.ts tests/integration/waitlist/advance-waitlist-concurrency.test.ts

예상 결과: advanceWaitlist가 없으므로 FAIL한다.

- [ ] **Step 5: lock된 확정 primitive 추출**

confirmOnLockedOccurrence는 caller가 이미 occurrence lock을 보유한다고 가정한다. member 시간 중복을 다시 확인하고 유효한 pass를 선택해 lock하며 한 credit을 차감한다. idempotent source request id로 reservation을 생성하고 debit ledger를 만들며 전달받은 waitlist entry를 같은 transaction에서 CONFIRMED로 표시한다. reserveClass는 public eligibility 확인 후 이 primitive를 재사용한다.

- [ ] **Step 6: queue 전진 구현**

occurrence를 먼저 lock하고 빈자리 수를 계산한 뒤 WAITING row를 joined_at과 id 순서로 FOR UPDATE하여 빈자리나 적격 대기자가 없어질 때까지 처리한다. 4시간 전보다 이르면 confirmOnLockedOccurrence를 호출한다. 각 자동 확정을 SAVEPOINT로 감싸고 concurrent insert가 23P01을 발생시키거나 member가 부적격해지면 해당 시도만 rollback하고 entry를 SKIPPED로 표시한 뒤 다음 대기자를 처리한다. offer window에서는 row 하나를 OFFERED로 변경하고 offer_expires_at을 저장한다. 1시간 전부터는 남은 활성 entry를 EXPIRED로 표시한다.

- [ ] **Step 7: GREEN 실행**

실행:

    npm exec vitest run tests/integration/waitlist/advance-waitlist.test.ts tests/integration/waitlist/advance-waitlist-concurrency.test.ts

예상 결과: automatic, offer, skip, close, capacity, concurrent idempotency 사례가 PASS한다.

- [ ] **Step 8: transition guard 정리 REFACTOR**

모든 status 변경을 UPDATE ... WHERE status = expected RETURNING 형태로 유지하고 반환 row가 0개면 이미 처리된 no-op으로 취급한다.

- [ ] **Step 9: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings tests/integration/waitlist

예상 결과: reservation 및 waitlist suite가 함께 PASS한다.

- [ ] **Step 10: 커밋**

  git add src/server/bookings src/server/waitlist/advance-waitlist.ts tests/integration/waitlist
  git commit -m "feat: advance class waitlists"

### Task 18: Cron 없이 수락 제안 처리 및 지연 만료

**파일:**

- 생성: src/server/waitlist/accept-offer.ts
- 생성: src/server/waitlist/lazy-cleanup.ts
- 생성: src/app/(member)/waitlist/[entryId]/page.tsx
- 생성: src/app/(member)/waitlist/[entryId]/actions.ts
- 생성: src/components/member/offer-countdown.tsx
- 생성: tests/integration/waitlist/accept-offer.test.ts
- 생성: tests/integration/waitlist/lazy-cleanup.test.ts
- 생성: tests/unit/member/offer-countdown.test.tsx
- 수정: src/server/scheduling/member-schedule-query.ts
- 수정: src/server/bookings/reservation-queries.ts
- 수정: src/app/(member)/schedule/[occurrenceId]/page.tsx

**인터페이스:**

- 입력: confirmOnLockedOccurrence(), advanceWaitlist(), database time, 현재 member ownership.
- 출력: acceptOffer({ memberId, entryId }), declineOffer(), cleanupExpiredOffers(occurrenceId), server-authoritative offer page.

- [ ] **Step 1: 실패하는 수락 테스트 작성**

수락 처리가 occurrence와 entry를 lock하고 PostgreSQL의 SELECT clock_timestamp()를 사용하며 다른 member의 요청을 거부하는지 검증한다. offer_expires_at이 database now와 같거나 이전이면 거부하고, 수업 1시간 전부터 거부하며, 유효한 offer는 debit과 reservation 생성을 원자적으로 처리하는지도 검증한다.

    const result = await acceptOffer({ memberId, entryId });
    expect(result).toMatchObject({ ok: false, error: 'OFFER_EXPIRED' });
    expect(await reservationCount(memberId, occurrenceId)).toBe(0);

- [ ] **Step 2: 실패하는 지연 정리 테스트 작성**

Cron을 비활성화한 상태에서 만료된 offer를 생성하고 관련 request에서 cleanupExpiredOffers를 호출한다. EXPIRED로 표시하고 점유된 자리를 해제하며 다음 대기자를 정확히 한 번 전진시키고, 동시에 호출해도 idempotent한지 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/waitlist/accept-offer.test.ts tests/integration/waitlist/lazy-cleanup.test.ts tests/unit/member/offer-countdown.test.tsx

예상 결과: acceptance, cleanup, offer page가 없으므로 FAIL한다.

- [ ] **Step 4: 최소 수락 및 거절 구현**

occurrence 다음 waitlist entry 순서로 lock을 획득한다. 만료 및 class cutoff 판단에는 browser countdown이 아니라 database time을 사용한다. 유효한 수락은 SAVEPOINT 안에서 confirmOnLockedOccurrence를 호출한다. pass eligibility 또는 시간 중복으로 실패하면 해당 확정 시도만 rollback하고 entry를 사유와 함께 SKIPPED로 표시하며 점유된 자리를 해제한 뒤 다음 대기자를 전진시킨다. 거절 또는 만료된 수락은 offer를 조건부로 해제하고 state 전환 뒤 같은 request에서 queue 전진을 호출한다.

- [ ] **Step 5: 지연 정리 진입점 구현**

member schedule, class detail, reservation list, offer page, waitlist 관련 action을 반환하기 전에 cleanupExpiredOffers를 호출한다. cleanup은 현재 request와 관련된 occurrence만 선택하고 전체 database를 scan하지 않는다.

- [ ] **Step 6: 표시 전용 countdown 구현**

client component는 absolute expiresAt을 받아 remaining time을 표시한다. button은 항상 server로 submit하고 표시 시간이 0이면 button을 비활성화하지만 이를 authorization 확인으로 사용하지 않는다.

- [ ] **Step 7: GREEN 실행**

실행:

    npm exec vitest run tests/integration/waitlist/accept-offer.test.ts tests/integration/waitlist/lazy-cleanup.test.ts tests/unit/member/offer-countdown.test.tsx

예상 결과: Cron 없이 acceptance, ownership, 실제 expiry, lazy advancement, idempotency, display 테스트가 PASS한다.

- [ ] **Step 8: cleanup caller 정리 REFACTOR**

하나의 cleanupExpiredOffers(occurrenceId) function을 제공하고 route/query wrapper는 관련 occurrence id 선택만 담당하게 한다.

- [ ] **Step 9: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/waitlist tests/unit/member/offer-countdown.test.tsx

예상 결과: timer 대기 없이 모든 waitlist 테스트가 PASS한다.

- [ ] **Step 10: 커밋**

  git add -- src/server/waitlist "src/app/(member)/waitlist" src/components/member/offer-countdown.tsx src/server/scheduling/member-schedule-query.ts src/server/bookings/reservation-queries.ts "src/app/(member)/schedule/[occurrenceId]/page.tsx" tests/integration/waitlist tests/unit/member/offer-countdown.test.tsx
  git commit -m "feat: accept and lazily expire waitlist offers"

### Task 19: 예약 취소, 이용권 복원, 대기열 즉시 전진

**파일:**

- 생성: src/server/bookings/cancel-reservation.ts
- 생성: src/app/(member)/reservations/actions.ts
- 생성: src/components/member/cancel-reservation-button.tsx
- 생성: tests/integration/bookings/cancel-reservation.test.ts
- 생성: tests/integration/bookings/cancel-queue-advance.test.ts
- 생성: tests/unit/member/cancel-reservation-button.test.tsx
- 수정: src/app/(member)/reservations/page.tsx

**인터페이스:**

- 입력: booking window, reservation/pass ledger, advanceWaitlist(), 현재 member.
- 출력: cancelReservation({ memberId, reservationId }): Promise<CancelResult>, cancelReservationAction().

- [ ] **Step 1: 실패하는 취소 및 복원 테스트 작성**

정확히 2시간 전 취소는 허용되고 1 millisecond 뒤에는 거부되는지, 본인의 CONFIRMED reservation만 변경할 수 있는지 검증한다. 복원은 dedupe key reservation:{id}:restore로 한 번만 기록되고 reservation status, pass 증가, ledger가 함께 commit되거나 rollback되는지도 검증한다.

- [ ] **Step 2: 실패하는 즉시 전진 테스트 작성**

Cron을 비활성화한 상태에서 대기 queue가 있는 reservation을 취소한다. cancellation transaction이 commit된 뒤 같은 service request가 advanceWaitlist를 호출하고 outcome을 반환하는지 검증한다. queue 전진을 강제로 실패시키고 cancellation/restore는 commit 상태를 유지하면서 structured error가 기록되는지도 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/bookings/cancel-reservation.test.ts tests/integration/bookings/cancel-queue-advance.test.ts tests/unit/member/cancel-reservation-button.test.tsx

예상 결과: cancellation service와 control이 없으므로 FAIL한다.

- [ ] **Step 4: cancellation transaction 구현**

occurrence를 lock한 다음 reservation과 pass를 lock한다. database now를 starts_at 2시간 전과 비교한다. CONFIRMED를 MEMBER_CANCELLED로 조건부 변경하고 원래 pass를 한 번 증가시키며 MEMBER_CANCEL_RESTORE를 하나의 transaction에서 삽입한다.

- [ ] **Step 5: commit 후 queue 전진 호출**

transaction이 성공을 반환한 뒤 같은 server request에서 즉시 advanceWaitlist(occurrenceId)를 호출한다. 전진 실패만 catch해 request, occurrence, error type과 함께 기록하고 commit된 cancellation을 다시 열지 않는다.

- [ ] **Step 6: member control 구현 및 GREEN 실행**

마감 전 본인의 confirmed reservation에만 cancellation을 표시하고 이후에는 취소할 수 없음을 설명한다.

실행:

    npm exec vitest run tests/integration/bookings/cancel-reservation.test.ts tests/integration/bookings/cancel-queue-advance.test.ts tests/unit/member/cancel-reservation-button.test.tsx

예상 결과: deadline, idempotent restore, immediate advancement, failure isolation, UI 테스트가 PASS한다.

- [ ] **Step 7: post-commit 작업 REFACTOR**

전진 결과를 typed postCommit result로 표현해 성공한 cancellation result를 바꾸지 않고 warning을 기록할 수 있게 한다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/bookings tests/integration/waitlist tests/unit/member

예상 결과: Cron을 비활성화한 상태에서 모든 booking, queue, member control 테스트가 PASS한다.

- [ ] **Step 9: 커밋**

  git add -- src/server/bookings/cancel-reservation.ts "src/app/(member)/reservations" src/components/member/cancel-reservation-button.tsx tests/integration/bookings tests/unit/member
  git commit -m "feat: cancel bookings and advance waiters"

### Task 20: 수업 휴강 처리와 권한별 명단 표시

**파일:**

- 생성: src/server/scheduling/cancel-occurrence.ts
- 생성: src/server/scheduling/roster-query.ts
- 생성: src/app/(admin)/admin/classes/[occurrenceId]/page.tsx
- 생성: src/app/(admin)/admin/classes/[occurrenceId]/actions.ts
- 생성: src/app/(instructor)/instructor/classes/[occurrenceId]/page.tsx
- 생성: src/components/admin/class-roster.tsx
- 생성: tests/integration/scheduling/cancel-occurrence.test.ts
- 생성: tests/integration/scheduling/roster-authorization.test.ts
- 생성: tests/unit/admin/class-roster.test.tsx
- 수정: src/app/(admin)/admin/schedule/occurrences/actions.ts

**인터페이스:**

- 입력: occurrence/reservation/pass/waitlist table과 authorization guard.
- 출력: cancelOccurrence(), updateOccurrenceCapacity(), updateOccurrenceInstructor(), getAuthorizedRoster().

- [ ] **Step 1: 실패하는 수업 휴강 테스트 작성**

하나의 lock된 transaction이 occurrence를 CANCELLED로 설정하고 모든 CONFIRMED reservation을 CLASS_CANCELLED로 변경하며 각 원래 pass를 한 번 복원하고 CLASS_CANCEL_RESTORE ledger를 추가하며 WAITING/OFFERED entry를 종료하는지 검증한다. 다시 실행하면 idempotent no-op이어야 한다.

- [ ] **Step 2: 실패하는 roster 및 예외 테스트 작성**

head admin은 모든 roster를, branch admin은 본인 branch만, instructor는 배정된 class만 볼 수 있고 member는 roster를 절대 볼 수 없는지 검증한다. capacity가 confirmed와 OFFERED hold의 합보다 작아질 수 없는지, instructor 변경이 수동 날짜 예외로만 처리되는지도 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/scheduling/cancel-occurrence.test.ts tests/integration/scheduling/roster-authorization.test.ts tests/unit/admin/class-roster.test.tsx

예상 결과: cancellation 및 roster service가 없으므로 FAIL한다.

- [ ] **Step 4: 최소 수업 휴강 transaction 구현**

occurrence를 먼저 lock하고 영향받는 reservations와 passes를 안정적인 id 순서로 lock한다. 조건부 status 전환과 reservation:{id}:restore dedupe key를 사용한다. pass를 차감하지 않고 waitlist 및 offer를 종료한다. 모든 복원을 함께 commit하거나 모두 rollback한다.

- [ ] **Step 5: roster 및 날짜별 예외 page 구현**

confirmed reservation과 queue 순서를 표시하되 attendance/no-show field나 control은 두지 않는다. Task 11의 capacity 하한을 재사용하고 instructor 변경은 administrator가 명시적으로 선택해야 한다.

- [ ] **Step 6: GREEN 실행**

실행:

    npm exec vitest run tests/integration/scheduling/cancel-occurrence.test.ts tests/integration/scheduling/roster-authorization.test.ts tests/unit/admin/class-roster.test.tsx

예상 결과: restore, queue close, idempotency, authorization, capacity, no-attendance UI 테스트가 PASS한다.

- [ ] **Step 7: bulk restore helper 정리 REFACTOR**

bulk restore를 class-cancellation transaction 안에 유지하고 member cancellation orchestration이 아니라 ledger-key 생성만 재사용한다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/scheduling tests/unit/admin

예상 결과: 모든 occurrence 및 roster 테스트가 PASS한다.

- [ ] **Step 9: 커밋**

  git add -- src/server/scheduling "src/app/(admin)/admin/classes" "src/app/(instructor)/instructor/classes" src/components/admin/class-roster.tsx "src/app/(admin)/admin/schedule/occurrences/actions.ts" tests/integration/scheduling tests/unit/admin
  git commit -m "feat: cancel classes and expose rosters"

### Task 21: 실패 허용형 앱 내부 알림 Module과 알림함 구현

**파일:**

- 생성: src/server/logging/logger.ts
- 생성: src/server/notifications/notification-types.ts
- 생성: src/server/notifications/notification-service.ts
- 생성: src/server/notifications/notification-queries.ts
- 생성: src/app/(member)/notifications/page.tsx
- 생성: src/app/(member)/notifications/actions.ts
- 생성: src/components/member/notification-list.tsx
- 생성: tests/integration/notifications/notification-service.test.ts
- 생성: tests/unit/member/notification-list.test.tsx
- 수정: src/app/(member)/layout.tsx

**인터페이스:**

- 입력: notifications table과 현재 member ownership.
- 출력: NotificationInput, tryCreateNotification(input), listNotifications(memberId), markNotificationRead(memberId, notificationId), structured Logger.error(event, fields).

- [ ] **Step 1: 실패하는 저장, dedupe, ownership 테스트 작성**

성공한 insert가 최신순으로 표시되고 같은 dedupe_key가 row 하나만 생성하는지 검증한다. member가 본인의 notification만 읽음 처리할 수 있는지, target_path가 same-origin relative path인지, expires_at이 offer 표시에 계속 제공되는지도 검증한다.

- [ ] **Step 2: 실패하는 error isolation 테스트 작성**

오류를 throw하는 repository를 주입하고 tryCreateNotification이 throw하지 않고 failure result를 반환하는지 검증한다. Logger는 type, businessId, memberId, errorType, failedAt만 받아야 하며 body, phone, password, token data를 받아서는 안 된다.

    expect(await tryCreateNotification(input, failingRepository))
      .toEqual({ ok: false, error: 'NOTIFICATION_STORE_FAILED' });
    expect(logger.error).toHaveBeenCalledWith(
      'notification.store_failed',
      expect.not.objectContaining({ body: expect.anything(), phone: expect.anything() })
    );

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/notifications/notification-service.test.ts tests/unit/member/notification-list.test.tsx

예상 결과: notification service와 알림함이 없으므로 FAIL한다.

- [ ] **Step 4: 최소 best-effort 저장 구현**

notification type, title, body, relative target path, optional expiry, deterministic dedupe key를 검증한다. storage error는 tryCreateNotification 안에서만 catch하고 최소화된 structured log를 남긴 뒤 failure를 반환한다. 재시도하거나 Outbox row를 생성하거나 administrator resend API를 제공하지 않는다.

- [ ] **Step 5: member 알림함과 읽음 action 구현**

로그인한 member의 notification만 나열한다. unread state, Seoul 기준 created time, 선택적 absolute expiry, target link를 rendering한다. 읽음 처리는 member_id predicate를 사용하며 row가 이미 읽음 상태여도 success를 반환한다.

- [ ] **Step 6: GREEN 실행**

실행:

    npm exec vitest run tests/integration/notifications/notification-service.test.ts tests/unit/member/notification-list.test.tsx

예상 결과: persistence, dedupe, ownership, failure isolation, privacy, UI 테스트가 PASS한다.

- [ ] **Step 7: notification projection 정리 REFACTOR**

database error object는 logger adapter 안에 두고 React에는 serializable MemberNotification model만 반환한다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/notifications tests/unit/member/notification-list.test.tsx

예상 결과: 모든 notification 테스트가 PASS한다.

- [ ] **Step 9: 커밋**

  git add -- src/server/logging src/server/notifications "src/app/(member)/notifications" src/components/member/notification-list.tsx "src/app/(member)/layout.tsx" tests/integration/notifications tests/unit/member/notification-list.test.tsx
  git commit -m "feat: add best effort in app notifications"

### Task 22: 핵심 Commit 후 업무 알림 생성

**파일:**

- 생성: src/server/notifications/business-notifications.ts
- 생성: tests/integration/notifications/business-events.test.ts
- 생성: tests/integration/notifications/failure-isolation.test.ts
- 수정: src/server/passes/pass-service.ts
- 수정: src/server/bookings/reserve-class.ts
- 수정: src/server/bookings/cancel-reservation.ts
- 수정: src/server/waitlist/waitlist-service.ts
- 수정: src/server/waitlist/advance-waitlist.ts
- 수정: src/server/waitlist/accept-offer.ts
- 수정: src/server/waitlist/lazy-cleanup.ts
- 수정: src/server/scheduling/cancel-occurrence.ts
- 수정: src/server/scheduling/occurrence-service.ts

**인터페이스:**

- 입력: commit된 service result와 tryCreateNotification().
- 출력: notifyBusinessEvents(events), deterministic notification dedupe key, event type PASS_ISSUED, RESERVATION_CONFIRMED, RESERVATION_CANCELLED, WAITLIST_JOINED, WAITLIST_CANCELLED, WAITLIST_AUTO_CONFIRMED, WAITLIST_OFFERED, WAITLIST_EXPIRED, WAITLIST_SKIPPED, CLASS_CHANGED, CLASS_CANCELLED.

- [ ] **Step 1: 실패하는 event coverage 테스트 작성**

각 event type에 대해 실제 service를 실행하고 notification insert 시도 전에 핵심 transaction이 조회되는지 검증한다. offer notification에 absolute expires_at과 /waitlist/{entryId}가 포함되고 booking event가 /reservations로 연결되는지 확인한다. 날짜별 instructor 또는 capacity 변경은 occurrence update가 commit된 뒤 모든 confirmed member에게 CLASS_CHANGED를 생성해야 한다.

- [ ] **Step 2: 실패하는 notification 오류 테스트 작성**

pass 발급, direct reservation, member cancellation, 자동 승격, offer 생성, offer 만료, class cancellation에서 notification insert를 강제로 실패시킨다. 모든 핵심 result가 commit 상태를 유지하고 structured log가 기록되는지 검증한다.

- [ ] **Step 3: RED 실행**

실행:

    npm exec vitest run tests/integration/notifications/business-events.test.ts tests/integration/notifications/failure-isolation.test.ts

예상 결과: business service가 notification 생성을 시도하지 않으므로 FAIL한다.

- [ ] **Step 4: 최소 post-commit event mapping 구현**

각 service는 transaction result 안에 plain event를 모으되 transaction promise가 resolve된 뒤에만 notifyBusinessEvents를 호출한다. cancellation은 즉시 queue 전진을 먼저 실행한 다음 cancellation과 반환된 전진 outcome의 notification을 생성한다. Notification failure는 log용으로 모으고 service의 success result를 절대 변경하지 않는다.

다음 deterministic key를 사용한다.

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

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/integration/notifications/business-events.test.ts tests/integration/notifications/failure-isolation.test.ts

예상 결과: 성공 시 모든 event가 한 번씩 나타나고 강제한 모든 오류에서도 booking/pass/waitlist state가 유지되며 sanitized log가 생성된다.

- [ ] **Step 6: event factory 정리 REFACTOR**

한국어 title/body 생성은 business-notifications.ts에 두고 domain service는 event fact와 target identifier만 담당하게 한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm exec vitest run tests/integration/passes tests/integration/bookings tests/integration/waitlist tests/integration/scheduling tests/integration/notifications

예상 결과: notification failure injection을 활성화한 상태에서 모든 PostgreSQL integration suite가 PASS한다.

- [ ] **Step 8: 커밋**

  git add src/server/notifications/business-notifications.ts src/server/passes/pass-service.ts src/server/bookings src/server/waitlist src/server/scheduling/cancel-occurrence.ts src/server/scheduling/occurrence-service.ts tests/integration/notifications
  git commit -m "feat: emit post commit business notifications"

### Task 23: Must-have 브라우저 사용자 흐름과 CI Gate 추가

**파일:**

- 생성: scripts/test/reset-e2e-db.ts
- 생성: scripts/test/seed-e2e.ts
- 생성: tests/e2e/auth.spec.ts
- 생성: tests/e2e/member-booking.spec.ts
- 생성: tests/e2e/waitlist.spec.ts
- 생성: tests/e2e/admin-class-cancellation.spec.ts
- 생성: tests/e2e/authorization.spec.ts
- 생성: .github/workflows/ci.yml
- 수정: package.json
- 수정: playwright.config.ts

**인터페이스:**

- 입력: Task 1~22의 모든 Must-have service와 page.
- 출력: deterministic E2E fixture, npm run verify:must-have, Cron이 없는 GitHub Actions gate.

- [ ] **Step 1: 실패하는 Playwright journey 작성**

다음을 다룬다.

1. Admin이 생성한 member invitation → password 설정 → login.
2. Member schedule → booking → pass 차감 → 허용된 cancellation → pass 복원.
3. 만석 class → waitlist → 같은 request에서 cancellation → 4시간 전 자동 확정.
4. 만석 class → offer → 앱 내부 notification link → 수락.
5. Cron 비활성 상태에서 만료된 offer 거부 및 지연 전진.
6. Administrator class cancellation → 전체 복원 → queue 종료.
7. Instructor 및 branch-admin의 금지된 접근 사례.

- [ ] **Step 2: RED 실행**

실행:

    npm exec playwright install chromium
    npm exec playwright test tests/e2e

예상 결과: deterministic fixture, 안정적인 locator, CI web-server 설정이 완성되지 않아 FAIL한다.

- [ ] **Step 3: deterministic E2E reset 및 seed 구현**

test database만 reset하고 모든 Must-have migration을 적용한다. branch 세 곳, 활성 group pass product 하나, head administrator, branch administrator, instructor, members, passes, templates, occurrences, 만석 class 하나, 순서가 있는 waiters를 seed한다. 고정 UUID를 사용하고 seed가 한 번 capture한 database clock_timestamp()에서 경계 occurrence를 계산한다. database name이 loungefit_test가 아닌 URL을 script에 절대 연결하지 않는다.

- [ ] **Step 4: 테스트에 필요한 최소 UI 조정**

semantic role로 dynamic row를 식별할 수 없을 때만 안정적인 accessible name과 data-testid를 추가한다. 테스트를 우회하도록 domain behavior를 바꾸지 않는다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec playwright test tests/e2e --project=chromium

예상 결과: Cron 설정 없이 모든 Must-have browser journey가 PASS한다.

- [ ] **Step 6: CI workflow 추가**

Node LTS, npm ci, PostgreSQL 16 service, migration/reset/seed 단계, Playwright Chromium 설치를 사용하고 다음 순서로 실행한다.

    npm run typecheck
    npm run lint
    npm run test:unit
    npm run test:db
    npm run test:e2e

Playwright trace는 실패할 때만 upload한다. scheduled GitHub workflow를 정의하지 않는다.

- [ ] **Step 7: package 검증 script REFACTOR**

npm run verify:must-have가 local과 CI에서 같은 다섯 gate를 실행하도록 설정한다. 각 하위 명령은 별도로 호출할 수 있게 유지한다.

    "verify:must-have": "npm run typecheck && npm run lint && npm run test:unit && npm run test:db && npm run test:e2e"

- [ ] **Step 8: Task 검증**

실행:

    npm run verify:must-have

예상 결과: TypeScript, lint, unit, PostgreSQL integration, Playwright가 모두 exit 0으로 종료되고 Playwright의 failed test가 0개다.

- [ ] **Step 9: 커밋**

  git add scripts/test tests/e2e .github/workflows/ci.yml package.json playwright.config.ts
  git commit -m "test: verify LoungeFit must have journeys"

### Task 24: Must-have를 Neon과 Vercel Hobby에 배포

**파일:**

- 생성: .env.example
- 생성: src/app/api/health/route.ts
- 생성: src/server/db/migration-env.ts
- 생성: scripts/seed-production.ts
- 생성: tests/unit/deployment/hobby-config.test.ts
- 생성: tests/integration/deployment/health.test.ts
- 생성: tests/e2e/deployment-smoke.spec.ts
- 생성: vercel.json
- 수정: src/server/env.ts
- 수정: package.json

**인터페이스:**

- 입력: 검증된 Must-have application과 migration.
- 출력: 검증된 runtime/deploy environment, idempotent 초기 data seed, /api/health, crons entry가 없는 Hobby-safe deployment.

- [ ] **Step 1: 실패하는 environment 및 Hobby 테스트 작성**

runtime startup이 DATABASE_URL, SESSION_SECRET, APP_URL 누락을 거부하는지 검증한다. migration command는 DATABASE_URL_MIGRATIONS 누락을 별도로 거부해야 한다. vercel.json을 parsing해 crons property가 없는지 검증한다. /api/health는 SELECT 1 성공 시 status ok와 함께 200을 반환하고 database를 사용할 수 없을 때 connection string을 노출하지 않고 503을 반환해야 한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/deployment/hobby-config.test.ts tests/integration/deployment/health.test.ts

예상 결과: deployment validation, health route, vercel.json이 없으므로 FAIL한다.

- [ ] **Step 3: 최소 deployment 설정 구현**

다음 내용만 포함하는 vercel.json을 생성한다.

    {
      "framework": "nextjs"
    }

Neon pooled runtime connection에는 DATABASE_URL을 사용한다. migration 전용 environment parser는 direct connection에 DATABASE_URL_MIGRATIONS를 사용하며 application runtime module에서 절대 import하지 않는다. SESSION_SECRET은 environment 저장용으로 encoding된 32 random byte 이상인지 검증하고 APP_URL은 local development 밖에서 HTTPS인지 검증한다. Health output에는 status만 포함한다.

다음 deployment 전용 script를 추가한다.

    "db:migrate:deploy": "drizzle-kit migrate --config drizzle.config.ts"

- [ ] **Step 4: idempotent 초기 production seed 구현**

scripts/seed-production.ts는 설정된 branch 세 곳, 활성 pass product 하나, SEED_HEAD_ADMIN_PHONE과 SEED_HEAD_ADMIN_PASSWORD로 HEAD_ADMIN 한 명을 생성한다. 비밀번호를 hash하고 secret을 절대 출력하지 않으며 production에서 HTTPS가 아닌 APP_URL을 거부한다. 두 SEED 변수를 제거할 수 있도록 seed 후 종료한다.

- [ ] **Step 5: local에서 GREEN 실행**

실행:

    npm exec vitest run tests/unit/deployment/hobby-config.test.ts tests/integration/deployment/health.test.ts
    npm run build

예상 결과: deployment 테스트가 PASS하고 Next.js production build가 exit 0으로 종료된다.

- [ ] **Step 6: Neon을 안전하게 provisioning**

Neon에 별도의 loungefit-preview 및 loungefit-production branch/database를 생성한다. pooled URL은 Vercel DATABASE_URL에 복사하고 direct URL은 신뢰할 수 있는 local shell 또는 보호된 migration CI environment에만 DATABASE_URL_MIGRATIONS로 둔다. 신뢰할 수 있는 환경에서 production migration을 적용한다.

    npm run db:migrate:deploy

예상 결과: migration 0000~0002가 한 번 적용되고 두 번째 호출은 pending migration이 없다고 보고한다. seed를 한 번 실행하고 administrator login을 검증한 다음 SEED_HEAD_ADMIN_PHONE과 SEED_HEAD_ADMIN_PASSWORD를 shell 및 추가했다면 Vercel에서도 삭제한다.

- [ ] **Step 7: secret을 노출하지 않고 Vercel Hobby 설정**

실행:

    npx vercel link
    npx vercel env add DATABASE_URL
    npx vercel env add SESSION_SECRET
    npx vercel env add APP_URL
    npx vercel --prod

예상 결과: prompt가 값을 Git이나 command history에 남기지 않고 입력받으며 Hobby deployment가 성공하고 Cron job이 표시되지 않는다.

- [ ] **Step 8: 배포 환경 smoke 검증 실행**

shell에서 PLAYWRIGHT_BASE_URL을 배포된 HTTPS URL로 설정한 뒤 실행한다.

    npm exec playwright test tests/e2e/deployment-smoke.spec.ts

예상 결과: health, login page, 인증된 schedule, test account 하나의 booking/cancellation이 PASS한다. Cron을 비활성화해도 핵심 동작이 PASS해야 한다.

- [ ] **Step 9: environment ownership 정리 REFACTOR**

migration 및 일회성 seed credential을 runtime module 밖에 두고 server environment parser만 secret variable을 읽을 수 있게 한다.

- [ ] **Step 10: Task 검증**

실행:

    npm run verify:must-have
    npm run build
    git grep -n -E "DATABASE_URL=.*postgres" -- . ":(exclude)package-lock.json"

예상 결과: verification과 build가 PASS하고 git grep은 match 없이 exit 1로 종료되어 commit된 connection string이 없음을 뜻한다. Vercel Hobby deployment에는 scheduled Cron이 없다.

- [ ] **Step 11: 커밋**

  git add .env.example src/app/api/health src/server/env.ts src/server/db/migration-env.ts scripts/seed-production.ts tests/unit/deployment tests/integration/deployment tests/e2e/deployment-smoke.spec.ts vercel.json package.json
  git commit -m "chore: prepare Hobby and Neon deployment"

### Task 25: README, 운영 점검, GitHub 제출 안내 작성

**파일:**

- 생성: README.md
- 생성: docs/operations/manual-verification.md
- 생성: docs/operations/data-migration-constraint.md
- 생성: .github/pull_request_template.md
- 생성: tests/unit/docs/readme.test.ts

**인터페이스:**

- 입력: 검증된 Must-have 명령, environment variable, deployment URL, 승인된 제외 범위.
- 출력: 재현 가능한 local/deploy 문서와 GitHub 제출 checklist.

- [ ] **Step 1: 실패하는 문서 contract 테스트 작성**

README.md를 읽어 overview, architecture, setup, environment variables, database migrations, tests, Vercel Hobby deployment, 비밀번호가 없는 demo accounts, scope, exclusions, data migration constraint heading이 있는지 검증한다. README가 CSV member import, Kakao/SMS, attendance, online payment, 필수 Cron을 제공한다고 주장하지 않는지도 검증한다.

- [ ] **Step 2: RED 실행**

실행:

    npm exec vitest run tests/unit/docs/readme.test.ts

예상 결과: README.md와 operations 문서가 없으므로 FAIL한다.

- [ ] **Step 3: 재현 가능한 최소 README 작성**

npm ci, example env file 복사, Docker test database, migration 명령, seed 명령, dev/build/verify 명령, route/role overview, 동시성 결정, Hobby no-Cron 동작, Task 24에서 얻은 실제 배포 HTTPS URL을 문서화한다. Web Push, PWA, reports, report CSV, advanced retry는 post-Must-have Task 26~30이라고 명시한다.

- [ ] **Step 4: 운영 검증 및 데이터 이전 제약 작성**

manual-verification.md에는 마지막 자리 동시성 및 Cron 비활성 만료를 포함한 승인된 Must-have 수동 점검 13개를 재현한다. 첫 달 측정 기준으로 capacity 초과/중복 booking 0건, pass-ledger 불일치 0건, member self-booking 80% 이상을 정의한다. data-migration-constraint.md에는 CSV import가 없고 약 1,200명의 실제 onboarding은 production 사용 전에 별도로 승인된 cleanse, validation, load, total reconciliation, sample audit 단계가 필요하다고 명시한다.

- [ ] **Step 5: GREEN 실행**

실행:

    npm exec vitest run tests/unit/docs/readme.test.ts

예상 결과: 모든 문서 contract 검증이 PASS한다.

- [ ] **Step 6: 중복 명령 REFACTOR**

README가 package script와 operations 문서를 참조하게 하고 secret을 복사하거나 충돌하는 deployment 절차 두 개를 유지하지 않는다.

- [ ] **Step 7: GitHub 제출 준비 검증**

실행:

    npm run verify:must-have
    npm run build
    git status --short
    git log --oneline --decorate -10
    git remote -v

예상 결과: verification과 build가 PASS한다. commit 전 status에는 이 Task가 의도한 문서 변경만 있고 최근 commit은 Task 범위로 분리되어 있으며 의도한 GitHub remote가 표시된다. commit 뒤 git status는 비어 있다. repository owner가 target remote를 확인한 뒤에만 git push --dry-run을 사용한다.

- [ ] **Step 8: 커밋**

  git add README.md docs/operations .github/pull_request_template.md tests/unit/docs/readme.test.ts
  git commit -m "docs: document LoungeFit setup and submission"

- [ ] **Step 9: 비공개 GitHub 저장소, 협업자, 비밀값 수동 확인**

실행:

    gh repo view --json visibility,url -q '{visibility: .visibility, url: .url}'
    git ls-files ".env*" ":(exclude).env.example" ":(exclude).env.test.example"
    git status --short

예상 결과: GitHub repository의 visibility는 PRIVATE이고 URL이 제출 대상 repository와 일치한다. GitHub repository의 Settings → Collaborators에서 minsuk-robert가 초대되어 있음을 수동 확인한다. git ls-files는 실제 .env file을 출력하지 않고 git status는 비어 있으며, 비밀값이 commit되지 않았다.

- [ ] **Step 10: 사용자 승인 후 main에 반영하고 최종 제출 확인**

Task 25의 변경 파일과 검증 결과를 보고하고 사용자 승인을 받은 뒤에만 repository root의 main workspace에서 실행한다. feature worktree 안이나 승인 전에는 실행하지 않는다.

실행:

    git switch main
    git merge --ff-only feature/loungefit-mvp
    git push origin main
    git status --short

예상 결과: 승인된 feature/loungefit-mvp 이력만 main에 fast-forward merge되고 최종 main이 origin에 push된다. git status는 비어 있다. GitHub repository URL과 Task 24에서 기록한 Vercel deployment URL을 각각 열어 접근 가능 여부와 최신 main commit 배포 여부를 수동 확인한다.

## 최종 검증 순서

Must-have Task 1~25를 모두 완료한 뒤 다음 순서로 검증한다.

```bash
npm run typecheck
npm run lint
npm run test
npm run test:db
npm run test:e2e
npm run build
```

예상 결과: 모든 명령이 exit code 0으로 종료되고, 배포된 Must-have 사용자 흐름이 Vercel Hobby와 Neon에서 통과한다.

## 계획 자체 검토 기록

- Task 완전성: 이 문서에는 Task 1~25가 번호 순서대로 각각 한 번만 있고, 별도 후속 계획에는 Task 26~30이 각각 한 번만 있다.
- 설계 명세와의 일치: 모듈형 단일 애플리케이션, 한 종류의 공유 그룹수업권, 14일 시간표, 2시간 취소 기준, 대기 자동 확정/30분 제안, best-effort 앱 내부 알림을 유지한다.
- 우선순위: Task 1~25는 Must-have이며, PWA, Web Push, 보고서, CSV 출력, 고급 재시도는 별도 후속 계획 문서로 분리했다.
- TDD 순서: 각 기능 Task는 실패 테스트를 먼저 작성하고 RED를 확인한 뒤 최소 구현으로 GREEN을 만들고 REFACTOR와 전체 검증을 수행한다.
- Task 크기: 각 Task는 독립적으로 테스트하고 커밋할 수 있는 하나의 스키마, domain capability, UI slice 또는 운영 산출물로 제한했다.
- 경로와 명령: 모든 Task에 정확한 파일 경로, 실행 명령, 예상 결과, 커밋 메시지를 명시했다.
- 기술 요소 보존: 파일 경로, function/type 이름, enum 값, SQL, code, 명령, environment variable, error code, Task별 Git commit message는 영어 원문을 유지했다.
- 무료 배포: 핵심 흐름은 Cron 없이 동작하며 Vercel Hobby에서 실행 가능하다. 1분 간격 Cron은 사용하지 않는다.
- 범위 통제: Kakao/SMS, member CSV import, 범용 audit history, online payment, personal lesson은 포함하지 않는다.
- 실행 격리: 실제 구현은 `feature/loungefit-mvp`의 `.worktrees/loungefit-mvp`에서만 수행하며 `main`에서 직접 구현하지 않는다.
- 승인 게이트: 한 번에 하나의 Task만 수행하고 변경 파일 및 검증 결과를 보고한 뒤 사용자 승인 전에는 다음 Task로 진행하지 않는다.
- GitHub 제출: Task 25에서 PRIVATE visibility, minsuk-robert 협업자 초대, 실제 `.env` 및 비밀값 비추적, 승인 후 최종 main push, GitHub repository URL과 Vercel deployment URL을 모두 확인한다.
