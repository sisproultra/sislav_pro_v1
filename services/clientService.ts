
import { Client } from '../types';

export const searchClient = async (docType: 'DNI' | 'RUC', number: string, apiToken: string): Promise<Partial<Client> | null> => {
  if (!number || !apiToken) {
    if(!apiToken) console.warn("Token de API no configurado en Ajustes > APIs");
    return null;
  }

  const endpoint = docType === 'DNI' ? 'reniec/dni' : 'sunat/ruc';
  const url = `/api-proxy/decolecta/${endpoint}?numero=${number}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      }
    });

    if (!response.ok) return null;

    const rawData = await response.json();
    const data = rawData.data || rawData.result || rawData;

    if (!data) return null;

    const sunatStatus = data.estado || data.status || '';
    const sunatCondition = data.condicion || data.condition || '';

    if (docType === 'DNI') {
      let fullName = '';
      if (data.full_name) {
        fullName = data.full_name;
      } else if (data.first_name || data.first_last_name) {
         const nombre = data.first_name || '';
         const apePat = data.first_last_name || '';
         const apeMat = data.second_last_name || '';
         fullName = `${nombre} ${apePat} ${apeMat}`.trim();
      } else {
         const nombres = data.nombres || data.Nombres || data.nombre || '';
         const apePat = data.apellidoPaterno || data.apellido_paterno || data.ApellidoPaterno || '';
         const apeMat = data.apellidoMaterno || data.apellido_materno || data.ApellidoMaterno || '';
         fullName = `${nombres} ${apePat} ${apeMat}`.trim();
      }

      if (!fullName) return null;

      return {
        docType: 'DNI',
        docNumber: data.document_number || data.dni || number,
        name: fullName,
        address: '',
        sunatStatus,
        sunatCondition
      };
    } else {
      const razonSocial = data.razonSocial || data.razon_social || data.nombreComercial || data.nombre_comercial || data.nombre;
      if (!razonSocial) return null;

      let direccionCompleta = data.direccion || data.direccion_completa || '';
      if (!direccionCompleta && (data.departamento || data.provincia || data.distrito)) {
          const dep = data.departamento || '';
          const prov = data.provincia || '';
          const dist = data.distrito || '';
          direccionCompleta = `${dep} - ${prov} - ${dist}`.replace(/^ - | - $/g, '');
      }

      return {
        docType: 'RUC',
        docNumber: data.ruc || number,
        name: razonSocial,
        address: direccionCompleta,
        sunatStatus,
        sunatCondition,
        ubigeo: data.ubigeo || '',
        urbanizacion: data.urbanizacion || '',
        distrito: data.distrito || '',
        provincia: data.provincia || '',
        departamento: data.departamento || ''
      };
    }
  } catch (error) {
    console.error("Error técnico al consultar API:", error);
    throw error;
  }
};
