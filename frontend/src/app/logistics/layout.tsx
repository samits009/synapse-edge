import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logistics // SynapseEdge",
  description: "Real-time swarm logistics and tactical dispatch for SynapseEdge mission control.",
};

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
