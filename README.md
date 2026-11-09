# AUTOPS

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

- Repository permissions의 **Contents: Read and write**를 설정합니다. Metadata 읽기는 기본 권한이며 Workflows는 요청하지 않습니다. 기존 설치는 새 권한을 승인해야 합니다. 실제 수정에는 별도의 MCP `repository.write` 동의도 필요합니다.
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

온보딩 연결만으로 진단·코드 변경·배포를 실행하지 않습니다. 선택한 저장소는 ChatGPT OAuth 동의 시 연결에 묶입니다.
MCP 소스 읽기·수정은 해당 사용자의 토큰으로 접근 권한을 매번 재확인합니다. 공개 MCP에 사용자별 저장소·토큰을 반환하면 안 됩니다.

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

## 실제 MCP 저장소 읽기·API 진단

### ChatGPT OAuth 연결

[autops 플러그인 SSOT](https://chatgpt.com/plugins/plugin_asdk_app_6af15485bd508191a2b71b9912640184)는 OAuth와 동적 클라이언트 등록(DCR)을 사용합니다. 서버 주소는 `https://autops-app.vercel.app/api/mcp`입니다. 중복 Auto Ops·autops diagnostics·패키지형 autops 연결은 사용하지 않습니다.
로그인은 GitHub만 사용합니다. 이전 이메일 로그인·가입·세션 API와 관련 Supabase Auth 설정은 제거했습니다. Supabase Platform OAuth 연결은 유지합니다.
`accounts.read`는 계정·허용 저장소 목록, `repository.read`는 선택한 저장소의 소스 읽기, `repository.write`는 기존 소스 파일 수정에 사용합니다. 쓰기는 read와 write를 모두 승인해야 합니다. 기존 읽기 전용 토큰의 권한은 자동으로 확대되지 않습니다.
온보딩에서 저장소를 선택한 뒤 ChatGPT에서 기존 autops 플러그인을 새로고침하고 요청된 OAuth 범위를 승인합니다. 연결은 최대 1시간 유지하며 PKCE S256·리디렉션 주소·state·issuer·audience와 실제 GitHub 계정을 검증합니다. Vercel·Supabase 웹 세션은 MCP로 전달하지 않습니다.
배포 후 기존 플러그인에서 `get_connected_accounts` → `get_project_context` → `get_repository_file`(`lib/products.ts`) → `diagnose_project`를 실제 호출해 확인합니다. 서버 직접 호출만으로 플러그인 검증 성공을 보고하지 않습니다.

인증 없는 프로젝트 맥락은 공개 데모임을 명시합니다. 인증하면 선택한 저장소의 맥락을 반환합니다. 소스 읽기·수정은 OAuth 선택 저장소에만 허용되며 사용자·저장소·App 설치 접근 권한을 매 요청마다 검증합니다. 경로는 100 KB 이하 UTF-8 소스 파일로 제한하며 숨김 경로·워크플로·비밀 파일·경로 순회를 허용하지 않습니다.

- `get_repository_file`: 선택한 저장소 기본 브랜치의 소스·커밋·파일 SHA·출처 반환.
- `update_repository_file`: 읽은 `fileSha`를 `expectedSha`로 전달하고 수정 내용·커밋 메시지를 지정합니다. 파일이 변경됐으면 거부합니다. 기존 파일 하나를 기본 브랜치에 실제 커밋하며 파일 생성·삭제는 지원하지 않습니다. 커밋은 기존 CI/배포를 트리거할 수 있습니다. 도구 자체는 테스트·배포를 검증하지 않습니다.
- `diagnose_project`: 선택한 저장소가 `ongleam/compiled-ex-project`일 때만 상품 API의 두 기존 조회 방식을 limit 2로 각각 3회 교차 호출합니다. 다른 저장소는 미지원임을 명시하며 다른 대상의 수치를 반환하지 않습니다. HTTP 응답 시간 p50/p95·실패 수·DB HTTP 요청 수·상품 결과 동일성을 반환합니다.
- CPU·메모리·페이지 TTFB와 대상 서비스 배포 커밋은 미검증입니다. 콜드 스타트를 제외하지 않으며 표본이 작습니다.
- 진단은 동일 배포 내 기존 조회 방식 비교이며 코드 변경 전후 개선으로 해석하면 안 됩니다. 영속 진단 저장·직접 배포·예약 기능은 제공하지 않습니다.
