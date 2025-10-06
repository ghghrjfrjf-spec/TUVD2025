// /.netlify/functions/guestbook
// Fetch Netlify Forms submissions for the "guestbook" form.
// - Uses NETLIFY_AUTH_TOKEN (Personal Access Token) from env
// - Optional: SITE_ID (to scope forms to a specific site). If absent, falls back to listing all forms.
// - Optional query: ?includeSpam=true to include spam-state submissions
export async function handler(event, context) {
  try {
    const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
    const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || ""; // optional

    if (!token) {
      return json(500, { error: "Missing NETLIFY_AUTH_TOKEN (or NETLIFY_TOKEN)" });
    }

    const qs = new URLSearchParams(event?.queryStringParameters || {});
    const includeSpam = (qs.get("includeSpam") === "true");

    // 1) Get forms (prefer scoping to site if SITE_ID is provided)
    const formsUrl = siteId
      ? `https://api.netlify.com/api/v1/sites/${siteId}/forms`
      : `https://api.netlify.com/api/v1/forms`;

    const formsRes = await fetch(formsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!formsRes.ok) {
      const errText = await formsRes.text();
      return json(formsRes.status, { error: "Failed to list forms", details: errText });
    }

    const forms = await formsRes.json();

    // 2) Find the 'guestbook' form (case-insensitive). If multiple, prefer same siteId if provided.
    const lower = (s) => (s || "").toLowerCase();
    let form = null;

    if (siteId) {
      form = forms.find(f => lower(f.name) === "guestbook" && f.site_id === siteId) 
          || forms.find(f => lower(f.name) === "guestbook");
    } else {
      form = forms.find(f => lower(f.name) === "guestbook");
    }

    if (!form) {
      // No form yet: return empty list (client can show "no messages")
      return json(200, [], { "cache-control": "no-store" });
    }

    // 3) Fetch submissions for the form (pull a generous page)
    const subsUrl = `https://api.netlify.com/api/v1/forms/${form.id}/submissions?per_page=200`;
    const subsRes = await fetch(subsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!subsRes.ok) {
      const errText = await subsRes.text();
      return json(subsRes.status, { error: "Failed to list submissions", details: errText });
    }

    const subs = await subsRes.json();

    // 4) Map + optionally filter out spam
    const usable = includeSpam ? subs : subs.filter(s => s.state !== "spam");

    const rows = usable.map(s => ({
      name:       s.data?.name    || "",
      message:    s.data?.message || "",
      from:       s.data?.from    || (s.data?.name || ""),
      created_at: s.created_at,
      state:      s.state, // "verified", "spam", etc. (might be useful for admin views)
    }));

    return json(200, rows, { "cache-control": "no-store" });

  } catch (err) {
    return json(500, { error: String(err) });
  }
}

// Helpers
function cors(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    ...extra,
  };
}
function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: cors(extraHeaders),
    body: JSON.stringify(data),
  };
}