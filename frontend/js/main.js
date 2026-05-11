/**
 * Точка входа фронтенда автоперевозок.
 */
import { initHeader } from './modules/header.js';
import { initMobileMenu } from './modules/mobile-menu.js';
import { initStickyCta } from './modules/sticky-cta.js';
import { initReveal } from './modules/reveal.js';
import { initCounters } from './modules/counters.js';
import { initRadioCards } from './modules/radio-cards.js';
import { initCalculator } from './modules/calculator.js';
import { initCallback } from './modules/callback.js';
import { initFormsMask } from './modules/forms.js';
import { initFleet } from './modules/fleet.js';
import { initHeroForm } from './modules/hero-form.js';

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
