import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bunker // SynapseEdge",
  description: "Secure vault and asset management for SynapseEdge mission control.",
};

export default function BunkerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
