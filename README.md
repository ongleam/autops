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

서버 전용 설정은 `.env.example`의 승인된 5개 이름을 사용합니다. 실제 값은 승인된 환경 설정 절차로 등록하고 커밋하지 않습니다.
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
