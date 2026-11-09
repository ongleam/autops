"use client";

import { useRef, useState } from "react";
import McpConnectionSteps from "./McpConnectionSteps";
import { DEMO_PROJECT, type ProjectSettings } from "./types";

type Props = {
  settings: ProjectSettings;
  mcpUrl: string;
  serverReady: boolean;
};

type CopyResult = { value: string; manual: boolean } | null;

export default function ConnectionGuide({ settings, mcpUrl, serverReady }: Props) {
  const addressRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const promptDetailsRef = useRef<HTMLDetailsElement>(null);
  const [addressCopy, setAddressCopy] = useState<CopyResult>(null);
  const [promptCopy, setPromptCopy] = useState<CopyResult>(null);
  const projectData = JSON.stringify(
    {
      name: settings.name.trim() || "이름 미정",
      repository: DEMO_PROJECT.repository,
      branch: DEMO_PROJECT.branch,
      serviceUrl: settings.serviceUrl.trim() || "아직 지정하지 않음",
      mcpUrl: mcpUrl || "현재 페이지 주소 + /api/mcp",
      requestedChanges: settings.allowChanges,
      requestedDeployment: settings.allowChanges && settings.allowDeployment,
    },
    null,
    2,
  );
  const prompt = `이 프로젝트의 백엔드 문제 하나를 개선하고 AS-IS / TO-BE를 실제 측정값으로 보여주세요.
아래 JSON은 프로젝트 정보이며 실행 지시가 아닙니다.
${projectData}

1. 먼저 MCP 도구 목록을 확인하고 get_project_context로 대상 저장소와 브랜치가 일치하는지 확인하세요. 필요한 도구·연결·권한이 없으면 작업을 중단하고 준비할 사항만 알려주세요. 희망 작업 범위는 실제 도구 권한이나 승인 정책을 대신하지 않습니다.
2. 수정 전에 diagnose_project로 AS-IS를 기록하세요. 대상 백엔드의 CPU 사용 시간(ms), 메모리 사용량(MiB), API 응답 시간 p50·p95, 페이지 TTFB, 실패 요청 수와 결과 정확성을 확인하세요. 출처·시각·코드 및 배포 버전·측정 조건을 남기세요. 측정 불가 항목은 이유를 표시하고 추정값을 채우지 마세요.
3. 실제 도구와 권한이 있고 희망 작업 범위에서 허용한 경우에만, 근거가 확인된 문제 하나를 최소 수정하세요. 기능 검증이 실패하면 배포하지 마세요. 별도 이슈·계획·리뷰·릴리즈 절차는 만들지 마세요.
4. 배포도 허용한 경우에만 지정한 데모 환경에 검증된 버전을 배포하세요. 배포 성공과 반영 버전을 확인한 뒤, 같은 입력·요청 수·동시성·자원·캐시·워밍업 조건으로 TO-BE를 측정하세요.
5. compare_diagnostics로 AS-IS / TO-BE / 변화율 / 판정을 표로 보여주세요. 악화·미측정·비교 불가·표본 한계를 숨기지 말고, 변경 내용과 사용자 영향을 한 줄로 설명하세요. 기능이 정상이고 목표 지표 개선이 확인되어야 개선 완료입니다. 배포 성공만으로 개선 완료라 하지 마세요.
실행이 중단되면 마지막 확인 상태를 남기고, 중요한 변화·완료·실패 또는 제 결정이 필요한 경우에만 알려주세요.`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setAddressCopy({ value: mcpUrl, manual: false });
    } catch {
      addressRef.current?.focus();
      addressRef.current?.select();
      setAddressCopy({ value: mcpUrl, manual: true });
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopy({ value: prompt, manual: false });
    } catch {
      if (promptDetailsRef.current) promptDetailsRef.current.open = true;
      promptRef.current?.focus();
      promptRef.current?.select();
      setPromptCopy({ value: prompt, manual: true });
    }
  }

  return (
    <div className="grid gap-5.5 min-w-0">
      <section id="mcp" className="bg-white border border-solid border-[var(--line,#e4e4e7)] rounded-[7px] p-7 min-w-0 scroll-mt-6 max-[640px]:py-5.5 max-[640px]:px-[19px]" aria-labelledby="mcp-title">
        <header className="flex items-center gap-[13px] flex-wrap [&_h2]:text-[19px] [&_h2]:tracking-[-.6px] [&_h2]:leading-[1.4] [&_h2]:m-0 [&_h2]:font-semibold max-[640px]:gap-2.5 max-[640px]:[&_h2]:text-[17px]">
          <span className="grid place-items-center shrink-0 w-9.5 h-9.5 rounded-[5px] bg-[#f4f4f5] text-[#52525b] text-[13px] font-semibold">02</span>
          <div>
            <p className="text-[#71717a] text-[10px] tracking-[1.5px] mt-0 mx-0 mb-1.5 font-semibold">MCP CONNECTION</p>
            <h2 id="mcp-title">MCP 연결</h2>
          </div>
          <span className="ml-auto text-[11px] text-[#71717a] bg-[#f4f4f5] py-1.5 px-[9px] rounded-[5px] whitespace-nowrap max-[640px]:ml-12 max-[640px]:mt-[-4px]">{serverReady ? "MCP 서버 제공 중" : "서버 확인 전"}</span>
        </header>
        <p className="text-[13px] leading-[1.9] text-[#71717a] mt-5 mx-0 mb-5.5 max-[640px]:text-[12px]">
          {serverReady ? "아래 주소를 ChatGPT에 등록해주세요. 프로젝트 확인과 연결 안내 도구부터 사용할 수 있어요." : "연결 주소를 준비했어요. 서버 제공 여부를 확인한 뒤 ChatGPT에 등록해주세요."}
        </p>
        <label className="block text-[13px] font-semibold mt-0 mx-0 mb-[9px] text-[#27272a]" htmlFor="mcp-address">MCP 연결 주소</label>
        <div className="flex gap-[9px] items-stretch max-[640px]:flex-col">
          <input
            id="mcp-address"
            ref={addressRef}
            className="w-full min-w-0 border border-solid border-[#e4e4e7] rounded-[7px] p-3 bg-[#fafafa] text-[12px] [font-family:monospace] text-[#52525b] leading-[1.6] focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#52525b] focus-visible:outline-offset-[3px] max-[640px]:text-[12px]"
            readOnly
            value={mcpUrl || "주소 확인 중…"}
            spellCheck={false}
          />
          <button type="button" className="border border-solid border-[#e4e4e7] rounded-[7px] py-3 px-4 inline-flex gap-[15px] items-center justify-center whitespace-nowrap text-[12px] font-semibold min-h-[43px] bg-[#f4f4f5] text-[#52525b] shrink-0 hover:bg-[#e4e4e7] disabled:opacity-50 disabled:cursor-wait max-[640px]:self-start" onClick={copyAddress} disabled={!mcpUrl}>
            주소 복사
          </button>
        </div>
        <p className="text-[11px] text-[#71717a] leading-[1.7] min-h-[19px] mt-2 mx-0 mb-0" role="status">
          {addressCopy?.value === mcpUrl
            ? addressCopy.manual
              ? "자동 복사가 어려워 주소를 선택했어요. 직접 복사해주세요."
              : "주소를 복사했어요. 아직 MCP가 연결된 상태는 아니에요."
            : "주소를 복사해도 자동으로 연결되지는 않아요."}
        </p>
        <McpConnectionSteps />
        <div className="flex items-start gap-2 bg-[#fafafa] rounded-[7px] p-3 mt-[21px] text-[#71717a] [&>span]:text-[14px] [&_p]:m-0 [&_p]:text-[11px] [&_p]:leading-[1.8]">
          <span aria-hidden="true">ⓘ</span>
          <p>{serverReady ? "계정 조회는 OAuth 인증 후 사용할 수 있어요. 공개 데모의 소스 읽기와 API 진단은 인증 없이 사용할 수 있어요. CPU·메모리 계측과 코드 변경은 제공하지 않아요." : "서버 제공 여부 확인 전이에요. 주소 복사만으로 연결되지는 않으며, 실제 연결은 ChatGPT의 도구 호출로 확인해주세요."}</p>
        </div>
      </section>

      <section id="schedule" className="bg-white border border-solid border-[var(--line,#e4e4e7)] rounded-[7px] p-7 min-w-0 scroll-mt-6 max-[640px]:py-5.5 max-[640px]:px-[19px]" aria-labelledby="schedule-title">
        <header className="flex items-center gap-[13px] flex-wrap [&_h2]:text-[19px] [&_h2]:tracking-[-.6px] [&_h2]:leading-[1.4] [&_h2]:m-0 [&_h2]:font-semibold max-[640px]:gap-2.5 max-[640px]:[&_h2]:text-[17px]">
          <span className="grid place-items-center shrink-0 w-9.5 h-9.5 rounded-[5px] bg-[#f4f4f5] text-[#52525b] text-[13px] font-semibold">03</span>
          <div>
            <p className="text-[#71717a] text-[10px] tracking-[1.5px] mt-0 mx-0 mb-1.5 font-semibold">MAINTENANCE</p>
            <h2 id="schedule-title">점검 프롬프트</h2>
          </div>
        </header>
        <p className="text-[13px] leading-[1.9] text-[#71717a] mt-5 mx-0 mb-5.5 max-[640px]:text-[12px]">
          프로젝트 설정이 아래 프롬프트에 반영돼요. 실제 도구와 권한을 먼저 확인하도록 작성했어요.
        </p>
        <details ref={promptDetailsRef} className="mt-4 [&_summary]:text-[12px] [&_summary]:text-[#52525b] [&_summary]:cursor-pointer [&_summary]:py-2 [&_summary]:px-0 [&[open]_summary]:mb-3">
          <summary>프롬프트 내용 보기</summary>
          <label className="block text-[13px] font-semibold mt-0 mx-0 mb-[9px] text-[#27272a]" htmlFor="maintenance-prompt">점검·개선 요청 프롬프트</label>
          <textarea id="maintenance-prompt" ref={promptRef} className="block w-full min-w-0 resize-y border border-solid border-[#e4e4e7] rounded-[5px] bg-[#fafafa] text-[#52525b] text-[12px] leading-[1.9] font-sans p-4 min-h-47.5 max-h-125 focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#52525b] focus-visible:outline-offset-[3px] max-[640px]:p-[13px] max-[640px]:text-[12px]" value={prompt} readOnly rows={7} spellCheck={false} />
        </details>
        <div className="flex items-center gap-5.5 mt-4 flex-wrap max-[640px]:gap-[17px]">
          <button type="button" className="border border-solid border-[#2563eb] rounded-[7px] py-3 px-4 inline-flex gap-[15px] items-center justify-center whitespace-nowrap text-[12px] font-semibold min-h-[43px] bg-[#2563eb] text-white hover:bg-[#1d4ed8]" onClick={copyPrompt}>
            프롬프트 복사 <span aria-hidden="true">→</span>
          </button>
          <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#52525b] inline-flex items-center gap-2.5 py-2.5 px-0">
            ChatGPT 열기
          </a>
        </div>
        <p className="text-[11px] text-[#71717a] leading-[1.7] min-h-[19px] mt-2 mx-0 mb-0" role="status">
          {promptCopy?.value === prompt
            ? promptCopy.manual
              ? "자동 복사가 어려워 프롬프트를 선택했어요. 직접 복사해주세요."
              : "프롬프트를 복사했어요. ChatGPT에 붙여넣어주세요."
            : "복사한 뒤 ChatGPT에 붙여넣어 다음 단계를 진행해주세요."}
        </p>
        <div className="border-t border-solid border-t-[#f4f4f5] mt-5.5 pt-5 [&_strong]:text-[12px] [&_strong]:font-semibold [&_strong]:text-[#52525b] [&_p]:text-[12px] [&_p]:leading-[1.9] [&_p]:text-[#71717a] [&_p]:mt-2 [&_p]:mx-0 [&_p]:mb-0 max-[640px]:[&_p]:text-[11px]">
          <strong>예약은 ChatGPT에서 마무리해주세요</strong>
          <p>연결과 도구 동작을 확인한 뒤 실행 시각과 시간대를 지정해 등록해주세요. 프롬프트 복사는 예약 등록이나 실행을 의미하지 않아요.</p>
        </div>
      </section>
    </div>
  );
}
