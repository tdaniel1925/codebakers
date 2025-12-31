import { NextRequest } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { ProjectTrackingService } from '@/services/project-tracking-service';
import { handleApiError, successResponse, applyRateLimit } from '@/lib/api-utils';
import { NotFoundError, AuthorizationError } from '@/lib/errors';
import { db, projects } from '@/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function verifyProjectOwnership(projectId: string, teamId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project');
  }

  if (project.teamId !== teamId) {
    throw new AuthorizationError('You do not have access to this project');
  }

  return { project };
}

/**
 * GET /api/projects/[id]/dependencies
 * Get dependency graph for visualization
 * Returns data in a format suitable for D3.js force-directed graph or similar
 * Supports both API key (CLI) and session (dashboard) auth
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthOrApiKey(req);
    const { id } = await params;
    applyRateLimit(req, 'api:projects:read', auth.userId);

    await verifyProjectOwnership(id, auth.teamId);

    const dependencies = await ProjectTrackingService.getProjectDependencyGraph(id);

    // Build nodes and links for visualization
    const nodesSet = new Set<string>();
    const nodeTypes = new Map<string, string>();

    // Collect all unique files
    for (const dep of dependencies) {
      nodesSet.add(dep.sourceFile);
      nodesSet.add(dep.targetFile);
      if (dep.sourceType) nodeTypes.set(dep.sourceFile, dep.sourceType);
      if (dep.targetType) nodeTypes.set(dep.targetFile, dep.targetType);
    }

    // Create nodes array
    const nodes = Array.from(nodesSet).map(file => ({
      id: file,
      name: file.split('/').pop() || file,
      fullPath: file,
      type: nodeTypes.get(file) || 'unknown',
      // Count connections for node sizing
      connections: dependencies.filter(d => d.sourceFile === file || d.targetFile === file).length,
    }));

    // Create links array
    const links = dependencies.map(dep => ({
      source: dep.sourceFile,
      target: dep.targetFile,
      type: dep.dependencyType || 'import',
      importName: dep.importName,
    }));

    // Calculate some stats
    const stats = {
      totalNodes: nodes.length,
      totalLinks: links.length,
      avgConnections: nodes.length > 0 ? links.length / nodes.length : 0,
      byType: {} as Record<string, number>,
      mostConnected: nodes.sort((a, b) => b.connections - a.connections).slice(0, 5),
    };

    // Count by dependency type
    for (const link of links) {
      const type = link.type || 'import';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return successResponse({
      nodes,
      links,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
