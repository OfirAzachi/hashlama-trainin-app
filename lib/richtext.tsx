/**
 * A light markdown subset used for post/photo captions instead of a raw HTML
 * editor: **bold**, "- " for a bullet list, "N. " for a numbered list.
 * Simple enough to type by hand, but SocialFeed's toolbar means nobody has
 * to know the syntax exists. Shared between the feed and the photo gallery
 * lightbox so a formatted caption never shows raw markup in either place.
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** Renders the same **bold** / "- " / "N. " subset as styled bold text and real lists. */
export function renderFormattedText(text: string): ReactNode {
  const renderInline = (line: string, keyBase: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const pattern = /\*\*([^*]+)\*\*/g;
    let last = 0;
    let index = 0;
    for (const match of line.matchAll(pattern)) {
      const at = match.index ?? 0;
      if (at > last) parts.push(line.slice(last, at));
      parts.push(<strong key={`${keyBase}-${index++}`}>{match[1]}</strong>);
      last = at + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  };

  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const isBullet = /^-\s/.test(lines[i]);
    const isNumbered = /^\d+\.\s/.test(lines[i]);

    if (isBullet || isNumbered) {
      const pattern = isBullet ? /^-\s/ : /^\d+\.\s/;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].replace(pattern, ''));
        i++;
      }
      const ListTag = isBullet ? 'ul' : 'ol';
      blocks.push(
        <ListTag key={key} className={cn('my-1 space-y-0.5 ps-5', isBullet ? 'list-disc' : 'list-decimal')}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ListTag>,
      );
      key++;
      continue;
    }

    blocks.push(<span key={key}>{renderInline(lines[i], `${key}`)}</span>);
    if (i < lines.length - 1) blocks.push(<br key={`br-${key}`} />);
    key++;
    i++;
  }
  return blocks;
}
