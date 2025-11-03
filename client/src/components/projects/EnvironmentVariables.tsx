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
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
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

interface EnvironmentVariablesProps {
  projectId: number;
}

export function EnvironmentVariables({ projectId }: EnvironmentVariablesProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newVar, setNewVar] = useState({ key: "", value: "", isSecret: false });
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());

  const { data: envVars, isLoading } = trpc.projects.getEnvironmentVariables.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.projects.setEnvironmentVariable.useMutation({
    onSuccess: () => {
      toast.success("Environment variable added successfully");
      setIsCreateOpen(false);
      setNewVar({ key: "", value: "", isSecret: false });
      utils.projects.getEnvironmentVariables.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to add variable: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.deleteEnvironmentVariable.useMutation({
    onSuccess: () => {
      toast.success("Environment variable deleted successfully");
      utils.projects.getEnvironmentVariables.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete variable: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newVar.key || !newVar.value) {
      toast.error("Key and value are required");
      return;
    }

    // Validate key format (alphanumeric + underscore)
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(newVar.key)) {
      toast.error("Key must start with a letter or underscore and contain only alphanumeric characters and underscores");
      return;
    }

    createMutation.mutate({
      projectId,
      key: newVar.key,
      value: newVar.value,
      isSecret: newVar.isSecret,
    });
  };

  const handleDelete = (id: number, key: string) => {
    if (confirm(`Are you sure you want to delete the environment variable "${key}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const toggleVisibility = (id: number) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const maskValue = (value: string) => {
    return "•".repeat(Math.min(value.length, 20));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>Loading variables...</CardDescription>
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
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              Manage environment variables for this project
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Variable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Variable</DialogTitle>
                <DialogDescription>
                  Create a new environment variable for this project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    placeholder="API_KEY"
                    value={newVar.key}
                    onChange={(e) => setNewVar({ ...newVar, key: e.target.value.toUpperCase() })}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use uppercase letters, numbers, and underscores
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    placeholder="your-secret-value"
                    value={newVar.value}
                    onChange={(e) => setNewVar({ ...newVar, value: e.target.value })}
                    type={newVar.isSecret ? "password" : "text"}
                    className="font-mono"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isSecret"
                    checked={newVar.isSecret}
                    onChange={(e) => setNewVar({ ...newVar, isSecret: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isSecret" className="font-normal">
                    Mark as secret (masked in UI)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Variable"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!envVars || envVars.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No environment variables configured</p>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Variable
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envVars.map((envVar) => (
                  <TableRow key={envVar.id}>
                    <TableCell className="font-mono text-sm">{envVar.key}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {envVar.isSecret && !visibleSecrets.has(envVar.id)
                            ? maskValue(envVar.value)
                            : envVar.value}
                        </span>
                        {envVar.isSecret && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleVisibility(envVar.id)}
                          >
                            {visibleSecrets.has(envVar.id) ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {envVar.isSecret ? (
                        <Badge variant="secondary" className="text-xs">Secret</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Public</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(envVar.id, envVar.key)}
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
