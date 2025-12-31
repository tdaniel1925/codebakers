'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Pause,
  XCircle,
  Activity,
  FileCode,
  TestTube2,
  GitBranch,
  Zap,
  Shield,
  ChevronRight,
  Circle,
  FolderTree,
  Network,
  History,
  FileText,
  Coins,
} from 'lucide-react';
import type {
  Project,
  ProjectPhase,
  ProjectEvent,
  ProjectTestRun,
  ProjectFile,
  ProjectRiskFlag,
} from '@/db';

interface DashboardData {
  project: Project & { overallProgress: number };
  phases: ProjectPhase[];
  timeline: ProjectEvent[];
  testRuns: ProjectTestRun[];
  riskFlags: ProjectRiskFlag[];
  resources: {
    totalApiCalls: number;
    totalTokens: { input: number; output: number; total: number };
    totalDurationMs: number;
    totalCostMillicents: number;
    byPhase: Map<string, { tokens: number; apiCalls: number }>;
  };
}

interface ProjectDashboardContentProps {
  dashboard: DashboardData;
  fileTree: ProjectFile[];
  testRuns: ProjectTestRun[];
}

const statusConfig = {
  discovery: { label: 'Discovery', color: 'bg-purple-500', textColor: 'text-purple-500' },
  planning: { label: 'Planning', color: 'bg-blue-500', textColor: 'text-blue-500' },
  building: { label: 'Building', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  testing: { label: 'Testing', color: 'bg-orange-500', textColor: 'text-orange-500' },
  completed: { label: 'Completed', color: 'bg-green-500', textColor: 'text-green-500' },
  paused: { label: 'Paused', color: 'bg-gray-500', textColor: 'text-gray-500' },
  failed: { label: 'Failed', color: 'bg-red-500', textColor: 'text-red-500' },
};

const phaseStatusConfig = {
  pending: { label: 'Pending', color: 'bg-gray-400', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500', icon: Activity },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle2 },
  skipped: { label: 'Skipped', color: 'bg-gray-500', icon: ChevronRight },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
};

const eventTypeIcons: Record<string, typeof Activity> = {
  project_started: Activity,
  project_completed: CheckCircle2,
  phase_started: GitBranch,
  phase_completed: CheckCircle2,
  feature_started: Zap,
  feature_completed: CheckCircle2,
  file_created: FileCode,
  file_modified: FileCode,
  test_passed: TestTube2,
  test_failed: XCircle,
  risk_flagged: AlertTriangle,
  ai_decision: Zap,
  snapshot_created: History,
  docs_generated: FileText,
};

export function ProjectDashboardContent({
  dashboard,
  fileTree,
  testRuns,
}: ProjectDashboardContentProps) {
  const { project, phases, timeline, riskFlags, resources } = dashboard;
  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.building;

  // Auto-refresh data every 30 seconds when project is active
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (project.status === 'building' || project.status === 'testing') {
      const interval = setInterval(() => {
        setLastRefresh(new Date());
        // In a real app, you'd refetch data here
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [project.status]);

  // Calculate test stats
  const totalTests = testRuns.reduce((sum, tr) => sum + (tr.totalTests || 0), 0);
  const passedTests = testRuns.reduce((sum, tr) => sum + (tr.passedTests || 0), 0);
  const testPassRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format cost
  const formatCost = (millicents: number) => {
    const dollars = millicents / 100000;
    return `$${dollars.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/projects">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{project.projectName}</h1>
            <Badge variant="secondary" className={`${status.color} text-white`}>
              {status.label}
            </Badge>
          </div>
          {project.projectDescription && (
            <p className="text-muted-foreground ml-10">{project.projectDescription}</p>
          )}
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Last activity: {new Date(project.lastActivityAt!).toLocaleString()}</p>
          {project.status === 'building' && (
            <p className="text-yellow-500 flex items-center justify-end gap-1">
              <Activity className="h-3 w-3 animate-pulse" />
              Building in progress...
            </p>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Overall Progress</span>
              <span className="text-2xl font-bold">{project.overallProgress}%</span>
            </div>
            <Progress value={project.overallProgress} className="h-3" />
            <div className="grid grid-cols-4 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold">{project.totalFilesCreated || 0}</p>
                <p className="text-sm text-muted-foreground">Files Created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{testPassRate}%</p>
                <p className="text-sm text-muted-foreground">Test Pass Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{phases.filter(p => p.status === 'completed').length}/{phases.length}</p>
                <p className="text-sm text-muted-foreground">Phases Complete</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{riskFlags.length}</p>
                <p className="text-sm text-muted-foreground">Active Risks</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
              <CardDescription>
                Real-time feed of everything happening in your project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {timeline.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No activity yet. Events will appear here as your project builds.
                    </p>
                  ) : (
                    timeline.map((event, index) => {
                      const Icon = eventTypeIcons[event.eventType] || Activity;
                      const isRisk = event.eventType === 'risk_flagged';
                      const isTest = event.eventType.includes('test');
                      const isFile = event.eventType.includes('file');

                      return (
                        <div key={event.id} className="flex gap-4">
                          <div className="relative">
                            <div className={`
                              rounded-full p-2
                              ${isRisk ? 'bg-red-100 text-red-600' :
                                isTest ? 'bg-purple-100 text-purple-600' :
                                isFile ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-600'}
                            `}>
                              <Icon className="h-4 w-4" />
                            </div>
                            {index < timeline.length - 1 && (
                              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{event.eventTitle}</p>
                                {event.eventDescription && (
                                  <p className="text-sm text-muted-foreground">
                                    {event.eventDescription}
                                  </p>
                                )}
                                {event.filePath && (
                                  <code className="text-xs bg-muted px-1 rounded">
                                    {event.filePath}
                                  </code>
                                )}
                                {event.aiConfidence && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {event.aiConfidence}% confidence
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(event.createdAt!).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phases Tab */}
        <TabsContent value="phases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Build Phases
              </CardTitle>
              <CardDescription>
                Project broken down into manageable phases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {phases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No phases defined yet. Phases will appear as the project is planned.
                  </p>
                ) : (
                  phases.map((phase) => {
                    const phaseStatus = phaseStatusConfig[phase.status as keyof typeof phaseStatusConfig] || phaseStatusConfig.pending;
                    const PhaseIcon = phaseStatus.icon;

                    return (
                      <div key={phase.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-full p-2 ${phaseStatus.color} text-white`}>
                              <PhaseIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                Phase {phase.phaseNumber}: {phase.phaseName}
                              </p>
                              {phase.phaseDescription && (
                                <p className="text-sm text-muted-foreground">
                                  {phase.phaseDescription}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{phaseStatus.label}</Badge>
                            {phase.aiConfidence && (
                              <p className="text-xs text-muted-foreground mt-1">
                                AI Confidence: {phase.aiConfidence}%
                              </p>
                            )}
                          </div>
                        </div>
                        <Progress value={phase.progress || 0} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress: {phase.progress || 0}%</span>
                          {phase.actualDuration && (
                            <span>Duration: {phase.actualDuration} min</span>
                          )}
                          {phase.tokensUsed ? (
                            <span>{phase.tokensUsed.toLocaleString()} tokens</span>
                          ) : null}
                        </div>
                        {phase.requiresApproval && !phase.approvedAt && (
                          <div className="flex items-center gap-2 text-yellow-600 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Waiting for approval
                          </div>
                        )}
                        <Separator />
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalTests}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Passed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{passedTests}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{testPassRate}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                Test Runs
              </CardTitle>
              <CardDescription>
                History of test executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {testRuns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No test runs yet. Tests will appear here as they run.
                    </p>
                  ) : (
                    testRuns.map((run) => (
                      <div
                        key={run.id}
                        className={`p-4 rounded-lg border ${
                          run.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {run.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-medium">{run.testType} tests</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(run.startedAt!).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-4 text-sm">
                          <span className="text-green-600">
                            {run.passedTests} passed
                          </span>
                          <span className="text-red-600">
                            {run.failedTests} failed
                          </span>
                          <span className="text-muted-foreground">
                            {run.skippedTests} skipped
                          </span>
                          {run.durationMs && (
                            <span className="text-muted-foreground">
                              {formatDuration(run.durationMs)}
                            </span>
                          )}
                        </div>
                        {run.testCommand && (
                          <code className="block mt-2 text-xs bg-muted px-2 py-1 rounded">
                            {run.testCommand}
                          </code>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {fileTree.filter(f => !f.isDirectory).length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Directories</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {fileTree.filter(f => f.isDirectory).length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Lines</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {fileTree.reduce((sum, f) => sum + (f.lineCount || 0), 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                File Tree
              </CardTitle>
              <CardDescription>
                Project structure as it evolves
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {fileTree.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No files tracked yet. Files will appear as they are created.
                  </p>
                ) : (
                  <div className="space-y-1 font-mono text-sm">
                    {fileTree.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2"
                        style={{ paddingLeft: `${(file.depth || 0) * 16 + 8}px` }}
                      >
                        {file.isDirectory ? (
                          <FolderTree className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <FileCode className="h-4 w-4 text-blue-500" />
                        )}
                        <span>{file.fileName}</span>
                        {file.lineCount && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {file.lineCount} lines
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Risk Flags
              </CardTitle>
              <CardDescription>
                Areas that may need human review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {riskFlags.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">No active risks</p>
                  <p className="text-muted-foreground">
                    Your project looks healthy! No issues require attention.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {riskFlags.map((flag) => {
                    const levelColors = {
                      low: 'border-yellow-300 bg-yellow-50',
                      medium: 'border-orange-300 bg-orange-50',
                      high: 'border-red-300 bg-red-50',
                      critical: 'border-red-500 bg-red-100',
                    };

                    return (
                      <div
                        key={flag.id}
                        className={`p-4 rounded-lg border-2 ${
                          levelColors[flag.riskLevel as keyof typeof levelColors]
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                              flag.riskLevel === 'critical' ? 'text-red-600' :
                              flag.riskLevel === 'high' ? 'text-red-500' :
                              flag.riskLevel === 'medium' ? 'text-orange-500' :
                              'text-yellow-500'
                            }`} />
                            <div>
                              <p className="font-medium">{flag.riskTitle}</p>
                              {flag.riskDescription && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {flag.riskDescription}
                                </p>
                              )}
                              {flag.triggerFile && (
                                <code className="text-xs bg-muted px-1 rounded mt-2 block">
                                  {flag.triggerFile}
                                </code>
                              )}
                              {flag.aiRecommendation && (
                                <div className="mt-2 p-2 bg-white rounded border">
                                  <p className="text-xs text-muted-foreground mb-1">AI Recommendation:</p>
                                  <p className="text-sm">{flag.aiRecommendation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant={flag.riskLevel === 'critical' ? 'destructive' : 'outline'}>
                            {flag.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{resources.totalApiCalls}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {resources.totalTokens.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resources.totalTokens.input.toLocaleString()} in / {resources.totalTokens.output.toLocaleString()} out
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatDuration(resources.totalDurationMs)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Est. Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatCost(resources.totalCostMillicents)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Resource Usage
              </CardTitle>
              <CardDescription>
                AI resources used during build
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Input Tokens</p>
                    <Progress
                      value={(resources.totalTokens.input / (resources.totalTokens.total || 1)) * 100}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {resources.totalTokens.input.toLocaleString()} tokens (prompts)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Output Tokens</p>
                    <Progress
                      value={(resources.totalTokens.output / (resources.totalTokens.total || 1)) * 100}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {resources.totalTokens.output.toLocaleString()} tokens (responses)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
