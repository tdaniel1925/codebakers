'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  FileCode,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AIAnalysis {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  duplicateRisk: string;
  productionReady: boolean;
}

interface Submission {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  basePattern: string | null;
  reason: string | null;
  aiSummary: string | null;
  aiRating: number | null;
  aiRecommendation: string | null;
  status: string;
  createdAt: string;
  submittedByTeam?: { id: string; name: string } | null;
}

interface SubmissionDetail extends Submission {
  content: string;
  userContext: string | null;
  aiAnalysis: AIAnalysis | null;
  adminNotes: string | null;
  reviewedAt: string | null;
  addedToVersion: string | null;
  reviewedByProfile?: { id: string; fullName: string | null } | null;
}

interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  avgRating: number | null;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Detail view
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`/api/admin/submissions?status=${statusFilter}`);
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      setSubmissions(data.data.submissions);
      setStats(data.data.stats);
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissionDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/submissions/${id}`);
      if (!response.ok) throw new Error('Failed to fetch submission');
      const data = await response.json();
      setSelectedSubmission(data.data);
      setAdminNotes('');
      setShowDetailDialog(true);
    } catch (error) {
      toast.error('Failed to load submission details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const approveSubmission = async (id: string) => {
    setIsUpdating(id);
    try {
      const response = await fetch(`/api/admin/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      toast.success('Pattern approved!');
      setShowDetailDialog(false);
      setSelectedSubmission(null);
      await fetchSubmissions();
    } catch (error) {
      toast.error('Failed to approve submission');
    } finally {
      setIsUpdating(null);
    }
  };

  const rejectSubmission = async (id: string) => {
    setIsUpdating(id);
    try {
      const response = await fetch(`/api/admin/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      toast.success('Pattern rejected');
      setShowDetailDialog(false);
      setSelectedSubmission(null);
      await fetchSubmissions();
    } catch (error) {
      toast.error('Failed to reject submission');
    } finally {
      setIsUpdating(null);
    }
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    switch (recommendation) {
      case 'approve':
        return (
          <Badge className="bg-green-600">
            <ThumbsUp className="h-3 w-3 mr-1" />
            Recommend Approve
          </Badge>
        );
      case 'review':
        return (
          <Badge className="bg-yellow-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        );
      case 'reject':
        return (
          <Badge className="bg-red-600">
            <ThumbsDown className="h-3 w-3 mr-1" />
            Recommend Reject
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-slate-400';
    if (rating >= 8) return 'text-green-400';
    if (rating >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Pattern Submissions</h1>
        <p className="text-slate-400 mt-1">
          Review AI-submitted patterns for the CodeBakers library
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{stats?.pending ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Approved
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats?.approved ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Rejected
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{stats?.rejected ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Avg Rating
            </CardTitle>
            <Star className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {stats?.avgRating ? Number(stats.avgRating).toFixed(1) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submissions List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : submissions.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-16 text-center">
            <Sparkles className="h-12 w-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">No Submissions</h3>
            <p className="text-slate-400">
              {statusFilter === 'pending'
                ? 'No patterns waiting for review.'
                : `No ${statusFilter} patterns yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card
              key={submission.id}
              className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="font-mono text-white">
                        {submission.name}
                      </CardTitle>
                      {submission.category && (
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {submission.category}
                        </Badge>
                      )}
                    </div>
                    {submission.description && (
                      <CardDescription className="text-slate-400">
                        {submission.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(submission.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Analysis Summary */}
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">AI Analysis</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span className={`font-bold ${getRatingColor(submission.aiRating)}`}>
                          {submission.aiRating ?? '-'}/10
                        </span>
                      </div>
                      {getRecommendationBadge(submission.aiRecommendation)}
                    </div>
                  </div>
                  {submission.aiSummary && (
                    <p className="text-sm text-slate-300">{submission.aiSummary}</p>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    {submission.basePattern && (
                      <span>Based on: <span className="text-slate-400">{submission.basePattern}</span></span>
                    )}
                    {submission.submittedByTeam && (
                      <span>By: <span className="text-slate-400">{submission.submittedByTeam.name}</span></span>
                    )}
                  </div>
                  <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchSubmissionDetail(submission.id)}
                    disabled={isLoadingDetail}
                    className="border-slate-600 text-slate-300"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>

                  {submission.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSubmission(submission as SubmissionDetail);
                          approveSubmission(submission.id);
                        }}
                        disabled={isUpdating === submission.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isUpdating === submission.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSubmission(submission as SubmissionDetail);
                          rejectSubmission(submission.id);
                        }}
                        disabled={isUpdating === submission.id}
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                      >
                        {isUpdating === submission.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3 mr-1" />
                        )}
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileCode className="h-5 w-5 text-purple-400" />
              {selectedSubmission?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Review pattern submission details
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4 py-4">
              {/* Status & Rating */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedSubmission.status)}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className={`font-bold ${getRatingColor(selectedSubmission.aiRating)}`}>
                      {selectedSubmission.aiRating ?? '-'}/10
                    </span>
                  </div>
                  {getRecommendationBadge(selectedSubmission.aiRecommendation)}
                </div>
              </div>

              {/* AI Summary */}
              {selectedSubmission.aiSummary && (
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">AI Summary</span>
                  </div>
                  <p className="text-sm text-purple-100">{selectedSubmission.aiSummary}</p>
                </div>
              )}

              {/* AI Analysis Details */}
              {selectedSubmission.aiAnalysis && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-300 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {selectedSubmission.aiAnalysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-green-100 flex items-start gap-2">
                          <Check className="h-3 w-3 mt-1 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-300 mb-2">Weaknesses</h4>
                    <ul className="space-y-1">
                      {selectedSubmission.aiAnalysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-red-100 flex items-start gap-2">
                          <X className="h-3 w-3 mt-1 flex-shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedSubmission.aiAnalysis.suggestions.length > 0 && (
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 md:col-span-2">
                      <h4 className="text-sm font-medium text-blue-300 mb-2">Suggestions</h4>
                      <ul className="space-y-1">
                        {selectedSubmission.aiAnalysis.suggestions.map((s, i) => (
                          <li key={i} className="text-sm text-blue-100 flex items-start gap-2">
                            <Sparkles className="h-3 w-3 mt-1 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Duplicate Risk:</span>
                      <span className="text-sm text-slate-200">{selectedSubmission.aiAnalysis.duplicateRisk}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-slate-400">Production Ready:</span>
                      <Badge className={selectedSubmission.aiAnalysis.productionReady ? 'bg-green-600' : 'bg-yellow-600'}>
                        {selectedSubmission.aiAnalysis.productionReady ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Pattern Content */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Pattern Content</h4>
                <pre className="p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60 whitespace-pre-wrap">
                  {selectedSubmission.content}
                </pre>
              </div>

              {/* Context */}
              {(selectedSubmission.reason || selectedSubmission.userContext) && (
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                  {selectedSubmission.reason && (
                    <div>
                      <span className="text-sm text-slate-400">Reason: </span>
                      <span className="text-sm text-slate-200">{selectedSubmission.reason}</span>
                    </div>
                  )}
                  {selectedSubmission.userContext && (
                    <div>
                      <span className="text-sm text-slate-400">User Context: </span>
                      <span className="text-sm text-slate-200">{selectedSubmission.userContext}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              {selectedSubmission.status === 'pending' && (
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Admin Notes (optional)</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}

              {/* Existing Admin Notes */}
              {selectedSubmission.adminNotes && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <span className="text-sm text-slate-400">Admin Notes: </span>
                  <span className="text-sm text-slate-200">{selectedSubmission.adminNotes}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailDialog(false);
                setSelectedSubmission(null);
              }}
              className="border-slate-600 text-slate-300"
            >
              Close
            </Button>
            {selectedSubmission?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => rejectSubmission(selectedSubmission.id)}
                  disabled={isUpdating === selectedSubmission.id}
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  {isUpdating === selectedSubmission.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={() => approveSubmission(selectedSubmission.id)}
                  disabled={isUpdating === selectedSubmission.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isUpdating === selectedSubmission.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
