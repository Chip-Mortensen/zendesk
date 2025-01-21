export function getPlainTextFromMarkdown(markdown: string, maxLength: number = 200): string {
  // Remove common markdown syntax
  const plainText = markdown
    // Remove headers
    .replace(/#{1,6}\s/g, '')
    // Remove bold/italic
    .replace(/[*_]{1,3}(.*?)[*_]{1,3}/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]+)\]\([^)]+\)/g, '')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove horizontal rules
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate if needed and add ellipsis
  return plainText.length > maxLength 
    ? `${plainText.slice(0, maxLength)}...` 
    : plainText;
} 