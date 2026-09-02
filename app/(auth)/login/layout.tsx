import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.auth.login.metaTitle };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
