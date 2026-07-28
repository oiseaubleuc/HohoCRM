/**
 * ORION — Digiteal Peppol API Wrapper
 * Connecteert Orion ERP met het Peppol-netwerk via Digiteal Access Point
 * 
 * Vereist: Digiteal API credentials (vraag aan via digiteal.eu)
 * 
 * Gebruik:
 *   const peppol = new OrionPeppol({ apiKey: 'xxx', apiSecret: 'yyy', sandbox: true });
 *   const canReceive = await peppol.checkRecipient('0208:0441797980');
 *   const result = await peppol.sendInvoice(ublXmlString);
 * 
 * @author HohoSolutions — info@hohosolutions.com
 * @version 1.0.0
 */

class OrionPeppol {

  /**
   * @param {Object} config
   * @param {string} config.apiKey - Digiteal API key
   * @param {string} config.apiSecret - Digiteal API secret
   * @param {boolean} [config.sandbox=true] - true = test-omgeving, false = productie
   * @param {string} [config.webhookUrl] - URL waar Digiteal binnenkomende facturen naartoe stuurt
   * @param {string} [config.proxyBase] - Orion API proxy (default: /v1/peppol) — vermijdt browser-CORS naar Digiteal
   * @param {boolean} [config.direct=false] - true = rechtstreeks Digiteal (alleen als CORS toegelaten is)
   * @param {Function} [config.onLog] - Log callback (voor debugging)
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.sandbox = config.sandbox !== false; // Default: sandbox
    this.webhookUrl = config.webhookUrl || null;
    this.onLog = config.onLog || console.log;
    this.direct = config.direct === true;

    const digitealBase = this.sandbox
      ? 'https://test.digiteal.eu/api/v1'
      : 'https://app.digiteal.eu/api/v1';

    // Standaard via Orion-backend proxy (browser → 127.0.0.1:4000 → Digiteal)
    const defaultProxy =
      (typeof window !== 'undefined' && window.ORION_PEPPOL_PROXY) ||
      '/v1/peppol';
    this.baseUrl = this.direct
      ? digitealBase
      : String(config.proxyBase || defaultProxy).replace(/\/$/, '');

    this._log(`OrionPeppol initialized (${this.sandbox ? 'SANDBOX' : 'PRODUCTIE'}${this.direct ? ', DIRECT' : ', PROXY'})`);
    this._log(`Base URL: ${this.baseUrl}`);
  }

  // ── PRIVATE HELPERS ────────────────────────────────────────────────────

  _log(msg) {
    if (this.onLog) this.onLog(`[Peppol] ${msg}`);
  }

  _authHeader() {
    const credentials = btoa(`${this.apiKey}:${this.apiSecret}`);
    return `Basic ${credentials}`;
  }

  async _request(method, path, body = null, contentType = 'application/json') {
    const url = `${this.baseUrl}${path}`;
    this._log(`${method} ${url}`);

    const headers = {
      'Authorization': this._authHeader(),
      'X-Digiteal-Sandbox': this.sandbox ? '1' : '0',
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const options = { method, headers };

    if (body) {
      if (contentType === 'application/json') {
        options.body = JSON.stringify(body);
      } else {
        options.body = body; // XML string
      }
    }

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();

      if (!response.ok) {
        this._log(`ERROR ${response.status}: ${responseText}`);
        return {
          success: false,
          status: response.status,
          error: responseText,
        };
      }

      // Try to parse as JSON, fallback to text
      try {
        return { success: true, status: response.status, data: JSON.parse(responseText) };
      } catch {
        return { success: true, status: response.status, data: responseText };
      }
    } catch (err) {
      this._log(`NETWORK ERROR: ${err.message}`);
      return { success: false, status: 0, error: err.message };
    }
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────

  /**
   * 1. CONTROLEER OF EEN ONTVANGER PEPPOL HEEFT
   * 
   * Check of een bedrijf geregistreerd is op het Peppol-netwerk
   * en welke documenttypes het kan ontvangen.
   * 
   * @param {string} peppolId - Peppol identifier, bijv. "0208:0441797980" (KBO) of "9925:BE0441797980" (BTW)
   * @returns {Object} { success, canReceiveInvoice, canReceiveCreditNote, documentTypes }
   * 
   * Tip: Gebruik altijd zowel het KBO-nummer (0208:) als het BTW-nummer (9925:) 
   *      want de ontvanger kan op slechts één van beide geregistreerd zijn.
   */
  async checkRecipient(peppolId) {
    this._log(`Checking recipient: ${peppolId}`);

    const result = await this._request(
      'GET',
      `/peppol/remote-participants/${encodeURIComponent(peppolId)}/supported-document-types`
    );

    if (!result.success) {
      return {
        success: false,
        canReceiveInvoice: false,
        canReceiveCreditNote: false,
        error: result.error,
      };
    }

    const docTypes = result.data || [];
    const canInvoice = docTypes.some(dt =>
      dt.includes('Invoice') || dt.includes('invoice')
    );
    const canCredit = docTypes.some(dt =>
      dt.includes('CreditNote') || dt.includes('creditnote')
    );

    this._log(`Recipient ${peppolId}: invoice=${canInvoice}, creditNote=${canCredit}`);

    return {
      success: true,
      canReceiveInvoice: canInvoice,
      canReceiveCreditNote: canCredit,
      documentTypes: docTypes,
    };
  }

  /**
   * Helper: Controleer een Belgisch bedrijf op beide identifiers
   * 
   * @param {string} kboNumber - KBO-nummer (bijv. "0441797980")
   * @param {string} [vatNumber] - BTW-nummer (bijv. "BE0441797980")
   * @returns {Object} { found, peppolId, ... }
   */
  async checkBelgianCompany(kboNumber, vatNumber = null) {
    const kboClean = kboNumber.replace(/\./g, '');

    // Probeer KBO eerst (verplichte identifier in België)
    let result = await this.checkRecipient(`0208:${kboClean}`);
    if (result.success && result.canReceiveInvoice) {
      return { found: true, peppolId: `0208:${kboClean}`, ...result };
    }

    // Fallback naar BTW-nummer
    if (vatNumber) {
      const vatClean = vatNumber.replace(/[\s.]/g, '').toUpperCase();
      result = await this.checkRecipient(`9925:${vatClean}`);
      if (result.success && result.canReceiveInvoice) {
        return { found: true, peppolId: `9925:${vatClean}`, ...result };
      }
    }

    return { found: false, peppolId: null, error: 'Bedrijf niet gevonden op Peppol-netwerk' };
  }

  /**
   * 2. VERSTUUR EEN UBL-FACTUUR VIA PEPPOL
   * 
   * Stuurt een UBL 2.1 XML-document via het Peppol-netwerk.
   * Digiteal valideert de XML en stuurt naar de ontvanger.
   * 
   * @param {string} ublXml - De volledige UBL 2.1 XML-string
   * @returns {Object} { success, documentId, status, error }
   * 
   * Mogelijke fouten:
   * - MISSING_DOCUMENT: geen XML meegegeven
   * - INVALID_DOCUMENT: XML is niet valide (zie error message voor details)
   * - RECIPIENT_NOT_IN_PEPPOL: ontvanger niet geregistreerd
   */
  async sendInvoice(ublXml) {
    this._log('Sending UBL invoice via Peppol...');

    const result = await this._request(
      'POST',
      '/peppol/outbound-ubl-documents',
      ublXml,
      'application/xml'
    );

    if (result.success) {
      this._log(`Invoice sent successfully! Document ID: ${result.data?.id || 'N/A'}`);
      return {
        success: true,
        documentId: result.data?.id,
        status: 'sent',
        data: result.data,
      };
    } else {
      this._log(`Failed to send invoice: ${result.error}`);
      return {
        success: false,
        error: result.error,
        status: 'failed',
      };
    }
  }

  /**
   * 3. REGISTREER EEN DEELNEMER OP PEPPOL
   * 
   * Registreer een bedrijf (jouw klant) als Peppol-deelnemer
   * zodat zij facturen kunnen ontvangen via het netwerk.
   * 
   * @param {Object} participant
   * @param {string} participant.kboNumber - KBO-nummer (verplicht voor België)
   * @param {string} participant.contactEmail - E-mail voor notificaties
   * @param {string} participant.contactFirstName - Voornaam contactpersoon
   * @param {string} participant.contactLastName - Achternaam contactpersoon
   * @param {string} [participant.contactPhone] - Telefoonnummer
   * @param {string} [participant.language='NL'] - Taal (NL, FR, EN)
   * @returns {Object} { success, peppolId, registrationDate }
   */
  async registerParticipant(participant) {
    const kboClean = participant.kboNumber.replace(/\./g, '');
    const peppolId = `0208:${kboClean}`;

    this._log(`Registering participant: ${peppolId}`);

    const body = {
      peppolIdentifier: peppolId,
      contact: {
        email: participant.contactEmail,
        firstName: participant.contactFirstName,
        lastName: participant.contactLastName,
        language: participant.language || 'NL',
      },
    };

    if (participant.contactPhone) {
      body.contact.phoneNumber = participant.contactPhone;
    }

    const result = await this._request('POST', '/peppol/participants', body);

    if (result.success) {
      this._log(`Participant registered: ${peppolId}`);
      return {
        success: true,
        peppolId,
        registrationDate: result.data?.registrationDate,
        data: result.data,
      };
    } else {
      this._log(`Failed to register participant: ${result.error}`);
      return { success: false, error: result.error };
    }
  }

  /**
   * 4. LIJST VAN VERSTUURDE DOCUMENTEN
   * 
   * Haal de status op van eerder verstuurde documenten.
   */
  async getOutboundDocuments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = `/peppol/outbound-documents${query ? '?' + query : ''}`;
    return this._request('GET', path);
  }

  /**
   * 5. LIJST VAN ONTVANGEN DOCUMENTEN
   * 
   * Haal binnenkomende Peppol-documenten op.
   */
  async getInboundDocuments(params = {}) {
    const query = new URLSearchParams(params).toString();
    const path = `/peppol/inbound-documents${query ? '?' + query : ''}`;
    return this._request('GET', path);
  }

  /**
   * 6. HAAL EEN SPECIFIEK DOCUMENT OP
   * 
   * Download de volledige UBL XML van een ontvangen document.
   * 
   * @param {string} documentId - Document ID uit de lijst
   * @returns {Object} { success, xml }
   */
  async getDocument(documentId) {
    const result = await this._request('GET', `/peppol/documents/${documentId}`);
    return result;
  }
}


// ── CONVENIENCE FUNCTION: VOLLEDIGE FLOW ─────────────────────────────────

/**
 * Volledige flow: valideer → genereer UBL → check ontvanger → verstuur
 * 
 * @param {OrionPeppol} peppolClient - Geïnitialiseerde Peppol client
 * @param {Object} invoiceData - Factuurdata (zie orion-ubl-generator.js)
 * @param {Object} OrionUBL - De UBL generator module
 * @returns {Object} { success, step, documentId, errors }
 */
async function sendInvoiceFlow(peppolClient, invoiceData, OrionUBL) {
  const result = { success: false, step: '', errors: [] };

  // Stap 1: Valideer
  result.step = 'validate';
  const errors = OrionUBL.validateInvoiceData(invoiceData);
  if (errors.length > 0) {
    result.errors = errors;
    return result;
  }

  // Stap 2: Check of ontvanger op Peppol zit
  result.step = 'check-recipient';
  const recipientCheck = await peppolClient.checkBelgianCompany(
    invoiceData.buyer.kboNumber,
    invoiceData.buyer.vatNumber
  );

  if (!recipientCheck.found) {
    result.errors = [`Ontvanger ${invoiceData.buyer.name} (KBO: ${invoiceData.buyer.kboNumber}) is niet gevonden op het Peppol-netwerk. Neem contact op met de ontvanger om zich te registreren.`];
    return result;
  }

  // Stap 3: Genereer UBL XML
  result.step = 'generate-ubl';
  const ublXml = OrionUBL.generateUBLInvoice(invoiceData);

  // Stap 4: Verstuur via Peppol
  result.step = 'send';
  const sendResult = await peppolClient.sendInvoice(ublXml);

  if (sendResult.success) {
    result.success = true;
    result.documentId = sendResult.documentId;
    result.step = 'complete';
    result.ublXml = ublXml; // Bewaar voor archivering
  } else {
    result.errors = [sendResult.error];
  }

  return result;
}


// ── EXPORTS ────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OrionPeppol, sendInvoiceFlow };
}

if (typeof window !== 'undefined') {
  window.OrionPeppol = OrionPeppol;
  window.sendInvoiceFlow = sendInvoiceFlow;
}
