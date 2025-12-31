import {
  db,
  projects,
  projectPhases,
  projectFeatures,
  projectEvents,
  projectTestRuns,
  projectFiles,
  projectDependencies,
  projectSnapshots,
  projectDocs,
  projectResources,
  projectRiskFlags,
  type NewProject,
  type NewProjectPhase,
  type NewProjectFeature,
  type NewProjectEvent,
  type NewProjectTestRun,
  type NewProjectFile,
  type NewProjectDependency,
  type NewProjectSnapshot,
  type NewProjectDoc,
  type NewProjectResource,
  type NewProjectRiskFlag,
} from '@/db';
import { eq, desc, and, sql } from 'drizzle-orm';

export class ProjectTrackingService {
  // ========================================
  // PROJECT OPERATIONS
  // ========================================

  /**
   * Create or get a project by team ID and project hash
   */
  static async getOrCreateProject(
    teamId: string,
    projectHash: string,
    projectName: string,
    projectDescription?: string
  ) {
    // Check if project already exists
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.teamId, teamId), eq(projects.projectHash, projectHash)))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new project
    const [project] = await db
      .insert(projects)
      .values({
        teamId,
        projectHash,
        projectName,
        projectDescription,
      })
      .returning();

    // Record project started event
    await this.recordEvent(project.id, null, null, {
      eventType: 'project_started',
      eventTitle: 'Project Started',
      eventDescription: `Started building ${projectName}`,
    });

    return project;
  }

  /**
   * Get project by ID with all related data
   */
  static async getProjectWithDetails(projectId: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        phases: {
          orderBy: (phases, { asc }) => [asc(phases.phaseNumber)],
        },
        riskFlags: {
          where: (flags) => eq(flags.isResolved, false),
          orderBy: (flags, { desc }) => [desc(flags.createdAt)],
          limit: 10,
        },
      },
    });

    return project;
  }

  /**
   * Get all projects for a team
   */
  static async getTeamProjects(teamId: string) {
    return db
      .select()
      .from(projects)
      .where(eq(projects.teamId, teamId))
      .orderBy(desc(projects.lastActivityAt));
  }

  /**
   * Update project status
   */
  static async updateProjectStatus(
    projectId: string,
    status: 'discovery' | 'planning' | 'building' | 'testing' | 'completed' | 'paused' | 'failed',
    additionalData?: Partial<NewProject>
  ) {
    const updateData: Record<string, unknown> = {
      status,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      ...additionalData,
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    return project;
  }

  /**
   * Update project progress metrics
   */
  static async updateProjectMetrics(
    projectId: string,
    metrics: {
      totalApiCalls?: number;
      totalTokensUsed?: number;
      totalFilesCreated?: number;
      totalFilesModified?: number;
      totalTestsRun?: number;
      totalTestsPassed?: number;
      overallProgress?: number;
    }
  ) {
    // Use SQL increments for counters
    const updates: Record<string, unknown> = {
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };

    if (metrics.overallProgress !== undefined) {
      updates.overallProgress = metrics.overallProgress;
    }

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, projectId))
      .returning();

    // Increment counters separately if provided
    if (metrics.totalApiCalls) {
      await db.execute(
        sql`UPDATE projects SET total_api_calls = total_api_calls + ${metrics.totalApiCalls} WHERE id = ${projectId}`
      );
    }
    if (metrics.totalTokensUsed) {
      await db.execute(
        sql`UPDATE projects SET total_tokens_used = total_tokens_used + ${metrics.totalTokensUsed} WHERE id = ${projectId}`
      );
    }
    if (metrics.totalFilesCreated) {
      await db.execute(
        sql`UPDATE projects SET total_files_created = total_files_created + ${metrics.totalFilesCreated} WHERE id = ${projectId}`
      );
    }
    if (metrics.totalFilesModified) {
      await db.execute(
        sql`UPDATE projects SET total_files_modified = total_files_modified + ${metrics.totalFilesModified} WHERE id = ${projectId}`
      );
    }
    if (metrics.totalTestsRun) {
      await db.execute(
        sql`UPDATE projects SET total_tests_run = total_tests_run + ${metrics.totalTestsRun} WHERE id = ${projectId}`
      );
    }
    if (metrics.totalTestsPassed) {
      await db.execute(
        sql`UPDATE projects SET total_tests_passed = total_tests_passed + ${metrics.totalTestsPassed} WHERE id = ${projectId}`
      );
    }

    return project;
  }

  // ========================================
  // PHASE OPERATIONS
  // ========================================

  /**
   * Create a new phase for a project
   */
  static async createPhase(data: NewProjectPhase) {
    const [phase] = await db.insert(projectPhases).values(data).returning();

    // Record event
    await this.recordEvent(data.projectId, phase.id, null, {
      eventType: 'phase_started',
      eventTitle: `Phase ${data.phaseNumber}: ${data.phaseName}`,
      eventDescription: data.phaseDescription,
    });

    return phase;
  }

  /**
   * Update phase status and progress
   */
  static async updatePhaseStatus(
    phaseId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed',
    progress?: number
  ) {
    const updates: Record<string, unknown> = { status };

    if (progress !== undefined) {
      updates.progress = progress;
    }

    if (status === 'in_progress' && !updates.startedAt) {
      updates.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
      // Calculate actual duration
      const [phase] = await db.select().from(projectPhases).where(eq(projectPhases.id, phaseId));
      if (phase?.startedAt) {
        updates.actualDuration = Math.round(
          (new Date().getTime() - new Date(phase.startedAt).getTime()) / 60000
        );
      }
    }

    const [updated] = await db
      .update(projectPhases)
      .set(updates)
      .where(eq(projectPhases.id, phaseId))
      .returning();

    return updated;
  }

  /**
   * Get phases for a project
   */
  static async getProjectPhases(projectId: string) {
    return db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId))
      .orderBy(projectPhases.phaseNumber);
  }

  // ========================================
  // FEATURE OPERATIONS
  // ========================================

  /**
   * Create a new feature
   */
  static async createFeature(data: NewProjectFeature) {
    const [feature] = await db.insert(projectFeatures).values(data).returning();

    // Record event
    await this.recordEvent(data.projectId, data.phaseId, feature.id, {
      eventType: 'feature_started',
      eventTitle: `Feature: ${data.featureName}`,
      eventDescription: data.featureDescription,
    });

    return feature;
  }

  /**
   * Update feature status
   */
  static async updateFeatureStatus(
    featureId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed',
    additionalData?: Partial<NewProjectFeature>
  ) {
    const updates: Record<string, unknown> = { status, ...additionalData };

    if (status === 'in_progress') {
      updates.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    const [feature] = await db
      .update(projectFeatures)
      .set(updates)
      .where(eq(projectFeatures.id, featureId))
      .returning();

    return feature;
  }

  /**
   * Get features for a phase
   */
  static async getPhaseFeatures(phaseId: string) {
    return db.select().from(projectFeatures).where(eq(projectFeatures.phaseId, phaseId));
  }

  // ========================================
  // EVENT OPERATIONS (TIMELINE)
  // ========================================

  /**
   * Record an event to the timeline
   */
  static async recordEvent(
    projectId: string,
    phaseId: string | null,
    featureId: string | null,
    data: Omit<NewProjectEvent, 'projectId' | 'phaseId' | 'featureId'>
  ) {
    const [event] = await db
      .insert(projectEvents)
      .values({
        projectId,
        phaseId,
        featureId,
        ...data,
      })
      .returning();

    return event;
  }

  /**
   * Get timeline events for a project
   */
  static async getProjectTimeline(projectId: string, limit = 100, offset = 0) {
    return db
      .select()
      .from(projectEvents)
      .where(eq(projectEvents.projectId, projectId))
      .orderBy(desc(projectEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get recent events across all projects for a team (activity feed)
   */
  static async getTeamActivityFeed(teamId: string, limit = 50) {
    const teamProjects = await this.getTeamProjects(teamId);
    const projectIds = teamProjects.map((p) => p.id);

    if (projectIds.length === 0) return [];

    // Get events from all team projects
    return db
      .select({
        event: projectEvents,
        project: {
          id: projects.id,
          projectName: projects.projectName,
        },
      })
      .from(projectEvents)
      .innerJoin(projects, eq(projectEvents.projectId, projects.id))
      .where(eq(projects.teamId, teamId))
      .orderBy(desc(projectEvents.createdAt))
      .limit(limit);
  }

  // ========================================
  // TEST RUN OPERATIONS
  // ========================================

  /**
   * Record a test run
   */
  static async recordTestRun(data: NewProjectTestRun) {
    const [testRun] = await db.insert(projectTestRuns).values(data).returning();

    // Record event
    const eventType = data.passed ? 'test_passed' : 'test_failed';
    await this.recordEvent(data.projectId, data.phaseId ?? null, data.featureId ?? null, {
      eventType,
      eventTitle: `Tests ${data.passed ? 'Passed' : 'Failed'}`,
      eventDescription: `${data.passedTests}/${data.totalTests} tests passed`,
      eventData: JSON.stringify({
        testType: data.testType,
        passed: data.passedTests,
        failed: data.failedTests,
        skipped: data.skippedTests,
        duration: data.durationMs,
      }),
    });

    // Update project metrics
    await this.updateProjectMetrics(data.projectId, {
      totalTestsRun: data.totalTests ?? 0,
      totalTestsPassed: data.passedTests ?? 0,
    });

    return testRun;
  }

  /**
   * Get test runs for a project
   */
  static async getProjectTestRuns(projectId: string, limit = 50) {
    return db
      .select()
      .from(projectTestRuns)
      .where(eq(projectTestRuns.projectId, projectId))
      .orderBy(desc(projectTestRuns.createdAt))
      .limit(limit);
  }

  // ========================================
  // FILE TRACKING OPERATIONS
  // ========================================

  /**
   * Record a file creation/modification
   */
  static async recordFile(data: NewProjectFile) {
    // Check if file already exists
    const existing = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, data.projectId), eq(projectFiles.filePath, data.filePath)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing file
      const [file] = await db
        .update(projectFiles)
        .set({
          lineCount: data.lineCount,
          complexity: data.complexity,
          modifiedAt: new Date(),
          status: 'active',
        })
        .where(eq(projectFiles.id, existing[0].id))
        .returning();

      await this.recordEvent(data.projectId, null, data.createdByFeatureId ?? null, {
        eventType: 'file_modified',
        eventTitle: `Modified: ${data.fileName}`,
        filePath: data.filePath,
        fileAction: 'modify',
        linesChanged: data.lineCount,
      });

      return file;
    }

    // Create new file record
    const [file] = await db.insert(projectFiles).values(data).returning();

    await this.recordEvent(data.projectId, null, data.createdByFeatureId ?? null, {
      eventType: 'file_created',
      eventTitle: `Created: ${data.fileName}`,
      filePath: data.filePath,
      fileAction: 'create',
      linesChanged: data.lineCount,
    });

    return file;
  }

  /**
   * Mark a file as deleted
   */
  static async markFileDeleted(projectId: string, filePath: string) {
    const [file] = await db
      .update(projectFiles)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.filePath, filePath)))
      .returning();

    if (file) {
      await this.recordEvent(projectId, null, null, {
        eventType: 'file_deleted',
        eventTitle: `Deleted: ${file.fileName}`,
        filePath,
        fileAction: 'delete',
      });
    }

    return file;
  }

  /**
   * Get file tree for a project
   */
  static async getProjectFileTree(projectId: string) {
    return db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.status, 'active')))
      .orderBy(projectFiles.depth, projectFiles.filePath);
  }

  // ========================================
  // DEPENDENCY GRAPH OPERATIONS
  // ========================================

  /**
   * Record a dependency between files
   */
  static async recordDependency(data: NewProjectDependency) {
    // Check if dependency already exists
    const existing = await db
      .select()
      .from(projectDependencies)
      .where(
        and(
          eq(projectDependencies.projectId, data.projectId),
          eq(projectDependencies.sourceFile, data.sourceFile),
          eq(projectDependencies.targetFile, data.targetFile)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [dep] = await db.insert(projectDependencies).values(data).returning();

    await this.recordEvent(data.projectId, null, data.featureId ?? null, {
      eventType: 'dependency_added',
      eventTitle: `Dependency: ${data.sourceFile} → ${data.targetFile}`,
      eventData: JSON.stringify({
        sourceFile: data.sourceFile,
        targetFile: data.targetFile,
        dependencyType: data.dependencyType,
      }),
    });

    return dep;
  }

  /**
   * Get dependency graph for a project
   */
  static async getProjectDependencyGraph(projectId: string) {
    return db
      .select()
      .from(projectDependencies)
      .where(eq(projectDependencies.projectId, projectId));
  }

  // ========================================
  // SNAPSHOT OPERATIONS (ROLLBACK POINTS)
  // ========================================

  /**
   * Create a snapshot/rollback point
   */
  static async createSnapshot(data: NewProjectSnapshot) {
    const [snapshot] = await db.insert(projectSnapshots).values(data).returning();

    await this.recordEvent(data.projectId, data.phaseId ?? null, null, {
      eventType: 'snapshot_created',
      eventTitle: `Snapshot: ${data.snapshotName}`,
      eventDescription: data.snapshotDescription,
      eventData: JSON.stringify({
        snapshotId: snapshot.id,
        gitCommitHash: data.gitCommitHash,
        isAutomatic: data.isAutomatic,
      }),
    });

    return snapshot;
  }

  /**
   * Get snapshots for a project
   */
  static async getProjectSnapshots(projectId: string) {
    return db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.createdAt));
  }

  /**
   * Mark a snapshot as restored
   */
  static async markSnapshotRestored(snapshotId: string) {
    const [snapshot] = await db
      .update(projectSnapshots)
      .set({ wasRestored: true, restoredAt: new Date() })
      .where(eq(projectSnapshots.id, snapshotId))
      .returning();

    if (snapshot) {
      await this.recordEvent(snapshot.projectId, snapshot.phaseId, null, {
        eventType: 'snapshot_restored',
        eventTitle: `Restored: ${snapshot.snapshotName}`,
        eventData: JSON.stringify({ snapshotId }),
      });
    }

    return snapshot;
  }

  // ========================================
  // DOCUMENTATION OPERATIONS
  // ========================================

  /**
   * Record auto-generated documentation
   */
  static async recordDoc(data: NewProjectDoc) {
    // Check if doc already exists
    const existing = await db
      .select()
      .from(projectDocs)
      .where(
        and(
          eq(projectDocs.projectId, data.projectId),
          eq(projectDocs.docType, data.docType),
          eq(projectDocs.docTitle, data.docTitle)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing doc
      const [doc] = await db
        .update(projectDocs)
        .set({
          content: data.content,
          sourceFiles: data.sourceFiles,
          lastGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectDocs.id, existing[0].id))
        .returning();

      return doc;
    }

    const [doc] = await db.insert(projectDocs).values(data).returning();

    await this.recordEvent(data.projectId, null, data.featureId ?? null, {
      eventType: 'docs_generated',
      eventTitle: `Documentation: ${data.docTitle}`,
      eventDescription: `Auto-generated ${data.docType} documentation`,
    });

    return doc;
  }

  /**
   * Get documentation for a project
   */
  static async getProjectDocs(projectId: string) {
    return db
      .select()
      .from(projectDocs)
      .where(eq(projectDocs.projectId, projectId))
      .orderBy(projectDocs.docType, projectDocs.docTitle);
  }

  // ========================================
  // RESOURCE TRACKING OPERATIONS
  // ========================================

  /**
   * Record resource usage (API calls, tokens, time)
   */
  static async recordResourceUsage(data: NewProjectResource) {
    const [resource] = await db.insert(projectResources).values(data).returning();

    // Update project metrics
    const metricsUpdate: Record<string, number> = {};
    if (data.resourceType === 'api_call') {
      metricsUpdate.totalApiCalls = 1;
    }
    if (data.totalTokens) {
      metricsUpdate.totalTokensUsed = data.totalTokens;
    }

    if (Object.keys(metricsUpdate).length > 0) {
      await this.updateProjectMetrics(data.projectId, metricsUpdate);
    }

    return resource;
  }

  /**
   * Get resource usage summary for a project
   */
  static async getProjectResourceSummary(projectId: string) {
    const resources = await db
      .select()
      .from(projectResources)
      .where(eq(projectResources.projectId, projectId));

    // Aggregate by type
    const summary = {
      totalApiCalls: 0,
      totalTokens: { input: 0, output: 0, total: 0 },
      totalDurationMs: 0,
      totalCostMillicents: 0,
      byPhase: new Map<string, { tokens: number; apiCalls: number }>(),
    };

    for (const r of resources) {
      if (r.resourceType === 'api_call') summary.totalApiCalls++;
      if (r.inputTokens) summary.totalTokens.input += r.inputTokens;
      if (r.outputTokens) summary.totalTokens.output += r.outputTokens;
      if (r.totalTokens) summary.totalTokens.total += r.totalTokens;
      if (r.durationMs) summary.totalDurationMs += r.durationMs;
      if (r.estimatedCostMillicents) summary.totalCostMillicents += r.estimatedCostMillicents;

      if (r.phaseId) {
        const phase = summary.byPhase.get(r.phaseId) || { tokens: 0, apiCalls: 0 };
        phase.tokens += r.totalTokens || 0;
        phase.apiCalls += r.resourceType === 'api_call' ? 1 : 0;
        summary.byPhase.set(r.phaseId, phase);
      }
    }

    return summary;
  }

  // ========================================
  // RISK FLAG OPERATIONS
  // ========================================

  /**
   * Create a risk flag
   */
  static async createRiskFlag(data: NewProjectRiskFlag) {
    const [flag] = await db.insert(projectRiskFlags).values(data).returning();

    await this.recordEvent(data.projectId, data.phaseId ?? null, data.featureId ?? null, {
      eventType: 'risk_flagged',
      eventTitle: `Risk: ${data.riskTitle}`,
      eventDescription: data.riskDescription,
      riskLevel: data.riskLevel,
      riskReason: data.triggerReason,
    });

    return flag;
  }

  /**
   * Resolve a risk flag
   */
  static async resolveRiskFlag(flagId: string, resolution: string) {
    const [flag] = await db
      .update(projectRiskFlags)
      .set({
        isResolved: true,
        resolution,
        resolvedAt: new Date(),
      })
      .where(eq(projectRiskFlags.id, flagId))
      .returning();

    return flag;
  }

  /**
   * Get active risk flags for a project
   */
  static async getProjectRiskFlags(projectId: string, includeResolved = false) {
    if (includeResolved) {
      return db
        .select()
        .from(projectRiskFlags)
        .where(eq(projectRiskFlags.projectId, projectId))
        .orderBy(desc(projectRiskFlags.createdAt));
    }

    return db
      .select()
      .from(projectRiskFlags)
      .where(and(eq(projectRiskFlags.projectId, projectId), eq(projectRiskFlags.isResolved, false)))
      .orderBy(desc(projectRiskFlags.createdAt));
  }

  // ========================================
  // DASHBOARD DATA
  // ========================================

  /**
   * Get comprehensive dashboard data for a project
   */
  static async getProjectDashboard(projectId: string) {
    const [project, phases, recentEvents, recentTests, riskFlags, resourceSummary] =
      await Promise.all([
        this.getProjectWithDetails(projectId),
        this.getProjectPhases(projectId),
        this.getProjectTimeline(projectId, 20),
        this.getProjectTestRuns(projectId, 10),
        this.getProjectRiskFlags(projectId),
        this.getProjectResourceSummary(projectId),
      ]);

    if (!project) return null;

    // Calculate overall progress from phases
    const totalPhases = phases.length;
    const completedPhases = phases.filter((p) => p.status === 'completed').length;
    const overallProgress =
      totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

    return {
      project: {
        ...project,
        overallProgress,
      },
      phases,
      timeline: recentEvents,
      testRuns: recentTests,
      riskFlags,
      resources: resourceSummary,
    };
  }
}
