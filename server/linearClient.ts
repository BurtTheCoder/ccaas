import { LinearClient as LinearSDK, LinearDocument, Issue, Team, Project, Comment } from '@linear/sdk';
import { ENV } from './_core/env';

/**
 * Cache for team and project data to reduce API calls
 */
interface LinearCache {
  teams: Map<string, Team>;
  projects: Map<string, Project>;
  lastRefresh: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Linear API client for creating/updating issues, posting comments, and querying data
 */
export class LinearClient {
  private client: LinearSDK | null = null;
  private cache: LinearCache = {
    teams: new Map(),
    projects: new Map(),
    lastRefresh: 0,
  };

  constructor() {
    // Initialize Linear client only if API key is available
    if (ENV.linearApiKey) {
      try {
        this.client = new LinearSDK({
          apiKey: ENV.linearApiKey,
        });
        console.log('[Linear] Client initialized successfully');
      } catch (error) {
        console.error('[Linear] Failed to initialize client:', error);
        this.client = null;
      }
    } else {
      console.warn('[Linear] LINEAR_API_KEY not configured. Linear integration will be disabled.');
    }
  }

  /**
   * Check if Linear client is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Create a new issue in Linear
   *
   * @param params - Issue creation parameters
   * @returns The created issue or null if failed
   */
  async createIssue(params: {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
    assigneeId?: string;
    projectId?: string;
    labels?: string[];
    stateId?: string;
  }): Promise<Issue | null> {
    if (!this.client) {
      console.warn('[Linear] Cannot create issue: Linear client not configured');
      return null;
    }

    try {
      console.log(`[Linear] Creating issue: ${params.title} in team ${params.teamId}`);

      const issuePayload: any = {
        teamId: params.teamId,
        title: params.title,
        description: params.description,
        priority: params.priority,
        assigneeId: params.assigneeId,
        projectId: params.projectId,
        stateId: params.stateId,
      };

      // Add labels if provided
      if (params.labels && params.labels.length > 0) {
        issuePayload.labelIds = params.labels;
      }

      const issuePayloadResponse = await this.client.createIssue(issuePayload);
      const issue = await issuePayloadResponse.issue;

      if (issue) {
        console.log(`[Linear] Issue created successfully: ${issue.id} - ${issue.identifier}`);
        return issue;
      }

      console.warn('[Linear] Issue creation returned no issue object');
      return null;
    } catch (error) {
      console.error('[Linear] Failed to create issue:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return null;
    }
  }

  /**
   * Update an existing issue
   *
   * @param issueId - Issue ID to update
   * @param updates - Fields to update
   * @returns The updated issue or null if failed
   */
  async updateIssue(
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      priority?: number;
      assigneeId?: string;
      stateId?: string;
      projectId?: string;
    }
  ): Promise<Issue | null> {
    if (!this.client) {
      console.warn('[Linear] Cannot update issue: Linear client not configured');
      return null;
    }

    try {
      console.log(`[Linear] Updating issue: ${issueId}`);

      const updatePayload = await this.client.updateIssue(issueId, updates);
      const issue = await updatePayload.issue;

      if (issue) {
        console.log(`[Linear] Issue updated successfully: ${issue.identifier}`);
        return issue;
      }

      console.warn('[Linear] Issue update returned no issue object');
      return null;
    } catch (error) {
      console.error('[Linear] Failed to update issue:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return null;
    }
  }

  /**
   * Add a comment to an issue
   *
   * @param issueId - Issue ID to comment on
   * @param body - Comment body (supports markdown)
   * @returns The created comment or null if failed
   */
  async addComment(issueId: string, body: string): Promise<Comment | null> {
    if (!this.client) {
      console.warn('[Linear] Cannot add comment: Linear client not configured');
      return null;
    }

    try {
      console.log(`[Linear] Adding comment to issue: ${issueId}`);

      const commentPayload = await this.client.createComment({
        issueId,
        body,
      });
      const comment = await commentPayload.comment;

      if (comment) {
        console.log(`[Linear] Comment added successfully: ${comment.id}`);
        return comment;
      }

      console.warn('[Linear] Comment creation returned no comment object');
      return null;
    } catch (error) {
      console.error('[Linear] Failed to add comment:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return null;
    }
  }

  /**
   * Get an issue by ID
   *
   * @param issueId - Issue ID
   * @returns The issue or null if not found
   */
  async getIssue(issueId: string): Promise<Issue | null> {
    if (!this.client) {
      console.warn('[Linear] Cannot get issue: Linear client not configured');
      return null;
    }

    try {
      console.log(`[Linear] Fetching issue: ${issueId}`);

      const issue = await this.client.issue(issueId);

      if (issue) {
        console.log(`[Linear] Issue fetched successfully: ${issue.identifier}`);
        return issue;
      }

      console.warn('[Linear] Issue not found');
      return null;
    } catch (error) {
      console.error('[Linear] Failed to get issue:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return null;
    }
  }

  /**
   * Get all teams in the workspace
   *
   * @param forceRefresh - Force refresh cache
   * @returns Array of teams
   */
  async getTeams(forceRefresh: boolean = false): Promise<Team[]> {
    if (!this.client) {
      console.warn('[Linear] Cannot get teams: Linear client not configured');
      return [];
    }

    // Check cache
    const now = Date.now();
    if (!forceRefresh && this.cache.teams.size > 0 && now - this.cache.lastRefresh < CACHE_TTL) {
      console.log('[Linear] Returning cached teams');
      return Array.from(this.cache.teams.values());
    }

    try {
      console.log('[Linear] Fetching teams from API');

      const teamsData = await this.client.teams();
      const teams = await teamsData.nodes;

      // Update cache
      this.cache.teams.clear();
      teams.forEach(team => {
        this.cache.teams.set(team.id, team);
      });
      this.cache.lastRefresh = now;

      console.log(`[Linear] Fetched ${teams.length} teams`);
      return teams;
    } catch (error) {
      console.error('[Linear] Failed to get teams:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Get all projects in a team
   *
   * @param teamId - Team ID
   * @param forceRefresh - Force refresh cache
   * @returns Array of projects
   */
  async getProjects(teamId?: string, forceRefresh: boolean = false): Promise<Project[]> {
    if (!this.client) {
      console.warn('[Linear] Cannot get projects: Linear client not configured');
      return [];
    }

    try {
      console.log(`[Linear] Fetching projects${teamId ? ` for team ${teamId}` : ''}`);

      if (teamId) {
        const team = await this.client.team(teamId);
        const projectsData = await team.projects();
        const projects = await projectsData.nodes;

        console.log(`[Linear] Fetched ${projects.length} projects for team ${teamId}`);
        return projects;
      } else {
        const projectsData = await this.client.projects();
        const projects = await projectsData.nodes;

        console.log(`[Linear] Fetched ${projects.length} projects`);
        return projects;
      }
    } catch (error) {
      console.error('[Linear] Failed to get projects:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Search for issues
   *
   * @param query - Search query
   * @param limit - Maximum number of results
   * @returns Array of issues
   */
  async searchIssues(query: string, limit: number = 20): Promise<Issue[]> {
    if (!this.client) {
      console.warn('[Linear] Cannot search issues: Linear client not configured');
      return [];
    }

    try {
      console.log(`[Linear] Searching issues: ${query}`);

      const issuesData = await this.client.issues({
        filter: {
          searchableContent: {
            contains: query,
          },
        },
        first: limit,
      });
      const issues = await issuesData.nodes;

      console.log(`[Linear] Found ${issues.length} issues`);
      return issues;
    } catch (error) {
      console.error('[Linear] Failed to search issues:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Get recent issues for a team
   *
   * @param teamId - Team ID
   * @param limit - Maximum number of results
   * @returns Array of issues
   */
  async getRecentIssues(teamId?: string, limit: number = 20): Promise<Issue[]> {
    if (!this.client) {
      console.warn('[Linear] Cannot get recent issues: Linear client not configured');
      return [];
    }

    try {
      console.log(`[Linear] Fetching recent issues${teamId ? ` for team ${teamId}` : ''}`);

      const filter: any = {};
      if (teamId) {
        filter.team = { id: { eq: teamId } };
      }

      const issuesData = await this.client.issues({
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        first: limit,
      });
      const issues = await issuesData.nodes;

      console.log(`[Linear] Fetched ${issues.length} recent issues`);
      return issues;
    } catch (error) {
      console.error('[Linear] Failed to get recent issues:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Get workflow states for a team
   *
   * @param teamId - Team ID
   * @returns Array of workflow states
   */
  async getWorkflowStates(teamId: string): Promise<any[]> {
    if (!this.client) {
      console.warn('[Linear] Cannot get workflow states: Linear client not configured');
      return [];
    }

    try {
      console.log(`[Linear] Fetching workflow states for team ${teamId}`);

      const team = await this.client.team(teamId);
      const statesData = await team.states();
      const states = await statesData.nodes;

      console.log(`[Linear] Fetched ${states.length} workflow states`);
      return states;
    } catch (error) {
      console.error('[Linear] Failed to get workflow states:', error);
      if (error instanceof Error) {
        console.error('[Linear] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.teams.clear();
    this.cache.projects.clear();
    this.cache.lastRefresh = 0;
    console.log('[Linear] Cache cleared');
  }
}

// Export singleton instance
export const linearClient = new LinearClient();
