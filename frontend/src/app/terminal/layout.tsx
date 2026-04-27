import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminal // SynapseEdge",
  description: "System kernel terminal interface for SynapseEdge mission control.",
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
