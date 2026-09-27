// Turns what the admin types into email HTML, so writing an email works like
// writing a text message: a blank line starts a new paragraph, a single line
// break stays a line break. Inline HTML (<b>, <a href>, …) still works, and a
// chunk that is already a block of HTML (<p>, <h2>, <ul>, <table>, …) is left
// exactly as written, so older HTML-style emails still come out the same.
//
// Used for both the on-page preview and what gets sent, so they can't differ.
// Styles are inline because many email clients ignore <style> blocks.
const BLOCK_START = /^<(p|div|h[1-6]|ul|ol|li|table|blockquote|hr|img|pre|center)\b/i;
const P_STYLE = 'margin:0 0 16px; line-height:1.5;';

export function textToEmailHtml(text) {
  if (!text) return '';
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)                 // blank line(s) = paragraph break
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => (BLOCK_START.test(chunk)
      ? chunk
      : `<p style="${P_STYLE}">${chunk.replace(/\n/g, '<br>')}</p>`))
    .join('\n');
}
