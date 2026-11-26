import Link from "next/link";
import { PageIntro } from "@/components/shell/PageIntro";

export default function NotFound() {
  return (
    <PageIntro eyebrow="404" title="Not found">
      <p>
        This page doesn&apos;t exist.{" "}
        <Link href="/work" style={{ textDecoration: "underline" }}>
          Browse the work
        </Link>
        .
      </p>
    </PageIntro>
  );
}
