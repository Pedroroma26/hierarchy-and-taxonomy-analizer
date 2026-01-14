// Web Worker for heavy analysis computation
// This runs in a separate thread to avoid blocking the UI

import { analyzeProductData } from '@/utils/analysisEngine';

// Worker message types
interface WorkerMessage {
  type: 'analyze';
  payload: {
    headers: string[];
    data: any[][];
    customThresholds?: {
      parent: number;
      childrenMin: number;
      childrenMax: number;
      sku: number;
      minPropertiesPerLevel?: number;
    };
    forcedHeaders?: string[];
  };
}

// Send progress update to main thread
const sendProgress = (step: string, percent: number) => {
  self.postMessage({
    type: 'progress',
    payload: { step, percent },
  });
};

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'analyze') {
    try {
      // Immediate feedback
      sendProgress('Initializing analysis...', 5);
      
      const startTime = performance.now();
      const totalRows = payload.data.length;
      const totalHeaders = payload.headers.length;
      
      // Progress: Loading data
      sendProgress(`Loading ${totalRows.toLocaleString()} rows...`, 10);
      
      // Small delay to allow UI to update before heavy computation
      setTimeout(() => {
        sendProgress(`Analyzing ${totalHeaders} attributes...`, 20);
        
        setTimeout(() => {
          sendProgress('Calculating cardinality scores...', 35);
          
          setTimeout(() => {
            sendProgress('Detecting hierarchy levels...', 50);
            
            setTimeout(() => {
              sendProgress('Building taxonomy structure...', 70);
              
              setTimeout(() => {
                sendProgress('Generating presets...', 85);
                
                // Now run the actual analysis
                const result = analyzeProductData(
                  payload.headers,
                  payload.data,
                  payload.customThresholds,
                  payload.forcedHeaders
                );
                
                const endTime = performance.now();
                console.log(`✅ [Worker] Analysis complete in ${(endTime - startTime).toFixed(0)}ms`);
                
                sendProgress('Complete!', 100);
                
                // Send result back to main thread
                self.postMessage({
                  type: 'result',
                  payload: result,
                });
              }, 50);
            }, 50);
          }, 50);
        }, 50);
      }, 10);
      
    } catch (error) {
      console.error('❌ [Worker] Analysis error:', error);
      self.postMessage({
        type: 'error',
        payload: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

export {};
