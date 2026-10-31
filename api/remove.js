module.exports = async (req, res) => {
  const send = (c, o) => { res.statusCode = c; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  try {
    if (req.method !== 'POST') return send(405, { error: 'Method tidak diizinkan' });
    const key = process.env.REMOVEBG_API_KEY;
    if (!key) return send(500, { error: 'REMOVEBG_API_KEY belum diatur' });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if (!buf.length) return send(400, { error: 'Foto kosong' });
    const mime = String(req.headers['content-type'] || 'image/jpeg').split(';')[0];
    const call = (size) => {
      const f = new FormData();
      f.append('image_file', new Blob([buf], { type: mime }), 'foto');
      f.append('size', size);
      return fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': key }, body: f });
    };
    const want = req.headers['x-quality'] === 'preview' ? 'preview' : 'auto';
    let r = await call(want), prev = want === 'preview';
    if (r.status === 402 && !prev) { r = await call('preview'); prev = true; }
    if (!r.ok) {
      let m = 'remove.bg menolak (kode ' + r.status + ')';
      try { m = (await r.json()).errors[0].title || m; } catch (e) {}
      return send(r.status === 402 ? 402 : 502, { error: m });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    if (prev) res.setHeader('X-Used-Preview', '1');
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    send(500, { error: 'Error server: ' + (e && e.message ? e.message : String(e)) });
  }
};
module.exports.config = { api: { bodyParser: false } };
