import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as executionService from "./executionService";
import * as workflowService from "./workflowService";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Project Management
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const projects = await db.listProjectsByUser(ctx.user.id);
      return Promise.all(
        projects.map(async (project) => {
          const workflowConfig = await ctx.configService.getWorkflowConfig(project.path);
          return {
            ...project,
            workflowConfig,
          };
        })
      );
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          return null;
        }
        const workflowConfig = await ctx.configService.getWorkflowConfig(project.path);
        return {
          ...project,
          workflowConfig,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        path: z.string(),
        description: z.string().optional(),
        containerConfig: z.any().optional(),
        workflowConfig: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createProject({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        path: z.string().optional(),
        description: z.string().optional(),
        containerConfig: z.any().optional(),
        workflowConfig: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return await db.updateProject(id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true };
      }),
  }),

  // Single-Agent Execution
  executions: router({
    execute: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        prompt: z.string(),
        source: z.string().optional(),
        sourceMetadata: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await executionService.execute({
          ...input,
          userId: ctx.user.id,
        });
      }),

    status: protectedProcedure
      .input(z.object({ executionId: z.string() }))
      .query(async ({ input }) => {
        return await executionService.getStatus(input.executionId);
      }),

    logs: protectedProcedure
      .input(z.object({ executionId: z.string() }))
      .query(async ({ input }) => {
        return await executionService.getLogs(input.executionId);
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await executionService.listExecutions(ctx.user.id, input.limit);
      }),
  }),

  // Multi-Agent Workflows
  workflows: router({
    execute: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        workflowName: z.string().optional(),
        context: z.any().optional(),
        source: z.string().optional(),
        sourceMetadata: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await workflowService.executeWorkflow(ctx.configService, ctx.actionService, {
          ...input,
          userId: ctx.user.id,
        });
      }),

    status: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .query(async ({ input }) => {
        return await workflowService.getWorkflowStatus(input.workflowId);
      }),

    pause: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .mutation(async ({ input }) => {
        await workflowService.pauseWorkflow(input.workflowId);
        return { success: true };
      }),

    resume: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .mutation(async ({ input }) => {
        await workflowService.resumeWorkflow(input.workflowId);
        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .mutation(async ({ input }) => {
        await workflowService.cancelWorkflow(input.workflowId);
        return { success: true };
      }),

    listActive: protectedProcedure.query(async () => {
      return await workflowService.listActiveWorkflows();
    }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await workflowService.listWorkflows(ctx.user.id, input.limit);
      }),

    logs: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .query(async ({ input }) => {
        return await db.getLogsByWorkflowId(input.workflowId);
      }),

    agentExecutions: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .query(async ({ input }) => {
        return await db.listAgentExecutionsByWorkflow(input.workflowId);
      }),
  }),

  // Budget & Metrics
  budget: router({
    today: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split('T')[0];
      return await db.getBudgetTrackingByDate(ctx.user.id, today);
    }),

    range: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getBudgetTrackingByDateRange(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // Notifications
  notifications: router({
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.listNotificationsByUser(ctx.user.id, input.unreadOnly);
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),
  }),

  // API Keys
  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.listApiKeysByUser(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        permissions: z.array(z.string()).optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const key = `sk-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        return await db.createApiKey({
          ...input,
          userId: ctx.user.id,
          key,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteApiKey(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

