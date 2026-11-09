export const MCP_URL = "https://autops-app.vercel.app/api/mcp";

export const MAINTENANCE_PROMPT = `연결된 autops 프로젝트를 확인하고 백엔드 문제 하나를 개선해주세요.
대상 저장소: https://github.com/ongleam/compiled-ex-project
대상 브랜치: main

먼저 get_project_context로 대상과 지원 기능을 확인하세요.
현재 이 MCP는 공개 프로젝트 맥락과 연결 안내만 제공합니다.
실제 진단·비교·변경·예약 도구와 권한이 없다면 작업을 시작하지 말고 필요한 연결을 알려주세요.

필요한 도구가 제공된 경우에만 다음을 수행하세요.
1. 변경 전 diagnose_project로 대상 백엔드의 CPU 사용 시간, 메모리 사용량,
   API p50·p95, 페이지 TTFB, 오류와 결과 정확성을 측정하세요.
   출처·시각·코드 버전·측정 조건을 기록하고 측정 불가는 이유를 표시하세요.
2. 근거가 있는 문제 하나만 최소 수정하고 기능을 검증하세요. 검증 실패 시 배포하지 마세요.
3. 사용자가 실제로 허용한 대상에 배포하고 코드 버전을 확인하세요.
4. 동일 조건으로 재측정하고 compare_diagnostics로 AS-IS / TO-BE 표를 보여주세요.
   개선·악화·비교 불가를 구분하고, 수치를 추정하거나 배포 성공을 성능 개선으로 표현하지 마세요.

별도 이슈·계획·리뷰·릴리즈 절차를 만들지 마세요.
예약은 ChatGPT에서 실행 시각과 시간대를 지정해 별도로 등록해야 합니다.
중요한 변화·완료·실패 또는 사용자 결정이 필요한 경우에만 알려주세요.`;

export function getProjectContext() {
  return {
    projectId: "compiled-ex-project",
    name: "autops demo project",
    repository: "https://github.com/ongleam/compiled-ex-project",
    branch: "main",
    mcpUrl: MCP_URL,
    capabilities: {
      context: true,
      diagnostics: false,
      comparison: false,
      changes: false,
      scheduling: false,
    },
    storage: "No user settings or credentials are stored by this public MCP.",
    prompt: MAINTENANCE_PROMPT,
  };
}

export function getConnectionInstructions() {
  return {
    name: "autops",
    serverUrl: MCP_URL,
    transport: "Streamable HTTP",
    authentication: "No authentication",
    steps: [
      "ChatGPT의 플러그인에서 사용자 지정 MCP 서버를 추가하세요. 계정과 워크스페이스에 따라 메뉴가 다를 수 있습니다.",
      `서버 URL에 ${MCP_URL}을 입력하고 인증 없음을 선택하세요.`,
      "연결 후 get_project_context 도구를 호출해 저장소와 main 브랜치가 일치하는지 확인하세요.",
      "필요한 GitHub 권한은 별도 연결 도구에서 설정하세요. 이 MCP는 저장소 변경 권한을 제공하지 않습니다.",
      "예약은 ChatGPT에서 실행 시각과 시간대를 지정해 별도로 등록하고 실제 실행을 확인하세요.",
    ],
    verification: "주소 복사나 안내 열람은 연결 확인이 아닙니다. 실제 MCP 도구 호출로 확인하세요.",
    availableTools: [
      "get_project_context",
      "get_connection_instructions",
      "get_maintenance_prompt",
    ],
    limitations: [
      "현재 진단·비교·코드 변경·배포·예약 도구는 제공하지 않습니다.",
      "공개된 고정 프로젝트 정보만 반환하며 실제 운영 상태를 조회하지 않습니다.",
      "이 서버에는 비밀번호·API 키·토큰을 입력할 필요가 없습니다.",
    ],
  };
}
