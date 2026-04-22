
/**
 * Utility to fix common character encoding issues, specifically the letter 'Ñ'
 * which often appears as the replacement character () due to encoding mismatches.
 */
export const fixEncoding = (str: string | null | undefined): string => {
  if (!str) return '';
  
  // 1. Replace the replacement character  (\uFFFD) when it's likely an 'Ñ'
  // In Spanish, if we see a replacement character between letters or in a context like "PAO",
  // it's almost certainly an 'Ñ'.
  let fixed = str.replace(/\uFFFD/g, 'Ñ');

  // 2. Fix cases where UTF-8 was misinterpreted as ISO-8859-1 (Common: Ã‘ -> Ñ)
  fixed = fixed.replace(/Ã‘/g, 'Ñ');
  fixed = fixed.replace(/Ã±/g, 'ñ');
  
  // 3. Fix other common accented characters if they show up corrupted
  // Ã¡ -> á, Ã© -> é, Ã­ -> í, Ã³ -> ó, Ãº -> ú
  fixed = fixed.replace(/Ã¡/g, 'á');
  fixed = fixed.replace(/Ã©/g, 'é');
  fixed = fixed.replace(/Ã­/g, 'í');
  fixed = fixed.replace(/Ã³/g, 'ó');
  fixed = fixed.replace(/Ãº/g, 'ú');
  fixed = fixed.replace(/Ã\u0081/g, 'Á');
  fixed = fixed.replace(/Ã\u0089/g, 'É');
  fixed = fixed.replace(/Ã\u008D/g, 'Í');
  fixed = fixed.replace(/Ã\u0093/g, 'Ó');
  fixed = fixed.replace(/Ã\u009A/g, 'Ú');

  return fixed;
};
