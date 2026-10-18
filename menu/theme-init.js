if (new URLSearchParams(location.search).get('tema') === 'natale') {
      const theme = document.createElement('link');
      theme.id = 'seasonal-theme'; theme.rel = 'stylesheet'; theme.href = 'themes/natale.css?v=20261011-1';
      document.head.appendChild(theme);
    }
