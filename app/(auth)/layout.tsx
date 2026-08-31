// AuthShell (the login/signup pages' own shared component) manages its
// own full-height layout now -- not the centered-card look .page-center
// still gives onboarding, which this route group no longer needs.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
