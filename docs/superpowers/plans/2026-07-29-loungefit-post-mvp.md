# 라운지핏 Post-MVP 후속 기능 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬로 superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans를 사용해 이 계획을 Task별로 실행한다. 진행 상태는 체크박스(- [ ])로 기록한다.

**목표:** Must-have MVP가 검증·배포된 뒤에도 핵심 예약 정합성에 영향을 주지 않는 PWA, Web Push, 운영 보고서, CSV 출력, 고급 재시도를 추가한다.

**아키텍처:** 승인된 모듈형 Next.js App Router 단일 애플리케이션을 그대로 확장한다. 후속 기능은 앱 내부 알림과 읽기 전용 집계 위에 연결하며, 예약·이용권·대기 상태는 PWA, Web Push, 보고서 또는 Cron의 성공 여부에 의존하지 않는다.

**기술 스택:** Next.js App Router, TypeScript, React, Drizzle ORM, postgres.js, PostgreSQL 16/Neon, Web Push API, Service Worker, Vitest, Testing Library, Playwright, Vercel.

## 구현 실행 전 필수 준비

- main에 docs/superpowers/specs/2026-07-29-loungefit-design.md와 docs/superpowers/plans/2026-07-29-loungefit-mvp.md의 승인된 커밋이 있는지 확인한다.
- MVP 계획의 Task 1–25, npm run verify:must-have, Vercel Hobby 배포 스모크 테스트가 모두 완료됐는지 확인한다.
- main에서 직접 구현하지 않는다. 후속 계획 실행 전 사용자가 승인한 별도 feature 브랜치와 worktree를 만든다.
- worktree 안에서 npm ci와 기준 테스트를 실행하고, 실제 후속 구현과 커밋도 모두 해당 worktree에서만 수행한다.
- 위 조건 중 하나라도 충족하지 않으면 Task 26을 시작하지 않는다.

## 실행 규칙

- 한 번에 하나의 Task만 구현한다.
- 각 Task에서 RED 실패, GREEN 통과, REFACTOR 후 재검증을 실제 명령 출력으로 확인한다.
- Task가 끝나면 변경 파일, 실행 명령, 테스트 수와 결과, 커밋 해시를 사용자에게 보고한다.
- 사용자가 해당 Task를 승인하기 전에는 다음 Task를 시작하지 않는다.
- Task 26–30의 실패는 Must-have 예약·이용권·대기 상태를 변경하거나 되돌리는 방식으로 해결하지 않는다.

## 전역 제약

- 기준 설계는 docs/superpowers/specs/2026-07-29-loungefit-design.md이고, 선행 계획은 docs/superpowers/plans/2026-07-29-loungefit-mvp.md다.
- Task 26–30은 Task 25 커밋과 Must-have CI·배포 스모크 검증 후에만 시작한다.
- Post-MVP 기능은 제거해도 예약, 이용권, 대기, 앱 내부 알림 정합성이 유지돼야 한다.
- Web Push는 앱 내부 알림 저장 성공 후에만 시도하며, 실패해도 핵심 업무를 되돌리지 않는다.
- Vercel Cron은 선택적 보조 정리에만 사용한다. 1분 주기가 필요하면 Vercel Pro 이상이 필요하다.
- 카카오 알림톡, SMS, 회원 CSV import, Outbox, 범용 감사 이력, 관리자 알림 재발송 화면을 추가하지 않는다.
- 비밀값은 소스, 브라우저 번들, 테스트 스냅숏, 명령행 인자에 기록하지 않는다.

---

## 후속 기능 Task

### Task 26: PWA Manifest, Service Worker 기본 구조, iPhone 설치 안내 추가

**파일:**

- 생성: src/app/manifest.ts
- 생성: public/sw.js
- 생성: public/icons/icon-192.png
- 생성: public/icons/icon-512.png
- 생성: src/components/pwa/service-worker-registration.tsx
- 생성: src/components/pwa/install-guide.tsx
- 생성: src/app/(member)/settings/page.tsx
- 생성: tests/unit/pwa/manifest.test.ts
- 생성: tests/unit/pwa/install-guide.test.tsx
- 생성: tests/e2e/pwa-install-guidance.spec.ts
- 수정: src/app/layout.tsx
- 수정: README.md

**인터페이스:**

- 입력: 검증된 반응형 웹 애플리케이션.
- 출력: 표준 Manifest, Service Worker 등록, standalone 표시, iPhone 설치 안내. PushSubscription은 아직 추가하지 않는다.

- [ ] **Step 1: 실패하는 Manifest·설치 안내 테스트 작성**

Manifest의 name, short_name, start_url, standalone display, theme/background color, 192/512 icon을 검증한다. iPhone Safari의 비-standalone 상태에서는 홈 화면 추가 안내가 보이고, 설치된 상태와 iPhone이 아닌 환경에는 잘못된 안내가 보이지 않는지 검증한다.

- [ ] **Step 2: RED 확인**

실행:

    npm exec vitest run tests/unit/pwa
    npm exec playwright test tests/e2e/pwa-install-guidance.spec.ts

예상 결과: Manifest, Service Worker, 설치 안내가 없으므로 FAIL.

- [ ] **Step 3: 테스트 통과에 필요한 최소 PWA 기본 구조 구현**

src/app/manifest.ts가 public/icons/icon-192.png와 public/icons/icon-512.png를 참조하도록 한다. hydration 후 /sw.js를 등록하고, install/activate handler에서 client를 claim한다. 인증 HTML, 예약 action, API response는 cache하지 않는다. 이 Service Worker는 Task 27의 제어 기반만 제공한다.

- [ ] **Step 4: iPhone 설치 안내 구현**

기능 탐지와 display-mode media query를 사용한다. 지원되는 iPhone의 Web Push는 홈 화면 추가 후 회원 동작으로 알림 권한을 허용해야 한다고 안내한다. README.md에 PWA 설치 방법과 cache 범위를 기록한다.

- [ ] **Step 5: GREEN 확인**

실행:

    npm exec vitest run tests/unit/pwa
    npm exec playwright test tests/e2e/pwa-install-guidance.spec.ts

예상 결과: Manifest, 등록, 플랫폼 판별, 설치 안내 테스트가 모두 PASS.

- [ ] **Step 6: REFACTOR 정리**

user-agent 판별을 하나의 작은 client helper에 모으고, 실제 동작은 capability와 display-mode 판별을 우선 사용한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run verify:must-have

예상 결과: PWA 검증이 PASS하고 모든 Must-have gate도 계속 PASS.

- [ ] **Step 8: 커밋**

    git add -- src/app/manifest.ts public/sw.js public/icons src/components/pwa "src/app/(member)/settings" src/app/layout.tsx tests/unit/pwa tests/e2e/pwa-install-guidance.spec.ts README.md
    git commit -m "feat: add LoungeFit PWA shell"

### Task 27: Web Push 구독과 즉시 발송 추가

**파일:**

- 생성: src/server/db/schema/push.ts
- 생성: drizzle/0003_web_push.sql
- 생성: drizzle/meta/0003_snapshot.json
- 생성: src/server/push/push-types.ts
- 생성: src/server/push/subscription-service.ts
- 생성: src/server/push/delivery-service.ts
- 생성: src/server/push/web-push-client.ts
- 생성: src/app/(member)/settings/push-actions.ts
- 생성: src/components/pwa/push-permission-control.tsx
- 생성: tests/integration/push/subscriptions.test.ts
- 생성: tests/integration/push/immediate-delivery.test.ts
- 생성: tests/unit/push/payload.test.ts
- 생성: tests/unit/pwa/push-permission-control.test.tsx
- 수정: src/server/db/schema/index.ts
- 수정: drizzle/meta/_journal.json
- 수정: src/server/notifications/notification-service.ts
- 수정: src/server/notifications/business-notifications.ts
- 수정: public/sw.js
- 수정: src/server/env.ts
- 수정: .env.example
- 수정: package.json
- 수정: README.md

**인터페이스:**

- 입력: PWA Service Worker와 저장에 성공한 앱 내부 Notification.
- 출력: registerSubscription(), deactivateSubscription(), sendImmediatePush(notificationId), PushClient, PUSH_MODE=mock 또는 live.

- [ ] **Step 1: 실패하는 구독·발송 스키마 테스트 작성**

endpoint가 unique인지, 재등록 시 key와 활성 상태가 갱신되는지, 회원이 자신의 기기만 비활성화할 수 있는지, Notification + PushSubscription 조합마다 PushDelivery가 하나만 존재하는지 검증한다. 기본 delivery state는 PENDING, SENDING, SENT, FAILED, INVALID_SUBSCRIPTION으로 고정한다.

- [ ] **Step 2: 실패하는 즉시 발송·payload 테스트 작성**

앱 내부 알림 저장 성공 후에만 Web Push를 시도하고, RESERVATION_CONFIRMED, RESERVATION_CANCELLED, WAITLIST_AUTO_CONFIRMED, WAITLIST_OFFERED, CLASS_CHANGED, CLASS_CANCELLED만 발송 대상인지 검증한다. PASS_ISSUED, WAITLIST_JOINED, WAITLIST_CANCELLED, WAITLIST_EXPIRED, WAITLIST_SKIPPED는 앱 내부 알림 전용이다. payload에는 notificationId, 짧은 message, 상대 targetPath, 선택적 expiresAt만 포함하고 회원명, 휴대폰 번호, 결제금액, 이용권 상세, 알림 본문 전체를 포함하지 않는다. mock mode에서 network call이 없는지 검증한다.

- [ ] **Step 3: RED 확인**

실행:

    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa/push-permission-control.test.tsx

예상 결과: Push schema와 service가 없으므로 FAIL.

- [ ] **Step 4: Migration과 구독 제어 최소 구현**

push_subscriptions에 member_id, endpoint, p256dh, auth, is_active, created_at, updated_at, deactivated_at을 두고 endpoint를 unique로 만든다. push_deliveries에 notification_id, subscription_id, status, attempt_count default 0, created_at, updated_at을 두고 unique(notification_id, subscription_id)를 적용한다. push_subscriptions_member_active_idx(member_id, is_active)와 push_deliveries_status_created_idx(status, created_at)를 추가한다. key는 server에만 저장한다.

web-push와 @types/web-push를 정확한 버전으로 lockfile에 기록한다. PUSH_MODE, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY를 검증 대상 환경변수 예시에 추가하고, browser에는 NEXT_PUBLIC_VAPID_PUBLIC_KEY만 노출한다. 생성된 key를 기록하지 않고 VAPID 생성과 mock/live 선택 방법을 README.md에 설명한다. 회원이 Allow notifications 버튼을 눌렀을 때만 Notification permission을 요청한다. 거부, 미지원, 미구독 상태에서도 앱 내부 알림은 정상 동작한다.

- [ ] **Step 5: 즉시 발송과 Service Worker handler 구현**

tryCreateNotification이 저장된 Notification을 반환하면 같은 server request에서 delivery row를 만들고 발송한다. 조건부 update로 PENDING → SENDING → SENT 또는 FAILED를 적용한다. Push service의 404/410 response는 INVALID_SUBSCRIPTION으로 바꾸고 해당 subscription을 비활성화한다.

public/sw.js는 notificationId를 tag로 사용한다. notificationclick은 같은 origin의 열린 client를 focus하거나 targetPath를 연다. Service Worker에서 offer acceptance를 승인하지 않는다.

- [ ] **Step 6: GREEN 확인**

실행:

    npm run db:migrate:test
    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa/push-permission-control.test.tsx

예상 결과: 스키마, 소유권, payload 개인정보 최소화, 앱 내부 알림 우선순위, mock network 차단, 실패 격리, 중복 발송 방지 테스트가 PASS.

- [ ] **Step 7: REFACTOR 정리**

MockPushClient와 WebPushClient가 동일한 send(subscription, payload) 인터페이스를 구현하게 한다. 검증된 PUSH_MODE로 adapter를 선택하고 테스트 기본값은 mock으로 둔다.

- [ ] **Step 8: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/push tests/unit/push tests/unit/pwa

예상 결과: Push 테스트가 PASS하고, permission 거부 또는 subscription 부재 상태에서도 Must-have 동작이 바뀌지 않는다.

- [ ] **Step 9: 커밋**

    git add -- src/server/db/schema/push.ts drizzle/0003_web_push.sql drizzle/meta src/server/push "src/app/(member)/settings" src/components/pwa/push-permission-control.tsx src/server/notifications public/sw.js src/server/env.ts .env.example package.json package-lock.json tests/integration/push tests/unit/push tests/unit/pwa README.md
    git commit -m "feat: add immediate web push delivery"

### Task 28: 읽기 전용 운영 보고서 추가

**파일:**

- 생성: src/server/reporting/report-types.ts
- 생성: src/server/reporting/report-queries.ts
- 생성: src/app/(admin)/admin/reports/page.tsx
- 생성: src/components/admin/report-filters.tsx
- 생성: src/components/admin/report-tables.tsx
- 생성: tests/integration/reporting/report-queries.test.ts
- 생성: tests/unit/admin/report-tables.test.tsx
- 수정: src/app/(admin)/admin/layout.tsx
- 수정: README.md

**인터페이스:**

- 입력: pass, ledger, occurrence, reservation, branch, authorization data.
- 출력: Asia/Seoul 기준 포함 날짜 범위와 허용된 branch set을 받는 getRevenueReport(), getUsageReport(), getOccupancyReport(), getRemainingPassReport().

- [ ] **Step 1: 실패하는 보고서 정의 테스트 작성**

다음을 검증한다.

- Revenue는 passes.paid_amount를 selling_branch_id와 issued_at 기준으로 집계한다.
- Usage는 class 시작 이후 NORMAL occurrence의 CONFIRMED reservation을 occurrence.branch_id 기준으로 집계한다.
- No-show/attendance data를 조회하지 않는다.
- Occupancy는 confirmed reservation 수를 occurrence capacity로 나눈다.
- Remaining-pass report는 pass.remaining_credits를 사용한다.
- HEAD_ADMIN은 모든 branch를, BRANCH_ADMIN은 자신의 branch만 조회한다.

- [ ] **Step 2: RED 확인**

실행:

    npm exec vitest run tests/integration/reporting/report-queries.test.ts tests/unit/admin/report-tables.test.tsx

예상 결과: Reporting query와 UI가 없으므로 FAIL.

- [ ] **Step 3: 읽기 전용 집계 query 최소 구현**

Filter date를 Asia/Seoul day boundary에서 UTC로 변환한 뒤 조회한다. Parameterized SQL만 사용하고 업무 table을 변경하지 않는다. Typed decimal/number projection을 반환하며 활동이 없는 active branch도 명시적인 zero row로 표시한다.

- [ ] **Step 4: 보고서 filter와 table 구현**

date-from, date-through, 허용된 branch filter를 제공한다. Revenue, usage, occupancy, remaining-pass table을 분리해 selling branch와 usage branch metric이 혼동되지 않게 한다. 보고서 정의와 role 범위를 README.md에 기록한다.

- [ ] **Step 5: GREEN 확인**

실행:

    npm exec vitest run tests/integration/reporting/report-queries.test.ts tests/unit/admin/report-tables.test.tsx

예상 결과: 귀속, 경계값, 권한, zero-state, rendering 테스트가 PASS.

- [ ] **Step 6: REFACTOR 정리**

ReportFilter schema와 authorizedBranchIds helper를 하나씩 공유하되 서로 다른 metric query를 하나의 읽기 어려운 query로 합치지 않는다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/reporting tests/unit/admin/report-tables.test.tsx

예상 결과: 보고서 테스트와 Must-have 테스트가 모두 PASS.

- [ ] **Step 8: 커밋**

    git add -- src/server/reporting "src/app/(admin)/admin/reports" src/components/admin/report-filters.tsx src/components/admin/report-tables.tsx "src/app/(admin)/admin/layout.tsx" tests/integration/reporting tests/unit/admin/report-tables.test.tsx README.md
    git commit -m "feat: add operational reports"

### Task 29: 보고서 결과 CSV 출력

**파일:**

- 생성: src/server/reporting/csv.ts
- 생성: src/app/api/admin/reports/export/route.ts
- 생성: tests/unit/reporting/csv.test.ts
- 생성: tests/integration/reporting/csv-route.test.ts
- 수정: src/app/(admin)/admin/reports/page.tsx
- 수정: README.md

**인터페이스:**

- 입력: Task 28의 권한이 적용된 읽기 전용 report query.
- 출력: formatReportCsv(rows), GET /api/admin/reports/export?report=&from=&through=&branchId=, 보고서 download link. Import endpoint는 만들지 않는다.

- [ ] **Step 1: 실패하는 CSV format 테스트 작성**

UTF-8 BOM, 고정된 한국어 header, CRLF record, RFC 4180 quote escaping, =, +, -, @로 시작하는 값의 formula-injection neutralization, 안정적인 column order를 검증한다.

- [ ] **Step 2: 실패하는 route 권한 테스트 작성**

MEMBER와 INSTRUCTOR는 403, BRANCH_ADMIN의 다른 branch export는 403, 유효하지 않은 report/date는 400인지 확인한다. Content-Disposition은 안전한 고정 prefix와 date range만 사용한다. POST와 multipart request는 405이고 /import route가 존재하지 않는지 검증한다.

- [ ] **Step 3: RED 확인**

실행:

    npm exec vitest run tests/unit/reporting/csv.test.ts tests/integration/reporting/csv-route.test.ts

예상 결과: CSV formatter와 export route가 없으므로 FAIL.

- [ ] **Step 4: Formatter와 GET route 최소 구현**

화면과 동일한 ReportFilter와 query function을 사용한다. text/csv; charset=utf-8과 BOM을 포함해 stream 또는 text로 반환한다. Route는 read-only이며 upload file을 받지 않는다. README.md에서 report CSV download와 제외된 1,200명 member data import를 명확히 구분한다.

- [ ] **Step 5: GREEN 확인**

실행:

    npm exec vitest run tests/unit/reporting/csv.test.ts tests/integration/reporting/csv-route.test.ts

예상 결과: Encoding, escaping, injection, 권한, filter, method 테스트가 PASS.

- [ ] **Step 6: REFACTOR 정리**

각 보고서의 header와 accessor를 typed constant로 정의해 CSV formatting에서 공유한다. UI table 순서가 CSV 내부 구현에 의존하지 않게 한다.

- [ ] **Step 7: Task 검증**

실행:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/unit/reporting tests/integration/reporting
    rg -n "import|upload|multipart" src/app/api/admin/reports

예상 결과: 모든 테스트가 PASS. rg는 명시적인 method rejection text만 찾고 member data import 구현은 찾지 않는다.

- [ ] **Step 8: 커밋**

    git add -- src/server/reporting/csv.ts src/app/api/admin/reports/export "src/app/(admin)/admin/reports/page.tsx" tests/unit/reporting tests/integration/reporting README.md
    git commit -m "feat: export operational reports as csv"

### Task 30: 선택적 고급 Push 재시도와 저빈도 유지보수 추가

**파일:**

- 생성: drizzle/0004_push_retry.sql
- 생성: drizzle/meta/0004_snapshot.json
- 생성: src/server/push/retry-service.ts
- 생성: src/server/push/subscription-cleanup.ts
- 생성: src/server/maintenance/maintenance-service.ts
- 생성: src/app/api/cron/maintenance/route.ts
- 생성: tests/integration/push/retry-service.test.ts
- 생성: tests/integration/maintenance/maintenance-route.test.ts
- 생성: tests/unit/deployment/cron-frequency.test.ts
- 수정: src/server/db/schema/push.ts
- 수정: drizzle/meta/_journal.json
- 수정: src/server/push/delivery-service.ts
- 수정: src/server/env.ts
- 수정: .env.example
- 수정: vercel.json
- 수정: tests/unit/deployment/hobby-config.test.ts
- 수정: README.md

**인터페이스:**

- 입력: FAILED PushDelivery row, inactive subscription, lazy offer cleanup.
- 출력: schedulePushRetry(), retryDuePushes(), removeExpiredSubscriptions(), runMaintenance(), 보호된 GET /api/cron/maintenance.

- [ ] **Step 1: 실패하는 retry state 테스트 작성**

RETRY_PENDING, FINAL_FAILED state와 next_attempt_at, last_error_type을 추가한다. Network/5xx failure만 명목상 1, 5, 15분 offset으로 schedule하고, delivery별 추가 시도는 최대 3회이며, 404/410은 retry하지 않고, 중복 worker가 같은 delivery를 claim하지 못하는지 검증한다.

- [ ] **Step 2: 실패하는 maintenance·주기 테스트 작성**

Authorization: Bearer CRON_SECRET이 필수인지, maintenance가 due row를 조건부 claim하는지, invalid subscription을 비활성화하는지, inactive 30일 이후에만 subscription을 삭제하는지, expired offer를 정리할 수 있는지 검증한다. vercel.json을 읽어 Hobby에서 daily보다 잦은 schedule을 거부한다.

- [ ] **Step 3: RED 확인**

실행:

    npm exec vitest run tests/integration/push/retry-service.test.ts tests/integration/maintenance/maintenance-route.test.ts tests/unit/deployment/cron-frequency.test.ts

예상 결과: Retry column, worker, 보호된 route, 선택적 schedule이 없으므로 FAIL.

- [ ] **Step 4: Retry migration과 worker 구현**

push_deliveries에 next_attempt_at, last_error_type, RETRY_PENDING, FINAL_FAILED를 추가한다. push_deliveries_retry_due_idx(next_attempt_at, id) WHERE status = 'RETRY_PENDING'와 push_subscriptions_inactive_cleanup_idx(deactivated_at, id) WHERE is_active = false를 만든다.

동시 worker가 같은 delivery를 보내지 못하도록 다음 CTE로 작업을 claim한다.

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

Sanitized error category만 기록한다. 지연된 Hobby invocation은 overdue row를 모두 처리할 수 있지만 명목상 minute를 보장하지 않는다.

- [ ] **Step 5: 선택적 daily maintenance route 구현**

CRON_SECRET을 constant-time comparison으로 검증한다. UTC daily schedule만 설정한다.

    {
      "framework": "nextjs",
      "crons": [
        {
          "path": "/api/cron/maintenance",
          "schedule": "0 3 * * *"
        }
      ]
    }

이 route가 호출되지 않아도 모든 Must-have 테스트가 PASS해야 한다. README.md에는 1분 cleanup/retry가 필요하면 Vercel Pro가 필요하고 Hobby 실행 시각은 보장되지 않는다고 명시한다.

값을 명령어나 저장소에 넣지 않고 Vercel prompt로 CRON_SECRET을 추가한다.

    npx vercel env add CRON_SECRET

- [ ] **Step 6: GREEN 확인**

실행:

    npm run db:migrate:test
    npm exec vitest run tests/integration/push/retry-service.test.ts tests/integration/maintenance/maintenance-route.test.ts tests/unit/deployment

예상 결과: Retry limit, claim concurrency, invalid-subscription 처리, 30일 정리, 권한, daily 주기 테스트가 PASS.

- [ ] **Step 7: REFACTOR 정리**

Invocation별 batch size와 execution budget을 제한하고 count만 반환한다. Waitlist cleanup, Push retry, subscription cleanup은 각각 독립 호출 가능한 function으로 유지한다.

- [ ] **Step 8: Task와 핵심 독립성 검증**

실행:

    npm run typecheck
    npm run lint
    npm run verify:must-have
    npm exec vitest run tests/integration/push tests/integration/maintenance tests/unit/deployment

예상 결과: 모든 테스트가 PASS. CRON_SECRET과 Vercel Cron을 비활성화한 상태에서 npm run verify:must-have를 다시 실행해도 PASS.

- [ ] **Step 9: 커밋**

    git add drizzle/0004_push_retry.sql drizzle/meta src/server/db/schema/push.ts src/server/push src/server/maintenance src/app/api/cron/maintenance src/server/env.ts .env.example vercel.json tests/integration/push tests/integration/maintenance tests/unit/deployment README.md
    git commit -m "feat: add optional push retry maintenance"

## 최종 검증 순서

각 후속 Task 완료 후 다음 명령을 실행한다.

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

예상 결과: 모든 명령이 exit 0이고, 테스트 failure가 0건이며, production build가 성공한다. Task 커밋 후 working tree는 비어 있어야 한다.

## 계획 자체 검토 기록

1. **Task 완전성:** Task 26–30을 원래 번호와 기술 내용 그대로 포함한다.
2. **선행 조건:** Must-have Task 1–25, CI, Vercel Hobby 배포가 완료되기 전에는 Task 26을 시작하지 않는다.
3. **테스트 우선:** 모든 production 변경은 명시된 실패 테스트와 RED 확인 이후에만 진행한다.
4. **핵심 독립성:** PWA, Web Push, report, CSV, retry 실패는 예약·이용권·대기 상태를 변경하지 않는다.
5. **무료 배포:** Optional Cron은 daily 이하이고, 1분 주기는 Vercel Pro 요구사항으로 명시한다.
6. **범위 통제:** 카카오 알림톡, SMS, member CSV import, Outbox, general audit history를 포함하지 않는다.
7. **실행 격리:** main에서 직접 구현하지 않고 승인된 별도 feature branch와 worktree에서만 실행한다.
8. **승인 게이트:** 한 번에 하나의 Task만 수행하고 결과를 보고한 뒤 사용자 승인 전에는 다음 Task를 시작하지 않는다.

이 문서를 작성하는 단계에서는 worktree 생성, 의존성 설치, migration 실행, 배포, 구현을 수행하지 않는다.
