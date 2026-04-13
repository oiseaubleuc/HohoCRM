/**
 * ORION — UBL 2.1 Invoice Generator
 * Peppol BIS Billing 3.0 · EN 16931 Compliant
 * Belgian B2B e-invoicing (verplicht sinds 01/01/2026)
 * 
 * Gebruik:
 *   const xml = generateUBLInvoice(invoiceData);
 *   // → Geldige UBL 2.1 XML string, klaar voor Peppol
 * 
 * @author HohoSolutions — info@hohosolutions.com
 * @version 1.0.0
 */

// ── HELPERS ────────────────────────────────────────────────────────────────

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Rond BTW-bedrag af per tarief (niet per lijn).
 * Verplicht sinds 01/01/2026 voor e-facturen in België.
 * Afronding op 2 decimalen, mathematisch (half-up).
 */
function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function formatAmount(amount) {
  return roundCurrency(amount).toFixed(2);
}

function formatDate(date) {
  if (typeof date === 'string') return date; // Already formatted YYYY-MM-DD
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Genereer Belgische gestructureerde mededeling (+++xxx/xxxx/xxxxx+++)
 * Formaat: +++DDD/DDDD/DDDCD+++ waarbij CD = modulo 97 controle
 */
function generateStructuredReference(invoiceNumber) {
  // Neem numeriek deel van het factuurnummer
  const numeric = String(invoiceNumber).replace(/\D/g, '').slice(0, 10).padStart(10, '0');
  const base = parseInt(numeric, 10);
  let check = base % 97;
  if (check === 0) check = 97;
  const full = numeric + String(check).padStart(2, '0');
  return `+++${full.slice(0,3)}/${full.slice(3,7)}/${full.slice(7,12)}+++`;
}

// ── MAIN GENERATOR ─────────────────────────────────────────────────────────

/**
 * Genereer een UBL 2.1 Invoice XML conform Peppol BIS Billing 3.0
 * 
 * @param {Object} data - Factuurgegevens
 * @param {string} data.invoiceNumber - Factuurnummer (uniek, opeenvolgend)
 * @param {string} data.issueDate - Factuurdatum (YYYY-MM-DD)
 * @param {string} data.dueDate - Vervaldatum (YYYY-MM-DD)
 * @param {string} [data.invoiceTypeCode='380'] - 380=factuur, 381=creditnota
 * @param {string} [data.currencyCode='EUR'] - Valutacode
 * @param {string} [data.note] - Opmerking op de factuur
 * @param {string} [data.buyerReference] - Referentie van de koper (verplicht voor B2G)
 * @param {string} [data.orderReference] - Bestelbonnummer
 * 
 * @param {Object} data.seller - Verkoper (uw klant)
 * @param {string} data.seller.name - Bedrijfsnaam
 * @param {string} data.seller.vatNumber - BTW-nummer (BE0xxxxxxxxx)
 * @param {string} data.seller.kboNumber - KBO/ondernemingsnummer (0xxxxxxxxx)
 * @param {string} data.seller.street - Straat + huisnummer
 * @param {string} data.seller.city - Gemeente
 * @param {string} data.seller.postalCode - Postcode
 * @param {string} [data.seller.country='BE'] - Landcode ISO 3166-1
 * @param {string} [data.seller.email] - E-mailadres
 * @param {string} [data.seller.phone] - Telefoonnummer
 * @param {string} data.seller.iban - IBAN-rekeningnummer
 * @param {string} [data.seller.bic] - BIC/SWIFT-code
 * 
 * @param {Object} data.buyer - Koper
 * @param {string} data.buyer.name - Bedrijfsnaam
 * @param {string} data.buyer.vatNumber - BTW-nummer
 * @param {string} data.buyer.kboNumber - KBO/ondernemingsnummer
 * @param {string} data.buyer.street - Straat + huisnummer
 * @param {string} data.buyer.city - Gemeente
 * @param {string} data.buyer.postalCode - Postcode
 * @param {string} [data.buyer.country='BE'] - Landcode
 * @param {string} [data.buyer.email] - E-mailadres
 * 
 * @param {Array} data.lines - Factuurlijnen
 * @param {string} data.lines[].description - Omschrijving
 * @param {number} data.lines[].quantity - Hoeveelheid
 * @param {string} [data.lines[].unitCode='HUR'] - Eenheidscode (HUR=uur, C62=stuks, MON=maand)
 * @param {number} data.lines[].unitPrice - Prijs per eenheid (excl. BTW)
 * @param {number} data.lines[].vatRate - BTW-tarief (21, 12, 6, of 0)
 * @param {string} [data.lines[].vatCategoryCode] - BTW-categorie (S=standaard, Z=nul, E=vrijgesteld, AE=reverse charge)
 * @param {string} [data.lines[].itemName] - Naam van het item (als anders dan description)
 * 
 * @param {Object} [data.paymentTerms] - Betalingsvoorwaarden
 * @param {string} [data.paymentTerms.note] - Bijv. "Betaling binnen 30 dagen"
 * @param {string} [data.paymentTerms.structuredReference] - Gestructureerde mededeling
 * 
 * @returns {string} UBL 2.1 XML string
 */
function generateUBLInvoice(data) {
  const {
    invoiceNumber,
    issueDate,
    dueDate,
    invoiceTypeCode = '380', // 380 = Invoice, 381 = Credit Note
    currencyCode = 'EUR',
    note = '',
    buyerReference = '',
    orderReference = '',
    seller,
    buyer,
    lines,
    paymentTerms = {},
  } = data;

  // ── Bereken totalen per BTW-tarief (afronding per tarief, NIET per lijn) ──
  const vatGroups = {};
  let totalLineExtension = 0;

  lines.forEach(line => {
    const lineAmount = roundCurrency(line.quantity * line.unitPrice);
    totalLineExtension += lineAmount;

    const rate = line.vatRate || 0;
    const catCode = line.vatCategoryCode || (rate > 0 ? 'S' : (rate === 0 ? 'Z' : 'E'));
    const key = `${rate}-${catCode}`;

    if (!vatGroups[key]) {
      vatGroups[key] = { rate, categoryCode: catCode, taxableAmount: 0 };
    }
    vatGroups[key].taxableAmount += lineAmount;
  });

  totalLineExtension = roundCurrency(totalLineExtension);

  // Bereken BTW per groep — afronding op groepsniveau (wet 2026)
  let totalVatAmount = 0;
  Object.values(vatGroups).forEach(group => {
    group.taxableAmount = roundCurrency(group.taxableAmount);
    group.taxAmount = roundCurrency(group.taxableAmount * group.rate / 100);
    totalVatAmount += group.taxAmount;
  });
  totalVatAmount = roundCurrency(totalVatAmount);

  const taxExclusiveAmount = totalLineExtension;
  const taxInclusiveAmount = roundCurrency(taxExclusiveAmount + totalVatAmount);
  const payableAmount = taxInclusiveAmount;

  // Gestructureerde mededeling
  const structRef = paymentTerms.structuredReference || generateStructuredReference(invoiceNumber);

  // Peppol IDs
  const sellerEndpoint = seller.kboNumber ? `0208:${seller.kboNumber.replace(/\./g, '')}` : '';
  const buyerEndpoint = buyer.kboNumber ? `0208:${buyer.kboNumber.replace(/\./g, '')}` : '';

  // ── BUILD XML ────────────────────────────────────────────────────────────

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <cbc:ID>${escapeXml(invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${formatDate(issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${formatDate(dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${escapeXml(invoiceTypeCode)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escapeXml(currencyCode)}</cbc:DocumentCurrencyCode>`;

  if (buyerReference) {
    xml += `
  <cbc:BuyerReference>${escapeXml(buyerReference)}</cbc:BuyerReference>`;
  }

  if (note) {
    xml += `
  <cbc:Note>${escapeXml(note)}</cbc:Note>`;
  }

  if (orderReference) {
    xml += `
  <cac:OrderReference>
    <cbc:ID>${escapeXml(orderReference)}</cbc:ID>
  </cac:OrderReference>`;
  }

  // ── SELLER (AccountingSupplierParty) ──
  xml += `

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0208">${escapeXml(seller.kboNumber?.replace(/\./g, '') || '')}</cbc:EndpointID>
      <cac:PartyIdentification>
        <cbc:ID schemeID="0208">${escapeXml(seller.kboNumber?.replace(/\./g, '') || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(seller.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(seller.street)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(seller.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(seller.postalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(seller.country || 'BE')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(seller.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0208">${escapeXml(seller.kboNumber?.replace(/\./g, '') || '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>`;

  if (seller.email || seller.phone) {
    xml += `
      <cac:Contact>`;
    if (seller.email) xml += `
        <cbc:ElectronicMail>${escapeXml(seller.email)}</cbc:ElectronicMail>`;
    if (seller.phone) xml += `
        <cbc:Telephone>${escapeXml(seller.phone)}</cbc:Telephone>`;
    xml += `
      </cac:Contact>`;
  }

  xml += `
    </cac:Party>
  </cac:AccountingSupplierParty>`;

  // ── BUYER (AccountingCustomerParty) ──
  xml += `

  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0208">${escapeXml(buyer.kboNumber?.replace(/\./g, '') || '')}</cbc:EndpointID>
      <cac:PartyIdentification>
        <cbc:ID schemeID="0208">${escapeXml(buyer.kboNumber?.replace(/\./g, '') || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(buyer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(buyer.street)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(buyer.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(buyer.postalCode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(buyer.country || 'BE')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(buyer.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0208">${escapeXml(buyer.kboNumber?.replace(/\./g, '') || '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>`;

  if (buyer.email) {
    xml += `
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(buyer.email)}</cbc:ElectronicMail>
      </cac:Contact>`;
  }

  xml += `
    </cac:Party>
  </cac:AccountingCustomerParty>`;

  // ── PAYMENT MEANS ──
  xml += `

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>${escapeXml(structRef)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(seller.iban?.replace(/\s/g, '') || '')}</cbc:ID>`;

  if (seller.bic) {
    xml += `
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${escapeXml(seller.bic)}</cbc:ID>
      </cac:FinancialInstitutionBranch>`;
  }

  xml += `
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`;

  // ── PAYMENT TERMS ──
  if (paymentTerms.note) {
    xml += `

  <cac:PaymentTerms>
    <cbc:Note>${escapeXml(paymentTerms.note)}</cbc:Note>
  </cac:PaymentTerms>`;
  }

  // ── TAX TOTAL ──
  xml += `

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(totalVatAmount)}</cbc:TaxAmount>`;

  Object.values(vatGroups).forEach(group => {
    xml += `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(group.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(group.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${escapeXml(group.categoryCode)}</cbc:ID>
        <cbc:Percent>${group.rate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
  });

  xml += `
  </cac:TaxTotal>`;

  // ── LEGAL MONETARY TOTAL ──
  xml += `

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(totalLineExtension)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(taxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;

  // ── INVOICE LINES ──
  lines.forEach((line, index) => {
    const lineAmount = roundCurrency(line.quantity * line.unitPrice);
    const rate = line.vatRate || 0;
    const catCode = line.vatCategoryCode || (rate > 0 ? 'S' : (rate === 0 ? 'Z' : 'E'));
    const unitCode = line.unitCode || 'HUR'; // HUR=uur, C62=stuks, MON=maand, DAY=dag

    xml += `

  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escapeXml(unitCode)}">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(lineAmount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escapeXml(line.description)}</cbc:Description>
      <cbc:Name>${escapeXml(line.itemName || line.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${escapeXml(catCode)}</cbc:ID>
        <cbc:Percent>${rate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${escapeXml(currencyCode)}">${formatAmount(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  });

  xml += `

</Invoice>`;

  return xml;
}


/**
 * Genereer een UBL 2.1 Credit Note XML conform Peppol BIS Billing 3.0
 * Zelfde structuur als factuur maar met CreditNote root element
 */
function generateUBLCreditNote(data) {
  // Creditnota = invoiceTypeCode 381
  return generateUBLInvoice({ ...data, invoiceTypeCode: '381' });
}


// ── VALIDATIE ──────────────────────────────────────────────────────────────

/**
 * Valideer factuurdata vóór XML-generatie.
 * Geeft een array van foutmeldingen terug (leeg = geldig).
 */
function validateInvoiceData(data) {
  const errors = [];

  if (!data.invoiceNumber) errors.push('Factuurnummer is verplicht');
  if (!data.issueDate) errors.push('Factuurdatum is verplicht');
  if (!data.dueDate) errors.push('Vervaldatum is verplicht');

  // Seller
  if (!data.seller) {
    errors.push('Verkopergegevens zijn verplicht');
  } else {
    if (!data.seller.name) errors.push('Verkoper: naam is verplicht');
    if (!data.seller.vatNumber) errors.push('Verkoper: BTW-nummer is verplicht');
    if (!data.seller.kboNumber) errors.push('Verkoper: KBO-nummer is verplicht');
    if (!data.seller.street) errors.push('Verkoper: adres is verplicht');
    if (!data.seller.city) errors.push('Verkoper: gemeente is verplicht');
    if (!data.seller.postalCode) errors.push('Verkoper: postcode is verplicht');
    if (!data.seller.iban) errors.push('Verkoper: IBAN is verplicht');

    // Belgisch BTW-formaat
    if (data.seller.vatNumber && !/^BE0\d{9}$/.test(data.seller.vatNumber.replace(/[\s.]/g, ''))) {
      errors.push('Verkoper: BTW-nummer moet formaat BE0xxxxxxxxx hebben');
    }
  }

  // Buyer
  if (!data.buyer) {
    errors.push('Kopergegevens zijn verplicht');
  } else {
    if (!data.buyer.name) errors.push('Koper: naam is verplicht');
    if (!data.buyer.vatNumber) errors.push('Koper: BTW-nummer is verplicht');
    if (!data.buyer.kboNumber) errors.push('Koper: KBO-nummer is verplicht');
    if (!data.buyer.street) errors.push('Koper: adres is verplicht');
    if (!data.buyer.city) errors.push('Koper: gemeente is verplicht');
    if (!data.buyer.postalCode) errors.push('Koper: postcode is verplicht');
  }

  // Lines
  if (!data.lines || data.lines.length === 0) {
    errors.push('Minstens één factuurregel is verplicht');
  } else {
    data.lines.forEach((line, i) => {
      if (!line.description) errors.push(`Lijn ${i+1}: omschrijving is verplicht`);
      if (!line.quantity || line.quantity <= 0) errors.push(`Lijn ${i+1}: hoeveelheid moet groter dan 0 zijn`);
      if (line.unitPrice === undefined || line.unitPrice < 0) errors.push(`Lijn ${i+1}: eenheidsprijs is verplicht`);
      if (line.vatRate === undefined) errors.push(`Lijn ${i+1}: BTW-tarief is verplicht`);
      if (![0, 6, 12, 21].includes(line.vatRate)) errors.push(`Lijn ${i+1}: BTW-tarief moet 0, 6, 12 of 21% zijn`);
    });
  }

  return errors;
}


// ── EXPORTS ────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateUBLInvoice,
    generateUBLCreditNote,
    validateInvoiceData,
    generateStructuredReference,
    roundCurrency,
  };
}

// Browser global
if (typeof window !== 'undefined') {
  window.OrionUBL = {
    generateUBLInvoice,
    generateUBLCreditNote,
    validateInvoiceData,
    generateStructuredReference,
    roundCurrency,
  };
}
