// ============================================================
// Roseller — admin-publish.js
// Fetches live products from Supabase and pushes them to the
// Cloudflare KV Worker as products.json.
// ============================================================
(function () {
  'use strict';

  async function publishProducts() {
    const cfg = window.ROSELLER_PUBLISH;
    if (!cfg || !cfg.workerUrl || !cfg.secret) {
      alert('Publish config missing. Check js/publish-config.js');
      return;
    }

    const sb = window.RosellerSupabase;
    if (!sb) {
      alert('Supabase client not ready');
      return;
    }

    const btn = document.getElementById('publish-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Fetching…'; }

    try {
      // 1. Fetch all live products
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || !data.length) {
        alert('No live products to publish');
        if (btn) { btn.disabled = false; btn.textContent = 'Publish to CDN'; }
        return;
      }

      // 2. Format to products.json shape (matches cards.js expectations)
      const json = data.map(p => ({
        id: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand || 'Roseller',
        price: Number(p.price),
        oldPrice: p.old_price ? Number(p.old_price) : undefined,
        image: p.image || '',
        tag: Array.isArray(p.tags) && p.tags.length ? p.tags[0] : undefined,
        featured: p.featured === true,
        bestseller: p.bestseller === true,
        stock: p.stock > 0 ? 'In Stock' : 'Out of Stock',
        description: p.description || '',
        images: p.images || [],
        sizes: p.sizes || [],
        colors: p.colors || [],
        vendor: p.vendor_id
      }));

      if (btn) btn.textContent = 'Uploading…';

      // 3. POST to Cloudflare Worker
      const res = await fetch(cfg.workerUrl + '/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + cfg.secret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed (${res.status}): ${errText}`);
      }
      const out = await res.json();
      if (!out.ok) throw new Error('Worker rejected the upload');

      // 4. Update published_at on those products
      await sb
        .from('products')
        .update({ published_at: new Date().toISOString() })
        .eq('status', 'live');

      if (btn) {
        btn.textContent = `✓ Published ${out.count}`;
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Publish to CDN';
        }, 2500);
      }

      alert(
        `Published ${out.count} products to CDN.\n\n` +
        `Live at: ${cfg.workerUrl}/products.json\n\n` +
        `The site will show the new products within 5 minutes ` +
        `(CDN cache) or immediately on hard-refresh.`
      );
    } catch (err) {
      console.error('[publish]', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Publish to CDN'; }
      alert('Publish failed: ' + err.message);
    }
  }

  window.RosellerPublish = { publishProducts };
})();