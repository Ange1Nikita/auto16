/**
 * Маска телефона +7 (XXX) XXX-XX-XX для всех input[type="tel"].
 */
export function initFormsMask() {
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', e => {
      e.target.value = formatPhone(e.target.value);
    });
    input.addEventListener('focus', e => {
      if (!e.target.value) e.target.value = '+7 ';
    });
    input.addEventListener('blur', e => {
      if (e.target.value === '+7 ') e.target.value = '';
    });
  });
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  let cleaned = digits;
  if (cleaned.startsWith('8')) cleaned = '7' + cleaned.slice(1);
  if (!cleaned.startsWith('7')) cleaned = '7' + cleaned;

  let out = '+7';
  if (cleaned.length > 1) out += ' (' + cleaned.slice(1, 4);
  if (cleaned.length >= 4) out += ')';
  if (cleaned.length >= 5) out += ' ' + cleaned.slice(4, 7);
  if (cleaned.length >= 8) out += '-' + cleaned.slice(7, 9);
  if (cleaned.length >= 10) out += '-' + cleaned.slice(9, 11);
  return out;
}

export function isValidPhone(value) {
  return value.replace(/\D/g, '').length === 11;
}
