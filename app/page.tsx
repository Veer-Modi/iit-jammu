'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  BarChart3,
  Users,
  MessageCircle,
  CheckCircle2,
  Rocket,
  Sparkles,
  DollarSign,
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-border border-t-primary rounded-full"
        ></motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold text-white">TF</span>
            </div>
            <span className="text-xl font-bold text-foreground">TaskFlow</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3"
          >
            <Link href="/auth/login">
              <Button variant="outline" className="btn-hover-lift bg-transparent">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/trial">
              <Button className="btn-hover-lift">Book 7-Day Free Trial</Button>
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            Beautiful Task Management{' '}
            <span className="bg-gradient-to-r from-primary via-blue-500 to-accent text-transparent bg-clip-text">
              For Teams
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 text-balance max-w-2xl mx-auto">
            Manage projects, collaborate with your team, and track progress with
            stunning animations and an intuitive interface. Built for startup
            founders who want to get things done.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/trial">
              <Button size="lg" className="gap-2 btn-hover-lift">
                <Rocket className="w-5 h-5" />
                Book 7-Day Free Trial
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="gap-2 btn-hover-lift bg-transparent">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20"
        >
          {[
            {
              icon: CheckCircle2,
              title: 'Smart Task Management',
              description:
                'Create, assign, and track tasks with beautiful animations and intuitive workflow states.',
              color: 'from-blue-500 to-blue-600',
            },
            {
              icon: Zap,
              title: 'Lightning Fast',
              description:
                'Optimized performance with smooth transitions and instant feedback on every interaction.',
              color: 'from-yellow-500 to-yellow-600',
            },
            {
              icon: Users,
              title: 'Team Collaboration',
              description:
                'Work together seamlessly with workspace management and real-time collaboration features.',
              color: 'from-purple-500 to-purple-600',
            },
            {
              icon: MessageCircle,
              title: 'Built-in Chat',
              description:
                'Communicate with your team directly within the platform without switching windows.',
              color: 'from-pink-500 to-pink-600',
            },
            {
              icon: BarChart3,
              title: 'Advanced Analytics',
              description:
                'Track team performance, milestone achievements, and project progress with beautiful charts.',
              color: 'from-green-500 to-green-600',
            },
            {
              icon: Rocket,
              title: 'Startup Friendly',
              description:
                'Designed specifically for startup teams who need powerful yet simple project management.',
              color: 'from-orange-500 to-orange-600',
            },
            {
              icon: Sparkles,
              title: 'AI-Powered Insights',
              description:
                'Smart task suggestions, daily summaries, and intelligent prioritization powered by AI.',
              color: 'from-violet-500 to-purple-600',
            },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ y: -5 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-primary transition-smooth hover:shadow-xl"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-3 mb-4 text-white`}
                >
                  <Icon className="w-full h-full" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>



        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center py-12 px-8 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20"
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Transform Your Workflow?
          </h2>
          <p className="text-muted-foreground mb-6 text-lg">
            Join teams using TaskFlow for task management + AI. Start with a 7-day free trial.
          </p>
          <Link href="/auth/trial">
            <Button size="lg" className="gap-2 btn-hover-lift">
              Book 7-Day Free Trial
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
          <p>© 2024 TaskFlow. Beautiful task management for teams worldwide.</p>
        </div>
      </footer>
    </div>
  );
}
