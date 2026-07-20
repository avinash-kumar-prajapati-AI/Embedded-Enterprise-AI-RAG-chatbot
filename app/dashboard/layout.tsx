import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav className="border-b-2 border-border-strong bg-card px-6 py-3">
        <div className="mx-auto flex max-w-3xl gap-4 text-sm font-medium">
          <Link href="/dashboard/settings" className="hover:underline">
            Settings
          </Link>
          <Link href="/dashboard/documents" className="hover:underline">
            Documents
          </Link>
          <Link href="/dashboard/models" className="hover:underline">
            Models
          </Link>
          <Link href="/dashboard/chat-test" className="hover:underline">
            Chat test
          </Link>
          <Link href="/" target="_blank" className="ml-auto hover:underline">
            View homepage ↗
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
