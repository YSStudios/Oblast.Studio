import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DatamoshLab } from "./DatamoshLab";

export const metadata: Metadata = { title: "Datamosh lab", robots: { index: false, follow: false } };
export default function DatamoshLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DatamoshLab />;
}
