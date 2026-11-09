# autops

Next.js App Router · TypeScript · Tailwind CSS 기반 해커톤 기본 페이지입니다.

## 실행

Node.js 20.9 이상과 Bun을 사용합니다.

```sh
bun install --frozen-lockfile
bun run dev
```

[로컬 페이지](http://localhost:3000)를 엽니다.

## 검증 및 프로덕션 실행

```sh
bun run lint
bun run typecheck
bun run build
bun run start
```

현재 화면은 반응형 헤더와 GitHub 링크로 구성되어 있습니다.

## GitHub 저장소 온보딩

`/onboarding`에서 GitHub 인증 → App 설치·저장소 접근 허용 → 저장소 선택을 진행합니다.
대시보드의 연결 관리와 저장소 연결 버튼도 이 화면으로 이동합니다.
관련 범위: [기획 #1](https://github.com/ongleam/autops/issues/1), [설정·연결 #2](https://github.com/ongleam/autops/issues/2).
이번 기능은 기존 고정 데모 저장소를 사용자별 선택으로 확장합니다.

GitHub App을 등록하고 다음과 같이 설정합니다.

- 사용자 설치를 허용할 계정 범위를 선택하고 Repository permissions의 **Contents: Read-only**를 설정합니다. Metadata 읽기는 기본 권한입니다. 코드 쓰기·배포 권한은 요청하지 않습니다.
- Callback URL: 서비스의 `/api/github/callback` 주소. 로컬 개발은 `http://localhost:3000/api/github/callback`을 추가 등록합니다.
- Setup URL: 서비스의 `/onboarding` 주소. 설치 변경 후 돌아오도록 Redirect on update를 켭니다.
- **Request user authorization (OAuth) during installation은 끕니다.** 사용자 인증은 사이트의 PKCE 흐름으로 먼저 수행하며 설치 후 Setup URL로 돌아옵니다.
- Webhook은 이번 기능에서 사용하지 않습니다. 연결 상태·저장소 선택 시 GitHub 권한을 다시 조회합니다.
- App 설치 시 **Only select repositories**로 필요한 저장소만 허용합니다. 조직 정책에 따라 관리자 승인이 필요합니다.

GitHub 서버 전용 설정은 `.env.example`의 `GITHUB_`로 시작하는 승인된 5개 이름을 사용합니다. 실제 값은 승인된 환경 설정 절차로 등록하고 커밋하지 않습니다.
`GITHUB_APP_PRIVATE_KEY`는 실제 줄바꿈이 포함된 PEM입니다. `GITHUB_SESSION_SECRET`은 32자 이상의 무작위 값이며 환경별로 다르게 설정합니다.
인증 토큰은 AES-256-GCM으로 암호화한 HttpOnly·SameSite=Lax 쿠키에만 보관합니다. Production에서는 Secure·`__Host-` 제약을 적용합니다.
세션은 토큰 만료와 8시간 중 짧은 기간만 유지하며 만료 후 재인증합니다. 별도 DB나 자동 갱신 토큰 저장은 추가하지 않았습니다.

연결된 저장소와 계정은 `GET /api/github/session`에서 해당 브라우저 세션으로만 조회할 수 있습니다.
`POST /api/github/selection`은 GitHub에서 다시 확인한 저장소 ID·설치 ID만 허용합니다.
연결 해제는 브라우저 세션만 지웁니다. App 설치·계정 권한을 철회하려면 GitHub 설정에서 제거합니다.

이 연결은 진단·코드 변경·배포를 실행하지 않습니다. 브라우저 세션은 ChatGPT의 MCP 인증으로 전달되지 않으며,
비공개 저장소를 MCP에서 사용하려면 사용자와 연결을 식별하는 별도 인증 계약이 필요합니다.
공개 MCP에 사용자별 저장소·토큰을 반환하면 안 됩니다.

```sh
bun test tests
bun run lint
bun run typecheck
bun run build
```

테스트는 GitHub HTTP 응답을 격리하며 실제 GitHub 설치·인증 성공을 증명하지 않습니다.

## Vercel·Supabase 읽기 전용 연결

`/onboarding`에서 GitHub 계정을 먼저 연결한 뒤 각 서비스의 권한 승인 → 프로젝트 선택 → 프로젝트 상태 조회를 진행합니다.
Vercel은 프로젝트 이름·프레임워크·최근 배포 상태를, Supabase는 프로젝트 이름·리전·상태를 조회합니다.
DB 행, SQL, API 키, 환경 변수, 배포 실행·설정 변경은 제공하지 않습니다. 두 서비스의 프로젝트는 각각 선택하며 자동으로 같은 서비스라고 간주하지 않습니다.

Vercel의 [Integration Console](https://vercel.com/docs/integrations/create-integration)에서 Connectable Account Integration을 등록합니다.

- **Projects: Read**, **Deployments: Read**만 허용합니다. 쓰기, 환경 변수, 도메인, 결제 권한은 요청하지 않습니다.
- Redirect URL: 서비스의 `/api/cloud/vercel/callback` 주소. 개발용 Integration에는 `http://localhost:3000/api/cloud/vercel/callback`을 등록합니다.
- 설치 과정에서 접근할 프로젝트를 허용합니다. 팀 설치는 토큰 교환 응답의 `team_id`로 API 범위를 제한합니다.
- 승인된 `VERCEL_INTEGRATION_CLIENT_ID`, `VERCEL_INTEGRATION_CLIENT_SECRET`, `VERCEL_INTEGRATION_SLUG`를 환경 설정 절차로 등록합니다.
- 외부 설치 흐름만 지원합니다. Marketplace에서 직접 시작한 설치와 기존 설치의 코드 없는 재연결은 지원하지 않으며, 인증을 다시 시작해야 합니다.

Supabase 조직 설정의 [Platform OAuth Apps](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration)에서 앱을 등록·게시합니다. 프로젝트의 Supabase Auth 로그인 앱과 다릅니다.

- **Projects: Read**만 허용합니다. SQL, Secrets, 쓰기 권한은 요청하지 않습니다.
- Redirect URI: 서비스의 `/api/cloud/supabase/callback` 주소. 개발용 앱에는 `http://localhost:3000/api/cloud/supabase/callback`을 등록합니다.
- 승인된 `SUPABASE_OAUTH_CLIENT_ID`, `SUPABASE_OAUTH_CLIENT_SECRET`를 환경 설정 절차로 등록합니다.
- PKCE S256과 사용자·브라우저 세션에 묶인 state를 검증합니다.

두 연결은 기존 `GITHUB_SESSION_SECRET`으로 암호화한 별도의 HttpOnly 쿠키에 저장합니다. GitHub 로그인 세션에 묶여 있으며 GitHub 연결 해제·계정 변경 후에는 사용할 수 없습니다.
세션은 공급자 access token 만료 또는 최대 8시간까지만 유지합니다. Refresh token은 저장하지 않으며 만료 후 다시 승인합니다.
서버 DB·백그라운드 실행·MCP 인증은 추가하지 않습니다. 공개 MCP에는 이 연결 정보와 사용자별 조회 결과가 노출되지 않습니다.
연결 해제는 이 브라우저의 쿠키만 지웁니다. 공급자의 앱 설치·권한 철회는 각 서비스 설정에서 진행합니다.

`/api/cloud/{vercel|supabase}`의 경로:

- `GET /start`, `GET /callback`: OAuth 시작·완료.
- `GET /session`, `DELETE /session`: 연결 상태 확인·브라우저 연결 해제.
- `GET /projects`: 현재 토큰으로 접근할 수 있는 프로젝트 목록.
- `POST /selection`: 공급자 목록에서 권한을 재확인한 프로젝트 ID 선택.
- `GET /overview`: 선택한 프로젝트를 공급자에서 다시 조회. 외부 프로젝트 API는 모두 GET만 사용합니다.

API 응답은 필요한 필드만 포함하며 토큰·원본 공급자 오류를 반환하지 않습니다. 설정 전에는 준비 중 상태를 표시하고 연결을 가장하지 않습니다.
`bun test tests`는 외부 HTTP 응답을 격리한 인증·권한·조회 테스트입니다. 실제 승인은 OAuth 앱 설정 후 두 서비스에서 각각 확인해야 합니다.
