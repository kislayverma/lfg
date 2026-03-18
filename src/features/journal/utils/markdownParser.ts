/**
 * Lightweight markdown tokenizer for rendering.
 *
 * Supports: headings, bold, italic, strikethrough, inline code,
 * fenced code blocks, bullet/numbered lists, checklists,
 * blockquotes, horizontal rules, and [[wiki links]].
 *
 * No external dependencies. Designed for fast rendering on mobile.
 */

export type TokenType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'codeBlock'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'blockquote'
  | 'hr'
  | 'wikiLink'
  | 'text'
  | 'newline';

export interface Token {
  type: TokenType;
  content: string;
  checked?: boolean; // for checklist items
  children?: Token[];
}

/**
 * Parses a line of markdown into block-level tokens.
 */
function parseBlockLine(line: string): Token {
  // Horizontal rule
  if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
    return {type: 'hr', content: ''};
  }

  // Headings
  if (line.startsWith('### ')) {
    return {type: 'h3', content: line.slice(4), children: parseInline(line.slice(4))};
  }
  if (line.startsWith('## ')) {
    return {type: 'h2', content: line.slice(3), children: parseInline(line.slice(3))};
  }
  if (line.startsWith('# ')) {
    return {type: 'h1', content: line.slice(2), children: parseInline(line.slice(2))};
  }

  // Checklist
  const checkMatch = line.match(/^- \[([ xX])\] (.*)$/);
  if (checkMatch) {
    return {
      type: 'checklist',
      content: checkMatch[2],
      checked: checkMatch[1] !== ' ',
      children: parseInline(checkMatch[2]),
    };
  }

  // Bullet list
  if (/^[-*+] /.test(line)) {
    const content = line.slice(2);
    return {type: 'bullet', content, children: parseInline(content)};
  }

  // Numbered list
  const numMatch = line.match(/^(\d+)\. (.*)$/);
  if (numMatch) {
    return {type: 'numbered', content: numMatch[2], children: parseInline(numMatch[2])};
  }

  // Blockquote
  if (line.startsWith('> ')) {
    const content = line.slice(2);
    return {type: 'blockquote', content, children: parseInline(content)};
  }

  // Regular text
  return {type: 'text', content: line, children: parseInline(line)};
}

/**
 * Parses inline markdown: bold, italic, strikethrough, code, wiki links.
 */
export function parseInline(text: string): Token[] {
  const tokens: Token[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Inline code (must come before bold/italic to avoid conflicts with backticks)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push({type: 'code', content: codeMatch[1]});
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Wiki link
    const wikiMatch = remaining.match(/^\[\[([^\]]+)\]\]/);
    if (wikiMatch) {
      tokens.push({type: 'wikiLink', content: wikiMatch[1].trim()});
      remaining = remaining.slice(wikiMatch[0].length);
      continue;
    }

    // Bold (** or __)
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      tokens.push({type: 'bold', content: boldMatch[1]});
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const boldMatch2 = remaining.match(/^__(.+?)__/);
    if (boldMatch2) {
      tokens.push({type: 'bold', content: boldMatch2[1]});
      remaining = remaining.slice(boldMatch2[0].length);
      continue;
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      tokens.push({type: 'strikethrough', content: strikeMatch[1]});
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Italic (* or _)
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      tokens.push({type: 'italic', content: italicMatch[1]});
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    const italicMatch2 = remaining.match(/^_(.+?)_/);
    if (italicMatch2) {
      tokens.push({type: 'italic', content: italicMatch2[1]});
      remaining = remaining.slice(italicMatch2[0].length);
      continue;
    }

    // Plain text — consume until next special character
    const nextSpecial = remaining.search(/[`*_~\[]/);
    if (nextSpecial === -1) {
      tokens.push({type: 'text', content: remaining});
      break;
    } else if (nextSpecial === 0) {
      // Special char that didn't match a pattern — consume it as text
      tokens.push({type: 'text', content: remaining[0]});
      remaining = remaining.slice(1);
    } else {
      tokens.push({type: 'text', content: remaining.slice(0, nextSpecial)});
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}

/**
 * Parses full markdown text into an array of block tokens.
 * Handles fenced code blocks as a special multi-line case.
 */
export function parseMarkdown(text: string): Token[] {
  const lines = text.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({type: 'codeBlock', content: codeLines.join('\n')});
      i++; // skip closing ```
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      tokens.push({type: 'newline', content: ''});
      i++;
      continue;
    }

    tokens.push(parseBlockLine(line));
    i++;
  }

  return tokens;
}
