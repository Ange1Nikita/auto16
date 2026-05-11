/**
 * Radio cards — карточки тарифов в калькуляторе.
 * При клике подсвечивает выбранную карточку (визуально), input уже обновляется.
 */
export function initRadioCards() {
  document.querySelectorAll('.radio-card input[type="radio"]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const name = input.name;
      document.querySelectorAll(`.radio-card input[name="${name}"]`).forEach(other => {
        const card = other.closest('.radio-card');
        if (card) card.classList.toggle('is-selected', other.checked);
      });
    });
  });
}
