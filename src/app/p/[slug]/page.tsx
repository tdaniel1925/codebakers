import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PublicProgressPage } from './public-progress-page';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const projectResults = await db
    .select({
      projectName: projects.projectName,
      projectDescription: projects.projectDescription,
    })
    .from(projects)
    .where(eq(projects.publicSlug, slug))
    .limit(1);

  if (projectResults.length === 0) {
    return {
      title: 'Project Not Found | CodeBakers',
    };
  }

  const project = projectResults[0];

  return {
    title: `${project.projectName} - Build Progress | CodeBakers`,
    description: project.projectDescription || `Follow the build progress of ${project.projectName}`,
    openGraph: {
      title: `${project.projectName} - Build Progress`,
      description: project.projectDescription || `Follow the build progress of ${project.projectName}`,
      type: 'website',
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  // Verify project exists and is public
  const projectResults = await db
    .select({
      id: projects.id,
      isPublicPageEnabled: projects.isPublicPageEnabled,
    })
    .from(projects)
    .where(eq(projects.publicSlug, slug))
    .limit(1);

  if (projectResults.length === 0) {
    notFound();
  }

  const project = projectResults[0];

  if (!project.isPublicPageEnabled) {
    notFound();
  }

  return <PublicProgressPage slug={slug} />;
}
