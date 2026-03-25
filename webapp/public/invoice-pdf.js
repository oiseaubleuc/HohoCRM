/**
 * PDF-factuur (A4) — HohoSolutions layout, EPC-QR voor banking apps.
 * Branding: defaultwaarden hieronder; overschrijf via localStorage key hohoh_invoice_branding (JSON).
 */
(function () {
  const DEFAULT_BRANDING = {
    companyName: 'HohoSolutions',
    addressLine: 'Koloniënstraat 11, 1000 Brussel, België',
    vat: 'BE1031192548',
    accountHolder: 'Houdaifa Hamouchi',
    iban: 'BE13 3632 6911 6739',
    ibanCompact: 'BE13363269116739',
    email: 'hohoservicess@gmail.com',
    phone: '+32451015476',
    legalNote0Btw: 'Bijzondere vrijstellingsregeling kleine ondernemingen - btw niet van toepassing.',
    /** Pad relatief aan webroot (Vite public → dist root), of volledige URL / data-URL */
    logoPath: '/invoice-logo.png',
  };

  function getBranding() {
    try {
      const raw = localStorage.getItem('hohoh_invoice_branding');
      if (raw) return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_BRANDING };
  }

  function fmtPdfDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function money(n) {
    return (Number(n) || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** EPC / SEPA QR (European Payments Council) — compatibel met Belgische bank-apps */
  function buildEpcPayload(f, b) {
    const iban = (b.ibanCompact || '').replace(/\s/g, '').toUpperCase();
    const amount = (f.totaal != null ? Number(f.totaal) : 0).toFixed(2);
    const name = (b.accountHolder || b.companyName || '').slice(0, 70);
    const rem = (`${(f.type || 'factuur').toUpperCase()} ${f.num || ''}`).slice(0, 140);
    const lines = [
      'BCD',
      '002',
      '1',
      'SCT',
      '',
      name,
      iban,
      `EUR${amount}`,
      '',
      rem,
    ];
    return lines.join('\n');
  }

  function invoiceLogoSrc(b) {
    const p = (b && b.logoPath != null) ? String(b.logoPath).trim() : '/invoice-logo.png';
    if (!p) return logoDataUriFallback();
    if (p.startsWith('data:') || /^https?:\/\//i.test(p)) return p;
    return p;
  }

  /** Fallback als geen logoPath / bestand ontbreekt */
  function logoDataUriFallback() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
      <rect width="72" height="72" fill="#0d0d0d"/>
      <ellipse cx="36" cy="42" rx="24" ry="11" fill="none" stroke="#fff" stroke-width="1.8" transform="rotate(-14 36 42)"/>
      <path fill="#fff" d="M36 14c0 0 10 18 10 26 0 2-1 4-3 4h-6v8l-5-7-5 7v-8h-6c-2 0-3-2-3-4 0-8 10-26 10-26s2 10 8 10 8-10 8-10z"/>
      <path fill="#fff" opacity=".9" d="M33 48l3 10 3-10h-6z"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.downloadFactuurPdf = function downloadFactuurPdf(factuurId) {
    const db = window.__HOHOH_DB__;
    if (!db || !db.facturen) {
      if (typeof toast === 'function') toast('❌ Geen factuurgegevens');
      return;
    }
    const f = db.facturen.find((x) => x.id === factuurId);
    if (!f) {
      if (typeof toast === 'function') toast('❌ Factuur niet gevonden');
      return;
    }
    if (typeof html2pdf === 'undefined') {
      if (typeof toast === 'function') toast('❌ PDF-bibliotheek niet geladen');
      return;
    }

    const kl = db.klanten ? db.klanten.find((k) => k.id === f.klantId) : null;
    const b = getBranding();
    const typeLabel = {
      factuur: 'FACTUUR',
      voorschot: 'VOORSCHOTFACTUUR',
      creditnota: 'CREDITNOTA',
      offerte: 'OFFERTE',
      'pro-forma': 'PRO-FORMA FACTUUR',
    };
    const titleType = typeLabel[f.type] || 'FACTUUR';
    const headerTitle = `${titleType} ${escapeHtml(f.num || '')}`;
    const orderNr = f.ref || (f.num || '').replace(/^.*?-/, '') || f.num || '—';
    const btwPct = f.btwPct != null ? Number(f.btwPct) : 21;
    const lines = (f.lines && f.lines.length)
      ? f.lines
      : [{ omschrijving: f.desc || '—', aantal: 1, prijs: f.excl || f.totaal || 0, subtotaal: f.excl || f.totaal || 0 }];

    const klantNaam = kl
      ? `${kl.voornaam || ''} ${kl.achternaam || ''}`.trim() || kl.bedrijf || '—'
      : '—';
    let klantExtra = 'België';
    if (kl) {
      const parts = [];
      if (kl.bedrijf && kl.bedrijf !== klantNaam) parts.push(escapeHtml(kl.bedrijf));
      if (kl.adres) parts.push(escapeHtml(kl.adres).replace(/\n/g, '<br>'));
      if (kl.btw) parts.push('BTW ' + escapeHtml(kl.btw));
      parts.push('België');
      klantExtra = parts.join('<br>');
    }

    let rowsHtml = '';
    lines.forEach((l) => {
      const aantal = l.aantal != null ? l.aantal : 1;
      const sub = l.subtotaal != null ? l.subtotaal : (Number(l.prijs) || 0) * (Number(aantal) || 1);
      const pex = aantal ? sub / Number(aantal) : sub;
      const oms = escapeHtml(l.omschrijving || '—').replace(/\n/g, '<br>');
      rowsHtml += `<tr>
        <td class="td-desc">${oms}</td>
        <td class="td-num">€ ${money(pex)}</td>
        <td class="td-mid">${btwPct} %</td>
        <td class="td-mid">${escapeHtml(String(aantal))}</td>
        <td class="td-num">€ ${money(sub)}</td>
      </tr>`;
    });

    const tot = f.totaal != null ? Number(f.totaal) : 0;
    const legalNote = btwPct === 0 && b.legalNote0Btw ? `<p class="legal">${escapeHtml(b.legalNote0Btw)}</p>` : '';

    const wrapper = document.createElement('div');
    wrapper.id = 'hohoh-invoice-pdf-root';
    wrapper.innerHTML = `
<div class="inv">
<style>
  .inv { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #111; width: 190mm; padding: 12mm 14mm; box-sizing: border-box; background: #fff; }
  .inv-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
  .logo { height: 56px; width: auto; max-width: 80px; object-fit: contain; flex-shrink: 0; display: block; }
  .meta { text-align: right; font-size: 10pt; }
  .meta h1 { margin: 0 0 8px; font-size: 15pt; font-weight: 700; letter-spacing: 0.02em; }
  .meta-row { margin: 2px 0; }
  .cols { display: flex; justify-content: space-between; gap: 16mm; margin-bottom: 10mm; }
  .col { flex: 1; font-size: 10pt; line-height: 1.45; }
  .col h2 { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #444; margin: 0 0 6px; }
  .col strong { font-size: 11pt; display: block; margin-bottom: 4px; }
  table.inv-table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  table.inv-table th { text-align: left; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #000; padding: 6px 4px 8px 0; }
  table.inv-table th.td-num { text-align: right; }
  table.inv-table th.td-mid { text-align: center; }
  table.inv-table td { vertical-align: top; padding: 10px 4px 10px 0; border-bottom: 1px solid #ddd; font-size: 10pt; }
  .td-desc { width: 42%; }
  .td-num { text-align: right; white-space: nowrap; }
  .td-mid { text-align: center; }
  .total-pay { text-align: right; font-size: 12pt; font-weight: 700; margin: 4mm 0 6mm; }
  .legal { font-size: 9pt; color: #333; margin: 6mm 0; line-height: 1.4; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10mm; padding-top: 5mm; border-top: 1px solid #000; font-size: 9pt; }
  .qr-wrap { text-align: center; }
  .qr-wrap p { margin: 0 0 4px; font-weight: 600; }
  #hohoh-qr-host { display: inline-block; }
  .foot-contact { text-align: right; line-height: 1.5; }
  .page-num { margin-top: 4mm; font-size: 8pt; color: #666; text-align: right; }
</style>
  <div class="inv-head">
    <img class="logo" src="${escapeHtml(invoiceLogoSrc(b))}" width="72" height="56" alt="" />
    <div class="meta">
      <h1>${headerTitle}</h1>
      <div class="meta-row"><strong>Factuurdatum</strong> ${escapeHtml(fmtPdfDate(f.datum))}</div>
      <div class="meta-row"><strong>Vervaldatum</strong> ${escapeHtml(fmtPdfDate(f.verval))}</div>
      <div class="meta-row"><strong>Ordernummer</strong> ${escapeHtml(orderNr)}</div>
    </div>
  </div>
  <div class="cols">
    <div class="col">
      <h2>Van</h2>
      <strong>${escapeHtml(b.companyName)}</strong>
      ${escapeHtml(b.addressLine).replace(/\n/g, '<br>')}<br>
      <strong>Btw</strong> ${escapeHtml(b.vat)}<br>
      <strong>Rekeninghouder</strong> ${escapeHtml(b.accountHolder)}<br>
      <strong>IBAN</strong> ${escapeHtml(b.iban)}
    </div>
    <div class="col">
      <h2>Aan</h2>
      <strong>${escapeHtml(klantNaam)}</strong>
      ${kl ? klantExtra : 'België'}
    </div>
  </div>
  <table class="inv-table">
    <thead>
      <tr>
        <th>Beschrijving</th>
        <th class="td-num">Prijs (excl. btw)</th>
        <th class="td-mid">Btw-tarief</th>
        <th class="td-mid">Aantal</th>
        <th class="td-num">Totaal</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="total-pay">Te betalen &nbsp; € ${money(tot)}</div>
  ${legalNote}
  <div class="foot">
    <div class="qr-wrap">
      <p>Betaal met je bank-app</p>
      <div id="hohoh-qr-host"></div>
    </div>
    <div class="foot-contact">
      ${escapeHtml(b.email)}<br>
      ${escapeHtml(b.phone)}
    </div>
  </div>
  <div class="page-num">Pagina 1/1</div>
</div>`;

    document.body.appendChild(wrapper);

    const qrHost = wrapper.querySelector('#hohoh-qr-host');
    if (typeof QRCode !== 'undefined' && qrHost) {
      qrHost.innerHTML = '';
      try {
        const level = QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0;
        new QRCode(qrHost, {
          text: buildEpcPayload(f, b),
          width: 120,
          height: 120,
          correctLevel: level,
        });
      } catch (e) {
        console.warn('QRCode', e);
      }
    }

    const opt = {
      margin: [8, 8, 8, 8],
      filename: `${(f.type || 'factuur')}-${(f.num || 'document').replace(/[^\w.-]+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    const inner = wrapper.querySelector('.inv');

    function runPdf() {
      const filename = opt.filename;

      // Native macOS app: avoid blob: URLs (WKWebView can't "open" them).
      const nativeDl = (typeof window !== 'undefined')
        && window.webkit
        && window.webkit.messageHandlers
        && window.webkit.messageHandlers.hohohDownload
        && typeof window.webkit.messageHandlers.hohohDownload.postMessage === 'function';

      if (nativeDl) {
        html2pdf()
          .set(opt)
          .from(inner)
          .toPdf()
          .get('pdf')
          .then((pdf) => {
            const ab = pdf.output('arraybuffer');
            const bytes = new Uint8Array(ab);
            let binary = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            const base64 = btoa(binary);
            window.webkit.messageHandlers.hohohDownload.postMessage({
              filename,
              mime: 'application/pdf',
              base64,
            });
            wrapper.remove();
            if (typeof toast === 'function') toast('✓ PDF opgeslagen');
          })
          .catch((err) => {
            console.error(err);
            wrapper.remove();
            if (typeof toast === 'function') toast('❌ PDF mislukt');
          });
        return;
      }

      // Browser path (normal download).
      html2pdf()
        .set(opt)
        .from(inner)
        .save()
        .then(() => {
          wrapper.remove();
          if (typeof toast === 'function') toast('✓ PDF gedownload');
        })
        .catch((err) => {
          console.error(err);
          wrapper.remove();
          if (typeof toast === 'function') toast('❌ PDF mislukt');
        });
    }

    setTimeout(runPdf, qrHost && typeof QRCode !== 'undefined' ? 180 : 0);
  };
})();
