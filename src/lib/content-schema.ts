import { z } from "zod";

// Column counts per breakpoint — must match src/styles/_grid.scss.
export const GRID_COLUMNS = { desktop: 6, tablet: 3, mobile: 2 } as const;

const nonEmpty = z.string().trim().min(1);

export const mediaSchema = z.object({
  kind: z.enum(["image", "video"]),
  src: nonEmpty,
  poster: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  // Empty string is allowed only for purely decorative media; informative media needs alt.
  alt: z.string(),
  objectPosition: z.string().optional(),
  caption: z.string().optional(),
});

const spanFor = (cols: number) =>
  z.object({
    x: z.number().int().min(1).max(cols),
    y: z.number().int().min(1).max(6),
  });

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("full"), media: mediaSchema }),
  z.object({ type: z.literal("split"), left: mediaSchema, right: mediaSchema }),
  z.object({ type: z.literal("text"), heading: z.string().optional(), body: nonEmpty }),
  z.object({
    type: z.literal("mediaText"),
    media: mediaSchema,
    body: nonEmpty,
    side: z.enum(["left", "right"]),
  }),
]);

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  title: nonEmpty,
  category: nonEmpty,
  disciplines: z.array(nonEmpty).min(1),
  year: z.number().int().min(2000).max(2100),
  order: z.number().int().nonnegative(),
  featured: z.boolean(),
  // Clearly marks mock entries for layout testing — must be gone before launch.
  placeholder: z.boolean().default(false),
  thumbnail: mediaSchema,
  hero: mediaSchema,
  spans: z.object({
    desktop: spanFor(GRID_COLUMNS.desktop),
    tablet: spanFor(GRID_COLUMNS.tablet),
    mobile: spanFor(GRID_COLUMNS.mobile),
  }),
  client: z.string().optional(),
  role: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  stack: z.array(z.string()).optional(),
  summary: nonEmpty,
  description: nonEmpty,
  blocks: z.array(contentBlockSchema),
  seo: z.object({ title: nonEmpty, description: nonEmpty }).optional(),
});

export type Media = z.infer<typeof mediaSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
