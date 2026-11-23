import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ROAM — Vehicle Rental Workspace",
    short_name: "ROAM",
    description: "Vehicle rental bookings and workspace updates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fb",
    theme_color: "#14233b",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
