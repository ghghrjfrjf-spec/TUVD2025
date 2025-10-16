// 2025/netlify/functions/guestbook-list.js
export default async (req, context) => {
    const token = process.env.NETLIFY_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;
    const formName = "guestbook";
  
    if (!token || !siteId) {
      return new Response(JSON.stringify({ error: "환경변수가 누락되었습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  
    const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const forms = await res.json();
    const form = forms.find(f => f.name === formName);
    if (!form) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
  
    const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const subs = await subsRes.json();
  
    const messages = subs.map(s => ({
      name: s.data.name,
      message: s.data.message,
      from: s.data.from,
    }));
  
    return new Response(JSON.stringify(messages), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };