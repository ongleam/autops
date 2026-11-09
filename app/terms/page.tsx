import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "데모 이용약관 — Autops" };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", lineHeight: 1.85 }}>
      <Link href="/">Autops로 돌아가기</Link>
      <h1>Autops 데모 이용약관</h1>
      <p>해커톤 데모 · 업데이트: 2026년 11월 9일</p>
      <h2>1. 제공하는 기능</h2>
      <p>Autops는 GitHub 저장소와 Vercel·Supabase 프로젝트를 연결하고, 허용된 범위의 프로젝트 정보와 배포 상태를 조회하는 데모입니다. 연결 자체로 코드 변경, 배포 실행, SQL 실행 또는 데이터베이스 행 조회를 시작하지 않습니다.</p>
      <h2>2. 연결과 권한</h2>
      <p>본인이 접근 권한을 가진 계정과 프로젝트만 연결해주세요. 각 제공자의 승인 화면에서 권한을 확인할 수 있으며, Autops는 승인된 권한 안에서 정보를 요청합니다. 서비스 제공자의 이용약관과 접근 정책도 적용됩니다.</p>
      <h2>3. 데모의 한계</h2>
      <p>이 데모에는 서비스 수준 협약(SLA)이 없습니다. 기능이나 제공 기간은 변경될 수 있고, 표시된 상태는 조회 시점과 제공자 응답에 따라 달라집니다. 운영상의 결정을 내리기 전 해당 제공자의 대시보드에서 정보를 다시 확인해주세요. 현재 화면의 안내와 조회 결과가 실제 진단·수정·배포의 완료를 의미하지는 않습니다.</p>
      <h2>4. 이용 종료</h2>
      <p>온보딩 화면에서 브라우저의 서비스 연결을 해제할 수 있습니다. 이 작업은 제공자에 등록된 앱 설치나 권한을 철회하지 않습니다. 완전히 철회하려면 GitHub, Vercel 또는 Supabase의 계정·조직 설정에서 해당 앱 권한도 제거해주세요.</p>
      <h2>5. 운영 및 문의</h2>
      <p>운영: ongleam · <a href="mailto:dev@ongleam.com">dev@ongleam.com</a></p>
      <p>연결 정보의 처리는 <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다.</p>
      <hr />
      <section lang="en" aria-label="English summary">
        <h2>English summary</h2>
        <p>Autops is a hackathon demo for connecting accounts and reading authorized project and deployment information. Connecting does not execute code changes, deployments, SQL, or database row queries. Connect only accounts and projects you are authorized to access. Provider terms also apply.</p>
        <p>No SLA is offered for this demo. Features and availability may change; verify operational information with the provider. Disconnecting clears this browser’s connection; revoke the app separately in the provider’s settings. Operator: ongleam. Contact: <a href="mailto:dev@ongleam.com">dev@ongleam.com</a>.</p>
      </section>
    </main>
  );
}
