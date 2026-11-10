export interface DeploymentLogoConfig {
  readonly dataUrl: string;
  readonly format: 'PNG' | 'JPEG';
}

export interface DeploymentBrandConfig {
  readonly companyName: string;
  readonly experienceMessage?: string;
  readonly email: string;
  readonly whatsapp: {
    readonly display: string;
    readonly value: string;
  };
  readonly instagram?: string;
  /** SCRUM-119: optional website shown in the PDF header. */
  readonly website?: string;
  readonly footerBusinessText: string;
  /** SCRUM-119: days a quote stays valid; the PDF shows the resulting date. */
  readonly quoteValidityDays?: number;
  readonly logo?: DeploymentLogoConfig;
  /** Brand color of the quote PDF (#RRGGBB); Ventro blue when absent. */
  readonly accentColor?: string;
}
