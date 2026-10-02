import { useEffect, useRef, useState } from 'react';
import { deploymentBrand } from '../config/deploymentBrand';
import type { NavigationSection } from '../utils/appNavigation';
import { getCircularFocusIndex, getVisibleContactItems } from '../utils/appNavigation';

interface AppHeaderProps {
  activeSection: NavigationSection;
  onNewQuote: () => void;
  onShowSavedQuotes: () => void;
  onShowCatalog: () => void;
}

const focusableSelector = 'button:not([disabled]), a[href]';

export function AppHeader({
  activeSection,
  onNewQuote,
  onShowSavedQuotes,
  onShowCatalog,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const wasMenuOpenRef = useRef(false);
  const contactItems = getVisibleContactItems(deploymentBrand);

  useEffect(() => {
    if (isMenuOpen) {
      const firstControl = navigationRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstControl?.focus();
      wasMenuOpenRef.current = true;
      return;
    }

    if (wasMenuOpenRef.current) {
      menuButtonRef.current?.focus();
      wasMenuOpenRef.current = false;
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleMenuKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const controls = Array.from(
        navigationRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      const currentIndex = controls.findIndex((control) => control === document.activeElement);
      const nextIndex = getCircularFocusIndex(
        currentIndex,
        event.shiftKey ? -1 : 1,
        controls.length,
      );

      if (nextIndex >= 0) {
        event.preventDefault();
        controls[nextIndex].focus();
      }
    }

    document.addEventListener('keydown', handleMenuKeyDown);
    return () => {
      document.removeEventListener('keydown', handleMenuKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 640px)');

    function closeMenuOutsideMobile(event: MediaQueryListEvent) {
      if (!event.matches) setIsMenuOpen(false);
    }

    mobileMedia.addEventListener('change', closeMenuOutsideMobile);
    return () => mobileMedia.removeEventListener('change', closeMenuOutsideMobile);
  }, []);

  function navigate(action: () => void) {
    setIsMenuOpen(false);
    action();
  }

  return (
    <header className="site-header">
      {contactItems.length > 0 && (
        <div className="information-bar">
          <div className="header-container information-bar-content">
            {contactItems.map((item) =>
              item.href ? (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span key={item.label}>{item.label}</span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="main-header">
        <div className="header-container main-header-content">
          <div className="brand-name" aria-label={`Aplicación de ${deploymentBrand.companyName}`}>
            {deploymentBrand.companyName}
          </div>

          <button
            ref={menuButtonRef}
            className="mobile-menu-button"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="primary-navigation"
            aria-label={isMenuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}
            onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div
              className="mobile-menu-backdrop"
              aria-hidden="true"
              onClick={() => setIsMenuOpen(false)}
            />
          )}

          <nav
            ref={navigationRef}
            id="primary-navigation"
            className={`primary-navigation ${isMenuOpen ? 'primary-navigation-open' : ''}`}
            aria-label="Navegación principal"
            aria-modal={isMenuOpen ? 'true' : undefined}
            role={isMenuOpen ? 'dialog' : undefined}
          >
            <button
              className="navigation-link"
              type="button"
              aria-current={activeSection === 'savedQuotes' ? 'page' : undefined}
              onClick={() => navigate(onShowSavedQuotes)}
            >
              Mis presupuestos
            </button>
            <button
              className="navigation-link"
              type="button"
              aria-current={activeSection === 'catalog' ? 'page' : undefined}
              onClick={() => navigate(onShowCatalog)}
            >
              Mano de obra
            </button>
            <button
              className="button button-primary header-new-quote"
              type="button"
              aria-current={activeSection === 'newQuote' ? 'page' : undefined}
              onClick={() => navigate(onNewQuote)}
            >
              <span aria-hidden="true">＋</span>
              Nuevo presupuesto
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
