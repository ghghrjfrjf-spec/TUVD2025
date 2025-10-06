// /.netlify/functions/guestbook
export async function handler(event, context) {
    try {
      const token  = process.env.NETLIFY_TOKEN;       // Netlify Personal Access Token
      const siteId = process.env.SITE_ID || context?.site?.id;
      if (!token || !siteId) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Missing NETLIFY_TOKEN or SITE_ID' }) };
      }
  
      // 1) 사이트 안의 폼 목록 가져오기
      const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!formsRes.ok) throw new Error('Failed to list forms');
      const forms = await formsRes.json();
  
      // 2) 'guestbook' 폼 찾기 (form name은 <form>의 name/form-name과 동일)
      const form = forms.find(f => (f.name || '').toLowerCase() === 'guestbook');
      if (!form) return { statusCode: 200, headers: cors(), body: JSON.stringify([]) };
  
      // 3) 해당 폼의 제출 가져오기
      const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!subsRes.ok) throw new Error('Failed to list submissions');
      const subs = await subsRes.json();
  
      // 4) 프론트에서 쓰던 형태로 매핑
      const rows = subs.map(s => ({
        name:    s.data?.name    || '',
        message: s.data?.message || '',
        from:    s.data?.from    || (s.data?.name || ''),
        created_at: s.created_at,
      }));
  
      return { statusCode: 200, headers: { ...cors(), 'cache-control': 'no-store' }, body: JSON.stringify(rows) };
    } catch (err) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: String(err) }) };
    }
  }
  
  function cors() {
    return {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    };
  }