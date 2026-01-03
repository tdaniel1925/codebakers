# EDUCATION EXPERT
# Module: 25b-education.md
# Load with: 00-core.md
# Covers: Courses, lessons, enrollments, progress tracking, quizzes, certificates

---

## 📚 EDUCATION EXPERT PERSPECTIVE

When building educational applications, focus on learning outcomes,
progress tracking, and engagement mechanics.

### Education Database Schema

```typescript
// db/schema/education.ts
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

// Courses
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  thumbnail: text('thumbnail'),
  instructorId: uuid('instructor_id').notNull(),
  categoryId: uuid('category_id'),
  level: text('level').notNull(), // 'beginner', 'intermediate', 'advanced'
  status: text('status').default('draft').notNull(),
  priceInCents: integer('price_in_cents'),
  isFree: boolean('is_free').default(false),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  language: text('language').default('en'),
  certificateEnabled: boolean('certificate_enabled').default(false),
  prerequisites: jsonb('prerequisites').$type<string[]>(),
  learningObjectives: jsonb('learning_objectives').$type<string[]>(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Course Sections/Modules
export const courseSections = pgTable('course_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Lessons
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => courseSections.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  contentType: text('content_type').notNull(), // 'video', 'text', 'quiz', 'assignment'
  content: jsonb('content').$type<{
    videoUrl?: string;
    videoProvider?: 'youtube' | 'vimeo' | 'mux' | 'cloudflare';
    videoDurationSeconds?: number;
    textContent?: string;
    quizId?: string;
    assignmentInstructions?: string;
  }>(),
  durationMinutes: integer('duration_minutes'),
  isFreePreview: boolean('is_free_preview').default(false),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Enrollments
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  status: text('status').default('active').notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  completedAt: timestamp('completed_at'),
  certificateIssuedAt: timestamp('certificate_issued_at'),
  certificateUrl: text('certificate_url'),
  progressPercentage: integer('progress_percentage').default(0),
  lastAccessedAt: timestamp('last_accessed_at'),
  orderId: uuid('order_id'),
  paidAmountCents: integer('paid_amount_cents'),
});

// Lesson Progress
export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  status: text('status').default('not_started').notNull(),
  progressData: jsonb('progress_data').$type<{
    videoWatchedSeconds?: number;
    videoLastPosition?: number;
    quizScore?: number;
    quizAttempts?: number;
  }>(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Quizzes
export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  passingScore: integer('passing_score').default(70),
  timeLimit: integer('time_limit'),
  maxAttempts: integer('max_attempts'),
  shuffleQuestions: boolean('shuffle_questions').default(false),
  showCorrectAnswers: boolean('show_correct_answers').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Certificates
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id').notNull().references(() => courses.id),
  enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id),
  certificateNumber: text('certificate_number').unique().notNull(),
  recipientName: text('recipient_name').notNull(),
  courseName: text('course_name').notNull(),
  instructorName: text('instructor_name').notNull(),
  completedAt: timestamp('completed_at').notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  pdfUrl: text('pdf_url'),
  verificationUrl: text('verification_url'),
});
```

### Progress Tracking Service

```typescript
// services/education/progress-service.ts
import { db } from '@/db';
import { enrollments, lessonProgress, lessons, courses, certificates } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class ProgressService {
  static async startLesson(userId: string, lessonId: string, enrollmentId: string): Promise<void> {
    const [existing] = await db.select().from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1);

    if (existing) {
      await db.update(lessonProgress).set({
        status: existing.status === 'not_started' ? 'in_progress' : existing.status,
        startedAt: existing.startedAt || new Date(),
        updatedAt: new Date(),
      }).where(eq(lessonProgress.id, existing.id));
    } else {
      await db.insert(lessonProgress).values({
        userId, lessonId, enrollmentId, status: 'in_progress', startedAt: new Date(),
      });
    }

    await db.update(enrollments).set({ lastAccessedAt: new Date() }).where(eq(enrollments.id, enrollmentId));
  }

  static async completeLesson(
    userId: string,
    lessonId: string,
    progressData?: Record<string, unknown>
  ): Promise<{ courseCompleted: boolean }> {
    await db.update(lessonProgress).set({
      status: 'completed',
      completedAt: new Date(),
      progressData: progressData || {},
      updatedAt: new Date(),
    }).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    const progressPercentage = await this.calculateProgress(userId, lesson.courseId);

    const [enrollment] = await db.select().from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, lesson.courseId))).limit(1);

    await db.update(enrollments).set({ progressPercentage, lastAccessedAt: new Date() })
      .where(eq(enrollments.id, enrollment.id));

    if (progressPercentage === 100) {
      await this.completeCourse(userId, lesson.courseId, enrollment.id);
      return { courseCompleted: true };
    }

    return { courseCompleted: false };
  }

  static async calculateProgress(userId: string, courseId: string): Promise<number> {
    const totalLessons = await db.select({ count: count() }).from(lessons).where(eq(lessons.courseId, courseId));
    const completedLessons = await db.select({ count: count() }).from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(and(eq(lessons.courseId, courseId), eq(lessonProgress.userId, userId), eq(lessonProgress.status, 'completed')));

    const total = Number(totalLessons[0]?.count || 0);
    const completed = Number(completedLessons[0]?.count || 0);
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  static async completeCourse(userId: string, courseId: string, enrollmentId: string): Promise<void> {
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);

    await db.update(enrollments).set({
      status: 'completed', completedAt: new Date(), progressPercentage: 100,
    }).where(eq(enrollments.id, enrollmentId));

    if (course.certificateEnabled) {
      await this.issueCertificate(userId, courseId, enrollmentId);
    }
  }

  static async issueCertificate(userId: string, courseId: string, enrollmentId: string): Promise<string> {
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    const certificateNumber = `CERT-${nanoid(10).toUpperCase()}`;

    const [certificate] = await db.insert(certificates).values({
      userId, courseId, enrollmentId, certificateNumber,
      recipientName: 'Student Name',
      courseName: course.title,
      instructorName: 'Instructor Name',
      completedAt: new Date(),
      verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/certificates/verify/${certificateNumber}`,
    }).returning();

    await db.update(enrollments).set({
      certificateIssuedAt: new Date(),
      certificateUrl: certificate.verificationUrl,
    }).where(eq(enrollments.id, enrollmentId));

    return certificate.certificateNumber;
  }
}
```

### Gamification Elements

```typescript
// services/education/gamification-service.ts

export const ACHIEVEMENTS = {
  FIRST_LESSON: { id: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', points: 10 },
  COURSE_COMPLETE: { id: 'course_complete', title: 'Graduate', description: 'Complete an entire course', icon: '🎓', points: 100 },
  STREAK_7: { id: 'streak_7', title: 'Week Warrior', description: 'Learn 7 days in a row', icon: '🔥', points: 50 },
  STREAK_30: { id: 'streak_30', title: 'Monthly Master', description: 'Learn 30 days in a row', icon: '💪', points: 200 },
  QUIZ_PERFECT: { id: 'quiz_perfect', title: 'Perfect Score', description: 'Score 100% on a quiz', icon: '💯', points: 25 },
  EARLY_BIRD: { id: 'early_bird', title: 'Early Bird', description: 'Complete a lesson before 7 AM', icon: '🌅', points: 15 },
  NIGHT_OWL: { id: 'night_owl', title: 'Night Owl', description: 'Complete a lesson after 11 PM', icon: '🦉', points: 15 },
};

export class GamificationService {
  static async checkAchievements(
    userId: string,
    event: { type: 'lesson_complete' | 'course_complete' | 'quiz_complete'; data: Record<string, unknown> }
  ): Promise<string[]> {
    const awarded: string[] = [];

    switch (event.type) {
      case 'lesson_complete':
        const completedCount = await this.getCompletedLessonCount(userId);
        if (completedCount === 1) {
          await this.awardAchievement(userId, 'FIRST_LESSON');
          awarded.push('FIRST_LESSON');
        }
        break;
      case 'course_complete':
        await this.awardAchievement(userId, 'COURSE_COMPLETE');
        awarded.push('COURSE_COMPLETE');
        break;
      case 'quiz_complete':
        if (event.data.score === 100) {
          await this.awardAchievement(userId, 'QUIZ_PERFECT');
          awarded.push('QUIZ_PERFECT');
        }
        break;
    }

    return awarded;
  }

  static async awardAchievement(userId: string, achievementKey: keyof typeof ACHIEVEMENTS): Promise<void> {
    const achievement = ACHIEVEMENTS[achievementKey];
    console.log(`Awarded ${achievement.title} to user ${userId}`);
  }

  static async getCompletedLessonCount(userId: string): Promise<number> { return 0; }
  static async getCurrentStreak(userId: string): Promise<number> { return 0; }
}
```

---
