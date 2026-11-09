import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 — Autops" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 leading-relaxed">
      <Link href="/">Autops로 돌아가기</Link>
      <h1 className="mt-6 text-3xl font-semibold">Autops 데모 개인정보처리방침</h1>
      <p className="mt-3">해커톤 데모 · 업데이트: 2026년 11월 9일</p>
      <h2 className="mt-8 text-xl font-semibold">1. 처리하는 정보와 목적</h2>
      <p className="mt-3">계정 연결과 권한 확인을 위해 GitHub 계정 ID·사용자 이름, 선택한 저장소 ID·이름·브랜치, 선택한 Vercel·Supabase 프로젝트 ID와 OAuth 인증 토큰을 처리합니다. 조회 시에는 프로젝트 이름, 프레임워크, 리전, 상태 및 최근 배포 상태 등 화면에 필요한 정보를 각 제공자에게 요청합니다.</p>
      <p className="mt-3">현재 읽기 전용 연결 기능은 데이터베이스 행, SQL 실행, 프로젝트 API 키 또는 환경 변수 조회를 제공하지 않습니다. 비밀번호나 개인 액세스 토큰을 화면에 직접 입력할 필요가 없습니다.</p>
      <h2 className="mt-8 text-xl font-semibold">2. 저장과 보관 기간</h2>
      <p className="mt-3">연결 정보는 AES-256-GCM으로 암호화한 HttpOnly 쿠키에 보관하며, 운영 환경에서는 Secure 속성도 적용합니다. 쿠키는 요청 처리 시 Autops 서버에 전달됩니다. 연결 세션은 토큰 만료와 최대 8시간 중 짧은 기간 동안 유지하고, 만료 후에는 다시 인증합니다.</p>
      <p className="mt-3">현재 연결 정보를 별도의 Autops 데이터베이스에 저장하지 않으며, 공급자의 refresh token도 저장하지 않습니다. 이 안내는 현재 데모의 연결 기능을 기준으로 합니다.</p>
      <h2 className="mt-8 text-xl font-semibold">3. 외부 서비스</h2>
      <p className="mt-3">Autops는 Vercel에서 호스팅되며, 사용자가 연결한 GitHub·Vercel·Supabase API와 통신합니다. 각 제공자는 승인 및 API 요청을 자체 정책에 따라 처리합니다. 호스팅 및 연동 제공자의 기본 보안·접속 로그가 생성될 수 있습니다. Autops 데모는 개인정보 판매나 광고 목적의 분석 쿠키를 추가하지 않습니다.</p>
      <h2 className="mt-8 text-xl font-semibold">4. 연결 해제와 권한 철회</h2>
      <p className="mt-3">온보딩 화면의 연결 해제 또는 브라우저 쿠키 삭제로 이 브라우저에 보관된 연결을 제거할 수 있습니다. 공급자 측 앱 권한과 설치는 별도로 유지되므로, 완전한 철회는 각 서비스의 계정·조직 설정에서 진행해주세요. 문의 시 비밀번호, 토큰 또는 비밀키를 보내지 마세요.</p>
      <h2 className="mt-8 text-xl font-semibold">5. 문의</h2>
      <p className="mt-3">운영: ongleam · <a href="mailto:dev@ongleam.com">dev@ongleam.com</a></p>
      <p className="mt-3"><Link href="/terms">데모 이용약관</Link></p>
      <hr className="my-8" />
      <section lang="en" aria-label="English summary">
        <h2 className="mt-8 text-xl font-semibold">English summary</h2>
        <p className="mt-3">Autops processes GitHub identity, selected repository and cloud project identifiers, OAuth tokens, and project/deployment information to provide authorized read-only connections. Connection data is stored in encrypted HttpOnly cookies, sent to the server for requests, and expires after the shorter of token expiry or eight hours. Production cookies use Secure. This demo does not store connection data in a separate Autops database or retain provider refresh tokens.</p>
        <p className="mt-3">Autops is hosted on Vercel and communicates with GitHub, Vercel, and Supabase. Provider security/access logs may be generated under their own policies. The demo does not sell personal data or add advertising analytics cookies. Disconnect or clear cookies to remove the browser connection, and revoke provider access separately. Contact: <a href="mailto:dev@ongleam.com">dev@ongleam.com</a>.</p>
      </section>
    </main>
  );
}
