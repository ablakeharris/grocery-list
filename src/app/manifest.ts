import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grocery Lists",
    short_name: "Groceries",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#c8161d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
