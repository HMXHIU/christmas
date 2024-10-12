import DOMPurify from "dompurify";

export { markdown };

function markdown(text?: string): string {
    return DOMPurify.sanitize(
        // post sanitize after text to html
        DOMPurify.sanitize(text ?? "", { ALLOWED_TAGS: [] }) // pre sanitize the text, dont allow any tags
            .replace(/\n/g, "<br>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'),
        { USE_PROFILES: { html: true } },
    );
}
