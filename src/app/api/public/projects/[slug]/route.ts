import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, projectPhases, teams } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

interface PublicPageSettings {
  showPhases?: boolean;
  showProgress?: boolean;
  showTimeline?: boolean;
  genericLabels?: boolean;
}

// Generic phase labels to avoid revealing specific implementation details
const GENERIC_PHASE_LABELS: Record<string, string> = {
  'Foundation': 'Project Setup',
  'Authentication': 'User Access',
  'Core Features': 'Core Functionality',
  'Database': 'Data Layer',
  'API': 'Backend Services',
  'Frontend': 'User Interface',
  'Testing': 'Quality Assurance',
  'Deployment': 'Launch Preparation',
  'Polish': 'Final Touches',
  'Security': 'Security Review',
  'Documentation': 'Documentation',
};

function genericizePhaseLabel(label: string): string {
  // Check if we have a generic mapping
  for (const [key, value] of Object.entries(GENERIC_PHASE_LABELS)) {
    if (label.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  // Default to generic "Phase N" format
  return label.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Development Phase';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the project by public slug
    const projectResults = await db
      .select({
        id: projects.id,
        projectName: projects.projectName,
        projectDescription: projects.projectDescription,
        status: projects.status,
        overallProgress: projects.overallProgress,
        isPublicPageEnabled: projects.isPublicPageEnabled,
        publicPageSettings: projects.publicPageSettings,
        startedAt: projects.startedAt,
        completedAt: projects.completedAt,
        lastActivityAt: projects.lastActivityAt,
        totalFilesCreated: projects.totalFilesCreated,
        totalTestsRun: projects.totalTestsRun,
        totalTestsPassed: projects.totalTestsPassed,
        teamId: projects.teamId,
      })
      .from(projects)
      .where(eq(projects.publicSlug, slug))
      .limit(1);

    if (projectResults.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const project = projectResults[0];

    // Check if public page is enabled
    if (!project.isPublicPageEnabled) {
      return NextResponse.json(
        { error: 'This project page is private' },
        { status: 403 }
      );
    }

    // Parse settings
    const settings: PublicPageSettings = project.publicPageSettings
      ? JSON.parse(project.publicPageSettings)
      : { showPhases: true, showProgress: true, showTimeline: false, genericLabels: true };

    // Get team name for branding
    const teamResults = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, project.teamId))
      .limit(1);

    const teamName = teamResults[0]?.name || 'CodeBakers Project';

    // Get phases if enabled
    let phases: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
      order: number;
    }> = [];

    if (settings.showPhases) {
      const phaseResults = await db
        .select({
          id: projectPhases.id,
          phaseName: projectPhases.phaseName,
          phaseNumber: projectPhases.phaseNumber,
          status: projectPhases.status,
          progress: projectPhases.progress,
        })
        .from(projectPhases)
        .where(eq(projectPhases.projectId, project.id))
        .orderBy(asc(projectPhases.phaseNumber));

      phases = phaseResults.map((phase) => ({
        id: phase.id,
        name: settings.genericLabels
          ? genericizePhaseLabel(phase.phaseName)
          : phase.phaseName,
        status: phase.status || 'pending',
        progress: phase.progress || 0,
        order: phase.phaseNumber,
      }));
    }

    // Calculate status display
    const statusDisplay = {
      discovery: { label: 'Getting Started', emoji: '🔍', color: 'purple' },
      planning: { label: 'Planning', emoji: '📋', color: 'blue' },
      building: { label: 'In Progress', emoji: '🏗️', color: 'yellow' },
      testing: { label: 'Testing', emoji: '🧪', color: 'orange' },
      completed: { label: 'Complete', emoji: '✅', color: 'green' },
      paused: { label: 'On Hold', emoji: '⏸️', color: 'gray' },
      failed: { label: 'Needs Attention', emoji: '⚠️', color: 'red' },
    }[project.status as string] || { label: 'In Progress', emoji: '🏗️', color: 'yellow' };

    // Build the public response - sanitized for client viewing
    const publicData = {
      projectName: project.projectName,
      // Sanitize description - remove any potentially sensitive info
      description: project.projectDescription
        ? project.projectDescription.substring(0, 200) + (project.projectDescription.length > 200 ? '...' : '')
        : null,
      teamName,
      status: statusDisplay,
      progress: settings.showProgress ? (project.overallProgress || 0) : null,
      phases: settings.showPhases ? phases : null,
      stats: {
        filesCreated: project.totalFilesCreated || 0,
        testsRun: project.totalTestsRun || 0,
        testsPassed: project.totalTestsPassed || 0,
      },
      startedAt: project.startedAt,
      completedAt: project.completedAt,
      lastActivity: project.lastActivityAt,
    };

    return NextResponse.json(publicData);
  } catch (error) {
    console.error('Error fetching public project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}
