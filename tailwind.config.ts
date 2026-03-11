import type { Config } from "tailwindcss";

const LANDSCAPE_ASPECT_RATIO = "1001/1000";

export default {
  theme: {
    extend: {
      screens: {
        "dashboard-two-col": {
          raw: "(min-width: 900px), (max-aspect-ratio: 1/1)",
        },
        "dashboard-wide-two": {
          raw: `(min-width: 1200px) and (min-aspect-ratio: ${LANDSCAPE_ASPECT_RATIO})`,
        },
        "dashboard-wide-three": {
          raw: `(min-width: 1600px) and (min-aspect-ratio: ${LANDSCAPE_ASPECT_RATIO})`,
        },
        "dashboard-wide-four": {
          raw: `(min-width: 1800px) and (min-aspect-ratio: ${LANDSCAPE_ASPECT_RATIO})`,
        },
      },
    },
  },
} satisfies Config;
