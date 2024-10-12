import DOMPurify from "dompurify";

export { markdown };

function markdown(text?: string): string {
    text = text ?? "";
    return DOMPurify.sanitize(
        text
            .replace(/\n/g, "<br>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\b(item_\w+)\b/g, '<span class="item-name">$1</span>'),
        { USE_PROFILES: { html: true } },
    );
}
