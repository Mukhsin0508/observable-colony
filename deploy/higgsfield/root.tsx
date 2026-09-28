import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import metadata from "../app-meta.json";
import build from "../colony-build.json";
import { reportHiggsfieldError } from "../lib/higgsfield-error-reporting";

declare const __HF_DESIGN_INSPECTOR__: boolean;
const origin = "https://observable-colony.higgsfield.app";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: metadata.og_title },
      { name: "description", content: metadata.og_description },
      { name: "theme-color", content: "#172b30" },
      { property: "og:title", content: metadata.og_title },
      { property: "og:description", content: metadata.og_description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: origin },
      { property: "og:image", content: metadata.og_image_url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: metadata.og_image_url },
    ],
    links: [
      { rel: "canonical", href: origin + "/" },
      { rel: "icon", href: metadata.favicon_url, type: "image/svg+xml" },
      { rel: "stylesheet", href: build.stylesheet },
    ],
  }),
  shellComponent: Shell,
  component: Root,
  notFoundComponent: () => <main style={{ padding: "3rem", color: "#f0ead8" }}><h1>Page not found</h1><a href="/">Return to the colony</a></main>,
  errorComponent: () => <main style={{ padding: "3rem", color: "#f0ead8" }}><h1>The colony could not load.</h1><a href="/">Reload the colony</a></main>,
});

function Shell({ children }: { children: ReactNode }) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function Root() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    if (!__HF_DESIGN_INSPECTOR__) return;
    void import("../module/design-inspector/runtime")
      .then(({ installHiggsfieldDesignInspector }) => installHiggsfieldDesignInspector())
      .catch(error => reportHiggsfieldError(error instanceof Error ? error : new Error("Inspector could not load"), { boundary: "design_inspector" }));
  }, []);
  return <QueryClientProvider client={queryClient}><Outlet /></QueryClientProvider>;
}
