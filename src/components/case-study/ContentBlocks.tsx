import Image from "next/image";
import type { ContentBlock, Media } from "@/lib/content-schema";
import styles from "./CaseStudy.module.scss";

function MediaFigure({ media, sizes }: { media: Media; sizes: string }) {
  return (
    <figure className={styles.figure}>
      <div className={styles.frame} style={{ aspectRatio: `${media.width} / ${media.height}` }}>
        {media.kind === "video" ? (
          <video
            src={media.src}
            poster={media.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-label={media.alt || undefined}
          />
        ) : (
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes={sizes}
            style={{ objectFit: "cover", objectPosition: media.objectPosition }}
          />
        )}
      </div>
      {media.caption && <figcaption className="ui-muted">{media.caption}</figcaption>}
    </figure>
  );
}

// Typed blocks only — never arbitrary HTML.
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className={styles.blocks}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "full":
            return <MediaFigure key={i} media={block.media} sizes="100vw" />;
          case "split":
            return (
              <div key={i} className={styles.split}>
                <MediaFigure media={block.left} sizes="(max-width: 720px) 100vw, 50vw" />
                <MediaFigure media={block.right} sizes="(max-width: 720px) 100vw, 50vw" />
              </div>
            );
          case "text":
            return (
              <section key={i} className={`${styles.text} prose`}>
                {block.heading && <h2 className="h2">{block.heading}</h2>}
                <p>{block.body}</p>
              </section>
            );
          case "mediaText":
            return (
              <div key={i} className={styles.mediaText} data-side={block.side}>
                <MediaFigure media={block.media} sizes="(max-width: 720px) 100vw, 50vw" />
                <div className="prose">
                  <p>{block.body}</p>
                </div>
              </div>
            );
        }
      })}
    </div>
  );
}
