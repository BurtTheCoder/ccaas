import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ConfigService } from "../configService";
import { ActionService } from "../actionService";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  configService: ConfigService;
  actionService: ActionService;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const configService = new ConfigService(process.cwd());
  const actionService = new ActionService();

  return {
    req: opts.req,
    res: opts.res,
    user,
    configService,
    actionService,
  };
}
