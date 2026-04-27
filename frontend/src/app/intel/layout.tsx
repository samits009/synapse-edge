import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intel // SynapseEdge",
  description: "Strategic intelligence synthesis dashboard for SynapseEdge mission control.",
};

export default function IntelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
