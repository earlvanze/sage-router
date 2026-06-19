const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const insert = async (supabaseUrl, serviceKey, table, record) => fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    prefer: 'return=minimal',
  },
  body: JSON.stringify(record),
});

const waitlistConfig = (env) => {
  const supabaseUrl = env.SAGEROUTER_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SAGEROUTER_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceKey };
};

export async function onRequestGet({ env }) {
  const { supabaseUrl, serviceKey } = waitlistConfig(env);
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 500);
  return json({
    ok: true,
    service: 'sage-router-waitlist',
    storage: 'supabase',
    primaryTable: 'sage_router_waitlist',
    fallbackTable: 'funnel_leads',
  });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const company = String(payload.company || '').trim().slice(0, 200);
  const website = String(payload.website || '').trim();

  if (website) return json({ ok: true });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'invalid_email' }, 400);
  }

  const { supabaseUrl, serviceKey } = waitlistConfig(env);
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_not_configured' }, 500);

  const metadata = {
    product: 'sage-router',
    form: 'site_waitlist',
    user_agent: request.headers.get('user-agent') || null,
    referer: request.headers.get('referer') || null,
  };

  const waitlistRecord = {
    source_page: 'https://sagerouter.dev',
    email,
    company: company || null,
    metadata,
  };

  let response = await insert(supabaseUrl, serviceKey, 'sage_router_waitlist', waitlistRecord);

  if (response.status === 409) return json({ ok: true });

  if (!response.ok && response.status === 404) {
    response = await insert(supabaseUrl, serviceKey, 'funnel_leads', {
      ...waitlistRecord,
      cta_type: 'sage_router_waitlist',
    });
  }

  if (response.status === 409) return json({ ok: true });

  if (!response.ok) {
    const details = await response.text();
    return json({ error: 'supabase_insert_failed', details }, 502);
  }

  return json({ ok: true });
}
