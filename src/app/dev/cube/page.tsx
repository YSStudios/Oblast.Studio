import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CubeLab } from "./CubeLab";

export const metadata: Metadata = {
  title: "Cube lab",
  robots: { index: false, follow: false },
};

// Development-only tuning route (spec Phase 1). 404s in production builds.
export default function CubeLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CubeLab />;
}
