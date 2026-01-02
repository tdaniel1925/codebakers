/**
 * ENGINEERING TOOLS FOR MCP
 *
 * MCP tools for the AI agent-based engineering workflow.
 * These tools enable enterprise-grade software development with NO FRICTION.
 */

import {
  EngineeringStateManager,
  getStateManager,
  hasEngineeringProject,
  getProjectSummary,
  type ProjectScope,
  type EngineeringPhase,
  type AgentRole,
} from '../lib/engineering-state.js';
import { getApiKey, getApiUrl } from '../config.js';

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const ENGINEERING_TOOLS = [
  {
    name: 'engineering_start',
    description:
      'Start a new engineering build project. This launches the scoping wizard to define what you\'re building. Use when user says "build me a...", "create a new app", "start a new project", or wants to build something from scratch with enterprise-grade engineering process. Returns the first scoping question.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectName: {
          type: 'string',
          description: 'Name for the project (will be used for folder name)',
        },
        description: {
          type: 'string',
          description: 'Brief description of what you\'re building',
        },
      },
      required: ['projectName'],
    },
  },
  {
    name: 'engineering_scope',
    description:
      'Answer a scoping wizard question. Called after engineering_start to progressively define the project scope. Returns the next question or signals scoping is complete.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stepId: {
          type: 'string',
          description: 'ID of the scoping step being answered',
        },
        answer: {
          type: 'string',
          description: 'User\'s answer (for text/single), or JSON array for multiple selection',
        },
      },
      required: ['stepId', 'answer'],
    },
  },
  {
    name: 'engineering_status',
    description:
      'Get the current engineering build status. Shows which phase you\'re in, overall progress, and what\'s next. Use when user asks "where am I?", "show progress", "what phase?", or "what\'s the status?".',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'engineering_advance',
    description:
      'Advance to the next engineering phase after completing the current one. Use after all work in the current phase is done and the gate is passed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        artifacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of artifacts produced in this phase (e.g., ["prd.md", "tech-spec.md"])',
        },
      },
    },
  },
  {
    name: 'engineering_gate',
    description:
      'Pass or fail the current phase gate. Use pass_gate when the phase work is complete and ready for review. Use fail_gate if there\'s an issue that needs to be resolved.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['pass', 'fail'],
          description: 'Whether to pass or fail the gate',
        },
        artifacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Artifacts produced (for pass)',
        },
        reason: {
          type: 'string',
          description: 'Reason for failure (for fail)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'engineering_artifact',
    description:
      'Save or retrieve an engineering artifact (PRD, tech spec, API docs, etc.). Use this to store documents produced during each phase.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['save', 'get', 'list'],
          description: 'Action to perform',
        },
        name: {
          type: 'string',
          description: 'Artifact name (e.g., "prd.md", "tech-spec.md")',
        },
        content: {
          type: 'string',
          description: 'Content to save (for save action)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'engineering_decision',
    description:
      'Record an engineering decision with reasoning. Use this whenever making a significant architectural or design decision. This creates an audit trail of why decisions were made.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent: {
          type: 'string',
          enum: ['orchestrator', 'pm', 'architect', 'engineer', 'qa', 'security', 'documentation', 'devops'],
          description: 'Which agent role is making this decision',
        },
        decision: {
          type: 'string',
          description: 'What was decided',
        },
        reasoning: {
          type: 'string',
          description: 'Why this decision was made',
        },
        alternatives: {
          type: 'array',
          items: { type: 'string' },
          description: 'What alternatives were considered',
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0-100',
        },
        impact: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Impact level of this decision',
        },
      },
      required: ['agent', 'decision', 'reasoning'],
    },
  },
  {
    name: 'engineering_graph_add',
    description:
      'Add a node or edge to the dependency graph. Use this after creating any file to track dependencies between components.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeType: {
          type: 'string',
          enum: ['schema', 'api', 'component', 'service', 'page', 'util', 'config'],
          description: 'Type of node to add',
        },
        name: {
          type: 'string',
          description: 'Name of the node',
        },
        filePath: {
          type: 'string',
          description: 'File path for the node',
        },
        dependsOn: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths this node depends on',
        },
        dependencyTypes: {
          type: 'array',
          items: { type: 'string', enum: ['import', 'api-call', 'db-query', 'event', 'config'] },
          description: 'Types of dependencies (parallel with dependsOn array)',
        },
      },
      required: ['nodeType', 'name', 'filePath'],
    },
  },
  {
    name: 'engineering_impact',
    description:
      'Analyze the impact of changing a file. Use BEFORE modifying any existing file to understand what else might break. Returns affected files, risk level, and recommendations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path of the file you\'re about to change',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'engineering_graph_view',
    description:
      'View the current dependency graph. Use to understand how components are connected before making changes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        focusFile: {
          type: 'string',
          description: 'Optional: Focus on dependencies for a specific file',
        },
      },
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

export async function handleEngineeringTool(
  name: string,
  args: Record<string, unknown>,
  apiUrl: string,
  authHeaders: Record<string, string>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const stateManager = getStateManager();

  switch (name) {
    case 'engineering_start':
      return handleEngineeringStart(stateManager, args as { projectName: string; description?: string });

    case 'engineering_scope':
      return handleEngineeringScope(stateManager, args as { stepId: string; answer: string });

    case 'engineering_status':
      return handleEngineeringStatus(stateManager);

    case 'engineering_advance':
      return handleEngineeringAdvance(stateManager, args as { artifacts?: string[] });

    case 'engineering_gate':
      return handleEngineeringGate(stateManager, args as { action: string; artifacts?: string[]; reason?: string });

    case 'engineering_artifact':
      return handleEngineeringArtifact(stateManager, args as { action: string; name?: string; content?: string });

    case 'engineering_decision':
      return handleEngineeringDecision(stateManager, args as {
        agent: AgentRole;
        decision: string;
        reasoning: string;
        alternatives?: string[];
        confidence?: number;
        impact?: string;
      });

    case 'engineering_graph_add':
      return handleEngineeringGraphAdd(stateManager, args as {
        nodeType: string;
        name: string;
        filePath: string;
        dependsOn?: string[];
        dependencyTypes?: string[];
      });

    case 'engineering_impact':
      return handleEngineeringImpact(stateManager, args as { filePath: string });

    case 'engineering_graph_view':
      return handleEngineeringGraphView(stateManager, args as { focusFile?: string });

    default:
      return {
        content: [{ type: 'text', text: `Unknown engineering tool: ${name}` }],
      };
  }
}

// =============================================================================
// INDIVIDUAL HANDLERS
// =============================================================================

const SCOPING_STEPS = [
  {
    id: 'audience',
    question: 'Who is this for?',
    description: 'Your target users',
    type: 'single',
    options: [
      { value: 'consumers', label: 'Consumers (B2C)' },
      { value: 'businesses', label: 'Businesses (B2B)' },
      { value: 'internal', label: 'Internal Team' },
      { value: 'developers', label: 'Developers (API)' },
    ],
  },
  {
    id: 'isFullBusiness',
    question: 'Is this a full business product?',
    description: 'Needs marketing, analytics, team features, etc.',
    type: 'boolean',
  },
  {
    id: 'platforms',
    question: 'Which platforms?',
    description: 'Where will users access this?',
    type: 'multiple',
    options: [
      { value: 'web', label: 'Web App' },
      { value: 'mobile', label: 'Mobile App' },
      { value: 'api', label: 'API Only' },
    ],
  },
  {
    id: 'hasAuth',
    question: 'Do users need accounts?',
    description: 'Login, signup, profiles',
    type: 'boolean',
  },
  {
    id: 'hasPayments',
    question: 'Will you charge money?',
    description: 'Subscriptions or one-time payments',
    type: 'boolean',
  },
  {
    id: 'hasRealtime',
    question: 'Need real-time features?',
    description: 'Live updates, chat, notifications',
    type: 'boolean',
  },
  {
    id: 'compliance',
    question: 'Any compliance requirements?',
    description: 'Skip if none apply',
    type: 'multiple',
    options: [
      { value: 'hipaa', label: 'HIPAA (Healthcare)' },
      { value: 'pci', label: 'PCI DSS (Payments)' },
      { value: 'gdpr', label: 'GDPR (EU Privacy)' },
      { value: 'soc2', label: 'SOC 2 (Enterprise)' },
      { value: 'coppa', label: 'COPPA (Children)' },
    ],
  },
  {
    id: 'expectedUsers',
    question: 'Expected scale?',
    description: 'Helps with architecture decisions',
    type: 'single',
    options: [
      { value: 'small', label: 'Small (< 1,000 users)' },
      { value: 'medium', label: 'Medium (1K - 100K users)' },
      { value: 'large', label: 'Large (100K - 1M users)' },
      { value: 'enterprise', label: 'Enterprise (1M+ users)' },
    ],
  },
  {
    id: 'launchTimeline',
    question: 'When do you want to launch?',
    description: 'Affects prioritization',
    type: 'single',
    options: [
      { value: 'asap', label: 'ASAP (MVP)' },
      { value: 'weeks', label: 'Few weeks (Core features)' },
      { value: 'months', label: 'Few months (Full feature set)' },
      { value: 'flexible', label: 'Flexible (Quality over speed)' },
    ],
  },
];

async function handleEngineeringStart(
  stateManager: EngineeringStateManager,
  args: { projectName: string; description?: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { projectName, description = '' } = args;

  // Create project
  stateManager.createProject(projectName, description);

  // Return first scoping question
  const firstStep = SCOPING_STEPS[0];
  let response = `# 🏗️ Engineering Build Started: ${projectName}\n\n`;
  response += `I'll guide you through a quick scoping wizard to understand what you're building.\n`;
  response += `This ensures we build with the right architecture from the start.\n\n`;
  response += `---\n\n`;
  response += `## ${firstStep.question}\n`;
  response += `*${firstStep.description}*\n\n`;

  if (firstStep.options) {
    for (const opt of firstStep.options) {
      response += `- **${opt.value}**: ${opt.label}\n`;
    }
  } else if (firstStep.type === 'boolean') {
    response += `Answer: **yes** or **no**\n`;
  }

  response += `\n*Use \`engineering_scope\` with stepId="${firstStep.id}" to answer.*`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringScope(
  stateManager: EngineeringStateManager,
  args: { stepId: string; answer: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { stepId, answer } = args;
  const project = stateManager.getProject();

  if (!project) {
    return { content: [{ type: 'text', text: '❌ No engineering project found. Run `engineering_start` first.' }] };
  }

  // Find current step index
  const currentIndex = SCOPING_STEPS.findIndex(s => s.id === stepId);
  if (currentIndex === -1) {
    return { content: [{ type: 'text', text: `❌ Unknown step: ${stepId}` }] };
  }

  // Update scope based on answer
  const step = SCOPING_STEPS[currentIndex];
  let parsedAnswer: unknown = answer;

  if (step.type === 'boolean') {
    parsedAnswer = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'true';
  } else if (step.type === 'multiple') {
    try {
      parsedAnswer = JSON.parse(answer);
    } catch {
      // If not JSON, split by comma
      parsedAnswer = answer.split(',').map(s => s.trim());
    }
  }

  // Update project scope
  const scopeUpdate: Partial<ProjectScope> = {};
  switch (stepId) {
    case 'audience':
      scopeUpdate.targetAudience = parsedAnswer as 'consumers' | 'businesses' | 'internal' | 'developers';
      break;
    case 'isFullBusiness':
      scopeUpdate.isFullBusiness = parsedAnswer as boolean;
      if (parsedAnswer) {
        scopeUpdate.needsMarketing = true;
        scopeUpdate.needsAnalytics = true;
        scopeUpdate.needsAdminDashboard = true;
      }
      break;
    case 'platforms':
      scopeUpdate.platforms = parsedAnswer as ('web' | 'mobile' | 'api')[];
      break;
    case 'hasAuth':
      scopeUpdate.hasAuth = parsedAnswer as boolean;
      break;
    case 'hasPayments':
      scopeUpdate.hasPayments = parsedAnswer as boolean;
      break;
    case 'hasRealtime':
      scopeUpdate.hasRealtime = parsedAnswer as boolean;
      break;
    case 'compliance':
      const values = parsedAnswer as string[];
      scopeUpdate.compliance = {
        hipaa: values.includes('hipaa'),
        pci: values.includes('pci'),
        gdpr: values.includes('gdpr'),
        soc2: values.includes('soc2'),
        coppa: values.includes('coppa'),
      };
      break;
    case 'expectedUsers':
      scopeUpdate.expectedUsers = parsedAnswer as 'small' | 'medium' | 'large' | 'enterprise';
      break;
    case 'launchTimeline':
      scopeUpdate.launchTimeline = parsedAnswer as 'asap' | 'weeks' | 'months' | 'flexible';
      break;
  }

  stateManager.updateScope(scopeUpdate);

  // Check if there's a next step
  const nextStep = SCOPING_STEPS[currentIndex + 1];

  if (!nextStep) {
    // Scoping complete!
    stateManager.passGate('scoping', ['scope.json'], 'auto');
    stateManager.setPhase('requirements', 'pm');

    stateManager.recordDecision({
      agent: 'orchestrator',
      phase: 'scoping',
      decision: 'Project scope defined',
      reasoning: `Scope completed: ${project.scope.platforms.join(', ')} platforms, ${project.scope.targetAudience} audience`,
      alternatives: [],
      confidence: 100,
      reversible: true,
      impact: 'high',
    });

    const updatedProject = stateManager.getProject()!;

    let response = `# ✅ Scoping Complete!\n\n`;
    response += `## Project: ${updatedProject.name}\n\n`;
    response += `### Scope Summary\n`;
    response += `- **Audience:** ${updatedProject.scope.targetAudience}\n`;
    response += `- **Platforms:** ${updatedProject.scope.platforms.join(', ')}\n`;
    response += `- **Auth:** ${updatedProject.scope.hasAuth ? 'Yes' : 'No'}\n`;
    response += `- **Payments:** ${updatedProject.scope.hasPayments ? 'Yes' : 'No'}\n`;
    response += `- **Realtime:** ${updatedProject.scope.hasRealtime ? 'Yes' : 'No'}\n`;
    response += `- **Full Business:** ${updatedProject.scope.isFullBusiness ? 'Yes' : 'No'}\n`;
    response += `- **Scale:** ${updatedProject.scope.expectedUsers}\n`;
    response += `- **Timeline:** ${updatedProject.scope.launchTimeline}\n\n`;

    response += `### Detected Stack\n`;
    response += `- **Framework:** ${updatedProject.stack.framework}\n`;
    response += `- **Database:** ${updatedProject.stack.database}\n`;
    response += `- **ORM:** ${updatedProject.stack.orm}\n`;
    response += `- **Auth:** ${updatedProject.stack.auth}\n`;
    response += `- **UI:** ${updatedProject.stack.ui}\n\n`;

    response += `---\n\n`;
    response += `## 📋 Next Phase: Requirements\n\n`;
    response += `The PM agent will now create a Product Requirements Document (PRD).\n`;
    response += `This defines exactly what we're building before any code is written.\n\n`;
    response += `*Ready to proceed? Start writing the PRD using the patterns and save with \`engineering_artifact\`.*`;

    return { content: [{ type: 'text', text: response }] };
  }

  // Return next question
  let response = `## ${nextStep.question}\n`;
  response += `*${nextStep.description}*\n\n`;

  if (nextStep.options) {
    for (const opt of nextStep.options) {
      response += `- **${opt.value}**: ${opt.label}\n`;
    }
    if (nextStep.type === 'multiple') {
      response += `\n*Select multiple by providing a JSON array or comma-separated values*\n`;
    }
  } else if (nextStep.type === 'boolean') {
    response += `Answer: **yes** or **no**\n`;
  }

  response += `\n*Use \`engineering_scope\` with stepId="${nextStep.id}" to answer.*`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringStatus(
  stateManager: EngineeringStateManager
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const summary = stateManager.getSummary();

  if (!summary.project || !summary.state) {
    return { content: [{ type: 'text', text: '❌ No engineering project found. Run `engineering_start` to begin.' }] };
  }

  const { project, state, graphStats, decisions, artifacts } = summary;

  const PHASE_NAMES: Record<EngineeringPhase, string> = {
    scoping: 'Scoping',
    requirements: 'Requirements',
    architecture: 'Architecture',
    design_review: 'Design Review',
    implementation: 'Implementation',
    code_review: 'Code Review',
    testing: 'Testing',
    security_review: 'Security Review',
    documentation: 'Documentation',
    staging: 'Staging',
    launch: 'Launch',
  };

  let response = `# 🏗️ Engineering Status: ${project.name}\n\n`;
  response += `## Progress: ${state.overallProgress}%\n\n`;
  response += `### Current Phase: ${PHASE_NAMES[state.currentPhase]}\n`;
  response += `**Agent:** ${state.currentAgent}\n\n`;

  response += `### Phase Status\n`;
  response += `| Phase | Status |\n`;
  response += `|-------|--------|\n`;

  const phases: EngineeringPhase[] = [
    'scoping', 'requirements', 'architecture', 'design_review',
    'implementation', 'code_review', 'testing', 'security_review',
    'documentation', 'staging', 'launch'
  ];

  for (const phase of phases) {
    const gate = state.gates[phase];
    const statusIcon = gate.status === 'passed' ? '✅' :
                       gate.status === 'in_progress' ? '🔄' :
                       gate.status === 'failed' ? '❌' :
                       gate.status === 'skipped' ? '⏭️' : '⬜';
    const current = phase === state.currentPhase ? ' ← Current' : '';
    response += `| ${statusIcon} ${PHASE_NAMES[phase]} | ${gate.status}${current} |\n`;
  }

  response += `\n### Metrics\n`;
  response += `- **Dependency Graph:** ${graphStats.nodes} nodes, ${graphStats.edges} edges\n`;
  response += `- **Decisions Recorded:** ${decisions}\n`;
  response += `- **Artifacts:** ${artifacts.length > 0 ? artifacts.join(', ') : 'None yet'}\n`;

  if (state.blockers.length > 0) {
    response += `\n### ⚠️ Blockers\n`;
    for (const blocker of state.blockers) {
      response += `- ${blocker}\n`;
    }
  }

  response += `\n---\n`;
  response += `*Last activity: ${new Date(state.lastActivity).toLocaleString()}*`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringAdvance(
  stateManager: EngineeringStateManager,
  args: { artifacts?: string[] }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const state = stateManager.getState();
  if (!state) {
    return { content: [{ type: 'text', text: '❌ No engineering project found.' }] };
  }

  const currentGate = state.gates[state.currentPhase];
  if (currentGate.status !== 'passed') {
    return { content: [{ type: 'text', text: `❌ Current phase gate not passed. Use \`engineering_gate\` to pass the ${state.currentPhase} gate first.` }] };
  }

  // Find next phase
  const phases: EngineeringPhase[] = [
    'scoping', 'requirements', 'architecture', 'design_review',
    'implementation', 'code_review', 'testing', 'security_review',
    'documentation', 'staging', 'launch'
  ];

  const currentIndex = phases.indexOf(state.currentPhase);
  if (currentIndex >= phases.length - 1) {
    return { content: [{ type: 'text', text: '🎉 All phases complete! Project is ready for launch.' }] };
  }

  const nextPhase = phases[currentIndex + 1];
  const agentMap: Record<EngineeringPhase, AgentRole> = {
    scoping: 'orchestrator',
    requirements: 'pm',
    architecture: 'architect',
    design_review: 'orchestrator',
    implementation: 'engineer',
    code_review: 'engineer',
    testing: 'qa',
    security_review: 'security',
    documentation: 'documentation',
    staging: 'devops',
    launch: 'devops',
  };

  stateManager.setPhase(nextPhase, agentMap[nextPhase]);

  const PHASE_NAMES: Record<EngineeringPhase, string> = {
    scoping: 'Scoping', requirements: 'Requirements', architecture: 'Architecture',
    design_review: 'Design Review', implementation: 'Implementation', code_review: 'Code Review',
    testing: 'Testing', security_review: 'Security Review', documentation: 'Documentation',
    staging: 'Staging', launch: 'Launch',
  };

  let response = `# ✅ Advanced to ${PHASE_NAMES[nextPhase]} Phase\n\n`;
  response += `**Agent:** ${agentMap[nextPhase]}\n\n`;

  const phaseDescriptions: Record<EngineeringPhase, string> = {
    scoping: 'Define what you\'re building',
    requirements: 'PM agent creates detailed PRD',
    architecture: 'Architect agent designs system structure',
    design_review: 'Review architecture with stakeholders',
    implementation: 'Engineer agents build the features',
    code_review: 'Review code quality and patterns',
    testing: 'QA agent writes and runs tests',
    security_review: 'Security agent audits vulnerabilities',
    documentation: 'Generate comprehensive docs',
    staging: 'Deploy to staging environment',
    launch: 'Final production deployment',
  };

  response += `**Goal:** ${phaseDescriptions[nextPhase]}\n\n`;
  response += `Use \`engineering_gate\` to pass this phase when complete.`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringGate(
  stateManager: EngineeringStateManager,
  args: { action: string; artifacts?: string[]; reason?: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { action, artifacts = [], reason } = args;
  const state = stateManager.getState();

  if (!state) {
    return { content: [{ type: 'text', text: '❌ No engineering project found.' }] };
  }

  if (action === 'pass') {
    stateManager.passGate(state.currentPhase, artifacts, 'auto');
    return {
      content: [{
        type: 'text',
        text: `✅ Gate passed for ${state.currentPhase} phase!\n\nArtifacts: ${artifacts.length > 0 ? artifacts.join(', ') : 'None'}\n\nUse \`engineering_advance\` to move to the next phase.`
      }]
    };
  } else if (action === 'fail') {
    stateManager.failGate(state.currentPhase, reason || 'Gate failed');
    return {
      content: [{
        type: 'text',
        text: `❌ Gate failed for ${state.currentPhase} phase.\n\nReason: ${reason || 'Not specified'}\n\nResolve the issue and try again.`
      }]
    };
  }

  return { content: [{ type: 'text', text: '❌ Invalid action. Use "pass" or "fail".' }] };
}

async function handleEngineeringArtifact(
  stateManager: EngineeringStateManager,
  args: { action: string; name?: string; content?: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { action, name, content } = args;

  if (action === 'list') {
    const artifacts = stateManager.listArtifacts();
    if (artifacts.length === 0) {
      return { content: [{ type: 'text', text: 'No artifacts saved yet.' }] };
    }
    return { content: [{ type: 'text', text: `## Artifacts\n\n${artifacts.map(a => `- ${a}`).join('\n')}` }] };
  }

  if (action === 'save') {
    if (!name || !content) {
      return { content: [{ type: 'text', text: '❌ Name and content required for save.' }] };
    }
    stateManager.saveArtifact(name, content);
    return { content: [{ type: 'text', text: `✅ Saved artifact: ${name}` }] };
  }

  if (action === 'get') {
    if (!name) {
      return { content: [{ type: 'text', text: '❌ Name required for get.' }] };
    }
    const artifactContent = stateManager.getArtifact(name);
    if (!artifactContent) {
      return { content: [{ type: 'text', text: `❌ Artifact not found: ${name}` }] };
    }
    return { content: [{ type: 'text', text: `## ${name}\n\n${artifactContent}` }] };
  }

  return { content: [{ type: 'text', text: '❌ Invalid action. Use "save", "get", or "list".' }] };
}

async function handleEngineeringDecision(
  stateManager: EngineeringStateManager,
  args: {
    agent: AgentRole;
    decision: string;
    reasoning: string;
    alternatives?: string[];
    confidence?: number;
    impact?: string;
  }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const state = stateManager.getState();
  if (!state) {
    return { content: [{ type: 'text', text: '❌ No engineering project found.' }] };
  }

  const decision = stateManager.recordDecision({
    agent: args.agent,
    phase: state.currentPhase,
    decision: args.decision,
    reasoning: args.reasoning,
    alternatives: args.alternatives || [],
    confidence: args.confidence || 80,
    reversible: true,
    impact: (args.impact as 'low' | 'medium' | 'high' | 'critical') || 'medium',
  });

  let response = `# 📝 Decision Recorded\n\n`;
  response += `**Agent:** ${args.agent}\n`;
  response += `**Phase:** ${state.currentPhase}\n`;
  response += `**Decision:** ${args.decision}\n\n`;
  response += `**Reasoning:** ${args.reasoning}\n\n`;

  if (args.alternatives && args.alternatives.length > 0) {
    response += `**Alternatives Considered:**\n`;
    for (const alt of args.alternatives) {
      response += `- ${alt}\n`;
    }
  }

  response += `\n**Confidence:** ${args.confidence || 80}%\n`;
  response += `**Impact:** ${args.impact || 'medium'}`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringGraphAdd(
  stateManager: EngineeringStateManager,
  args: {
    nodeType: string;
    name: string;
    filePath: string;
    dependsOn?: string[];
    dependencyTypes?: string[];
  }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { nodeType, name, filePath, dependsOn = [], dependencyTypes = [] } = args;

  // Add the node
  const node = stateManager.addNode({
    type: nodeType as 'schema' | 'api' | 'component' | 'service' | 'page' | 'util' | 'config',
    name,
    filePath,
  });

  // Add edges for dependencies
  const graph = stateManager.getGraph();
  let edgesAdded = 0;

  for (let i = 0; i < dependsOn.length; i++) {
    const targetPath = dependsOn[i];
    const targetNode = graph.nodes.find(n => n.filePath === targetPath);

    if (targetNode) {
      stateManager.addEdge({
        sourceId: node.id,
        targetId: targetNode.id,
        type: (dependencyTypes[i] as 'import' | 'api-call' | 'db-query' | 'event' | 'config') || 'import',
      });
      edgesAdded++;
    }
  }

  let response = `# ✅ Added to Dependency Graph\n\n`;
  response += `**Node:** ${name} (${nodeType})\n`;
  response += `**Path:** ${filePath}\n`;
  response += `**Dependencies:** ${edgesAdded} edges added\n`;

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringImpact(
  stateManager: EngineeringStateManager,
  args: { filePath: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { filePath } = args;
  const graph = stateManager.getGraph();

  // Find the node
  const node = graph.nodes.find(n => n.filePath === filePath);
  if (!node) {
    return { content: [{ type: 'text', text: `File not in dependency graph: ${filePath}\n\nThis might be a new file or one that hasn't been tracked yet.` }] };
  }

  // Find affected nodes
  const { direct, transitive } = stateManager.findAffectedNodes(node.id);

  // Determine risk level
  const totalAffected = direct.length + transitive.length;
  let riskLevel = 'low';
  let riskIcon = '🟢';
  if (totalAffected > 10) {
    riskLevel = 'critical';
    riskIcon = '🔴';
  } else if (totalAffected > 5) {
    riskLevel = 'high';
    riskIcon = '🟠';
  } else if (totalAffected > 2) {
    riskLevel = 'medium';
    riskIcon = '🟡';
  }

  let response = `# 🔍 Impact Analysis: ${node.name}\n\n`;
  response += `**File:** ${filePath}\n`;
  response += `**Type:** ${node.type}\n`;
  response += `**Risk Level:** ${riskIcon} ${riskLevel.toUpperCase()}\n\n`;

  if (direct.length > 0) {
    response += `## Directly Affected (${direct.length})\n`;
    response += `These files import or directly depend on this file:\n\n`;
    for (const n of direct) {
      response += `- ${n.name} (${n.type}) - ${n.filePath}\n`;
    }
    response += `\n`;
  }

  if (transitive.length > 0) {
    response += `## Transitively Affected (${transitive.length})\n`;
    response += `These files are indirectly affected through the dependency chain:\n\n`;
    for (const n of transitive.slice(0, 10)) { // Limit to 10
      response += `- ${n.name} (${n.type}) - ${n.filePath}\n`;
    }
    if (transitive.length > 10) {
      response += `... and ${transitive.length - 10} more\n`;
    }
    response += `\n`;
  }

  if (totalAffected === 0) {
    response += `No other files depend on this one. Changes are safe to make.\n`;
  } else {
    response += `## Recommendations\n`;
    if (node.type === 'schema') {
      response += `- Consider running database migration after changes\n`;
      response += `- Check all API routes that use this schema\n`;
    }
    if (riskLevel === 'high' || riskLevel === 'critical') {
      response += `- Create a snapshot before making changes\n`;
      response += `- Run full test suite after changes\n`;
    }
    response += `- Update affected files if interface changes\n`;
  }

  return { content: [{ type: 'text', text: response }] };
}

async function handleEngineeringGraphView(
  stateManager: EngineeringStateManager,
  args: { focusFile?: string }
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const graph = stateManager.getGraph();

  if (graph.nodes.length === 0) {
    return { content: [{ type: 'text', text: 'Dependency graph is empty. Use `engineering_graph_add` to add nodes.' }] };
  }

  let response = `# 🕸️ Dependency Graph\n\n`;
  response += `**Nodes:** ${graph.nodes.length} | **Edges:** ${graph.edges.length}\n\n`;

  // Group by type
  const byType: Record<string, typeof graph.nodes> = {};
  for (const node of graph.nodes) {
    if (!byType[node.type]) byType[node.type] = [];
    byType[node.type].push(node);
  }

  for (const [type, nodes] of Object.entries(byType)) {
    response += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${nodes.length})\n`;
    for (const node of nodes) {
      const incoming = graph.edges.filter(e => e.targetId === node.id).length;
      const outgoing = graph.edges.filter(e => e.sourceId === node.id).length;
      response += `- **${node.name}** - ↓${incoming} ↑${outgoing} deps\n`;
      response += `  ${node.filePath}\n`;
    }
    response += `\n`;
  }

  return { content: [{ type: 'text', text: response }] };
}
