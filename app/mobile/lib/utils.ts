/**
 * Formats a date string (yyyy-mm-dd) according to the provided format
 * Support formats: dd-mm-yyyy, mm-dd-yyyy, dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd.mm.yyyy, etc.
 */
export function formatDate(dateStr: string | Date | null | undefined, format: string = "yyyy-mm-dd"): string {
    if (!dateStr) return "";

    let date: Date;
    if (typeof dateStr === "string") {
        // Assume yyyy-mm-dd from Frappe
        const [y, m, d] = dateStr.split("-").map(Number);
        date = new Date(y, m - 1, d);
    } else {
        date = dateStr;
    }

    if (isNaN(date.getTime())) return String(dateStr);

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    const yy = yyyy.slice(-2);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mmm = months[date.getMonth()];

    let result = format.toLowerCase();
    result = result.replace("yyyy", yyyy);
    result = result.replace("aaaa", yyyy);
    result = result.replace("yy", yy);
    result = result.replace("aa", yy);
    result = result.replace("mmm", mmm);
    result = result.replace("mm", mm);
    result = result.replace("dd", dd);

    return result;
}

/**
 * Formats a currency amount with two decimal places
 */
export function fmtAmount(amount: number): string {
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
/**
 * Strips HTML tags from a string
 */
export function stripHtml(html: string): string {
    if (!html) return "";
    return html
        .replace(/<[^>]*>?/gm, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/**
 * Escapes plain text so it can be injected safely into HTML text nodes.
 */
export function escapeHtml(value: string): string {
    return String(value || "").replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Serializes data for safe interpolation inside an inline <script> block.
 * Prevents breaking out of script context via </script> and similar payloads.
 */
export function safeJsonForInlineScript(value: unknown): string {
    return JSON.stringify(value ?? null)
        .replace(/</g, "\\u003C")
        .replace(/>/g, "\\u003E")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

/**
 * Best-effort HTML sanitizer for rich text coming from backend notifications.
 * Removes executable tags, event handlers and javascript:/data:text/html URLs.
 */
export function sanitizeHtmlContent(html: string): string {
    if (!html) return "";

    let sanitized = String(html);

    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, "");

    sanitized = sanitized.replace(
        /<(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>[\s\S]*?<\/\1>/gi,
        ""
    );
    sanitized = sanitized.replace(
        /<(script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*\/?>/gi,
        ""
    );

    sanitized = sanitized.replace(/\son[a-zA-Z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gsi, "");

    sanitized = sanitized.replace(
        /\s(href|src|xlink:href|action|formaction)\s*=\s*(['"])\s*(javascript:|data:text\/html)[^'"]*\2/gi,
        ' $1="#"'
    );
    sanitized = sanitized.replace(
        /\s(href|src|xlink:href|action|formaction)\s*=\s*(javascript:|data:text\/html)[^\s>]*/gi,
        ' $1="#"'
    );

    return sanitized.trim();
}
