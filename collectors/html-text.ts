import { Parser } from "htmlparser2";

// WordPress REST descriptions contain rendered HTML, including registration
// forms and scripts. Extract text only; never execute or return that markup.
export function renderedHtmlToText(html: string): string {
  const chunks: string[] = [];
  const hidden: boolean[] = [];
  const blockTags = new Set(["p", "div", "section", "br", "li", "h1", "h2", "h3", "h4", "tr"]);
  const ignoredTags = new Set(["script", "style", "form", "noscript", "template"]);
  const parser = new Parser({
    onopentag(name, attributes) {
      const ignore = hidden.at(-1) === true || ignoredTags.has(name) ||
        (attributes.class ?? "").split(/\s+/).includes("gform_wrapper");
      hidden.push(ignore);
      if (!ignore && blockTags.has(name)) chunks.push(" ");
    },
    ontext(text) {
      if (!hidden.at(-1)) chunks.push(text);
    },
    onclosetag(name) {
      const ignore = hidden.pop();
      if (!ignore && blockTags.has(name)) chunks.push(" ");
    },
  }, { decodeEntities: true });
  parser.end(html);
  return chunks.join("").replace(/\s+/g, " ").trim();
}
