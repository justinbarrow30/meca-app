export interface OGMetadata {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export async function fetchOGMetadata(url: string): Promise<OGMetadata> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MecaBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return {};

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return {};

    const html = await res.text();
    const head = html.substring(0, 20000);

    const ogTitle = extractMeta(head, "og:title") || extractMeta(head, "twitter:title") || extractTitle(head);
    const ogDescription = extractMeta(head, "og:description") || extractMeta(head, "twitter:description") || extractMeta(head, "description");
    const ogImage = extractMeta(head, "og:image") || extractMeta(head, "twitter:image");

    let resolvedImage = ogImage;
    if (resolvedImage && !resolvedImage.startsWith("http")) {
      try {
        resolvedImage = new URL(resolvedImage, url).toString();
      } catch {}
    }

    return {
      ogTitle: ogTitle?.slice(0, 200),
      ogDescription: ogDescription?.slice(0, 500),
      ogImage: resolvedImage?.slice(0, 1000),
    };
  } catch {
    return {};
  }
}

function extractMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`, "i"),
    new RegExp(`<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escapeRegex(property)}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHTMLEntities(match[1].trim());
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHTMLEntities(match[1].trim()) : undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
