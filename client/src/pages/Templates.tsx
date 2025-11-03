import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileCode, Search, RefreshCw, Star, TrendingUp, Clock, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { toast } from "sonner";

export default function Templates() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deployProjectId, setDeployProjectId] = useState<number>(0);
  const [customVariables, setCustomVariables] = useState<Record<string, any>>({});

  const { data: templates, isLoading, refetch } = trpc.templates.list.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    difficulty: difficultyFilter !== "all" ? (difficultyFilter as any) : undefined,
    search: searchQuery || undefined,
  });

  const { data: categories } = trpc.templates.categories.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: templateDetail } = trpc.templates.get.useQuery(
    { templateId: selectedTemplate?.templateId || "" },
    { enabled: !!selectedTemplate }
  );

  const deployMutation = trpc.templates.deploy.useMutation({
    onSuccess: (data) => {
      toast.success("Template deployed successfully!");
      setShowDeployDialog(false);
      setSelectedTemplate(null);
      setLocation(`/workflows/${data.workflowId}`);
    },
    onError: (error) => {
      toast.error(`Failed to deploy template: ${error.message}`);
    },
  });

  const seedMutation = trpc.templates.seedBuiltIn.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.count} built-in templates`);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to seed templates: ${error.message}`);
    },
  });

  const handleViewTemplate = (template: any) => {
    setSelectedTemplate(template);
  };

  const handleDeployTemplate = (template: any) => {
    setSelectedTemplate(template);
    setShowDeployDialog(true);
    setCustomVariables({});
  };

  const handleDeploy = () => {
    if (!deployProjectId) {
      toast.error("Please select a project");
      return;
    }

    deployMutation.mutate({
      templateId: selectedTemplate.templateId,
      projectId: deployProjectId,
      customVariables,
    });
  };

  const filteredTemplates = templates?.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const builtInTemplates = filteredTemplates?.filter(t => t.isBuiltIn) || [];
  const customTemplates = filteredTemplates?.filter(t => !t.isBuiltIn) || [];

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileCode className="h-8 w-8" />
              Workflow Templates
            </h1>
            <p className="text-muted-foreground mt-2">
              Browse and deploy pre-built workflow templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => seedMutation.mutate()}>
              <Sparkles className="h-4 w-4 mr-2" />
              Seed Built-in
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Tabs defaultValue="built-in" className="space-y-4">
          <TabsList>
            <TabsTrigger value="built-in">
              Built-in Templates ({builtInTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="custom">
              Custom Templates ({customTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="built-in">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : builtInTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtInTemplates.map((template) => (
                  <TemplateCard
                    key={template.templateId}
                    template={template}
                    onView={() => handleViewTemplate(template)}
                    onDeploy={() => handleDeployTemplate(template)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No built-in templates found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Seed Built-in" to load the official templates
                  </p>
                  <Button onClick={() => seedMutation.mutate()}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Seed Built-in Templates
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="custom">
            {customTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTemplates.map((template) => (
                  <TemplateCard
                    key={template.templateId}
                    template={template}
                    onView={() => handleViewTemplate(template)}
                    onDeploy={() => handleDeployTemplate(template)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No custom templates</p>
                  <p className="text-sm text-muted-foreground">
                    Create custom templates from your workflows
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Template Detail Dialog */}
        <Dialog open={!!selectedTemplate && !showDeployDialog} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTemplate?.name}
                {selectedTemplate?.isBuiltIn && (
                  <Badge variant="outline">Official</Badge>
                )}
              </DialogTitle>
              <DialogDescription>{selectedTemplate?.description}</DialogDescription>
            </DialogHeader>

            {templateDetail && (
              <div className="space-y-4">
                {/* Meta info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Badge className={
                      selectedTemplate.difficulty === "beginner" ? "bg-green-500/10 text-green-500" :
                      selectedTemplate.difficulty === "intermediate" ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    }>
                      {selectedTemplate.difficulty}
                    </Badge>
                  </div>
                  {selectedTemplate.estimatedTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedTemplate.estimatedTime}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedTemplate.usageCount} uses</span>
                  </div>
                  {selectedTemplate.averageRating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span>{(selectedTemplate.averageRating / 10).toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Variables */}
                {templateDetail.variables && templateDetail.variables.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Customizable Variables</h4>
                    <div className="space-y-2 text-sm">
                      {templateDetail.variables.map((v: any) => (
                        <div key={v.variableName} className="flex justify-between items-start p-2 bg-muted rounded">
                          <div>
                            <code className="text-xs bg-background px-1 py-0.5 rounded">{v.variableName}</code>
                            <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {v.required ? "Required" : "Optional"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Close
                  </Button>
                  <Button onClick={() => { setShowDeployDialog(true); }}>
                    Deploy Template
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Deploy Dialog */}
        <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Deploy Template: {selectedTemplate?.name}</DialogTitle>
              <DialogDescription>
                Configure and deploy this workflow template
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Project</Label>
                <Select value={deployProjectId?.toString()} onValueChange={(v) => setDeployProjectId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {templateDetail?.variables && templateDetail.variables.length > 0 && (
                <div>
                  <Label className="mb-2 block">Custom Variables (JSON)</Label>
                  <Textarea
                    placeholder='{"repository": "owner/repo", "targetDirectory": "src"}'
                    value={JSON.stringify(customVariables, null, 2)}
                    onChange={(e) => {
                      try {
                        setCustomVariables(JSON.parse(e.target.value));
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="font-mono text-sm h-32"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeploy} disabled={deployMutation.isPending}>
                {deployMutation.isPending ? "Deploying..." : "Deploy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
