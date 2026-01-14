import { useRef, useCallback, useState } from 'react';
import { AnalysisResult } from '@/utils/analysisEngine';

interface ProgressInfo {
  step: string;
  percent: number;
}

interface WorkerResponse {
  type: 'result' | 'error' | 'progress';
  payload: AnalysisResult | string | ProgressInfo;
}

export const useAnalysisWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo>({ step: '', percent: 0 });

  const analyze = useCallback((
    headers: string[],
    data: any[][],
    customThresholds?: {
      parent: number;
      childrenMin: number;
      childrenMax: number;
      sku: number;
      minPropertiesPerLevel?: number;
    },
    forcedHeaders?: string[]
  ): Promise<AnalysisResult> => {
    return new Promise((resolve, reject) => {
      // Create worker if not exists
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/analysisWorker.ts', import.meta.url),
          { type: 'module' }
        );
      }

      const worker = workerRef.current;
      setIsAnalyzing(true);
      setProgress({ step: 'Starting...', percent: 0 });

      // Handle response
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, payload } = event.data;
        
        if (type === 'progress') {
          // Update progress state
          setProgress(payload as ProgressInfo);
        } else if (type === 'result') {
          setIsAnalyzing(false);
          setProgress({ step: 'Complete!', percent: 100 });
          worker.removeEventListener('message', handleMessage);
          resolve(payload as AnalysisResult);
        } else if (type === 'error') {
          setIsAnalyzing(false);
          setProgress({ step: 'Error', percent: 0 });
          worker.removeEventListener('message', handleMessage);
          reject(new Error(payload as string));
        }
      };

      worker.addEventListener('message', handleMessage);

      // Handle errors
      worker.onerror = (error) => {
        setIsAnalyzing(false);
        setProgress({ step: 'Error', percent: 0 });
        reject(error);
      };

      // Send data to worker
      worker.postMessage({
        type: 'analyze',
        payload: {
          headers,
          data,
          customThresholds,
          forcedHeaders,
        },
      });
    });
  }, []);

  // Cleanup worker on unmount
  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return { analyze, isAnalyzing, progress, terminate };
};
