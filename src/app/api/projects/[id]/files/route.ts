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
 * GET /api/projects/[id]/files
 * Get file tree for a project (for visualization)
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

    const files = await ProjectTrackingService.getProjectFileTree(id);

    // Build tree structure for visualization
    const fileTree = buildFileTree(files);

    return successResponse({
      files,
      tree: fileTree,
      stats: {
        totalFiles: files.filter(f => !f.isDirectory).length,
        totalDirectories: files.filter(f => f.isDirectory).length,
        totalLines: files.reduce((sum, f) => sum + (f.lineCount || 0), 0),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  fileType?: string | null;
  lineCount?: number | null;
  children?: TreeNode[];
}

function buildFileTree(files: { filePath: string; fileName: string; isDirectory: boolean | null; fileType: string | null; lineCount: number | null }[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  // Sort files by path depth first
  const sortedFiles = [...files].sort((a, b) => {
    const depthA = a.filePath.split('/').length;
    const depthB = b.filePath.split('/').length;
    return depthA - depthB;
  });

  for (const file of sortedFiles) {
    const parts = file.filePath.split('/').filter(Boolean);
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let existing = currentLevel.find(n => n.name === part);

      if (!existing) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          type: isLast && !file.isDirectory ? 'file' : 'directory',
          fileType: isLast ? file.fileType : undefined,
          lineCount: isLast ? file.lineCount : undefined,
          children: isLast && !file.isDirectory ? undefined : [],
        };

        currentLevel.push(node);
        pathMap.set(currentPath, node);
        existing = node;
      }

      if (existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  return root;
}
