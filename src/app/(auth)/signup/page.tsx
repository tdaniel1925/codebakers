'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const signupSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupInput = z.infer<typeof signupSchema>;

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsWindows(navigator.platform.toLowerCase().includes('win'));
  }, []);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Check your email to confirm your account');
      router.push('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign up';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGitHub = async () => {
    setIsGitHubLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign up with GitHub';
      toast.error(message);
      setIsGitHubLoading(false);
    }
  };

  return (
    <Card className="border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-white">Create your account</CardTitle>
        <CardDescription className="text-neutral-400">Start building production-ready apps faster</CardDescription>
      </CardHeader>
      <CardContent>
        {/* GitHub OAuth */}
        <Button
          type="button"
          variant="outline"
          disabled={isGitHubLoading}
          onClick={signUpWithGitHub}
          className="w-full mb-6 border-neutral-700 bg-neutral-800/50 text-white hover:bg-neutral-700 hover:text-white"
        >
          {isGitHubLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitHubIcon className="mr-2 h-5 w-5" />
          )}
          Continue with GitHub
        </Button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-neutral-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-neutral-900 px-2 text-neutral-400">or continue with email</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      className="bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-red-500 focus:ring-red-500/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-red-500 focus:ring-red-500/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-neutral-200">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Min 8 characters"
                      className="bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-red-500 focus:ring-red-500/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="text-red-400 hover:text-red-300">
            Sign in
          </Link>
        </div>

        {/* CLI Trial Option */}
        <div className="mt-6 pt-6 border-t border-neutral-800">
          <p className="text-center text-xs text-neutral-400 mb-3">
            Want to try first? No signup needed:
          </p>
          <a
            href={isWindows ? '/install-codebakers.bat' : '/install-codebakers.command'}
            download
            className="flex items-center justify-center gap-2 w-full text-sm bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-red-400 hover:bg-neutral-700 hover:text-red-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Installer
          </a>
          <p className="text-center text-xs text-neutral-400 mt-2">
            7-day free trial, instant access
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
