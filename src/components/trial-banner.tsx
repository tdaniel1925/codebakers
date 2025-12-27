'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Clock, Github, CreditCard, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';

export type TrialStage = 'anonymous' | 'extended' | 'expired' | 'converted';

interface TrialBannerProps {
  stage: TrialStage;
  daysRemaining: number;
  canExtend?: boolean;
  githubUsername?: string | null;
  projectName?: string | null;
  onExtend?: () => void;
  onUpgrade?: () => void;
  dismissible?: boolean;
}

export function TrialBanner({
  stage,
  daysRemaining,
  canExtend = false,
  githubUsername,
  projectName,
  onExtend,
  onUpgrade,
  dismissible = true,
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Don't show for converted users or active subscribers
  if (stage === 'converted') return null;

  const isExpired = stage === 'expired' || daysRemaining <= 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 2;

  // Determine banner style based on state
  const getBannerStyle = () => {
    if (isExpired) {
      return 'bg-red-900/90 border-red-700 text-red-100';
    }
    if (isExpiringSoon) {
      return 'bg-amber-900/90 border-amber-700 text-amber-100';
    }
    return 'bg-emerald-900/90 border-emerald-700 text-emerald-100';
  };

  const getIcon = () => {
    if (isExpired) {
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    }
    if (isExpiringSoon) {
      return <Clock className="h-4 w-4 text-amber-400" />;
    }
    return <Sparkles className="h-4 w-4 text-emerald-400" />;
  };

  const getMessage = () => {
    if (isExpired) {
      if (canExtend) {
        return 'Your trial has expired. Connect GitHub for 7 more days free!';
      }
      return 'Your trial has expired. Upgrade to continue using CodeBakers.';
    }

    if (isExpiringSoon) {
      if (stage === 'anonymous' && canExtend) {
        return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left! Connect GitHub for 7 more days free.`;
      }
      return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining. Upgrade to keep building.`;
    }

    // Active trial
    if (stage === 'extended' && githubUsername) {
      return `Extended trial active (${daysRemaining} days left). Connected as @${githubUsername}.`;
    }

    return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your free trial.`;
  };

  const getActionButton = () => {
    if (isExpired || isExpiringSoon) {
      if (canExtend && stage === 'anonymous') {
        return (
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2"
            onClick={onExtend}
          >
            <Github className="h-4 w-4" />
            Extend with GitHub
          </Button>
        );
      }
      return (
        <Link href="/billing">
          <Button
            size="sm"
            className="bg-white text-gray-900 hover:bg-gray-100 gap-2"
            onClick={onUpgrade}
          >
            <CreditCard className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </Link>
      );
    }

    // Not urgent - just show days and a subtle upgrade link
    return (
      <Link href="/billing">
        <Button
          size="sm"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10 gap-2"
        >
          View plans
        </Button>
      </Link>
    );
  };

  return (
    <div
      className={`w-full px-4 py-3 border-b flex items-center justify-between gap-4 ${getBannerStyle()}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getIcon()}
        <p className="text-sm font-medium truncate">{getMessage()}</p>
        {projectName && (
          <span className="hidden md:inline-flex items-center gap-1 text-xs opacity-70">
            <span className="px-2 py-0.5 rounded bg-white/10">{projectName}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {getActionButton()}
        {dismissible && !isExpired && (
          <Button
            size="sm"
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Static trial status display (for account page)
 */
export function TrialStatusCard({
  stage,
  daysRemaining,
  expiresAt,
  githubUsername,
  projectName,
  canExtend,
}: {
  stage: TrialStage;
  daysRemaining: number;
  expiresAt: Date | null;
  githubUsername?: string | null;
  projectName?: string | null;
  canExtend?: boolean;
}) {
  const isExpired = stage === 'expired' || daysRemaining <= 0;

  const getStatusColor = () => {
    if (isExpired) return 'text-red-500';
    if (daysRemaining <= 2) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getStatusLabel = () => {
    if (stage === 'converted') return 'Converted';
    if (isExpired) return 'Expired';
    if (stage === 'extended') return 'Extended Trial';
    return 'Free Trial';
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Trial Status</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-neutral-400">Status</span>
          <span className={`font-medium ${getStatusColor()}`}>{getStatusLabel()}</span>
        </div>

        {!isExpired && (
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Days Remaining</span>
            <span className={`font-medium ${getStatusColor()}`}>
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {expiresAt && (
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Expires</span>
            <span className="text-neutral-300">
              {new Date(expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {stage === 'extended' && githubUsername && (
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Connected via</span>
            <span className="text-neutral-300 flex items-center gap-2">
              <Github className="h-4 w-4" />
              @{githubUsername}
            </span>
          </div>
        )}

        {projectName && (
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Project</span>
            <span className="text-neutral-300">{projectName}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-neutral-800 space-y-3">
          {canExtend && stage === 'anonymous' && (
            <Link href="/api/auth/github?extend=true" className="block">
              <Button variant="outline" className="w-full gap-2">
                <Github className="h-4 w-4" />
                Connect GitHub (+7 days)
              </Button>
            </Link>
          )}

          <Link href="/billing" className="block">
            <Button
              className={`w-full gap-2 ${
                isExpired ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              <CreditCard className="h-4 w-4" />
              {isExpired ? 'Upgrade Now' : 'View Plans'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
