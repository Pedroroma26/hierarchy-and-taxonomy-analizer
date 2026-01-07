// Shared type definitions used across the application

export interface HierarchyLevel {
  level: number;
  name: string;
  headers: string[];
  recordId?: string;
  recordName?: string;
  cardinality?: number;
}
