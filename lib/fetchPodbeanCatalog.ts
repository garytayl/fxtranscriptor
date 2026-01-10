/**
 * Fetches and parses Podbean RSS feed to get all episodes
 */

export interface PodbeanEpisode {
  title: string;
  description: string;
  date: Date;
  url: string;
  audioUrl: string;
  guid: string; // Unique identifier
}

export async function fetchPodbeanCatalog(
  rssUrl: string = 'https://feed.podbean.com/fxtalk/feed.xml'
): Promise<PodbeanEpisode[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TranscriptBot/1.0)',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch Podbean RSS: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const episodes: PodbeanEpisode[] = [];

    // Parse RSS XML
    // Extract all <item> tags
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = Array.from(xml.matchAll(itemPattern));

    for (const itemMatch of items) {
      const itemContent = itemMatch[1];

      // Extract title
      const titleMatch = itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
                        itemContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract description
      const descMatch = itemContent.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                       itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract pubDate
      const dateMatch = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i);
      const pubDate = dateMatch ? new Date(dateMatch[1].trim()) : new Date();

      // Extract link (episode URL)
      const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/i);
      const url = linkMatch ? linkMatch[1].trim() : '';

      // Extract enclosure (audio URL)
      const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
      const audioUrl = enclosureMatch ? enclosureMatch[1] : '';

      // Extract GUID (unique identifier)
      const guidMatch = itemContent.match(/<guid[^>]*>(.*?)<\/guid>/i);
      const guid = guidMatch ? guidMatch[1].trim().replace(/^<\!\[CDATA\[|\]\]>$/g, '') : url || '';

      if (title && url) {
        episodes.push({
          title,
          description,
          date: pubDate,
          url,
          audioUrl,
          guid: guid || url,
        });
      }
    }

    return episodes;
  } catch (error) {
    console.error('Error fetching Podbean catalog:', error);
    throw error;
  }
}
