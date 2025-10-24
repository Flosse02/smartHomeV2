// Tiny DOM helpers (local so this file is self-contained)
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function initTabs({
  barSelector = '#tabs-bar',
  buttonSelector = '[data-tab]',
  activeAttr = 'data-active',
  mountTargetId = 'upper-pane',
  defaultTab = null,
  views = {}, // { tabName: () => import('...') }
} = {}) {
  const bar = $(barSelector);
  const buttons = bar ? $$(buttonSelector, bar) : [];
  const mountTarget = document.getElementById(mountTargetId);
  if (!bar || !buttons.length || !mountTarget) {
    console.warn('tabs: missing bar/buttons/target', { bar, buttons, mountTarget });
    return;
  }

  // Keep loaded views: { [tab]: { api, mounted } }
  const registry = Object.create(null);

  // Button state helper
  function setActiveButton(tab) {
    buttons.forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      if (isActive) btn.setAttribute(activeAttr, 'true');
      else btn.removeAttribute(activeAttr);
    });
  }

  // Hide all mounted views
  function hideAll() {
    Object.values(registry).forEach(({ api }) => {
      try { api.hide?.(); } catch {}
    });
  }

  // Load (if needed) and show a tab
  async function activate(tab) {
    const loader = views[tab];
    if (!loader) {
      console.warn(`tabs: no view loader for "${tab}"`);
      return;
    }

    setActiveButton(tab);

    if (!registry[tab]) {
      try {
        const mod = await loader();
        // Default API surface with graceful fallbacks
        const api = {
          mount: mod.mount || ((el) => { el.innerHTML = `<div class="p-4">[${tab}] view</div>`; }),
          show:  mod.show  || (() => {}),
          hide:  mod.hide  || (() => {}),
        };
        // Clear target before first mount to avoid stacking content
        mountTarget.replaceChildren();
        api.mount(mountTarget);
        registry[tab] = { api, mounted: true };
        // hide others then show this one
        hideAll();
        api.show();
      } catch (e) {
        console.error(`tabs: failed to load view "${tab}"`, e);
      }
      return;
    }

    // Already loaded: just switch
    hideAll();
    // Replace content with this view's root if your mount strategy swaps DOM;
    // If your view manages its own visibility internally, just call show().
    registry[tab].api.show();
  }

  // Click handlers
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      activate(tab);
    });
  });

  // Activate default
  const initial = defaultTab || buttons[0]?.dataset.tab;
  if (initial) {
    // reflect active button state now (so styles update immediately)
    setActiveButton(initial);
    // activate after a tick so the page paints quickly
    queueMicrotask(() => activate(initial));
  }
}
