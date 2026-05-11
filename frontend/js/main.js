/**
 * Точка входа фронтенда автоперевозок.
 */
import { initHeader } from './modules/header.js?v=7';
import { initMobileMenu } from './modules/mobile-menu.js?v=7';
import { initStickyCta } from './modules/sticky-cta.js?v=7';
import { initReveal } from './modules/reveal.js?v=7';
import { initCounters } from './modules/counters.js?v=7';
import { initRadioCards } from './modules/radio-cards.js?v=7';
import { initCalculator } from './modules/calculator.js?v=7';
import { initCallback } from './modules/callback.js?v=7';
import { initFormsMask } from './modules/forms.js?v=7';
import { initFleet } from './modules/fleet.js?v=7';
import { initHeroForm } from './modules/hero-form.js?v=7';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initStickyCta();
  initReveal();
  initCounters();
  initRadioCards();
  initFormsMask();
  initHeroForm();
  initCalculator();
  initCallback();
  initFleet();
});
