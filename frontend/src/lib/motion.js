import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

export const EASE = {
  out: 'power3.out',
  inOut: 'power3.inOut',
  snap: 'expo.out',
  back: 'back.out(1.6)',
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/* Lenis lives outside React so any component can drive the scroll without context plumbing. */
let lenisInstance = null;

export function setLenis(instance) {
  lenisInstance = instance;
}

export function getLenis() {
  return lenisInstance;
}

export function scrollToTarget(target, { offset = -96, immediate = false } = {}) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { offset, immediate });
    return;
  }
  const behavior = immediate || prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
    return;
  }
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior });
}

/* Modals and the guided tour freeze the page behind them. */
let scrollLocks = 0;

export function lockScroll() {
  scrollLocks += 1;
  lenisInstance?.stop();
  document.documentElement.classList.add('scroll-locked');
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) {
      lenisInstance?.start();
      document.documentElement.classList.remove('scroll-locked');
    }
  };
}

export { gsap, ScrollTrigger, useGSAP };
