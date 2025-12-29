'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  FileCode,
  Eye,
  Save,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ModulePreview {
  name: string;
  content: string;
  isNew: boolean;
}

interface GeneratedChanges {
  claudeMd?: string;
  cursorRules?: string;
  modules?: Record<string, string>;
  summary: string;
}

export default function ModuleBuilderPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi! I'm your AI Module Builder assistant. I can help you:

• **Create new modules** - Describe a new pattern category you want to add
• **Update existing modules** - Tell me what changes you want to make
• **Add new patterns** - Describe specific code patterns to include

What would you like to work on today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedChanges, setGeneratedChanges] = useState<GeneratedChanges | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/module-builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If AI generated changes, store them
      if (data.data.changes) {
        setGeneratedChanges(data.data.changes);
        toast.success('Changes generated! Click "Preview Changes" to review.');
      }
    } catch (error) {
      toast.error('Failed to send message');
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleModuleExpand = (name: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedModules(newExpanded);
  };

  const applyChanges = async () => {
    if (!generatedChanges) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/module-builder/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: generatedChanges,
        }),
      });

      if (!response.ok) throw new Error('Failed to apply changes');

      toast.success('Changes applied and new version created!');
      setGeneratedChanges(null);
      setShowPreview(false);

      // Add confirmation message
      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '✅ Changes have been applied and a new version has been created. Users will receive the updated patterns on their next sync.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error) {
      toast.error('Failed to apply changes');
    } finally {
      setIsSaving(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Hi! I'm your AI Module Builder assistant. I can help you:

• **Create new modules** - Describe a new pattern category you want to add
• **Update existing modules** - Tell me what changes you want to make
• **Add new patterns** - Describe specific code patterns to include

What would you like to work on today?`,
        timestamp: new Date(),
      },
    ]);
    setGeneratedChanges(null);
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-400" />
            AI Module Builder
          </h1>
          <p className="text-slate-400 mt-1">
            Chat with AI to create or update pattern modules
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedChanges && (
            <Button
              onClick={() => setShowPreview(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Changes
            </Button>
          )}
          <Button
            variant="outline"
            onClick={clearChat}
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 bg-slate-800/50 border-slate-700 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                <div className="text-xs opacity-50 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to add or change..."
              className="bg-slate-700 border-slate-600 text-white resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 px-6"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-400" />
              Preview Changes
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Review the generated changes before applying
            </DialogDescription>
          </DialogHeader>

          {generatedChanges && (
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                <p className="text-purple-200 text-sm">{generatedChanges.summary}</p>
              </div>

              {/* CLAUDE.md changes */}
              {generatedChanges.claudeMd && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <button
                    onClick={() => toggleModuleExpand('claudeMd')}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-green-400" />
                      <span className="text-white font-medium">CLAUDE.md</span>
                      <Badge className="bg-green-600">Updated</Badge>
                    </div>
                    {expandedModules.has('claudeMd') ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedModules.has('claudeMd') && (
                    <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                      {generatedChanges.claudeMd}
                    </pre>
                  )}
                </div>
              )}

              {/* .cursorrules changes */}
              {generatedChanges.cursorRules && (
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <button
                    onClick={() => toggleModuleExpand('cursorRules')}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-green-400" />
                      <span className="text-white font-medium">.cursorrules</span>
                      <Badge className="bg-green-600">Updated</Badge>
                    </div>
                    {expandedModules.has('cursorRules') ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedModules.has('cursorRules') && (
                    <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                      {generatedChanges.cursorRules}
                    </pre>
                  )}
                </div>
              )}

              {/* Module files */}
              {generatedChanges.modules && Object.entries(generatedChanges.modules).map(([name, content]) => (
                <div key={name} className="bg-slate-900/50 rounded-lg p-4">
                  <button
                    onClick={() => toggleModuleExpand(name)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-blue-400" />
                      <span className="text-white font-medium">{name}</span>
                      <Badge className="bg-blue-600">Module</Badge>
                    </div>
                    {expandedModules.has(name) ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expandedModules.has(name) && (
                    <pre className="mt-3 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto max-h-60">
                      {content}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              className="border-slate-600 text-slate-300"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={applyChanges}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
