import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ExternalLink, Github, Slack, Mail } from "lucide-react";

interface IntegrationStatusProps {
  projectId: number;
}

interface Integration {
  name: string;
  icon: React.ReactNode;
  description: string;
  configured: boolean;
  configUrl?: string;
}

export function IntegrationStatus({ projectId }: IntegrationStatusProps) {
  const { data: integrations, isLoading } = trpc.projects.getIntegrations.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Loading integrations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const integrationsList: Integration[] = [
    {
      name: "GitHub",
      icon: <Github className="h-5 w-5" />,
      description: "Connect to GitHub repositories for code access and PR management",
      configured: integrations?.github ?? false,
      configUrl: "/settings/integrations/github",
    },
    {
      name: "Slack",
      icon: <Slack className="h-5 w-5" />,
      description: "Send workflow notifications to Slack channels",
      configured: integrations?.slack ?? false,
      configUrl: "/settings/integrations/slack",
    },
    {
      name: "Linear",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.5 3.5L20.5 20.5M3.5 20.5L20.5 3.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
      description: "Trigger workflows from Linear issue updates",
      configured: integrations?.linear ?? false,
      configUrl: "/settings/integrations/linear",
    },
    {
      name: "Email",
      icon: <Mail className="h-5 w-5" />,
      description: "Send email notifications for workflow events",
      configured: integrations?.email ?? false,
      configUrl: "/notifications",
    },
  ];

  const configuredCount = integrationsList.filter((i) => i.configured).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              {configuredCount} of {integrationsList.length} integrations configured
            </CardDescription>
          </div>
          <Badge variant={configuredCount === integrationsList.length ? "default" : "secondary"}>
            {configuredCount}/{integrationsList.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {integrationsList.map((integration) => (
            <div
              key={integration.name}
              className="flex items-start justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{integration.name}</h4>
                    {integration.configured ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Not Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {integration.description}
                  </p>
                </div>
              </div>
              {integration.configUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // In a real app, this would navigate to the config page
                    window.location.href = integration.configUrl || "#";
                  }}
                >
                  {integration.configured ? "Manage" : "Configure"}
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Configure integrations to enable advanced features like webhook triggers, automated
            notifications, and seamless repository access. Visit the settings page to set up
            each integration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
