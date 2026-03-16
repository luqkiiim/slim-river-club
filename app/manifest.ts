import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Slim River Club",
    short_name: "Slim River Club",
    description: "Mobile-friendly office weight loss tracker with per-participant monthly targets and penalty rules.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f2e8",
    theme_color: "#f8f2e8",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
