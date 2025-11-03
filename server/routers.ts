import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as executionService from "./executionService";
import * as workflowService from "./workflowService";
import * as templateService from "./templateService";
import { loadBuiltInTemplates } from "./builtInTemplates";
import * as metricsService from "./metricsService";
import * as imageCache from "./imageCache";
import * as imageBuilder from "./imageBuilder";
import { linearClient } from "./linearClient";
import { testLinearWebhook } from "./linearWebhookHandler";
import { getEmailService } from "./emailService";
import * as emailTemplates from "./emailTemplates";

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

    getContainerConfig: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          return null;
        }
        try {
          const containerConfig = await ctx.configService.getContainerConfig(project.path);
          return { containerConfig: containerConfig || "" };
        } catch (error) {
          return { containerConfig: "" };
        }
      }),

    updateContainerConfig: protectedProcedure
      .input(z.object({
        id: z.number(),
        containerConfig: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          throw new Error("Project not found");
        }
        await ctx.configService.saveContainerConfig(project.path, input.containerConfig);
        return { success: true };
      }),

    getWorkflowConfig: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          return null;
        }
        try {
          const workflowConfig = await ctx.configService.getWorkflowConfigRaw(project.path);
          return { workflowConfig: workflowConfig || "" };
        } catch (error) {
          return { workflowConfig: "" };
        }
      }),

    updateWorkflowConfig: protectedProcedure
      .input(z.object({
        id: z.number(),
        workflowConfig: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) {
          throw new Error("Project not found");
        }
        await ctx.configService.saveWorkflowConfig(project.path, input.workflowConfig);
        return { success: true };
      }),

    getEnvironmentVariables: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectEnvironmentVariables(input.projectId);
      }),

    setEnvironmentVariable: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        key: z.string(),
        value: z.string(),
        isSecret: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProjectEnvironmentVariable({
          projectId: input.projectId,
          key: input.key,
          value: input.value,
          isSecret: input.isSecret ?? false,
        });
      }),

    deleteEnvironmentVariable: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProjectEnvironmentVariable(input.id);
        return { success: true };
      }),

    getIntegrations: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        // Check for configured integrations
        const linearConfig = await db.getLinearIntegrationConfigByProject(input.projectId);

        return {
          github: false, // Would check GitHub integration config
          slack: false,  // Would check Slack integration config
          linear: !!linearConfig,
          email: true,   // Email is always available if configured
        };
      }),

    getWebhooks: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectWebhooks(input.projectId);
      }),

    createWebhook: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string(),
        url: z.string(),
        events: z.array(z.string()),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createProjectWebhook({
          projectId: input.projectId,
          name: input.name,
          url: input.url,
          events: input.events,
          isActive: input.isActive ?? true,
        });
      }),

    deleteWebhook: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProjectWebhook(input.id);
        return { success: true };
      }),

    updateSettings: protectedProcedure
      .input(z.object({
        id: z.number(),
        settings: z.object({
          budgetLimit: z.number().optional(),
          timeout: z.number().optional(),
          maxConcurrentExecutions: z.number().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        // Store settings in project metadata or separate table
        // For now, we'll just return success
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

    // Email preferences
    emailPreferences: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        return await db.listEmailPreferencesByUser(ctx.user.id);
      }),

      get: protectedProcedure
        .input(z.object({
          emailType: z.string(),
          projectId: z.number().optional(),
        }))
        .query(async ({ ctx, input }) => {
          return await db.getEmailPreference(
            ctx.user.id,
            input.emailType,
            input.projectId
          );
        }),

      upsert: protectedProcedure
        .input(z.object({
          emailType: z.string(),
          projectId: z.number().optional(),
          enabled: z.boolean(),
          recipients: z.array(z.string()).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          return await db.upsertEmailPreference({
            userId: ctx.user.id,
            projectId: input.projectId,
            emailType: input.emailType,
            enabled: input.enabled,
            recipients: input.recipients,
          });
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await db.deleteEmailPreference(input.id);
          return { success: true };
        }),
    }),

    // Email queue management
    emailQueue: router({
      list: protectedProcedure
        .input(z.object({
          status: z.enum(['pending', 'sent', 'failed']).optional(),
          limit: z.number().optional(),
        }))
        .query(async ({ input }) => {
          if (input.status) {
            return await db.listEmailQueueByStatus(input.status, input.limit);
          }
          return [];
        }),

      status: protectedProcedure
        .input(z.object({ emailId: z.number() }))
        .query(async ({ input }) => {
          const emailService = getEmailService();
          return await emailService.getStatus(input.emailId);
        }),
    }),

    // Email testing
    test: protectedProcedure
      .input(z.object({
        to: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const emailService = getEmailService();
        if (!emailService.isConfigured()) {
          throw new Error('Email service not configured');
        }

        const emailHtml = emailTemplates.testEmailTemplate(input.to);
        const result = await emailService.sendImmediate({
          to: input.to,
          subject: 'Test Email - Claude Code Service',
          html: emailHtml,
        });

        return result;
      }),

    verify: protectedProcedure.query(async () => {
      const emailService = getEmailService();
      return await emailService.verify();
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

  // Analytics
  analytics: router({
    overview: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const dailyMetrics = await metricsService.getDailyMetrics(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        const execStats = await metricsService.getExecutionStats(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        const workflowStats = await metricsService.getWorkflowStats(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        const costTrends = await metricsService.getCostTrends(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        return {
          dailyMetrics,
          execStats,
          workflowStats,
          costTrends,
        };
      }),

    executions: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await metricsService.getExecutionStats(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),

    workflows: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await metricsService.getWorkflowStats(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),

    costs: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await metricsService.getCostTrends(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),

    usage: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const toolUsage = await metricsService.getToolUsage(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        const integrationMetrics = await metricsService.getIntegrationMetrics(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        return {
          toolUsage,
          integrationMetrics,
        };
      }),

    agentPerformance: protectedProcedure
      .input(z.object({ workflowId: z.string() }))
      .query(async ({ input }) => {
        return await metricsService.getAgentPerformance(input.workflowId);
      }),

    export: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        format: z.enum(['json', 'csv']),
      }))
      .query(async ({ ctx, input }) => {
        const dailyMetrics = await metricsService.getDailyMetrics(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        if (input.format === 'csv') {
          // Convert to CSV format
          const headers = ['Date', 'Executions', 'Workflows', 'Cost', 'Success', 'Failure', 'Avg Duration'];
          const rows = dailyMetrics.map(m => [
            m.date,
            m.totalExecutions.toString(),
            m.totalWorkflows.toString(),
            (m.totalCost / 100).toFixed(2),
            m.successCount.toString(),
            m.failureCount.toString(),
            (m.avgDuration / 1000).toFixed(2),
          ]);

          return {
            format: 'csv' as const,
            data: [headers, ...rows].map(row => row.join(',')).join('\n'),
          };
        }

        return {
          format: 'json' as const,
          data: JSON.stringify(dailyMetrics, null, 2),
        };
      }),
  }),

  // Container Image Cache Management
  images: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await imageCache.listCachedImages(input.limit);
      }),

    get: protectedProcedure
      .input(z.object({ imageId: z.string() }))
      .query(async ({ input }) => {
        return await imageCache.getImageMetadata(input.imageId);
      }),

    build: protectedProcedure
      .input(z.object({
        baseImage: z.string(),
        npmPackages: z.array(z.string()).optional(),
        pipPackages: z.array(z.string()).optional(),
        aptPackages: z.array(z.string()).optional(),
        systemConfig: z.record(z.string(), z.any()).optional(),
        claudeCodeVersion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const config: imageCache.ImageCacheConfig = {
          baseImage: input.baseImage,
          npmPackages: input.npmPackages,
          pipPackages: input.pipPackages,
          aptPackages: input.aptPackages,
          systemConfig: input.systemConfig,
          claudeCodeVersion: input.claudeCodeVersion,
        };

        const result = await imageBuilder.buildImage(config);
        return result;
      }),

    buildInBackground: protectedProcedure
      .input(z.object({
        baseImage: z.string(),
        npmPackages: z.array(z.string()).optional(),
        pipPackages: z.array(z.string()).optional(),
        aptPackages: z.array(z.string()).optional(),
        systemConfig: z.record(z.string(), z.any()).optional(),
        claudeCodeVersion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const config: imageCache.ImageCacheConfig = {
          baseImage: input.baseImage,
          npmPackages: input.npmPackages,
          pipPackages: input.pipPackages,
          aptPackages: input.aptPackages,
          systemConfig: input.systemConfig,
          claudeCodeVersion: input.claudeCodeVersion,
        };

        const imageId = await imageBuilder.buildImageInBackground(config);
        return { imageId };
      }),

    delete: protectedProcedure
      .input(z.object({ imageId: z.string() }))
      .mutation(async ({ input }) => {
        const metadata = await imageCache.getImageMetadata(input.imageId);
        if (metadata) {
          // Remove Docker image
          await imageBuilder.removeImage(metadata.tag);
        }

        // Delete from cache
        await imageCache.deleteCachedImage(input.imageId);
        return { success: true };
      }),

    invalidate: protectedProcedure
      .input(z.object({ baseImage: z.string() }))
      .mutation(async ({ input }) => {
        await imageCache.invalidateCache(input.baseImage);
        return { success: true };
      }),

    stats: protectedProcedure.query(async () => {
      return await imageCache.getCacheStats();
    }),

    prune: protectedProcedure.mutation(async () => {
      await imageBuilder.pruneUnusedImages();
      return { success: true };
    }),
  }),

  // Workflow Templates
  templates: router({
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
        isBuiltIn: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return await templateService.listTemplates(input);
      }),

    get: protectedProcedure
      .input(z.object({ templateId: z.string() }))
      .query(async ({ input }) => {
        return await templateService.getTemplate(input.templateId);
      }),

    deploy: protectedProcedure
      .input(z.object({
        templateId: z.string(),
        projectId: z.number(),
        customVariables: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        const workflowId = await templateService.deployTemplate(
          input.templateId,
          input.projectId,
          input.customVariables,
          ctx.user.id
        );
        return { workflowId };
      }),

    createFromWorkflow: protectedProcedure
      .input(z.object({
        workflowId: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        estimatedTime: z.string().optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { workflowId, ...metadata } = input;
        return await templateService.createTemplateFromWorkflow(
          workflowId,
          metadata,
          ctx.user.id
        );
      }),

    rate: protectedProcedure
      .input(z.object({
        templateId: z.string(),
        rating: z.number().min(1).max(5),
        review: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await templateService.rateTemplate(
          input.templateId,
          ctx.user.id,
          input.rating,
          input.review
        );
        return { success: true };
      }),

    stats: protectedProcedure
      .input(z.object({ templateId: z.string() }))
      .query(async ({ input }) => {
        return await templateService.getTemplateStats(input.templateId);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return await templateService.searchTemplates(input.query);
      }),

    categories: protectedProcedure.query(async () => {
      return templateService.getTemplateCategories();
    }),

    seedBuiltIn: protectedProcedure.mutation(async () => {
      const templates = await loadBuiltInTemplates();
      await db.seedBuiltInTemplates(templates);
      return { count: templates.length };
    }),
  }),

  // Linear Integration
  linear: router({
    test: protectedProcedure.query(async () => {
      return await testLinearWebhook();
    }),

    teams: protectedProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const teams = await linearClient.getTeams(input.forceRefresh);
        return teams.map(team => ({
          id: team.id,
          name: team.name,
          key: team.key,
        }));
      }),

    projects: protectedProcedure
      .input(z.object({ teamId: z.string().optional() }))
      .query(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const projects = await linearClient.getProjects(input.teamId);
        return projects.map(project => ({
          id: project.id,
          name: project.name,
        }));
      }),

    issues: protectedProcedure
      .input(z.object({ teamId: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const issues = await linearClient.getRecentIssues(input.teamId, input.limit);
        const formattedIssues = await Promise.all(issues.map(async (issue) => {
          const state = await issue.state;
          return {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            url: issue.url,
            state: state?.name,
            priority: issue.priority,
          };
        }));
        return formattedIssues;
      }),

    createIssue: protectedProcedure
      .input(z.object({
        teamId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        priority: z.number().optional(),
        assigneeId: z.string().optional(),
        projectId: z.string().optional(),
        labels: z.array(z.string()).optional(),
        stateId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const issue = await linearClient.createIssue(input);
        if (!issue) {
          throw new Error('Failed to create Linear issue');
        }
        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          url: issue.url,
        };
      }),

    addComment: protectedProcedure
      .input(z.object({
        issueId: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const comment = await linearClient.addComment(input.issueId, input.body);
        if (!comment) {
          throw new Error('Failed to add comment to Linear issue');
        }
        return {
          id: comment.id,
        };
      }),

    configs: protectedProcedure.query(async () => {
      return await db.listLinearIntegrationConfigs();
    }),

    getConfig: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getLinearIntegrationConfig(input.id);
      }),

    getConfigByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLinearIntegrationConfigByProject(input.projectId);
      }),

    createConfig: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        linearTeamId: z.string(),
        linearTeamName: z.string().optional(),
        linearProjectId: z.string().optional(),
        linearProjectName: z.string().optional(),
        eventTypes: z.array(z.string()),
        webhookUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createLinearIntegrationConfig(input);
      }),

    updateConfig: protectedProcedure
      .input(z.object({
        id: z.number(),
        linearProjectId: z.string().optional(),
        linearProjectName: z.string().optional(),
        eventTypes: z.array(z.string()).optional(),
        webhookUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return await db.updateLinearIntegrationConfig(id, updates);
      }),

    deleteConfig: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLinearIntegrationConfig(input.id);
        return { success: true };
      }),

    webhookEvents: protectedProcedure
      .input(z.object({ limit: z.number().optional(), processed: z.boolean().optional() }))
      .query(async ({ input }) => {
        return await db.listLinearWebhookEvents(input.limit, input.processed);
      }),

    workflowStates: protectedProcedure
      .input(z.object({ teamId: z.string() }))
      .query(async ({ input }) => {
        if (!linearClient.isConfigured()) {
          throw new Error('Linear API not configured');
        }
        const states = await linearClient.getWorkflowStates(input.teamId);
        return states.map(state => ({
          id: state.id,
          name: state.name,
          type: state.type,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;

