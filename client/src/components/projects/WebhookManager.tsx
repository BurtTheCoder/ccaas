import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WebhookManagerProps {
  projectId: number;
}

export function WebhookManager({ projectId }: WebhookManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: ["workflow.completed"] as string[],
    isActive: true,
  });
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null);

  const { data: webhooks, isLoading } = trpc.projects.getWebhooks.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.projects.createWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook created successfully");
      setIsCreateOpen(false);
      setNewWebhook({
        name: "",
        url: "",
        events: ["workflow.completed"],
        isActive: true,
      });
      utils.projects.getWebhooks.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create webhook: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.deleteWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook deleted successfully");
      utils.projects.getWebhooks.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete webhook: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast.error("Name and URL are required");
      return;
    }

    // Validate URL format
    try {
      new URL(newWebhook.url);
    } catch {
      toast.error("Invalid URL format");
      return;
    }

    createMutation.mutate({
      projectId,
      ...newWebhook,
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete the webhook "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const copyToClipboard = async (url: string, id: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(id);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const eventOptions = [
    { value: "workflow.started", label: "Workflow Started" },
    { value: "workflow.completed", label: "Workflow Completed" },
    { value: "workflow.failed", label: "Workflow Failed" },
    { value: "execution.completed", label: "Execution Completed" },
    { value: "execution.failed", label: "Execution Failed" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>Loading webhooks...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              Configure webhooks to receive notifications about project events
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook</DialogTitle>
                <DialogDescription>
                  Create a new webhook endpoint to receive event notifications
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name">Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="My Webhook"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://example.com/webhook"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    The endpoint that will receive POST requests
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-events">Events</Label>
                  <Select
                    value={newWebhook.events[0]}
                    onValueChange={(value) => setNewWebhook({ ...newWebhook, events: [value] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select events" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select which events should trigger this webhook
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="webhook-active"
                    checked={newWebhook.isActive}
                    onChange={(e) => setNewWebhook({ ...newWebhook, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="webhook-active" className="font-normal">
                    Active (receive events immediately)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Webhook"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!webhooks || webhooks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No webhooks configured</p>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Webhook
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate max-w-[300px]">
                          {webhook.url}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(webhook.url, webhook.id)}
                        >
                          {copiedUrl === webhook.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(webhook.id, webhook.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
