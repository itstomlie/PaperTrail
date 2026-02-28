import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url?.trim()) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const res = await fetch(url.trim(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PaperTrail/1.0; +https://papertrail.local)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${res.status}` },
        { status: 400 },
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const getMeta = (name: string) =>
      $(`meta[property="${name}"]`).attr("content") ||
      $(`meta[name="${name}"]`).attr("content") ||
      null;

    const title =
      getMeta("og:title") || $("title").first().text().trim() || null;
    const description =
      getMeta("og:description") || getMeta("description") || null;
    const siteName = getMeta("og:site_name") || null;
    const image = getMeta("og:image") || null;
    const type = getMeta("og:type") || null;
    const publishedDate =
      getMeta("article:published_time") || getMeta("datePublished") || null;

    // Favicon
    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      null;
    if (favicon && !favicon.startsWith("http")) {
      const base = new URL(url.trim());
      favicon = new URL(favicon, base.origin).href;
    }

    // Resolve relative image URL
    let resolvedImage = image;
    if (image && !image.startsWith("http")) {
      const base = new URL(url.trim());
      resolvedImage = new URL(image, base.origin).href;
    }

    return NextResponse.json({
      title,
      description,
      siteName,
      image: resolvedImage,
      favicon,
      type,
      publishedDate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
