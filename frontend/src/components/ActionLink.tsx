import Link from "next/link";

export interface Action {
  href: string;
  label: string;
  external?: boolean;
}

export function ActionLink({ action, className, ariaLabel, children }: { action: Action; className?: string; ariaLabel?: string; children: React.ReactNode }) {
  return action.external ? (
    <a className={className} href={action.href} aria-label={ariaLabel}>
      {children}
    </a>
  ) : (
    <Link className={className} href={action.href} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
