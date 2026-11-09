## 검증 루프 원칙

- 새 브랜치나 worktree를 만들지 않고 `main`에서 바로 작업한다.
- 변경 후 `bun run lint`와 `bun run build`를 실행하고, 둘 다 통과하면 해당 작업의 변경만 커밋해 `main`에 즉시 push한다.
- 배포 완료 후 실제 배포 화면에서 직접 E2E로 확인하고, 피드백에 따라 수정 → lint·build → push → 배포 → E2E를 반복한다.
- 요청한 동작이 실제로 확인될 때까지 반복하며, 확인하지 못한 항목은 명시한다.
- MCP·인증 변경을 배포할 때마다 기존 `autops` 플러그인에서 OAuth 계정 확인 → 공개 저장소 읽기 → `diagnose_project`를 실제 호출한다. 서버 직접 호출만 성공한 경우 ChatGPT 플러그인 검증 완료로 보고하지 않는다.
- autops 연결의 SSOT는 `plugin_asdk_app_6af15485bd508191a2b71b9912640184`이다. 같은 MCP를 가리키는 플러그인을 추가로 만들지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
