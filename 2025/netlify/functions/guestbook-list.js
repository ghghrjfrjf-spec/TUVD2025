// netlify/functions/guestbook.js
// Netlify Blobs에 방명록 저장 (컬렉션: "guestbook")
export default async (req) => {
  const { blobs } = await import('@netlify/blobs');
  const store = blobs.createBlobStore({ name: 'guestbook' });

  const json = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' }
  });

  try {
    if (req.method === 'GET') {
      const keys = await store.list();
      const items = [];
      for (const k of keys.blobs || []) {
        const raw = await store.get(k.key, { type: 'json' });
        if (raw) items.push(raw);
      }
      // 최신순 정렬(id에 timestamp 포함 가정)
      items.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
      return json(200, items);
    }

    if (req.method === 'POST') {
      const ct = req.headers.get('content-type') || '';
      const data = ct.includes('application/json')
        ? await req.json()
        : Object.fromEntries(new URLSearchParams(await req.text()));

      const action = (data.action || 'create').toLowerCase();
      const nowISO = new Date().toISOString();

      if (action === 'create') {
        // 필수값
        const name = (data.name||'').trim();
        const message = (data.message||'').trim();
        const from = (data.from||'').trim();
        const ownerId = (data.ownerId||'').trim();
        if (!name || !message) return json(400, { error: 'name/message required' });

        const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const row = { id, name, message, from: from || name, ownerId, createdAt: nowISO, updatedAt: nowISO };
        await store.setJSON(id, row);
        return json(201, row);
      }

      if (action === 'update') {
        const { id, ownerId, name, message, from } = data;
        if (!id) return json(400, { error: 'id required' });
        const cur = await store.get(id, { type: 'json' });
        if (!cur) return json(404, { error: 'not found' });
        if ((cur.ownerId||'') !== (ownerId||'')) return json(403, { error: 'not owner' });

        const next = {
          ...cur,
          name: name ?? cur.name,
          message: message ?? cur.message,
          from: (from ?? cur.from) || (name ?? cur.name),
          updatedAt: nowISO
        };
        await store.setJSON(id, next);
        return json(200, next);
      }

      if (action === 'delete') {
        const { id, ownerId } = data;
        if (!id) return json(400, { error: 'id required' });
        const cur = await store.get(id, { type: 'json' });
        if (!cur) return json(404, { error: 'not found' });
        if ((cur.ownerId||'') !== (ownerId||'')) return json(403, { error: 'not owner' });
        await store.delete(id);
        return json(204, {});
      }

      return json(400, { error: 'unknown action' });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};