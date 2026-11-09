export default function McpConnectionSteps() {
  return <div className="mt-6 text-sm leading-7 text-[#526348]">
    <ol className="list-decimal space-y-3 pl-5">
      <li><a className="font-semibold underline" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">ChatGPT 플러그인 열기 ↗</a>에서 <strong>추가(+) → 사용자 지정 MCP 서버 추가</strong>를 선택하세요.</li>
      <li>이름은 <strong>autops</strong>, 서버 URL은 위 주소를 입력하세요. 인증은 <strong>OAuth</strong>를 선택하고 클라이언트 ID·비밀키는 비워두세요. 자동 등록을 사용합니다.</li>
      <li>안내를 확인하고 플러그인을 만든 뒤 설치하세요. 계정 연결에서 GitHub 인증을 완료해주세요. 웹에서 autops에 연결한 계정과 같은 GitHub 계정을 선택하세요.</li>
      <li>대화 입력창에서 <strong>@autops</strong>를 선택하고 아래 문장을 보내세요.</li>
    </ol>
    <p className="mt-4 rounded-lg border border-[#e0e6d8] bg-[#f8faf5] p-4">autops의 get_connected_accounts 도구로 연결된 GitHub 계정 이름과 허용된 저장소를 보여줘. get_project_context의 데모 정보와 구분해줘.</p>
    <p className="mt-4">실제 GitHub 계정 이름과 저장소 목록이 응답에 나오면 계정 연결을 확인한 거예요. 저장소가 없다면 <a href="/onboarding" className="underline">계정 연결 화면</a>에서 GitHub App에 허용한 저장소를 확인해주세요.</p>
    <p className="mt-3">연결은 1시간 후 만료돼요. 만료되면 ChatGPT에서 다시 인증해주세요. Vercel·Supabase의 웹 연결 정보는 이번 MCP 연결에 포함되지 않아요.</p>
    <details className="mt-4">
      <summary className="cursor-pointer font-semibold">연결이 안 될 때</summary>
      <p className="mt-2">추가 메뉴가 없으면 워크스페이스의 사용자 지정 MCP 권한을 확인해주세요. 도구가 보이지 않으면 플러그인 설정에서 도구를 새로고침하고 대화에 autops를 선택하세요. 인증 오류가 나면 연결을 다시 시작해주세요.</p>
    </details>
    <a className="mt-4 inline-block underline" href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noreferrer">OpenAI 공식 연결 가이드 ↗</a>
  </div>;
}
