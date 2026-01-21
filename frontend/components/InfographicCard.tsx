import React, { useEffect, useRef } from 'react';
// @ts-ignore
import { Infographic } from '@antv/infographic';

interface InfographicCardProps {
  syntax: string;
  width?: string | number;
  height?: string | number;
  onLoaded?: () => void;
  onError?: (error: Error) => void;
}

export const InfographicCard: React.FC<InfographicCardProps> = ({ syntax, width = '100%', height = 400, onLoaded, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const infographicRef = useRef<Infographic | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      if (!infographicRef.current) {
        infographicRef.current = new Infographic({
          container: containerRef.current,
          width: width,
          height: height,
          editable: false,
        });

        if (onLoaded) {
          infographicRef.current.on('loaded', onLoaded);
        }

        if (onError) {
          infographicRef.current.on('error', (errors: any) => {
            onError(new Error(Array.isArray(errors) ? errors[0]?.message : 'Render failed'));
          });
        }
      }

      infographicRef.current.render(syntax);
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
    }

    return () => {
      if (infographicRef.current) {
        infographicRef.current.destroy();
        infographicRef.current = null;
      }
    };
  }, [syntax, width, height, onLoaded, onError]);

  return <div ref={containerRef} style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height }} className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-200" />;
};
