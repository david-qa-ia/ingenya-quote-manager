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
  readonly footerBusinessText: string;
  readonly logo?: DeploymentLogoConfig;
}
