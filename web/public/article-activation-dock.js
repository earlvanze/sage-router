(function () {
  const path = window.location.pathname || '/';
  const title = (document.querySelector('h1')?.textContent || document.title || 'Sage Router').trim();
  const accountUrl = 'https://app.sagerouter.dev/account.html?plan=pro&start=checkout&utm_source=article-dock&utm_medium=activation&utm_campaign=sage-router-launch&utm_content=create-pro-key';
  const quickstartUrl = '/quickstart?utm_source=article-dock&utm_medium=activation&utm_campaign=sage-router-launch&utm_content=copy-quickstart';
  const calculatorUrl = '/model-routing-calculator?utm_source=article-dock&utm_medium=activation&utm_campaign=sage-router-launch&utm_content=estimate-fit';

  function attributionValue(value) {
    const sanitized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, '-')
      .slice(0, 100);
    return sanitized || undefined;
  }

  function track(event, extra = {}) {
    const params = new URLSearchParams(window.location.search);
    let referrerHost = '';
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      referrerHost = '';
    }
    const payload = JSON.stringify({
      event,
      plan: extra.plan || 'pro',
      sourcePage: window.location.href,
      source_page: window.location.href,
      target: extra.target || null,
      metadata: {
        source: 'article-dock',
        sourceSurface: 'article',
        articlePath: attributionValue(path),
        articleTitle: attributionValue(title),
        button: attributionValue(extra.button),
        state: attributionValue(extra.state),
        utmSource: attributionValue(params.get('utm_source')),
        utmMedium: attributionValue(params.get('utm_medium')),
        utmCampaign: attributionValue(params.get('utm_campaign')),
        referrerHost: attributionValue(referrerHost),
      },
    });
    if (navigator.sendBeacon?.('/api/funnel-event', new Blob([payload], { type: 'application/json' }))) {
      return;
    }
    fetch('/api/funnel-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  }

  function makeLink(label, href, className, event, button) {
    const link = document.createElement('a');
    link.href = href;
    link.className = className;
    link.textContent = label;
    link.addEventListener('click', () => track(event, { target: href, button }));
    return link;
  }

  function mountDock() {
    if (document.getElementById('article-activation-dock')) return;
    const style = document.createElement('style');
    style.textContent = `
      #article-activation-dock{position:fixed;left:50%;bottom:18px;z-index:60;display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto;gap:10px;align-items:center;width:min(1040px,calc(100vw - 32px));padding:12px;border:1px solid rgba(141,240,178,.35);border-radius:999px;background:rgba(7,16,13,.94);box-shadow:0 20px 80px rgba(0,0,0,.45);backdrop-filter:blur(18px)}
      #article-activation-dock strong,#article-activation-dock span{display:block}
      #article-activation-dock strong{color:#edfdf5;font:900 14px/1.2 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #article-activation-dock span{color:#a9c5b8;font:500 13px/1.25 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #article-activation-dock a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:0 16px;text-decoration:none;font:900 13px/1 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap}
      #article-activation-dock .articleDockPrimary{background:linear-gradient(135deg,#8df0b2,#50d891);color:#04150d}
      #article-activation-dock .articleDockSecondary{border:1px solid rgba(166,255,207,.18);background:rgba(255,255,255,.055);color:#edfdf5}
      @media(max-width:760px){body{padding-bottom:190px!important}#article-activation-dock{grid-template-columns:1fr;border-radius:24px;align-items:stretch}#article-activation-dock a{width:100%}}
    `;
    document.head.appendChild(style);

    const dock = document.createElement('aside');
    dock.id = 'article-activation-dock';
    dock.setAttribute('aria-label', 'Sage Router activation');
    const copy = document.createElement('div');
    copy.innerHTML = '<strong>Turn this into a routed request.</strong><span>Create a Pro key, copy setup, or estimate the right plan.</span>';
    dock.appendChild(copy);
    dock.appendChild(makeLink('Create Pro key', accountUrl, 'articleDockPrimary', 'content_article_checkout_clicked', 'sticky-create-pro-key'));
    dock.appendChild(makeLink('Copy quickstart', quickstartUrl, 'articleDockSecondary', 'content_article_quickstart_clicked', 'sticky-copy-quickstart'));
    dock.appendChild(makeLink('Estimate fit', calculatorUrl, 'articleDockSecondary', 'content_article_calculator_clicked', 'sticky-estimate-fit'));
    document.body.appendChild(dock);
    track('content_article_activation_dock_viewed', { state: 'mounted' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDock, { once: true });
  } else {
    mountDock();
  }
})();
