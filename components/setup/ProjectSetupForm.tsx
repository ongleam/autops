"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEMO_PROJECT, type ProjectSettings } from "./types";

const STORAGE_KEY = "autops-project-settings";
const LEGACY_STORAGE_KEY = "compiled-project-settings";

function validServiceUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return !url.username && !url.password &&
      (url.protocol === "https:" || (url.protocol === "http:" && local));
  } catch {
    return false;
  }
}

function restoredSettings(value: unknown): ProjectSettings | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 ||
      typeof item.serviceUrl !== "string" || item.serviceUrl.length > 2048 ||
      !validServiceUrl(item.serviceUrl) || typeof item.allowChanges !== "boolean" ||
      typeof item.allowDeployment !== "boolean") return null;
  return {
    name: item.name.trim(),
    serviceUrl: item.serviceUrl.trim(),
    allowChanges: item.allowChanges,
    allowDeployment: item.allowChanges && item.allowDeployment,
  };
}

type Props = {
  settings: ProjectSettings;
  onChange: (settings: ProjectSettings) => void;
  onSaved: () => void;
};

export default function ProjectSetupForm({ settings, onChange, onSaved }: Props) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const restored = restoredSettings(JSON.parse(stored));
        if (restored) onChange(restored);
      }
    } catch {
      // Saving reports storage errors; setup remains usable without storage.
    }
  }, [onChange]);

  function update(next: ProjectSettings) {
    onChange(next);
    setError("");
    setStatus("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    if (!settings.name.trim()) {
      setError("프로젝트 이름을 입력해주세요.");
      return;
    }
    if (!validServiceUrl(settings.serviceUrl)) {
      setError("서비스 주소는 https://로 입력해주세요. 로컬 주소는 http://localhost도 사용할 수 있어요.");
      return;
    }
    const next = {
      ...settings,
      name: settings.name.trim(),
      serviceUrl: settings.serviceUrl.trim(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      onChange(next);
      setError("");
      setStatus("저장 완료. 아래에서 ChatGPT를 연결하세요.");
      onSaved();
    } catch {
      setError("브라우저에 저장하지 못했어요. 저장소 접근을 허용하거나 다른 브라우저를 사용해주세요.");
    }
  }

  return (
    <form className="flex flex-col gap-[23px] min-w-0" onSubmit={save}>
      <div className="flex flex-col gap-[9px] [&>label]:text-[14px] [&>label]:font-semibold [&>label]:text-[#27272a] [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-solid [&_input]:border-[#e4e4e7] [&_input]:rounded-[5px] [&_input]:py-[13px] [&_input]:px-3.5 [&_input]:bg-white [&_input]:text-[#27272a] [&_input]:[font:inherit] [&_input]:text-[14px] [&_input]:leading-[1.5] [&_input]:outline-offset-[3px] [&_input:focus-visible]:outline-[2px] [&_input:focus-visible]:outline-solid [&_input:focus-visible]:outline-[#2563eb] [&_input:focus-visible]:border-[#71717a] [&_input::placeholder]:text-[#71717a]">
        <label htmlFor="project-name">프로젝트 이름 <span className="ml-1.5 text-[11px] font-normal text-[#71717a]">필수</span></label>
        <input id="project-name" name="projectName" value={settings.name} required maxLength={80}
          placeholder="예: 나의 첫 서비스" autoComplete="off"
          onChange={(event) => update({ ...settings, name: event.target.value })} />
      </div>

      <div className="flex flex-col gap-[9px] [&>label]:text-[14px] [&>label]:font-semibold [&>label]:text-[#27272a] [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-solid [&_input]:border-[#e4e4e7] [&_input]:rounded-[5px] [&_input]:py-[13px] [&_input]:px-3.5 [&_input]:bg-white [&_input]:text-[#27272a] [&_input]:[font:inherit] [&_input]:text-[14px] [&_input]:leading-[1.5] [&_input]:outline-offset-[3px] [&_input:focus-visible]:outline-[2px] [&_input:focus-visible]:outline-solid [&_input:focus-visible]:outline-[#2563eb] [&_input:focus-visible]:border-[#71717a] [&_input::placeholder]:text-[#71717a]">
        <label htmlFor="service-url">서비스 주소 <span className="ml-1.5 text-[11px] font-normal text-[#71717a]">선택</span></label>
        <input id="service-url" name="serviceUrl" type="url" value={settings.serviceUrl}
          maxLength={2048} placeholder="https://my-service.com" autoComplete="url"
          aria-describedby="service-url-help"
          onChange={(event) => update({ ...settings, serviceUrl: event.target.value })} />
        <p id="service-url-help" className="m-0 text-[#71717a] text-[12px] leading-[1.8]">선택 사항 · 비밀번호나 토큰을 포함하지 마세요.</p>
      </div>

      <div className="flex flex-col gap-[13px] bg-[#f4f4f5] border border-solid border-[#e4e4e7] rounded-[5px] py-[17px] px-4.5 min-w-0 [&>a]:flex [&>a]:justify-between [&>a]:items-center [&>a]:gap-2.5 [&>a]:[overflow-wrap:anywhere] [&>a]:text-[14px] [&>a]:leading-[1.7] [&>a]:font-semibold [&>a]:text-[#27272a] [&>a:hover]:underline max-[540px]:p-[15px]">
        <div className="flex items-center gap-[9px] text-[#52525b] text-[13px] flex-wrap [&>span:first-child]:text-[21px] [&>span:first-child]:leading-none [&_strong]:font-semibold"><span aria-hidden="true">⑂</span><strong>데모 GitHub 저장소</strong><span className="ml-auto py-1 px-[7px] rounded-[4px] bg-[#f4f4f5] text-[#71717a] text-[10px] max-[540px]:ml-0">고정 대상</span></div>
        <a href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam / compiled-ex-project</a>
        <div className="flex items-center gap-[9px] flex-wrap text-[#71717a] text-[11px] leading-[1.6] [&_code]:bg-[#f4f4f5] [&_code]:rounded-[4px] [&_code]:py-[3px] [&_code]:px-[7px] [&_code]:text-[11px] [&_code]:text-[#52525b] max-[540px]:gap-[7px]"><code>{DEMO_PROJECT.branch}</code><span>계정 연결은 별도</span></div>
      </div>

      <fieldset className="[&_legend]:text-[14px] [&_legend]:font-semibold [&_legend]:text-[#27272a] border-0 p-0 m-0 min-w-0 [&_legend]:mb-2 [&_legend]:p-0 [&>p]:mb-3.5">
        <legend>작업 범위</legend>
        <p className="m-0 text-[#71717a] text-[12px] leading-[1.8]">요청에 반영돼요. 실제 권한은 연결 도구에서 설정하세요.</p>
        <label className="flex items-start gap-[11px] py-3 px-0 cursor-pointer [&_input]:accent-[#2563eb] [&_input]:shrink-0 [&_input]:w-[17px] [&_input]:h-[17px] [&_input]:mt-0.5 [&_input]:mx-0 [&_input]:mb-0 [&_strong]:block [&_strong]:text-[14px] [&_strong]:leading-[1.5] [&_strong]:font-medium [&_strong]:text-[#27272a] [&_small]:block [&_small]:text-[12px] [&_small]:leading-[1.8] [&_small]:text-[#71717a] [&_small]:mt-1">
          <input type="checkbox" checked={settings.allowChanges}
            onChange={(event) => update({ ...settings, allowChanges: event.target.checked, allowDeployment: event.target.checked && settings.allowDeployment })} />
          <span><strong>코드 개선</strong><small>진단 후 코드 수정</small></span>
        </label>
        <label className="flex items-start gap-[11px] py-3 px-0 cursor-pointer [&_input]:accent-[#2563eb] [&_input]:shrink-0 [&_input]:w-[17px] [&_input]:h-[17px] [&_input]:mt-0.5 [&_input]:mx-0 [&_input]:mb-0 [&_strong]:block [&_strong]:text-[14px] [&_strong]:leading-[1.5] [&_strong]:font-medium [&_strong]:text-[#27272a] [&_small]:block [&_small]:text-[12px] [&_small]:leading-[1.8] [&_small]:text-[#71717a] [&_small]:mt-1 has-disabled:cursor-default [&:has(:disabled)_strong]:text-[#71717a] [&:has(:disabled)_small]:text-[#71717a]">
          <input type="checkbox" checked={settings.allowDeployment} disabled={!settings.allowChanges}
            onChange={(event) => update({ ...settings, allowDeployment: event.target.checked })} />
          <span><strong>데모 환경 배포</strong><small>{settings.allowChanges ? "검증 후 데모 배포" : "코드 개선 선택 시 사용 가능"}</small></span>
        </label>
      </fieldset>

      {error && <p className="m-0 text-[#b91c1c] bg-[#f4f4f5] rounded-[6px] py-[11px] px-[13px] text-[13px] leading-[1.7]" role="alert">{error}</p>}
      <p className="m-0 text-[#52525b] text-[13px] leading-[1.7] empty:hidden" role="status" aria-live="polite">{status}</p>
      <div className="flex items-center justify-between gap-4 pt-4.5 border-t border-solid border-t-[#f4f4f5] max-[540px]:items-stretch max-[540px]:flex-col max-[540px]:gap-3">
        <p className="m-0 text-[#71717a] text-[12px] leading-[1.8]">설정은 이 브라우저에만 보관돼요.</p>
        <button className="inline-flex justify-center items-center gap-[15px] border-0 rounded-[7px] bg-[#2563eb] text-white text-[13px] font-medium py-[13px] px-4 whitespace-nowrap min-h-11 hover:bg-[#27272a] focus-visible:outline-[2px] focus-visible:outline-solid focus-visible:outline-[#2563eb] focus-visible:outline-offset-[4px] max-[540px]:w-full" type="submit">설정 저장</button>
      </div>
    </form>
  );
}
