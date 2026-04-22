/**
 * Extrae el nombre amigable según el tipo de documento y formato
 * Reglas según requerimiento de AGRINOVA:
 * - DNI: Toma la 3ra palabra (Formato: Apellidos Apellidos Nombre)
 * - RUC: Empresa, mantiene nombre completo
 * - Otros/Manual: Toma la 1ra palabra (Formato: Nombre Nombre Apellidos)
 */
export const getFriendlyName = (fullName: string | undefined, docType: string | undefined): string => {
  if (!fullName || fullName.trim() === '') return 'CLIENTE';
  
  const doc = (docType || '').toUpperCase();
  const name = fullName.trim();
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // REGLA RUC: Es una empresa, mantenemos el nombre completo
  if (doc === 'RUC') {
    return name.toUpperCase();
  }

  // REGLA DNI: Formato oficial APELLIDO P. + APELLIDO M. + NOMBRES
  if (doc === 'DNI') {
    if (words.length >= 3) {
      return words[2].toUpperCase(); // Tercera palabra (Ej: OSNAR o JHON)
    }
  }

  // REGLA "-" o MANUAL: Formato libre, solemos empezar por el nombre
  return words[0].toUpperCase(); // Primera palabra (Ej: JOSE o JOSEFIN)
};
