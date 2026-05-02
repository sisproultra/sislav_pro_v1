export const applyDynamicManifest = (config: {
  name: string;
  shortName?: string;
  iconUrl: string;
  themeColor?: string;
  backgroundColor?: string;
  startUrl?: string;
}) => {
  // IMPORTANTE: Usar data URI en lugar de blob URL
  // Los blob URLs fallan en Service Workers de algunos browsers móviles
  
  const manifest = {
    name: config.name,
    short_name: config.shortName || config.name.substring(0, 12),
    description: `Sistema de gestión — ${config.name}`,
    start_url: config.startUrl || window.location.origin + window.location.pathname,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: config.backgroundColor || '#0d0f14',
    theme_color: config.themeColor || '#1A6EF5',
    icons: [
      {
        src: config.iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: config.iconUrl,
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };

  // Serializar el manifest a JSON string
  const manifestStr = JSON.stringify(manifest);
  
  // Usar data URI (base64) en lugar de blob URL — funciona en todos los browsers
  const base64 = btoa(unescape(encodeURIComponent(manifestStr)));
  const dataUri = `data:application/json;base64,${base64}`;

  // Aplicar al <link rel="manifest">
  let manifestLink = document.querySelector(
    "link[rel='manifest']"
  ) as HTMLLinkElement;
  
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = dataUri;

  // Aplicar favicon
  if (config.iconUrl) {
    let faviconLink = document.querySelector(
      "link[rel~='icon']"
    ) as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = config.iconUrl;
    faviconLink.type = 'image/png';

    // Apple touch icon (iOS)
    let appleLink = document.querySelector(
      "link[rel='apple-touch-icon']"
    ) as HTMLLinkElement;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = config.iconUrl;
  }

  // Meta theme-color
  let metaTheme = document.querySelector(
    "meta[name='theme-color']"
  ) as HTMLMetaElement;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = config.themeColor || '#1A6EF5';

  // Meta apple mobile
  let metaApple = document.querySelector(
    "meta[name='apple-mobile-web-app-capable']"
  ) as HTMLMetaElement;
  if (!metaApple) {
    metaApple = document.createElement('meta');
    metaApple.name = 'apple-mobile-web-app-capable';
    metaApple.content = 'yes';
    document.head.appendChild(metaApple);
  }

  let metaAppleTitle = document.querySelector(
    "meta[name='apple-mobile-web-app-title']"
  ) as HTMLMetaElement;
  if (!metaAppleTitle) {
    metaAppleTitle = document.createElement('meta');
    metaAppleTitle.name = 'apple-mobile-web-app-title';
    document.head.appendChild(metaAppleTitle);
  }
  metaAppleTitle.content = config.name;

  console.log(`✅ PWA Manifest aplicado para: ${config.name}`);
};
