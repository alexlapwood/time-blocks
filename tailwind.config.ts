import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      screens: {
        "dashboard-two-col": "900px",
        "dashboard-wide-two": "1200px",
        "dashboard-wide-three": "1600px",
        "dashboard-wide-four": "1800px",
      },
    },
  },
} satisfies Config;
