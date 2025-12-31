'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  XCircle,
  Search,
  Activity,
  FileCode,
  TestTube2,
} from 'lucide-react';
import type { Project } from '@/db';

interface ProjectsListContentProps {
  projects: Project[];
}

const statusConfig = {
  discovery: { label: 'Discovery', color: 'bg-purple-500', icon: Search },
  planning: { label: 'Planning', color: 'bg-blue-500', icon: Clock },
  building: { label: 'Building', color: 'bg-yellow-500', icon: Activity },
  testing: { label: 'Testing', color: 'bg-orange-500', icon: TestTube2 },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle2 },
  paused: { label: 'Paused', color: 'bg-gray-500', icon: Pause },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
};

export function ProjectsListContent({ projects }: ProjectsListContentProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter(
    (p) =>
      p.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.projectDescription?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProjects = projects.filter(
    (p) => p.status === 'building' || p.status === 'testing'
  ).length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Track your AI-built projects in real-time
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedProjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.reduce((sum, p) => sum + (p.totalFilesCreated || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderCode className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Start building a project using CodeBakers CLI and it will appear here automatically.
              Use <code className="bg-muted px-1 rounded">codebakers build</code> to start.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.building;
            const StatusIcon = status.icon;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <FolderCode className="h-5 w-5" />
                          {project.projectName}
                        </CardTitle>
                        {project.projectDescription && (
                          <CardDescription className="line-clamp-1">
                            {project.projectDescription}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="secondary" className={`${status.color} text-white`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{project.overallProgress || 0}%</span>
                        </div>
                        <Progress value={project.overallProgress || 0} className="h-2" />
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileCode className="h-4 w-4" />
                          <span>{project.totalFilesCreated || 0} files</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TestTube2 className="h-4 w-4" />
                          <span>
                            {project.totalTestsPassed || 0}/{project.totalTestsRun || 0} tests
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {project.lastActivityAt
                              ? new Date(project.lastActivityAt).toLocaleDateString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
