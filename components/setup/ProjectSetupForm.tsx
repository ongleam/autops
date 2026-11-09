"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEMO_PROJECT, type ProjectSettings } from "./types";
import styles from "./ProjectSetupForm.module.css";

const STORAGE_KEY = "compiled-project-settings";

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
};

export default function ProjectSetupForm({ settings, onChange }: Props) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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
      setStatus("이 브라우저에 저장했어요. 다음으로 MCP 연결 안내를 확인해주세요.");
    } catch {
      setError("브라우저에 저장하지 못했어요. 저장소 접근을 허용하거나 다른 브라우저를 사용해주세요.");
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={styles.field}>
        <label htmlFor="project-name">프로젝트 이름 <span className={styles.required}>필수</span></label>
        <input id="project-name" name="projectName" value={settings.name} required maxLength={80}
          placeholder="예: 나의 첫 서비스" autoComplete="off"
          onChange={(event) => update({ ...settings, name: event.target.value })} />
      </div>

      <div className={styles.field}>
        <label htmlFor="service-url">서비스 주소 <span className={styles.optional}>선택</span></label>
        <input id="service-url" name="serviceUrl" type="url" value={settings.serviceUrl}
          maxLength={2048} placeholder="https://my-service.com" autoComplete="url"
          aria-describedby="service-url-help"
          onChange={(event) => update({ ...settings, serviceUrl: event.target.value })} />
        <p id="service-url-help" className={styles.help}>아직 공개하지 않았다면 비워두세요. 비밀번호나 토큰이 포함된 주소는 입력하지 마세요.</p>
      </div>

      <div className={styles.repository}>
        <div className={styles.repoHeader}><span aria-hidden="true">⑂</span><strong>데모 GitHub 저장소</strong><span className={styles.readonly}>고정 대상</span></div>
        <a href={DEMO_PROJECT.repository} target="_blank" rel="noreferrer">ongleam / compiled-ex-project <span aria-hidden="true">↗</span></a>
        <div className={styles.repoMeta}><code>{DEMO_PROJECT.branch}</code><span>저장소 지정 · GitHub 계정 연결은 별도 진행</span></div>
      </div>

      <fieldset className={styles.permissions}>
        <legend>AI에게 맡기고 싶은 작업</legend>
        <p className={styles.help}>희망 범위를 프롬프트에 반영해요. 실제 권한은 연결한 도구에서 따로 설정해야 해요.</p>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={settings.allowChanges}
            onChange={(event) => update({ ...settings, allowChanges: event.target.checked, allowDeployment: event.target.checked && settings.allowDeployment })} />
          <span><strong>코드 개선</strong><small>진단 결과를 바탕으로 코드를 수정해요.</small></span>
        </label>
        <label className={`${styles.checkRow} ${!settings.allowChanges ? styles.disabled : ""}`}>
          <input type="checkbox" checked={settings.allowDeployment} disabled={!settings.allowChanges}
            onChange={(event) => update({ ...settings, allowDeployment: event.target.checked })} />
          <span><strong>데모 환경 배포</strong><small>{settings.allowChanges ? "검증한 변경을 데모 환경에 배포해요." : "코드 개선을 선택하면 설정할 수 있어요."}</small></span>
        </label>
      </fieldset>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
      <div className={styles.saveRow}>
        <p className={styles.help}>설정은 이 브라우저에만 보관돼요.</p>
        <button className={styles.saveButton} type="submit">이 브라우저에 저장 <span aria-hidden="true">→</span></button>
      </div>
    </form>
  );
}
