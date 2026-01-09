/**
 * OnboardingWizard - Intelligent Onboarding System
 *
 * Multi-step wizard that adapts to user skill level and project context.
 * Enforces proper discovery before any code generation.
 *
 * Features:
 * - Skill level detection (beginner/intermediate/advanced)
 * - Project type detection (new/existing)
 * - Multiple input methods (chat, form, mockups, examples)
 * - Deep dive audit for existing projects
 * - Stack detection and confirmation
 */

import * as vscode from 'vscode';
import { ProjectStateManager, ProjectConfig, UserPreferences } from './ProjectStateManager';

export type OnboardingStep =
  | 'welcome'
  | 'skill-assessment'
  | 'project-type'
  | 'input-method'
  | 'new-project-discovery'
  | 'existing-project-audit'
  | 'stack-confirmation'
  | 'complete';

export interface OnboardingState {
  currentStep: OnboardingStep;
  skillLevel: UserPreferences['skillLevel'] | null;
  projectType: 'new' | 'existing' | null;
  inputMethod: UserPreferences['preferredInputMethod'] | null;
  discoveryData: {
    projectDescription?: string;
    targetUsers?: string;
    keyFeatures?: string[];
    needsAuth?: boolean;
    needsPayments?: boolean;
    designReference?: string;
    exampleApp?: string;
  };
  auditResults?: {
    hasTests: boolean;
    hasAuth: boolean;
    hasPayments: boolean;
    hasDatabase: boolean;
    fileCount: number;
    issues: string[];
  };
  stackConfirmed: boolean;
}

export class OnboardingWizard {
  private state: OnboardingState;
  private stateManager: ProjectStateManager;
  private postMessage: (message: any) => void;

  constructor(
    stateManager: ProjectStateManager,
    postMessage: (message: any) => void
  ) {
    this.stateManager = stateManager;
    this.postMessage = postMessage;
    this.state = this.getInitialState();
  }

  private getInitialState(): OnboardingState {
    return {
      currentStep: 'welcome',
      skillLevel: null,
      projectType: null,
      inputMethod: null,
      discoveryData: {},
      stackConfirmed: false
    };
  }

  /**
   * Initialize wizard based on project state
   */
  async initialize(): Promise<void> {
    const { isNew, needsOnboarding, config } = await this.stateManager.initialize();

    if (!needsOnboarding && config) {
      // User already onboarded - skip to complete
      this.state.currentStep = 'complete';
      this.state.skillLevel = config.userPreferences.skillLevel;
      this.state.projectType = config.projectType;
      this.state.inputMethod = config.userPreferences.preferredInputMethod;
      this.state.stackConfirmed = true;
      return;
    }

    if (isNew) {
      // New project - start from welcome
      this.state.currentStep = 'welcome';
    } else {
      // Existing project without onboarding - skip to project type
      this.state.currentStep = 'project-type';
    }

    this.renderCurrentStep();
  }

  /**
   * Handle user input for current step
   */
  handleInput(action: string, data?: any): void {
    switch (this.state.currentStep) {
      case 'welcome':
        this.handleWelcomeInput(action);
        break;
      case 'skill-assessment':
        this.handleSkillInput(action, data);
        break;
      case 'project-type':
        this.handleProjectTypeInput(action);
        break;
      case 'input-method':
        this.handleInputMethodInput(action);
        break;
      case 'new-project-discovery':
        this.handleDiscoveryInput(action, data);
        break;
      case 'existing-project-audit':
        this.handleAuditInput(action, data);
        break;
      case 'stack-confirmation':
        this.handleStackInput(action, data);
        break;
    }
  }

  private handleWelcomeInput(action: string): void {
    if (action === 'start') {
      this.state.currentStep = 'skill-assessment';
      this.renderCurrentStep();
    }
  }

  private handleSkillInput(action: string, data: any): void {
    if (action === 'select-skill') {
      this.state.skillLevel = data.level as UserPreferences['skillLevel'];
      this.state.currentStep = 'project-type';
      this.renderCurrentStep();
    }
  }

  private handleProjectTypeInput(action: string): void {
    if (action === 'new-project') {
      this.state.projectType = 'new';
      this.state.currentStep = 'input-method';
      this.renderCurrentStep();
    } else if (action === 'existing-project') {
      this.state.projectType = 'existing';
      this.state.currentStep = 'existing-project-audit';
      this.startExistingProjectAudit();
    }
  }

  private handleInputMethodInput(action: string): void {
    const methodMap: Record<string, UserPreferences['preferredInputMethod']> = {
      'chat': 'chat',
      'form': 'form',
      'mockups': 'mockups',
      'example': 'example'
    };

    if (methodMap[action]) {
      this.state.inputMethod = methodMap[action];
      this.state.currentStep = 'new-project-discovery';
      this.renderCurrentStep();
    }
  }

  private handleDiscoveryInput(action: string, data: any): void {
    if (action === 'submit-discovery') {
      this.state.discoveryData = data;
      this.state.currentStep = 'stack-confirmation';
      this.renderCurrentStep();
    }
  }

  private handleAuditInput(action: string, data: any): void {
    if (action === 'audit-complete') {
      this.state.auditResults = data;
      this.state.currentStep = 'stack-confirmation';
      this.renderCurrentStep();
    } else if (action === 'skip-audit') {
      this.state.currentStep = 'stack-confirmation';
      this.renderCurrentStep();
    }
  }

  private handleStackInput(action: string, data: any): void {
    if (action === 'confirm-stack') {
      this.state.stackConfirmed = true;
      this.completeOnboarding(data?.stackOverrides);
    } else if (action === 'modify-stack') {
      // Re-render with modification mode
      this.renderCurrentStep(true);
    }
  }

  private async startExistingProjectAudit(): Promise<void> {
    // Show loading state
    this.postMessage({
      type: 'onboarding-update',
      step: 'existing-project-audit',
      loading: true,
      message: 'Analyzing your project...'
    });

    // Perform audit
    const auditResults = await this.performProjectAudit();
    this.state.auditResults = auditResults;

    this.renderCurrentStep();
  }

  private async performProjectAudit(): Promise<OnboardingState['auditResults']> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return {
        hasTests: false,
        hasAuth: false,
        hasPayments: false,
        hasDatabase: false,
        fileCount: 0,
        issues: ['No workspace folder found']
      };
    }

    const fs = require('fs');
    const path = require('path');

    const issues: string[] = [];
    let fileCount = 0;
    let hasTests = false;
    let hasAuth = false;
    let hasPayments = false;
    let hasDatabase = false;

    // Check for test files
    const testPatterns = ['**/*.test.ts', '**/*.spec.ts', '**/test/**', '**/__tests__/**'];
    for (const pattern of testPatterns) {
      try {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 10);
        if (files.length > 0) {
          hasTests = true;
          break;
        }
      } catch {}
    }

    // Check package.json for dependencies
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Auth detection
        const authPackages = ['@supabase/supabase-js', 'next-auth', '@clerk/nextjs', 'firebase', '@auth0/nextjs-auth0'];
        hasAuth = authPackages.some(pkg => allDeps[pkg]);

        // Payments detection
        const paymentPackages = ['stripe', '@stripe/stripe-js', 'paypal-rest-sdk', '@paypal/checkout-server-sdk'];
        hasPayments = paymentPackages.some(pkg => allDeps[pkg]);

        // Database detection
        const dbPackages = ['drizzle-orm', 'prisma', '@prisma/client', 'typeorm', 'mongoose', 'pg', 'mysql2'];
        hasDatabase = dbPackages.some(pkg => allDeps[pkg]);
      } catch {}
    }

    // Count source files
    try {
      const sourceFiles = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**', 500);
      fileCount = sourceFiles.length;
    } catch {}

    // Generate issues based on findings
    if (!hasTests) {
      issues.push('No test files detected - tests are required for production code');
    }
    if (!hasAuth && fileCount > 20) {
      issues.push('No authentication system detected - consider adding user auth');
    }
    if (!fs.existsSync(path.join(workspaceRoot, '.env.example'))) {
      issues.push('No .env.example file - document environment variables');
    }

    // Check for common issues in code
    try {
      const tsFiles = await vscode.workspace.findFiles('**/*.{ts,tsx}', '**/node_modules/**', 100);
      for (const file of tsFiles.slice(0, 20)) {
        const content = fs.readFileSync(file.fsPath, 'utf-8');

        // Check for console.log in non-test files
        if (!file.fsPath.includes('.test.') && content.includes('console.log')) {
          issues.push(`Console.log found in ${path.basename(file.fsPath)}`);
          break;
        }

        // Check for TODO comments
        if (content.includes('TODO') || content.includes('FIXME')) {
          issues.push('TODO/FIXME comments found - review before production');
          break;
        }

        // Check for any type
        const anyCount = (content.match(/:\s*any\b/g) || []).length;
        if (anyCount > 3) {
          issues.push(`Multiple 'any' types found - improve type safety`);
          break;
        }
      }
    } catch {}

    return {
      hasTests,
      hasAuth,
      hasPayments,
      hasDatabase,
      fileCount,
      issues: issues.slice(0, 5) // Limit to 5 issues
    };
  }

  private async completeOnboarding(stackOverrides?: Partial<ProjectConfig['stack']>): Promise<void> {
    // Create the project config
    const config = this.stateManager.createConfig(
      'CodeBakers Project', // Will be updated from discovery
      this.state.projectType!,
      {
        skillLevel: this.state.skillLevel!,
        preferredInputMethod: this.state.inputMethod || 'chat',
        autoApply: true, // Always auto-apply by default - users can undo if needed
        verboseExplanations: this.state.skillLevel === 'beginner'
      }
    );

    // Apply stack overrides if any
    if (stackOverrides) {
      config.stack = { ...config.stack, ...stackOverrides };
    }

    // Set discovery data for new projects
    if (this.state.projectType === 'new' && this.state.discoveryData) {
      config.discovery = {
        projectDescription: this.state.discoveryData.projectDescription || '',
        targetUsers: this.state.discoveryData.targetUsers || '',
        keyFeatures: this.state.discoveryData.keyFeatures || [],
        needsAuth: this.state.discoveryData.needsAuth || false,
        needsPayments: this.state.discoveryData.needsPayments || false
      };
    }

    // Save config
    this.stateManager.saveConfig(config);

    // Add devlog entry for onboarding
    this.stateManager.addDevlogEntry({
      title: 'Project Onboarding Complete',
      taskSize: 'small',
      status: 'completed',
      whatWasDone: [
        `Skill level: ${this.state.skillLevel}`,
        `Project type: ${this.state.projectType}`,
        `Input method: ${this.state.inputMethod}`,
        `Stack detected: ${config.stack.framework || 'generic'}`
      ],
      filesChanged: [{ path: '.codebakers.json', change: 'created' }],
      nextSteps: this.state.projectType === 'new'
        ? ['Begin project build with discovered requirements']
        : ['Continue development with CodeBakers patterns']
    });

    // Update state
    this.state.currentStep = 'complete';

    // Notify UI
    this.postMessage({
      type: 'onboarding-complete',
      config: config,
      skillLevel: this.state.skillLevel,
      projectType: this.state.projectType
    });
  }

  /**
   * Render the current step's UI
   */
  renderCurrentStep(modifyMode: boolean = false): void {
    switch (this.state.currentStep) {
      case 'welcome':
        this.renderWelcome();
        break;
      case 'skill-assessment':
        this.renderSkillAssessment();
        break;
      case 'project-type':
        this.renderProjectType();
        break;
      case 'input-method':
        this.renderInputMethod();
        break;
      case 'new-project-discovery':
        this.renderNewProjectDiscovery();
        break;
      case 'existing-project-audit':
        this.renderExistingProjectAudit();
        break;
      case 'stack-confirmation':
        this.renderStackConfirmation(modifyMode);
        break;
      case 'complete':
        this.renderComplete();
        break;
    }
  }

  private renderWelcome(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'welcome',
      html: this.getWelcomeHTML()
    });
  }

  private renderSkillAssessment(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'skill-assessment',
      html: this.getSkillAssessmentHTML()
    });
  }

  private renderProjectType(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'project-type',
      html: this.getProjectTypeHTML()
    });
  }

  private renderInputMethod(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'input-method',
      html: this.getInputMethodHTML()
    });
  }

  private renderNewProjectDiscovery(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'new-project-discovery',
      inputMethod: this.state.inputMethod,
      html: this.getDiscoveryHTML()
    });
  }

  private renderExistingProjectAudit(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'existing-project-audit',
      auditResults: this.state.auditResults,
      html: this.getAuditHTML()
    });
  }

  private renderStackConfirmation(modifyMode: boolean): void {
    const stack = this.stateManager.detectStack();
    this.postMessage({
      type: 'onboarding-update',
      step: 'stack-confirmation',
      stack: stack,
      modifyMode: modifyMode,
      html: this.getStackConfirmationHTML(stack, modifyMode)
    });
  }

  private renderComplete(): void {
    this.postMessage({
      type: 'onboarding-update',
      step: 'complete',
      html: this.getCompleteHTML()
    });
  }

  // =========================================================================
  // HTML Templates
  // =========================================================================

  private getWelcomeHTML(): string {
    return `
      <div class="onboarding-step welcome">
        <div class="onboarding-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h2>Welcome to CodeBakers</h2>
        <p>Production-ready code, first time. Every time.</p>
        <p class="subtitle">Let's set up your project for success. This takes about 2 minutes.</p>
        <button class="primary-btn" onclick="handleOnboarding('start')">
          Get Started
        </button>
      </div>
    `;
  }

  private getSkillAssessmentHTML(): string {
    return `
      <div class="onboarding-step skill-assessment">
        <div class="step-indicator">Step 1 of 4</div>
        <h2>What's your experience level?</h2>
        <p>This helps me tailor explanations to your needs.</p>

        <div class="skill-options">
          <button class="skill-btn" onclick="handleOnboarding('select-skill', { level: 'beginner' })">
            <span class="skill-icon">🌱</span>
            <span class="skill-title">Beginner</span>
            <span class="skill-desc">New to coding? I'll explain concepts in detail as we build.</span>
          </button>

          <button class="skill-btn" onclick="handleOnboarding('select-skill', { level: 'intermediate' })">
            <span class="skill-icon">🌿</span>
            <span class="skill-title">Intermediate</span>
            <span class="skill-desc">Know the basics. I'll balance explanation with efficiency.</span>
          </button>

          <button class="skill-btn recommended" onclick="handleOnboarding('select-skill', { level: 'advanced' })">
            <span class="skill-icon">🌳</span>
            <span class="skill-title">Advanced</span>
            <span class="skill-desc">Experienced dev. I'll be concise and get things done fast.</span>
            <span class="recommended-badge">Most Popular</span>
          </button>
        </div>

        <p style="margin-top: 20px; font-size: 0.8rem; opacity: 0.7;">
          ✨ Changes auto-apply by default. You can always undo!
        </p>
      </div>
    `;
  }

  private getProjectTypeHTML(): string {
    return `
      <div class="onboarding-step project-type">
        <div class="step-indicator">Step 2 of 4</div>
        <h2>What are we working on?</h2>

        <div class="project-options">
          <button class="project-btn" onclick="handleOnboarding('new-project')">
            <span class="project-icon">✨</span>
            <span class="project-title">New Project</span>
            <span class="project-desc">Start from scratch. I'll help you plan and build with best practices.</span>
          </button>

          <button class="project-btn" onclick="handleOnboarding('existing-project')">
            <span class="project-icon">🔧</span>
            <span class="project-title">Existing Project</span>
            <span class="project-desc">Add features or improve code. I'll analyze your project first.</span>
          </button>
        </div>
      </div>
    `;
  }

  private getInputMethodHTML(): string {
    return `
      <div class="onboarding-step input-method">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>How would you like to describe your project?</h2>
        <p>Choose the method that works best for you.</p>

        <div class="method-options">
          <button class="method-btn" onclick="handleOnboarding('chat')">
            <span class="method-icon">💬</span>
            <span class="method-title">Chat</span>
            <span class="method-desc">Describe it conversationally. I'll ask follow-up questions.</span>
          </button>

          <button class="method-btn recommended" onclick="handleOnboarding('form')">
            <span class="method-icon">📝</span>
            <span class="method-title">Form</span>
            <span class="method-desc">Fill out a structured form with guided questions.</span>
            <span class="recommended-badge">Recommended</span>
          </button>

          <button class="method-btn" onclick="handleOnboarding('mockups')">
            <span class="method-icon">🎨</span>
            <span class="method-title">Mockups</span>
            <span class="method-desc">Upload designs or screenshots. I'll analyze and implement.</span>
          </button>

          <button class="method-btn" onclick="handleOnboarding('example')">
            <span class="method-icon">🔗</span>
            <span class="method-title">"Like X"</span>
            <span class="method-desc">Reference an existing app. "Build me something like Linear."</span>
          </button>
        </div>
      </div>
    `;
  }

  private getDiscoveryHTML(): string {
    const method = this.state.inputMethod;

    if (method === 'form') {
      return this.getFormDiscoveryHTML();
    } else if (method === 'mockups') {
      return this.getMockupsDiscoveryHTML();
    } else if (method === 'example') {
      return this.getExampleDiscoveryHTML();
    } else {
      return this.getChatDiscoveryHTML();
    }
  }

  private getFormDiscoveryHTML(): string {
    return `
      <div class="onboarding-step discovery-form">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Tell me about your project</h2>

        <form id="discovery-form" class="discovery-form-fields">
          <div class="form-group">
            <label for="description">What does this app do?</label>
            <textarea id="description" placeholder="A project management tool that helps teams track tasks..." rows="3"></textarea>
          </div>

          <div class="form-group">
            <label for="users">Who will use it?</label>
            <input type="text" id="users" placeholder="Small business teams, freelancers, agencies...">
          </div>

          <div class="form-group">
            <label>Key Features (select all that apply)</label>
            <div class="checkbox-group">
              <label class="checkbox"><input type="checkbox" name="features" value="user-accounts"> User accounts & profiles</label>
              <label class="checkbox"><input type="checkbox" name="features" value="dashboard"> Dashboard / Analytics</label>
              <label class="checkbox"><input type="checkbox" name="features" value="crud"> Create, edit, delete items</label>
              <label class="checkbox"><input type="checkbox" name="features" value="search"> Search & filtering</label>
              <label class="checkbox"><input type="checkbox" name="features" value="notifications"> Notifications</label>
              <label class="checkbox"><input type="checkbox" name="features" value="file-uploads"> File uploads</label>
            </div>
          </div>

          <div class="form-group">
            <label>Additional Requirements</label>
            <div class="checkbox-group">
              <label class="checkbox"><input type="checkbox" name="needs" value="auth"> User authentication required</label>
              <label class="checkbox"><input type="checkbox" name="needs" value="payments"> Payment processing needed</label>
              <label class="checkbox"><input type="checkbox" name="needs" value="realtime"> Real-time updates needed</label>
            </div>
          </div>

          <button type="button" class="primary-btn" onclick="submitDiscoveryForm()">
            Continue
          </button>
        </form>
      </div>
    `;
  }

  private getMockupsDiscoveryHTML(): string {
    return `
      <div class="onboarding-step discovery-mockups">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Upload your designs</h2>
        <p>Drop mockups, screenshots, or design files. I'll analyze them and create matching code.</p>

        <div class="upload-area" id="upload-dropzone">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drag and drop files here</p>
          <p class="upload-hint">PNG, JPG, PDF, or Figma exports</p>
          <input type="file" id="mockup-upload" multiple accept="image/*,.pdf" style="display:none">
          <button class="secondary-btn" onclick="document.getElementById('mockup-upload').click()">
            Browse Files
          </button>
        </div>

        <div id="uploaded-files" class="uploaded-files"></div>

        <div class="form-group">
          <label for="mockup-notes">Additional notes (optional)</label>
          <textarea id="mockup-notes" placeholder="Any context about the designs..." rows="2"></textarea>
        </div>

        <button class="primary-btn" onclick="submitMockups()" disabled id="mockup-submit">
          Analyze Designs
        </button>
      </div>
    `;
  }

  private getExampleDiscoveryHTML(): string {
    return `
      <div class="onboarding-step discovery-example">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>What app inspires you?</h2>
        <p>Reference an existing product and I'll help you build something similar.</p>

        <div class="popular-examples">
          <h4>Popular references:</h4>
          <div class="example-chips">
            <button class="chip" onclick="selectExample('Linear')">Linear</button>
            <button class="chip" onclick="selectExample('Notion')">Notion</button>
            <button class="chip" onclick="selectExample('Stripe Dashboard')">Stripe</button>
            <button class="chip" onclick="selectExample('Vercel')">Vercel</button>
            <button class="chip" onclick="selectExample('Slack')">Slack</button>
            <button class="chip" onclick="selectExample('Figma')">Figma</button>
          </div>
        </div>

        <div class="form-group">
          <label for="example-app">Or enter a specific app:</label>
          <input type="text" id="example-app" placeholder="Like Asana but for...">
        </div>

        <div class="form-group">
          <label for="example-diff">What would you change or add?</label>
          <textarea id="example-diff" placeholder="I want it to be simpler, focused on..." rows="3"></textarea>
        </div>

        <button class="primary-btn" onclick="submitExample()">
          Continue
        </button>
      </div>
    `;
  }

  private getChatDiscoveryHTML(): string {
    return `
      <div class="onboarding-step discovery-chat">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Tell me about your idea</h2>
        <p>Describe what you want to build in your own words. I'll ask follow-up questions.</p>

        <div class="chat-prompt-area">
          <textarea id="chat-description" placeholder="I want to build a..." rows="5"></textarea>
          <div class="chat-hints">
            <span>Hint: Include who will use it, what problem it solves, and key features.</span>
          </div>
        </div>

        <button class="primary-btn" onclick="submitChatDescription()">
          Continue
        </button>
      </div>
    `;
  }

  private getAuditHTML(): string {
    const results = this.state.auditResults;

    if (!results) {
      return `
        <div class="onboarding-step audit-loading">
          <div class="loading-spinner"></div>
          <h2>Analyzing your project...</h2>
          <p>Checking tests, dependencies, patterns, and more.</p>
        </div>
      `;
    }

    const statusIcon = (has: boolean) => has ? '✅' : '❌';
    const issuesList = results.issues.map(issue => `<li>${issue}</li>`).join('');

    return `
      <div class="onboarding-step audit-results">
        <div class="step-indicator">Step 3 of 4</div>
        <h2>Project Analysis</h2>

        <div class="audit-summary">
          <div class="audit-stat">
            <span class="stat-value">${results.fileCount}</span>
            <span class="stat-label">Source files</span>
          </div>
        </div>

        <div class="audit-checks">
          <div class="check-item">${statusIcon(results.hasTests)} Test files</div>
          <div class="check-item">${statusIcon(results.hasAuth)} Authentication</div>
          <div class="check-item">${statusIcon(results.hasPayments)} Payments</div>
          <div class="check-item">${statusIcon(results.hasDatabase)} Database</div>
        </div>

        ${results.issues.length > 0 ? `
          <div class="audit-issues">
            <h4>Issues Found:</h4>
            <ul>${issuesList}</ul>
          </div>
        ` : '<p class="audit-clean">No critical issues found!</p>'}

        <div class="audit-actions">
          <button class="primary-btn" onclick="handleOnboarding('audit-complete', ${JSON.stringify(results).replace(/"/g, '&quot;')})">
            Continue
          </button>
          <button class="secondary-btn" onclick="handleOnboarding('skip-audit')">
            Skip Audit
          </button>
        </div>
      </div>
    `;
  }

  private getStackConfirmationHTML(stack: ProjectConfig['stack'], modifyMode: boolean): string {
    if (modifyMode) {
      return this.getStackModifyHTML(stack);
    }

    return `
      <div class="onboarding-step stack-confirmation">
        <div class="step-indicator">Step 4 of 4</div>
        <h2>Confirm Your Stack</h2>
        <p>I detected the following technologies. I'll use matching CodeBakers patterns.</p>

        <div class="stack-grid">
          <div class="stack-item">
            <span class="stack-label">Framework</span>
            <span class="stack-value">${stack.framework || 'Next.js (default)'}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">Database</span>
            <span class="stack-value">${stack.database || 'Drizzle + PostgreSQL (default)'}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">Auth</span>
            <span class="stack-value">${stack.auth || 'Supabase Auth (default)'}</span>
          </div>
          <div class="stack-item">
            <span class="stack-label">UI</span>
            <span class="stack-value">${stack.ui || 'shadcn/ui (default)'}</span>
          </div>
          ${stack.payments?.length ? `
            <div class="stack-item">
              <span class="stack-label">Payments</span>
              <span class="stack-value">${stack.payments.join(', ')}</span>
            </div>
          ` : ''}
        </div>

        <div class="stack-actions">
          <button class="primary-btn" onclick="handleOnboarding('confirm-stack')">
            Looks Good!
          </button>
          <button class="secondary-btn" onclick="handleOnboarding('modify-stack')">
            Modify Stack
          </button>
        </div>
      </div>
    `;
  }

  private getStackModifyHTML(stack: ProjectConfig['stack']): string {
    return `
      <div class="onboarding-step stack-modify">
        <div class="step-indicator">Step 4 of 4</div>
        <h2>Customize Your Stack</h2>

        <form id="stack-form" class="stack-form">
          <div class="form-group">
            <label for="framework">Framework</label>
            <select id="framework">
              <option value="nextjs" ${stack.framework === 'nextjs' ? 'selected' : ''}>Next.js</option>
              <option value="remix" ${stack.framework === 'remix' ? 'selected' : ''}>Remix</option>
              <option value="vite" ${stack.framework === 'vite' ? 'selected' : ''}>Vite + React</option>
            </select>
          </div>

          <div class="form-group">
            <label for="database">Database</label>
            <select id="database">
              <option value="drizzle" ${stack.database === 'drizzle' ? 'selected' : ''}>Drizzle (Recommended)</option>
              <option value="prisma" ${stack.database === 'prisma' ? 'selected' : ''}>Prisma</option>
              <option value="supabase" ${stack.database === 'supabase' ? 'selected' : ''}>Supabase</option>
              <option value="mongoose" ${stack.database === 'mongoose' ? 'selected' : ''}>Mongoose</option>
            </select>
          </div>

          <div class="form-group">
            <label for="auth">Authentication</label>
            <select id="auth">
              <option value="supabase" ${stack.auth === 'supabase' ? 'selected' : ''}>Supabase Auth (Recommended)</option>
              <option value="next-auth" ${stack.auth === 'next-auth' ? 'selected' : ''}>NextAuth</option>
              <option value="clerk" ${stack.auth === 'clerk' ? 'selected' : ''}>Clerk</option>
              <option value="auth0" ${stack.auth === 'auth0' ? 'selected' : ''}>Auth0</option>
            </select>
          </div>

          <div class="form-group">
            <label for="ui">UI Library</label>
            <select id="ui">
              <option value="shadcn" ${stack.ui === 'shadcn' ? 'selected' : ''}>shadcn/ui (Recommended)</option>
              <option value="chakra" ${stack.ui === 'chakra' ? 'selected' : ''}>Chakra UI</option>
              <option value="mui" ${stack.ui === 'mui' ? 'selected' : ''}>Material UI</option>
              <option value="tailwind" ${stack.ui === 'tailwind' ? 'selected' : ''}>Tailwind Only</option>
            </select>
          </div>

          <button type="button" class="primary-btn" onclick="submitStackModification()">
            Confirm Stack
          </button>
        </form>
      </div>
    `;
  }

  private getCompleteHTML(): string {
    const skillEmoji = {
      'beginner': '🌱',
      'intermediate': '🌿',
      'advanced': '🌳'
    };

    return `
      <div class="onboarding-step complete">
        <div class="success-icon">🎉</div>
        <h2>You're All Set!</h2>
        <p>CodeBakers is ready to build with you.</p>

        <div class="setup-summary">
          <div class="summary-item">
            <span class="summary-icon">${skillEmoji[this.state.skillLevel!] || '🌿'}</span>
            <span>${this.state.skillLevel} mode</span>
          </div>
          <div class="summary-item">
            <span class="summary-icon">${this.state.projectType === 'new' ? '✨' : '🔧'}</span>
            <span>${this.state.projectType === 'new' ? 'New project' : 'Existing project'}</span>
          </div>
        </div>

        <div style="margin: 20px 0; padding: 12px 16px; background: rgba(220, 38, 38, 0.1); border-radius: 8px; text-align: left;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #dc2626;">Quick tips:</p>
          <p style="margin: 0 0 4px; font-size: 0.875rem;">✨ Changes apply automatically - no approve buttons!</p>
          <p style="margin: 0 0 4px; font-size: 0.875rem;">↩️ Made a mistake? Just say "undo that"</p>
          <p style="margin: 0; font-size: 0.875rem;">📁 Pin files to always include them in context</p>
        </div>

        <p class="next-step">Just tell me what you want to build!</p>
      </div>
    `;
  }

  /**
   * Get CSS styles for onboarding
   */
  static getStyles(): string {
    return `
      .onboarding-step {
        padding: 24px;
        text-align: center;
      }

      .onboarding-step h2 {
        margin: 16px 0 8px;
        font-size: 1.5rem;
        color: var(--vscode-foreground);
      }

      .onboarding-step p {
        color: var(--vscode-descriptionForeground);
        margin-bottom: 16px;
      }

      .onboarding-step .subtitle {
        font-size: 0.875rem;
        margin-bottom: 24px;
      }

      .step-indicator {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
      }

      .onboarding-icon {
        color: var(--brand-primary, #dc2626);
        margin-bottom: 8px;
      }

      /* Buttons */
      .primary-btn {
        background: var(--brand-primary, #dc2626);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }

      .primary-btn:hover {
        background: var(--brand-primary-dark, #b91c1c);
      }

      .primary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary-btn {
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-left: 8px;
      }

      /* Skill options */
      .skill-options, .project-options, .method-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 20px;
      }

      .skill-btn, .project-btn, .method-btn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s;
        position: relative;
      }

      .skill-btn:hover, .project-btn:hover, .method-btn:hover {
        border-color: var(--brand-primary, #dc2626);
      }

      .skill-btn.recommended, .method-btn.recommended {
        border-color: var(--brand-primary, #dc2626);
      }

      .skill-icon, .project-icon, .method-icon {
        font-size: 1.5rem;
        margin-bottom: 8px;
      }

      .skill-title, .project-title, .method-title {
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
      }

      .skill-desc, .project-desc, .method-desc {
        font-size: 0.875rem;
        color: var(--vscode-descriptionForeground);
      }

      .recommended-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 0.75rem;
        background: var(--brand-primary, #dc2626);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
      }

      /* Form styles */
      .form-group {
        margin-bottom: 16px;
        text-align: left;
      }

      .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      .form-group input,
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 10px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        color: var(--vscode-foreground);
        font-size: 0.875rem;
      }

      .form-group textarea {
        resize: vertical;
        min-height: 80px;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: normal;
        cursor: pointer;
      }

      .checkbox input {
        width: auto;
      }

      /* Upload area */
      .upload-area {
        border: 2px dashed var(--vscode-input-border);
        border-radius: 12px;
        padding: 40px;
        margin: 20px 0;
        transition: border-color 0.2s;
      }

      .upload-area:hover {
        border-color: var(--brand-primary, #dc2626);
      }

      .upload-hint {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
      }

      /* Example chips */
      .example-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
      }

      .chip {
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 16px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 0.875rem;
      }

      .chip:hover, .chip.selected {
        background: var(--brand-primary, #dc2626);
        color: white;
        border-color: var(--brand-primary, #dc2626);
      }

      /* Audit results */
      .audit-summary {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin: 20px 0;
      }

      .audit-stat {
        text-align: center;
      }

      .stat-value {
        display: block;
        font-size: 2rem;
        font-weight: bold;
        color: var(--brand-primary, #dc2626);
      }

      .stat-label {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
      }

      .audit-checks {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 20px 0;
        text-align: left;
      }

      .check-item {
        padding: 8px 12px;
        background: var(--vscode-input-background);
        border-radius: 6px;
      }

      .audit-issues {
        text-align: left;
        background: var(--vscode-inputValidation-warningBackground);
        border: 1px solid var(--vscode-inputValidation-warningBorder);
        border-radius: 8px;
        padding: 12px;
        margin: 16px 0;
      }

      .audit-issues h4 {
        margin: 0 0 8px;
        color: var(--vscode-inputValidation-warningForeground);
      }

      .audit-issues ul {
        margin: 0;
        padding-left: 20px;
      }

      .audit-clean {
        color: var(--vscode-testing-iconPassed);
      }

      .audit-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 20px;
      }

      /* Stack confirmation */
      .stack-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 20px 0;
        text-align: left;
      }

      .stack-item {
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 8px;
      }

      .stack-label {
        display: block;
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 4px;
      }

      .stack-value {
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      .stack-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-top: 24px;
      }

      /* Complete */
      .success-icon {
        font-size: 3rem;
        margin-bottom: 16px;
      }

      .setup-summary {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin: 24px 0;
      }

      .summary-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .summary-icon {
        font-size: 1.25rem;
      }

      .next-step {
        font-weight: 500;
        color: var(--vscode-foreground);
      }

      /* Loading */
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--vscode-input-border);
        border-top-color: var(--brand-primary, #dc2626);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
  }

  /**
   * Get JavaScript for onboarding interactions
   */
  static getScript(): string {
    return `
      function handleOnboarding(action, data) {
        vscode.postMessage({
          type: 'onboarding-action',
          action: action,
          data: data || {}
        });
      }

      function submitDiscoveryForm() {
        const form = document.getElementById('discovery-form');
        const features = Array.from(form.querySelectorAll('input[name="features"]:checked'))
          .map(cb => cb.value);
        const needs = Array.from(form.querySelectorAll('input[name="needs"]:checked'))
          .map(cb => cb.value);

        handleOnboarding('submit-discovery', {
          projectDescription: document.getElementById('description').value,
          targetUsers: document.getElementById('users').value,
          keyFeatures: features,
          needsAuth: needs.includes('auth'),
          needsPayments: needs.includes('payments'),
          needsRealtime: needs.includes('realtime')
        });
      }

      function submitChatDescription() {
        const description = document.getElementById('chat-description').value;
        if (description.trim()) {
          handleOnboarding('submit-discovery', {
            projectDescription: description,
            inputMethod: 'chat'
          });
        }
      }

      function selectExample(name) {
        document.getElementById('example-app').value = name;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        event.target.classList.add('selected');
      }

      function submitExample() {
        const app = document.getElementById('example-app').value;
        const diff = document.getElementById('example-diff').value;
        if (app.trim()) {
          handleOnboarding('submit-discovery', {
            exampleApp: app,
            projectDescription: diff || 'Similar to ' + app
          });
        }
      }

      function submitMockups() {
        const notes = document.getElementById('mockup-notes').value;
        handleOnboarding('submit-discovery', {
          designReference: 'uploaded-mockups',
          projectDescription: notes
        });
      }

      function submitStackModification() {
        handleOnboarding('confirm-stack', {
          stackOverrides: {
            framework: document.getElementById('framework').value,
            database: document.getElementById('database').value,
            auth: document.getElementById('auth').value,
            ui: document.getElementById('ui').value
          }
        });
      }

      // File upload handling
      const dropzone = document.getElementById('upload-dropzone');
      const uploadInput = document.getElementById('mockup-upload');
      const uploadedFilesDiv = document.getElementById('uploaded-files');
      const uploadedFiles = [];

      if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--brand-primary)';
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.style.borderColor = 'var(--vscode-input-border)';
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'var(--vscode-input-border)';
          handleFiles(e.dataTransfer.files);
        });
      }

      if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
          handleFiles(e.target.files);
        });
      }

      function handleFiles(files) {
        for (const file of files) {
          uploadedFiles.push(file.name);
        }
        updateUploadedList();
      }

      function updateUploadedList() {
        if (uploadedFilesDiv && uploadedFiles.length > 0) {
          uploadedFilesDiv.innerHTML = uploadedFiles.map(f =>
            '<div class="uploaded-file">' + f + '</div>'
          ).join('');
          document.getElementById('mockup-submit').disabled = false;
        }
      }
    `;
  }

  /**
   * Check if onboarding is required
   */
  isOnboardingRequired(): boolean {
    return this.state.currentStep !== 'complete';
  }

  /**
   * Get current onboarding state
   */
  getState(): OnboardingState {
    return { ...this.state };
  }

  /**
   * Reset onboarding (for testing or re-onboarding)
   */
  reset(): void {
    this.state = this.getInitialState();
  }
}
