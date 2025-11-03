import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Executions from "./pages/Executions";
import ExecutionDetail from "./pages/ExecutionDetail";
import Workflows from "./pages/Workflows";
import WorkflowDetail from "./pages/WorkflowDetail";
import Projects from "./pages/Projects";
import Budget from "./pages/Budget";
import ApiKeys from "./pages/ApiKeys";
import Notifications from "./pages/Notifications";
import ProjectDetail from "./pages/ProjectDetail";
import Analytics from "./pages/Analytics";
import Templates from "./pages/Templates";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/executions"} component={Executions} />
      <Route path={"/executions/:id"} component={ExecutionDetail} />
      <Route path={"/workflows"} component={Workflows} />
      <Route path={"/workflows/:id"} component={WorkflowDetail} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/projects/:id"} component={ProjectDetail} />
      <Route path={"/templates"} component={Templates} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/budget"} component={Budget} />
      <Route path={"/api-keys"} component={ApiKeys} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

