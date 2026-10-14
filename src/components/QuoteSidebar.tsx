import { useState, type ReactNode } from 'react';
import {
  getSidebarTabAfterKey,
  quoteSidebarTabs,
  type QuoteSidebarTab,
} from '../utils/quoteSidebarTabs';

interface Props {
  summary: ReactNode;
  activities: ReactNode;
  commercialStatus: ReactNode;
}

export function QuoteSidebar({ summary, activities, commercialStatus }: Props) {
  const [activeTab, setActiveTab] = useState<QuoteSidebarTab>('summary');
  const contentByTab: Record<QuoteSidebarTab, ReactNode> = {
    summary,
    activities,
    commercialStatus,
  };

  return (
    <section className="quote-sidebar-tabs" aria-label="Panel lateral del presupuesto">
      <div className="quote-sidebar-tab-list" role="tablist" aria-label="Información comercial">
        {quoteSidebarTabs.map((tab) => (
          <button
            key={tab.id}
            id={`quote-sidebar-tab-${tab.id}`}
            className={`quote-sidebar-tab ${activeTab === tab.id ? 'quote-sidebar-tab-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`quote-sidebar-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              const nextTab = getSidebarTabAfterKey(tab.id, event.key);
              if (!nextTab) return;
              event.preventDefault();
              setActiveTab(nextTab);
              document.getElementById(`quote-sidebar-tab-${nextTab}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`quote-sidebar-panel-${activeTab}`}
        className="quote-sidebar-tab-panel"
        role="tabpanel"
        aria-labelledby={`quote-sidebar-tab-${activeTab}`}
      >
        {contentByTab[activeTab]}
      </div>
    </section>
  );
}
