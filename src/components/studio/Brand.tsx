import Link from "next/link";

export function Brand() {
  return <Link href="/" className="studio-brand" aria-label="Reppl home"><svg width="29" height="29" viewBox="0 0 29 29" fill="none" aria-hidden="true"><path d="M5 21V8h7a6 6 0 0 1 0 12H8M16 22l7-14M20 18h5" stroke="currentColor" strokeWidth="3" strokeLinecap="square" /></svg><span>reppl<span className="brand-period">.</span></span></Link>;
}
