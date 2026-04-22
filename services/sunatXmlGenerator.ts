import { Invoice, Company, IgvType, PaymentMethod, IdentityDocumentType } from '../types';

// Helper to format date YYYY-MM-DD
const formatDate = (dateStr: string) => dateStr.split('T')[0];
// Helper to format time HH:mm:ss
const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toTimeString().split(' ')[0];
};

/**
 * Generates the UBL 2.1 Invoice XML (Current SUNAT Standard)
 */
export const generateUBLInvoice = (invoice: Invoice, company: Company): string => {
  const typeCode = invoice.type; // 01 or 03
  const currency = 'PEN';
  const igvRate = company.porcentajeIgv || 18.00;
  const igvFactor = 1 + (igvRate / 100);
  
  // Calculate Totals for XML
  const { gravada, exonerada, inafecta, igv, total } = invoice.totals;

  // Determine Identity Document Code (Catálogo 06)
  let identityType = IdentityDocumentType.SIN_DOCUMENTO;
  if (invoice.client.docType === 'RUC') identityType = IdentityDocumentType.RUC;
  else if (invoice.client.docType === 'DNI') identityType = IdentityDocumentType.DNI;

  // Function to generate a TaxSubtotal block
  const generateGlobalTaxSubtotal = () => {
    let blocks = '';
    
    // Block for IGV (Gravado)
    if (gravada > 0) {
      blocks += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${gravada.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">${igv.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:ID>1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    }
    
    // Block for Exonerado
    if (exonerada > 0) {
       blocks += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${exonerada.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">0.00</cbc:TaxAmount>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:ID>9997</cbc:ID>
                    <cbc:Name>EXO</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    }

    // Block for Inafecto
    if (inafecta > 0) {
       blocks += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${inafecta.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">0.00</cbc:TaxAmount>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:ID>9998</cbc:ID>
                    <cbc:Name>INA</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    }

    return blocks;
  };

  const xml = `<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ccts="urn:un:unece:uncefact:documentation:2"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
    xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
    xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
    xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <ds:Signature Id="SignSUNAT">
                    <ds:SignedInfo>
                        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
                        <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                        <ds:Reference URI="">
                            <ds:Transforms>
                                <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                            </ds:Transforms>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                            <ds:DigestValue>${generateRandomHash()}</ds:DigestValue>
                        </ds:Reference>
                    </ds:SignedInfo>
                    <ds:SignatureValue>${generateRandomSignature()}</ds:SignatureValue>
                </ds:Signature>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ID>${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}</cbc:ID>
    <cbc:IssueDate>${formatDate(invoice.fecha_emision || invoice.date)}</cbc:IssueDate>
    <cbc:IssueTime>${formatTime(invoice.fecha_emision || invoice.date)}</cbc:IssueTime>
    <cbc:InvoiceTypeCode listID="0101">${typeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
    
    <!-- Emisor -->
    <cac:Signature>
        <cbc:ID>${company.ruc}</cbc:ID>
        <cac:SignatoryParty>
            <cac:PartyIdentification>
                <cbc:ID>${company.ruc}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name><![CDATA[${company.razonSocial}]]></cbc:Name>
            </cac:PartyName>
        </cac:SignatoryParty>
        <cac:DigitalSignatureAttachment>
            <cac:ExternalReference>
                <cbc:URI>#SignSUNAT</cbc:URI>
            </cac:ExternalReference>
        </cac:DigitalSignatureAttachment>
    </cac:Signature>
    
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${company.ruc}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name><![CDATA[${company.razonSocial}]]></cbc:Name>
            </cac:PartyName>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${company.razonSocial}]]></cbc:RegistrationName>
                <cac:RegistrationAddress>
                     <cbc:ID>${company.ubigeo}</cbc:ID>
                     <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <!-- Cliente -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${identityType}">${invoice.client.docNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${invoice.client.name}]]></cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>

    <!-- Forma de Pago (Requisito UBL 2.1) -->
    <cac:PaymentTerms>
        <cbc:ID>FormaPago</cbc:ID>
        <cbc:PaymentMeansID>${invoice.paymentMethod === 'CONTADO' ? PaymentMethod.CONTADO : PaymentMethod.CREDITO}</cbc:PaymentMeansID>
        ${invoice.paymentMethod === 'CREDITO' ? `<cbc:Amount currencyID="${currency}">${total.toFixed(2)}</cbc:Amount>` : ''}
    </cac:PaymentTerms>
    
    <!-- Totales Globales -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${igv.toFixed(2)}</cbc:TaxAmount>
        ${generateGlobalTaxSubtotal()}
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${currency}">${(gravada + exonerada + inafecta).toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="${currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${currency}">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    
    <!-- Items -->
    ${invoice.items.map((item, index) => {
       let itemTaxAmount = 0;
       let itemTaxableAmount = 0;
       let priceCode = '01'; 
       let taxExemptionCode = '10'; 
       let taxSchemeId = '1000';
       let taxName = 'IGV';
       let itemPriceNoTax = 0;

       if (item.igvType === IgvType.GRAVADO) {
           itemTaxableAmount = (item.price * item.quantity) / igvFactor;
           itemTaxAmount = (item.price * item.quantity) - itemTaxableAmount;
           itemPriceNoTax = item.price / igvFactor;
       } else if (item.igvType === IgvType.EXONERADO) {
           taxExemptionCode = '20';
           taxSchemeId = '9997';
           taxName = 'EXO';
           itemTaxableAmount = item.price * item.quantity;
           itemTaxAmount = 0;
           itemPriceNoTax = item.price;
       } else if (item.igvType === IgvType.INAFECTO) {
           taxExemptionCode = '30';
           taxSchemeId = '9998';
           taxName = 'INA';
           itemTaxableAmount = item.price * item.quantity;
           itemTaxAmount = 0;
           itemPriceNoTax = item.price;
       }

       return `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${item.unitCode}">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${currency}">${itemTaxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternativeConditionPrice>
                <cbc:PriceAmount currencyID="${currency}">${item.price.toFixed(2)}</cbc:PriceAmount>
                <cbc:PriceTypeCode>${priceCode}</cbc:PriceTypeCode>
            </cac:AlternativeConditionPrice>
        </cac:PricingReference>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${currency}">${itemTaxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="${currency}">${itemTaxableAmount.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="${currency}">${itemTaxAmount.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:Percent>${item.igvType === IgvType.GRAVADO ? igvRate.toFixed(2) : '0.00'}</cbc:Percent>
                    <cbc:TaxExemptionReasonCode>${taxExemptionCode}</cbc:TaxExemptionReasonCode>
                    <cac:TaxScheme>
                        <cbc:ID>${taxSchemeId}</cbc:ID>
                        <cbc:Name>${taxName}</cbc:Name>
                        <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description><![CDATA[${item.name}]]></cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${currency}">${itemPriceNoTax.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
    }).join('')}
</Invoice>`;

  return xml;
};

// Simulation helpers
const generateRandomHash = () => {
  return Array.from({ length: 28 }, () => Math.floor(Math.random() * 36).toString(36)).join('') + '=';
};

const generateRandomSignature = () => {
  return Array.from({ length: 100 }, () => Math.floor(Math.random() * 36).toString(36)).join('') + '==';
};