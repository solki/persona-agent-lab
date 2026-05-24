import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shared/AppShell";

export const metadata: Metadata = {
  title: "Agent Swarm Lab",
  description: "Configure isolated AI agents, tools, context, memory, and workflows."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
