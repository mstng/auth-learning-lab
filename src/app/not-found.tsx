import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <h1>このページはまだありません。</h1>
      <p>このバージョンはPHASE 1〜6に対応しています。</p>
      <Link className="button primary" href="/">
        ロードマップへ
      </Link>
    </div>
  );
}
