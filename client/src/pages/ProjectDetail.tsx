import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Settings,
  FileCode,
  Variable,
  Plug,
  Webhook,
  Info,
  Container,
} from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ProjectBasicInfo } from "@/components/projects/ProjectBasicInfo";
import { ContainerConfigEditor } from "@/components/projects/ContainerConfigEditor";
import { WorkflowConfigEditor } from "@/components/projects/WorkflowConfigEditor";
import { EnvironmentVariables } from "@/components/projects/EnvironmentVariables";
import { IntegrationStatus } from "@/components/projects/IntegrationStatus";
import { WebhookManager } from "@/components/projects/WebhookManager";
import { ProjectSettings } from "@/components/projects/ProjectSettings";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = parseInt(params?.id || "0");
  const [activeTab, setActiveTab] = useState("info");

  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: projectId > 0 }
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="container py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium mb-2">Project not found</p>
              <Link href="/projects">
                <Button>Back to Projects</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="info" className="gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Info</span>
            </TabsTrigger>
            <TabsTrigger value="container" className="gap-2">
              <Container className="h-4 w-4" />
              <span className="hidden sm:inline">Container</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-2">
              <FileCode className="h-4 w-4" />
              <span className="hidden sm:inline">Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="environment" className="gap-2">
              <Variable className="h-4 w-4" />
              <span className="hidden sm:inline">Environment</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            <ProjectBasicInfo
              projectId={projectId}
              initialData={{
                name: project.name,
                description: project.description,
                path: project.path,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
              }}
            />
          </TabsContent>

          <TabsContent value="container" className="space-y-6">
            <ContainerConfigEditor projectId={projectId} projectPath={project.path} />
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            <WorkflowConfigEditor projectId={projectId} projectPath={project.path} />
          </TabsContent>

          <TabsContent value="environment" className="space-y-6">
            <EnvironmentVariables projectId={projectId} />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <IntegrationStatus projectId={projectId} />
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <WebhookManager projectId={projectId} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <ProjectSettings
              projectId={projectId}
              projectName={project.name}
              initialSettings={{
                budgetLimit: undefined,
                timeout: 3600,
                maxConcurrentExecutions: 5,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
