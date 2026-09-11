/* A corner badge is data the caller hands to CornerBadges.astro: a key
   (which becomes the chip's badge-<key> class, the styling hook), the
   label, and a glyph from the icon registry. No lookup table in the
   package (owner call 2026-09-10): a site's view-model lists the
   badges a post carries, in the order it wants them, and can invent one
   without a package release. The two house conventions ship as
   constants so every site spells them the same way. */
import type { IconName } from "./icons";

export interface Badge {
  key: string;
  label: string;
  icon: IconName;
}

/* The pixels were generated (a hero, a content image). */
export const GENAI_BADGE: Badge = {
  key: "genai",
  label: "AI Art",
  icon: "sparkles",
};

/* The post carries an interactive demo. */
export const DEMO_BADGE: Badge = {
  key: "demo",
  label: "Demo",
  icon: "play",
};
