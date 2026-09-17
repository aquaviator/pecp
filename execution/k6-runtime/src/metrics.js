// PECP Stable k6 Runtime - Custom Metrics
import { Counter, Rate, Trend } from 'k6/metrics';

// Workload Arrival Demand metrics (Prerequisite tracking, Constitution §10)
export const workloadArrivalDemand = new Counter('pecp_workload_arrival_demand');
export const workloadAttainmentRate = new Rate('pecp_workload_attainment_rate');

// Journey transaction duration trends
export const journeyDurationTrend = new Trend('pecp_journey_duration_ms', true);
