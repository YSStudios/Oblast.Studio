import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseHero } from "@/components/case-study/CaseHero";
import { ContentBlocks } from "@/components/case-study/ContentBlocks";
import { ProjectMetadata } from "@/components/case-study/ProjectMetadata";
import { ProjectPagination } from "@/components/case-study/ProjectPagination";
import {
  getAdjacentProjects,
  getProject,
  getProjectNumber,
  getProjects,
} from "@/lib/projects";

// Case studies may block navigation until ready rather than stream a skeleton:
// the Phase 4 tile→hero overlay covers the wait, and a fallback flash would
// fight it. Every known slug is prerendered, so this costs nothing on direct loads.
export const instant = false;

// Known slugs are prerendered; unknown slugs fall through to notFound() below.
export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};

  const title = project.seo?.title ?? project.title;
  const description = project.seo?.description ?? project.summary;
  return {
    title,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    // Mock pages must never be indexed.
    robots: project.placeholder ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: project.hero.poster ?? project.hero.src, alt: project.hero.alt }],
    },
  };
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const { previous, next } = getAdjacentProjects(project);

  return (
    <article>
      <CaseHero project={project} number={getProjectNumber(project)} />
      <ProjectMetadata project={project} />
      <ContentBlocks blocks={project.blocks} />
      <ProjectPagination previous={previous} next={next} />
    </article>
  );
}
