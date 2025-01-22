export interface ResponseTimeMetrics {
  avg_time_hours: number;
  min_time_hours: number;
  max_time_hours: number;
  p50_time_hours: number;
  p90_time_hours: number;
}

export interface PriorityResponseMetrics {
  priority_level: 'low' | 'medium' | 'high';
  avg_time_hours: number;
  p90_time_hours: number;
  ticket_count: number;
}

export interface ResponseTimeData {
  firstResponse: ResponseTimeMetrics | null;
  resolutionTime: ResponseTimeMetrics | null;
  priorityMetrics: PriorityResponseMetrics[];
} 