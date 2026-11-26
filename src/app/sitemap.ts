import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/projects";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/work", "/about", "/contact"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: now,
  }));

  // Mock projects are never listed.
  const projects = getProjects()
    .filter((p) => !p.placeholder)
    .map((p) => ({ url: `${site.url}/work/${p.slug}`, lastModified: now }));

  return [...routes, ...projects];
}
