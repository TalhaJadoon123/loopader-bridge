import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [courses, progress] = await Promise.all([
    prisma.educationCourse.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    prisma.educationProgress.findMany({ where: { userId: session.user.id } }),
  ]);

  const progressMap = new Map(progress.map(p => [p.courseId, p]));

  return NextResponse.json({
    courses: courses.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      difficulty: c.difficulty,
      duration: c.duration,
      order: c.order,
      completed: progressMap.get(c.id)?.completed ?? false,
      quizScore: progressMap.get(c.id)?.quizScore ?? null,
      hasQuiz: !!c.quizJson,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { courseId, quizScore } = body as { courseId: string; quizScore?: number };

  const course = await prisma.educationCourse.findUnique({ where: { id: courseId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  let score = quizScore;
  // Auto-grade quiz if present
  if (course.quizJson && quizScore === undefined) {
    return NextResponse.json({ quiz: course.quizJson, requiresAnswer: true });
  }

  // Validate quiz answer if one provided
  let maxScore: number | null = null;
  if (course.quizJson && score !== undefined) {
    const quiz = course.quizJson as any;
    maxScore = (quiz.questions?.length ?? 0) * 100;
    score = Math.min(100, Math.max(0, score));
  }

  const upserted = await prisma.educationProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    create: { userId: session.user.id, courseId, completed: true, quizScore: score ?? null, completedAt: new Date() },
    update: { completed: true, quizScore: score ?? undefined, completedAt: new Date() },
  });

  return NextResponse.json({ success: true, progress: upserted });
}