// netlify/functions/guestbook.js
// CommonJS export (Netlify 기본 기대치)
const fetchApi = global.fetch; // Node 18+면 fetch 전역. 혹시 모를 네임 충돌 방지용

function cors() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
}

exports.handler = async (event, context) => {
  try {
    // CORS/preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          ...cors(),
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization',
        },
        body: '',
      };
    }

    const token  = process.env.NETLIFY_TOKEN;
    const siteId = process.env.SITE_ID || (context && context.site && context.site.id);
    if (!token || !siteId) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ error: 'Missing NETLIFY_TOKEN or SITE_ID' }),
      };
    }

    // 1) 사이트 폼 목록
    const formsRes = await fetchApi(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!formsRes.ok) throw new Error(`Failed to list forms: ${formsRes.status}`);
    const forms = await formsRes.json();

    // 2) guestbook 폼 찾기
    const form = forms.find(f => (f.name || '').toLowerCase() === 'guestbook');
    if (!form) {
      return {
        statusCode: 200,
        headers: { ...cors(), 'cache-control': 'no-store' },
        body: JSON.stringify([]),
      };
    }

    // 3) 제출 가져오기
    const subsRes = await fetchApi(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!subsRes.ok) throw new Error(`Failed to list submissions: ${subsRes.status}`);
    const subs = await subsRes.json();

    // 4) 프론트에서 쓰던 형태로 매핑
    const rows = subs.map(s => ({
      name:    s.data?.name    || '',
      message: s.data?.message || '',
      from:    s.data?.from    || (s.data?.name || ''),
      created_at: s.created_at,
    }));

    return {
      statusCode: 200,
      headers: { ...cors(), 'cache-control': 'no-store' },
      body: JSON.stringify(rows),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: String(err) }),
    };
  }
};