import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    MayanSwap?: {
      init: (elementId: string, config: MayanConfig) => void;
      setSwapInitiateListener: (callback: (data: unknown) => void) => void;
      setSwapCompleteListener: (callback: (data: unknown) => void) => void;
    };
  }
}

interface MayanConfig {
  appIdentity: {
    name: string;
    icon: string;
    uri: string;
  };
  colors?: {
    mainBox?: string;
    background?: string;
    primary?: string;
    secondary?: string;
  };
  rpcs?: Record<string, string>;
  defaultFromChain?: string;
  defaultToChain?: string;
  lockDestinationChain?: boolean;
}

interface MayanWidgetProps {
  onSwapInitiate?: (data: unknown) => void;
  onSwapComplete?: (data: unknown) => void;
  defaultToChain?: string;
  defaultFromChain?: string;
}

export function MayanWidget({ 
  onSwapInitiate, 
  onSwapComplete,
  defaultToChain = 'megaeth',
  defaultFromChain = 'ethereum'
}: MayanWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.mayan.finance/mayan_widget_v_1_2_3.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      scriptLoaded.current = true;
      setIsLoading(false);

      if (window.MayanSwap) {
        const config: MayanConfig = {
          appIdentity: {
            name: 'MegaPortal',
            icon: '/logo.png',
            uri: window.location.origin,
          },
          colors: {
            mainBox: '#1a1a2e',
            background: '#0f0f1a',
            primary: '#00ff88',
            secondary: '#8b5cf6',
          },
          rpcs: {
            megaeth: 'https://mainnet.megaeth.com/rpc',
            ethereum: 'https://eth.llamarpc.com',
          },
          defaultFromChain,
          defaultToChain,
        };

        window.MayanSwap.init('mayan-widget-container', config);

        if (onSwapInitiate) {
          window.MayanSwap.setSwapInitiateListener(onSwapInitiate);
        }
        if (onSwapComplete) {
          window.MayanSwap.setSwapCompleteListener(onSwapComplete);
        }
      } else {
        setHasError(true);
      }
    };

    script.onerror = () => {
      setIsLoading(false);
      setHasError(true);
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [defaultFromChain, defaultToChain, onSwapComplete, onSwapInitiate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mayan-widget-loading">
        <Loader2 className="h-8 w-8 animate-spin text-mega-green" />
        <span className="ml-2 text-gray-400">Loading Mayan Widget...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center" data-testid="mayan-widget-error">
        <p className="text-gray-400 mb-4">
          Mayan Widget not available. Use the direct swap interface instead.
        </p>
        <Button
          variant="outline"
          onClick={() => window.open('https://mayan.finance', '_blank')}
          className="gap-2"
          data-testid="button-open-mayan"
        >
          Open Mayan Finance <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      id="mayan-widget-container" 
      className="w-full min-h-[400px]"
      data-testid="mayan-widget-container"
    />
  );
}

export function MayanSwapButton({ direction }: { direction: 'in' | 'out' }) {
  const [showWidget, setShowWidget] = useState(false);

  const handleOpen = () => {
    const fromChain = direction === 'in' ? 'ethereum' : 'megaeth';
    const toChain = direction === 'in' ? 'megaeth' : 'ethereum';
    
    const url = `https://mayan.finance/?fromChain=${fromChain}&toChain=${toChain}`;
    window.open(url, '_blank');
  };

  return (
    <Button
      onClick={handleOpen}
      className="w-full bg-gradient-to-r from-mega-green to-mega-purple hover:opacity-90"
      data-testid={`button-mayan-${direction}`}
    >
      {direction === 'in' ? 'Bridge via Mayan' : 'Withdraw via Mayan'}
      <ExternalLink className="ml-2 h-4 w-4" />
    </Button>
  );
}
