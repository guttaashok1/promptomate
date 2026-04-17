import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpContentBlock {
  type: "text" | "image" | string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export class PlaywrightMcpClient {
  private client: Client;
  private transport?: StdioClientTransport;
  private connected = false;

  constructor() {
    this.client = new Client({ name: "promptomate", version: "0.1.0" });
  }

  async connect(opts: { headless: boolean; storageState?: string }): Promise<void> {
    const binary = path.join(process.cwd(), "node_modules/.bin/playwright-mcp");
    const args: string[] = [];
    if (opts.headless) args.push("--headless");
    if (opts.storageState) args.push("--storage-state", opts.storageState);
    this.transport = new StdioClientTransport({
      command: binary,
      args,
      stderr: "pipe",
    });
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async listTools(): Promise<McpTool[]> {
    const response = await this.client.listTools();
    return response.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema,
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: McpContentBlock[]; isError: boolean }> {
    const response = await this.client.callTool({ name, arguments: args });
    return {
      content: (response.content as McpContentBlock[]) ?? [],
      isError: !!response.isError,
    };
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
