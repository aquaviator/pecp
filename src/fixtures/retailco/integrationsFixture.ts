import { IntegrationDefinition } from '../../types';

export const INITIAL_INTEGRATIONS_FIXTURE: IntegrationDefinition[] = [
  {
    id: 'integ-ado',
    name: 'Azure DevOps',
    category: 'ALM',
    description: 'Work item synchronization, requirements, NFR tracking, defect logging, and pipeline orchestration.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'Awaiting customer PAT and Organization URL binding'
  },
  {
    id: 'integ-jira',
    name: 'Jira',
    category: 'ALM',
    description: 'Issue tracking, engineering story linking, sprint boards, and bug escalation.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'Awaiting Jira Cloud API token or Data Center endpoint'
  },
  {
    id: 'integ-confluence',
    name: 'Confluence',
    category: 'DOCUMENTS',
    description: 'Automated publishing of generated Performance Strategy, Test Plans, and Governance Evidence packages.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'Space key and publishing template unassigned'
  },
  {
    id: 'integ-sharepoint',
    name: 'SharePoint',
    category: 'DOCUMENTS',
    description: 'Enterprise document ingestion (HLD, LLD, spreadsheets) and formal DOCX/PDF sign-off archiving.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'Microsoft Graph tenant permissions pending'
  },
  {
    id: 'integ-ai-provider',
    name: 'AI Provider',
    category: 'AI',
    description: 'Bring Your Own AI (BYOAI): Customer-managed LLM endpoint for drafting, extraction, and explanation.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'PECP deterministically owns canonical state; AI assists drafting only'
  },
  {
    id: 'integ-k6',
    name: 'k6',
    category: 'TESTING_ENGINE',
    description: 'First supported execution engine: Script generation, threshold mapping, and customer-controlled runner orchestration.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'CLI / Docker runner integration ready for customer trigger'
  },
  {
    id: 'integ-jmeter',
    name: 'JMeter',
    category: 'TESTING_ENGINE',
    description: 'Legacy and enterprise thread-group test plan generation and results parser.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'JMX template compiler unconfigured'
  },
  {
    id: 'integ-otel-prom',
    name: 'Prometheus / OpenTelemetry',
    category: 'OBSERVABILITY',
    description: 'Live APM telemetry ingestion, saturation curve correlation, and metric gate verification.',
    status: 'NOT_CONFIGURED',
    availableModes: ['MOCK', 'SANDBOX', 'LIVE'],
    currentMode: 'MOCK',
    configSummary: 'OTLP collector endpoint pending network ingress'
  }
];
