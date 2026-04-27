import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login // SynapseEdge",
  description: "Authenticate to the SynapseEdge tactical mission control center.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
