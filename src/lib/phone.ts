/**
 * Utility functions for phone number normalization and formatting
 */

/**
 * Normaliza um número de telefone removendo caracteres especiais
 * e sufixos do WhatsApp
 * @param phone - Número de telefone a ser normalizado
 * @returns Número normalizado contendo apenas dígitos
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  
  // Remove @s.whatsapp.net se existir
  let normalized = phone.replace(/@s\.whatsapp\.net/g, '');
  
  // Remove todos os caracteres não numéricos
  normalized = normalized.replace(/\D/g, '');
  
  return normalized;
};

/**
 * Normaliza um número de telefone brasileiro para comparação de duplicatas
 * Considera números com/sem o 9° dígito como iguais
 * Ex: 5565999852826 e 556599852826 serão normalizados para o mesmo valor
 * @param phone - Número de telefone a ser normalizado
 * @returns Número normalizado para comparação (sempre com 9° dígito se BR celular)
 */
export const normalizePhoneForComparison = (phone: string): string => {
  let normalized = normalizePhone(phone);
  
  // Se começa com 55 (Brasil)
  if (normalized.startsWith('55')) {
    // Número com 12 dígitos (55 + DDD 2 dígitos + 8 dígitos = formato antigo celular)
    if (normalized.length === 12) {
      const ddd = normalized.slice(2, 4);
      const number = normalized.slice(4);
      
      // Se o número local tem 8 dígitos, adiciona o 9
      // Celulares no Brasil começam com 9, 8, ou 7 após o DDD no formato antigo
      if (number.length === 8) {
        normalized = `55${ddd}9${number}`;
      }
    }
    // Número com 13 dígitos já está no formato correto (55 + DDD + 9 dígitos)
  }
  
  return normalized;
};

/**
 * Formata um número de telefone brasileiro no padrão (XX) XXXXX-XXXX
 * @param phone - Número de telefone a ser formatado
 * @returns Número formatado
 */
export const formatPhone = (phone: string): string => {
  const normalized = normalizePhone(phone);
  
  if (normalized.length === 11) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
  } else if (normalized.length === 10) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  
  return normalized;
};

/**
 * Valida se um número de telefone brasileiro é válido
 * @param phone - Número de telefone a ser validado
 * @returns true se o número é válido
 */
export const isValidPhone = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 && normalized.length <= 11;
};
