export type DatabaseField = 
  | 'email' 
  | 'first_name' 
  | 'last_name' 
  | 'phone' 
  | 'tags' 
  | 'persona' 
  | 'sms_opt_in' 
  | 'skip';

export interface ColumnMapping {
  csvHeader: string;
  databaseField: DatabaseField;
  sampleData: string[];
  aiConfidence?: 'high' | 'medium' | 'low';
  aiReasoning?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export type ImportStage = 'upload' | 'mapping' | 'importing' | 'complete';

export interface ImportProgress {
  stage: ImportStage;
  progress: number;
  message: string;
  currentBatch?: number;
  totalBatches?: number;
}

export interface AIAnalysisResult {
  success: boolean;
  analysis: {
    columnNames: string[];
    dataConsistency: {
      isConsistent: boolean;
      issues: string[];
      rowsAnalyzed: number;
    };
    suggestedMappings: Array<{
      columnIndex: number;
      columnName: string;
      suggestedField: DatabaseField;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>;
  };
  error?: string;
}
